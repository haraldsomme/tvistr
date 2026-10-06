"use client";

import { useState } from "react";
import { vedleggFor } from "@/lib/brev/brev";
import { VEDLEGG, type Utfylling, type Vedlegg } from "@/lib/brev/utfylling";
import type { KlageInput } from "@/lib/vurdering/typer";
import { Flervalgsfelt, Sammendrag, Skjema, valgAv, type Felles } from "../felt";

const VEDLEGG_TEKST: Record<Vedlegg, string> = {
  kjopekontrakt: "Kjøpekontrakt",
  verkstedrapport: "Verksted- eller tilstandsrapport",
  faktura: "Faktura for reparasjonen",
  tilbud: "Pristilbud eller takst",
  bilder: "Bilder eller video av feilen",
  annonse: "Annonsen bilen ble solgt med",
  meldinger: "E-post eller SMS med forhandleren",
  kvitteringer: "Kvitteringer for utgifter",
};

// What the buyer encloses with the letter. Until saved, the choice is suggested from the answers
// (`vedleggFor`): what the letter rests on (`vedleggBrevetByggerPa`), and pictures.
export function VedleggFelt({ input, utfylling, aktiv, lagre, avbryt }: Felles & { input: KlageInput; utfylling: Utfylling }) {
  const [valgt, setValgt] = useState<Vedlegg[]>(() => vedleggFor(input, utfylling));

  if (!aktiv) {
    if (!utfylling.vedlegg) return null;
    return <Sammendrag linjer={[utfylling.vedlegg.length ? utfylling.vedlegg.map((v) => VEDLEGG_TEKST[v]).join(", ") : "Ingen vedlegg"]} />;
  }

  return (
    <Skjema klar send={() => lagre({ vedlegg: valgt })} avbryt={avbryt} knapp="Bekreft vedlegg">
      <Flervalgsfelt label="Hva legger du ved brevet?" hjelp="Kryss bare av det du faktisk legger ved. Vi har foreslått det brevet bygger på." verdi={valgt} velg={setValgt} valg={valgAv(VEDLEGG, VEDLEGG_TEKST)} />
    </Skjema>
  );
}
