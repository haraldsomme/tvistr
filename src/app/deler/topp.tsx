import Link from "next/link";
import { Konto } from "./konto";
import { Ordmerke } from "./ordmerke";

// The header of the pages that are not the landing page: the wordmark and the account link.
export function Topp() {
  return (
    <header style={{ borderBottom: "1px solid #E3E6E8" }}>
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, height: 68 }}>
        <Link href="/" aria-label="Tvistr, til forsiden" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <Ordmerke size={28} />
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Konto />
        </div>
      </div>
    </header>
  );
}
