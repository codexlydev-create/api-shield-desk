const express = require("express");
const { z } = require("zod");
const Application = require("../models/Application");
const Device = require("../models/Device");
const Location = require("../models/Location");

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

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
}

function derivePlatform(info) {
  if (!info || typeof info !== "object") return null;
  const product = info.product_name || info.system || null;
  const build = info.current_build ? ` (build ${info.current_build})` : "";
  if (product) return `${product}${build}`;
  return info.platform || null;
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
      createdAt: app.createdAt.toISOString(),
      expiresAt: app.expiryDate.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

// --- Public device registration ---
const registerSchema = z.object({
  deviceName: z.string().trim().min(1).max(120),
  deviceSecret: z.string().trim().min(1).max(200),
  status: z.string().optional(),
  windowsInfo: z.record(z.any()).optional(),
  registrationTime: z.string().optional(),
  formattedRegistrationTime: z.string().optional(),
});
router.post("/applications/:id/device", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const app = await Application.findOne({ publicId: req.params.id });
    if (!app) return res.status(404).json({ error: "Application not found" });

    const ip = getClientIp(req);
    const platform = derivePlatform(parsed.data.windowsInfo);
    const device = await Device.create({
      applicationId: app._id,
      applicationPublicId: app.publicId,
      deviceName: parsed.data.deviceName,
      deviceSecret: parsed.data.deviceSecret,
      status: app.autoApproveDevices ? "approved" : "pending",
      windowsInfo: parsed.data.windowsInfo || null,
      registrationTime: parsed.data.registrationTime || null,
      formattedRegistrationTime: parsed.data.formattedRegistrationTime || null,
      ip,
      platform,
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

// --- Public location ingest ---
// Every call appends a new record — full history is preserved.
const locationSchema = z.object({
  deviceSecret: z.string().trim().min(1).max(200),
  timestamp: z.string().optional(),
  formattedDateTime: z.string().optional(),
  location: z.record(z.any()).optional(),
  windowsInfo: z.record(z.any()).optional(),
});
router.post("/applications/:id/location", async (req, res, next) => {
  try {
    const parsed = locationSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const app = await Application.findOne({ publicId: req.params.id });
    if (!app) return res.status(404).json({ error: "Application not found" });

    // Best-effort device match by secret (history still stored even if unmatched).
    const device = await Device.findOne({
      applicationId: app._id,
      deviceSecret: parsed.data.deviceSecret,
    });

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"] || null;
    const entry = await Location.create({
      applicationId: app._id,
      applicationPublicId: app.publicId,
      deviceId: device ? device._id : null,
      deviceSecret: parsed.data.deviceSecret,
      timestamp: parsed.data.timestamp || new Date().toISOString(),
      formattedDateTime: parsed.data.formattedDateTime || fmtDate(new Date()),
      location: parsed.data.location || null,
      windowsInfo: parsed.data.windowsInfo || null,
      ip,
      userAgent,
    });

    // Keep device's latest IP / platform / windowsInfo in sync.
    if (device) {
      let dirty = false;
      if (parsed.data.windowsInfo && !device.windowsInfo) {
        device.windowsInfo = parsed.data.windowsInfo;
        dirty = true;
      }
      const platform = derivePlatform(parsed.data.windowsInfo || device.windowsInfo);
      if (platform && device.platform !== platform) {
        device.platform = platform;
        dirty = true;
      }
      if (ip && device.ip !== ip) {
        device.ip = ip;
        dirty = true;
      }
      if (dirty) await device.save();
    }

    res.status(201).json({ location: entry.toClientJSON() });
  } catch (e) {
    next(e);
  }
});

// --- Public read of location history for an application ---
router.get("/applications/:id/locations", async (req, res, next) => {
  try {

    const app = await Application.findOne({ publicId: req.params.id });
    if (!app) return res.status(404).json({ error: "Application not found" });
    const filter = { applicationId: app._id };
    if (req.query.deviceSecret) filter.deviceSecret = String(req.query.deviceSecret);
    const items = await Location.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 500, 2000));
    res.json({ locations: items.map((l) => l.toClientJSON()) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
