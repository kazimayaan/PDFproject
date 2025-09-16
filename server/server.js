// ---------- Imports ----------
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
require("dotenv").config();

// ---------- Config ----------
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const BASE_URL = `http://localhost:${PORT}`;

// In-memory storage
const documents = new Map(); // docId -> { filename, originalName, url }
const annotations = new Map(); // docId -> [ annotations ]

// ---------- App & Server ----------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

// ---------- Multer (file upload) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    req.newDocMeta = {
      docId: uuidv4(),
      filename: uniqueName,
      originalName: file.originalname,
    };
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ---------- Routes ----------

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Upload endpoint
app.post("/api/upload", upload.single("file"), (req, res) => {
  const { docId, filename, originalName } = req.newDocMeta;
  const url = `${BASE_URL}/uploads/${filename}`;
  documents.set(docId, { filename, originalName, url });
  annotations.set(docId, []);
  res.json({ docId, url, originalName });
});

// Metadata endpoint
app.get("/api/docs/:docId", (req, res) => {
  const { docId } = req.params;
  const doc = documents.get(docId);
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.json(doc);
});

// Fetch annotations
app.get("/api/docs/:docId/annotations", (req, res) => {
  const { docId } = req.params;
  const list = annotations.get(docId) || [];
  res.json(list);
});

// Save annotations for a document
app.post("/api/docs/:docId/annotations", (req, res) => {
  const { docId } = req.params;
  const { annotations: newAnns } = req.body;

  if (!newAnns || !Array.isArray(newAnns)) {
    return res.status(400).json({ error: "Invalid annotations data" });
  }

  // Save annotations in memory
  annotations.set(docId, newAnns);
  console.log(`Saved ${newAnns.length} annotations for docId=${docId}`);

  res.json({ success: true });
});

// ---------- Socket.IO ----------
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join document room
  socket.on("join-document", ({ docId, user }) => {
    socket.join(docId);
    const initial = annotations.get(docId) || [];
    socket.emit("init-annotations", initial);
    socket.to(docId).emit("user-joined", { user });
  });

  // Add annotation
  socket.on("add-annotation", ({ docId, annotation }) => {
    const ann = { id: uuidv4(), ...annotation };
    const list = annotations.get(docId) || [];
    list.push(ann);
    annotations.set(docId, list);
    io.to(docId).emit("annotation-added", ann);
  });

  // Update annotation
  socket.on("update-annotation", ({ docId, id, patch }) => {
    const list = annotations.get(docId) || [];
    const idx = list.findIndex((a) => a.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...patch };
      annotations.set(docId, list);
      io.to(docId).emit("annotation-updated", list[idx]);
    }
  });

  // Delete annotation
  socket.on("delete-annotation", ({ docId, id }) => {
    const list = annotations.get(docId) || [];
    const next = list.filter((a) => a.id !== id);
    annotations.set(docId, next);
    io.to(docId).emit("annotation-deleted", { id });
  });

  // Live cursors
  socket.on("cursor", ({ docId, user, x, y }) => {
    socket.to(docId).emit("cursor", { user, x, y });
  });
});

// ---------- Start Server ----------
server.listen(PORT, () => {
  console.log(`✅ Server listening on ${BASE_URL}`);
});
