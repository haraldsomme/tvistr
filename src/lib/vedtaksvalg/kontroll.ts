import { komponenttype } from "@/lib/feil/kategorier";
import { finnesIFulltekst, normaliser } from "@/lib/feilvurdering/verifiser";
import type { Rangert } from "@/lib/matching/ranger";
import type { Brukersak, Kandidat } from "@/lib/matching/typer";
import type { Bruk } from "./instruks";

const IKKE_DROFTET = new Set(["erkjent_av_selger", "uomtvistet"]);

export type Valg = { vedtak_id: number; bruk: Bruk; avsnitt: string; sitater: string[]; forbehold: string };

// Checks the model's choice against the data: the decision is a candidate, the paragraph names it,
// every quote is in the decision's quote fields and in the paragraph, and the use claimed fits the
// decision's structure. Returns what is wrong; empty when the choice holds.
export function kontroller(valg: Valg, kandidater: Rangert[], alle: Map<number, Kandidat>, sak: Brukersak): string[] {
  const r = kandidater.find((x) => x.id === valg.vedtak_id);
  const k = r && alle.get(r.id);
  if (!r || !k) return [`vedtak_id ${valg.vedtak_id} er ikke blant kandidatene`];
  const feil: string[] = [];
  const medhold = k.feil.filter((f) => f.utfall === "medhold");

  if (k.saksnummer && !valg.avsnitt.includes(k.saksnummer)) feil.push(`avsnittet må nevne saksnummeret ${k.saksnummer}`);

  // The decision's own quotes have already been checked word for word against its full text.
  const kilder = medhold.map((f) => f.sitat).filter((s): s is string => !!s).map(normaliser);
  const avsnitt = normaliser(valg.avsnitt);
  if (!valg.sitater.length) feil.push("avsnittet må ha minst ett ordrett sitat fra vedtaket");
  for (const s of valg.sitater) {
    if (!finnesIFulltekst(s, kilder)) feil.push(`sitatet «${s}» står ikke ordrett i sitat-feltene til ${k.saksnummer ?? "vedtaket"} (hver bit minst 20 tegn)`);
    else if (!s.split(/\s*(?:…|\.\.\.)\s*/).every((bit) => avsnitt.includes(normaliser(bit)))) feil.push(`sitatet «${s}» står ikke i avsnittet`);
  }

  // `samme_feil` needs a defect in the buyer's subcategory that the committee weighed itself: one
  // the seller admitted or did not dispute says nothing about whether it is a defect. On top, a known
  // time level as late or later (or a defect of the kind «opplysning», where time does not count).
  const sammeUnder = medhold.filter(
    (f) =>
      sak.kategorier.some((c) => f.hovedkategori === c.hoved && f.underkategori !== null && c.under.includes(f.underkategori)) &&
      !IKKE_DROFTET.has(f.bevisgrunnlag ?? ""),
  );
  if ((valg.bruk === "samme_feil" || valg.bruk === "samme_feil_uten_tidspunkt") && !sammeUnder.length)
    feil.push(
      `bruk «${valg.bruk}» krever en feil med medhold i kjøperens underkategori som utvalget vurderte selv (ikke erkjent av selgeren eller uomtvistet); velg et annet vedtak, eller bruk «overforbar» eller «rettslig_poeng»`,
    );
  if (
    valg.bruk === "samme_feil" &&
    sammeUnder.length &&
    !sammeUnder.some((f) => {
      const niva = sak.kategorier.find((c) => c.hoved === f.hovedkategori)!.niva;
      return komponenttype(f.hovedkategori, f.underkategori) === "opplysning" || (f.tidsniva !== null && f.tidsniva >= niva);
    })
  )
    feil.push("bruk «samme_feil» krever at feilen i vedtaket viste seg like sent eller senere; bruk «samme_feil_uten_tidspunkt»");
  if (valg.bruk === "opplysningssvikt" && !k.mangelsgrunnlag?.some((m) => m === "feil_opplysninger" || m === "tilbakeholdt_opplysning"))
    feil.push("bruk «opplysningssvikt» krever et vedtak om uriktig eller tilbakeholdt opplysning");
  if (valg.bruk === "rettslig_poeng" && !r.rett.length) feil.push("bruk «rettslig_poeng» krever et vedtak som avgjorde ett av kjøperens rettslige poeng (feltet rettslige_poeng)");
  return feil;
}
