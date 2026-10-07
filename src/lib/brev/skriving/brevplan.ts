import { leggTilManeder } from "@/lib/vurdering/faktorer";
import { NAAR } from "@/lib/vurdering/grunnlag";
import { HENVISNINGER, velgHenvisning } from "@/lib/vurdering/henvisninger";
import {
  harFatt,
  JURIDISK,
  kreverPenger,
  kroner,
  liste,
  norskDato,
  REKLAMASJON_ALLTID_I_TIDE_MANEDER,
  SVARFRIST_DAGER,
  UTGIFT,
  vedleggFor,
  VEDLEGG_NAVN,
} from "../brev";
import { MOMENTER } from "../momenter";
import { sjekkBrev, type Advarsel } from "../sjekk";
import { rensTekst, type Saksmodell } from "./saksmodell";

// The rules of the letter worked out in code before anything is written: what it must argue, in order,
// each with the legal wording it rests on (`foring`); what it must not argue; and what is missing and so
// stands as a placeholder. The author may word it freely but not change its legal content. Not reviewed
// by a lawyer.

export const ARGUMENT_IDER = [
  "innledning",
  "feilen",
  "mangel",
  "formodning",
  "tidspunkt",
  "rapport_bevis",
  "opplysning",
  "kjente_ikke",
  "momenter",
  "henvisning",
  "forbehold",
  "slitasje",
  "femarsfrist",
  "frist_overholdt",
  "historikk",
  "reklamasjon",
  "avviser_nytt_forsok",
  "krav_retting",
  "krav_heving",
  "krav_prisavslag",
  "krav_valg",
  "vesentlig",
  "subsidiaert_prisavslag",
  "rente_heving",
  "rente",
  "erstatning",
  "kontonummer",
  "forbehold_tap",
  "svarfrist",
  "vedlegg",
] as const;
export type ArgumentId = (typeof ARGUMENT_IDER)[number];

export type Argument = { id: ArgumentId; foring: string; data: Record<string, unknown> };
export type Forbud = { id: ArgumentId; grunn: string };
// What is missing, as it stands in the placeholder «[MANGLER: tekst]», and the step that fills it in.
export type Mangel = { tekst: string; steg: string };
export type Kildehenvisning = { ref: string; organ: string; dato: string; kildeUrl: string };
export type Brevplan = {
  argumenter: Argument[];
  forbudt: Forbud[];
  mangler: Mangel[];
  henvisning: Kildehenvisning | null;
  // The marks the author may use besides quotes; filled in by `render.ts`.
  merker: string[];
  // The points of `sjekkBrev` about the case, not the text: the author must not contradict them.
  advarsler: Advarsel[];
};

