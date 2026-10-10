// Steps 5–7: which decided defects the user's case is at least as strong as, in which order, and which
// defects go to the practice paragraph (§§ 8–9).
import { leksikografisk } from "./kriterier";
import type { Kriterium, Sak, VedtakFeil, Vurdert } from "./typer";

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

// More stronger points, no weakness, newest. The last tie-breakers only make the order total, so the
// same input always gives the same order.
const rangering = (x: Vurdert) => [x.antall_sterkere, x.svakhet ? 0 : 1, Date.parse(x.vedtak.vedtaksdato)];

export function ranger(godkjente: Vurdert[]): Vurdert[] {
  return [...godkjente].sort(
    (a, b) => leksikografisk(rangering(b), rangering(a)) || a.vedtak.vedtak_id - b.vedtak.vedtak_id || a.vedtak.feil_id.localeCompare(b.vedtak.feil_id),
  );
}

// At most two defects go to the practice paragraph: those whose best decision has the most stronger
// points, then the costlier.
export function velgTilBrev(feil: Array<{ feil_id: string; kostnad: number; antall_sterkere: number | null }>): string[] {
  return feil
    .filter((x) => x.antall_sterkere != null)
    .sort((a, b) => b.antall_sterkere! - a.antall_sterkere! || b.kostnad - a.kostnad || a.feil_id.localeCompare(b.feil_id))
    .slice(0, 2)
    .map((x) => x.feil_id);
}
