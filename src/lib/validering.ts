import { SITATFELT, type Tolkning } from "./ai/skjema";

export const MIN_KONFIDENS = 0.7;

export function dagerMellom(fra: string | null, til: string | null): number | null {
  if (!fra || !til) return null;
  const d = (Date.parse(til) - Date.parse(fra)) / 86_400_000;
  return Number.isFinite(d) ? Math.round(d) : null;
}

const normWs = (s: string) => s.replace(/[\s­]+/g, " ").replace(/[«»“”"]/g, '"').replace(/[’‘]/g, "'").trim().toLowerCase();

// Quotes are checked loosely (whitespace/quote marks/case), ignoring a trailing ellipsis.
export function sitatFinnes(sitat: string, tekst: string): boolean {
  const deler = normWs(sitat)
    .split(/\s*(?:\.\.\.|…|\[\.\.\.\]|\[…\])\s*/)
    .filter((d) => d.length >= 4);
  const t = normWs(tekst);
  return deler.length > 0 && deler.every((d) => t.includes(d));
}

// Reasons with this prefix are kept for context but do not by themselves flag the decision.
export const MERKNAD = "merknad: ";

// A total without its own quote is backed by its parts' quotes when it equals one part or the
// sum of the parts that have values.
function totalSitat(t: Tolkning, felt: "krevd_totalt_nok" | "tilkjent_totalt_nok", total: number): string | null {
  const pre = felt === "krevd_totalt_nok" ? "krevd" : "tilkjent";
  const deler = (["prisavslag", "erstatning"] as const)
    .map((d) => ({ verdi: t[`${pre}_${d}_nok`], sitat: t.sitater[`${pre}_${d}_nok`] }))
    .filter((d) => d.verdi != null);
  const lik = deler.find((d) => d.verdi === total);
  if (lik) return lik.sitat;
  const sum = deler.reduce((a, d) => a + (d.verdi ?? 0), 0);
  return deler.length > 1 && sum === total && deler.every((d) => d.sitat) ? deler.map((d) => d.sitat).join(" … ") : null;
}

export type Kontroll = { dagerTilReklamasjon: number | null; alderVedKjop: number | null; arsaker: string[] };

export function maaKontrolleres(arsaker: string[]): boolean {
  return arsaker.some((a) => !a.startsWith(MERKNAD));
}

/**
 * Plausibility checks after interpretation. `tekst` is the (redacted) full text the quotes are
 * checked against; the quotes must have been redacted the same way.
 */
export function kontroller(t: Tolkning, tekst: string, idag = new Date()): Kontroll {
  const arsaker: string[] = [];

  if (t.konfidens < MIN_KONFIDENS) arsaker.push(`lav konfidens (${t.konfidens})`);
  if (t.tolkningsmerknad) arsaker.push(`${MERKNAD}${t.tolkningsmerknad}`);

  // Every field with a value needs a quote, and every quote must be found in the text.
  for (const felt of SITATFELT) {
    const verdi = t[felt as keyof Tolkning];
    const harVerdi = Array.isArray(verdi) ? verdi.length > 0 : verdi != null && verdi !== "ukjent";
    let sitat = t.sitater[felt];
    // A total equal to one of its parts may rely on that part's quote.
    if (!sitat && verdi != null && (felt === "krevd_totalt_nok" || felt === "tilkjent_totalt_nok")) sitat = totalSitat(t, felt, verdi as number);
    // A dealer's company name in the text is itself evidence that the seller is a business.
    if (!sitat && felt === "selger_type" && t.selger_type === "forhandler" && t.selger_navn && sitatFinnes(t.selger_navn, tekst)) sitat = t.selger_navn;
    if (harVerdi && !sitat) arsaker.push(`${felt} mangler sitat`);
    if (sitat && !sitatFinnes(sitat, tekst)) arsaker.push(`sitat for ${felt} finnes ikke ordrett i vedtaket`);
  }

  // Amounts: awarded ≤ claimed, parts ≤ total.
  const par: [string, number | null, number | null][] = [
    ["prisavslag", t.krevd_prisavslag_nok, t.tilkjent_prisavslag_nok],
    ["erstatning", t.krevd_erstatning_nok, t.tilkjent_erstatning_nok],
    ["totalt", t.krevd_totalt_nok, t.tilkjent_totalt_nok],
  ];
  for (const [navn, krevd, tilkjent] of par) {
    if (krevd != null && tilkjent != null && tilkjent > krevd) arsaker.push(`tilkjent ${navn} (${tilkjent}) > krevd (${krevd})`);
  }
  const sjekkSum = (hva: string, total: number | null, deler: (number | null)[]) => {
    const kjente = deler.filter((d): d is number => d != null);
    if (total != null && kjente.length && kjente.reduce((a, b) => a + b, 0) > total + 1)
      arsaker.push(`${hva}: delbeløpene er større enn totalen`);
  };
  // Claims are often alternatives ("subsidiært"), so only awarded amounts must add up.
  sjekkSum("tilkjent", t.tilkjent_totalt_nok, [t.tilkjent_prisavslag_nok, t.tilkjent_erstatning_nok]);
  for (const [navn, v] of [
    ["kjøpesum", t.kjopesum_nok],
    ["krevd totalt", t.krevd_totalt_nok],
    ["tilkjent totalt", t.tilkjent_totalt_nok],
  ] as const) {
    if (v != null && (v < 0 || v > 5_000_000)) arsaker.push(`urimelig ${navn}: ${v}`);
  }

  // Outcome consistent with amounts.
  const tilkjent = t.tilkjent_totalt_nok ?? (t.tilkjent_prisavslag_nok ?? 0) + (t.tilkjent_erstatning_nok ?? 0);
  if ((t.utfall === "ikke_medhold" || t.utfall === "avvist") && tilkjent > 0)
    arsaker.push(`utfall ${t.utfall}, men ${tilkjent} kr tilkjent`);
  if (t.utfall === "medhold" && t.krevd_totalt_nok != null && t.tilkjent_totalt_nok != null && t.tilkjent_totalt_nok < t.krevd_totalt_nok)
    arsaker.push("utfall medhold, men tilkjent < krevd");
  if (t.utfall === "delvis_medhold" && t.krevd_totalt_nok != null && t.tilkjent_totalt_nok != null && t.tilkjent_totalt_nok >= t.krevd_totalt_nok && t.krevd_totalt_nok > 0)
    arsaker.push("utfall delvis medhold, men tilkjent ≥ krevd");

  // Dates in a plausible order.
  const rekkefolge: [string, string | null][] = [
    ["kjøpsdato", t.kjopsdato],
    ["overtakelsesdato", t.overtakelsesdato],
    ["første reklamasjon", t.forste_reklamasjon_dato],
    ["vedtaksdato", t.vedtaksdato],
  ];
  const kjente = rekkefolge.filter((r): r is [string, string] => r[1] != null);
  for (let i = 1; i < kjente.length; i++) {
    // Buying and handing over can be a few days apart in either direction.
    const slakk = kjente[i - 1][0] === "kjøpsdato" && kjente[i][0] === "overtakelsesdato" ? 14 : 0;
    const d = dagerMellom(kjente[i - 1][1], kjente[i][1]);
    if (d != null && d < -slakk) arsaker.push(`${kjente[i][0]} er før ${kjente[i - 1][0]}`);
  }
  for (const [navn, d] of rekkefolge) {
    if (!d) continue;
    const ms = Date.parse(d);
    if (!Number.isFinite(ms) || ms > idag.getTime() || ms < Date.parse("1990-01-01")) arsaker.push(`urimelig ${navn}: ${d}`);
  }

  const aar = idag.getFullYear();
  if (t.arsmodell != null && (t.arsmodell < 1950 || t.arsmodell > aar + 1)) arsaker.push(`urimelig årsmodell: ${t.arsmodell}`);
  if (t.km_ved_kjop != null && (t.km_ved_kjop < 0 || t.km_ved_kjop > 1_500_000)) arsaker.push(`urimelig km: ${t.km_ved_kjop}`);
  if (t.enstemmig === true && t.dissens === true) arsaker.push("både enstemmig og dissens");

  const dagerTilReklamasjon = dagerMellom(t.overtakelsesdato ?? t.kjopsdato, t.forste_reklamasjon_dato);
  const kjopsar = Number((t.kjopsdato ?? t.overtakelsesdato)?.slice(0, 4)) || null;
  const alderVedKjop = kjopsar && t.arsmodell ? Math.max(0, kjopsar - t.arsmodell) : null;

  return { dagerTilReklamasjon, alderVedKjop, arsaker };
}
