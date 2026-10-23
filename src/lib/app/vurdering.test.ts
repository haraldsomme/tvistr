import { describe, expect, it } from "vitest";
import { dur, fmtD, parseD, relText } from "./dato";
import { regler } from "./lov";
import { eksempel, syncAreas } from "./skjema";
import { celleFaktor, evaluate, medCelle, skriverResultat, styrke, wsFactors } from "./vurdering";

const idag = "2026-10-16";
const base = { seller: "forhandler", buyer: "privat", asis: "nei", notified: "nei" } as const;
const har = (r: ReturnType<typeof evaluate>, t: string) => r.factors.some((f) => f.t === t);

describe("evaluate", () => {
  it("innen formodningen alene: god", () => expect(evaluate({ ...base, delivery: "2026-06-01", found: "2026-10-01" }, idag).tier).toBe("god"));
  it("feil i det selgeren opplyste: sterk", () => expect(evaluate({ ...base, delivery: "2026-06-01", found: "2026-10-01", opplysning: true }, idag).tier).toBe("sterk"));
  it("innen to år etter 2024", () => expect(har(evaluate({ ...base, delivery: "2025-01-10", found: "2026-06-01" }, idag), "Feilen viste seg innen to år")).toBe(true));
  it("seks måneder før 2024", () => {
    const r = evaluate({ ...base, delivery: "2023-12-31", found: "2024-09-01" }, idag);
    expect(r.factors.some((f) => f.t.startsWith("Mer enn seks måneder"))).toBe(true);
    expect(r.tier).toBe("kreverMer");
  });
  it("innen seks måneder før 2024", () => expect(har(evaluate({ ...base, delivery: "2023-06-01", found: "2023-09-01" }, idag), "Feilen viste seg innen seks måneder")).toBe(true));
  it("grensen 1.1.2024", () => expect(har(evaluate({ ...base, delivery: "2024-01-01", found: "2024-09-01" }, idag), "Feilen viste seg innen to år")).toBe(true));
  it("fristen er ute", () => expect(har(evaluate({ ...base, delivery: "2020-01-01", found: "2026-01-01" }, idag), "Fristen er ute")).toBe(true));
  it.each(["privat", "leasing"] as const)("utenfor: selger %s", (s) => expect(evaluate({ seller: s }, idag).tier).toBe("utenfor"));
  it("utenfor: næring", () => expect(evaluate({ seller: "forhandler", buyer: "naering" }, idag).tier).toBe("utenfor"));
  it("feil før overtakelsen", () => expect(har(evaluate({ ...base, delivery: "2026-06-01", found: "2026-05-01" }, idag), "Feilen ble oppdaget før overtakelsen")).toBe(true));
  it("datoene mangler", () => expect(har(evaluate({ ...base, found: "2026-05-01" }, idag), "Datoene mangler")).toBe(true));
  it("som den er før 2024 bruker gamle § 17", () =>
    expect(evaluate({ ...base, asis: "ja", delivery: "2023-06-01", found: "2023-07-01" }, idag).factors.find((f) => f.t === "Solgt «som den er»")?.law).toBe("forbrkjl. § 17 første ledd bokstav a"));
  it("som den er fra 2024 bruker § 15 annet ledd", () =>
    expect(evaluate({ ...base, asis: "ja", delivery: "2024-06-01", found: "2024-07-01" }, idag).factors.find((f) => f.t === "Solgt «som den er»")?.law).toBe("forbrkjl. § 15 annet ledd"));
  it("fristen ute nevner unntaket for grov uaktsomhet og uredelighet", () =>
    expect(evaluate({ ...base, delivery: "2020-01-01", found: "2026-01-01" }, idag).factors.find((f) => f.t === "Fristen er ute")?.d).toContain("grovt uaktsomt eller i strid med redelighet og god tro"));
  it("sender innen to måneder: i tide til fristen", () =>
    expect(evaluate({ ...base, delivery: "2026-06-01", found: "2026-10-01" }, idag).factors.find((f) => f.t === "Du er i tide")?.d).toContain(fmtD(parseD("2026-12-01")!)));
});

