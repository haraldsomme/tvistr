"use client";

// The buyer's form, one flow from the registration number to the letter (docs/skjema.md), as in the
// mockups («Tvistr onboarding v2»):
//   1 Bilen → 2 Kjøpet → 3 Feilen → 4 Vurdering (free) → 5 Detaljer → 6 Krav og selger
//   → 7 Forhåndsvisning (pay) → 8 Brevet
// Everything the assessment needs comes before it, everything the letter needs besides comes after, so
// nothing is asked twice. Step 4 is code and database only (vurderSaken); the one model call is in
// step 7 (finnVedtak), so the preview and the letter rest on the same decision.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Logo } from "@/app/logo";
import { somTekst } from "@/lib/brev/brev";
import { liste } from "@/lib/brev/format";
import { tekniskFeil } from "@/lib/brev/feiltype";
import { MAKS_BESKRIVELSE, MAKS_KONKLUSJON, MAKS_VERKSTEDNAVN, RAPPORT_PUNKTER, rensFritekst, rensKonklusjon, SELGER_SVAR, type SelgerSvar, VERKSTED_HVEM } from "@/lib/brev/rapport";
import { type Riktighet, type Riktighetsmerknad, vurderRiktighet } from "@/lib/brev/riktighet";
import type { Brev } from "@/lib/brev/typer";
import { lovversjon } from "@/lib/brev/paragrafer";
import { dagerMellom, erDato, type Merknad, OVER_TO_AAR_FEIL, OVER_TO_AAR_KJOP, plussManeder, type Vurdering, vurderTidslinje } from "@/lib/brev/tidslinje";
import { type Feilvalg, HOVEDKATEGORIER, rensFeilvalg } from "@/lib/feil/kategorier";
import { type Kjoretoy, normaliserRegnr } from "@/lib/kjoretoy/vegvesen";
import { maal } from "@/lib/maling";
import { PRIS } from "@/lib/pris";
import { fristenErUte, SOM_DEN_ER_GAMMEL, slitedelGrunn, somDenErGammel, type VurderingResultat } from "@/lib/vurdering/vurdering";
import { type BrevResultat, byggBrevet, type Funn, finnVedtak } from "./actions";
import {
  A,
  AS,
  Avkrysning,
  Brevvisning,
  chip,
  Chipvalg,
  Datovelger,
  datoTekst,
  type Detalj,
  Fristvarsel,
  H1,
  Hake,
  HVORDAN,
  type Hvordan,
  INGRESS,
  INK,
  JA_NEI,
  KILDE,
  type Kilde,
  KNAPP,
  kort,
  KRAV,
  type Krav,
  kunSifre,
  LINE,
  Merknader,
  MONO,
  orgnrTekst,
  OPPLYST_VALG,
  type OpplystValg,
  OVERLINE,
  pop,
  Punkt,
  Radiomerke,
  Radiovalg,
  type RapportSkjema,
  type Reklamert,
  RETTINGSFORSOK,
  SANS,
  type Selger,
  Selgervalg,
  Skilt,
  SOM_DEN_ER,
  type SomDenEr,
  storKnapp,
  tall,
  Tallfelt,
  TOM_RAPPORT,
  type Utlegg,
  UTLEGG_FORSLAG,
  Varsel,
} from "./deler";
import { Vurderingsvisning } from "./vurderingsvisning";
import { vurderSaken } from "./vurdering";

const STEG = ["Bilen", "Kjøpet", "Feilen", "Vurdering", "Detaljer", "Krav og selger", "Forhåndsvisning", "Brevet"] as const;
const [BILEN, KJOPET, FEILEN, VURDERING, DETALJER, KRAVSTEG, FORHAND, BREVET] = [0, 1, 2, 3, 4, 5, 6, 7];
// The steps before payment, as the progress counts them («3 / 7»).
const FOR_BETALING = 7;

const STEMMER = [
  { id: "ja", navn: "Ja, det stemmer" },
  { id: "nei", navn: "Nei, søk på nytt" },
] as const;
// Step 5 asks the workshop question in the mockup's words; the answers are the same three.
const VERKSTED_VALG: readonly { id: Kilde; navn: string }[] = [
  { id: "skriftlig", navn: "Ja, og jeg har en rapport" },
  { id: "muntlig", navn: "Ja, men uten rapport" },
  { id: "nei", navn: "Nei" },
];
const OPPLYSNING_VALG: readonly { id: Kilde; navn: string }[] = [
  { id: "nei", navn: "Nei" },
  { id: "skriftlig", navn: "Skriftlig" },
  { id: "muntlig", navn: "Muntlig" },
];

// «3 måneder og 3 uker etter at du overtok bilen».
function tidEtter(kjop: string, dato: string): string {
  let m = 0;
  while (plussManeder(kjop, m + 1) <= dato) m++;
  const rest = dagerMellom(plussManeder(kjop, m), dato);
  const ar = Math.floor(m / 12);
  const mnd = m % 12;
  const uker = Math.floor(rest / 7);
  const deler: string[] = [];
  if (ar) deler.push(`${ar} år`);
  if (mnd) deler.push(`${mnd} ${mnd === 1 ? "måned" : "måneder"}`);
  if (!ar && uker) deler.push(`${uker} ${uker === 1 ? "uke" : "uker"}`);
  if (!deler.length) deler.push(`${rest} ${rest === 1 ? "dag" : "dager"}`);
  return `${liste(deler)} etter at du overtok bilen`;
}
const kortDato = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

// `segl` is the server's seal on the vehicle (/api/kjoretoy); the server builds the letter from it, never
// from the make, model or year the browser sends.
type Bil = { k: Kjoretoy; eierFra: string | null; segl: string };
// Everything the buyer has typed or chosen, kept in sessionStorage so a reload or the browser's back
// button does not lose it. The assessment, the decision and the letter are not kept: they are found
// again from the answers.
type Lagret = {
  step: number;
  detaljSide: number;
  regnr: string;
  car: Bil | null;
  bilBekreftet: "ja" | null;
  kjopsdato: string;
  valg: Feilvalg;
  km: string;
  kjopesum: string;
  somDenEr: SomDenEr | null;
  detaljer: Record<string, Detalj>;
  krav: Krav | null;
  kreverUtlegg: boolean;
  utlegg: Utlegg[];
  selger: Selger | null;
  reklamert: Reklamert | null;
  reklamertDato: string;
  reklamertForm: Hvordan | null;
  forsok: number | null;
  selgerSvar: SelgerSvar | null;
};
const TOM: Lagret = {
  step: 0,
  detaljSide: 0,
  regnr: "",
  car: null,
  bilBekreftet: null,
  kjopsdato: "",
  valg: {},
  km: "",
  kjopesum: "",
  somDenEr: null,
  detaljer: {},
  krav: null,
  kreverUtlegg: false,
  utlegg: [],
  selger: null,
  reklamert: null,
  reklamertDato: "",
  reklamertForm: null,
  forsok: null,
  selgerSvar: null,
};
// v4: «Sa selger noe?» for a technical defect has its own answers. Answers saved under v3 had only how
// it was said, and are left behind.
const LAGRINGSNOKKEL = "tvistr:sak:v4";
// The Vipps order id, kept so that a reload after payment finds the paid letter again (docs/brev.md).
// In development the pay button writes one that stands for a confirmed payment.
const ORDRENOKKEL = "tvistr:ordre";

const streng = (v: unknown, maks: number) => (typeof v === "string" ? v.slice(0, maks) : "");

function lesSelger(v: unknown): Selger | null {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  if (typeof r.orgnr !== "string" || !/^\d{9}$/.test(r.orgnr) || typeof r.navn !== "string") return null;
  return { orgnr: r.orgnr, navn: r.navn.slice(0, 120), kommune: typeof r.kommune === "string" ? r.kommune.slice(0, 80) : null, status: r.status === "konkurs" || r.status === "avvikling" ? r.status : null, naeringskode: typeof r.naeringskode === "string" ? r.naeringskode.slice(0, 10) : null };
}

function lesRapport(r: Record<string, unknown>): RapportSkjema {
  return {
    hvem: VERKSTED_HVEM.find((h) => h.id === r.hvem)?.id,
    navn: streng(r.navn, MAKS_VERKSTEDNAVN),
    dato: streng(r.dato, 10),
    punkter: Array.isArray(r.punkter) ? RAPPORT_PUNKTER.filter((p) => (r.punkter as unknown[]).includes(p.id)).map((p) => p.id) : [],
    konklusjon: streng(r.konklusjon, MAKS_KONKLUSJON),
    overslag: streng(r.overslag, 7).replace(/\D/g, ""),
  };
}

function lesLagret(): Lagret | null {
  try {
    const r = JSON.parse(sessionStorage.getItem(LAGRINGSNOKKEL) ?? "null") as Record<string, unknown> | null;
    if (!r || typeof r !== "object") return null;
    const bil = r.car as Bil | null;
    const detaljer: Record<string, Detalj> = {};
    for (const [id, d] of Object.entries((r.detaljer && typeof r.detaljer === "object" ? r.detaljer : {}) as Record<string, Record<string, unknown>>)) {
      detaljer[id] = {
        ...(typeof d?.oppdaget === "string" && { oppdaget: d.oppdaget.slice(0, 10) }),
        ...(d?.omtrentlig === true && { omtrentlig: true }),
        ...(d?.bekreftet === true && { bekreftet: true }),
        ...(typeof d?.beskrivelse === "string" && { beskrivelse: d.beskrivelse.slice(0, 200) }),
        ...(KILDE.some((k) => k.id === d?.verksted) && { verksted: d.verksted as Kilde }),
        ...(KILDE.some((k) => k.id === d?.opplysning) && { opplysning: d.opplysning as Kilde }),
        ...((d?.opplyst === "i_orden" || d?.opplyst === "feilen") && { opplyst: d.opplyst }),
        ...(d?.rapport && typeof d.rapport === "object" ? { rapport: lesRapport(d.rapport as Record<string, unknown>) } : {}),
      };
    }
    return {
      // The page never opens on the preview or the letter: they are built again.
      step: typeof r.step === "number" && Number.isInteger(r.step) ? Math.min(Math.max(r.step, 0), KRAVSTEG) : 0,
      detaljSide: typeof r.detaljSide === "number" && Number.isInteger(r.detaljSide) ? Math.max(r.detaljSide, 0) : 0,
      regnr: streng(r.regnr, 8),
      car:
        bil && typeof bil === "object" && bil.k && typeof bil.k.merke === "string" && typeof bil.k.modell === "string" && typeof bil.segl === "string"
          ? { k: bil.k, eierFra: typeof bil.eierFra === "string" ? bil.eierFra : null, segl: bil.segl }
          : null,
      bilBekreftet: r.bilBekreftet === "ja" ? "ja" : null,
      kjopsdato: streng(r.kjopsdato, 10),
      valg: rensFeilvalg(r.valg),
      km: streng(r.km, 7).replace(/\D/g, ""),
      kjopesum: streng(r.kjopesum, 8).replace(/\D/g, ""),
      somDenEr: SOM_DEN_ER.find((o) => o.id === r.somDenEr)?.id ?? null,
      detaljer,
      krav: KRAV.find((k) => k.id === r.krav)?.id ?? null,
      reklamert: JA_NEI.find((o) => o.id === r.reklamert)?.id ?? null,
      reklamertDato: streng(r.reklamertDato, 10),
      reklamertForm: HVORDAN.find((o) => o.id === r.reklamertForm)?.id ?? null,
      forsok: RETTINGSFORSOK.find((o) => o.id === r.forsok)?.id ?? null,
      selgerSvar: SELGER_SVAR.find((o) => o.id === r.selgerSvar)?.id ?? null,
      kreverUtlegg: r.kreverUtlegg === true,
      selger: lesSelger(r.selger),
      utlegg: Array.isArray(r.utlegg) ? r.utlegg.slice(0, 20).map((u: Record<string, unknown>) => ({ beskrivelse: streng(u?.beskrivelse, 200), belop: streng(u?.belop, 8).replace(/\D/g, "") })) : [],
    };
  } catch {
    return null;
  }
}

