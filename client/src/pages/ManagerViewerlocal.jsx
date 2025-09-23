import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";

import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function ManagerViewer() {
  const { docId } = useParams();
  const SERVER = import.meta.env.VITE_SERVER_URL;

  const [meta, setMeta] = useState(null);
  const [anns, setAnns] = useState([]);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // fetch document metadata
    const fetchMeta = async () => {
      const res = await fetch(`${SERVER}/api/docs/${docId}`);
      if (!res.ok) {
        alert("Document not found");
        return;
      }
      const j = await res.json();
      setMeta(j);
    };
    fetchMeta();

    // fetch annotations
    const fetchAnns = async () => {
      const res = await fetch(`${SERVER}/api/docs/${docId}/annotations`);
      if (!res.ok) return;
      const data = await res.json();
      setAnns(data);
    };
    fetchAnns();
  }, [SERVER, docId]);

  return (
    <div className="card">
      <h2>Manager Viewer</h2>
      {!meta && <div>Loading document…</div>}
      {meta && (
        <>
          <div className="toolbar" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>{meta.originalName}</div>
            <button class = "navButons" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </button>
            <div>Page {page}{numPages ? ` / ${numPages}` : ""}</div>
            <button class = "navButons" onClick={() => setPage((p) => Math.min(numPages || p + 1, p + 1))} disabled={!numPages || page >= numPages}>
              Next
            </button>
          </div>

          <div
            ref={containerRef}
            style={{
              position: "relative",
              width: "100%",
              border: "1px solid #eee",
              borderRadius: 12,
              overflow: "hidden",
              marginTop: 12
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

            {/* Overlay annotations with text */}
            <div style={{ position: "absolute", inset: 0 }}>
              {anns
                .filter(a => a.page === page)
                .map(a => (
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
                      boxSizing: "border-box"
                    }}
                    title={a.text} // optional tooltip
                  >
                    {a.text}
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
