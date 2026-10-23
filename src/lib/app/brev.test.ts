import { describe, expect, it } from "vitest";
import { LOVSETNING } from "@/lib/vedtaksvalg/valg";
import { byggBrev, emne, tilTekst } from "./brev";
import type { Blokk, Presedens } from "./brevtyper";
import { docsValg, eksempel, standard, svarToggle, syncAreas, vedlegg } from "./skjema";

const idag = "2026-10-16";
const PRES: Presedens = {
  id: 1,
  saksnummer: "52074",
  vedtaksdato: "2025-11-24",
  bil: "Peugeot 308 fra 2014",
  utfall: ["heving"],
  avsnitt: "Forbrukerklageutvalget kom i sak 52074 til at bilen hadde en mangel.",
  kildeUrl: "https://example.org/v.pdf",
  utvalg: "Forbrukerklageutvalget",
  anbefalt: true,
  niva: "A",
  gjaldt: "turbo",
  km: 150000,
  alder: 9,
  somDenEr: false,
  likhet: 80,
  treff: {} as Presedens["treff"],
};
const tekst = (s: ReturnType<typeof eksempel>, p: Presedens | null = null) => tilTekst(byggBrev(syncAreas(s), p, idag));

describe("brevet", () => {
  it("eksempelbrevet", () => expect(tekst(eksempel(idag), PRES)).toMatchSnapshot());

  it("tomt skjema gir plassholdere", () => {
    const t = tekst(standard(idag));
    for (const p of ["[Ditt navn]", "[Forhandlerens navn]", "[reg.nr.]", "[kjøpsdato]", "[kjøpesum]"]) expect(t).toContain(p);
  });

  it("før 2024: seks måneder og § 17", () => {
    const s = { ...eksempel(idag), c_purchase: "2023-12-31", c_delivery: "2023-12-31", c_asis: true };
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2024-03-01" } };
    const t = tekst(s);
    expect(t).toContain("seks måneder");
    expect(t).toContain("§ 17 første ledd bokstav a");
    expect(t).not.toContain("innen to år etter leveringen");
  });

  it("fra 2024: to år", () => {
    const s = { ...eksempel(idag), c_purchase: "2024-01-01", c_delivery: "2024-01-01" };
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2024-05-01" } };
    expect(tekst(s)).toContain("innen to år etter leveringen");
  });

  it("vedtaksavsnittet og lenken", () => {
    const t = tekst(eksempel(idag), PRES);
    expect(t).toContain("Praksis fra Forbrukerklageutvalget");
    expect(t).toContain(PRES.avsnitt);
    expect(t).toContain(PRES.kildeUrl!);
  });

  it("uten kandidat: lovsetningen", () => expect(tekst(eksempel(idag))).toContain(LOVSETNING));

  it("kjøpsdatoen bare når den er en annen enn overtakelsen", () => {
    expect(tekst(eksempel(idag))).toMatch(/Jeg kjøpte bilen \d.* for kr 329 900 og overtok den \d/);
    const s = { ...eksempel(idag), c_purchase: "" };
    expect(tekst(s)).toMatch(/Jeg kjøpte og overtok bilen \d+\. \w+ \d{4} for kr 329 900 med en kilometerstand på 38 500 km\./);
    expect(tekst({ ...s, c_purchase: s.c_delivery })).toContain("Jeg kjøpte og overtok bilen");
  });

  it("feil før overtakelse kaster ikke", () => {
    const s = { ...eksempel(idag), c_delivery: "2026-10-01" };
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2026-09-01" } };
    expect(() => tekst(s)).not.toThrow();
  });

  it("emnefeltet", () => expect(emne(byggBrev(syncAreas(eksempel(idag)), null, idag))).toBe("Reklamasjon på mangel ved Volkswagen ID.4, reg.nr. EL 48213"));
});

describe("rettinger etter gjennomgangen", () => {
  it("#2 «som den er» fra 2024: ikke et avtalt unntak etter § 15 annet ledd", () => {
    const s = { ...eksempel(idag), c_asis: true };
    const t = tekst(s);
    expect(t).toContain("er ikke et avtalt unntak etter forbrukerkjøpsloven § 15 annet ledd");
    expect(t).not.toContain("vesentlig dårligere stand");
  });
  it("#3 ingen formodning en dag etter seks kalendermåneder", () => {
    const s = { ...eksempel(idag), c_purchase: "2023-01-31", c_delivery: "2023-01-31" };
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2023-08-01" } };
    expect(tekst(s)).not.toContain("formodes");
  });
});

describe("tidslinjen i brevet", () => {
  const med = (s: ReturnType<typeof eksempel>, areas: Record<string, string>) => ({
    ...s,
    f_cats: Object.keys(areas),
    f_area: Object.fromEntries(Object.entries(areas).map(([c, found]) => [c, { found }])),
    f_parts: {},
    f_catdesc: {},
  });
  it("to feil, én innenfor og én utenfor formodningen: formodningen nevner bare den ene", () => {
    const s = med({ ...eksempel(idag), c_purchase: "2023-03-01", c_delivery: "2023-03-01" }, { motor: "2023-05-01", klima: "2024-01-15" });
    const t = tekst(s);
    expect(t).toContain("Feilen ved motoren viste seg");
    expect(t).toContain("at denne feilen ikke var til stede");
    expect(t).not.toContain("Feilen viste seg 2 måneder");
  });
  it("to feil innenfor: flertall", () => {
    const s = med({ ...eksempel(idag), c_purchase: "2025-03-01", c_delivery: "2025-03-01" }, { motor: "2025-05-01", klima: "2025-09-01" });
    expect(tekst(s)).toContain("at feilene ikke var til stede");
  });
  it("feil oppdaget mer enn fem år etter overtakelsen: ingen påstand om femårsfristen", () => {
    const s = med({ ...eksempel(idag), c_purchase: "2020-01-01", c_delivery: "2020-01-01" }, { motor: "2025-06-01" });
    expect(tekst(s)).not.toContain("reklamasjonsfristen er derfor fem år");
  });
  it("før 2024: «som den er» uten halen om tilbakeholdte opplysninger", () => {
    const s = { ...eksempel(idag), c_purchase: "2023-06-01", c_delivery: "2023-06-01", c_asis: true };
    expect(tekst(s)).not.toContain("unnlatt å opplyse");
  });
  it("mens vedtaket hentes: plassholder i stedet for lovsetningen", () => {
    const t = tilTekst(byggBrev(syncAreas(eksempel(idag)), "venter", idag));
    expect(t).toContain("[lignende sak hentes]");
    expect(t).not.toContain(LOVSETNING);
  });
});

