"use client";

// The last resort for an error nothing else caught. The answers are kept in localStorage, so loading
// the page again continues where the buyer was.
export default function Feil() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em" }}>Noe gikk galt</h1>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "#455063" }}>Vi fikk ikke vist siden. Svarene dine er lagret i nettleseren.</p>
      <button type="button" onClick={() => window.location.reload()} style={{ alignSelf: "flex-start", font: "inherit", fontWeight: 600, padding: "12px 20px", borderRadius: 12, border: "none", background: "#1F4F8F", color: "#fff", cursor: "pointer" }}>
        Prøv igjen
      </button>
    </div>
  );
}
