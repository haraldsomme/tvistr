// The fixed practice block per track (docs/praksis.md): written and approved by a jurist, with the
// buyer's own facts in slots. Two uses: the outline for the model's general paragraph, and the fallback
// rendered as it stands when the general paragraph cannot be supported. Nothing in it is taken from the
// corpus at run time; the examples are the jurist's choice. Used in production only when approved.
import type { FeilProfil, Sak, Spor } from "@/lib/sammenligning/typer";
import { indreAnforsel, tall } from "./tekst";

export type Eksempel = { vedtak_id: number; feil_id: string; saksnummer: string; vedtaksdato: string; kategori: string; kilde_url: string };
export type FastBlokk = { spor: Spor; versjon: string; godkjent_av: string | null; tekst: string; eksempler: Eksempel[] };

// Drafts 2026-10-10, not yet approved. The examples are proposals from docs/praksis-grunnlag-<spor>.md.
export const PRAKSIS_FAST: Record<Spor, FastBlokk> = {
  A: {
    spor: "A",
    versjon: "2026-10",
    godkjent_av: null,
    tekst:
      "Forbrukerklageutvalget legger til grunn at bilen skal svare til opplysninger selger har gitt i {hvor_sto_det_bestemt}, og at avvik fra slike opplysninger er en mangel når opplysningen kan antas å ha virket inn på kjøpet, se for eksempel {eksempler}. Opplysningen i min sak lød: «{avskrift_selger}».",
    eksempler: [
      { vedtak_id: 3047, feil_id: "f1", saksnummer: "FKU-2026-11954", vedtaksdato: "2026-04-20", kategori: "utstyr_mangler", kilde_url: "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-11954.pdf" },
      { vedtak_id: 3012, feil_id: "f2", saksnummer: "FKU-2026-89285", vedtaksdato: "2026-06-22", kategori: "servicehistorikk", kilde_url: "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-89285.pdf" },
    ],
  },
  B: {
    spor: "B",
    versjon: "2026-10",
    godkjent_av: null,
    tekst:
      "Forbrukerklageutvalget legger til grunn at en feil som viser seg innen fristen i forbrukerkjøpsloven § 18 annet ledd, formodes å ha vært til stede ved leveringen, med mindre selger beviser noe annet, se for eksempel {eksempler}. Feilen i min sak viste seg {dager_til_feil} dager etter leveringen, og selger har ikke fremlagt dokumentasjon som tilsier at den oppsto senere.",
    eksempler: [
      { vedtak_id: 3023, feil_id: "f1", saksnummer: "FKU-2026-11234", vedtaksdato: "2026-06-03", kategori: "klimaanlegg", kilde_url: "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-11234.pdf" },
      { vedtak_id: 3071, feil_id: "f1", saksnummer: "FKU-2026-110357", vedtaksdato: "2026-02-18", kategori: "elektrisk", kilde_url: "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-110357.pdf" },
    ],
  },
  C: {
    spor: "C",
    versjon: "2026-10",
    godkjent_av: null,
    tekst:
      "Forbrukerklageutvalget legger i saker om {komponent_bestemt} avgjørende vekt på om en sakkyndig vurdering viser at feilen går ut over det som er påregnelig for bilens alder og kjørelengde, og om feilen kan føres tilbake til leveringstidspunktet, se for eksempel {eksempler}. I min sak har verkstedet konkludert slik: «{avskrift_verksted}». Bilen var {alder_ved_kjop} år gammel med {km_ved_kjop} km da jeg kjøpte den for {pris_kr} kr, og utbedringen er beregnet til {kostnad_kr} kr. Vurderingen oppfyller de kravene utvalget stiller.",
    eksempler: [
      { vedtak_id: 3086, feil_id: "f1", saksnummer: "FKU-2026-104368", vedtaksdato: "2026-02-02", kategori: "motor", kilde_url: "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-104368.pdf" },
      { vedtak_id: 3128, feil_id: "f1", saksnummer: "FKU-2025-58214", vedtaksdato: "2025-11-05", kategori: "rust", kilde_url: "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-58214.pdf" },
    ],
  },
};

