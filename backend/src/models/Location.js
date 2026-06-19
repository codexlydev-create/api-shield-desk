const mongoose = require("mongoose");

const LocationSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    applicationPublicId: { type: String, required: true, index: true },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      default: null,
      index: true,
    },
    deviceSecret: { type: String, required: true, index: true },
    timestamp: { type: String, default: null },
    formattedDateTime: { type: String, default: null },
    location: { type: mongoose.Schema.Types.Mixed, default: null },
    windowsInfo: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);

LocationSchema.methods.toClientJSON = function () {
  return {
    id: this._id.toString(),
    applicationId: this.applicationPublicId,
    deviceId: this.deviceId ? this.deviceId.toString() : null,
    deviceSecret: this.deviceSecret,
    timestamp: this.timestamp || null,
    formattedDateTime: this.formattedDateTime || null,
    location: this.location || null,
    windowsInfo: this.windowsInfo || null,
    ip: this.ip || null,
    userAgent: this.userAgent || null,
    createdAt: this.createdAt.toISOString(),
  };
};

module.exports = mongoose.model("Location", LocationSchema);
