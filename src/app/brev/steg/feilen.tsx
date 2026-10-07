"use client";

import { useId, useState } from "react";
import { norskDato } from "@/lib/brev/brev";
import { BESKRIVELSE_MAKS, BESKRIVELSE_MIN, type Feilen } from "@/lib/brev/utfylling";
import { FEILTYPE_TEKST } from "@/app/vurdering/tekster";
import { kjopsdatoAv, type Innsending } from "@/lib/vurdering/innsending";
import type { KlageInput } from "@/lib/vurdering/typer";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Datofelt } from "../datofelt";
import { HJELP, Sammendrag, Skjema, type Felles } from "../felt";

// The defect: the day the first defect showed and the buyer's own description. No language model here;
// the clarifying round at the end asks what is missing, and the letter is written from the facts.
export function FeilenFelt({ input, svar, idag, verdi, aktiv, lagre, avbryt }: Felles & { input: KlageInput; svar: Innsending; idag: string; verdi: Feilen | undefined }) {
  const id = useId();
  const [dato, setDato] = useState(verdi?.dato ?? "");
  const [egen, setEgen] = useState(verdi?.egen ?? "");
  const feiltyper = [...new Set(input.feilen.typer)].map((t) => FEILTYPE_TEKST[t]).join(", ");

  if (!aktiv) {
    if (!verdi) return null;
    const tekst = verdi.egen;
    return <Sammendrag linjer={[feiltyper, `Viste seg ${norskDato(verdi.dato)}`, tekst.length > 90 ? `${tekst.slice(0, 90)}…` : tekst]} />;
  }

  const min = kjopsdatoAv(svar, idag);
  const klar = dato !== "" && egen.trim().length >= BESKRIVELSE_MIN;
  // The paragraphs the letter from the template uses until the written letter replaces it. A text left
  // as it was keeps what was saved with it (titles and approved paragraphs from the earlier interview).
  const send = () => {
    const t = egen.trim();
    return lagre({ feilen: verdi && t === verdi.egen ? { ...verdi, dato } : { dato, egen: t, feil: [], avsnitt: [t] } });
  };

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      <p className={HJELP}>Feil du har oppgitt: {feiltyper}.</p>
      <Datofelt label="Når viste den første feilen seg?" min={min || undefined} max={idag} verdi={dato} settVerdi={setDato} />
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${id}-egen`}>Beskriv feilen med dine egne ord</FieldLabel>
        <Textarea id={`${id}-egen`} aria-describedby={`${id}-hjelp`} value={egen} onChange={(e) => setEgen(e.target.value.slice(0, BESKRIVELSE_MAKS))} className="min-h-35" />
        <FieldDescription id={`${id}-hjelp`} className={HJELP}>
          Skriv hva som skjer, når og hvor ofte, hva det betyr for bruken av bilen, og hva et verksted har funnet. Har bilen flere feil, beskriv hver av dem. Kostnader og hva forhandleren har sagt fyller du inn senere.
        </FieldDescription>
      </Field>
    </Skjema>
  );
}
