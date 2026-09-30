// Downloads used-car decisions (2013 →) from the three archives into data/raw/ and registers
// them in `kildedokument`. Resumable: case state lives in `kildesak`, so a rerun skips finished
// cases and retries failed ones. Never prints titles or party names.
//
//   npm run hent -- [--arkiv hist|prod|wp|alle] [--grense N] [--uten-liste] [--bare-liste]

import { createHash } from "node:crypto";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "../src/db";
import { kildedokument, kildesak } from "../src/db/schema";
import { hent, hentTekst, TilgangSperretError } from "../src/lib/crawler/http";
import * as onacos from "../src/lib/kilder/onacos";
import * as wp from "../src/lib/kilder/wp";

type Arkiv = "hist" | "prod" | "wp";

const FRA_AR = 2013;
const MAKS_FORSOK = 3;

const { values: args } = parseArgs({
  options: {
    arkiv: { type: "string", default: "alle" },
    grense: { type: "string" },
    "uten-liste": { type: "boolean", default: false },
    "bare-liste": { type: "boolean", default: false },
  },
});
const ALLE: Arkiv[] = ["hist", "prod", "wp"];
if (args.arkiv !== "alle" && !ALLE.includes(args.arkiv as Arkiv)) {
  console.error(`Ukjent --arkiv ${args.arkiv}; bruk hist, prod, wp eller alle.`);
  process.exit(1);
}
const arkiver: Arkiv[] = args.arkiv === "alle" ? ALLE : [args.arkiv as Arkiv];
const grense = args.grense ? Number(args.grense) : Infinity;

async function registrerSaker(arkiv: Arkiv, filter: string, saker: { id: string; meta?: Record<string, string | null> }[]) {
  if (!saker.length) return 0;
  const inserted = await db
    .insert(kildesak)
    .values(saker.map((s) => ({ kildeArkiv: arkiv, eksternId: s.id, filter, meta: s.meta ?? null })))
    .onConflictDoNothing()
    .returning({ id: kildesak.id });
  return inserted.length;
}

async function listOnacos(arkiv: "hist" | "prod") {
  for (const f of onacos.FILTRE[arkiv]) {
    let side = 0;
    let sider = 1;
    let nye = 0;
    while (side < sider) {
      const liste = onacos.parseListe(await hentTekst(onacos.listeUrl(arkiv, f.params, side * onacos.SIDESTORRELSE)));
      sider = Math.max(sider, liste.sisteSide ?? 1);
      nye += await registrerSaker(arkiv, f.navn, liste.arkivsakIder.map((id) => ({ id })));
      side++;
      if (side % 10 === 0 || side === sider) console.log(`  ${arkiv}/${f.navn}: side ${side}/${sider}, ${nye} nye saker`);
    }
  }
}

async function listWp() {
  const alle = wp.parseIndeks(await hentTekst(wp.INDEKS_URL));
  const bil = alle.filter((v) => v.kategori === wp.BIL_KATEGORI);
  const nye = await registrerSaker(
    "wp",
    wp.BIL_KATEGORI,
    bil.map((v) => ({ id: v.task_id, meta: { dato: v.dato, pdf_filnavn: v.pdf_filnavn } })),
  );
  console.log(`  wp: ${bil.length} av ${alle.length} i kategori ${wp.BIL_KATEGORI}, ${nye} nye saker`);
}

type Dokumentinfo = { url: string; filnavn: string; saksnummer: string | null; ar: number | null };

// Resolves where the decision document is, or why there is none to fetch.
async function finnDokument(sak: typeof kildesak.$inferSelect): Promise<Dokumentinfo | { status: "ingen_dokument" | "hoppet_over"; grunn: string }> {
  if (sak.kildeArkiv === "wp") {
    const filnavn = sak.meta?.pdf_filnavn;
    if (!filnavn) return { status: "ingen_dokument", grunn: "mangler pdf_filnavn i indeksen" };
    return { url: wp.pdfUrl(filnavn), filnavn, saksnummer: filnavn.replace(/\.pdf$/i, ""), ar: Number(sak.meta?.dato?.slice(0, 4)) || null };
  }
  const arkiv = sak.kildeArkiv;
  const url = onacos.sakUrl(arkiv, sak.eksternId);
  const info = onacos.parseSak(await hentTekst(url), url);
  if (!info.dokumentUrl) return { status: "ingen_dokument", grunn: info.avgjorelsestype ?? "ingen publisert dokumentlenke" };
  const ar = onacos.dokumentAr(info.dokumentUrl) ?? (info.moteDato ? Number(info.moteDato.slice(0, 4)) : null);
  if (ar !== null && ar < FRA_AR) return { status: "hoppet_over", grunn: `vedtaksår ${ar} < ${FRA_AR}` };
  return { url: info.dokumentUrl, filnavn: onacos.dokumentFilnavn(info.dokumentUrl), saksnummer: info.saksnummer, ar };
}

async function oppdaterSak(id: number, verdier: Partial<typeof kildesak.$inferInsert>) {
  await db.update(kildesak).set({ ...verdier, oppdatert: new Date() }).where(eq(kildesak.id, id));
}

