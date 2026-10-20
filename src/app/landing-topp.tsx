"use client";

import Link from "next/link";
import { useState } from "react";
import { Konto } from "./deler/konto";
import { Ordmerke } from "./deler/ordmerke";

// The header of the landing page: anchors to the sections, the account link and the check button.
// From 1100px the links sit in the bar; below it they fold into a menu (the switch is in CSS, `.lp-wide`
// and `.lp-narrow`). Below 560px «Logg inn» moves from the bar into the menu.

const LENKER = [
  ["#slik", "Slik fungerer det"],
  ["#saker", "Vunnede saker"],
  ["#rettigheter", "Dine rettigheter"],
  ["#avslag", "Hvis de sier nei"],
  ["#sporsmal", "Spørsmål"],
] as const;

export function LandingTopp() {
  const [apen, setApen] = useState(false);
  const lukk = () => setApen(false);
  return (
    <header style={{ position: "sticky", top: "env(safe-area-inset-top, 0px)", zIndex: 10, background: "rgba(244,245,246,.88)", backdropFilter: "saturate(1.4) blur(12px)", WebkitBackdropFilter: "saturate(1.4) blur(12px)", borderBottom: "1px solid #E3E6E8" }}>
      <div className="lp-in" style={{ height: 72, display: "flex", alignItems: "center", gap: 32 }}>
        <a href="#top" aria-label="Tvistr, til toppen" style={{ textDecoration: "none", color: "#111515" }}>
          <Ordmerke size={28} />
        </a>
        <nav className="lp-wide lp-nav" aria-label="Hovedmeny" style={{ flex: 1, gap: 4 }}>
          {LENKER.map(([href, navn]) => (
            <a key={href} href={href}>
              {navn}
            </a>
          ))}
        </nav>
        <span className="lp-narrow" style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
          <span className="lp-login">
            <Konto variant="lenke" />
          </span>
          <Link href="/sak?start" className="lp-pri" style={{ height: 44, padding: "0 18px", borderRadius: 12, display: "flex", alignItems: "center", fontSize: 15, fontWeight: 500, whiteSpace: "nowrap", textDecoration: "none" }}>
            Sjekk saken din
          </Link>
          <button
            type="button"
            className="lp-narrow lp-burger"
            aria-label="Meny"
            aria-expanded={apen}
            aria-controls="lp-meny"
            onClick={() => setApen((a) => !a)}
            style={{ width: 44, height: 44, border: "1px solid #CDD5D2", borderRadius: 12, background: "#FFFFFF", color: "#111515", placeItems: "center" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={apen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
        </div>
      </div>
      {apen && (
        <nav id="lp-meny" className="lp-narrow lp-in" aria-label="Meny" style={{ paddingTop: 4, paddingBottom: 16, flexDirection: "column" }}>
          {LENKER.map(([href, navn]) => (
            <a key={href} href={href} onClick={lukk} className="lp-rad">
              {navn}
            </a>
          ))}
          <span className="lp-loginmeny">
            <Konto variant="meny" onVelgAction={lukk} />
          </span>
        </nav>
      )}
    </header>
  );
}