describe("wsFactors", () => {
  it("rapport som sier levering", () => expect(wsFactors({ ws: "rapport", ws_says: ["levering"] })[0].s).toBe("good"));
  it("uten rapport: nøytral, og sier om svarene står i brevet", () => {
    expect(wsFactors({ ws: "uten", ws_says: ["bekrefter"] })[0]).toMatchObject({ s: "info", t: "Verkstedet har sett på feilen" });
    expect(wsFactors({ ws: "uten", ws_says: ["bekrefter"] })[0].d).toContain("står i brevet");
    expect(wsFactors({ ws: "uten", ws_says: [] })[0].d).toContain("Kryss av");
  });
  it("selger opplyste om feilen før 2024: rødt (gamle § 16 tredje ledd)", () => expect(wsFactors({ seller_said: "opplyste", c_purchase: "2023-06-01" }).some((f) => f.s === "bad")).toBe(true));
  it("selger opplyste om feilen fra 2024: gult, bare et avtalt unntak teller (§ 15 annet ledd)", () => {
    const f = wsFactors({ seller_said: "opplyste", c_delivery: "2024-06-01" }).find((x) => x.t === "Selger opplyste om feilen")!;
    expect(f.s).toBe("warn");
    expect(f.d).toContain("spesielt opplyst om akkurat dette avviket og uttrykkelig godtok det");
    expect(f.law).toBe("forbrkjl. § 15 annet ledd");
  });
});

describe("dato og lov", () => {
  it("regler før og etter 2024", () => {
    expect(regler("2023-12-31").formodningMnd).toBe(6);
    expect(regler("2024-01-01").formodningMnd).toBe(24);
    expect(regler(null).versjon).toBe("etter_2024");
    expect(regler("2023-05-01").ref("forbehold")).toBe("forbrkjl. § 17 første ledd bokstav a");
  });
  it("dur og relText", () => {
    expect(dur(parseD("2026-01-01")!, parseD("2026-03-15")!)).toBe("to måneder");
    expect(relText("2026-03-15", "2026-01-01")).toBe("2 måneder og 2 uker etter overtakelsen");
    expect(relText("2025-12-01", "2026-01-01")).toBe("Før overtakelsen");
  });
});

describe("rettinger etter gjennomgangen", () => {
  it("#1 skriveren bruker kjøpsdatoen for lovversjonen", () => {
    const s = { ...eksempel(idag), c_purchase: "2023-12-20", c_delivery: "2024-01-05", c_asis: true };
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2024-10-01" } };
    const r = skriverResultat(syncAreas(s), idag);
    expect(r.factors.some((f) => f.t.startsWith("Mer enn seks måneder"))).toBe(true);
    expect(r.factors.find((f) => f.t === "Solgt «som den er»")?.law).toBe("forbrkjl. § 17 første ledd bokstav a");
  });
  it("#2 «som den er» fra 2024 er ikke et avtalt unntak, uten «vesentlig»", () => {
    const f = evaluate({ ...base, asis: "ja", delivery: "2024-06-01", found: "2024-07-01" }, idag).factors.find((x) => x.t === "Solgt «som den er»")!;
    expect(f.s).toBe("info");
    expect(f.d).not.toContain("vesentlig");
    expect(f.d).toContain("spesielt opplyst");
  });
  it("#3 seks måneder telles i kalendermåneder", () => {
    expect(evaluate({ ...base, delivery: "2023-01-31", found: "2023-08-01" }, idag).factors.some((f) => f.t.startsWith("Mer enn seks måneder"))).toBe(true);
    expect(evaluate({ ...base, delivery: "2023-01-31", found: "2023-07-31" }, idag).factors.some((f) => f.t === "Feilen viste seg innen seks måneder")).toBe(true);
  });
});

describe("tidslinjen i vurderingen", () => {
  it("sa fra før feilen ble oppdaget", () => expect(evaluate({ ...base, delivery: "2026-06-01", found: "2026-09-01", notified: "ja", notifiedDate: "2026-08-01" }, idag).factors.some((f) => f.t === "Sjekk datoene")).toBe(true));
  it("dato frem i tid", () => expect(evaluate({ ...base, delivery: "2026-06-01", found: "2026-12-01" }, idag).factors.some((f) => f.t === "Sjekk datoene")).toBe(true));
  it("én av flere feil utenfor formodningen", () => expect(evaluate({ ...base, delivery: "2023-03-01", found: "2023-05-01", sist: "2024-01-15" }, idag).factors.some((f) => f.t === "Én av feilene viste seg senere")).toBe(true));
});

