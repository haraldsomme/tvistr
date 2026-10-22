"use client";

// The two panes of the new flow (mockup «Sjekk saken»): the questions on the left and the letter on
// the right from 960px, the letter pane sticky under the header. Narrower, the letter is a bottom
// sheet behind a peek bar that shows what was just added and how much is filled in.
import { createContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Dokument, Opp } from "@/app/deler/ikoner";

// Set while the letter is a bottom sheet: Brevrute draws its close button from it.
export const Ark = createContext<{ lukk: () => void } | null>(null);

const BRED = "(min-width: 960px)";
const lytt = (f: () => void) => {
  const m = matchMedia(BRED);
  m.addEventListener("change", f);
  return () => m.removeEventListener("change", f);
};
const erBred = () => matchMedia(BRED).matches;

export function Oppsett({ topp, venstre, brev, kikk }: { topp: ReactNode; venstre: ReactNode; brev: ReactNode; kikk: { tekst: string; fylt: number; totalt: number } }) {
  const [apen, settApen] = useState(false);
  // The server and the first render draw two panes; the sheet only exists in a narrow browser.
  const bred = useSyncExternalStore(lytt, erBred, () => true);
  const ark = useRef<HTMLElement>(null);
  const knapp = useRef<HTMLButtonElement>(null);
  const ute = !bred && apen;

  // Focus moves into the open sheet and back to the peek bar when it closes; Escape closes it.
  useEffect(() => {
    if (!ute) return;
    ark.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") settApen(false);
    };
    document.addEventListener("keydown", esc);
    const k = knapp.current;
    return () => {
      document.removeEventListener("keydown", esc);
      k?.focus({ preventScroll: true });
    };
  }, [ute]);

  const pst = kikk.totalt ? Math.round((kikk.fylt / kikk.totalt) * 100) : 0;
  return (
    <div className="fl-app">
      {topp}
      <div className="fl-rom">
        <div className="fl-venstre">
          <div className="fl-kol">{venstre}</div>
        </div>
        <section ref={ark} className="fl-brev" data-apen={ute || undefined} aria-label="Brevet ditt" tabIndex={-1} inert={!bred && !apen}>
          <Ark.Provider value={bred ? null : { lukk: () => settApen(false) }}>{brev}</Ark.Provider>
        </section>
        <button ref={knapp} type="button" className="fl-kikk" onClick={() => settApen(true)} aria-expanded={ute} aria-label={`Brevet ditt${kikk.tekst ? `, ${kikk.tekst}` : ""}. ${kikk.fylt} av ${kikk.totalt} fylt inn. Åpne brevet.`}>
          <span className="fl-kikk-i" aria-hidden="true">
            <Dokument s={19} />
          </span>
          <span className="fl-kikk-t">
            <span className="fl-kikk-l">
              <span>{kikk.tekst || "Brevet ditt"}</span>
              <span className="fl-kikk-n">
                {kikk.fylt}/{kikk.totalt}
              </span>
            </span>
            <span className="fl-bar">
              <span style={{ width: `${pst}%` }} />
            </span>
          </span>
          <Opp style={{ color: "#475467" }} />
        </button>
      </div>
    </div>
  );
}
