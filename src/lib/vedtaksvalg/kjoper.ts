import { brukerNiva, HOVEDKATEGORIER, komponenttype, VISTE_SEG_VALG, type VisteSegValg } from "@/lib/feil/kategorier";
import { lovversjon } from "@/lib/brev/paragrafer";
import type { Brukersak, Krav } from "@/lib/matching/typer";

export type Kilde = "skriftlig" | "muntlig" | "nei";

// The buyer's answers from the form, already cleaned.
export type Svar = {
  kjopsdato: string | null;
  km: number | null;
  // The year the car was first registered.
  ar: number | null;
  somDenEr: "ja" | "nei" | null;
  krav: Krav | null;
  forsok: number | null;
  feil: { hoved: string; under: string[]; tid: VisteSegValg; beskrivelse: string | null; opplysning: Kilde | null; verksted: Kilde | null }[];
};

// The buyer's case as the model reads it: the answers in words, and the legal facts the code can
// work out itself, so the model never has to.
export type Kjoper = {
  kjopsdato: string | null;
  lovversjon: string;
  formodningsfrist: string;
  km: number | null;
  alder: number | null;
  som_den_er: string;
  krav: Krav | null;
  rettingsforsok: number | null;
  feil: {
    kategori: string;
    underkategorier: string[];
    beskrivelse: string | null;
    viste_seg: string;
    // Null for a defect in what the seller said or promised: it existed at the sale, so there is
    // nothing to presume.
    formodningsregelen_gjelder: boolean | null;
    // Only for a defect that showed itself after two years.
    reklamasjonsfrist?: string;
    selger_sa_noe: Kilde | null;
    verksted_undersokt: Kilde | null;
  }[];
};

// The presumption (fkjl. § 18 annet ledd) covers six months for purchases before 2024 and two years
// after. Without a purchase date the 2024 law is assumed, as in brukerNiva.
const fra2024 = (kjopsdato: string | null) => lovversjon(kjopsdato) === "etter_2024";

// The ranking's view and the model's view of the same answers.
export function byggSaken(s: Svar): { sak: Brukersak; kjoper: Kjoper } {
  const kjopsar = s.kjopsdato ? Number(s.kjopsdato.slice(0, 4)) : new Date().getFullYear();
  const ja = (k: Kilde | null) => (k === null ? null : k !== "nei");
  const sak: Brukersak = {
    kategorier: s.feil.map((f) => ({ hoved: f.hoved, under: f.under, niva: brukerNiva(f.tid, s.kjopsdato), opplysning: ja(f.opplysning), verksted: ja(f.verksted) })),
    km: s.km,
    alder: s.ar === null ? null : Math.max(0, kjopsar - s.ar),
    somDenEr: s.somDenEr === null ? null : s.somDenEr === "ja",
    krav: s.krav,
    forsok: s.forsok,
  };
  const kjoper: Kjoper = {
    kjopsdato: s.kjopsdato,
    lovversjon: fra2024(s.kjopsdato) ? "kjøpt fra 1.1.2024 (gjeldende forbrukerkjøpslov)" : "kjøpt før 1.1.2024 (forbrukerkjøpsloven slik den var da)",
    formodningsfrist: fra2024(s.kjopsdato) ? "2 år" : "6 måneder",
    km: sak.km,
    alder: sak.alder,
    som_den_er: s.somDenEr ?? "vet ikke",
    krav: s.krav,
    rettingsforsok: s.forsok,
    feil: s.feil.map((f, i) => {
      const h = HOVEDKATEGORIER.find((x) => x.id === f.hoved)!;
      return {
        kategori: `${h.id} (${h.navn})`,
        underkategorier: f.under.map((u) => `${h.id}.${u} (${h.under.find((x) => x.id === u)!.navn})`),
        beskrivelse: f.beskrivelse,
        viste_seg: VISTE_SEG_VALG.find((t) => t.id === f.tid)!.navn,
        formodningsregelen_gjelder: komponenttype(f.hoved, f.under[0] ?? null) === "opplysning" ? null : sak.kategorier[i].niva === 1,
        ...(f.tid === "over_24_mnd" && {
          reklamasjonsfrist:
            "Feilen viste seg mer enn to år etter kjøpet. Etter fkjl. § 27 er fristen da fem år, men bare for deler som er ment å vare vesentlig lenger enn to år; kjøperen må også vise at feilen fantes ved levering.",
        }),
        selger_sa_noe: f.opplysning,
        verksted_undersokt: f.verksted,
      };
    }),
  };
  return { sak, kjoper };
}
