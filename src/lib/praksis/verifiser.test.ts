import { describe, expect, it } from "vitest";
import skjemaJson from "@/lib/sammenligning/testdata/enyaq-skjema.json";
import { avledFeil, avledSak } from "@/lib/sammenligning/avled";
import type { Skjema, VedtakFeil, Vurdert } from "@/lib/sammenligning/typer";
import { kjenteOpplysninger } from "./rens";
import { tall } from "./tekst";
import type { Analyse, PraksisSvar, Setning } from "./typer";
import { type Grunnlag, verifiserPraksis } from "./verifiser";

const IDAG = "2026-10-09";
const enyaq = skjemaJson as unknown as Skjema;

// A made-up decision's analysis: the committee's sentences, a party's claim, and pass 1's outcome quote.
const ANALYSE: Analyse = {
  sammendrag: "Varmepumpen virket ikke.",
  utvalgets_nokkelmomenter: [],
  forbehold_tekst: null,
  tilkjent_prisavslag_nok: null,
  tilkjent_erstatning_nok: 16_066,
  sitater: { tilkjent_erstatning_nok: "Klageren tilkjennes erstatning med kr 16 066 for utbedringen." },
  kontroll_arsaker: [],
  feil: [{ id: "f1", sitat: "Utvalget finner at bilen har en mangel etter forbrukerkjøpsloven § 16 første ledd bokstav c.", sitat_verifisert: true }],
  begrunnelse_sitater: [
    { tema: "opplysning", tekst: "Utvalget legger til grunn at varmepumpen ikke fungerte ved levering, og at bilen ikke var som opplyst.", gjelder_feil: ["f1"] },
  ],
};
// Statements as pass 2 stored them: what the ad said (the committee's finding) and what the parties claimed.
const OPPLYSNINGER = [
  { type: "uttalelse", form: "annonse", ordlyd: "varmepumpe", ordlyd_verifisert: true, sitat: "Det fremgår av annonsen at bilen hadde varmepumpe.", sitat_verifisert: true, status: "lagt_til_grunn", vekt: "for_klager", rekkevidde: "spesifikk", svar_pa_direkte_sporsmal: false, gjelder: "", gjelder_feil: ["f1"] },
  { type: "uttalelse", form: "annet", ordlyd: null, ordlyd_verifisert: null, sitat: "Innklagde hevder at bilen var i god stand ved levering.", sitat_verifisert: true, status: "omtvistet", vekt: "ingen", rekkevidde: "generell", svar_pa_direkte_sporsmal: false, gjelder: "", gjelder_feil: ["f1"] },
  { type: "uttalelse", form: "annet", ordlyd: null, ordlyd_verifisert: null, sitat: "Klageren hevder at varmepumpen ikke virket.", sitat_verifisert: true, status: "omtvistet", vekt: "ingen", rekkevidde: "generell", svar_pa_direkte_sporsmal: false, gjelder: "", gjelder_feil: ["f1"] },
] as unknown as VedtakFeil["opplysninger"];

function vedtak(o: Partial<VedtakFeil> = {}): VedtakFeil {
  return {
    vedtak_id: 1,
    feil_id: "f1",
    spor: "A",
    saksnummer: "22/2952",
    vedtaksdato: "2022-05-18",
    kilde_url: "https://example.org/1.pdf",
    utfall: "medhold",
    grunn: null,
    selger_type: "forhandler",
    kategori: "klimaanlegg",
    komponenter: [],
    grunnlag: "feil_opplysning",
    spor_vunnet: ["A"],
    a_variant: "uttalelse",
    alvor: [],
    dager_etter_levering: 40,
    viste_seg_kilde: "vedtak",
    lovversjon: "før_2024",
    alder_ved_kjop: 3,
    km_ved_kjop: 30_000,
    kjopesum_nok: 400_000,
    utbedringskostnad_nok: null,
    tilkjent_totalt_nok: 16_066,
    belop_tilkjent_nok: null,
    sanksjon: "erstatning",
    selger_bevis_finnes: false,
    forbehold: [],
    forste_henvendelse_dato: null,
    start_dato: "2021-10-01",
    antall_feil: 1,
    opplysninger: OPPLYSNINGER,
    bevis: [],
    ...o,
  };
}

