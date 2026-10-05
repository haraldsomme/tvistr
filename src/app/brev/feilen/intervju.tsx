"use client";

import { useEffect, useId, useState } from "react";
import type { FeilMedSporsmal, Sporsmal, Utelatt } from "@/lib/brev/feilbeskrivelse";
import { BESKRIVELSE_MAKS, BESKRIVELSE_MIN, FEILBESKRIVELSE, type Fakta, type Feilen, type Utfylling } from "@/lib/brev/utfylling";
import { FRA_AR, gyldigKjopsdato, medKjopsdato, type Innsending } from "@/lib/vurdering/innsending";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Datofelt } from "../datofelt";
import { HJELP, LABEL } from "../felt";

// The interview about the defect, in three steps: the buyer writes freely; the model asks what a fixed
// checklist says is missing; the buyer compares the draft with their own text and inserts one of them.
// Nothing goes in the letter before «Bruk vårt forslag» or «Bruk din tekst». «Bruk din tekst» saves the buyer's own text without
// sending it anywhere. It is step 3 of the wizard after buying, which gives it the page around it.

type Trinn = "skriv" | "sporsmal" | "utkast";

// Everything the buyer has typed or chosen in the interview. The wizard keeps it while the buyer
// moves to other steps and back, because the step is unmounted when it is left.
export type IntervjuUtkast = {
  kjopsdato: string;
  dato: string;
  egen: string;
  egenForUtkast: string;
  grupper: FeilMedSporsmal[];
  svarene: Record<string, Svar>;
  forslagTekst: string;
  titler: string[];
  utelatt: Utelatt[];
  trinn: Trinn;
};

