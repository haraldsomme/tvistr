"use client";

import { useId, useState } from "react";
import { norskDato } from "@/lib/brev/brev";
import type { FeilMedSporsmal, Sporsmal, Utelatt } from "@/lib/brev/feilbeskrivelse";
import { BESKRIVELSE_MAKS, BESKRIVELSE_MIN, FEILBESKRIVELSE, type Fakta, type Feilen, type Utfylling } from "@/lib/brev/utfylling";
import { FRA_AR, gyldigKjopsdato, medKjopsdato, type Innsending } from "@/lib/vurdering/innsending";
import { HJELP, INPUT, KNAPP, LABEL, TEKSTOMRADE, Tekstfelt } from "../felt";

// The interview about the defect, in three steps: the buyer writes freely; the model asks what a fixed
// checklist says is missing; the buyer edits the model's draft and approves it. Nothing goes in the
// letter before «Sett inn i brevet». «Bruk teksten min som den er» saves the buyer's own text without
// sending it anywhere. It is step 3 of the wizard after buying, which gives it the page around it.

type Trinn = "skriv" | "sporsmal" | "utkast";
const TRINN: Trinn[] = ["skriv", "sporsmal", "utkast"];

const STEG_NAVN: Record<Utelatt["steg"], string> = { kravet: "Kravet", kontakt: "Kontakt med forhandleren", for_kjopet: "Før kjøpet", bevis: "Bevis og vedlegg" };
const FORSLAG_FEILET = "Vi klarte ikke å lage et forslag akkurat nå. Du kan bruke din egen tekst i brevet.";
const LENKE = "text-[14px] font-medium text-[#5b6472] underline underline-offset-2 disabled:text-[#8a94a3]";

const nokkel = (feil: number, sporsmal: number) => `${feil}-${sporsmal}`;
const melding = (e: unknown, ellers: string) => (e instanceof Error && !(e instanceof TypeError) && !(e instanceof SyntaxError) && e.message) || ellers;

// One answer: the choices picked, and the buyer's own words beside them. Sent as one text,
// «A; B; utdyping», so the stored answer and what the model reads are plain text.
type Svar = { valgt: string[]; utdyp: string };
const TOMT: Svar = { valgt: [], utdyp: "" };
const somTekst = (s: Svar) => [...s.valgt, s.utdyp.trim()].filter(Boolean).join("; ").slice(0, FEILBESKRIVELSE.svarMaks);

// The questions and answers saved with the case, so «Endre» shows them again without asking the model.
// The choices are not stored, so a saved answer comes back as the buyer's own words.
function lagredeSvar(fakta: Fakta[] = []) {
  const grupper: FeilMedSporsmal[] = [];
  const svar: Record<string, Svar> = {};
  for (const f of fakta) {
    let n = grupper.findIndex((g) => g.tittel === f.feil);
    if (n === -1) n = grupper.push({ tittel: f.feil, sporsmal: [] }) - 1;
    svar[nokkel(n, grupper[n].sporsmal.length)] = { valgt: [], utdyp: f.svar };
    grupper[n].sporsmal.push({ tekst: f.sporsmal, alternativer: [], flervalg: false, punkt: "hva" });
  }
  return { grupper, svar };
}

// One follow-up question: the model's choices, if any (several at once when they can all be true),
// and a field of one's own that never repeats a choice. Nothing picked and nothing written is a
// skipped question.
function SporsmalFelt({ sporsmal, verdi, sett }: { sporsmal: Sporsmal; verdi: Svar; sett: (v: Svar) => void }) {
  const id = useId();
  const velg = (a: string) => {
    const pa = verdi.valgt.includes(a);
    const valgt = sporsmal.flervalg ? (pa ? verdi.valgt.filter((x) => x !== a) : [...verdi.valgt, a]) : pa ? [] : [a];
    sett({ ...verdi, valgt });
  };
  const harValg = sporsmal.alternativer.length > 0;
  return (
    <div className="flex flex-col gap-2">
      <p id={`${id}-sporsmal`} className={`m-0 ${LABEL}`}>
        {sporsmal.tekst}
      </p>
      {harValg && (
        <>
          {sporsmal.flervalg && <p className={HJELP}>Velg alt som stemmer.</p>}
          <div role="group" aria-labelledby={`${id}-sporsmal`} className="flex flex-wrap gap-2">
            {sporsmal.alternativer.map((a) => {
              const pa = verdi.valgt.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={pa}
                  onClick={() => velg(a)}
                  className={`rounded-full border px-3.5 py-1.5 text-[14px] ${pa ? "border-[#17263d] bg-[#17263d] text-[#f6f4ef]" : "border-[#bfbab0] bg-white"}`}
                >
                  {sporsmal.flervalg && pa ? `✓ ${a}` : a}
                </button>
              );
            })}
          </div>
        </>
      )}
      <label htmlFor={id} className="sr-only">
        {harValg ? `Utdyp: ${sporsmal.tekst}` : sporsmal.tekst}
      </label>
      <input
        id={id}
        value={verdi.utdyp}
        onChange={(e) => sett({ ...verdi, utdyp: e.target.value.slice(0, FEILBESKRIVELSE.svarMaks) })}
        placeholder={harValg ? "Utdyp eller skriv noe annet (valgfritt)" : "Vet du ikke, la feltet stå tomt."}
        className={INPUT}
      />
    </div>
  );
}

