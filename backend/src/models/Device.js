const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    applicationPublicId: { type: String, required: true, index: true },
    deviceName: { type: String, required: true, trim: true, maxlength: 120 },
    deviceSecret: { type: String, required: true, trim: true, maxlength: 200, index: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    windowsInfo: { type: mongoose.Schema.Types.Mixed, default: null },
    registrationTime: { type: String, default: null },
    formattedRegistrationTime: { type: String, default: null },
  },
  { timestamps: true },
);

DeviceSchema.methods.toClientJSON = function () {
  return {
    id: this._id.toString(),
    applicationId: this.applicationPublicId,
    deviceName: this.deviceName,
    deviceSecret: this.deviceSecret,
    status: this.status,
    windowsInfo: this.windowsInfo || null,
    registrationTime: this.registrationTime || null,
    formattedRegistrationTime: this.formattedRegistrationTime || null,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

module.exports = mongoose.model("Device", DeviceSchema);
