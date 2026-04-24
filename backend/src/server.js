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

const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Add it to backend/.env");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("[mongo] connected");
    app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("[mongo] connection failed:", err.message);
    process.exit(1);
  });
