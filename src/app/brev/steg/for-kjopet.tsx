"use client";

import { useId, useState } from "react";
import { OPPLYSNING_KILDER, type Opplysning } from "@/lib/brev/utfylling";
import { OPPLYST_TEKST } from "@/app/vurdering/tekster";
import { OPPLYST_VALG, type Innsending } from "@/lib/vurdering/innsending";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { HJELP, Sammendrag, Skjema, valgAv, Valgfelt, type Felles } from "../felt";

const KILDE_TEKST: Record<Opplysning["kilde"], string> = { annonse: "Annonsen", kontrakt: "Kjøpekontrakten", melding: "Melding fra forhandleren", muntlig: "Muntlig før kjøpet" };

// Two questions the assessment leaves for the letter page: did the buyer know about the defect before
// buying (pre-filled from the assessment, corrected here), and did the ad or the dealer say something
// about the car that was not true. A «ja» to the second asks where and what, quoted in the letter as
// written, so it is not reworded; whether that is documented follows from where it was said.
export function ForKjopetFelt({
  svar,
  verdi,
  feilopplyst,
  aktiv,
  lagre,
  avbryt,
}: Felles & { svar: Innsending; verdi: Opplysning | undefined; feilopplyst: "ja" | "nei" | undefined }) {
  const id = useId();
  const [visste, setVisste] = useState(svar.opplystForKjop);
  const [opplyst, setOpplyst] = useState<"ja" | "nei" | "">(feilopplyst ?? "");
  const [kilde, setKilde] = useState<Opplysning["kilde"] | "">(verdi?.kilde ?? "");
  const [tekst, setTekst] = useState(verdi?.tekst ?? "");

  if (!aktiv) {
    if (feilopplyst === undefined) return null;
    return (
      <Sammendrag
        linjer={[visste && `Visste om feilen før kjøpet: ${OPPLYST_TEKST[visste].toLowerCase()}`, feilopplyst === "nei" ? "Ingen uriktige opplysninger før kjøpet" : verdi && `${KILDE_TEKST[verdi.kilde]}: «${verdi.tekst}»`]}
      />
    );
  }

  const klar = visste !== "" && (opplyst === "nei" || (opplyst === "ja" && kilde !== "" && tekst.trim().length >= 5));
  const send = () =>
    lagre({
      svar: { ...svar, opplystForKjop: visste },
      feilopplyst: opplyst || undefined,
      opplysning: opplyst === "ja" ? { kilde: kilde as Opplysning["kilde"], tekst } : null,
    });

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      <Valgfelt label="Visste du om feilen før du kjøpte?" verdi={visste} velg={setVisste} valg={valgAv(OPPLYST_VALG, OPPLYST_TEKST)} />
      <Valgfelt
        label="Sa annonsen eller selgeren noe om bilen som ikke stemte?"
        verdi={opplyst}
        velg={setOpplyst}
        valg={[
          { verdi: "ja", tekst: "Ja" },
          { verdi: "nei", tekst: "Nei" },
        ]}
      />
      {opplyst === "ja" && (
        <>
          <Valgfelt label="Hvor ble det opplyst?" verdi={kilde} velg={setKilde} valg={valgAv(OPPLYSNING_KILDER, KILDE_TEKST)} />
          <Field className="gap-1.5">
            <FieldLabel htmlFor={`${id}-tekst`}>Hva ble opplyst?</FieldLabel>
            <Textarea id={`${id}-tekst`} aria-describedby={`${id}-hjelp`} value={tekst} onChange={(e) => setTekst(e.target.value.slice(0, 500))} placeholder="Ny clutch i 2025" className="min-h-[76px]" />
            <FieldDescription id={`${id}-hjelp`} className={HJELP}>
              Skriv så ordrett du kan, dette vil stå sitert i anførselstegn i brevet.
            </FieldDescription>
          </Field>
        </>
      )}
    </Skjema>
  );
}