const kandidat = (o: Partial<VedtakFeil> = {}, antall_sterkere = 2): Vurdert => ({ vedtak: vedtak(o), kriterier: [], antall_sterkere, svakhet: null });

function grunnlag(o: Partial<Grunnlag> = {}): Grunnlag {
  const sak = avledSak(enyaq, IDAG);
  const f = enyaq.del3_feil[0];
  return {
    modus: "spesifikk",
    kandidater: [kandidat()],
    analyse: new Map([[1, ANALYSE]]),
    sak,
    feil: avledFeil(sak, f),
    skjemaFeil: f,
    km_na: enyaq.km_na,
    kjente: kjenteOpplysninger(enyaq),
    ...o,
  };
}

const S = (ledd: number, tekst: string, sitat: string | null, om: Setning["om"] = "vedtak", vedtak_id = 1): Setning => ({ ledd, om, tekst, belegg: sitat ? { vedtak_id, sitat } : null });

const LEDD1 = S(1, "Forbrukerklageutvalget har i vedtak {{saksnummer}} av {{vedtaksdato}} lagt til grunn at varmepumpen ikke fungerte ved levering", "Utvalget legger til grunn at varmepumpen ikke fungerte ved levering");
const LEDD2 = S(2, "Det sto i annonsen at bilen hadde varmepumpe.", "Det fremgår av annonsen at bilen hadde varmepumpe.");
const LEDD4 = S(4, "Kjøperen fikk erstattet {{belop}} kr.", "Klageren tilkjennes erstatning med kr 16 066 for utbedringen.");
const LEDD5 = S(5, `Min sak står minst like sterkt: opplysningen sto i både annonsen og en melding, og bilen kostet ${tall(enyaq.del1_kjopet.pris_kr)} kr.`, null, "min_sak");

const svar = (o: Partial<PraksisSvar> = {}): PraksisSvar => ({
  valgt_vedtak_id: 1,
  eksempel_vedtak_ids: [],
  grunn_ingen: null,
  begrunnelse: "Samme type opplysning.",
  sitat: { vedtak_id: 1, tekst: "Utvalget legger til grunn at varmepumpen ikke fungerte ved levering, og at bilen ikke var som opplyst." },
  setninger: [LEDD1, LEDD2, LEDD4, LEDD5],
  ...o,
});

