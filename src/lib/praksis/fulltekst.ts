// The decisions' redacted full texts ([KLAGER]/[PERSON]); never the raw PDF text.
import { sql } from "drizzle-orm";
import type { HentFulltekst } from "./typer";

export function lagHentFulltekst(db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> }): HentFulltekst {
  return async (ider) => {
    if (!ider.length) return new Map();
    const { rows } = await db.execute(sql`select id, fulltekst_renset from vedtak where id in (${sql.join(ider.map((id) => sql`${id}`), sql`, `)})`);
    return new Map(rows.filter((r) => r.fulltekst_renset).map((r) => [Number(r.id), String(r.fulltekst_renset)]));
  };
}
