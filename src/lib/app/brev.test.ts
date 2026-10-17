import { describe, expect, it } from "vitest";
import { LOVSETNING } from "@/lib/vedtaksvalg/valg";
import { byggBrev, emne, type Presedens, tilTekst, vedlegg } from "./brev";
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
  const saker = [alt("retting"), alt("omlevering"), alt("prisavslag", { k_amount: "30 000" }), alt("heving"), alt("retting", { c_purchase: "2023-03-01", c_delivery: "2023-03-01" })];
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
    expect(vedlegg(s)).toEqual(["Kjøpekontrakt", "Verkstedrapport"]);
    expect(t).toContain("\n2. Verkstedrapport");
  });
  it("huket av: bare én gang", () => expect(vedlegg(eksempel(idag)).filter((x) => x === "Verkstedrapport")).toHaveLength(1));
  it("uten rapport legges ingenting til", () => expect(vedlegg({ ...eksempel(idag), ws: "uten", f_docs: [] })).toEqual([]));
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
    expect(t).toContain("Dere har forsøkt å rette feilen to ganger uten å lykkes, og har dermed ikke lenger rett til å rette, jf. §§ 29 og 30.");
    expect(t).toContain("Bilen kan ikke brukes.");
    expect(t).toContain("Feilen går ut over sikkerheten.");
    expect(t).toContain("Verkstedet fraråder videre bruk.");
    expect(t).toContain("Bilen avviker fra det dere uttrykkelig opplyste før kjøpet.");
    expect(t).toContain("Mangelen er derfor ikke uvesentlig, og jeg hever kjøpet, jf. § 32.");
    expect(t).not.toContain("Mangelen er ikke uvesentlig, og jeg hever");
  });
  it("ett forsøk og liten kostnad: forsøket nevnes, kostnaden ikke", () => {
    const t = tekst(hev({ k_cost: "9 000", k_forsok: "1", seller_said: "nei" }));
    expect(t).toContain("Ett rettingsforsøk har ikke løst feilen.");
    expect(t).not.toContain("anslått til");
  });
  it("«3+» skrives som tre eller flere ganger", () => expect(tekst(hev({ k_forsok: "3+" }))).toContain("tre eller flere ganger"));
  it("uten grunnlag står dagens setning", () => {
    const s = hev({ seller_said: "nei" });
    s.f_area = { hoyvolt: { ...s.f_area.hoyvolt, impact: ["plagsom"] } };
    expect(tekst(s)).toContain("Mangelen er ikke uvesentlig, og jeg hever med dette kjøpet, jf. § 32.");
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
  it("kravet nevnes bare når vedtaket ga det; omlevering regnes som retting", () => {
    expect(tekst({ ...eksempel(idag), k_main: "prisavslag", k_amount: "1" }, pres({ utfall: ["heving"] }))).not.toContain("som er det jeg krever");
    expect(tekst({ ...eksempel(idag), k_main: "omlevering" }, pres({ utfall: ["retting"] }))).toContain("Kjøperen fikk medhold i retting, som er det jeg krever.");
  });
  it("nivå B: samme rettslige spørsmål", () => expect(tekst(eksempel(idag), pres({ niva: "B" }))).toContain("Vedtaket avgjør det samme rettslige spørsmålet som denne saken reiser."));
  it("uten vedtak eller mens det hentes: ingen slutning", () => {
    expect(tekst(eksempel(idag))).not.toContain("vurderes på samme måte");
    expect(tilTekst(byggBrev(syncAreas(eksempel(idag)), "venter", idag))).not.toContain("vurderes på samme måte");
  });
});
