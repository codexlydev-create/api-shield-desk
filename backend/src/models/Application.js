const mongoose = require("mongoose");
const { randomId, randomKey } = require("../lib/ids");

const ApplicationSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true }, // 8-char short id
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    expiryDate: { type: Date, required: true },
    blocked: { type: Boolean, default: false },
    apiKey: { type: String, required: true },
  },
  { timestamps: true },
);

ApplicationSchema.statics.generateUniquePublicId = async function () {
  // 36^8 = ~2.8 trillion combinations; collisions are rare but check anyway.
  for (let i = 0; i < 5; i++) {
    const id = randomId(8);
    const exists = await this.exists({ publicId: id });
    if (!exists) return id;
  }
  throw new Error("Failed to generate unique application id");
};

ApplicationSchema.statics.generateApiKey = function () {
  return randomKey();
};

ApplicationSchema.methods.toClientJSON = function () {
  return {
    id: this.publicId,
    ownerId: this.ownerId.toString(),
    name: this.name,
    description: this.description,
    expiryDate: this.expiryDate.toISOString(),
    blocked: this.blocked,
    apiKey: this.apiKey,
    createdAt: this.createdAt.toISOString(),
  };
};

module.exports = mongoose.model("Application", ApplicationSchema);
