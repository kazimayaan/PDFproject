import { Routes, Route, Link } from 'react-router-dom'
import UploadPage from './pages/UploadPage.jsx'
import ViewerPage from './pages/ViewerPage.jsx'
import ManagerViewer from './pages/ManagerViewer';

export default function App() {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, Arial, sans-serif' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display:'flex', gap:12, alignItems:'center' }}>
        <Link to="/" style={{ fontWeight: 700, textDecoration: 'none', color: '#111' }}>PDF Proto</Link>
        <span style={{ fontSize: 12, color: '#777' }}>upload & annotate </span>
      </header>
      <main style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/doc/:docId" element={<ViewerPage />} />
          <Route path="/manager/:docId" element={<ManagerViewer />} />
        </Routes>
      </main>
    </div>
  )
}


// import { Routes, Route, Link } from "react-router-dom"

// function Home() {
//   return <h1>Hello World ✅ React is working</h1>
// }

// export default function App() {
//   return (
//     <div>
//       <nav>
//         <Link to="/">Home</Link>
//       </nav>
//       <Routes>
//         <Route path="/" element={<Home />} />
//       </Routes>
//     </div>
//   )
// }
