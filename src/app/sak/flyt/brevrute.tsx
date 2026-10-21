// The letter pane (mockup «Sjekk saken»): the header with «Brevet ditt», the page's label and a bar
// for how much of the letter is filled in, then the letter on an A4 sheet with one numbered bubble per
// section. What the buyer just filled in is marked for a moment, and the pane follows it unless the
// reader is scrolling the letter themselves.
import { useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Adresser, BlokkEl, NyeFelt } from "@/app/sak/[id]/papir";
import type { Blokk, Del } from "@/lib/app/brevtyper";
import { Ark } from "./oppsett";

const MERKET_MS = 2500;
// A reader who scrolled the letter this recently is left where they are.
const LESER_MS = 4000;

// Every run of parts in a block.
function delerAv(b: Blokk): Del[][] {
  switch (b.t) {
    case "addr":
    case "sign":
      return b.linjer;
    case "ul":
    case "ol":
      return b.punkter;
    case "prec":
      return b.avsnitt;
    case "exp":
      return b.rader.map(([d]) => d);
    default:
      return [b.tekst];
  }
}
const alleDeler = (b: Blokk[]): Del[] => b.flatMap((x) => delerAv(x).flat());

// Each field's text in the letter (all its places together, a field can stand more than once).
function feltTekst(b: Blokk[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const d of alleDeler(b)) if (typeof d === "object" && "felt" in d) m.set(d.felt, m.has(d.felt) ? `${m.get(d.felt)}\u0001${d.tekst}` : d.tekst);
  return m;
}

// The fields whose text is new or changed since the last letter, in the order they stand in it.
// Nothing for the first letter: there is no change to show yet.
export function endredeFelt(for_: Blokk[] | null, na: Blokk[]): string[] {
  if (!for_) return [];
  const forrige = feltTekst(for_);
  return [...feltTekst(na)].filter(([k, v]) => forrige.get(k) !== v).map(([k]) => k);
}

export type Seksjon = { fra: number; til: number; fylt: "ja" | "delvis" | "nei" };

// The numbered sections: the blocks before the first heading, then one per heading. A section is
// filled when it has no placeholder left, partly when it has some of the buyer's answers too.
export function seksjoner(b: Blokk[]): Seksjon[] {
  const start = b.flatMap((x, i) => (i === 0 || x.t === "h" ? [i] : []));
  return start
    .map((fra, j) => ({ fra, til: start[j + 1] ?? b.length }))
    .filter((s) => s.til > s.fra)
    .map(({ fra, til }) => {
      const d = alleDeler(b.slice(fra, til));
      const ph = d.some((x) => typeof x === "object" && "ph" in x);
      const felt = d.some((x) => typeof x === "object" && "felt" in x);
      return { fra, til, fylt: !ph ? "ja" : felt ? "delvis" : "nei" };
    });
}

// The share of the buyer's answers among the places the letter has for them.
function andel(b: Blokk[]): number {
  let felt = 0,
    ph = 0;
  for (const d of alleDeler(b))
    if (typeof d === "object" && "felt" in d) felt++;
    else if (typeof d === "object" && "ph" in d) ph++;
  return felt + ph ? Math.round((felt / (felt + ph)) * 100) : 0;
}

// The sections' blocks, sender and receiver side by side, each section's bubble beside its heading
// (or the first paragraph of the opening section).
function Ark4({ blokker }: { blokker: Blokk[] }) {
  const noder: ReactNode[] = [];
  seksjoner(blokker).forEach((s, n) => {
    const forstP = blokker.slice(s.fra, s.til).findIndex((b) => b.t === "p");
    const anker = blokker[s.fra].t === "h" || forstP < 0 ? s.fra : s.fra + forstP;
    for (let i = s.fra; i < s.til; i++) {
      const b = blokker[i];
      const neste = blokker[i + 1];
      if (b.t === "addr" && neste?.t === "addr" && i + 1 < s.til && i !== anker) {
        noder.push(<Adresser key={i} a={b} b={neste} />);
        i++;
      } else if (i === anker)
        noder.push(
          <div key={i} className="fl-anker">
            <span className="fl-nr" data-fylt={s.fylt} aria-hidden="true">
              {n + 1}
            </span>
            <BlokkEl b={b} />
          </div>,
        );
      else noder.push(<BlokkEl key={i} b={b} />);
    }
  });
  return <>{noder}</>;
}

