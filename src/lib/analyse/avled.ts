// Conclusions computed from the agents' facts (docs/pass2-design.md § 7, docs/spor.md).
// Changing a definition here only needs a re-import, never a new agent run.
import { SAKKYNDIGE_BEVIS, SKRIFTLIGE_FORMER, type Spor, utfallForFeil } from "./skjema";
import { dagerMellom, type VerifisertFeil, type VerifisertSvar } from "./verifiser";

export type VedtakFakta = { kjopsdato: string | null; overtakelsesdato: string | null; vedtaksdato: string | null; klagerErForbruker: boolean | null };
export type Lovversjon = "før_2024" | "etter_2024" | "ukjent";

export function avledLovversjon(v: VedtakFakta): Lovversjon {
  const d = v.kjopsdato ?? v.overtakelsesdato;
  if (d) return d < "2024-01-01" ? "før_2024" : "etter_2024";
  // Cases take months to reach a decision, so a decision before mid-2024 means a purchase before 2024.
  if (v.vedtaksdato && v.vedtaksdato < "2024-06-01") return "før_2024";
  return "ukjent";
}

// fkjl § 18 second paragraph: six months before 2024, two years from 1 January 2024.
export function formodningsfrist(l: Lovversjon): number | null {
  return l === "før_2024" ? 183 : l === "etter_2024" ? 730 : null;
}

// The sanction the buyer got. Rescission is read from the conclusion ("mot at [KLAGER] stiller bilen
// til disposisjon"), not from the amounts alone: a rescission can be a net settlement (17/1629:
// 11 535 of 209 000 kr) and the total can include the fee. Builds on the broad pattern from the data
// check (sjekk 9), corrected on pass 2's decisions:
// - the conclusion is found by its heading, not as the last 2 000 characters (22/880);
// - a full stop inside "3.0" or a date does not end the clause (21/4203);
// - "mot å stille", "til rådighet" and "skal returneres" count (17/1629, 23/3866, 23/15557);
// - handing back a part is not rescission (24/1726, a charging cable), nor is a return clause
//   when rescission was not claimed (21/6296, a trade-in).
// Some rescissions only order the price repaid, with no return clause (14/1382, 23/2860): rescission
// was claimed and at least 90 % of the price came back beyond the price reduction and damages.
export type Sanksjon = "heving" | "prisavslag" | "erstatning" | "prisavslag_og_erstatning";
const SLUTNING = /fatter (?:slikt|følgende) vedtak|vedtak\s*:/gi;
const HEVING = /\bmot\b((?:[^.]|\.(?!\s)){0,250}?)(disposisjon|rådighet|tilbakelever|leveres? tilbake|returner(?:er|es)?\b)/i;
const DEL = /\b(ladekabel\w*|kabel\w*|del(?:en|ene)?|dekk(?:ene)?|felg\w*|nøkkel\w*|batteri(?:et)?)\b/i;
export type SanksjonFakta = {
  fulltekstRenset: string | null;
  utfall: string | null;
  kravtyper: string[] | null;
  kjopesumNok: number | null;
  tilkjentPrisavslagNok: number | null;
  tilkjentErstatningNok: number | null;
  tilkjentTotaltNok: number | null;
};

export function slutning(fulltekst: string): string {
  const t = fulltekst.replace(/\s+/g, " ");
  const treff = [...t.matchAll(SLUTNING)];
  return treff.length ? t.slice(treff[treff.length - 1].index) : t.slice(-2000);
}

export function erHeving(fulltekst: string): boolean {
  const s = slutning(fulltekst);
  if (/hevingsoppgjør|kjøpet (?:heves|er hevet)/i.test(s)) return true;
  const m = HEVING.exec(s);
  // The part handed back may come after the verb ("returnerer mottatt ladekabel").
  return !!m && !DEL.test(s.slice(m.index, m.index + m[0].length + 40));
}