async function behandle(sak: typeof kildesak.$inferSelect) {
  const dok = await finnDokument(sak);
  if ("status" in dok) {
    await oppdaterSak(sak.id, { status: dok.status, grunn: dok.grunn });
    return dok.status;
  }

  const r = await hent(dok.url);
  const erPdf = r.status === 200 && (r.contentType.includes("pdf") || r.body.subarray(0, 5).toString() === "%PDF-");
  if (!erPdf) {
    const feilmelding = `HTTP ${r.status}, content-type ${r.contentType}`;
    const [kd] = await db
      .insert(kildedokument)
      .values({ kildeArkiv: sak.kildeArkiv, kildeUrl: dok.url, saksnummer: dok.saksnummer, ar: dok.ar, httpStatus: r.status, status: "feilet", feilmelding })
      .onConflictDoUpdate({ target: kildedokument.kildeUrl, set: { httpStatus: r.status, status: "feilet", feilmelding } })
      .returning({ id: kildedokument.id });
    await oppdaterSak(sak.id, { status: "feilet", grunn: feilmelding, forsok: sak.forsok + 1, kildedokumentId: kd.id });
    return "feilet";
  }

  const sha256 = createHash("sha256").update(r.body).digest("hex");
  const [finnes] = await db.select({ id: kildedokument.id, url: kildedokument.kildeUrl }).from(kildedokument).where(eq(kildedokument.sha256, sha256));
  if (finnes && finnes.url !== dok.url) {
    await oppdaterSak(sak.id, { status: "duplikat", grunn: "samme innhold som et annet dokument", kildedokumentId: finnes.id });
    return "duplikat";
  }

  const mappe = `data/raw/${sak.kildeArkiv}`;
  mkdirSync(mappe, { recursive: true });
  const sti = `${mappe}/${dok.filnavn}`;
  writeFileSync(sti + ".tmp", r.body);
  renameSync(sti + ".tmp", sti);

  const felter = { lokalSti: sti, sha256, saksnummer: dok.saksnummer, ar: dok.ar, hentetTidspunkt: new Date(), httpStatus: r.status, feilmelding: null };
  const [kd] = await db
    .insert(kildedokument)
    .values({ kildeArkiv: sak.kildeArkiv, kildeUrl: dok.url, status: "hentet", ...felter })
    // A rerun after a failure resets the status; already classified/interpreted documents keep theirs.
    .onConflictDoUpdate({
      target: kildedokument.kildeUrl,
      set: { ...felter, status: sql`case when ${kildedokument.status} = 'feilet' then 'hentet'::dokument_status else ${kildedokument.status} end` },
    })
    .returning({ id: kildedokument.id });
  await oppdaterSak(sak.id, { status: "hentet", grunn: null, kildedokumentId: kd.id });
  return "hentet";
}

async function main() {
  let igjen = grense;
  for (const arkiv of arkiver) {
    if (!args["uten-liste"]) {
      console.log(`Lister saker i ${arkiv} …`);
      if (arkiv === "wp") await listWp();
      else await listOnacos(arkiv);
    }
    if (args["bare-liste"]) continue;

    const ventende = await db
      .select()
      .from(kildesak)
      .where(
        and(eq(kildesak.kildeArkiv, arkiv), inArray(kildesak.status, ["ny", "feilet"]), lt(kildesak.forsok, MAKS_FORSOK)),
      )
      .orderBy(kildesak.id);
    console.log(`${arkiv}: ${ventende.length} saker å behandle`);

    const telling: Record<string, number> = {};
    for (const [i, sak] of ventende.entries()) {
      if (igjen <= 0) break;
      let utfall: string;
      try {
        utfall = await behandle(sak);
      } catch (e) {
        if (e instanceof TilgangSperretError) throw e;
        utfall = "feilet";
        await oppdaterSak(sak.id, { status: "feilet", grunn: (e as Error).message.slice(0, 500), forsok: sak.forsok + 1 });
      }
      telling[utfall] = (telling[utfall] ?? 0) + 1;
      if (utfall === "hentet") igjen--;
      if ((i + 1) % 25 === 0 || i === ventende.length - 1 || igjen <= 0) {
        console.log(`  ${arkiv} ${i + 1}/${ventende.length}: ${JSON.stringify(telling)}`);
      }
    }
    if (igjen <= 0) {
      console.log(`Nådde --grense ${grense}.`);
      break;
    }
  }

  const status = await db
    .select({ arkiv: kildesak.kildeArkiv, status: kildesak.status, antall: sql<number>`count(*)::int` })
    .from(kildesak)
    .groupBy(kildesak.kildeArkiv, kildesak.status)
    .orderBy(kildesak.kildeArkiv, kildesak.status);
  console.table(status);
}

main().catch((e) => {
  if (e instanceof TilgangSperretError) {
    console.error(`STOPP: ${e.message} Rapporter til prosjekteier; ikke prøv å omgå.`);
    process.exit(2);
  }
  console.error(e);
  process.exit(1);
});
