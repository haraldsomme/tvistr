import Link from "next/link";
import { Konto } from "./konto";
import { Ordmerke } from "./ordmerke";

// The header of the pages that are not the landing page: the wordmark and the way into the check.
export function Topp() {
  return (
        <header style={{ borderBottom: "1px solid #E2E6EC" }}>
          <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, height: 68 }}>
            <Link href="/" aria-label="Tvistr, til forsiden" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
              <Ordmerke size={30} />
            </Link>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Konto />
            <Link href="/sak?start" className="btn-pri" style={{ display: "inline-flex", alignItems: "center", height: 42, padding: "0 18px", borderRadius: 12, background: "#2B5BF0", color: "#FFFFFF", fontSize: 14, fontWeight: 550, textDecoration: "none", whiteSpace: "nowrap" }}>
              Sjekk saken din
            </Link>
            </div>
          </div>
        </header>
  );
}
