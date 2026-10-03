"use client";

import { TID_TIL_VEDTAK } from "@/lib/vurdering/tid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/app/logo";
import { useEffect, useId, useState, type ReactNode } from "react";
import { lesKjoretoy } from "@/lib/brev/utfylling";
import type { Kjoretoy } from "@/lib/kjoretoy/vegvesen";
import {
  FEILTYPER_KNAPPER,
  forsteUgyldigeSteg,
  gyldigKjopsdato,
  JA_NEI,
  kjopsdatoAv,
  medKjopsalder,
  medKjopsdato,
  oppdagetMulig,
  OPPLYST_VALG,
  sporOmFemarsfrist,
  sporOmOpplysning,
  stegFor,
  stegGyldig,
  tilParametre,
  type Innsending,
  type Steg,
} from "@/lib/vurdering/innsending";
import { presumsjonManederFor } from "@/lib/vurdering/faktorer";
import {
  KJOPSALDER_VALG,
  KJOPSFORM_VALG,
  KONTAKT_VALG,
  OPPDAGET_VALG,
  type Niva,
} from "@/lib/vurdering/typer";
import { Bilkort, Regnr } from "./regnr";
import {
  FEILTYPE_TEKST,
  JA_NEI_TEKST,
  KJOPSALDER_TEKST,
  KJOPSFORM_TEKST,
  KONTAKT_TEKST,
  OPPDAGET_TEKST,
  OPPLYST_TEKST,
  SPORSMAL,
} from "./tekster";

// How close the example decision is to the buyer's case; see finnEksempel.
type Treff = "lignende" | "tilnaermet" | "generell";
type Punkt = {
  tekst: string;
  vekt: "for" | "mot" | "noytral";
  paragraf?: string;
  lenke?: string;
};
type Resultat = {
  niva: Niva;
  tittel: string;
  begrunnelse: string;
  // What strengthens the case, and what weakens it (or the one reason the law stops it).
  styrker: Punkt[];
  svakheter: Punkt[];
  // The explanation is only sent for a weak case; otherwise it is part of the paid step.
  tiltak: { tittel: string; tekst?: string }[];
  // null when the five-year deadline has passed, so no comparison was made.
  utvalg: { n: number; vunnet: number; spesifikk: boolean } | null;
  eksempel: { setning: string; saksnummer: string; kildeUrl: string; utfall: "vunnet"; treff: Treff } | null;
};

const STEG_TEKST: Record<Steg, { navn: string; tittel: string }> = {
  1: { navn: "Bilen", tittel: "Hvilken bil kjøpte du?" },
  2: { navn: "Feilen", tittel: "Hva er galt med bilen?" },
  3: { navn: "Forhandleren", tittel: "Hva har forhandleren sagt?" },
  4: { navn: "Bevis", tittel: "Hvilke bevis har du?" },
};
// The button text: the name of the next step, or the assessment after the last one.
const nesteTekst = (steger: readonly Steg[], steg: Steg) => {
  const neste = steger[steger.indexOf(steg) + 1];
  return neste ? `Neste: ${STEG_TEKST[neste].navn} →` : "Se vurderingen →";
};

const INNHOLD = "flex flex-col gap-5 px-6 pt-[22px] md:gap-9 md:px-0 md:pt-0";
const LABEL = "font-ui text-[14px] font-semibold text-[#17263d] md:text-[15px]";
const KNAPP =
  "w-full rounded-[6px] bg-[#17263d] p-[18px] text-center font-ui text-[16px] font-semibold text-[#f6f4ef] disabled:cursor-not-allowed disabled:opacity-40";

