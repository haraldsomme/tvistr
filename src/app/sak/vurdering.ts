"use server";

// The free assessment (step 4): the answers of steps 1–3 against the ranking and the counted figures.
// Code and database only: this file must never reach the model (vurdering.test.ts checks the imports).
import { headers } from "next/headers";
import { lagGrense } from "@/lib/rategrense";
import { lesStatistikk } from "@/lib/vurdering/statistikk-db";
import { byggVurdering, fristenErUte, type VurderingResultat } from "@/lib/vurdering/vurdering";
import { lovversjon } from "@/lib/brev/paragrafer";
import { gyldigDato, heltall, idagOslo, rensVedtakssvar } from "./rens";
import { hentAlle, hentBilnavn } from "./vedtak-db";

export type Vurderingssvar = { ok: true; vurdering: VurderingResultat } | { ok: false; melding: string };

const forMange = lagGrense({ antall: 30, vinduMs: 60_000 });

let statistikk: ReturnType<typeof lesStatistikk> | null = null;

export async function vurderSaken(inn: unknown): Promise<Vurderingssvar> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";
  if (forMange(ip)) return { ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." };
  const s = (inn && typeof inn === "object" ? inn : {}) as Record<string, unknown>;
  const idag = idagOslo();

  // Past five years nothing else is judged: the flow stops (docs/vurdering.md).
  const kjopsdato = gyldigDato(s.kjopsdato);
  if (kjopsdato && fristenErUte(kjopsdato, idag))
    return { ok: true, vurdering: { status: "ute", grunner: [], lovversjon: lovversjon(kjopsdato), lovlinjer: [], tall: [], kort: [], niva: null, poeng: [], sammenligning: null } };

  const rens = rensVedtakssvar(s);
  if (!rens.ok) return { ok: false, melding: rens.melding };
  const r = rens.svar;
  try {
    statistikk ??= lesStatistikk().catch((e) => {
      statistikk = null;
      throw e;
    });
    const [alle, bilnavn, tall] = await Promise.all([hentAlle(), hentBilnavn(), statistikk]);
    const vurdering = byggVurdering({
      sak: {
        kjopsdato: r.kjopsdato,
        idag,
        km: heltall(s.km, 1, 1_500_000),
        ar: r.ar,
        somDenEr: r.somDenEr,
        feil: r.rekkefolge.map((id) => ({ hoved: id, under: r.rent[id], oppdaget: r.detaljer[id].oppdaget })),
      },
      alle,
      statistikk: tall,
      bilnavn,
    });
    // One line per assessment for the operator, without personal data.
    console.info("vurdering", JSON.stringify({ status: vurdering.status, grunner: vurdering.grunner.map((g) => g.regel), niva: vurdering.niva, kort: vurdering.kort.map((k) => k.saksnummer) }));
    return { ok: true, vurdering };
  } catch (e) {
    console.error("vurderingen feilet", e);
    return { ok: false, melding: "Noe gikk galt. Prøv igjen." };
  }
}
