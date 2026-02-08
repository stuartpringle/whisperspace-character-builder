import { useEffect, useState } from "react";
import { RULES_API_BASE } from "@whisperspace/sdk";

export default function App() {
  const [apiStatus, setApiStatus] = useState<string>("checking...");

  useEffect(() => {
    let active = true;
    fetch(`${RULES_API_BASE}/meta.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((meta) => {
        if (!active) return;
        setApiStatus(`rules v${meta.version}`);
      })
      .catch(() => {
        if (!active) return;
        setApiStatus("offline");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app">
      <header>
        <div className="eyebrow">Whisperspace</div>
        <h1>Character Builder</h1>
        <p className="status">Rules API: {apiStatus}</p>
      </header>

      <section className="card">
        <h2>Next Steps</h2>
        <ol>
          <li>Define the character creation flow.</li>
          <li>Fetch rules + equipment data from the API.</li>
          <li>Implement a saved character JSON schema.</li>
        </ol>
      </section>
    </div>
  );
}
