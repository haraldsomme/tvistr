import { describe, expect, it } from "vitest";
import { delOpp, lesSvar, signaturdato, utenRettsligPoeng, utenStandpunkt } from "./verifiser";

const FULLTEKST = `Sakens bakgrunn: Bilen ble annonsert som «uten noen skader».
Utvalget ser slik på saken: Utvalget legger avgjørende vekt på uttalelsen fra Nord Salten Auto om at lekkasjen ikke er å anse som normal slitasje. Det er ikke forhold som tyder på at dette kan skyldes brukerfeil. Bilen har en mangel, jf. fkjl. § 17 første ledd bokstav a.
Vedtak: Klageren gis prisavslag.`;

const feil = (f: Record<string, unknown> = {}) => ({
  id: "f1",
  avgjorende: "Utvalget bygde på en sakkyndig uttalelse om at lekkasjen ikke var normal slitasje.",
  hjemmel: ["fkjl. § 17 første ledd bokstav a"],
  bevis: ["sakkyndig"],
  samlet_med: [],
  under_tvil: false,
  sanksjoner: ["prisavslag"],
  sitater: ["Utvalget legger avgjørende vekt på uttalelsen fra Nord Salten Auto om at lekkasjen ikke er å anse som normal slitasje."],
  ...f,
});
const svar = (o: Record<string, unknown> = {}) => ({ vedtak_id: 7, selger_svarte: true, feil: [feil()], ...o });
const les = (f: Record<string, unknown>, medhold = ["f1"]) => lesSvar(svar({ feil: [feil(f)] }), 7, FULLTEKST, medhold);

describe("delOpp", () => {
  it("skiller saksfremstillingen fra utvalgets vurdering, også på nynorsk", () => {
    expect(delOpp(FULLTEKST).vurdering).toMatch(/^Utvalget ser slik på saken/);
    expect(delOpp("Faktum.\nUtvalet ser slik på saka: Bilen har ein mangel.").vurdering).toMatch(/^Utvalet/);
    expect(delOpp("Bare faktum.").vurdering).toBeNull();
  });
});

describe("signaturdato", () => {
  it("leser datoen i signaturen, med tall eller måned i ord", () => {
    expect(signaturdato("… Vedtaket er enstemmig.\nPorsgrunn, den 6.10.2021\n[PERSON] [PERSON]")).toBe("2021-10-06");
    expect(signaturdato("… Vedtaket er enstemmig.\nOslo, den 7. februar 2023\n[PERSON]")).toBe("2023-02-07");
    expect(signaturdato("… enstemmig. Oslo, den 09.10.14 [PERSON]")).toBe("2014-10-09");
  });

  it("gir null når signaturen mangler eller ikke kan leses", () => {
    expect(signaturdato("… enstemmig. Porsgrunn, den .2022 [PERSON]")).toBeNull();
    expect(signaturdato("… enstemmig. [PERSON] [PERSON] Rett utskrift")).toBeNull();
  });
});

