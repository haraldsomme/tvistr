"use client";

import { useState } from "react";
import { norskDato } from "@/lib/brev/brev";
import { REKLAMASJON_MATER, type Reklamasjon } from "@/lib/brev/utfylling";
import { KONTAKT_TEKST } from "@/app/vurdering/tekster";
import { kjopsdatoAv, type Innsending } from "@/lib/vurdering/innsending";
import { KONTAKT_VALG, rettingValgFor, type Kontakt, type Retting } from "@/lib/vurdering/typer";
import { HJELP, Nedtrekk, Sammendrag, Skjema, Tekstfelt, type Felles } from "../felt";

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
  const [valgtRetting, setValgtRetting] = useState<string>(retting ?? (kontakt === "nei" ? "ingen" : ""));
  const [dato, setDato] = useState(reklamasjon?.dato ?? "");
  const [mate, setMate] = useState<string>(reklamasjon?.mate ?? "");
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
      <Nedtrekk
        label="Har du tatt opp feilen med forhandleren?"
        value={kontakt}
        onChange={(e) => {
          const v = e.target.value as Kontakt;
          setKontakt(v);
          setValgtRetting(v === "nei" ? "ingen" : "");
        }}
      >
        {KONTAKT_VALG.map((v) => (
          <option key={v} value={v}>
            {KONTAKT_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
      {kontakt === "nei" && (
        <p className={HJELP}>Forhandleren har rett til å forsøke å rette feilen først. Reparerer du den andre steder før de har fått sjansen, kan du miste retten til å få kostnaden dekket.</p>
      )}
      {kontakt !== "nei" && (
        <>
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
        </>
      )}
      <Nedtrekk label={kontakt === "nei" ? "Har du fått feilen reparert?" : "Hva har forhandleren gjort?"} value={valgtRetting} onChange={(e) => setValgtRetting(e.target.value)}>
        <option value="">Velg</option>
        {rettingValgFor(kontakt).map((v) => (
          <option key={v} value={v}>
            {RETTING_TEKST[v]}
          </option>
        ))}
      </Nedtrekk>
      {kontakt !== "nei" && forsokt && (
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
