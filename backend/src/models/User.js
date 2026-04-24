const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

UserSchema.methods.toPublicJSON = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    emailVerified: this.emailVerified,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", UserSchema);
