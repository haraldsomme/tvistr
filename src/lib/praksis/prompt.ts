// The prompt and tool for the practice paragraph (docs/praksis.md). The model reads the candidates'
// extracted analysis (not the full text) and writes; what it may claim is limited by
// src/lib/praksis/verifiser.ts, which checks every belegg against the full text.
import { nullbar, objekt } from "@/lib/ai/skjema";
import type { FeilProfil, Sak, VedtakFeil, Vurdert } from "@/lib/sammenligning/typer";
import type { SkjemaFeil } from "@/lib/skjema/skjema";
import { type Kjent, rensTekst } from "./rens";
import type { Analyse, Kilder, Modus } from "./typer";

export const PRAKSIS_VERKTOY = {
  name: "skriv_praksis",
  description: "Lever praksisavsnittet. Kall verktøyet nøyaktig én gang.",
  input_schema: objekt({
    valgt_vedtak_id: nullbar({ type: "integer" }, "Spesifikt avsnitt: vedtak_id fra <kandidater>, eller null når ingen er sammenlignbar. Generelt avsnitt: alltid null."),
    eksempel_vedtak_ids: { type: "array", items: { type: "integer" }, description: "Generelt avsnitt: vedtak_id for eksemplene avsnittet nevner. Spesifikt avsnitt: tom liste." },
    grunn_ingen: nullbar({ type: "string" }, "Hvorfor ingen kandidat er sammenlignbar (bare når valgt_vedtak_id er null i et spesifikt avsnitt)."),
    begrunnelse: { type: "string", description: "Én eller to setninger om valget, til kontroll. Kommer ikke i brevet." },
    sitat: nullbar(
      objekt({
        vedtak_id: { type: "integer", description: "Vedtaket sitatet er hentet fra." },
        tekst: { type: "string", description: "Én hel setning kopiert tegn for tegn fra utvalgets vurdering, uten «…»." },
      }),
      "Utvalgets egne ord (ledd 3). Påkrevd i et spesifikt avsnitt, valgfritt i et generelt.",
    ),
    setninger: {
      type: "array",
      description: "Avsnittets setninger, i rekkefølge innenfor hvert ledd.",
      items: objekt({
        ledd: { type: "integer", enum: [1, 2, 4, 5], description: "Spesifikt: 1, 2, 4 eller 5. Generelt: 1 eller 2." },
        om: { type: "string", enum: ["vedtak", "min_sak", "begge"], description: "Hva setningen påstår noe om." },
        tekst: { type: "string", description: "Setningen slik den skal stå i brevet, i jeg-form." },
        belegg: nullbar(
          objekt({
            vedtak_id: { type: "integer" },
            sitat: { type: "string", description: "Et sammenhengende utdrag på minst 20 tegn, kopiert tegn for tegn fra et ordrett felt i vedtakets analyse (sitat, tekst, ordlyd eller sitater), som viser det setningen sier om vedtaket." },
          }),
          "Påkrevd når om er vedtak eller begge. null når om er min_sak.",
        ),
      }),
    },
  }),
};

const FELLES = `Du skriver ett avsnitt i et reklamasjonsbrev som en forbruker selv sender til bilforhandleren som solgte bilen. Avsnittet står under overskriften «Praksis fra Forbrukerklageutvalget». Skriv i jeg-form, på bokmål, saklig og presist, slik en erfaren jurist ville skrevet for en forbruker.

Motparten vil slå opp vedtakene. Én uriktig påstand ødelegger brevet. Derfor:
Hvert vedtak i <kandidater> er gitt som en analyse (<vedtak>), ikke som fulltekst. Feltene «sitat», «tekst» (i utvalgets_begrunnelse), «ordlyd» og verdiene i «sitater» er ordrette utdrag som er kontrollert mot vedtaksteksten. Alt annet (sammendrag, nøkkelmomenter, kategorier som grunnlag, bevisgrunnlag og ved_levering) er analysens egen oppsummering: bruk det til å forstå saken, men aldri som belegg.
- Hver setning som sier noe om et vedtak (om = vedtak eller begge) skal ha et belegg: et sammenhengende utdrag på minst 20 tegn, kopiert tegn for tegn fra et av de ordrette feltene, som viser det setningen sier. Inneholder utdraget «…», tar du bare en sammenhengende del uten «…». Finner du ikke et slikt utdrag, skriver du ikke setningen.
- Setninger om hva utvalget fant eller legger vekt på (ledd 1), skal ha belegg fra utvalgets egen vurdering: utvalgets_begrunnelse eller denne_feilen.sitat. Det partene hevder, er ikke det utvalget fant.
- Sitatet (ledd 3) er én hel setning fra utvalgets_begrunnelse, kopiert tegn for tegn, uten «…».
- Skriv aldri saksnummer, vedtaksdato eller beløp fra vedtaket med tall. Skriv {{saksnummer}}, {{vedtaksdato}} og «{{belop}} kr»; de fylles inn fra databasen.
- Tall og datoer om kjøperens sak tar du bare fra <sak> og <feil>. Datoer skrives som «20. november 2025», beløp som «16 066 kr».
- Paragrafer nevnes bare når de står i belegget for samme setning.
- Ikke bruk ordene «synlig», «besiktigelse», «prøvekjøring» eller «burde» om vedtaket: de kan snus mot kjøperen.
- Ikke skriv kjøperens navn, adresse eller andre personopplysninger, og ikke «[KLAGER]» eller «[PERSON]».
- Ingen juridisk rådgivning og ingen påstander om hvordan utvalget vil avgjøre kjøperens sak.

Kall verktøyet skriv_praksis nøyaktig én gang.`;

