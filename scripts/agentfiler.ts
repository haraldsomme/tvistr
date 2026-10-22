// The frame the hent and importer scripts for the agent passes share (feilvurdering, avgjorende):
// choosing decisions, writing the agents' input files and id list, and reading their answers back.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lagreStatistikk } from "../src/lib/vurdering/statistikk-db";
import { kjorParallelt } from "../src/lib/parallell";

export const tall = (s: string) => s.split(",").filter(Boolean).map(Number);

// The first option given picks the decisions; the list is named after it unless --navn is given.
export async function velg(navn: string | undefined, valg: Record<string, (() => Promise<number[]>) | undefined>) {
  for (const [k, hent] of Object.entries(valg)) if (hent) return { navn: navn ?? k, valgte: await hent() };
  throw new Error(`Velg ${Object.keys(valg).map((k) => `--${k}`).join(", ")}.`);
}

// One file per decision in <mappe>/inn and the ids in <mappe>/lister/<navn>.json, in the chosen
// order (the order the agents get). A decision whose text is null is skipped.
export function skrivInnfiler<R extends { id: number }>(mappe: string, navn: string, valgte: number[], rader: R[], tekst: (r: R) => string | null, grunn: string) {
  mkdirSync(join(mappe, "inn"), { recursive: true });
  mkdirSync(join(mappe, "lister"), { recursive: true });
  const skrevet: number[] = [];
  for (const id of valgte) {
    const r = rader.find((x) => x.id === id);
    const t = r ? tekst(r) : null;
    if (t === null) continue;
    writeFileSync(join(mappe, "inn", `${id}.txt`), t);
    skrevet.push(id);
  }
  const liste = join(mappe, "lister", `${navn}.json`);
  writeFileSync(liste, JSON.stringify(skrevet));
  console.log(`${skrevet.length} inn-filer skrevet, liste: ${liste}`);
  const uten = valgte.length - skrevet.length;
  if (uten) console.log(`${uten} uten ${grunn} ble hoppet over.`);
}

type Lest = { ok: false; feil: string } | { ok: true; kontroll: string[] };

// Reads the answers in <mappe>/ut/<id>.<versjon>.json (all of them, or the ids in lister/<liste>.json),
// checks and stores each with `lagre`, and writes those with hard errors to <mappe>/avvist with the
// reason. The checks are counted per kind (`art`), so the summary shows patterns.
export async function importerSvar<V extends { fulltekst: string | null }>(o: {
  mappe: string;
  versjon: string;
  liste?: string;
  hent: (id: number) => Promise<V | undefined>;
  lagre: (id: number, raa: unknown, v: V & { fulltekst: string }) => Promise<Lest>;
  art: (kontroll: string) => string;
}) {
  const ut = join(o.mappe, "ut");
  const avvistMappe = join(o.mappe, "avvist");
  const slutt = `.${o.versjon}.json`;
  mkdirSync(avvistMappe, { recursive: true });
  const alle = o.liste
    ? (JSON.parse(readFileSync(join(o.mappe, "lister", `${o.liste}.json`), "utf8")) as number[])
    : readdirSync(ut)
        .filter((f) => f.endsWith(slutt))
        .map((f) => Number(f.slice(0, -slutt.length)))
        .filter(Number.isInteger);
  let lagret = 0;
  let manglerSvar = 0;
  const avvist: string[] = [];
  const kontrollAntall = new Map<string, number>();

  await kjorParallelt(alle, 6, async (id) => {
    const fil = join(ut, `${id}${slutt}`);
    if (!existsSync(fil)) {
      manglerSvar++;
      return;
    }
    const v = await o.hent(id);
    let raa: unknown;
    try {
      raa = JSON.parse(readFileSync(fil, "utf8"));
    } catch {
      raa = undefined;
    }
    const lest: Lest = !v?.fulltekst
      ? { ok: false, feil: "vedtaket eller fulltekst finnes ikke" }
      : raa === undefined
        ? { ok: false, feil: "ugyldig JSON" }
        : await o.lagre(id, raa, v as V & { fulltekst: string });
    if (!lest.ok) {
      avvist.push(`${id}: ${lest.feil}`);
      writeFileSync(join(avvistMappe, `${id}${slutt}`), JSON.stringify({ grunn: lest.feil, svar: raa ?? null }, null, 2));
      return;
    }
    lagret++;
    for (const k of lest.kontroll) {
      const art = o.art(k);
      kontrollAntall.set(art, (kontrollAntall.get(art) ?? 0) + 1);
    }
  });

  console.log(`${lagret} lagret, ${avvist.length} avvist, ${manglerSvar} uten svar (av ${alle.length}).`);
  for (const a of avvist) console.log(`  avvist ${a}`);
  if (kontrollAntall.size) {
    console.log("Rettet eller nullet:");
    for (const [k, n] of [...kontrollAntall].sort((x, y) => y[1] - x[1])) console.log(`  ${n} × ${k}`);
  }
  // The assessment's figures are counted from what was just imported (src/lib/vurdering/statistikk.ts).
  const statistikk = await lagreStatistikk();
  console.log(`statistikk_kategori: ${statistikk.length} rader`);
}
