// Runs simulated buyer cases through the same chain as finnVedtak in src/app/sak/[id]/actions.ts (rangerPerFeil →
// velgVedtak → template) and stores the paragraph, the fields it used, the model and the cost, for a
// field-by-field fact check against the full text.
//
//   npm run simuler -- <utfil.json>                 with the model's choice
//   UTEN_MODELL=1 npm run simuler -- <utfil.json>   the ranking's first candidate
//   FILTER=Turbo,Rust npm run simuler -- <utfil>    only cases whose name contains one of these

import { writeFileSync } from "node:fs";
import { inArray } from "drizzle-orm";
import { hentAlle } from "../src/app/sak/vedtak-db";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { rangerPerFeil } from "../src/lib/matching/ranger";
import { byggSaken } from "../src/lib/vedtaksvalg/kjoper";
import { LOVSETNING, UTVALG_I_TEKSTEN, type Vedtaksdetaljer, velgVedtak } from "../src/lib/vedtaksvalg/valg";
import { SAKER, type Sim } from "./simulerte-saker";

async function main() {
  const utfil = process.argv[2];
  if (!utfil) throw new Error("Oppgi utfil.");
  const utenModell = !!process.env.UTEN_MODELL;
  const alle = await hentAlle();
  const etterId = new Map(alle.map((k) => [k.id, k]));

  // One row per fault (named «… #2» from the second), as the letter cites one decision per fault; the
  // one model call's cost stands on the first row.
  async function kjor(x: Sim) {
    const { sak, kjoper } = byggSaken({ kjopsdato: x.kjopsdato, km: x.km, ar: x.ar, somDenEr: x.somDenEr === "vet_ikke" ? null : x.somDenEr, krav: x.krav, forsok: x.forsok, feil: x.feil });
    const rangeringer = rangerPerFeil(alle, sak);
    const kandidater = rangeringer.map((r) => r.kandidater);
    const ider = [...new Set(kandidater.flat().map((r) => r.id))];
    const rader = ider.length
      ? await db
          .select({ id: vedtak.id, kildeUrl: vedtak.kildeUrl, utvalg: UTVALG_I_TEKSTEN, merke: vedtak.merke, modell: vedtak.modell, arsmodell: vedtak.arsmodell })
          .from(vedtak)
          .where(inArray(vedtak.id, ider))
      : [];
    const detaljer = new Map<number, Vedtaksdetaljer>(rader.map(({ id, ...d }) => [id, d]));
    const start = Date.now();
    const svar = await velgVedtak({ kjoper, sak, kandidater, alle: etterId, detaljer, utenModell });
    const sekunder = Math.round((Date.now() - start) / 1000);
    const ingen = { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 };
    return svar.feil.map((f, i) => {
      const navn = kandidater.length > 1 ? `${x.navn} #${i + 1}` : x.navn;
      const felles = { navn, bruker: kjoper, sekunder, modell: svar.modell, forbruk: i === 0 ? svar.forbruk : ingen, perNiva: rangeringer[i].perNiva };
      if (!f) return { ...felles, fulgt: false, plass: 0, niva: null, avsnitt: LOVSETNING, felter: null };
      const r = f.r;
      const k = etterId.get(r.id)!;
      const d = detaljer.get(k.id)!;
      return {
        ...felles,
        fulgt: f.fulgt,
        plass: kandidater[i].findIndex((x) => x.id === k.id) + 1,
        niva: f.niva,
        avsnitt: f.avsnitt,
        // What the paragraph was built from, for the fact check.
        felter: {
          vedtak_id: k.id,
          fulltekst: `data/avgjorende/inn/${k.id}.txt`,
          utvalg: d.utvalg,
          saksnummer: k.saksnummer,
          vedtaksdato: k.vedtaksdato,
          bil: [d.merke, d.modell, d.arsmodell].filter(Boolean).join(" "),
          km: k.km,
          alder: k.alder,
          som_den_er: k.somDenEr,
          feil: r.feil ? { id: r.feil.id, komponent: r.feil.komponent, kategori: `${r.feil.hovedkategori}.${r.feil.underkategori}` } : null,
          sanksjoner: r.feil ? (k.avgjorende?.feil.find((a) => a.id === r.feil!.id)?.sanksjoner ?? []) : k.sanksjoner,
          rettslige_poeng: r.rett,
          sitater: f.sitater,
        },
      };
    });
  }

  const filter = process.env.FILTER?.split(",");
  const saker = filter ? SAKER.filter((x) => filter.some((f) => x.navn.includes(f))) : SAKER;
  const resultater: Awaited<ReturnType<typeof kjor>> = [];
  for (let i = 0; i < saker.length; i += 4) resultater.push(...(await Promise.all(saker.slice(i, i + 4).map(kjor))).flat());
  writeFileSync(utfil, JSON.stringify(resultater, null, 1));

  let sum = 0;
  for (const r of resultater) {
    sum += r.forbruk.kostnadUsd;
    console.log(`${r.navn.padEnd(36)} nivå ${r.niva ?? "-"}  ${String(r.felter?.saksnummer ?? "lovsetning").padEnd(18)} plass ${String(r.plass).padStart(2)}  ${r.fulgt ? "modell " : "poeng  "} ${r.sekunder} s  ${r.forbruk.tokensInn} inn / ${r.forbruk.tokensUt} ut  $${r.forbruk.kostnadUsd.toFixed(4)}`);
  }
  console.log(`\n${resultater.length} avsnitt i ${saker.length} brev. Sum $${sum.toFixed(3)}, snitt $${(sum / Math.max(saker.length, 1)).toFixed(4)} per brev.`);
  process.exit(0);
}
main();