describe("brukertesten", () => {
  const en = (s: ReturnType<typeof eksempel>, c: string, under: string[], found: string) => ({ ...s, f_cats: [c], f_parts: { [c]: under }, f_area: { [c]: { found } }, f_catdesc: {} });
  it("påstår ikke «innen rimelig tid» når det har gått mer enn to måneder", () => {
    const s = en({ ...eksempel(idag), c_purchase: "2023-03-01", c_delivery: "2023-03-01", f_prior: false }, "drivlinje", ["girkasse"], "2023-11-15");
    expect(tekst(s)).not.toContain("Reklamasjonen er fremsatt");
  });
  it("feil i det selgeren opplyste: ingen formodning", () => {
    const s = en({ ...eksempel(idag), c_purchase: "2026-03-01", c_delivery: "2026-03-01" }, "historikk", ["km"], "2026-06-01");
    expect(tekst(s)).not.toContain("formodes");
  });
  it("garanti ikke som lovet: ingen formodning", () => {
    const s = en({ ...eksempel(idag), c_purchase: "2025-11-01", c_delivery: "2025-11-01" }, "garanti", [], "2026-02-01");
    expect(tekst(s)).not.toContain("formodes");
  });
  it("erstatning uten utgifter: plassholder", () => expect(tekst({ ...eksempel(idag), k_exp: true, exp: [] })).toContain("[legg til utgiftene]"));
});

describe("plassholdere", () => {
  it("manglende reg.nr. ser ikke ut som et ekte skilt", () => {
    const t = tekst({ ...eksempel(idag), c_reg: "" });
    expect(t).toContain("[reg.nr.]");
    expect(t).not.toContain("AB 12345");
  });
});

describe("vedleggslisten", () => {
  it("rapporten som er krysset av, følger vedlagt og står i listen", () => {
    const s = { ...eksempel(idag), f_docs: ["kontrakt", "verksted"] };
    const t = tekst(s);
    expect(t).toContain("Verkstedrapporten, som følger vedlagt,");
    expect(vedlegg(s)).toEqual(["Kjøpekontrakt", "Verkstedrapport", "Kvitteringer for utgifter"]);
    expect(t).toContain("\n2. Verkstedrapport");
  });
  it("rapporten som ikke er krysset av, sies ikke å følge vedlagt", () => {
    const s = { ...eksempel(idag), f_docs: ["kontrakt"] };
    const t = tekst(s);
    expect(t).toContain("Verkstedrapporten bekrefter feilen");
    expect(t).not.toContain("vedlagt");
    expect(vedlegg(s)).not.toContain("Verkstedrapport");
  });
  it("uten rapport kan den ikke krysses av", () => {
    const s = { ...eksempel(idag), ws: "uten", f_docs: ["verksted"], k_exp: false };
    expect(vedlegg(s)).toEqual([]);
    expect(docsValg(s).map(([id]) => id)).not.toContain("verksted");
    expect(docsValg(eksempel(idag)).map(([id]) => id)).toContain("verksted");
  });
  it("uten rapport: det verkstedet sa, som det ble sagt, og hvor det kan bekreftes", () => {
    const t = tekst({ ...eksempel(idag), ws: "uten", ws_says: ["bekrefter", "levering", "ikke_slitasje"], ws_quote: "En battericelle er defekt" });
    expect(t).toContain("Volkswagen Sandvika har undersøkt bilen. Verkstedet har bekreftet feilen og opplyst meg om at feilen var til stede ved leveringen og at den ikke skyldes normal slitasje.");
    expect(t).toContain("Slik jeg oppfattet verkstedet: En battericelle er defekt. Dere kan kontakte verkstedet for å få dette bekreftet.");
    expect(t).toContain("Verkstedet har opplyst at feilen ikke skyldes normal slitasje, og formodningen er derfor ikke uforenlig");
    expect(t).not.toContain("rapport");
  });
  it("uten rapport og uten svar: bare at bilen er undersøkt", () => {
    const t = tekst({ ...eksempel(idag), ws: "uten", ws_says: [], ws_quote: "" });
    expect(t).toContain("Volkswagen Sandvika har undersøkt bilen.");
    expect(t).not.toContain("kontakte verkstedet");
  });
  it("kvitteringene følger et erstatningskrav med utgifter", () => {
    expect(vedlegg({ ...eksempel(idag), f_docs: [] })).toContain("Kvitteringer for utgifter");
    expect(vedlegg({ ...eksempel(idag), f_docs: [], exp: [] })).not.toContain("Kvitteringer for utgifter");
  });
});

describe("konsekvensen", () => {
  const med = (f_impact: string[]) => ({ ...eksempel(idag), f_impact });
  it("«påvirker bruken» sies konkret når bilen ellers kan brukes", () => expect(tekst(med(["bruk"]))).toContain("\n\nKonsekvensen av feilen er at jeg merker det under kjøring og må begrense bruken av bilen.\n\n"));
  it("«påvirker bruken» utelates når setningen før alt sier at bilen bare kan brukes delvis", () => {
    const t = tekst(med(["palitelig", "bruk"]));
    expect(t).toContain("Konsekvensen av feilen er at jeg ikke kan stole på bilen og bare kan bruke den i begrenset grad.");
    expect(t).not.toContain("merker det under kjøring");
  });
  it("sikkerhet nevnes fortsatt sammen med delvis bruk", () => expect(tekst(med(["palitelig", "sikkerhet"]))).toContain("Konsekvensen av feilen er at bilens sikkerhet er svekket og at jeg ikke kan stole på bilen og bare kan bruke den i begrenset grad."));
});

