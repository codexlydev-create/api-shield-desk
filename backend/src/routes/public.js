const express = require("express");
const Application = require("../models/Application");

const router = express.Router();

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

module.exports = router;
