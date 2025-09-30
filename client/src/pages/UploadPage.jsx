import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [authorName, setAuthorName] = useState("")
  const [authorMessage, setAuthorMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [existingDocId, setExistingDocId] = useState("")
  const [copied, setCopied] = useState(false)   // track copy state
  const SERVER = import.meta.env.VITE_SERVER_URL
  const navigate = useNavigate()

  const onUpload = async () => {
    if (!file) return alert('Pick a PDF first')
    try {
      setLoading(true)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('author', authorName)
      fd.append('authorMessage', authorMessage)

      const res = await fetch(`${SERVER}/api/upload`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const json = await res.json()
      setResult(json)
      setCopied(false) // reset copied state when new doc is uploaded
    } catch (e) {
      console.error(e)
      alert(e.message || 'Error uploading')
    } finally {
      setLoading(false)
    }
  }

  const goToExistingDoc = () => {
    if (!existingDocId.trim()) return alert("Enter a valid Doc ID")
    navigate(`/doc/${existingDocId.trim()}`)
  }

  const copyDocId = () => {
    if (result?.docId) {
      navigator.clipboard.writeText(result.docId)
      setCopied(true)   // change button state
      setTimeout(() => setCopied(false), 2000) // revert back after 2s
    }
  }

  return (
    <div className="card uploadpagecard">
      <h2 style={{ marginTop: 0 }}>Upload a PDF</h2>

      {/* Section: Upload new PDF */}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom: 8 }}>
        <input
          className="input"
          type="text"
          placeholder="Author Name"
          value={authorName}
          onChange={e => setAuthorName(e.target.value)}
        />
        <input
          className="input"
          type="text"
          placeholder="Author Message"
          value={authorMessage}
          onChange={e => setAuthorMessage(e.target.value)}
        />
      </div>
      <div style={{ display:'flex', gap:12, alignItems:'center' }}>
        <input
          className="input fileinputbutton"
          type="file"
          accept="application/pdf"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
        <button className="button-50" onClick={onUpload} disabled={loading}>
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 16 }}>
          <div>Uploaded: <b>{result.originalName}</b></div>
          <div>File URL: <a className="link" href={result.url} target="_blank">{result.url}</a></div>

          {/* Doc ID section */}
          <div style={{ marginTop: 12, padding: 10, border: "1px solid #eee", borderRadius: 6, backgroundColor: "#fafafa" }}>
            <div><strong>Doc ID:</strong> {result.docId}</div>
            <p style={{ margin: "6px 0", color: "#555" }}>
              Please note the Doc ID for future references.
            </p>
            <button
              className="button-50"
              style={{
                backgroundColor: copied ? "#28a745" : "#0964b0", // green when copied
                transition: "background-color 0.3s"
              }}
              onClick={copyDocId}
            >
              {copied ? "Copied!" : "Copy Doc ID"}
            </button>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Link className="button-50" to={`/doc/${result.docId}`}>Open Viewer</Link>
            <Link className="button-50" to={`/manager/${result.docId}`}>Open Manager</Link>
          </div>
        </div>
      )}

      {/* Section: Go to existing doc */}
      <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12 }}>
        <h4>Open Existing Document</h4>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            type="text"
            placeholder="Enter existing Doc ID"
            value={existingDocId}
            onChange={e => setExistingDocId(e.target.value)}
          />
          <button className="button-50" onClick={goToExistingDoc}>Go to Viewer</button>
        </div>
      </div>
    </div>
  )
}