describe("renter", () => {
  it("heving: renter fra reklamasjonsdagen etter § 50 annet ledd (kjøp fra 2024)", () => {
    const t = tekst({ ...eksempel(idag), k_main: "heving" });
    expect(t).toContain("med tillegg av renter etter forsinkelsesrenteloven fra den dag jeg reklamerte, 4. oktober 2026, jf. § 50 annet ledd");
  });
  it("heving uten tidligere kontakt: brevets dato", () => {
    const t = tekst({ ...eksempel(idag), k_main: "heving", f_prior: false });
    expect(t).toContain("fra den dag jeg reklamerte, 16. oktober 2026, jf. § 50 annet ledd");
  });
  it("kjøp før 2024: renter kreves, men uten startdag", () => {
    const s = { ...eksempel(idag), k_main: "heving", c_purchase: "2023-06-01", c_delivery: "2023-06-01" };
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2023-08-01" } };
    const t = tekst(s);
    expect(t).toContain("med tillegg av renter etter forsinkelsesrenteloven, jf. § 50 annet ledd");
    expect(t).not.toContain("fra den dag jeg reklamerte");
  });
  it("subsidiær heving nevner også rentene", () => expect(tekst(eksempel(idag))).toContain("med tillegg av renter etter forsinkelsesrenteloven"));
  it("prisavslag og erstatning: forsinkelsesrente ved forsinket betaling", () => {
    const t = tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "30 000" });
    expect(t).toContain("Ved forsinket betaling kreves forsinkelsesrente etter forsinkelsesrenteloven § 2.");
    expect(tekst({ ...eksempel(idag), k_exp: false })).not.toContain("forsinkelsesrenteloven § 2");
  });
});

describe("begrunnelsen for heving", () => {
  const hev = (ekstra: Partial<ReturnType<typeof eksempel>> = {}) => ({ ...eksempel(idag), k_main: "heving", ...ekstra });
  it("kostnad mot kjøpesum, forsøk, bruk, verksted og løfte, deretter konklusjonen", () => {
    const s = hev({ k_cost: "85 000", k_forsok: "2", ws_says: ["bekrefter", "frarader"] });
    s.f_impact = ["stopp", "sikkerhet"];
    const t = tekst(s);
    expect(t).toContain(
      "Jeg hever kjøpet, jf. § 32. Mangelen er ikke uvesentlig: utbedringen er anslått til kr 85 000, som utgjør 26 % av kjøpesummen, dere har forsøkt å rette feilen to ganger uten å lykkes, bilen kan ikke brukes, feilen går ut over sikkerheten, verkstedet fraråder videre bruk og bilen avviker fra det dere uttrykkelig opplyste før kjøpet. Det er dere som har bevisbyrden for at mangelen er uvesentlig. Etter de mislykkede rettingsforsøkene kan jeg avvise videre retting, jf. § 30 fjerde ledd.",
    );
    expect(t).not.toContain("Jeg krever å heve");
  });
  it("ett forsøk fra 2024: forbrukeren kan avvise videre retting (§ 30 fjerde ledd), kostnaden nevnes ikke", () => {
    const t = tekst(hev({ k_cost: "9 000", k_forsok: "1", seller_said: "nei" }));
    expect(t).toContain("dere har forsøkt å rette feilen uten å lykkes");
    expect(t).toContain("Etter det mislykkede rettingsforsøket kan jeg avvise videre retting, jf. § 30 fjerde ledd.");
    expect(t).toContain("Jeg hever kjøpet, jf. § 32.");
    expect(t).not.toContain("Jeg er kjent med at dere kan tilby å rette");
    expect(t).not.toContain("anslått til");
  });
  it("før 2024: ett forsøk er ikke nok, to gir gamle § 30 annet ledd, og bevisbyrden nevnes ikke", () => {
    const s = hev({ k_forsok: "1", seller_said: "nei", c_purchase: "2023-06-01", c_delivery: "2023-06-01" });
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2023-08-01" } };
    const t = tekst(s);
    expect(t).toContain("ett rettingsforsøk har ikke løst feilen");
    expect(t).toContain("Jeg er kjent med at dere kan tilby å rette mangelen, dersom det skjer uten opphold, jf. § 29 tredje ledd.");
    expect(t).not.toContain("bevisbyrden for at mangelen er uvesentlig");
    const t2 = tekst({ ...s, k_forsok: "2" });
    expect(t2).toContain("Etter de mislykkede rettingsforsøkene har dere ikke lenger rett til å rette, jf. § 30 annet ledd.");
    expect(t2).not.toContain("Jeg er kjent med at dere kan tilby å rette");
  });
  it("«3+» skrives som tre eller flere ganger", () => expect(tekst(hev({ k_forsok: "3+" }))).toContain("tre eller flere ganger"));
  it("«2+» skrives som to eller flere ganger og gir tapt rett til retting", () => {
    const t = tekst(hev({ k_forsok: "2+" }));
    expect(t).toContain("dere har forsøkt å rette feilen to eller flere ganger uten å lykkes");
    expect(t).toContain("Jeg hever kjøpet");
  });
  it("uten rettingsforsøk: kravet om heving fremmes, og selgerens rett til å rette erkjennes (§ 29 tredje ledd)", () => {
    const s = hev({ seller_said: "nei" });
    s.f_impact = ["plagsom"];
    const t = tekst(s);
    expect(t).toContain("Jeg krever å heve kjøpet, jf. § 32, fordi mangelen ikke er uvesentlig.");
    expect(t).toContain("Jeg er kjent med at dere kan tilby å rette mangelen, jf. § 29 tredje ledd. Rettingen må i så fall skje uten kostnad, uten vesentlig ulempe for meg og innen rimelig tid, jf. § 30 første ledd. Skjer ikke det, fastholder jeg kravet om heving.");
    expect(t).toContain("Bilen kan stilles til rådighet for undersøkelse og retting etter nærmere avtale, jf. § 30 annet ledd.");
  });
  it("alvorlig mangel fra 2024: heving med en gang etter § 29 tredje ledd tredje punktum", () => {
    const s = hev({ seller_said: "nei" });
    s.f_impact = ["sikkerhet"];
    const t = tekst(s);
    expect(t).toContain("Jeg hever kjøpet, jf. § 32. Mangelen er ikke uvesentlig: feilen går ut over sikkerheten.");
    expect(t).toContain("Mangelen er etter sin art så alvorlig at det ikke er rimelig å forvente at jeg skal godta et tilbud om avhjelp, jf. § 29 tredje ledd tredje punktum.");
    expect(t).not.toContain("Jeg er kjent med at dere kan tilby å rette");
    expect(t).toContain("Bilen kan stilles til rådighet for undersøkelse etter nærmere avtale");
  });
  it("alvorlig mangel før 2024: ingen umiddelbar heving, selgeren kan tilby retting", () => {
    const s = hev({ seller_said: "nei", c_purchase: "2023-06-01", c_delivery: "2023-06-01" });
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2023-08-01" } };
    s.f_impact = ["sikkerhet"];
    const t = tekst(s);
    expect(t).not.toContain("så alvorlig");
    expect(t).toContain("dersom det skjer uten opphold");
    expect(t).toContain("Bilen kan stilles til rådighet for undersøkelse og retting etter nærmere avtale.");
  });
  it("prisavslag uten forsøk: selgerens rett til å rette erkjennes", () => {
    const t = tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "30 000" });
    expect(t).toContain("Skjer ikke det, fastholder jeg kravet om prisavslag.");
  });
  it("subsidiær heving får samme grunner", () => {
    const t = tekst({ ...eksempel(idag), k_forsok: "2" });
    expect(t).toContain("krever jeg subsidiært å heve kjøpet, jf. § 32.");
    expect(t).toContain("dere har forsøkt å rette feilen to ganger");
  });
  it("prisavslag nevner overslaget", () =>
    expect(tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "30 000", k_cost: "35 000" })).toContain("Jeg krever et forholdsmessig prisavslag på kr 30 000, jf. § 31, basert på et overslag over utbedringskostnaden på kr 35 000."));
});

