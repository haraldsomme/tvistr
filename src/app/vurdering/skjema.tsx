"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/app/logo";
import { useEffect, useId, useState, type ReactNode } from "react";
import { FEILTYPER_KNAPPER, forsteUgyldigeSteg, FRA_AR, JA_NEI, oppdagetMulig, OPPLYST_VALG, sporOmReklamasjonsdato, stegGyldig, tilParametre, type Innsending, type Steg } from "@/lib/vurdering/innsending";
import { iDag, presumsjonManederFor } from "@/lib/vurdering/faktorer";
import { KONTAKT_VALG, OPPDAGET_VALG, type Kontakt, type Niva, type Oppdaget } from "@/lib/vurdering/typer";

// How close the example decision is to the buyer's case; see finnEksempel.
type Treff = "lignende" | "tilnaermet" | "generell";
type Resultat = {
  niva: Niva;
  tittel: string;
  begrunnelse: string;
  grunnlag: { tekst: string; vekt: "for" | "mot" | "noytral"; paragraf?: string; lenke?: string }[];
  // The explanation is only sent for a weak case; otherwise it is part of the paid step.
  tiltak: { tittel: string; tekst?: string }[];
  // null when the case was ruled out before the comparison.
  utvalg: { n: number; spesifikk: boolean } | null;
  eksempel: { setning: string; saksnummer: string; kildeUrl: string; utfall: "vunnet" | "tapt"; treff: Treff } | null;
};

const FEILTYPE_TEKST: Record<(typeof FEILTYPER_KNAPPER)[number], string> = {
  motor: "Motor",
  girkasse: "Girkasse og clutch",
  elektrisk: "Elektrisk",
  batteri: "Batteri (elbil)",
  understell: "Understell og hjul",
  bremser: "Bremser",
  rust: "Rust",
  fukt: "Fukt og lekkasje",
  klimaanlegg: "Klimaanlegg",
  km_service: "Kilometer og servicehistorikk",
  skade: "Kollisjonsskade",
  annet: "Annet",
};
const OPPLYST_TEKST = { ja: "Ja", nei: "Nei", usikker: "Usikker" } as const;
const KONTAKTET_TEKST = { nei: "Nei, ikke ennå", ja: "Ja" } as const;
// The follow-up when the dealer has been contacted.
const SVAR_VALG = KONTAKT_VALG.filter((k): k is Exclude<Kontakt, "nei"> => k !== "nei");
const SVAR_TEKST: Record<Exclude<Kontakt, "nei">, string> = {
  venter: "Venter på svar eller reparasjon",
  avvist: "Forhandleren avviste",
  forsokt: "Forsøkt rettet, uten hell",
};
const OPPDAGET_TEKST: Record<Oppdaget, string> = {
  innen_6_mnd: "Innen 6 måneder",
  "6_mnd_til_2_ar": "6 måneder til 2 år",
  over_2_ar: "Mer enn 2 år",
};
const JA_NEI_TEKST = { ja: "Ja", nei: "Nei" } as const;
const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
const STEG: readonly Steg[] = [1, 2, 3, 4];
const SISTE_STEG: Steg = 4;
const STEG_TEKST: Record<Steg, { navn: string; tittel: string }> = {
  1: { navn: "Bilen", tittel: "Hvilken bil kjøpte du?" },
  2: { navn: "Feilen", tittel: "Hva er galt med bilen?" },
  3: { navn: "Forhandleren", tittel: "Hva har forhandleren sagt?" },
  4: { navn: "Bevis", tittel: "Hvilke bevis har du?" },
};
const NESTE_TEKST: Record<Steg, string> = {
  1: `Neste: ${STEG_TEKST[2].navn} →`,
  2: `Neste: ${STEG_TEKST[3].navn} →`,
  3: `Neste: ${STEG_TEKST[4].navn} →`,
  4: "Se vurderingen →",
};
// Digits only in the state; the field shows them grouped in thousands.
const bareSifre = (s: string) => s.replace(/\D/g, "").slice(0, 9);
const medMellomrom = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const INPUT =
  "w-full rounded-[6px] border border-[#bfbab0] bg-white p-[14px] font-ui text-[16px] text-[#17263d] outline-none placeholder:text-[#8a94a3] focus:border-[#17263d] focus:shadow-[0_0_0_.5px_#17263d]";
