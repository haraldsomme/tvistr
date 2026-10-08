"use client";

import { useId, useState } from "react";
import { medKilde, OPPLYSNING_KILDER, type Kilder, type Opplysning } from "@/lib/brev/utfylling";
import { OPPLYST_TEKST, SPORSMAL } from "@/app/vurdering/tekster";
import type { Innsending } from "@/lib/vurdering/innsending";
import { OPPLYST_VALG } from "@/lib/vurdering/typer";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { HJELP, Kildefelt, Sammendrag, Skjema, valgAv, Valgfelt, type Felles } from "../felt";
import { moment, MomentFelt, useMomenter, type Momenter } from "./moment";
import { vistSporsmal } from "@/lib/brev/momenter";

const [IMPORT_IKKE_OPPLYST, IMPORT_OPPLYST, IMPORT_NEI] = moment("bruktimport_ikke_opplyst").alternativer;

const KILDE_TEKST: Record<Opplysning["kilde"], string> = { annonse: "Annonsen", kontrakt: "Kjøpekontrakten", melding: "Melding fra forhandleren", muntlig: "Muntlig før kjøpet" };

// What the buyer knew and was told before buying: did the buyer know about the defect (the three answers,
// pre-filled from the assessment and corrected here), and did the ad or the dealer say something about the
// car that was not true. A «ja» to the second asks where and what, quoted in the letter as written, so it
// is not reworded; whether that is in writing follows from where it was said (`avledSvar`). Then the
// moments of what was known before the purchase (momenter.ts), when they apply. Whether the car was
// imported used comes from the registry when it tells (`bruktimportert`); only whether the ad or the
// contract said so is asked then.
export function ForKjopetFelt({
  svar,
  verdi,
  feilopplyst,
  kilder,
  bruktimportert,
  momenter,
  aktiv,
  lagre,
  avbryt,
}: Felles & { svar: Innsending; verdi: Opplysning | undefined; feilopplyst: "ja" | "nei" | undefined; kilder: Kilder | undefined; bruktimportert: boolean | undefined; momenter: Momenter }) {
  const m = useMomenter(momenter);
  const lagretImport = momenter.lagret?.bruktimport_ikke_opplyst?.svar;
  const [importert, setImportert] = useState<"ja" | "nei" | "">(bruktimportert ? "ja" : lagretImport ? (lagretImport === IMPORT_NEI ? "nei" : "ja") : "");
  const id = useId();
  const [visste, setVisste] = useState(svar.opplystForKjop);
  const [opplyst, setOpplyst] = useState<"ja" | "nei" | "">(feilopplyst ?? "");
  const [kilde, setKilde] = useState<Opplysning["kilde"] | "">(verdi?.kilde ?? "");
  const [tekst, setTekst] = useState(verdi?.tekst ?? "");
  const [kildetekst, setKildetekst] = useState(kilder?.opplysning ?? "");

  if (!aktiv) {
    if (feilopplyst === undefined) return null;
    return (
      <Sammendrag
        linjer={[visste && `Visste om feilen før kjøpet: ${OPPLYST_TEKST[visste].toLowerCase()}`, feilopplyst === "nei" ? "Ingen uriktige opplysninger før kjøpet" : verdi && `${KILDE_TEKST[verdi.kilde]}: «${verdi.tekst}»`]}
      />
    );
  }

  const klar = visste !== "" && (opplyst === "nei" || (opplyst === "ja" && kilde !== "" && tekst.trim().length >= 5));
  // The rule the letter rests on follows the saved answers; a «ja» given now shows its questions at once.
  const beskrivelse = m.gjelder("positiv_beskrivelse") || opplyst === "ja";
  const tjeneste = opplyst === "ja";
  const importSporres = m.gjelder("bruktimport_ikke_opplyst") && vistSporsmal("bruktimport_ikke_opplyst", { bruktimportert });
  const viste = [
    beskrivelse && "positiv_beskrivelse",
    tjeneste && "uriktig_service_arbeid_utstyr",
    m.gjelder("tidligere_skade_ikke_opplyst") && "tidligere_skade_ikke_opplyst",
    importSporres && "bruktimport_ikke_opplyst",
    m.gjelder("dokument_for_salg") && "dokument_for_salg",
  ].filter((x): x is string => Boolean(x));
  const send = () =>
    lagre({
      momenter: m.lagring("for-kjopet", viste),
      svar: { ...svar, opplystForKjop: visste },
      feilopplyst: opplyst || undefined,
      opplysning: opplyst === "ja" ? { kilde: kilde as Opplysning["kilde"], tekst } : null,
      // Only a written source can be pasted in and quoted.
      kilder: medKilde(kilder, "opplysning", opplyst === "ja" && kilde !== "muntlig" ? kildetekst : ""),
    });

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      <Valgfelt label={SPORSMAL.opplyst} verdi={visste} velg={setVisste} valg={valgAv(OPPLYST_VALG, OPPLYST_TEKST)} />
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
              Skriv med egne ord hva som ble sagt eller skrevet.
            </FieldDescription>
          </Field>
          {kilde !== "" && kilde !== "muntlig" && (
            <Kildefelt
              label={`Lim inn teksten fra ${kilde === "annonse" ? "annonsen" : kilde === "kontrakt" ? "kontrakten" : "meldingen"} (valgfritt)`}
              hjelp="Har du teksten, lim den inn her. Brevet siterer bare det som står her."
              verdi={kildetekst}
              sett={setKildetekst}
            />
          )}
          <MomentFelt id="uriktig_service_arbeid_utstyr" svar={m.svar} sett={m.sett} />
        </>
      )}
      {beskrivelse && <MomentFelt id="positiv_beskrivelse" svar={m.svar} sett={m.sett} />}
      {m.gjelder("tidligere_skade_ikke_opplyst") && <MomentFelt id="tidligere_skade_ikke_opplyst" svar={m.svar} sett={m.sett} />}
      {importSporres && bruktimportert === undefined && (
        <Valgfelt
          label="Var bilen bruktimportert?"
          verdi={importert}
          velg={(v) => {
            setImportert(v);
            m.sett("bruktimport_ikke_opplyst", v === "nei" ? { svar: IMPORT_NEI } : null);
          }}
          valg={[
            { verdi: "ja", tekst: "Ja" },
            { verdi: "nei", tekst: "Nei" },
          ]}
        />
      )}
      {importSporres && importert === "ja" && (
        <MomentFelt
          id="bruktimport_ikke_opplyst"
          label="Sto det i annonsen eller kontrakten at bilen var bruktimportert?"
          hjelp={bruktimportert ? "Ifølge Statens vegvesen ble bilen registrert i utlandet før den kom til Norge." : undefined}
          svar={m.svar}
          sett={m.sett}
          valg={[
            { verdi: IMPORT_OPPLYST, tekst: "Ja" },
            { verdi: IMPORT_IKKE_OPPLYST, tekst: "Nei" },
          ]}
        />
      )}
      {m.gjelder("dokument_for_salg") && <MomentFelt id="dokument_for_salg" svar={m.svar} sett={m.sett} />}
    </Skjema>
  );
}
