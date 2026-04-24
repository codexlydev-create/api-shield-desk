const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: { type: String, required: true, enum: ["register", "reset", "change-email"] },
    code: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

OtpSchema.statics.generateCode = function () {
  return String(Math.floor(100000 + Math.random() * 900000));
};

module.exports = mongoose.model("Otp", OtpSchema);