const INNHOLD = "flex flex-col gap-5 px-6 pt-[22px] md:gap-9 md:px-0 md:pt-0";
const LABEL = "font-ui text-[14px] font-semibold text-[#17263d] md:text-[15px]";
const KNAPP =
  "w-full rounded-[6px] bg-[#17263d] p-[18px] text-center font-ui text-[16px] font-semibold text-[#f6f4ef] disabled:cursor-not-allowed disabled:opacity-40";

// Completed steps are buttons back to that step; the ones ahead cannot be opened, so each step is
// still validated before the next.
function StegTopp({ steg, tilbake, gaTil }: { steg: Steg; tilbake: ReactNode; gaTil: (n: Steg) => void }) {
  return (
    <div className="flex flex-col gap-3.5 px-6 pt-[52px] md:gap-3.5 md:px-0 md:pt-0">
      <div className="font-ui text-[14px] text-[#5b6472]">{tilbake}</div>
      <ol className="m-0 flex list-none gap-1.5 p-0 md:gap-2">
        {STEG.map((n) => {
          const navn = `${n} ${STEG_TEKST[n].navn}`;
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

// Native select with a chevron, so the label text stays accessible.
function Rullegardin({ label, ...rest }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select aria-label={label} {...rest} className={`${INPUT} appearance-none pr-10 md:px-4 ${rest.className ?? ""}`} />
      <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-[#5b6472]">
        ▾
      </span>
    </div>
  );
}

const NIVA_VISNING: Record<Niva, { tekst: string; prikk: string; farge: string; bakgrunn: string }> = {
  sterk: { tekst: "Sterk sak", prikk: "oklch(0.52 0.1 160)", farge: "oklch(0.42 0.1 160)", bakgrunn: "oklch(0.95 0.04 160)" },
  middels: { tekst: "Middels sterk sak", prikk: "oklch(0.45 0.1 75)", farge: "oklch(0.45 0.1 75)", bakgrunn: "oklch(0.95 0.04 75)" },
  svak: { tekst: "Dårlig sak", prikk: "oklch(0.52 0.12 25)", farge: "oklch(0.42 0.12 25)", bakgrunn: "oklch(0.95 0.04 25)" },
  ikke_aktuell: { tekst: "Ingen sak", prikk: "#8a94a3", farge: "#5b6472", bakgrunn: "#e6e2d8" },
};
// For and against get a sign in the same green and red as the case level; neutral points a grey dot.
const VEKT_TEGN = {
  for: { tegn: "+", farge: "oklch(0.42 0.1 160)", bakgrunn: "oklch(0.95 0.04 160)", tekst: "Taler for saken" },
  mot: { tegn: "−", farge: "oklch(0.42 0.12 25)", bakgrunn: "oklch(0.95 0.04 25)", tekst: "Taler mot saken" },
} as const;
const TREFF_TEKST: Record<Treff, string> = {
  lignende: "Ett eksempel:",
  tilnaermet: "Det nærmeste eksemplet:",
  generell: "Ett eksempel fra grunnlaget:",
};
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

// From the first complaint to the committee's decision: median 664 days (middle half 514–851) in
// the 326 dealer decisions from 2023 on that state the complaint date (vedtak.forste_reklamasjon_dato
// to vedtaksdato, computed 2026-10-01). It was 357 days before 2021. Recompute when `hent` has added more.
const TID_TIL_VEDTAK = "Saker som ender hos Forbrukerklageutvalget tar nå typisk rundt to år. Et godt brev kan løse saken før det.";

// Payment is not built yet: both buttons open the letter. Payment goes in front of it later.
const LIGNENDE_SAKER = "Henvisninger til lignende saker som fikk medhold";
const NESTE_PUNKTER = [
  "Formuleringer etter og henvisninger til lovverk",
  LIGNENDE_SAKER,
  "Frist for svar fra forhandleren",
  "Hva du gjør hvis forhandleren avviser",
  "PDF og redigerbar Word-fil",
];

// The line about similar cases is only promised when we have one to refer to.
// `apneBrev` opens the letter and returns an error message if that failed.
function Neste({ niva, medEksempel, apneBrev }: { niva: Niva; medEksempel: boolean; apneBrev: () => Promise<string | null> }) {
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
          {niva === "svak" ? "Vil du reklamere likevel?" : "Få reklamasjonsbrevet"}
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
      <Vipps tekst="Betal med" onClick={apne} disabled={apner} />
      <button
        type="button"
        onClick={apne}
        disabled={apner}
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

// Points for the case first, then those against, then the neutral ones; the order within each group is kept.
const VEKT_REKKEFOLGE = { for: 0, mot: 1, noytral: 2 } as const;
const sortertGrunnlag = <T extends { vekt: keyof typeof VEKT_REKKEFOLGE }>(punkter: T[]) =>
  [...punkter].sort((a, b) => VEKT_REKKEFOLGE[a.vekt] - VEKT_REKKEFOLGE[b.vekt]);

function Prikk() {
  return <div aria-hidden className="mt-[7px] h-[9px] w-[9px] flex-none rounded-full bg-[#8a9bb5]" />;
}

function Vekt({ vekt }: { vekt: "for" | "mot" | "noytral" }) {
  if (vekt === "noytral") return <Prikk />;
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

function Vurdering({ resultat, endre, apneBrev }: { resultat: Resultat; endre: () => void; apneBrev: () => Promise<string | null> }) {
  const v = NIVA_VISNING[resultat.niva];
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
            <div className="flex items-center gap-[9px] self-start rounded-full px-3.5 py-[7px]" style={{ background: v.bakgrunn }}>
              <div className="h-[9px] w-[9px] rounded-full" style={{ background: v.prikk }} />
              <div className="text-[13px] font-semibold" style={{ color: v.farge }}>
                {v.tekst}
              </div>
            </div>
            <h1 className="m-0 font-brev text-[28px] font-semibold leading-[1.15] md:text-[44px] md:leading-[1.12] md:tracking-[-.01em] md:[text-wrap:balance]">
              {resultat.tittel}
            </h1>
            <p className="m-0 max-w-[600px] text-[15px] leading-[1.6] text-[#3d4757] [text-wrap:pretty] md:text-[17px] md:leading-[1.65]">
              {resultat.begrunnelse}
            </p>
          </div>
          {(resultat.grunnlag.length > 0 || resultat.utvalg) && (
            <section aria-labelledby="grunnlag" className="flex flex-col gap-3.5">
              <h2 id="grunnlag" className={SEKSJON_TITTEL}>
                Dette bygger vurderingen på
              </h2>
              <ul className={`m-0 list-none p-0 ${KORT}`}>
                {resultat.utvalg && (
                  <li className={RAD}>
                    <Vekt vekt="noytral" />
                    <div className="flex flex-col items-start gap-2">
                      <p className="m-0 text-[15px] leading-[1.6]">
                        <strong className="font-semibold">
                          {resultat.utvalg.spesifikk ? `${resultat.utvalg.n} lignende vedtak` : `${resultat.utvalg.n} vedtak om bruktbil kjøpt fra forhandler`}
                        </strong>{" "}
                        fra Forbrukerklageutvalget.
                        {resultat.eksempel && ` ${TREFF_TEKST[resultat.eksempel.treff]} ${resultat.eksempel.setning}`}
                      </p>
                      {resultat.eksempel && (
                        <a href={resultat.eksempel.kildeUrl} target="_blank" rel="noreferrer" className="rounded bg-[#eef1f6] px-2 py-1 font-kode text-[12px] font-medium text-[#1f3a5f]">
                          Forbrukerklageutvalget, sak {resultat.eksempel.saksnummer}
                        </a>
                      )}
                    </div>
                  </li>
                )}
                {sortertGrunnlag(resultat.grunnlag).map((g) => (
                  <li key={g.tekst} className={RAD}>
                    <Vekt vekt={g.vekt} />
                    <div className="flex flex-col items-start gap-2">
                      <span className="text-[15px] leading-[1.6]">{g.tekst}</span>
                      {g.paragraf &&
                        (g.lenke ? (
                          <a href={g.lenke} target="_blank" rel="noreferrer" className="rounded bg-[#eef1f6] px-2 py-1 font-kode text-[12px] font-medium text-[#1f3a5f]">
                            {g.paragraf}
                          </a>
                        ) : (
                          <span className="rounded bg-[#eef1f6] px-2 py-1 font-kode text-[12px] font-medium text-[#1f3a5f]">{g.paragraf}</span>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {resultat.tiltak.length > 0 && (
            <section aria-labelledby="tiltak" className="flex flex-col gap-3.5">
              <h2 id="tiltak" className={SEKSJON_TITTEL}>
                Dette kan styrke saken
              </h2>
              <ol className={`m-0 list-none p-0 ${KORT}`}>
                {resultat.tiltak.map((t, n) => (
                  <li key={t.tittel} className={`${RAD} items-center py-[17px]`}>
                    <span aria-hidden className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[#eef1f6] text-[15px] font-semibold text-[#1f3a5f]">
                      {n + 1}
                    </span>
                    <div className="flex flex-col gap-1 text-[15px] leading-[1.5]">
                      <span className="font-medium">{t.tittel}</span>
                      {t.tekst && <span className="text-[#3d4757]">{t.tekst}</span>}
                    </div>
                  </li>
                ))}
              </ol>
              {!resultat.tiltak.some((t) => t.tekst) && <p className="m-0 text-[13px] leading-[1.5] text-[#5b6472]">Veiledning om hvordan følger med brevet.</p>}
            </section>
          )}
          <p className="m-0 max-w-[600px] border-t border-[#dcd8cf] pt-4 text-[13px] leading-[1.55] text-[#5b6472]">
            Vurderingen bygger på svarene dine og på tidligere vedtak. Den er veiledende og ikke juridisk rådgivning, og utfallet i din sak kan bli et annet.
          </p>
        </div>
        {resultat.niva !== "ikke_aktuell" && (
          <div className="mt-auto md:mt-0">
            <Neste niva={resultat.niva} medEksempel={resultat.eksempel?.utfall === "vunnet" && resultat.eksempel.treff === "lignende"} apneBrev={apneBrev} />
          </div>
        )}
      </div>
    </div>
  );
}

// The answers and the step live in the URL (`?kjopsdato=2024-03-12&…&steg=2`), so a link opens the form where
// it was. A complete set of answers without `steg` is a link to the assessment itself.
// `sakId` is set when the user came back from a letter: opening the letter again then goes to the
// same case, with the answers as they are now, so nothing filled in there is lost.
export function Skjema({ startSvar, startSteg, sakId }: { startSvar: Innsending; startSteg: number; sakId?: string }) {
  const id = useId();
  const router = useRouter();
  const forsteUgyldig = forsteUgyldigeSteg(startSvar);
  const visVurdering = forsteUgyldig === null && !startSteg;
  const [steg, setSteg] = useState<Steg>(() => {
    const onsket = ([1, 2, 3, 4] as const).find((s) => s === startSteg) ?? 1;
    return forsteUgyldig === null ? onsket : (Math.min(onsket, forsteUgyldig) as Steg);
  });
  const [d, setD] = useState<Innsending>(startSvar);
  // «Ja» on the contact question, before the follow-up is answered.
  const [kontaktet, setKontaktet] = useState(false);
  // «Ja» on the wrong-information question, before the follow-up is answered.
  const [feilinformert, setFeilinformert] = useState(false);
  const [sender, setSender] = useState(visVurdering);
  const [feil, setFeil] = useState<string | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);

  const sett = <K extends keyof Innsending>(k: K, v: Innsending[K]) => setD((x) => ({ ...x, [k]: v }));
  const idag = iDag();

  // Changing the purchase date can make the chosen «how long after» impossible; clear what no longer fits.
  function settKjop(kjopsdato: string) {
    setD((x) => {
      const ny = { ...x, kjopsdato };
      if (ny.oppdaget && !oppdagetMulig(ny, ny.oppdaget)) ny.oppdaget = "";
      // When only one answer fits, there is nothing to choose: pick it.
      const mulige = OPPDAGET_VALG.filter((v) => oppdagetMulig(ny, v));
      if (!ny.oppdaget && mulige.length === 1) ny.oppdaget = mulige[0];
      return ny;
    });
  }

  const naa = new Date();

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
        grunnlag: json.grunnlag ?? [],
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
  function oppdaterUrl(data: Innsending, s: Steg | null, sak: string | undefined) {
    const p = tilParametre(data);
    if (s) p.set("steg", String(s));
    if (sak) p.set("sak", sak);
    window.history.replaceState(null, "", `?${p}`);
  }

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
    if (!resultat && !sender) oppdaterUrl(d, steg, sakId);
  }, [d, steg, resultat, sender, sakId]);

  async function neste() {
    if (!stegGyldig(d, steg)) return;
    setFeil(null);
    if (steg < SISTE_STEG) return setSteg((steg + 1) as Steg);
    setSender(true);
    const f = await hent(d);
    setFeil(f);
    if (!f) oppdaterUrl(d, null, sakId);
    setSender(false);
  }

  async function apneBrev(): Promise<string | null> {
    try {
      const res = await fetch("/api/sak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, ...(sakId && { sak: sakId }) }),
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
    return <Vurdering resultat={resultat} endre={() => { setSteg(1); setResultat(null); }} apneBrev={apneBrev} />;
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
        <StegTopp steg={steg} tilbake={tilbake} gaTil={setSteg} />
        <Tittel tittel={STEG_TEKST[steg].tittel} />

        {steg === 1 && (
          <>
            <div className={INNHOLD}>
              <label className="flex flex-col gap-2.5 md:max-w-[440px] md:gap-3">
                <span className={LABEL}>Når kjøpte du bilen?</span>
                <input
                  type="date"
                  className={INPUT}
                  min={`${FRA_AR}-01-01`}
                  max={idag}
                  value={d.kjopsdato}
                  onChange={(e) => settKjop(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-1 gap-5 md:max-w-[440px] md:grid-cols-2 md:gap-3">
                <label className="flex flex-col gap-2.5 md:gap-3">
                  <span className={LABEL}>Hva kostet bilen?</span>
                  <input
                    className={INPUT}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Kroner"
                    value={medMellomrom(d.kjopesum)}
                    onChange={(e) => sett("kjopesum", bareSifre(e.target.value))}
                  />
                </label>
                <label className="flex flex-col gap-2.5 md:gap-3">
                  <span className={LABEL}>Kilometerstand ved kjøpet</span>
                  <input
                    className={INPUT}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Kilometer"
                    value={medMellomrom(d.kmVedKjop)}
                    onChange={(e) => sett("kmVedKjop", bareSifre(e.target.value))}
                  />
                </label>
              </div>
            </div>
          </>
        )}

        {steg === 2 && (
          <>
            <div className={INNHOLD}>
              <div role="group" aria-labelledby={`${id}-feiltype`} className="flex flex-col gap-2.5 md:gap-3">
                <span id={`${id}-feiltype`} className={LABEL}>
                  Hva gjelder feilen? <span className="hidden font-normal text-[#5b6472] md:inline">Velg én eller flere</span>
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
                  label="Hvor lenge etter kjøpet oppdaget du feilen?"
                  verdier={OPPDAGET_VALG}
                  tekst={OPPDAGET_TEKST}
                  valgt={d.oppdaget}
                  velg={(v) => sett("oppdaget", v)}
                  kort
                  deaktivert={(v) => !oppdagetMulig(d, v)}
                />
                {/* The period turns on 1 January, so the year alone decides it. */}
                {d.kjopsdato && (
                  <p className="m-0 hidden text-[13px] leading-[1.5] text-[#5b6472] md:block">
                    {presumsjonManederFor(d.kjopsdato) === 24 ? "Innen 2 år" : "Innen 6 måneder"} antas feilen å ha vært der ved levering. Da står du sterkere.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {steg === 3 && (
          <>
            <div className={INNHOLD}>
              <Radliste>
                <Valg
                  id={`${id}-opplyst`}
                  label="Ble du fortalt om feilen før kjøpet?"
                  verdier={OPPLYST_VALG}
                  tekst={OPPLYST_TEKST}
                  valgt={d.opplystForKjop}
                  velg={(v) => sett("opplystForKjop", v)}
                  rad
                />
                <Valg
                  id={`${id}-feilopplysning`}
                  label="Ble du feilaktig informert av selger eller annonse?"
                  verdier={JA_NEI}
                  tekst={JA_NEI_TEKST}
                  valgt={d.feilOpplysning === "nei" ? "nei" : feilinformert || d.feilOpplysning ? "ja" : ""}
                  velg={(v) => {
                    setFeilinformert(v === "ja");
                    if (v === "nei") sett("feilOpplysning", "nei");
                    else if (d.feilOpplysning === "nei") sett("feilOpplysning", "");
                  }}
                  rad
                />
                {d.feilOpplysning !== "nei" && (feilinformert || d.feilOpplysning) && (
                  <Valg
                    id={`${id}-dokumentert`}
                    label="Har du det skriftlig?"
                    verdier={JA_NEI}
                    tekst={JA_NEI_TEKST}
                    valgt={d.feilOpplysning === "ja_dokumentert" ? "ja" : d.feilOpplysning === "ja_udokumentert" ? "nei" : ""}
                    velg={(v) => sett("feilOpplysning", v === "ja" ? "ja_dokumentert" : "ja_udokumentert")}
                    rad
                  />
                )}
                <Valg
                  id={`${id}-kontakt`}
                  label="Har du tatt opp feilen med forhandleren?"
                  verdier={JA_NEI}
                  tekst={KONTAKTET_TEKST}
                  valgt={d.kontakt === "nei" ? "nei" : kontaktet || d.kontakt ? "ja" : ""}
                  velg={(v) => {
                    setKontaktet(v === "ja");
                    if (v === "nei") sett("kontakt", "nei");
                    else if (d.kontakt === "nei") sett("kontakt", "");
                  }}
                  rad
                />
              </Radliste>
              {d.kontakt !== "nei" && (kontaktet || d.kontakt) && (
                <Valg
                  id={`${id}-svar`}
                  label="Hva har skjedd siden?"
                  verdier={SVAR_VALG}
                  tekst={SVAR_TEKST}
                  valgt={d.kontakt}
                  velg={(v) => sett("kontakt", v)}
                  kort
                />
              )}
              {sporOmReklamasjonsdato(d) && (
                <div role="group" aria-labelledby={`${id}-reklamert`} className="flex flex-col gap-2.5 md:gap-3">
                  <span id={`${id}-reklamert`} className={LABEL}>
                    Når tok du første gang opp feilen med forhandleren?
                  </span>
                  <div className="grid grid-cols-2 gap-2.5 md:max-w-[440px] md:gap-3">
                    <Rullegardin label="År reklamert" value={d.reklamasjonAr} onChange={(e) => sett("reklamasjonAr", e.target.value)}>
                      <option value="">År</option>
                      {Array.from({ length: naa.getFullYear() - Number(d.kjopsdato.slice(0, 4)) + 1 }, (_, n) => String(Number(d.kjopsdato.slice(0, 4)) + n)).map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </Rullegardin>
                    <Rullegardin
                      label="Måned reklamert"
                      className="disabled:opacity-40"
                      disabled={!d.reklamasjonAr}
                      value={d.reklamasjonManed}
                      onChange={(e) => sett("reklamasjonManed", e.target.value)}
                    >
                      <option value="">Måned</option>
                      {MANEDER.slice(0, d.reklamasjonAr === String(naa.getFullYear()) ? naa.getMonth() + 1 : 12).map((m, n) => (
                        <option key={m} value={String(n + 1)}>
                          {m}
                        </option>
                      ))}
                    </Rullegardin>
                  </div>
                </div>
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
                  label="Har du en verksted- eller tilstandsrapport?"
                  verdier={JA_NEI}
                  tekst={JA_NEI_TEKST}
                  valgt={d.verkstedrapport}
                  velg={(v) => sett("verkstedrapport", v)}
                  rad
                />
                {d.verkstedrapport === "ja" && (
                  <Valg
                    id={`${id}-rapport-sier`}
                    label="Sier rapporten at feilen sannsynligvis var til stede før kjøpet?"
                    verdier={JA_NEI}
                    tekst={JA_NEI_TEKST}
                    valgt={d.rapportSierForKjop}
                    velg={(v) => sett("rapportSierForKjop", v)}
                    rad
                  />
                )}
                {d.verkstedrapport === "nei" && (
                  <Valg
                    id={`${id}-bilder`}
                    label="Har du bilder eller video av feilen?"
                    verdier={JA_NEI}
                    tekst={JA_NEI_TEKST}
                    valgt={d.bilder}
                    velg={(v) => sett("bilder", v)}
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
            <button type="submit" className={`${KNAPP} md:w-auto md:min-w-[240px] md:px-8 md:py-[17px]`} disabled={!stegGyldig(d, steg) || sender}>
              {sender ? "Vurderer saken …" : NESTE_TEKST[steg]}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
