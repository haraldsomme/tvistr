// The pieces of the form shared by its steps (skjema.tsx) and the assessment (vurderingsvisning.tsx),
// ported from the mockups (ReklamasjonSkjema.dc.html, «Tvistr onboarding v2»): the same markup, inline
// styles and animations. The keyframes and the hover/active rules live in globals.css under `.rk`.
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { type CSSProperties, useEffect, useState, useSyncExternalStore } from "react";
import { nb } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type Forslag, tittel as tittelNavn } from "@/lib/brreg";
import { type Linje, tilDokument } from "@/lib/brev/brev";
import { fristTekst } from "@/lib/brev/tidslinje";
import type { Lovversjon } from "@/lib/brev/paragrafer";
import type { Brev } from "@/lib/brev/typer";
import type { RapportPunkt, VerkstedHvem } from "@/lib/brev/rapport";

export const A = "oklch(0.47 0.12 255)",
  AS = "oklch(0.965 0.018 255)",
  LINE = "#e2e3e0",
  INK = "#16181a";
export const SANS = "var(--font-instrument), system-ui, sans-serif";
export const MONO = "var(--font-jbmono), monospace";

// The answers are compared with the decisions (src/lib/matching/) and put into the letter (src/lib/brev/).
export const SOM_DEN_ER = [
  { id: "ja", navn: "Ja" },
  { id: "nei", navn: "Nei" },
  { id: "vet_ikke", navn: "Vet ikke" },
] as const;
export type SomDenEr = (typeof SOM_DEN_ER)[number]["id"];
export const KILDE = [
  { id: "skriftlig", navn: "Ja, skriftlig" },
  { id: "muntlig", navn: "Ja, muntlig" },
  { id: "nei", navn: "Nei" },
] as const;
export type Kilde = (typeof KILDE)[number]["id"];
// What the buyer fills in about a written workshop report (a field is text as typed; the server cleans it).
export type RapportSkjema = { hvem?: VerkstedHvem; navn: string; dato: string; punkter: RapportPunkt[]; konklusjon: string; overslag: string };
export const TOM_RAPPORT: RapportSkjema = { navn: "", dato: "", punkter: [], konklusjon: "", overslag: "" };
// Per main category: a free-text line, whether a workshop examined it, and whether the seller said
// anything about it before the sale. With a written workshop assessment: the report.
// The day the defect was discovered, whether it is approximate, and whether the buyer has checked an
// approximate day near a deadline.
export type Detalj = { oppdaget?: string; omtrentlig?: boolean; bekreftet?: boolean; beskrivelse?: string; verksted?: Kilde; opplysning?: Kilde; rapport?: RapportSkjema };
export type Krav = "retting" | "prisavslag" | "heving";
export const KRAV: { id: Krav; navn: string; merke?: string; tekst: string }[] = [
  { id: "retting", navn: "Retting", merke: "Vanligst", tekst: "Forhandleren utbedrer feilen uten kostnad for deg. Dette er normalt første steg." },
  { id: "prisavslag", navn: "Prisavslag", tekst: "Du beholder bilen og får kjøpesummen redusert tilsvarende mangelen." },
  { id: "heving", navn: "Heving", tekst: "Kjøpet omgjøres, og kjøpesummen tilbakebetales. Forutsetter at mangelen ikke er uvesentlig." },
];
export const RETTINGSFORSOK = [
  { id: 0, navn: "Nei" },
  { id: 1, navn: "1 gang" },
  { id: 2, navn: "2 ganger" },
  { id: 3, navn: "3 eller flere" },
] as const;
// «Kontakt med selger»: has the buyer complained before, and how.
export const JA_NEI = [
  { id: "ja", navn: "Ja" },
  { id: "nei", navn: "Nei" },
] as const;
export type Reklamert = (typeof JA_NEI)[number]["id"];
export const HVORDAN = [
  { id: "skriftlig", navn: "Skriftlig" },
  { id: "muntlig", navn: "Muntlig" },
] as const;
export type Hvordan = (typeof HVORDAN)[number]["id"];
export const UTLEGG_FORSLAG = ["Tauing", "Feilsøking", "Leiebil", "Verkstedregning"];
export type Utlegg = { beskrivelse: string; belop: string };

// Digits with a space every third place: 84210 → «84 210».
export const tall = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
export const kunSifre = (s: string, maks: number) => s.replace(/\D/g, "").replace(/^0+/, "").slice(0, maks);