// «i saker om …»: only the kinds of defect where the phrase reads naturally; the rest get no block on C.
const KOMPONENT_BESTEMT: Record<string, string> = {
  motor: "motoren",
  girkasse: "girkassen",
  clutch: "clutchen",
  drivlinje: "drivlinjen",
  bremser: "bremsene",
  understell_hjuloppheng: "understell og hjuloppheng",
  dekk_felger: "dekk og felger",
  rust: "rust",
  karosseri_lakk_glass: "lakk og karosseri",
  elektrisk: "det elektriske anlegget",
  batteri_elbil: "høyvoltbatteriet",
  klimaanlegg: "klimaanlegget",
  fukt_lekkasje: "fukt og lekkasje",
  eksos_utslipp: "eksosanlegget",
  utstyr_mangler: "bilens utstyr",
  interior_lukt: "interiøret",
};

const FORM_BESTEMT: Record<string, string> = {
  annonse: "annonsen",
  kontrakt: "kontrakten",
  melding: "en skriftlig melding",
  salgsoppgave: "salgsoppgaven",
  tilstandsrapport_fra_selger: "tilstandsrapporten",
};

// «sak FKU-2026-104368 (2026) og sak FKU-2025-58214 (2025)»
export const eksemplerTekst = (e: Eksempel[]) => {
  const deler = e.map((x) => `sak ${x.saksnummer} (${x.vedtaksdato.slice(0, 4)})`);
  return deler.length > 1 ? `${deler.slice(0, -1).join(", ")} og ${deler.at(-1)}` : (deler[0] ?? null);
};

// The buyer's copy without its own quotation marks or final full stop, since the block quotes it.
const avskrift = (t: string | null) => {
  const s = t?.trim().replace(/^[«"“]+|[»"”]+$/g, "").replace(/[.\s]+$/, "").trim();
  return s ? indreAnforsel(s) : null;
};

export const brukbar = (b: FastBlokk, utkast: boolean) => (!!b.godkjent_av || utkast) && b.eksempler.length > 0;

// The block for the defect's primary track, or null when the track has no approved block or a slot it
// uses has no value. A pure function: no text is generated or varied.
export function fastBlokk(sak: Sak, feil: FeilProfil, utkast = false): { tekst: string; spor: Spor; versjon: string; eksempler: Eksempel[] } | null {
  const spor = feil.spor_primar;
  if (!spor) return null;
  const b = PRAKSIS_FAST[spor];
  if (!brukbar(b, utkast)) return null;
  // B's text says the seller has put forward nothing; that is untrue when the seller has.
  if (spor === "B" && sak.selger_motbevis) return null;
  const kostnad = feil.kostnad_kr != null && (feil.kostnad_kr <= sak.pris_kr || feil.kostnad_over_pris_bekreftet) ? feil.kostnad_kr : null;
  const verdier: Record<string, string | null> = {
    komponent_bestemt: KOMPONENT_BESTEMT[feil.kategori_pass2] ?? null,
    dager_til_feil: String(feil.dager_til_feil),
    alder_ved_kjop: String(sak.alder_ved_kjop),
    km_ved_kjop: tall(sak.km_ved_kjop),
    pris_kr: tall(sak.pris_kr),
    kostnad_kr: kostnad != null ? tall(kostnad) : null,
    avskrift_verksted: avskrift(feil.avskrift_verksted),
    avskrift_selger: avskrift(feil.avskrift_selger),
    hvor_sto_det_bestemt: feil.a_form ? (FORM_BESTEMT[feil.a_form] ?? null) : null,
    eksempler: eksemplerTekst(b.eksempler),
  };
  let mangler = false;
  const tekst = b.tekst.replace(/\{(\w+)\}/g, (_, navn: string) => {
    const v = verdier[navn];
    if (v == null) mangler = true;
    return v ?? "";
  });
  return mangler ? null : { tekst, spor, versjon: b.versjon, eksempler: b.eksempler };
}
