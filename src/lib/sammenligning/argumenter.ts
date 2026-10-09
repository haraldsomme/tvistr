// Steps 8–9: fixed sentences per stronger criterion, the committee's own words, and the finished
// paragraph (§§ 10–10b). No free text: every slot is filled from the form or the index.
import { BEVIS_FRASE, datoLang, FORM_BESTEMT, indreAnforsel, KATEGORI_FRASE, OPPLYSNING_OM, prosent, tall } from "./fraser";
import type { FeilProfil, Kriterium, Sak, Sitat, VedtakFeil, Vurdert } from "./typer";

// The decision's own words for the reservation when we have them ("som den står" in 55355).
function forbeholdSetning(v: VedtakFeil): string {
  if (v.forbehold_frase) return `Bilen i vedtaket var solgt «${v.forbehold_frase}»; min bil ble solgt uten forbehold.`;
  if (v.forbehold.includes("uten_garanti") && !v.forbehold.includes("som_den_er")) return "Bilen i vedtaket var solgt uten garanti; min bil ble solgt uten forbehold.";
  return "Salget i vedtaket hadde et forbehold om bilens stand; min bil ble solgt uten forbehold.";
}

const dager = (d: number) => `${d} ${d === 1 ? "dag" : "dager"}`;
const etterLevering = (d: number) => (d === 0 ? "samme dag som bilen ble levert" : d === 1 ? "dagen etter leveringen" : `${d} dager etter leveringen`);

const form = (f: string | null) => FORM_BESTEMT[f ?? ""] ?? "et skriftlig dokument";

function setning(k: Kriterium, sak: Sak, f: FeilProfil, x: Vurdert): string | null {
  const v = x.vedtak;
  switch (`${v.spor}:${k.navn}`) {
    case "A:form":
      return `I vedtaket sto opplysningen i ${form(x.opplysning?.form ?? null)}; i min sak står den i ${form(f.a_form)}.`;
    case "A:konkrethet":
      return "Opplysningen i min sak gjelder et konkret forhold uttrykkelig, mens opplysningen i vedtaket var generell.";
    case "A:direkte_sporsmal":
      return "Opplysningen ble gitt som svar på mitt direkte spørsmål.";
    case "A:forbehold":
      return forbeholdSetning(v);
    case "A:kategori":
      return "Vedtaket gjaldt samme type opplysning som i min sak.";
    case "B:kategori":
    case "C:kategori":
      return "Vedtaket gjaldt samme type feil som i min sak.";
    case "B:tid_til_feil":
    case "C:tid_til_feil":
      return `Feilen viste seg ${etterLevering(f.dager_til_feil)}, mot ${dager(v.dager_etter_levering!)} i vedtaket.`;
    case "B:selger_motbevis":
      return "Selger har, som i vedtaket, ikke fremlagt dokumentasjon som tilsier at feilen oppsto etter leveringen.";
    case "B:rapport_levering":
      return "Verkstedet har i tillegg knyttet feilen til leveringstidspunktet.";
    case "B:arsak":
      return "Verkstedet har i tillegg forklart hvorfor delen sviktet.";
    case "B:reklamasjonstid":
      return f.dager_til_reklamasjon === 0 ? "Jeg reklamerte samme dag som feilen ble oppdaget." : `Jeg reklamerte ${dager(f.dager_til_reklamasjon!)} etter at feilen ble oppdaget.`;
    case "C:alvor":
      return `Feilen gjør at bilen ${f.kan_bilen_brukes === "nei" ? "ikke kan brukes" : "bare kan brukes begrenset"}.`;
    case "C:alder":
      return `Bilen var ${sak.alder_ved_kjop} år ved kjøpet, mot ${v.alder_ved_kjop} år i vedtaket.`;
    case "C:km":
      return `Bilen hadde gått ${tall(sak.km_ved_kjop)} km ved kjøpet, mot ${tall(v.km_ved_kjop!)} km i vedtaket.`;
    case "C:pris":
      return `Bilen kostet ${tall(sak.pris_kr)} kr, mot ${tall(v.kjopesum_nok!)} kr i vedtaket.`;
    case "C:kostnad_pris":
      return `Utbedringen koster ${prosent(k.bruker as number)} % av kjøpesummen, mot ${prosent(k.vedtak as number)} % i vedtaket.`;
  }
  return null;
}

