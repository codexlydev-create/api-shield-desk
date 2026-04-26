const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email }, JWT_SECRET, {
    expiresIn: "30d",
  });
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    let user;
    try {
      user = await User.findById(payload.sub);
    } catch (dbErr) {
      // DB unavailable / timeout — return 503 (transient) so the client
      // does NOT clear the auth token and log the user out.
      console.error("[auth] user lookup failed:", dbErr.message);
      return res
        .status(503)
        .json({ error: "Database temporarily unavailable. Please try again." });
    }

    if (!user) return res.status(401).json({ error: "Invalid token" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { signToken, requireAuth };