export function avledSanksjon(v: SanksjonFakta): Sanksjon | null {
  if (v.utfall !== "medhold" && v.utfall !== "delvis_medhold") return null;
  const p = v.tilkjentPrisavslagNok ?? 0;
  const e = v.tilkjentErstatningNok ?? 0;
  // The committee only rescinds when rescission was claimed; without the claim a return clause is a
  // trade-in or similar arrangement (21/6296).
  const krevd = v.kravtyper?.includes("heving") ?? false;
  if (krevd && v.fulltekstRenset && erHeving(v.fulltekstRenset)) return "heving";
  const tilbake = (v.tilkjentTotaltNok ?? 0) - p - e;
  if (krevd && v.kjopesumNok && tilbake >= 0.9 * v.kjopesumNok) return "heving";
  return p > 0 && e > 0 ? "prisavslag_og_erstatning" : p > 0 ? "prisavslag" : e > 0 ? "erstatning" : null;
}

// The committee writes the same reference many ways ("fkjl. § 17 første ledd b)", "§ 16 (1) c",
// "forbrukerkjøpsloven § 18 andre ledd"); store one form: "fkjl § 17 første ledd bokstav b".
const ORDENSTALL: Record<string, string> = { "1": "første", "2": "annet", "3": "tredje", "4": "fjerde", første: "første", annet: "annet", andre: "annet", tredje: "tredje", fjerde: "fjerde" };
export function normaliserParagraf(p: string): string {
  const s = p.replace(/\s+/g, " ").trim();
  const lov = /^(forbrukerkjøpsloven|fkjl)/i.test(s) ? "fkjl" : /^(kjøpsloven|kjl)/i.test(s) ? "kjl" : /^forsinkelsesrentelov/i.test(s) ? "forsinkelsesrenteloven" : null;
  const m = s.match(/§\s*(\d+)\s*([a-h])?(?![a-zæøå])/i);
  if (!lov || !m) return s;
  let ut = `${lov} § ${m[1]}${m[2] ? ` ${m[2].toLowerCase()}` : ""}`;
  const rest = s.slice((m.index ?? 0) + m[0].length);
  const ledd = rest.match(/(første|annet|andre|tredje|fjerde)\s+ledd|\((\d)\)|(\d)\.\s*ledd/i);
  if (!ledd) return ut;
  ut += ` ${ORDENSTALL[(ledd[1] ?? ledd[2] ?? ledd[3]).toLowerCase()]} ledd`;
  const bokstav = rest.slice((ledd.index ?? 0) + ledd[0].length).match(/^[\s,]*(?:bokstav|litra)?\s*\(?([a-h])\)?(?![a-zæøå])/i);
  return bokstav ? `${ut} bokstav ${bokstav[1].toLowerCase()}` : ut;
}

export type AvledetFeil = {
  feilId: string;
  kategori: string;
  komponenter: string[];
  vurdering: string;
  samletUtfall: string | null;
  grunn: string | null;
  grunnlag: string | null;
  bevisgrunnlag: string | null;
  spor: Spor[];
  sporVunnet: Spor[];
  // Which kind of track A (docs/spor.md): a written statement, silence about a documented fact, or both.
  aVariant: "uttalelse" | "taushet" | "begge" | null;
  alvor: string[];
  dagerEtterLevering: number | null;
  visteSegPresisjon: string;
  // "vedtak" when the decision gives the time, "bevisdato" when it is the date of a linked document.
  visteSegKilde: "vedtak" | "bevisdato" | null;
  innenFormodningsfrist: boolean | null;
  formodning: string;
  belopTilkjentNok: number | null;
  harSkriftligOpplysning: boolean;
  harSakkyndigBevis: boolean;
};

