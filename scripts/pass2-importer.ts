// Imports the pass 2 agent answers into vedtak_analyse and vedtak_feil (docs/pass2-design.md § 6–7).
// Hard errors move the answer to data/pass2/avvist/; everything else is repaired and flagged.
//
//   npm run pass2:importer -- [--mappe data/pass2/ut] [--id 12,34] [--modell "..."] [--tørrkjøring]

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak, vedtakAnalyse, vedtakFeil } from "../src/db/schema";
import { avledAnalyse, avledSanksjon } from "../src/lib/analyse/avled";
import { INSTRUKS_VERSJON, type Pass2Svar } from "../src/lib/analyse/skjema";
import { hardeFeil, verifiserSvar } from "../src/lib/analyse/verifiser";

const { values: args } = parseArgs({
  options: {
    mappe: { type: "string", default: "data/pass2/ut" },
    id: { type: "string" },
    modell: { type: "string", default: "claude-sonnet-5-5 (Claude Code-agent)" },
    "tørrkjøring": { type: "boolean", default: false },
  },
});

const M = "data/pass2";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const GRUNNUTVALG = sql`${vedtak.kjoretoytype} in ('personbil','varebil') and ${vedtak.utfall} <> 'avvist' and ${vedtak.lov} = 'forbrukerkjøpsloven'`;

async function main() {
  const monster = new RegExp(`^(\\d+)\\.${INSTRUKS_VERSJON.replace(/\./g, "\\.")}\\.json$`);
  const valgte = args.id ? new Set(args.id.split(",").map(Number)) : null;
  const filer = readdirSync(args.mappe!)
    .map((f) => ({ f, id: Number(monster.exec(f)?.[1] ?? NaN) }))
    .filter((x) => !Number.isNaN(x.id) && (!valgte || valgte.has(x.id)));
  if (!filer.length) {
    console.log(`Ingen svarfiler for ${INSTRUKS_VERSJON} i ${args.mappe}.`);
    return;
  }
  for (const d of ["avvist", "avledet"]) mkdirSync(join(M, d), { recursive: true });

  const rader = await db
    .select({
      id: vedtak.id,
      fulltekstRenset: vedtak.fulltekstRenset,
      utfall: vedtak.utfall,
      tilkjentTotaltNok: vedtak.tilkjentTotaltNok,
      tilkjentPrisavslagNok: vedtak.tilkjentPrisavslagNok,
      tilkjentErstatningNok: vedtak.tilkjentErstatningNok,
      kravtyper: vedtak.kravtyper,
      kjopesumNok: vedtak.kjopesumNok,
      kjopsdato: vedtak.kjopsdato,
      overtakelsesdato: vedtak.overtakelsesdato,
      vedtaksdato: vedtak.vedtaksdato,
      klagerErForbruker: vedtak.klagerErForbruker,
    })
    .from(vedtak)
    .where(sql`${inArray(vedtak.id, filer.map((x) => x.id))} and ${GRUNNUTVALG}`);
  const perId = new Map(rader.map((r) => [r.id, r]));

  const telling = { importert: 0, avvist: 0, sitaterForsokt: 0, sitaterNullet: 0, medKontrollArsaker: 0, feilpunkter: 0 };
  const arsaker = new Map<string, number>();
  const avvisteIder: number[] = [];

  for (const { f, id } of filer) {
    const raa = readFileSync(join(args.mappe!, f), "utf8");
    const avvistSti = join(M, "avvist", f);
    const avvis = (feil: string[]) => {
      writeFileSync(avvistSti, JSON.stringify({ fil: join(args.mappe!, f), feil, raasvar: raa }, null, 2));
      telling.avvist++;
      avvisteIder.push(id);
    };
    let json: unknown;
    try {
      json = JSON.parse(raa);
    } catch (e) {
      avvis([`ugyldig JSON: ${(e as Error).message}`]);
      continue;
    }
    const v = perId.get(id);
    const harde = hardeFeil(json, id, !!v?.fulltekstRenset);
    if (harde.length) {
      avvis(harde);
      continue;
    }
    const fakta = { ...v!, fulltekstRenset: v!.fulltekstRenset! };
    const r = verifiserSvar(json as Pass2Svar, fakta);
    const { analyse, feil } = avledAnalyse(r.svar, fakta);
    writeFileSync(join(M, "avledet", f), JSON.stringify({ vedtak_id: id, lovversjon: analyse.lovversjon, ikkeMangelssak: analyse.ikkeMangelssak, feil }, null, 2));

    telling.sitaterForsokt += r.sitaterForsokt;
    telling.sitaterNullet += r.sitaterNullet;
    telling.feilpunkter += feil.length;
    if (r.kontrollArsaker.length) telling.medKontrollArsaker++;
    for (const a of r.kontrollArsaker) {
      const nokkel = a.replace(/:.*$/, "");
      arsaker.set(nokkel, (arsaker.get(nokkel) ?? 0) + 1);
    }
    if (existsSync(avvistSti)) rmSync(avvistSti);
    if (args["tørrkjøring"]) {
      telling.importert++;
      continue;
    }

    const rad = {
      ...analyse,
      sanksjon: avledSanksjon(fakta),
      instruksVersjon: INSTRUKS_VERSJON,
      aiModell: args.modell!,
      analysertTidspunkt: new Date(),
      fulltekstSha256: sha(fakta.fulltekstRenset),
      raasvarSha256: sha(raa),
      feil: r.svar.feil,
      opplysninger: r.svar.opplysninger,
      bevis: r.svar.bevis,
      begrunnelseSitater: r.svar.begrunnelse_sitater,
      usikkerhet: r.svar.usikkerhet,
      kontrollArsaker: r.kontrollArsaker,
    };
    // Upsert the analysis first (vedtak_feil references it), then replace all defect rows so a
    // re-import never leaves rows from an earlier answer behind.
    const upsert = db.insert(vedtakAnalyse).values({ vedtakId: id, ...rad }).onConflictDoUpdate({ target: vedtakAnalyse.vedtakId, set: rad });
    const slett = db.delete(vedtakFeil).where(eq(vedtakFeil.vedtakId, id));
    if (feil.length) await db.batch([upsert, slett, db.insert(vedtakFeil).values(feil.map((x) => ({ vedtakId: id, ...x })))]);
    else await db.batch([upsert, slett]);
    telling.importert++;
  }

  const oppsummering = {
    versjon: INSTRUKS_VERSJON,
    mappe: args.mappe,
    tørrkjøring: args["tørrkjøring"],
    ...telling,
    andelSitaterNullet: telling.sitaterForsokt ? telling.sitaterNullet / telling.sitaterForsokt : 0,
    kontrollArsaker: Object.fromEntries([...arsaker].sort((a, b) => b[1] - a[1])),
    avvisteIder,
  };
  writeFileSync(join(M, `import-${INSTRUKS_VERSJON}.json`), JSON.stringify(oppsummering, null, 2));
  console.table(telling);
  console.table(oppsummering.kontrollArsaker);
  if (avvisteIder.length) console.log(`Avvist (se ${join(M, "avvist")}): ${avvisteIder.join(",")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