const STEG_NAVN: Record<Utelatt["steg"], string> = { kravet: "Kravet", kontakt: "Kontakt med forhandleren", for_kjopet: "Før kjøpet", bevis: "Bevis og vedlegg" };
const FORSLAG_FEILET = "Vi klarte ikke å lage et forslag akkurat nå. Du kan bruke din egen tekst i brevet.";

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
                <Toggle
                  key={a}
                  pressed={pa}
                  onPressedChange={() => velg(a)}
                  variant="pille"
                  size="pille"
                >
                  {sporsmal.flervalg && pa ? `✓ ${a}` : a}
                </Toggle>
              );
            })}
          </div>
        </>
      )}
      <label htmlFor={id} className="sr-only">
        {harValg ? `Utdyp: ${sporsmal.tekst}` : sporsmal.tekst}
      </label>
      <Input
        id={id}
        value={verdi.utdyp}
        onChange={(e) => sett({ ...verdi, utdyp: e.target.value.slice(0, FEILBESKRIVELSE.svarMaks) })}
        placeholder={harValg ? "Utdyp eller skriv noe annet (valgfritt)" : "Vet du ikke, la feltet stå tomt."}
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
  utkast: husket,
  settUtkast,
  lagret,
  ferdig,
  tilbake,
  tilbakeTekst,
  hoppOver,
}: {
  id: string;
  svar: Innsending;
  idag: string;
  feiltyper: string[];
  forslagKjopsdato: string | null;
  verdi: Feilen | undefined;
  utkast: IntervjuUtkast | null;
  settUtkast: (u: IntervjuUtkast) => void;
  // What the server stored, so the wizard shows the same as the letter will.
  lagret: (svar: Innsending | undefined, utfylling: Utfylling) => void;
  ferdig: () => void;
  // «Tilbake» on the first screen leaves the step; on the others it goes back one screen here.
  tilbake: () => void;
  tilbakeTekst: string;
  hoppOver?: () => void;
}) {
  const skjemaId = useId();
  const manglerKjopsdato = !gyldigKjopsdato(svar.kjopsdato, idag);
  const [start] = useState<IntervjuUtkast>(() => {
    if (husket) return husket;
    const lagrede = lagredeSvar(verdi?.fakta);
    return {
      kjopsdato: forslagKjopsdato ?? "",
      dato: verdi?.dato ?? "",
      egen: verdi?.egen ?? "",
      // The text the current draft was made from, so step 1 can go back to the draft without a model call.
      egenForUtkast: verdi?.egen ?? "",
      grupper: lagrede.grupper,
      svarene: lagrede.svar,
      // The draft is one text; a blank line starts a new paragraph.
      forslagTekst: (verdi?.avsnitt ?? []).join("\n\n"),
      titler: verdi?.feil ?? [],
      utelatt: [],
      trinn: verdi ? "utkast" : "skriv",
    };
  });
  const [kjopsdato, setKjopsdato] = useState(start.kjopsdato);
  const [dato, setDato] = useState(start.dato);
  const [egen, setEgen] = useState(start.egen);
  const [egenForUtkast, setEgenForUtkast] = useState(start.egenForUtkast);
  const [grupper, setGrupper] = useState<FeilMedSporsmal[]>(start.grupper);
  const [svarene, setSvarene] = useState<Record<string, Svar>>(start.svarene);
  const [forslagTekst, setForslagTekst] = useState(start.forslagTekst);
  const [titler, setTitler] = useState<string[]>(start.titler);
  const [utelatt, setUtelatt] = useState<Utelatt[]>(start.utelatt);
  const [trinn, setTrinn] = useState<Trinn>(start.trinn);
  const [arbeider, setArbeider] = useState<"sporsmal" | "utkast" | "lagrer" | null>(null);
  const [settInnHva, setSettInnHva] = useState<"forslag" | "original" | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  useEffect(() => {
    settUtkast({ kjopsdato, dato, egen, egenForUtkast, grupper, svarene, forslagTekst, titler, utelatt, trinn });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `settUtkast` only stores what is passed.
  }, [kjopsdato, dato, egen, egenForUtkast, grupper, svarene, forslagTekst, titler, utelatt, trinn]);

  const kjop = manglerKjopsdato ? kjopsdato : svar.kjopsdato;
  const kjopOk = gyldigKjopsdato(kjop, idag);
  const datoOk = kjopOk && dato >= kjop && dato <= idag;
  const egenOk = egen.trim().length >= BESKRIVELSE_MIN;
  const skrivKlar = datoOk && egenOk && arbeider === null;
  const fakta: Fakta[] = grupper
    .flatMap((g, n) => g.sporsmal.map((s, m) => ({ feil: g.tittel, sporsmal: s.tekst, svar: somTekst(svarene[nokkel(n, m)] ?? TOMT) })))
    .filter((f) => f.svar !== "");
  const harSporsmal = grupper.some((g) => g.sporsmal.length > 0);
  const avsnitt = forslagTekst.split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean);
  const lengde = avsnitt.reduce((n, a) => n + a.length, 0);
  const forslagFeil =
    avsnitt.length === 0 ? "Forslaget er tomt."
    : avsnitt.length > FEILBESKRIVELSE.maksAvsnitt ? `Forslaget har for mange avsnitt: ${avsnitt.length} av ${FEILBESKRIVELSE.maksAvsnitt}.`
    : avsnitt.some((a) => a.length < FEILBESKRIVELSE.avsnittMin) ? "Et avsnitt er for kort. Skriv mer i det, eller fjern det."
    : lengde > FEILBESKRIVELSE.totalMaks ? `Teksten er for lang: ${lengde} av ${FEILBESKRIVELSE.totalMaks} tegn.`
    : null;
  const utkastOk = forslagFeil === null;

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
      setForslagTekst((json.avsnitt as string[]).join("\n\n"));
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

  const brukEgen = () => {
    setSettInnHva("original");
    return lagre({ dato, egen, feil: [], avsnitt: [egen] });
  };
  const settInn = () => {
    setSettInnHva("forslag");
    return lagre({ dato, egen, feil: titler, ...(fakta.length > 0 && { fakta }), avsnitt });
  };
  const navigasjon = (tilbakeFra: () => void, tekst = "Tilbake") => (
    <>
      <Button type="button" variant="ghost" disabled={arbeider !== null} onClick={tilbakeFra}>
        {tekst}
      </Button>
      {hoppOver && (
        <Button type="button" variant="link" disabled={arbeider !== null} onClick={hoppOver} className="px-2.5">
          Hopp over
        </Button>
      )}
    </>
  );

  const beskrivTekst =
    feiltyper.length === 0
      ? "Beskriv feilen med dine egne ord"
      : `Beskriv feilene på ${feiltyper.length === 1 ? feiltyper[0] : `${feiltyper.slice(0, -1).join(", ")} og ${feiltyper[feiltyper.length - 1]}`} med dine egne ord`;
  const skriv = (
    <>
      {manglerKjopsdato && (
        <Datofelt
          label="Når kjøpte du bilen?"
          hjelp={forslagKjopsdato && kjopsdato === forslagKjopsdato ? "Foreslått fra Statens vegvesen: datoen bilen ble registrert på deg. Rett den hvis den ikke stemmer med kjøpekontrakten." : "Datoen står i kjøpekontrakten."}
          min={`${FRA_AR}-01-01`}
          max={idag}
          verdi={kjopsdato}
          settVerdi={setKjopsdato}
        />
      )}
      <Datofelt
        label="Når viste den første feilen seg?"
        min={kjopOk ? kjop : undefined}
        max={idag}
        verdi={dato}
        settVerdi={setDato}
      />
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${skjemaId}-egen`}>{beskrivTekst}</FieldLabel>
        <Textarea
          id={`${skjemaId}-egen`}
          aria-describedby={`${skjemaId}-egen-hjelp`}
          value={egen}
          onChange={(e) => setEgen(e.target.value.slice(0, BESKRIVELSE_MAKS))}
          placeholder="Motorlampen lyser, og bilen mister trekkraft i motbakker …"
          className="min-h-[180px]"
        />
        <FieldDescription id={`${skjemaId}-egen-hjelp`} className={HJELP}>
          Hva skjer, når og hvor ofte? Har bilen flere feil, ta med alle. Ikke skriv navn på personer. Bruk minst {BESKRIVELSE_MIN} tegn for å kunne gå videre.
        </FieldDescription>
      </Field>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" disabled={!skrivKlar} onClick={fortsett}>
          {arbeider === "sporsmal" ? (
            <>
              <Spinner aria-hidden data-icon="inline-start" /> Leser beskrivelsen
            </>
          ) : arbeider === "utkast" ? (
            <>
              <Spinner aria-hidden data-icon="inline-start" /> Lager forslag
            </>
          ) : (
            "Fortsett"
          )}
        </Button>
        {forslagTekst.trim() !== "" && egen === egenForUtkast && (
          <Button type="button" variant="link" disabled={!datoOk || arbeider !== null} onClick={() => setTrinn("utkast")}>
            Tilbake til forslaget
          </Button>
        )}
        {navigasjon(tilbake, tilbakeTekst)}
      </div>
      {!skrivKlar && arbeider === null && !kjopOk && <p className={HJELP}>Fyll ut kjøpsdatoen for å gå videre.</p>}
    </>
  );

  const sporsmal = (
    <>
      <p className={HJELP}>Vi trenger å stille deg noen flere spørsmål ut fra beskrivelsen du har lagt inn. Svar så godt du kan. Det du ikke vet, hopper du over.</p>
      {grupper.map(
        (g, n) =>
          g.sporsmal.length > 0 && (
            <FieldSet key={n} className="m-0 gap-4 border-0 p-0">
              <FieldLegend className="mb-1 p-0 text-[15px] font-semibold">{g.tittel}</FieldLegend>
              {g.sporsmal.map((s, m) => (
                <SporsmalFelt key={m} sporsmal={s} verdi={svarene[nokkel(n, m)] ?? TOMT} sett={(v) => setSvarene((f) => ({ ...f, [nokkel(n, m)]: v }))} />
              ))}
            </FieldSet>
          ),
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" disabled={arbeider !== null} onClick={() => lagUtkast(fakta)}>
          {arbeider === "utkast" ? (
            <>
              <Spinner aria-hidden data-icon="inline-start" /> Lager forslag
            </>
          ) : (
            "Lag forslag"
          )}
        </Button>
        {navigasjon(() => setTrinn("skriv"))}
      </div>
    </>
  );

  const utkast = (
    <>
      <p className={HJELP}>Les begge tekstene og velg hvilken som skal i brevet. Du kan rette forslaget først. Et nytt avsnitt starter med en blank linje.</p>
      <div className="grid gap-5 md:grid-cols-2">
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${skjemaId}-forslag`}>Forslag til tekst</FieldLabel>
          <Textarea id={`${skjemaId}-forslag`} value={forslagTekst} onChange={(e) => setForslagTekst(e.target.value)} className="min-h-[260px]" />
          <Button type="button" disabled={!utkastOk || arbeider !== null} onClick={settInn} className="self-start">
            {arbeider === "lagrer" && settInnHva === "forslag" ? (
              <>
                <Spinner aria-hidden data-icon="inline-start" /> Setter inn
              </>
            ) : (
              "Bruk vårt forslag"
            )}
          </Button>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${skjemaId}-original`}>Din originale tekst</FieldLabel>
          <Textarea id={`${skjemaId}-original`} value={egen} readOnly className="min-h-[260px] bg-muted/50" />
          <Button type="button" variant="outline" disabled={!datoOk || arbeider !== null} onClick={brukEgen} className="self-start">
            {arbeider === "lagrer" && settInnHva === "original" ? (
              <>
                <Spinner aria-hidden data-icon="inline-start" /> Setter inn
              </>
            ) : (
              "Bruk din tekst"
            )}
          </Button>
        </Field>
      </div>
      {!utkastOk && <p className={HJELP}>{forslagFeil}</p>}
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{navigasjon(() => setTrinn(harSporsmal ? "sporsmal" : "skriv"))}</div>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
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
