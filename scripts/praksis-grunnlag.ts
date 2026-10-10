// The basis for the jurist's fixed practice blocks (docs/praksis.md, src/lib/praksis/fast.ts): per track
// the 20 newest won decided defects against a dealer, with the committee's verified quotes, written to
// docs/praksis-grunnlag-<spor>.md. The jurist picks the examples and approves the text from there.
// Read-only; the quotes are from the redacted text.
//
//   npx tsx --env-file=.env.local scripts/praksis-grunnlag.ts

import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

const SPOR = ["A", "B", "C"] as const;
const ANTALL = 20;
const HVA: Record<string, string> = { A: "en skriftlig opplysning fra selger eller taushet om et dokumentert forhold", B: "formodningsregelen", C: "sakkyndig dokumentasjon av mer enn påregnelig slitasje" };

type Sitat = { tema: string; tekst: string; gjelder_feil: string[] };
type Bevis = { type: string; fremlagt_av: string; paregnelig: string; ved_levering: string; gjelder_feil: string[] };

async function main() {
  for (const spor of SPOR) {
    const { rows } = await db.execute(sql`
      select s.vedtak_id, s.feil_id, s.saksnummer, s.vedtaksdato::text as vedtaksdato, s.kategori, s.kilde_url, s.grunnlag, s.bevisgrunnlag,
        s.lovversjon::text as lovversjon, a.sanksjon, a.begrunnelse_sitater, a.bevis
      from vedtak_feil_sok s
      join vedtak_analyse a on a.vedtak_id = s.vedtak_id
      where s.vurdering = 'mangel' and ${spor} = any(s.spor_vunnet) and s.selger_type = 'forhandler' and s.utfall <> 'avvist'
        and s.vedtaksdato >= date '2021-01-01' and not s.ikke_mangelssak
      order by s.vedtaksdato desc, s.vedtak_id, s.feil_id
      limit ${ANTALL}`);
    const ut = [
      `# Grunnlag for den faste praksisblokken, spor ${spor}`,
      "",
      `*Generert av \`scripts/praksis-grunnlag.ts\` 2026-10-10. De ${ANTALL} nyeste vunne vedtaksfeilene på spor ${spor} (${HVA[spor]}) mot en forhandler, fra 2021. Juristen velger 2–3 eksempler og godkjenner blokkteksten i \`src/lib/praksis/fast.ts\`. Sitatene er kontrollert mot den rensede fulltekst.*`,
      "",
    ];
    for (const r of rows) {
      const feilId = String(r.feil_id);
      const egne = <T extends { gjelder_feil: string[] }>(xs: T[]) => xs.filter((x) => !x.gjelder_feil.length || x.gjelder_feil.includes(feilId));
      const sitater = egne(r.begrunnelse_sitater as Sitat[]);
      const bevis = egne(r.bevis as Bevis[]).filter((b) => b.fremlagt_av === "klager");
      ut.push(
        `## ${r.saksnummer} (${r.vedtaksdato}), ${r.kategori}`,
        "",
        `- **vedtak_id / feil:** ${r.vedtak_id} / ${feilId} · [vedtaket](${r.kilde_url})`,
        `- **Grunnlag:** ${r.grunnlag ?? "–"} · **bevisgrunnlag:** ${r.bevisgrunnlag ?? "–"} · **lovversjon:** ${r.lovversjon} · **sanksjon:** ${r.sanksjon ?? "–"}`,
        ...(bevis.length ? [`- **Klagerens bevis:** ${bevis.map((b) => `${b.type} (påregnelig: ${b.paregnelig}, ved levering: ${b.ved_levering})`).join("; ")}`] : []),
        ...sitater.map((s) => `- *${s.tema}:* «${s.tekst.trim()}»`),
        "",
      );
    }
    const fil = `docs/praksis-grunnlag-${spor}.md`;
    writeFileSync(fil, ut.join("\n"));
    console.log(`${fil}: ${rows.length} vedtaksfeil`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
