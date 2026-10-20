"use client";

import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Hake, Pil } from "./deler/ikoner";
import type { Fane } from "./eksempelbrev";

// The card in the hero: one excerpt of the letter at a time (the tabs and texts come from eksempelbrev.ts).
// The excerpts rotate every 7 seconds, except while the card is hovered or has focus, after the visitor
// has picked one, and when the visitor asks for less motion.

const BLA = "#1F3A5F";
const MONO = "var(--f-mono)";
const TAKT = 7000;

// The highlighted phrases of a tab, found in the text in the order they appear.
function Merket({ tekst, merk }: { tekst: string; merk: string[] }) {
  const deler = tekst.split(new RegExp(`(${merk.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`));
  return deler.map((d, i) =>
    merk.includes(d) ? (
      <mark key={i} style={{ background: "#EBEFF5", color: BLA, padding: "1px 4px", borderRadius: 4, whiteSpace: "nowrap" }}>
        {d}
      </mark>
    ) : (
      <Fragment key={i}>{d}</Fragment>
    ),
  );
}

const pilKnapp = { width: 40, height: 40, border: "1px solid #CDD5D2", borderRadius: 12, background: "#FFFFFF", color: "#111515", display: "grid", placeItems: "center", cursor: "pointer" } as const;

export function HeroBrev({ faner }: { faner: Fane[] }) {
  const [valgt, setValgt] = useState(0);
  const [pauset, setPauset] = useState(false);
  const [valgtSelv, setValgtSelv] = useState(false);
  const knapper = useRef<(HTMLButtonElement | null)[]>([]);
  const f = faner[valgt];

  useEffect(() => {
    if (pauset || valgtSelv || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setValgt((v) => (v + 1) % faner.length), TAKT);
    return () => clearInterval(t);
  }, [pauset, valgtSelv, faner.length]);

  function gaTil(i: number) {
    setValgtSelv(true);
    setValgt((i + faner.length) % faner.length);
  }

  // Arrow keys move between the tabs, as in the tab pattern.
  function taste(e: KeyboardEvent, i: number) {
    const til = e.key === "ArrowRight" ? (i + 1) % faner.length : e.key === "ArrowLeft" ? (i - 1 + faner.length) % faner.length : e.key === "Home" ? 0 : e.key === "End" ? faner.length - 1 : null;
    if (til === null) return;
    e.preventDefault();
    gaTil(til);
    knapper.current[til]?.focus();
  }

  return (
    <div
      onMouseEnter={() => setPauset(true)}
      onMouseLeave={() => setPauset(false)}
      onFocus={() => setPauset(true)}
      onBlur={() => setPauset(false)}
      style={{ padding: "clamp(20px, 2.4vw, 28px)", borderRadius: 28, background: "#FFFFFF", boxShadow: "0 0 0 1px rgba(17,21,21,.05), 0 40px 80px -48px rgba(31,58,95,.45)", display: "flex", flexDirection: "column", gap: 20 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: "#111515" }}>Dette står i brevet ditt</span>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, padding: "5px 11px", borderRadius: 999, background: "#111515", color: "#FFFFFF" }}>Eksempel</span>
      </div>

      <div role="tablist" aria-label="Utdrag fra brevet" style={{ display: "grid", gridTemplateColumns: `repeat(${faner.length}, minmax(0, 1fr))`, gap: 4, padding: 4, borderRadius: 14, background: "#F1F3F4" }}>
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
            onClick={() => gaTil(i)}
            onKeyDown={(e) => taste(e, i)}
            style={{
              height: 40, padding: "0 8px", border: 0, borderRadius: 10, font: "inherit", fontSize: 14.5, fontWeight: 500, cursor: "pointer", transition: "background .2s, color .2s",
              ...(i === valgt ? { background: "#FFFFFF", color: BLA, boxShadow: "0 1px 2px rgba(17,21,21,.08), 0 0 0 1px rgba(17,21,21,.04)" } : { background: "transparent", color: "#465150" }),
            }}
          >
            {x.navn}
          </button>
        ))}
      </div>

      <div id="fane-panel" role="tabpanel" aria-labelledby={`fane-${f.id}`} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ minHeight: 300, padding: "clamp(24px, 3vw, 36px)", border: "1px solid #E3E6E8", borderRadius: 6, background: "#FCFCFB", fontFamily: "var(--f-doc)", display: "flex", flexDirection: "column", gap: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: "#111515" }}>{f.overskrift}</span>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.75, color: "#111515", textWrap: "pretty" }}>
            <Merket tekst={f.setninger.join(" ")} merk={f.merk} />
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "16px 18px", borderRadius: 16, background: "#EBEFF5" }}>
          <span style={{ flex: "none", marginTop: 2, color: BLA, display: "inline-flex" }}>
            <Hake s={18} w={2.4} />
          </span>
          <span style={{ fontSize: 15, lineHeight: 1.5, color: "#16294A", textWrap: "pretty" }}>
            {f.forklaring}
            {f.lenke && (
              <>
                {" "}
                <a href={f.lenke} target="_blank" rel="noopener" style={{ fontWeight: 600, color: BLA, whiteSpace: "nowrap" }}>
                  Les vedtaket
                </a>
              </>
            )}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <Link href="/brevet" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600, color: BLA, textDecoration: "none" }}>
          Se alt brevet inneholder
          <Pil />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button type="button" aria-label="Forrige" onClick={() => gaTil(valgt - 1)} style={pilKnapp}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <span aria-live="off" style={{ minWidth: 44, textAlign: "center", fontFamily: MONO, fontSize: 13, color: "#465150" }}>
            {valgt + 1} / {faner.length}
          </span>
          <button type="button" aria-label="Neste" onClick={() => gaTil(valgt + 1)} style={pilKnapp}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
