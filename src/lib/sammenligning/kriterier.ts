// Step 4: the user's defect against one decided defect, criterion by criterion (§ 7).
// A null on the decision's side gives "lik": what the decision does not say cannot count against the user.
import { SKRIFTLIGE_FORMER } from "@/lib/analyse/skjema";
import type { VerifisertBevis, VerifisertOpplysning } from "@/lib/analyse/verifiser";
import { dagerMellom } from "@/lib/analyse/verifiser";
import { erSlitedel, FORM_RANG } from "./avled";
import type { FeilProfil, Kriterium, Sak, Utfall, VedtakFeil } from "./typer";

// Better for the buyer when `bedre` holds on the user's side and not the decision's.
function fordel(bruker: boolean | null, vedtak: boolean | null): Utfall {
  if (bruker == null) return "utelat";
  if (vedtak == null || bruker === vedtak) return "lik";
  return bruker ? "sterkere" : "svakere";
}

function storreErBedre(bruker: number | null, vedtak: number | null): Utfall {
  return mindreErBedre(bruker == null ? null : -bruker, vedtak == null ? null : -vedtak);
}

function mindreErBedre(bruker: number | null, vedtak: number | null): Utfall {
  if (bruker == null) return "utelat";
  if (vedtak == null || bruker === vedtak) return "lik";
  return bruker < vedtak ? "sterkere" : "svakere";
}

const k = (navn: string, bruker: unknown, vedtak: unknown, utfall: Utfall, krav = false, adresserbar = false): Kriterium => ({
  navn,
  bruker,
  vedtak,
  utfall,
  krav,
  adresserbar: adresserbar && utfall === "svakere",
});

// A statement the paragraph can cite must be linked to this defect; one that concerns the whole case
// only counts when the case had a single defect.
const eksplisitt = (refs: string[], v: VedtakFeil) => refs.includes(v.feil_id) || (refs.length === 0 && v.antall_feil === 1);
// Evidence with no link concerns the whole case (as in src/lib/analyse/avled.ts).
const knyttetBevis = (v: VedtakFeil): VerifisertBevis[] => v.bevis.filter((b) => b.gjelder_feil.length === 0 || b.gjelder_feil.includes(v.feil_id));

export function velgOpplysning(v: VedtakFeil, variant: "uttalelse" | "taushet"): VerifisertOpplysning | null {
  const aktuelle = v.opplysninger.filter(
    (o) => o.type === variant && eksplisitt(o.gjelder_feil, v) && (variant === "taushet" || (o.form != null && SKRIFTLIGE_FORMER.includes(o.form))),
  );
  const poeng = (o: VerifisertOpplysning) => [
    o.status === "lagt_til_grunn" && o.vekt === "for_klager" ? 1 : 0,
    o.rekkevidde === "spesifikk" ? 1 : 0,
    FORM_RANG[o.form ?? ""] ?? 0,
    o.ordlyd_verifisert ? 1 : 0,
  ];
  // Highest score first; ties keep the order in the decision.
  return aktuelle.map((o) => ({ o, p: poeng(o) })).sort((a, b) => leksikografisk(b.p, a.p))[0]?.o ?? null;
}

