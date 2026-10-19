import { Topp } from "@/app/deler/topp";
import { LoggUt } from "@/app/deler/logg-ut";

// Shown to a logged-in user who does not own the case. Says nothing about the case itself.
export function AnnenKonto() {
  return (
    <div className="home" style={{ minHeight: "100vh", background: "#F5F6F8" }}>
      <Topp />
      <main className="wrap">
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "64px 0", display: "flex", flexDirection: "column", gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em" }}>Denne saken tilhører en annen Vipps-konto. Logg inn med Vipps-kontoen som betalte.</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <LoggUt />
          </div>
        </div>
      </main>
    </div>
  );
}
