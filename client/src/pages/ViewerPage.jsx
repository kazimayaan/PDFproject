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
  const [comments, setComments] = useState([]);
  const containerRef = useRef(null);

  const [mode, setMode] = useState("view"); // "view" | "annotate" | "highlight" | "comment"
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [dragging, setDragging] = useState(null);

  // -- Fetch doc meta --
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${SERVER}/api/docs/${docId}`);
        if (!res.ok) {
          alert("Document not found");
          return;
        }
        const j = await res.json();
        if (alive) setMeta(j);
      } catch (err) {
        console.error("Fetch meta error", err);
      }
    })();
    return () => {
      alive = false;
    };
  }, [SERVER, docId]);

  // -- Fetch annotations & comments --
  useEffect(() => {
    if (!meta) return;
    let alive = true;
    (async () => {
      try {
        const [resA, resC] = await Promise.all([
          fetch(`${SERVER}/api/docs/${docId}/annotations`),
          fetch(`${SERVER}/api/docs/${docId}/comments`),
        ]);
        if (alive) {
          if (resA.ok) {
            const annsData = await resA.json();
            setAnns(Array.isArray(annsData) ? annsData : annsData || []);
          } else {
            console.warn("Failed to load annotations");
          }
          if (resC.ok) {
            const commentsData = await resC.json();
            setComments(Array.isArray(commentsData) ? commentsData : commentsData || []);
          } else {
            console.warn("Failed to load comments");
          }
        }
      } catch (err) {
        console.error("Fetch annotations/comments error", err);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SERVER, docId, meta]);

  // Utility: get container rect safely
  const getRect = () => {
    const el = containerRef.current;
    if (!el) return { left: 0, top: 0, width: 1, height: 1 };
    return el.getBoundingClientRect();
  };

  // --- Mouse handlers for annotate/highlight ---
  const handleMouseDown = (e) => {
    // don't start box-draw when in comment mode
    if (mode === "view" || mode === "comment") return;
    const r = getRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setDragStart({ x: px, y: py });
    setDragCurrent({ x: px, y: py });
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      const r = getRect();
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
      const r = getRect();
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
        type: mode === "highlight" ? "highlight" : "annotate",
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
    const r = getRect();
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

  // --- Comments: add on click (when mode === 'comment') ---
  const handlePdfClick = (e) => {
    if (mode !== "comment") return;
    const r = getRect();
    // Only add if clicked inside pdf area
    const cx = e.clientX;
    const cy = e.clientY;
    if (cx < r.left || cx > r.left + r.width || cy < r.top || cy > r.top + r.height) {
      return;
    }
    const relX = (cx - r.left) / r.width;
    const relY = (cy - r.top) / r.height;

    // choose default box size (relative)
    const boxPxW = Math.min(360, r.width * 0.28);
    const boxPxH = Math.min(180, r.height * 0.18);
    const boxW = boxPxW / r.width;
    const boxH = boxPxH / r.height;

    // decide side: if clicked left half, put box to right; else put to left
    let boxX;
    if (relX < 0.5) {
      boxX = Math.min(0.98 - boxW, relX + 0.06);
    } else {
      boxX = Math.max(0.02, relX - boxW - 0.06);
    }
    let boxY = Math.min(0.95 - boxH, Math.max(0.02, relY - boxH / 2));

    const newComment = {
      id: Date.now(),
      page,
      x: relX,
      y: relY,
      text: "",
      lastEdited: new Date().toISOString(),
      boxX,
      boxY,
      boxW,
      boxH,
      editing: true, // auto-open for typing
      visible: true,
    };

    const updated = [...comments, newComment];
    setComments(updated);
    // persist immediately
    saveComments(updated).catch((err) => console.error("saveComments", err));
    // exit comment mode so it doesn't remain sticky
    setMode("view");
  };

  // Update comment text (local + immediate save)
  const updateComment = (id, text) => {
    const updated = comments.map((c) =>
      c.id === id ? { ...c, text, lastEdited: new Date().toISOString() } : c
    );
    setComments(updated);
  };

  // Toggle visibility of comment box (when icon clicked)
  const toggleCommentBox = (id, e) => {
    e.stopPropagation();
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  };

  // Delete comment
  const deleteComment = (id, e) => {
    e?.stopPropagation();
    const updated = comments.filter((c) => c.id !== id);
    setComments(updated);
    saveComments(updated).catch((err) => console.error("saveComments", err));
  };

  // Persist comments to backend
  const saveComments = async (commentsToSave = comments) => {
    try {
      const res = await fetch(`${SERVER}/api/docs/${docId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: commentsToSave }),
      });
      if (!res.ok) {
        throw new Error("Failed to save comments");
      }
    } catch (err) {
      console.error("saveComments error", err);
      throw err;
    }
  };

  // Persist annotations
  const saveAnnotations = async (annsToSave = anns) => {
    try {
      const res = await fetch(`${SERVER}/api/docs/${docId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations: annsToSave }),
      });
      if (!res.ok) {
        throw new Error("Failed to save annotations");
      }
    } catch (err) {
      console.error("saveAnnotations error", err);
      throw err;
    }
  };

  // Submit both
  const handleSubmit = async () => {
    if (!meta) return;
    try {
      await saveAnnotations();
      await saveComments();
      alert("Annotations and comments saved successfully!");
    } catch (err) {
      alert("Error saving annotations or comments");
    }
  };

  // Compute nearest point on comment box to icon (for connector line)
  const nearestPointOnRect = (iconX, iconY, boxLeft, boxTop, boxW, boxH) => {
    const nx = Math.max(boxLeft, Math.min(iconX, boxLeft + boxW));
    const ny = Math.max(boxTop, Math.min(iconY, boxTop + boxH));
    return { nx, ny };
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
              justifyContent: "center",
            }}
          >
            <button
              className={mode === "annotate" ? "activetoolbar" : "tool-btn"}
              onClick={() =>
                setMode(mode === "annotate" ? "view" : "annotate")
              }
            >
              {mode === "annotate" ? "Cancel" : "📝 Annotation"}
            </button>
            <button
              className={mode === "highlight" ? "activetoolbar" : "tool-btn"}
              onClick={() =>
                setMode(mode === "highlight" ? "view" : "highlight")
              }
            >
              {mode === "highlight" ? "Cancel" : "✨ Highlight"}
            </button>
            <button
              className={mode === "comment" ? "activetoolbar" : "tool-btn"}
              onClick={() => setMode(mode === "comment" ? "view" : "comment")}
            >
              {mode === "comment" ? "Cancel" : "💬 Comment"}
            </button>
          </div>

          <p className="hintforuser">
            {mode === "annotate"
              ? "Drag on the PDF to draw a box for your comment."
              : mode === "highlight"
              ? "Drag on the PDF to add a highlight."
              : mode === "comment"
              ? "Click anywhere on the PDF to place a comment icon (a comment box will open automatically)."
              : "Double-click a box to edit text, or hover to delete."}
          </p>

          {/* PDF + Overlay */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onClick={handlePdfClick}
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
                            ann.id === a.id ? { ...ann, editing: true } : ann
                          )
                        )
                      }
                      title={a.text || ""}
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

              {/* Comments rendering */}
              {comments
                .filter((c) => c.page === page)
                .map((c) => {
                  // compute pixel positions based on current container rect
                  const r = getRect();
                  const iconX = Math.round(c.x * r.width);
                  const iconY = Math.round(c.y * r.height);

                  const boxLeft = (c.boxX ?? (c.x + 0.06)) * r.width;
                  const boxTop = (c.boxY ?? (c.y - (c.boxH ?? 0.12) / 2)) * r.height;
                  const boxW = (c.boxW ?? 0.28) * r.width;
                  const boxH = (c.boxH ?? 0.14) * r.height;

                  // nearest point on box to icon
                  const { nx, ny } = nearestPointOnRect(
                    iconX,
                    iconY,
                    boxLeft,
                    boxTop,
                    boxW,
                    boxH
                  );

                  return (
                    <div key={c.id}>
                      {/* comment icon */}
                      <div
                        onClick={(e) => toggleCommentBox(c.id, e)}
                        style={{
                          position: "absolute",
                          left: iconX - 10,
                          top: iconY - 10,
                          fontSize: "20px",
                          cursor: "pointer",
                          zIndex: 12,
                          userSelect: "none",
                        }}
                        title="Open comment"
                      >
                        💬
                      </div>

                      {/* connector line (SVG) */}
                      <svg
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: "100%",
                          height: "100%",
                          pointerEvents: "none",
                          zIndex: 11,
                        }}
                      >
                        <line
                          x1={iconX}
                          y1={iconY}
                          x2={nx}
                          y2={ny}
                          stroke="#007bff"
                          strokeWidth="1"
                          strokeDasharray="4 3"
                        />
                      </svg>

                      {/* floating comment box */}
                      {c.visible && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            left: boxLeft,
                            top: boxTop,
                            width: boxW,
                            minHeight: boxH,
                            zIndex: 20,
                            background: "white",
                            border: "1px solid #ccc",
                            borderRadius: 8,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                            padding: 8,
                            resize: "both",
                            overflow: "auto",
                          }}
                        >
                          <textarea
                            value={c.text}
                            onChange={(ev) => updateComment(c.id, ev.target.value)}
                            onBlur={async () => {
                              // update last edited and persist
                              setComments((prev) =>
                                prev.map((cc) =>
                                  cc.id === c.id ? { ...cc, lastEdited: new Date().toISOString() } : cc
                                )
                              );
                              try {
                                await saveComments();
                              } catch (err) {
                                console.error("save on blur failed", err);
                              }
                            }}
                            placeholder="Add comment..."
                            style={{
                              width: "100%",
                              minHeight: 60,
                              border: "none",
                              outline: "none",
                              resize: "both",
                              fontSize: 13,
                            }}
                            autoFocus={c.editing}
                          />
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginTop: 6,
                            }}
                          >
                            <div style={{ fontSize: 11, color: "#666" }}>
                              Last edited: {c.lastEdited ? new Date(c.lastEdited).toLocaleString() : "-"}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // close box
                                  setComments((prev) => prev.map((cc) => cc.id === c.id ? { ...cc, visible: false } : cc));
                                }}
                                className="button-30"
                              >
                                Close
                              </button>
                              <button
                                onClick={(e) => deleteComment(c.id, e)}
                                className="button-30"
                                style={{ background: "transparent", color: "#c00", border: "1px solid #eee" }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Preview box while drawing */}
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