describe("verifiserPraksis, spesifikt avsnitt", () => {
  it("et sant avsnitt rendres med saksnummer, dato og beløp fra basen", () => {
    const v = verifiserPraksis(svar(), grunnlag());
    expect(v.strykninger).toEqual([]);
    expect(v.vedtak_id).toBe(1);
    expect(v.avsnitt).toBe(
      "Forbrukerklageutvalget har i vedtak 22/2952 av 18. mai 2022 lagt til grunn at varmepumpen ikke fungerte ved levering. " +
        "Det sto i annonsen at bilen hadde varmepumpe. " +
        "Utvalget uttalte: «Utvalget legger til grunn at varmepumpen ikke fungerte ved levering, og at bilen ikke var som opplyst». " +
        "Kjøperen fikk erstattet 16 066 kr. " +
        `Min sak står minst like sterkt: opplysningen sto i både annonsen og en melding, og bilen kostet ${tall(enyaq.del1_kjopet.pris_kr)} kr.`,
    );
  });

  it("to kjøringer gir samme svar", () => {
    expect(verifiserPraksis(svar(), grunnlag())).toEqual(verifiserPraksis(svar(), grunnlag()));
  });

  it("et endret belegg stryker setningen, men avsnittet består", () => {
    const endret = S(2, "Det sto i annonsen at bilen hadde varmepumpe.", "Det fremgår av annonsen at bilen hadde ny varmepumpe.");
    const v = verifiserPraksis(svar({ setninger: [LEDD1, endret, LEDD4] }), grunnlag());
    expect(v.strykninger).toMatchObject([{ regel: "belegg" }]);
    expect(v.avsnitt).not.toContain("Det sto i annonsen");
  });

  it("to strøkne setninger gir ikke noe avsnitt", () => {
    const uten = S(2, "Bilen var solgt som den er.", null);
    const v = verifiserPraksis(svar({ setninger: [LEDD1, uten, { ...LEDD4, belegg: null }] }), grunnlag());
    expect(v).toMatchObject({ avsnitt: null, grunn: "2 setninger strøket" });
  });

  it("et tall som ikke står i kildene stryker setningen", () => {
    const v = verifiserPraksis(svar({ setninger: [LEDD1, S(2, "Bilen hadde gått 45 000 km.", "Det fremgår av annonsen at bilen hadde varmepumpe.")] }), grunnlag());
    expect(v.strykninger).toMatchObject([{ regel: "tall", detalj: "tallet 45000 står ikke i kildene" }]);
  });

  it("et vedtak utenfor kandidatene gir ikke noe avsnitt", () => {
    expect(verifiserPraksis(svar({ valgt_vedtak_id: 9 }), grunnlag())).toMatchObject({ avsnitt: null, grunn: "vedtak 9 er ikke blant kandidatene" });
  });

  it("modellen kan si at ingen er sammenlignbar", () => {
    expect(verifiserPraksis(svar({ valgt_vedtak_id: null, grunn_ingen: "vedtaket gjaldt en annen bil" }), grunnlag()).grunn).toContain("vedtaket gjaldt en annen bil");
  });

  it("et sitat som ikke er fra utvalgets begrunnelse, gir ikke noe avsnitt: det kan være en parts påstand", () => {
    const v = verifiserPraksis(svar({ sitat: { vedtak_id: 1, tekst: "Innklagde hevder at bilen var i god stand ved levering." } }), grunnlag());
    expect(v).toMatchObject({ avsnitt: null, grunn: "sitatet er ikke fra utvalgets begrunnelse" });
  });

  it("ledd 1 må ha belegg fra utvalgets begrunnelse", () => {
    const v = verifiserPraksis(svar({ setninger: [S(1, "Utvalget la til grunn at varmepumpen ikke virket.", "Klageren hevder at varmepumpen ikke virket."), LEDD2] }), grunnlag());
    expect(v).toMatchObject({ avsnitt: null, grunn: "ledd 1 mangler" });
    expect(v.strykninger).toMatchObject([{ regel: "vurderingsdel" }]);
  });

  it("«like sterkt» bare når kjøperen ikke er sterkere og ikke har en svakhet", () => {
    const like = S(5, "Min sak står like sterkt på de momentene utvalget bygde på.", null, "min_sak");
    expect(verifiserPraksis(svar({ setninger: [LEDD1, like] }), grunnlag()).strykninger).toMatchObject([{ regel: "like_sterkt" }]);
    expect(verifiserPraksis(svar({ setninger: [LEDD1, like] }), grunnlag({ kandidater: [kandidat({}, 0)] })).strykninger).toEqual([]);
  });

  it("ord som kan snus mot kjøperen stryker en setning om vedtaket", () => {
    const synlig = S(2, "Utvalget fant at feilen ikke var synlig ved levering.", "Utvalget legger til grunn at varmepumpen ikke fungerte ved levering");
    expect(verifiserPraksis(svar({ setninger: [LEDD1, synlig] }), grunnlag()).strykninger).toMatchObject([{ regel: "ord" }]);
  });

  it("kjøperens navn stryker setningen", () => {
    const navn = S(5, `Jeg, ${enyaq.del7_onske_og_kontakt.kjoper.navn}, har reklamert i tide.`, null, "min_sak");
    expect(verifiserPraksis(svar({ setninger: [LEDD1, navn] }), grunnlag()).strykninger).toMatchObject([{ regel: "personopplysning" }]);
  });

  it("et beløp som ikke står i belegget stryker setningen", () => {
    const belop = S(4, "Kjøperen fikk erstattet {{belop}} kr.", "Det fremgår av annonsen at bilen hadde varmepumpe.");
    expect(verifiserPraksis(svar({ setninger: [LEDD1, belop] }), grunnlag()).strykninger).toMatchObject([{ regel: "belegg" }]);
  });

  it("en paragraf bare når den står i belegget", () => {
    const med = S(1, "Utvalget fant en mangel etter forbrukerkjøpsloven § 16.", "Utvalget finner at bilen har en mangel etter forbrukerkjøpsloven § 16 første ledd bokstav c.");
    expect(verifiserPraksis(svar({ setninger: [med] }), grunnlag()).strykninger).toEqual([]);
    const uten = S(5, "Etter § 17 er bilen mangelfull.", null, "min_sak");
    expect(verifiserPraksis(svar({ setninger: [LEDD1, uten] }), grunnlag()).strykninger).toMatchObject([{ regel: "paragraf" }]);
  });
});