describe("lesSvar", () => {
  it("godtar et gyldig svar uten merknader", () => {
    expect(lesSvar(svar(), 7, FULLTEKST, ["f1"])).toMatchObject({ ok: true, kontroll: [] });
  });

  it("avviser svar for et annet vedtak eller uten feilliste", () => {
    expect(lesSvar(svar({ vedtak_id: 8 }), 7, FULLTEKST, ["f1"]).ok).toBe(false);
    expect(lesSvar(svar({ feil: "f1" }), 7, FULLTEKST, ["f1"]).ok).toBe(false);
  });

  it("dropper sitater fra saksfremstillingen, med utelatelser, eller som ikke står ordrett", () => {
    const lest = les({
      sitater: ["Sakens bakgrunn: Bilen ble annonsert som «uten noen skader».", "Det er ikke forhold som tyder på … at dette kan skyldes brukerfeil.", "Utvalget mener lekkasjen er en klar mangel ved bilen."],
    });
    expect(lest.ok && lest.svar.feil[0].sitater).toEqual([]);
    expect(lest.ok && lest.kontroll).toEqual([
      "f1: sitat ikke ordrett i vurderingen, droppet",
      "f1: sitat med utelatelse, droppet",
      "f1: sitat ikke ordrett i vurderingen, droppet",
      "f1: ingen sitater",
    ]);
  });

  it("beholder bare hjemler som står i vurderingen", () => {
    const lest = les({ hjemmel: ["FKJL. § 17 første ledd bokstav a)", "forbrukerkjøpsloven § 17 første ledd bokstav a", "fkjl. § 16 første ledd bokstav c"] });
    expect(lest.ok && lest.svar.feil[0].hjemmel).toEqual(["FKJL. § 17 første ledd bokstav a)", "forbrukerkjøpsloven § 17 første ledd bokstav a"]);
  });

  it("dropper feil som ikke fikk medhold, og melder feil som mangler", () => {
    const lest = les({ id: "f3" });
    expect(lest.ok && lest.svar.feil).toEqual([]);
    expect(lest.ok && lest.kontroll).toEqual(["f3: ikke en feil med medhold, droppet", "f1: mangler i svaret"]);
  });

  it("beholder bilens navn bare når det står i vedtaket", () => {
    const med = (bil: string) => lesSvar(svar({ bil }), 7, `Bilen var en Range Rover Sport 2014-modell.\n${FULLTEKST}`, ["f1"]);
    expect([med("Range Rover Sport 2014-modell"), med("Land Rover Sport")].map((l) => l.ok && l.svar.bil)).toEqual(["Range Rover Sport 2014-modell", null]);
  });

  it("tar med svarene om feilen ble nevnt og vurdert for seg, og tolker manglende svar som ja", () => {
    const lest = les({ nevnt_i_vurderingen: false });
    expect(lest.ok && lest.svar.feil[0]).toMatchObject({ nevnt_i_vurderingen: false, vurdert_for_seg: true });
  });

  it("beholder ett kontrollert sitat per rettslig poeng og godtar bare kjente verdier", () => {
    const sitat = "Det er ikke forhold som tyder på at dette kan skyldes brukerfeil.";
    const lest = lesSvar(
      svar({
        forbehold: "som_den_er",
        lovversjon_brukt: "noe",
        rettslige_sitater: [
          { poeng: "formodning", sitat },
          { poeng: "formodning", sitat: "Bilen har en mangel, jf. fkjl. § 17 første ledd bokstav a." },
          { poeng: "heving", sitat: "Sakens bakgrunn: Bilen ble annonsert som «uten noen skader»." },
          { poeng: "ukjent_poeng", sitat },
        ],
      }),
      7,
      FULLTEKST,
      ["f1"],
    );
    expect(lest.ok && lest.svar).toMatchObject({ forbehold: "som_den_er", lovversjon_brukt: "ukjent", rettslige_sitater: [{ poeng: "formodning", sitat }] });
    expect(lest.ok && lest.kontroll).toEqual(["heving: sitat ikke ordrett i vurderingen, droppet", "rettslig poeng ukjent_poeng ukjent, droppet"]);
  });

  it("setter vurdert_for_seg til nei når feilen ble vurdert sammen med andre", () => {
    const lest = lesSvar(svar({ feil: [feil({ vurdert_for_seg: true, samlet_med: ["f2"] }), feil({ id: "f2", samlet_med: ["f1"] })] }), 7, FULLTEKST, ["f1", "f2"]);
    expect(lest.ok && lest.svar.feil.map((f) => f.vurdert_for_seg)).toEqual([false, false]);
    expect(lest.ok && lest.kontroll).toEqual(["f1: vurdert for seg, men samlet med andre; satt til nei"]);
  });

  it("retter ukjente verdier og holder samlet_med til kjente feil", () => {
    const lest = les({ bevis: ["sakkyndig", "rykte"], samlet_med: ["f1", "f2", "f9"], sanksjoner: ["heving", "gave"] }, ["f1", "f2"]);
    expect(lest.ok && lest.svar.feil[0]).toMatchObject({ bevis: ["sakkyndig"], samlet_med: ["f2"], sanksjoner: ["heving"] });
  });
});

describe("utenStandpunkt", () => {
  it("dropper sitatene feltpasset sa ikke er utvalgets standpunkt, og beholder resten", () => {
    const lest = lesSvar(svar({ rettslige_sitater: [{ poeng: "formodning", sitat: "Det er ikke forhold som tyder på at dette kan skyldes brukerfeil." }] }), 7, FULLTEKST, ["f1"]);
    if (!lest.ok) throw new Error(lest.feil);
    const sitater = [
      { id: "f1.s1", tekst: lest.svar.feil[0].sitater[0] },
      { id: "rettslig.formodning", tekst: "Det er ikke forhold som tyder på at dette kan skyldes brukerfeil." },
    ];
    const ut = utenStandpunkt(lest.svar, sitater, { sitater: [{ id: "f1.s1", standpunkt: false }, { id: "rettslig.formodning", standpunkt: true }] });
    expect(ut.svar.feil[0].sitater).toEqual([]);
    expect(ut.svar.rettslige_sitater).toHaveLength(1);
    expect(ut.kontroll).toEqual(["f1: 1 sitat ikke utvalgets standpunkt, droppet"]);
    expect(utenStandpunkt(lest.svar, sitater, undefined).svar).toEqual(lest.svar);
  });
});

describe("utenRettsligPoeng", () => {
  it("dropper rettslige sitater datavasken sa ikke uttrykker poenget", () => {
    const sitat = "Det er ikke forhold som tyder på at dette kan skyldes brukerfeil.";
    const lest = lesSvar(svar({ rettslige_sitater: [{ poeng: "formodning", sitat }, { poeng: "heving", sitat }] }), 7, FULLTEKST, ["f1"]);
    if (!lest.ok) throw new Error(lest.feil);
    const inn = lest.svar.rettslige_sitater!;
    const ut = utenRettsligPoeng(lest.svar, inn, { sitater: [{ poeng: "heving", uttrykker: false }, { poeng: "formodning", uttrykker: true }] });
    expect(ut.svar.rettslige_sitater).toEqual([{ poeng: "formodning", sitat }]);
    expect(ut.kontroll).toEqual(["heving: sitat uttrykker ikke poenget, droppet"]);
  });
});