export const PRAKSIS_SPESIFIKK = `${FELLES}

Oppgaven: velg høyst ett vedtak fra <kandidater> og skriv avsnittet. Kandidatene er vunne vedtak om samme type feil som et filter har funnet at kjøperens sak er minst like sterk som, kriterium for kriterium (<kriterier>). Ta den første med mindre analysen viser at en annen er en klart bedre analogi. Er ingen av dem en analogi en jurist ville godtatt for denne feilen, for eksempel fordi utvalget bygde på noe kjøperens sak ikke har, setter du valgt_vedtak_id til null og forklarer i grunn_ingen. Det er bedre enn en svak analogi. «Minst like sterkt» forutsetter at kjøperen har alt utvalget bygde på (se nøkkelmomentene og utvalgets_begrunnelse); mangler kjøperen noe av det, må avsnittet si det og svare på det, eller du velger ingen.

Avsnittet har fem ledd, i denne rekkefølgen:
1. Hva utvalget la til grunn, med vedtakets nummer og dato: «Forbrukerklageutvalget har i vedtak {{saksnummer}} av {{vedtaksdato}} lagt til grunn at …». Si hva utvalget faktisk fant, med utvalgets begrep: en uriktig opplysning er ikke det samme som at selger unnlot å opplyse om noe.
2. Vedtakets faktum som er relevant for sammenligningen (hva opplysningen var, bilens alder og kjørelengde, når feilen viste seg, hva rapporten sa).
3. Sitatet.
4. Utfallet: hva kjøperen fikk for denne feilen. sanksjon og beløpene i utfall gjelder hele saken, som kan ha flere feil (andre_feil_i_saken): si bare hva kjøperen fikk for denne feilen (prisavslag, erstatning eller heving) når et sitat sier det om denne feilen. Bruk {{belop}} bare når belegget inneholder beløpet, og si hva beløpet dekket slik vedtaket sier det. Finner du ikke et slikt sitat, utelater du ledd 4.
5. Sammenligningen: «Min sak står minst like sterkt på de momentene utvalget bygde på.» og deretter de momentene der kjøperen er sterkere ifølge <kriterier>. «Like sterkt» uten «minst» bare når ingen kriterier er sterkere og det ikke er noen svakhet. Påstå aldri at kjøperen er sterkere på et moment kriteriene ikke sier er sterkere. Har kandidaten en svakhet (svakhet i <meta>), ta den opp ærlig og forklar hvorfor den ikke endrer vurderingen, med fakta fra <feil>.

5 til 9 setninger i alt.`;

export const PRAKSIS_GENERELL = `${FELLES}

Oppgaven: kjøperens sak har ingen vunne vedtak om samme type feil å sammenligne med. Skriv i stedet et generelt avsnitt om regelen Forbrukerklageutvalget anvender på sporet, med <fast_blokk> som disposisjon. Blokken er skrevet av en jurist; følg innholdet, men tilpass ordlyden til kjøperens feil og fakta.
- Ledd 1: hva utvalget legger vekt på, med belegg fra et av eksempelvedtakene i <kandidater> (fra utvalgets vurdering). Eksemplene nevnes bare som «se for eksempel sak {{saksnummer}}», i samme setning som belegget fra det vedtaket, og hvert eksempel nevnes én gang.
- Ledd 2: kjøperens egne fakta (om = min_sak) som viser at kjøperen har det utvalget legger vekt på.
- Sitat (ledd 3) er valgfritt, fra ett av eksempelvedtakene.
- Ikke sammenlign: aldri «like sterkt», «minst like sterkt», «sterkere», «samme type» eller «tilsvarende sak». Ikke si hva kjøperen i et eksempel fikk, og ingen beløp ({{belop}} er ikke tillatt).
- Ingen ledd 4 eller 5. Høyst 8 setninger. valgt_vedtak_id er null, og eksempel_vedtak_ids lister vedtakene du nevner.`;

