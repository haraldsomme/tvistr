// Everything besides the dates that could make the letter say something untrue or incoherent, judged
// in one pure function. The form calls it on every change, the server (rens.ts) runs it again and
// turns a stop away, and the tests run it over every letter. The dates have their own (tidslinje.ts).
//
// Impossible or self-contradictory answers stop; answers that are possible but weaken the case warn.
// Every rule is listed with its message in docs/riktighet.md.
import { gyldigOrgnr } from "@/lib/brreg";
import type { Krav } from "@/lib/matching/typer";
import { feiltype } from "./feiltype";
import { overslagSum, type Rapport, type SelgerSvar } from "./rapport";
import type { Kilde, SomDenEr } from "./typer";

export type Riktighetssak = {
  kjopsdato: string;
  kjopesum: number | null;
  forsteRegistrert: number | null;
  somDenEr: SomDenEr | null;
  krav: Krav | null;
  forsok: number;
  svar: SelgerSvar | null;
  feil: { hoved: string; under: string[]; opplysning: Kilde | null; verksted: Kilde | null; rapport: Pick<Rapport, "punkter" | "overslag" | "navn" | "dato"> | null; beskrivelse: string | null; konklusjon: string | null }[];
  utlegg: { belop: number }[];
  selger: { orgnr: string; status: "konkurs" | "avvikling" | null; naeringskode: string | null } | null;
};

export type Riktighetsmerknad = {
  regel: string;
  felt: "kategori" | "opplysning" | "krav" | "kjopesum" | "kjopsdato" | "selger" | "utlegg" | "beskrivelse" | "konklusjon" | "somDenEr" | "rapport";
  feilId?: string;
  melding: string;
};
export type Riktighet = { stopp: Riktighetsmerknad[]; advarsler: Riktighetsmerknad[] };

export const KJOPESUM_MIN = 5_000;
export const KJOPESUM_MAKS = 3_000_000;
const KJOPESUM_LAV = 20_000;
const LITEN_UTBEDRING = 0.1;

const KRAVNAVN: Record<Krav, string> = { retting: "retting", prisavslag: "prisavslag", heving: "heving" };

// Free text the letter quotes: only letters make it something to quote, and a link is not a quote.
const BARE_TEGN = /^[^\p{L}]+$/u;
const LENKE = /(https?:\/\/|www\.)|\b[\w-]+\.(no|com|net|org|io|se|dk|eu)\b/i;

export function fritekstMerknad(tekst: string | null, felt: "beskrivelse" | "konklusjon", feilId: string): Riktighetsmerknad | null {
  if (!tekst) return null;
  if (LENKE.test(tekst)) return { regel: "fritekst_lenke", felt, feilId, melding: "Legg ved dokumentet i stedet for lenken." };
  if (BARE_TEGN.test(tekst)) return { regel: "fritekst_bare_tegn", felt, feilId, melding: "Skriv med ord, ikke bare tall eller tegn." };
  return null;
}

