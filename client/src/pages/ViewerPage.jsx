import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";

import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function ViewerPage() {
  const { docId } = useParams();
  const SERVER = import.meta.env.VITE_SERVER_URL;

  const [meta, setMeta] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [page, setPage] = useState(1);
  const [anns, setAnns] = useState([]);
  const containerRef = useRef(null);

  const [dragging, setDragging] = useState(null); // {id, type, startX, startY, startW, startH}

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
    return () => { alive = false; };
  }, [SERVER, docId]);

  const handleAdd = (e) => {
    if (dragging) return; // prevent adding while dragging/resizing
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;

    // prevent adding if click is on existing box
    const clickedOnBox = anns.some(a =>
      page === a.page &&
      px >= a.x && px <= a.x + a.w &&
      py >= a.y && py <= a.y + a.h
    );
    if (clickedOnBox) return;

    const ann = {
      id: Date.now(),
      page,
      x: Math.max(0, Math.min(0.95, px)),
      y: Math.max(0, Math.min(0.95, py)),
      w: 0.18,
      h: 0.1,
      text: "",
      editing: true,
    };

    setAnns(prev => [...prev, ann]);
  };

  const updateText = (id, text) => {
    setAnns(prev => prev.map(a => a.id === id ? { ...a, text } : a));
  };

  const finishEditing = (id) => {
    setAnns(prev => prev.map(a => a.id === id ? { ...a, editing: false } : a));
  };

  const handleMouseDown = (e, ann, type) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDragging({
      id: ann.id,
      type, // 'move' or 'resize'
      startX: (e.clientX - r.left) / r.width,
      startY: (e.clientY - r.top) / r.height,
      startW: ann.w,
      startH: ann.h,
      origX: ann.x,
      origY: ann.y
    });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;

    setAnns(prev =>
      prev.map(a => {
        if (a.id !== dragging.id) return a;
        if (dragging.type === "move") {
          let newX = dragging.origX + (px - dragging.startX);
          let newY = dragging.origY + (py - dragging.startY);
          return { ...a, x: Math.max(0, Math.min(0.95, newX)), y: Math.max(0, Math.min(0.95, newY)) };
        } else if (dragging.type === "resize") {
          let newW = dragging.startW + (px - dragging.startX);
          let newH = dragging.startH + (py - dragging.startY);
          return { ...a, w: Math.max(0.05, Math.min(1 - a.x, newW)), h: Math.max(0.05, Math.min(1 - a.y, newH)) };
        }
        return a;
      })
    );
  };

  const handleMouseUp = () => setDragging(null);

  const handleSubmit = async () => {
    try {
      const res = await fetch(`${SERVER}/api/docs/${docId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations: anns }),
      });
      if (!res.ok) throw new Error("Failed to save annotations");
      alert("Annotations saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Error saving annotations");
    }
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Viewer</h2>

      {!meta && <div>Loading document…</div>}
      {meta && (
        <>
          <div className="toolbar" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>{meta.originalName}</div>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <div>Page {page}{numPages ? ` / ${numPages}` : ""}</div>
            <button onClick={() => setPage(p => Math.min(numPages || p + 1, p + 1))} disabled={!numPages || page >= numPages}>Next</button>
          </div>

          <p className="hint">
            Click anywhere on the PDF to drop an annotation. Drag or resize boxes as needed.
          </p>

          <div
            ref={containerRef}
            onClick={handleAdd}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
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
              error={<div style={{ padding: 24, color: "#c00" }}>Failed to load PDF</div>}
            >
              <Page pageNumber={page} width={920} renderTextLayer={false} renderAnnotationLayer={false} />
            </Document>

            {/* Overlay annotations */}
            <div style={{ position: "absolute", inset: 0 }}>
              {anns.filter(a => a.page === page).map(a => (
                a.editing ? (
                  <input
                    key={a.id}
                    style={{
                      position: "absolute",
                      left: `${a.x * 100}%`,
                      top: `${a.y * 100}%`,
                      width: `${a.w * 100}%`,
                      height: `${a.h * 100}%`,
                      border: "2px solid red",
                      backgroundColor: "rgba(255,255,255,0.8)",
                      padding: "2px",
                      fontSize: "14px"
                    }}
                    value={a.text}
                    onChange={e => updateText(a.id, e.target.value)}
                    onBlur={() => finishEditing(a.id)}
                    onKeyDown={e => e.key === "Enter" && finishEditing(a.id)}
                    autoFocus
                  />
                ) : (
                  <div
                    key={a.id}
                    style={{
                      position: "absolute",
                      left: `${a.x * 100}%`,
                      top: `${a.y * 100}%`,
                      width: `${a.w * 100}%`,
                      height: `${a.h * 100}%`,
                      border: "2px solid red",
                      backgroundColor: "rgba(255,0,0,0.1)",
                      padding: "2px",
                      fontSize: "14px",
                      overflow: "hidden",
                      whiteSpace: "pre-wrap",
                      cursor: "move",
                      boxSizing: "border-box"
                    }}
                    onMouseDown={(e) => handleMouseDown(e, a, "move")}
                  >
                    {a.text}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, a, "resize")}
                      style={{
                        position: "absolute",
                        right: 0,
                        bottom: 0,
                        width: 10,
                        height: 10,
                        backgroundColor: "red",
                        cursor: "nwse-resize"
                      }}
                    />
                  </div>
                )
              ))}
            </div>
          </div>

          <button className="btn" onClick={handleSubmit} style={{ marginTop: 16 }}>
            Submit Annotations
          </button>
        </>
      )}
    </div>
  );
}
