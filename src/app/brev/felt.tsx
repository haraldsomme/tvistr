"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { norskDato, vedleggFor } from "@/lib/brev/brev";
import {
  BESKRIVELSE_MAKS,
  BESKRIVELSE_MIN,
  FORBEHOLD_VALG,
  KRAV_TYPER,
  OPPLYSNING_KILDER,
  MAKS_UTGIFTER,
  REKLAMASJON_MATER,
  UTGIFT_TYPER,
  VEDLEGG,
  type Avsender,
  type Endring,
  type Feilen,
  type Forbehold,
  type Krav,
  type Opplysning,
  type Reklamasjon,
  type Utfylling,
  type Utgift,
  type Vedlegg,
} from "@/lib/brev/utfylling";
import {
  gyldigRetting,
  rettingValgFor,
  type KlageInput,
  type Retting,
} from "@/lib/vurdering/typer";

// The fields of the fill-in steps on the letter page. Each shows a summary when its step is done
// and a form when it is active. `lagre` saves with the case and says whether that worked; `avbryt`
// is there when the user is changing a step that was already done.

type Felles = { aktiv: boolean; lagre: (endring: Endring) => Promise<boolean>; avbryt?: () => void };

export const LABEL = "text-[13px] font-semibold";
const INPUT = "w-full rounded-[6px] border border-[#bfbab0] bg-white px-3.5 py-3 text-[16px] placeholder:text-[#8a94a3]";
export const HJELP = "m-0 text-[13px] leading-[1.5] text-[#5b6472]";

export const kroner = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
export const gruppert = (siffer: string) => siffer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
export const bareSiffer = (s: string, maks = 8) => s.replace(/\D/g, "").replace(/^0+/, "").slice(0, maks);

export function Sammendrag({ linjer }: { linjer: ReactNode[] }) {
  return (
    <div className="flex flex-col gap-0.5 text-[14px] leading-[1.45] text-[#3d4757]">
      {linjer.filter(Boolean).map((l, n) => (
        <span key={n}>{l}</span>
      ))}
    </div>
  );
}

// The form of a step: saves on submit and shows the two buttons.
export function Skjema({ klar, send, avbryt, children, knapp = "Lagre" }: { klar: boolean; send: () => Promise<boolean>; avbryt?: () => void; children: ReactNode; knapp?: string }) {
  const [lagrer, setLagrer] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!klar || lagrer) return;
    setLagrer(true);
    await send();
    setLagrer(false);
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {children}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!klar || lagrer} className="rounded-[6px] bg-[#17263d] px-[18px] py-[11px] text-[14px] font-semibold text-[#f6f4ef] disabled:bg-[#dcd8cf] disabled:text-[#8a94a3]">
          {lagrer ? "Lagrer …" : knapp}
        </button>
        {avbryt && (
          <button type="button" onClick={avbryt} className="px-2.5 py-[11px] text-[14px] font-medium text-[#5b6472]">
            Avbryt
          </button>
        )}
      </div>
    </form>
  );
}

export function Tekstfelt({ label, hjelp, ...input }: { label: string; hjelp?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input id={id} aria-describedby={hjelp ? `${id}-hjelp` : undefined} className={INPUT} {...input} />
      {hjelp && (
        <p id={`${id}-hjelp`} className={HJELP}>
          {hjelp}
        </p>
      )}
    </div>
  );
}

export function Nedtrekk({ label, children, ...select }: { label: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select id={id} className={INPUT} {...select}>
        {children}
      </select>
    </div>
  );
}

const KNAPP = "rounded-[6px] bg-[#17263d] px-[18px] py-[11px] text-[14px] font-semibold text-[#f6f4ef] disabled:bg-[#dcd8cf] disabled:text-[#8a94a3]";
const KNAPP_LYS = "rounded-[6px] border border-[#bfbab0] bg-white px-[18px] py-[11px] text-[14px] font-semibold text-[#17263d] disabled:text-[#8a94a3]";
const TEKSTOMRADE = `${INPUT} min-h-[112px] resize-y text-[15px] leading-[1.55]`;

