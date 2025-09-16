import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { Document, Page, pdfjs } from "react-pdf";

import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function ViewerPage() {
  const { docId } = useParams();
  const SERVER = import.meta.env.VITE_SERVER_URL; // e.g., http://localhost:4000

  const [meta, setMeta] = useState(null); // { filename, originalName }
  const [numPages, setNumPages] = useState(null);
  const [page, setPage] = useState(1);

  // annotations: { id, page, x, y, w, h, text }
  const [anns, setAnns] = useState([]);

  // socket state
  const [socket, setSocket] = useState(null);

  const containerRef = useRef(null);

  // create socket after SERVER is defined
  useEffect(() => {
    if (!SERVER) return;

    const s = io(SERVER, { transports: ["websocket"] });
    setSocket(s);

    s.on("connect", () => {
      console.log("Connected to socket server:", s.id);
    });

    s.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
    });

    return () => {
      s.disconnect();
    };
  }, [SERVER]);

  // fetch document metadata
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`${SERVER}/api/docs/${docId}`);
      if (!res.ok) {
        alert("Document not found");
        return;
      }
      const j = await res.json();
      if (alive) setMeta(j);
    })();
    return () => {
      alive = false;
    };
  }, [SERVER, docId]);

  // socket event wiring
  useEffect(() => {
    if (!socket || !docId) return;

    socket.emit("join-document", {
      docId,
      user: `User-${Math.floor(Math.random() * 999)}`,
    });

    socket.on("init-annotations", (list) => setAnns(list));
    socket.on("annotation-added", (ann) => setAnns((prev) => [...prev, ann]));
    socket.on("annotation-updated", (ann) =>
      setAnns((prev) => prev.map((a) => (a.id === ann.id ? ann : a)))
    );
    socket.on("annotation-deleted", ({ id }) =>
      setAnns((prev) => prev.filter((a) => a.id !== id))
    );

    return () => {
      socket.off("init-annotations");
      socket.off("annotation-added");
      socket.off("annotation-updated");
      socket.off("annotation-deleted");
    };
  }, [socket, docId]);

  // add annotation by clicking on PDF
  const handleAdd = (e) => {
    const el = containerRef.current;
    if (!el || !socket) return;

    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;

    const ann = {
      page,
      x: Math.max(0, Math.min(0.95, px)),
      y: Math.max(0, Math.min(0.95, py)),
      w: 0.18,
      h: 0.1,
      text: "New note",
    };

    socket.emit("add-annotation", { docId, annotation: ann });
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Viewer</h2>

      {!meta && <div>Loading document…</div>}
      {meta && (
        <>
          <div className="toolbar">
            <div style={{ fontWeight: 600 }}>{meta.originalName}</div>
            <a
              className="link"
              href={`${SERVER}/uploads/${meta.filename}`}
              target="_blank"
              rel="noreferrer"
            >
              Open raw PDF
            </a>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                className="btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <div style={{ alignSelf: "center" }}>
                Page {page}
                {numPages ? ` / ${numPages}` : ""}
              </div>
              <button
                className="btn"
                onClick={() =>
                  setPage((p) => Math.min(numPages || p + 1, p + 1))
                }
                disabled={!numPages || page >= numPages}
              >
                Next
              </button>
            </div>
          </div>

          <p className="hint">
            Click anywhere on the PDF to drop a red note box. Open the same
            link in another window to see real-time sync.
          </p>

          {/* PDF + overlay container */}
          <div
            ref={containerRef}
            onClick={handleAdd}
            style={{
              position: "relative",
              width: "100%",
              border: "1px solid #eee",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <Document
              file={`${SERVER}/uploads/${meta.filename}`}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<div style={{ padding: 24 }}>Loading PDF…</div>}
              error={
                <div style={{ padding: 24, color: "#c00" }}>
                  Failed to load PDF
                </div>
              }
            >
              <Page
                pageNumber={page}
                width={920}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>

            {/* Overlay annotations for current page */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {anns
                .filter((a) => a.page === page)
                .map((a) => (
                  <div
                    key={a.id ?? `${a.page}-${a.x}-${a.y}-${a.text}`}
                    className="ann-box"
                    style={{
                      left: `${a.x * 100}%`,
                      top: `${a.y * 100}%`,
                      width: `${a.w * 100}%`,
                      height: `${a.h * 100}%`,
                    }}
                    title={a.text}
                  />
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
