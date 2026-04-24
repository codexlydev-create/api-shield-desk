const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { signToken } = require("../lib/auth");
const { sendMail, otpEmail } = require("../lib/mailer");

const router = express.Router();

const TEN_MIN = 10 * 60 * 1000;

function badRequest(res, err) {
  return res.status(400).json({ error: err.issues?.[0]?.message || err.message || "Invalid input" });
}

// ---- Register: start ----
const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72),
});
router.post("/register/start", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const { name, email, password } = parsed.data;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });

    const code = Otp.generateCode();
    const passwordHash = await bcrypt.hash(password, 10);

    await Otp.deleteMany({ email: email.toLowerCase(), purpose: "register" });
    await Otp.create({
      email: email.toLowerCase(),
      purpose: "register",
      code,
      payload: { name, passwordHash },
      expiresAt: new Date(Date.now() + TEN_MIN),
    });

    const { subject, text, html } = otpEmail(code, "register");
    await sendMail({ to: email, subject, text, html });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---- Register: verify ----
const verifyRegisterSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().regex(/^\d{6}$/),
});
router.post("/register/verify", async (req, res, next) => {
  try {
    const parsed = verifyRegisterSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const { email, code } = parsed.data;

    const rec = await Otp.findOne({
      email: email.toLowerCase(),
      purpose: "register",
      code,
      expiresAt: { $gt: new Date() },
    });
    if (!rec) return res.status(400).json({ error: "Invalid or expired code" });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      await Otp.deleteOne({ _id: rec._id });
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const user = await User.create({
      name: rec.payload.name,
      email: email.toLowerCase(),
      passwordHash: rec.payload.passwordHash,
      emailVerified: true,
    });
    await Otp.deleteOne({ _id: rec._id });

    const token = signToken(user);
    res.json({ token, user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
});

// ---- Login ----
const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const { email, password } = parsed.data;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "No account found with that email." });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Incorrect password." });

    if (!user.emailVerified) return res.status(403).json({ error: "Please verify your email first." });

    const token = signToken(user);
    res.json({ token, user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
});

// ---- Forgot password: start ----
const forgotStartSchema = z.object({ email: z.string().trim().email() });
router.post("/forgot/start", async (req, res, next) => {
  try {
    const parsed = forgotStartSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const { email } = parsed.data;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "No account with that email." });

    const code = Otp.generateCode();
    await Otp.deleteMany({ email: email.toLowerCase(), purpose: "reset" });
    await Otp.create({
      email: email.toLowerCase(),
      purpose: "reset",
      code,
      expiresAt: new Date(Date.now() + TEN_MIN),
    });
    const { subject, text, html } = otpEmail(code, "reset");
    await sendMail({ to: email, subject, text, html });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---- Forgot password: verify + reset ----
const forgotVerifySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(8).max(72),
});
router.post("/forgot/verify", async (req, res, next) => {
  try {
    const parsed = forgotVerifySchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const { email, code, password } = parsed.data;

    const rec = await Otp.findOne({
      email: email.toLowerCase(),
      purpose: "reset",
      code,
      expiresAt: { $gt: new Date() },
    });
    if (!rec) return res.status(400).json({ error: "Invalid or expired code" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "No account with that email." });

    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();
    await Otp.deleteOne({ _id: rec._id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
