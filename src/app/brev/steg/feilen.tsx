"use client";

import { useId, useState } from "react";
import { norskDato } from "@/lib/brev/brev";
import { BESKRIVELSE_MAKS, BESKRIVELSE_MIN, type Feilen } from "@/lib/brev/utfylling";
import { FEILTYPE_TEKST, SPORSMAL } from "@/app/vurdering/tekster";
import { FEILTYPER_KNAPPER, kjopsdatoAv, type Innsending } from "@/lib/vurdering/innsending";
import type { FeilKnapp, KlageInput } from "@/lib/vurdering/typer";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Datofelt } from "../datofelt";
import { bareSiffer, gruppert, HJELP, Sammendrag, Skjema, Tekstfelt, type Felles } from "../felt";
import { moment, MomentFelt, useMomenter, type Momenter } from "./moment";
import { vistSporsmal } from "@/lib/brev/momenter";

const [SKRIFTLIG_JA, SKRIFTLIG_NEI] = moment("tidlige_tegn").alternativer;

// The defect: what it concerns (the same buttons the assessment used to have, saved as `svar.feiltyper`;
// they pick the moments, the statistics and the decision the letter cites), the day the first defect showed
// and the buyer's own description, then the moments of the defect the committee has weighed (momenter.ts),
// when they apply: what the defect does to the use of the car, why the buyer did not see it before the
// purchase, the odometer when it showed, and whether the first signs are written down anywhere. No
// language model here; the clarifying round at the end asks what the description lacks.
export function FeilenFelt({
  input,
  svar,
  idag,
  verdi,
  kmVedFeil,
  momenter,
  aktiv,
  lagre,
  avbryt,
}: Felles & { input: KlageInput; svar: Innsending; idag: string; verdi: Feilen | undefined; kmVedFeil: number | undefined; momenter: Momenter }) {
  const id = useId();
  const [typer, setTyper] = useState<FeilKnapp[]>(svar.feiltyper);
  const [dato, setDato] = useState(verdi?.dato ?? "");
  const [egen, setEgen] = useState(verdi?.egen ?? "");
  const [km, setKm] = useState(kmVedFeil === undefined ? "" : String(kmVedFeil));
  const m = useMomenter(momenter);
  const feiltyper = [...new Set(input.feilen.typer ?? [])].map((t) => FEILTYPE_TEKST[t]).join(", ");

  if (!aktiv) {
    if (!verdi) return null;
    const tekst = verdi.egen;
    return <Sammendrag linjer={[feiltyper, `Viste seg ${norskDato(verdi.dato)}`, tekst.length > 90 ? `${tekst.slice(0, 90)}…` : tekst]} />;
  }

  const min = kjopsdatoAv(svar, idag);
  const visKm = m.gjelder("km_etter_kjop");
  const kmFeil = visKm && km !== "" && svar.kmVedKjop !== "" && Number(km) < Number(svar.kmVedKjop) ? "Kilometerstanden kan ikke være lavere enn da du kjøpte bilen." : null;
  const klar = typer.length > 0 && dato !== "" && egen.trim().length >= BESKRIVELSE_MIN && !kmFeil;
  // Why the buyer did not see the defect is no question for one who knew of it.
  const skjult = m.gjelder("skjult_feil") && vistSporsmal("skjult_feil", { opplystForKjop: input.feilen.opplystForKjop ?? "" });
  const viste = ["bruksstans_sikkerhet", ...(skjult ? ["skjult_feil"] : []), "tidlige_tegn"].filter(m.gjelder);
  // The paragraphs the letter from the template uses until the written letter replaces it. A text left
  // as it was keeps what was saved with it (titles and approved paragraphs from the earlier interview).
  const send = () => {
    const t = egen.trim();
    return lagre({
      feilen: verdi && t === verdi.egen ? { ...verdi, dato } : { dato, egen: t, feil: [], avsnitt: [t] },
      momenter: m.lagring("feilen", viste),
      ...(visKm && { kmVedFeil: km ? Number(km) : null }),
      svar: { ...svar, feiltyper: typer },
    });
  };

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      <div role="group" aria-labelledby={`${id}-typer`} aria-describedby={`${id}-typer-hjelp`} className="flex flex-col gap-2.5">
        <span id={`${id}-typer`} className="text-[15px] font-semibold">
          {SPORSMAL.feiltype}
        </span>
        <span id={`${id}-typer-hjelp`} className={HJELP}>
          Velg én eller flere.
        </span>
        <div className="flex flex-wrap gap-2">
          {FEILTYPER_KNAPPER.map((t) => (
            <Toggle
              key={t}
              variant="pille"
              size="pille"
              pressed={typer.includes(t)}
              onPressedChange={(pa) => setTyper((x) => (pa ? [...x, t] : x.filter((y) => y !== t)))}
              className="px-3.5 py-2.5 font-ui font-medium"
            >
              {FEILTYPE_TEKST[t]}
            </Toggle>
          ))}
        </div>
      </div>
      <Datofelt
        label="Når viste den første feilen seg?"
        hjelp="Merket du tegn på feilen tidligere, for eksempel en lyd eller en lukt, skriv den datoen."
        min={min || undefined}
        max={idag}
        verdi={dato}
        settVerdi={setDato}
      />
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${id}-egen`}>Beskriv feilen med dine egne ord</FieldLabel>
        <Textarea id={`${id}-egen`} aria-describedby={`${id}-hjelp`} value={egen} onChange={(e) => setEgen(e.target.value.slice(0, BESKRIVELSE_MAKS))} className="min-h-35" />
        <FieldDescription id={`${id}-hjelp`} className={HJELP}>
          Skriv hva som skjer, når det skjer og hvor ofte. Har bilen flere feil, beskriv hver av dem. Kostnader, verkstedets funn og hva forhandleren har sagt fyller du inn senere.
        </FieldDescription>
      </Field>
      {m.gjelder("bruksstans_sikkerhet") && <MomentFelt id="bruksstans_sikkerhet" svar={m.svar} sett={m.sett} />}
      {skjult && <MomentFelt id="skjult_feil" svar={m.svar} sett={m.sett} />}
      {visKm && (
        <Tekstfelt
          label="Hva sto kilometertelleren på da feilen viste seg? (valgfritt)"
          hjelp="Den står ofte på fakturaen fra verkstedet. Med kilometerstanden ved kjøpet regner vi ut hvor langt du hadde kjørt."
          feil={kmFeil}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Kilometer"
          value={gruppert(km)}
          onChange={(e) => setKm(bareSiffer(e.target.value))}
        />
      )}
      {m.gjelder("tidlige_tegn") && (
        <MomentFelt
          id="tidlige_tegn"
          label={`Finnes det noe skriftlig fra ${dato ? norskDato(dato) : "da feilen viste seg"} eller like etter, for eksempel en melding, en e-post eller en verkstedfaktura?`}
          svar={m.svar}
          sett={m.sett}
          valg={[
            { verdi: SKRIFTLIG_JA, tekst: "Ja" },
            { verdi: SKRIFTLIG_NEI, tekst: "Nei" },
          ]}
        />
      )}
    </Skjema>
  );
}
