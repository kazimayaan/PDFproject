// test-client.js
const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:4000"; // your backend
const DOC_ID = "test-doc"; // use an existing docId or dummy
const USER = "NodeTester";

const socket = io(SERVER_URL, {
  transports: ["websocket"], // force WS, avoids long-poll fallback
});

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);

  // Join a document room
  socket.emit("join-document", { docId: DOC_ID, user: USER });

  // After joining, send an annotation
  setTimeout(() => {
    socket.emit("add-annotation", {
      docId: DOC_ID,
      annotation: { text: "Hello from Node client!", page: 1 },
    });
  }, 1000);
});

// Initial annotations from server
socket.on("init-annotations", (list) => {
  console.log("📄 Initial annotations:", list);
});

// When a new annotation is added
socket.on("annotation-added", (ann) => {
  console.log("➕ Annotation added:", ann);
});

// When an annotation is updated
socket.on("annotation-updated", (ann) => {
  console.log("✏️ Annotation updated:", ann);
});

// When an annotation is deleted
socket.on("annotation-deleted", ({ id }) => {
  console.log("❌ Annotation deleted:", id);
});

// Live cursors
socket.on("cursor", (data) => {
  console.log("🖱️ Cursor:", data);
});

// Handle disconnects/errors
socket.on("disconnect", (reason) => {
  console.log("⚠️ Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("❌ Connection error:", err.message);
});