const roligBevegelse = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// The first part in the letter that holds one of these fields.
function forsteNye(c: HTMLElement | null, felt: ReadonlySet<string>): HTMLElement | null {
  return [...(c?.querySelectorAll<HTMLElement>("[data-felt]") ?? [])].find((el) => felt.has(el.dataset.felt!)) ?? null;
}

// Scrolls the pane so the part stands a little above the middle, as in the mockup.
function rullTil(c: HTMLElement | null, el: HTMLElement, myk: boolean) {
  if (!c) return;
  const top = c.scrollTop + el.getBoundingClientRect().top - c.getBoundingClientRect().top - c.clientHeight * 0.28;
  c.scrollTo({ top: Math.max(0, top), behavior: myk ? "smooth" : "auto" });
}

export function Brevrute({ blokker, venter, feil, etikett, onFelt }: { blokker: Blokk[] | null; venter: boolean; feil: string | null; etikett: string; onFelt?: (felt: string) => void }) {
  const ark = useContext(Ark);
  const rull = useRef<HTMLDivElement>(null);
  // When the reader last scrolled the letter, and the field the latest change starts at.
  const lest = useRef(0);
  const mal = useRef<string | null>(null);
  const [visHopp, settVisHopp] = useState(false);
  // The fields that just changed, worked out when new blocks arrive (React's «previous props» pattern).
  const [forrige, settForrige] = useState(blokker);
  const [nye, settNye] = useState<ReadonlySet<string>>(() => new Set());
  if (blokker !== forrige) {
    settForrige(blokker);
    const e = blokker ? endredeFelt(forrige, blokker) : [];
    if (e.length) settNye(new Set(e));
  }

  // A change is marked for 2.5 s; the pane follows it, or offers «Vis siste endring» when the reader
  // is scrolling or prefers less motion. Measured after layout, so the new text is in place.
  useEffect(() => {
    if (!nye.size) return;
    const ramme = requestAnimationFrame(() => {
      const el = forsteNye(rull.current, nye);
      if (!el) return;
      mal.current = el.dataset.felt!;
      if (roligBevegelse() || Date.now() - lest.current < LESER_MS) settVisHopp(true);
      else {
        settVisHopp(false);
        rullTil(rull.current, el, true);
      }
    });
    const tid = setTimeout(() => settNye(new Set()), MERKET_MS);
    return () => {
      cancelAnimationFrame(ramme);
      clearTimeout(tid);
    };
  }, [nye]);

  const leser = () => {
    lest.current = Date.now();
  };
  const hopp = () => {
    settVisHopp(false);
    lest.current = 0;
    const el = mal.current ? forsteNye(rull.current, new Set([mal.current])) : null;
    if (el) rullTil(rull.current, el, !roligBevegelse());
  };
  const klikk = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-felt]");
    if (!el || !onFelt) return;
    // A narrow screen's sheet closes, so the row the answer opens is in view.
    ark?.lukk();
    onFelt(el.dataset.felt!);
  };

  const pst = blokker ? andel(blokker) : 0;
  return (
    <div className="fl-rute">
      <div className="fl-rute-h">
        <div className="fl-rute-ht">
          <div className="fl-rute-l">
            <span className="fl-rute-n">Brevet ditt</span>
            <span className="fl-rute-e">{etikett}</span>
          </div>
          <span className="fl-bar">
            <span style={{ width: `${pst}%` }} />
          </span>
        </div>
        {ark && (
          <button type="button" className="fl-ikon" onClick={ark.lukk} aria-label="Lukk brevet">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
      <div
        ref={rull}
        className="fl-rull"
        onWheel={leser}
        onTouchMove={leser}
        onKeyDown={leser}
        onPointerDown={(e) => {
          // The scrollbar itself.
          if (e.target === e.currentTarget) leser();
        }}
      >
        {feil && (
          <p className="fl-feil" role="status">
            Brevet oppdateres ikke akkurat nå. Prøver igjen …
          </p>
        )}
        {blokker ? (
          <NyeFelt.Provider value={nye}>
            {/* Clicking one of the buyer's answers opens where it is answered; the page has the same rows as buttons. */}
            <article className={onFelt ? "letter fl-ark fl-klikk" : "letter fl-ark"} aria-label="Reklamasjonsbrev" aria-busy={venter} onClick={klikk} style={{ whiteSpace: "pre-line" }}>
              <Ark4 blokker={blokker} />
            </article>
          </NyeFelt.Provider>
        ) : (
          !feil && <p className="fl-henter">Brevet hentes …</p>
        )}
      </div>
      {visHopp && (
        <button type="button" className="fl-hopp" onClick={hopp}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
          Vis siste endring
        </button>
      )}
    </div>
  );
}