// Completed steps are buttons back to that step; the ones ahead cannot be opened, so each step is
// still validated before the next.
function StegTopp({ steger, steg, tilbake, gaTil }: { steger: readonly Steg[]; steg: Steg; tilbake: ReactNode; gaTil: (n: Steg) => void }) {
  return (
    <div className="flex flex-col gap-3.5 px-6 pt-[52px] md:gap-3.5 md:px-0 md:pt-0">
      <div className="font-ui text-[14px] text-[#5b6472]">{tilbake}</div>
      <ol className="m-0 flex list-none gap-1.5 p-0 md:gap-2">
        {steger.map((n, indeks) => {
          const navn = `${indeks + 1} ${STEG_TEKST[n].navn}`;
          return (
            <li
              key={n}
              aria-current={n === steg ? "step" : undefined}
              className={`flex flex-1 flex-col gap-2 font-ui text-[13px] ${
                n === steg ? "font-semibold text-[#17263d]" : n < steg ? "text-[#17263d]" : "text-[#5b6472]"
              }`}
            >
              <div className={`h-[3px] rounded-sm ${n <= steg ? "bg-[#17263d]" : "bg-[#dcd8cf]"}`} />
              {n < steg ? (
                <button type="button" onClick={() => gaTil(n)} className="self-start text-left">
                  {navn}
                </button>
              ) : (
                <span>{navn}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Tittel({ tittel }: { tittel: string }) {
  return (
    <div className="px-6 pt-[26px] md:px-0 md:pt-0">
      <h2 className="m-0 font-brev text-[27px] font-semibold leading-[1.15] md:text-[40px] md:leading-[1.12] md:tracking-[-.01em]">{tittel}</h2>
    </div>
  );
}

// Radio group built from buttons, styled like the sketches. Default is pills; `kort` makes radio
// cards (stacked on mobile, three across from md). `rad` puts the question and the pills on one
// row from md, for use inside `Radliste`.
function Valg<T extends string>({
  id,
  label,
  verdier,
  tekst,
  valgt,
  velg,
  kort,
  rad,
  deaktivert,
}: {
  id: string;
  label: string;
  verdier: readonly T[];
  tekst: Record<T, string>;
  valgt: T | "";
  velg: (v: T) => void;
  kort?: boolean;
  rad?: boolean;
  deaktivert?: (v: T) => boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={id}
      className={`flex flex-col gap-2.5 ${rad ? "md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6 md:border-b md:border-[#eceae4] md:py-5 md:last:border-b-0" : "md:gap-3"}`}
    >
      <span id={id} className={`${LABEL} ${rad ? "md:text-[16px] md:font-medium md:leading-[1.45]" : ""}`}>
        {label}
      </span>
      <div className={kort ? "flex flex-col gap-2 md:grid md:grid-cols-3 md:gap-3" : "flex flex-wrap gap-2 md:justify-end"}>
        {verdier.map((v) => {
          const er = valgt === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={er}
              disabled={deaktivert?.(v)}
              onClick={() => velg(v)}
              className={`disabled:cursor-not-allowed disabled:opacity-40 ${
                kort
                  ? `flex items-center gap-[11px] rounded-lg bg-white px-4 py-[13px] text-left font-ui text-[14px] md:gap-3 md:px-[19px] md:py-4 md:text-[15px] ${
                      er ? "border-2 border-[#17263d] font-semibold" : "border border-[#bfbab0] py-[14px] font-medium md:py-[17px]"
                    }`
                  : `whitespace-nowrap rounded-full px-[21px] py-2.5 font-ui text-[14px] ${
                      er ? "bg-[#17263d] font-semibold text-[#f6f4ef]" : "border border-[#bfbab0] bg-white font-medium text-[#17263d]"
                    }`
              }`}
            >
              {kort && (
                <span
                  aria-hidden
                  className={`box-border h-[17px] w-[17px] flex-none rounded-full md:h-[18px] md:w-[18px] ${
                    er ? "border-[5px] border-[#17263d] md:border-[5.5px]" : "border-[1.5px] border-[#8a94a3]"
                  }`}
                />
              )}
              {tekst[v]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The question rows sit in a white card from md; on mobile they are just stacked.
function Radliste({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 md:gap-0 md:rounded-lg md:border md:border-[#dcd8cf] md:bg-white md:px-7 md:py-2">{children}</div>
  );
}

// Points for the case get a green plus, points against it a red minus.
const VEKT_TEGN = {
  for: { tegn: "+", farge: "oklch(0.42 0.1 160)", bakgrunn: "oklch(0.95 0.04 160)", tekst: "Taler for saken" },
  mot: { tegn: "−", farge: "oklch(0.42 0.12 25)", bakgrunn: "oklch(0.95 0.04 25)", tekst: "Taler mot saken" },
} as const;
const TREFF_TEKST: Record<Treff, string> = {
  lignende: "Her er ett eksempel:",
  tilnaermet: "Her er det nærmeste eksemplet:",
  generell: "Her er ett eksempel fra grunnlaget:",
};

// The comparison point shown right under the title: how many similar decisions that got medhold the case
// was checked against, then the one example decision (always one the buyer won), if any.
function sammenligningTekst(utvalg: Resultat["utvalg"], eksempel: Resultat["eksempel"]): string | null {
  if (!utvalg) return null;
  const gruppe = utvalg.spesifikk ? "lignende vedtak" : "vedtak om bruktbil kjøpt fra forhandler";
  const grunnsetning = `Vi har sjekket saken din opp mot ${utvalg.vunnet} ${gruppe} fra Forbrukerklageutvalget som fikk medhold.`;
  return eksempel ? `${grunnsetning} ${TREFF_TEKST[eksempel.treff]} ${eksempel.setning}` : grunnsetning;
}
const KORT = "overflow-hidden rounded-lg border border-[#dcd8cf] bg-white";
const RAD = "flex gap-3.5 border-b border-[#eceae4] px-6 py-[18px] last:border-b-0";
const SEKSJON_TITTEL = "m-0 font-brev text-[24px] font-semibold leading-[1.3]";

// Indeterminate on purpose: we cannot know how long the assessment takes.
function Venter() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f4ef] font-ui text-[#17263d]">
      <div className="border-b border-[#dcd8cf] px-6 pb-[18px] pt-[52px] md:px-16 md:py-[22px]">
        <Logo liten />
      </div>
      <div role="status" className="mx-auto flex w-full max-w-[560px] flex-col gap-7 px-6 pt-14 md:px-0 md:pt-28">
        <div className="flex flex-col gap-3.5">
          <div className="text-[13px] font-medium text-[#1f3a5f]">Et øyeblikk</div>
          <h1 className="m-0 font-brev text-[30px] font-semibold leading-[1.15] md:text-[40px] md:tracking-[-.01em] md:[text-wrap:balance]">
            Vi sjekker saken din opp mot lignende saker
          </h1>
          <p className="m-0 text-[15px] leading-[1.6] text-[#3d4757] md:text-[16px]">
            Dette tar bare noen sekunder.<span className="hidden md:inline"> Ikke lukk siden.</span>
          </p>
        </div>
        <div aria-label="Vurderer saken" role="progressbar" className="h-1 overflow-hidden rounded-sm bg-[#e6e2d8]">
          <div className="h-full w-[30%] rounded-sm bg-[#17263d] motion-safe:animate-[rull_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
      <div className="mt-auto p-6 text-center text-[13px] leading-[1.5] text-[#5b6472] md:hidden">Ikke lukk siden</div>
    </div>
  );
}

const PRIS_NOK = 249;
const KJORETOY_NOKKEL = "tvistr-kjoretoy";

function Vipps({ tekst, onClick, disabled }: { tekst: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-full bg-[#ff5b24] p-4 font-ui text-[16px] font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,.12)] md:text-[17px]"
    >
      <span>{tekst}</span>
      <span className="font-vipps text-[21px] font-bold leading-none tracking-[-.04em] md:text-[22px]">vipps</span>
    </button>
  );
}


// Payment is not built yet: both buttons open the letter. Payment goes in front of it later.
const LIGNENDE_SAKER = "Henvisninger til lignende saker som fikk medhold";
const NESTE_PUNKTER = [
  "Formuleringer etter og henvisninger til lovverk",
  LIGNENDE_SAKER,
  "Frist for svar fra forhandleren",
  "Hva du gjør hvis forhandleren avviser, med svar til vanlige innvendinger og purrebrev",
  "Saksmappe med tall fra tidligere vedtak: sjanser, beløp og forhandlerens historikk",
  "PDF og redigerbar Word-fil",
];

// The line about similar cases is only promised when we have one to refer to.
// `apneBrev` opens the letter and returns an error message if that failed.
function Neste({
  medEksempel,
  apneBrev,
  kjoretoy,
  velgBil,
}: {
  medEksempel: boolean;
  apneBrev: () => Promise<string | null>;
  // undefined until the tab has been read, null when there is no car (a shared link, or storage that is empty).
  kjoretoy: Kjoretoy | null | undefined;
  velgBil: () => void;
}) {
  const punkter = NESTE_PUNKTER.filter((p) => medEksempel || p !== LIGNENDE_SAKER);
  const [apner, setApner] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  async function apne() {
    setApner(true);
    setFeil(null);
    const f = await apneBrev();
    // On success the page is on its way to the letter; keep the buttons disabled meanwhile.
    if (f) {
      setFeil(f);
      setApner(false);
    }
  }
  return (
    <aside className="flex flex-col gap-3 bg-[#17263d] px-6 pb-6 pt-5 text-[#f6f4ef] md:sticky md:top-6 md:gap-5 md:self-start md:rounded-lg md:p-9">
      <div className="font-ui text-[12px] font-medium uppercase tracking-[.04em] text-[#8a9bb5] md:text-[13px]">Neste steg</div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="m-0 font-brev text-[17px] font-semibold leading-[1.3] md:text-[28px] md:leading-[1.2]">
          Få reklamasjonsbrevet
        </h2>
        <span className="font-brev text-[20px] font-semibold md:hidden">{PRIS_NOK} kr</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 border-b border-[rgba(246,244,239,.18)] p-0 pb-3.5 text-[13px] leading-[1.5] text-[#c9d2df] md:gap-2.5 md:pb-3.5 md:text-[14px]">
        {punkter.map((p) => (
          <li key={p} className="flex items-baseline gap-2.5">
            <span aria-hidden className="text-[#8a9bb5]">
              ✓
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <div className="hidden items-baseline justify-between md:flex">
        <span className="font-ui text-[16px] font-semibold">Totalt</span>
        <span className="font-brev text-[28px] font-semibold">{PRIS_NOK} kr</span>
      </div>
      {/* The buyer sees which car the letter is for before paying, and cannot change it here. A shared
          link or an emptied tab has the answers but not the car: it is chosen in the first step. */}
      {kjoretoy && <Bilkort kjoretoy={kjoretoy} />}
      {kjoretoy === null && (
        <div role="group" aria-label="Bilen mangler" className="flex flex-col items-start gap-2.5 rounded-[6px] border border-[rgba(246,244,239,.35)] p-4 text-[14px] leading-[1.5]">
          <span>Brevet skrives for én bil. Legg inn registreringsnummeret først.</span>
          <button type="button" onClick={velgBil} className="rounded-[6px] bg-[#f6f4ef] px-4 py-2.5 font-semibold text-[#17263d]">
            Legg inn registreringsnummer
          </button>
        </div>
      )}
      <Vipps tekst="Betal med" onClick={apne} disabled={apner || !kjoretoy} />
      <button
        type="button"
        onClick={apne}
        disabled={apner || !kjoretoy}
        className="block rounded-[6px] border border-[rgba(246,244,239,.45)] p-3.5 text-center font-ui text-[15px] font-semibold text-[#f6f4ef] md:p-[15px]"
      >
        Betal med kort
      </button>
      {feil && (
        <p role="alert" className="m-0 font-ui text-[13px] leading-[1.5] text-[#ffb4a6]">
          {feil}
        </p>
      )}
      <p className="m-0 text-center font-ui text-[12px] text-[#aab6c7] md:text-left md:text-[13px] md:leading-[1.55]">
        Engangsbeløp, ingen abonnement.<span className="hidden md:inline"> {TID_TIL_VEDTAK}</span>
      </p>
    </aside>
  );
}

function Vekt({ vekt }: { vekt: "for" | "mot" }) {
  const v = VEKT_TEGN[vekt];
  return (
    <span
      role="img"
      aria-label={v.tekst}
      className="mt-[3px] flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[14px] font-bold leading-none"
      style={{ background: v.bakgrunn, color: v.farge }}
    >
      {v.tegn}
    </span>
  );
}

// A list of points under a heading: a green plus for what strengthens the case, a red minus for what
// weakens it, with the rule it rests on.
function PunktListe({
  id,
  tittel,
  punkter,
}: {
  id: string;
  tittel: string;
  punkter: Punkt[];
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3.5">
      <h2 id={id} className={SEKSJON_TITTEL}>
        {tittel}
      </h2>
      <ul className={`m-0 list-none p-0 ${KORT}`}>
        {punkter.map((g) => (
          <li key={g.tekst} className={RAD}>
            <Vekt vekt={g.vekt === "for" ? "for" : "mot"} />
            <div className="flex flex-col items-start gap-2">
              <span className="text-[15px] leading-[1.6]">{g.tekst}</span>
              {g.paragraf &&
                (g.lenke ? (
                  <a
                    href={g.lenke}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-[#eef1f6] px-2 py-1 font-kode text-[12px] font-medium text-[#1f3a5f]"
                  >
                    {g.paragraf}
                  </a>
                ) : (
                  <span className="rounded bg-[#eef1f6] px-2 py-1 font-kode text-[12px] font-medium text-[#1f3a5f]">
                    {g.paragraf}
                  </span>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Where the law stops the claim there is no letter to sell. The buyer can change the answers, and is
// pointed to the Consumer Council for advice.
function Utenfor({ endre }: { endre: () => void }) {
  return (
    <aside className="flex flex-col gap-3 rounded-lg border border-[#dcd8cf] bg-white px-6 py-5 md:sticky md:top-6 md:gap-4 md:self-start md:p-9">
      <h2 className="m-0 font-brev text-[20px] font-semibold leading-[1.3] md:text-[24px]">
        Brevet passer ikke for denne saken
      </h2>
      <p className="m-0 text-[14px] leading-[1.6] text-[#3d4757] md:text-[15px]">
        Har du svart feil, kan du endre svarene. Ellers kan Forbrukerrådet gi
        gratis veiledning om hva du kan gjøre.
      </p>
      <button
        type="button"
        onClick={endre}
        className="rounded-[6px] bg-[#17263d] p-3.5 text-center font-ui text-[15px] font-semibold text-[#f6f4ef]"
      >
        Endre svar
      </button>
      <a
        href="https://www.forbrukerradet.no"
        target="_blank"
        rel="noreferrer"
        className="text-center text-[14px] font-medium text-[#1f3a5f] underline"
      >
        Forbrukerrådet
      </a>
    </aside>
  );
}

function Vurdering({
  resultat,
  endre,
  apneBrev,
  kjoretoy,
}: {
  resultat: Resultat;
  endre: () => void;
  apneBrev: () => Promise<string | null>;
  kjoretoy: Kjoretoy | null | undefined;
}) {
  const sammenligning = sammenligningTekst(resultat.utvalg, resultat.eksempel);
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f4ef] font-ui text-[#17263d]">
      <div className="hidden items-center justify-between border-b border-[#dcd8cf] px-16 py-[22px] md:flex">
        <Logo />
        <button type="button" onClick={endre} className="text-[14px] text-[#5b6472]">
          ← Endre svar
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col md:grid md:flex-none md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-start md:gap-16 md:px-16 md:pb-20 md:pt-14">
        <div className="flex flex-col gap-6 px-6 pb-6 pt-[52px] md:gap-9 md:p-0">
          <button type="button" onClick={endre} className="self-start text-[14px] text-[#5b6472] md:hidden">
            ← Endre svar
          </button>
          <div className="flex flex-col gap-3.5 md:gap-4">
            <h1 className="m-0 font-brev text-[28px] font-semibold leading-[1.15] md:text-[44px] md:leading-[1.12] md:tracking-[-.01em] md:[text-wrap:balance]">
              {resultat.tittel}
            </h1>
            {sammenligning && (
              <div className="flex flex-col items-start gap-2">
                <p className="m-0 max-w-[600px] text-[15px] leading-[1.6] text-[#3d4757] [text-wrap:pretty] md:text-[17px] md:leading-[1.65]">
                  {sammenligning}
                </p>
                {resultat.eksempel && (
                  <a href={resultat.eksempel.kildeUrl} target="_blank" rel="noreferrer" className="rounded bg-[#eef1f6] px-2 py-1 font-kode text-[12px] font-medium text-[#1f3a5f]">
                    Forbrukerklageutvalget, sak {resultat.eksempel.saksnummer}
                  </a>
                )}
              </div>
            )}
            <p className="m-0 max-w-[600px] text-[15px] leading-[1.6] text-[#3d4757] [text-wrap:pretty] md:text-[17px] md:leading-[1.65]">
              {resultat.begrunnelse}
            </p>
          </div>
          {resultat.styrker.length > 0 && (
            <PunktListe
              id="styrker"
              tittel="Dette styrker saken din"
              punkter={resultat.styrker}
            />
          )}
          {resultat.svakheter.length > 0 && (
            <PunktListe
              id="svakheter"
              tittel={
                resultat.niva === "utenfor"
                  ? "Dette stopper saken din"
                  : "Dette svekker saken din"
              }
              punkter={resultat.svakheter}
            />
          )}
          <p className="m-0 max-w-[600px] border-t border-[#dcd8cf] pt-4 text-[13px] leading-[1.55] text-[#5b6472]">
            Vurderingen bygger på svarene dine og på tidligere vedtak. Den er veiledende og ikke juridisk rådgivning, og utfallet i din sak kan bli et annet.
          </p>
        </div>
        <div className="mt-auto md:mt-0">
          {resultat.niva === "utenfor" ? (
            <Utenfor endre={endre} />
          ) : (
            <Neste
              medEksempel={
                resultat.eksempel?.utfall === "vunnet" &&
                resultat.eksempel.treff === "lignende"
              }
              apneBrev={apneBrev}
              kjoretoy={kjoretoy}
              velgBil={endre}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// The answers and the step live in the URL (`?kjopsdato=2024-03-12&…&steg=2`), so a link opens the form where
// it was. A complete set of answers without `steg` is a link to the assessment itself.
// The vehicle is not part of the answers and never goes in the address: a registration number is
// personal. It is kept in this tab (sessionStorage) so a reload does not lose it, and goes to the
// server when the letter is opened.
export function Skjema({ startSvar, startSteg }: { startSvar: Innsending; startSteg: number }) {
  const id = useId();
  const router = useRouter();
  const forsteUgyldig = forsteUgyldigeSteg(startSvar);
  const visVurdering = forsteUgyldig === null && !startSteg;
  const [steg, setSteg] = useState<Steg>(() => {
    const onsket = stegFor(startSvar).find((s) => s === startSteg) ?? 1;
    return forsteUgyldig === null ? onsket : (Math.min(onsket, forsteUgyldig) as Steg);
  });
  const [d, setD] = useState<Innsending>(startSvar);
  const [sender, setSender] = useState(visVurdering);
  const [feil, setFeil] = useState<string | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  // undefined until this tab's storage has been read.
  const [kjoretoy, setKjoretoy] = useState<Kjoretoy | null | undefined>(undefined);
  // The purchase date was suggested from the registry and has not been touched since.
  const [datoFraRegister, setDatoFraRegister] = useState(false);

  const sett = <K extends keyof Innsending>(k: K, v: Innsending[K]) => setD((x) => ({ ...x, [k]: v }));

  const velgKjopsalder = (alder: (typeof KJOPSALDER_VALG)[number] | "") => {
    setDatoFraRegister(false);
    setD((x) => medKjopsalder(x, alder));
  };

  // The evidence step only exists when the defect showed outside the presumption period.
  const steger = stegFor(d);
  const sisteSteg = steger[steger.length - 1];

  // Returns an error message, or null when the result was set. `avbrutt` says the caller no longer
  // wants the answer (the effect was cleaned up), so a late answer cannot bring the result back.
  async function hent(data: Innsending, avbrutt: () => boolean = () => false): Promise<string | null> {
    try {
      const res = await fetch("/api/vurder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as Partial<Resultat> & { feil?: string };
      if (!res.ok || !json.niva || !json.tittel || !json.begrunnelse) throw new Error(json.feil ?? "Noe gikk galt.");
      if (avbrutt()) return null;
      setResultat({
        niva: json.niva,
        tittel: json.tittel,
        begrunnelse: json.begrunnelse,
        styrker: json.styrker ?? [],
        svakheter: json.svakheter ?? [],
        tiltak: json.tiltak ?? [],
        utvalg: json.utvalg ?? null,
        eksempel: json.eksempel ?? null,
      });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Noe gikk galt.";
    }
  }

  // Keeps the address in step with the answers without adding history entries.
  function oppdaterUrl(data: Innsending, s: Steg | null) {
    const p = tilParametre(data);
    if (s) p.set("steg", String(s));
    window.history.replaceState(null, "", `?${p}`);
  }

  // The day the registry has the vehicle on its current owner is a good guess at the day of the
  // purchase, so it picks the answer to «Når kjøpte du bilen?» and keeps the day for the letter. An
  // answer the buyer has chosen is never replaced, and a suggestion goes away with the vehicle it
  // came from.
  function velgKjoretoy(k: Kjoretoy | null, eierFra?: string | null) {
    if (k && eierFra && !d.kjopAlder && gyldigKjopsdato(eierFra)) {
      setD((x) => medKjopsdato(x, eierFra));
      setDatoFraRegister(true);
    } else if (!k && datoFraRegister) {
      velgKjopsalder("");
    }
    setKjoretoy(k);
    // Storage can be blocked or empty; the vehicle is then fetched again.
    try {
      if (k) sessionStorage.setItem(KJORETOY_NOKKEL, JSON.stringify(k));
      else sessionStorage.removeItem(KJORETOY_NOKKEL);
    } catch {
      /* the vehicle stays in this page's state */
    }
  }

  useEffect(() => {
    let k: Kjoretoy | null = null;
    try {
      const lagret = sessionStorage.getItem(KJORETOY_NOKKEL);
      k = lagret ? lesKjoretoy(JSON.parse(lagret)) : null;
    } catch {
      /* nothing saved, or storage is blocked */
    }
    // sessionStorage does not exist on the server, so this cannot be read while rendering without
    // the first render differing from the server's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKjoretoy(k);
  }, []);

  useEffect(() => {
    if (!visVurdering) return;
    // React runs this effect twice in development; only the answer to the last call counts.
    let avbrutt = false;
    void hent(startSvar, () => avbrutt).then((f) => {
      if (avbrutt) return;
      setFeil(f);
      if (f) setSteg(1);
      setSender(false);
    });
    return () => {
      avbrutt = true;
    };
    // Only the link that opened the page is fetched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!resultat && !sender) oppdaterUrl(d, steg);
  }, [d, steg, resultat, sender]);

  // The vehicle is part of the first step: nothing else in the assessment is about another car.
  const kanGaVidere = stegGyldig(d, steg) && (steg !== 1 || !!kjoretoy);

  async function neste() {
    if (!kanGaVidere) return;
    setFeil(null);
    if (steg < sisteSteg) return setSteg(steger[steger.indexOf(steg) + 1]);
    setSender(true);
    const f = await hent(d);
    setFeil(f);
    if (!f) oppdaterUrl(d, null);
    setSender(false);
  }

  async function apneBrev(): Promise<string | null> {
    if (!kjoretoy) return "Hent bilen med registreringsnummeret først.";
    try {
      const res = await fetch("/api/sak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, kjoretoy }),
      });
      const json = (await res.json()) as { id?: string; feil?: string };
      if (!res.ok || !json.id) return json.feil ?? "Noe gikk galt. Prøv igjen.";
      router.push(`/brev/${json.id}`);
      return null;
    } catch {
      return "Noe gikk galt. Prøv igjen.";
    }
  }

  if (sender) return <Venter />;

  if (resultat) {
    return <Vurdering resultat={resultat} endre={() => { setSteg(1); setResultat(null); }} apneBrev={apneBrev} kjoretoy={kjoretoy} />;
  }

  const tilbake =
    steg === 1 ? (
      <Link href="/">← Tilbake</Link>
    ) : (
      <button type="button" onClick={() => setSteg((steg - 1) as Steg)}>
        ← Tilbake
      </button>
    );

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f4ef]">
      <div className="hidden items-center justify-between border-b border-[#dcd8cf] px-16 py-[22px] md:flex">
        <Link href="/">
          <Logo />
        </Link>
        <span className="text-[14px] text-[#5b6472]">Gratis vurdering · ingen konto</span>
      </div>
      <form
        className="mx-auto flex w-full max-w-[430px] flex-1 flex-col font-ui text-[#17263d] md:max-w-[720px] md:flex-none md:gap-9 md:pb-[72px] md:pt-14"
        onSubmit={(e) => {
          e.preventDefault();
          void neste();
        }}
        noValidate
      >
        <StegTopp steger={steger} steg={steg} tilbake={tilbake} gaTil={setSteg} />
        <Tittel tittel={STEG_TEKST[steg].tittel} />

        {steg === 1 && (
          <>
            <div className={INNHOLD}>
              <Regnr kjoretoy={kjoretoy ?? null} funnet={velgKjoretoy} />
              <div className="flex flex-col gap-2">
                <Valg
                  id={`${id}-kjopalder`}
                  label={SPORSMAL.kjopAlder}
                  verdier={KJOPSALDER_VALG}
                  tekst={KJOPSALDER_TEKST}
                  valgt={d.kjopAlder}
                  velg={velgKjopsalder}
                  kort
                />
                {datoFraRegister && <p className="m-0 text-[13px] leading-[1.5] text-[#5b6472]">Valgt ut fra Statens vegvesen: dagen bilen ble registrert på deg. Velg et annet alternativ hvis det ikke stemmer.</p>}
              </div>
              <Valg
                id={`${id}-kjopsform`}
                label={SPORSMAL.kjopsform}
                verdier={KJOPSFORM_VALG}
                tekst={KJOPSFORM_TEKST}
                valgt={d.kjopsform}
                velg={(v) => sett("kjopsform", v)}
                kort
              />
            </div>
          </>
        )}

        {steg === 2 && (
          <>
            <div className={INNHOLD}>
              <div role="group" aria-labelledby={`${id}-feiltype`} className="flex flex-col gap-2.5 md:gap-3">
                <span id={`${id}-feiltype`} className={LABEL}>
                  {SPORSMAL.feiltype} <span className="hidden font-normal text-[#5b6472] md:inline">Velg én eller flere</span>
                </span>
                <div className="flex flex-wrap gap-2 md:gap-2.5">
                  {FEILTYPER_KNAPPER.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={d.feiltyper.includes(f)}
                      onClick={() =>
                        sett("feiltyper", d.feiltyper.includes(f) ? d.feiltyper.filter((x) => x !== f) : [...d.feiltyper, f])
                      }
                      className={`rounded-full px-3.5 py-2.5 font-ui text-[14px] font-medium md:px-5 md:py-3 md:text-[15px] ${
                        d.feiltyper.includes(f) ? "bg-[#17263d] text-[#f6f4ef]" : "border border-[#bfbab0] bg-white text-[#17263d]"
                      }`}
                    >
                      {FEILTYPE_TEKST[f]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Valg
                  id={`${id}-oppdaget`}
                  label={SPORSMAL.oppdaget}
                  verdier={OPPDAGET_VALG}
                  tekst={OPPDAGET_TEKST}
                  valgt={d.oppdaget}
                  velg={(v) => sett("oppdaget", v)}
                  kort
                  deaktivert={(v) => !oppdagetMulig(d, v)}
                />
                {/* The period turns on 1 January, so the year alone decides it. */}
                {d.kjopAlder && (
                  <p className="m-0 hidden text-[13px] leading-[1.5] text-[#5b6472] md:block">
                    {presumsjonManederFor(kjopsdatoAv(d)) === 24 ? "Innen 2 år" : "Innen 6 måneder"} antas feilen å ha vært der ved levering. Da står du sterkere.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {steg === 3 && (
          <>
            <div className={INNHOLD}>
              {sporOmOpplysning(d) && (
                <Valg
                  id={`${id}-opplyst`}
                  label={SPORSMAL.opplyst}
                  verdier={OPPLYST_VALG}
                  tekst={OPPLYST_TEKST}
                  valgt={d.opplystForKjop}
                  velg={(v) => sett("opplystForKjop", v)}
                  kort
                />
              )}
              <Valg
                id={`${id}-kontakt`}
                label={SPORSMAL.kontakt}
                verdier={KONTAKT_VALG}
                tekst={KONTAKT_TEKST}
                valgt={d.kontakt}
                velg={(v) => sett("kontakt", v)}
                kort
              />
              {sporOmFemarsfrist(d) && (
                <Valg
                  id={`${id}-reklamert`}
                  label={SPORSMAL.reklamert}
                  verdier={JA_NEI}
                  tekst={JA_NEI_TEKST}
                  valgt={d.reklamertInnenFemAr}
                  velg={(v) => sett("reklamertInnenFemAr", v)}
                />
              )}
            </div>
          </>
        )}

        {steg === 4 && (
          <>
            <div className={INNHOLD}>
              <Radliste>
                <Valg
                  id={`${id}-rapport`}
                  label={SPORSMAL.rapport}
                  verdier={JA_NEI}
                  tekst={JA_NEI_TEKST}
                  valgt={d.verkstedrapport}
                  velg={(v) => sett("verkstedrapport", v)}
                  rad
                />
                {d.verkstedrapport === "ja" && (
                  <Valg
                    id={`${id}-rapport-sier`}
                    label={SPORSMAL.rapportSier}
                    verdier={JA_NEI}
                    tekst={JA_NEI_TEKST}
                    valgt={d.rapportSierForKjop}
                    velg={(v) => sett("rapportSierForKjop", v)}
                    rad
                  />
                )}
              </Radliste>
              <p className="m-0 text-[13px] leading-[1.5] text-[#5b6472] md:-mt-4">
                En rapport som peker bakover i tid er det sterkeste beviset ditt. Du kan laste den opp etter vurderingen.
              </p>
            </div>
          </>
        )}

        <div className="mt-auto flex flex-col gap-3 p-6 md:mt-0 md:flex-row md:items-center md:justify-between md:gap-6 md:border-t md:border-[#dcd8cf] md:p-0 md:pt-6">
          <p className="m-0 hidden text-[13px] text-[#5b6472] md:block">Svarene lagres ikke før du går videre</p>
          <div className="flex flex-col gap-3 md:items-end">
            {feil && (
              <p role="alert" className="m-0 text-center font-ui text-[14px] text-[oklch(0.42_0.12_25)]">
                {feil}
              </p>
            )}
            <button type="submit" className={`${KNAPP} md:w-auto md:min-w-[240px] md:px-8 md:py-[17px]`} disabled={!kanGaVidere || sender}>
              {sender ? "Vurderer saken …" : nesteTekst(steger, steg)}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
