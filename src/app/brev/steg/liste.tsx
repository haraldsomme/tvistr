import type { ReactNode } from "react";
import type { Lagring, Utfylling } from "@/lib/brev/utfylling";
import { gyldigKjopsdato, type Innsending } from "@/lib/vurdering/innsending";
import { gyldigRetting, type KlageInput } from "@/lib/vurdering/typer";
import { AvsenderFelt, KravFelt } from "../felt";
import { FeilenFelt } from "./feilen";
import { ForhandlerFelt } from "./forhandler";
import { ForKjopetFelt } from "./for-kjopet";
import { KjopetFelt } from "./kjopet";
import { KontaktFelt } from "./kontakt";
import { rapportBesvart, RapportFelt } from "./rapport";
import { VedleggFelt } from "./vedlegg";

// The fill-in steps in order, for both the letter page (a numbered list beside the letter) and the
// wizard after buying (one step per screen). `tittel` names the step in the list and heads its screen
// in the wizard; the questions stay with the fields. A step is `ferdig` when the letter has what it asks for.

export const STEG_IDER = ["kjopet", "forhandler", "feilen", "for-kjopet", "kontakt", "rapport", "vedlegg", "krav", "avsender"] as const;
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

export type Steg = { id: StegId; tittel: string; ferdig: boolean; innhold: (f: { aktiv: boolean; avbryt?: () => void }) => ReactNode };

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
      ferdig: kjopetFerdig,
      innhold: (f) => <KjopetFelt kjoretoy={utfylling.kjoretoy!} svar={svar} idag={idag} verdi={utfylling.forbehold} forslagKjopsdato={forslagKjopsdato} {...felles(f)} />,
    },
    {
      id: "forhandler",
      tittel: "Forhandler",
      ferdig: forhandler !== null,
      innhold: () => <ForhandlerFelt forhandler={forhandler} funnet={(v) => lagre({ forhandler: v })} tittelId={`${idBase}-forhandler`} />,
    },
    {
      id: "feilen",
      tittel: "Feilen",
      ferdig: utfylling.feilen !== undefined,
      innhold: (f) => <FeilenFelt sakId={sakId} input={input} verdi={utfylling.feilen} aktiv={f.aktiv} />,
    },
    {
      id: "for-kjopet",
      tittel: "Før kjøpet",
      ferdig: utfylling.feilopplyst !== undefined,
      innhold: (f) => <ForKjopetFelt svar={svar} verdi={utfylling.opplysning} feilopplyst={utfylling.feilopplyst} {...felles(f)} />,
    },
    {
      id: "kontakt",
      tittel: "Kontakt med forhandleren",
      ferdig: kontaktFerdig,
      innhold: (f) => <KontaktFelt svar={svar} idag={idag} retting={retting} reklamasjon={utfylling.reklamasjon} {...felles(f)} />,
    },
    {
      // The answers come from the assessment. During the first pass of the wizard a report that points
      // backward still waits for what it says, so a buyer who comes back is taken here; after it, the
      // transcript is optional.
      id: "rapport",
      tittel: "Tilstandsrapport",
      ferdig: rapportBesvart(svar) && (svar.rapportSierForKjop !== "ja" || utfylling.rapport !== undefined || utfylling.gjennomgatt === true),
      innhold: (f) => <RapportFelt svar={svar} verdi={utfylling.rapport} idag={idag} {...felles(f)} />,
    },
    {
      id: "vedlegg",
      tittel: "Vedlegg",
      ferdig: utfylling.vedlegg !== undefined,
      innhold: (f) => <VedleggFelt input={input} utfylling={utfylling} {...felles(f)} />,
    },
    {
      id: "krav",
      tittel: "Kravet",
      ferdig: utfylling.krav !== undefined && (!kanVelgeKrav || utfylling.krav.type !== undefined),
      innhold: (f) => <KravFelt kanVelge={kanVelgeKrav} verdi={utfylling.krav} {...felles(f)} />,
    },
    {
      id: "avsender",
      tittel: "Om deg",
      ferdig: utfylling.avsender !== undefined,
      innhold: (f) => <AvsenderFelt verdi={utfylling.avsender} {...felles(f)} />,
    },
  ];
}
