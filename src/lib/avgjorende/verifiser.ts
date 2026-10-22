// Reads one agent answer (instruks.md). Hard errors (not the decision asked for, no list of
// defects) reject the whole answer; everything else is corrected or dropped, with the reason in
// `kontroll`. Quotes and provisions must be found in the committee's own assessment, so a fact the
// committee only recounted cannot pass as its reasoning.
import { SANKSJONER } from "@/lib/feilvurdering/skjema";
import { erListe, finnesIFulltekst, fulltekstVarianter, normaliser } from "@/lib/feilvurdering/verifiser";
import { type AvgjorendeFeil, BEVIS, FORBEHOLD, LOVVERSJON, POENG, type Svar } from "./skjema";

const MAKS_AVGJORENDE = 1000;
const MAKS_SITATER = 3;

// Where the committee's assessment (part III) starts. Every decision the letter can cite has one of these.
const VURDERINGEN = /utval(?:get|et) ser slik på sak(?:en|a)|\n\s*utvalget sin vurdering\s*\n/i;

// The decision split in the recounted case (parts I–II) and the committee's assessment; null
// assessment when the heading is not found.
export function delOpp(fulltekst: string): { saksfremstilling: string; vurdering: string | null } {
  const i = fulltekst.search(VURDERINGEN);
  return i < 0 ? { saksfremstilling: fulltekst, vurdering: null } : { saksfremstilling: fulltekst.slice(0, i).trimEnd(), vurdering: fulltekst.slice(i) };
}

const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