function svakhetSetning(k: Kriterium): string {
  if (k.navn === "form") return "Opplysningen sto i annonsen og ikke i kontrakten, men et generelt annonseforbehold fritar ikke selger, slik utvalget la til grunn i vedtaket.";
  if (k.navn === "reklamasjonstid") return "Reklamasjonen ble fremsatt innen lovens frist på to måneder.";
  // tid_til_feil: only addressable when the workshop tied the defect to delivery (kriterier.ts).
  return "Feilen viste seg senere enn i vedtaket, men verkstedet har konkludert med at den forelå ved leveringen.";
}

export const kmSvakhetIAvsnitt = (sak: Sak, f: FeilProfil) => sak.svakhet_sak === "km" && f.rapport_levering;

export function byggArgumenter(sak: Sak, f: FeilProfil, x: Vurdert): string[] {
  const v = x.vedtak;
  const ut: string[] = [];
  const sterke = x.kriterier.filter((k) => k.utfall === "sterkere");
  // Age, mileage and price together read as one sentence when all three are stronger.
  const cTrio = v.spor === "C" && ["alder", "km", "pris"].every((n) => sterke.some((k) => k.navn === n));
  for (const k of x.kriterier) {
    // Same rank, but the user has the statement in more than one place: worth saying, not counted.
    if (k.navn === "form" && k.utfall === "lik" && f.a_former.length > 1 && x.opplysning?.form) {
      const [a, b] = f.a_former;
      ut.push(`I vedtaket sto opplysningen i ${form(x.opplysning.form)}; i min sak står den både i ${form(a)} og i ${form(b)}.`);
      continue;
    }
    if (k.utfall !== "sterkere") continue;
    if (cTrio && ["alder", "km", "pris"].includes(k.navn)) {
      if (k.navn === "alder")
        ut.push(
          `Bilen var ${sak.alder_ved_kjop} år med ${tall(sak.km_ved_kjop)} km og kostet ${tall(sak.pris_kr)} kr, mot ${v.alder_ved_kjop} år, ${tall(v.km_ved_kjop!)} km og ${tall(v.kjopesum_nok!)} kr i vedtaket.`,
        );
      continue;
    }
    const s = setning(k, sak, f, x);
    if (s) ut.push(s);
  }
  if (x.svakhet) ut.push(svakhetSetning(x.svakhet));
  // The mileage since purchase is only raised here when it can be answered. Otherwise the flag
  // (km_svakhet_i_avsnitt = false) goes to the letter engine, which takes it up only if the seller has.
  if (kmSvakhetIAvsnitt(sak, f))
    ut.push(`Jeg har kjørt ${tall(sak.km_siden_kjop)} km siden kjøpet. Verkstedet har likevel knyttet feilen til leveringstidspunktet.`);
  return ut;
}

// Once per letter, after the last practice paragraph, so two paragraphs do not repeat it.
export function lovendring(sak: Sak, vedtak: VedtakFeil[]): string | null {
  const eldre = vedtak.filter((v) => v.lovversjon === "før_2024");
  if (sak.lov !== "etter_2024" || !eldre.length) return null;
  const flere = eldre.length > 1;
  return (
    `${flere ? (eldre.length === vedtak.length ? "Begge vedtakene" : "Vedtakene") + " gjelder kjøp" : "Vedtaket gjelder et kjøp"} før forbrukerkjøpsloven ble endret 1. januar 2024. ` +
    "Endringen forlenget blant annet fristen der en feil som viser seg, formodes å ha vært til stede ved leveringen, fra seks måneder til to år. " +
    `Ingen av reglene ${flere ? "vedtakene" : "vedtaket"} bygger på, er endret til kjøperens ugunst.`
  );
}

// B rests on the presumption alone; a general "mangel" quote there was about something else (S06).
const SITATTEMA: Record<string, string[]> = { A: ["opplysning", "mangel"], B: ["formodning"], C: ["bevis", "mangel"] };

