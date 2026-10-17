import Link from "next/link";
import type { ReactNode } from "react";
import { Bunn } from "./bunn";
import { Ordmerke } from "./ordmerke";

// The terms and the privacy statement: the landing page's header and footer around one text column.
export function Juridisk({ tittel, oppdatert, children }: { tittel: string; oppdatert: string; children: ReactNode }) {
  return (
    <div className="home" style={{ minHeight: "100vh", background: "#F5F6F8" }}>
      <header style={{ borderBottom: "1px solid #E2E6EC" }}>
        <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, height: 68 }}>
          <Link href="/" aria-label="Tvistr, til forsiden" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <Ordmerke size={30} />
          </Link>
          <Link href="/sak?start" className="btn-pri" style={{ display: "inline-flex", alignItems: "center", height: 42, padding: "0 18px", borderRadius: 12, background: "#2B5BF0", color: "#FFFFFF", fontSize: 14, fontWeight: 550, textDecoration: "none", whiteSpace: "nowrap" }}>
            Sjekk saken din
          </Link>
        </div>
      </header>
      <main className="wrap">
        <article className="jur" style={{ margin: "0 auto" }}>
          <h1>{tittel}</h1>
          <p className="jur-dato">Sist oppdatert {oppdatert}</p>
          {children}
        </article>
      </main>
      <Bunn />
    </div>
  );
}
