// ---------- Imports ----------
const express = require("express");
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

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ---------- Cloudinary ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------- Supabase ----------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---------- Multer ----------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------- Routes ----------

// Upload PDF
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const docId = uuidv4();
    const originalName = req.file.originalname;

    // Upload to Cloudinary
    const cloudResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: "raw", folder: "pdf-annotations" },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    const cloudUrl = cloudResult.secure_url;
    const cloudPublicId = cloudResult.public_id;

    // Save to MongoDB
    const db = await connectDB();
    await db.collection("documents").insertOne({
      _id: docId,
      originalName,
      cloudUrl,
      cloudPublicId,
      createdAt: new Date(),
    });

    // Save to Supabase
    const { data, error } = await supabase.from("pdf_files").insert([
      {
        doc_id: docId,
        pdf_name: originalName,
        author_name: req.body.author || "Unknown",
        author_message: req.body.authorMessage || "",
        cloud_url: cloudUrl,
        cloud_public_id: cloudPublicId,
        created_at: new Date().toISOString(),
      },
    ]);
    if (error) console.error("Supabase insert error:", error);
    else console.log("✅ Supabase insert success:", data);

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

// ---------- Annotations ----------

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
    await db.collection("annotations").deleteMany({ docId: req.params.docId });
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

// ---------- Highlights ----------

// Fetch highlights
app.get("/api/docs/:docId/highlights", async (req, res) => {
  try {
    const db = await connectDB();
    const highlights = await db
      .collection("highlights")
      .find({ docId: req.params.docId })
      .toArray();
    res.json(highlights);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch highlights" });
  }
});

// Save highlights
app.post("/api/docs/:docId/highlights", async (req, res) => {
  try {
    const { highlights } = req.body;
    if (!Array.isArray(highlights))
      return res.status(400).json({ error: "Invalid data" });

    const db = await connectDB();
    await db.collection("highlights").deleteMany({ docId: req.params.docId });
    const highlightsWithDocId = highlights.map((h) => ({
      ...h,
      docId: req.params.docId,
    }));
    if (highlightsWithDocId.length > 0)
      await db.collection("highlights").insertMany(highlightsWithDocId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save highlights" });
  }
});

// ---------- Start Server ----------
app.listen(PORT, () => {
  console.log(`✅ Server listening on ${BASE_URL}`);
});