describe("brukertesten", () => {
  it("over to år: «Mer enn to år»", () => expect(evaluate({ ...base, delivery: "2022-09-01", found: "2025-10-01" }, idag).factors.some((f) => f.t === "Mer enn to år etter overtakelsen")).toBe(true));
  it("fristen ute: ikke samtidig «Du er i tide»", () => {
    const r = evaluate({ ...base, delivery: "2021-02-01", found: "2026-09-01" }, idag);
    expect(r.factors.some((f) => f.t === "Fristen er ute")).toBe(true);
    expect(r.factors.some((f) => f.t === "Du er i tide")).toBe(false);
  });
  it("fristen ute når reklamasjonen kommer etter fem år, selv om feilen viste seg før", () =>
    expect(evaluate({ ...base, delivery: "2021-09-01", found: "2026-08-01" }, idag).factors.some((f) => f.t === "Fristen er ute")).toBe(true));
  it("feil i det selgeren opplyste: ingen formodning", () => {
    const r = evaluate({ ...base, delivery: "2026-03-01", found: "2026-06-01", opplysning: true }, idag);
    expect(r.factors.some((f) => f.t.startsWith("Feilen viste seg innen"))).toBe(false);
    expect(r.factors.some((f) => f.t === "Bilen var ikke som selgeren opplyste")).toBe(true);
  });
});

describe("kanttilfeller", () => {
  it("uten datoer: foreløpig, ikke «Mulig sak»", () => {
    const r = evaluate({ seller: "forhandler" }, idag);
    expect(r.tier).toBe("ukjent");
    expect(r.badge).toBe("Foreløpig");
  });
  it("dato frem i tid: ingen konklusjoner om frister", () => {
    const r = evaluate({ ...base, delivery: "2026-06-01", found: "2027-01-01" }, idag);
    expect(r.factors.some((f) => f.t === "Sjekk datoene")).toBe(true);
    expect(r.factors.some((f) => /innen to år|Du er i tide/.test(f.t))).toBe(false);
  });
});

describe("nivået fra vektene", () => {
  const innen = { ...base, delivery: "2026-06-01", found: "2026-10-01" } as const;
  const etter = { ...base, delivery: "2022-09-01", found: "2025-10-01", notified: "ja", notifiedDate: "2025-10-10" } as const;
  it("selger lovet at bilen var fri for slike feil: sterk", () => expect(evaluate({ ...innen, seller_said: "lovet" }, idag).tier).toBe("sterk"));
  it("én av flere feil i det selgeren opplyste: sterk", () => {
    const r = evaluate({ ...innen, noenOpplysning: true, fysiske: ["motor"] }, idag);
    expect(r.tier).toBe("sterk");
    expect(har(r, "En av feilene gjelder det selgeren opplyste")).toBe(true);
  });
  it("«lovet» teller ikke to ganger når feilen alt gjelder det selgeren opplyste", () =>
    expect(evaluate({ ...innen, opplysning: true, seller_said: "lovet" }, idag).factors.reduce((n, f) => n + (f.w ?? 0), 0)).toBe(2));
  it("etter formodningen: krever mer, og en rapport om levering veier opp", () => {
    expect(evaluate({ ...etter, fysiske: ["motor"] }, idag).tier).toBe("kreverMer");
    expect(evaluate({ ...etter, fysiske: ["motor"], ws: "rapport", ws_says: ["levering"] }, idag).tier).toBe("god");
  });
  it("etter formodningen uten rapport: be om rapport, ingen vekt", () => {
    const f = evaluate({ ...etter, ws: "nei" }, idag).factors.find((x) => x.t === "Få en verkstedrapport før du sender")!;
    expect(f.s).toBe("warn");
    expect(f.w).toBeUndefined();
  });
  it("etter formodningen, rapport uten levering eller slitasje: be verkstedet skrive det", () =>
    expect(har(evaluate({ ...etter, ws: "rapport", ws_says: ["bekrefter"] }, idag), "Be verkstedet skrive om feilen fantes ved leveringen")).toBe(true));
  it("bare understell: slitasje trekker ned, rapporten om at det ikke er slitasje fjerner det", () => {
    expect(evaluate({ ...innen, fysiske: ["understell"] }, idag).tier).toBe("kreverMer");
    const r = evaluate({ ...innen, fysiske: ["understell"], ws: "rapport", ws_says: ["ikke_slitasje"] }, idag);
    expect(r.tier).toBe("god");
    expect(har(r, "Verkstedet sier at feilen ikke er slitasje")).toBe(true);
  });
  it("understell sammen med motor: raden står, uten vekt", () => {
    const f = evaluate({ ...innen, fysiske: ["understell", "motor"] }, idag).factors.find((x) => x.t === "Forhandleren kan si at det er slitasje")!;
    expect(f.w).toBe(0);
  });
  it("forhandleren har sagt slitasje: står i raden", () =>
    expect(evaluate({ ...innen, fysiske: ["understell"], f_prior_svar: ["slitasje"] }, idag).factors.find((x) => x.t === "Forhandleren kan si at det er slitasje")!.d).toContain("har alt sagt"));
  it("vet ikke ennå: krever mer", () => expect(evaluate({ ...innen, fysiske: ["vet_ikke"] }, idag).tier).toBe("kreverMer"));
  it("mislykket retting: én etter 2024, to før", () => {
    expect(har(evaluate({ ...innen, k_forsok: "1" }, idag), "Forhandleren har ikke klart å rette feilen")).toBe(true);
    expect(har(evaluate({ ...base, delivery: "2023-03-01", found: "2023-05-01", k_forsok: "1" }, idag), "Ett rettingsforsøk har ikke løst feilen")).toBe(true);
    expect(evaluate({ ...base, delivery: "2023-03-01", found: "2023-05-01", notified: "ja", notifiedDate: "2023-05-10", k_forsok: "2+" }, idag).tier).toBe("sterk");
  });
  it("innvendinger fra forhandleren: brevet svarer", () => expect(har(evaluate({ ...innen, f_prior_svar: ["for_sent"] }, idag), "Brevet svarer på det forhandleren har sagt")).toBe(true));
  it("sen reklamasjon og «som den er» flytter ikke nivået", () =>
    expect(evaluate({ ...base, delivery: "2023-03-01", found: "2023-05-01", asis: "ja", notified: "ja", notifiedDate: "2023-09-01" }, idag).tier).toBe("god"));
});

