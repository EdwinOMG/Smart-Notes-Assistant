import { useState, useCallback, CSSProperties } from "react";

const API_BASE = "http://localhost:8000";

const COLORS = {
  bg: "#0f0f11",
  surface: "#17171a",
  border: "#2a2a2f",
  accent: "#7c6dfa",
  accentSoft: "#7c6dfa18",
  accentGlow: "#7c6dfa33",
  text: "#e8e8f0",
  textMuted: "#6b6b80",
  textDim: "#3a3a4a",
  green: "#4ade80",
  red: "#f87171",
  boxBorder: "#7c6dfa66",
  underline: "#7c6dfa",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type ContainerType = "box" | "underlined" | "circled" | "arrow" | "none";
type ElementType = "header" | "paragraph" | "bullet_list" | "key_value" | "diagram" | "table" | "label";
type NoteType = "default" | "lecture" | "meeting";
type PageLayout = "single_column" | "two_column" | "mixed" | "unknown";
type DiagramShape = "rectangle" | "circle" | "triangle" | "diamond" | "arrow" | "none";

interface DiagramData {
  description: string;
  location: string;
  shape: DiagramShape;
  labels: string[];
}

interface ElementPosition {
  region: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
}

interface ElementStyle {
  is_bold: boolean;
  is_large: boolean;
  is_underlined: boolean;
}

interface NoteElementData {
  id: number;
  type: ElementType;
  content: string;
  container: ContainerType;
  position: ElementPosition;
  style: ElementStyle;
  children: string[];
  connected_to: number[];
  diagram?: DiagramData;
}

interface NoteMetadata {
  model: string;
  note_type: NoteType;
}

interface NoteResponse {
  page_layout: PageLayout;
  elements: NoteElementData[];
  raw_text: string;
  metadata: NoteMetadata;
  error?: string;
}

interface NoteViewerProps {
  onLogout: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sortByPosition = (elements: NoteElementData[]): NoteElementData[] =>
  [...elements].sort((a, b) => {
    const ay = a.position?.y_percent ?? 0;
    const by = b.position?.y_percent ?? 0;
    if (Math.abs(ay - by) > 8) return ay - by;
    return (a.position?.x_percent ?? 0) - (b.position?.x_percent ?? 0);
  });

const shouldUseColumns = (layout: PageLayout, left: NoteElementData[], right: NoteElementData[]): boolean =>
  (layout === "two_column" || layout === "mixed") && left.length > 0 && right.length > 0;

// Only box/underlined/circled affect visual style — never constrain width from position data
const getContainerStyle = (container: ContainerType): CSSProperties => {
  switch (container) {
    case "box":
      return {
        border: `1.5px solid ${COLORS.boxBorder}`,
        borderRadius: "10px",
        padding: "16px 18px",
        background: COLORS.accentSoft,
        boxShadow: `0 0 24px ${COLORS.accentGlow}`,
      };
    case "underlined":
      return { borderBottom: `2px solid ${COLORS.underline}`, paddingBottom: "4px" };
    case "circled":
      return { border: `1.5px solid ${COLORS.boxBorder}`, borderRadius: "50px", padding: "6px 18px", display: "inline-block" };
    default:
      return {};
  }
};

// ── SVG text helper ───────────────────────────────────────────────────────────

function SvgText({ lines, cx, cy, shapeH, fontSize = 12 }: {
  lines: string[]; cx: number; cy: number; shapeH: number; fontSize?: number;
}) {
  const lineH = fontSize * 1.45;
  // Scale font down if text won't fit vertically
  const maxLines = Math.floor((shapeH * 0.7) / lineH);
  const visibleLines = lines.slice(0, maxLines);
  const totalH = visibleLines.length * lineH;
  const startY = cy - totalH / 2 + lineH / 2;

  return (
    <>
      {visibleLines.map((line, i) => (
        <text
          key={i}
          x={cx}
          y={startY + i * lineH}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fill={COLORS.text}
          fontFamily="'DM Sans', sans-serif"
        >
          {line}
        </text>
      ))}
    </>
  );
}

// Wraps a string into lines that fit within maxChars per line
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

// ── ShapeRenderer ─────────────────────────────────────────────────────────────

function ShapeRenderer({ diagram }: { diagram: DiagramData }) {
  const { shape, labels, description } = diagram;
  const allText = labels?.length ? labels.join(" · ") : description;
  const stroke = { stroke: COLORS.accent, strokeWidth: 1.5, fill: COLORS.accentSoft };

  if (shape === "circle") {
    const lines = wrapText(allText, 18);
    return (
      <svg viewBox="0 0 200 160" width="100%" style={{ maxWidth: "240px", display: "block", margin: "0 auto" }}>
        <ellipse cx="100" cy="80" rx="94" ry="70" {...stroke} />
        <SvgText lines={lines} cx={100} cy={80} shapeH={140} fontSize={12} />
      </svg>
    );
  }

  if (shape === "triangle") {
    const lines = wrapText(allText, 16);
    return (
      <svg viewBox="0 0 200 180" width="100%" style={{ maxWidth: "240px", display: "block", margin: "0 auto" }}>
        <polygon points="100,8 196,172 4,172" {...stroke} />
        {/* Text sits in the lower two-thirds of the triangle */}
        <SvgText lines={lines} cx={100} cy={130} shapeH={100} fontSize={11} />
      </svg>
    );
  }

  if (shape === "diamond") {
    const lines = wrapText(allText, 14);
    return (
      <svg viewBox="0 0 200 200" width="100%" style={{ maxWidth: "240px", display: "block", margin: "0 auto" }}>
        <polygon points="100,6 194,100 100,194 6,100" {...stroke} />
        <SvgText lines={lines} cx={100} cy={100} shapeH={120} fontSize={11} />
      </svg>
    );
  }

  if (shape === "arrow") {
    const lines = wrapText(allText, 18);
    return (
      <svg viewBox="0 0 240 80" width="100%" style={{ maxWidth: "280px", display: "block", margin: "0 auto" }}>
        <polygon points="0,22 175,22 175,4 240,40 175,76 175,58 0,58" {...stroke} />
        <SvgText lines={lines} cx={90} cy={40} shapeH={36} fontSize={11} />
      </svg>
    );
  }

  if (shape === "rectangle") {
    const lines = wrapText(allText, 22);
    return (
      <svg viewBox="0 0 240 120" width="100%" style={{ maxWidth: "280px", display: "block", margin: "0 auto" }}>
        <rect x={8} y={8} width={224} height={104} rx={8} {...stroke} />
        <SvgText lines={lines} cx={120} cy={60} shapeH={90} fontSize={12} />
      </svg>
    );
  }

  // none / unknown — plain italic description
  return (
    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", color: "#b0b0c8", lineHeight: 1.65, margin: 0, fontStyle: "italic" }}>
      {description}
    </p>
  );
}

// ── DiagramCard ───────────────────────────────────────────────────────────────

function DiagramCard({ el, onDismiss }: { el: NoteElementData; onDismiss: () => void }) {
  const diagram = el.diagram;
  const hasShape = diagram?.shape && diagram.shape !== "none";

  return (
    <div
      style={{ position: "relative", border: `1.5px dashed ${COLORS.textDim}`, borderRadius: "10px", padding: "14px", marginBottom: "18px", background: COLORS.surface, transition: "border-color 0.2s" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.accent)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = COLORS.textDim)}
    >
      {/* Dismiss button — only UI chrome, no title/label */}
      <button
        onClick={onDismiss}
        title="Remove"
        style={{ position: "absolute", top: "8px", right: "8px", background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, width: "20px", height: "20px", borderRadius: "50%", cursor: "pointer", fontSize: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, transition: "all 0.15s", zIndex: 1 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.red; e.currentTarget.style.borderColor = COLORS.red; e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.textMuted; }}
      >
        ✕
      </button>

      {diagram && hasShape ? (
        <ShapeRenderer diagram={diagram} />
      ) : (
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", color: "#b0b0c8", lineHeight: 1.65, margin: 0, fontStyle: "italic", paddingRight: "24px" }}>
          {el.content}
        </p>
      )}
    </div>
  );
}

// ── NoteElement ───────────────────────────────────────────────────────────────

function NoteElement({ el, onDismissDiagram }: { el: NoteElementData; onDismissDiagram: (id: number) => void }) {
  if (el.type === "diagram") {
    return <DiagramCard el={el} onDismiss={() => onDismissDiagram(el.id)} />;
  }

  // Never constrain width from position data — always let elements fill their container
  const wrapStyle: CSSProperties = {
    width: "100%",
    marginBottom: "18px",
    ...getContainerStyle(el.container),
  };

  if (el.type === "header") {
    return (
      <div style={wrapStyle}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: el.style?.is_large ? "1.6rem" : "1.2rem", fontWeight: 700, color: COLORS.text, margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {el.content}
        </h2>
      </div>
    );
  }

  if (el.type === "bullet_list") {
    return (
      <div style={wrapStyle}>
        {el.children?.map((child, i) => (
          <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "flex-start" }}>
            <span style={{ color: COLORS.accent, fontSize: "1rem", lineHeight: "1.7", flexShrink: 0, fontWeight: 700 }}>◆</span>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", color: COLORS.text, lineHeight: 1.7, margin: 0 }}>{child}</p>
          </div>
        ))}
      </div>
    );
  }

  if (el.type === "key_value") {
    const [key, ...rest] = (el.content ?? "").split(":");
    return (
      <div style={{ ...wrapStyle, display: "flex", gap: "12px", alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "0.78rem", fontWeight: 700, color: COLORS.accent, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>{key}</span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", color: COLORS.text }}>{rest.join(":")}</span>
      </div>
    );
  }

  // paragraph / label / other
  return (
    <div style={wrapStyle}>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.95rem", color: el.style?.is_bold ? COLORS.text : "#c0c0d4", lineHeight: 1.8, margin: 0, fontWeight: el.style?.is_bold ? 600 : 400 }}>
        {el.content}
      </p>
    </div>
  );
}

// ── NoteCanvas ────────────────────────────────────────────────────────────────

function NoteCanvas({ elements, layout, dismissed, onDismissDiagram }: {
  elements: NoteElementData[];
  layout: PageLayout;
  dismissed: Set<number>;
  onDismissDiagram: (id: number) => void;
}) {
  const visible = elements.filter((e) => !dismissed.has(e.id));

  if (layout === "single_column" || layout === "unknown") {
    return (
      <div style={{ width: "100%" }}>
        {sortByPosition(visible).map((el) => (
          <NoteElement key={el.id} el={el} onDismissDiagram={onDismissDiagram} />
        ))}
      </div>
    );
  }

  const left = visible.filter((e) => e.position?.region?.includes("left"));
  const right = visible.filter((e) => e.position?.region?.includes("right"));
  const center = visible.filter((e) => !e.position?.region?.includes("left") && !e.position?.region?.includes("right"));

  if (!shouldUseColumns(layout, left, right)) {
    return (
      <div style={{ width: "100%" }}>
        {sortByPosition(visible).map((el) => (
          <NoteElement key={el.id} el={el} onDismissDiagram={onDismissDiagram} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      {/* Center elements always span full width */}
      {sortByPosition(center).map((el) => (
        <NoteElement key={el.id} el={el} onDismissDiagram={onDismissDiagram} />
      ))}
      {(left.length > 0 || right.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px", marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${COLORS.border}` }}>
          <div>{sortByPosition(left).map((el) => <NoteElement key={el.id} el={el} onDismissDiagram={onDismissDiagram} />)}</div>
          <div>{sortByPosition(right).map((el) => <NoteElement key={el.id} el={el} onDismissDiagram={onDismissDiagram} />)}</div>
        </div>
      )}
    </div>
  );
}

// ── UploadZone ────────────────────────────────────────────────────────────────

function UploadZone({ onUpload, loading }: { onUpload: (file: File) => void; loading: boolean }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }, [onUpload]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => (document.getElementById("file-input") as HTMLInputElement)?.click()}
      style={{ border: `2px dashed ${dragging ? COLORS.accent : COLORS.border}`, borderRadius: "16px", padding: "64px 40px", textAlign: "center", cursor: "pointer", background: dragging ? COLORS.accentSoft : COLORS.surface, transition: "all 0.2s ease", boxShadow: dragging ? `0 0 40px ${COLORS.accentGlow}` : "none" }}
    >
      <input id="file-input" type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) onUpload(file); }}
      />
      {loading ? (
        <div>
          <div style={{ width: "40px", height: "40px", border: `3px solid ${COLORS.border}`, borderTop: `3px solid ${COLORS.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: COLORS.textMuted, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Scanning your notes...</p>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: "2.5rem", marginBottom: "14px" }}>📄</div>
          <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: COLORS.text, margin: "0 0 6px" }}>Drop your note image here</p>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", color: COLORS.textMuted, margin: 0 }}>or click to browse · PNG, JPG supported</p>
        </div>
      )}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ fontSize: "0.62rem", color: COLORS.textMuted, fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "0.85rem", color: accent ? COLORS.accent : COLORS.text }}>{value}</div>
    </div>
  );
}

// ── NoteViewer ────────────────────────────────────────────────────────────────

export default function NoteViewer({ onLogout }: NoteViewerProps) {
  const [noteData, setNoteData] = useState<NoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteType, setNoteType] = useState<NoteType>("default");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const handleUpload = async (file: File) => {
    setError(null);
    setLoading(true);
    setDismissed(new Set());
    setImagePreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/ocr?note_type=${noteType}`, { method: "POST", body: formData });
      const data: NoteResponse = await res.json();
      if (data.error) throw new Error(data.error);
      setNoteData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleDismissDiagram = (id: number) => setDismissed((prev) => new Set([...prev, id]));
  const reset = () => { setNoteData(null); setImagePreview(null); setError(null); setDismissed(new Set()); };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${COLORS.bg}f0`, backdropFilter: "blur(14px)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "30px", height: "30px", background: COLORS.accent, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>🍌</div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.05rem", letterSpacing: "0.02em" }}>NotePeel</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {noteData && (
            <>
              <span style={{ fontSize: "0.75rem", color: COLORS.green, background: "#4ade8018", padding: "4px 10px", borderRadius: "20px", border: "1px solid #4ade8033", fontFamily: "'DM Sans', sans-serif" }}>
                ✓ {noteData.elements?.length ?? 0} elements
              </span>
              {dismissed.size > 0 && (
                <span style={{ fontSize: "0.75rem", color: COLORS.textMuted, background: COLORS.surface, padding: "4px 10px", borderRadius: "20px", border: `1px solid ${COLORS.border}`, fontFamily: "'DM Sans', sans-serif" }}>
                  {dismissed.size} hidden
                </span>
              )}
            </>
          )}
          <select value={noteType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNoteType(e.target.value as NoteType)}
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text, padding: "5px 10px", borderRadius: "8px", fontSize: "0.82rem", fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>
            <option value="default">Default</option>
            <option value="lecture">Lecture</option>
            <option value="meeting">Meeting</option>
          </select>
          {noteData && (
            <button onClick={reset} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: "5px 12px", borderRadius: "8px", fontSize: "0.82rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              New note
            </button>
          )}
          <button onClick={onLogout} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: "5px 12px", borderRadius: "8px", fontSize: "0.82rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "40px 24px" }}>
        {!noteData && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <div style={{ textAlign: "center", marginBottom: "44px" }}>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "2.8rem", fontWeight: 800, margin: "0 0 12px", background: `linear-gradient(135deg, ${COLORS.text}, ${COLORS.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Peel back your notes
              </h1>
              <p style={{ color: COLORS.textMuted, fontSize: "1rem", margin: 0 }}>Upload a photo of handwritten notes and watch them come to life digitally.</p>
            </div>
            <UploadZone onUpload={handleUpload} loading={loading} />
            {error && (
              <div style={{ marginTop: "20px", padding: "14px 18px", background: "#f8717118", border: "1px solid #f8717133", borderRadius: "10px", color: COLORS.red, fontSize: "0.875rem" }}>
                ⚠ {error}
              </div>
            )}
          </div>
        )}

        {noteData && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "36px", alignItems: "start" }}>

              {/* Left panel */}
              <div style={{ position: "sticky", top: "80px" }}>
                <div style={{ fontSize: "0.65rem", fontFamily: "'Syne', sans-serif", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "10px" }}>Original</div>
                {imagePreview && <img src={imagePreview} alt="Original note" style={{ width: "100%", borderRadius: "12px", border: `1px solid ${COLORS.border}`, display: "block" }} />}
                <div style={{ marginTop: "14px", padding: "14px", background: COLORS.surface, borderRadius: "10px", border: `1px solid ${COLORS.border}` }}>
                  <Row label="Layout" value={noteData.page_layout} />
                  <Row label="Model" value={noteData.metadata?.model} accent />
                  <Row label="Elements" value={String(noteData.elements?.length ?? 0)} />
                  {dismissed.size > 0 && <Row label="Hidden" value={String(dismissed.size)} />}
                </div>
                {dismissed.size > 0 && (
                  <button onClick={() => setDismissed(new Set())}
                    style={{ marginTop: "10px", width: "100%", background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: "7px", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    Restore {dismissed.size} hidden element{dismissed.size > 1 ? "s" : ""}
                  </button>
                )}
              </div>

              {/* Right panel */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.65rem", fontFamily: "'Syne', sans-serif", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "10px" }}>Rebuilt</div>
                <div style={{ background: COLORS.surface, borderRadius: "16px", border: `1px solid ${COLORS.border}`, padding: "32px 36px", width: "100%" }}>
                  <NoteCanvas elements={noteData.elements ?? []} layout={noteData.page_layout} dismissed={dismissed} onDismissDiagram={handleDismissDiagram} />
                </div>
                <details style={{ marginTop: "14px" }}>
                  <summary style={{ cursor: "pointer", fontSize: "0.72rem", color: COLORS.textMuted, fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.1em", userSelect: "none", padding: "8px 0" }}>
                    Raw transcription
                  </summary>
                  <pre style={{ marginTop: "8px", padding: "16px", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "10px", fontSize: "0.78rem", color: COLORS.textMuted, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", lineHeight: 1.65 }}>
                    {noteData.raw_text}
                  </pre>
                </details>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}