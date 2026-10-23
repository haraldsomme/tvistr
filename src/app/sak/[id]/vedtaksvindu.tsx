// «Lignende vedtak» (mockup, after payment): for each fault, the ranking's top ten decisions with
// medhold, the model's choice first («Anbefalt»), each with how it compares to the buyer's case and its
// likeness. The buyer picks the one the letter cites under each fault; the picks apply on «Ferdig» and
// are dropped on «Avbryt».
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Hake, Lukk } from "@/app/deler/ikoner";
import type { Sett } from "@/app/sak/skjema/felt";
import { fmtD } from "@/lib/app/dato";
import { cap, tall } from "@/lib/app/format";
import type { Presedens } from "@/lib/app/brevtyper";
import { trygt } from "@/lib/app/kall";
import { delTekst, feiloverskrift } from "@/lib/app/feilnavn";
import { feilposterSortert } from "@/lib/app/feil";
import { nyttPrecValg, type Precutfall, sakNavn, svarPoster, tilSvar } from "@/lib/app/saken";
import type { Skjema } from "@/lib/app/skjema";
import type { Kriterium, Treff } from "@/lib/matching/ranger";
import type { Endring } from "@/lib/vedtaksvalg/valg";
import { type Funn, finnVedtak } from "./actions";

// One request per set of answers at a time, however often the page asks while it runs. A result
// is not kept here: the server keeps the model's answers (sak.vedtaksvalg) and tells what changed since
// the list the buyer last got, which a kept result would not.
const underveis = new Map<string, Promise<Funn>>();
const hent = (svar: NonNullable<ReturnType<typeof tilSvar>>, id: string) => {
  const k = `${id}|${JSON.stringify(svar)}`;
  if (!underveis.has(k)) underveis.set(k, trygt(finnVedtak({ id, svar }), "Vi fikk ikke kontakt. Prøv igjen.").finally(() => underveis.delete(k)));
  return underveis.get(k)!;
};

// What a new list did to the decision the letter cites under one fault.
type Virkning = {
  utfall: Precutfall;
  // The decision the letter cited before the new list replaced it; null when it still cites the same.
  byttetFra: Presedens | null;
  // The buyer's own pick, kept or gone (utfall).
  egetValg: Presedens | null;
};

// The lists as they arrived: one per fault, in the order of the answers' faults (`nokler`).
type Hentet = { n: string; f: Funn; nokler: string[]; virkning: Record<string, Virkning> };

// One fault's decisions: its number and name as the letter has them, the list, the one the letter
// cites, and what changed since the list the buyer last got.
export type Feilvalg = {
  nokkel: string;
  nr: number;
  navn: string;
  valg: Presedens[];
  valgt: Presedens | null;
  endring: (Endring & Virkning) | null;
};

export type Vedtaksvalg = {
  // The dates are missing, so there is nothing to look up yet.
  mangler: boolean;
  // A list for other answers was shown in this session: the answers changed and a new one is coming.
  endres: boolean;
  funn: Funn | null;
  // The faults with a list, in the letter's order.
  feil: Feilvalg[];
  // The letter waits for the decisions.
  venter: boolean;
  provIgjen: () => void;
};

