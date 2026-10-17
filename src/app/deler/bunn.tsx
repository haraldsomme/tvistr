import Link from "next/link";
import type { ReactNode } from "react";
import { FIRMA } from "@/lib/firma";
import { Bygning, Post, Sted } from "./ikoner";
import { Ordmerke } from "./ordmerke";

const Linje = ({ ikon, children }: { ikon: ReactNode; children: ReactNode }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    <span style={{ display: "inline-flex", color: "#2B5BF0" }}>{ikon}</span>
    {children}
  </span>
);

// The footer of the landing page and the terms and privacy pages: who sells Tvistr on the left.
export function Bunn() {
  return (
    <footer style={{ borderTop: "1px solid #E2E6EC" }}>
      <div className="wrap bunn" style={{ paddingTop: 32, paddingBottom: 40, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "24px 32px", fontSize: 13, color: "#5B6576" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <Ordmerke size={20} />
            <span>{FIRMA.navn}</span>
          </span>
          <Linje ikon={<Bygning />}>Org.nr. {FIRMA.orgnr}</Linje>
          <Linje ikon={<Sted />}>{FIRMA.adresse}</Linje>
          <Linje ikon={<Post />}>
            <a href={`mailto:${FIRMA.epost}`}>{FIRMA.epost}</a>
          </Linje>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: "46ch" }}>
          <nav aria-label="Vilkår og personvern" style={{ display: "flex", gap: 20, fontWeight: 550 }}>
            <Link href="/vilkar">Vilkår</Link>
            <Link href="/personvern">Personvern</Link>
          </nav>
          <span style={{ lineHeight: 1.55 }}>En mal basert på forbrukerkjøpsloven. Ikke juridisk rådgivning.</span>
        </div>
      </div>
    </footer>
  );
}
