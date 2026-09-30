import { sql } from "drizzle-orm";
import { db } from "../src/db";
const r = await db.execute(sql`select distinct selger_navn n from vedtak where selger_navn is not null and selger_type in ('forhandler','formidling') order by 1`);
const navn = r.rows.map((x: any) => x.n as string);
const kjerne = (s: string) => s.replace(/[.,]/g, " ").replace(/\b(as|asa)\b/gi, "").replace(/\s+/g, " ").trim();
const tekn = (s: string) => kjerne(s).toLowerCase().replace(/[^a-zæøå0-9]/g, "");
let eksakt = 0, prefiks = 0, ingen = 0;
for (const n of navn) {
  const q = kjerne(n);
  const u = `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(q)}&organisasjonsform=AS,ASA&size=20`;
  const j: any = await (await fetch(u)).json();
  const h = (j._embedded?.enheter ?? []) as any[];
  const e = h.find((x) => tekn(x.navn) === tekn(n));
  const p = h.filter((x) => tekn(x.navn).startsWith(tekn(n)) || tekn(n).startsWith(tekn(x.navn)));
  if (e) { eksakt++; console.log(`✔ ${n} → ${e.organisasjonsnummer} ${e.navn}${h.filter(x=>tekn(x.navn)===tekn(n)).length>1?" (FLERE eksakte!)":""}`); }
  else if (p.length) { prefiks++; console.log(`~ ${n} → ${p.slice(0,3).map((x) => `${x.organisasjonsnummer} ${x.navn} [${x.forretningsadresse?.kommune}]`).join(" | ")}`); }
  else { ingen++; console.log(`✘ ${n}  (${j.page.totalElements} treff; topp: ${h.slice(0,2).map((x) => x.navn).join(" | ")})`); }
}
console.log({ eksakt, prefiks, ingen, totalt: navn.length });
