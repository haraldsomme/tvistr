import { describe, expect, it } from "vitest";
import { dokumentAr, dokumentFilnavn, listeUrl, parseListe, parseSak } from "./onacos";

const sakHtml = `<html><body><table>
<tr><th class="header-cell left">ArkivsakID:</th><td class="content-cell">24/3823</td></tr>
<tr><th class="header-cell left">Dato:</th><td class="content-cell">04.04.2024</td></tr>
<tr><th class="header-cell left">Tittel:</th><td class="content-cell">Klage på bil</td></tr>
<tr><th class="header-cell left">Avgjørelsestype:</th><td class="content-cell">Saken er avsluttet</td></tr>
<tr><th class="left header-cell">Møtedato:</th><td class="content-cell">24.02.2025</td></tr>
</table>
<div class="sec"><ul class="i-jp"><li class="np i-par i-jp"><div class="i-fl doc">
<a href="https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024063843&amp;dokid=1247728&amp;versjon=1&amp;variant=A&amp;">Dokument</a>
</div></li></ul></div></body></html>`;

const listeHtml = `<ul>
<li class="ctm_vedtak"><a href="/forbrukertilsynet/prod/wfinnsyn.ashx?response=arkivsak_detaljer&arkivsakid=2024003823&">a</a>
<a href="/forbrukertilsynet/prod/wfinnsyn.ashx?response=arkivsak_detaljer&arkivsakid=2024003823&">b</a></li>
<li class="ctm_vedtak"><a href="/forbrukertilsynet/prod/wfinnsyn.ashx?response=arkivsak_detaljer&arkivsakid=2024000700&">c</a></li>
</ul>
<a href="wfinnsyn.ashx?startrow=10&x">2</a><a href="wfinnsyn.ashx?startrow=1440&x">145</a>`;

describe("onacos", () => {
  it("parses case metadata and the decision link", () => {
    const sak = parseSak(sakHtml, "https://innsyn.onacos.no/forbrukertilsynet/prod/wfinnsyn.ashx");
    expect(sak).toEqual({
      saksnummer: "24/3823",
      sakDato: "2024-04-04",
      moteDato: "2025-02-24",
      avgjorelsestype: "Saken er avsluttet",
      dokumentUrl:
        "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024063843&dokid=1247728&versjon=1&variant=A&",
    });
    expect(dokumentFilnavn(sak.dokumentUrl!)).toBe("2024063843-1247728.pdf");
    expect(dokumentAr(sak.dokumentUrl!)).toBe(2024);
  });

  it("parses unique case ids and the last page from a result list", () => {
    expect(parseListe(listeHtml)).toEqual({ arkivsakIder: ["2024003823", "2024000700"], sisteSide: 145 });
  });

  it("builds list URLs with the classification filter", () => {
    const url = new URL(listeUrl("prod", { klasseringliste: "1.2 Brukt bil" }, 20));
    expect(url.searchParams.get("klasseringliste")).toBe("1.2 Brukt bil");
    expect(url.searchParams.get("startrow")).toBe("20");
    expect(url.pathname).toBe("/forbrukertilsynet/prod/wfinnsyn.ashx");
  });
});
