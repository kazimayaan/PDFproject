import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const SERVER = import.meta.env.VITE_SERVER_URL

  const onUpload = async () => {
    if (!file) return alert('Pick a PDF first')
    try {
      setLoading(true)
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${SERVER}/api/upload`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const json = await res.json()
      setResult(json) // { docId, url, originalName }
    } catch (e) {
      console.error(e)
      alert(e.message || 'Error uploading')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Upload a PDF</h2>
      <div style={{ display:'flex', gap:12, alignItems:'center' }}>
        <input className="input" type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button className="btn" onClick={onUpload} disabled={loading}>{loading ? 'Uploading...' : 'Upload'}</button>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        Your server will save the file and return a <code>docId</code>. We’ll open the viewer with that id.
      </p>

      {result && (
        <div style={{ marginTop: 16 }}>
          <div>Uploaded: <b>{result.originalName}</b></div>
          <div>File URL: <a className="link" href={result.url} target="_blank">{result.url}</a></div>
          <div style={{ marginTop: 8 }}>
            <Link className="btn" to={`/doc/${result.docId}`}>Open Viewer</Link>
          </div>
        </div>
      )}
    </div>
  )
}