// The first whole sentence of a verified quote: still verbatim, and short enough for a letter.
function forsteSetning(t: string): string {
  const s = t.trim();
  const m = s.match(/^[^]{40,}?[.!?](?=\s+[A-ZÆØÅ«])/);
  return (m ? m[0] : s).replace(/[.\s]+$/, "");
}

// A whole sentence without placeholders such as [KLAGER]. A fragment ("foreligget på
// overtagelsestidspunktet …") reads as a misquote, so the paragraph goes without the quote instead.
// It must also end as a sentence: some stored quotes were cut short by the agent ("… knyttet til at
// bilen" followed by " ikke", S06). A stored quote often lacks its full stop, so the full text decides:
// a full stop next, or a capital letter after a space where the extracted text lost the stop
// (23/15972: "… virket inn på kjøpet De …").
// Words that can be turned against the buyer: what was visible, inspected or test-driven, or what
// someone "burde" have known (S08: "skaden er lett synlig på bilen"). Matched at the start of a word,
// or "sannsynliggjort" would count as "synlig".
const MOT_KJOPER = /(^|[^a-zæøå])(synlig|besiktigelse|prøvekjør|burde)/i;

export const helSetning = (t: string, nesteTegn?: string | null) => {
  const s = t.trim();
  const slutter = /[.!?»)]$/.test(s) || (nesteTegn != null && /^([.!?»)]|\s[A-ZÆØÅ«])/.test(nesteTegn));
  return /^[A-ZÆØÅ«]/.test(s) && slutter && s.length >= 40 && !s.includes("[");
};

// Quotes the importer kept are verified against the full text (docs/pass2-design.md § 6).
export function velgSitat(v: VedtakFeil): Sitat | null {
  const egne = v.begrunnelse_sitater.filter((s) => s.gjelder_feil.includes(v.feil_id));
  const hele = v.begrunnelse_sitater.filter((s) => s.gjelder_feil.length === 0);
  for (const tema of SITATTEMA[v.spor]) {
    for (const liste of [egne, hele]) {
      // The filter applies to the sentence the letter shows, not to the rest of the stored quote.
      const s = liste.find((x) => x.tema === tema && x.tekst && helSetning(x.tekst, x.neste_tegn) && !MOT_KJOPER.test(forsteSetning(x.tekst)));
      if (s) return { tema, tekst: forsteSetning(s.tekst) };
    }
  }
  return null;
}

function ledd1(x: Vurdert, f: FeilProfil): string {
  const v = x.vedtak;
  const start = `Forbrukerklageutvalget har i vedtak ${v.saksnummer} av ${datoLang(v.vedtaksdato)} lagt til grunn at`;
  // From the phrase table, not the agent's free-text summary; the selger's own words follow in ledd 2.
  const gjelder = OPPLYSNING_OM[v.kategori] ?? OPPLYSNING_OM.annet;
  if (v.spor === "A" && f.a_variant === "taushet") return `${start} selger hadde unnlatt å opplyse om ${gjelder}, og at dette var en mangel.`;
  if (v.spor === "A") return `${start} selger hadde gitt en uriktig opplysning om ${gjelder}.`;
  if (v.spor === "B") {
    const når = v.dager_etter_levering == null ? "etter leveringen" : etterLevering(v.dager_etter_levering);
    // When the decision's seller did put forward evidence, the committee found it insufficient (S06).
    return v.selger_bevis_finnes
      ? `${start} en feil som viste seg ${når}, forelå ved leveringen, og at selgers dokumentasjon ikke var tilstrekkelig til å motbevise dette.`
      : `${start} en feil som viste seg ${når}, forelå ved leveringen, fordi selger ikke hadde fremlagt bevis for noe annet.`;
  }
  return `${start} en feil som var dokumentert å gå ut over det påregnelige for bilens alder og kjørelengde, var en mangel.`;
}

