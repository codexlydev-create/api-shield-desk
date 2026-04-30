const express = require("express");
const { z } = require("zod");
const Application = require("../models/Application");
const Device = require("../models/Device");

const router = express.Router();

function badRequest(res, err) {
  return res
    .status(400)
    .json({ error: err.issues?.[0]?.message || err.message || "Invalid input" });
}

function computeStatus(app) {
  if (app.blocked) return "blocked";
  if (app.expiryDate.getTime() < Date.now()) return "expired";
  return "active";
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Public, read-only — anyone can view validity for an application id.
router.get("/applications/:id", async (req, res, next) => {
  try {
    const app = await Application.findOne({ publicId: req.params.id });
    if (!app) return res.status(404).json({ error: "Not found", id: req.params.id });

    let ms = app.expiryDate.getTime() - Date.now();
    const expired = ms <= 0;
    ms = Math.abs(ms);
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);

    res.json({
      id: app.publicId,
      expiry_date: fmtDate(app.expiryDate),
      status: computeStatus(app),
      remaining_time: expired
        ? `Expired ${days}d ${hours}h ${minutes}m ${seconds}s ago`
        : `${days}d ${hours}h ${minutes}m ${seconds}s`,
      remaining: {
        days: expired ? -days : days,
        hours: expired ? -hours : hours,
        minutes: expired ? -minutes : minutes,
        seconds: expired ? -seconds : seconds,
      },
    });
  } catch (e) {
    next(e);
  }
});

// --- Public device registration ---
const registerSchema = z.object({
  deviceName: z.string().trim().min(1).max(120),
  deviceSecret: z.string().trim().min(1).max(200),
  // status is always forced to "pending" — we accept it from the body for
  // API symmetry but ignore any other value.
  status: z.string().optional(),
});
router.post("/applications/:id/device", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const app = await Application.findOne({ publicId: req.params.id });
    if (!app) return res.status(404).json({ error: "Application not found" });

    const device = await Device.create({
      applicationId: app._id,
      applicationPublicId: app.publicId,
      deviceName: parsed.data.deviceName,
      deviceSecret: parsed.data.deviceSecret,
      status: "pending",
    });
    res.status(201).json({ device: device.toClientJSON() });
  } catch (e) {
    next(e);
  }
});

// --- Public read of all device requests for an application ---
router.get("/applications/:id/deviceAccess", async (req, res, next) => {
  try {
    const app = await Application.findOne({ publicId: req.params.id });
    if (!app) return res.status(404).json({ error: "Application not found" });
    const devices = await Device.find({ applicationId: app._id }).sort({ createdAt: -1 });
    res.json({ devices: devices.map((d) => d.toClientJSON()) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

