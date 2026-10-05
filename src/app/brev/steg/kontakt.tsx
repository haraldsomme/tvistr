"use client";

import { useState } from "react";
import { norskDato } from "@/lib/brev/brev";
import { REKLAMASJON_MATER, type Reklamasjon } from "@/lib/brev/utfylling";
import { KONTAKT_TEKST } from "@/app/vurdering/tekster";
import { kjopsdatoAv, type Innsending } from "@/lib/vurdering/innsending";
import { KONTAKT_VALG, rettingValgFor, type Kontakt, type Retting } from "@/lib/vurdering/typer";
import { Datofelt } from "../datofelt";
import { HJELP, Nedtrekk, Sammendrag, Skjema, valgAv, Valgfelt, type Felles } from "../felt";

export const RETTING_TEKST: Record<Retting, string> = {
  ingen: "Nei, feilen er ikke reparert",
  venter: "Forhandleren vil forsøke, eller har ikke svart ennå",
  avvist: "Forhandleren nekter å rette feilen",
  forsokt: "Forhandleren har forsøkt, uten hell",
  reparert_selv: "Jeg har fått feilen reparert andre steder",
};
const MATE_TEKST: Record<Reklamasjon["mate"], string> = {
  epost: "E-post",
  sms: "SMS",
  telefon: "Telefon",
  oppmote: "Oppmøte hos forhandleren",
  brev: "Brev",
};

// Whether the dealer has been told, and if so when, how and what came of it. Decides the claim:
// repair while the dealer has not had a try, price reduction or cancelling once it has refused or
// failed (fkjl §§ 29 and 30, met in the letter in `brev.ts`). «Tatt opp med forhandleren» comes from
// the assessment and is corrected here, since what has happened since can only be asked once that is
// known. Takes the raw answers rather than the engine's checked input, so it also works when a
// deadline that has begun to matter since means there is no letter until this step is answered again.
export function KontaktFelt({
  svar,
  idag,
  retting,
  reklamasjon,
  aktiv,
  lagre,
  avbryt,
}: Felles & { svar: Innsending; idag: string; retting: Retting | undefined; reklamasjon: Reklamasjon | undefined }) {
  const [kontakt, setKontakt] = useState<Kontakt>(svar.kontakt || "nei");
  const [valgtRetting, setValgtRetting] = useState<Retting | "">(retting ?? (kontakt === "nei" ? "ingen" : ""));
  const [dato, setDato] = useState(reklamasjon?.dato ?? "");
  const [mate, setMate] = useState<Reklamasjon["mate"] | "">(reklamasjon?.mate ?? "");
  const [forsok, setForsok] = useState(reklamasjon?.forsok ? String(reklamasjon.forsok) : "");

  if (!aktiv) {
    const vistRetting = retting ?? (kontakt === "nei" ? "ingen" : undefined);
    if (!vistRetting) return null;
    return (
      <Sammendrag
        linjer={[
          `Tatt opp med forhandleren: ${KONTAKT_TEKST[kontakt].toLowerCase()}`,
          kontakt !== "nei" && reklamasjon && `${norskDato(reklamasjon.dato)} · ${MATE_TEKST[reklamasjon.mate].toLowerCase()}`,
          RETTING_TEKST[vistRetting],
          reklamasjon?.forsok ? `${reklamasjon.forsok} rettingsforsøk` : null,
        ]}
      />
    );
  }

  const forsokt = valgtRetting === "forsokt";
  const min = kjopsdatoAv(svar, idag);
  const reklamasjonKlar = kontakt === "nei" || (dato >= min && dato <= idag && mate !== "" && (!forsokt || forsok !== ""));
  const klar = valgtRetting !== "" && reklamasjonKlar;
  const send = () =>
    lagre({
      svar: { ...svar, kontakt },
      retting: valgtRetting as Retting,
      reklamasjon: kontakt === "nei" ? null : { dato, mate: mate as Reklamasjon["mate"], ...(forsokt && { forsok: Number(forsok) }) },
    });

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      <Valgfelt
        label="Har du tatt opp feilen med forhandleren?"
        verdi={kontakt}
        velg={(v) => {
          setKontakt(v);
          setValgtRetting(v === "nei" ? "ingen" : "");
        }}
        valg={valgAv(KONTAKT_VALG, KONTAKT_TEKST)}
      />
      {kontakt === "nei" && (
        <p className={HJELP}>Forhandleren har rett til å forsøke å rette feilen først. Reparerer du den andre steder før de har fått sjansen, kan du miste retten til å få kostnaden dekket.</p>
      )}
      {kontakt !== "nei" && (
        <>
          <Datofelt
            label="Når tok du opp feilen første gang?"
            hjelp={min ? `Tidligst ${norskDato(min)}, den dagen du kjøpte bilen, og senest i dag.` : "Senest i dag."}
            min={min || undefined}
            max={idag}
            verdi={dato}
            settVerdi={setDato}
          />
          <Valgfelt label="Hvordan tok du kontakt?" verdi={mate} velg={setMate} valg={valgAv(REKLAMASJON_MATER, MATE_TEKST)} />
        </>
      )}
      <Valgfelt label={kontakt === "nei" ? "Har du fått feilen reparert?" : "Hva har forhandleren gjort?"} verdi={valgtRetting} velg={setValgtRetting} valg={valgAv(rettingValgFor(kontakt), RETTING_TEKST)} />
      {kontakt !== "nei" && forsokt && (
        <Nedtrekk label="Hvor mange ganger har forhandleren forsøkt å rette feilen?" verdi={forsok} velg={setForsok} valg={["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => ({ verdi: n, tekst: n }))} />
      )}
    </Skjema>
  );
}
