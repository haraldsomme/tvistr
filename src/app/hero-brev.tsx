"use client";

import { Fragment, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Dokument, Hake, Pil } from "./deler/ikoner";
import type { Fane } from "./eksempelbrev";

// The card in the hero: one excerpt of the letter at a time (the tabs and texts come from eksempelbrev.ts).

const BLA = "#2B5BF0";
const MONO = "var(--f-mono)";

// The highlighted phrases of a tab, found in the text in the order they appear.
function Merket({ tekst, merk }: { tekst: string; merk: string[] }) {
  const deler = tekst.split(new RegExp(`(${merk.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`));
  return deler.map((d, i) =>
    merk.includes(d) ? (
      <mark key={i} style={{ background: "#E8EEFE", color: BLA, padding: "1px 4px", borderRadius: 4, whiteSpace: "nowrap" }}>
        {d}
      </mark>
    ) : (
      <Fragment key={i}>{d}</Fragment>
    ),
  );
}

export function HeroBrev({ faner }: { faner: Fane[] }) {
  const [valgt, setValgt] = useState(0);
  const knapper = useRef<(HTMLButtonElement | null)[]>([]);
  const f = faner[valgt];

  // Arrow keys move between the tabs, as in the tab pattern.
  function taste(e: KeyboardEvent, i: number) {
    const til = e.key === "ArrowRight" ? (i + 1) % faner.length : e.key === "ArrowLeft" ? (i - 1 + faner.length) % faner.length : e.key === "Home" ? 0 : e.key === "End" ? faner.length - 1 : null;
    if (til === null) return;
    e.preventDefault();
    setValgt(til);
    knapper.current[til]?.focus();
  }

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 22, boxShadow: "var(--sh-1)", padding: "22px 22px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: "#E8EEFE", color: BLA, display: "grid", placeItems: "center" }}>
            <Dokument s={16} />
          </span>
          Dette står i brevet ditt
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "#10141A", color: "#FFFFFF" }}>Eksempel</span>
      </div>

      <div role="tablist" aria-label="Utdrag fra brevet" style={{ display: "grid", gridTemplateColumns: `repeat(${faner.length}, minmax(0, 1fr))`, gap: 3, padding: 4, borderRadius: 12, background: "#ECEFF3" }}>
        {faner.map((x, i) => (
          <button
            key={x.id}
            ref={(el) => {
              knapper.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`fane-${x.id}`}
            aria-selected={i === valgt}
            aria-controls="fane-panel"
            tabIndex={i === valgt ? 0 : -1}
            onClick={() => setValgt(i)}
            onKeyDown={(e) => taste(e, i)}
            style={{
              minHeight: 44, padding: "0 8px", border: 0, borderRadius: 9, font: "inherit", fontSize: 14, cursor: "pointer",
              ...(i === valgt ? { background: "#FFFFFF", color: "#10141A", fontWeight: 600, boxShadow: "0 1px 2px rgba(16,20,26,.07), 0 0 0 1px #E2E6EC" } : { background: "transparent", color: "#455063", fontWeight: 500 }),
            }}
          >
            {x.navn}
          </button>
        ))}
      </div>

      <div id="fane-panel" role="tabpanel" aria-labelledby={`fane-${f.id}`} style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 230 }}>
        <div style={{ fontFamily: "var(--f-doc)", fontSize: 15.5, lineHeight: 1.65, color: "#1A1E24", padding: "18px 20px", borderRadius: 12, background: "#FBFBFC", border: "1px solid #E2E6EC" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{f.overskrift}</div>
          <p style={{ margin: 0 }}>
            <Merket tekst={f.setninger.join(" ")} merk={f.merk} />
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, fontSize: 14, lineHeight: 1.5, color: "#455063" }}>
          <span style={{ display: "flex", gap: 10 }}>
            <span style={{ flex: "none", marginTop: 2, color: "#1E7A4C", display: "inline-flex" }}>
              <Hake s={16} w={2.4} />
            </span>
            {f.forklaring}
          </span>
          {f.lenke && (
            <a href={f.lenke} target="_blank" rel="noopener" style={{ flex: "none", fontWeight: 550, color: BLA }}>
              Les vedtaket
            </a>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 16, borderTop: "1px solid #E2E6EC" }}>
        <Link href="/brevet" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 550, color: BLA, textDecoration: "none" }}>
          Se alt brevet inneholder
          <Pil />
        </Link>
        <span style={{ fontFamily: MONO, fontSize: 12, color: BLA, whiteSpace: "nowrap" }}>
          {valgt + 1} / {faner.length}
        </span>
      </div>
    </div>
  );
}