export const pop = (i: number) => `rkPop 560ms cubic-bezier(.22,1,.36,1) ${70 + i * 45}ms backwards`;
export const datoTekst = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const KNAPP: CSSProperties = {
  all: "unset",
  boxSizing: "border-box",
  cursor: "pointer",
};
export const OVERLINE: CSSProperties = {
  font: `600 11px ${MONO}`,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: A,
};
export const H1: CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.15,
  fontWeight: 600,
  letterSpacing: "-0.02em",
  textWrap: "pretty",
};
export const INGRESS: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.5,
  color: "#5f6468",
  textWrap: "pretty",
};

export function Hake() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: "rkCheck 320ms cubic-bezier(.34,1.56,.64,1) both" }}>
      <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const chip = (sel: boolean): CSSProperties => ({
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
export function Chipvalg<T extends string | number>({
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

export function Radiomerke({ valgt }: { valgt: boolean }) {
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

export const kort = (sel: boolean, anim: string): CSSProperties => ({
  ...KNAPP,
  borderRadius: 11,
  border: `1.5px solid ${sel ? A : LINE}`,
  background: sel ? AS : "#fff",
  transition: "border-color .2s,background .2s,transform .15s,box-shadow .2s",
  animation: anim,
});

// A tick: one thing the report says. Looks like the checkbox for expenses in step 4.
export function Avkrysning({ valgt, velg, children }: { valgt: boolean; velg: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={valgt}
      onClick={velg}
      className="rk-kat"
      style={{ ...kort(valgt, "none"), borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", textAlign: "left", width: "100%" }}
    >
      <span
        style={{ width: 18, height: 18, flex: "none", marginTop: 1, borderRadius: 5, border: `1.5px solid ${valgt ? A : "#b4b8bc"}`, background: valgt ? A : "#fff", display: "grid", placeItems: "center", transition: "all .2s" }}
      >
        {valgt && <Hake />}
      </span>
      <span style={{ fontSize: 14.5, lineHeight: 1.45, textWrap: "pretty" }}>{children}</span>
    </button>
  );
}

// Every notice in the form is one of three kinds, drawn the same way: a tinted box that starts with an icon (! by default, § for the law), 14px text and a bold lead line.
// stopp (red) blocks the user, advarsel (amber) only warns, info (grey) reminds.
export const VARSEL = {
  stopp: { bg: "oklch(0.96 0.03 25)", merke: "#a3372b", role: "alert" },
  advarsel: { bg: "oklch(0.96 0.04 75)", merke: "oklch(0.5 0.13 60)", role: "note" },
  info: { bg: "#eef0f1", merke: A, role: "note" },
} as const;

export function Varsel({ type, ikon, tittel, children, ...rest }: { type: keyof typeof VARSEL; ikon?: string; tittel?: React.ReactNode; children?: React.ReactNode } & { [k in `data-${string}`]?: boolean }) {
  const v = VARSEL[type];
  return (
    <div role={v.role} {...rest} style={{ background: v.bg, borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12, animation: pop(0) }}>
      <span aria-hidden="true" style={{ font: `600 15px ${MONO}`, color: v.merke, lineHeight: 1.4, flex: "none", width: 10, textAlign: "center" }}>
        {ikon ?? "!"}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 14, lineHeight: 1.5, color: "#2c3033", textWrap: "pretty" }}>
        {tittel && <strong style={{ fontWeight: 600 }}>{tittel}</strong>}
        {children}
      </div>
    </div>
  );
}

// The messages at a field: what stops in red, what only warns in amber.
export function Merknader({ stopp = [], advarsler = [] }: { stopp?: { melding: string }[]; advarsler?: { melding: string }[] }) {
  if (!stopp.length && !advarsler.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {stopp.map((m) => (
        <Varsel key={m.melding} type="stopp">
          {m.melding}
        </Varsel>
      ))}
      {advarsler.map((m) => (
        <Varsel key={m.melding} type="advarsel" data-advarsel>
          {m.melding}
        </Varsel>
      ))}
    </div>
  );
}

// A number with a unit after it, shown with thousands spaces; the value is kept as digits only.
export function Tallfelt({ etikett, hjelp, enhet, verdi, sett, maks }: { etikett: string; hjelp?: string; enhet: string; verdi: string; sett: (v: string) => void; maks: number }) {
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

// fkjl. § 27: the limits for complaining, shown where a date or a choice puts them in doubt.
export function Fristvarsel({ v, children }: { v: Lovversjon; children: React.ReactNode }) {
  return (
    <Varsel type="advarsel" ikon="§" tittel={children}>
      <span>{fristTekst(v)}</span>
    </Varsel>
  );
}

// A date: the phone's own picker on a touch screen, the calendar with a mouse.
export function Datovelger({ etikett, verdi, sett, min, maks }: { etikett: string; verdi: string; sett: (iso: string) => void; min?: string; maks: string }) {
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
export type Selger = { orgnr: string; navn: string; kommune: string | null; status: "konkurs" | "avvikling" | null; naeringskode: string | null };
export const orgnrTekst = (o: string) => o.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
export const STATUS = { konkurs: "Registrert som konkurs", avvikling: "Under avvikling" } as const;

export function Selgervalg({ valgt, velg }: { valgt: Selger | null; velg: (s: Selger | null) => void }) {
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
      {feil && !soker && s.length >= 3 && <Varsel type="stopp">Vi fikk ikke kontakt med Enhetsregisteret. Prøv igjen om litt.</Varsel>}
      {treff.length > 0 && (
        <div role="listbox" aria-label="Treff i Enhetsregisteret" style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden" }}>
          {treff.map((f, i) => (
            <button
              key={f.orgnr}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => velg({ orgnr: f.orgnr, navn: tittelNavn(f.navn), kommune: f.kommune, status: f.status, naeringskode: f.naeringskode })}
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
          Ingen treff. Prøv navnet slik det står i kontrakten, eller organisasjonsnummeret. Vi søker ikke etter enkeltpersonforetak, fordi navnet på dem er et personnavn.
        </span>
      )}
    </div>
  );
}

// The letter as the buyer sees it: the same lines as «Kopier tekst» and the Word file (tilDokument),
// set as an A4 sheet with the Word file's margins and a serif text face. A hidden block, before
// payment, is drawn as grey bars the length of the text it stands for.
export const BREV_FONT = "var(--font-brev)";
export function Brevvisning({ brev, bred }: { brev: Brev; bred: boolean }) {
  const grupper = tilDokument(brev);
  const tekst: CSSProperties = { margin: 0, fontFamily: BREV_FONT, fontSize: "11.5pt", lineHeight: 1.5, color: "#111", textWrap: "pretty" };
  const [forste, andre, ...resten] = grupper;
  // Sender top left and place and date top right, when both are there.
  const harDato = andre?.[0]?.stil === "stedDato";
  const toppRad = forste?.[0]?.stil === "adresse" && harDato;
  const rest = toppRad ? resten : grupper.slice(forste?.[0]?.stil === "stedDato" ? 1 : 0);
  const linjer = (g: Linje[]) =>
    g.map((l, i) => (
      <span key={i} style={{ display: "block", ...(l.stil === "vedleggOverskrift" && { fontWeight: 700 }), ...(l.stil === "hilsen" && i > 0 && { marginTop: "26pt" }) }}>
        {l.tekst}
      </span>
    ));
  return (
    <article
      aria-label="Reklamasjonsbrev"
      style={{
        boxSizing: "border-box",
        width: "210mm",
        maxWidth: "100%",
        minHeight: bred ? "297mm" : undefined,
        margin: "0 auto",
        padding: bred ? "20mm 23mm 25mm" : "28px 22px 40px",
        background: "#fff",
        border: "1px solid #e4e4e0",
        boxShadow: "0 1px 2px rgba(20, 30, 50, .05), 0 14px 36px rgba(20, 30, 50, .10)",
        display: "flex",
        flexDirection: "column",
        gap: "12pt",
        animation: pop(0),
      }}
    >
      {toppRad ? (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "6pt 24pt", ...tekst, marginBottom: "18pt" }}>
          <div>{linjer(forste)}</div>
          <div style={{ textAlign: "right" }}>{linjer(andre)}</div>
        </div>
      ) : (
        grupper[0]?.[0]?.stil === "stedDato" && <div style={{ ...tekst, textAlign: "right", marginBottom: "18pt" }}>{linjer(grupper[0])}</div>
      )}
      {rest.map((g, i) => {
        const stil = g[0].stil;
        if (g[0].skjult !== undefined) {
          const antall = Math.max(1, Math.round(g[0].skjult / 90));
          return (
            <div key={i} aria-hidden="true" data-skjult style={{ display: "flex", flexDirection: "column", gap: "7pt", padding: "2pt 0", filter: "blur(2.5px)", userSelect: "none" }}>
              {Array.from({ length: antall }, (_, j) => (
                <span key={j} style={{ height: "8.5pt", width: j === antall - 1 ? `${55 + ((i * 17) % 35)}%` : "100%", borderRadius: 2, background: "#dedfdb" }} />
              ))}
            </div>
          );
        }
        if (stil === "overskrift") return <h2 key={i} style={{ ...tekst, fontWeight: 700, margin: "10pt 0 -5pt" }}>{g[0].tekst}</h2>;
        if (stil === "tittel") return <h1 key={i} style={{ ...tekst, fontWeight: 700, fontSize: "13pt", margin: "18pt 0 2pt" }}>{g[0].tekst}</h1>;
        if (stil === "adresse") return <div key={i} style={{ ...tekst, marginBottom: "6pt" }}>{linjer(g)}</div>;
        if (stil === "hilsen") return <div key={i} style={{ ...tekst, marginTop: "14pt" }}>{linjer(g)}</div>;
        if (stil === "vedleggOverskrift") return <div key={i} style={{ ...tekst, marginTop: "20pt" }}>{linjer(g)}</div>;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: "3pt" }}>
            <p style={tekst}>{g[0].tekst}</p>
            {g[0].lenke && (
              <a href={g[0].lenke} target="_blank" rel="noopener noreferrer" style={{ ...tekst, fontSize: "10pt", color: A, textDecoration: "underline", textUnderlineOffset: 3, alignSelf: "flex-start" }}>
                Les vedtaket
              </a>
            )}
          </div>
        );
      })}
    </article>
  );
}

// A question answered with one radio card, as in the mockup («Stemmer dette?», «som den er»).
export function Radiovalg<T extends string>({
  id,
  sporsmal,
  hjelp,
  valg,
  valgt,
  velg,
  min = 150,
}: {
  id: string;
  sporsmal: string;
  hjelp?: string;
  valg: readonly { id: T; navn: string }[];
  valgt: T | null | undefined;
  velg: (id: T) => void;
  min?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <h2 id={id} style={{ margin: 0, fontSize: 15, lineHeight: 1.4, fontWeight: 600, textWrap: "pretty" }}>
          {sporsmal}
        </h2>
        {hjelp && <span style={{ fontSize: 13.5, lineHeight: 1.45, color: "#5f6468" }}>{hjelp}</span>}
      </div>
      <div role="radiogroup" aria-labelledby={id} style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${min}px,1fr))`, gap: 10 }}>
        {valg.map((o, i) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={valgt === o.id}
            onClick={() => velg(o.id)}
            className="rk-kat"
            style={{ ...kort(valgt === o.id, pop(i)), display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}
          >
            <Radiomerke valgt={valgt === o.id} />
            <span style={{ fontSize: 15, fontWeight: 500 }}>{o.navn}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// The number plate, as the registry writes the number.
export function Skilt({ regnr, stor }: { regnr: string; stor?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", border: `2px solid ${INK}`, borderRadius: 7, overflow: "hidden", background: "#fff", height: stor ? 58 : 44, alignSelf: "flex-start" }}>
      <div
        aria-hidden="true"
        style={{ width: stor ? 28 : 22, background: "oklch(0.42 0.15 262)", color: "#fff", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 5, boxSizing: "border-box", font: `700 10px ${SANS}` }}
      >
        N
      </div>
      <span style={{ display: "flex", alignItems: "center", padding: "0 12px", font: `600 ${stor ? 25 : 19}px ${MONO}`, letterSpacing: ".06em" }}>{regnr}</span>
    </div>
  );
}

// A line in «Dette får du» and «Lås opp hele brevet».
export function Punkt({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.45 }}>
      <span aria-hidden="true" style={{ width: 20, height: 20, flex: "none", borderRadius: "50%", background: AS, display: "grid", placeItems: "center" }}>
        <svg width="11" height="11" viewBox="0 0 12 12">
          <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke={A} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>{children}</span>
    </div>
  );
}

// A large button: the accent, black (to an outside page) or outlined.
export const storKnapp = (type: "aksent" | "svart" | "kant" | "vipps" | "av"): CSSProperties => ({
  ...KNAPP,
  minHeight: 50,
  padding: "12px 26px",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  fontSize: 15,
  fontWeight: type === "vipps" ? 700 : 600,
  color: type === "kant" ? INK : "#fff",
  background: { aksent: A, svart: INK, kant: "#fff", vipps: "#ff5b24", av: "#c4c7ca" }[type],
  border: type === "kant" ? `1.5px solid ${LINE}` : "none",
  cursor: type === "av" ? "not-allowed" : "pointer",
});
