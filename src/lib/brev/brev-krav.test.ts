import { describe, expect, it } from "vitest";
import type { KlageInput } from "@/lib/vurdering/typer";
import { byggBrev, henvisningFor } from "./brev";
import type { Utfylling } from "./utfylling";

const IDAG = "2026-10-02";
const klage = (feilen: Partial<KlageInput["feilen"]> = {}, bil: Partial<KlageInput["bilOgKjop"]> = {}): KlageInput => ({
  bilOgKjop: { kjopsdato: "2026-03-12", kjopesumNok: 250000, kmVedKjop: 80000, ...bil },
  feilen: { typer: ["motor"], oppdaget: "innen_6_mnd", opplystForKjop: "nei", feilOpplysning: "nei", kontakt: "ja", ...feilen },
  bevis: { verkstedrapport: false, rapportSierForKjop: null, bilder: true },
});
// The dealer has refused to repair unless a test says otherwise (answered on the letter page).
const tekst = (input: KlageInput, idag: string, u: Utfylling = {}) => byggBrev(input, idag, { retting: "avvist", ...u }).avsnitt.join("\n");

describe("heving og prisavslag", () => {
  it("heving har subsidiært krav om prisavslag, sier at mangelen ikke er uvesentlig, og krever rente fra reklamasjonen", () => {
    const t = tekst(klage(), IDAG, { krav: { type: "heving", utgifter: [] }, reklamasjon: { dato: "2026-09-03", mate: "epost" } });
    expect(t).toContain("Jeg hever kjøpet, jf. § 32");
    expect(t).toContain("Mangelen er ikke uvesentlig, og det er dere som må bevise noe annet, jf. § 32.");
    expect(t).toContain("subsidiært");
    expect(t).toContain("Etter forbrukerkjøpsloven § 50 andre ledd skal dere betale forsinkelsesrente av kjøpesummen fra 3. september 2026, da jeg reklamerte, til betaling skjer.");
  });

  it("«som den er» følger loven på kjøpsdagen", () => {
    expect(tekst(klage({}, { kjopsdato: "2023-05-02" }), IDAG, { forbehold: "som_den_er" })).toContain("jf. forbrukerkjøpsloven § 17 første ledd bokstav a slik den lød da vi inngikk avtalen");
    expect(tekst(klage(), IDAG, { forbehold: "som_den_er" })).toContain("har ingen virkning overfor meg som forbruker, jf. § 15 andre ledd og § 3. Jeg godtok ikke feilen uttrykkelig og særskilt ved kjøpet.");
  });

  it("subsidiært prisavslag bruker utbedringskostnaden når den er oppgitt", () => {
    const t = tekst(klage(), IDAG, { krav: { type: "heving", utbedringNok: 42000, utgifter: [] } });
    expect(t).toContain("subsidiært prisavslag på 42 000 kr");
  });

  it("prisavslag har rentekrav, men et krav som ikke er valgt ennå har det ikke", () => {
    expect(tekst(klage(), IDAG, { krav: { type: "prisavslag", utgifter: [] } })).toContain("forsinkelsesrenteloven");
    expect(tekst(klage(), IDAG, {})).not.toContain("forsinkelsesrenteloven");
  });

  it("retting (forhandleren ikke kontaktet) har verken subsidiært krav eller rente", () => {
    const t = tekst(klage({ kontakt: "nei" }), IDAG, {});
    expect(t).not.toContain("subsidiært");
    expect(t).not.toContain("forsinkelsesrenteloven");
  });
});

describe("forbehold og slitasje", () => {
  it("«solgt som den er» gir et avsnitt som møter forbeholdet", () => {
    expect(tekst(klage(), IDAG, { forbehold: "som_den_er" })).toContain("«som den er»");
  });

  it("uten forbehold eller «vet ikke» kommer det ikke noe avsnitt om forbehold", () => {
    expect(tekst(klage(), IDAG, { forbehold: "ingen" })).not.toContain("«som den er»");
    expect(tekst(klage(), IDAG, { forbehold: "vet_ikke" })).not.toContain("«som den er»");
    expect(tekst(klage(), IDAG, {})).not.toContain("«som den er»");
  });

  it("slitasjeavsnittet nevner kilometerstanden", () => {
    expect(tekst(klage(), IDAG, {})).toContain("80 000 km");
  });

  it("feil som slitasje ikke kan forklare (kilometerstand) får ikke slitasjeavsnitt", () => {
    expect(tekst(klage({ typer: ["km_service"] }), IDAG, {})).not.toContain("normal slitasje");
  });
});

describe("henvisning til vedtak", () => {
  const KILDE = /\((FKU|FTU)-\d{4}-\d+(-\d+)?, \d{1,2}\. [a-zø]+ \d{4}, https:\/\/\S+\)\./;

  it("står rett etter avsnittet om mangel og bevisbyrde, før kravet, med ref, dato og lenke", () => {
    const i = klage();
    const v = henvisningFor(i, IDAG, {});
    expect(v).not.toBeNull();
    const b = byggBrev(i, IDAG, { retting: "avvist" });
    const iMangel = b.avsnitt.findIndex((a) => a.includes("mangel etter forbrukerkjøpsloven § 16"));
    const iHenvisning = b.avsnitt.findIndex((a) => a.includes(v!.henvisning.ref));
    const iKrav = b.avsnitt.findIndex((a) => a.includes("forbrukerkjøpsloven § 27"));
    expect(iHenvisning).toBe(iMangel + 1);
    expect(iHenvisning).toBeLessThan(iKrav);
    expect(b.avsnitt[iHenvisning]).toMatch(KILDE);
    expect(b.avsnitt[iHenvisning]).toMatch(/^Forbruker(klage|tvist)utvalget har (behandlet en lignende sak|behandlet en sak om samme type feil|lagt det samme til grunn tidligere|vurdert hva en kjøper kan forvente av en eldre bil)\./);
    expect(b.avsnitt[iHenvisning]).toMatch(/Jeg ber dere ta hensyn til at utvalget har vurdert en tilsvarende sak slik\.$/);
    expect(b.avsnitt.filter((a) => KILDE.test(a))).toHaveLength(1);
  });

  it("«Annet» gir en regel-sak", () => {
    expect(tekst(klage({ typer: ["annet"] }), IDAG)).toContain("har lagt det samme til grunn tidligere");
  });

  it("en kjøpsdato før 2024 gir aldri en sak vunnet på formodningsregelen for feil etter 6–24 måneder", () => {
    const i = klage({ oppdaget: "6_mnd_til_2_ar" }, { kjopsdato: "2023-03-12" });
    const v = henvisningFor(i, IDAG, {});
    expect(v?.henvisning.presumsjon).toBe(false);
    expect(tekst(i, IDAG)).toContain(v!.henvisning.ref);
  });

  it("bilens årstall fra registeret brukes: en 25 år gammel bil får aldri en mye nyere lignende bil", () => {
    const v = henvisningFor(klage(), IDAG, { kjoretoy: { regnr: "ZZ 99999", merke: "Testmerke", modell: "Modell X", ar: 2001 } });
    expect(v).not.toBeNull();
    if (v!.henvisning.type === "lignende") expect(v!.henvisning.alder).toBeGreaterThanOrEqual(21);
  });

  it("når loven stopper kravet, viser brevet ikke til noe vedtak", () => {
    expect(tekst(klage({}, { kjopsform: "privatperson" }), IDAG)).not.toMatch(KILDE);
  });
});