export function Intervju({
  id,
  svar,
  idag,
  feiltyper,
  forslagKjopsdato,
  verdi,
  lagret,
  ferdig,
}: {
  id: string;
  svar: Innsending;
  idag: string;
  feiltyper: string[];
  forslagKjopsdato: string | null;
  verdi: Feilen | undefined;
  // What the server stored, so the wizard shows the same as the letter will.
  lagret: (svar: Innsending | undefined, utfylling: Utfylling) => void;
  ferdig: () => void;
}) {
  const skjemaId = useId();
  const manglerKjopsdato = !gyldigKjopsdato(svar.kjopsdato, idag);
  const [start] = useState(() => lagredeSvar(verdi?.fakta));
  const [kjopsdato, setKjopsdato] = useState(forslagKjopsdato ?? "");
  const [dato, setDato] = useState(verdi?.dato ?? "");
  const [egen, setEgen] = useState(verdi?.egen ?? "");
  // The text the current draft was made from, so step 1 can go back to the draft without a model call.
  const [egenForUtkast, setEgenForUtkast] = useState(verdi?.egen ?? "");
  const [grupper, setGrupper] = useState<FeilMedSporsmal[]>(start.grupper);
  const [svarene, setSvarene] = useState<Record<string, Svar>>(start.svar);
  const [avsnitt, setAvsnitt] = useState<string[]>(verdi?.avsnitt ?? []);
  const [titler, setTitler] = useState<string[]>(verdi?.feil ?? []);
  const [utelatt, setUtelatt] = useState<Utelatt[]>([]);
  const [trinn, setTrinn] = useState<Trinn>(verdi ? "utkast" : "skriv");
  const [arbeider, setArbeider] = useState<"sporsmal" | "utkast" | "lagrer" | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  const kjop = manglerKjopsdato ? kjopsdato : svar.kjopsdato;
  const kjopOk = gyldigKjopsdato(kjop, idag);
  const datoOk = kjopOk && dato >= kjop && dato <= idag;
  const egenOk = egen.trim().length >= BESKRIVELSE_MIN;
  const skrivKlar = datoOk && egenOk && arbeider === null;
  const fakta: Fakta[] = grupper
    .flatMap((g, n) => g.sporsmal.map((s, m) => ({ feil: g.tittel, sporsmal: s.tekst, svar: somTekst(svarene[nokkel(n, m)] ?? TOMT) })))
    .filter((f) => f.svar !== "");
  const harSporsmal = grupper.some((g) => g.sporsmal.length > 0);
  const lengde = avsnitt.reduce((n, a) => n + a.trim().length, 0);
  const utkastOk = avsnitt.length > 0 && avsnitt.every((a) => a.trim().length >= FEILBESKRIVELSE.avsnittMin) && lengde <= FEILBESKRIVELSE.totalMaks;

  async function forslag(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(`/api/sak/${id}/feilen`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error(typeof json.feil === "string" ? json.feil : "");
    return json;
  }

  async function lagUtkast(med: Fakta[]) {
    setArbeider("utkast");
    setFeil(null);
    try {
      const json = await forslag({ trinn: "utkast", beskrivelse: egen, fakta: med });
      setAvsnitt(json.avsnitt as string[]);
      setTitler(json.titler as string[]);
      setUtelatt(json.utelatt as Utelatt[]);
      setEgenForUtkast(egen);
      setTrinn("utkast");
    } catch (e) {
      setFeil(melding(e, FORSLAG_FEILET));
    }
    setArbeider(null);
  }

  async function fortsett() {
    setArbeider("sporsmal");
    setFeil(null);
    try {
      const json = await forslag({ trinn: "sporsmal", beskrivelse: egen });
      const nye = json.grupper as FeilMedSporsmal[];
      setGrupper(nye);
      setSvarene({});
      if (nye.some((g) => g.sporsmal.length > 0)) {
        setTrinn("sporsmal");
        setArbeider(null);
        return;
      }
    } catch {
      // Without questions the draft is made from the buyer's own text alone.
      setGrupper([]);
      setSvarene({});
    }
    await lagUtkast([]);
  }

  async function lagre(feilen: Feilen) {
    setArbeider("lagrer");
    setFeil(null);
    try {
      // A purchase date asked for here is saved with the defect, so the date of the defect is checked against it.
      const body = { feilen, ...(manglerKjopsdato && { svar: medKjopsdato(svar, kjopsdato, idag) }) };
      const res = await fetch(`/api/sak/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json()) as { svar?: Innsending; utfylling?: Utfylling; feil?: string };
      if (!res.ok || !json.utfylling) throw new Error(json.feil ?? "");
      lagret(json.svar, json.utfylling);
      setArbeider(null);
      ferdig();
    } catch (e) {
      setFeil(melding(e, "Vi fikk ikke lagret. Prøv igjen om litt."));
      setArbeider(null);
    }
  }

  const brukEgen = () => lagre({ dato, egen, feil: [], avsnitt: [egen] });
  const settInn = () => lagre({ dato, egen, feil: titler, ...(fakta.length > 0 && { fakta }), avsnitt: avsnitt.map((a) => a.trim()) });
  const brukEgenKnapp = (
    <button type="button" disabled={!skrivKlar} onClick={brukEgen} className={LENKE}>
      Bruk teksten min som den er
    </button>
  );

  const skriv = (
    <>
      {manglerKjopsdato && (
        <Tekstfelt label="Når kjøpte du bilen?" hjelp={forslagKjopsdato && kjopsdato === forslagKjopsdato ? "Foreslått fra Statens vegvesen: datoen bilen ble registrert på deg. Rett den hvis den ikke stemmer med kjøpekontrakten." : "Datoen står i kjøpekontrakten."} type="date" min={`${FRA_AR}-01-01`} max={idag} value={kjopsdato} onChange={(e) => setKjopsdato(e.target.value)} />
      )}
      <Tekstfelt
        label="Når viste den første feilen seg?"
        hjelp={kjopOk ? `Tidligst ${norskDato(kjop)}, den dagen du kjøpte bilen, og senest i dag.` : "Senest i dag."}
        type="date"
        min={kjopOk ? kjop : undefined}
        max={idag}
        value={dato}
        onChange={(e) => setDato(e.target.value)}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${skjemaId}-egen`} className={LABEL}>
          Beskriv feilen eller feilene med dine egne ord
        </label>
        <textarea
          id={`${skjemaId}-egen`}
          aria-describedby={`${skjemaId}-egen-hjelp`}
          value={egen}
          onChange={(e) => setEgen(e.target.value.slice(0, BESKRIVELSE_MAKS))}
          placeholder="Motorlampen lyser, og bilen mister trekkraft i motbakker …"
          className={`${TEKSTOMRADE} min-h-[180px]`}
        />
        <p id={`${skjemaId}-egen-hjelp`} className={HJELP}>
          Hva skjer, når og hvor ofte? Har bilen flere feil, ta med alle. Ikke skriv navn på personer. Når du trykker «Fortsett», sendes teksten til en språkmodell (Claude fra Anthropic), som stiller deg noen spørsmål og foreslår en tekst. Ingenting kommer i brevet før du har godkjent det.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" disabled={!skrivKlar} onClick={fortsett} className={KNAPP}>
          {arbeider === "sporsmal" ? "Leser beskrivelsen …" : arbeider === "utkast" ? "Lager forslag …" : "Fortsett"}
        </button>
        {avsnitt.length > 0 && egen === egenForUtkast && (
          <button type="button" disabled={!datoOk || arbeider !== null} onClick={() => setTrinn("utkast")} className={LENKE}>
            Tilbake til forslaget
          </button>
        )}
        {brukEgenKnapp}
      </div>
      {!skrivKlar && arbeider === null && (
        <p className={HJELP}>
          {!kjopOk ? "Fyll ut kjøpsdatoen for å gå videre." : !datoOk ? "Fyll ut datoen feilen viste seg for å gå videre." : `Beskriv feilen med minst ${BESKRIVELSE_MIN} tegn for å gå videre.`}
        </p>
      )}
    </>
  );

  const sporsmal = (
    <>
      <p className={HJELP}>Svar på det du vet. Det du ikke vet, hopper du over.</p>
      {grupper.map(
        (g, n) =>
          g.sporsmal.length > 0 && (
            <fieldset key={n} className="m-0 flex flex-col gap-4 border-0 p-0">
              <legend className="mb-1 p-0 text-[15px] font-semibold">{g.tittel}</legend>
              {g.sporsmal.map((s, m) => (
                <SporsmalFelt key={m} sporsmal={s} verdi={svarene[nokkel(n, m)] ?? TOMT} sett={(v) => setSvarene((f) => ({ ...f, [nokkel(n, m)]: v }))} />
              ))}
            </fieldset>
          ),
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" disabled={arbeider !== null} onClick={() => lagUtkast(fakta)} className={KNAPP}>
          {arbeider === "utkast" ? "Lager forslag …" : "Lag forslag"}
        </button>
        <button type="button" disabled={arbeider !== null} onClick={() => setTrinn("skriv")} className={LENKE}>
          Endre det du skrev
        </button>
      </div>
    </>
  );

  const utkast = (
    <>
      <p className={HJELP}>Les nøye. Står det noe som ikke stemmer, rett det. Brevet sendes i ditt navn.</p>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-3">
          {avsnitt.map((a, n) => (
            <div key={n} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={`${skjemaId}-avsnitt-${n}`} className={LABEL}>
                  Avsnitt {n + 1}
                </label>
                {avsnitt.length > 1 && (
                  <button type="button" onClick={() => {
                      // One paragraph per defect: the title goes with it.
                      if (avsnitt.length === titler.length) setTitler((t) => t.filter((_, i) => i !== n));
                      setAvsnitt((l) => l.filter((_, i) => i !== n));
                    }} className="text-[13px] font-medium text-[#5b6472]">
                    Fjern
                  </button>
                )}
              </div>
              <textarea id={`${skjemaId}-avsnitt-${n}`} value={a} onChange={(e) => setAvsnitt((l) => l.map((x, i) => (i === n ? e.target.value : x)))} className={TEKSTOMRADE} />
            </div>
          ))}
        </div>
        <aside className="flex flex-col gap-1.5 rounded-md bg-[#f6f4ef] p-4">
          <h2 className="m-0 text-[13px] font-semibold">Det du skrev</h2>
          <p className="m-0 whitespace-pre-wrap text-[14px] leading-[1.5] text-[#3d4757]">{egen}</p>
        </aside>
      </div>
      {utelatt.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className={`m-0 ${LABEL}`}>Dette står ikke i feilbeskrivelsen fordi det fylles ut i et annet steg:</p>
          <ul className="m-0 pl-5 text-[14px] leading-[1.5] text-[#3d4757]">
            {utelatt.map((u, n) => (
              <li key={n}>
                {u.hva} (steget «{STEG_NAVN[u.steg]}»)
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" disabled={!utkastOk || arbeider !== null} onClick={settInn} className={KNAPP}>
          {arbeider === "lagrer" ? "Setter inn …" : "Sett inn i brevet"}
        </button>
        {harSporsmal && (
          <button type="button" disabled={arbeider !== null} onClick={() => setTrinn("sporsmal")} className={LENKE}>
            Endre svarene
          </button>
        )}
        <button type="button" disabled={arbeider !== null} onClick={() => setTrinn("skriv")} className={LENKE}>
          Endre det du skrev
        </button>
        {brukEgenKnapp}
      </div>
      {!utkastOk && (
        <p className={HJELP}>{lengde > FEILBESKRIVELSE.totalMaks ? `Teksten er for lang: ${lengde} av ${FEILBESKRIVELSE.totalMaks} tegn.` : "Et avsnitt er tomt. Skriv i det, eller fjern det."}</p>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className={HJELP}>
        Feil du har oppgitt: {feiltyper.join(", ")}. Beskrivelsen er det forhandleren, og senere Forbrukerklageutvalget, leser for å forstå hva som er galt.
      </p>
      <p className="m-0 text-[13px] font-semibold text-[#5b6472]">Trinn {TRINN.indexOf(trinn) + 1} av 3</p>
      {trinn === "skriv" && skriv}
      {trinn === "sporsmal" && sporsmal}
      {trinn === "utkast" && utkast}
      {feil && (
        <p role="alert" className="m-0 text-[13px] leading-[1.5] text-[#a23b2a]">
          {feil}
        </p>
      )}
    </div>
  );
}
