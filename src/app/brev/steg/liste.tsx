import type { ReactNode } from "react";
import type { Lagring, Utfylling } from "@/lib/brev/utfylling";
import { gyldigKjopsdato, type Innsending } from "@/lib/vurdering/innsending";
import { gyldigRetting, type KlageInput } from "@/lib/vurdering/typer";
import { harFatt } from "@/lib/brev/brev";
import { momenterFor } from "@/lib/brev/momenter";
import { beregnFaktorer } from "@/lib/vurdering/faktorer";
import { AvsenderFelt, KravFelt } from "../felt";
import { GjennomgangFelt } from "./gjennomgang";
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

export const STEG_IDER = ["kjopet", "forhandler", "feilen", "for-kjopet", "kontakt", "rapport", "krav", "avsender", "vedlegg", "gjennomgang"] as const;
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
  const retting = gyldigRetting(svar.kontakt || undefined, utfylling.retting);
  const kjopetFerdig = gyldigKjopsdato(svar.kjopsdato, idag) && /^\d+$/.test(svar.kjopesum) && utfylling.forbehold !== undefined;
  // "" until the step is answered: a case opened from the assessment has no answer about contact.
  const kontakt = svar.kontakt;
  const reparasjonFerdig = retting !== "reparert_selv" || utfylling.reparasjon !== undefined;
  const kontaktFerdig =
    kontakt !== "" && reparasjonFerdig && (kontakt === "nei" || (retting !== undefined && utfylling.reklamasjon !== undefined && (retting !== "forsokt" || utfylling.reklamasjon.forsok !== undefined)));
  const kanVelgeKrav = harFatt(retting);
  const felles = (f: { aktiv: boolean; avbryt?: () => void }) => ({ ...f, lagre });
  // The moments the steps ask about this case (`steg` in momenter.ts), and the answers saved.
  const momenter = { aktuelle: momenterFor(beregnFaktorer(input, idag)).map((m) => m.id), lagret: utfylling.momenter };

  return [
    {
      id: "kjopet",
      tittel: "Kjøpet",
      ferdig: kjopetFerdig,
      innhold: (f) => <KjopetFelt kjoretoy={utfylling.kjoretoy!} svar={svar} idag={idag} verdi={utfylling.forbehold} forslagKjopsdato={forslagKjopsdato} momenter={momenter} {...felles(f)} />,
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
      // The type is asked in the same step; an older case has it from the assessment.
      ferdig: utfylling.feilen !== undefined && svar.feiltyper.length > 0,
      innhold: (f) => <FeilenFelt input={input} svar={svar} idag={idag} verdi={utfylling.feilen} kmVedFeil={utfylling.kmVedFeil} momenter={momenter} {...felles(f)} />,
    },
    {
      id: "for-kjopet",
      tittel: "Før kjøpet",
      ferdig: utfylling.feilopplyst !== undefined,
      innhold: (f) => <ForKjopetFelt svar={svar} verdi={utfylling.opplysning} feilopplyst={utfylling.feilopplyst} kilder={utfylling.kilder} bruktimportert={utfylling.kjoretoy?.bruktimportert} momenter={momenter} {...felles(f)} />,
    },
    {
      id: "kontakt",
      tittel: "Kontakt med forhandleren",
      ferdig: kontaktFerdig,
      innhold: (f) => <KontaktFelt svar={svar} idag={idag} retting={retting} reklamasjon={utfylling.reklamasjon} reparasjon={utfylling.reparasjon} kilder={utfylling.kilder} momenter={momenter} {...felles(f)} />,
    },
    {
      // Asked here (older cases have the answers from the assessment). During the first pass of the wizard
      // a report that points backward still waits for what it says, so a buyer who comes back is taken
      // here; after it, the transcript is optional.
      id: "rapport",
      tittel: "Tilstandsrapport",
      ferdig: rapportBesvart(svar) && (svar.rapportSierForKjop !== "ja" || utfylling.rapport !== undefined || utfylling.gjennomgatt === true),
      innhold: (f) => <RapportFelt svar={svar} verdi={utfylling.rapport} kilder={utfylling.kilder} verksted={utfylling.verksted} idag={idag} momenter={momenter} {...felles(f)} />,
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
    {
      // Last before the review, as in the letter: the suggestion follows the claim (a quote, receipts).
      id: "vedlegg",
      tittel: "Vedlegg",
      ferdig: utfylling.vedlegg !== undefined,
      innhold: (f) => <VedleggFelt input={input} utfylling={utfylling} {...felles(f)} />,
    },
    {
      // The clarifying round: last, when the facts it asks about are in.
      id: "gjennomgang",
      tittel: "Gjennomgang",
      ferdig: utfylling.avklart === true,
      innhold: (f) => <GjennomgangFelt sakId={sakId} svar={svar} utfylling={utfylling} idag={idag} {...felles(f)} />,
    },
  ];
}
