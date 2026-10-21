import { describe, expect, it } from "vitest";
import { LOVSETNING } from "@/lib/vedtaksvalg/valg";
import { byggBrev, emne, tilTekst, vedlegg } from "./brev";
import type { Blokk, Presedens } from "./brevtyper";
import { eksempel, standard, syncAreas } from "./skjema";

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

  it("slått av: ingen sak", () => {
    const t = tekst({ ...eksempel(idag), prec_on: false }, PRES);
    expect(t).not.toContain("Praksis fra");
    expect(t).not.toContain(LOVSETNING);
  });

  it("feil før overtakelse kaster ikke", () => {
    const s = { ...eksempel(idag), c_delivery: "2026-10-01" };
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2026-09-01" } };
    expect(() => tekst(s)).not.toThrow();
  });

  it("emnefeltet", () => expect(emne(byggBrev(syncAreas(eksempel(idag)), null, idag))).toBe("Reklamasjon på mangel ved Volkswagen ID.4, reg.nr. EL 48213"));
});

describe("tonen", () => {
  // Every argument the letter can make: «som den er», five-year rule, warranty, promise, prior contact,
  // expenses and withholding, and each main claim.
  const alt = (k_main: string, ekstra: Partial<ReturnType<typeof eksempel>> = {}) => ({ ...eksempel(idag), k_main, c_asis: true, k_hold: true, k_hold_amt: "5 000", k_days: "14", ...ekstra });
  const saker = [alt("retting"), alt("prisavslag", { k_amount: "30 000" }), alt("heving"), alt("retting", { c_purchase: "2023-03-01", c_delivery: "2023-03-01" })];
  const avsnitt = (s: ReturnType<typeof eksempel>) => tekst(s, PRES).split("\n\n");
  const tall = (t: string) => (t.match(/§+ \d+\w*|\d+/g) ?? []).sort();

  it("bestemt eksempelbrev", () => expect(tekst({ ...eksempel(idag), l_tone: "bestemt" }, PRES)).toMatchSnapshot());

  it.each(saker.map((s, i) => [i, s] as const))("sak %i: samme paragrafer, beløp og datoer i begge toner", (_, s) => {
    const a = tekst({ ...s, l_tone: "saklig" }, PRES);
    const b = tekst({ ...s, l_tone: "bestemt" }, PRES);
    expect(a).not.toBe(b);
    expect(tall(b)).toEqual(tall(a));
  });

  it("argumentasjonen endres, fakta og vedtaket står fast", () => {
    for (const s of saker) {
      const a = avsnitt({ ...s, l_tone: "saklig" });
      const b = avsnitt({ ...s, l_tone: "bestemt" });
      expect(b.length).toBe(a.length);
      const ulike = a.filter((x, i) => x !== b[i]);
      expect(ulike.length).toBeGreaterThanOrEqual(7);
      expect(b).toContain(PRES.avsnitt);
      expect(ulike.join("\n")).not.toContain(PRES.avsnitt);
    }
  });
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
    f_area: Object.fromEntries(Object.entries(areas).map(([c, found]) => [c, { found, impact: [], known: "nei" }])),
    f_parts: {},
    f_catdesc: {},
  });
  it("to feil, én innenfor og én utenfor formodningen: formodningen nevner bare den ene", () => {
    const s = med({ ...eksempel(idag), c_purchase: "2023-03-01", c_delivery: "2023-03-01" }, { motor: "2023-05-01", klima: "2024-01-15" });
    const t = tekst(s);
    expect(t).toContain("Feilen ved motor og eksos viste seg");
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
  const en = (s: ReturnType<typeof eksempel>, c: string, under: string[], found: string) => ({ ...s, f_cats: [c], f_parts: { [c]: under }, f_area: { [c]: { found, impact: [], known: "nei" } }, f_catdesc: {} });
  it("påstår ikke «innen rimelig tid» når det har gått mer enn to måneder", () => {
    const s = en({ ...eksempel(idag), c_purchase: "2023-03-01", c_delivery: "2023-03-01", f_prior: false }, "drivlinje", ["girkasse"], "2023-11-15");
    expect(tekst(s)).not.toContain("Reklamasjonen er fremsatt");
  });
  it("feil i det selgeren opplyste: ingen formodning", () => {
    const s = en({ ...eksempel(idag), c_purchase: "2026-03-01", c_delivery: "2026-03-01" }, "historikk", ["km"], "2026-06-01");
    expect(tekst(s)).not.toContain("formodes");
  });
  it("garanti ikke som lovet: ingen formodning og ingen setning om at garantien gjelder", () => {
    const s = en({ ...eksempel(idag), c_purchase: "2025-11-01", c_delivery: "2025-11-01", c_warranty: true }, "garanti", [], "2026-02-01");
    const t = tekst(s);
    expect(t).not.toContain("formodes");
    expect(t).not.toContain("Bilen er også omfattet av garanti");
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
  it("rapporten brevet sier følger vedlagt, står i listen", () => {
    const s = { ...eksempel(idag), f_docs: ["kontrakt"] };
    const t = tekst(s);
    expect(t).toContain("Rapporten følger vedlagt");
    expect(vedlegg(s)).toEqual(["Kjøpekontrakt", "Verkstedrapport", "Kvitteringer for utgifter"]);
    expect(t).toContain("\n2. Verkstedrapport");
  });
  it("huket av: bare én gang", () => expect(vedlegg(eksempel(idag)).filter((x) => x === "Verkstedrapport")).toHaveLength(1));
  it("uten rapport legges ingenting til", () => expect(vedlegg({ ...eksempel(idag), ws: "uten", f_docs: [], k_exp: false })).toEqual([]));
  it("kvitteringene følger et erstatningskrav med utgifter", () => {
    expect(vedlegg({ ...eksempel(idag), f_docs: [] })).toContain("Kvitteringer for utgifter");
    expect(vedlegg({ ...eksempel(idag), f_docs: [], exp: [] })).not.toContain("Kvitteringer for utgifter");
  });
});

describe("konsekvensen", () => {
  const med = (impact: string[]) => {
    const s = eksempel(idag);
    return { ...s, f_area: { hoyvolt: { ...s.f_area.hoyvolt, impact } } };
  };
  it("«påvirker bruken» sies konkret når bilen ellers kan brukes", () => expect(tekst(med(["bruk"]))).toContain("Konsekvensen er at feilen merkes under kjøring og begrenser hvordan bilen kan brukes."));
  it("«påvirker bruken» utelates når setningen før alt sier at bilen bare kan brukes delvis", () => {
    const t = tekst(med(["palitelig", "bruk"]));
    expect(t).toContain("Bilen kan bare brukes i begrenset grad");
    expect(t).not.toContain("Konsekvensen er");
  });
  it("sikkerhet nevnes fortsatt sammen med delvis bruk", () => expect(tekst(med(["palitelig", "sikkerhet"]))).toContain("Konsekvensen er at feilen går ut over sikkerheten."));
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
  it("tilbakeholdsretten henviser via tabellen", () => expect(tekst({ ...eksempel(idag), k_hold: true, k_hold_amt: "5 000" })).toContain("av det jeg skylder dere, jf. § 28."));
});

describe("begrunnelsen for heving", () => {
  const hev = (ekstra: Partial<ReturnType<typeof eksempel>> = {}) => ({ ...eksempel(idag), k_main: "heving", ...ekstra });
  it("kostnad mot kjøpesum, forsøk, bruk, verksted og løfte, deretter konklusjonen", () => {
    const s = hev({ k_cost: "85 000", k_forsok: "2", ws_says: ["bekrefter", "frarader"] });
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, impact: ["stopp", "sikkerhet"] } };
    const t = tekst(s);
    expect(t).toContain("Utbedringen er anslått til kr 85 000, som utgjør 26 % av kjøpesummen.");
    expect(t).toContain("Dere har forsøkt å rette feilen to ganger uten å lykkes, og jeg kan derfor avvise videre retting, jf. § 30 fjerde ledd.");
    expect(t).toContain("Bilen kan ikke brukes.");
    expect(t).toContain("Feilen går ut over sikkerheten.");
    expect(t).toContain("Verkstedet fraråder videre bruk.");
    expect(t).toContain("Bilen avviker fra det dere uttrykkelig opplyste før kjøpet.");
    expect(t).toContain("Mangelen er derfor ikke uvesentlig, og jeg hever kjøpet, jf. § 32. Det er dere som har bevisbyrden for at mangelen er uvesentlig.");
    expect(t).not.toContain("Mangelen er ikke uvesentlig, og jeg hever");
  });
  it("ett forsøk fra 2024: forbrukeren kan avvise videre retting (§ 30 fjerde ledd), kostnaden nevnes ikke", () => {
    const t = tekst(hev({ k_cost: "9 000", k_forsok: "1", seller_said: "nei" }));
    expect(t).toContain("Dere har forsøkt å rette feilen uten å lykkes, og jeg kan derfor avvise videre retting, jf. § 30 fjerde ledd.");
    expect(t).toContain("og jeg hever kjøpet, jf. § 32.");
    expect(t).not.toContain("Jeg er kjent med at dere kan tilby å rette");
    expect(t).not.toContain("anslått til");
  });
  it("før 2024: ett forsøk er ikke nok, to gir gamle § 30 annet ledd, og bevisbyrden nevnes ikke", () => {
    const s = hev({ k_forsok: "1", seller_said: "nei", c_purchase: "2023-06-01", c_delivery: "2023-06-01" });
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2023-08-01" } };
    const t = tekst(s);
    expect(t).toContain("Ett rettingsforsøk har ikke løst feilen.");
    expect(t).toContain("Jeg er kjent med at dere kan tilby å rette mangelen, dersom det skjer uten opphold, jf. § 29 tredje ledd.");
    expect(t).not.toContain("bevisbyrden for at mangelen er uvesentlig");
    const t2 = tekst({ ...s, k_forsok: "2" });
    expect(t2).toContain("har dermed ikke lenger rett til å rette, jf. § 30 annet ledd.");
    expect(t2).not.toContain("Jeg er kjent med at dere kan tilby å rette");
  });
  it("«3+» skrives som tre eller flere ganger", () => expect(tekst(hev({ k_forsok: "3+" }))).toContain("tre eller flere ganger"));
  it("uten rettingsforsøk: kravet om heving fremmes, og selgerens rett til å rette erkjennes (§ 29 tredje ledd)", () => {
    const s = hev({ seller_said: "nei" });
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, impact: ["plagsom"] } };
    const t = tekst(s);
    expect(t).toContain("Mangelen er ikke uvesentlig, og jeg krever å heve kjøpet, jf. § 32.");
    expect(t).toContain("Jeg er kjent med at dere kan tilby å rette mangelen, jf. § 29 tredje ledd. Rettingen må i så fall skje uten kostnad, uten vesentlig ulempe for meg og innen rimelig tid, jf. § 30 første ledd. Skjer ikke det, fastholder jeg kravet om heving.");
    expect(t).toContain("Bilen kan stilles til rådighet for undersøkelse og retting etter nærmere avtale, jf. § 30 annet ledd.");
  });
  it("alvorlig mangel fra 2024: heving med en gang etter § 29 tredje ledd tredje punktum", () => {
    const s = hev({ seller_said: "nei" });
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, impact: ["sikkerhet"] } };
    const t = tekst(s);
    expect(t).toContain("og jeg hever kjøpet, jf. § 32.");
    expect(t).toContain("Mangelen er etter sin art så alvorlig at det ikke er rimelig å forvente at jeg skal godta et tilbud om avhjelp, jf. § 29 tredje ledd tredje punktum.");
    expect(t).not.toContain("Jeg er kjent med at dere kan tilby å rette");
    expect(t).toContain("Bilen kan stilles til rådighet for undersøkelse etter nærmere avtale");
  });
  it("alvorlig mangel før 2024: ingen umiddelbar heving, selgeren kan tilby retting", () => {
    const s = hev({ seller_said: "nei", c_purchase: "2023-06-01", c_delivery: "2023-06-01" });
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, found: "2023-08-01", impact: ["sikkerhet"] } };
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
    expect(t).toContain("kreve å heve kjøpet, jf. § 32.");
    expect(t).toContain("Dere har forsøkt å rette feilen to ganger");
  });
  it("prisavslag uten grunnlagstekst nevner overslaget", () => {
    expect(tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "30 000", k_cost: "35 000" })).toContain("Beløpet bygger på et overslag over utbedringskostnaden på kr 35 000.");
    expect(tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "30 000", k_cost: "35 000", k_basis: "takst" })).toContain("Beløpet bygger på takst.");
  });
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
    expect(tekst(eksempel(idag))).toContain("Formodningen er ikke uforenlig med varens eller mangelens art, jf. § 18 annet ledd tredje punktum: verkstedrapporten fastslår at feilen ikke skyldes normal slitasje."));
  it("nevnes ikke uten slik rapport", () => expect(tekst({ ...eksempel(idag), ws_says: ["bekrefter"] })).not.toContain("uforenlig"));
});

