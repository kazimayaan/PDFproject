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
  const [anns, setAnns] = useState([]); // local annotations
  const containerRef = useRef(null);

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
    return () => { alive = false; };
  }, [SERVER, docId]);

  // add annotation by clicking on PDF
  const handleAdd = (e) => {
    const el = containerRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;

    const ann = {
      id: Date.now(),
      page,
      x: Math.max(0, Math.min(0.95, px)),
      y: Math.max(0, Math.min(0.95, py)),
      w: 0.18,
      h: 0.1,
      text: "",
      editing: true, // start in editing mode
    };

    setAnns((prev) => [...prev, ann]);
  };

  // update text for annotation
  const updateText = (id, text) => {
    setAnns(prev => prev.map(a => a.id === id ? { ...a, text } : a));
  };

  // finish editing
  const finishEditing = (id) => {
    setAnns(prev => prev.map(a => a.id === id ? { ...a, editing: false } : a));
  };

  // submit annotations to server
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
                Page {page}{numPages ? ` / ${numPages}` : ""}
              </div>
              <button
                className="btn"
                onClick={() => setPage((p) => Math.min(numPages || p + 1, p + 1))}
                disabled={!numPages || page >= numPages}
              >
                Next
              </button>
            </div>
          </div>

          <p className="hint">
            Click anywhere on the PDF to drop an annotation box and enter text.
          </p>

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
              error={<div style={{ padding: 24, color: "#c00" }}>Failed to load PDF</div>}
            >
              <Page
                pageNumber={page}
                width={920}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
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
                      cursor: "text"
                    }}
                    onDoubleClick={() => updateText(a.id, a.text)}
                    title={a.text}
                  >
                    {a.text}
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
