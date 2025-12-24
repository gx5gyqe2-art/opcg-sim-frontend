import { useEffect, useState } from "react";

export default function App() {
  const base = import.meta.env.VITE_API_BASE_URL;
  const [msg, setMsg] = useState("checking...");

  useEffect(() => {
    fetch(`${base}/health`)
      .then(async (r) => setMsg(`API ${r.status}: ${await r.text()}`))
      .catch((e) => setMsg(`API ERROR: ${String(e)}`));
  }, [base]);

  return (
    <div style={{ padding: 16 }}>
      <div>BASE: {base}</div>
      <div>{msg}</div>
    </div>
  );
}