export function vurderRiktighet(s: Riktighetssak): Riktighet {
  const stopp: Riktighetsmerknad[] = [];
  const advarsler: Riktighetsmerknad[] = [];
  const typer = s.feil.map((f) => (f.under.length ? f.under : [null]).map((u) => feiltype(f.hoved, u)));

  // 1. Answers that contradict each other.
  for (const f of s.feil)
    if (f.hoved === "garanti" && f.opplysning === "nei")
      stopp.push({ regel: "garanti_uten_lofte", felt: "opplysning", feilId: f.hoved, melding: "En garanti må være lovet. Velg hva selger sa om garantien." });

  const vetIkke = s.feil.filter((f) => f.hoved === "vet_ikke");
  if (vetIkke.length && vetIkke.length === s.feil.length && (s.krav === "heving" || s.krav === "prisavslag"))
    stopp.push({
      regel: "vet_ikke_krav",
      felt: "krav",
      melding: "Før årsaken er kjent, kan brevet bare kreve at feilen undersøkes og rettes. Velg retting, eller velg en feilkategori.",
    });
  if (vetIkke.length && vetIkke.length < s.feil.length && (s.krav === "prisavslag" || s.krav === "heving"))
    advarsler.push({
      regel: "vet_ikke_blandet",
      felt: "kategori",
      melding:
        s.krav === "heving"
          ? "Du har valgt både en kjent feil og «vet ikke». Brevet hever kjøpet på grunn av den kjente feilen; den ukjente er bare beskrevet."
          : `Du har valgt både en kjent feil og «vet ikke». Brevet krever retting av den ukjente og ${KRAVNAVN[s.krav]} for den kjente.`,
    });

  const o = overslagSum(s);
  if (s.krav === "prisavslag" && !o)
    advarsler.push({ regel: "prisavslag_uten_overslag", felt: "krav", melding: "Uten et kostnadsoverslag fra verkstedet kan brevet ikke oppgi beløp. Brevet krever prisavslag uten å nevne et beløp." });
  if (s.krav === "heving" && s.forsok === 0 && s.svar !== "avviste" && s.svar !== "ikke_svart")
    advarsler.push({ regel: "heving_uten_retting", felt: "krav", melding: "Selger kan ha rett til å forsøke retting først. Brevet tar høyde for det, men heving står svakere." });
  if (s.krav === "heving" && o && s.kjopesum && s.feil.length === 1 && o.sum < s.kjopesum * LITEN_UTBEDRING)
    advarsler.push({ regel: "heving_liten_utbedring", felt: "krav", melding: "Heving krever at mangelen ikke er uvesentlig. Når utbedringen koster lite i forhold til kjøpesummen, blir heving sjelden godtatt. Vurder prisavslag." });
  if (s.krav === "prisavslag" && s.feil.some((f) => f.rapport?.punkter.includes("frarader")))
    advarsler.push({ regel: "frarader_prisavslag", felt: "krav", melding: "Verkstedet fraråder bruk. Retting eller heving passer ofte bedre når bilen ikke kan brukes." });
  // What the buyer knew at the purchase cannot be relied on, whatever the reservation and the version of the law.
  if (s.feil.some((f, i) => typer[i].includes("teknisk") && f.opplysning !== null && f.opplysning !== "nei"))
    advarsler.push({
      regel: "som_den_er_opplyst",
      felt: "somDenEr",
      melding: "Hvis selger opplyste om akkurat denne feilen før kjøpet, kan du som regel ikke reklamere på den. Sjekk hva som ble sagt, og om det gjaldt denne feilen eller noe annet.",
    });

  const valgte = s.feil.flatMap((f) => f.under.map((u) => `${f.hoved}.${u}`));
  if (new Set(valgte).size !== valgte.length || new Set(s.feil.map((f) => f.hoved)).size !== s.feil.length)
    stopp.push({ regel: "samme_feil_to_ganger", felt: "kategori", melding: "Samme feil er valgt to ganger." });

  const utlegg = s.utlegg.reduce((t, u) => t + u.belop, 0);
  if (s.kjopesum && utlegg > s.kjopesum) advarsler.push({ regel: "utlegg_over_kjopesum", felt: "utlegg", melding: "Utleggene er høyere enn kjøpesummen. Sjekk beløpene." });

  // 2. The car and the figures.
  if (s.kjopesum !== null && (s.kjopesum < KJOPESUM_MIN || s.kjopesum > KJOPESUM_MAKS))
    stopp.push({ regel: "kjopesum_utenfor", felt: "kjopesum", melding: "Kjøpesummen må være mellom 5 000 og 3 000 000 kr. Sjekk beløpet." });
  if (s.kjopesum !== null && s.kjopesum < KJOPESUM_LAV && s.krav === "heving")
    advarsler.push({ regel: "lav_kjopesum_heving", felt: "krav", melding: "Ved så lav kjøpesum legger utvalget til grunn at mye må påregnes." });
  if (s.forsteRegistrert !== null && s.forsteRegistrert > Number(s.kjopsdato.slice(0, 4)))
    stopp.push({ regel: "registrert_etter_kjop", felt: "kjopsdato", melding: "Bilen ble første gang registrert etter kjøpsdatoen. Sjekk kjøpsdatoen." });

  // 3. The seller.
  if (s.selger) {
    if (!gyldigOrgnr(s.selger.orgnr)) stopp.push({ regel: "orgnr_ugyldig", felt: "selger", melding: "Organisasjonsnummeret er ikke gyldig. Velg selgeren på nytt." });
    if (s.selger.status)
      advarsler.push({
        regel: "selger_konkurs",
        felt: "selger",
        melding: `Foretaket er registrert ${s.selger.status === "konkurs" ? "som konkurs" : "under avvikling"}. Du kan likevel lage brevet, men kravet kan være vanskelig å inndrive.`,
      });
    if (s.selger.naeringskode && !s.selger.naeringskode.startsWith("45.1"))
      advarsler.push({ regel: "selger_ikke_bilforhandler", felt: "selger", melding: "Foretaket er ikke registrert som bilforhandler. Er dette riktig selger?" });
  }

  // 4. The free text the letter quotes.
  for (const f of s.feil)
    for (const m of [fritekstMerknad(f.beskrivelse, "beskrivelse", f.hoved), fritekstMerknad(f.konklusjon, "konklusjon", f.hoved)]) if (m) stopp.push(m);

  return { stopp, advarsler };
}
