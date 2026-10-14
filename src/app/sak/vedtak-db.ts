// The decisions the ranking reads, for the assessment (vurdering.ts) and the letter (actions.ts). The
// set only changes on import, so it is read once per server instance.
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { vedtak } from "@/db/schema";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { GRUNNFILTER } from "@/lib/matching/grunnfilter";
import type { Kandidat } from "@/lib/matching/typer";

type Rad = Kandidat & { merke: string | null; modell: string | null; arsmodell: number | null };

let alleVedtak: Promise<Rad[]> | null = null;
function hent(): Promise<Rad[]> {
  alleVedtak ??= db
    .select({
      id: vedtak.id,
      saksnummer: vedtak.saksnummer,
      vedtaksdato: vedtak.vedtaksdato,
      km: vedtak.kmVedKjop,
      alder: vedtak.alderVedKjop,
      somDenEr: vedtak.somDenEr,
      sanksjoner: vedtak.sanksjoner,
      mangelsgrunnlag: vedtak.mangelsgrunnlag,
      paragrafer: vedtak.paragrafer,
      tvistetema: vedtak.tvistetema,
      feil: sql<AvledetFeil[]>`coalesce(${vedtak.feilvurdering}->'feil', '[]'::jsonb)`,
      avgjorende: vedtak.avgjorende,
      merke: vedtak.merke,
      modell: vedtak.modell,
      arsmodell: vedtak.arsmodell,
    })
    .from(vedtak)
    .where(GRUNNFILTER)
    .catch((e) => {
      alleVedtak = null;
      throw e;
    });
  return alleVedtak;
}

export const hentAlle = (): Promise<Kandidat[]> => hent();

// Make, model and model year of every decision in the set, for a card whose extraction has no `bil`.
export async function hentBilnavn(): Promise<(id: number) => string | null> {
  const navn = new Map((await hent()).map((r) => [r.id, [r.merke, r.modell, r.arsmodell].filter(Boolean).join(" ") || null]));
  return (id) => navn.get(id) ?? null;
}
