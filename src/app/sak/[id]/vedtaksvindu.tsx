// «Lignende vedtak» (mockup, after payment): the ranking's top ten decisions with medhold, the model's
// choice first («Anbefalt»), each with how it compares to the buyer's case and its likeness. The buyer
// picks the one the letter cites; the pick applies on «Ferdig» and is dropped on «Avbryt».
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Hake, Lukk } from "@/app/deler/ikoner";
import { Bryter, type Sett } from "@/app/sak/skjema/felt";
import { fmtD } from "@/lib/app/dato";
import { cap, tall } from "@/lib/app/format";
import type { Presedens } from "@/lib/app/brevtyper";
import { trygt } from "@/lib/app/kall";
import { nokkel, nyttPrecValg, type Precutfall, tilSvar } from "@/lib/app/saken";
import type { Skjema } from "@/lib/app/skjema";
import type { Kriterium, Treff } from "@/lib/matching/ranger";
import { type Funn, finnVedtak } from "./actions";
import { skalHente, VENT_MS } from "./vedtak-hent";

// One request per set of answers at a time, however often the page asks while it runs. A result
// is not kept here: the server keeps the model's answers (sak.vedtaksvalg) and tells what changed since
// the list the buyer last got, which a kept result would not.
const underveis = new Map<string, Promise<Funn>>();
const hent = (svar: NonNullable<ReturnType<typeof tilSvar>>, id: string) => {
  const k = `${id}|${nokkel(svar)}`;
  if (!underveis.has(k)) underveis.set(k, trygt(finnVedtak({ id, svar }), "Vi fikk ikke kontakt. Prøv igjen.").finally(() => underveis.delete(k)));
  return underveis.get(k)!;
};

// A list as it arrived, and what it did to the decision the letter cites.
type Hentet = {
  n: string;
  f: Funn;
  utfall: Precutfall;
  // The decision the letter cited before the new list replaced it; null when it still cites the same.
  byttetFra: Presedens | null;
  // The buyer's own pick, kept or gone (utfall).
  egetValg: Presedens | null;
};

export type Vedtaksvalg = {
  // The dates are missing, so there is nothing to look up yet.
  mangler: boolean;
  // A list for other answers was shown in this session: the answers changed and a new one is coming.
  endres: boolean;
  funn: Funn | null;
  // What changed since the list the buyer last got (finnVedtak), with what it did to the letter.
  endring: (NonNullable<Extract<Funn, { ok: true }>["endring"]> & Omit<Hentet, "n" | "f">) | null;
  valg: Presedens[];
  valgt: Presedens | null;
  // The letter waits for the decision.
  venter: boolean;
  provIgjen: () => void;
};

