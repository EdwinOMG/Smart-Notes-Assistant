import { useState } from "react";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>("");

  const upload = async () => {
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("http://localhost:8000/ocr", {
      method: "POST",
      body: form
    });

    const data: { text: string } = await res.json();
    setResult(data.text);
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Upload Notes</h2>

      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <br /><br />

      <button onClick={upload}>Upload</button>

      <pre style={{ marginTop: 20 }}>
        {result}
      </pre>
    </div>
  );
}

export default App;