describe("forhandlerens svar", () => {
  const svar = (f_prior_svar: string[], ekstra: Partial<ReturnType<typeof eksempel>> = {}) => tekst({ ...eksempel(idag), f_prior_resp: "", f_prior_svar, ...ekstra });
  it("svarene står i avsnittet om kontakten", () => expect(svar(["slitasje", "garanti_ute"])).toContain("Svaret jeg fikk, var at feilen skyldes slitasje eller feil bruk og garantien er utløpt."));
  it("fritekst kommer etter valgene", () => expect(svar(["avvist"], { f_prior_resp: "bilen var gammel" })).toContain("Svaret jeg fikk, var at reklamasjonen ble avvist og bilen var gammel."));
  it("slitasje innenfor formodningen", () => expect(svar(["slitasje"])).toContain("At dere viser til slitasje eller feil bruk, endrer ikke dette."));
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
    expect(t).toContain("Saken gjaldt samme type feil som i min sak. Bilen i min sak var ikke i et svakere utgangspunkt. Kjøperen fikk medhold i heving, som er det jeg krever. Min sak bør vurderes på samme måte.");
  });
  it("bestemt tone med samme utgangspunkt", () => {
    const t = tekst({ ...eksempel(idag), k_main: "heving", l_tone: "bestemt" }, pres({ utfall: ["heving"] }));
    expect(t).toContain("Min sak står minst like sterkt, og utfallet bør bli det samme.");
  });
  it("strengere på én side: ingen påstand om utgangspunktet, og saklig avslutning i begge toner", () => {
    for (const l_tone of ["saklig", "bestemt"]) {
      const t = tekst({ ...eksempel(idag), l_tone }, pres({ treff: T({ km: "strengere" }), utfall: ["heving"] }));
      expect(t).not.toContain("svakere utgangspunkt");
      expect(t).toContain("Min sak bør vurderes på samme måte.");
      expect(t).not.toContain("minst like sterkt");
    }
  });
  it("kravet nevnes bare når vedtaket ga det", () => {
    expect(tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "1" }, pres({ utfall: ["heving"] }))).not.toContain("som er det jeg krever");
    expect(tekst({ ...eksempel(idag), k_main: "retting" }, pres({ utfall: ["retting"] }))).toContain("Kjøperen fikk medhold i retting, som er det jeg krever.");
  });
  it("omlevering er ikke et krav i brevet", () => expect(tekst({ ...eksempel(idag), k_main: "omlevering" })).not.toMatch(/omlevering/i));
  it("nivå B: samme rettslige spørsmål", () => expect(tekst(eksempel(idag), pres({ niva: "B" }))).toContain("Vedtaket avgjør det samme rettslige spørsmålet som denne saken reiser."));
  it("uten vedtak eller mens det hentes: ingen slutning", () => {
    expect(tekst(eksempel(idag))).not.toContain("vurderes på samme måte");
    expect(tilTekst(byggBrev(syncAreas(eksempel(idag)), "venter", idag))).not.toContain("vurderes på samme måte");
  });
});

describe("feltmerker", () => {
  const deler = (B: Blokk[]) => B.flatMap((b) => ("tekst" in b ? [b.tekst] : "linjer" in b ? b.linjer : "punkter" in b ? b.punkter : "avsnitt" in b ? b.avsnitt : b.rader.map((r) => r[0]))).flat();
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
