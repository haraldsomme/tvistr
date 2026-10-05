import type { ReactNode } from "react";
import type { Lagring, Utfylling } from "@/lib/brev/utfylling";
import { gyldigKjopsdato, type Innsending } from "@/lib/vurdering/innsending";
import { gyldigRetting, type KlageInput } from "@/lib/vurdering/typer";
import { AvsenderFelt, KravFelt } from "../felt";
import { BevisFelt } from "./bevis";
import { FeilenFelt } from "./feilen";
import { ForhandlerFelt } from "./forhandler";
import { ForKjopetFelt } from "./for-kjopet";
import { KjopetFelt } from "./kjopet";
import { KontaktFelt } from "./kontakt";

// The fill-in steps in order, for both the letter page (a numbered list beside the letter) and the
// wizard after buying (one step per screen). `tittel` is the step's name in the list, `sporsmal` the
// heading of its screen in the wizard. A step is `ferdig` when the letter has what it asks for.

export const STEG_IDER = ["kjopet", "forhandler", "feilen", "for-kjopet", "kontakt", "bevis", "krav", "avsender"] as const;
export type StegId = (typeof STEG_IDER)[number];

export type StegKontekst = {
  sakId: string;
  input: KlageInput;
  svar: Innsending;
  utfylling: Utfylling;
  idag: string;
  idBase: string;
  forslagKjopsdato?: string | null;
  lagre: (lagring: Lagring) => Promise<boolean>;
};

export type Steg = { id: StegId; tittel: string; sporsmal: string; ferdig: boolean; innhold: (f: { aktiv: boolean; avbryt?: () => void }) => ReactNode };

export function lagSteg({ sakId, input, svar, utfylling, idag, idBase, forslagKjopsdato, lagre }: StegKontekst): Steg[] {
  const forhandler = utfylling.forhandler ?? null;
  const retting = gyldigRetting(svar.kontakt || "nei", utfylling.retting);
  const kjopetFerdig = gyldigKjopsdato(svar.kjopsdato, idag) && /^\d+$/.test(svar.kjopesum) && utfylling.forbehold !== undefined;
  const kontakt = svar.kontakt || "nei";
  const kontaktFerdig = kontakt === "nei" || (retting !== undefined && utfylling.reklamasjon !== undefined && (retting !== "forsokt" || utfylling.reklamasjon.forsok !== undefined));
  const kanVelgeKrav = retting === "avvist" || retting === "forsokt" || retting === "reparert_selv";
  const felles = (f: { aktiv: boolean; avbryt?: () => void }) => ({ ...f, lagre });

  return [
    {
      id: "kjopet",
      tittel: "Kjøpet",
      sporsmal: "Om kjøpet",
      ferdig: kjopetFerdig,
      innhold: (f) => <KjopetFelt kjoretoy={utfylling.kjoretoy!} svar={svar} idag={idag} verdi={utfylling.forbehold} forslagKjopsdato={forslagKjopsdato} {...felles(f)} />,
    },
    {
      id: "forhandler",
      tittel: "Forhandler",
      sporsmal: "Hvem kjøpte du bilen av?",
      ferdig: forhandler !== null,
      innhold: () => <ForhandlerFelt forhandler={forhandler} funnet={(v) => lagre({ forhandler: v })} tittelId={`${idBase}-forhandler`} />,
    },
    {
      id: "feilen",
      tittel: "Feilen",
      sporsmal: "Beskriv feilen",
      ferdig: utfylling.feilen !== undefined,
      innhold: (f) => <FeilenFelt sakId={sakId} input={input} verdi={utfylling.feilen} aktiv={f.aktiv} />,
    },
    {
      id: "for-kjopet",
      tittel: "Før kjøpet",
      sporsmal: "Hva visste du før kjøpet?",
      ferdig: utfylling.feilopplyst !== undefined,
      innhold: (f) => <ForKjopetFelt svar={svar} verdi={utfylling.opplysning} feilopplyst={utfylling.feilopplyst} {...felles(f)} />,
    },
    {
      id: "kontakt",
      tittel: "Kontakt med forhandleren",
      sporsmal: "Har du tatt opp feilen med forhandleren?",
      ferdig: kontaktFerdig,
      innhold: (f) => <KontaktFelt svar={svar} idag={idag} retting={retting} reklamasjon={utfylling.reklamasjon} {...felles(f)} />,
    },
    {
      id: "bevis",
      tittel: "Bevis og vedlegg",
      sporsmal: "Hva har du av dokumentasjon?",
      ferdig: utfylling.vedlegg !== undefined,
      innhold: (f) => <BevisFelt input={input} svar={svar} utfylling={utfylling} {...felles(f)} />,
    },
    {
      id: "krav",
      tittel: "Kravet",
      sporsmal: "Hva krever du?",
      ferdig: utfylling.krav !== undefined && (!kanVelgeKrav || utfylling.krav.type !== undefined),
      innhold: (f) => <KravFelt kanVelge={kanVelgeKrav} verdi={utfylling.krav} {...felles(f)} />,
    },
    {
      id: "avsender",
      tittel: "Deg",
      sporsmal: "Hvem sender brevet?",
      ferdig: utfylling.avsender !== undefined,
      innhold: (f) => <AvsenderFelt verdi={utfylling.avsender} {...felles(f)} />,
    },
  ];
}
