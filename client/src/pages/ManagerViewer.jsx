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
  const [hiddenAnnIds, setHiddenAnnIds] = useState([]);

  const containerRef = useRef(null);

  // Fetch document metadata and annotations
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await fetch(`${SERVER}/api/docs/${docId}`);
        if (!res.ok) throw new Error("Document not found");
        const j = await res.json();
        setMeta(j);
      } catch (err) {
        console.error(err);
        alert("Failed to fetch document");
      }
    };

    const fetchAnnotations = async () => {
      try {
        const resAnn = await fetch(`${SERVER}/api/docs/${docId}/annotations`);
        if (!resAnn.ok) throw new Error("Failed to fetch annotations");
        const dataAnn = await resAnn.json();

        // Ensure type exists ("highlight" or "annotation")
        const combined = dataAnn.map(a => ({
          ...a,
          type: a.type || "annotation"
        }));

        setAnns(combined);
      } catch (err) {
        console.error("Failed to fetch annotations:", err);
      }
    };

    fetchMeta();
    fetchAnnotations();
  }, [SERVER, docId]);

  const handleSelectAnn = (ann) => {
    setSelectedAnn(ann);
    setPage(ann.page);
  };

  const toggleAnnotationVisibility = (annId) => {
    setHiddenAnnIds((prev) =>
      prev.includes(annId)
        ? prev.filter((id) => id !== annId)
        : [...prev, annId]
    );
  };

  const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  return (
    <div className="card">
      <h2>Manager Viewer</h2>
      {!meta && <div>Loading document…</div>}
      {meta && (
        <>
          {/* Toolbar */}
          <div
            className="toolbar"
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <div style={{ fontWeight: 600 }}>{meta.originalName}</div>
            <div className="navgroup">
              <button
                className="button-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <div>
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

          {/* PDF + Right Pane */}
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            {/* PDF Container */}
            <div style={{ flex: 2 }}>
              <div
                ref={containerRef}
                style={{
                  position: "relative",
                  width: "100%",
                  border: "1px solid #eee",
                  borderRadius: 12,
                  overflow: "hidden",
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
                    width={600}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>

                {/* Overlay annotations + highlights */}
                <div style={{ position: "absolute", inset: 0 }}>
                  {anns
                    .filter(a => a.page === page)
                    .filter(a => !hiddenAnnIds.includes(a.id))
                    .map(a => (
                      <div
                        key={a.id}
                        style={{
                          position: "absolute",
                          left: `${a.x * 100}%`,
                          top: `${a.y * 100}%`,
                          width: `${a.w * 100}%`,
                          height: `${a.h * 100}%`,
                          backgroundColor:
                            a.type === "highlight"
                              ? "rgba(255,255,0,0.4)"
                              : selectedAnn?.id === a.id
                              ? "rgba(0,47,255,0.1)"
                              : "rgba(255,0,0,0.1)",
                          border:
                            a.type === "highlight"
                              ? "1px solid #eab308"
                              : selectedAnn?.id === a.id
                              ? "3px solid blue"
                              : "2px solid red",
                          borderRadius: a.type === "highlight" ? 3 : 0,
                          cursor: "pointer",
                          padding: a.type === "annotation" ? "2px" : 0,
                          overflow: "hidden",
                          whiteSpace: "pre-wrap",
                          boxSizing: "border-box",
                        }}
                        onClick={() => handleSelectAnn(a)}
                        title={a.text}
                      >
                        {a.type === "annotation" ? a.text : null}
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Right Pane */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Selected comment panel */}
              <div
                style={{
                  minHeight: 120,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 8,
                  marginBottom: 12,
                  backgroundColor: "#f9f9f9",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {selectedAnn ? (
                  <>
                    <strong
                      className="Comment"
                      style={{ display: "flex", justifyContent: "center" }}
                    >
                      Selected Comment:
                    </strong>
                    <p style={{ marginTop: 4 }}>
                      {selectedAnn.text || "No comment"}
                    </p>
                    <button
                      className="btn"
                      style={{ margin: "auto" }}
                      onClick={() => toggleAnnotationVisibility(selectedAnn.id)}
                    >
                      {hiddenAnnIds.includes(selectedAnn.id)
                        ? "Unhide Annotation"
                        : "Hide Annotation"}
                    </button>
                  </>
                ) : (
                  <p>Select an annotation to view comment</p>
                )}
              </div>

              {/* All annotations/highlights list */}
              <div
                style={{
                  flex: 1,
                  border: "1px solid #ddd",
                  borderRadius: 3,
                  padding: 8,
                  overflowY: "auto",
                }}
              >
                <h4 style={{ display: "flex", justifyContent: "center" }}>
                  All Annotations
                </h4>
                {anns.length === 0 && <p>No annotations</p>}
                {anns.map((a, index) => (
                  <div
                    key={a.id}
                    onClick={() => handleSelectAnn(a)}
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: "10px 5px",
                      marginBottom: 4,
                      borderRadius: 2,
                      cursor: "pointer",
                      backgroundColor:
                        selectedAnn?.id === a.id ? "#d0ebff" : "#f5f5f5",
                    }}
                  >
                    <strong>{`${index + 1}${getOrdinal(
                      index + 1
                    )} ${a.type}`}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
