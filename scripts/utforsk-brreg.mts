import { sql } from "drizzle-orm";
import { db } from "../src/db";
const r = await db.execute(sql`select distinct selger_navn n from vedtak where selger_navn is not null and selger_type in ('forhandler','formidling') order by 1`);
const navn = r.rows.map((x: any) => x.n as string);
const tekn = (s: string) => s.toLowerCase().replace(/[.,]/g, " ").replace(/\b(as|asa)\b/g, "").replace(/\s+/g, " ").trim();
for (const n of navn) {
  const u = `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(n)}&size=5`;
  const j: any = await (await fetch(u)).json();
  const h = (j._embedded?.enheter ?? []) as any[];
  const eks = h.find((e) => tekn(e.navn) === tekn(n));
  console.log(`${n}  → ${j.page.totalElements} treff, ${eks ? "EKSAKT" : h.length ? "kun uklart" : "INGEN"}`);
  for (const e of h.slice(0, eks ? 1 : 3)) console.log(`     ${e.organisasjonsnummer} ${e.navn} | ${e.organisasjonsform?.kode} | ${e.naeringskode1?.beskrivelse ?? "-"} | ${e.forretningsadresse?.kommune ?? "-"} | ansatte ${e.antallAnsatte ?? "-"} | stiftet ${e.stiftelsesdato ?? "-"}${e.konkurs ? " KONKURS" : ""}${e.underAvvikling || e.underTvangsavviklingEllerTvangsopplosning ? " AVVIKLING" : ""}`);
}
