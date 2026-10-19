import type { Metadata } from "next";
import { Topp } from "@/app/deler/topp";

export const metadata: Metadata = { title: "Innlogging – Tvistr", robots: { index: false, follow: false } };

// Every rejected login ends here. The retry is a plain <a>: /logg-inn is a route handler that sends
// the user on to Vipps, and a prefetching <Link> would start logins nobody asked for.
export default function Page() {
  return (
    <div className="home" style={{ minHeight: "100vh", background: "#F5F6F8" }}>
      <Topp />
      <main className="wrap">
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "64px 0", display: "flex", flexDirection: "column", gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em" }}>Innloggingen ble ikke fullført</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/logg-inn" className="btn pri" style={{ textDecoration: "none" }}>
              Prøv igjen
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
