import { describe, expect, it } from "vitest";
import { brevhode, harPlassholder, norskDato } from "../brev";
import { planlegg, type ArgumentId } from "./brevplan";
import { brevTekst, fyllInn, HENVISNING_MANGLER, lagretBrev, skrevetBrev } from "./render";
import type { Utkast } from "./typer";
import { avsender, feilen, modell, svar } from "./testdata";

const utkast = (tekst: string, sitater: Utkast["sitater"] = []): Utkast => ({ sitater, avsnitt: [{ setninger: [{ tekst, argumenter: [] }] }] });

describe("fyllInn", () => {
  const m = modell({
    svar: svar({ kontakt: "ja" }),
    utfylling: { feilen, avsender, retting: "avvist", reklamasjon: { dato: "2026-04-05", mate: "epost" }, krav: { type: "prisavslag", utgifter: [] } },
    kilder: { rapport: "Reimen er sterkt slitt." },
  });
  const p = planlegg(m);

  it("setter inn sitatet ordrett i «» uten eget sluttpunktum", () => {
    expect(fyllInn(utkast("Rapporten sier {{sitat:r1}}.", [{ id: "r1", kilde: "rapport", tekst: "Reimen er sterkt slitt." }]), p, m, "2026-10-20")[0].avsnitt[0]).toBe("Rapporten sier «Reimen er sterkt slitt».");
  });

  it("setter punktum etter et sitat som avslutter setningen", () => {
    const sitater = [{ id: "r1", kilde: "rapport" as const, tekst: "Reimen er sterkt slitt." }];
    expect(fyllInn(utkast("Rapporten sier {{sitat:r1}}", sitater), p, m, "2026-10-20")[0].avsnitt[0]).toBe("Rapporten sier «Reimen er sterkt slitt».");
  });

  it("regner svarfristen fra brevets dato", () => {
    expect(fyllInn(utkast("Svar innen {{dato:svarfrist}}."), p, m, "2026-10-20")[0].avsnitt[0]).toBe("Svar innen 3. november 2026.");
  });

  it("setter inn kilden til vedtaket, kontonummeret og e-posten, og lenken til slutt", () => {
    const h = p.henvisning!;
    const [forste, vedlegg] = fyllInn(utkast("Se {{henvisning}}. Konto {{kontonummer}}, e-post {{epost}}."), p, m, "2026-10-20");
    expect(vedlegg).toEqual({ overskrift: "Vedlegg", avsnitt: [`Vedtaket ${h.ref} er tilgjengelig på ${h.kildeUrl}.`] });
    expect(forste.avsnitt[0]).toBe(`Se ${h.ref} av ${norskDato(h.dato)}. Konto 1234 56 78903, e-post test@example.com.`);
  });

  it("legger på det samme brevhodet som malen", () => {
    const b = skrevetBrev(utkast("Tekst."), p, m, "2026-10-20");
    expect(b).toEqual({
      ...brevhode(m.utfylling, "2026-10-20"),
      deler: [
        { overskrift: null, avsnitt: ["Tekst."] },
        { overskrift: "Vedlegg", avsnitt: [`Vedtaket ${p.henvisning!.ref} er tilgjengelig på ${p.henvisning!.kildeUrl}.`] },
      ],
    });
    expect(b.stedDato).toBe("Oslo, 20. oktober 2026");
  });

  it("et lagret brev viser til vedtaket det ble skrevet med, ikke det saken gir nå", () => {
    const lagret = { ref: "FKU-2020-1234", organ: "Forbrukerklageutvalget" as const, dato: "2020-05-04", kildeUrl: "https://example.org/vedtak.pdf" };
    const b = lagretBrev({ utkast: utkast("Se {{henvisning}}."), avvik: [], funn: [], grunnlag: "", versjon: "", skrevet: "", henvisning: lagret }, p, m, "2026-10-20");
    expect(lagret.ref).not.toBe(p.henvisning!.ref);
    expect(b.deler).toEqual([
      { overskrift: null, avsnitt: ["Se FKU-2020-1234 av 4. mai 2020."] },
      { overskrift: "Vedlegg", avsnitt: ["Vedtaket FKU-2020-1234 er tilgjengelig på https://example.org/vedtak.pdf."] },
    ]);
  });

  it("et brev skrevet før vedtaket ble lagret, får et gult felt og ingen lenke", () => {
    const b = lagretBrev({ utkast: utkast("Se {{henvisning}}."), avvik: [], funn: [], grunnlag: "", versjon: "", skrevet: "" }, p, m, "2026-10-20");
    expect(b.deler).toEqual([{ overskrift: null, avsnitt: [`Se ${HENVISNING_MANGLER}.`] }]);
    expect(harPlassholder(b)).toBe(true);
  });

  it("deler avsnittene under overskrifter etter argumentene de dekker, og aldri bakover", () => {
    const a = (tekst: string, ...argumenter: ArgumentId[]) => ({ setninger: [{ tekst, argumenter }] });
    const u: Utkast = { sitater: [], avsnitt: [a("Kjøpet.", "innledning"), a("Feilen.", "feilen"), a("Overgang."), a("Mangel.", "mangel"), a("Hendelse.", "historikk"), a("Svar.", "svarfrist")] };
    const deler = fyllInn(u, p, m, "2026-10-20");
    expect(deler.map((d) => [d.overskrift, d.avsnitt.length])).toEqual([
      [null, 1],
      ["Faktum", 2],
      ["Rettslig grunnlag", 2],
      ["Svarfrist og videre saksgang", 1],
      ["Vedlegg", 1],
    ]);
    expect(brevTekst(deler)).toMatch(/^Kjøpet\.\n\nFaktum\n\nFeilen\./);
  });
});
