import Link from "next/link";
import { FIRMA } from "@/lib/firma";
import { Ordmerke } from "./ordmerke";

// The footer of the landing page and the terms and privacy pages: who sells Tvistr on the left.
export function Bunn() {
  return (
    <footer style={{ background: "#FFFFFF" }}>
      <div className="wrap bunn" style={{ paddingTop: 40, paddingBottom: 48, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Ordmerke size={26} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: 14.5, color: "#465150" }}>
              <span>{FIRMA.navn}</span>
              <span>Org.nr. {FIRMA.orgnr}</span>
              <span>{FIRMA.adresse}</span>
              <a href={`mailto:${FIRMA.epost}`} style={{ color: "#1F3A5F" }}>
                {FIRMA.epost}
              </a>
            </div>
          </div>
          <nav aria-label="Vilkår og personvern" style={{ display: "flex", gap: 20, fontSize: 14.5, fontWeight: 500 }}>
            <Link href="/vilkar">Vilkår</Link>
            <Link href="/personvern">Personvern</Link>
          </nav>
        </div>
        <p style={{ margin: 0, paddingTop: 20, borderTop: "1px solid #E3E7E5", fontSize: 14, color: "#869190" }}>En mal basert på forbrukerkjøpsloven. Ikke juridisk rådgivning.</p>
      </div>
    </footer>
  );
}
