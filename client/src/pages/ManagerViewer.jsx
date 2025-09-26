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
    setPage(ann.page); // navigate to the annotation's page
  };

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* Left: List of annotations */}
      <div style={{ flex: 1, border: "1px solid #eee", borderRadius: 8, padding: 12, maxHeight: "90vh", overflowY: "auto" }}>
        <h3>Annotations</h3>
        {anns.length === 0 && <p>No annotations</p>}
        {anns.map((a) => (
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
            <strong>Page {a.page}</strong>
            <p style={{ margin: "4px 0" }}>{a.text || "No comment"}</p>
          </div>
        ))}
      </div>

      {/* Center: PDF Viewer */}
      <div style={{ flex: 3 }}>
        <h2>Manager Viewer</h2>
        {!meta && <div>Loading document…</div>}
        {meta && (
          <>
            {/* Toolbar */}
            <div className="toolbar" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>{meta.originalName}</div>
              <button className="navButons" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
              <div>Page {page}{numPages ? ` / ${numPages}` : ""}</div>
              <button className="navButons" onClick={() => setPage((p) => Math.min(numPages || p + 1, p + 1))} disabled={!numPages || page >= numPages}>Next</button>
            </div>

            {/* PDF */}
            <div
              ref={containerRef}
              style={{
                position: "relative",
                width: "100%",
                border: "1px solid #eee",
                borderRadius: 12,
                overflow: "hidden",
                marginTop: 12,
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

              {/* Overlay annotations */}
              <div style={{ position: "absolute", inset: 0 }}>
                {anns
                  .filter((a) => a.page === page)
                  .map((a) => {
                    const isSelected = selectedAnn?.id === a.id;
                    return (
                      <div
                        key={a.id}
                        onClick={() => setSelectedAnn(a)}
                        style={{
                          position: "absolute",
                          left: `${a.x * 100}%`,
                          top: `${a.y * 100}%`,
                          width: `${a.w * 100}%`,
                          height: `${a.h * 100}%`,
                          border: isSelected ? "3px solid blue" : "2px solid red",
                          backgroundColor: "rgba(255,0,0,0.1)",
                          padding: "2px",
                          fontSize: "14px",
                          overflow: "hidden",
                          whiteSpace: "pre-wrap",
                          boxSizing: "border-box",
                          cursor: "pointer",
                        }}
                        title={a.text}
                      >
                        {a.text}
                      </div>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right: Selected annotation details */}
      <div style={{ flex: 1, border: "1px solid #eee", borderRadius: 8, padding: 12, height: "fit-content" }}>
        <h3>Annotation Comment</h3>
        {selectedAnn ? (
          <div>
            <strong>Page {selectedAnn.page}</strong>
            <p>{selectedAnn.text || "No comment provided"}</p>
          </div>
        ) : (
          <p>Click an annotation to see its comment</p>
        )}
      </div>
    </div>
  );
}