// The defect in the buyer's own words. The language model can suggest a wording for the letter; the
// buyer then uses the suggestion (as it is or edited) or their own text. Nothing goes in the letter
// without the buyer choosing it.
export function FeilenFelt({ sakId, input, idag, verdi, aktiv, lagre, avbryt }: Felles & { sakId: string; input: KlageInput; idag: string; verdi: Feilen | undefined }) {
  const id = useId();
  const [dato, setDato] = useState(verdi?.dato ?? "");
  const [egen, setEgen] = useState(verdi?.egen ?? "");
  // The suggestion, once asked for. Starts as the saved letter text when that differs from the buyer's own.
  const [forslag, setForslag] = useState<string | null>(verdi && verdi.tekst !== verdi.egen ? verdi.tekst : null);
  const [arbeider, setArbeider] = useState<"forslag" | "lagrer" | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  if (!aktiv) {
    if (!verdi) return null;
    return <Sammendrag linjer={[`Viste seg ${norskDato(verdi.dato)}`, verdi.tekst.length > 90 ? `${verdi.tekst.slice(0, 90)}…` : verdi.tekst]} />;
  }

  const min = input.bilOgKjop.kjopsdato ?? "";
  const datoOk = dato >= min && dato <= idag;
  const egenOk = egen.trim().length >= BESKRIVELSE_MIN;
  const forslagOk = forslag !== null && forslag.trim().length >= BESKRIVELSE_MIN;

  async function lagForslag() {
    setArbeider("forslag");
    setFeil(null);
    try {
      const res = await fetch(`/api/sak/${sakId}/sprakvask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ beskrivelse: egen }) });
      const json = (await res.json()) as { forslag?: string; feil?: string };
      if (!res.ok || !json.forslag) throw new Error(json.feil ?? "");
      setForslag(json.forslag);
    } catch (e) {
      setFeil((e instanceof Error && !(e instanceof TypeError) && e.message) || "Vi klarte ikke å lage et forslag akkurat nå. Du kan bruke din egen tekst i brevet.");
    }
    setArbeider(null);
  }

  async function bruk(tekst: string) {
    setArbeider("lagrer");
    setFeil(null);
    await lagre({ feilen: { dato, egen, tekst } });
    setArbeider(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <Tekstfelt
        label="Når viste feilen seg første gang?"
        hjelp={min ? `Tidligst ${norskDato(min)}, den dagen du kjøpte bilen, og senest i dag.` : "Senest i dag."}
        type="date"
        min={min || undefined}
        max={idag}
        value={dato}
        onChange={(e) => setDato(e.target.value)}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-egen`} className={LABEL}>
          Beskriv feilen med egne ord
        </label>
        <textarea
          id={`${id}-egen`}
          aria-describedby={`${id}-egen-hjelp`}
          value={egen}
          onChange={(e) => setEgen(e.target.value.slice(0, BESKRIVELSE_MAKS))}
          placeholder="Motorlampen lyser, og bilen mister trekkraft i motbakker …"
          className={TEKSTOMRADE}
        />
        <p id={`${id}-egen-hjelp`} className={HJELP}>
          Hva skjer, hvor ofte, og hva har verkstedet funnet? Ikke skriv navn på personer. Ber du om et forslag, sendes denne teksten til en språkmodell (Claude fra Anthropic).
        </p>
      </div>
      {forslag !== null && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-forslag`} className={LABEL}>
            Forslag til tekst i brevet
          </label>
          <textarea id={`${id}-forslag`} aria-describedby={`${id}-forslag-hjelp`} value={forslag} onChange={(e) => setForslag(e.target.value.slice(0, BESKRIVELSE_MAKS))} className={TEKSTOMRADE} />
          <p id={`${id}-forslag-hjelp`} className={HJELP}>
            Les forslaget nøye. Det skal bare si det du selv har skrevet. Du kan rette i det før du bruker det.
          </p>
        </div>
      )}
      {feil && (
        <p role="alert" className="m-0 text-[13px] leading-[1.5] text-[#a23b2a]">
          {feil}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {forslag !== null && (
          <button type="button" disabled={!datoOk || !egenOk || !forslagOk || arbeider !== null} onClick={() => bruk(forslag)} className={KNAPP}>
            Bruk forslaget
          </button>
        )}
        <button type="button" disabled={!egenOk || arbeider !== null} onClick={lagForslag} className={forslag === null ? KNAPP : KNAPP_LYS}>
          {arbeider === "forslag" ? "Lager forslag …" : forslag === null ? "Lag forslag" : "Lag nytt forslag"}
        </button>
        <button type="button" disabled={!datoOk || !egenOk || arbeider !== null} onClick={() => bruk(egen)} className={KNAPP_LYS}>
          Bruk min egen tekst
        </button>
        {avbryt && (
          <button type="button" onClick={avbryt} className="px-2.5 py-[11px] text-[14px] font-medium text-[#5b6472]">
            Avbryt
          </button>
        )}
      </div>
    </div>
  );
}

const KILDE_TEKST: Record<Opplysning["kilde"], string> = { annonse: "Annonsen", kontrakt: "Kjøpekontrakten", melding: "Melding fra forhandleren", muntlig: "Muntlig før kjøpet" };

// What the ad or the dealer said that was not true. Quoted in the letter as written, so it is not reworded.
export function OpplysningFelt({ verdi, aktiv, lagre, avbryt }: Felles & { verdi: Opplysning | undefined }) {
  const id = useId();
  const [kilde, setKilde] = useState<string>(verdi?.kilde ?? "");
  const [tekst, setTekst] = useState(verdi?.tekst ?? "");
  if (!aktiv) {
    if (!verdi) return null;
    return <Sammendrag linjer={[KILDE_TEKST[verdi.kilde], `«${verdi.tekst}»`]} />;
  }
  return (
    <Skjema klar={kilde !== "" && tekst.trim().length >= 5} send={() => lagre({ opplysning: { kilde: kilde as Opplysning["kilde"], tekst } })} avbryt={avbryt}>
      <p className={HJELP}>Du har svart at annonsen eller selgeren sa noe om bilen som ikke stemte. Brevet siterer det.</p>
      <Nedtrekk label="Hvor ble det opplyst?" value={kilde} onChange={(e) => setKilde(e.target.value)}>
        <option value="">Velg</option>
        {OPPLYSNING_KILDER.map((k) => (
          <option key={k} value={k}>
            {KILDE_TEKST[k]}
          </option>
        ))}
      </Nedtrekk>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-tekst`} className={LABEL}>
          Hva ble opplyst?
        </label>
        <textarea id={`${id}-tekst`} aria-describedby={`${id}-hjelp`} value={tekst} onChange={(e) => setTekst(e.target.value.slice(0, 500))} placeholder="Ny clutch i 2025" className={`${INPUT} min-h-[76px] resize-y text-[15px] leading-[1.55]`} />
        <p id={`${id}-hjelp`} className={HJELP}>
          Skriv det så ordrett du kan. Det står i anførselstegn i brevet.
        </p>
      </div>
    </Skjema>
  );
}

export const RETTING_TEKST: Record<Retting, string> = {
  ingen: "Nei, feilen er ikke reparert",
  venter: "Forhandleren vil forsøke, eller har ikke svart ennå",
  avvist: "Forhandleren nekter å rette feilen",
  forsokt: "Forhandleren har forsøkt, uten hell",
  reparert_selv: "Jeg har fått feilen reparert andre steder",
};

// What has happened about repairing the defect. Decides the claim: repair while the dealer has not had a
// try, price reduction or cancelling once they have refused or failed. A buyer who had it repaired elsewhere
// first can lose the right to have the cost covered (§§ 29 and 30), and the letter says what happened.
export function RettingFelt({
  input,
  verdi,
  aktiv,
  lagre,
  avbryt,
}: Felles & { input: KlageInput; verdi: Retting | undefined }) {
  const kontakt = input.feilen.kontakt;
  const [valgt, setValgt] = useState<string>(
    gyldigRetting(kontakt, verdi) ?? (kontakt === "nei" ? "ingen" : ""),
  );
  const spm =
    kontakt === "nei"
      ? "Har du fått feilen reparert?"
      : "Hva har forhandleren gjort?";
  if (!aktiv) {
    const vist =
      gyldigRetting(kontakt, verdi) ??
      (kontakt === "nei" ? "ingen" : undefined);
    return vist ? <Sammendrag linjer={[RETTING_TEKST[vist]]} /> : null;
  }
  return (
    <Skjema
      klar={valgt !== ""}
      send={() => lagre({ retting: valgt as Retting })}
      avbryt={avbryt}
    >
      {kontakt === "nei" && (
        <p className={HJELP}>
          Forhandleren har rett til å forsøke å rette feilen først. Reparerer du
          den andre steder før de har fått sjansen, kan du miste retten til å få
          kostnaden dekket.
        </p>
      )}
      <Nedtrekk
        label={spm}
        value={valgt}
        onChange={(e) => setValgt(e.target.value)}
      >
        <option value="">Velg</option>
        {rettingValgFor(kontakt).map((v) => (
          <option key={v} value={v}>
            {RETTING_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
    </Skjema>
  );
}

const MATE_TEKST: Record<Reklamasjon["mate"], string> = {
  epost: "E-post",
  sms: "SMS",
  telefon: "Telefon",
  oppmote: "Oppmøte hos forhandleren",
  brev: "Brev",
};

// When and how the buyer first took the defect up with the dealer. Only for buyers who have.
export function ReklamasjonFelt({
  input,
  retting,
  idag,
  verdi,
  aktiv,
  lagre,
  avbryt,
}: Felles & {
  input: KlageInput;
  retting: Retting | undefined;
  idag: string;
  verdi: Reklamasjon | undefined;
}) {
  const forsokt = retting === "forsokt";
  const [dato, setDato] = useState(verdi?.dato ?? "");
  const [mate, setMate] = useState<string>(verdi?.mate ?? "");
  const [forsok, setForsok] = useState(verdi?.forsok ? String(verdi.forsok) : "");
  if (!aktiv) {
    if (!verdi) return null;
    return <Sammendrag linjer={[`${norskDato(verdi.dato)} · ${MATE_TEKST[verdi.mate].toLowerCase()}`, verdi.forsok ? `${verdi.forsok} rettingsforsøk` : null]} />;
  }
  const min = input.bilOgKjop.kjopsdato ?? "";
  const klar = dato >= min && dato <= idag && mate !== "" && (!forsokt || forsok !== "");
  return (
    <Skjema klar={klar} send={() => lagre({ reklamasjon: { dato, mate: mate as Reklamasjon["mate"], ...(forsokt && { forsok: Number(forsok) }) } })} avbryt={avbryt}>
      <Tekstfelt
        label="Når tok du opp feilen første gang?"
        hjelp={min ? `Tidligst ${norskDato(min)}, den dagen du kjøpte bilen, og senest i dag.` : "Senest i dag."}
        type="date"
        min={min || undefined}
        max={idag}
        value={dato}
        onChange={(e) => setDato(e.target.value)}
      />
      <Nedtrekk label="Hvordan tok du kontakt?" value={mate} onChange={(e) => setMate(e.target.value)}>
        <option value="">Velg</option>
        {REKLAMASJON_MATER.map((m) => (
          <option key={m} value={m}>
            {MATE_TEKST[m]}
          </option>
        ))}
      </Nedtrekk>
      {forsokt && (
        <Nedtrekk label="Hvor mange ganger har forhandleren forsøkt å rette feilen?" value={forsok} onChange={(e) => setForsok(e.target.value)}>
          <option value="">Velg</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Nedtrekk>
      )}
    </Skjema>
  );
}

const KRAV_TEKST: Record<NonNullable<Krav["type"]>, { tittel: string; tekst: string }> = {
  prisavslag: { tittel: "Prisavslag", tekst: "Du beholder bilen og får tilbake en del av kjøpesummen, vanligvis det det koster å rette feilen." },
  heving: { tittel: "Heving", tekst: "Du leverer bilen tilbake og får kjøpesummen tilbake. Krever at feilen ikke er uvesentlig." },
};
const UTGIFT_TEKST: Record<Utgift["type"], string> = { verksted: "Verksted og feilsøking", tauing: "Tauing", leiebil: "Leiebil", annet: "Annet" };

type UtgiftUtkast = { type: Utgift["type"]; belop: string };

// What the buyer claims. The choice between a price reduction and cancelling is only there once the
// dealer has refused or failed to repair; before that the claim is repair. Costs can always be claimed.
export function KravFelt({
  kanVelge,
  verdi,
  aktiv,
  lagre,
  avbryt,
}: Felles & { kanVelge: boolean; verdi: Krav | undefined }) {
  const id = useId();
  const [type, setType] = useState<Krav["type"]>(verdi?.type);
  const [utbedring, setUtbedring] = useState(verdi?.utbedringNok ? String(verdi.utbedringNok) : "");
  const [utgifter, setUtgifter] = useState<UtgiftUtkast[]>(() => (verdi?.utgifter ?? []).map((u) => ({ type: u.type, belop: String(u.belopNok) })));

  if (!aktiv) {
    if (!verdi) return null;
    const sum = verdi.utgifter.reduce((s, u) => s + u.belopNok, 0);
    const hoved = !kanVelge ? "Retting uten kostnad for deg" : verdi.type === "heving" ? "Heving av kjøpet" : verdi.type === "prisavslag" ? `Prisavslag${verdi.utbedringNok ? ` på ${kroner(verdi.utbedringNok)}` : ""}` : null;
    return <Sammendrag linjer={[hoved, sum > 0 ? `Erstatning for utgifter: ${kroner(sum)}` : null]} />;
  }

  const endreUtgift = (n: number, e: Partial<UtgiftUtkast>) => setUtgifter((u) => u.map((x, i) => (i === n ? { ...x, ...e } : x)));
  const klar = (!kanVelge || type !== undefined) && utgifter.every((u) => u.belop !== "");
  const send = () =>
    lagre({
      krav: {
        ...(kanVelge && type && { type }),
        ...(kanVelge && type === "prisavslag" && utbedring !== "" && { utbedringNok: Number(utbedring) }),
        utgifter: utgifter.map((u) => ({ type: u.type, belopNok: Number(u.belop) })),
      },
    });

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      {kanVelge ? (
        <div role="radiogroup" aria-labelledby={`${id}-krav`} className="flex flex-col gap-2">
          <span id={`${id}-krav`} className={LABEL}>
            Hva krever du?
          </span>
          {KRAV_TYPER.map((k) => (
            <label key={k} className={`flex cursor-pointer gap-3 rounded-lg border bg-white px-3.5 py-3 ${type === k ? "border-2 border-[#17263d]" : "border-[#bfbab0]"}`}>
              <input type="radio" name={`${id}-krav`} checked={type === k} onChange={() => setType(k)} className="mt-1 accent-[#17263d]" />
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{KRAV_TEKST[k].tittel}</span>
                <span className={HJELP}>{KRAV_TEKST[k].tekst}</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className={HJELP}>Forhandleren har rett til å forsøke å rette feilen først. Brevet krever derfor at feilen rettes uten kostnad for deg.</p>
      )}
      {kanVelge && type === "prisavslag" && (
        <Tekstfelt
          label="Hva koster det å rette feilen? (valgfritt)"
          hjelp="Bruk beløpet fra verkstedets tilbud eller rapport. Uten beløp krever brevet et forholdsmessig prisavslag."
          inputMode="numeric"
          placeholder="f.eks. 38 000"
          value={gruppert(utbedring)}
          onChange={(e) => setUtbedring(bareSiffer(e.target.value))}
        />
      )}
      <div className="flex flex-col gap-2">
        <span className={LABEL}>Utgifter du vil ha erstattet (valgfritt)</span>
        <p className={HJELP}>Utgifter du har hatt på grunn av feilen, og som du har kvittering for.</p>
        {utgifter.map((u, n) => (
          <div key={n} role="group" aria-label={`Utgift ${n + 1}`} className="flex items-center gap-2">
            <select aria-label="Type utgift" value={u.type} onChange={(e) => endreUtgift(n, { type: e.target.value as Utgift["type"] })} className={`${INPUT} min-w-0 flex-[3] px-2.5`}>
              {UTGIFT_TYPER.map((t) => (
                <option key={t} value={t}>
                  {UTGIFT_TEKST[t]}
                </option>
              ))}
            </select>
            <input aria-label="Beløp i kroner" inputMode="numeric" placeholder="kr" value={gruppert(u.belop)} onChange={(e) => endreUtgift(n, { belop: bareSiffer(e.target.value) })} className={`${INPUT} min-w-0 flex-[2] px-2.5`} />
            <button type="button" onClick={() => setUtgifter((x) => x.filter((_, i) => i !== n))} className="text-[13px] font-medium text-[#5b6472]">
              Fjern
            </button>
          </div>
        ))}
        {utgifter.length < MAKS_UTGIFTER && (
          <button type="button" onClick={() => setUtgifter((u) => [...u, { type: "verksted", belop: "" }])} className="self-start text-[14px] font-medium text-[#1f3a5f] underline underline-offset-2">
            Legg til utgift
          </button>
        )}
      </div>
    </Skjema>
  );
}

const VEDLEGG_TEKST: Record<Vedlegg, string> = {
  kjopekontrakt: "Kjøpekontrakt",
  verkstedrapport: "Verksted- eller tilstandsrapport",
  bilder: "Bilder eller video av feilen",
  annonse: "Annonsen bilen ble solgt med",
  meldinger: "E-post eller SMS med forhandleren",
  kvitteringer: "Kvitteringer for utgifter",
};

// What the buyer encloses with the letter. Starts from the evidence given in the assessment.
export function VedleggFelt({ input, utfylling, aktiv, lagre, avbryt }: Felles & { input: KlageInput; utfylling: Utfylling }) {
  const [valgt, setValgt] = useState<Vedlegg[]>(() => vedleggFor(input, utfylling));
  if (!aktiv) {
    if (!utfylling.vedlegg) return null;
    return <Sammendrag linjer={[utfylling.vedlegg.length ? utfylling.vedlegg.map((v) => VEDLEGG_TEKST[v]).join(", ") : "Ingen vedlegg"]} />;
  }
  return (
    <Skjema klar send={() => lagre({ vedlegg: valgt })} avbryt={avbryt} knapp="Bekreft vedlegg">
      <p className={HJELP}>Kryss av for det du legger ved brevet. Brevet lister opp vedleggene.</p>
      <div className="flex flex-col gap-1.5">
        {VEDLEGG.map((v) => (
          <label key={v} className="flex cursor-pointer items-center gap-2.5 text-[14px]">
            <input type="checkbox" checked={valgt.includes(v)} onChange={(e) => setValgt((x) => (e.target.checked ? [...x, v] : x.filter((y) => y !== v)))} className="h-[18px] w-[18px] accent-[#17263d]" />
            {VEDLEGG_TEKST[v]}
          </label>
        ))}
      </div>
    </Skjema>
  );
}

// The sender of the letter: the buyer's name and address.
export function AvsenderFelt({ verdi, aktiv, lagre, avbryt }: Felles & { verdi: Avsender | undefined }) {
  const [a, setA] = useState({ navn: verdi?.navn ?? "", adresse: verdi?.adresse ?? "", postnummer: verdi?.postnummer ?? "", poststed: verdi?.poststed ?? "", telefon: verdi?.telefon ?? "" });
  const sett = (felt: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement>) => setA((x) => ({ ...x, [felt]: e.target.value }));
  if (!aktiv) {
    if (!verdi) return null;
    return <Sammendrag linjer={[verdi.navn, `${verdi.adresse}, ${verdi.postnummer} ${verdi.poststed}`, verdi.telefon ? `Tlf. ${verdi.telefon}` : null]} />;
  }
  const klar = a.navn.trim().length >= 2 && a.adresse.trim().length >= 2 && /^\d{4}$/.test(a.postnummer) && a.poststed.trim() !== "" && (a.telefon.trim() === "" || /^\+?[\d ]{8,16}$/.test(a.telefon.trim()));
  return (
    <Skjema klar={klar} send={() => lagre({ avsender: { navn: a.navn, adresse: a.adresse, postnummer: a.postnummer, poststed: a.poststed, ...(a.telefon.trim() && { telefon: a.telefon }) } })} avbryt={avbryt}>
      <p className={HJELP}>Navnet og adressen din står øverst i brevet, slik at forhandleren kan svare deg.</p>
      <Tekstfelt label="Navn" autoComplete="name" maxLength={100} value={a.navn} onChange={sett("navn")} />
      <Tekstfelt label="Adresse" autoComplete="street-address" maxLength={100} value={a.adresse} onChange={sett("adresse")} />
      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
        <Tekstfelt label="Postnummer" autoComplete="postal-code" inputMode="numeric" maxLength={4} value={a.postnummer} onChange={(e) => setA((x) => ({ ...x, postnummer: e.target.value.replace(/\D/g, "") }))} />
        <Tekstfelt label="Sted" autoComplete="address-level2" maxLength={50} value={a.poststed} onChange={sett("poststed")} />
      </div>
      <Tekstfelt label="Telefon (valgfritt)" autoComplete="tel" inputMode="tel" maxLength={16} value={a.telefon} onChange={sett("telefon")} />
    </Skjema>
  );
}

const FORBEHOLD_TEKST: Record<Forbehold, string> = {
  som_den_er: "Ja, bilen ble solgt «som den er»",
  garanti: "Nei, men bilen hadde garanti fra forhandleren",
  ingen: "Nei, ingen forbehold eller garanti",
  vet_ikke: "Jeg vet ikke",
};

// Did the contract or the ad say «som den er», or promise a warranty? Decides whether the letter
// meets a disclaimer. «Vet ikke» leaves it out.
export function ForbeholdFelt({ verdi, aktiv, lagre, avbryt }: Felles & { verdi: Forbehold | undefined }) {
  const [valg, setValg] = useState<Forbehold | null>(verdi ?? null);
  if (!aktiv) return verdi ? <Sammendrag linjer={[FORBEHOLD_TEKST[verdi]]} /> : null;
  return (
    <Skjema klar={valg !== null} send={() => lagre({ forbehold: valg! })} avbryt={avbryt}>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className={`${LABEL} mb-1`}>Sto det «solgt som den er» eller noe om garanti i kontrakten eller annonsen?</legend>
        {FORBEHOLD_VALG.map((v) => (
          <label key={v} className="flex items-start gap-2.5 text-[14px] leading-[1.45]">
            <input type="radio" name="forbehold" value={v} checked={valg === v} onChange={() => setValg(v)} className="mt-1" />
            {FORBEHOLD_TEKST[v]}
          </label>
        ))}
      </fieldset>
    </Skjema>
  );
}
