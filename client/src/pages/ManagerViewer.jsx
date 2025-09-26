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
  const [selectedAnn, setSelectedAnn] = useState(null);

  const containerRef = useRef(null);

  useEffect(() => {
    // Fetch document metadata
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

    // Fetch annotations
    const fetchAnns = async () => {
      const res = await fetch(`${SERVER}/api/docs/${docId}/annotations`);
      if (!res.ok) return;
      const data = await res.json();
      setAnns(data);
    };
    fetchAnns();
  }, [SERVER, docId]);

  const handleSelectAnn = (ann) => {
    setSelectedAnn(ann);
    setPage(ann.page);
  };

  const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  return (
    <div className="card" style={{ display: "flex", gap: 12 }}>
      {/* PDF Left Pane */}
      <div style={{ flex: 2 }}>
        <h2>Manager Viewer</h2>
        {!meta && <div>Loading document…</div>}
        {meta && (
          <>
            {/* Toolbar */}
            <div className="toolbar" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>{meta.originalName}</div>
              <button
                className="navButons"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <div>Page {page}{numPages ? ` / ${numPages}` : ""}</div>
              <button
                className="navButons"
                onClick={() => setPage((p) => Math.min(numPages || p + 1, p + 1))}
                disabled={!numPages || page >= numPages}
              >
                Next
              </button>
            </div>

            {/* PDF Container */}
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
                file={meta.cloudUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div style={{ padding: 24 }}>Loading PDF…</div>}
                error={<div style={{ padding: 24, color: "#c00" }}>Failed to load PDF</div>}
              >
                <Page
                  pageNumber={page}
                  width={600}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>

              {/* Overlay annotations */}
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
                        border: selectedAnn?.id === a.id ? "3px solid blue" : "2px solid red",
                        backgroundColor: "rgba(255,0,0,0.1)",
                        padding: "2px",
                        fontSize: "14px",
                        overflow: "hidden",
                        whiteSpace: "pre-wrap",
                        boxSizing: "border-box",
                        cursor: "pointer",
                      }}
                      onClick={() => handleSelectAnn(a)}
                      title={a.text}
                    >
                      {a.text}
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Pane */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Comment Viewer */}
        <div
          style={{
            minHeight: 120,
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 8,
            marginBottom: 12,
            backgroundColor: "#f9f9f9",
            overflowY: "auto",
          }}
        >
          {selectedAnn ? (
            <>
              <strong>Selected Comment:</strong>
              <p style={{ marginTop: 4 }}>{selectedAnn.text || "No comment"}</p>
            </>
          ) : (
            <p>Select an annotation to view comment</p>
          )}
        </div>

        {/* List of comments */}
        <div
          style={{
            flex: 1,
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 8,
            overflowY: "auto",
          }}
        >
          <h4>All Annotations</h4>
          {anns.length === 0 && <p>No annotations</p>}
          {anns.map((a, index) => (
            <div
              key={a.id}
              onClick={() => handleSelectAnn(a)}
              style={{
                padding: "6px 8px",
                marginBottom: 4,
                borderRadius: 4,
                cursor: "pointer",
                backgroundColor: selectedAnn?.id === a.id ? "#d0ebff" : "#f5f5f5",
              }}
            >
              <strong>{`${index + 1}${getOrdinal(index + 1)} comment`}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
