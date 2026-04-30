const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    // Denormalised public id of the parent application — handy for queries
    // and for returning data without an extra populate.
    applicationPublicId: { type: String, required: true, index: true },
    deviceName: { type: String, required: true, trim: true, maxlength: 120 },
    deviceSecret: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
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
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

module.exports = mongoose.model("Device", DeviceSchema);