// The date the decision is signed with («Oslo, den 14.1.2015», «Porsgrunn, den 7. februar 2023»),
// read from its last lines. Null when there is none or it cannot be read.
export function signaturdato(fulltekst: string): string | null {
  const slutt = fulltekst.slice(-700);
  const m = [...slutt.matchAll(/(?:^|\s)(?:[A-ZÆØÅ][a-zæøå]+,?\s+)?den\s+(\d{1,2})\.\s*(?:(\d{1,2})\.\s*(\d{4}|\d{2})\b|([a-zæøå]+)\s+(\d{4}))/gi)].at(-1);
  if (!m) return null;
  const mnd = m[2] ? Number(m[2]) : MANEDER.indexOf(m[4].toLowerCase()) + 1;
  const ar = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(m[5]);
  const dag = Number(m[1]);
  if (!mnd || mnd > 12 || !dag || dag > 31 || ar < 2000) return null;
  return `${ar}-${String(mnd).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
}

export type Lest = { ok: true; svar: Svar; kontroll: string[] } | { ok: false; feil: string };

const liste = <T extends string>(lovlige: readonly T[], v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => erListe(lovlige, x)))] : []);
const tekster = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))] : []);
const ELLIPSE = /…|\.\.\./;

// `medhold`: the ids of the defects the feilvurdering found accepted, the only ones asked about.
export function lesSvar(raa: unknown, forventetId: number, fulltekst: string, medhold: string[]): Lest {
  if (!raa || typeof raa !== "object") return { ok: false, feil: "svaret er ikke et objekt" };
  const o = raa as Record<string, unknown>;
  if (o.vedtak_id !== forventetId) return { ok: false, feil: `vedtak_id ${String(o.vedtak_id)} er ikke ${forventetId}` };
  if (!Array.isArray(o.feil)) return { ok: false, feil: "feil er ikke en liste" };

  const kontroll: string[] = [];
  const { vurdering } = delOpp(fulltekst);
  if (!vurdering) kontroll.push("fant ikke utvalgets vurdering, sitater kontrollert mot hele teksten");
  const varianter = fulltekstVarianter(vurdering ?? fulltekst);
  const vurderingLiten = varianter.map((t) => t.toLowerCase());
  // A quote must stand word for word in the committee's assessment, without omissions.
  const sitatHolder = (s: string, hvor: string) => {
    if (ELLIPSE.test(s)) kontroll.push(`${hvor}: sitat med utelatelse, droppet`);
    else if (!finnesIFulltekst(s, varianter)) kontroll.push(`${hvor}: sitat ikke ordrett i vurderingen, droppet`);
    else return true;
    return false;
  };
  const feil: AvgjorendeFeil[] = [];
  for (const f of o.feil as unknown[]) {
    if (!f || typeof f !== "object") continue;
    const x = f as Record<string, unknown>;
    const id = typeof x.id === "string" ? x.id : "";
    if (!medhold.includes(id)) {
      kontroll.push(`${id || "uten id"}: ikke en feil med medhold, droppet`);
      continue;
    }
    if (feil.some((y) => y.id === id)) {
      kontroll.push(`${id}: dobbel, droppet`);
      continue;
    }
    let avgjorende = typeof x.avgjorende === "string" ? x.avgjorende.trim() : "";
    if (!avgjorende) kontroll.push(`${id}: avgjorende mangler`);
    if (avgjorende.length > MAKS_AVGJORENDE) {
      avgjorende = `${avgjorende.slice(0, MAKS_AVGJORENDE - 1)}…`;
      kontroll.push(`${id}: avgjorende kuttet`);
    }
    const sitater = tekster(x.sitater).filter((s) => sitatHolder(s, id));
    if (sitater.length > MAKS_SITATER) kontroll.push(`${id}: mer enn ${MAKS_SITATER} sitater, kuttet`);
    if (!sitater.length) kontroll.push(`${id}: ingen sitater`);
    const hjemmel = tekster(x.hjemmel).filter((h) => {
      // The act's name may stand once for several provisions, and a closing «)» or full stop belongs
      // to the sentence; only the provision itself must be in the text.
      const kjerne = normaliser(h)
        .toLowerCase()
        .replace(/^(?:fkjl\.?|forbrukerkjøpsloven|kjl\.?|kjøpsloven)\s*/, "")
        .replace(/[).,;:\s]+$/, "");
      const ok = vurderingLiten.some((t) => t.includes(kjerne));
      if (!ok) kontroll.push(`${id}: hjemmel «${h}» står ikke i vurderingen, droppet`);
      return ok;
    });
    const samlet_med = tekster(x.samlet_med).filter((y) => y !== id && medhold.includes(y));
    // Judged together with other defects is never judged on its own, whatever the answer says.
    if (samlet_med.length && x.vurdert_for_seg === true) kontroll.push(`${id}: vurdert for seg, men samlet med andre; satt til nei`);
    feil.push({
      id,
      nevnt_i_vurderingen: x.nevnt_i_vurderingen !== false,
      vurdert_for_seg: x.vurdert_for_seg !== false && !samlet_med.length,
      avgjorende,
      hjemmel,
      bevis: liste(BEVIS, x.bevis),
      samlet_med,
      under_tvil: x.under_tvil === true,
      sanksjoner: liste(SANKSJONER, x.sanksjoner),
      sitater: sitater.slice(0, MAKS_SITATER),
    });
  }
  for (const id of medhold) if (!feil.some((f) => f.id === id)) kontroll.push(`${id}: mangler i svaret`);
  const selger_svarte = typeof o.selger_svarte === "boolean" ? o.selger_svarte : null;
  // The car's name must stand in the decision as written.
  let bil = typeof o.bil === "string" && o.bil.trim() ? o.bil.trim() : null;
  if (bil && !fulltekstVarianter(fulltekst).some((t) => t.toLowerCase().includes(normaliser(bil!).toLowerCase()))) {
    kontroll.push(`bil «${bil}» står ikke i vedtaket, nullet`);
    bil = null;
  }
  // One sentence per legal point; a point named twice keeps the first that holds.
  const rettslige_sitater: NonNullable<Svar["rettslige_sitater"]> = [];
  for (const r of Array.isArray(o.rettslige_sitater) ? (o.rettslige_sitater as unknown[]) : []) {
    const x = (r ?? {}) as Record<string, unknown>;
    const sitat = typeof x.sitat === "string" ? x.sitat.trim() : "";
    if (!erListe(POENG, x.poeng)) kontroll.push(`rettslig poeng ${String(x.poeng)} ukjent, droppet`);
    else if (rettslige_sitater.some((y) => y.poeng === x.poeng)) continue;
    else if (sitat && sitatHolder(sitat, String(x.poeng))) rettslige_sitater.push({ poeng: x.poeng, sitat });
  }
  return {
    ok: true,
    svar: {
      vedtak_id: forventetId,
      selger_svarte,
      bil,
      forbehold: erListe(FORBEHOLD, o.forbehold) ? o.forbehold : "ukjent",
      lovversjon_brukt: erListe(LOVVERSJON, o.lovversjon_brukt) ? o.lovversjon_brukt : "ukjent",
      rettslige_sitater,
      feil,
    },
    kontroll,
  };
}

// The field pass for quotes (standpunkt.md): drops the quotes judged not to be the committee's own
// standpoint. `sitater` maps the pass's ids to the quotes it was given; matching is on the text, so
// the ids need not survive a re-import. A quote the pass gave no answer for is kept.
export function utenStandpunkt(svar: Svar, sitater: { id: string; tekst: string }[], vurdert: unknown): { svar: Svar; kontroll: string[] } {
  const svarene = (vurdert && typeof vurdert === "object" && Array.isArray((vurdert as { sitater?: unknown }).sitater) ? (vurdert as { sitater: unknown[] }).sitater : []) as { id?: unknown; standpunkt?: unknown }[];
  const ikke = new Set(svarene.filter((x) => x.standpunkt === false).flatMap((x) => sitater.filter((s) => s.id === x.id).map((s) => s.tekst)));
  const kontroll: string[] = [];
  const feil = svar.feil.map((f) => {
    const beholdt = f.sitater.filter((t) => !ikke.has(t));
    if (beholdt.length < f.sitater.length) kontroll.push(`${f.id}: ${f.sitater.length - beholdt.length} sitat ikke utvalgets standpunkt, droppet`);
    return { ...f, sitater: beholdt };
  });
  const rettslige = svar.rettslige_sitater?.filter((r) => {
    if (!ikke.has(r.sitat)) return true;
    kontroll.push(`${r.poeng}: sitat ikke utvalgets standpunkt, droppet`);
    return false;
  });
  return { svar: { ...svar, feil, ...(rettslige && { rettslige_sitater: rettslige }) }, kontroll };
}

// The data wash for the legal points' quotes (rettslig.md): drops each quote answered as not stating
// its point. `inn` is what the wash was given; matching is on point and text, so a re-import keeps
// the result. A quote without an answer is kept.
export function utenRettsligPoeng(svar: Svar, inn: { poeng: string; sitat: string }[], vurdert: unknown): { svar: Svar; kontroll: string[] } {
  const svarene = (vurdert && typeof vurdert === "object" && Array.isArray((vurdert as { sitater?: unknown }).sitater) ? (vurdert as { sitater: unknown[] }).sitater : []) as { poeng?: unknown; uttrykker?: unknown }[];
  const bort = new Set(svarene.filter((x) => x.uttrykker === false).flatMap((x) => inn.filter((s) => s.poeng === x.poeng).map((s) => `${s.poeng}|${s.sitat}`)));
  if (!bort.size || !svar.rettslige_sitater) return { svar, kontroll: [] };
  const kontroll = svar.rettslige_sitater.filter((r) => bort.has(`${r.poeng}|${r.sitat}`)).map((r) => `${r.poeng}: sitat uttrykker ikke poenget, droppet`);
  return { svar: { ...svar, rettslige_sitater: svar.rettslige_sitater.filter((r) => !bort.has(`${r.poeng}|${r.sitat}`)) }, kontroll };
}
