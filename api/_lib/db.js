/* ================================================================
   db.js — MongoDB Connection + Mongoose Models + GridFS Bucket
   
   This module provides:
     1. A cached Mongoose connection for users/projects
     2. A native MongoDB GridFS bucket for streaming audio stems
   
   GridFS splits files into 255 KB chunks, so there's no 16 MB 
   document limit. Audio stems (~2-5 MB as MP3) are stored and 
   streamed directly from MongoDB Atlas.
   ================================================================ */

import mongoose from "mongoose";
import { MongoClient, GridFSBucket } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "MONGODB_URI is not defined. Add it to your .env or Vercel environment variables."
  );
}

/* ================================================================
   1. Mongoose Connection (for Users & Projects)
   ================================================================ */

let cached = global.__mongooseCache;
if (!cached) {
  cached = global.__mongooseCache = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        maxPoolSize: 10,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

/* ================================================================
   2. Native MongoClient + GridFS (for audio file storage)
   ================================================================ */

let nativeClient = global.__nativeMongoClient;
if (!nativeClient) {
  nativeClient = global.__nativeMongoClient = { client: null, promise: null };
}

/**
 * Returns the native MongoDB database handle for GridFS operations.
 * Uses a separate cached connection pool from Mongoose.
 */
export async function getNativeDB() {
  if (nativeClient.client) {
    return nativeClient.client.db();
  }

  if (!nativeClient.promise) {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 5,
    });
    nativeClient.promise = client.connect().then(() => {
      nativeClient.client = client;
      return client;
    });
  }

  const client = await nativeClient.promise;
  return client.db();
}

/**
 * Returns a GridFSBucket instance for uploading/downloading audio stems.
 * Bucket name: "stems" → creates collections: stems.files + stems.chunks
 */
export async function getGridFSBucket() {
  const db = await getNativeDB();
  return new GridFSBucket(db, { bucketName: "stems" });
}

/* ================================================================
   3. Mongoose Schemas & Models
   ================================================================ */

// ---------- User Schema ----------
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// ---------- Project Schema ----------
// stems now stores GridFS ObjectId strings (not external URLs)
const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    stems: {
      vocals: { type: String, default: "" },   // GridFS file ID as string
      drums: { type: String, default: "" },
      bass: { type: String, default: "" },
      other: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

// Prevent model recompilation during hot-reload
export const User =
  mongoose.models.User || mongoose.model("User", userSchema);

export const Project =
  mongoose.models.Project || mongoose.model("Project", projectSchema);
