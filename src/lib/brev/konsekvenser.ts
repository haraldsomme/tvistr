import { harFatt } from "@/lib/brev/brev";
import { avledSvar, kontrollerRettelse, rettSvar } from "@/lib/brev/svar";
import { medEndring, tilpassTilSvar, type Lagring, type Utfylling } from "@/lib/brev/utfylling";
import { beregnFaktorer } from "@/lib/vurdering/faktorer";
import { tilKlageInput, type Innsending } from "@/lib/vurdering/innsending";
import { gyldigRetting } from "@/lib/vurdering/typer";
import { vurderFraFaktorer } from "@/lib/vurdering/vurder";

// What a save would cost the letter, worked out before it is sent, so the page can ask first. Runs the
// same steps as `PATCH /api/sak/[id]` (`rettSvar`, `tilpassTilSvar`, `medEndring`, `avledSvar`,
// `kontrollerRettelse`) on the case as the page has it, and compares before and after. `avvist` is the
// message the server would refuse the save with. `tap` lists, in plain words, what the letter loses:
// what is filled in that gets dropped, a claim that falls back to repair, a weaker level, and new
// points against the case.

export type Konsekvenser = { avvist: string | null; tap: string[] };

const FJERNET: Record<"feilen" | "reklamasjon" | "sendt", string> = {
  feilen: "Feilbeskrivelsen du har skrevet, blir slettet, fordi datoen feilen viste seg ikke passer med kjøpsdatoen. Du må beskrive feilen på nytt.",
  reklamasjon: "Datoen og måten du tok opp feilen med forhandleren på, blir slettet.",
  sendt: "Datoen brevet ble sendt, blir slettet. Fristene og purringen i saksmappen forsvinner.",
};
const KRAV_NAVN = { prisavslag: "prisavslag", heving: "heving av kjøpet" } as const;

type Sak = { svar: Innsending; utfylling: Utfylling };

function vurdering({ svar, utfylling }: Sak, idag: string) {
  const parsed = tilKlageInput(svar, idag);
  if (!parsed.ok) return null;
  const v = vurderFraFaktorer(beregnFaktorer(parsed.input, idag), null);
  return { niva: v.niva, svakheter: v.grunnlag.filter((p) => p.vekt !== "for").map((p) => p.tekst), kanVelgeKrav: harFatt(gyldigRetting(parsed.input.feilen.kontakt, utfylling.retting)) };
}

export function konsekvenserAv(for_: Sak, lagring: Lagring, idag: string): Konsekvenser {
  const { svar: svarRaw, ...endring } = lagring;
  let svar = for_.svar;
  let utfylling = for_.utfylling;
  if (svarRaw !== undefined) {
    const rettet = rettSvar(for_.svar, svarRaw, idag);
    if (!rettet) return { avvist: null, tap: [] };
    svar = rettet;
    utfylling = tilpassTilSvar(utfylling, svar, idag);
  }
  utfylling = medEndring(utfylling, endring);
  const etter: Sak = { svar: avledSvar(svar, utfylling, idag), utfylling };

  const avvist = kontrollerRettelse(for_.svar, etter.svar, idag);
  if (avvist) return { avvist, tap: [] };

  const tap: string[] = [];
  for (const felt of ["feilen", "reklamasjon", "sendt"] as const) {
    if (for_.utfylling[felt] !== undefined && etter.utfylling[felt] === undefined) tap.push(FJERNET[felt]);
  }

  const a = vurdering(for_, idag);
  const b = vurdering(etter, idag);
  if (a && b) {
    const kravType = for_.utfylling.krav?.type;
    if (a.kanVelgeKrav && !b.kanVelgeKrav && kravType) tap.push(`Brevet krever ikke lenger ${KRAV_NAVN[kravType]}, men at forhandleren retter feilen først.`);
    if (a.niva === "god" && b.niva === "svak") tap.push("Saken din blir vurdert som svakere.");
    if (b.svakheter.length > a.svakheter.length) {
      for (const p of b.svakheter.filter((t) => !a.svakheter.includes(t))) tap.push(`Nytt punkt som svekker saken: ${p}`);
    }
  }
  return { avvist: null, tap };
}