describe("fristen på fem år", () => {
  const ute = { ...base, delivery: "2020-01-01", found: "2026-01-01" } as const;
  it("uten unntak: normalt ingen sak, med rådene", () => {
    const r = evaluate(ute, idag);
    expect(r.tier).toBe("frist");
    expect(r.badge).toBe("Normalt ingen sak");
    expect(r.advice?.length).toBeGreaterThan(0);
    expect(har(r, "Fristen er ute")).toBe(true);
  });
  it("med unntak: vanlig vurdering, raden sier hva kjøperen må vise", () => {
    const r = evaluate({ ...ute, unntak: true }, idag);
    expect(r.tier).toBe("kreverMer");
    expect(r.factors.find((f) => f.t === "Fristen er ute")!.d).toContain("du må kunne vise det");
  });
  it("med unntak: feilen viste seg sent, så raden om rapporten og lignende saker kommer med", () => {
    const r = evaluate({ ...ute, unntak: true, ws: "nei" }, idag);
    expect(har(r, "Få en verkstedrapport før du sender")).toBe(true);
    const c = { hoved: "motor", tema: "motor", niva: 3, saker: 65, medhold: 16, avslag: null, avslagAntall: 0 } as const;
    expect(medCelle(r, c).factors.some((f) => f.t === "Slik gikk lignende saker")).toBe(true);
  });
  it("skriveren tar med unntaket fra skjemaet", () => {
    const s = syncAreas({ ...eksempel(idag), c_purchase: "2020-01-01", c_delivery: "2020-01-01", c_unntak: true });
    expect(skriverResultat(s, idag).tier).not.toBe("frist");
  });
});

describe("tekstene", () => {
  const niva = (q: Parameters<typeof evaluate>[0]) => evaluate(q, idag);
  const sterk = niva({ ...base, delivery: "2026-06-01", found: "2026-10-01", opplysning: true });
  const god = niva({ ...base, delivery: "2026-06-01", found: "2026-10-01" });
  const mer = niva({ ...base, delivery: "2022-09-01", found: "2025-10-01" });
  it("bare nivåene over 50 % sier «trolig», og ingen lover et utfall eller har prosent", () => {
    for (const r of [sterk, god]) expect(r.title).toMatch(/trolig/);
    expect(`${mer.title} ${mer.summary}`).not.toMatch(/trolig/);
    for (const r of [sterk, god, mer]) expect(`${r.title} ${r.summary}`).not.toMatch(/%|vinner|garantert/);
  });
  it("merkelappene og overskriftene", () => {
    expect([sterk.badge, god.badge, mer.badge]).toEqual(["Sterk sak", "God sak", "Krever mer"]);
    expect([sterk.title, god.title, mer.title]).toEqual(["Du har trolig en sterk sak", "Du har trolig en god sak", "Saken din kan være krevende"]);
  });
});

