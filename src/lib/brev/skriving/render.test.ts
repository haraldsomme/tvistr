import { describe, expect, it } from "vitest";
import { brevhode, norskDato } from "../brev";
import { planlegg, type ArgumentId } from "./brevplan";
import { brevTekst, fyllInn, skrevetBrev } from "./render";
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
