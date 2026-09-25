import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

export function isDbConfigured(): boolean {
  return !!process.env.MONGODB_URI;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local to enable saved jobs."
    );
  }

  const cache = (globalThis as { mongooseCache?: MongooseCache });
  cache.mongooseCache ??= { conn: null, promise: null };

  if (cache.mongooseCache.conn) return cache.mongooseCache.conn;

  if (!cache.mongooseCache.promise) {
    cache.mongooseCache.promise = mongoose.connect(process.env.MONGODB_URI, {
      dbName: "remotefromapac",
    });
  }
  cache.mongooseCache.conn = await cache.mongooseCache.promise;
  return cache.mongooseCache.conn;
}
