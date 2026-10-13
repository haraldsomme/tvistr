"use client";

// The buyer's form, ported from the mockup (ReklamasjonSkjema.dc.html): the same
// markup, inline styles and animations. The keyframes and the hover/active rules the mockup set with
// style-hover/style-active live in globals.css under `.rk`. «Lag brev» finds the decision the letter
// cites (finnVedtak) and builds the letter (byggBrevet, src/lib/brev/); step 5 shows it.
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { nb } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type Forslag, tittel as tittelNavn } from "@/lib/brreg";
import { type Linje, somTekst, tilDokument } from "@/lib/brev/brev";
import type { Brev } from "@/lib/brev/typer";
import { type Kjoretoy, normaliserRegnr } from "@/lib/kjoretoy/vegvesen";
import { type Feilvalg, HOVEDKATEGORIER, rensFeilvalg, rensTidsvalg, type Tidsvalg, VISTE_SEG_VALG, type VisteSegValg } from "@/lib/feil/kategorier";
import { type BrevResultat, byggBrevet, type Funn, finnVedtak } from "./actions";

const A = "oklch(0.47 0.12 255)",
  AS = "oklch(0.965 0.018 255)",
  LINE = "#e2e3e0",
  INK = "#16181a";
const SANS = "var(--font-instrument), system-ui, sans-serif";
const MONO = "var(--font-jbmono), monospace";
const STEPS = ["Kjøretøy", "Feilen", "Detaljer", "Krav", "Brev"];
const BREV = STEPS.length - 1;

// The answers are compared with the decisions (src/lib/matching/) and put into the letter (src/lib/brev/).
const SOM_DEN_ER = [
  { id: "ja", navn: "Ja" },
  { id: "nei", navn: "Nei" },
  { id: "vet_ikke", navn: "Vet ikke" },
] as const;
type SomDenEr = (typeof SOM_DEN_ER)[number]["id"];
const KILDE = [
  { id: "skriftlig", navn: "Ja, skriftlig" },
  { id: "muntlig", navn: "Ja, muntlig" },
  { id: "nei", navn: "Nei" },
] as const;
type Kilde = (typeof KILDE)[number]["id"];
// Per main category: a free-text line, whether a workshop examined it, and whether the seller said
// anything about it before the sale.
type Detalj = { beskrivelse?: string; verksted?: Kilde; opplysning?: Kilde };
type Krav = "retting" | "prisavslag" | "heving";
const KRAV: { id: Krav; navn: string; merke?: string; tekst: string }[] = [
  { id: "retting", navn: "Retting", merke: "Vanligst", tekst: "Forhandleren utbedrer feilen uten kostnad for deg. Dette er normalt første steg." },
  { id: "prisavslag", navn: "Prisavslag", tekst: "Du beholder bilen og får kjøpesummen redusert tilsvarende mangelen." },
  { id: "heving", navn: "Heving", tekst: "Kjøpet omgjøres, og kjøpesummen tilbakebetales. Forutsetter at mangelen ikke er uvesentlig." },
];
const RETTINGSFORSOK = [
  { id: 0, navn: "Nei" },
  { id: 1, navn: "1 gang" },
  { id: 2, navn: "2 ganger" },
  { id: 3, navn: "3 eller flere" },
] as const;
const TIDLIGERE = [
  { id: "nei", navn: "Nei" },
  { id: "skriftlig", navn: "Ja, skriftlig" },
  { id: "muntlig", navn: "Ja, muntlig" },
] as const;
type Tidligere = (typeof TIDLIGERE)[number]["id"];
const UTLEGG_FORSLAG = ["Tauing", "Feilsøking", "Leiebil", "Verkstedregning"];
type Utlegg = { beskrivelse: string; belop: string };

// Digits with a space every third place: 84210 → «84 210».
const tall = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const kunSifre = (s: string, maks: number) => s.replace(/\D/g, "").replace(/^0+/, "").slice(0, maks);

const pop = (i: number) => `rkPop 560ms cubic-bezier(.22,1,.36,1) ${70 + i * 45}ms backwards`;
const datoTekst = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const KNAPP: CSSProperties = {
  all: "unset",
  boxSizing: "border-box",
  cursor: "pointer",
};
const OVERLINE: CSSProperties = {
  font: `600 11px ${MONO}`,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: A,
};
const H1: CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.15,
  fontWeight: 600,
  letterSpacing: "-0.02em",
  textWrap: "pretty",
};
const INGRESS: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.5,
  color: "#5f6468",
  textWrap: "pretty",
};

function Hake() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: "rkCheck 320ms cubic-bezier(.34,1.56,.64,1) both" }}>
      <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const chip = (sel: boolean): CSSProperties => ({
  ...KNAPP,
  padding: "9px 15px",
  borderRadius: 999,
  border: `1.5px solid ${sel ? A : LINE}`,
  background: sel ? A : "#fff",
  color: sel ? "#fff" : INK,
  fontSize: 14,
  fontWeight: 500,
  transition: "all .2s",
});

// A question answered with one chip.
function Chipvalg<T extends string | number>({
  sporsmal,
  etikett,
  valg,
  valgt,
  velg,
}: {
  sporsmal: string;
  etikett?: string;
  valg: readonly { id: T; navn: string }[];
  valgt: T | null | undefined;
  velg: (id: T) => void;
}) {
  return (
    <div role="group" aria-label={etikett ?? sporsmal} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 14, fontWeight: 600, textWrap: "pretty" }}>{sporsmal}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {valg.map((t) => (
          <button key={t.id} type="button" aria-pressed={valgt === t.id} onClick={() => velg(t.id)} className="rk-chip" style={chip(valgt === t.id)}>
            {t.navn}
          </button>
        ))}
      </div>
    </div>
  );
}

function Radiomerke({ valgt }: { valgt: boolean }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        flex: "none",
        borderRadius: "50%",
        border: `1.5px solid ${valgt ? A : "#b4b8bc"}`,
        display: "grid",
        placeItems: "center",
        transition: "border-color .2s",
      }}
    >
      {valgt && <span style={{ width: 10, height: 10, borderRadius: "50%", background: A, animation: "rkCheck 300ms cubic-bezier(.34,1.56,.64,1) both" }} />}
    </span>
  );
}

const kort = (sel: boolean, anim: string): CSSProperties => ({
  ...KNAPP,
  borderRadius: 11,
  border: `1.5px solid ${sel ? A : LINE}`,
  background: sel ? AS : "#fff",
  transition: "border-color .2s,background .2s,transform .15s,box-shadow .2s",
  animation: anim,
});

// A number with a unit after it, shown with thousands spaces; the value is kept as digits only.
function Tallfelt({ etikett, hjelp, enhet, verdi, sett, maks }: { etikett: string; hjelp?: string; enhet: string; verdi: string; sett: (v: string) => void; maks: number }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, fontWeight: 600 }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {etikett}
        {hjelp && <span style={{ fontSize: 13, fontWeight: 400, color: "#5f6468" }}>{hjelp}</span>}
      </span>
      <span
        className="rk-felt"
        style={{ display: "flex", alignItems: "center", height: 50, border: `1.5px solid ${LINE}`, borderRadius: 10, background: "#fff", overflow: "hidden", boxSizing: "border-box" }}
      >
        <input
          inputMode="numeric"
          autoComplete="off"
          value={tall(verdi)}
          onChange={(e) => sett(kunSifre(e.target.value, maks))}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", padding: "0 4px 0 14px", font: `500 16px ${MONO}`, color: INK, background: "transparent" }}
        />
        <span style={{ padding: "0 14px 0 4px", fontSize: 14, fontWeight: 400, color: "#5f6468" }}>{enhet}</span>
      </span>
    </label>
  );
}