describe("lånebil etter lovversjon", () => {
  it("fra 2024: et moment etter § 30 første ledd annet punktum", () =>
    expect(tekst(eksempel(idag))).toContain("skal det blant annet legges vekt på om dere stiller en erstatningsbil til rådighet, jf. § 30 første ledd annet punktum."));
  it("før 2024: en rett når rettingen tar mer enn en uke (gamle § 30 tredje ledd)", () => {
    const s = { ...eksempel(idag), c_purchase: "2023-06-01", c_delivery: "2023-06-01" };
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2023-08-01" } };
    expect(tekst(s)).toContain("Vil rettingen medføre at jeg i mer enn en uke blir avskåret fra å bruke bilen, ber jeg om at dere stiller en erstatningsbil til rådighet for deres regning, jf. § 30 tredje ledd.");
  });
});

describe("unntaket fra formodningen", () => {
  it("besvares når verkstedet har utelukket slitasje", () =>
    expect(tekst(eksempel(idag))).toContain("Verkstedrapporten fastslår at feilen ikke skyldes normal slitasje, og formodningen er derfor ikke uforenlig med varens eller mangelens art, jf. § 18 annet ledd tredje punktum."));
  it("nevnes ikke uten slik rapport", () => expect(tekst({ ...eksempel(idag), ws_says: ["bekrefter"] })).not.toContain("uforenlig"));
});

