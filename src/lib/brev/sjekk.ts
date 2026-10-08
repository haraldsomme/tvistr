import { beregnFaktorer, leggTilManeder, maneder, PRESUMSJON_TO_AR_FRA, RIMELIG_TID_MANEDER } from "@/lib/vurdering/faktorer";
import type { ValgtHenvisning } from "@/lib/vurdering/henvisninger";
import { grupperFor } from "@/lib/vurdering/henvisninger";
import { VERKSTED_RAD } from "@/lib/vurdering/tiltak";
import { gyldigRetting, type KlageInput } from "@/lib/vurdering/typer";
import { harFatt, kreverPenger, kroner, norskDato, REKLAMASJON_ALLTID_I_TIDE_MANEDER, vedleggBrevetByggerPa, vedleggFor, VEDLEGG_NAVN } from "./brev";
import { moment } from "./momenter";
import type { Utfylling } from "./utfylling";

// What can make the letter weak without leaving a yellow field: a complaint that came late, a repair
// elsewhere the dealer did not get to try first, dates that do not fit together, amounts that cannot be
// right or are claimed twice, an attachment the letter rests on but does not list, and no way to pay the
// buyer. What the buyer typed is checked by the clarifying round and the letter by the writing engine's
// check and review (src/lib/brev/skriving/). Pure, so the letter page, the download and the save dialog
// (`konsekvenserAv`) agree. The texts speak to the buyer, not the dealer. Not reviewed by a lawyer.
//
// `hard` is a point that can sink the claim or makes the letter contradict itself: the page asks before
// the letter is downloaded, and a save that adds one asks first. `myk` is shown above the letter only.

export type Advarsel = { id: string; tekst: string; steg: string | null; alvor: "hard" | "myk"; fast?: true; handling?: string };
// `fast`: nothing the buyer can fill in or obtain changes it. `handling`: the kind of action that fixes it (merged on the page).

const dager = (fra: string, til: string) => Math.round((Date.parse(`${til}T00:00:00Z`) - Date.parse(`${fra}T00:00:00Z`)) / 86_400_000);

// The dealer needs some days to answer and repair; a repair elsewhere sooner than this after the
// complaint is hard to call the dealer's failure to repair within reasonable time.
const MIN_DAGER_FOR_IKKE_RETTET = 14;
const LAV_KJOPESUM = 5000;
// Foreldelsesloven: a claim for a defect is time-barred three years after delivery (§ 3 nr. 2, § 2), but
// never before a year after the buyer learned of it (§ 10 nr. 1). A complaint to the dealer does not stop it.
const FORELDELSE_AR = 3;
const TILLEGGSFRIST_AR = 1;
// How close to the deadline the buyer is warned that the letter alone will not stop it.
const FORELDELSE_VARSEL_DAGER = 60;
// The registry gives the day the car changed owner; the law follows the day of the contract, which can
// be a few weeks earlier. Purchases this close after the change in 2024 are asked to check.
const NAER_LOVENDRING_DAGER = 31;

// A report should come from a workshop, an assessor or the like, not a relative.
const FAGLIG_KILDE = /(\bAS\b|\bASA\b|\bENK\b|\bDA\b|\bANS\b|verksted|bil|naf|takst|mekan|service|motor|senter|center|teknikk|auto|lakk|dekk|garasje|forhandler|merkeverksted|vegvesen|eu-kontroll)/i;
const REPARASJON_I_UTGIFT = /(repar|bytt|ny |nytt |deler|motor|girkasse|clutch|utbedr)/i;
const IKKE_OKONOMISK = /(tort|svie|stress|ulempe|plage|irritasjon|egen tid|min tid|tapt tid|bryderi)/i;
const OKONOMISK = /(inntekt|lønn|arbeid|fravær)/i;