// The decisions for the case's answers, fetched 800 ms after they last changed while `aktiv` (no row
// that changes them is open, or the dialog is). Each new set of answers costs one of the case's model
// calls, so not while the buyer is typing in such a row, where the last lists stand and the letter
// keeps citing their decisions, and not again for lists already shown. A failed set is fetched again
// when the lookup becomes active again, and on «Prøv igjen».
export function useVedtak(s: Skjema, sett: Sett, id: string, aktiv: boolean): Vedtaksvalg {
  const svar = tilSvar(s);
  const n = JSON.stringify(svar);
  const [funn, settFunn] = useState<Hentet | null>(null);
  const [forsok, settForsok] = useState(0);
  const hente = aktiv && !!svar && (!funn?.f.ok || funn.n !== n);

  useEffect(() => {
    if (!hente || !svar) return;
    let gjeldende = true;
    const tid = setTimeout(
      () =>
        hent(svar, id).then((f) => {
          if (!gjeldende) return;
          // Each list belongs to the fault at its place in the answers (svarPoster), never by the letter's order.
          const nokler = svarPoster(s).map((p) => p.nokkel);
          const lister = f.ok ? nokler.map((nokkel, i) => ({ nokkel, valg: f.valg[i] ?? [] })) : [];
          // The letter follows the recommendation, unless the buyer picked another that is still on the list.
          const { endre, utfall } = nyttPrecValg(s.prec, lister);
          settFunn((forrige) => {
            const kjente = [...lister.flatMap((l) => l.valg), ...(forrige?.f.ok ? forrige.f.valg.flat() : [])];
            const sak = (id: number | undefined) => kjente.find((v) => v.id === id) ?? null;
            const virkning = Object.fromEntries(
              lister.map(({ nokkel }, i) => {
                const for_ = s.prec[nokkel]?.id;
                const na = endre?.prec?.[nokkel]?.id ?? for_;
                const byttet = f.ok && !!f.endring[i] && for_ !== undefined && na !== for_;
                return [nokkel, { utfall: utfall[nokkel] ?? "fulgt", byttetFra: byttet ? sak(for_) : null, egetValg: utfall[nokkel] && utfall[nokkel] !== "fulgt" ? sak(for_) : null }];
              }),
            );
            return { n, f, nokler, virkning };
          });
          if (endre) sett(endre);
        }),
      800,
    );
    return () => {
      gjeldende = false;
      clearTimeout(tid);
    };
    // `n` stands for `svar`; `forsok` is «Prøv igjen».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hente, n, id, forsok]);

  // The lists for these answers, or while inactive the last ones fetched.
  const aktuell = funn && (funn.n === n || (!aktiv && funn.f.ok)) ? funn.f : null;
  const poster = feilposterSortert(s);
  const feil: Feilvalg[] =
    aktuell?.ok && funn
      ? poster.flatMap((p, j) => {
          const i = funn.nokler.indexOf(p.nokkel);
          if (i < 0) return [];
          const valg = aktuell.valg[i] ?? [];
          const e = aktuell.endring[i];
          return [{ nokkel: p.nokkel, nr: j + 1, navn: cap(delTekst(feiloverskrift(p, "ubestemt"))), valg, valgt: valg.find((v) => v.id === s.prec[p.nokkel]?.id) ?? valg[0] ?? null, endring: e ? { ...e, ...funn.virkning[p.nokkel] } : null }];
        })
      : [];
  return {
    mangler: !svar,
    endres: !!funn && funn.n !== n,
    funn: aktuell,
    feil,
    venter: !!svar && (!aktuell || !aktuell.ok),
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

function Kort({ navn, v, valgt, iBrevet, ny, onVelg }: { navn: string; v: Presedens; valgt: boolean; iBrevet: boolean; ny: boolean; onVelg: () => void }) {
  const tittel = [v.bil, v.km !== null ? `${tall(v.km)} km` : "", v.alder !== null ? `${v.alder} år gammel` : "", v.somDenEr ? "«som den er»" : ""].filter(Boolean).join(" · ");
  const brikker = (Object.keys(TREFFTEKST) as Kriterium[]).flatMap((k) => {
    const t = TREFFTEKST[k][v.treff[k]];
    return t ? [{ k, tone: t[0], tekst: t[1] }] : [];
  });
  return (
    <label className="fl-vk" data-valgt={valgt || undefined}>
      <input type="radio" name={navn} value={v.id} checked={valgt} onChange={onVelg} />
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

// Why a fault's list changed and what it did to the letter, so new decisions on top are no surprise.
function Endringsmelding({ f }: { f: Feilvalg }) {
  const { endring, valg, valgt } = f;
  if (!endring) return null;
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

// One fault's cards, under its number and name when the letter has several faults.
function Feilliste({ f, flere, markert, onVelg }: { f: Feilvalg; flere: boolean; markert: Presedens | null; onVelg: (id: number) => void }) {
  return (
    <section className="fl-vk-g" aria-label={flere ? `${f.nr}. ${f.navn}` : undefined}>
      {flere && <h3 className="fl-vk-gh">{`${f.nr}. ${f.navn}`}</h3>}
      <Endringsmelding f={f} />
      {f.valg.length ? (
        <div className="fl-vk-l" role="radiogroup" aria-label={flere ? `Lignende vedtak for ${f.navn.toLowerCase()}` : "Lignende vedtak"}>
          {f.valg.map((v) => (
            <Kort key={v.id} navn={`prec_${f.nokkel}`} v={v} valgt={v.id === markert?.id} iBrevet={v.id === f.valgt?.id} ny={!!f.endring?.nye.includes(v.id)} onVelg={() => onVelg(v.id)} />
          ))}
        </div>
      ) : (
        <p className="fl-melding">Vi fant ingen lignende sak med medhold for denne feilen. Brevet bygger der på lovens vilkår.</p>
      )}
    </section>
  );
}

// The dialog, mounted afresh on each opening (the page renders it only while open), so a dropped pick is
// gone the next time. Every way out closes the <dialog> (Escape too), which puts focus back where it was, and its
// close event tells the page; the page behind does not scroll (globals.css).
export function Vedtaksvindu({ vedtak, prec, sett, onLukk }: { vedtak: Vedtaksvalg; prec: Skjema["prec"]; sett: Sett; onLukk: () => void }) {
  const { funn, feil } = vedtak;
  // The staged picks per fault; a fault without one follows the letter.
  const [plukk, settPlukk] = useState<Record<string, number>>({});
  const markert = (f: Feilvalg) => f.valg.find((v) => v.id === plukk[f.nokkel]) ?? f.valgt;
  const vindu = useRef<HTMLDialogElement>(null);
  const boks = useRef<HTMLDivElement>(null);
  const lukk = () => vindu.current?.close();
  const flere = feil.length > 1;
  const antall = feil.reduce((n, f) => n + f.valg.length, 0);

  useEffect(() => {
    vindu.current?.showModal();
    boks.current?.focus({ preventScroll: true });
  }, []);

  const ferdig = () => {
    const endret = feil.flatMap((f) => {
      const m = markert(f);
      return m && m.id !== f.valgt?.id ? [[f.nokkel, { id: m.id, selv: !m.anbefalt }] as const] : [];
    });
    if (endret.length) sett({ prec: { ...prec, ...Object.fromEntries(endret) } });
    lukk();
  };

  return createPortal(
    <dialog ref={vindu} className="fl-vindu" aria-labelledby="vedtakTittel" onClose={onLukk} onMouseDown={(e) => e.target === e.currentTarget && lukk()}>
      <div ref={boks} className="fl-vindu-i" tabIndex={-1}>
        <div className="fl-vindu-h">
          <div>
            <h2 id="vedtakTittel">Lignende vedtak</h2>
            <p>
              {flere
                ? "Vedtak fra Forbrukerklageutvalget der kjøperen fikk medhold, ett for hver feil i brevet. Det øverste under hver feil ligner mest, og det er det vi anbefaler. Vedtakene du velger, brukes i brevet."
                : `${antall ? `${antall} vedtak` : "Vedtak"} fra Forbrukerklageutvalget der kjøperen fikk medhold. Det øverste ligner mest på saken din, og det er det vi anbefaler. Vedtaket du velger, brukes i brevet.`}
            </p>
          </div>
          <button type="button" className="fl-ikon" aria-label="Lukk" onClick={lukk}>
            <Lukk />
          </button>
        </div>
        <div className="fl-vindu-k">
          {vedtak.mangler ? (
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
          ) : !antall ? (
            <p className="fl-melding">Vi fant ingen lignende sak med medhold. Brevet bygger på lovens vilkår.</p>
          ) : (
            <>
              {feil.map((f) => (
                <Feilliste key={f.nokkel} f={f} flere={flere} markert={markert(f)} onVelg={(id) => settPlukk((p) => ({ ...p, [f.nokkel]: id }))} />
              ))}
              <p className="fine" style={{ margin: 0 }}>
                Likhet viser hvor mye vedtaket ligner {flere ? "feilen" : "saken din"} på feil, tidspunkt, bil, krav og bevis. Det er ikke en vinnersjanse.
              </p>
            </>
          )}
        </div>
        <div className="fl-vindu-f">
          <button type="button" className="fl-knapp fl-knapp-s" onClick={lukk}>
            Avbryt
          </button>
          <button type="button" className="fl-ferdig" onClick={ferdig}>
            Ferdig
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
