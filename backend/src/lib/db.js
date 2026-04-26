// Cached MongoDB connection for serverless (Vercel) environments.
//
// Why: Each invocation of a serverless function may reuse a "warm" container
// or start a new one ("cold start"). We must:
//   1. NEVER call mongoose.connect() per request.
//   2. Cache the *connection promise* on the global object so concurrent
//      requests during a cold start all await the same in-flight connect.
//   3. Disable mongoose buffering — otherwise queries silently queue for
//      10s waiting for a connection and then throw the dreaded
//      "Operation X buffering timed out after 10000ms".
//
// Usage:
//   const { connectDB } = require("../lib/db");
//   await connectDB();              // before any Model.find / Model.create
//
const mongoose = require("mongoose");

// Disable buffering globally — fail fast instead of waiting silently.
mongoose.set("bufferCommands", false);
mongoose.set("strictQuery", true);

const MONGODB_URI = process.env.MONGODB_URI;

// Reuse across hot invocations (and across module reloads in dev).
let cached = global.__mongooseCache;
if (!cached) {
  cached = global.__mongooseCache = { conn: null, promise: null };
}

async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  // Already connected and healthy → reuse immediately.
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // A connect() is already in flight from a concurrent request → await it.
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Tight timeouts so a flaky network fails fast instead of hanging
      // the whole serverless invocation.
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      maxPoolSize: 5,
      minPoolSize: 0,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((m) => {
        console.log("[mongo] connected");
        return m;
      })
      .catch((err) => {
        // Reset so the next request can retry instead of being stuck on a
        // permanently-rejected promise.
        cached.promise = null;
        console.error("[mongo] connection error:", err.message);
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connectDB };
