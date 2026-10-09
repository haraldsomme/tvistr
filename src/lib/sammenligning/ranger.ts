// Steps 5–7: which decided defects the user's case is at least as strong as, which one is best, and
// which defects get a practice paragraph (§§ 8–9).
import { velgSitat } from "./argumenter";
import { leksikografisk } from "./kriterier";
import type { FeilProfil, Kriterium, Sak, VedtakFeil, Vurdert } from "./typer";

export type Dom = { godkjent: true; svakhet: Kriterium | null } | { godkjent: false; grunn: string };

export function sterkereEnn(kriterier: Kriterium[], sak: Sak, v: VedtakFeil): Dom {
  if (!kriterier.length) return { godkjent: false, grunn: "ingen opplysning i vedtaket knyttet til feilen" };
  // Always out on B and C, whatever the table says: the seller documented the defect arose later or
  // elsewhere, the decision's seller did not. On A the question is whether the statement was wrong,
  // which a seller's report on the defect does not answer; there it is only a flag for the letter.
  if (v.spor !== "A" && sak.selger_motbevis && !v.selger_bevis_finnes) return { godkjent: false, grunn: "selger har motbevis, det hadde ikke selger i vedtaket" };
  const krav = kriterier.find((k) => k.krav && k.utfall === "svakere");
  if (krav) return { godkjent: false, grunn: `svakere på ${krav.navn}` };
  const svake = kriterier.filter((k) => k.utfall === "svakere");
  if (svake.length === 0) return { godkjent: true, svakhet: null };
  if (svake.length === 1 && svake[0].adresserbar) return { godkjent: true, svakhet: svake[0] };
  return { godkjent: false, grunn: `svakere på ${svake.map((k) => k.navn).join(", ")}` };
}

// Not in the spec's list, but a paragraph without the seller's words or the committee's own sentence
// is a weaker paragraph: the verified wording and a whole-sentence quote come before recency.
function siterbar(x: Vurdert): number {
  const sitat = velgSitat(x.vedtak);
  return (x.vedtak.spor !== "A" || x.opplysning?.ordlyd_verifisert ? 1 : 0) + (sitat ? 1 : 0);
}

const LOSNINGER_UTEN_HEVING = ["prisavslag", "erstatning", "prisavslag_og_erstatning", "retting"];

function rangering(x: Vurdert, f: FeilProfil, sak: Sak): number[] {
  const v = x.vedtak;
  const sanksjonPasser = sak.onsket_losning === "heving" ? v.sanksjon === "heving" : LOSNINGER_UTEN_HEVING.includes(v.sanksjon ?? "");
  const sammeKategori = v.kategori === f.kategori_pass2 ? 1 : 0;
  return [
    // On B and C the analogy is the defect itself: a rust case is compared with rust before a
    // four-wheel-drive failure with more stronger points (S04). On A the category is already a criterion.
    v.spor === "A" ? 0 : sammeKategori,
    // Against a dealer, a dealer decision is the stronger analogy than a commission sale (the form only
    // reaches matching for dealer purchases).
    v.selger_type === "forhandler" ? 1 : 0,
    x.antall_sterkere,
    x.svakhet ? 0 : 1,
    sammeKategori,
    v.lovversjon === sak.lov ? 1 : 0,
    sanksjonPasser ? 1 : 0,
    siterbar(x),
    Date.parse(v.vedtaksdato),
  ];
}

// Best first; the last tie-breakers only make the order total, so the same input always gives the same pick.
export function ranger(godkjente: Vurdert[], f: FeilProfil, sak: Sak): Vurdert[] {
  return [...godkjente].sort(
    (a, b) =>
      leksikografisk(rangering(b, f, sak), rangering(a, f, sak)) || a.vedtak.vedtak_id - b.vedtak.vedtak_id || a.vedtak.feil_id.localeCompare(b.vedtak.feil_id),
  );
}

// One decision per defect. When two defects want the same decision, the one with more stronger
// points gets it, then the costlier one; the other takes its next candidate.
export function fordel(lister: Map<string, Vurdert[]>, kostnad: Map<string, number>): Map<string, Vurdert | null> {
  const valgt = new Map<string, Vurdert | null>();
  const brukt = new Set<number>();
  const igjen = new Set(lister.keys());
  while (igjen.size) {
    const neste = [...igjen].map((id) => ({ id, v: lister.get(id)!.find((x) => !brukt.has(x.vedtak.vedtak_id)) ?? null }));
    neste.sort(
      (a, b) =>
        (b.v?.antall_sterkere ?? -1) - (a.v?.antall_sterkere ?? -1) || (kostnad.get(b.id) ?? 0) - (kostnad.get(a.id) ?? 0) || a.id.localeCompare(b.id),
    );
    const { id, v } = neste[0];
    valgt.set(id, v);
    if (v) brukt.add(v.vedtak.vedtak_id);
    igjen.delete(id);
  }
  return valgt;
}

// At most two defects get a paragraph: strength plus a bonus for the same category, then cost.
export function velgTilBrev(feil: Array<{ feil_id: string; kostnad: number; valgt: Vurdert | null; kategori: string }>): string[] {
  const poeng = (x: (typeof feil)[number]) => x.valgt!.antall_sterkere + (x.valgt!.vedtak.kategori === x.kategori ? 1 : 0);
  return feil
    .filter((x) => x.valgt)
    .sort((a, b) => poeng(b) - poeng(a) || b.kostnad - a.kostnad || a.feil_id.localeCompare(b.feil_id))
    .slice(0, 2)
    .map((x) => x.feil_id);
}