describe("forhandlerens svar", () => {
  const svar = (f_prior_svar: string[], ekstra: Partial<ReturnType<typeof eksempel>> = {}) => tekst({ ...eksempel(idag), f_prior_svar, ...ekstra });
  it("svarene står i et eget avsnitt om kontakten", () =>
    expect(svar(["slitasje", "garanti_ute"])).toContain("\n\nJeg kontaktet dere 4. oktober 2026 og opplyste om feilen. Dere svarte at feilen skyldes slitasje eller feil bruk og at garantien er utløpt.\n\n"));
  it("avvist sammen med et annet svar", () => {
    expect(svar(["avvist"])).toContain("Dere avviste reklamasjonen uten begrunnelse.");
    expect(svar(["avvist", "garanti_ute"])).toContain("Dere avviste reklamasjonen og svarte at garantien er utløpt.");
  });
  it("har ikke svart", () => {
    const t = svar(["ikke_svart"]);
    expect(t).toContain("Jeg har tidligere reklamert på mangelen overfor dere, og dette brevet bekrefter og utdyper reklamasjonen");
    expect(t).toContain("Jeg kontaktet dere 4. oktober 2026 og opplyste om feilen. Dere har ikke svart på henvendelsen.");
    expect(t).not.toContain("svarte dere");
  });
  it("motsvarene i ett avsnitt, innledet bare når alle svarene er besvart", () => {
    const t = svar(["produsent", "betaling"]);
    expect(t).toContain("Svarene dere ga, endrer ikke kravet. Kravet mitt retter seg mot dere som selger, jf. § 26.");
    expect(t).toContain("jf. § 35 første ledd. Retting skal skje uten kostnad for meg");
    // Wear outside the presumption and without a report is not answered, so the letter does not say the answers change nothing.
    const s = { ...eksempel(idag), f_prior_svar: ["slitasje", "produsent"], ws_says: ["bekrefter"], c_purchase: "2023-03-01", c_delivery: "2023-03-01" };
    s.f_area = { hoyvolt: { found: "2024-06-01" } };
    expect(tekst(s)).not.toContain("endrer ikke kravet");
  });
  it("«har ikke svart» utelukker svarene og omvendt", () => {
    expect(svarToggle(["slitasje", "avvist"], "ikke_svart", true)).toEqual(["ikke_svart"]);
    expect(svarToggle(["ikke_svart"], "avvist", true)).toEqual(["avvist"]);
  });
  it("slitasje innenfor formodningen", () => expect(svar(["slitasje"])).toContain("Det er dere som må bevise at feilen ikke var til stede ved leveringen, også når dere viser til slitasje eller feil bruk."));
  it("produsent eller importør: § 26 og § 35", () => expect(svar(["produsent"])).toContain("Kravet mitt retter seg mot dere som selger, jf. § 26. Jeg kan gå mot et tidligere salgsledd, men har ingen plikt til det, jf. § 35 første ledd."));
  it("reparasjon mot betaling: uten kostnad", () => expect(svar(["betaling"])).toContain("Retting skal skje uten kostnad for meg, jf. § 30 første ledd."));
  it("garantien er utløpt: § 18 a fjerde ledd", () => expect(svar(["garanti_ute"])).toContain("En garanti «begrenser ikke forbrukerens rettigheter etter loven», jf. § 18 a fjerde ledd."));
  it("for sent: lovens frister når rettidigheten ikke alt er slått fast", () => {
    expect(svar(["for_sent"])).not.toContain("aldri kortere enn to måneder");
    expect(svar(["for_sent"], { f_prior: false, l_date: "2026-12-31" })).not.toContain("aldri kortere");
    const t = svar(["for_sent"], { f_prior_date: "2026-12-30" });
    expect(t).toContain("Fristen for å reklamere er aldri kortere enn to måneder fra jeg oppdaget mangelen, jf. § 27 første ledd.");
  });
  it("«som den er» uten forbehold i kontrakten: § 15 annet ledd uten å si at bilen ble solgt slik", () => {
    const t = svar(["som_den_er"]);
    expect(t).toContain("Et generelt forbehold om at bilen selges «som den er», er ikke et avtalt unntak etter forbrukerkjøpsloven § 15 annet ledd.");
    expect(t).not.toContain("Bilen ble solgt «som den er»");
  });
  it("uten tidligere kontakt teller ikke svarene", () => expect(svar(["produsent"], { f_prior: false })).not.toContain("§ 35"));
});

describe("slutningen etter vedtaket", () => {
  const T = (t: Partial<Presedens["treff"]>) => ({ underkategori: "likt", tidsniva: "likt", km: "likt", alder: "likt", som_den_er: "likt", krav: "likt", egen_vurdering: "likt", grunnlag: "likt", ...t }) as Presedens["treff"];
  const pres = (p: Partial<Presedens>) => ({ ...PRES, treff: T({}), ...p });
  it("nivå A med samme utgangspunkt og samme krav", () => {
    const t = tekst({ ...eksempel(idag), k_main: "heving" }, pres({ utfall: ["heving"] }));
    expect(t).toContain("Saken gjaldt samme type feil som min, og min bil var ikke i et svakere utgangspunkt. Kjøperen fikk der medhold i heving, som er det jeg krever. Min sak bør derfor vurderes på samme måte. Vedtaket er offentlig tilgjengelig på");
  });
  it("strengere på én side: ingen påstand om utgangspunktet", () => {
    const t = tekst(eksempel(idag), pres({ treff: T({ km: "strengere" }), utfall: ["heving"] }));
    expect(t).not.toContain("svakere utgangspunkt");
    expect(t).toContain("Min sak bør derfor vurderes på samme måte.");
  });
  it("kravet nevnes bare når vedtaket ga det", () => {
    expect(tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "1" }, pres({ utfall: ["heving"] }))).not.toContain("som er det jeg krever");
    expect(tekst({ ...eksempel(idag), k_main: "retting" }, pres({ utfall: ["retting"] }))).toContain("Kjøperen fikk der medhold i retting, som er det jeg krever.");
  });
  it("omlevering er ikke et krav i brevet", () => expect(tekst({ ...eksempel(idag), k_main: "omlevering" })).not.toMatch(/omlevering/i));
  it("nivå B: samme rettslige spørsmål", () => expect(tekst(eksempel(idag), pres({ niva: "B" }))).toContain("Vedtaket avgjør det samme rettslige spørsmålet som min sak reiser"));
  it("uten vedtak eller mens det hentes: ingen slutning", () => {
    expect(tekst(eksempel(idag))).not.toContain("vurderes på samme måte");
    expect(tilTekst(byggBrev(syncAreas(eksempel(idag)), "venter", idag))).not.toContain("vurderes på samme måte");
  });
});

describe("feltmerker", () => {
  const deler = (B: Blokk[]) => B.flatMap((b) => ("tekst" in b ? [b.tekst] : "linjer" in b ? b.linjer : "punkter" in b ? b.punkter : b.avsnitt)).flat();
  const felt = (B: Blokk[], k: string) => deler(B).filter((d): d is { felt: string; tekst: string } => typeof d === "object" && "felt" in d && d.felt === k);
  it("kjøperens svar er merket", () => {
    const B = byggBrev(syncAreas(eksempel(idag)), PRES, idag);
    expect(felt(B, "c_km")[0].tekst).toBe("38 500");
    expect(felt(B, "b_name")[0].tekst).toBe("Kari Nordmann");
    expect(felt(B, "c_reg").length).toBeGreaterThan(1);
    expect(felt(B, "f_catdesc.hoyvolt")[0].tekst).toContain("40 kW");
    expect(felt(B, "seller_txt")[0].tekst).toContain("full kapasitet");
  });
  it("ingen tomme merker", () => expect(deler(byggBrev(syncAreas(eksempel(idag)), PRES, idag)).every((d) => typeof d !== "object" || !("felt" in d) || d.felt && d.tekst)).toBe(true));
});

