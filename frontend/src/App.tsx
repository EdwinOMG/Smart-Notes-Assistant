import { useState } from "react";

function App() {
  const [file, setFile] = useState<File | null>(null); // holds the selected file
  const [result, setResult] = useState<string>(""); // holds text output returned from backend
// usestate makes component reactive, so when changed the ui will update automatically

  const upload = async () => {
  if (!file) return;

  const form = new FormData();
  form.append("file", file);

  // send request to backend, which will return the extracted text
  const res = await fetch("http://localhost:8000/ocr", {
    method: "POST",
    body: form
  });

  /// makes json into js object
  const data = await res.json();

  // formats structured ocr data
  let text = "";
  if (data.key_values) {
    text += "Key-Values:\n";
    for (const [k, v] of Object.entries(data.key_values)) {
      text += `${k}: ${v}\n`;
    }
  }

  if (data.table_rows) {
    text += "\nTable Rows:\n";
    for (const row of data.table_rows) {
      text += row.join(" | ") + "\n";
    }
  }
// update the state
  setResult(text);
  
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