// fkjl. § 27: the absolute deadline, shown where a date or a choice puts it in doubt.
function Fristvarsel({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" style={{ background: "oklch(0.96 0.04 75)", borderRadius: 12, padding: "16px 18px", display: "flex", gap: 14, animation: pop(0) }}>
      <span aria-hidden="true" style={{ font: `600 15px ${MONO}`, color: "oklch(0.5 0.13 60)", lineHeight: 1.4 }}>
        §
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, lineHeight: 1.5, color: "#2c3033", textWrap: "pretty" }}>
        <span>
          Fristen for å reklamere er to år etter overtakelsen, eller fem år for deler som er ment å vare vesentlig lenger. Reklamasjonen må fremsettes innen rimelig tid
          etter at feilen ble oppdaget (forbrukerkjøpsloven § 27).
        </span>
        <span style={{ fontWeight: 600 }}>{children}</span>
      </div>
    </div>
  );
}


// A date: the phone's own picker on a touch screen, the calendar with a mouse.
function Datovelger({ etikett, verdi, sett, min, maks }: { etikett: string; verdi: string; sett: (iso: string) => void; min?: string; maks: string }) {
  const [apen, setApen] = useState(false);
  const beroring = useSyncExternalStore(
    () => () => {},
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
  const fra = min ? new Date(`${min}T12:00:00`) : new Date(Number(maks.slice(0, 4)) - 20, 0);
  const felt: CSSProperties = { height: 50, width: 220, border: `1.5px solid ${LINE}`, borderRadius: 10, padding: "0 14px", font: `16px ${SANS}`, color: INK, outline: "none", background: "#fff", boxSizing: "border-box" };
  if (beroring)
    return <input type="date" aria-label={etikett} value={verdi} min={min} max={maks} onChange={(e) => sett(e.target.value)} className="rk-input" style={felt} />;
  return (
    <Popover open={apen} onOpenChange={setApen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={etikett}
          className="rk-input"
          style={{ ...KNAPP, ...felt, border: `1.5px solid ${apen ? A : LINE}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, color: verdi ? INK : "#8a8f93" }}
        >
          {verdi ? datoTekst(verdi) : "Velg dato"}
          <CalendarIcon aria-hidden size={18} color="#5f6468" />
        </button>
      </PopoverTrigger>
      {/* The form's accent, not the site's navy, for the selected day and focus ring. */}
      <PopoverContent align="start" className="w-auto overflow-hidden p-0" style={{ "--primary": A, "--ring": A, fontFamily: SANS } as CSSProperties}>
        <Calendar
          className="[--cell-size:--spacing(9)]"
          mode="single"
          locale={nb}
          captionLayout="dropdown"
          selected={verdi ? new Date(`${verdi}T12:00:00`) : undefined}
          defaultMonth={verdi ? new Date(`${verdi}T12:00:00`) : undefined}
          startMonth={fra}
          endMonth={new Date(`${maks}T12:00:00`)}
          disabled={[{ after: new Date(`${maks}T12:00:00`) }, ...(min ? [{ before: fra }] : [])]}
          onSelect={(d) => {
            if (!d) return;
            sett(format(d, "yyyy-MM-dd"));
            setApen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// The seller, found in the Enhetsregister (Brreg) by name or organisation number through /api/firma.
// Only the chosen hit is kept; the letter is addressed from the register again on the server.
type Selger = { orgnr: string; navn: string; kommune: string | null; status: "konkurs" | "avvikling" | null };
const orgnrTekst = (o: string) => o.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
const STATUS = { konkurs: "Registrert som konkurs", avvikling: "Under avvikling" } as const;

function Selgervalg({ valgt, velg }: { valgt: Selger | null; velg: (s: Selger | null) => void }) {
  const [q, setQ] = useState("");
  const [forslag, setForslag] = useState<Forslag[]>([]);
  const [soker, setSoker] = useState(false);
  const [feil, setFeil] = useState(false);
  // The query the list on screen belongs to, so «no hits» is not shown while the next one is on its way.
  const [sokt, setSokt] = useState("");

  const s = q.trim();
  useEffect(() => {
    if (s.length < 3) return;
    const avbryt = new AbortController();
    const timer = setTimeout(async () => {
      setSoker(true);
      try {
        const res = await fetch(`/api/firma?${new URLSearchParams({ q: s })}`, { signal: avbryt.signal });
        const json = (await res.json()) as { forslag?: Forslag[]; feil?: true };
        if (avbryt.signal.aborted) return;
        setForslag(json.forslag ?? []);
        setFeil(!!json.feil);
        setSokt(s);
      } catch {
        if (avbryt.signal.aborted) return;
        setForslag([]);
        setFeil(true);
      } finally {
        if (!avbryt.signal.aborted) setSoker(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      avbryt.abort();
    };
  }, [s]);
  // A query shorter than three letters shows nothing, whatever an earlier one left behind.
  const treff = s.length >= 3 ? forslag : [];

  if (valgt)
    return (
      <div style={{ background: "#fff", border: `1.5px solid ${A}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, animation: pop(0) }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{valgt.navn}</span>
          <span style={{ fontSize: 13, color: "#5f6468" }}>
            Org.nr. {orgnrTekst(valgt.orgnr)}
            {valgt.kommune ? ` · ${valgt.kommune}` : ""}
          </span>
          {valgt.status && <span style={{ fontSize: 13, color: "#a3372b" }}>{STATUS[valgt.status]}</span>}
        </span>
        <button type="button" onClick={() => velg(null)} className="rk-tilbake" style={{ ...KNAPP, padding: "8px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600, color: A }}>
          Endre
        </button>
      </div>
    );

  const trengerSvar = s.length >= 3 && !soker && sokt === s;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value.slice(0, 80))}
        placeholder="Navn eller organisasjonsnummer"
        aria-label="Søk etter selgeren"
        autoComplete="off"
        className="rk-input"
        style={{ height: 50, border: `1.5px solid ${LINE}`, borderRadius: 10, padding: "0 14px", font: `16px ${SANS}`, color: INK, outline: "none", background: "#fff", boxSizing: "border-box" }}
      />
      {soker && s.length >= 3 && <span role="status" style={{ fontSize: 13, color: "#5f6468" }}>Søker …</span>}
      {feil && !soker && s.length >= 3 && <span role="alert" style={{ fontSize: 13, color: "#a3372b" }}>Vi fikk ikke kontakt med Enhetsregisteret. Prøv igjen om litt.</span>}
      {treff.length > 0 && (
        <div role="listbox" aria-label="Treff i Enhetsregisteret" style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden" }}>
          {treff.map((f, i) => (
            <button
              key={f.orgnr}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => velg({ orgnr: f.orgnr, navn: tittelNavn(f.navn), kommune: f.kommune, status: f.status })}
              className="rk-kat"
              style={{ ...KNAPP, width: "100%", display: "flex", flexDirection: "column", gap: 2, padding: "12px 18px", borderTop: i ? "1px solid #eeeeeb" : "none" }}
            >
              <span style={{ fontSize: 15, fontWeight: 600 }}>{tittelNavn(f.navn)}</span>
              <span style={{ fontSize: 13, color: "#5f6468" }}>
                Org.nr. {orgnrTekst(f.orgnr)}
                {f.kommune ? ` · ${f.kommune}` : ""}
                {f.bransje ? ` · ${f.bransje}` : ""}
              </span>
              {f.status && <span style={{ fontSize: 13, color: "#a3372b" }}>{STATUS[f.status]}</span>}
            </button>
          ))}
        </div>
      )}
      {trengerSvar && !treff.length && !feil && (
        <span style={{ fontSize: 13, color: "#5f6468", lineHeight: 1.5 }}>
          Ingen treff. Prøv navnet slik det står i kontrakten, eller organisasjonsnummeret. Vi finner aksjeselskaper og lignende, ikke enkeltpersonforetak.
        </span>
      )}
    </div>
  );
}

// The letter as the buyer sees it: the same lines as «Kopier tekst» and the Word file (tilDokument).
// A hidden block, before payment, is drawn as grey bars the length of the text it stands for.
function Brevvisning({ brev, bred }: { brev: Brev; bred: boolean }) {
  const grupper = tilDokument(brev);
  const brevside: CSSProperties = { margin: 0, fontSize: 15.5, lineHeight: 1.65, color: INK, textWrap: "pretty" };
  const [forste, andre, ...resten] = grupper;
  // Sender top left and place and date top right, when both are there.
  const harDato = andre?.[0]?.stil === "stedDato";
  const toppRad = forste?.[0]?.stil === "adresse" && harDato;
  const rest = toppRad ? resten : grupper.slice(forste?.[0]?.stil === "stedDato" ? 1 : 0);
  const linjer = (g: Linje[]) => g.map((l, i) => <span key={i} style={{ display: "block" }}>{l.tekst}</span>);
  return (
    <article aria-label="Reklamasjonsbrev" style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: bred ? "36px 44px" : "24px 20px", display: "flex", flexDirection: "column", gap: 18, animation: pop(0) }}>
      {toppRad ? (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "4px 24px", ...brevside, fontSize: 14.5 }}>
          <div>{linjer(forste)}</div>
          <div style={{ textAlign: "right" }}>{linjer(andre)}</div>
        </div>
      ) : (
        grupper[0]?.[0]?.stil === "stedDato" && <div style={{ ...brevside, fontSize: 14.5, textAlign: "right" }}>{linjer(grupper[0])}</div>
      )}
      {rest.map((g, i) => {
        const stil = g[0].stil;
        if (g[0].skjult !== undefined) {
          const antall = Math.max(1, Math.round(g[0].skjult / 90));
          return (
            <div key={i} aria-hidden="true" data-skjult style={{ display: "flex", flexDirection: "column", gap: 8, filter: "blur(2.5px)", userSelect: "none" }}>
              {Array.from({ length: antall }, (_, j) => (
                <span key={j} style={{ height: 12, width: j === antall - 1 ? `${55 + ((i * 17) % 35)}%` : "100%", borderRadius: 4, background: "#dcdedb" }} />
              ))}
            </div>
          );
        }
        if (stil === "overskrift") return <h2 key={i} style={{ ...brevside, fontWeight: 700, margin: "6px 0 -8px" }}>{g[0].tekst}</h2>;
        if (stil === "tittel") return <h1 key={i} style={{ ...brevside, fontWeight: 700, fontSize: 17, letterSpacing: "-0.005em" }}>{g[0].tekst}</h1>;
        if (stil === "adresse") return <div key={i} style={brevside}>{linjer(g)}</div>;
        if (stil === "hilsen" || stil === "vedleggOverskrift") return <div key={i} style={{ ...brevside, ...(stil === "vedleggOverskrift" && { fontSize: 14.5 }) }}>{linjer(g)}</div>;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={brevside}>{g[0].tekst}</p>
            {g[0].lenke && (
              <a href={g[0].lenke} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: A, alignSelf: "flex-start" }}>
                Les vedtaket
              </a>
            )}
          </div>
        );
      })}
    </article>
  );
}