// The landing page sends the registration number as ?regnr=. A new number starts a new case and is
// looked up at once; the number of the case already saved continues it.
function lesStart(): { lagret: Lagret | null; autoHent: boolean } {
  const lagret = lesLagret();
  const fraUrl = new URLSearchParams(window.location.search).get("regnr");
  const ny = fraUrl ? normaliserRegnr(fraUrl) : null;
  if (!ny) return { lagret, autoHent: false };
  const gammel = lagret?.car ? normaliserRegnr(lagret.car.k.regnr) : null;
  if (gammel === ny) return { lagret, autoHent: false };
  return { lagret: { ...TOM, regnr: fraUrl!.toUpperCase().replace(/[^A-ZÆØÅ0-9 -]/g, "").slice(0, 8) }, autoHent: true };
}

// While the server works: the step's heading and a shimmer.
function Venter({ overline, tittel, tekst, anim, bred }: { overline: string; tittel: string; tekst: string; anim: string; bred: boolean }) {
  return (
    <div style={{ animation: anim, display: "flex", flexDirection: "column", gap: 28 }}>
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={OVERLINE}>{overline}</span>
        <h1 style={H1}>{tittel}</h1>
        <p style={INGRESS}>{tekst}</p>
      </header>
      <div role="status" aria-label={tittel} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: bred ? "28px 32px" : "22px 20px", display: "flex", flexDirection: "column", gap: 12, animation: pop(0) }}>
        <span aria-hidden="true" style={{ width: 22, height: 22, boxSizing: "border-box", borderRadius: "50%", border: `2px solid ${AS}`, borderTopColor: A, animation: "rkSpin .7s linear infinite", marginBottom: 6 }} />
        {["92%", "78%", "85%"].map((b, i) => (
          <span key={b} aria-hidden="true" style={{ height: 14, width: b, borderRadius: 4, background: "#ecedea", animation: `rkShimmer 1.1s ease-in-out ${i * 0.15}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// A server call that never throws: a network failure, or no answer within `ms`, gives a message instead,
// so the form never falls through to Next's error page or waits for ever. Server actions run one at a
// time, so after a call that hangs only a reload (the answers are kept) can try again.
const NETTFEIL = "Vi fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.";
const TREGT = "Det tok for lang tid å få svar. Prøv igjen; svarene dine er lagret.";
async function sikkert<T>(kall: () => Promise<T>, ms: number, henger: { current: boolean }): Promise<T | { ok: false; melding: string }> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const tid = new Promise<"tid">((r) => (t = setTimeout(() => r("tid"), ms)));
  try {
    const r = await Promise.race([kall(), tid]);
    if (r !== "tid") return r;
    henger.current = true;
    return { ok: false, melding: TREGT };
  } catch {
    return { ok: false, melding: NETTFEIL };
  } finally {
    clearTimeout(t);
  }
}

function Feilmelding({ tittel, melding, igjen, anim }: { tittel: string; melding: string; igjen: () => void; anim: string }) {
  return (
    <div style={{ animation: anim, display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={H1}>{tittel}</h1>
      <Varsel type="stopp">{melding}</Varsel>
      <button type="button" onClick={igjen} className="rk-neste" style={{ ...storKnapp("aksent"), alignSelf: "flex-start" }}>
        Prøv igjen
      </button>
    </div>
  );
}

// sessionStorage is not there when the server renders. The form is first rendered empty, then
// remounted with what was saved once the client has taken over.
export function Skjema() {
  const hydrert = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const start = useMemo(() => (hydrert ? lesStart() : null), [hydrert]);
  return <SkjemaInnhold key={hydrert ? "klient" : "server"} start={start?.lagret ?? null} autoHent={!!start?.autoHent} lagre={hydrert} />;
}

function SkjemaInnhold({ start, autoHent, lagre }: { start: Lagret | null; autoHent: boolean; lagre: boolean }) {
  const s0 = start ?? TOM;
  const [step, setStep] = useState(s0.step);
  const [detaljSide, setDetaljSide] = useState(s0.detaljSide);
  const [dir, setDir] = useState(1);
  const [w, setW] = useState(1200);
  const [regnr, setRegnr] = useState(s0.regnr);
  const [fetching, setFetching] = useState(false);
  const [car, setCar] = useState<Bil | null>(s0.car);
  const [bilBekreftet, setBilBekreftet] = useState<"ja" | null>(s0.bilBekreftet);
  const [oppslagFeil, setOppslagFeil] = useState<string | null>(null);
  // Suggested from the day the car was registered on its current owner; the buyer can change it.
  const [kjopsdato, setKjopsdato] = useState(s0.kjopsdato);
  const [valg, setValg] = useState<Feilvalg>(s0.valg);
  const [km, setKm] = useState(s0.km);
  const [kjopesum, setKjopesum] = useState(s0.kjopesum);
  const [somDenEr, setSomDenEr] = useState<SomDenEr | null>(s0.somDenEr);
  const [detaljer, setDetaljer] = useState<Record<string, Detalj>>(s0.detaljer);
  const [krav, setKrav] = useState<Krav | null>(s0.krav);
  const [reklamert, setReklamert] = useState<Reklamert | null>(s0.reklamert);
  const [reklamertDato, setReklamertDato] = useState(s0.reklamertDato);
  const [reklamertForm, setReklamertForm] = useState<Hvordan | null>(s0.reklamertForm);
  const [forsok, setForsok] = useState<number | null>(s0.forsok);
  const [selgerSvar, setSelgerSvar] = useState<SelgerSvar | null>(s0.selgerSvar);
  const [kreverUtlegg, setKreverUtlegg] = useState(s0.kreverUtlegg);
  const [utlegg, setUtlegg] = useState<Utlegg[]>(s0.utlegg);
  const [selger, setSelger] = useState<Selger | null>(s0.selger);
  const [vurdering, setVurdering] = useState<VurderingResultat | null>(null);
  const [vurderingFeil, setVurderingFeil] = useState<string | null>(null);
  const [funn, setFunn] = useState<Funn | null>(null);
  const [forhand, setForhand] = useState<BrevResultat | null>(null);
  const [heltBrev, setHeltBrev] = useState<BrevResultat | null>(null);
  const [kopiert, setKopiert] = useState(false);
  // The field «Endre» in the summary leads back to, scrolled into view once its step is shown.
  const [fokus, setFokus] = useState<string | null>(null);
  useEffect(() => {
    if (!fokus) return;
    const t = setTimeout(() => {
      document.getElementById(fokus)?.scrollIntoView({ block: "center", behavior: "smooth" });
      setFokus(null);
    }, 150);
    return () => clearTimeout(t);
  }, [fokus, step]);
  const [soker, startSok] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const foresporsel = useRef(0);
  const vForesporsel = useRef(0);
  const henger = useRef(false);
  const provIgjen = (f: () => void) => (henger.current ? window.location.reload() : f());

  useEffect(() => {
    if (!rootRef.current || !window.ResizeObserver) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!lagre) return;
    const l: Lagret = { step: Math.min(step, KRAVSTEG), detaljSide, regnr, car, bilBekreftet, kjopsdato, valg, km, kjopesum, somDenEr, detaljer, krav, kreverUtlegg, utlegg, selger, reklamert, reklamertDato, reklamertForm, forsok, selgerSvar };
    try {
      sessionStorage.setItem(LAGRINGSNOKKEL, JSON.stringify(l));
    } catch {}
  }, [lagre, step, detaljSide, regnr, car, bilBekreftet, kjopsdato, valg, km, kjopesum, somDenEr, detaljer, krav, kreverUtlegg, utlegg, selger, reklamert, reklamertDato, reklamertForm, forsok, selgerSvar]);

  const isDesktop = w >= 820;
  const idag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(new Date());
  const valgte = HOVEDKATEGORIER.filter((h) => h.id in valg);
  // The categories as the measurement keeps them: «motor.turbo», or «motor» without a subcategory.
  const kategorier = valgte.flatMap((h) => (valg[h.id].length ? valg[h.id].map((u) => `${h.id}.${u}`) : [h.id]));
  const ute = erDato(kjopsdato) && fristenErUte(kjopsdato, idag);
  // The same rule the lookup uses, so the button only works for a number the server accepts.
  const gyldig = normaliserRegnr(regnr) !== null;

  // The chosen defects in the catalogue's order, the order of the pages in step 5 and of the letter. A
  // reload reads them back the same way, so the letter does not change with the order of the clicks.
  const valgIRekkefolge = () => rensFeilvalg(valg);
  // What steps 1–3 answered, as the assessment and the decision search read it.
  const grunnsvar = () => ({ valg: valgIRekkefolge(), kjopsdato, km: Number(km) || null, bilSegl: car?.segl, somDenEr, detaljer: Object.fromEntries(valgte.map((h) => [h.id, { oppdaget: detaljer[h.id]?.oppdaget, omtrentlig: !!detaljer[h.id]?.omtrentlig }])) });
  // Everything, for the letter.
  const brevsvar = () => ({
    valg: valgIRekkefolge(),
    kjopsdato,
    km: Number(km),
    kjopesum: Number(kjopesum),
    bilSegl: car?.segl,
    somDenEr,
    krav,
    // Only the chosen defects, and a report only while the answer is «with a report»: the form keeps
    // the rest, so changing back restores it, but it is not an answer. The estimate is typed as text;
    // the server wants a number.
    detaljer: Object.fromEntries(
      valgte.map((h) => {
        const { rapport, ...d } = detaljer[h.id] ?? {};
        return [h.id, d.verksted === "skriftlig" && rapport ? { ...d, rapport: { ...rapport, overslag: rapport.overslag ? Number(rapport.overslag) : null } } : d];
      }),
    ),
    selgerOrgnr: selger?.orgnr ?? null,
    kontakt: reklamert === "ja" ? { reklamert: true, dato: reklamertDato, form: reklamertForm, svar: selgerSvar, forsok: selgerSvar === "forsokt" ? forsok : 0 } : { reklamert: false },
    utlegg: kreverUtlegg ? utlegg.map((u) => ({ beskrivelse: u.beskrivelse, belop: Number(u.belop) })) : [],
  });

  // The assessment, found again each time step 4 is shown, so it always belongs to the answers.
  // Past five years it needs nothing from the server.
  function vurder() {
    const mitt = ++vForesporsel.current;
    setVurdering(null);
    setVurderingFeil(null);
    if (ute) {
      maal("vurdering_vist", { status: "ute", kategorier });
      return;
    }
    // Not a transition: React keeps a transition pending until the server action answers, so a
    // message after the time limit would never show. The screen follows the state alone.
    void (async () => {
      const r = await sikkert(() => vurderSaken(grunnsvar()), 30_000, henger);
      if (mitt !== vForesporsel.current) return;
      if (!r.ok) return setVurderingFeil(r.melding);
      setVurdering(r.vurdering);
      maal("vurdering_vist", { status: r.vurdering.status, kategorier });
    })();
  }

  // Step 7 opens at once and waits for the answer. The decision is found first (the one model call),
  // then the preview is built from the answers and the decision's paragraph.
  function lagBrev() {
    const mitt = ++foresporsel.current;
    setFunn(null);
    setForhand(null);
    setHeltBrev(null);
    startSok(async () => {
      const svar = brevsvar();
      const f = await sikkert(() => finnVedtak(svar), 90_000, henger);
      if (mitt !== foresporsel.current) return;
      setFunn(f);
      if (!f.ok) return;
      const b = await sikkert(() => byggBrevet({ svar, funn: f }), 30_000, henger);
      if (mitt !== foresporsel.current) return;
      setForhand(b);
      if (b.ok) maal("steg7_vist");
    });
  }

  // Until Vipps is connected the button only works in development (TVISTR_HELT_BREV_UTEN_BETALING=1),
  // where an order id stands for a confirmed payment.
  function betal() {
    maal("betaling_startet");
    const ordreId = `utvikling-${crypto.randomUUID()}`;
    try {
      sessionStorage.setItem(ORDRENOKKEL, ordreId);
    } catch {}
    go(BREVET);
    setHeltBrev(null);
    const mitt = foresporsel.current;
    startSok(async () => {
      const b = await sikkert(() => byggBrevet({ svar: brevsvar(), funn, ordreId }), 30_000, henger);
      if (mitt !== foresporsel.current) return;
      setHeltBrev(b);
      if (b.ok && b.fullt) maal("betaling_fullfort");
    });
  }

  function go(n: number, side = 0) {
    setDir(n > step || (n === step && side >= detaljSide) ? 1 : -1);
    setStep(n);
    setDetaljSide(side);
    // The decision and the letter belong to the answers they were made for; going back lets them change.
    if (n < FORHAND) {
      setFunn(null);
      setForhand(null);
      setHeltBrev(null);
      foresporsel.current++;
    }
    if (n === VURDERING) vurder();
    if (n === FORHAND && step !== BREVET) lagBrev();
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  async function fetchCar() {
    if (!gyldig || fetching) return;
    setFetching(true);
    setCar(null);
    setBilBekreftet(null);
    setOppslagFeil(null);
    // Only the server's own message is shown; anything else (no JSON, no network, no answer) is general.
    let json: { kjoretoy?: Kjoretoy; eierFra?: string | null; segl?: string; feil?: string } | null = null;
    try {
      const res = await fetch(`/api/kjoretoy?${new URLSearchParams({ regnr })}`, { signal: AbortSignal.timeout(15_000) });
      json = await res.json().catch(() => null);
    } catch {}
    setFetching(false);
    if (!json?.kjoretoy || !json.segl) return setOppslagFeil(typeof json?.feil === "string" ? json.feil : "Noe gikk galt. Prøv igjen.");
    setCar({ k: json.kjoretoy, eierFra: json.eierFra ?? null, segl: json.segl });
    setKjopsdato(json.eierFra ?? "");
    maal("regnr_ok");
  }

  const toggleCat = (id: string) => setValg((v) => (id in v ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== id)) : { ...v, [id]: [] }));
  const toggleSub = (h: string, u: string) => setValg((v) => ({ ...v, [h]: v[h].includes(u) ? v[h].filter((x) => x !== u) : [...v[h], u] }));

  // A complaint or a report comes after the purchase and not in the future.
  const dagEtter = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const etterKjop = (dato: string) => /^\d{4}-\d{2}-\d{2}$/.test(dato) && /^\d{4}-\d{2}-\d{2}$/.test(kjopsdato) && dato > kjopsdato && dato <= idag;
  // A report is complete with who examined, the workshop's name, a date and at least one tick. The
  // conclusion and the estimate are optional.
  const rapportOk = (r?: RapportSkjema) => !!r?.hvem && !!r.navn.trim() && etterKjop(r.dato) && r.punkter.length > 0;
  // The timeline judged as the server will judge it (tidslinje.ts).
  const tidslinje: Vurdering = vurderTidslinje({
    kjop: kjopsdato,
    feil: valgte.map((h) => ({
      id: h.id,
      oppdaget: detaljer[h.id]?.oppdaget ?? "",
      omtrentlig: !!detaljer[h.id]?.omtrentlig,
      ...(detaljer[h.id]?.verksted === "skriftlig" && erDato(detaljer[h.id]?.rapport?.dato) && { rapport: detaljer[h.id]!.rapport!.dato }),
    })),
    ...(reklamert === "ja" && erDato(reklamertDato) && { reklamert: reklamertDato }),
    idag,
  });
  // The rules besides the dates (riktighet.ts), on the answers as the server will clean them.
  const riktighet: Riktighet = erDato(kjopsdato)
    ? vurderRiktighet({
        kjopsdato,
        kjopesum: kjopesum ? Number(kjopesum) : null,
        forsteRegistrert: car?.k.ar ?? null,
        somDenEr,
        krav,
        forsok: reklamert === "ja" && selgerSvar === "forsokt" ? (forsok ?? 0) : 0,
        svar: reklamert === "ja" ? selgerSvar : null,
        feil: valgte.map((h) => {
          const x = detaljer[h.id] ?? {};
          const r = x.verksted === "skriftlig" ? x.rapport : undefined;
          return {
            hoved: h.id,
            under: valg[h.id] ?? [],
            opplysning: x.opplysning ?? null,
            opplyst: x.opplyst ?? null,
            verksted: x.verksted ?? null,
            rapport: r ? { navn: r.navn, dato: r.dato, punkter: r.punkter, overslag: r.overslag ? Number(r.overslag) : null } : null,
            beskrivelse: rensFritekst(x.beskrivelse, MAKS_BESKRIVELSE),
            konklusjon: r ? rensKonklusjon(r.konklusjon) : null,
          };
        }),
        utlegg: kreverUtlegg ? utlegg.map((u) => ({ belop: Number(u.belop) || 0 })) : [],
        selger: selger && { orgnr: selger.orgnr, status: selger.status, naeringskode: selger.naeringskode },
      })
    : { stopp: [], advarsler: [] };
  const merkR = (felt: Riktighetsmerknad["felt"], feilId?: string) => {
    const her = (m: Riktighetsmerknad) => m.felt === felt && (feilId === undefined || m.feilId === feilId);
    return { stopp: riktighet.stopp.filter(her), advarsler: riktighet.advarsler.filter(her) };
  };
  // The messages for one field (and one defect), each once.
  const merk = (felt: Merknad["felt"], feilId?: string) => {
    const her = (m: Merknad) => m.felt === felt && (feilId === undefined || m.feilId === feilId);
    const unike = (xs: Merknad[]) => xs.filter((m, i) => xs.findIndex((x) => x.melding === m.melding) === i);
    return { stopp: unike(tidslinje.stopp.filter(her)), advarsler: unike(tidslinje.advarsler.filter(her)) };
  };

  // Step 3: a defect is done with a valid date that does not stop, and an approximate day near a deadline confirmed.
  const datoFerdig = (id: string) => {
    const d = detaljer[id] ?? {};
    const her = (m: Merknad) => m.feilId === id && m.felt === "oppdaget";
    return erDato(d.oppdaget) && !tidslinje.stopp.some(her) && (!tidslinje.advarsler.some((m) => her(m) && m.bekreft) || !!d.bekreftet);
  };
  // Step 5: a page is done when both questions are answered, a written report is filled in, and nothing
  // on the page stops.
  const sideFerdig = (id: string) => {
    const d = detaljer[id] ?? {};
    return (
      !!d.verksted &&
      !!d.opplysning &&
      // A technical defect the seller said something about needs what was said.
      (d.opplysning === "nei" || !teknisk(id) || !!d.opplyst) &&
      (d.verksted !== "skriftlig" || rapportOk(d.rapport)) &&
      !riktighet.stopp.some((m) => m.feilId === id) &&
      !tidslinje.stopp.some((m) => m.feilId === id && m.felt === "rapport")
    );
  };
  const teknisk = (id: string) => tekniskFeil({ hoved: id, under: valg[id] ?? [] });
  const settDetalj = (id: string, endring: Detalj) => setDetaljer((v) => ({ ...v, [id]: { ...v[id], ...endring } }));
  const settRapport = (id: string, endring: Partial<RapportSkjema>) => setDetaljer((v) => ({ ...v, [id]: { ...v[id], rapport: { ...(v[id]?.rapport ?? TOM_RAPPORT), ...endring } } }));
  // The same report for this defect as for the one before: the workshop, the date and who. What the
  // report says about this defect is ticked again.
  const kopierRapport = (id: string, fra: RapportSkjema) => settRapport(id, { hvem: fra.hvem, navn: fra.navn, dato: fra.dato, punkter: [], konklusjon: "", overslag: "" });
  // «No» clears the rest: without a complaint there are no repairs and no answer to give.
  const velgReklamert = (r: Reklamert) => {
    setReklamert(r);
    if (r === "nei") {
      setReklamertDato("");
      setReklamertForm(null);
      setForsok(null);
      setSelgerSvar(null);
    }
  };
  const settUtlegg = (i: number, endring: Partial<Utlegg>) => setUtlegg((u) => u.map((x, j) => (j === i ? { ...x, ...endring } : x)));

  const carName = car ? [car.k.merke, car.k.modell].filter(Boolean).join(" ") : "";
  const kjopStopp = [...tidslinje.stopp.filter((m) => m.felt === "kjopsdato" && m.regel !== "kjop_fem_aar" && m.regel !== "kjop_mangler"), ...merkR("kjopsdato").stopp];
  const aarSiden = (n: number) => `${Number(idag.slice(0, 4)) - n}${idag.slice(4)}`;
  const utleggSum = utlegg.reduce((s, x) => s + (Number(x.belop) || 0), 0);
  const utleggOk = !kreverUtlegg || (utlegg.length > 0 && utlegg.every((x) => x.beskrivelse.trim() && Number(x.belop) > 0));
  // Contact with the seller: «no» is the letter being the complaint. «Yes» needs the date, how, the
  // repairs and the answer, so the answers cannot contradict each other (repairs without a complaint).
  const kontaktOk =
    reklamert === "nei" || (reklamert === "ja" && etterKjop(reklamertDato) && !tidslinje.stopp.some((m) => m.felt === "reklamert") && !!reklamertForm && !!selgerSvar && (selgerSvar !== "forsokt" || (forsok ?? 0) > 0));
  const sideFeil = valgte[Math.min(detaljSide, Math.max(valgte.length - 1, 0))];
  const stegOk = [
    !!car && !fetching && bilBekreftet === "ja",
    erDato(kjopsdato) && !kjopStopp.length && Number(km) > 0 && Number(kjopesum) > 0 && !!somDenEr && !riktighet.stopp.some((m) => m.felt === "kjopesum"),
    valgte.length > 0 && valgte.every((h) => datoFerdig(h.id)),
    false,
    !!sideFeil && sideFerdig(sideFeil.id),
    !!krav && kontaktOk && utleggOk && !!selger && !riktighet.stopp.length && !tidslinje.stopp.length,
    false,
    false,
  ];
  const valid = stegOk[step];
  const ok = valid && !soker;
  // A case read back from sessionStorage opens on the first step that is not done, never past it: what
  // the browser stored is not trusted more than what the buyer would have had to get through.
  const forsteApne = (): { steg: number; side: number } => {
    for (const n of [BILEN, KJOPET]) if (n < step && !stegOk[n]) return { steg: n, side: 0 };
    if (step > VURDERING && ute) return { steg: VURDERING, side: 0 };
    if (step > FEILEN && !stegOk[FEILEN]) return { steg: FEILEN, side: 0 };
    const side = valgte.findIndex((h) => !sideFerdig(h.id));
    if (step > DETALJER && side >= 0) return { steg: DETALJER, side };
    if (step === DETALJER && side >= 0 && side < detaljSide) return { steg: DETALJER, side };
    return { steg: step, side: detaljSide };
  };

  // A page restored on step 4 finds its assessment again; the landing page's number is looked up. In a
  // timeout, so a remount in development's strict mode cancels the first run. The number leaves the
  // address either way, so a reload later is not read as the landing page again.
  useEffect(() => {
    if (!lagre) return;
    const t = setTimeout(() => {
      if (window.location.search) window.history.replaceState(null, "", "/sak");
      if (autoHent) return void fetchCar();
      const { steg, side } = forsteApne();
      if (steg !== step || side !== detaljSide) {
        setStep(steg);
        setDetaljSide(side);
      }
      if (steg === VURDERING) vurder();
    });
    return () => clearTimeout(t);
    // Once, on the client's first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lagre]);

  const statusKort = vurdering ? { sak: "Du kan ha en sak", svak: "Du kan ha en sak", ute: "Fristen er ute" }[vurdering.status] : step >= VURDERING && ute ? "Fristen er ute" : "Gratis";
  const subs = [
    car ? `${carName} · ${car.k.regnr}` : "",
    erDato(kjopsdato) ? [kortDato(kjopsdato), kjopesum && `${tall(kjopesum)} kr`].filter(Boolean).join(" · ") : "",
    valgte.map((h) => h.navn).join(", "),
    statusKort,
    valgte.some((h) => detaljer[h.id]?.verksted === "skriftlig") ? "Verkstedrapport" : "",
    [KRAV.find((k) => k.id === krav)?.navn, selger?.navn].filter(Boolean).join(" · "),
    step === BREVET ? `Betalt ${PRIS} kr` : "",
    "",
  ];
  // Where a field is: its step, the page of the defect, and the element to scroll to.
  const gaaTil = (m: { felt: string; feilId?: string; regel: string }) => {
    const sideFor = (id?: string) => Math.max(0, valgte.findIndex((h) => h.id === id));
    if (m.felt === "bil") return go(BILEN);
    if (["kjopsdato", "kjopesum"].includes(m.felt) || (m.felt === "somDenEr" && m.regel !== "som_den_er_opplyst")) {
      go(KJOPET);
      return setFokus(`felt-${m.felt}`);
    }
    if (m.felt === "oppdaget") {
      go(FEILEN);
      return setFokus(`felt-oppdaget-${m.feilId}`);
    }
    if (["rapport", "opplysning", "beskrivelse", "konklusjon", "somDenEr"].includes(m.felt)) {
      const id = m.feilId ?? valgte.find((h) => (detaljer[h.id]?.opplysning ?? "nei") !== "nei")?.id;
      go(DETALJER, sideFor(id));
      return setFokus(m.felt === "somDenEr" ? "felt-opplysning" : `felt-${m.felt}`);
    }
    go(KRAVSTEG);
    setFokus(m.felt === "reklamert" ? "felt-kontakt" : m.felt === "kategori" ? "felt-krav" : `felt-${m.felt}`);
  };
  // The warnings of the whole case, each once: the dates' and the rest.
  const alleAdvarsler = [...tidslinje.advarsler, ...riktighet.advarsler].filter((m, i, xs) => xs.findIndex((x) => x.melding === m.melding && x.feilId === m.feilId) === i);
  const datoadvarsler = alleAdvarsler.filter((m) => tidslinje.advarsler.includes(m as Merknad)).length;

  function neste() {
    if (!ok) return;
    if (step === KJOPET) {
      maal("steg2_ferdig");
      return go(ute ? VURDERING : FEILEN);
    }
    if (step === FEILEN) {
      maal("steg3_ferdig", { kategorier });
      return go(VURDERING);
    }
    if (step === DETALJER && detaljSide < valgte.length - 1) return go(DETALJER, detaljSide + 1);
    go(step + 1);
  }
  function tilbake() {
    if (step === DETALJER && detaljSide > 0) return go(DETALJER, detaljSide - 1);
    if (step === VURDERING && ute) return go(KJOPET);
    if (step === KRAVSTEG) return go(DETALJER, Math.max(valgte.length - 1, 0));
    if (step > 0) go(step - 1);
  }

  async function kopier(b: Brev) {
    try {
      await navigator.clipboard.writeText(somTekst(b));
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {}
  }

  async function lastNed(b: Brev) {
    maal("brev_lastet_ned");
    const { tilDocxBlob } = await import("@/lib/brev/docx");
    const url = URL.createObjectURL(await tilDocxBlob(b));
    const lenke = document.createElement("a");
    lenke.href = url;
    lenke.download = `reklamasjon-${(car?.k.regnr ?? "bil").replace(/\s/g, "")}.docx`;
    lenke.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const carRows = car
    ? [
        { k: "Første gang registrert", v: car.k.ar ? String(car.k.ar) : "Ukjent" },
        ...(car.eierFra ? [{ k: "Sist registrert", v: datoTekst(car.eierFra) }] : []),
        ...(car.k.bruktimportert !== undefined ? [{ k: "Bruktimportert", v: car.k.bruktimportert ? "Ja" : "Nei" }] : []),
      ]
    : [];
  const stepAnim = `${dir > 0 ? "rkIn" : "rkBack"} 460ms cubic-bezier(.22,1,.36,1) both`;
  const overline = (navn: string) => `Steg ${step + 1} av ${FOR_BETALING} · ${navn}`;
  const H2 = { margin: 0, fontSize: 17, fontWeight: 600 } as const;
  const visUte = step === VURDERING && ute;
  const nesteTekst = step === FEILEN ? "Se vurderingen" : step === KRAVSTEG ? "Se brevet" : "Fortsett";
  const harNeste = [BILEN, KJOPET, FEILEN, DETALJER, KRAVSTEG].includes(step);
  const toKolonner = isDesktop && (step === FORHAND || step === BREVET);

  return (
    <div ref={rootRef} className="rk" style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", background: "#f6f6f4", fontFamily: SANS, color: INK, overflow: "hidden", WebkitFontSmoothing: "antialiased" }}>
      {isDesktop && (
        <aside style={{ width: 290, flex: "none", background: "#fff", borderRight: `1px solid ${LINE}`, display: "flex", flexDirection: "column", padding: "32px 24px", boxSizing: "border-box", gap: 40, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link href="/" aria-label="Til forsiden" style={{ color: INK, textDecoration: "none" }}>
              <Logo />
            </Link>
            <div style={{ fontSize: 13, color: "#5f6468" }}>Reklamasjon på bruktbil fra forhandler</div>
          </div>
          <nav aria-label="Stegene" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {STEG.map((t, i) => {
              const done = i < step && !(visUte && i > KJOPET),
                cur = i === step;
              return (
                <div key={t} style={{ display: "contents" }}>
                  {i === BREVET && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 6px", font: `600 10.5px ${MONO}`, letterSpacing: ".08em", textTransform: "uppercase", color: "#8a8f93" }}>
                      <span style={{ flex: 1, height: 1, background: LINE }} />
                      Betaling {PRIS} kr
                      <span style={{ flex: 1, height: 1, background: LINE }} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => done && i < FORHAND && go(i, i === DETALJER ? Math.max(valgte.length - 1, 0) : 0)}
                    aria-current={cur ? "step" : undefined}
                    style={{ ...KNAPP, display: "flex", gap: 14, alignItems: "flex-start", padding: 10, borderRadius: 10, cursor: done && i < FORHAND ? "pointer" : "default", background: cur ? "#f3f3f0" : "transparent", transition: "background .25s" }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        flex: "none",
                        boxSizing: "border-box",
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        font: `600 12px ${MONO}`,
                        background: done ? A : "#fff",
                        border: `1.5px solid ${done ? A : cur ? (visUte ? "#9a9ea2" : INK) : LINE}`,
                        color: cur ? INK : "#8a8f93",
                        transition: "all .3s",
                      }}
                    >
                      {done ? <Hake /> : i + 1}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, paddingTop: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: done || cur ? INK : "#8a8f93" }}>{t}</span>
                      {((done && subs[i]) || (i === VURDERING && !done && !cur)) && (
                        <span style={{ fontSize: 12.5, color: "#5f6468", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190 }}>{subs[i]}</span>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </nav>
          <div style={{ marginTop: "auto", fontSize: 13, lineHeight: 1.5, color: "#5f6468" }}>Vurderingen er gratis. Du betaler først når du har sett brevet.</div>
        </aside>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {!isDesktop && (
          <div style={{ background: "#fff", borderBottom: `1px solid ${LINE}`, padding: "16px 20px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Link href="/" aria-label="Til forsiden" style={{ color: INK, textDecoration: "none" }}>
                <Logo liten />
              </Link>
              <span style={{ font: `500 12px ${MONO}`, color: "#5f6468" }}>{step === BREVET ? "Ferdig" : visUte ? "Vurdering" : `${step + 1} / ${FOR_BETALING} · ${STEG[step]}`}</span>
            </div>
            {step !== BREVET && (
              <div style={{ display: "flex", gap: 4 }}>
                {STEG.slice(0, FOR_BETALING).map((t, i) => (
                  <span key={t} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? (visUte ? "#9a9ea2" : A) : LINE, transition: "background .45s cubic-bezier(.22,1,.36,1)" }} />
                ))}
              </div>
            )}
          </div>
        )}

        <div ref={scrollRef} style={{ flex: 1, overflow: "auto", overflowX: "hidden" }}>
          <div style={{ maxWidth: toKolonner ? 960 : 760, margin: "0 auto", padding: isDesktop ? "56px 40px 64px" : "28px 20px 36px", boxSizing: "border-box" }}>
            {step === BILEN && (
              <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 28 }}>
                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={OVERLINE}>{overline("Bilen")}</span>
                  <h1 style={H1}>{car && !fetching ? "Er dette bilen din?" : "Hvilken bil gjelder det?"}</h1>
                  <p style={INGRESS}>{car && !fetching ? "Opplysningene er hentet fra Statens vegvesen." : "Skriv inn registreringsnummeret. Opplysningene hentes fra Statens vegvesen."}</p>
                </header>
                {!car && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: pop(2) }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "stretch", border: `2px solid ${INK}`, borderRadius: 8, overflow: "hidden", background: "#fff", height: 58, width: 230 }}>
                        <div aria-hidden="true" style={{ width: 28, flex: "none", background: "oklch(0.42 0.15 262)", color: "#fff", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 7, boxSizing: "border-box", font: `700 12px ${SANS}` }}>
                          N
                        </div>
                        <input
                          value={regnr}
                          onChange={(e) => setRegnr(e.target.value.toUpperCase().replace(/[^A-ZÆØÅ0-9 -]/g, ""))}
                          onKeyDown={(e) => e.key === "Enter" && void fetchCar()}
                          placeholder="AB 12345"
                          maxLength={8}
                          aria-label="Registreringsnummer"
                          autoComplete="off"
                          spellCheck={false}
                          style={{ border: "none", outline: "none", minWidth: 0, width: "100%", padding: "0 14px", font: `600 25px ${MONO}`, letterSpacing: ".06em", textTransform: "uppercase", color: INK, background: "transparent" }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void fetchCar()}
                        disabled={!gyldig || fetching}
                        style={{ ...KNAPP, cursor: gyldig && !fetching ? "pointer" : "not-allowed", height: 58, padding: "0 22px", borderRadius: 10, background: gyldig ? A : "#9a9ea2", color: "#fff", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}
                      >
                        {fetching && <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", animation: "rkSpin .7s linear infinite" }} />}
                        {fetching ? "Henter …" : "Sjekk bilen"}
                      </button>
                    </div>
                    {oppslagFeil && <Varsel type="stopp">{oppslagFeil}</Varsel>}
                  </div>
                )}

                {fetching && (
                  <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
                    {["55%", "35%", "70%"].map((b, i) => (
                      <span key={b} style={{ height: i ? 12 : 18, width: b, borderRadius: 4, background: "#ecedea", animation: `rkShimmer 1.1s ease-in-out ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                )}

                {car && !fetching && (
                  <>
                    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden", animation: pop(0) }}>
                      <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10, borderBottom: "1px solid #eeeeeb" }}>
                        <Skilt regnr={car.k.regnr} />
                        <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{carName}</span>
                        {car.k.ar && <span style={{ fontSize: 14, color: "#5f6468" }}>{car.k.ar}</span>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
                        {carRows.map((c, i) => (
                          <div key={c.k} style={{ padding: "14px 22px", display: "flex", flexDirection: "column", gap: 3, animation: pop(i + 1) }}>
                            <span style={{ fontSize: 12, color: "#5f6468" }}>{c.k}</span>
                            <span style={{ fontSize: 14.5, fontWeight: 500 }}>{c.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Radiovalg
                      id="stemmer"
                      sporsmal="Stemmer dette?"
                      valg={STEMMER}
                      valgt={bilBekreftet}
                      velg={(v) => {
                        if (v === "ja") return setBilBekreftet("ja");
                        setCar(null);
                        setRegnr("");
                        setBilBekreftet(null);
                      }}
                    />
                  </>
                )}
              </div>
            )}

            {step === KJOPET && (
              <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 28 }}>
                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={OVERLINE}>{overline("Kjøpet")}</span>
                  <h1 style={H1}>Om kjøpet</h1>
                </header>
                <section id="felt-kjopsdato" style={{ display: "flex", flexDirection: "column", gap: 8, animation: pop(0) }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Når overtok du bilen?</h2>
                  <Datovelger etikett="Kjøpsdato" verdi={kjopsdato} maks={idag} sett={setKjopsdato} />
                  <span style={{ fontSize: 13, lineHeight: 1.55, color: "#5f6468" }}>
                    Fristene regnes fra denne datoen.{car?.eierFra ? " Foreslått ut fra når bilen sist ble omregistrert." : ""}
                  </span>
                  {erDato(kjopsdato) && !ute && kjopsdato < aarSiden(2) && <Fristvarsel v={lovversjon(kjopsdato)}>{OVER_TO_AAR_KJOP}</Fristvarsel>}
                  <Merknader stopp={kjopStopp} advarsler={merkR("kjopsdato").advarsler} />
                </section>
                <section id="felt-kjopesum" style={{ display: "flex", flexDirection: "column", gap: 12, animation: pop(1) }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
                    <Tallfelt etikett="Km ved kjøp" hjelp="Står i kjøpekontrakten." enhet="km" verdi={km} sett={setKm} maks={7} />
                    <Tallfelt etikett="Kjøpesum" hjelp="Det du betalte for bilen." enhet="kr" verdi={kjopesum} sett={setKjopesum} maks={8} />
                  </div>
                  <Merknader {...merkR("kjopesum")} />
                </section>
                <section id="felt-somDenEr" style={{ display: "flex", flexDirection: "column", gap: 12, animation: pop(2) }}>
                  <Radiovalg id="som-den-er" sporsmal="Står det «som den er» eller lignende i kontrakten eller annonsen?" valg={SOM_DEN_ER} valgt={somDenEr} velg={setSomDenEr} min={120} />
                  {somDenErGammel({ kjopsdato, km: Number(km) || null, ar: car?.k.ar ?? null, somDenEr }) && <Varsel type="advarsel">{SOM_DEN_ER_GAMMEL}</Varsel>}
                </section>
              </div>
            )}

            {step === FEILEN && (
              <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 28 }}>
                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={OVERLINE}>{overline("Feilen")}</span>
                  <h1 style={H1}>Hva er galt med bilen?</h1>
                  <p style={INGRESS}>Velg ett eller flere områder, og deretter feilene du har lagt merke til.</p>
                </header>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
                  {HOVEDKATEGORIER.map((o, i) => {
                    const sel = o.id in valg;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => toggleCat(o.id)}
                        className="rk-kat"
                        style={{ ...KNAPP, display: "flex", flexDirection: "column", gap: 18, padding: "14px 14px 16px", borderRadius: 12, border: `1.5px solid ${sel ? A : LINE}`, background: sel ? AS : "#fff", transition: "border-color .2s,background .2s,transform .15s,box-shadow .2s", animation: pop(i) }}
                      >
                        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ font: `500 11px ${MONO}`, color: "#8a8f93" }}>{o.kode}</span>
                          <span style={{ width: 18, height: 18, boxSizing: "border-box", borderRadius: 5, border: `1.5px solid ${sel ? A : "#b4b8bc"}`, background: sel ? A : "#fff", display: "grid", placeItems: "center", transition: "all .2s" }}>{sel && <Hake />}</span>
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{o.navn}</span>
                      </button>
                    );
                  })}
                </div>
                {valgte
                  .filter((h) => h.under.length)
                  .map((h) => (
                    <section key={h.id} aria-label={`${h.navn}: hva gjelder feilen?`} style={{ display: "flex", flexDirection: "column", gap: 12, animation: pop(0) }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>
                        {h.navn} <span style={{ fontWeight: 400, color: "#5f6468" }}>– hva gjelder feilen? (valgfritt)</span>
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {h.under.map((u) => {
                          const sel = valg[h.id].includes(u.id);
                          return (
                            <button key={u.id} type="button" aria-pressed={sel} onClick={() => toggleSub(h.id, u.id)} className="rk-chip" style={chip(sel)}>
                              {u.navn}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                {valgte.length > 0 && (
                  <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Når oppdaget du {valgte.length > 1 ? "hver feil" : "feilen"}?</h2>
                    {valgte.map((h, i) => {
                      const d = detaljer[h.id] ?? {};
                      const under = h.under.filter((u) => valg[h.id].includes(u.id)).map((u) => u.navn);
                      const oppdaget = merk("oppdaget", h.id);
                      const slitedel = erDato(d.oppdaget) && erDato(kjopsdato) ? slitedelGrunn(kjopsdato, { hoved: h.id, under: valg[h.id], oppdaget: d.oppdaget }) : null;
                      return (
                        <div key={h.id} id={`felt-oppdaget-${h.id}`} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, animation: pop(i) }}>
                          <span style={{ fontSize: 15, fontWeight: 600 }}>
                            {h.navn}
                            {under.length > 0 && <span style={{ fontWeight: 400, color: "#5f6468" }}> · {under.join(", ")}</span>}
                          </span>
                          <span style={{ fontSize: 13.5, color: "#5f6468" }}>Dagen du først merket feilen. Vet du ikke dagen, velg omtrent og kryss av for omtrentlig.</span>
                          <Datovelger etikett={`Når oppdaget du ${h.navn}?`} verdi={d.oppdaget ?? ""} min={kjopsdato ? dagEtter(kjopsdato) : undefined} maks={idag} sett={(dato) => settDetalj(h.id, { oppdaget: dato, bekreftet: false })} />
                          {erDato(d.oppdaget) && erDato(kjopsdato) && d.oppdaget > kjopsdato && <span style={{ fontSize: 13, lineHeight: 1.55, color: "#5f6468" }}>{tidEtter(kjopsdato, d.oppdaget)}</span>}
                          <Avkrysning valgt={!!d.omtrentlig} velg={() => settDetalj(h.id, { omtrentlig: !d.omtrentlig, bekreftet: false })}>
                            Datoen er omtrentlig
                          </Avkrysning>
                          <Merknader stopp={oppdaget.stopp} advarsler={[...oppdaget.advarsler, ...(slitedel ? [{ melding: slitedel.tekst }] : [])]} />
                          {tidslinje.advarsler.some((m) => m.feilId === h.id && m.felt === "oppdaget" && m.bekreft) && (
                            <Avkrysning valgt={!!d.bekreftet} velg={() => settDetalj(h.id, { bekreftet: !d.bekreftet })}>
                              Jeg har sjekket datoen, og den stemmer
                            </Avkrysning>
                          )}
                        </div>
                      );
                    })}
                    {tidslinje.avledet.some((a) => a.tidsnivaa === 3) && <Fristvarsel v={lovversjon(kjopsdato)}>{OVER_TO_AAR_FEIL}</Fristvarsel>}
                  </section>
                )}
              </div>
            )}

            {step === VURDERING && (
              <div style={{ animation: stepAnim }}>
                {visUte ? (
                  <Vurderingsvisning v={{ status: "ute", grunner: [], lovversjon: lovversjon(kjopsdato), lovlinjer: [], tall: [], kort: [], niva: null, poeng: [], sammenligning: null }} kjopsdato={kjopsdato} fortsett={() => {}} endreKjopsdato={() => go(KJOPET)} steg="Vurdering" />
                ) : !vurdering && !vurderingFeil ? (
                  <Venter overline={overline("Vurdering")} tittel="Vi ser på saken din" tekst="Vi sammenligner svarene dine med loven og med vedtakene fra Forbrukerklageutvalget." anim={stepAnim} bred={isDesktop} />
                ) : vurderingFeil ? (
                  <Feilmelding tittel="Vi fikk ikke laget vurderingen" melding={vurderingFeil} igjen={() => provIgjen(vurder)} anim={stepAnim} />
                ) : (
                  vurdering && (
                    <Vurderingsvisning
                      v={vurdering}
                      kjopsdato={kjopsdato}
                      steg={`Steg 4 av ${FOR_BETALING} · Gratis vurdering`}
                      endreKjopsdato={() => go(KJOPET)}
                      fortsett={() => {
                        maal("fortsett_klikket", { status: vurdering.status });
                        go(DETALJER);
                      }}
                    />
                  )
                )}
              </div>
            )}

            {step === DETALJER && sideFeil && (() => {
              const h = sideFeil;
              const d = detaljer[h.id] ?? {};
              const r = d.rapport ?? TOM_RAPPORT;
              const i = valgte.indexOf(h);
              // A report already filled in for an earlier defect, to copy.
              const forrige = valgte
                .slice(0, i)
                .reverse()
                .filter((x) => detaljer[x.id]?.verksted === "skriftlig")
                .map((x) => detaljer[x.id]?.rapport)
                .find((x) => x?.hvem && x.navn.trim() && x.dato);
              // The warning that a defect the seller told of is usually excepted, on the pages where the seller did.
              const sierFeilen = !!d.opplysning && d.opplysning !== "nei" && (!teknisk(h.id) || d.opplyst === "feilen");
              const sdeOpplyst = sierFeilen ? riktighet.advarsler.filter((m) => m.regel === "som_den_er_opplyst") : [];
              const opplystValg: OpplystValg | undefined = d.opplysning === "nei" ? "ingenting" : d.opplyst;
              return (
                <div key={h.id} style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 28 }}>
                  <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <span style={OVERLINE}>{overline(valgte.length > 1 ? `Feil ${i + 1} av ${valgte.length}` : h.navn)}</span>
                    <h1 style={H1}>Litt mer om feilen</h1>
                    {valgte.length > 1 && <p style={INGRESS}>{[h.navn, ...h.under.filter((u) => valg[h.id].includes(u.id)).map((u) => u.navn)].join(" · ")}</p>}
                  </header>
                  <section id="felt-rapport" style={{ display: "flex", flexDirection: "column", gap: 14, animation: pop(0) }}>
                    <Radiovalg id={`verksted-${h.id}`} sporsmal="Er feilen undersøkt av et verksted?" valg={VERKSTED_VALG} valgt={d.verksted} velg={(k) => settDetalj(h.id, { verksted: k })} min={200} />
                    {d.verksted === "skriftlig" && (
                      <fieldset style={{ margin: 0, minWidth: 0, border: `1px solid ${LINE}`, borderRadius: 12, padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 20, background: "#fafaf8", animation: pop(0) }}>
                        <legend style={{ padding: "0 6px", fontSize: 14, fontWeight: 600 }}>Rapporten fra verkstedet</legend>
                        {forrige && (
                          <button type="button" onClick={() => kopierRapport(h.id, forrige)} className="rk-chip" style={{ ...chip(false), alignSelf: "flex-start" }}>
                            Samme rapport som forrige feil
                          </button>
                        )}
                        <Chipvalg sporsmal="Hvem undersøkte bilen?" etikett={`Hvem undersøkte ${h.navn}?`} valg={VERKSTED_HVEM} valgt={r.hvem} velg={(x) => settRapport(h.id, { hvem: x })} />
                        <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, fontWeight: 600 }}>
                          Verkstedets navn
                          <input
                            value={r.navn}
                            onChange={(e) => settRapport(h.id, { navn: e.target.value })}
                            maxLength={MAKS_VERKSTEDNAVN}
                            autoComplete="off"
                            className="rk-input"
                            style={{ height: 48, border: `1.5px solid ${LINE}`, borderRadius: 10, padding: "0 14px", font: `400 15px ${SANS}`, color: INK, outline: "none", background: "#fff" }}
                          />
                        </label>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>Dato for rapporten</span>
                          <Datovelger etikett={`Dato for rapporten om ${h.navn}`} verdi={r.dato} min={kjopsdato ? dagEtter(kjopsdato) : undefined} maks={idag} sett={(dato) => settRapport(h.id, { dato })} />
                          <Merknader {...(r.dato && !etterKjop(r.dato) && !merk("rapport", h.id).stopp.length ? { stopp: [{ melding: "Datoen må ligge etter kjøpsdatoen og ikke i fremtiden." }] } : merk("rapport", h.id))} />
                        </div>
                        <div role="group" aria-label={`Hva sier rapporten om ${h.navn}?`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>Hva sier rapporten?</span>
                          <span style={{ fontSize: 13.5, color: "#5f6468", lineHeight: 1.5 }}>Kryss bare av det rapporten faktisk sier. Forhandleren kan be om å få se den.</span>
                          {RAPPORT_PUNKTER.map((p) => (
                            <Avkrysning key={p.id} valgt={r.punkter.includes(p.id)} velg={() => settRapport(h.id, { punkter: r.punkter.includes(p.id) ? r.punkter.filter((x) => x !== p.id) : [...r.punkter, p.id] })}>
                              {p.skjema}
                            </Avkrysning>
                          ))}
                        </div>
                        {r.punkter.includes("overslag") && (
                          <div style={{ maxWidth: 320 }}>
                            <Tallfelt etikett="Kostnadsoverslag for utbedring" hjelp="Beløpet rapporten oppgir. Valgfritt." enhet="kr" verdi={r.overslag} sett={(overslag) => settRapport(h.id, { overslag })} maks={7} />
                          </div>
                        )}
                        <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, fontWeight: 600 }}>
                          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span>
                              Rapportens konklusjon, ordrett <span style={{ fontWeight: 400, color: "#5f6468" }}>(valgfritt)</span>
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 400, color: "#5f6468" }}>Skriv av rapportens konklusjon ordrett, gjerne én til tre setninger. Legg ved rapporten når du sender brevet.</span>
                          </span>
                          <textarea
                            value={r.konklusjon}
                            onChange={(e) => settRapport(h.id, { konklusjon: e.target.value })}
                            maxLength={MAKS_KONKLUSJON}
                            rows={4}
                            className="rk-input"
                            style={{ border: `1.5px solid ${LINE}`, borderRadius: 10, padding: "12px 14px", font: `400 15px/1.5 ${SANS}`, color: INK, outline: "none", background: "#fff", resize: "vertical" }}
                          />
                          <Merknader {...merkR("konklusjon", h.id)} />
                        </label>
                      </fieldset>
                    )}
                  </section>
                  <section id="felt-opplysning" style={{ display: "flex", flexDirection: "column", gap: 12, animation: pop(1) }}>
                    {teknisk(h.id) ? (
                      <>
                        {/* What the seller said, which decides whether it helps (in order) or weakens (told of the defect), then how. */}
                        <Radiovalg
                          id={`opplysning-${h.id}`}
                          sporsmal="Sa selger noe om denne feilen før kjøpet?"
                          hjelp="For eksempel i annonsen, kontrakten eller en melding."
                          valg={OPPLYST_VALG}
                          valgt={opplystValg}
                          velg={(k) => settDetalj(h.id, k === "ingenting" ? { opplysning: "nei", opplyst: undefined } : { opplyst: k, opplysning: d.opplysning === "nei" ? undefined : d.opplysning })}
                          min={200}
                        />
                        {d.opplyst && d.opplysning !== "nei" && <Chipvalg sporsmal="Hvordan sa selger det?" etikett={`Hvordan sa selger det om ${h.navn}?`} valg={HVORDAN} valgt={d.opplysning} velg={(k) => settDetalj(h.id, { opplysning: k })} />}
                      </>
                    ) : (
                      <Radiovalg id={`opplysning-${h.id}`} sporsmal="Sa selger noe om denne feilen før kjøpet?" hjelp="For eksempel i annonsen, kontrakten eller en melding." valg={OPPLYSNING_VALG} valgt={d.opplysning} velg={(k) => settDetalj(h.id, { opplysning: k })} min={96} />
                    )}
                    <Merknader stopp={merkR("opplysning", h.id).stopp} advarsler={[...merkR("opplysning", h.id).advarsler, ...sdeOpplyst]} />
                  </section>
                  <label id="felt-beskrivelse" style={{ display: "flex", flexDirection: "column", gap: 8, animation: pop(2) }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>Beskriv feilen med egne ord</span>
                      <span style={{ fontSize: 13.5, color: "#5f6468" }}>Valgfritt. Teksten brukes i brevet.</span>
                    </span>
                    <textarea
                      value={d.beskrivelse ?? ""}
                      onChange={(e) => settDetalj(h.id, { beskrivelse: e.target.value })}
                      maxLength={MAKS_BESKRIVELSE}
                      rows={3}
                      placeholder="Feilen er at …"
                      className="rk-input"
                      style={{ border: `1.5px solid ${LINE}`, borderRadius: 10, padding: "12px 14px", font: `400 15px/1.5 ${SANS}`, color: INK, outline: "none", background: "#fff", resize: "vertical" }}
                    />
                    <Merknader {...merkR("beskrivelse", h.id)} />
                  </label>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#8a8f93" }}>Tjenesten gir ikke juridisk rådgivning. Brevet bygges av dine svar, og du er ansvarlig for at de stemmer.</p>
                </div>
              );
            })()}

            {step === KRAVSTEG && (
              <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 32 }}>
                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={OVERLINE}>{overline("Krav og selger")}</span>
                  <h1 style={H1}>Hva krever du, og av hvem?</h1>
                </header>
                <section id="felt-krav" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <h2 id="krav-sporsmal" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                    Hva krever du av forhandleren?
                  </h2>
                  <div role="radiogroup" aria-labelledby="krav-sporsmal" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 10 }}>
                    {KRAV.map((o, i) => (
                      <button key={o.id} type="button" role="radio" aria-checked={krav === o.id} onClick={() => setKrav(o.id)} className="rk-kat" style={{ ...kort(krav === o.id, pop(i)), borderRadius: 12, display: "flex", flexDirection: "column", gap: 8, padding: "16px 18px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Radiomerke valgt={krav === o.id} />
                          <span style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>{o.navn}</span>
                          {o.merke && <span style={{ font: `600 10.5px ${MONO}`, letterSpacing: ".05em", textTransform: "uppercase", color: A, background: "oklch(0.94 0.03 255)", padding: "3px 7px", borderRadius: 5 }}>{o.merke}</span>}
                        </span>
                        <span style={{ fontSize: 14, lineHeight: 1.5, color: "#5f6468", paddingLeft: 30, textWrap: "pretty" }}>{o.tekst}</span>
                      </button>
                    ))}
                  </div>
                  <Merknader stopp={[...merkR("krav").stopp, ...merkR("kategori").stopp]} advarsler={[...merkR("krav").advarsler, ...merkR("kategori").advarsler]} />
                </section>

                <section id="felt-kontakt" aria-labelledby="kontakt-med-selger" style={{ display: "flex", flexDirection: "column", gap: 18, animation: pop(3) }}>
                  <h2 id="kontakt-med-selger" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                    Har du tatt opp feilen med forhandleren?
                  </h2>
                  <Chipvalg sporsmal="Har du reklamert til selger?" valg={JA_NEI} valgt={reklamert} velg={velgReklamert} />
                  {reklamert === "nei" && <p style={{ margin: 0, fontSize: 14, color: "#5f6468", animation: pop(0) }}>Da er dette brevet selve reklamasjonen.</p>}
                  {reklamert === "ja" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: pop(0) }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>Når reklamerte du første gang?</span>
                        <Datovelger etikett="Dato for første reklamasjon" verdi={reklamertDato} min={kjopsdato ? dagEtter(kjopsdato) : undefined} maks={idag} sett={setReklamertDato} />
                        <Merknader {...(reklamertDato && !etterKjop(reklamertDato) && !merk("reklamert").stopp.length ? { stopp: [{ melding: "Datoen må ligge etter kjøpsdatoen og ikke i fremtiden." }] } : merk("reklamert"))} />
                      </div>
                      <Chipvalg sporsmal="Hvordan?" etikett="Hvordan reklamerte du?" valg={HVORDAN} valgt={reklamertForm} velg={setReklamertForm} />
                      <Chipvalg sporsmal="Hva har selger gjort?" valg={SELGER_SVAR} valgt={selgerSvar} velg={setSelgerSvar} />
                      {selgerSvar === "forsokt" && (
                        <div style={{ animation: pop(0) }}>
                          <Chipvalg sporsmal="Hvor mange ganger?" etikett="Hvor mange ganger har selger forsøkt å rette?" valg={RETTINGSFORSOK.filter((o) => o.id > 0)} valgt={forsok} velg={setForsok} />
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section id="felt-utlegg" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <button type="button" role="checkbox" aria-checked={kreverUtlegg} onClick={() => setKreverUtlegg(!kreverUtlegg)} style={{ ...kort(kreverUtlegg, pop(5)), borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px" }}>
                    <span style={{ width: 18, height: 18, flex: "none", marginTop: 1, boxSizing: "border-box", borderRadius: 5, border: `1.5px solid ${kreverUtlegg ? A : "#b4b8bc"}`, background: kreverUtlegg ? A : "#fff", display: "grid", placeItems: "center", transition: "all .2s" }}>
                      {kreverUtlegg && <Hake />}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>Jeg krever i tillegg erstatning for utlegg</span>
                      <span style={{ fontSize: 14, color: "#5f6468", lineHeight: 1.5 }}>For eksempel tauing, feilsøking eller leiebil.</span>
                    </span>
                  </button>
                  {kreverUtlegg && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: pop(0) }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {UTLEGG_FORSLAG.map((l, i) => (
                          <button key={l} type="button" onClick={() => setUtlegg((u) => [...u, { beskrivelse: l, belop: "" }])} className="rk-chip rk-forslag" style={{ ...chip(false), display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", animation: pop(i) }}>
                            <span style={{ color: A, fontWeight: 600 }}>+</span>
                            {l}
                          </button>
                        ))}
                      </div>
                      {utlegg.length > 0 && (
                        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden" }}>
                          {utlegg.map((x, i) => (
                            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderTop: i ? "1px solid #eeeeeb" : "none" }}>
                              <input
                                value={x.beskrivelse}
                                onChange={(e) => settUtlegg(i, { beskrivelse: e.target.value })}
                                placeholder="Beskrivelse"
                                aria-label="Beskrivelse av utlegget"
                                maxLength={100}
                                className="rk-input"
                                style={{ flex: 1, minWidth: 0, height: 44, border: `1.5px solid ${LINE}`, borderRadius: 9, padding: "0 12px", font: `15px ${SANS}`, color: INK, outline: "none", background: "#fff" }}
                              />
                              <span className="rk-felt" style={{ display: "flex", alignItems: "center", width: 128, flex: "none", height: 44, border: `1.5px solid ${LINE}`, borderRadius: 9, background: "#fff", overflow: "hidden", boxSizing: "border-box" }}>
                                <input
                                  value={tall(x.belop)}
                                  onChange={(e) => settUtlegg(i, { belop: kunSifre(e.target.value, 7) })}
                                  inputMode="numeric"
                                  placeholder="0"
                                  aria-label="Beløp"
                                  style={{ flex: 1, minWidth: 0, border: "none", outline: "none", padding: "0 4px 0 12px", font: `500 15px ${MONO}`, textAlign: "right", color: INK, background: "transparent" }}
                                />
                                <span style={{ padding: "0 12px 0 4px", fontSize: 13, color: "#5f6468" }}>kr</span>
                              </span>
                              <button type="button" onClick={() => setUtlegg((u) => u.filter((_, j) => j !== i))} aria-label="Fjern" className="rk-tilbake" style={{ ...KNAPP, width: 32, height: 32, flex: "none", borderRadius: 8, display: "grid", placeItems: "center", color: "#8a8f93", fontSize: 18 }}>
                                ×
                              </button>
                            </div>
                          ))}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "#f8f8f6", borderTop: "1px solid #eeeeeb" }}>
                            <button type="button" onClick={() => setUtlegg((u) => [...u, { beskrivelse: "", belop: "" }])} style={{ ...KNAPP, fontSize: 14, fontWeight: 600, color: A }}>
                              + Legg til annet utlegg
                            </button>
                            <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                              <span style={{ fontSize: 13, color: "#5f6468" }}>Sum</span>
                              <span style={{ font: `600 16px ${MONO}` }}>{tall(String(utleggSum))} kr</span>
                            </span>
                          </div>
                        </div>
                      )}
                      <Varsel type="info">Husk å legge ved kopi av fakturaer og kvitteringer. Vedleggene listes opp i brevet.</Varsel>
                    </div>
                  )}
                  <Merknader {...(utleggOk ? merkR("utlegg") : { stopp: [{ melding: "Fyll ut beskrivelse og beløp for hvert utlegg." }], advarsler: merkR("utlegg").advarsler })} />
                </section>

                <section id="felt-selger" style={{ display: "flex", flexDirection: "column", gap: 10, animation: pop(6) }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Hvem solgte bilen?</h2>
                    <span style={{ fontSize: 13.5, lineHeight: 1.45, color: "#5f6468" }}>Søk i Brønnøysundregistrene på navnet eller org.nr. fra kjøpekontrakten. Brevet adresseres til selgeren slik Enhetsregisteret oppgir den.</span>
                  </div>
                  <Selgervalg valgt={selger} velg={setSelger} />
                  <Merknader {...merkR("selger")} />
                </section>
              </div>
            )}

            {step === FORHAND &&
              // Waiting until there is a preview or an error, not while the transition is pending: it stays
              // pending as long as a hanging server action does.
              (!forhand && !(funn && !funn.ok)
                ? <Venter overline={overline("Forhåndsvisning")} tittel="Vent mens vi lager brevet" tekst="Vi velger vedtaket brevet skal vise til, og setter sammen brevet. Det tar noen sekunder." anim={stepAnim} bred={isDesktop} />
                : (funn && !funn.ok) || (forhand && !forhand.ok)
                  ? <Feilmelding tittel="Vi fikk ikke laget brevet" melding={funn && !funn.ok ? funn.melding : forhand && !forhand.ok ? forhand.melding : ""} igjen={() => provIgjen(lagBrev)} anim={stepAnim} />
                  : forhand?.ok && (
                      <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 28 }}>
                        <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <span style={OVERLINE}>{overline("Forhåndsvisning")}</span>
                          <h1 style={H1}>Slik blir brevet ditt</h1>
                          <p style={INGRESS}>Sakens bakgrunn og starten på vedtaksavsnittet vises nå. Resten låses opp når du har betalt.</p>
                        </header>
                        {alleAdvarsler.length > 0 && (
                          <section aria-label="Advarsler" data-advarsler>
                            <Varsel
                              type="advarsel"
                              tittel={
                                <>
                                  Brevet har {alleAdvarsler.length} {alleAdvarsler.length === 1 ? "advarsel" : "advarsler"}
                                  {datoadvarsler ? (datoadvarsler === alleAdvarsler.length ? " om datoer" : `, ${datoadvarsler} av dem om datoer`) : ""}. Se over før du betaler.
                                </>
                              }
                            >
                              {alleAdvarsler.map((m, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                  <span style={{ flex: 1 }}>{m.melding}</span>
                                  <button type="button" onClick={() => gaaTil(m)} style={{ ...KNAPP, fontSize: 14, fontWeight: 600, color: A, whiteSpace: "nowrap" }}>
                                    Endre
                                  </button>
                                </div>
                              ))}
                            </Varsel>
                          </section>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: toKolonner ? "minmax(0,1fr) 320px" : "minmax(0,1fr)", gap: toKolonner ? 40 : 24, alignItems: "start" }}>
                          <Brevvisning brev={forhand.brev} bred={false} />
                          <div data-betaling style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 16, position: toKolonner ? "sticky" : undefined, top: 0 }}>
                            <h2 style={H2}>Lås opp hele brevet</h2>
                            {car && (
                              <div style={{ background: "#f6f6f4", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                                <span style={OVERLINE}>Brevet skrives for</span>
                                <Skilt regnr={car.k.regnr} />
                                <span style={{ fontSize: 15, fontWeight: 600 }}>
                                  {carName}
                                  {car.k.ar && <span style={{ fontWeight: 400, color: "#5f6468" }}> · {car.k.ar}</span>}
                                </span>
                                <span style={{ fontSize: 13, lineHeight: 1.5, color: "#5f6468" }}>Bilen kan ikke byttes etter kjøpet. Er det feil bil, endrer du svarene først.</span>
                              </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <Punkt>{funn?.ok && funn.vedtak?.saksnummer ? `Hele brevet, med ordrette sitater og lenke til vedtak ${funn.vedtak.saksnummer.replace(/^FKU-\d{4}-(\d+)(?:-\d+)?$/, "$1")}` : "Hele brevet"}</Punkt>
                              <Punkt>Rettslig vurdering, krav og frist for svar</Punkt>
                              <Punkt>Word-fil og kopierbar tekst</Punkt>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid #eeeeeb", paddingTop: 14 }}>
                              <span style={{ fontSize: 14, color: "#5f6468" }}>Totalt</span>
                              <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{PRIS} kr</span>
                            </div>
                            {forhand.betalingIUtvikling ? (
                              <button type="button" onClick={betal} style={storKnapp("vipps")}>
                                Betal med Vipps
                              </button>
                            ) : (
                              <>
                                <button type="button" disabled style={storKnapp("av")}>
                                  Betal med Vipps (kommer)
                                </button>
                                <button type="button" disabled style={{ ...storKnapp("kant"), color: "#8a8f93", cursor: "not-allowed" }}>
                                  Betal med kort (kommer)
                                </button>
                              </>
                            )}
                            <span style={{ fontSize: 13, lineHeight: 1.55, color: "#5f6468" }}>Engangsbeløp, ingen abonnement.</span>
                          </div>
                        </div>
                        <details style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "14px 18px" }}>
                          <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 600 }}>Se over opplysningene i brevet</summary>
                          <table aria-label="Opplysningene i brevet" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5, marginTop: 12 }}>
                            <tbody>
                              {[
                                { navn: "Bil", verdi: car ? `${carName}, ${car.k.regnr}` : "", m: { felt: "bil", regel: "" } },
                                { navn: "Kjøpsdato", verdi: erDato(kjopsdato) ? datoTekst(kjopsdato) : "", m: { felt: "kjopsdato", regel: "" } },
                                { navn: "Kilometerstand", verdi: km ? `${tall(km)} km` : "", m: { felt: "kjopesum", regel: "" } },
                                { navn: "Kjøpesum", verdi: kjopesum ? `${tall(kjopesum)} kr` : "", m: { felt: "kjopesum", regel: "" } },
                                { navn: "«Som den er»", verdi: SOM_DEN_ER.find((o) => o.id === somDenEr)?.navn ?? "", m: { felt: "somDenEr", regel: "" } },
                                ...valgte.map((h) => {
                                  const d = detaljer[h.id] ?? {};
                                  const r = d.rapport;
                                  return {
                                    navn: h.navn,
                                    m: { felt: "rapport", feilId: h.id, regel: "" },
                                    verdi: [
                                      h.under.filter((u) => valg[h.id]?.includes(u.id)).map((u) => u.navn).join(", "),
                                      d.oppdaget && erDato(d.oppdaget) ? `Oppdaget ${d.omtrentlig ? "omtrent " : ""}${datoTekst(d.oppdaget)}` : "",
                                      d.verksted === "skriftlig" && r ? `Rapport fra ${r.navn}${erDato(r.dato) ? ` ${datoTekst(r.dato)}` : ""}` : d.verksted === "muntlig" ? "Undersøkt av verksted, uten rapport" : "Ikke undersøkt av verksted",
                                      teknisk(h.id) && d.opplysning !== "nei"
                                        ? `${OPPLYST_VALG.find((k) => k.id === d.opplyst)?.navn ?? "Selger sa: –"}${d.opplysning ? ` (${d.opplysning})` : ""}`
                                        : `Selger sa: ${OPPLYSNING_VALG.find((k) => k.id === d.opplysning)?.navn.toLowerCase() ?? "–"}`,
                                    ]
                                      .filter(Boolean)
                                      .join(" · "),
                                  };
                                }),
                                {
                                  navn: "Reklamasjon",
                                  m: { felt: "reklamert", regel: "" },
                                  verdi:
                                    reklamert === "ja"
                                      ? `${erDato(reklamertDato) ? datoTekst(reklamertDato) : ""}, ${reklamertForm ?? ""}. Selger: ${SELGER_SVAR.find((o) => o.id === selgerSvar)?.navn.toLowerCase() ?? "–"}${selgerSvar === "forsokt" ? `, ${RETTINGSFORSOK.find((o) => o.id === forsok)?.navn ?? "–"}` : ""}`
                                      : "Nei. Dette brevet er reklamasjonen.",
                                },
                                { navn: "Krav", verdi: KRAV.find((k) => k.id === krav)?.navn ?? "", m: { felt: "krav", regel: "" } },
                                { navn: "Utlegg", verdi: kreverUtlegg ? `${utlegg.map((u) => `${u.beskrivelse} ${tall(u.belop)} kr`).join(", ")} (til sammen ${tall(String(utleggSum))} kr)` : "Ingen", m: { felt: "utlegg", regel: "" } },
                                { navn: "Selger", verdi: selger ? `${selger.navn}, org.nr. ${orgnrTekst(selger.orgnr)}` : "", m: { felt: "selger", regel: "" } },
                              ].map((rad, i) => (
                                <tr key={i} style={{ borderTop: i ? "1px solid #eeeeeb" : "none" }}>
                                  <th scope="row" style={{ textAlign: "left", verticalAlign: "top", padding: "12px 10px 12px 0", fontWeight: 600, width: isDesktop ? 150 : 100 }}>
                                    {rad.navn}
                                  </th>
                                  <td style={{ verticalAlign: "top", padding: "12px 4px", color: "#2c3033", lineHeight: 1.5, textWrap: "pretty" }}>{rad.verdi}</td>
                                  <td style={{ verticalAlign: "top", padding: "12px 0 12px 10px", textAlign: "right" }}>
                                    <button type="button" onClick={() => gaaTil(rad.m)} style={{ ...KNAPP, fontSize: 14, fontWeight: 600, color: A }}>
                                      Endre
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      </div>
                    ))}

            {step === BREVET &&
              (!heltBrev
                ? <Venter overline="Brevet" tittel="Vent mens vi lager brevet" tekst="Hele brevet settes sammen med vedtaket fra forhåndsvisningen." anim={stepAnim} bred={isDesktop} />
                : !heltBrev.ok
                  ? <Feilmelding tittel="Vi fikk ikke laget brevet" melding={heltBrev.melding} igjen={() => provIgjen(betal)} anim={stepAnim} />
                  : !heltBrev.fullt
                    ? <Feilmelding tittel="Betalingen er ikke bekreftet" melding="Vi fant ingen bekreftet betaling for brevet. Gå tilbake til forhåndsvisningen og prøv igjen." igjen={() => go(FORHAND)} anim={stepAnim} />
                    : (
                      <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 28 }}>
                        <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: "50%", background: A, display: "grid", placeItems: "center" }}>
                            <svg width="20" height="20" viewBox="0 0 12 12">
                              <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                          <span style={OVERLINE}>Ferdig · Reklamasjonsbrev</span>
                          <h1 style={H1}>Brevet er klart</h1>
                          <p style={INGRESS}>Send det selv til {selger?.navn ?? "selgeren"}, for eksempel som e-post eller rekommandert post. Ta vare på en kopi.</p>
                        </header>
                        <div style={{ display: "grid", gridTemplateColumns: toKolonner ? "minmax(0,1fr) 320px" : "minmax(0,1fr)", gap: toKolonner ? 40 : 24, alignItems: "start" }}>
                          <div style={{ order: toKolonner ? 0 : 1 }}>
                            <Brevvisning brev={heltBrev.brev} bred={false} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, position: toKolonner ? "sticky" : undefined, top: 0 }}>
                            <button type="button" onClick={() => lastNed(heltBrev.brev)} className="rk-neste" style={storKnapp("aksent")}>
                              Last ned Word
                            </button>
                            <button type="button" onClick={() => kopier(heltBrev.brev)} className="rk-tilbake" style={storKnapp("kant")}>
                              {kopiert ? "Kopiert" : "Kopier tekst"}
                            </button>
                            {heltBrev.brev.vedlegg && <span style={{ fontSize: 13, lineHeight: 1.55, color: "#5f6468" }}>Legg ved vedleggene som står nederst i brevet når du sender det.</span>}
                          </div>
                        </div>
                      </div>
                    ))}
          </div>
        </div>

        {step !== BREVET && (
          <div style={{ background: "#fff", borderTop: `1px solid ${LINE}`, padding: isDesktop ? "14px 40px" : "14px 20px" }}>
            <div style={{ maxWidth: toKolonner ? 960 : 760, margin: "0 auto", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
              <button type="button" onClick={tilbake} className="rk-tilbake" style={{ ...KNAPP, height: 50, padding: "0 18px", borderRadius: 10, fontSize: 15, fontWeight: 600, color: INK, opacity: step === BILEN ? 0 : 1, pointerEvents: step === BILEN ? "none" : undefined, transition: "opacity .2s,background .2s" }}>
                Tilbake
              </button>
              {harNeste && (
                <button
                  type="button"
                  onClick={neste}
                  className="rk-neste"
                  style={{ ...KNAPP, height: 50, padding: "0 26px", borderRadius: 10, fontSize: 15, fontWeight: 600, color: "#fff", background: ok ? A : "#c4c7ca", cursor: ok ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flex: isDesktop ? "0 0 auto" : "1", transition: "background .25s,transform .15s" }}
                >
                  {nesteTekst}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