describe("feilene i løpende tekst", () => {
  const to = (catdesc: Record<string, string>, klima = "2025-09-01") => ({
    ...eksempel(idag),
    c_purchase: "2025-03-01",
    c_delivery: "2025-03-01",
    f_cats: ["klima", "motor"],
    f_parts: { motor: ["turbo", "olje"], klima: ["ac"] },
    f_area: { motor: { found: "2025-05-01" }, klima: { found: klima } },
    f_catdesc: catdesc,
    f_impact: ["plagsom"],
  });
  it("ingen kulepunkter: én blokk per feil, etter dato, med «også» fra den andre", () => {
    const B = byggBrev(syncAreas(to({ motor: "Bilen mister trekkraft" })), null, idag);
    expect(B.some((b) => (b.t as string) === "ul")).toBe(false);
    const t = tilTekst(B);
    expect(t).toContain("Den 1. mai 2025 oppdaget jeg feil ved turboen og unormalt oljeforbruk eller oljelekkasje. Bilen mister trekkraft.\n\nDen 1. september 2025 oppdaget jeg også feil ved klimaanlegget (AC).\n\nKonsekvensen av feilene er at bilen er plagsom å bruke i hverdagen.");
  });
  it("samme dag uten beskrivelse: én setning", () => {
    const t = tekst(to({}, "2025-05-01"));
    expect(t).toContain("Den 1. mai 2025 oppdaget jeg feil ved klimaanlegget (AC) og turboen og unormalt oljeforbruk eller oljelekkasje.");
    expect(t).not.toContain("oppdaget jeg også");
  });
  it("«ved» gjentas når et navn har sitt eget «eller»", () => {
    const s = { ...eksempel(idag), f_cats: ["motor"], f_parts: { motor: ["turbo", "registerreim"] }, f_area: { motor: { found: eksempel(idag).f_area.hoyvolt.found } }, f_catdesc: {} };
    expect(tekst(s)).toContain("oppdaget jeg feil ved turboen og ved registerreimen eller registerkjedet.");
  });
  it("feltmerket følger hvert område", () => {
    const B = byggBrev(syncAreas(to({})), null, idag);
    const deler = B.flatMap((b) => ("tekst" in b ? b.tekst : []));
    expect(deler).toContainEqual({ felt: "f_parts.motor", tekst: "turboen" });
    expect(deler).toContainEqual({ felt: "f_parts.klima", tekst: "klimaanlegget (AC)" });
  });
});

describe("avsnittene", () => {
  // Sentences of a paragraph, apart from abbreviations such as «jf.» and «nr.».
  const setninger = (t: string) => t.replace(/\b(jf|nr|reg\.nr|Org\.nr)\./g, "$1").split(/[.!?»](?:\s|$)/).filter((x) => x.trim()).length;
  const deler = (B: Blokk[], fra: string, til: string) => {
    const i = B.findIndex((b) => b.t === "h" && tilTekst([b]) === fra);
    const j = B.findIndex((b, k) => k > i && b.t === "h" && tilTekst([b]).startsWith(til));
    return B.slice(i + 1, j).filter((b) => b.t === "p").map((b) => tilTekst([b]));
  };
  it.each([
    ["eksempelet", eksempel(idag)],
    ["verksted uten rapport", { ...eksempel(idag), ws: "uten", seller_said: "nei", f_prior: false }],
    ["har ikke svart", { ...eksempel(idag), ws: "nei", seller_said: "nei", f_prior_svar: ["ikke_svart"] }],
    ["bare rettidig", { ...eksempel(idag), f_cats: ["historikk"], f_parts: { historikk: ["km"] }, f_area: { historikk: { found: eksempel(idag).f_area.hoyvolt.found } } }],
  ])("ingen avsnitt på én setning i «Mangelen» og «Rettslig grunnlag», bortsett fra konsekvensen: %s", (_, s) => {
    const B = byggBrev(syncAreas(s), PRES, idag);
    for (const p of [...deler(B, "Mangelen", "Rettslig"), ...deler(B, "Rettslig grunnlag", "Praksis")].filter((p) => !p.startsWith("Konsekvensen av"))) expect(setninger(p), p).toBeGreaterThan(1);
  });
});

describe("utgiftene", () => {
  it("to utgifter: én setning med sum", () => {
    const B = byggBrev(syncAreas(eksempel(idag)), null, idag);
    expect(B.some((b) => (b.t as string) === "exp")).toBe(false);
    expect(tilTekst(B)).toContain("Jeg krever også erstatning for utgiftene jeg har hatt som følge av mangelen, jf. § 33: kr 1 890 til feilsøking hos merkeverksted og kr 2 850 til leiebil i tre dager, til sammen kr 4 740.");
  });
  it("én utgift: uten sum", () => expect(tekst({ ...eksempel(idag), exp: [{ t: "Tauing.", a: 1500 }] })).toContain("jf. § 33: kr 1 500 til tauing."));
  it("utgift uten tekst: plassholder", () => expect(tekst({ ...eksempel(idag), exp: [{ t: "", a: 900 }] })).toContain("kr 900 til [utgift]."));
});

