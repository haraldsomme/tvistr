"use client";

import { useId, useState } from "react";
import { OPPLYSNING_KILDER, type Opplysning } from "@/lib/brev/utfylling";
import { OPPLYST_TEKST } from "@/app/vurdering/tekster";
import { OPPLYST_VALG, type Innsending } from "@/lib/vurdering/innsending";
import { HJELP, INPUT, LABEL, Nedtrekk, Sammendrag, Skjema, type Felles } from "../felt";

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
  const [kilde, setKilde] = useState<string>(verdi?.kilde ?? "");
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
      <Nedtrekk label="Visste du om feilen før du kjøpte?" value={visste} onChange={(e) => setVisste(e.target.value as Innsending["opplystForKjop"])}>
        <option value="">Velg</option>
        {OPPLYST_VALG.map((v) => (
          <option key={v} value={v}>
            {OPPLYST_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
      <Nedtrekk label="Sa annonsen eller selgeren noe om bilen som ikke stemte?" value={opplyst} onChange={(e) => setOpplyst(e.target.value as "ja" | "nei")}>
        <option value="">Velg</option>
        <option value="ja">Ja</option>
        <option value="nei">Nei</option>
      </Nedtrekk>
      {opplyst === "ja" && (
        <>
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
        </>
      )}
    </Skjema>
  );
}
