// What pass 1 and pass 2 extracted from each decision, for the practice paragraph. Never the full text.
import { sql } from "drizzle-orm";
import type { Analyse, HentAnalyse } from "./typer";

export function lagHentAnalyse(db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> }): HentAnalyse {
  return async (ider) => {
    if (!ider.length) return new Map();
    const { rows } = await db.execute(sql`
      select v.id, v.sammendrag, coalesce(v.utvalgets_nokkelmomenter, '{}') as utvalgets_nokkelmomenter, v.forbehold_tekst,
        v.tilkjent_prisavslag_nok, v.tilkjent_erstatning_nok, v.sitater, coalesce(v.kontroll_arsaker, '{}') as kontroll_arsaker, a.feil, a.begrunnelse_sitater
      from vedtak v join vedtak_analyse a on a.vedtak_id = v.id
      where v.id in (${sql.join(ider.map((id) => sql`${id}`), sql`, `)})`);
    return new Map(rows.map((r) => [Number(r.id), { ...r, id: undefined } as unknown as Analyse]));
  };
}
