const express = require("express");
const { z } = require("zod");
const { sendMail } = require("../lib/mailer");

const router = express.Router();

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  message: z.string().trim().min(10).max(2000),
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    }
    const { name, email, message } = parsed.data;
    const to =
      process.env.CONTACT_TO ||
      process.env.EMAIL_USER ||
      process.env.GMAIL_USER;
    const safeMsg = message.replace(/</g, "&lt;").replace(/\n/g, "<br/>");
    await sendMail({
      to,
      replyTo: email,
      subject: `New contact-form message from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;background:#0b0b0f;padding:24px;color:#fff">
          <div style="max-width:560px;margin:0 auto;background:#15151c;border:1px solid #2a2a35;border-radius:14px;padding:24px">
            <h2 style="margin:0 0 12px;font-size:18px">New contact form message</h2>
            <p style="margin:0;color:#aaa"><strong style="color:#fff">From:</strong> ${name} &lt;${email}&gt;</p>
            <hr style="border:none;border-top:1px solid #2a2a35;margin:16px 0"/>
            <div style="line-height:1.55;color:#ddd">${safeMsg}</div>
          </div>
        </div>`,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
