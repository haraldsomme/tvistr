import { describe, expect, it } from "vitest";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import type { Rangert } from "@/lib/matching/ranger";
import type { Brukersak, Kandidat } from "@/lib/matching/typer";
import { kontroller, type Valg } from "./kontroll";

const SITAT = "Turboen svarer ikke til det klageren hadde grunn til å regne med ved kjøpet.";

const feil = (f: Partial<AvledetFeil> = {}): AvledetFeil => ({
  id: "f1",
  hovedkategori: "motor",
  underkategori: "turbo",
  komponent: "turbo",
  utfall: "medhold",
  samlet: false,
  avslagsgrunn: null,
  bevisgrunnlag: "utvalgets_skjonn",
  dager_etter_levering: null,
  viste_seg: "ukjent",
  formodning: "ikke_nevnt",
  sitat: SITAT,
  tidsniva: 2,
  ...f,
});

const kandidat = (k: Partial<Kandidat> = {}): Kandidat => ({
  id: 7,
  saksnummer: "21/5035",
  vedtaksdato: "2022-03-01",
  km: null,
  alder: null,
  somDenEr: null,
  sanksjoner: ["prisavslag"],
  mangelsgrunnlag: null,
  paragrafer: null,
  tvistetema: null,
  feil: [feil()],
  ...k,
});

const rangert = (r: Partial<Rangert> = {}): Rangert => ({ id: 7, trinn: 1, feil: null, hoved: "motor", rett: [], poengsum: 0, maks: 0, treff: {} as Rangert["treff"], ...r });

const sak = (niva: 1 | 2 | 3 = 1): Brukersak => ({
  kategorier: [{ hoved: "motor", under: ["turbo"], niva, opplysning: false, verksted: true }],
  km: null,
  alder: null,
  somDenEr: null,
  krav: "prisavslag",
  forsok: 0,
});

const valg = (v: Partial<Valg> = {}): Valg => ({
  vedtak_id: 7,
  bruk: "samme_feil",
  avsnitt: `I sak 21/5035 fikk kjøperen medhold. Utvalget uttalte: «${SITAT}» Min sak står minst like sterkt.`,
  sitater: [SITAT],
  forbehold: "",
  ...v,
});

const sjekk = (v: Partial<Valg> = {}, k: Partial<Kandidat> = {}, r: Partial<Rangert> = {}, s: Brukersak = sak()) =>
  kontroller(valg(v), [rangert(r)], new Map([[7, kandidat(k)]]), s);

describe("kontroller", () => {
  it("godtar et valg som holder", () => {
    expect(sjekk()).toEqual([]);
  });

  it("avviser et vedtak som ikke er blant kandidatene", () => {
    expect(sjekk({ vedtak_id: 8 })).toEqual(["vedtak_id 8 er ikke blant kandidatene"]);
  });

  it("krever saksnummeret i avsnittet", () => {
    expect(sjekk({ avsnitt: `Utvalget uttalte: «${SITAT}»` })).toEqual(["avsnittet må nevne saksnummeret 21/5035"]);
  });

  it("krever at hvert sitat står ordrett i vedtakets sitatfelt og i avsnittet", () => {
    expect(sjekk({ sitater: [] })).toEqual(["avsnittet må ha minst ett ordrett sitat fra vedtaket"]);
    expect(sjekk({ sitater: ["Turboen var helt klart en alvorlig mangel ved bilen."] })[0]).toMatch(/står ikke ordrett/);
    expect(sjekk({ avsnitt: "I sak 21/5035 fikk kjøperen medhold." })[0]).toMatch(/står ikke i avsnittet/);
    // A part of a quote, with an ellipsis for what is left out, is allowed.
    const del = "Turboen svarer ikke til det … grunn til å regne med ved kjøpet.";
    expect(sjekk({ sitater: [del], avsnitt: "I sak 21/5035 uttalte utvalget at «Turboen svarer ikke til det … grunn til å regne med ved kjøpet.»" })).toEqual([]);
  });

  it("godtar ikke sitater fra en feil utvalget avviste", () => {
    const avvist = "Bremsene er slitedeler, og slitasjen er ikke en mangel ved bilen.";
    expect(sjekk({ sitater: [avvist], avsnitt: `I sak 21/5035 uttalte utvalget: «${avvist}»` }, { feil: [feil(), feil({ id: "f2", utfall: "avvist", sitat: avvist })] })[0]).toMatch(/står ikke ordrett/);
  });

  it("krever samme underkategori for «samme feil», og samme eller senere tidspunkt for tidspunktet", () => {
    expect(sjekk({}, { feil: [feil({ underkategori: "olje" })] })[0]).toMatch(/krever en feil med medhold i kjøperens underkategori/);
    expect(sjekk({}, { feil: [feil({ tidsniva: 1 })] }, {}, sak(2))[0]).toMatch(/like sent eller senere/);
    expect(sjekk({ bruk: "samme_feil_uten_tidspunkt" }, { feil: [feil({ tidsniva: 1 })] }, {}, sak(2))).toEqual([]);
  });

  it("godtar ikke «samme feil» når selgeren erkjente feilen eller ikke bestred den", () => {
    expect(sjekk({}, { feil: [feil({ bevisgrunnlag: "uomtvistet" })] })[0]).toMatch(/som utvalget vurderte selv/);
    expect(sjekk({ bruk: "samme_feil_uten_tidspunkt" }, { feil: [feil({ bevisgrunnlag: "erkjent_av_selger" })] })[0]).toMatch(/som utvalget vurderte selv/);
  });

  it("krever et vedtak om opplysningssvikt og et rettslig poeng for de brukene", () => {
    expect(sjekk({ bruk: "opplysningssvikt" })[0]).toMatch(/uriktig eller tilbakeholdt opplysning/);
    expect(sjekk({ bruk: "opplysningssvikt" }, { mangelsgrunnlag: ["tilbakeholdt_opplysning"] })).toEqual([]);
    expect(sjekk({ bruk: "rettslig_poeng" })[0]).toMatch(/rettslige poeng/);
    expect(sjekk({ bruk: "rettslig_poeng" }, {}, { rett: ["prisavslag"] })).toEqual([]);
  });
});
