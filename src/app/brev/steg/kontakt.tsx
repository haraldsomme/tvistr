"use client";

import { useState } from "react";
import { norskDato } from "@/lib/brev/brev";
import { medKilde, REKLAMASJON_MATER, reparasjonGrunnerFor, type Kilder, type Reklamasjon, type Reparasjon } from "@/lib/brev/utfylling";
import { KONTAKT_TEKST } from "@/app/vurdering/tekster";
import { kjopsdatoAv, type Innsending } from "@/lib/vurdering/innsending";
import { KONTAKT_VALG, rettingValgFor, type Kontakt, type Retting } from "@/lib/vurdering/typer";
import { Datofelt } from "../datofelt";
import { HJELP, Kildefelt, Nedtrekk, Sammendrag, Skjema, valgAv, Valgfelt, type Felles } from "../felt";
import { MomentFelt, useMomenter, type Momenter } from "./moment";
import { vistSporsmal } from "@/lib/brev/momenter";

export const RETTING_TEKST: Record<Retting, string> = {
  ingen: "Nei, feilen er ikke reparert",
  venter: "Forhandleren vil forsøke, eller har ikke svart ennå",
  avvist: "Forhandleren nekter å rette feilen",
  forsokt: "Forhandleren har forsøkt, uten hell",
  ikke_rettet: "Forhandleren har ikke rettet feilen innen rimelig tid, selv om de kunne fått bilen",
  reparert_selv: "Jeg har fått feilen reparert andre steder",
};
const GRUNN_TEKST: Record<Reparasjon["grunn"], string> = {
  avvist: "Forhandleren nektet å rette feilen",
  ikke_rettet: "Forhandleren rettet den ikke innen rimelig tid",
  nodvendig: "Bilen måtte repareres for at jeg skulle kunne bruke den",
  ingen: "Forhandleren fikk ikke sjansen først",
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
// failed (fkjl §§ 29 and 30, met in the letter in `brev.ts`). «Tatt opp med forhandleren» is asked here
// (older cases have it from the assessment), and what has happened since once that is known. Takes the
// raw answers rather than the engine's checked input, so it also works when a deadline that has begun to
// matter since means there is no letter until this step is answered again.
export function KontaktFelt({
  svar,
  idag,
  retting,
  reklamasjon,
  reparasjon,
  kilder,
  momenter,
  aktiv,
  lagre,
  avbryt,
}: Felles & { svar: Innsending; idag: string; retting: Retting | undefined; reklamasjon: Reklamasjon | undefined; reparasjon?: Reparasjon; kilder?: Kilder; momenter?: Momenter }) {
  // Left out where the case cannot be assessed (brevside.tsx): the moments are then neither shown nor saved.
  const m = useMomenter(momenter ?? { aktuelle: [], lagret: undefined });
  // "" until answered: a case opened from the assessment has no answer yet.
  const [kontakt, setKontakt] = useState<Kontakt | "">(svar.kontakt);
  const [valgtRetting, setValgtRetting] = useState<Retting | "">(retting ?? (kontakt === "nei" ? "ingen" : ""));
  const [dato, setDato] = useState(reklamasjon?.dato ?? "");
  const [mate, setMate] = useState<Reklamasjon["mate"] | "">(reklamasjon?.mate ?? "");
  const [forsok, setForsok] = useState(reklamasjon?.forsok ? String(reklamasjon.forsok) : "");
  const [svarDato, setSvarDato] = useState(reklamasjon?.svarDato ?? "");
  const [repDato, setRepDato] = useState(reparasjon?.dato ?? "");
  const [grunn, setGrunn] = useState<Reparasjon["grunn"] | "">(reparasjon?.grunn ?? "");
  const [svarTekst, setSvarTekst] = useState(kilder?.svar ?? "");

  if (!aktiv) {
    const vistRetting = retting ?? (kontakt === "nei" ? "ingen" : undefined);
    if (!kontakt || !vistRetting) return null;
    return (
      <Sammendrag
        linjer={[
          `Tatt opp med forhandleren: ${KONTAKT_TEKST[kontakt].toLowerCase()}`,
          kontakt !== "nei" && reklamasjon && `${norskDato(reklamasjon.dato)} · ${MATE_TEKST[reklamasjon.mate].toLowerCase()}`,
          RETTING_TEKST[vistRetting],
          reklamasjon?.forsok ? `${reklamasjon.forsok} rettingsforsøk` : null,
          kontakt !== "nei" && reklamasjon?.svarDato ? `${vistRetting === "avvist" ? "Avvist" : "Sist forsøkt"} ${norskDato(reklamasjon.svarDato)}` : null,
          vistRetting === "reparert_selv" && reparasjon ? `Reparert ${norskDato(reparasjon.dato)} · ${GRUNN_TEKST[reparasjon.grunn].toLowerCase()}` : null,
        ]}
      />
    );
  }

  const forsokt = valgtRetting === "forsokt";
  const harSvar = valgtRetting === "avvist" || forsokt;
  const reparert = valgtRetting === "reparert_selv";
  const grunner = kontakt ? reparasjonGrunnerFor(kontakt) : [];
  const min = kjopsdatoAv(svar, idag);
  const reklamasjonKlar = kontakt === "nei" || (dato >= min && dato <= idag && mate !== "" && (!forsokt || forsok !== ""));
  const reparasjonKlar = !reparert || (repDato >= min && repDato <= idag && grunn !== "" && grunner.includes(grunn));
  const klar = kontakt !== "" && valgtRetting !== "" && reklamasjonKlar && reparasjonKlar;
  const godtatt = m.gjelder("forhandler_erkjente") && vistSporsmal("forhandler_erkjente", { kontakt });
  const annenArsak = m.gjelder("forhandler_annen_arsak") && vistSporsmal("forhandler_annen_arsak", { retting: valgtRetting });
  const send = () =>
    lagre({
      ...(momenter && { momenter: m.lagring("kontakt", [...(godtatt ? ["forhandler_erkjente"] : []), ...(annenArsak ? ["forhandler_annen_arsak"] : [])]) }),
      svar: { ...svar, kontakt },
      retting: valgtRetting as Retting,
      reklamasjon:
        kontakt === "nei"
          ? null
          : { dato, mate: mate as Reklamasjon["mate"], ...(forsokt && { forsok: Number(forsok) }), ...(harSvar && svarDato >= dato && { svarDato }) },
      reparasjon: reparert ? { dato: repDato, grunn: grunn as Reparasjon["grunn"] } : null,
      kilder: medKilde(kilder, "svar", kontakt === "nei" ? "" : svarTekst),
    });

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      <Valgfelt
        label="Har du tatt opp feilen med forhandleren?"
        verdi={kontakt}
        velg={(v) => {
          setKontakt(v);
          setValgtRetting(v === "nei" ? "ingen" : "");
          setGrunn("");
        }}
        valg={valgAv(KONTAKT_VALG, KONTAKT_TEKST)}
      />
      {kontakt === "nei" && (
        <p className={HJELP}>Forhandleren har rett til å forsøke å rette feilen først. Reparerer du den andre steder før de har fått sjansen, kan du miste retten til å få kostnaden dekket.</p>
      )}
      {kontakt === "ja" && (
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
      {kontakt && (
        <Valgfelt label={kontakt === "nei" ? "Har du fått feilen reparert?" : "Hva har forhandleren gjort?"} verdi={valgtRetting} velg={setValgtRetting} valg={valgAv(rettingValgFor(kontakt), RETTING_TEKST)} />
      )}
      {kontakt === "ja" && forsokt && (
        <Nedtrekk label="Hvor mange ganger har forhandleren forsøkt å rette feilen?" verdi={forsok} velg={setForsok} valg={["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => ({ verdi: n, tekst: n }))} />
      )}
      {kontakt === "ja" && harSvar && (
        <Datofelt
          label={forsokt ? "Når forsøkte forhandleren sist å rette feilen? (valgfritt)" : "Når avviste forhandleren å rette feilen? (valgfritt)"}
          hjelp="Med datoen er tidslinjen i brevet komplett."
          min={dato || min || undefined}
          max={idag}
          verdi={svarDato}
          settVerdi={setSvarDato}
        />
      )}
      {kontakt === "ja" && valgtRetting !== "" && valgtRetting !== "ingen" && (
        <Kildefelt
          label="Lim inn forhandlerens skriftlige svar (valgfritt)"
          hjelp="Har forhandleren svart på e-post, SMS eller brev, lim inn svaret her. Brevet kan da sitere det."
          verdi={svarTekst}
          sett={setSvarTekst}
        />
      )}
      {godtatt && <MomentFelt id="forhandler_erkjente" svar={m.svar} sett={m.sett} />}
      {annenArsak && <MomentFelt id="forhandler_annen_arsak" svar={m.svar} sett={m.sett} />}
      {reparert && (
        <>
          <Datofelt label="Når ble feilen reparert?" hjelp="Datoen på fakturaen fra verkstedet." min={min || undefined} max={idag} verdi={repDato} settVerdi={setRepDato} />
          <Valgfelt label="Hvorfor ble feilen ikke rettet av forhandleren?" verdi={grunn} velg={setGrunn} valg={valgAv(grunner, GRUNN_TEKST)} />
          {grunn === "ingen" && (
            <p className={HJELP}>
              Forhandleren har rett til å forsøke å rette feilen først (§ 29 og § 30). Fikk forhandleren ikke sjansen, kan de kreve at beløpet settes ned til det de selv ville brukt, eller avvise kravet. Brevet sier det som det er.
            </p>
          )}
        </>
      )}
    </Skjema>
  );
}
