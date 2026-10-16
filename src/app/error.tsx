"use client";

// The last resort for an error nothing else caught. The form keeps its answers in sessionStorage, so
// loading the page again continues where the buyer was.
import { A, H1, INGRESS, SANS } from "./sak/deler";

export default function Feil() {
  return (
    <div style={{ fontFamily: SANS, maxWidth: 560, margin: "0 auto", padding: "64px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={H1}>Noe gikk galt</h1>
      <p style={INGRESS}>Vi fikk ikke vist siden. Svarene dine er lagret i nettleseren.</p>
      <button type="button" onClick={() => window.location.reload()} style={{ alignSelf: "flex-start", font: "inherit", fontWeight: 600, padding: "12px 20px", borderRadius: 10, border: "none", background: A, color: "#fff", cursor: "pointer" }}>
        Prøv igjen
      </button>
    </div>
  );
}