describe("lignende saker i vurderingen", () => {
  const c = { hoved: "elektrisk", tema: "elektriske feil", niva: 2, saker: 61, medhold: 10, avslag: "ikke_sannsynliggjort_ved_levering", avslagAntall: 30 } as const;
  it("tallene og grunnen, i antall", () => {
    const f = celleFaktor(c);
    expect(f.d).toContain("I 61 saker om elektriske feil");
    expect(f.d).toContain("medhold i 10");
    expect(f.d).toContain("(30 av 51)");
    expect(f.d).not.toContain("%");
  });
  it("en grunn uten tekst gir bare tallene", () => expect(celleFaktor({ ...c, avslag: "annet" }).d).not.toContain("vanligste grunnen"));
  it("står etter raden om når feilen viste seg, bare når den viste seg sent", () => {
    const sent = medCelle(evaluate({ ...base, delivery: "2023-03-01", found: "2024-01-01" }, idag), c);
    const i = sent.factors.findIndex((f) => f.t.startsWith("Mer enn "));
    expect(sent.factors[i + 1].t).toBe("Slik gikk lignende saker");
    expect(medCelle(evaluate({ ...base, delivery: "2026-06-01", found: "2026-10-01" }, idag), c).factors.some((f) => f.t === "Slik gikk lignende saker")).toBe(false);
  });
});

describe("styrkebaren", () => {
  it("hvert nivå har sin tredjedel, og vektene flytter markøren innenfor den", () => {
    const mer = styrke({ tier: "kreverMer", poeng: -1 })!,
      god0 = styrke({ tier: "god", poeng: 0 })!,
      god1 = styrke({ tier: "god", poeng: 1 })!,
      sterk = styrke({ tier: "sterk", poeng: 2 })!;
    expect(mer).toBeLessThan(1 / 3);
    expect([god0, god1].every((x) => x > 1 / 3 && x < 2 / 3)).toBe(true);
    expect(god0).toBeLessThan(god1);
    expect(sterk).toBeGreaterThan(2 / 3);
    expect(styrke({ tier: "sterk", poeng: 9 })).toBeLessThan(1);
    expect(styrke({ tier: "kreverMer", poeng: -9 })).toBeGreaterThan(0);
  });
  it("uten vurdering og utenfor: ingen markør; fristen ute: helt til venstre", () => {
    expect(styrke({ tier: "ukjent" })).toBeNull();
    expect(styrke({ tier: "utenfor" })).toBeNull();
    expect(styrke({ tier: "frist" })).toBeLessThan(0.05);
  });
  it("vurderingen gir summen av vektene", () => expect(evaluate({ ...base, delivery: "2026-06-01", found: "2026-10-01", opplysning: true }, idag).poeng).toBe(2));
});

describe("sen reklamasjon", () => {
  const rad = (r: ReturnType<typeof evaluate>, t: string) => r.factors.find((f) => f.t === t);
  it("sen første reklamasjon: rad med vekt", () => {
    const r = evaluate({ ...base, delivery: "2022-05-14", found: "2023-02-10" }, idag);
    expect(rad(r, "Reklamasjonen kommer sent")).toMatchObject({ s: "bad", w: -2, law: "forbrkjl. § 27 fjerde ledd" });
  });
  it("mellom to og seks måneder: advarsel uten vekt", () => expect(rad(evaluate({ ...base, delivery: "2026-01-10", found: "2026-06-01" }, idag), "Det har gått mer enn to måneder")?.w).toBeUndefined());
  it("innen to måneder: ingen av radene", () => {
    const r = evaluate({ ...base, delivery: "2026-01-10", found: "2026-09-01" }, idag);
    expect(rad(r, "Reklamasjonen kommer sent") ?? rad(r, "Det har gått mer enn to måneder")).toBeUndefined();
  });
  it("sen reklamasjon trekker ned et nivå", () => expect(evaluate({ ...base, delivery: "2022-05-14", found: "2023-02-10", opplysning: true }, idag).tier).toBe("god"));
});

describe("ordlyd i vurderingen", () => {
  it("foreløpig til begge datoene er inne", () => {
    expect(evaluate({ ...base, delivery: "2026-06-01" }, idag).tier).toBe("ukjent");
    expect(evaluate({ ...base, found: "2026-06-01" }, idag).tier).toBe("ukjent");
  });
  it("ett forsøk etter 2024: entall", () =>
    expect(evaluate({ ...base, delivery: "2025-01-10", found: "2025-03-01", notified: "ja", notifiedDate: "2025-03-05", k_forsok: "1" }, idag).factors.find((f) => f.t === "Forhandleren har ikke klart å rette feilen")?.d).toContain("Etter det mislykkede forsøket"));
});
