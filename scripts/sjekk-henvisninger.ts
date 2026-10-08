// Checks every decision in the library the letter cites against the database and the decision
// text: id, dealer, outcome, link, date, case reference, committee, law, presumption, car age,
// every number in the sentences, and a verbatim quote behind every claim. Read-only; exits 1 on
// any error, so the library cannot drift from its sources.
//
//   npm run sjekk-henvisninger

import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { sitatFinnes } from "../src/lib/validering";
import { HENVISNINGER, REGELGRUNNLAG, type Henvisning, type Organ } from "../src/lib/vurdering/henvisninger";

const kjerne = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const beleggKreves = (h: Henvisning) => ["feil", "tid", "bil", "utfall", ...(h.regel ? ["regel"] : [])];

// The committee cites its own decisions as FKU-2019-759 for case 19/759; the newer case numbers already have that form.
function refFor(saksnummer: string, organ: Organ): string {
  const m = /^(\d{2})\/(\d+)$/.exec(saksnummer);
  return m ? `${organ === "Forbrukertvistutvalget" ? "FTU" : "FKU"}-20${m[1]}-${m[2]}` : saksnummer;
}

async function main() {
  const belegg = JSON.parse(readFileSync("scripts/henvisninger-belegg.json", "utf8")) as Record<string, Record<string, string>>;
  const feil: string[] = [];
  if (HENVISNINGER.length === 0) feil.push("biblioteket er tomt");
  const ider = HENVISNINGER.map((h) => h.vedtakId);
  for (const id of new Set(ider)) if (ider.filter((x) => x === id).length > 1) feil.push(`#${id} står flere ganger`);
  for (const g of REGELGRUNNLAG)
    if (!HENVISNINGER.some((h) => h.regel && h.grunnlag === g && h.lov === "før_2024")) feil.push(`grunnlaget ${g} mangler en post med regel etter gammel lov`);

  const rader = ider.length
    ? ((
        await db.execute(sql`select id, saksnummer, vedtaksdato::text vedtaksdato, kjopsdato::text kjopsdato, kilde_url, selger_type, utfall, selger_navn, alder_ved_kjop, fulltekst_renset
        from vedtak where id in (${sql.join(ider.map((i) => sql`${i}`), sql`, `)})`)
      ).rows as Record<string, unknown>[])
    : [];

  for (const h of HENVISNINGER) {
    const ut = (m: string) => feil.push(`#${h.vedtakId} ${h.ref}: ${m}`);
    const r = rader.find((x) => Number(x.id) === h.vedtakId);
    if (!r) {
      ut("finnes ikke i databasen");
      continue;
    }
    const tekst = String(r.fulltekst_renset ?? "");
    if (r.selger_type !== "forhandler") ut(`selger er ${r.selger_type}, ikke forhandler`);
    if (r.utfall !== "medhold" && r.utfall !== "delvis_medhold") ut(`utfall ${r.utfall}`);
    if (r.kilde_url !== h.kildeUrl) ut("kildeUrl er ulik databasen");
    if (r.vedtaksdato !== h.dato) ut(`dato ${h.dato}, databasen har ${r.vedtaksdato}`);
    const [a, m, d] = h.dato.split("-");
    if (![`${d}.${m}.${a}`, `${Number(d)}.${Number(m)}.${a}`].some((x) => tekst.includes(x))) ut("datoen står ikke i vedtaket");
    // The body that made the decision says so where it decides («… fatter slikt vedtak»); older headers do not always name it.
    const fatter = /(Forbrukertvistutvalget|Forbrukerklageutvalget) fatter slikt/i.exec(tekst)?.[1];
    const organ: Organ = fatter
      ? (fatter.toLowerCase() === "forbrukertvistutvalget" ? "Forbrukertvistutvalget" : "Forbrukerklageutvalget")
      : /FTU-sak|Forbrukertvistutvalget/.test(tekst.slice(0, 600)) ? "Forbrukertvistutvalget" : "Forbrukerklageutvalget";
    if (h.organ !== organ) ut(`organ ${h.organ}, toppteksten sier ${organ}`);
    if (h.ref !== refFor(String(r.saksnummer), organ)) ut(`ref ${h.ref}, ventet ${refFor(String(r.saksnummer), organ)}`);
    const lov = r.kjopsdato ? (String(r.kjopsdato) >= "2024-01-01" ? "etter_2024" : "før_2024") : null;
    if (lov !== h.lov) ut(`lov ${h.lov}, kjøpsdatoen i databasen er ${r.kjopsdato}`);
    if (r.alder_ved_kjop !== null && Math.abs(Number(r.alder_ved_kjop) - h.alder) > 1) ut(`alder ${h.alder}, databasen har ${r.alder_ved_kjop}`);
    if (h.km !== null && !kjerne(tekst).includes(String(h.km))) ut(`km ${h.km} står ikke i vedtaket`);

    const presumsjon = h.botte === "rask" || (h.lov === "etter_2024" && h.botte === "middels");
    if (h.presumsjon !== presumsjon) ut(`presumsjon ${h.presumsjon}, ventet ${presumsjon}`);
    if (h.regel && !h.grunnlag) ut("regel uten grunnlag");
    if (h.grunnlag === "formodning" && !h.presumsjon) ut("grunnlag formodning uten presumsjon");

    const setninger = [h.setning, h.likhet, h.konklusjon, ...(h.regel ? [h.regel] : [])];
    for (const s of setninger) {
      if (/[[\]]/.test(s)) ut(`hakeparentes i «${s}»`);
      if (r.selger_navn && kjerne(String(r.selger_navn)).length >= 3 && kjerne(s).includes(kjerne(String(r.selger_navn)))) ut(`forhandlerens navn i «${s}»`);
      // Amounts and mileage must be in the text; small numbers (months, days) are often worked out from dates.
      for (const t of s.match(/\d[\d  ]*\d/g) ?? []) {
        const n = t.replace(/[\s ]/g, "");
        if (Number(n) >= 1000 && !kjerne(tekst).includes(n)) ut(`tallet ${t} står ikke i vedtaket`);
      }
    }

    const b = belegg[String(h.vedtakId)];
    if (!b) ut("mangler belegg");
    else {
      for (const k of beleggKreves(h)) if (!b[k]) ut(`mangler belegg for «${k}»`);
      for (const [k, sitat] of Object.entries(b)) if (!sitatFinnes(sitat, tekst)) ut(`belegget for «${k}» står ikke ordrett i vedtaket: «${sitat}»`);
    }
  }

  for (const f of feil) console.error(f);
  console.log(`${HENVISNINGER.length} poster, ${feil.length} feil.`);
  if (feil.length > 0) process.exit(1);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
