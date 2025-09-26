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

  const [mode, setMode] = useState("view"); // "view" | "annotate"
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [dragging, setDragging] = useState(null);

  // Fetch document metadata
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

  // Fetch existing annotations
  useEffect(() => {
    if (!meta) return;
    let alive = true;
    (async () => {
      const res = await fetch(`${SERVER}/api/docs/${docId}/annotations`);
      if (!res.ok) return;
      const data = await res.json();
      if (alive) setAnns(data);
    })();
    return () => { alive = false };
  }, [SERVER, docId, meta]);

  // --- Annotation logic ---
  const handleMouseDown = (e) => {
    if (mode !== "annotate") return;
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setDragStart({ x: px, y: py });
    setDragCurrent({ x: px, y: py });
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;

      setAnns((prev) =>
        prev.map((a) => {
          if (a.id !== dragging.id) return a;
          if (dragging.type === "move") {
            let newX = dragging.origX + (px - dragging.startX);
            let newY = dragging.origY + (py - dragging.startY);
            return {
              ...a,
              x: Math.max(0, Math.min(0.95, newX)),
              y: Math.max(0, Math.min(0.95, newY)),
            };
          } else if (dragging.type === "resize") {
            let newW = dragging.startW + (px - dragging.startX);
            let newH = dragging.startH + (py - dragging.startY);
            return {
              ...a,
              w: Math.max(0.05, Math.min(1 - a.x, newW)),
              h: Math.max(0.05, Math.min(1 - a.y, newH)),
            };
          }
          return a;
        })
      );
    } else if (mode === "annotate" && dragStart) {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      setDragCurrent({ x: px, y: py });
    }
  };

  const handleMouseUp = () => {
    if (mode === "annotate" && dragStart && dragCurrent) {
      const ann = {
        id: Date.now(),
        page,
        x: Math.min(dragStart.x, dragCurrent.x),
        y: Math.min(dragStart.y, dragCurrent.y),
        w: Math.abs(dragCurrent.x - dragStart.x),
        h: Math.abs(dragCurrent.y - dragStart.y),
        text: "",
        editing: true,
      };
      setAnns((prev) => [...prev, ann]);
      setMode("view");
    }
    setDragStart(null);
    setDragCurrent(null);
    setDragging(null);
  };

  const updateText = (id, text) => {
    setAnns((prev) => prev.map((a) => (a.id === id ? { ...a, text } : a)));
  };

  const finishEditing = (id) => {
    setAnns((prev) =>
      prev.map((a) => (a.id === id ? { ...a, editing: false } : a))
    );
  };

  const handleDragMove = (e, ann, type) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDragging({
      id: ann.id,
      type,
      startX: (e.clientX - r.left) / r.width,
      startY: (e.clientY - r.top) / r.height,
      startW: ann.w,
      startH: ann.h,
      origX: ann.x,
      origY: ann.y,
    });
  };

  // Submit annotations to backend
  const handleSubmit = async () => {
    if (!meta) return;
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
    <div
      className="card"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <h2 className="headerforview" style={{ marginTop: 0 }}>
        Annotation Tool
      </h2>

      {!meta && <div>Loading document…</div>}
      {meta && (
        <>
          {/* Toolbar */}
          <div
            className="toolbar"
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <div style={{ fontWeight: 600 }}>{meta.originalName}</div>
            <div className="navbuttonwrapper">
              <button
                className="navButons"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <div className="pagesNumber">
                Page {page}
                {numPages ? ` / ${numPages}` : ""}
              </div>
              <button
                className="navButons"
                onClick={() =>
                  setPage((p) => Math.min(numPages || p + 1, p + 1))
                }
                disabled={!numPages || page >= numPages}
              >
                Next
              </button>
            </div>
            <div
              className="UtilityButtons"
              style={{ marginLeft: "auto", display: "flex", gap: 8 }}
            >
              <button
                className={
                  mode === "annotate" ? "btn-active annotateButton" : "annotateButton"
                }
                onClick={() => setMode(mode === "annotate" ? "view" : "annotate")}
              >
                {mode === "annotate" ? "Cancel" : "Add Annotation"}
              </button>
              <button className="submitButton" onClick={handleSubmit}>
                Submit
              </button>
            </div>
          </div>

          <p className="hintforuser">
            {mode === "annotate"
              ? "Drag on the PDF to draw a box for your comment."
              : "Double-click a box to edit text, or hover to delete."}
          </p>

          {/* PDF + Overlay */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            style={{
              position: "relative",
              width: "100%",
              border: "1px solid #eee",
              borderRadius: 12,
              overflow: "hidden",
              cursor: mode === "annotate" ? "crosshair" : "default",
            }}
          >
            <Document
              file={meta.cloudUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<div style={{ padding: 24 }}>Loading PDF…</div>}
              error={<div style={{ padding: 24, color: "#c00" }}>Failed to load PDF</div>}
            >
              <Page
                pageNumber={page}
                width={920}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>

            {/* Annotations */}
            <div style={{ position: "absolute", inset: 0 }}>
              {anns
                .filter((a) => a.page === page)
                .map((a) =>
                  a.editing ? (
                    <textarea
                      key={a.id}
                      style={{
                        position: "absolute",
                        left: `${a.x * 100}%`,
                        top: `${a.y * 100}%`,
                        width: `${a.w * 100}%`,
                        height: `${a.h * 100}%`,
                        border: "2px solid red",
                        backgroundColor: "rgba(255,255,255,0.9)",
                        padding: "4px",
                        fontSize: "14px",
                        resize: "none",
                      }}
                      value={a.text}
                      onChange={(e) => updateText(a.id, e.target.value)}
                      onBlur={() => finishEditing(a.id)}
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
                        boxSizing: "border-box",
                      }}
                      onMouseDown={(e) => handleDragMove(e, a, "move")}
                      onDoubleClick={() =>
                        setAnns((prev) =>
                          prev.map((ann) =>
                            ann.id === a.id ? { ...ann, editing: true } : ann
                          )
                        )
                      }
                    >
                      {a.text}



{/* Delete button */}
<div
    onClick={() => setAnns((prev) => prev.filter((ann) => ann.id !== a.id))}
    style={{
      position: "absolute",
      top: 0,
      right: 0,
      width: 20,
      height: 20,
      backgroundColor: "red",
      color: "white",
      fontWeight: "bold",
      textAlign: "center",
      lineHeight: "20px",
      cursor: "pointer",
      display: "none", // initially hidden
    }}
    className="delete-btn"
  >
    ×
  </div>
                      {/* Resize handle */}
                      <div
                        onMouseDown={(e) => handleDragMove(e, a, "resize")}
                        style={{
                          position: "absolute",
                          right: 0,
                          bottom: 0,
                          width: 10,
                          height: 10,
                          backgroundColor: "red",
                          cursor: "nwse-resize",
                        }}
                      />
                    </div>
                  )
                )}

              {/* Preview box while drawing */}
              {dragStart && dragCurrent && (
                <div
                  style={{
                    position: "absolute",
                    left: `${Math.min(dragStart.x, dragCurrent.x) * 100}%`,
                    top: `${Math.min(dragStart.y, dragCurrent.y) * 100}%`,
                    width: `${Math.abs(dragCurrent.x - dragStart.x) * 100}%`,
                    height: `${Math.abs(dragCurrent.y - dragStart.y) * 100}%`,
                    border: "2px dashed blue",
                    backgroundColor: "rgba(0,0,255,0.05)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}