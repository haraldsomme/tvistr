"use client";

// The account in the new flow's header (mockup «Sjekk saken»): «Logg inn med Vipps» when logged out,
// else a button with the owner's initials that opens their letters, «Start en ny sak» and «Logg ut».
// Logged in is decided from the hint cookie, as Konto does; the letters come from the real session
// (mineBrev). «Logg inn» is a plain <a>: a <Link> would prefetch /logg-inn, which starts a login. The
// menu is a popover: a click outside or Escape closes it, and every item loads a new page.
import { useEffect, useState } from "react";
import { FeilSymbol } from "@/app/deler/feilliste";
import { Fold, Pluss } from "@/app/deler/ikoner";
import { useInne } from "@/app/deler/konto";
import { loggUtOgForlat } from "@/app/deler/logg-ut";
import { mineBrev, type MittBrev } from "@/app/sak/mine";

// «Kari Anne Nordmann» → «KN».
export const initialer = (navn: string) => {
  const ord = navn.split(/\s+/).filter(Boolean);
  return (ord.length > 1 ? ord[0][0] + ord[ord.length - 1][0] : (ord[0] ?? "").slice(0, 2)).toUpperCase();
};

export function Kontomeny({ aktivSak }: { aktivSak?: string }) {
  const inne = useInne();
  const [konto, settKonto] = useState<{ navn: string | null; brev: MittBrev[] } | null>(null);

  useEffect(() => {
    if (!inne) return;
    let levende = true;
    mineBrev()
      .then((k) => levende && settKonto(k))
      .catch(() => {});
    return () => {
      levende = false;
    };
  }, [inne]);

  if (!inne)
    return (
      <a href="/logg-inn?til=/min-side" className="fl-knapp">
        Logg inn med <b className="fl-vipps">Vipps</b>
      </a>
    );

  const navn = konto?.navn ?? null;
  const brev = konto?.brev ?? [];
  const aktiv = brev.find((b) => b.id === aktivSak);
  // Beside the initials on wider screens: the open case's car, else the first name. Without a name
  // the car stands in for it.
  const etikett = aktiv?.bil || navn?.split(/\s+/)[0] || brev[0]?.bil || "";
  return (
    <div className="fl-konto">
      <button type="button" className="fl-knapp fl-konto-k" popoverTarget="fl-konto-meny" aria-label={navn ? `Konto: ${navn}` : "Konto"}>
        <span className="fl-init" aria-hidden="true">
          {navn ? initialer(navn) : <FeilSymbol id="karosseri" s={16} w={2} />}
        </span>
        {etikett && <span className="fl-konto-e">{etikett}</span>}
        <Fold s={14} w={2.2} style={{ color: "#6B7689" }} />
      </button>
      <div id="fl-konto-meny" className="fl-meny" popover="auto">
        <div className="fl-meny-h">
          {navn && <span className="fl-meny-navn">{navn}</span>}
          <span className="fl-meny-s">Logget inn med Vipps</span>
        </div>
        {brev.length > 0 && (
          <>
            <span className="fl-meny-o">Dine brev</span>
            {brev.map((b) => (
              <a key={b.id} href={`/sak/${b.id}`} className="fl-meny-r" aria-current={b.id === aktivSak ? "page" : undefined}>
                <span className="fl-meny-rt">
                  <span>{[b.bil || "Bil", b.reg].filter(Boolean).join(" · ")}</span>
                  <span className="fl-meny-s">{[b.feil, b.dato].filter(Boolean).join(" · ")}</span>
                </span>
                {b.id === aktivSak && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17304F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </a>
            ))}
          </>
        )}
        {/* A full load on purpose: /sak reads `?ny` when it starts, and must not keep the open draft in memory. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/sak?ny" className="fl-meny-r fl-meny-ny">
          <Pluss s={16} w={2.2} />
          Start en ny sak
        </a>
        <div className="fl-meny-skille" />
        <form action={loggUtOgForlat}>
          <button type="submit" className="fl-meny-r">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
            </svg>
            Logg ut
          </button>
        </form>
      </div>
    </div>
  );
}
