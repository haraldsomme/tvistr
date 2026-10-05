"use client";

import { useState } from "react";
import { norskDato } from "@/lib/brev/brev";
import { FORBEHOLD_VALG, type Forbehold } from "@/lib/brev/utfylling";
import type { Kjoretoy } from "@/lib/kjoretoy/vegvesen";
import { FRA_AR, gyldigKjopsdato, medKjopsdato, type Innsending } from "@/lib/vurdering/innsending";
import { Datofelt } from "../datofelt";
import { bareSiffer, type Felles, gruppert, HJELP, kroner, Skjema, Tekstfelt, valgAv, Valgfelt } from "../felt";

// What the letter needs about the purchase itself: the day, the price, the mileage, and whether the
// contract made a disclaimer. The car itself came from the assessment and cannot change here.

export const FORBEHOLD_TEKST: Record<Forbehold, string> = {
  som_den_er: "Ja, bilen ble solgt «som den er»",
  garanti: "Nei, men bilen hadde garanti fra forhandleren",
  ingen: "Nei, ingen forbehold eller garanti",
  vet_ikke: "Jeg vet ikke",
};

export function KjopetFelt({
  kjoretoy,
  svar,
  idag,
  verdi,
  aktiv,
  lagre,
  avbryt,
  forslagKjopsdato,
}: Felles & { kjoretoy: Kjoretoy; svar: Innsending; idag: string; verdi: Forbehold | undefined; forslagKjopsdato?: string | null }) {
  // Without a purchase date in the case, the registry's day for the current owner is the suggestion.
  const [dato, setDato] = useState(svar.kjopsdato || forslagKjopsdato || "");
  const [sum, setSum] = useState(svar.kjopesum);
  const [km, setKm] = useState(svar.kmVedKjop);
  const [forbehold, setForbehold] = useState<Forbehold | null>(verdi ?? null);
  const bil = `${kjoretoy.merke} ${kjoretoy.modell}${kjoretoy.ar ? ` (${kjoretoy.ar})` : ""}, ${kjoretoy.regnr}`;

  if (!aktiv) {
    return (
      <Sammendrag
        bil={bil}
        dato={dato}
        sum={sum}
        km={km}
        forbehold={forbehold}
      />
    );
  }

  const datoOk = gyldigKjopsdato(dato, idag);
  const sumOk = /^\d+$/.test(sum) && Number(sum) > 0;
  const klar = datoOk && sumOk && forbehold !== null;
  const send = () => lagre({ svar: medKjopsdato({ ...svar, kjopesum: sum, kmVedKjop: km }, dato, idag), forbehold: forbehold! });

  return (
    <Skjema klar={klar} send={send} avbryt={avbryt}>
      <p className={HJELP}>{bil} (bilen kan ikke endres)</p>
      <Datofelt
        label="Når kjøpte du bilen?"
        hjelp={forslagKjopsdato && !svar.kjopsdato && dato === forslagKjopsdato ? "Foreslått fra Statens vegvesen: datoen bilen ble registrert på deg. Rett den hvis den ikke stemmer med kjøpekontrakten." : undefined}
        min={`${FRA_AR}-01-01`}
        max={idag}
        verdi={dato}
        settVerdi={setDato}
      />
      <Tekstfelt label="Hva kostet bilen?" inputMode="numeric" autoComplete="off" placeholder="Kroner" value={gruppert(sum)} onChange={(e) => setSum(bareSiffer(e.target.value))} />
      <Tekstfelt label="Kilometerstand ved kjøpet (valgfritt)" inputMode="numeric" autoComplete="off" placeholder="Kilometer" value={gruppert(km)} onChange={(e) => setKm(bareSiffer(e.target.value))} />
      <Valgfelt label="Sto det «solgt som den er» eller noe om garanti i kontrakten eller annonsen?" verdi={forbehold} velg={setForbehold} valg={valgAv(FORBEHOLD_VALG, FORBEHOLD_TEKST)} />
    </Skjema>
  );
}

function Sammendrag({ bil, dato, sum, km, forbehold }: { bil: string; dato: string; sum: string; km: string; forbehold: Forbehold | null }) {
  const pris = sum ? ` for ${kroner(Number(sum))}` : "";
  const kilometer = km ? `, ${gruppert(km)} km` : "";
  return (
    <div className="flex flex-col gap-0.5 text-[14px] leading-[1.45] text-[#3d4757]">
      <span>{bil} (kan ikke endres)</span>
      <span>{`Kjøpt ${gyldigKjopsdato(dato) ? norskDato(dato) : dato}${pris}${kilometer}`}</span>
      {forbehold && <span>{FORBEHOLD_TEKST[forbehold]}</span>}
    </div>
  );
}