export type AvledetAnalyse = {
  ikkeMangelssak: boolean;
  ikkeMangelssakGrunn: string | null;
  lovversjon: Lovversjon;
  spor: Spor[];
  sporVunnet: Spor[];
  formodningAnvendt: boolean;
  dagerTilFeil: number | null;
  forsteHenvendelseDato: string | null;
  forsteHenvendelseForm: string | null;
  grunnlag: string[];
  opplysningSkriftligForKlager: boolean;
  selgerBevisFinnes: boolean;
  bevisUtoverParegnelig: boolean;
  paragraferMedLedd: string[];
};

// An empty gjelder_feil means the item concerns the whole case, so it applies to every defect.
const knyttet = (refs: string[], feilId: string) => refs.length === 0 || refs.includes(feilId);
const ORDEN: Spor[] = ["A", "B", "C"];
const sortert = (s: Set<Spor>) => ORDEN.filter((x) => s.has(x));

function dagerFraVedtaket(f: VerifisertFeil, start: string | null): number | null {
  // An exact date beats the agent's day count (verifiser.ts flags the disagreement).
  if (f.viste_seg.dato && start && f.viste_seg.presisjon === "dag") return dagerMellom(start, f.viste_seg.dato);
  return f.viste_seg.dager_etter_levering;
}

function avledFeil(f: VerifisertFeil, svar: VerifisertSvar, v: VedtakFakta, frist: number | null): AvledetFeil {
  const skriftlig = (o: VerifisertSvar["opplysninger"][number]) => o.type === "uttalelse" && o.form != null && SKRIFTLIGE_FORMER.includes(o.form);
  const skriftlige = svar.opplysninger.filter((o) => knyttet(o.gjelder_feil, f.id) && skriftlig(o));
  const knyttetBevis = svar.bevis.filter((b) => knyttet(b.gjelder_feil, f.id));
  const sakkyndige = knyttetBevis.filter(
    (b) => b.fremlagt_av === "klager" && SAKKYNDIGE_BEVIS.includes(b.type) && (b.paregnelig !== "uttaler_seg_ikke" || b.ved_levering !== "uttaler_seg_ikke"),
  );

  // When the decision gives no time, a dated document that records the defect proves it had shown
  // itself by then: an upper bound ("the test less than a month after the purchase").
  const start = v.overtakelsesdato ?? v.kjopsdato;
  const fraVedtaket = dagerFraVedtaket(f, start);
  const bevisDager = start ? knyttetBevis.filter((b) => b.dato).map((b) => dagerMellom(start, b.dato!)).filter((d) => d >= 0) : [];
  const dager = fraVedtaket ?? (bevisDager.length ? Math.min(...bevisDager) : null);
  const kilde = fraVedtaket != null ? "vedtak" : dager != null ? "bevisdato" : null;
  const innenFrist = frist != null && dager != null ? dager <= frist : null;

  // docs/spor.md: track A is a failure to inform. A statement counts when it is written and
  // concrete (general phrases such as "god stand" only when the committee relied on them for the
  // buyer); silence counts when the concealed fact is documented by evidence linked to the defect.
  // A won A rests on the legal basis, which pass 2 reads reliably.
  const mangel = utfallForFeil(f) === "mangel";
  const dokumentert = knyttetBevis.length > 0;
  // A concrete statement must be linked to this defect; one that concerns the whole case
  // ("3 mnd. bruktbilgaranti") says nothing about each defect.
  const eksplisitt = (refs: string[]) => refs.includes(f.id) || (refs.length === 0 && svar.feil.length === 1);
  const provUttalelse = skriftlige.some(
    (o) => (o.rekkevidde === "spesifikk" && eksplisitt(o.gjelder_feil)) || (o.status === "lagt_til_grunn" && o.vekt === "for_klager"),
  );
  const provTaushet = dokumentert && svar.opplysninger.some((o) => o.type === "taushet" && knyttet(o.gjelder_feil, f.id));
  const vunnetUttalelse = mangel && f.grunnlag === "feil_opplysning" && svar.opplysninger.some(skriftlig);
  const vunnetTaushet = mangel && f.grunnlag === "tilbakeholdt_opplysning" && dokumentert;
  const uttalelse = vunnetUttalelse || provUttalelse;
  const taushet = vunnetTaushet || provTaushet;
  const aVariant = uttalelse && taushet ? "begge" : uttalelse ? "uttalelse" : taushet ? "taushet" : null;
  const vunnet = new Set<Spor>();
  if (mangel) {
    if (vunnetUttalelse || vunnetTaushet) vunnet.add("A");
    if (f.bevisgrunnlag === "formodning_ikke_motbevist") vunnet.add("B");
    if (f.bevisgrunnlag === "dokumentert_utover_paregnelig") vunnet.add("C");
  }
  // A track that was won was also tried, even when the facts above did not mark it.
  const prov = new Set<Spor>(vunnet);
  if (provUttalelse || provTaushet) prov.add("A");
  if (innenFrist === true || f.formodning === "anvendt_for_klager" || f.formodning === "avkreftet") prov.add("B");
  if (sakkyndige.length) prov.add("C");

  return {
    feilId: f.id,
    kategori: f.kategori,
    komponenter: f.komponenter,
    vurdering: f.vurdering,
    samletUtfall: f.samlet_utfall,
    grunn: f.grunn,
    grunnlag: f.grunnlag,
    bevisgrunnlag: f.bevisgrunnlag,
    spor: sortert(prov),
    sporVunnet: sortert(vunnet),
    aVariant,
    alvor: f.alvor,
    dagerEtterLevering: dager,
    visteSegPresisjon: f.viste_seg.presisjon,
    visteSegKilde: kilde,
    innenFormodningsfrist: innenFrist,
    formodning: f.formodning,
    belopTilkjentNok: f.belop_tilkjent_nok,
    harSkriftligOpplysning: prov.has("A"),
    harSakkyndigBevis: prov.has("C"),
  };
}

