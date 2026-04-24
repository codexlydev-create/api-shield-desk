const nodemailer = require("nodemailer");

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

let transporter = null;
function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set in backend/.env");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text, html, replyTo }) {
  const tx = getTransporter();
  return tx.sendMail({
    from: `"APPLICATION Validity Manager" <${GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
    replyTo,
  });
}

function otpEmail(code, purpose) {
  const labels = {
    register: "Verify your email",
    reset: "Reset your password",
    "change-email": "Confirm your new email",
  };
  const title = labels[purpose] || "Your verification code";
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;background:#0b0b0f;padding:32px;color:#fff">
    <div style="max-width:520px;margin:0 auto;background:#15151c;border-radius:16px;padding:32px;border:1px solid #2a2a35">
      <h1 style="margin:0 0 8px;font-size:22px">${title}</h1>
      <p style="margin:0 0 20px;color:#aaa">Use the code below. It expires in 10 minutes.</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:700;text-align:center;background:#1f1f29;border-radius:12px;padding:18px 0">${code}</div>
      <p style="margin-top:24px;font-size:12px;color:#888">If you didn't request this, ignore this email.</p>
    </div>
  </div>`;
  return { subject: `${title} — code ${code}`, text: `Your code is ${code}. It expires in 10 minutes.`, html };
}

module.exports = { sendMail, otpEmail };
