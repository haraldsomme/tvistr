"use client";

import Link from "next/link";
import { norskDato } from "@/lib/brev/brev";
import { type Feilen } from "@/lib/brev/utfylling";
import { FEILTYPE_TEKST } from "@/app/vurdering/tekster";
import type { KlageInput } from "@/lib/vurdering/typer";
import { HJELP, KNAPP, Sammendrag } from "../felt";

// The defect is described in step 3 of the wizard (`/brev/[id]/veiviser?steg=feilen`), where the
// interview has room; here the step shows what was saved, or the way there. «Endre» goes there too.
export function FeilenFelt({ sakId, input, verdi, aktiv }: { sakId: string; input: KlageInput; verdi: Feilen | undefined; aktiv: boolean }) {
  const feiltyper = [...new Set(input.feilen.typer)].map((t) => FEILTYPE_TEKST[t]).join(", ");

  if (verdi) {
    const forste = verdi.avsnitt[0];
    return <Sammendrag linjer={[feiltyper, `Viste seg ${norskDato(verdi.dato)}`, forste.length > 90 ? `${forste.slice(0, 90)}…` : forste]} />;
  }
  if (!aktiv) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className={HJELP}>Feil du har oppgitt: {feiltyper}. Du beskriver feilen på en egen side, der vi hjelper deg med spørsmål og et forslag til tekst.</p>
      <Link href={`/brev/${sakId}/veiviser?steg=feilen&tilbake=brev`} className={`${KNAPP} self-start`}>
        Beskriv feilen
      </Link>
    </div>
  );
}
