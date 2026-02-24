import { useState } from "react";

interface ContentItem {
  type: string;
  text?: string;
  key?: string;
  value?: string;
  rows?: string[][];
}

interface Section {
  title: string;
  content: ContentItem[];
}

interface OCRResponse {
  headers: string[];
  sections: Section[];
  key_values: Record<string, string>;
  bullet_points: string[];
  tables: string[][][];
  paragraphs: string[];
  metadata?: Record<string, unknown>;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<OCRResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const upload = async () => {
    if (!file) return;

    setLoading(true);
    setError("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/ocr", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data: OCRResponse = await res.json();

      if ((data as any).error) {
        setError((data as any).error);
        setResult(null);
      } else {
        // Log stats to console instead of showing in UI
        console.log("=== NotePeel Document Stats ===");
        console.log("Headers found:", data.headers.length);
        console.log("Sections:", data.sections.length);
        console.log("Key-value pairs:", Object.keys(data.key_values ?? {}).length);
        console.log("Bullet points:", data.bullet_points.length);
        console.log("Tables:", data.tables.length);
        console.log("Paragraphs:", data.paragraphs.length);
        console.log("Metadata:", data.metadata);
        console.log("Full response:", data);

        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const renderContentItem = (item: ContentItem, idx: number) => {
    switch (item.type) {
      case "bullet":
        return (
          <li key={idx} style={styles.bullet}>
            {item.text}
          </li>
        );
      case "key_value":
        return (
          <div key={idx} style={styles.keyValue}>
            <span style={styles.key}>{item.key}:</span> {item.value}
          </div>
        );
      case "table":
        return (
          <table key={idx} style={styles.table}>
            <tbody>
              {item.rows?.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={styles.td}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "paragraph":
      case "text":
      default:
        return (
          <p key={idx} style={styles.paragraph}>
            {item.text}
          </p>
        );
    }
  };

  // Collect unsectioned content (key_values, bullet_points, paragraphs not under any header)
  const hasUnsectionedContent =
    result &&
    (Object.keys(result.key_values ?? {}).length > 0 ||
      result.bullet_points.length > 0 ||
      result.paragraphs.length > 0);

  return (
    <div style={styles.page}>
      {/* Upload bar */}
      <div style={styles.uploadBar}>
        <span style={styles.logo}>🍌 NotePeel</span>
        <div style={styles.uploadControls}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={styles.fileInput}
          />
          <button
            onClick={upload}
            disabled={!file || loading}
            style={{
              ...styles.uploadBtn,
              opacity: !file || loading ? 0.4 : 1,
              cursor: !file || loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Reading..." : "Upload"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div style={styles.error}>⚠ {error}</div>}

      {/* Document reconstruction */}
      {result && (
        <div style={styles.document}>

          {/* Unsectioned content first */}
          {hasUnsectionedContent && (
            <div style={styles.unsectioned}>
              {Object.keys(result.key_values ?? {}).length > 0 && (
                <div style={styles.kvBlock}>
                  {Object.entries(result.key_values).map(([k, v]) => (
                    <div key={k} style={styles.keyValue}>
                      <span style={styles.key}>{k}:</span> {v}
                    </div>
                  ))}
                </div>
              )}
              {result.bullet_points.length > 0 && (
                <ul style={styles.bulletList}>
                  {result.bullet_points.map((b, i) => (
                    <li key={i} style={styles.bullet}>{b}</li>
                  ))}
                </ul>
              )}
              {result.paragraphs.length > 0 &&
                result.paragraphs.map((p, i) => (
                  <p key={i} style={styles.paragraph}>{p}</p>
                ))}
            </div>
          )}

          {/* Sections: header + content */}
          {result.sections.map((section, idx) => (
            <div key={idx} style={styles.section}>
              <h2 style={styles.sectionHeader}>{section.title}</h2>
              <div style={styles.sectionBody}>
                {section.content.length === 0 ? (
                  <p style={styles.empty}>No content</p>
                ) : (
                  section.content.map((item, i) => renderContentItem(item, i))
                )}
              </div>
            </div>
          ))}

          {/* Tables not inside sections */}
          {result.tables.length > 0 &&
            result.tables.map((table, idx) => (
              <div key={idx} style={styles.section}>
                <table style={styles.table}>
                  <tbody>
                    {table.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} style={styles.td}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div style={styles.emptyState}>
          <p>Upload an image of your notes to reconstruct them here.</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#fafaf8",
    fontFamily: "'Georgia', serif",
    color: "#1a1a1a",
  },
  uploadBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 40px",
    borderBottom: "1px solid #e0ddd8",
    backgroundColor: "#fff",
    position: "sticky" as const,
    top: 0,
    zIndex: 10,
  },
  logo: {
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: "-0.5px",
  },
  uploadControls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  fileInput: {
    fontSize: 13,
    color: "#555",
  },
  uploadBtn: {
    padding: "8px 20px",
    backgroundColor: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    fontSize: 14,
    fontFamily: "'Georgia', serif",
    transition: "opacity 0.2s",
  },
  error: {
    margin: "20px 40px",
    padding: "12px 16px",
    backgroundColor: "#fff0f0",
    color: "#c0392b",
    borderRadius: 4,
    fontSize: 14,
    border: "1px solid #f5c6c6",
  },
  document: {
    maxWidth: 720,
    margin: "48px auto",
    padding: "0 40px 80px",
  },
  unsectioned: {
    marginBottom: 40,
    paddingBottom: 32,
    borderBottom: "1px solid #e0ddd8",
  },
  kvBlock: {
    marginBottom: 16,
  },
  keyValue: {
    padding: "4px 0",
    fontSize: 15,
    lineHeight: 1.6,
    color: "#1a1a1a",
  },
  key: {
    fontWeight: "bold",
  },
  section: {
    marginBottom: 40,
  },
  sectionHeader: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: "2px solid #1a1a1a",
    letterSpacing: "-0.3px",
  },
  sectionBody: {
    paddingLeft: 4,
  },
  bulletList: {
    paddingLeft: 24,
    margin: "8px 0",
  },
  bullet: {
    fontSize: 15,
    lineHeight: 1.7,
    color: "#1a1a1a",
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 1.8,
    color: "#1a1a1a",
    margin: "8px 0",
  },
  table: {
    borderCollapse: "collapse" as const,
    width: "100%",
    margin: "12px 0",
    fontSize: 14,
  },
  td: {
    border: "1px solid #d0cdc8",
    padding: "8px 12px",
    textAlign: "left" as const,
    color: "#1a1a1a",
  },
  empty: {
    color: "#aaa",
    fontStyle: "italic",
    fontSize: 14,
  },
  emptyState: {
    textAlign: "center" as const,
    marginTop: 120,
    color: "#aaa",
    fontSize: 15,
    fontStyle: "italic",
  },
};

export default App;