type Bil = { k: Kjoretoy; eierFra: string | null };
// Everything the buyer has typed or chosen, kept in sessionStorage so a reload or the browser's back
// button does not lose it. The result (funn) is not kept: it is found again with «Lag brev».
type Lagret = {
  step: number;
  regnr: string;
  car: Bil | null;
  kjopsdato: string;
  valg: Feilvalg;
  tid: Partial<Tidsvalg>;
  km: string;
  kjopesum: string;
  somDenEr: SomDenEr | null;
  detaljer: Record<string, Detalj>;
  krav: Krav | null;
  forsok: number | null;
  kreverUtlegg: boolean;
  utlegg: Utlegg[];
  selger: Selger | null;
  tidligere: Tidligere | null;
  tidligereDato: string;
  overslag: string;
};
const LAGRINGSNOKKEL = "tvistr:sak";
// The Vipps order id, kept so that a reload after payment finds the paid letter again (docs/brev.md).
const ORDRENOKKEL = "tvistr:ordre";
const lesOrdreId = () => {
  try {
    return sessionStorage.getItem(ORDRENOKKEL);
  } catch {
    return null;
  }
};

const streng = (v: unknown, maks: number) => (typeof v === "string" ? v.slice(0, maks) : "");

function lesSelger(v: unknown): Selger | null {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  if (typeof r.orgnr !== "string" || !/^\d{9}$/.test(r.orgnr) || typeof r.navn !== "string") return null;
  return { orgnr: r.orgnr, navn: r.navn.slice(0, 120), kommune: typeof r.kommune === "string" ? r.kommune.slice(0, 80) : null, status: r.status === "konkurs" || r.status === "avvikling" ? r.status : null };
}

function lesLagret(): Lagret | null {
  try {
    const r = JSON.parse(sessionStorage.getItem(LAGRINGSNOKKEL) ?? "null") as Record<string, unknown> | null;
    if (!r || typeof r !== "object") return null;
    const bil = r.car as Bil | null;
    const detaljer: Record<string, Detalj> = {};
    for (const [id, d] of Object.entries((r.detaljer && typeof r.detaljer === "object" ? r.detaljer : {}) as Record<string, Record<string, unknown>>)) {
      detaljer[id] = {
        ...(typeof d?.beskrivelse === "string" && { beskrivelse: d.beskrivelse.slice(0, 200) }),
        ...(KILDE.some((k) => k.id === d?.verksted) && { verksted: d.verksted as Kilde }),
        ...(KILDE.some((k) => k.id === d?.opplysning) && { opplysning: d.opplysning as Kilde }),
      };
    }
    return {
      // The result is not kept, so the page never opens on step 5.
      step: typeof r.step === "number" && Number.isInteger(r.step) ? Math.min(Math.max(r.step, 0), BREV - 1) : 0,
      regnr: streng(r.regnr, 8),
      car: bil && typeof bil === "object" && bil.k && typeof bil.k.merke === "string" && typeof bil.k.modell === "string" ? { k: bil.k, eierFra: typeof bil.eierFra === "string" ? bil.eierFra : null } : null,
      kjopsdato: streng(r.kjopsdato, 10),
      valg: rensFeilvalg(r.valg),
      tid: rensTidsvalg(r.tid),
      km: streng(r.km, 7).replace(/\D/g, ""),
      kjopesum: streng(r.kjopesum, 8).replace(/\D/g, ""),
      somDenEr: SOM_DEN_ER.find((o) => o.id === r.somDenEr)?.id ?? null,
      detaljer,
      krav: KRAV.find((k) => k.id === r.krav)?.id ?? null,
      forsok: RETTINGSFORSOK.find((o) => o.id === r.forsok)?.id ?? null,
      kreverUtlegg: r.kreverUtlegg === true,
      selger: lesSelger(r.selger),
      tidligere: TIDLIGERE.find((o) => o.id === r.tidligere)?.id ?? null,
      tidligereDato: streng(r.tidligereDato, 10),
      overslag: streng(r.overslag, 7).replace(/\D/g, ""),
      utlegg: Array.isArray(r.utlegg) ? r.utlegg.slice(0, 20).map((u: Record<string, unknown>) => ({ beskrivelse: streng(u?.beskrivelse, 200), belop: streng(u?.belop, 8).replace(/\D/g, "") })) : [],
    };
  } catch {
    return null;
  }
}

