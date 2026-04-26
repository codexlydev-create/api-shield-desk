require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { connectDB } = require("./lib/db");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const applicationRoutes = require("./routes/applications");
const contactRoutes = require("./routes/contact");
const publicRoutes = require("./routes/public");

const app = express();
app.use(express.json({ limit: "1mb" }));

const allowed = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes("*") || allowed.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Lightweight liveness endpoints that do NOT touch the DB.
app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.get("/", (_req, res) =>
  res.json({ ok: true, name: "avm-backend", time: new Date().toISOString() }),
);

// --- Ensure MongoDB is connected before any /api/* request resolves. ---
// On Vercel cold-starts the first request triggers connect(); subsequent
// (warm) requests reuse the cached connection instantly.
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("[api] db connect failed:", err.message);
    res.status(503).json({ error: "Database temporarily unavailable. Please try again." });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/public", publicRoutes);

// Error handler — never crash the lambda; map known cases to clean statuses.
app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  // Auth errors from jsonwebtoken
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  // Mongoose / DB unavailability
  if (
    err.name === "MongooseServerSelectionError" ||
    err.name === "MongoNetworkError" ||
    /buffering timed out/i.test(err.message || "")
  ) {
    return res.status(503).json({ error: "Database temporarily unavailable. Please try again." });
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

// --- Local dev: start an HTTP listener.
// On Vercel (serverless) the platform sets process.env.VERCEL and imports
// the exported `app` directly — we must NOT call app.listen() there.
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 4000;
  connectDB()
    .then(() => {
      app.listen(PORT, () =>
        console.log(`[api] listening on http://localhost:${PORT}`),
      );
    })
    .catch((err) => {
      console.error("[mongo] initial connection failed:", err.message);
      // Still start the server so /health works; requests will retry connectDB.
      app.listen(PORT, () =>
        console.log(`[api] listening on http://localhost:${PORT} (db not connected)`),
      );
    });
}

module.exports = app;