export function sjekkBrev(input: KlageInput, u: Utfylling, idag: string, valgt?: ValgtHenvisning | null): Advarsel[] {
  const f = beregnFaktorer(input, idag);
  const ut: Advarsel[] = [];
  const legg = (a: Advarsel) => ut.push(a);
  const kontakt = input.feilen.kontakt;
  const retting = gyldigRetting(kontakt, u.retting);
  const feilDato = u.feilen?.dato;
  const r = kontakt === "ja" ? u.reklamasjon : undefined;
  const rep = retting === "reparert_selv" ? u.reparasjon : undefined;
  const krav = u.krav;
  const utgifter = krav?.utgifter ?? [];
  const kjopesum = input.bilOgKjop.kjopesumNok;

  // § 27 (1): within two months is always in time; past six months we call it late.
  const forSentEtter = (fra: string, til: string): "hard" | "myk" | null =>
    til > leggTilManeder(fra, RIMELIG_TID_MANEDER) ? "hard" : til > leggTilManeder(fra, REKLAMASJON_ALLTID_I_TIDE_MANEDER) ? "myk" : null;

  // The complaint and when it came.
  if (kontakt === "nei") {
    const alvor = feilDato ? forSentEtter(feilDato, idag) : f.reklamertForSent ? "hard" : null;
    const siden = feilDato ? `Feilen viste seg ${norskDato(feilDato)}, for ${maneder(feilDato, idag)} måneder siden, og du har ikke tatt den opp med forhandleren.` : "Du har ikke tatt opp feilen med forhandleren.";
    if (alvor === "hard")
      legg({
        id: "ikke_reklamert",
        alvor,
        steg: "kontakt",
        tekst: `${siden} En reklamasjon skal komme innen rimelig tid, og forhandleren kan avvise kravet fordi det kommer for sent. Har du tatt det opp før, også på telefon eller ved oppmøte, rett svaret under «Kontakt med forhandleren».`,
      });
    else if (alvor === "myk")
      legg({
        id: "ikke_reklamert",
        alvor,
        steg: "kontakt",
        tekst: `${siden} Dette brevet er reklamasjonen din, og den skal komme innen rimelig tid: send brevet så snart du kan. Har du tatt det opp før, også muntlig, rett svaret under «Kontakt med forhandleren».`,
      });
  }
  if (r && feilDato) {
    if (r.dato < feilDato) {
      legg({ id: "reklamasjon_for_feilen", alvor: "hard", steg: "kontakt", tekst: `Du skriver at du tok opp feilen ${norskDato(r.dato)}, før den viste seg ${norskDato(feilDato)}. Sjekk de to datoene; brevet sier ellers imot seg selv.` });
    } else {
      const alvor = forSentEtter(feilDato, r.dato);
      if (alvor)
        legg({
          id: "reklamert_sent",
          alvor,
          steg: "kontakt",
          tekst: `Det gikk ${maneder(feilDato, r.dato)} måneder fra feilen viste seg til du tok den opp med forhandleren. Forhandleren kan mene at du reklamerte for sent. Tok du den opp tidligere, også muntlig, bruk den første datoen.`,
        });
    }
  }
  if (retting === "ikke_rettet" && r && dager(r.dato, idag) < MIN_DAGER_FOR_IKKE_RETTET) {
    legg({
      id: "ikke_rettet_for_tidlig",
      alvor: "hard",
      steg: "kontakt",
      tekst: `Du tok opp feilen for bare ${dager(r.dato, idag)} dager siden. Det er sjelden «rimelig tid» for forhandleren å rette den, og brevet krever likevel prisavslag eller heving. Velg «Forhandleren vil forsøke, eller har ikke svart ennå» under «Kontakt med forhandleren», så krever brevet retting.`,
    });
  }
  if (retting === "venter" && r && idag > leggTilManeder(r.dato, 2)) {
    legg({
      id: "venter_lenge",
      fast: true,
      alvor: "myk",
      steg: "kontakt",
      tekst: `Du tok opp feilen ${norskDato(r.dato)}, for ${maneder(r.dato, idag)} måneder siden, og forhandleren har ikke rettet den. Brevet krever fortsatt at forhandleren retter feilen. Har forhandleren ikke rettet den innen rimelig tid, velg det under «Kontakt med forhandleren», så kan brevet kreve prisavslag eller heving.`,
    });
  }

  // Foreldelse: the letter does not stop it; a complaint to Forbrukertilsynet does.
  // Only from the exact purchase date: the middle of an answered range is a guess, not a deadline.
  const kjopsdato = input.bilOgKjop.kjopsdato;
  const foreldes = kjopsdato ? [leggTilManeder(kjopsdato, FORELDELSE_AR * 12), ...(feilDato ? [leggTilManeder(feilDato, TILLEGGSFRIST_AR * 12)] : [])].sort().at(-1)! : null;
  if (!foreldes) {
    // Nothing to compute with.
  } else if (idag > foreldes) {
    legg({
      id: "foreldet",
      fast: true,
      alvor: "hard",
      steg: null,
      tekst: `Kravet ditt kan være foreldet. Et krav etter et bilkjøp foreldes tre år etter at du fikk bilen, men tidligst ett år etter at du oppdaget feilen (foreldelsesloven). For deg var det ${norskDato(foreldes)}. En reklamasjon til forhandleren stanser ikke foreldelsen. Har forhandleren skriftlig eller tydelig erkjent at de er ansvarlige for feilen, kan en ny frist på tre år ha begynt å løpe (foreldelsesloven §§ 14 og 20), men et forsøk på å rette feilen regnes ikke alltid som en slik erkjennelse. Snakk med Forbrukerrådet før du sender brevet.`,
    });
  } else if (dager(idag, foreldes) <= FORELDELSE_VARSEL_DAGER) {
    legg({
      id: "foreldes_snart",
      alvor: "hard",
      steg: null,
      tekst: `Kravet ditt foreldes ${norskDato(foreldes)}. Brevet stanser ikke foreldelsen. Får du ikke svar eller penger før da, må du klage saken inn til Forbrukertilsynet før ${norskDato(foreldes)}. Det stanser foreldelsen (foreldelsesloven § 16 nr. 2 bokstav b), og det gjør også en skriftlig erkjennelse fra forhandleren. Send brevet med en gang, eller klag til Forbrukertilsynet direkte.`,
    });
  }

  // Outside the presumption the buyer must show the defect was there at delivery (§ 18 first paragraph).
  if (!f.presumsjon && f.rapportSierForKjop !== true && f.feilOpplysninger !== true && (f.feilgrupper.length === 0 || f.feilgrupper.some((g) => g[0] !== "km_avvik" && g[0] !== "kollisjonsskade"))) {
    legg({
      id: "uten_bevis",
      alvor: "hard",
      steg: "rapport",
      handling: "verksted",
      tekst: `Feilen viste seg mer enn ${f.presumsjonManeder === 24 ? "to år" : "seks måneder"} etter kjøpet. Da er det du som må vise at feilen var der da du kjøpte bilen. ${VERKSTED_RAD}${valgt?.mangler.some((id) => id.startsWith("rapport_")) ? " I vedtaket brevet viser til, la utvalget vekt på en slik vurdering." : ""} Fyll inn det verkstedet skriver under «Tilstandsrapport».`,
    });
  }

  // Brakes, clutch and the like wear out; the dealer will call it normal wear unless a workshop says otherwise.
  const slitedel = moment("slitedel")?.gjelder.grupper ?? [];
  const upaaregnelig = u.momenter?.rapport_upaaregnelig?.svar && moment("rapport_upaaregnelig")!.gunstig.includes(u.momenter.rapport_upaaregnelig.svar);
  if (f.slitasjeAktuelt && grupperFor(f).some((g) => slitedel.includes(g)) && !upaaregnelig)
    legg({ id: "slitasje_uten_vurdering", alvor: "myk", steg: "rapport", handling: "verksted", tekst: "Forhandleren vil trolig si at dette er normal slitasje. Be verkstedet skrive om feilen er mer enn det som er vanlig for en bil med denne alderen og kilometerstanden." });

  // What the decision the letter cites was won on, and the other cases like this one, that the buyer lacks.
  for (const id of valgt?.mangler ?? []) {
    const mo = moment(id);
    if (!mo?.steg) continue;
    legg({
      id: `moment_mangler_${id}`,
      alvor: "myk",
      steg: mo.steg,
      handling: id.startsWith("rapport_") ? "verksted" : `moment:${id}`,
      tekst: `Vedtaket brevet viser til, og de andre som ligner din sak, ble vunnet blant annet fordi: ${mo.navn.toLowerCase()}. Det har du ikke ennå.${id.startsWith("rapport_") ? ` ${VERKSTED_RAD}` : ""}`,
    });
  }

  if (input.bilOgKjop.kjopsdato && input.bilOgKjop.kjopsdato >= PRESUMSJON_TO_AR_FRA && dager(PRESUMSJON_TO_AR_FRA, input.bilOgKjop.kjopsdato) < NAER_LOVENDRING_DAGER) {
    legg({
      id: "kontraktsdato",
      alvor: "myk",
      steg: "kjopet",
      tekst: "Loven ble endret 1. januar 2024, og hvilke regler som gjelder, avhenger av datoen i kjøpekontrakten. Datoen fra Statens vegvesen er datoen bilen ble registrert på deg, som kan være senere. Sjekk at kjøpsdatoen er datoen i kontrakten.",
    });
  }

  // A repair elsewhere: the dealer has the first try (§§ 29 and 30).
  if (retting === "reparert_selv") {
    if (!rep) {
      legg({ id: "reparasjon_uten_dato", alvor: "hard", steg: "kontakt", tekst: "Brevet sier ikke når feilen ble reparert, eller hvorfor forhandleren ikke fikk rette den. Fyll det inn under «Kontakt med forhandleren»." });
    } else {
      const forFeilen = feilDato !== undefined && rep.dato < feilDato;
      if (rep.grunn === "ingen" || (kontakt === "nei" && rep.grunn !== "nodvendig")) {
        legg({
          id: "reparert_uten_kontakt",
          fast: true,
          alvor: "hard",
          steg: "kontakt",
          tekst: "Forhandleren har rett til å forsøke å rette feilen selv (§ 29 og § 30). Du fikk den reparert et annet sted uten at forhandleren fikk sjansen. Da kan forhandleren kreve at beløpet settes ned til det de selv ville brukt på å rette feilen, eller i verste fall avvise kravet.",
        });
      } else if (rep.grunn === "nodvendig" && (kontakt === "nei" || (r && rep.dato < r.dato))) {
        legg({
          id: "reparert_nodvendig",
          alvor: "myk",
          steg: "kontakt",
          tekst: "Du fikk feilen reparert før du tok den opp med forhandleren, fordi du ikke kunne bruke bilen. Forhandleren kan likevel mene at de skulle fått rette den. Ta vare på dokumentasjon for at reparasjonen hastet.",
        });
      }
      if (forFeilen) {
        legg({ id: "reparasjon_for_feilen", alvor: "hard", steg: "kontakt", tekst: `Reparasjonen (${norskDato(rep.dato)}) er datert før feilen viste seg (${norskDato(feilDato!)}). Sjekk datoene.` });
      } else if (r && rep.dato < r.dato && rep.grunn !== "nodvendig") {
        legg({ id: "reparasjon_for_reklamasjon", alvor: "hard", steg: "kontakt", tekst: `Reparasjonen (${norskDato(rep.dato)}) er datert før du tok opp feilen med forhandleren (${norskDato(r.dato)}), men brevet sier at forhandleren ikke rettet den. Sjekk datoene.` });
      } else if (r && rep.grunn === "ikke_rettet" && dager(r.dato, rep.dato) < MIN_DAGER_FOR_IKKE_RETTET) {
        legg({
          id: "ikke_rettet_for_tidlig",
          alvor: "hard",
          steg: "kontakt",
          tekst: `Det gikk bare ${dager(r.dato, rep.dato)} dager fra du tok opp feilen til du fikk den reparert. Det er sjelden «rimelig tid» for forhandleren å rette den, og forhandleren kan avvise kravet om å dekke kostnaden. Sjekk datoene og grunnen.`,
        });
      }
    }
    if (krav?.type === "prisavslag" && !krav.utbedringNok) {
      legg({ id: "reparert_uten_belop", alvor: "hard", steg: "krav", tekst: "Du har fått feilen reparert, men brevet sier ikke hva det kostet. Skriv inn beløpet fra fakturaen under «Kravet», så krever brevet et konkret prisavslag." });
    }
    if (krav?.type === "heving") {
      legg({ id: "heving_etter_reparasjon", alvor: "hard", steg: "krav", tekst: "Du krever heving, men feilen er reparert. Når feilen er rettet, er prisavslag (det reparasjonen kostet) vanligvis det riktige kravet." });
    }
  }

  // The dealer's answer on the time line.
  if (r && (retting === "avvist" || retting === "forsokt") && !r.svarDato) {
    legg({ id: "svar_uten_dato", alvor: "myk", steg: "kontakt", tekst: retting === "avvist" ? "Brevet sier ikke når forhandleren avviste å rette feilen. Med datoen er tidslinjen komplett." : "Brevet sier ikke når forhandleren sist forsøkte å rette feilen. Med datoen er tidslinjen komplett." });
  }
  // Before 2024 the dealer normally had two tries before the buyer could go on to a price reduction or cancelling.
  if (retting === "forsokt" && r?.forsok === 1 && f.presumsjonManeder === 6 && krav?.type) {
    legg({ id: "ett_forsok", fast: true, alvor: "hard", steg: "kontakt", tekst: "Forhandleren har forsøkt å rette feilen én gang. For kjøp før 2024 har forhandleren normalt rett til to forsøk før du kan kreve prisavslag eller heving." });
  }

  // What the buyer knew. A defect known as it is stops the claim for a purchase before 2024 (the assessment
  // and a correction are refused); from 2024 the dealer can only rely on it when the buyer was told
  // specifically and accepted it expressly and separately (§ 15 second paragraph). «Worse or other than I
  // was told» is what the letter builds on, and no warning.
  if (f.opplyst === "ja_som_opplyst" && f.presumsjonManeder !== 24 && !input.bilOgKjop.kjopsdato) {
    // Only «hvor lenge siden» is known, and it does not settle which side of 1 January 2024 the purchase is on
    // (an answer certainly before it is stopped, one certainly after it gets the warning below).
    legg({
      id: "kjent_uten_kjopsdato",
      alvor: "hard",
      steg: "kjopet",
      tekst: "Du visste om feilen da du kjøpte bilen. Om du kan klage, avhenger av om kjøpet var før eller etter 1. januar 2024. Fyll inn den nøyaktige kjøpsdatoen under «Kjøpet».",
    });
  } else if (f.opplyst === "ja_som_opplyst" && f.presumsjonManeder === 24) {
    legg({
      id: "kjent_fra_2024",
      fast: true,
      alvor: "hard",
      steg: "for-kjopet",
      tekst:
        "Du visste om feilen da du kjøpte bilen. For kjøp fra 2024 kan forhandleren bare avvise kravet hvis du ble gjort særskilt oppmerksom på feilen og godtok den uttrykkelig og særskilt, for eksempel ved at det sto i kontrakten. Sjekk kontrakten.",
    });
  }

  // The amounts.
  if (harFatt(retting) && krav?.type === "prisavslag" && !krav.utbedringNok && retting !== "reparert_selv") {
    legg({ id: "prisavslag_uten_belop", alvor: "myk", steg: "krav", tekst: "Brevet krever et prisavslag uten beløp. Har du et pristilbud fra et verksted, eller en takst over verditapet, skriv inn beløpet under «Kravet» og legg det ved." });
  }
  const sumKrav = (harFatt(retting) && krav?.type === "prisavslag" ? (krav.utbedringNok ?? 0) : 0) + utgifter.reduce((s, x) => s + x.belopNok, 0);
  // A price reduction above the price is a typo; damages come on top and can together exceed it.
  const avslag = harFatt(retting) && krav?.type === "prisavslag" ? (krav.utbedringNok ?? 0) : 0;
  if (kjopesum != null && avslag > kjopesum) {
    legg({ id: "belop_over_kjopesum", alvor: "hard", steg: "krav", tekst: `Du krever et prisavslag på ${kroner(avslag)}, mer enn bilen kostet (${kroner(kjopesum)}). Sjekk beløpet under «Kravet» og kjøpesummen under «Kjøpet».` });
  } else if (kjopesum != null && sumKrav > kjopesum) {
    legg({ id: "belop_over_kjopesum", alvor: "myk", steg: "krav", tekst: `Til sammen krever du ${kroner(sumKrav)}, mer enn bilen kostet (${kroner(kjopesum)}). Det kan stemme når erstatningen er stor, men sjekk beløpene under «Kravet».` });
  }
  if (kjopesum != null && kjopesum < LAV_KJOPESUM) {
    legg({ id: "kjopesum_lav", alvor: "myk", steg: "kjopet", tekst: `Kjøpesummen er ${kroner(kjopesum)}. Stemmer det? Sjekk beløpet under «Kjøpet».` });
  }
  if (krav?.utbedringNok && krav.type === "prisavslag" && harFatt(retting)) {
    if (utgifter.some((x) => (x.type === "verksted" || x.type === "annet") && x.belopNok === krav.utbedringNok)) {
      legg({ id: "dobbelt", alvor: "hard", steg: "krav", tekst: "Du krever det samme beløpet både som prisavslag og som erstatning. Da krever du det samme to ganger. Fjern det ene under «Kravet»." });
    } else if (utgifter.some((x) => x.type === "verksted")) {
      legg({ id: "mulig_dobbelt", alvor: "myk", steg: "krav", tekst: "Du krever både prisavslag for reparasjonen og erstatning for verksted og feilsøking. Pass på at feilsøkingen ikke også er med i reparasjonsbeløpet, ellers krever du det samme to ganger." });
    } else if (utgifter.some((x) => x.type === "annet" && REPARASJON_I_UTGIFT.test(x.beskrivelse ?? ""))) {
      legg({ id: "mulig_dobbelt", alvor: "myk", steg: "krav", tekst: "En av utgiftene ser ut til å være selve reparasjonen, som prisavslaget allerede dekker. Pass på at du ikke krever det samme to ganger." });
    }
  }
  if (!harFatt(retting) && utgifter.some((x) => x.type === "verksted" && x.belopNok >= 5000)) {
    legg({ id: "retting_og_reparasjonskostnad", alvor: "myk", steg: "krav", tekst: "Brevet krever at forhandleren retter feilen, og også verkstedutgifter. Gjelder beløpet selve reparasjonen, krever du det samme to ganger, for forhandleren skal rette feilen uten kostnad for deg." });
  }
  if (utgifter.some((x) => x.type === "annet" && IKKE_OKONOMISK.test(x.beskrivelse ?? "") && !OKONOMISK.test(x.beskrivelse ?? ""))) {
    legg({ id: "ikke_okonomisk_tap", alvor: "myk", steg: "krav", tekst: "Erstatning etter § 33 dekker økonomisk tap du kan dokumentere, ikke ulempe eller tort og svie. Fjern den utgiften under «Kravet»." });
  }

  // The report.
  if (u.rapport && feilDato && u.rapport.dato < feilDato) {
    legg({ id: "rapport_for_feilen", alvor: "myk", steg: "rapport", handling: "verksted", tekst: `Rapporten er datert ${norskDato(u.rapport.dato)}, før feilen viste seg ${norskDato(feilDato)}. Sjekk datoen.` });
  }
  if (u.rapport && !FAGLIG_KILDE.test(u.rapport.fra)) {
    legg({ id: "rapport_fra_privat", alvor: "myk", steg: "rapport", handling: "verksted", tekst: `Rapporten er fra «${u.rapport.fra}». Den veier mest når den er skrevet av et verksted, NAF eller en takstmann. Står det et firmanavn på rapporten, skriv det.` });
  }
  // Attachments: everything the letter rests on should be listed (and enclosed), and nothing it does not mention.
  const medRetting = { ...u, retting };
  const vedlagt = vedleggFor(input, medRetting);
  const trengs = vedleggBrevetByggerPa(input, medRetting);
  // A workshop report often states the cost; enclosed, it documents the amount.
  const mangler = trengs.filter((v) => !vedlagt.includes(v) && !(v === "tilbud" && vedlagt.includes("verkstedrapport")));
  if (mangler.includes("tilbud")) {
    legg({
      id: "tilbud_mangler",
      alvor: "hard",
      steg: "vedlegg",
      tekst: `Brevet krever ${kroner(krav!.utbedringNok!)}, men verken et pristilbud, en takst eller en verkstedrapport står på vedleggslisten. Legg ved det beløpet bygger på.`,
    });
    mangler.splice(mangler.indexOf("tilbud"), 1);
  }
  if (mangler.length) {
    // A quoted report, or the invoice behind an amount claimed, is what the dealer will ask for first.
    const hard = (mangler.includes("verkstedrapport") && u.rapport !== undefined) || (mangler.includes("faktura") && (krav?.utbedringNok ?? 0) > 0);
    legg({
      id: "vedlegg_mangler",
      alvor: hard ? "hard" : "myk",
      steg: "vedlegg",
      tekst: `Brevet bygger på ${mangler.map((v) => VEDLEGG_NAVN[v]).join(", ")}, men ${mangler.length > 1 ? "de står" : "det står"} ikke på vedleggslisten. Legg ${mangler.length > 1 ? "dem" : "det"} ved, eller rett svaret som brevet bygger på.`,
    });
  }
  const overflodig = vedlagt.filter((v) => ((v === "faktura" || v === "tilbud") && retting !== "reparert_selv" && !krav?.utbedringNok) || (v === "kvitteringer" && utgifter.length === 0));
  if (overflodig.length) {
    legg({
      id: "vedlegg_uten_grunnlag",
      alvor: "myk",
      steg: "vedlegg",
      tekst: `Du legger ved ${overflodig.map((v) => VEDLEGG_NAVN[v]).join(" og ")}, men brevet krever ikke ${overflodig.includes("kvitteringer") && overflodig.length === 1 ? "noen utgifter" : "noe beløp"} som ${overflodig.length > 1 ? "de" : "det"} hører til. Fjern vedlegget, eller fyll inn kravet under «Kravet».`,
    });
  }

  // Contact and payment.
  if (u.avsender && !u.avsender.epost && !u.avsender.telefon) {
    legg({ id: "kontakt_mangler", alvor: "myk", steg: "avsender", tekst: "Brevet har verken e-post eller telefon. Med e-post kan forhandleren svare skriftlig, og du har svaret dokumentert." });
  }
  if (u.avsender && kreverPenger(medRetting) && !u.avsender.kontonummer) {
    legg({ id: "kontonummer_mangler", alvor: "myk", steg: "avsender", tekst: "Brevet krever penger, men har ikke kontonummeret ditt. Fyll det inn under «Om deg», så vet forhandleren hvor beløpet skal betales." });
  }

  return [...ut.filter((a) => a.alvor === "hard"), ...ut.filter((a) => a.alvor === "myk")];
}