// sessionStorage is not there when the server renders. The form is first rendered empty, then
// remounted with what was saved once the client has taken over.
export function Skjema() {
  const hydrert = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return <SkjemaInnhold key={hydrert ? "klient" : "server"} start={hydrert ? lesLagret() : null} lagre={hydrert} />;
}

function SkjemaInnhold({ start, lagre }: { start: Lagret | null; lagre: boolean }) {
  const [step, setStep] = useState(start?.step ?? 0);
  const [dir, setDir] = useState(1);
  const [w, setW] = useState(1200);
  const [regnr, setRegnr] = useState(start?.regnr ?? "");
  const [fetching, setFetching] = useState(false);
  const [car, setCar] = useState<Bil | null>(start?.car ?? null);
  const [oppslagFeil, setOppslagFeil] = useState<string | null>(null);
  // Suggested from the day the car was registered on its current owner; the buyer can change it.
  const [kjopsdato, setKjopsdato] = useState(start?.kjopsdato ?? "");
  const [valg, setValg] = useState<Feilvalg>(start?.valg ?? {});
  const [tid, setTid] = useState<Partial<Tidsvalg>>(start?.tid ?? {});
  const [km, setKm] = useState(start?.km ?? "");
  const [kjopesum, setKjopesum] = useState(start?.kjopesum ?? "");
  const [somDenEr, setSomDenEr] = useState<SomDenEr | null>(start?.somDenEr ?? null);
  const [detaljer, setDetaljer] = useState<Record<string, Detalj>>(start?.detaljer ?? {});
  // The open card in step 3; undefined means the first unanswered one.
  const [apent, setApent] = useState<string | null | undefined>(undefined);
  const [krav, setKrav] = useState<Krav | null>(start?.krav ?? null);
  const [forsok, setForsok] = useState<number | null>(start?.forsok ?? null);
  const [kreverUtlegg, setKreverUtlegg] = useState(start?.kreverUtlegg ?? false);
  const [utlegg, setUtlegg] = useState<Utlegg[]>(start?.utlegg ?? []);
  const [selger, setSelger] = useState<Selger | null>(start?.selger ?? null);
  const [tidligere, setTidligere] = useState<Tidligere | null>(start?.tidligere ?? null);
  const [tidligereDato, setTidligereDato] = useState(start?.tidligereDato ?? "");
  const [overslag, setOverslag] = useState(start?.overslag ?? "");
  const [funn, setFunn] = useState<Funn | null>(null);
  const [brevet, setBrevet] = useState<BrevResultat | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [soker, startSok] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nesteKort = useRef<ReturnType<typeof setTimeout>>(undefined);
  const foresporsel = useRef(0);

  useEffect(() => {
    if (!rootRef.current || !window.ResizeObserver) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => clearTimeout(nesteKort.current), []);

  useEffect(() => {
    if (!lagre) return;
    const l: Lagret = { step: Math.min(step, BREV - 1), regnr, car, kjopsdato, valg, tid, km, kjopesum, somDenEr, detaljer, krav, forsok, kreverUtlegg, utlegg, selger, tidligere, tidligereDato, overslag };
    try {
      sessionStorage.setItem(LAGRINGSNOKKEL, JSON.stringify(l));
    } catch {}
  }, [lagre, step, regnr, car, kjopsdato, valg, tid, km, kjopesum, somDenEr, detaljer, krav, forsok, kreverUtlegg, utlegg, selger, tidligere, tidligereDato, overslag]);

  const isDesktop = w >= 820;
  // The same rule the lookup uses, so the button only works for a number the server accepts.
  const gyldig = normaliserRegnr(regnr) !== null;
  const go = (n: number) => {
    setDir(n >= step ? 1 : -1);
    setStep(n);
    // The decisions belong to the answers they were found for; leaving step 5 lets them change.
    if (n < BREV) {
      setFunn(null);
      setBrevet(null);
      foresporsel.current++;
    }
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  async function fetchCar() {
    if (!gyldig || fetching) return;
    setFetching(true);
    setCar(null);
    setOppslagFeil(null);
    try {
      const res = await fetch(`/api/kjoretoy?${new URLSearchParams({ regnr })}`);
      const json = (await res.json()) as {
        kjoretoy?: Kjoretoy;
        eierFra?: string | null;
        feil?: string;
      };
      if (!json.kjoretoy) throw new Error(json.feil ?? "Noe gikk galt. Prøv igjen.");
      setCar({ k: json.kjoretoy, eierFra: json.eierFra ?? null });
      setKjopsdato(json.eierFra ?? "");
      setFunn(null);
    } catch (e) {
      setOppslagFeil(e instanceof Error && !(e instanceof TypeError) ? e.message : "Noe gikk galt. Prøv igjen.");
    } finally {
      setFetching(false);
    }
  }

  // A result belongs to the choices it was made for; any change clears it.
  const endreValg = (f: (v: Feilvalg) => Feilvalg) => {
    setValg(f);
    setFunn(null);
  };
  const toggleCat = (id: string) => endreValg((v) => (id in v ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== id)) : { ...v, [id]: [] }));
  const toggleSub = (h: string, u: string) =>
    endreValg((v) => ({
      ...v,
      [h]: v[h].includes(u) ? v[h].filter((x) => x !== u) : [...v[h], u],
    }));

  const valgte = HOVEDKATEGORIER.filter((h) => h.id in valg);
  // A card is answered when it says when the defect showed itself, whether a workshop examined it
  // and whether the seller said anything about it. The description and subcategories are optional.
  const besvarteMed = (id: string, t: Partial<Tidsvalg>, d: Record<string, Detalj>) => [t[id], d[id]?.verksted, d[id]?.opplysning].filter(Boolean).length;
  const ferdig = (id: string) => besvarteMed(id, tid, detaljer) === 3;
  const apenId = apent === undefined ? (valgte.find((h) => !ferdig(h.id))?.id ?? null) : apent;

  // When an answer completes a card, the next unanswered one opens, as in the mockup.
  function besvar(id: string, nyTid: Partial<Tidsvalg>, nyeDetaljer: Record<string, Detalj>) {
    const varFerdig = ferdig(id);
    setTid(nyTid);
    setDetaljer(nyeDetaljer);
    if (varFerdig || besvarteMed(id, nyTid, nyeDetaljer) < 3) return;
    clearTimeout(nesteKort.current);
    nesteKort.current = setTimeout(() => {
      const i = valgte.findIndex((h) => h.id === id);
      const rekke = [...valgte.slice(i + 1), ...valgte.slice(0, i)];
      setApent(rekke.find((h) => besvarteMed(h.id, nyTid, nyeDetaljer) < 3)?.id ?? null);
    }, 420);
  }
  const settTid = (id: string, t: VisteSegValg) => {
    setFunn(null);
    besvar(id, { ...tid, [id]: t }, detaljer);
  };
  const settDetalj = (id: string, endring: Detalj) => besvar(id, tid, { ...detaljer, [id]: { ...detaljer[id], ...endring } });
  const settUtlegg = (i: number, endring: Partial<Utlegg>) => setUtlegg((u) => u.map((x, j) => (j === i ? { ...x, ...endring } : x)));

  const carName = car ? `${car.k.merke} ${car.k.modell}` : "";
  const beskrevet = valgte.filter((h) => ferdig(h.id)).length;
  const idag = new Date().toISOString().slice(0, 10);
  const datoOk = /^\d{4}-\d{2}-\d{2}$/.test(kjopsdato) && kjopsdato <= idag;
  const aarSiden = (n: number) => `${Number(idag.slice(0, 4)) - n}${idag.slice(4)}`;
  const utleggSum = utlegg.reduce((s, x) => s + (Number(x.belop) || 0), 0);
  const utleggOk = !kreverUtlegg || (utlegg.length > 0 && utlegg.every((x) => x.beskrivelse.trim() && Number(x.belop) > 0));
  // The date of an earlier notice lies between the purchase and today.
  const tidligereDatoOk = /^\d{4}-\d{2}-\d{2}$/.test(tidligereDato) && tidligereDato >= kjopsdato && tidligereDato <= idag;
  const tidligereOk = tidligere === "nei" || (tidligere !== null && tidligereDatoOk);
  // A cost estimate has a place when a workshop has put its assessment in writing.
  const skriftligVerksted = valgte.some((h) => detaljer[h.id]?.verksted === "skriftlig");
  const valid = [
    !!car && !fetching && datoOk && Number(km) > 0 && Number(kjopesum) > 0 && !!somDenEr,
    valgte.length > 0,
    valgte.length > 0 && beskrevet === valgte.length,
    !!krav && forsok !== null && utleggOk && !!selger && tidligereOk,
  ][step];
  const ok = valid && !soker;
  const subs = [
    car ? [carName, car.k.regnr, km && `${tall(km)} km`].filter(Boolean).join(" · ") : "",
    valgte.map((h) => h.navn).join(", "),
    "",
    krav ? `${KRAV.find((k) => k.id === krav)?.navn}${kreverUtlegg ? " + utlegg" : ""}` : "",
    "",
  ];
  // Step 5 opens at once and waits for the answer. Leaving step 5 (or asking again) makes an
  // answer that is still on its way stale. The decision is found first, then the letter is built
  // from the answers and the decision's paragraph.
  const lagBrev = () => {
    const mitt = ++foresporsel.current;
    setFunn(null);
    setBrevet(null);
    if (step !== BREV) go(BREV);
    startSok(async () => {
      const svar = {
        valg,
        tid,
        kjopsdato,
        km: Number(km),
        kjopesum: Number(kjopesum),
        ar: car?.k.ar ?? null,
        somDenEr,
        krav,
        forsok,
        detaljer,
        bil: car && { regnr: car.k.regnr, merke: car.k.merke, modell: car.k.modell, ar: car.k.ar },
        selgerOrgnr: selger?.orgnr ?? null,
        tidligere: tidligere && tidligere !== "nei" ? { form: tidligere, dato: tidligereDato } : null,
        overslag: skriftligVerksted && overslag ? Number(overslag) : null,
        utlegg: kreverUtlegg ? utlegg.map((u) => ({ beskrivelse: u.beskrivelse, belop: Number(u.belop) })) : [],
      };
      const f = await finnVedtak(svar);
      if (mitt !== foresporsel.current) return;
      setFunn(f);
      if (!f.ok) return;
      const b = await byggBrevet({ svar, funn: f, ordreId: lesOrdreId() });
      if (mitt === foresporsel.current) setBrevet(b);
    });
  };

  async function kopier(b: Brev) {
    try {
      await navigator.clipboard.writeText(somTekst(b));
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {}
  }

  async function lastNed(b: Brev) {
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
        {
          k: "Første gang registrert",
          v: car.k.ar ? String(car.k.ar) : "Ukjent",
        },
        ...(car.eierFra ? [{ k: "Sist registrert", v: datoTekst(car.eierFra) }] : []),
        ...(car.k.bruktimportert !== undefined ? [{ k: "Bruktimportert", v: car.k.bruktimportert ? "Ja" : "Nei" }] : []),
      ]
    : [];
  const stepAnim = `${dir > 0 ? "rkIn" : "rkBack"} 460ms cubic-bezier(.22,1,.36,1) both`;

  return (
    <div
      ref={rootRef}
      className="rk"
      style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", background: "#f6f6f4", fontFamily: SANS, color: INK, overflow: "hidden", WebkitFontSmoothing: "antialiased" }}
    >
      {isDesktop && (
        <aside
          style={{
            width: 290,
            flex: "none",
            background: "#fff",
            borderRight: `1px solid ${LINE}`,
            display: "flex",
            flexDirection: "column",
            padding: "32px 24px",
            boxSizing: "border-box",
            gap: 40,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>Reklamasjon</div>
            <div style={{ fontSize: 13, color: "#5f6468" }}>Kjøp av bruktbil fra forhandler</div>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {STEPS.map((t, i) => {
              const done = i < step,
                cur = i === step;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => done && go(i)}
                  style={{
                    ...KNAPP,
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    padding: "10px 10px",
                    borderRadius: 10,
                    cursor: done ? "pointer" : "default",
                    background: cur ? "#f3f3f0" : "transparent",
                    transition: "background .25s",
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      flex: "none",
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      font: `600 12px ${MONO}`,
                      background: done ? A : "#fff",
                      border: `1.5px solid ${done ? A : cur ? INK : LINE}`,
                      color: cur ? INK : "#8a8f93",
                      transition: "all .3s",
                    }}
                  >
                    {done ? <Hake /> : i + 1}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, paddingTop: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: done || cur ? INK : "#8a8f93" }}>{t}</span>
                    {done && subs[i] && (
                      <span style={{ fontSize: 12.5, color: "#5f6468", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190 }}>{subs[i]}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {!isDesktop && (
          <div style={{ background: "#fff", borderBottom: `1px solid ${LINE}`, padding: "14px 20px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Reklamasjon</span>
              <span style={{ font: `500 12px ${MONO}`, color: "#5f6468" }}>{`${step + 1} / ${STEPS.length} · ${STEPS[step]}`}</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {STEPS.map((t, i) => (
                <span key={t} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? A : LINE, transition: "background .45s cubic-bezier(.22,1,.36,1)" }} />
              ))}
            </div>
          </div>
        )}

        <div ref={scrollRef} style={{ flex: 1, overflow: "auto", overflowX: "hidden" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", padding: isDesktop ? "56px 40px 64px" : "28px 20px 40px", boxSizing: "border-box" }}>
            {step === 0 && (
              <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 36 }}>
                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={OVERLINE}>Steg 1 av {STEPS.length} · Kjøretøy</span>
                  <h1 style={H1}>Hvilken bil gjelder reklamasjonen?</h1>
                  <p style={INGRESS}>Oppgi registreringsnummeret. Kjøretøyopplysningene hentes automatisk fra Statens vegvesen.</p>
                </header>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: pop(2) }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "stretch",
                        border: `2px solid ${INK}`,
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#fff",
                        height: 58,
                        width: 230,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          flex: "none",
                          background: "oklch(0.42 0.15 262)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                          paddingBottom: 7,
                          boxSizing: "border-box",
                          font: `700 12px ${SANS}`,
                        }}
                      >
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
                        style={{
                          border: "none",
                          outline: "none",
                          minWidth: 0,
                          width: "100%",
                          padding: "0 14px",
                          font: `600 25px ${MONO}`,
                          letterSpacing: ".06em",
                          textTransform: "uppercase",
                          color: INK,
                          background: "transparent",
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void fetchCar()}
                      disabled={!gyldig || fetching}
                      style={{
                        ...KNAPP,
                        cursor: gyldig && !fetching ? "pointer" : "not-allowed",
                        height: 58,
                        padding: "0 22px",
                        borderRadius: 10,
                        background: gyldig ? INK : "#9a9ea2",
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "background .2s",
                      }}
                    >
                      {fetching && (
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            border: "2px solid rgba(255,255,255,.35)",
                            borderTopColor: "#fff",
                            animation: "rkSpin .7s linear infinite",
                          }}
                        />
                      )}
                      {fetching ? "Henter …" : car ? "Hent på nytt" : "Hent opplysninger"}
                    </button>
                  </div>
                  {oppslagFeil && (
                    <p role="alert" style={{ margin: 0, fontSize: 14, color: "#a3372b" }}>
                      {oppslagFeil}
                    </p>
                  )}
                </div>

                {fetching && (
                  <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
                    <span style={{ height: 18, width: "55%", borderRadius: 4, background: "#ecedea", animation: "rkShimmer 1.1s ease-in-out infinite" }} />
                    <span style={{ height: 12, width: "35%", borderRadius: 4, background: "#ecedea", animation: "rkShimmer 1.1s ease-in-out .15s infinite" }} />
                    <span style={{ height: 12, width: "70%", borderRadius: 4, background: "#ecedea", animation: "rkShimmer 1.1s ease-in-out .3s infinite" }} />
                  </div>
                )}

                {car && !fetching && (
                  <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden", animation: pop(0) }}>
                    <div style={{ padding: "20px 22px", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", borderBottom: "1px solid #eeeeeb" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>{carName}</span>
                        <span style={{ fontSize: 14, color: "#5f6468" }}>{[car.k.regnr, car.k.ar].filter(Boolean).join(" · ")}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCar(null);
                          setRegnr("");
                        }}
                        style={{ all: "unset", cursor: "pointer", fontSize: 13, fontWeight: 600, color: A, whiteSpace: "nowrap" }}
                      >
                        Feil bil?
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))" }}>
                      {carRows.map((c, i) => (
                        <div key={c.k} style={{ padding: "14px 22px", display: "flex", flexDirection: "column", gap: 3, animation: pop(i + 1) }}>
                          <span style={{ fontSize: 12, color: "#5f6468" }}>{c.k}</span>
                          <span style={{ fontSize: 14.5, fontWeight: 500 }}>{c.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {car && !fetching && (
                  <section style={{ display: "flex", flexDirection: "column", gap: 14, animation: pop(4) }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Når kjøpte du bilen?</h2>
                      <p style={{ margin: 0, fontSize: 14, color: "#5f6468" }}>
                        {car.eierFra ? "Foreslått ut fra når bilen sist ble omregistrert. Endre hvis det ikke stemmer." : "Vi fant ikke datoen i motorvognregisteret. Fyll inn selv."}
                      </p>
                    </div>
                    <Datovelger
                      etikett="Kjøpsdato"
                      verdi={kjopsdato}
                      maks={idag}
                      sett={(d) => {
                        setKjopsdato(d);
                        setFunn(null);
                      }}
                    />
                    {datoOk && kjopsdato < aarSiden(5) ? (
                      <Fristvarsel>Du kjøpte bilen for mer enn fem år siden. Da kan fristen for å reklamere ha gått ut, også for deler som er ment å vare vesentlig lenger.</Fristvarsel>
                    ) : datoOk && kjopsdato < aarSiden(2) ? (
                      <Fristvarsel>Du kjøpte bilen for mer enn to år siden. Da kan fristen for å reklamere ha gått ut, med mindre delen er ment å vare vesentlig lenger.</Fristvarsel>
                    ) : null}
                  </section>
                )}

                {car && !fetching && (
                  <section style={{ display: "flex", flexDirection: "column", gap: 14, animation: pop(6) }}>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Om kjøpet</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
                      <Tallfelt etikett="Kilometerstand ved kjøp" hjelp="Står i kjøpekontrakten." enhet="km" verdi={km} sett={setKm} maks={7} />
                      <Tallfelt etikett="Kjøpesum" hjelp="Det du betalte for bilen." enhet="kr" verdi={kjopesum} sett={setKjopesum} maks={8} />
                    </div>
                  </section>
                )}

                {car && !fetching && (
                  <section style={{ display: "flex", flexDirection: "column", gap: 14, animation: pop(8) }}>
                    <h2 id="som-den-er" style={{ margin: 0, fontSize: 17, fontWeight: 600, textWrap: "pretty" }}>
                      Sto det «som den er», «som forevist» eller lignende i kontrakten eller annonsen?
                    </h2>
                    <div role="radiogroup" aria-labelledby="som-den-er" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
                      {SOM_DEN_ER.map((o, i) => (
                        <button
                          key={o.id}
                          type="button"
                          role="radio"
                          aria-checked={somDenEr === o.id}
                          onClick={() => setSomDenEr(o.id)}
                          className="rk-kat"
                          style={{ ...kort(somDenEr === o.id, pop(9 + i)), display: "flex", alignItems: "center", gap: 12, padding: "15px 16px" }}
                        >
                          <Radiomerke valgt={somDenEr === o.id} />
                          <span style={{ fontSize: 15, fontWeight: 500 }}>{o.navn}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {step === 1 && (
              <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 36 }}>
                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={OVERLINE}>Steg 2 av {STEPS.length} · Feilen</span>
                  <h1 style={H1}>Hva er galt med bilen?</h1>
                  <p style={INGRESS}>Velg ett eller flere områder. Du beskriver dem nærmere i neste steg.</p>
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
                        style={{
                          ...KNAPP,
                          display: "flex",
                          flexDirection: "column",
                          gap: 18,
                          padding: "14px 14px 16px",
                          borderRadius: 12,
                          border: `1.5px solid ${sel ? A : LINE}`,
                          background: sel ? AS : "#fff",
                          transition: "border-color .2s,background .2s,transform .15s,box-shadow .2s",
                          animation: pop(i),
                        }}
                      >
                        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ font: `500 11px ${MONO}`, color: "#8a8f93" }}>{o.kode}</span>
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 5,
                              border: `1.5px solid ${sel ? A : "#b4b8bc"}`,
                              background: sel ? A : "#fff",
                              display: "grid",
                              placeItems: "center",
                              transition: "all .2s",
                            }}
                          >
                            {sel && <Hake />}
                          </span>
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>{o.navn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 32 }}>
                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={OVERLINE}>Steg 3 av {STEPS.length} · Detaljer</span>
                  <h1 style={H1}>Beskriv feilene</h1>
                  <p style={INGRESS}>
                    Tiden regnes fra overtakelsen. {beskrevet} av {valgte.length} områder er besvart.
                  </p>
                </header>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {valgte.map((h, i) => {
                    const d = detaljer[h.id] ?? {};
                    const besvart = besvarteMed(h.id, tid, detaljer);
                    const done = besvart === 3;
                    const open = apenId === h.id;
                    const sammendrag = [
                      d.beskrivelse?.trim(),
                      ...h.under.filter((u) => valg[h.id].includes(u.id)).map((u) => u.navn),
                      VISTE_SEG_VALG.find((t) => t.id === tid[h.id])?.navn,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <div
                        key={h.id}
                        style={{
                          background: "#fff",
                          border: `1.5px solid ${open ? A : LINE}`,
                          borderRadius: 14,
                          overflow: "hidden",
                          boxShadow: open ? "0 8px 28px rgba(20,30,50,.08)" : "none",
                          transition: "border-color .25s,box-shadow .25s",
                          animation: pop(i),
                        }}
                      >
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setApent(open ? null : h.id)}
                          style={{ ...KNAPP, width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 18px" }}
                        >
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              flex: "none",
                              borderRadius: "50%",
                              display: "grid",
                              placeItems: "center",
                              font: `600 12px ${MONO}`,
                              background: done ? A : "#fff",
                              border: `1.5px solid ${done ? A : open ? INK : LINE}`,
                              color: open ? INK : "#8a8f93",
                              transition: "all .3s",
                            }}
                          >
                            {done ? <Hake /> : i + 1}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 16, fontWeight: 600 }}>{h.navn}</span>
                            {!open && sammendrag && (
                              <span style={{ fontSize: 13.5, color: "#5f6468", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sammendrag}</span>
                            )}
                          </span>
                          {!open && <span style={{ fontSize: 13, fontWeight: 600, color: done ? A : "#8a8f93", whiteSpace: "nowrap" }}>{done ? "Endre" : `${besvart} av 3`}</span>}
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            aria-hidden="true"
                            style={{ flex: "none", transform: `rotate(${open ? 180 : 0}deg)`, transition: "transform .3s cubic-bezier(.22,1,.36,1)" }}
                          >
                            <path d="M3.5 5.5L7 9l3.5-3.5" fill="none" stroke="#5f6468" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {open && (
                          <div style={{ padding: isDesktop ? "4px 18px 22px 60px" : "4px 18px 22px", display: "flex", flexDirection: "column", gap: 22 }}>
                            <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, fontWeight: 600, animation: pop(0) }}>
                              <span>
                                Hva er feil? <span style={{ fontWeight: 400, color: "#5f6468" }}>(valgfritt)</span>
                              </span>
                              <input
                                value={d.beskrivelse ?? ""}
                                onChange={(e) => {
                                  const beskrivelse = e.target.value;
                                  setDetaljer((v) => ({ ...v, [h.id]: { ...v[h.id], beskrivelse } }));
                                }}
                                placeholder="Feilen er at …"
                                maxLength={200}
                                className="rk-input"
                                style={{
                                  height: 48,
                                  border: `1.5px solid ${LINE}`,
                                  borderRadius: 10,
                                  padding: "0 14px",
                                  font: `400 15px ${SANS}`,
                                  color: INK,
                                  outline: "none",
                                  background: "#fff",
                                }}
                              />
                            </label>
                            {h.under.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: pop(1) }}>
                                <span style={{ fontSize: 14, fontWeight: 600 }}>Hva gjelder feilen?</span>
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
                              </div>
                            )}
                            <div style={{ animation: pop(2) }}>
                              <Chipvalg
                                sporsmal="Når viste feilen seg?"
                                etikett={`Når viste ${h.navn} seg?`}
                                valg={VISTE_SEG_VALG}
                                valgt={tid[h.id]}
                                velg={(t) => settTid(h.id, t)}
                              />
                            </div>
                            <div style={{ animation: pop(3) }}>
                              <Chipvalg
                                sporsmal="Har et verksted undersøkt feilen?"
                                etikett={`Har et verksted undersøkt ${h.navn}?`}
                                valg={KILDE}
                                valgt={d.verksted}
                                velg={(k) => settDetalj(h.id, { verksted: k })}
                              />
                            </div>
                            <div style={{ animation: pop(4) }}>
                              <Chipvalg
                                sporsmal="Skrev eller sa selger noe om dette før kjøpet, for eksempel i annonse, kontrakt eller melding?"
                                etikett={`Skrev eller sa selger noe om ${h.navn} før kjøpet?`}
                                valg={KILDE}
                                valgt={d.opplysning}
                                velg={(k) => settDetalj(h.id, { opplysning: k })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {valgte.some((h) => tid[h.id] === "over_24_mnd") && (
                  <Fristvarsel>En eller flere feil viste seg mer enn to år etter overtakelsen. Reklamasjon for disse kan være for sent fremsatt, med mindre delen er ment å vare vesentlig lenger.</Fristvarsel>
                )}
              </div>
            )}

            {step === 3 && (
              <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 36 }}>
                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={OVERLINE}>Steg 4 av {STEPS.length} · Krav</span>
                  <h1 style={H1}>Hva krever du av forhandleren?</h1>
                  <p style={INGRESS}>Rettighetene ved mangel følger av forbrukerkjøpsloven. Velg det kravet som best beskriver ønsket løsning.</p>
                </header>
                <div role="radiogroup" aria-label="Krav" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 10 }}>
                  {KRAV.map((o, i) => (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={krav === o.id}
                      onClick={() => setKrav(o.id)}
                      className="rk-kat"
                      style={{ ...kort(krav === o.id, pop(i)), borderRadius: 12, display: "flex", flexDirection: "column", gap: 10, padding: 18 }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Radiomerke valgt={krav === o.id} />
                        <span style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>{o.navn}</span>
                        {o.merke && (
                          <span
                            style={{
                              font: `600 10.5px ${MONO}`,
                              letterSpacing: ".05em",
                              textTransform: "uppercase",
                              color: A,
                              background: "oklch(0.94 0.03 255)",
                              padding: "3px 7px",
                              borderRadius: 5,
                            }}
                          >
                            {o.merke}
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 14, lineHeight: 1.5, color: "#5f6468", paddingLeft: 30, textWrap: "pretty" }}>{o.tekst}</span>
                    </button>
                  ))}
                </div>

                <div style={{ animation: pop(3) }}>
                  <Chipvalg sporsmal="Har selger forsøkt å reparere feilene?" valg={RETTINGSFORSOK} valgt={forsok} velg={setForsok} />
                </div>

                {skriftligVerksted && (
                  <div style={{ animation: pop(4) }}>
                    <div style={{ maxWidth: 320 }}>
                      <Tallfelt etikett="Kostnadsoverslag for utbedring" hjelp="Fra verkstedets skriftlige vurdering. Valgfritt." enhet="kr" verdi={overslag} sett={setOverslag} maks={7} />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  role="checkbox"
                  aria-checked={kreverUtlegg}
                  onClick={() => setKreverUtlegg(!kreverUtlegg)}
                  style={{ ...kort(kreverUtlegg, pop(5)), borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px" }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      flex: "none",
                      marginTop: 1,
                      borderRadius: 5,
                      border: `1.5px solid ${kreverUtlegg ? A : "#b4b8bc"}`,
                      background: kreverUtlegg ? A : "#fff",
                      display: "grid",
                      placeItems: "center",
                      transition: "all .2s",
                    }}
                  >
                    {kreverUtlegg && <Hake />}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>Jeg krever i tillegg erstatning for utlegg</span>
                    <span style={{ fontSize: 14, color: "#5f6468", lineHeight: 1.5 }}>For eksempel tauing, feilsøking eller leiebil.</span>
                  </span>
                </button>

                {kreverUtlegg && (
                  <section style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: -16, animation: pop(0) }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Legg til utlegg</h2>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {UTLEGG_FORSLAG.map((l, i) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setUtlegg((u) => [...u, { beskrivelse: l, belop: "" }])}
                            className="rk-chip rk-forslag"
                            style={{ ...chip(false), display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", animation: pop(i) }}
                          >
                            <span style={{ color: A, fontWeight: 600 }}>+</span>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    {utlegg.length > 0 && (
                      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden" }}>
                        {utlegg.map((x, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderTop: i ? "1px solid #eeeeeb" : "none", animation: pop(0) }}>
                            <input
                              value={x.beskrivelse}
                              onChange={(e) => settUtlegg(i, { beskrivelse: e.target.value })}
                              placeholder="Beskrivelse"
                              aria-label="Beskrivelse av utlegget"
                              maxLength={100}
                              className="rk-input"
                              style={{
                                flex: 1,
                                minWidth: 0,
                                height: 44,
                                border: `1.5px solid ${LINE}`,
                                borderRadius: 9,
                                padding: "0 12px",
                                font: `15px ${SANS}`,
                                color: INK,
                                outline: "none",
                                background: "#fff",
                              }}
                            />
                            <span
                              className="rk-felt"
                              style={{ display: "flex", alignItems: "center", width: 128, flex: "none", height: 44, border: `1.5px solid ${LINE}`, borderRadius: 9, background: "#fff", overflow: "hidden", boxSizing: "border-box" }}
                            >
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
                            <button
                              type="button"
                              onClick={() => setUtlegg((u) => u.filter((_, j) => j !== i))}
                              aria-label="Fjern"
                              className="rk-tilbake"
                              style={{ ...KNAPP, width: 32, height: 32, flex: "none", borderRadius: 8, display: "grid", placeItems: "center", color: "#8a8f93", fontSize: 18 }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "#f8f8f6", borderTop: "1px solid #eeeeeb" }}>
                          <button
                            type="button"
                            onClick={() => setUtlegg((u) => [...u, { beskrivelse: "", belop: "" }])}
                            style={{ ...KNAPP, fontSize: 14, fontWeight: 600, color: A }}
                          >
                            + Legg til annet utlegg
                          </button>
                          <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                            <span style={{ fontSize: 13, color: "#5f6468" }}>Sum</span>
                            <span style={{ font: `600 16px ${MONO}` }}>{tall(String(utleggSum))} kr</span>
                          </span>
                        </div>
                      </div>
                    )}
                    <div role="note" style={{ background: "#eef0f1", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12, fontSize: 14, lineHeight: 1.5, color: "#2c3033" }}>
                      <span aria-hidden="true" style={{ font: `600 14px ${MONO}`, color: A }}>
                        !
                      </span>
                      <span style={{ textWrap: "pretty" }}>Husk å legge ved kopi av fakturaer og kvitteringer når du sender brevet. Vedleggene listes opp i brevet.</span>
                    </div>
                  </section>
                )}

                <section style={{ display: "flex", flexDirection: "column", gap: 14, animation: pop(6) }}>
                  <Chipvalg sporsmal="Har du allerede reklamert til selger?" valg={TIDLIGERE} valgt={tidligere} velg={setTidligere} />
                  {tidligere && tidligere !== "nei" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: pop(0) }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Når reklamerte du?</span>
                      <Datovelger etikett="Dato for tidligere reklamasjon" verdi={tidligereDato} min={kjopsdato} maks={idag} sett={setTidligereDato} />
                      {tidligereDato && !tidligereDatoOk && (
                        <span role="alert" style={{ fontSize: 13, color: "#a3372b" }}>
                          Datoen må ligge mellom kjøpsdatoen og i dag.
                        </span>
                      )}
                    </div>
                  )}
                </section>

                <section style={{ display: "flex", flexDirection: "column", gap: 14, animation: pop(7) }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Hvem kjøpte du bilen av?</h2>
                    <p style={{ margin: 0, fontSize: 14, color: "#5f6468" }}>Søk på navnet eller org.nr. fra kjøpekontrakten. Brevet adresseres til selgeren slik Enhetsregisteret oppgir den.</p>
                  </div>
                  <Selgervalg valgt={selger} velg={setSelger} />
                </section>
              </div>
            )}

            {step === BREV && (!funn || (funn.ok && !brevet)) && (
              <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 28 }}>
                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={OVERLINE}>Steg 5 av {STEPS.length} · Brev</span>
                  <h1 style={H1}>Vent mens vi lager brevet</h1>
                  <p style={INGRESS}>Vi leter i vedtakene fra Forbrukerklageutvalget etter en lignende sak der kjøperen fikk medhold, og setter sammen brevet. Det tar noen sekunder.</p>
                </header>
                <div role="status" aria-label="Vent mens vi lager brevet" style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: isDesktop ? "28px 32px" : "22px 20px", display: "flex", flexDirection: "column", gap: 12, animation: pop(0) }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 22, height: 22, boxSizing: "border-box", borderRadius: "50%", border: `2px solid ${AS}`, borderTopColor: A, animation: "rkSpin .7s linear infinite", marginBottom: 6 }}
                  />
                  <span aria-hidden="true" style={{ height: 14, width: "92%", borderRadius: 4, background: "#ecedea", animation: "rkShimmer 1.1s ease-in-out infinite" }} />
                  <span aria-hidden="true" style={{ height: 14, width: "78%", borderRadius: 4, background: "#ecedea", animation: "rkShimmer 1.1s ease-in-out .15s infinite" }} />
                  <span aria-hidden="true" style={{ height: 14, width: "85%", borderRadius: 4, background: "#ecedea", animation: "rkShimmer 1.1s ease-in-out .3s infinite" }} />
                </div>
              </div>
            )}

            {step === BREV && ((funn && !funn.ok) || (brevet && !brevet.ok)) && (
              <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 20 }}>
                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={OVERLINE}>Steg 5 av {STEPS.length} · Brev</span>
                  <h1 style={H1}>Vi fikk ikke laget brevet</h1>
                </header>
                <p role="alert" style={{ margin: 0, padding: "18px 22px", fontSize: 14, color: "#a3372b", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14 }}>
                  {funn && !funn.ok ? funn.melding : brevet && !brevet.ok ? brevet.melding : ""}
                </p>
                <button
                  type="button"
                  onClick={lagBrev}
                  disabled={soker}
                  className="rk-neste"
                  style={{ ...KNAPP, height: 50, padding: "0 26px", borderRadius: 10, fontSize: 15, fontWeight: 600, color: "#fff", background: A, alignSelf: "flex-start" }}
                >
                  Prøv igjen
                </button>
              </div>
            )}

            {step === BREV && brevet?.ok && (
              <div style={{ animation: stepAnim, display: "flex", flexDirection: "column", gap: 24 }}>
                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={OVERLINE}>Steg 5 av {STEPS.length} · Brev</span>
                  <h1 style={H1}>{brevet.fullt ? "Ditt reklamasjonsbrev" : "Forhåndsvisning av brevet"}</h1>
                  <p style={INGRESS}>
                    {brevet.fullt
                      ? "Les gjennom brevet før du sender det. Du kan kopiere teksten eller laste det ned som Word-dokument."
                      : "Dette er sakens bakgrunn og avsnittet som viser til en lignende sak der kjøperen fikk medhold. Resten av brevet er skjult til du har betalt."}
                  </p>
                </header>

                {brevet.fullt && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <button type="button" onClick={() => kopier(brevet.brev)} className="rk-neste" style={{ ...KNAPP, height: 46, padding: "0 20px", borderRadius: 10, fontSize: 15, fontWeight: 600, color: "#fff", background: A }}>
                      {kopiert ? "Kopiert" : "Kopier tekst"}
                    </button>
                    <button type="button" onClick={() => lastNed(brevet.brev)} className="rk-tilbake" style={{ ...KNAPP, height: 46, padding: "0 20px", borderRadius: 10, fontSize: 15, fontWeight: 600, color: INK, border: `1.5px solid ${LINE}`, background: "#fff" }}>
                      Last ned som Word
                    </button>
                  </div>
                )}

                <Brevvisning brev={brevet.brev} bred={isDesktop} />

                {!brevet.fullt && (
                  <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: isDesktop ? "24px 28px" : "20px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Få hele brevet</h2>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#5f6468" }}>
                      Hele brevet har mangel, rettslig vurdering, krav og frist for svar, ferdig utfylt med dine opplysninger. Du får det etter betaling med Vipps.
                    </p>
                    <button type="button" disabled style={{ ...KNAPP, height: 50, padding: "0 26px", borderRadius: 10, fontSize: 15, fontWeight: 600, color: "#fff", background: "#c4c7ca", cursor: "not-allowed", alignSelf: "flex-start" }}>
                      Betal med Vipps (kommer)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ background: "#fff", borderTop: `1px solid ${LINE}`, padding: "14px 20px" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={() => step > 0 && go(step - 1)}
              className="rk-tilbake"
              style={{
                ...KNAPP,
                height: 50,
                padding: "0 18px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                color: INK,
                opacity: step === 0 ? 0 : 1,
                transition: "opacity .2s,background .2s",
              }}
            >
              Tilbake
            </button>
            {step < BREV && (
              <button
                type="button"
                onClick={() => ok && (step === BREV - 1 ? lagBrev() : go(step + 1))}
                className="rk-neste"
                style={{
                  ...KNAPP,
                  height: 50,
                  padding: "0 26px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#fff",
                  background: ok ? A : "#c4c7ca",
                  cursor: ok ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: isDesktop ? "0 0 auto" : "1",
                  transition: "background .25s,transform .15s",
                }}
              >
                {step < BREV - 1 ? "Fortsett" : "Lag brev"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