// One decision as the model reads it: the defect the filter matched, the statements, evidence and
// committee sentences tied to it (or to the whole case), the outcome, and pass 1's summary. No full text:
// the analysis is what was extracted to decide on, and its quotes are verified (docs/praksis.md).
// Pass 1's quotes on the outcome, the amounts and the reservation; the claims are left out.
const SITATER_UTFALL = ["utfall", "forbehold", "kjopesum_nok", "utbedringskostnad_nok", "tilkjent_prisavslag_nok", "tilkjent_erstatning_nok", "tilkjent_totalt_nok"];

export function vedtakForModell(v: VedtakFeil, a: Analyse | undefined) {
  const egen = (refs: string[] | undefined) => !refs?.length || refs.includes(v.feil_id);
  const verifisert = <T extends { sitat?: unknown; sitat_verifisert?: unknown }>(x: T) => (x.sitat_verifisert ? x.sitat : null);
  const feil = a?.feil.find((f) => f.id === v.feil_id);
  return {
    sammendrag: a?.sammendrag ?? null,
    utvalgets_nokkelmomenter: a?.utvalgets_nokkelmomenter ?? [],
    forbehold: a?.forbehold_tekst ?? null,
    bilen: { kjopesum_nok: v.kjopesum_nok, km_ved_kjop: v.km_ved_kjop, alder_ved_kjop: v.alder_ved_kjop },
    denne_feilen: {
      kategori: v.kategori,
      komponenter: v.komponenter,
      grunnlag: v.grunnlag,
      bevisgrunnlag: feil?.bevisgrunnlag ?? null,
      formodning: feil?.formodning ?? null,
      dager_etter_levering: v.dager_etter_levering,
      dager_er_pavist_senest: v.viste_seg_kilde === "bevisdato",
      sitat: feil?.sitat_verifisert ? (feil.sitat ?? null) : null,
    },
    andre_feil_i_saken: (a?.feil ?? []).filter((f) => f.id !== v.feil_id).map((f) => ({ kategori: f.kategori, vurdering: f.vurdering, grunn: f.grunn })),
    opplysninger: v.opplysninger
      .filter((o) => egen(o.gjelder_feil))
      .map((o) => ({ type: o.type, form: o.form, ordlyd: o.ordlyd_verifisert ? o.ordlyd : null, status: o.status, vekt: o.vekt, rekkevidde: o.rekkevidde, svar_pa_direkte_sporsmal: o.svar_pa_direkte_sporsmal, sitat: verifisert(o) })),
    // Evidence the committee neither weighed nor quoted says little about what it built on.
    bevis: v.bevis
      .filter((b) => egen(b.gjelder_feil) && (b.utvalgets_vurdering !== "ikke_nevnt" || b.sitat_verifisert))
      .map((b) => ({ type: b.type, fremlagt_av: b.fremlagt_av, arsak: b.arsak, ved_levering: b.ved_levering, paregnelig: b.paregnelig, utvalgets_vurdering: b.utvalgets_vurdering, avslagsgrunn: b.avslagsgrunn, sitat: verifisert(b) })),
    utvalgets_begrunnelse: (a?.begrunnelse_sitater ?? []).filter((b) => egen(b.gjelder_feil)).map((b) => ({ tema: b.tema, tekst: b.tekst })),
    utfall: {
      sanksjon: v.sanksjon,
      tilkjent_for_denne_feilen_nok: v.belop_tilkjent_nok,
      tilkjent_prisavslag_nok: a?.tilkjent_prisavslag_nok ?? null,
      tilkjent_erstatning_nok: a?.tilkjent_erstatning_nok ?? null,
      tilkjent_totalt_nok: v.tilkjent_totalt_nok,
      utbedringskostnad_nok: v.utbedringskostnad_nok,
    },
    // Pass 1 only flagged a quote it could not find verbatim; such a quote is left out.
    sitater: Object.fromEntries(Object.entries(a?.sitater ?? {}).filter(([k]) => SITATER_UTFALL.includes(k) && !a?.kontroll_arsaker?.some((x) => x.startsWith(`sitat for ${k} finnes ikke`)))),
  };
}

// The verified quotes in what the model saw: the only text a belegg may be taken from. The committee's own
// reasoning (its sentences and its conclusion on this defect) is what ledd 1 and the quote must come from.
export function kilderFor(v: VedtakFeil, a: Analyse | undefined): Kilder {
  const m = vedtakForModell(v, a);
  const vurdering = [m.denne_feilen.sitat, ...m.utvalgets_begrunnelse.map((b) => b.tekst)];
  const alle = [...vurdering, ...m.opplysninger.flatMap((o) => [o.ordlyd, o.sitat]), ...m.bevis.map((b) => b.sitat), ...Object.values(m.sitater)];
  const tekster = (xs: unknown[]) => xs.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  return { alle: tekster(alle), vurdering: tekster(vurdering) };
}