export function leksikografisk(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function sporA(sak: Sak, f: FeilProfil, v: VedtakFeil, o: VerifisertOpplysning): Kriterium[] {
  const forbehold = k(
    "forbehold",
    sak.uten_forbehold == null ? null : !sak.uten_forbehold,
    v.forbehold.length > 0,
    fordel(sak.uten_forbehold, v.forbehold.length === 0),
  );
  if (f.a_variant === "taushet") {
    return [k("dokumentert_fortielse", f.rapport_ok, knyttetBevis(v).length > 0, fordel(f.rapport_ok, knyttetBevis(v).length > 0)), forbehold];
  }
  const br = FORM_RANG[f.a_form ?? ""] ?? 0;
  const vr = FORM_RANG[o.form ?? ""] ?? 0;
  const form = br === vr || !vr ? "lik" : br > vr ? "sterkere" : "svakere";
  const bSpes = f.a_spesifikk ? "spesifikk" : "generell";
  return [
    k("form", f.a_form, o.form, form, false, f.a_form === "annonse" && o.form === "kontrakt"),
    k("konkrethet", bSpes, o.rekkevidde, o.rekkevidde == null || o.rekkevidde === bSpes ? "lik" : f.a_spesifikk ? "sterkere" : "svakere"),
    k("direkte_sporsmal", f.a_direkte, o.svar_pa_direkte_sporsmal, fordel(f.a_direkte, o.svar_pa_direkte_sporsmal)),
    forbehold,
  ];
}

// Days from the defect showing itself to the first complaint, in the decision. With a document date
// for the defect (viste_seg_kilde = bevisdato) the defect may have shown itself earlier, so this is
// a lower bound of the decision's complaint time.
function vedtakReklamasjon(v: VedtakFeil): number | null {
  if (!v.forste_henvendelse_dato || !v.start_dato || v.dager_etter_levering == null) return null;
  const d = dagerMellom(v.start_dato, v.forste_henvendelse_dato) - v.dager_etter_levering;
  return d >= 0 ? d : null;
}

// The decision's day count from a document date is «påvist senest»: a user whose defect showed itself
// within it is not shown to be earlier (the decision's may have been earlier still), only one after it
// is shown to be later. The same bound turned round holds for the complaint time.
function tidTilFeil(f: FeilProfil, v: VedtakFeil): Kriterium["utfall"] {
  const u = mindreErBedre(f.dager_til_feil, v.dager_etter_levering);
  return v.viste_seg_kilde === "bevisdato" && u === "sterkere" ? "lik" : u;
}
function reklamasjonstid(f: FeilProfil, v: VedtakFeil, vRek: number | null): Kriterium["utfall"] {
  const u = mindreErBedre(f.dager_til_reklamasjon, vRek);
  return v.viste_seg_kilde === "bevisdato" && u === "svakere" ? "lik" : u;
}

function sporB(sak: Sak, f: FeilProfil, v: VedtakFeil): Kriterium[] {
  const bevis = knyttetBevis(v);
  const vLevering = bevis.some((b) => b.ved_levering === "ja");
  const vSlitedel = erSlitedel(v.kategori, v.alder_ved_kjop, v.km_ved_kjop);
  // A wear part is only as strong as a decision on the same wear part: there the committee itself
  // accepted the presumption for that kind of part (57255 dekk, 77134 bremser).
  const slitedel: Kriterium["utfall"] = !f.slitedel ? (vSlitedel ? "sterkere" : "lik") : vSlitedel && v.kategori === f.kategori_pass2 ? "lik" : "svakere";
  const vRek = vedtakReklamasjon(v);
  // Pass 2's arsak on the buyer's own evidence: rotarsak says why, komponent only which part.
  const arsaker = bevis.filter((b) => b.fremlagt_av === "klager").map((b) => b.arsak);
  const vArsak = arsaker.includes("rotarsak") ? true : arsaker.includes("komponent") ? false : null;
  return [
    // A later defect is only answered when the workshop tied it to delivery (S06).
    k("tid_til_feil", f.dager_til_feil, v.dager_etter_levering, tidTilFeil(f, v), false, f.rapport_levering),
    k("selger_motbevis", sak.selger_motbevis, v.selger_bevis_finnes, fordel(!sak.selger_motbevis, !v.selger_bevis_finnes), true),
    k("rapport_levering", f.rapport_levering, vLevering, fordel(f.rapport_levering, vLevering)),
    k("arsak", f.rapport_arsak, vArsak, fordel(f.rapport_arsak, vArsak)),
    k("ikke_slitedel", !f.slitedel, !vSlitedel, slitedel, true),
    k("reklamasjonstid", f.dager_til_reklamasjon, vRek, reklamasjonstid(f, v, vRek), false, (f.dager_til_reklamasjon ?? Infinity) <= 60),
  ];
}

function sporC(sak: Sak, f: FeilProfil, v: VedtakFeil): Kriterium[] {
  const bevis = knyttetBevis(v).filter((b) => b.fremlagt_av === "klager");
  // A decision won on C was by definition documented beyond the expected (docs/spor.md), even when
  // the evidence list misses it; otherwise a thinner record would count in the user's favour (S04).
  const vUtover = v.spor_vunnet.includes("C") || bevis.some((b) => b.paregnelig === "utover");
  const vLevering = bevis.some((b) => b.ved_levering === "ja");
  // The decision's repair cost, not the largest invoice: a diagnosis invoice of 2 600 kr is no repair (22/3370).
  const vAndel = v.utbedringskostnad_nok && v.kjopesum_nok ? v.utbedringskostnad_nok / v.kjopesum_nok : null;
  // A repair costing more than the car is a rescission case or a typo (52 000 for 520 000 kr): it is
  // only compared when the buyer confirmed it in the form.
  const bAndel = f.kostnad_kr != null && (f.kostnad_kr <= sak.pris_kr || f.kostnad_over_pris_bekreftet) ? f.kostnad_kr / sak.pris_kr : null;
  const andel: Kriterium["utfall"] = bAndel == null || vAndel == null ? "utelat" : bAndel > vAndel ? "sterkere" : bAndel === vAndel ? "lik" : "utelat";
  const vAlvor = v.alvor.length > 0;
  return [
    k("utover_paregnelig", f.rapport_paregnelig, vUtover, fordel(f.rapport_paregnelig, vUtover), true),
    k("ved_levering", f.rapport_levering, vLevering, fordel(f.rapport_levering, vLevering), true),
    // Seriousness only counts in the user's favour; a decision with a serious defect is no weakness.
    k("alvor", f.alvor, vAlvor, f.alvor && !vAlvor ? "sterkere" : "lik"),
    k("alder", sak.alder_ved_kjop, v.alder_ved_kjop, mindreErBedre(sak.alder_ved_kjop, v.alder_ved_kjop)),
    k("km", sak.km_ved_kjop, v.km_ved_kjop, mindreErBedre(sak.km_ved_kjop, v.km_ved_kjop)),
    k("pris", sak.pris_kr, v.kjopesum_nok, storreErBedre(sak.pris_kr, v.kjopesum_nok)),
    k("kostnad_pris", bAndel, vAndel, andel),
    k("tid_til_feil", f.dager_til_feil, v.dager_etter_levering, tidTilFeil(f, v), false, f.rapport_levering),
  ];
}

export function vurderKriterier(sak: Sak, f: FeilProfil, v: VedtakFeil, o: VerifisertOpplysning | null): Kriterium[] {
  if (v.spor === "A") return o ? sporA(sak, f, v, o) : [];
  return v.spor === "B" ? sporB(sak, f, v) : sporC(sak, f, v);
}