describe("sen reklamasjon", () => {
  const sen = (seller_said: string) => {
    const s = { ...eksempel(idag), c_purchase: "2022-05-14", c_delivery: "2022-05-14", f_prior: false, seller_said };
    s.f_area = { hoyvolt: { found: "2023-02-10" } };
    return tekst(s);
  };
  it("nevner fristen og unntaket, og løftet når selgeren lovet", () => {
    const t = sen("lovet");
    expect(t).toContain("Reklamasjonsfristen etter § 27 første ledd er «innen rimelig tid», og to måneder er bare lovens korteste frist. Fristen gjelder ikke dersom selgeren har opptrådt grovt uaktsomt eller i strid med redelighet og god tro, jf. § 27 fjerde ledd.");
    expect(t).toContain("Dere er en profesjonell forhandler og opplyste før kjøpet at bilen var fri for slike feil. Når det ikke stemte, har dere i det minste opptrådt grovt uaktsomt, og dere kan derfor ikke påberope dere at reklamasjonen kom for sent, jf. § 27 fjerde ledd.");
    expect(t).not.toContain("er dermed rettidig");
  });
  it("uten løfte: bare lovens regel", () => {
    const t = sen("nei");
    expect(t).toContain("jf. § 27 fjerde ledd.");
    expect(t).not.toContain("gjør gjeldende at fristen");
  });
  it("over fem år med unntaket: brevet argumenterer unntaket", () => {
    const s = { ...eksempel(idag), c_purchase: "2021-03-01", c_delivery: "2021-03-01", c_unntak: true, f_prior: false };
    s.f_area = { hoyvolt: { found: "2026-09-01" } };
    expect(tekst(s)).toContain("Det er mer enn fem år siden jeg overtok bilen. Fristen på fem år gjelder likevel ikke når selgeren har påtatt seg ansvar for lengre tid ved garanti, eller har opptrådt grovt uaktsomt eller i strid med redelighet og god tro, jf. § 27 fjerde ledd. Jeg gjør gjeldende at det er tilfellet her.");
  });
});

describe("to feil i samme område på ulike datoer", () => {
  const saken = {
    ...eksempel(idag),
    c_purchase: "2024-01-15", c_delivery: "2024-01-15",
    f_cats: ["motor", "understell"], f_parts: { motor: ["utslipp", "turbo"], understell: ["bremser"] },
    f_area: { motor: { found: "2024-04-02" }, understell: { found: "2026-10-10" } },
    f_catdesc: { motor: "Partikkelfilteret tettet seg." },
    f_under: { "motor.turbo": { found: "2025-02-18", desc: "Turboen hviner." } },
    f_prior: true, f_prior_date: "2024-04-10", f_prior_svar: [],
  };
  it("hver feil med sin dato", () => {
    const t = tekst(saken);
    expect(t).toContain("Den 2. april 2024 oppdaget jeg feil ved utslippssystemet (EGR, partikkelfilter eller AdBlue). Partikkelfilteret tettet seg.");
    expect(t).toContain("Den 18. februar 2025 oppdaget jeg også feil ved turboen. Turboen hviner.");
    expect(t).not.toContain("2. april 2024 oppdaget jeg feil ved turboen");
  });
  it("formodningen for de to første, femårsregelen ikke for noen", () => {
    const t = tekst(saken);
    expect(t).toContain("Feilene ved turboen og ved utslippssystemet (EGR, partikkelfilter eller AdBlue) viste seg innen to år etter overtakelsen.");
    expect(t).toContain("At feilen ved bremsene viste seg mer enn to år etter overtakelsen, hindrer ikke reklamasjon: en bil er ment å vare vesentlig lenger enn to år, og den ytterste reklamasjonsfristen er derfor fem år, jf. § 27 annet ledd annet punktum.");
  });
  it("tidligere reklamasjon bare for det som var kjent, og rettidig per feil", () => {
    const t = tekst(saken);
    expect(t).toContain("og opplyste om feilen. For feil jeg har oppdaget etter det, er dette brevet reklamasjonen.");
    expect(t).toContain("Reklamasjonen på feilen ved utslippssystemet (EGR, partikkelfilter eller AdBlue) og ved bremsene er fremsatt innen to måneder etter at jeg oppdaget dem");
    expect(t).toContain("jf. § 27 fjerde ledd.");
    expect(t).not.toContain("Reklamasjonen er fremsatt innen to måneder");
  });
});

describe("bevisbyrden og fristene i hvert sitt avsnitt", () => {
  // Karosseri inside the presumption but complained of late; klima after two years but in time.
  const s = { ...eksempel(idag), c_purchase: "2024-06-01", c_delivery: "2024-06-01", f_cats: ["karosseri", "klima"], f_parts: { karosseri: ["rust"], klima: ["ac"] }, f_area: { karosseri: { found: "2024-09-01" }, klima: { found: "2026-09-01" } }, f_catdesc: {}, f_prior: false, f_prior_svar: [] };
  const avsnitt = () => tilTekst(byggBrev(syncAreas(s), PRES, idag)).split("\n\n");
  it("formodningen i ett avsnitt, uten femårsregelen", () => {
    const p = avsnitt().find((x) => x.startsWith("Feilen ved karosseriet"))!;
    expect(p).toContain("viste seg innen to år etter overtakelsen. Etter § 18 annet ledd");
    expect(p).toContain("at denne feilen ikke var til stede");
    expect(p).not.toContain("fem år");
  });
  it("fristene i neste avsnitt: først den rettidige, så femårsregelen, så den sene med lovens korteste frist", () => {
    const p = avsnitt().find((x) => x.startsWith("Reklamasjonen på feilen ved klimaanlegget"))!;
    expect(p).toMatch(/er dermed rettidig etter § 27 første ledd\. At feilen ved klimaanlegget \(AC\) viste seg mer enn to år etter overtakelsen, hindrer ikke reklamasjon: .* fem år, jf\. § 27 annet ledd annet punktum\. For feilen ved karosseriet gikk det mer enn to måneder fra jeg oppdaget den til jeg reklamerte\. To måneder er likevel bare lovens korteste frist\./);
  });
});

