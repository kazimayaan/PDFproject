import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [authorName, setAuthorName] = useState("")
  const [authorMessage, setAuthorMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [existingDocId, setExistingDocId] = useState("")
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

  return (
    <div className="card">
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
          className="input"
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
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Link className="button-50" to={`/doc/${result.docId}`}>Open Viewer</Link>
            <Link className="button-50" to={`/manager/${result.docId}`}>Open Manager</Link>
          </div>
        </div>
      )}

      {/* Section: Go to existing doc (moved below upload section) */}
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
