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

  const [mode, setMode] = useState("view"); // "view" | "annotate" | "highlight"
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
    return () => {
      alive = false;
    };
  }, [SERVER, docId, meta]);

  // --- Annotation/Highlight logic ---
  const handleMouseDown = (e) => {
    if (mode === "view") return;
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
    } else if ((mode === "annotate" || mode === "highlight") && dragStart) {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      setDragCurrent({ x: px, y: py });
    }
  };

  const handleMouseUp = () => {
    if ((mode === "annotate" || mode === "highlight") && dragStart && dragCurrent) {
      const ann = {
        id: Date.now(),
        page,
        type: mode, // "annotate" or "highlight"
        x: Math.min(dragStart.x, dragCurrent.x),
        y: Math.min(dragStart.y, dragCurrent.y),
        w: Math.abs(dragCurrent.x - dragStart.x),
        h: Math.abs(dragCurrent.y - dragStart.y),
        text: mode === "annotate" ? "" : null,
        editing: mode === "annotate",
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

  const deleteAnnotation = (id) => {
    setAnns((prev) => prev.filter((a) => a.id !== id));
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
          {/* Main Toolbar (scrolls away) */}
          <div
            className="toolbar"
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <div
              className="tooldbarjr"
              style={{ display: "flex", alignItems: "center" }}
            >
              <div style={{ fontWeight: 600, width: "13vw" }}>
                {meta.originalName}
              </div>
              <div
                className="navbuttonwrapper"
                style={{
                  margin: "auto",
                  display: "flex",
                  alignitems: "center",
                  gap: "15px",
                }}
              >
                <button
                  className="button-50"
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
                  className="button-50"
                  onClick={() =>
                    setPage((p) => Math.min(numPages || p + 1, p + 1))
                  }
                  disabled={!numPages || page >= numPages}
                >
                  Next
                </button>
              </div>
            </div>
            <div
              className="UtilityButtons"
              style={{ marginLeft: "auto", display: "flex", gap: 8 }}
            >
              <button className="button-40" onClick={handleSubmit}>
                Submit
              </button>
            </div>
          </div>

          {/* Sticky Tools Bar */}
          <div
            className="tools-bar"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              borderBottom: "1px solid #eee",
              padding: "6px 12px",
              display: "flex",
              gap: "10px",
              justifyContent:"center",
            }}
          >
            <button
  className={mode === "annotate" ? "activetoolbar" : "tool-btn"}
  onClick={() =>
    setMode(mode === "annotate" ? "view" : "annotate")
  }
>
  {mode === "annotate" ? (
    <>
    <img 
      src="https://res.cloudinary.com/dq2dvsmus/image/upload/v1759349192/cf0f9696abaaf8f4bfc31589784cb061_qnjwxw.png" 
      alt="Cancel"
      style={{ width: "16px", height: "16px", marginRight: "5px" }}
    />
    Cancel
  </>
  ) : (
    <>
      <img 
        src="https://res.cloudinary.com/dq2dvsmus/image/upload/v1759525480/bc67e96d-d7fd-4ac3-8c4f-bec17cf0a1f9.png" 
        alt="Annotate"
        style={{ width: "16px", height: "16px", marginRight: "5px" }}
      />
      Annotation
    </>
  )}
</button>
            <button
              className={mode === "highlight" ? "activetoolbar" : "tool-btn"}
              onClick={() =>
                setMode(mode === "highlight" ? "view" : "highlight")
              }
            >
              {mode === "highlight" ? (
    <>
    <img 
      src="https://res.cloudinary.com/dq2dvsmus/image/upload/v1759349192/cf0f9696abaaf8f4bfc31589784cb061_qnjwxw.png" 
      alt="Cancel"
      style={{ width: "16px", height: "16px", marginRight: "5px" }}
    />
    Cancel
  </>
  ) : (
    <>
      <img 
        src="https://res.cloudinary.com/dq2dvsmus/image/upload/v1759524542/a847d5e1-69e8-4bc3-95d9-9976d4f77520.png" 
        alt="Highlight"
        className="highlightIcon"
        style={{ width: "20px", height: "20px", marginRight: "5px",}}
      />
      Highlight
    </>
  )}
            </button>
          </div>

          <p className="hintforuser">
            {mode === "annotate"
              ? "Drag on the PDF to draw a box for your comment."
              : mode === "highlight"
              ? "Drag on the PDF to add a highlight."
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
              cursor: mode !== "view" ? "crosshair" : "default",
            }}
          >
            <Document
              file={meta.cloudUrl}
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

            {/* Annotations & Highlights */}
            <div style={{ position: "absolute", inset: 0 }}>
              {anns
                .filter((a) => a.page === page)
                .map((a) =>
                  a.type === "highlight" ? (
                    <div
                      key={a.id}
                      className="highlight-box"
                      style={{
                        position: "absolute",
                        left: `${a.x * 100}%`,
                        top: `${a.y * 100}%`,
                        width: `${a.w * 100}%`,
                        height: `${a.h * 100}%`,
                        backgroundColor: "rgba(255,255,0,0.4)",
                        border: "1px solid #eab308",
                        borderRadius: 3,
                      }}
                    >
                      <img
                        src="https://res.cloudinary.com/dq2dvsmus/image/upload/v1759349192/cf0f9696abaaf8f4bfc31589784cb061_qnjwxw.png"
                        alt="Delete"
                        onClick={() => deleteAnnotation(a.id)}
                        className="delete-btn"
                        style={{
                          position: "absolute",
                          top: "0px",
                          right: "0px",
                          width: "20px",
                          height: "19px",
                          cursor: "pointer",
                          display: "none",
                        }}
                      />
                    </div>
                  ) : a.editing ? (
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
                      className="annotation-box"
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
                            ann.id === a.id
                              ? { ...ann, editing: true }
                              : ann
                          )
                        )
                      }
                    >
                      {a.text}

                      <img
                        src="https://res.cloudinary.com/dq2dvsmus/image/upload/v1759349192/cf0f9696abaaf8f4bfc31589784cb061_qnjwxw.png"
                        alt="Delete"
                        onClick={() => deleteAnnotation(a.id)}
                        className="delete-btn"
                        style={{
                          position: "absolute",
                          top: "0px",
                          right: "0px",
                          width: "20px",
                          height: "19px",
                          cursor: "pointer",
                          display: "none",
                        }}
                      />

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

              {dragStart && dragCurrent && (
                <div
                  style={{
                    position: "absolute",
                    left: `${Math.min(dragStart.x, dragCurrent.x) * 100}%`,
                    top: `${Math.min(dragStart.y, dragCurrent.y) * 100}%`,
                    width: `${Math.abs(dragCurrent.x - dragStart.x) * 100}%`,
                    height: `${Math.abs(dragCurrent.y - dragStart.y) * 100}%`,
                    border:
                      mode === "highlight" ? "2px dashed orange" : "2px dashed blue",
                    backgroundColor:
                      mode === "highlight"
                        ? "rgba(255,200,0,0.2)"
                        : "rgba(0,0,255,0.05)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}

      <style>
        {`
          .annotation-box:hover .delete-btn,
          .highlight-box:hover .delete-btn {
            display: block !important;
          }
        `}
      </style>
    </div>
  );
}
