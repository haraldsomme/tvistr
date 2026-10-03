import { describe, expect, it } from "vitest";
import type { KlageInput } from "@/lib/vurdering/typer";
import { byggBrev, type LignendeRef } from "./brev";
import type { Utfylling } from "./utfylling";

const IDAG = "2026-10-02";
const klage = (feilen: Partial<KlageInput["feilen"]> = {}, bil: Partial<KlageInput["bilOgKjop"]> = {}): KlageInput => ({
  bilOgKjop: { kjopsdato: "2026-03-12", kjopesumNok: 250000, kmVedKjop: 80000, ...bil },
  feilen: { typer: ["motor"], oppdaget: "innen_6_mnd", opplystForKjop: "nei", feilOpplysning: "nei", kontakt: "ja", ...feilen },
  bevis: { verkstedrapport: false, rapportSierForKjop: null, bilder: true },
});
// The dealer has refused to repair unless a test says otherwise (answered on the letter page).
const tekst = (input: KlageInput, idag: string, u: Utfylling = {}, lignende: LignendeRef[] = []) => byggBrev(input, idag, { retting: "avvist", ...u }, lignende).avsnitt.join("\n");

describe("heving og prisavslag", () => {
  it("heving har subsidiært krav om prisavslag og krav om rente", () => {
    const t = tekst(klage(), IDAG, { krav: { type: "heving", utgifter: [] } });
    expect(t).toContain("hever kjøpet, jf. § 32");
    expect(t).toContain("subsidiært");
    expect(t).toContain("forsinkelsesrenteloven §§ 2 og 3");
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

describe("lignende vedtak", () => {
  const ref = (o: Partial<LignendeRef> = {}): LignendeRef => ({
    saksnummer: "23/13923",
    ar: 2024,
    utfall: "delvis_medhold",
    moment: "Formodningsregelen gjaldt, og feilene ble anses å foreligge ved levering",
    kildeUrl: "https://example.test/v.pdf",
    ...o,
  });

  it("uten vedtak er det ikke noe avsnitt", () => {
    expect(tekst(klage(), IDAG, {}, [])).not.toContain("Forbrukerklageutvalgets behandling");
  });

  it("hvert vedtak står med saksnummer, år, utfall og nøkkelmoment som en egen setning", () => {
    const t = tekst(klage(), IDAG, {}, [ref(), ref({ saksnummer: "FKU-2025-140302", ar: 2025, utfall: "medhold", moment: "Feilen var dokumentert av verksted." })]);
    expect(t).toContain("Sak 23/13923 (2024, delvis medhold): Formodningsregelen gjaldt, og feilene ble anses å foreligge ved levering.");
    expect(t).toContain("Sak FKU-2025-140302 (2025, medhold): Feilen var dokumentert av verksted.");
  });

  it("vedtakene kommer før kravet, og vedlegg-linjen nevner ikke vedtakene", () => {
    const b = byggBrev(klage(), IDAG, {}, [ref()]);
    const iLignende = b.avsnitt.findIndex((a) => a.includes("Forbrukerklageutvalgets behandling"));
    const iKrav = b.avsnitt.findIndex((a) => a.includes("Jeg reklamerer herved"));
    expect(iLignende).toBeGreaterThan(-1);
    expect(iLignende).toBeLessThan(iKrav);
    expect(b.avsnitt.at(-1)).not.toContain("23/13923");
  });
});
