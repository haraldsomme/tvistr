import { describe, expect, it } from "vitest";
import type { VedtakFeil } from "@/lib/sammenligning/typer";
import { vedtakForModell } from "./prompt";
import { rensTekst } from "./rens";
import type { Analyse } from "./typer";

describe("vedtakForModell", () => {
  const v = {
    feil_id: "f1",
    kategori: "klimaanlegg",
    komponenter: ["AC-kompressor"],
    grunnlag: "feil_opplysning",
    opplysninger: [
      { type: "uttalelse", form: "annonse", ordlyd: "klimaanlegg", ordlyd_verifisert: true, sitat: "Bilen ble solgt med klimaanlegg.", sitat_verifisert: true, gjelder_feil: ["f1"] },
      { type: "uttalelse", form: "annonse", ordlyd: "EU-godkjent", ordlyd_verifisert: null, sitat: "Ikke kontrollert.", sitat_verifisert: null, gjelder_feil: ["f2"] },
    ],
    bevis: [{ type: "faktura", fremlagt_av: "klager", sitat: "Defekt kompressor.", sitat_verifisert: true, gjelder_feil: [] }],
  } as unknown as VedtakFeil;
  const a = {
    sammendrag: "Kort.",
    utvalgets_nokkelmomenter: ["Annonsert med klimaanlegg"],
    forbehold_tekst: null,
    tilkjent_prisavslag_nok: 10_000,
    tilkjent_erstatning_nok: 2_490,
    sitater: { utfall: "kroner 12 490,-" },
    feil: [
      { id: "f1", sitat: "Utvalget finner uriktige opplysninger.", sitat_verifisert: true, bevisgrunnlag: "formodning_ikke_motbevist" },
      { id: "f2", vurdering: "ikke_mangel", kategori: "motor", grunn: "ikke_dokumentert" },
    ],
    begrunnelse_sitater: [
      { tema: "mangel", tekst: "Om klimaanlegget.", gjelder_feil: ["f1"] },
      { tema: "mangel", tekst: "Om kjølehuset.", gjelder_feil: ["f2"] },
    ],
  } as Analyse;

  it("tar med det som gjelder feilen og hele saken, og bare kontrollerte sitater", () => {
    const m = vedtakForModell(v, a);
    expect(m.opplysninger.map((o) => o.ordlyd)).toEqual(["klimaanlegg"]);
    expect(m.bevis.map((b) => b.sitat)).toEqual(["Defekt kompressor."]);
    expect(m.utvalgets_begrunnelse.map((b) => b.tekst)).toEqual(["Om klimaanlegget."]);
    expect(m.denne_feilen.sitat).toBe("Utvalget finner uriktige opplysninger.");
    expect(m.andre_feil_i_saken).toEqual([{ kategori: "motor", vurdering: "ikke_mangel", grunn: "ikke_dokumentert" }]);
    expect(JSON.stringify(m)).not.toContain("fulltekst");
  });
});

describe("rensTekst", () => {
  it("fjerner kjøperens navn, e-post, telefon og regnummer", () => {
    const kjente = [
      { tekst: "Kari Nordmann", somSkrevet: false },
      { tekst: "Kari", somSkrevet: true },
    ];
    expect(rensTekst("Hei Kari, ring meg på 412 34 567 eller kari@example.no om EL 12345.", kjente)).toBe("Hei …, ring meg på … eller … om ….");
    // A part of the name only as written: «kari» in an ordinary word is kept.
    expect(rensTekst("Kari Nordmann skrev til Karikatur AS", kjente)).toBe("… skrev til Karikatur AS");
  });
});
