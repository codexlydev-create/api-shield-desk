require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

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

app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.get("/", (_req, res) =>
  res.json({ ok: true, name: "avm-backend", time: new Date().toISOString() }),
);

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/public", publicRoutes);

// Error handler
app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  // On Vercel, surface a clear error rather than crashing the lambda boot.
  console.error("MONGODB_URI is not set. Add it to your environment.");
}

// --- Mongo connection (cached for serverless) ---
// On Vercel, each invocation may reuse a warm container. We cache the
// connection promise on the global object so we don't open a new socket
// for every request.
let cachedConn = global.__mongoConn;
async function connectMongo() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is not configured");
  if (cachedConn) return cachedConn;
  cachedConn = mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
  });
  global.__mongoConn = cachedConn;
  await cachedConn;
  console.log("[mongo] connected");
  return cachedConn;
}

// Ensure DB is ready before any /api/* request resolves on serverless cold-starts.
app.use(async (req, res, next) => {
  try {
    if (MONGODB_URI) await connectMongo();
    next();
  } catch (e) {
    next(e);
  }
});

// --- Local dev: start an HTTP listener.
// On Vercel (serverless) the platform sets process.env.VERCEL and imports
// the exported `app` directly — we must NOT call app.listen() there.
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 4000;
  if (MONGODB_URI) {
    connectMongo()
      .then(() => {
        app.listen(PORT, () =>
          console.log(`[api] listening on http://localhost:${PORT}`),
        );
      })
      .catch((err) => {
        console.error("[mongo] connection failed:", err.message);
        process.exit(1);
      });
  } else {
    app.listen(PORT, () =>
      console.log(`[api] listening on http://localhost:${PORT} (no MONGODB_URI)`),
    );
  }
}

module.exports = app;