describe("opplysningsfeil", () => {
  const km = { ...eksempel(idag), f_cats: ["historikk"], f_parts: { historikk: ["km"] }, f_area: { historikk: { found: "2026-09-01" } }, f_catdesc: {}, f_impact: ["verdi"], k_main: "prisavslag", k_amount: "45 000", ws: "nei", f_prior: false };
  it("verdi som virkning, intet rettingstilbud og ingen undersøkelse", () => {
    const t = tekst(km);
    expect(t).toContain("Konsekvensen av feilen er at bilen er mindre verdt enn det jeg betalte for.");
    expect(t).not.toContain("kan tilby å rette mangelen");
    expect(t).not.toContain("stilles til rådighet");
  });
  it("som den er før 2024 med løfte: også bokstav b", () => {
    const s = { ...eksempel(idag), c_purchase: "2022-05-14", c_delivery: "2022-05-14", c_asis: true, seller_said: "lovet" };
    s.f_area = { hoyvolt: { found: "2022-08-01" } };
    expect(tekst(s)).toContain("Bilen har også en mangel når den ikke svarer til opplysninger dere ga før kjøpet, jf. § 17 første ledd bokstav b.");
    expect(tekst({ ...s, seller_said: "nei" })).not.toContain("bokstav b");
  });
});

describe("ordlyd", () => {
  it("ett forsøk etter 2024: entall", () => expect(tekst({ ...eksempel(idag), k_main: "heving", k_forsok: "1" })).toContain("Etter det mislykkede rettingsforsøket kan jeg avvise videre retting"));
  it("beløpet navngis", () => {
    expect(tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "25 000", k_exp: false })).toContain(" Prisavslaget bes utbetalt innen fristen.");
    expect(tekst({ ...eksempel(idag), k_main: "heving" })).toContain(" Erstatningen for utgiftene bes utbetalt innen fristen.");
    expect(tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "25 000" })).toContain(" Prisavslaget og erstatningen for utgiftene bes utbetalt innen fristen.");
    expect(tekst({ ...eksempel(idag), k_main: "retting", k_exp: false })).not.toContain("bes utbetalt");
  });
  it("anførselstegn inni sitatet", () => expect(tekst({ ...eksempel(idag), seller_txt: "Annonsen sa «141 000 km, full servicehistorikk»" })).toContain("Før kjøpet opplyste dere: «Annonsen sa ‘141 000 km, full servicehistorikk’»."));
  it("verkstedets ord uten rapport er ikke et sitat", () => expect(tekst({ ...eksempel(idag), ws: "uten", ws_quote: "Rusten må ha vært der ved salget" })).toContain("Slik jeg oppfattet verkstedet: Rusten må ha vært der ved salget."));
});

describe("fristene, runde 2", () => {
  const base = { ...eksempel(idag), c_purchase: "2021-01-01", c_delivery: "2021-01-01", f_cats: ["motor", "klima"], f_parts: { motor: ["turbo"], klima: ["ac"] }, f_area: { motor: { found: "2025-11-01" }, klima: { found: "2026-09-01" } }, f_catdesc: {}, f_under: {}, seller_said: "nei", f_prior: true, f_prior_date: "2025-11-20", f_prior_svar: ["for_sent"] };
  it("en feil reklamert med brevet etter fem år er ikke rettidig", () => {
    const t = tekst(base);
    expect(t).not.toContain("er dermed rettidig");
  });
  it("tidligere reklamasjon uten dato: ingenting om sen reklamasjon", () => {
    const s = { ...eksempel(idag), f_prior: true, f_prior_date: "", c_purchase: "2025-01-01", c_delivery: "2025-01-01" };
    s.f_area = { hoyvolt: { found: "2025-03-01" } };
    expect(tekst(s)).not.toContain("Reklamasjonsfristen etter");
  });
  it("etter fem år med unntaket: svaret på «for sent» viser ikke til femårsfristen", () => {
    const s = { ...base, c_unntak: true, f_area: { motor: { found: "2026-09-01" }, klima: { found: "2026-09-01" } }, f_prior_date: "2026-09-10" };
    const t = tekst(s);
    expect(t).toContain("Fristen på fem år gjelder likevel ikke");
    expect(t).not.toContain("den ytterste fristen fem år");
  });
  it("sen feil nevnes ved navn når andre er i tide", () => {
    const s = { ...eksempel(idag), c_purchase: "2025-01-01", c_delivery: "2025-01-01", f_cats: ["motor", "klima"], f_parts: { motor: ["turbo"], klima: ["ac"] }, f_area: { motor: { found: "2025-03-01" }, klima: { found: "2026-10-01" } }, f_catdesc: {}, f_prior: false, f_prior_svar: [] };
    expect(tekst(s)).toContain("For feilen ved turboen gikk det mer enn to måneder fra jeg oppdaget den til jeg reklamerte. To måneder er likevel bare lovens korteste frist. Fristen etter § 27 første ledd er «innen rimelig tid», og den gjelder ikke dersom");
  });
  it("oppgitt kilometerstand når km er en feil", () => expect(tekst({ ...eksempel(idag), c_km: "141 000", f_cats: ["historikk"], f_parts: { historikk: ["km"] }, f_area: { historikk: { found: "2026-09-01" } } })).toContain("med en oppgitt kilometerstand på 141 000 km"));
  it("retting med subsidiær heving: ikke «avvise videre retting»", () => expect(tekst({ ...eksempel(idag), k_main: "retting", k_alt: "heving", k_forsok: "1" })).not.toContain("avvise videre retting"));
});

describe("tilTekst med underoverskrift og kursiv", () => {
  it("kursivt innledningsord uten markering, underoverskriften på egen linje", () => {
    const B: Blokk[] = [{ t: "h", tekst: ["Rettslig grunnlag"] }, { t: "h2", tekst: ["1. Feilen ved turboen"] }, { t: "p", tekst: [{ kursiv: "Reklamasjonen er rettidig." }, " Jeg reklamerte i tide."] }];
    expect(tilTekst(B)).toBe("Rettslig grunnlag\n\n1. Feilen ved turboen\n\nReklamasjonen er rettidig. Jeg reklamerte i tide.");
  });
});
