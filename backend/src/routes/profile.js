const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const User = require("../models/User");
const Otp = require("../models/Otp");
const { requireAuth } = require("../lib/auth");
const { sendMail, otpEmail } = require("../lib/mailer");

const router = express.Router();
const TEN_MIN = 10 * 60 * 1000;

function badRequest(res, err) {
  return res.status(400).json({ error: err.issues?.[0]?.message || err.message || "Invalid input" });
}

router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
});

const startEmailSchema = z.object({ newEmail: z.string().trim().email() });
router.post("/email/start", requireAuth, async (req, res, next) => {
  try {
    const parsed = startEmailSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const newEmail = parsed.data.newEmail.toLowerCase();
    if (newEmail === req.user.email) return res.status(400).json({ error: "That's already your email." });
    const exists = await User.findOne({ email: newEmail });
    if (exists) return res.status(409).json({ error: "Email already in use" });

    const code = Otp.generateCode();
    await Otp.deleteMany({ email: newEmail, purpose: "change-email" });
    await Otp.create({
      email: newEmail,
      purpose: "change-email",
      code,
      payload: { userId: req.user._id.toString() },
      expiresAt: new Date(Date.now() + TEN_MIN),
    });
    const { subject, text, html } = otpEmail(code, "change-email");
    await sendMail({ to: newEmail, subject, text, html });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const verifyEmailSchema = z.object({
  newEmail: z.string().trim().email(),
  code: z.string().regex(/^\d{6}$/),
});
router.post("/email/verify", requireAuth, async (req, res, next) => {
  try {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const newEmail = parsed.data.newEmail.toLowerCase();

    const rec = await Otp.findOne({
      email: newEmail,
      purpose: "change-email",
      code: parsed.data.code,
      expiresAt: { $gt: new Date() },
    });
    if (!rec || rec.payload?.userId !== req.user._id.toString()) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    req.user.email = newEmail;
    req.user.emailVerified = true;
    await req.user.save();
    await Otp.deleteOne({ _id: rec._id });
    res.json({ user: req.user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
});

const passwordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8).max(72),
});
router.post("/password", requireAuth, async (req, res, next) => {
  try {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);

    const ok = await bcrypt.compare(parsed.data.current, req.user.passwordHash);
    if (!ok) return res.status(400).json({ error: "Incorrect current password" });

    req.user.passwordHash = await bcrypt.hash(parsed.data.next, 10);
    await req.user.save();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
