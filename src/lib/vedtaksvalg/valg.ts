import { type Forbruk, kallVerktoy, MODELL_FORFATTER } from "@/lib/ai/klient";
import type { Rangert } from "@/lib/matching/ranger";
import { poengtekst } from "@/lib/matching/rett";
import type { Brukersak, Kandidat } from "@/lib/matching/typer";
import { BRUK, INSTRUKS } from "./instruks";
import { kontroller, type Valg } from "./kontroll";

// The fields of a candidate the model reads beside those the ranking uses. No full text: the quotes
// in `feil` are already checked against it, and the summary and key points stand in for the rest.
export type Vedtaksdetaljer = {
  kildeUrl: string;
  merke: string | null;
  modell: string | null;
  arsmodell: number | null;
  kjopesum: number | null;
  prisavslagProsent: number | null;
  rettingsforsok: number | null;
  enstemmig: boolean | null;
  dissens: boolean | null;
  sammendrag: string | null;
  nokkelmomenter: string[] | null;
};

// The buyer's case as the model reads it: the answers in words, with the free-text descriptions.
export type Kjoper = {
  kjopsdato: string | null;
  km: number | null;
  alder: number | null;
  som_den_er: string;
  krav: string | null;
  rettingsforsok: number | null;
  feil: {
    kategori: string;
    underkategorier: string[];
    beskrivelse: string | null;
    viste_seg: string;
    tidsniva: number;
    selger_sa_noe: string | null;
    verksted_undersokt: string | null;
  }[];
};

const VERKTOY = {
  name: "velg_vedtak",
  description: "Det valgte vedtaket og avsnittet i brevet som viser til det.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["vedtak_id", "bruk", "avsnitt", "sitater", "forbehold"],
    properties: {
      vedtak_id: { type: "integer", description: "vedtak_id til vedtaket du valgte." },
      bruk: { type: "string", enum: [...BRUK], description: "Hva vedtaket brukes til i brevet." },
      avsnitt: { type: "string", description: "Avsnittet i brevet, i første person fra kjøperen." },
      sitater: { type: "array", items: { type: "string" }, description: "Hvert sitat brukt i avsnittet, ordrett fra sitat-feltene." },
      forbehold: { type: "string", description: "Svakhetene ved henvisningen, for Tvistrs kontroll." },
    },
  },
};

function kandidattekst(r: Rangert, k: Kandidat, d: Vedtaksdetaljer | undefined) {
  const kategori = (h: string, u: string | null) => (u ? `${h}.${u}` : h);
  return {
    vedtak_id: k.id,
    saksnummer: k.saksnummer,
    vedtaksdato: k.vedtaksdato,
    trinn: r.trinn,
    poeng: `${r.poengsum}/${r.maks}`,
    rettslige_poeng: r.rett.map(poengtekst),
    bil: [d?.merke, d?.modell, d?.arsmodell].filter(Boolean).join(" ") || null,
    km_ved_kjop: k.km,
    alder_ved_kjop: k.alder,
    kjopesum_nok: d?.kjopesum ?? null,
    som_den_er: k.somDenEr,
    utvalget_ga: k.sanksjoner,
    prisavslag_prosent: d?.prisavslagProsent ?? null,
    rettingsforsok: d?.rettingsforsok ?? null,
    enstemmig: d?.enstemmig ?? null,
    dissens: d?.dissens ?? null,
    mangelsgrunnlag_pastatt: k.mangelsgrunnlag,
    tvistetema: k.tvistetema,
    paragrafer: k.paragrafer,
    matchet_feil: r.feil && { kategori: kategori(r.feil.hovedkategori, r.feil.underkategori), komponent: r.feil.komponent },
    feil_med_medhold: k.feil
      .filter((f) => f.utfall === "medhold")
      .map((f) => ({
        kategori: kategori(f.hovedkategori, f.underkategori),
        komponent: f.komponent,
        tidsniva: f.tidsniva,
        dager_etter_levering: f.dager_etter_levering,
        viste_seg: f.viste_seg,
        samlet: f.samlet,
        bevisgrunnlag: f.bevisgrunnlag,
        formodning: f.formodning,
        sitat: f.sitat,
      })),
    feil_avvist: k.feil.filter((f) => f.utfall === "avvist").map((f) => ({ kategori: kategori(f.hovedkategori, f.underkategori), komponent: f.komponent, avslagsgrunn: f.avslagsgrunn })),
    nokkelmomenter: d?.nokkelmomenter ?? [],
    sammendrag: d?.sammendrag ?? null,
  };
}

export type Valgresultat = { valg: Valg; modell: string; forbruk: Forbruk; forsok: number };

// Asks the model to choose, checks the answer and asks again with what was wrong. The third attempt
// offers only the candidates with a legal point and asks for that use, which always exists.
export async function velgVedtak(opts: {
  kjoper: Kjoper;
  sak: Brukersak;
  kandidater: Rangert[];
  alle: Map<number, Kandidat>;
  detaljer: Map<number, Vedtaksdetaljer>;
}): Promise<Valgresultat> {
  const forbruk: Forbruk = { tokensInn: 0, tokensUt: 0, kostnadUsd: 0 };
  let avvist: string[] = [];
  for (let forsok = 1; forsok <= 3; forsok++) {
    const siste = forsok === 3;
    const utvalg = siste ? opts.kandidater.filter((r) => r.rett.length) : opts.kandidater;
    if (!utvalg.length) break;
    const deler = [
      `Kjøperens sak:\n${JSON.stringify(opts.kjoper)}`,
      `Kandidatene (${utvalg.length}):\n${JSON.stringify(utvalg.map((r) => kandidattekst(r, opts.alle.get(r.id)!, opts.detaljer.get(r.id))))}`,
      avvist.length ? `Forrige svar ble avvist av kontrollen:\n${avvist.map((a) => `- ${a}`).join("\n")}\nVelg og skriv på nytt.` : "",
      siste ? "Velg nå et vedtak med bruk «rettslig_poeng»." : "",
    ];
    const svar = await kallVerktoy<Valg>({
      system: INSTRUKS,
      verktoy: VERKTOY,
      bruker: deler.filter(Boolean).join("\n\n"),
      effort: "high",
      maksTokens: 16000,
      modell: MODELL_FORFATTER,
    });
    forbruk.tokensInn += svar.forbruk.tokensInn;
    forbruk.tokensUt += svar.forbruk.tokensUt;
    forbruk.kostnadUsd += svar.forbruk.kostnadUsd;
    avvist = kontroller(svar.input, utvalg, opts.alle, opts.sak);
    if (siste && svar.input.bruk !== "rettslig_poeng") avvist.push("bruk må være «rettslig_poeng»");
    if (!avvist.length) return { valg: svar.input, modell: svar.modell, forbruk, forsok };
  }
  throw new Error(`valget holdt ikke kontrollen: ${avvist.join("; ")}`);
}
