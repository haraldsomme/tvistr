import { KNAPP_TIL_FEILTYPE, type Faktorer, type Reklamasjonsbotte } from "@/lib/vurdering/faktorer";
import { GRUPPER, regelgrunnlag, type Gruppe, type Regelgrunnlag } from "@/lib/vurdering/henvisninger";

// What Forbrukerklageutvalget weighed in dealer cases, as kinds of facts a buyer can be asked about:
// the catalogue behind the questions of the clarifying round. Built from 200 decisions read by two
// models (docs/momenter.md); every moment has word-for-word evidence in scripts/momenter-belegg.json, and
// `npm run sjekk-momenter` checks it. Not reviewed by a lawyer.

export type Moment = {
  id: string;
  navn: string;
  tema: string;
  // Whether the moment's presence helps («for») or hurts («mot») the buyer.
  retning: "for" | "mot";
  // Empty: every case.
  gjelder: { grupper?: Gruppe[]; botter?: Reklamasjonsbotte[]; grunnlag?: Regelgrunnlag[] };
  sporsmal: string;
  alternativer: string[];
  // The answers that speak for the buyer.
  gunstig: string[];
  // How the letter uses a favourable answer.
  argument: string;
  // In how many of the decisions read it was present, won and lost, and whether it separates them.
  forekomst: { vunnet: number; tapt: number; skiller: boolean };
};

export const MOMENTER: readonly Moment[] = [];

// The defect groups of a case, as the library of decisions names them.
const grupperFor = (f: Faktorer): Gruppe[] => GRUPPER.filter((g) => f.feilgrupper.some((fg) => KNAPP_TIL_FEILTYPE[g][0] === fg[0]));

// The moments to ask a buyer about: those that separate won from lost cases and apply to this case's
// defect, timing and the rule the letter rests on.
export function momenterFor(f: Faktorer, katalog: readonly Moment[] = MOMENTER): Moment[] {
  const grupper = grupperFor(f);
  const grunnlag = regelgrunnlag(f);
  return katalog.filter(
    (m) =>
      m.forekomst.skiller &&
      (!m.gjelder.grupper?.length || m.gjelder.grupper.some((g) => grupper.includes(g))) &&
      (!m.gjelder.botter?.length || m.gjelder.botter.includes(f.reklamasjonsbotte)) &&
      (!m.gjelder.grunnlag?.length || m.gjelder.grunnlag.includes(grunnlag)),
  );
}
