// ---------- Imports ----------
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const { connectDB } = require("./db");
const { createClient } = require("@supabase/supabase-js");


// ---------- Config ----------
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const BASE_URL = `http://localhost:${PORT}`;

// ---------- App & Server ----------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// supabase config
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);



// Multer memory storage for Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------- Routes ----------

// Upload PDF to Cloudinary and save metadata to MongoDB
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const docId = uuidv4();
    const originalName = req.file.originalname;

    // Upload to Cloudinary
    const cloudResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: "raw", folder: "pdf-annotations" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const cloudUrl = cloudResult.secure_url;
    const cloudPublicId = cloudResult.public_id;

    // Save metadata to MongoDB
    const db = await connectDB();
    await db.collection("documents").insertOne({
      _id: docId,
      originalName,
      cloudUrl,
      cloudPublicId,
      createdAt: new Date(),
    });

    // Respond with Cloudinary info
    res.json({ docId, originalName, cloudUrl, cloudPublicId });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Fetch document metadata
app.get("/api/docs/:docId", async (req, res) => {
  try {
    const db = await connectDB();
    const doc = await db
      .collection("documents")
      .findOne({ _id: req.params.docId });
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// Fetch annotations
app.get("/api/docs/:docId/annotations", async (req, res) => {
  try {
    const db = await connectDB();
    const anns = await db
      .collection("annotations")
      .find({ docId: req.params.docId })
      .toArray();
    res.json(anns);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch annotations" });
  }
});

// Save annotations
app.post("/api/docs/:docId/annotations", async (req, res) => {
  try {
    const { annotations } = req.body;
    if (!Array.isArray(annotations))
      return res.status(400).json({ error: "Invalid data" });

    const db = await connectDB();
    // Remove old annotations
    await db.collection("annotations").deleteMany({ docId: req.params.docId });
    // Insert new ones
    const annsWithDocId = annotations.map((a) => ({
      ...a,
      docId: req.params.docId,
    }));
    if (annsWithDocId.length > 0)
      await db.collection("annotations").insertMany(annsWithDocId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save annotations" });
  }
});

// ---------- Socket.IO ----------
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-document", async ({ docId, user }) => {
    socket.join(docId);
    const db = await connectDB();
    const initial = await db
      .collection("annotations")
      .find({ docId })
      .toArray();
    socket.emit("init-annotations", initial);
    socket.to(docId).emit("user-joined", { user });
  });

  socket.on("add-annotation", async ({ docId, annotation }) => {
    const ann = { ...annotation, id: uuidv4(), docId };
    const db = await connectDB();
    await db.collection("annotations").insertOne(ann);
    io.to(docId).emit("annotation-added", ann);
  });

  socket.on("update-annotation", async ({ docId, id, patch }) => {
    const db = await connectDB();
    await db
      .collection("annotations")
      .updateOne({ id, docId }, { $set: patch });
    const updated = await db.collection("annotations").findOne({ id, docId });
    io.to(docId).emit("annotation-updated", updated);
  });

  socket.on("delete-annotation", async ({ docId, id }) => {
    const db = await connectDB();
    await db.collection("annotations").deleteOne({ id, docId });
    io.to(docId).emit("annotation-deleted", { id });
  });

  socket.on("cursor", ({ docId, user, x, y }) => {
    socket.to(docId).emit("cursor", { user, x, y });
  });
});

// ---------- Start Server ----------
server.listen(PORT, () => {
  console.log(`✅ Server listening on ${BASE_URL}`);
});

// latest??
// works fine till here, planning to add closing button func and admin page functionality