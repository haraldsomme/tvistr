import { AvvistAvModellError, kallVerktoy } from "@/lib/ai/klient";
import { FEILEN_SKRIV_SYSTEM, FEILEN_SPORSMAL_SYSTEM, feilenBruker } from "@/lib/ai/prompter";
import { FEILBESKRIVELSE, lesAvsnitt, type Fakta } from "./utfylling";

// The interview about the defect: the model reads the buyer's own text, asks what a fixed checklist
// says is missing, and writes a draft from the buyer's facts only. Nothing here is saved; the buyer
// edits the draft and approves it on the page. Only the text, the answers and the defect categories
// are sent, never name, address, plate or dealer.

export const PUNKTER = ["hva", "nar", "hyppighet", "bruk", "verksted", "forst_vist"] as const;
export const UTELATT_STEG = ["kravet", "kontakt", "for_kjopet", "bevis"] as const;

// `flervalg`: the choices can be true together (symptoms, conditions), so several can be picked.
export type Sporsmal = { tekst: string; alternativer: string[]; flervalg: boolean; punkt: (typeof PUNKTER)[number] };
export type FeilMedSporsmal = { tittel: string; sporsmal: Sporsmal[] };
export type Utelatt = { hva: string; steg: (typeof UTELATT_STEG)[number] };
type Feilet = { ok: false; grunn: "avvist" | "feilet" };

const SPORSMAL_VERKTOY = {
  name: "still_sporsmal",
  description: "Leverer feilene bilen har og oppfølgingsspørsmålene om det som mangler i beskrivelsen.",
  input_schema: {
    type: "object",
    properties: {
      feil: {
        type: "array",
        description: "Én oppføring per feil bilen har.",
        items: {
          type: "object",
          properties: {
            tittel: { type: "string", description: "Kort tittel på feilen, 1–4 ord." },
            sporsmal: {
              type: "array",
              description: "Null til tre spørsmål om det som mangler for denne feilen.",
              items: {
                type: "object",
                properties: {
                  tekst: { type: "string", description: "Spørsmålet, kort og i du-form." },
                  alternativer: { type: "array", items: { type: "string" }, description: "2–6 korte svaralternativer, eller en tom liste." },
                  flervalg: { type: "boolean", description: "true når flere alternativer kan stemme samtidig; false når de utelukker hverandre." },
                  punkt: { type: "string", enum: [...PUNKTER], description: "Punktet i sjekklisten spørsmålet gjelder." },
                },
                required: ["tekst", "alternativer", "flervalg", "punkt"],
                additionalProperties: false,
              },
            },
          },
          required: ["tittel", "sporsmal"],
          additionalProperties: false,
        },
      },
    },
    required: ["feil"],
    additionalProperties: false,
  },
};

const SKRIV_VERKTOY = {
  name: "skriv_beskrivelse",
  description: "Leverer beskrivelsen av feilene slik den skal stå i reklamasjonsbrevet.",
  input_schema: {
    type: "object",
    properties: {
      feil: { type: "array", items: { type: "string" }, description: "Én kort tittel per feil bilen har." },
      avsnitt: { type: "array", items: { type: "string" }, description: "Avsnittene i beskrivelsen, i rekkefølge. Ett til seks." },
      utelatt: {
        type: "array",
        description: "Opplysninger fra forbrukeren som hører hjemme i et annet steg av brevet.",
        items: {
          type: "object",
          properties: {
            hva: { type: "string", description: "Opplysningen, gjengitt i høyst én kort setning." },
            steg: { type: "string", enum: [...UTELATT_STEG] },
          },
          required: ["hva", "steg"],
          additionalProperties: false,
        },
      },
    },
    required: ["feil", "avsnitt", "utelatt"],
    additionalProperties: false,
  },
};

const kort = (v: unknown, maks: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length > 0 && t.length <= maks ? t : null;
};

const grunn = (e: unknown): Feilet => ({ ok: false, grunn: e instanceof AvvistAvModellError ? "avvist" : "feilet" });

// At most three questions a defect and eight in all; a question, choice or title the page cannot show is dropped.
function beskjaer(grupper: FeilMedSporsmal[]): FeilMedSporsmal[] {
  let igjen: number = FEILBESKRIVELSE.maksFakta;
  const ut: FeilMedSporsmal[] = [];
  for (const g of grupper.slice(0, FEILBESKRIVELSE.maksFeil)) {
    const tittel = kort(g.tittel, FEILBESKRIVELSE.feilTittelMaks);
    if (!tittel) continue;
    const sporsmal: Sporsmal[] = [];
    for (const s of g.sporsmal) {
      const tekst = kort(s.tekst, FEILBESKRIVELSE.sporsmalMaks);
      if (!tekst || !PUNKTER.includes(s.punkt) || sporsmal.length === 3 || igjen <= 0) continue;
      const alternativer = s.alternativer.map((a) => kort(a, 60)).filter((a): a is string => a !== null).slice(0, 6);
      sporsmal.push({ tekst, alternativer, flervalg: s.flervalg === true && alternativer.length > 1, punkt: s.punkt });
      igjen--;
    }
    ut.push({ tittel, sporsmal });
  }
  return ut;
}

export async function stillSporsmal(egen: string, feiltyper: string[]): Promise<{ ok: true; grupper: FeilMedSporsmal[] } | Feilet> {
  try {
    const { input } = await kallVerktoy<{ feil: FeilMedSporsmal[] }>({
      system: FEILEN_SPORSMAL_SYSTEM,
      verktoy: SPORSMAL_VERKTOY,
      bruker: feilenBruker(egen, feiltyper),
      effort: "low",
      maksTokens: 1500,
    });
    return { ok: true, grupper: beskjaer(input.feil) };
  } catch (e) {
    return grunn(e);
  }
}

export async function skrivBeskrivelse(
  egen: string,
  fakta: Fakta[],
  feiltyper: string[],
): Promise<{ ok: true; titler: string[]; avsnitt: string[]; utelatt: Utelatt[] } | Feilet> {
  try {
    const { input } = await kallVerktoy<{ feil: string[]; avsnitt: string[]; utelatt: Utelatt[] }>({
      system: FEILEN_SKRIV_SYSTEM,
      verktoy: SKRIV_VERKTOY,
      bruker: feilenBruker(egen, feiltyper, fakta),
      effort: "medium",
      maksTokens: 2500,
    });
    // The draft goes through the same check as what the buyer saves: within the limits, no brackets.
    const avsnitt = lesAvsnitt(input.avsnitt);
    if (!avsnitt) return { ok: false, grunn: "feilet" };
    const titler = input.feil.map((f) => kort(f, FEILBESKRIVELSE.feilTittelMaks)).filter((f): f is string => f !== null).slice(0, FEILBESKRIVELSE.maksFeil);
    const utelatt: Utelatt[] = [];
    for (const u of input.utelatt) {
      const hva = kort(u.hva, 200);
      if (hva && UTELATT_STEG.includes(u.steg)) utelatt.push({ hva, steg: u.steg });
    }
    return { ok: true, titler, avsnitt, utelatt };
  } catch (e) {
    return grunn(e);
  }
}
