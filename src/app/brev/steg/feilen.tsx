"use client";

import { useId, useState } from "react";
import { norskDato } from "@/lib/brev/brev";
import { type Feilen } from "@/lib/brev/utfylling";
import { FEILTYPE_TEKST } from "@/app/vurdering/tekster";
import type { KlageInput } from "@/lib/vurdering/typer";
import { BESKRIVELSE, HJELP, KNAPP, KNAPP_LYS, LABEL, Sammendrag, TEKSTOMRADE, Tekstfelt, type Felles } from "../felt";

// The defect in the buyer's own words, in one field. The defect types come from the assessment and
// cannot be changed here. «Sett inn forbedret tekst» sends it to the language model and puts its
// wording straight in the letter; «Sett inn min egen tekst» puts in what is typed, unchanged. Either
// way the buyer can open the step again («Endre») to try again: it always starts from what was typed,
// not from a model's wording.
export function FeilenFelt({ sakId, input, idag, verdi, aktiv, lagre, avbryt }: Felles & { sakId: string; input: KlageInput; idag: string; verdi: Feilen | undefined }) {
  const id = useId();
  const [dato, setDato] = useState(verdi?.dato ?? "");
  const [egen, setEgen] = useState(verdi?.egen ?? "");
  const [arbeider, setArbeider] = useState<"egen" | "forbedret" | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  const feiltyper = [...new Set(input.feilen.typer)].map((t) => FEILTYPE_TEKST[t]).join(", ");

  if (!aktiv) {
    if (!verdi) return null;
    return <Sammendrag linjer={[feiltyper, `Viste seg ${norskDato(verdi.dato)}`, verdi.tekst.length > 90 ? `${verdi.tekst.slice(0, 90)}…` : verdi.tekst]} />;
  }

  const min = input.bilOgKjop.kjopsdato ?? "";
  const datoOk = dato >= min && dato <= idag;
  const egenOk = egen.trim().length >= BESKRIVELSE.min;
  const klar = datoOk && egenOk && arbeider === null;

  async function settInnEgen() {
    setArbeider("egen");
    setFeil(null);
    await lagre({ feilen: { dato, egen, tekst: egen } });
    setArbeider(null);
  }

  async function settInnForbedret() {
    setArbeider("forbedret");
    setFeil(null);
    try {
      const res = await fetch(`/api/sak/${sakId}/sprakvask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ beskrivelse: egen }) });
      const json = (await res.json()) as { forslag?: string; feil?: string };
      if (!res.ok || !json.forslag) throw new Error(json.feil ?? "");
      await lagre({ feilen: { dato, egen, tekst: json.forslag } });
    } catch (e) {
      setFeil((e instanceof Error && !(e instanceof TypeError) && e.message) || "Vi klarte ikke å lage en forbedret tekst akkurat nå. Bruk «Sett inn min egen tekst» i stedet.");
    }
    setArbeider(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className={HJELP}>Feil du har oppgitt: {feiltyper}.</p>
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
          Beskriv feilen
        </label>
        <textarea
          id={`${id}-egen`}
          aria-describedby={`${id}-egen-hjelp`}
          value={egen}
          onChange={(e) => setEgen(e.target.value.slice(0, BESKRIVELSE.maks))}
          placeholder="Motorlampen lyser, og bilen mister trekkraft i motbakker …"
          className={TEKSTOMRADE}
        />
        <p id={`${id}-egen-hjelp`} className={HJELP}>
          Hva skjer, hvor ofte, og hva har verkstedet funnet? Ikke skriv navn på personer. Velger du «Sett inn forbedret tekst», sendes teksten til en språkmodell (Claude fra Anthropic), og forslaget settes rett inn i brevet.
        </p>
      </div>
      {feil && (
        <p role="alert" className="m-0 text-[13px] leading-[1.5] text-[#a23b2a]">
          {feil}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!klar} onClick={settInnEgen} className={KNAPP_LYS}>
          {arbeider === "egen" ? "Setter inn …" : "Sett inn min egen tekst"}
        </button>
        <button type="button" disabled={!klar} onClick={settInnForbedret} className={KNAPP}>
          {arbeider === "forbedret" ? "Lager forbedret tekst …" : "Sett inn forbedret tekst"}
        </button>
        {avbryt && (
          <button type="button" onClick={avbryt} className="px-2.5 py-[11px] text-[14px] font-medium text-[#5b6472]">
            Avbryt
          </button>
        )}
      </div>
      {!klar && arbeider === null && (
        <p className={HJELP}>
          {!datoOk && !egenOk
            ? "Fyll ut datoen og beskriv feilen for å gå videre."
            : !datoOk
              ? "Fyll ut datoen feilen viste seg for å gå videre."
              : `Beskriv feilen med minst ${BESKRIVELSE.min} tegn for å gå videre.`}
        </p>
      )}
    </div>
  );
}
