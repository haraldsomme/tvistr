import type { Sak } from "@/lib/brev/sak";
import { beregnFaktorer } from "@/lib/vurdering/faktorer";
import { tilKlageInput } from "@/lib/vurdering/innsending";
import { aktorKort } from "./kort/aktorer";
import { avgjordeKort } from "./kort/avgjorde";
import { belopKort } from "./kort/belop";
import { styrkeKort } from "./kort/styrke";
import { styrkPunkter } from "./kort/styrk";
import { videreKort } from "./kort/videre";
import type { Mappe, MappeData } from "./typer";

// A lookup that fails must not take the whole file with it: that card gets an empty answer, the
// others are shown. Nothing from the case is logged.
async function eller<T>(lop: Promise<T>, reserve: T): Promise<T> {
  try {
    return await lop;
  } catch {
    console.error("oppslag i saksmappen feilet");
    return reserve;
  }
}

// The file for a case. The route answers 409 when the answers give no letter; the builder checks it
// again so it cannot be called wrongly.
export async function byggMappe(sak: Pick<Sak, "svar" | "utfylling">, dep: MappeData, idag: string): Promise<Mappe> {
  const lest = tilKlageInput(sak.svar, idag);
  if (!lest.ok) throw new Error("svarene gir ikke en sak");
  const input = lest.input;
  const f = beregnFaktorer(input, idag);
  const u = sak.utfylling;
  const forhandler = u.forhandler;
  const orgnr = forhandler?.type === "brreg" ? forhandler.orgnr : null;
  const ingenModell = { n: 0, vunnet: 0 };

  const [utvalg, belop, temaer, eksempler, forhandlerTall, modell, bevis] = await Promise.all([
    eller(dep.utvalg(), { n: 0, fullt: 0, delvis: 0, avslag: 0, trinn: 0, beskrivelse: "", spesifikk: false }),
    eller(dep.belop(), { tilkjent: null, prisavslagAvUtbedring: null, heving: null, erstatning: { nKrevd: 0, nTilkjent: 0, median: null } }),
    eller(dep.temaer(), { medhold: 0, avslag: 0, rader: [] }),
    eller(dep.eksempler(), []),
    eller(dep.forhandler(forhandler?.navn ?? null, orgnr), null),
    u.kjoretoy ? eller(dep.modell(u.kjoretoy.merke, u.kjoretoy.modell), ingenModell) : Promise.resolve(ingenModell),
    eller(dep.bevis(), { nMedhold: 0, verkstedrapport: 0, bilder: 0, takst: 0, naf: 0, kvittering: 0 }),
  ]);

  return {
    idag,
    styrke: styrkeKort(utvalg),
    belop: belopKort(belop, { utbedringNok: u.krav?.utbedringNok }, input.feilen.utbedringskostnadNok),
    avgjorde: avgjordeKort(temaer, eksempler),
    aktorer: aktorKort(forhandlerTall, modell),
    styrk: styrkPunkter(f, bevis, u.sjekket ?? []),
    videre: videreKort(u, idag),
  };
}
