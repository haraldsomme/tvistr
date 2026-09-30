import * as cheerio from "cheerio";

// ACOS Innsyn (innsyn.onacos.no) hosts Forbrukertilsynet's case archives:
//   hist = Forbrukertvistutvalget, up to and including 2020
//   prod = Forbrukerklageutvalget, 2021 to May 2025
// Each case page links exactly one public document: the decision.

export type OnacosArkiv = "hist" | "prod";

const BASE = "https://innsyn.onacos.no/forbrukertilsynet";
export const SIDESTORRELSE = 10;

// Archive-specific classification filters for used cars and motorhomes.
export const FILTRE: Record<OnacosArkiv, { navn: string; params: Record<string, string> }[]> = {
  hist: [
    { navn: "bruktbil", params: { tkl1: "41", tkl2: "411", tkl3: "411.2" } },
    { navn: "campingvogn_bobil", params: { tkl1: "41", tkl2: "412.4", tkl3: "" } },
    // Cases from late 2018 to 2020 are unclassified; the title search also matches the summary.
    { navn: "tittel_bruktbil", params: { tittel: "bruktbil", tkl1: "", tkl2: "", tkl3: "" } },
    { navn: "tittel_brukt_bil", params: { tittel: "brukt bil", tkl1: "", tkl2: "", tkl3: "" } },
    { navn: "tittel_bobil", params: { tittel: "bobil", tkl1: "", tkl2: "", tkl3: "" } },
    // Other used vehicles (scope widened 2026-09-30): MC/moped, caravans, other transport.
    { navn: "mc_moped", params: { tkl1: "41", tkl2: "412.1", tkl3: "" } },
    { navn: "andre_transportmidler", params: { tkl1: "41", tkl2: "412", tkl3: "" } },
    { navn: "tittel_motorsykkel", params: { tittel: "motorsykkel", tkl1: "", tkl2: "", tkl3: "" } },
    { navn: "tittel_campingvogn", params: { tittel: "campingvogn", tkl1: "", tkl2: "", tkl3: "" } },
  ],
  prod: [
    { navn: "brukt_bil", params: { klasseringliste: "1.2 Brukt bil" } },
    { navn: "campingvogn_bobil", params: { klasseringliste: "1.3 Campingvogn/bobil" } },
    { navn: "andre_kjoretoy", params: { klasseringliste: "1.4 Andre kjøretøy" } },
  ],
};

export function listeUrl(arkiv: OnacosArkiv, filter: Record<string, string>, startrow: number): string {
  const p = new URLSearchParams({
    sakid: "",
    tittel: "",
    ...filter,
    sok: "Søk",
    startrow: String(startrow),
    showresults: "true",
    tomtsok: "false",
    simple: "false",
    response: "arkivsak_sok_tomdefault",
  });
  return `${BASE}/${arkiv}/wfinnsyn.ashx?${p}`;
}

export function sakUrl(arkiv: OnacosArkiv, arkivsakid: string): string {
  return `${BASE}/${arkiv}/wfinnsyn.ashx?response=arkivsak_detaljer&arkivsakid=${arkivsakid}&`;
}

export function parseListe(html: string): { arkivsakIder: string[]; sisteSide: number | null } {
  const $ = cheerio.load(html);
  const ider = new Set<string>();
  $("a[href*='arkivsakid=']").each((_, a) => {
    const m = ($(a).attr("href") ?? "").match(/arkivsakid=(\d+)/);
    if (m) ider.add(m[1]);
  });
  let sisteSide: number | null = null;
  $("a[href*='startrow=']").each((_, a) => {
    const m = ($(a).attr("href") ?? "").match(/startrow=(\d+)/);
    if (m) sisteSide = Math.max(sisteSide ?? 0, Number(m[1]) / SIDESTORRELSE + 1);
  });
  return { arkivsakIder: [...ider], sisteSide };
}

export type OnacosSak = {
  saksnummer: string | null;
  sakDato: string | null;
  moteDato: string | null;
  avgjorelsestype: string | null;
  dokumentUrl: string | null;
};

function norskDatoTilIso(s: string | null): string | null {
  const m = s?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Reads only non-personal metadata; titles are skipped because they name private parties.
export function parseSak(html: string, sideUrl: string): OnacosSak {
  const $ = cheerio.load(html);
  const felt = (label: string) => {
    const th = $("th").filter((_, e) => $(e).text().trim() === label).first();
    const v = th.next("td").text().trim();
    return v || null;
  };
  const href = $("a[href*='wfdocument.ashx']").first().attr("href");
  return {
    saksnummer: felt("ArkivsakID:"),
    sakDato: norskDatoTilIso(felt("Dato:")),
    moteDato: norskDatoTilIso(felt("Møtedato:")),
    avgjorelsestype: felt("Avgjørelsestype:"),
    dokumentUrl: href ? new URL(href, sideUrl).href : null,
  };
}

export function dokumentFilnavn(dokumentUrl: string): string {
  const u = new URL(dokumentUrl);
  return `${u.searchParams.get("journalpostid")}-${u.searchParams.get("dokid")}.pdf`;
}

// Journal post ids start with the year the decision document was journaled, e.g. 2016021173.
export function dokumentAr(dokumentUrl: string): number | null {
  const m = new URL(dokumentUrl).searchParams.get("journalpostid")?.match(/^(\d{4})\d+$/);
  return m ? Number(m[1]) : null;
}
