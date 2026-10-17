"use client";

// The last resort for an error nothing else caught. The answers are kept in localStorage, so loading
// the page again continues where the buyer was.
// The order is kept, so a buyer who has paid keeps access.
function startPaNytt() {
  try {
    localStorage.removeItem("tvistr-sjekk");
    localStorage.removeItem("tvistr-skjema");
  } catch {}
  window.location.reload();
}

export default function Feil() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em" }}>Noe gikk galt</h1>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "#455063" }}>Vi fikk ikke vist siden. Svarene dine er lagret i nettleseren.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => window.location.reload()} style={{ font: "inherit", fontWeight: 600, padding: "12px 20px", borderRadius: 12, border: "none", background: "#2B5BF0", color: "#fff", cursor: "pointer" }}>
          Prøv igjen
        </button>
        {/* A stored answer the page cannot read would fail again on reload; this clears the draft. */}
        <button type="button" onClick={startPaNytt} style={{ font: "inherit", fontWeight: 600, padding: "12px 20px", borderRadius: 12, border: "1px solid #CBD3DD", background: "#fff", color: "#455063", cursor: "pointer" }}>
          Start på nytt
        </button>
      </div>
    </div>
  );
}