// Compact JSON without empty fields: the model reads what is there, and every character is paid for.
const tom = (x: unknown) => x == null || x === "" || (Array.isArray(x) && !x.length) || (typeof x === "object" && !Array.isArray(x) && !Object.keys(x as object).length);
function kompakt(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(kompakt).filter((y) => !tom(y));
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, kompakt(v)]).filter(([, v]) => !tom(v)));
  return x;
}
const json = (x: unknown) => JSON.stringify(kompakt(x));

export function praksisBruker(o: {
  modus: Modus;
  sak: Sak;
  feil: FeilProfil;
  skjemaFeil: SkjemaFeil;
  kandidater: Vurdert[];
  analyse: Map<number, Analyse>;
  kjente: Kjent[];
  fast?: { tekst: string; spor: string } | null;
}): string {
  const { sak, feil: f, skjemaFeil: sf, kjente } = o;
  const rens = (t: string | null) => (t ? rensTekst(t, kjente) : null);
  const sakData = {
    kjopsdato: sak.kjopsdato,
    lov: sak.lov,
    formodningsfrist_dager: sak.formodningsfrist_dager,
    pris_kr: sak.pris_kr,
    km_ved_kjop: sak.km_ved_kjop,
    alder_ved_kjop: sak.alder_ved_kjop,
    km_siden_kjop: sak.km_siden_kjop,
    solgt_som_den_er: sak.uten_forbehold == null ? "vet ikke" : !sak.uten_forbehold,
    selger_har_lagt_frem_motbevis: sak.selger_motbevis,
    dato_forste_kontakt_med_selger: sak.dato_forste_gang,
    onsket_losning: sak.onsket_losning,
  };
  const feilData = {
    kategori: f.kategori_pass2,
    feilen_er_at: rens(sf.en_setning),
    dato_oppdaget: sf.dato_oppdaget,
    dager_fra_kjop_til_feil: f.dager_til_feil,
    innen_formodningsfristen: f.innen_frist,
    spor: f.spor_alle,
    opplysning_fra_selger: f.avskrift_selger ? { hvor: f.a_form, ordlyd: rens(f.avskrift_selger), svar_pa_direkte_sporsmal: f.a_direkte } : null,
    verkstedrapport: f.avskrift_verksted || f.rapport_ok
      ? {
          sier_hva_som_er_feil: f.rapport_ok,
          sier_hvorfor: f.rapport_arsak,
          sier_at_feilen_var_der_ved_levering: f.rapport_levering,
          sier_mer_enn_normal_slitasje: f.rapport_paregnelig,
          verkstedet_skriver: rens(f.avskrift_verksted),
        }
      : null,
    kan_bilen_brukes: f.kan_bilen_brukes,
    kostnad_kr: f.kostnad_kr != null && (f.kostnad_kr <= sak.pris_kr || f.kostnad_over_pris_bekreftet) ? f.kostnad_kr : null,
    dager_fra_feil_til_reklamasjon: f.dager_til_reklamasjon,
  };
  const kandidater = o.kandidater
    .map((x) => {
      const v = x.vedtak;
      const meta = {
        vedtak_id: v.vedtak_id,
        spor: v.spor,
        sanksjon: v.sanksjon,
        lovversjon: v.lovversjon,
        ...(o.modus === "spesifikk" ? { antall_sterkere: x.antall_sterkere, svakhet: x.svakhet?.navn ?? null } : {}),
      };
      const kriterier = o.modus === "spesifikk" ? `\n<kriterier>${json(x.kriterier.map(({ navn, bruker, vedtak, utfall }) => ({ navn, min_sak: bruker, vedtaket: vedtak, utfall })))}</kriterier>` : "";
      return `<kandidat vedtak_id="${v.vedtak_id}">\n<meta>${json(meta)}</meta>${kriterier}\n<vedtak>${json(vedtakForModell(v, o.analyse.get(v.vedtak_id)))}</vedtak>\n</kandidat>`;
    })
    .join("\n");
  const fast = o.modus === "generell" && o.fast ? `\n<fast_blokk spor="${o.fast.spor}">\n${o.fast.tekst}\n</fast_blokk>` : "";
  return `<sak>${json(sakData)}</sak>\n<feil>${json(feilData)}</feil>${fast}\n<kandidater>\n${kandidater}\n</kandidater>`;
}
