// The law as it applied to the buyer's purchase: the rules changed on 1.1.2024 (presumption six months
// before, two years after; «som den er» under old § 17 before, § 15 annet ledd after). Paragraphs come
// from the checked tables in paragrafer.ts, never written by hand here.
import { type Lovversjon, lovRef, lovversjon, PARAGRAFER, type Poeng } from "@/lib/brev/paragrafer";
import { FORMODNING_MND } from "@/lib/brev/tidslinje";

export type Regler = {
  versjon: Lovversjon;
  formodningMnd: 6 | 24;
  formodningTekst: string;
  // «forbrkjl. § 18 annet ledd», for the tags on the verdict.
  ref: (p: Poeng) => string;
  // «forbrukerkjøpsloven § 18 annet ledd», for the letter.
  lovRef: (p: Poeng) => string;
  // «§ 18 annet ledd», after the law has been named.
  par: (p: Poeng) => string;
};

export function regler(dato: string | null | undefined): Regler {
  const versjon = lovversjon(dato ?? null);
  const formodningMnd = FORMODNING_MND[versjon];
  return {
    versjon,
    formodningMnd,
    formodningTekst: formodningMnd === 6 ? "seks måneder" : "to år",
    ref: (p) => `forbrkjl. ${PARAGRAFER[versjon][p] ?? ""}`.trim(),
    lovRef: (p) => lovRef(versjon, p),
    par: (p) => PARAGRAFER[versjon][p] ?? "",
  };
}
