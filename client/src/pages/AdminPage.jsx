import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function AdminPage() {
  const [pdfs, setPdfs] = useState([]);
  const [filteredPdfs, setFilteredPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchPDFs() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("pdf_files")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        setPdfs(data);
        setFilteredPdfs(data);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch PDFs");
      } finally {
        setLoading(false);
      }
    }

    fetchPDFs();
  }, []);

  // Search filter
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);

    const filtered = pdfs.filter(
      (pdf) =>
        pdf.pdf_name?.toLowerCase().includes(value.toLowerCase()) ||
        pdf.author_name?.toLowerCase().includes(value.toLowerCase()) ||
        pdf.author_message?.toLowerCase().includes(value.toLowerCase())
    );

    setFilteredPdfs(filtered);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h2>Admin Page - All PDFs</h2>

      <input
        type="text"
        placeholder="Search by name, author, message..."
        value={search}
        onChange={handleSearch}
        style={{ width: "100%", padding: 8, marginBottom: 16 }}
      />

      {loading && <p>Loading PDFs...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && filteredPdfs.length === 0 && <p>No PDFs found.</p>}

      {filteredPdfs.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 }}>PDF Name</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 }}>Author</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: 8 }}>Message</th>
              <th style={{ borderBottom: "1px solid #ccc", padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPdfs.map((pdf) => (
              <tr key={pdf.doc_id}>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{pdf.pdf_name}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{pdf.author_name}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{pdf.author_message}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8, display: "flex", gap: 8 }}>
                  <Link className="btn button-50" to={`/manager/${pdf.doc_id}`}>
                    Open Manager
                  </Link>
                  <a className="btn button-50" href={pdf.cloud_url} target="_blank" rel="noopener noreferrer">
                    Download PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