function ledd2(x: Vurdert, f: FeilProfil): string | null {
  const v = x.vedtak;
  const o = x.opplysning;
  if (v.spor === "A" && f.a_variant === "taushet") return "Forholdet var dokumentert i saken.";
  if (v.spor === "A") {
    if (o?.ordlyd && o.ordlyd_verifisert) {
      const ordlyd = indreAnforsel(o.ordlyd.replace(/[.\s]+$/, ""));
      if (ordlyd.split(/\s+/).length >= 3) return `Opplysningen sto i ${form(o.form)} og lød: «${ordlyd}».`;
      // A word or two is a listing, not a sentence. "i utstyrslisten" only when the decision says so.
      const kilde = form(o.form).replace(/^en /, "");
      const liste = o.sitat_verifisert && /utstyr/i.test(o.sitat ?? "") ? " i utstyrslisten" : "";
      return `${kilde[0].toUpperCase()}${kilde.slice(1)} oppga «${ordlyd}»${liste}.`;
    }
    return `Opplysningen var gitt i ${form(o?.form ?? null)}.`;
  }
  const bil = [v.alder_ved_kjop != null ? `en ${v.alder_ved_kjop} år gammel bil` : "en bil", v.km_ved_kjop != null ? `med ${tall(v.km_ved_kjop)} km` : null]
    .filter(Boolean)
    .join(" ");
  if (v.spor === "B") return `Saken gjaldt ${KATEGORI_FRASE[v.kategori] ?? KATEGORI_FRASE.annet} på ${v.alder_ved_kjop != null ? `en ${v.alder_ved_kjop} år gammel bil` : "en bruktbil"}.`;
  const kjopt = v.kjopesum_nok != null ? `, kjøpt for ${tall(v.kjopesum_nok)} kr` : "";
  const sakkyndig = v.bevis.find(
    (b) => b.fremlagt_av === "klager" && b.paregnelig === "utover" && BEVIS_FRASE[b.type] && (b.gjelder_feil.length === 0 || b.gjelder_feil.includes(v.feil_id)),
  );
  const konklusjon = sakkyndig
    ? ` ${BEVIS_FRASE[sakkyndig.type]} konkluderte med at feilen gikk ut over det påregnelige${sakkyndig.ved_levering === "ja" ? " og hadde oppstått før leveringen" : ""}.`
    : "";
  return `Saken gjaldt ${bil}${kjopt}.${konklusjon}`;
}

// The amount must say what it covers: the opposing party will look the decision up.
function ledd4(v: VedtakFeil): string | null {
  if (v.sanksjon === "heving") return "Kjøpet ble hevet.";
  const egen = v.belop_tilkjent_nok;
  const belop = egen ?? v.tilkjent_totalt_nok;
  if (!belop || !v.sanksjon) return null;
  const hva = egen != null ? " for denne mangelen" : v.antall_mangler > 1 ? " for manglene i saken" : "";
  const tilSammen = egen == null && v.antall_mangler > 1 ? "til sammen " : "";
  switch (v.sanksjon) {
    case "prisavslag":
      return `Kjøperen fikk prisavslag på ${tilSammen}${tall(belop)} kr${hva}.`;
    case "erstatning":
      return `Kjøperen fikk erstattet ${tilSammen}${tall(belop)} kr${hva}.`;
    case "prisavslag_og_erstatning":
      // With several defects the split per defect is unknown; with one, the whole sum was for it.
      return egen != null && (v.antall_mangler > 1 || egen !== v.tilkjent_totalt_nok)
        ? `Kjøperen fikk tilkjent ${tall(belop)} kr${hva}.`
        : `Kjøperen fikk prisavslag og erstatning på til sammen ${tall(belop)} kr${hva}.`;
  }
  return null;
}

export function renderAvsnitt(f: FeilProfil, x: Vurdert, argumenter: string[], sitat: Sitat | null): string {
  const innledning =
    x.antall_sterkere === 0 && !x.svakhet ? "Min sak står like sterkt på de momentene utvalget bygde på." : "Min sak står minst like sterkt på de momentene utvalget bygde på.";
  return [ledd1(x, f), ledd2(x, f), sitat ? `Utvalget uttalte: «${indreAnforsel(sitat.tekst)}».` : null, ledd4(x.vedtak), innledning, ...argumenter]
    .filter((s): s is string => !!s)
    .join(" ");
}