describe("verifiserPraksis, generelt avsnitt", () => {
  const EKS2: Analyse = { ...ANALYSE, sitater: {}, feil: [{ id: "f1" }], begrunnelse_sitater: [{ tema: "bevis", tekst: "Ifølge uttalelsen fra NAF er dette komponenter i bilen som forventes å ha en vesentlig lengre levetid enn 7 år.", gjelder_feil: [] }] };
  const g = (o: Partial<Grunnlag> = {}) =>
    grunnlag({
      modus: "generell",
      kandidater: [kandidat({}, 0), { vedtak: vedtak({ vedtak_id: 2, saksnummer: "FKU-2026-104368", vedtaksdato: "2026-02-02" }), kriterier: [], antall_sterkere: 0, svakhet: null }],
      analyse: new Map([
        [1, ANALYSE],
        [2, EKS2],
      ]),
      ...o,
    });
  const REGEL = S(1, "Forbrukerklageutvalget legger vekt på om bilen svarer til det som er opplyst, se for eksempel sak {{saksnummer}}.", "Utvalget legger til grunn at varmepumpen ikke fungerte ved levering");
  const MIN = S(2, `Bilen kostet ${tall(enyaq.del1_kjopet.pris_kr)} kr.`, null, "min_sak");
  const gsvar = (o: Partial<PraksisSvar> = {}) => svar({ valgt_vedtak_id: null, eksempel_vedtak_ids: [1], sitat: null, setninger: [REGEL, MIN], ...o });

  it("en sann tekst med belegg fra et eksempel rendres, og eksemplene er de som har belegg", () => {
    const v = verifiserPraksis(gsvar(), g());
    expect(v.strykninger).toEqual([]);
    expect(v.avsnitt).toBe(`Forbrukerklageutvalget legger vekt på om bilen svarer til det som er opplyst, se for eksempel sak 22/2952. Bilen kostet ${tall(enyaq.del1_kjopet.pris_kr)} kr.`);
    expect(v.eksempel_vedtak_ids).toEqual([1]);
  });

  it("ledd 4 og 5 strykes", () => {
    expect(verifiserPraksis(gsvar({ setninger: [REGEL, MIN, LEDD4] }), g()).strykninger).toMatchObject([{ regel: "ledd" }]);
  });

  it("sammenligning strykes, også «minst like sterkt»", () => {
    const like = S(2, "Min sak står minst like sterkt.", null, "min_sak");
    expect(verifiserPraksis(gsvar({ setninger: [REGEL, like] }), g()).strykninger).toMatchObject([{ regel: "sammenligning" }]);
  });

  it("et eksempel utenfor juristens liste gir ikke noe avsnitt", () => {
    expect(verifiserPraksis(gsvar({ eksempel_vedtak_ids: [9] }), g()).grunn).toBe("eksempel utenfor juristens eksempler");
    expect(verifiserPraksis(gsvar({ valgt_vedtak_id: 1 }), g()).grunn).toBe("et generelt avsnitt viser ikke til ett vedtak");
  });

  it("belegg fra et vedtak utenfor eksemplene strykes; to strykninger gir ikke noe avsnitt", () => {
    const fremmed = { ...REGEL, belegg: { vedtak_id: 9, sitat: REGEL.belegg!.sitat } };
    expect(verifiserPraksis(gsvar({ setninger: [REGEL, fremmed] }), g()).strykninger).toMatchObject([{ regel: "belegg" }]);
    expect(verifiserPraksis(gsvar({ setninger: [REGEL, fremmed, LEDD4] }), g())).toMatchObject({ avsnitt: null, grunn: "2 setninger strøket" });
  });

  it("et valgfritt sitat fra et eksempel står sist med saksnummeret", () => {
    const v = verifiserPraksis(gsvar({ sitat: { vedtak_id: 2, tekst: "Ifølge uttalelsen fra NAF er dette komponenter i bilen som forventes å ha en vesentlig lengre levetid enn 7 år." } }), g());
    expect(v.avsnitt).toMatch(/I sak FKU-2026-104368 uttalte utvalget: «Ifølge uttalelsen fra NAF .* enn 7 år»\.$/);
    expect(v.eksempel_vedtak_ids).toEqual([1, 2]);
  });
});