export function avledAnalyse(svar: VerifisertSvar, v: VedtakFakta): { analyse: AvledetAnalyse; feil: AvledetFeil[] } {
  const lovversjon = avledLovversjon(v);
  const frist = formodningsfrist(lovversjon);
  const feil = svar.feil.map((f) => avledFeil(f, svar, v, frist));
  const dager = feil.map((f) => f.dagerEtterLevering).filter((d): d is number => d != null);
  const ikkeForbruker = v.klagerErForbruker === false;

  return {
    analyse: {
      ikkeMangelssak: svar.ikke_mangelssak != null || ikkeForbruker,
      ikkeMangelssakGrunn: svar.ikke_mangelssak?.grunn ?? (ikkeForbruker ? "ikke_forbruker" : null),
      lovversjon,
      spor: sortert(new Set(feil.flatMap((f) => f.spor))),
      sporVunnet: sortert(new Set(feil.flatMap((f) => f.sporVunnet))),
      formodningAnvendt: feil.some((f) => f.formodning === "anvendt_for_klager"),
      dagerTilFeil: dager.length ? Math.min(...dager) : null,
      forsteHenvendelseDato: svar.forste_henvendelse?.dato ?? null,
      forsteHenvendelseForm: svar.forste_henvendelse?.form ?? null,
      grunnlag: [...new Set(feil.map((f) => f.grunnlag).filter((g): g is string => g != null))],
      opplysningSkriftligForKlager: svar.opplysninger.some(
        (o) => o.type === "uttalelse" && o.form != null && SKRIFTLIGE_FORMER.includes(o.form) && o.status === "lagt_til_grunn" && o.vekt === "for_klager",
      ),
      selgerBevisFinnes: svar.bevis.some((b) => b.fremlagt_av === "selger"),
      bevisUtoverParegnelig: svar.bevis.some((b) => b.fremlagt_av === "klager" && b.paregnelig === "utover"),
      paragraferMedLedd: [...new Set(svar.paragrafer_med_ledd.map(normaliserParagraf))],
    },
    feil,
  };
}