// The decisions for the case's answers, fetched a moment after they last changed while `aktiv` (no row
// that changes them is open, or the dialog is). While a row is open the last list stands, so the
// letter keeps citing its decision instead of waiting.
export function useVedtak(s: Skjema, sett: Sett, id: string, aktiv: boolean): Vedtaksvalg {
  const svar = tilSvar(s);
  const n = nokkel(svar);
  const [funn, settFunn] = useState<Hentet | null>(null);
  const [forsok, settForsok] = useState(0);
  const hente = skalHente({ aktiv, harSvar: !!svar, precOn: s.prec_on, sistHentet: funn?.f.ok ? funn.n : null, nokkel: n });

  useEffect(() => {
    if (!hente || !svar) return;
    let gjeldende = true;
    const tid = setTimeout(
      () =>
        hent(svar, id).then((f) => {
          if (!gjeldende) return;
          // The letter follows the recommendation, unless the buyer picked another that is still on the list.
          const { endre, utfall } = f.ok ? nyttPrecValg(s, f.valg) : { endre: null, utfall: "fulgt" as const };
          settFunn((forrige) => {
            const kjente = [...(f.ok ? f.valg : []), ...(forrige?.f.ok ? forrige.f.valg : [])];
            const sak = (id: number | null) => kjente.find((v) => v.id === id) ?? null;
            const byttet = f.ok && !!f.endring && s.prec_id !== null && endre?.prec_id !== undefined && endre.prec_id !== s.prec_id;
            return { n, f, utfall, byttetFra: byttet ? sak(s.prec_id) : null, egetValg: utfall === "fulgt" ? null : sak(s.prec_id) };
          });
          if (endre) sett(endre);
        }),
      VENT_MS,
    );
    return () => {
      gjeldende = false;
      clearTimeout(tid);
    };
    // `n` stands for `svar`; `forsok` is «Prøv igjen».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hente, n, id, forsok]);

  // The list for these answers, or while inactive the last one fetched.
  const aktuell = funn && (funn.n === n || (!aktiv && funn.f.ok)) ? funn.f : null;
  const valg = aktuell?.ok ? aktuell.valg : [];
  const endring = aktuell?.ok && aktuell.endring && funn ? { ...aktuell.endring, utfall: funn.utfall, byttetFra: funn.byttetFra, egetValg: funn.egetValg } : null;
  return {
    mangler: !svar,
    endres: !!funn && funn.n !== n,
    funn: aktuell,
    endring,
    valg,
    valgt: valg.find((v) => v.id === s.prec_id) ?? valg[0] ?? null,
    venter: !!svar && s.prec_on && (!aktuell || !aktuell.ok),
    provIgjen: () => settForsok((f) => f + 1),
  };
}

type Tone = "good" | "up" | "warn";
// How each criterion compared, as the buyer reads it. «Strengere» means the decision was harder for the
// buyer than this case, so the buyer's case stands stronger. `ukjent` and `ikke_oppgitt` are not shown.
export const TREFFTEKST: Record<Kriterium, Partial<Record<Treff, [Tone, string]>>> = {
  underkategori: { likt: ["good", "Samme del"], ulikt: ["warn", "Annen del"] },
  tidsniva: { likt: ["good", "Feilen viste seg på samme tidspunkt"], strengere: ["up", "Feilen viste seg senere enn din"], mildere: ["warn", "Feilen viste seg tidligere enn din"] },
  km: { likt: ["good", "Kjørt omtrent like langt"], strengere: ["up", "Bilen hadde gått lenger enn din"], mildere: ["warn", "Bilen hadde gått kortere enn din"] },
  alder: { likt: ["good", "Omtrent like gammel bil"], strengere: ["up", "Bilen var eldre enn din"], mildere: ["warn", "Bilen var yngre enn din"] },
  som_den_er: { likt: ["good", "Likt på «som den er»"], strengere: ["up", "Solgt «som den er», det var ikke din"], mildere: ["warn", "Ikke solgt «som den er», det var din"] },
  krav: { likt: ["good", "Fikk det du krever"], delvis: ["warn", "Fikk det du krever, for flere feil"], ulikt: ["warn", "Fikk et annet krav enn ditt"] },
  egen_vurdering: { likt: ["good", "Utvalget vurderte feilen for seg"], ulikt: ["warn", "Feilen ble ikke drøftet for seg"] },
  grunnlag: { likt: ["good", "Bygde på bevis du også har"], mildere: ["warn", "Bygde på bevis du ikke har"] },
};

function Kort({ v, valgt, iBrevet, ny, onVelg }: { v: Presedens; valgt: boolean; iBrevet: boolean; ny: boolean; onVelg: () => void }) {
  const tittel = [v.bil, v.km !== null ? `${tall(v.km)} km` : "", v.alder !== null ? `${v.alder} år gammel` : "", v.somDenEr ? "«som den er»" : ""].filter(Boolean).join(" · ");
  const brikker = (Object.keys(TREFFTEKST) as Kriterium[]).flatMap((k) => {
    const t = TREFFTEKST[k][v.treff[k]];
    return t ? [{ k, tone: t[0], tekst: t[1] }] : [];
  });
  return (
    <label className="fl-vk" data-valgt={valgt || undefined}>
      <input type="radio" name="prec_id" value={v.id} checked={valgt} onChange={onVelg} />
      <span className="fl-vk-o" aria-hidden="true" />
      <span className="fl-vk-b">
        <span className="fl-vk-h">
          <span className="fl-vk-m">
            <span className="fl-vk-sak">{[v.saksnummer ? `Sak ${v.saksnummer}` : "Vedtak", v.vedtaksdato ? fmtD(v.vedtaksdato) : ""].filter(Boolean).join(" · ")}</span>
            {v.anbefalt && <span className="fl-pille" data-t="anbefalt">Anbefalt</span>}
            {iBrevet && <span className="fl-pille">I brevet nå</span>}
            {ny && <span className="fl-pille" data-t="ny">Ny</span>}
          </span>
          {v.utfall[0] && <span className="fl-tag">{cap(v.utfall.join(" og "))}</span>}
        </span>
        <span className="fl-vk-t">{tittel}</span>
        {v.gjaldt && <span className="fl-vk-p">{cap(v.gjaldt)}</span>}
        {valgt && (
          <span className="fl-vk-a">
            <span className="fl-vk-al">Slik står det i brevet</span>
            <span>{v.avsnitt}</span>
          </span>
        )}
        <span className="fl-vk-f">
          {brikker.map((b) => (
            <span key={b.k} className="fl-treff" data-tone={b.tone}>
              {b.tone === "good" ? <Hake s={11} /> : b.tone === "up" ? <span aria-hidden="true">↑</span> : null}
              {b.tekst}
            </span>
          ))}
          <span className="fl-vk-likhet" aria-label={`Likhet ${v.likhet} prosent`}>
            {v.likhet} % likhet
          </span>
          {v.kildeUrl && (
            <a className="fl-vk-les" href={v.kildeUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
              Les vedtaket
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17L17 7M8 7h9v9" />
              </svg>
            </a>
          )}
        </span>
      </span>
    </label>
  );
}

const sakNavn = (v: { saksnummer: string | null } | null) => (v?.saksnummer ? `sak ${v.saksnummer}` : "et annet vedtak");

// Why the list changed and what it did to the letter, so new decisions on top are no surprise.
function Endringsmelding({ endring, valg, valgt }: { endring: NonNullable<Vedtaksvalg["endring"]>; valg: Presedens[]; valgt: Presedens | null }) {
  const anbefalt = valg[0];
  const setninger = [
    endring.nye.length
      ? `Svarene dine er endret, så listen er oppdatert. ${endring.nye.length === valg.length ? "Alle" : `${endring.nye.length} av de ${valg.length}`} vedtakene som ligner mest, er nye.`
      : "Svarene dine er endret, så listen er oppdatert.",
    endring.forrigeAnbefalt ? `Vi anbefaler nå ${sakNavn(anbefalt)} (før: ${sakNavn(endring.forrigeAnbefalt)}).` : `Vi anbefaler fortsatt ${sakNavn(anbefalt)}.`,
    endring.utfall === "beholdt"
      ? `Brevet viser fortsatt til ${sakNavn(valgt)}, som du valgte selv.`
      : endring.utfall === "borte"
        ? `${endring.egetValg ? `${cap(sakNavn(endring.egetValg))}, som du valgte,` : "Vedtaket du valgte,"} er ikke lenger blant de ${valg.length}, så brevet viser nå til det anbefalte.`
        : null,
  ].filter(Boolean);
  return (
    <p className="fl-melding" role="status">
      {setninger.join(" ")}
    </p>
  );
}

export function Vedtaksvindu({ apen, vedtak, s, sett, onLukk }: { apen: boolean; vedtak: Vedtaksvalg; s: Skjema; sett: Sett; onLukk: () => void }) {
  // Mounted afresh on each opening, so a dropped pick is gone the next time.
  return apen ? <Vindu vedtak={vedtak} s={s} sett={sett} onLukk={onLukk} /> : null;
}

function Vindu({ vedtak, s, sett, onLukk }: { vedtak: Vedtaksvalg; s: Skjema; sett: Sett; onLukk: () => void }) {
  const { funn, valg, valgt } = vedtak;
  // The staged pick; null follows the letter.
  const [plukk, settPlukk] = useState<number | null>(null);
  const markert = valg.find((v) => v.id === plukk) ?? valgt;
  const boks = useRef<HTMLDivElement>(null);
  // The latest close, so a new closure from the page does not run the effect below again.
  const lukk = useRef(onLukk);
  useEffect(() => {
    lukk.current = onLukk;
  });

  // Focus moves into the dialog and back where it was; the page behind does not scroll; Escape cancels.
  useEffect(() => {
    const for_ = document.activeElement as HTMLElement | null;
    boks.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && lukk.current();
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = overflow;
      for_?.focus({ preventScroll: true });
    };
  }, []);

  const ferdig = () => {
    if (markert && markert.id !== valgt?.id) sett({ prec_id: markert.id, prec_on: true, prec_selv: !markert.anbefalt });
    onLukk();
  };

  return createPortal(
    <div className="fl-vindu" onMouseDown={(e) => e.target === e.currentTarget && onLukk()}>
      <div ref={boks} className="fl-vindu-i" role="dialog" aria-modal="true" aria-labelledby="vedtakTittel" tabIndex={-1}>
        <div className="fl-vindu-h">
          <div>
            <h2 id="vedtakTittel">Lignende vedtak</h2>
            <p>
              {valg.length ? `${valg.length} vedtak` : "Vedtak"} fra Forbrukerklageutvalget der kjøperen fikk medhold. Det øverste ligner mest på saken din, og det er det vi anbefaler. Vedtaket du velger, brukes i brevet.
            </p>
          </div>
          <button type="button" className="fl-ikon" aria-label="Lukk" onClick={onLukk}>
            <Lukk />
          </button>
        </div>
        <div className="fl-vindu-k">
          <Bryter s={s} sett={sett} k="prec_on" tittel="Vis til en lignende sak" tekst="Brevet sammenligner saken din med et vedtak fra Forbrukerklageutvalget der forbrukeren fikk medhold." />
          {!s.prec_on ? (
            <p className="fl-melding">Du har slått av henvisningen til en lignende sak i brevet.</p>
          ) : vedtak.mangler ? (
            <p className="fl-melding">Legg inn overtakelsesdato og når du oppdaget feilen, så finner vi lignende saker.</p>
          ) : !funn ? (
            <p className="fl-melding" role="status">
              {vedtak.endres ? "Svarene dine er endret. Vi finner vedtakene som ligner mest på nytt …" : "Finner lignende saker …"}
            </p>
          ) : !funn.ok ? (
            <div className="fl-melding">
              <span>{funn.melding}</span>
              <button type="button" className="fl-knapp" onClick={vedtak.provIgjen}>
                Prøv igjen
              </button>
            </div>
          ) : !valg.length ? (
            <p className="fl-melding">Vi fant ingen lignende sak med medhold. Brevet bygger på lovens vilkår.</p>
          ) : (
            <>
              {vedtak.endring && <Endringsmelding endring={vedtak.endring} valg={valg} valgt={valgt} />}
              <div className="fl-vk-l" role="radiogroup" aria-label="Lignende vedtak">
                {valg.map((v) => (
                  <Kort key={v.id} v={v} valgt={v.id === markert?.id} iBrevet={v.id === valgt?.id} ny={!!vedtak.endring?.nye.includes(v.id)} onVelg={() => settPlukk(v.id)} />
                ))}
              </div>
              <p className="fine" style={{ margin: 0 }}>
                Likhet viser hvor mye vedtaket ligner saken din på feil, tidspunkt, bil, krav og bevis. Det er ikke en vinnersjanse.
              </p>
            </>
          )}
        </div>
        <div className="fl-vindu-f">
          <button type="button" className="fl-knapp fl-knapp-s" onClick={onLukk}>
            Avbryt
          </button>
          <button type="button" className="fl-ferdig" onClick={ferdig}>
            Ferdig
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