export function planlegg(m: Saksmodell): Brevplan {
  const { input, faktorer: f, utfylling: u, idag, kjopsdato } = m;
  const argumenter: Argument[] = [];
  const forbudt: Forbud[] = [];
  const mangler: Mangel[] = [];
  const merker = ["dato:svarfrist"];
  const legg = (id: ArgumentId, foring: string, data: Record<string, unknown> = {}) => void argumenter.push({ id, foring, data });
  const forby = (id: ArgumentId, grunn: string) => void forbudt.push({ id, grunn });
  const mangel = (tekst: string, steg: string) => void mangler.push({ tekst, steg });
  // The plan is sent to the author: what the buyer typed is cleaned as the case is.
  const rens = (t: string) => rensTekst(t, m.kjente);
  const { kjopesumNok, kmVedKjop } = input.bilOgKjop;
  const kontakt = input.feilen.kontakt === "ja";
  const retting = u.retting;
  const r = kontakt ? u.reklamasjon : undefined;
  const utgifter = u.krav?.utgifter ?? [];

  // The purchase and the defect.
  if (!input.bilOgKjop.kjopsdato) mangel("kjøpsdato", "kjopet");
  if (kjopesumNok == null) mangel("kjøpesum", "kjopet");
  legg("innledning", "Vis til kjøpet av bilen fra dere, med kjøpsdatoen og kjøpesummen.", { kjopsdato: input.bilOgKjop.kjopsdato ?? null, kjopesumNok: kjopesumNok ?? null });
  if (!u.feilen) mangel("beskrivelse av feilen: når den viste seg, hva som skjer, og hva verkstedet har funnet", "feilen");
  legg(
    "feilen",
    "Beskriv feilen ut fra kjøperens egne opplysninger: hva som skjer, når og hvor ofte, hva det betyr for bruken av bilen, og hva et verksted har funnet.",
    { forsteGang: u.feilen?.dato ?? null, antallFeil: u.feilen?.feil.length ?? null },
  );

  // The defect and the burden of proof.
  legg("mangel", "Bilen har en mangel etter forbrukerkjøpsloven § 16.");
  if (f.presumsjon) {
    const periode = f.presumsjonManeder === 24 ? "to år" : "seks måneder";
    legg("formodning", `Feilen viste seg innen ${periode} etter levering. Det følger av § 18 andre ledd at en mangel som viser seg innen ${periode} etter levering, antas å ha eksistert ved leveringen, med mindre dere beviser noe annet.`, { periode });
  } else {
    forby("formodning", "Feilen viste seg etter formodningsperioden i § 18 andre ledd.");
    legg("tidspunkt", `Feilen viste seg ${NAAR[f.oppdaget]} etter levering.`);
  }
  if (f.rapportSierForKjop === true) {
    legg(
      "rapport_bevis",
      // With the report's own text, the letter says what it says, not what the buyer answered it says.
      m.kilder.rapport
        ? `En verksted- eller tilstandsrapport er limt inn. Gjengi eller siter bare det den faktisk sier om årsaken og om når feilen oppsto. Sier den ikke noe om tidspunktet, skriv ikke at den viser eller støtter at feilen var der da jeg overtok bilen${f.presumsjon ? "" : ", jf. § 18 første ledd"}.`
        : f.presumsjon
          ? "En verksted- eller tilstandsrapport støtter også at feilen var der allerede da jeg overtok bilen."
          : "En verksted- eller tilstandsrapport sier at feilen sannsynligvis var til stede før jeg overtok bilen, jf. § 18 første ledd.",
      { fra: u.rapport ? rens(u.rapport.fra) : null, dato: u.rapport?.dato ?? null, kanSiteres: Boolean(m.kilder.rapport) },
    );
  } else forby("rapport_bevis", "Ingen rapport sier at feilen var der før kjøpet.");
  if (input.feilen.feilOpplysning !== "nei") {
    if (!u.opplysning) mangel("hva annonsen eller selgeren opplyste som ikke stemte", "for-kjopet");
    legg("opplysning", "Det dere opplyste om bilen før kjøpet, stemmer ikke, og bilen svarer dermed ikke til opplysningene dere har gitt, jf. § 16.", { kilde: u.opplysning?.kilde ?? null, kanSiteres: Boolean(m.kilder.opplysning) });
  } else forby("opplysning", "Kjøperen har ikke sagt at dere ga uriktige opplysninger.");
  if (input.feilen.opplystForKjop === "nei") legg("kjente_ikke", "Jeg kjente ikke til feilen da jeg kjøpte bilen, og dere opplyste ikke om den.");

  // The moments the buyer answered in the clarifying round: a favourable answer becomes an argument in the
  // moment's own wording; an unfavourable one is a weakness the author must not contradict.
  const gunstige: string[] = [];
  const svake: Advarsel[] = [];
  for (const a of m.avklaringer) {
    const moment = a.moment ? MOMENTER.find((x) => x.id === a.moment) : undefined;
    if (!moment || !a.svar) continue;
    const svar = rens(a.svar);
    if (moment.gunstig.some((g) => a.svar!.includes(g))) gunstige.push(`${moment.navn}: ${moment.argument} Kjøperens svar: «${svar}».`);
    else svake.push({ id: `moment-${moment.id}`, tekst: `${moment.navn}: kjøperen svarte «${svar}».`, steg: null, alvor: "myk" });
  }
  if (gunstige.length) {
    legg(
      "momenter",
      `Bruk disse forholdene, som Forbrukerklageutvalget har lagt vekt på i lignende saker, der de hører hjemme i brevet. Plassholderne i parentes fylles med det kjøperen har svart; skriv ingenting kjøperen ikke har svart. ${gunstige.join(" ")}`,
    );
  } else forby("momenter", "Kjøperen har ikke gitt gunstige svar om forhold utvalget legger vekt på.");

  // The decision the letter cites, chosen as the assessment chose it; its source is a mark.
  // Never a decision from after the letter's own date.
  const valgt = velgHenvisning(f, HENVISNINGER.filter((h) => h.dato <= idag));
  let henvisning: Kildehenvisning | null = null;
  if (valgt) {
    const h = valgt.henvisning;
    henvisning = { ref: h.ref, organ: h.organ, dato: h.dato, kildeUrl: h.kildeUrl };
    merker.push("henvisning");
    legg("henvisning", JURIDISK.henvisning(valgt, f).replace(`(${h.ref}, ${norskDato(h.dato)}, ${h.kildeUrl}).`, "{{henvisning}}."), { treff: valgt.treff });
  }

  // What the dealer may object.
  const forbehold = u.forbehold && JURIDISK.forbehold(u.forbehold, f.presumsjonManeder, input.feilen.opplystForKjop === "ja");
  if (forbehold) legg("forbehold", forbehold, { forbehold: u.forbehold });
  const nevnerSlitasje = /slit/i.test([u.rapport?.sitat ?? "", u.feilen?.egen ?? "", ...(u.feilen?.avsnitt ?? []), m.kilder.rapport ?? ""].join(" "));
  if (f.slitasjeAktuelt) legg("slitasje", JURIDISK.slitasje(kmVedKjop, nevnerSlitasje), { kmVedKjop: kmVedKjop ?? null });
  else forby("slitasje", "Feilen er ikke av en type slitasje kan forklare.");

  // Deadlines. The two years run from delivery to the first complaint, or to this letter.
  const reklamert = r ? r.dato : idag;
  const delene = f.feilgrupper.length === 0 || f.feilgrupper.some((g) => g[0] !== "km_avvik" && g[0] !== "kollisjonsskade");
  if (reklamert > leggTilManeder(kjopsdato, 24)) legg("femarsfrist", JURIDISK.femArsfrist(delene));
  else forby("femarsfrist", "Reklamasjonen kommer innen to år etter levering.");
  if (f.femAarGatt && !f.fristUte) legg("frist_overholdt", "Det er mer enn fem år siden jeg overtok bilen, men jeg tok feilen opp med dere innen fem år, slik at fristen i § 27 andre ledd er overholdt.", { forsteReklamasjon: r?.dato ?? null });

  // What has happened between the buyer and the dealer, in the order it happened.
  const hendelser: string[] = [];
  if (kontakt) {
    if (!u.reklamasjon) mangel("dato og måte du tok opp feilen med forhandleren", "kontakt");
    hendelser.push("Når og hvordan jeg tok opp feilen med dere første gang.");
    if (u.reklamasjon && u.feilen && u.reklamasjon.dato >= u.feilen.dato && u.reklamasjon.dato <= leggTilManeder(u.feilen.dato, REKLAMASJON_ALLTID_I_TIDE_MANEDER)) hendelser.push("Det var mindre enn to måneder etter at jeg oppdaget feilen.");
    if (retting === "avvist") hendelser.push("Dere avviste å rette feilen.");
    if (retting === "forsokt") hendelser.push("Dere har forsøkt å rette feilen uten å lykkes (antall forsøk og datoen for det siste forsøket står i dataene når de er kjent).");
    if (retting === "ikke_rettet") hendelser.push("Dere har ikke rettet feilen innen rimelig tid, selv om bilen har stått til rådighet for retting, jf. § 30.");
    if (retting === "venter") hendelser.push("Feilen er ennå ikke rettet.");
  }
  if (retting === "reparert_selv") {
    if (u.reparasjon) hendelser.push(JURIDISK.reparasjon[u.reparasjon.grunn](norskDato(u.reparasjon.dato)));
    else mangel("dato for reparasjonen, og hvorfor forhandleren ikke rettet feilen", "kontakt");
  }
  if (kontakt || retting === "reparert_selv") {
    legg("historikk", `Fortell i tidsrekkefølge hva som har skjedd: ${hendelser.join(" ")}`.trim(), {
      forsteReklamasjon: r ? { dato: r.dato, mate: r.mate } : null,
      [retting === "forsokt" ? "sisteForsok" : "forhandlerensSvar"]: r?.svarDato ?? null,
      antallForsok: r?.forsok ?? null,
      retting: retting ?? null,
      reparasjon: retting === "reparert_selv" ? (u.reparasjon ?? null) : null,
    });
  } else forby("historikk", "Kjøperen har ikke tatt opp feilen med dere før, og bilen er ikke reparert andre steder.");

  // The complaint itself: a first one, or the written confirmation of one already made (§ 27).
  const iTide = !kontakt && u.feilen && idag <= leggTilManeder(u.feilen.dato, REKLAMASJON_ALLTID_I_TIDE_MANEDER);
  legg(
    "reklamasjon",
    kontakt ? "Jeg bekrefter herved reklamasjonen skriftlig, jf. forbrukerkjøpsloven § 27." : `Jeg reklamerer herved på mangelen i medhold av forbrukerkjøpsloven § 27${iTide ? ", mindre enn to måneder etter at jeg oppdaget feilen" : ""}.`,
  );
  if (retting === "forsokt" && f.presumsjonManeder === 24 && u.krav?.type) legg("avviser_nytt_forsok", JURIDISK.avviserNyttForsok);

  // The claim. The dealer has the first try (§ 29); then a price reduction or cancelling (§§ 31, 32).
  if (!harFatt(retting)) {
    legg("krav_retting", "Jeg krever at dere retter mangelen for egen regning innen rimelig tid, jf. § 29 og § 30. Retting skal skje uten kostnad og uten vesentlig ulempe for meg.");
    for (const id of ["krav_heving", "krav_prisavslag", "krav_valg"] as const) forby(id, "Dere har ikke fått forsøke å rette feilen ennå (§ 29).");
  } else {
    forby("krav_retting", "Dere har allerede fått forsøke å rette feilen, eller den er reparert andre steder.");
    if (u.krav?.type === "heving") {
      legg("krav_heving", `Jeg hever kjøpet, jf. § 32, og krever kjøpesummen${kjopesumNok != null ? ` på ${kroner(kjopesumNok)}` : ""} tilbakebetalt mot at bilen leveres tilbake.`, { kjopesumNok: kjopesumNok ?? null });
      legg("vesentlig", JURIDISK.vesentlig(f.presumsjonManeder));
      legg("subsidiaert_prisavslag", JURIDISK.hevingSubsidiart(u.krav.utbedringNok), { utbedringNok: u.krav.utbedringNok ?? null });
      legg("rente_heving", JURIDISK.renteHeving(r?.dato ?? null));
      forby("krav_prisavslag", "Kjøperen hever kjøpet; prisavslag kreves bare subsidiært.");
    } else if (u.krav?.type === "prisavslag") {
      const verditap = f.feilgrupper.length > 0 && f.feilgrupper.every((g) => g[0] === "km_avvik" || g[0] === "kollisjonsskade");
      const grunnlag = retting === "reparert_selv" ? "som er det reparasjonen kostet" : verditap ? "som tilsvarer verditapet" : "som tilsvarer kostnaden ved å få mangelen rettet";
      legg("krav_prisavslag", u.krav.utbedringNok ? `Jeg krever prisavslag på ${kroner(u.krav.utbedringNok)}, ${grunnlag}, jf. § 31.` : "Jeg krever et forholdsmessig prisavslag, jf. § 31.", { belopNok: u.krav.utbedringNok ?? null });
      legg("rente", JURIDISK.rente);
      forby("krav_heving", "Kjøperen har valgt prisavslag.");
    } else {
      mangel("prisavslag eller heving av kjøpet", "krav");
      legg("krav_valg", "Jeg krever prisavslag eller heving av kjøpet, jf. § 31 og § 32. Valget er ikke gjort, så plassholderen står der kravet skal stå.");
    }
  }

  // Costs as damages (§ 33). Interest covers them too, once.
  if (utgifter.length) {
    const sum = utgifter.reduce((s, x) => s + x.belopNok, 0);
    const poster = utgifter.map((x) => `${x.type === "annet" && x.beskrivelse ? rens(x.beskrivelse) : UTGIFT[x.type]} ${kroner(x.belopNok)}`);
    legg("erstatning", `I tillegg krever jeg erstatning for utgiftene mangelen har påført meg, jf. § 33: ${liste(poster)}${utgifter.length > 1 ? `, til sammen ${kroner(sum)}` : ""}.`, { sumNok: sum });
    if (!argumenter.some((a) => a.id === "rente")) legg("rente", JURIDISK.rente);
  } else forby("erstatning", "Kjøperen krever ingen utgifter dekket.");
  if (kreverPenger(u) && u.avsender?.kontonummer) {
    merker.push("kontonummer");
    legg("kontonummer", "Beløpet bes innbetalt til kontonummer {{kontonummer}}.");
  } else forby("kontonummer", "Brevet krever ikke penger nå, eller kontonummeret er ikke oppgitt.");
  legg(
    "forbehold_tap",
    harFatt(retting)
      ? utgifter.length
        ? "Jeg forbeholder meg retten til å kreve erstatning for ytterligere tap."
        : "Jeg forbeholder meg også retten til erstatning for mitt økonomiske tap etter § 33."
      : `Dersom retting ikke skjer innen rimelig tid, forbeholder jeg meg retten til å kreve prisavslag eller heving av kjøpet etter § 31 og § 32, samt ${utgifter.length ? "ytterligere erstatning" : "erstatning for mitt økonomiske tap"} etter § 33.`,
  );

  // The deadline for an answer and what is enclosed.
  if (u.avsender?.epost) merker.push("epost");
  legg(
    "svarfrist",
    `Jeg ber om skriftlig svar innen ${SVARFRIST_DAGER} dager fra dette brevets dato, det vil si innen {{dato:svarfrist}}${u.avsender?.epost ? ", gjerne på e-post til {{epost}}" : ""}. Får jeg ikke svar innen fristen, eller avviser dere kravet, vil jeg klage saken inn til Forbrukertilsynet for mekling og eventuelt behandling i Forbrukerklageutvalget.`,
  );
  const vedlagt = vedleggFor(input, u).map((v) => VEDLEGG_NAVN[v]);
  if (vedlagt.length) legg("vedlegg", `Vedlagt følger ${liste(vedlagt)}.`, { vedlegg: vedlagt });

  const advarsler = [...sjekkBrev(input, u, idag).map((a) => ({ ...a, tekst: rens(a.tekst) })), ...svake];
  return { argumenter, forbudt, mangler, henvisning, merker, advarsler };
}
