// One defect's practice paragraph: the model reads the candidates' full texts and writes, the verifier
// keeps what the full text supports (docs/praksis.md). One model call, no retry when the verifier says no:
// a paragraph that cannot be supported is not written.
import { kallVerktoy, type Modell, MODELL_FORFATTER, type VerktoySvar } from "@/lib/ai/klient";
import { PRAKSIS_VERSJON } from "@/lib/ai/prompter";
import { avledFeil, avledSak } from "@/lib/sammenligning/avled";
import type { Vurdert } from "@/lib/sammenligning/typer";
import type { Skjema } from "@/lib/skjema/skjema";
import { PRAKSIS_GENERELL, PRAKSIS_SPESIFIKK, PRAKSIS_VERKTOY, praksisBruker } from "./prompt";
import { kjenteOpplysninger } from "./rens";
import type { HentFulltekst, Modus, Praksis, PraksisSvar } from "./typer";
import { verifiserPraksis } from "./verifiser";

export type Kall = (o: { system: string; bruker: string; modell: Modell }) => Promise<VerktoySvar<PraksisSvar>>;

const modellKall: Kall = ({ system, bruker, modell }) =>
  kallVerktoy<PraksisSvar>({ system, verktoy: PRAKSIS_VERKTOY, bruker, effort: "high", maksTokens: 16_000, modell });

export type SkrivInn = {
  skjema: Skjema;
  feil_id: string;
  modus: Modus;
  // spesifikk: the filter's candidates (sammenligning kandidaterForFeil); generell: the jurist's examples.
  kandidater: Vurdert[];
  idag: string;
  // generell: the jurist's block for the track, as the outline (src/lib/praksis/fast.ts).
  fast?: { tekst: string; spor: string } | null;
};

export type Avhengigheter = { hentFulltekst: HentFulltekst; kall?: Kall; modell?: Modell };

export async function skrivPraksis(inn: SkrivInn, deps: Avhengigheter): Promise<Praksis & { bruker: string | null }> {
  const tom = (grunn: string) => ({
    modus: inn.modus,
    avsnitt: null,
    vedtak_id: null,
    eksempel_vedtak_ids: [],
    grunn,
    strykninger: [],
    raa: null,
    versjon: PRAKSIS_VERSJON,
    modell: null,
    forbruk: null,
    bruker: null,
  });
  if (!inn.kandidater.length) return tom("ingen kandidater");
  const sf = inn.skjema.del3_feil.find((f) => f.id === inn.feil_id);
  if (!sf) return tom(`feilen ${inn.feil_id} finnes ikke i skjemaet`);
  const sak = avledSak(inn.skjema, inn.idag);
  const feil = avledFeil(sak, sf);
  const kjente = kjenteOpplysninger(inn.skjema);
  const fulltekst = await deps.hentFulltekst(inn.kandidater.map((x) => x.vedtak.vedtak_id));
  const bruker = praksisBruker({ modus: inn.modus, sak, feil, skjemaFeil: sf, kandidater: inn.kandidater, fulltekst, kjente, fast: inn.fast });
  const modell = deps.modell ?? MODELL_FORFATTER;

  let svar: VerktoySvar<PraksisSvar>;
  try {
    svar = await (deps.kall ?? modellKall)({ system: inn.modus === "spesifikk" ? PRAKSIS_SPESIFIKK : PRAKSIS_GENERELL, bruker, modell });
  } catch (e) {
    return { ...tom(`modell: ${e instanceof Error ? e.message : String(e)}`), bruker, feil: true };
  }
  const verifisert = verifiserPraksis(svar.input, { modus: inn.modus, kandidater: inn.kandidater, fulltekst, sak, feil, skjemaFeil: sf, km_na: inn.skjema.km_na, kjente });
  return { ...verifisert, raa: svar.input, versjon: PRAKSIS_VERSJON, modell: svar.modell, forbruk: svar.forbruk, bruker };
}
