import { useEffect, useState } from "react";

export default function App() {
  const [msg, setMsg] = useState("checking...");
  const base = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    fetch(`${base}/health`)
      .then(async (r) => setMsg(`API ${r.status}: ${await r.text()}`))
      .catch((e) => setMsg(`API ERROR: ${String(e)}`));
  }, [base]);

  return (
    <div style={{ padding: 16 }}>
      <div>VITE_API_BASE_URL: {base}</div>
      <div>{msg}</div>
    </div>
  );
}