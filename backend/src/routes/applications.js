const express = require("express");
const { z } = require("zod");
const Application = require("../models/Application");
const Device = require("../models/Device");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

function badRequest(res, err) {
  return res.status(400).json({ error: err.issues?.[0]?.message || err.message || "Invalid input" });
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const apps = await Application.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
    res.json({ applications: apps.map((a) => a.toClientJSON()) });
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional().default(""),
  expiryDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid expiry date"),
});
router.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const publicId = await Application.generateUniquePublicId();
    const app = await Application.create({
      publicId,
      ownerId: req.user._id,
      name: parsed.data.name,
      description: parsed.data.description || "",
      expiryDate: new Date(parsed.data.expiryDate),
      apiKey: Application.generateApiKey(),
    });
    res.status(201).json({ application: app.toClientJSON() });
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(300).optional(),
  expiryDate: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), "Invalid expiry date")
    .optional(),
  blocked: z.boolean().optional(),
});
router.patch("/:id", async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const app = await Application.findOne({ publicId: req.params.id, ownerId: req.user._id });
    if (!app) return res.status(404).json({ error: "Not found" });

    if (parsed.data.name !== undefined) app.name = parsed.data.name;
    if (parsed.data.description !== undefined) app.description = parsed.data.description;
    if (parsed.data.expiryDate !== undefined) app.expiryDate = new Date(parsed.data.expiryDate);
    if (parsed.data.blocked !== undefined) app.blocked = parsed.data.blocked;
    await app.save();
    res.json({ application: app.toClientJSON() });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await Application.deleteOne({ publicId: req.params.id, ownerId: req.user._id });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// --- Owner-only device management ---
// List devices for an application (owner only — returns same shape as the
// public route, but enforces ownership so the owner can manage them).
router.get("/:id/devices", async (req, res, next) => {
  try {
    const app = await Application.findOne({ publicId: req.params.id, ownerId: req.user._id });
    if (!app) return res.status(404).json({ error: "Not found" });
    const devices = await Device.find({ applicationId: app._id }).sort({ createdAt: -1 });
    res.json({ devices: devices.map((d) => d.toClientJSON()) });
  } catch (e) {
    next(e);
  }
});

const deviceUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
});
router.patch("/:id/devices/:deviceId", async (req, res, next) => {
  try {
    const parsed = deviceUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues?.[0]?.message || "Invalid input" });
    }
    const app = await Application.findOne({ publicId: req.params.id, ownerId: req.user._id });
    if (!app) return res.status(404).json({ error: "Not found" });

    const device = await Device.findOne({ _id: req.params.deviceId, applicationId: app._id });
    if (!device) return res.status(404).json({ error: "Device not found" });

    device.status = parsed.data.status;
    await device.save();
    res.json({ device: device.toClientJSON() });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id/devices/:deviceId", async (req, res, next) => {
  try {
    const app = await Application.findOne({ publicId: req.params.id, ownerId: req.user._id });
    if (!app) return res.status(404).json({ error: "Not found" });
    const result = await Device.deleteOne({ _id: req.params.deviceId, applicationId: app._id });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Device not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

