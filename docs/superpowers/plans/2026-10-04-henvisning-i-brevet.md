# Henvisning i brevet – implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hvert reklamasjonsbrev som kan kjøpes, viser fra første utkast til ett kontrollert vedtak, det samme som vurderingen viste. Kjøperens valg av vedtak i saksmappen fjernes.

**Architecture:**
- Et kuratert bibliotek (`src/lib/vurdering/henvisninger.ts`) med to slags poster:
  - `lignende`: samme feilgruppe, tidsrom og aldersgruppe
  - `regel`: en sak der utvalget la samme regel til grunn som brevet bygger på
- En ren funksjon `velgHenvisning(f)` går gjennom en stige (lignende, nabotidsrom, regel) og gir alltid svar, med mindre loven stopper kravet.
- Vurderingen, brevet (`byggBrev`) og saksmappen kaller den samme funksjonen. Ingenting lagres i `brevsak`.
- Biblioteket fylles av agenter og kontrolleres av et skript mot databasen.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Vitest, Playwright, Drizzle mot Neon, `docx`, `pdf-lib`, tsx-skript.

**Spec:** `docs/superpowers/specs/2026-10-04-henvisning-i-brevet-design.md`

## Global Constraints

- Les relevant guide i `node_modules/next/dist/docs/` før du endrer Next-kode (AGENTS.md).
- Kode og identifikatorer på norsk, kommentarer på engelsk, i samme stil som filene rundt.
- Vitest bare for vurderingsmotoren (`src/lib/vurdering/`) og brevet (`src/lib/brev/brev*.test.ts`). Ingen nye testfiler. `eksempler.test.ts` flyttes til `henvisninger.test.ts`. Ingen nye Playwright-tester. Rød test: les feilen. Er endringen bevisst, oppdater testen; ellers rett koden. Aldri `skip`/`fixme`.
- Testdata er oppdiktet: ingen navn, adresser eller regnummer.
- Ikke vis eller lagre rå PDF-tekst eller navn. Tekst fra `vedtak` er `fulltekst_renset`. Ingenting fra `brevsak` sendes til en språkmodell.
- Lovendringen gjelder avtaler inngått fra `PRESUMSJON_TO_AR_FRA = "2024-01-01"`.
- Høyst én henvisning per brev. Ingen beløp i brevets henvisning. Ingen navn. Nøktern tone.
- Juridisk ordlyd står i `JURIDISK` i `src/lib/brev/brev.ts` (ikke lest av jurist).
- Commit bare når brukeren ber om det. Commit-stegene under gjelder hvis brukeren har bedt om commits for denne planen. Ellers hoppes de over, og endringene blir liggende i arbeidstreet.

## Review Focus

1. **Kjøpsdato rettet fra 2025 til 2023 på brevsiden, med feil etter 6–24 måneder:** Brevet må bytte bort et vedtak som ble vunnet på formodningsregelen. Testes i Task 5 (`brev-krav.test.ts`).
2. **Bil uten årstall i registeret (`kjoretoy.ar === null`):** Det skal fortsatt komme en henvisning, med den eldste siterte bilen. Testes i Task 1 og i garantitesten i Task 3.
3. **Svært gammel bil (25 år):** Brevet får en regel-sak, ikke en lignende sak med en mye nyere bil. Testes i garantitesten i Task 3.
4. **Kjøperen visste om feilen, eller valgte bare «Annet»:** Det skal fortsatt komme en henvisning, da som regel-sak. Testes i Task 1 og i garantitesten i Task 3.
5. **Lang onacos-lenke (ca. 140 tegn) i PDF:** Lenken skal brytes på `/ ? & =`, ikke midt i et ord, og være klikkbar. Sjekkes manuelt i Task 6, fordi eksporten ikke har Vitest-tester (CLAUDE.md).

---

### Task 1: Biblioteket som type og `velgHenvisning` (stigen)

**Files:**
- Create: `src/lib/vurdering/henvisninger.ts`
- Modify: `src/lib/vurdering/typer.ts` (`KlageInput.bilOgKjop.bilAr`)
- Modify: `src/lib/vurdering/faktorer.ts` (`bilAlder`, eksporter `KNAPP_TIL_FEILTYPE`)
- Move + rewrite: `src/lib/vurdering/eksempler.test.ts` → `src/lib/vurdering/henvisninger.test.ts`

**Interfaces:**
- Produces:
  - `type Gruppe`, `GRUPPER`, `type Regelgrunnlag`, `REGELGRUNNLAG`
  - `type LignendePost`, `type RegelPost`, `type Henvisning`, `type Treff = "lignende" | "tilnaermet" | "regel"`, `type ValgtHenvisning = { henvisning: Henvisning; treff: Treff }`
  - `HENVISNINGER: readonly Henvisning[]` (tom liste til Task 3)
  - `velgHenvisning(f: Faktorer, bibliotek?: readonly Henvisning[]): ValgtHenvisning | null`
  - `regelgrunnlag(f: Faktorer): Regelgrunnlag`
  - `MAKS_NYERE_AR = 4`
  - `Faktorer.bilAlder: number | null`, `KlageInput.bilOgKjop.bilAr?: number`
  - `KNAPP_TIL_FEILTYPE` eksportert fra `faktorer.ts`

- [ ] **Step 1: Flytt testfilen og skriv de feilende testene**

```bash
git mv src/lib/vurdering/eksempler.test.ts src/lib/vurdering/henvisninger.test.ts
```

Erstatt hele innholdet i `src/lib/vurdering/henvisninger.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { beregnFaktorer } from "./faktorer";
import { velgHenvisning, type Henvisning, type LignendePost, type RegelPost } from "./henvisninger";
import type { FeilKnapp, FeilOpplysning, KlageInput, Kjopsform, Oppdaget } from "./typer";

const IDAG = "2026-10-01";

type Valg = { typer?: FeilKnapp[]; oppdaget?: Oppdaget; kjopsdato?: string; bilAr?: number; rapport?: boolean; feilOpplysning?: FeilOpplysning; opplystForKjop?: "ja" | "nei"; kjopsform?: Kjopsform };
const klage = (o: Valg = {}): KlageInput => ({
  bilOgKjop: { kjopsform: o.kjopsform ?? "forhandler", kjopsdato: o.kjopsdato ?? "2025-03-01", kjopesumNok: 150000, ...(o.bilAr !== undefined && { bilAr: o.bilAr }) },
  feilen: { typer: o.typer ?? ["motor"], oppdaget: o.oppdaget ?? "innen_6_mnd", opplystForKjop: o.opplystForKjop ?? "nei", feilOpplysning: o.feilOpplysning ?? "nei", kontakt: "ja" },
  bevis: { verkstedrapport: o.rapport ?? false, rapportSierForKjop: o.rapport ? true : null, bilder: null },
});
const velg = (o: Valg, bibliotek: Henvisning[]) => velgHenvisning(beregnFaktorer(klage(o), IDAG), bibliotek);

// Made-up posts: the selection rules are tested here, the real library in «biblioteket» below.
const felles = {
  ref: "FKU-2024-1",
  organ: "Forbrukerklageutvalget",
  dato: "2024-01-31",
  kildeUrl: "https://example.test/v.pdf",
  km: 150000,
  lov: "før_2024",
  setning: "I 2024 fikk kjøperen av en Testbil medhold etter å ha klaget på motorfeil 10 dager etter kjøpet. Utvalget tilkjente 10 000 kr.",
} as const;
let neste = 1;
const lignende = (o: Partial<LignendePost> = {}): LignendePost => ({
  ...felles,
  vedtakId: neste++,
  type: "lignende",
  gruppe: "motor",
  botte: "rask",
  alder: 10,
  presumsjon: true,
  likhet: "En testbil kjøpt hos forhandler fikk motorfeil.",
  konklusjon: "Utvalget kom til at bilen hadde en mangel.",
  ...o,
});
const regel = (o: Partial<RegelPost> = {}): RegelPost => ({
  ...felles,
  vedtakId: neste++,
  type: "regel",
  grunnlag: "formodning",
  alder: 14,
  presumsjon: true,
  regel: "I en sak om en testbil la utvalget formodningsregelen til grunn.",
  ...o,
});
const REGLER = [regel({ vedtakId: 900 }), regel({ vedtakId: 901, grunnlag: "rapport", presumsjon: false }), regel({ vedtakId: 902, grunnlag: "opplysning", presumsjon: false }), regel({ vedtakId: 903, grunnlag: "forventning", presumsjon: false })];

describe("velgHenvisning", () => {
  it("samme feilgruppe og tidsrom gir en lignende sak", () => {
    const v = velg({}, [lignende({ vedtakId: 100 }), ...REGLER]);
    expect(v).toMatchObject({ treff: "lignende", henvisning: { vedtakId: 100 } });
  });

  it("uten sak for tidsrommet brukes nabotidsrommet når formodningsregelen tillater det", () => {
    // Bought 2025, defect after 6–24 months: inside the two-year presumption, so a «rask» decision fits.
    const v = velg({ oppdaget: "6_mnd_til_2_ar" }, [lignende({ vedtakId: 110 }), ...REGLER]);
    expect(v).toMatchObject({ treff: "tilnaermet", henvisning: { vedtakId: 110 } });
  });

  it("aldri en sak vunnet på formodningsregelen for en kjøper som ikke har den", () => {
    // Bought 2023, defect after 6–24 months: the six-month presumption does not reach it.
    const v = velg({ oppdaget: "6_mnd_til_2_ar", kjopsdato: "2023-03-01" }, [lignende({ vedtakId: 120 }), ...REGLER]);
    expect(v).toMatchObject({ treff: "regel", henvisning: { vedtakId: 903, grunnlag: "forventning" } });
  });

  it("regel-saken følger grunnlaget brevet bygger på", () => {
    expect(velg({ typer: ["annet"] }, REGLER)?.henvisning.vedtakId).toBe(900);
    expect(velg({ oppdaget: "over_2_ar", kjopsdato: "2023-03-01", rapport: true }, REGLER)?.henvisning.vedtakId).toBe(901);
    expect(velg({ oppdaget: "over_2_ar", kjopsdato: "2023-03-01", feilOpplysning: "ja_dokumentert" }, REGLER)?.henvisning.vedtakId).toBe(902);
    expect(velg({ oppdaget: "over_2_ar", kjopsdato: "2023-03-01" }, REGLER)?.henvisning.vedtakId).toBe(903);
  });

  it("kjøperen visste om feilen: fortsatt en henvisning", () => {
    expect(velg({ opplystForKjop: "ja" }, [lignende({ vedtakId: 130 }), ...REGLER])?.henvisning.vedtakId).toBe(130);
  });

  it("en sak etter ny lov brukes bare for kjøp fra 2024, og foretrekkes da", () => {
    const bibliotek = [lignende({ vedtakId: 140 }), lignende({ vedtakId: 141, lov: "etter_2024" }), ...REGLER];
    expect(velg({ kjopsdato: "2023-03-01" }, bibliotek)?.henvisning.vedtakId).toBe(140);
    expect(velg({ kjopsdato: "2025-03-01" }, bibliotek)?.henvisning.vedtakId).toBe(141);
  });

  it("den siterte bilen er ikke mer enn fire år nyere enn kjøperens", () => {
    // The buyer's car was 15 years old at purchase.
    expect(velg({ bilAr: 2010 }, [lignende({ vedtakId: 150, alder: 10 }), ...REGLER])?.treff).toBe("regel");
    expect(velg({ bilAr: 2010 }, [lignende({ vedtakId: 151, alder: 11 }), ...REGLER])?.henvisning.vedtakId).toBe(151);
  });

  it("nærmeste alder foretrekkes; ukjent alder gir den eldste bilen", () => {
    const bibliotek = [lignende({ vedtakId: 160, alder: 4 }), lignende({ vedtakId: 161, alder: 12 }), ...REGLER];
    expect(velg({ bilAr: 2021 }, bibliotek)?.henvisning.vedtakId).toBe(160);
    expect(velg({}, bibliotek)?.henvisning.vedtakId).toBe(161);
  });

  it("med flere feil vinner samme tidsrom i en annen gruppe over nabotidsrom i den første", () => {
    const bibliotek = [lignende({ vedtakId: 170, botte: "middels", presumsjon: false }), lignende({ vedtakId: 171, gruppe: "rust" }), ...REGLER];
    expect(velg({ typer: ["motor", "rust"] }, bibliotek)?.henvisning.vedtakId).toBe(171);
  });

  it("når loven stopper kravet, er det ingen henvisning", () => {
    expect(velg({ kjopsform: "privatperson" }, [lignende(), ...REGLER])).toBeNull();
  });
});
```

- [ ] **Step 2: Kjør testene og se at de feiler**

Run: `npx vitest run src/lib/vurdering/henvisninger.test.ts`
Expected: FAIL med «Cannot find module './henvisninger'» (eller tilsvarende).

- [ ] **Step 3: Legg til `bilAr` i `KlageInput`**

I `src/lib/vurdering/typer.ts`, i `bilOgKjop` rett under `kmVedKjop?: number;`:

```ts
    // The year the vehicle was first registered (from the registry lookup); gives its age at purchase.
    bilAr?: number;
```

- [ ] **Step 4: Legg til `bilAlder` i `Faktorer` og eksporter `KNAPP_TIL_FEILTYPE`**

I `src/lib/vurdering/faktorer.ts`:
- Endre `const KNAPP_TIL_FEILTYPE` til `export const KNAPP_TIL_FEILTYPE`.
- Legg til i typen `Faktorer`, rett etter `feilgrupper`:

```ts
  // The car's age in whole years at purchase, from its first registration. null when not known.
  bilAlder: number | null;
```

- Sett i `beregnFaktorer`, rett etter `feilgrupper,` i returobjektet:

```ts
    bilAlder: b.bilAr ? Math.max(0, Number(kjopsdato.slice(0, 4)) - b.bilAr) : null,
```

- [ ] **Step 5: Skriv `src/lib/vurdering/henvisninger.ts`**

```ts
import { KNAPP_TIL_FEILTYPE, type Faktorer, type Reklamasjonsbotte } from "./faktorer";
import type { Feiltype } from "./typer";

// The decision the letter cites and the assessment shows, from a library of decisions that are
// read and checked against the decision text (docs/henvisninger.md, scripts/sjekk-henvisninger.ts).
// Two kinds: a similar case (same defect group, timing and car age), and a case where the committee
// applied the same rule the letter rests on. The second kind always exists, so every claim the law
// does not stop gets one.

export const GRUPPER = ["motor", "elektrisk", "understell", "km_service", "rust", "bremser", "girkasse", "fukt", "klimaanlegg", "skade", "batteri"] as const;
export type Gruppe = (typeof GRUPPER)[number];

// The rule the letter's paragraph on the defect rests on: the § 18 presumption, a report that the
// defect was there at delivery, wrong information from the dealer (§ 16), or that the car was worse
// than the buyer had reason to expect (§ 15).
export const REGELGRUNNLAG = ["formodning", "rapport", "opplysning", "forventning"] as const;
export type Regelgrunnlag = (typeof REGELGRUNNLAG)[number];

export type Organ = "Forbrukerklageutvalget" | "Forbrukertvistutvalget";

type Felles = {
  vedtakId: number;
  // As the committee cites its own decisions: FKU-2023-13923 for case 23/13923.
  ref: string;
  organ: Organ;
  // The day of the decision (ÅÅÅÅ-MM-DD), as in «Porsgrunn, den …».
  dato: string;
  kildeUrl: string;
  // The cited car's age at purchase in whole years, and its mileage, as the decision gives them.
  alder: number;
  km: number | null;
  // By the cited purchase date: the 2024 changes apply to contracts made from 1 January 2024.
  lov: "før_2024" | "etter_2024";
  // The cited buyer had the § 18 presumption (six months before 2024, two years from 2024).
  presumsjon: boolean;
  // For the buyer, on the assessment page.
  setning: string;
};
export type LignendePost = Felles & {
  type: "lignende";
  gruppe: Gruppe;
  // When the defect showed in the cited case, by the decision text.
  botte: Reklamasjonsbotte;
  // One sentence each, for the dealer: the facts of the case, and what the committee concluded.
  likhet: string;
  konklusjon: string;
};
export type RegelPost = Felles & {
  type: "regel";
  grunnlag: Regelgrunnlag;
  // One sentence for the dealer: the case and the rule the committee applied.
  regel: string;
};
export type Henvisning = LignendePost | RegelPost;

// lignende: same group and timing. tilnaermet: same group, the neighbouring timing. regel: same rule.
export type Treff = "lignende" | "tilnaermet" | "regel";
export type ValgtHenvisning = { henvisning: Henvisning; treff: Treff };

// A cited car may be at most this much newer than the buyer's: an older car with the same defect is
// a stronger comparison, a much newer one invites «normal wear».
export const MAKS_NYERE_AR = 4;

// Filled from the curation in docs/henvisninger.md; checked by `npm run sjekk-henvisninger`.
export const HENVISNINGER: readonly Henvisning[] = [];

const GRUPPE_FOR = Object.fromEntries(
  GRUPPER.map((g) => [KNAPP_TIL_FEILTYPE[g][0], g]),
) as Partial<Record<Feiltype, Gruppe>>;

// Only the neighbouring timing: a defect after two weeks is not compared with one after four years.
const NABO: Record<Reklamasjonsbotte, Reklamasjonsbotte[]> = { rask: ["middels"], middels: ["rask", "sen"], sen: ["middels"] };

export function regelgrunnlag(f: Faktorer): Regelgrunnlag {
  if (f.presumsjon) return "formodning";
  if (f.rapportSierForKjop === true) return "rapport";
  if (f.feilOpplysninger) return "opplysning";
  return "forventning";
}

// Never a decision won on something the buyer does not have: the presumption, or the 2024 rules.
const forenlig = (h: Henvisning, f: Faktorer) => (!h.presumsjon || f.presumsjon) && (h.lov === "før_2024" || f.presumsjonManeder === 24);
const alderOk = (h: Henvisning, f: Faktorer) => f.bilAlder === null || h.alder >= f.bilAlder - MAKS_NYERE_AR;

// Same law as the buyer first, then the nearest age (the older car on a tie, and when the buyer's
// age is unknown), then the newest decision.
function best<T extends Henvisning>(kandidater: T[], f: Faktorer): T | undefined {
  const lov = f.presumsjonManeder === 24 ? "etter_2024" : "før_2024";
  const avstand = (h: Henvisning) => (f.bilAlder === null ? 0 : Math.abs(h.alder - f.bilAlder));
  return [...kandidater].sort(
    (a, b) => Number(b.lov === lov) - Number(a.lov === lov) || avstand(a) - avstand(b) || b.alder - a.alder || b.dato.localeCompare(a.dato),
  )[0];
}

export function velgHenvisning(f: Faktorer, bibliotek: readonly Henvisning[] = HENVISNINGER): ValgtHenvisning | null {
  // A claim the law stops gets no letter, and a won decision would mislead.
  if (f.stopp) return null;
  const grupper = GRUPPER.filter((g) => f.feilgrupper.some((fg) => GRUPPE_FOR[fg[0]] === g));
  const lignende = bibliotek.filter((h): h is LignendePost => h.type === "lignende" && forenlig(h, f) && alderOk(h, f));
  const trinn: [Treff, Reklamasjonsbotte[]][] = [
    ["lignende", [f.reklamasjonsbotte]],
    ["tilnaermet", NABO[f.reklamasjonsbotte]],
  ];
  for (const [treff, botter] of trinn) {
    for (const g of grupper) {
      const h = best(lignende.filter((x) => x.gruppe === g && botter.includes(x.botte)), f);
      if (h) return { henvisning: h, treff };
    }
  }
  const grunnlag = regelgrunnlag(f);
  const h = best(bibliotek.filter((x): x is RegelPost => x.type === "regel" && x.grunnlag === grunnlag && forenlig(x, f)), f);
  return h ? { henvisning: h, treff: "regel" } : null;
}
```

- [ ] **Step 6: Kjør testene**

Run: `npx vitest run src/lib/vurdering/henvisninger.test.ts`
Expected: PASS (10 tester).

Run: `npm test && npm run typecheck`
Expected: Alt grønt. `eksempler.ts` brukes fortsatt av `vurder.ts` og påvirkes ikke. Hvis en test i `faktorer.test.ts` sammenligner hele `Faktorer`-objektet og feiler på det nye feltet, legg til `bilAlder: null` i forventningen. Det er en bevisst endring.

- [ ] **Step 7: Commit**

```bash
git add src/lib/vurdering/henvisninger.ts src/lib/vurdering/henvisninger.test.ts src/lib/vurdering/faktorer.ts src/lib/vurdering/typer.ts
git commit -m "Velg henvisning til vedtak med stige: lignende sak, nabotidsrom, samme regel"
```

---

### Task 2: Kandidatskript og kontrollskript

**Files:**
- Create: `scripts/henvisning-kandidater.ts`
- Create: `scripts/sjekk-henvisninger.ts`
- Create: `scripts/henvisninger-belegg.json` (innhold `{}`)
- Modify: `package.json` (to skript)

**Interfaces:**
- Consumes: `GRUPPER`, `HENVISNINGER`, `REGELGRUNNLAG`, `type Organ` (Task 1), `KNAPP_TIL_FEILTYPE` (Task 1), `sitatFinnes` (`src/lib/validering.ts`)
- Produces:
  - `npm run henvisning-kandidater [-- --ut <fil>] [-- --tekst <id>]`
  - `npm run sjekk-henvisninger`, som avslutter med 1 når noe er galt
  - Formatet på `scripts/henvisninger-belegg.json`: `{ "<vedtakId>": { "<påstand>": "<ordrett sitat>" } }`. For `lignende` kreves nøklene `feil`, `tid`, `bil` og `utfall`. For `regel` kreves `regel`, `bil` og `utfall`.

Skriptene er dataverktøy, ikke tester (CLAUDE.md). De verifiseres ved å kjøre dem.

- [ ] **Step 1: Legg til skriptene i `package.json`**

Under `"scripts"`, etter `"rydd"`:

```json
    "henvisning-kandidater": "tsx --env-file=.env.local scripts/henvisning-kandidater.ts",
    "sjekk-henvisninger": "tsx --env-file=.env.local scripts/sjekk-henvisninger.ts"
```

(Husk komma etter linjen med `rydd`.)

- [ ] **Step 2: Skriv `scripts/henvisning-kandidater.ts`**

```ts
// Candidate decisions for the library the letter cites (docs/henvisninger.md): the newest won dealer
// decisions per defect group, timing and car age, and per rule the letter can rest on. Read-only.
//
//   npm run henvisning-kandidater -- [--ut data/explore/henvisning-kandidater.json]
//   npm run henvisning-kandidater -- --tekst 1691      prints one decision's redacted text

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../src/db";
import { KNAPP_TIL_FEILTYPE } from "../src/lib/vurdering/faktorer";
import { GRUPPER } from "../src/lib/vurdering/henvisninger";

const { values: args } = parseArgs({ options: { ut: { type: "string", default: "data/explore/henvisning-kandidater.json" }, tekst: { type: "string" } } });
const rader = async (q: SQL) => (await db.execute(q)).rows as Record<string, unknown>[];
const PER_LISTE = 10;

const GRUNN = sql`v.selger_type = 'forhandler' and v.utfall in ('medhold','delvis_medhold') and not v.trenger_kontroll and v.kjoretoytype in ('personbil','varebil')`;
const BOTTER: Record<string, SQL> = {
  rask: sql`v.dager_til_reklamasjon <= 180`,
  middels: sql`v.dager_til_reklamasjon between 181 and 730`,
  sen: sql`v.dager_til_reklamasjon > 730`,
};
const ALDER: Record<string, SQL> = { yngre: sql`v.alder_ved_kjop <= 7`, eldre: sql`v.alder_ved_kjop >= 8` };
// Won without the presumption under the old law, so the decision fits a buyer who does not have it.
const UTEN_FORMODNING = sql`v.dager_til_reklamasjon > 180 and v.kjopsdato < '2024-01-01'`;
const FORMODNING_I_TEKST = sql`v.fulltekst_renset ~* '(formodningsregel|18 annet ledd|18 andre ledd)'`;
const REGLER: Record<string, SQL> = {
  "formodning/før_2024": sql`v.dager_til_reklamasjon <= 180 and v.kjopsdato < '2024-01-01' and v.alder_ved_kjop >= 10 and ${FORMODNING_I_TEKST}`,
  "formodning/etter_2024": sql`v.kjopsdato >= '2024-01-01' and v.dager_til_reklamasjon <= 730 and ${FORMODNING_I_TEKST}`,
  rapport: sql`${UTEN_FORMODNING} and v.alder_ved_kjop >= 8 and v.bevistyper && array['verkstedrapport','takst','NAF_test']::text[]`,
  opplysning: sql`${UTEN_FORMODNING} and v.alder_ved_kjop >= 8 and 'feil_opplysninger' = any(v.mangelsgrunnlag)`,
  forventning: sql`${UTEN_FORMODNING} and v.alder_ved_kjop >= 12 and 'om_det_er_mangel' = any(v.tvistetema)`,
};
const KOLONNER = sql`v.id, v.saksnummer, v.vedtaksdato::text vedtaksdato, v.kjopsdato::text kjopsdato, v.alder_ved_kjop alder, v.km_ved_kjop km,
  v.merke, v.modell, v.dager_til_reklamasjon dager, v.utfall, v.feiltyper, v.sammendrag, v.utvalgets_nokkelmomenter momenter`;

async function main() {
  if (args.tekst) {
    const [r] = await rader(sql`select saksnummer, vedtaksdato::text vedtaksdato, kilde_url, fulltekst_renset from vedtak where id = ${Number(args.tekst)}`);
    if (!r) throw new Error(`fant ikke vedtak ${args.tekst}`);
    console.log(`${r.saksnummer} · ${r.vedtaksdato} · ${r.kilde_url}\n\n${r.fulltekst_renset}`);
    return;
  }
  const lister: Record<string, Record<string, unknown>[]> = {};
  for (const gruppe of GRUPPER) {
    const typer = sql`array[${sql.join(KNAPP_TIL_FEILTYPE[gruppe].map((t) => sql`${t}`), sql`, `)}]::text[]`;
    for (const [botte, b] of Object.entries(BOTTER))
      for (const [alder, a] of Object.entries(ALDER))
        lister[`lignende/${gruppe}/${botte}/${alder}`] = await rader(
          sql`select ${KOLONNER} from vedtak v where ${GRUNN} and v.feiltyper && ${typer} and ${b} and ${a} order by v.vedtaksdato desc limit ${PER_LISTE}`,
        );
  }
  for (const [navn, r] of Object.entries(REGLER))
    lister[`regel/${navn}`] = await rader(sql`select ${KOLONNER} from vedtak v where ${GRUNN} and ${r} order by v.vedtaksdato desc limit ${PER_LISTE + 2}`);

  mkdirSync(dirname(args.ut!), { recursive: true });
  writeFileSync(args.ut!, JSON.stringify(lister, null, 2));
  for (const [navn, l] of Object.entries(lister)) console.log(`${navn.padEnd(36)} ${l.length}`);
  console.log(`Skrevet til ${args.ut}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
```

- [ ] **Step 3: Kjør kandidatskriptet**

Run: `npm run henvisning-kandidater`
Expected: én linje per liste, de fleste `lignende/*/rask/*` med 10. `regel/formodning/før_2024`, `regel/rapport`, `regel/opplysning` og `regel/forventning` har alle minst 1 (funn 4 i spesifikasjonen: 41, 49, mange, mange). Filen `data/explore/henvisning-kandidater.json` finnes (`explore` er git-ignorert).

Run: `npm run henvisning-kandidater -- --tekst 1691`
Expected: «23/13923 · 2024-01-31 · https://innsyn.onacos.no/…», etterfulgt av vedtaksteksten.

- [ ] **Step 4: Skriv `scripts/henvisninger-belegg.json`**

```json
{}
```

- [ ] **Step 5: Skriv `scripts/sjekk-henvisninger.ts`**

```ts
// Checks every decision in the library the letter cites against the database and the decision
// text: id, dealer, outcome, link, date, case reference, committee, law, presumption, car age,
// every number in the sentences, and a verbatim quote behind every claim. Read-only; exits 1 on
// any error, so the library cannot drift from its sources.
//
//   npm run sjekk-henvisninger

import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { sitatFinnes } from "../src/lib/validering";
import { HENVISNINGER, REGELGRUNNLAG, type Henvisning, type Organ } from "../src/lib/vurdering/henvisninger";

const kjerne = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const BELEGG_KREVES: Record<Henvisning["type"], string[]> = { lignende: ["feil", "tid", "bil", "utfall"], regel: ["regel", "bil", "utfall"] };

// The committee cites its own decisions as FKU-2019-759 for case 19/759; the newer case numbers already have that form.
export function refFor(saksnummer: string, organ: Organ): string {
  const m = /^(\d{2})\/(\d+)$/.exec(saksnummer);
  return m ? `${organ === "Forbrukertvistutvalget" ? "FTU" : "FKU"}-20${m[1]}-${m[2]}` : saksnummer;
}

async function main() {
  const belegg = JSON.parse(readFileSync("scripts/henvisninger-belegg.json", "utf8")) as Record<string, Record<string, string>>;
  const feil: string[] = [];
  if (HENVISNINGER.length === 0) feil.push("biblioteket er tomt");
  const ider = HENVISNINGER.map((h) => h.vedtakId);
  for (const id of new Set(ider)) if (ider.filter((x) => x === id).length > 1) feil.push(`#${id} står flere ganger`);
  for (const g of REGELGRUNNLAG)
    if (!HENVISNINGER.some((h) => h.type === "regel" && h.grunnlag === g && h.lov === "før_2024")) feil.push(`grunnlaget ${g} mangler en regel-post etter gammel lov`);

  const rader = ider.length
    ? ((await db.execute(sql`select id, saksnummer, vedtaksdato::text vedtaksdato, kjopsdato::text kjopsdato, kilde_url, selger_type, utfall, selger_navn, alder_ved_kjop, fulltekst_renset
        from vedtak where id in (${sql.join(ider.map((i) => sql`${i}`), sql`, `)})`)).rows as Record<string, unknown>[])
    : [];

  for (const h of HENVISNINGER) {
    const ut = (m: string) => feil.push(`#${h.vedtakId} ${h.ref}: ${m}`);
    const r = rader.find((x) => Number(x.id) === h.vedtakId);
    if (!r) {
      ut("finnes ikke i databasen");
      continue;
    }
    const tekst = String(r.fulltekst_renset ?? "");
    if (r.selger_type !== "forhandler") ut(`selger er ${r.selger_type}, ikke forhandler`);
    if (r.utfall !== "medhold" && r.utfall !== "delvis_medhold") ut(`utfall ${r.utfall}`);
    if (r.kilde_url !== h.kildeUrl) ut("kildeUrl er ulik databasen");
    if (r.vedtaksdato !== h.dato) ut(`dato ${h.dato}, databasen har ${r.vedtaksdato}`);
    const [a, m, d] = h.dato.split("-");
    if (![`${d}.${m}.${a}`, `${Number(d)}.${Number(m)}.${a}`].some((x) => tekst.includes(x))) ut("datoen står ikke i vedtaket");
    const organ: Organ = /FTU-sak|Forbrukertvistutvalget/.test(tekst.slice(0, 600)) ? "Forbrukertvistutvalget" : "Forbrukerklageutvalget";
    if (h.organ !== organ) ut(`organ ${h.organ}, toppteksten sier ${organ}`);
    if (h.ref !== refFor(String(r.saksnummer), organ)) ut(`ref ${h.ref}, ventet ${refFor(String(r.saksnummer), organ)}`);
    const lov = r.kjopsdato ? (String(r.kjopsdato) >= "2024-01-01" ? "etter_2024" : "før_2024") : null;
    if (lov !== h.lov) ut(`lov ${h.lov}, kjøpsdatoen i databasen er ${r.kjopsdato}`);
    if (r.alder_ved_kjop !== null && Math.abs(Number(r.alder_ved_kjop) - h.alder) > 1) ut(`alder ${h.alder}, databasen har ${r.alder_ved_kjop}`);
    if (h.km !== null && !kjerne(tekst).includes(String(h.km))) ut(`km ${h.km} står ikke i vedtaket`);

    const presumsjon = h.type === "regel" ? h.grunnlag === "formodning" : h.botte === "rask" || (h.lov === "etter_2024" && h.botte === "middels");
    if (h.presumsjon !== presumsjon) ut(`presumsjon ${h.presumsjon}, ventet ${presumsjon}`);

    const setninger = h.type === "lignende" ? [h.setning, h.likhet, h.konklusjon] : [h.setning, h.regel];
    for (const s of setninger) {
      if (/[[\]]/.test(s)) ut(`hakeparentes i «${s}»`);
      if (r.selger_navn && kjerne(String(r.selger_navn)).length >= 3 && kjerne(s).includes(kjerne(String(r.selger_navn)))) ut(`forhandlerens navn i «${s}»`);
      // Amounts and mileage must be in the text; small numbers (months, days) are often worked out from dates.
      for (const t of s.match(/\d[\d  ]*\d/g) ?? []) {
        const n = t.replace(/[\s ]/g, "");
        if (Number(n) >= 1000 && !kjerne(tekst).includes(n)) ut(`tallet ${t} står ikke i vedtaket`);
      }
    }

    const b = belegg[String(h.vedtakId)];
    if (!b) ut("mangler belegg");
    else {
      for (const k of BELEGG_KREVES[h.type]) if (!b[k]) ut(`mangler belegg for «${k}»`);
      for (const [k, sitat] of Object.entries(b)) if (!sitatFinnes(sitat, tekst)) ut(`belegget for «${k}» står ikke ordrett i vedtaket: «${sitat}»`);
    }
  }

  for (const f of feil) console.error(f);
  console.log(`${HENVISNINGER.length} poster, ${feil.length} feil.`);
  if (feil.length > 0) process.exit(1);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
```

- [ ] **Step 6: Kjør kontrollskriptet mot det tomme biblioteket**

Run: `npm run sjekk-henvisninger`
Expected: exit 1 med «biblioteket er tomt» og «grunnlaget formodning mangler en regel-post etter gammel lov» (×4). Det viser at skriptet virker. Det blir grønt i Task 3.

Run: `npm run typecheck && npm run lint`
Expected: grønt.

- [ ] **Step 7: Commit**

```bash
git add scripts/henvisning-kandidater.ts scripts/sjekk-henvisninger.ts scripts/henvisninger-belegg.json package.json
git commit -m "Skript for kandidater til og kontroll av henvisningsbiblioteket"
```

---

### Task 3: Kurater biblioteket (agenter og skript) og garantitesten

**Files:**
- Modify: `src/lib/vurdering/henvisninger.ts` (`HENVISNINGER`)
- Modify: `scripts/henvisninger-belegg.json`
- Move + rewrite: `docs/eksempelsaker.md` → `docs/henvisninger.md`
- Modify: `src/lib/vurdering/henvisninger.test.ts` (ny `describe("biblioteket")`)

**Interfaces:**
- Consumes: kandidatfilen og `--tekst` (Task 2), typene (Task 1)
- Produces: `HENVISNINGER` med minst én `regel`-post med `før_2024` per grunnlag, og `lignende`-poster der en kandidat holder. `npm run sjekk-henvisninger` gir 0 feil.

Dette er dataarbeid som gjøres med Agent-verktøyet. Ingen person godkjenner (brukerens valg), så hver post går gjennom alle stegene under. Ingen tekst fra `brevsak` brukes. Agentene leser bare `vedtak` (renset tekst) med `npm run henvisning-kandidater -- --tekst <id>`.

- [ ] **Step 1: Skriv garantitesten og bibliotekstestene (feiler på tomt bibliotek)**

Legg til nederst i `src/lib/vurdering/henvisninger.test.ts`. Utvid importlinjene øverst med `HENVISNINGER, MAKS_NYERE_AR, REGELGRUNNLAG` fra `./henvisninger`, `FEILTYPER_KNAPPER` fra `./innsending` og `OPPDAGET_VALG` fra `./typer`.

```ts
// The sentence for the buyer, unchanged from the earlier examples.
const MAL = /^I 20\d\d fikk kjøperen av en .+ (delvis )?medhold etter å ha klaget på .+ (etter|som) kjøpet\. Utvalget (tilkjente [\d ]+ kr|kom til at .+)\.$/;

describe("biblioteket", () => {
  it("alle saker loven ikke stopper får en henvisning, og den er aldri vunnet på en fordel kjøperen mangler", () => {
    const avvik: string[] = [];
    const feil: FeilKnapp[][] = [...FEILTYPER_KNAPPER.map((t) => [t]), ["motor", "rust"], ["annet", "bremser"]];
    for (const typer of feil)
      for (const oppdaget of OPPDAGET_VALG)
        for (const kjopsdato of ["2023-03-01", "2025-03-01"])
          for (const alder of [null, 1, 6, 10, 15, 25])
            for (const rapport of [false, true])
              for (const feilOpplysning of ["nei", "ja_dokumentert"] as const)
                for (const opplystForKjop of ["nei", "ja"] as const) {
                  // A defect cannot show more than two years after a purchase 19 months ago.
                  if (kjopsdato === "2025-03-01" && oppdaget === "over_2_ar") continue;
                  const bilAr = alder === null ? undefined : Number(kjopsdato.slice(0, 4)) - alder;
                  const f = beregnFaktorer(klage({ typer, oppdaget, kjopsdato, bilAr, rapport, feilOpplysning, opplystForKjop }), IDAG);
                  const v = velgHenvisning(f);
                  const merke = JSON.stringify({ typer, oppdaget, kjopsdato, alder, rapport, feilOpplysning, opplystForKjop });
                  if (!v) {
                    avvik.push(`${merke}: ingen henvisning`);
                    continue;
                  }
                  const h = v.henvisning;
                  if (h.presumsjon && !f.presumsjon) avvik.push(`${merke}: #${h.vedtakId} er vunnet på formodningsregelen`);
                  if (h.lov === "etter_2024" && f.presumsjonManeder !== 24) avvik.push(`${merke}: #${h.vedtakId} er etter ny lov`);
                  if (h.type === "lignende" && f.bilAlder !== null && h.alder < f.bilAlder - MAKS_NYERE_AR) avvik.push(`${merke}: #${h.vedtakId} er en mye nyere bil`);
                }
    expect(avvik.slice(0, 15)).toEqual([]);
  });

  it("hvert grunnlag har en regel-post etter gammel lov, og bare formodning bygger på formodningsregelen", () => {
    for (const g of REGELGRUNNLAG) expect(HENVISNINGER.some((h) => h.type === "regel" && h.grunnlag === g && h.lov === "før_2024"), g).toBe(true);
    for (const h of HENVISNINGER) if (h.type === "regel") expect(h.presumsjon, `#${h.vedtakId}`).toBe(h.grunnlag === "formodning");
  });

  it("alle poster er fullstendige, unike og følger malen", () => {
    expect(new Set(HENVISNINGER.map((h) => h.vedtakId)).size).toBe(HENVISNINGER.length);
    for (const h of HENVISNINGER) {
      const navn = `#${h.vedtakId}`;
      expect(h.setning, navn).toMatch(MAL);
      expect(h.ref, navn).toMatch(/^(FKU|FTU)-\d{4}-\d+(-\d+)?$/);
      expect(h.kildeUrl, navn).toMatch(/^https:\/\/\S+$/);
      expect(h.dato, navn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const tekster = h.type === "lignende" ? [h.likhet, h.konklusjon] : [h.regel];
      for (const t of tekster) {
        expect(t, navn).toMatch(/^[A-ZÆØÅ].+\.$/);
        expect(t, navn).not.toMatch(/[[\]]|\d+ ?kr\b/);
      }
    }
  });
});
```

Run: `npx vitest run src/lib/vurdering/henvisninger.test.ts`
Expected: «biblioteket» FAIL («ingen henvisning» og manglende regel-poster). De 10 testene fra Task 1 PASS.

- [ ] **Step 2: Lag kandidatfilen**

Run: `npm run henvisning-kandidater`
Expected: `data/explore/henvisning-kandidater.json` er oppdatert.

- [ ] **Step 3: Utvelgelse, tre uavhengige agenter per liste**

Del listene i fire porsjoner:
- motor, elektrisk, understell
- km_service, rust, bremser, girkasse
- fukt, klimaanlegg, skade, batteri
- alle `regel/*`

Start for hver porsjon tre agenter samtidig (Agent-verktøyet, `general-purpose`), altså 12 agenter. Hver agent får denne prompten (fyll inn porsjonen):

```
Du er én av tre uavhengige vurderere. Repo: /Users/harald.somme/dev/tvistr. Les data/explore/henvisning-kandidater.json, listene: <PORSJON>.
For hver liste: velg det ene vedtaket som er best å vise til overfor en bilforhandler i et reklamasjonsbrev, eller «ingen».
Les sammendrag og nøkkelpunkter for alle kandidatene, og les deretter hele vedtaket for de 2–3 beste med:
  npm run henvisning-kandidater -- --tekst <id>
Bruk docs/eksempelsaker.md (tidligere håndplukkede eksempler med merknader) som hjelp, ikke som fasit.

Kriterier, i rekkefølge:
1. Kjøperen vant på akkurat denne feilen (lignende-lister: feilgruppen i listenavnet; den kan være én av flere feil) eller på denne regelen (regel-lister):
   - formodning: utvalget la til grunn at feilen var der ved levering fordi den viste seg innenfor formodningsperioden og forhandleren ikke beviste noe annet.
   - rapport: en verkstedrapport, takst eller NAF-test viste at feilen var der ved levering, og formodningsregelen gjaldt ikke.
   - opplysning: bilen svarte ikke til det annonsen eller forhandleren opplyste (fkjl § 16), og formodningsregelen gjaldt ikke.
   - forventning: bilen var i dårligere stand enn kjøperen hadde grunn til å regne med ut fra alder, km og pris (ikke normal slitasje), og formodningsregelen gjaldt ikke.
2. Forhandleren svarte i saken (ikke avgjort på kjøperens fremstilling alene).
3. Avgjort på vanlige mangelsregler i forbrukerkjøpsloven, ikke på garanti eller kjøpsloven.
4. Tid fra kjøp/overtakelse til feilen viste seg, og bilens alder ved kjøpet, stemmer med listenavnet ifølge vedtaksteksten (rask ≤ 6 mnd, middels 6–24 mnd, sen > 24 mnd; yngre 0–7 år, eldre 8+ år). Databasens dager_til_reklamasjon kan være feil.
5. Enstemmig, ingen dissens, ikke «under (noe) tvil».
6. Så nytt som mulig; eldre bare når ingen nyere holder. I samme aldersgruppe: velg den eldste bilen.
7. Gjenkjennelig bil og feil, klart utfall.
Svar KUN med JSON: [{"liste": "<navn>", "valg": <id eller null>, "begrunnelse": "<maks 30 ord, ingen personnavn>"}]
```

Lagre svarene i `data/explore/henvisning-valg-<porsjon>-<1|2|3>.json`.

- [ ] **Step 4: Avgjørelse der vurdererne er uenige**

For lister der ikke minst to av tre valgte samme id (eller samme «null»), start én agent per porsjon med de omstridte listene, de tre valgene og begrunnelsene. Agenten får samme kriterier og denne instruksen: «Les hele vedtaket for hvert foreslått valg og avgjør etter kriteriene. Svar med samme JSON-format.» Resultatet er én id (eller null) per liste. Lagre som `data/explore/henvisning-valg-endelig.json`.

- [ ] **Step 5: Tekst og belegg, én agent per porsjon**

Prompt (fyll inn ids):

```
Repo: /Users/harald.somme/dev/tvistr. For hvert vedtak under: les hele teksten (npm run henvisning-kandidater -- --tekst <id>) og skriv en post til biblioteket i src/lib/vurdering/henvisninger.ts (typene LignendePost/RegelPost der) pluss belegg.
Vedtak: <liste: id, listenavn>.

Felt:
- ref: FKU-20YY-N for saksnummer YY/N (FTU-20YY-N hvis toppteksten sier «FTU-sak»/Forbrukertvistutvalget); nyere saksnummer (FKU-2025-140302) som de er.
- organ: «Forbrukerklageutvalget» eller «Forbrukertvistutvalget» etter toppteksten.
- dato: vedtaksdatoen («Porsgrunn, den DD.MM.ÅÅÅÅ»), som ÅÅÅÅ-MM-DD.
- kildeUrl: fra utskriften.
- alder, km: bilens alder ved kjøpet (hele år) og km ved kjøpet ifølge teksten; km null hvis ikke oppgitt.
- lov: «før_2024» hvis kjøpsavtalen er inngått før 1.1.2024, ellers «etter_2024».
- presumsjon: lignende: true når feilen viste seg innen 6 mnd (før_2024) eller 2 år (etter_2024); regel: true bare for formodning.
- lignende: gruppe og botte fra listenavnet. regel: grunnlag fra listenavnet.
- setning (til kjøperen, eksakt mal): «I <år for dato> fikk kjøperen av en <merke modell> <medhold|delvis medhold> etter å ha klaget på <frase> <tid> etter kjøpet. Utvalget <tilkjente N kr|kom til at …>.»
  Frase per gruppe (bruk ordrett): motor «motorfeil», girkasse «feil på girkassen», elektrisk «elektrisk feil», understell «feil på understellet», bremser «bremsefeil», rust «rust», fukt «fukt eller lekkasje», klimaanlegg «feil på klimaanlegget», km_service «uriktige opplysninger om kilometerstand eller service», skade «en tidligere kollisjonsskade», batteri «feil på elbilbatteriet». Regel-poster: en kort, presis frase for feilen i saken.
- lignende.likhet (én setning til forhandleren): «En <merke modell> som var <alder> år gammel[ og hadde gått <km> km], ble kjøpt hos forhandler og fikk <feil> <tid> etter kjøpet.»
- lignende.konklusjon (én setning): «Utvalget kom til at <feilen> var en mangel forhandleren var ansvarlig for, og kjøperen fikk <prisavslag|erstatning|heving av kjøpet|dekket reparasjonen>.»
- regel.regel (én setning) etter grunnlag:
  formodning: «I en sak om en <alder> år gammel <merke modell> kjøpt hos forhandler kom utvalget til at <feil> som viste seg <tid> etter kjøpet, måtte anses å ha vært der ved leveringen, fordi forhandleren ikke hadde bevist noe annet.»
  rapport: «I en sak om en <alder> år gammel <merke modell> kjøpt hos forhandler la utvalget vekt på <en verkstedrapport|en takst|en NAF-test> som viste at <feil> var der ved leveringen, selv om den viste seg først <tid> etter kjøpet.»
  opplysning: «I en sak om en <alder> år gammel <merke modell> kjøpt hos forhandler kom utvalget til at bilen hadde en mangel fordi den ikke svarte til <hva som var opplyst>.»
  forventning: «I en sak om en <alder> år gammel <merke modell> med <km> km kjøpt hos forhandler kom utvalget til at <feil> var mer enn kjøperen måtte regne med ut fra alder, kilometerstand og pris.»
Regler: bokmål, nøkternt, ingen navn (heller ikke forhandlerens), ingen hakeparenteser, ingen beløp i likhet/konklusjon/regel. «Tid» som «om lag 14 måneder», «tre uker», «8 dager».
Belegg: for hver påstand et ORDRETT sitat (maks ca. 25 ord, kopiert tegn for tegn fra teksten). Nøkler for lignende: feil, tid, bil, utfall, krav. Nøkler for regel: regel, bil, utfall, og tid når setningen nevner tid.
Svar KUN med JSON: [{"post": {...alle felt...}, "belegg": {...}}]
```

- [ ] **Step 6: Uavhengig kontroll, én ny agent per porsjon (ikke den som skrev)**

Prompt:

```
Repo: /Users/harald.somme/dev/tvistr. Du kontrollerer poster til et bibliotek med vedtak som et reklamasjonsbrev viser til overfor en bilforhandler. En feil henvisning svekker hele brevet, så vær streng.
For hver post: les hele vedtaket (npm run henvisning-kandidater -- --tekst <vedtakId>) og sjekk HVER påstand i setning, likhet, konklusjon/regel og hvert felt (ref, organ, dato, alder, km, lov, presumsjon, botte/grunnlag) mot teksten.
Sjekk også kriteriene: kjøperen vant på akkurat denne feilen/regelen, forhandleren svarte, vanlige mangelsregler (ikke garanti), ikke «under tvil», ingen dissens, og at belegget faktisk underbygger påstanden.
Svar KUN med JSON: [{"vedtakId": n, "ok": true|false, "feil": ["<konkret avvik>"], "rettet": {<felt: ny verdi>} }]
Poster: <JSON fra Step 5>
```

Poster med `ok: false` skrives om etter `rettet` (eller forkastes, og da tas neste kandidat fra Step 3/4 gjennom Step 5–6). En omskrevet post kontrolleres på nytt av en ny agent. Ingen post tas inn uten `ok: true`.

- [ ] **Step 7: Skriv postene inn i biblioteket**

Lim inn de godkjente postene i `HENVISNINGER` i `src/lib/vurdering/henvisninger.ts`, gruppert med kommentarer: `// Lignende saker: motor`, … og `// Regel-saker`. Lim inn beleggene i `scripts/henvisninger-belegg.json` med nøkkel `"<vedtakId>"`.

Eksempel på form (verdiene er illustrasjoner, ikke fasit):

```ts
  {
    type: "lignende",
    vedtakId: 1691,
    ref: "FKU-2023-13923",
    organ: "Forbrukerklageutvalget",
    dato: "2024-01-31",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023121274&dokid=1115606&versjon=1&variant=A&",
    gruppe: "motor",
    botte: "middels",
    alder: 9,
    km: 125300,
    lov: "før_2024",
    presumsjon: false,
    setning: "I 2024 fikk kjøperen av en BMW X5 delvis medhold etter å ha klaget på motorfeil om lag 14 måneder etter kjøpet. Utvalget tilkjente 60 637 kr.",
    likhet: "En BMW X5 som var 9 år gammel og hadde gått 125 300 km, ble kjøpt hos forhandler og fikk feil på registerkjeden i motoren om lag 14 måneder etter kjøpet.",
    konklusjon: "Utvalget kom til at feilen var en mangel forhandleren var ansvarlig for, og kjøperen fikk erstatning.",
  },
```

- [ ] **Step 8: Kjør kontrollskriptet til det er grønt**

Run: `npm run sjekk-henvisninger`
Expected: «N poster, 0 feil.» Ved feil: rett posten mot vedtaksteksten (se `--tekst`). Kan den ikke rettes, fjernes den. Kjør Step 6 på nytt for en post der teksten er endret.

- [ ] **Step 9: Kjør bibliotekstestene**

Run: `npx vitest run src/lib/vurdering/henvisninger.test.ts`
Expected: PASS for alle tester, også garantitesten. Feiler garantitesten, mangler en regel-post. Gå tilbake til Step 3–8 for det grunnlaget.

- [ ] **Step 10: Dokumenter**

```bash
git mv docs/eksempelsaker.md docs/henvisninger.md
```

Skriv `docs/henvisninger.md` på nytt, i samme stil som før:
1. Innledning: hva biblioteket er (brevets henvisning og vurderingens eksempel), og stigen (lignende → nabotidsrom → samme regel).
2. Regelen «aldri vunnet på en fordel kjøperen mangler» med begrunnelse (lovendringen 1.1.2024 gjelder bare avtaler inngått etter den, og alle endringene styrket kjøperen).
3. Slik ble de valgt: kandidater (Task 2), tre vurderere, avgjørelse, tekst og belegg, uavhengig kontroll, `npm run sjekk-henvisninger`. Oppgi antall kandidater og hvor ofte vurdererne var enige.
4. Én seksjon per post (som før): setningen, «**Sak:** #id · ref · [vedtaket](url)», «**Fikk:**», «**Merk:**».
5. Kombinasjoner uten lignende sak, og hvorfor (dekkes av regel-trinnet).
6. Forkastet i kontrollen, med grunn.
7. Vedlikehold: når nye vedtak hentes, kjør `npm run henvisning-kandidater` og kurateringen for de berørte listene. Vedtak om kjøp fra 2024 foretrekkes.

Det gamle avsnittet om tapte saker fjernes. Det ligger i git-historikken.

- [ ] **Step 11: Commit**

```bash
git add src/lib/vurdering/henvisninger.ts src/lib/vurdering/henvisninger.test.ts scripts/henvisninger-belegg.json docs/henvisninger.md
git commit -m "Kuratert bibliotek med vedtak brevet viser til"
```

---

### Task 4: Vurderingen bruker biblioteket

**Files:**
- Modify: `src/lib/vurdering/vurder.ts`
- Delete: `src/lib/vurdering/eksempler.ts`
- Modify: `src/lib/vurdering/innsending.ts` (`tilKlageInput` leser `bilAr`)
- Modify: `src/app/api/vurder/route.ts`
- Modify: `src/app/vurdering/skjema.tsx`
- Modify: `src/lib/vurdering/vurder.test.ts`, `src/lib/vurdering/kombinasjoner.test.ts`, `e2e/registreringsflyt.spec.ts:53`
- Check: `scripts/vurder.ts` (bruker det `eksempel`? I så fall `eksempel.henvisning.setning`)

**Interfaces:**
- Consumes: `velgHenvisning`, `type ValgtHenvisning`, `type Treff` (Task 1), et fylt bibliotek (Task 3)
- Produces:
  - `Vurdering.eksempel: ValgtHenvisning | null`
  - `/api/vurder` svarer med `eksempel: { setning, ref, organ, kildeUrl, treff } | null`
  - forespørselsfeltet `bilAr` (heltall)

- [ ] **Step 1: Oppdater testene (feiler)**

`src/lib/vurdering/vurder.test.ts`:
- Linje ~106: `expect(v.eksempel?.setning).not.toMatch(/gjort kjent med feilen/);` blir til `expect(v.eksempel?.henvisning.setning).not.toMatch(/gjort kjent med feilen/);`
- Testen «også en svak sak får et eksempel der kjøperen fikk medhold» (~252) får dette innholdet:

```ts
  it("også en svak sak får en henvisning til en sak kjøperen vant", async () => {
    const v = await vurder(hent(6), dep());
    expect(v.niva).toBe("svak");
    expect(v.eksempel?.henvisning.setning).toMatch(/ medhold /);
    expect(v.eksempel?.henvisning.setning).not.toMatch(/ ikke medhold /);
  });
```

`src/lib/vurdering/kombinasjoner.test.ts`, i «gir forventet vurdering og et eksempelvedtak i alle fire statistikkscenarier»:
- `const teller = { god: 0, svak: 0, utenfor: 0, lignende: 0, tilnaermet: 0, regel: 0 };`, og `batteriBare` fjernes.
- Blokken fra `const e = v.eksempel;` til slutten av `if (grupper.length === 0) … else …` erstattes med:

```ts
        const e = v.eksempel;
        if (!e) {
          avvik.push(`${merke}: INGEN henvisning`);
          continue;
        }
        const h = e.henvisning;
        if (s === SCENARIER[0]) teller[e.treff]++;
        if (!MAL.test(h.setning)) avvik.push(`${merke}: setning følger ikke malen: ${h.setning}`);
        if (!h.kildeUrl.startsWith("https://") || !h.ref) avvik.push(`${merke}: henvisningen mangler kilde`);
        if (/ ikke medhold /.test(h.setning)) avvik.push(`${merke}: henvisningen skal være en sak kjøperen vant: ${h.setning}`);
        if (grupper.length === 0 && e.treff !== "regel") avvik.push(`${merke}: uten egen feilgruppe skal henvisningen være en regel-sak, fikk ${e.treff}`);
        if (e.treff !== "regel" && !grupper.some((g) => h.setning.includes(FRASE[g]!))) avvik.push(`${merke}: henvisningen handler ikke om en av de valgte feilene (${grupper.join(", ")}): ${h.setning}`);
```

- Under løkken fjernes `console.info` for `batteriBare`. Forventningene blir:

```ts
    expect(teller.lignende).toBeGreaterThan(300);
    expect(teller.regel).toBeGreaterThan(0);
```

  Linjene med `teller.tilnaermet` og `teller.generell` fjernes.
- I `FRASE` blir `girkasse: "girkassen"` stående. `"feil på girkassen"` inneholder `"girkassen"`. Sjekk at alle frasene i Task 3, Step 5 inneholder `FRASE`-verdien. Det gjør de.
- I «API-ruten gir samme resultat …» blir grenen `else if (!json.eksempel?.setning …` og `else if (json.eksempel.utfall …` til:

```ts
      } else if (!json.eksempel?.setning || !json.eksempel?.kildeUrl || !json.eksempel?.ref || !json.eksempel?.organ) {
        avvik.push(`${merke}: ruten ga ingen henvisning`);
      }
```

`e2e/registreringsflyt.spec.ts` linje 53:

```ts
    await expect(page.getByRole("link", { name: /^Forbruker(klage|tvist)utvalget, (FKU|FTU)-\d{4}-\d+/ })).toBeVisible();
```

Run: `npx vitest run src/lib/vurdering`
Expected: FAIL (typefeil eller `henvisning` er undefined).

- [ ] **Step 2: `vurder.ts` bruker `velgHenvisning`**

Endre importen `import { finnEksempel, type ValgtEksempel } from "./eksempler";` til `import { velgHenvisning, type ValgtHenvisning } from "./henvisninger";`.

I typen `Vurdering`:

```ts
  // The decision the letter cites, shown to the buyer before purchase. null only when the law stops the claim.
  eksempel: ValgtHenvisning | null;
```

`eksempel: finnEksempel(f),` blir til `eksempel: velgHenvisning(f),`.

Slett `src/lib/vurdering/eksempler.ts`:

```bash
git rm src/lib/vurdering/eksempler.ts
```

- [ ] **Step 3: `tilKlageInput` leser `bilAr`**

I `src/lib/vurdering/innsending.ts`, i `tilKlageInput` rett etter `const ja = …`:

```ts
  // The vehicle's first registration year, sent alongside the answers from the registry lookup.
  const bilAr = (raw as Record<string, unknown>).bilAr;
  const gyldigBilAr = Number.isInteger(bilAr) && (bilAr as number) >= 1900 && (bilAr as number) <= Number(idag.slice(0, 4));
```

I `bilOgKjop`, rett etter linjen med `kmVedKjop`:

```ts
        ...(gyldigBilAr && { bilAr: bilAr as number }),
```

- [ ] **Step 4: API-ruten**

I `src/app/api/vurder/route.ts` blir `eksempel: v.eksempel && { … }` til:

```ts
      eksempel: v.eksempel && {
        setning: v.eksempel.henvisning.setning,
        ref: v.eksempel.henvisning.ref,
        organ: v.eksempel.henvisning.organ,
        kildeUrl: v.eksempel.henvisning.kildeUrl,
        treff: v.eksempel.treff,
      },
```

Oppdater kommentaren over `POST` («and one similar decision when there is one» blir «and the decision the letter will cite»).

- [ ] **Step 5: Skjemaet**

I `src/app/vurdering/skjema.tsx`:
- Kommentaren og typen: `// How close the cited decision is to the buyer's case; see velgHenvisning.` og `type Treff = "lignende" | "tilnaermet" | "regel";`
- `Resultat.eksempel` blir `eksempel: { setning: string; ref: string; organ: string; kildeUrl: string; treff: Treff } | null;`
- `TREFF_TEKST`:

```ts
const TREFF_TEKST: Record<Treff, string> = {
  lignende: "Her er en lignende sak:",
  tilnaermet: "Her er den nærmeste lignende saken:",
  regel: "Her er en sak der utvalget la samme regel til grunn:",
};
```

- Lenken (rundt linje 498–502) blir til:

```tsx
                {resultat.eksempel && (
                  <>
                    <a href={resultat.eksempel.kildeUrl} target="_blank" rel="noreferrer" className="rounded bg-[#eef1f6] px-2 py-1 font-kode text-[12px] font-medium text-[#1f3a5f]">
                      {resultat.eksempel.organ}, {resultat.eksempel.ref}
                    </a>
                    <p className="m-0 text-[14px] font-medium text-[#1f3a5f]">Brevet ditt viser til denne saken.</p>
                  </>
                )}
```

- Salgskortet:
  - Slett `BREV_UTEN_LIGNENDE`.
  - I `Neste`: fjern propen `medEksempel` og bruk `const punkter = [BREV_MED_LIGNENDE, ...NESTE_PUNKTER];`.
  - Kommentaren «Similar cases are only promised when we have one to refer to.» blir «Every letter that can be bought cites a decision (velgHenvisning).».
  - Fjern `medEksempel={…}` der `Neste` brukes (rundt linje 533–536).
- I `hent` blir `body: JSON.stringify(data),` til:

```ts
        // Only the year, not the registration number: it picks a decision with a car of similar age.
        body: JSON.stringify(kjoretoy?.ar ? { ...data, bilAr: kjoretoy.ar } : data),
```

  Sjekk at `kjoretoy` er i scope i funksjonen som definerer `hent`. Den er state i samme komponent (rundt linje 567). Ligger `hent` i en `useCallback` eller en `useEffect` med avhengighetsliste, legg `kjoretoy` til i listen.

- [ ] **Step 6: Kjør testene**

Run: `npx vitest run src/lib/vurdering && npm run typecheck && npm run lint`
Expected: PASS. `grep -rn "finnEksempel\|eksempler\"" src scripts` gir ingen treff.

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/vurdering src/app/api/vurder/route.ts src/app/vurdering/skjema.tsx e2e/registreringsflyt.spec.ts scripts/vurder.ts
git commit -m "Vurderingen viser vedtaket brevet viser til"
```

---

### Task 5: Avsnittet i brevet, og kjøperens valg fjernes

**Files:**
- Modify: `src/lib/brev/brev.ts`
- Modify: `src/lib/brev/dokument.ts`
- Modify: `src/lib/brev/utfylling.ts`
- Modify: `src/lib/brev/sak.ts` (kommentar)
- Modify: `src/lib/mappe/hent.ts`
- Modify: `src/app/api/sak/[id]/route.ts`
- Modify: `src/app/brev/[id]/page.tsx`
- Modify: `src/app/brev/brevside.tsx`
- Modify: `src/app/brev/mappe/saksmappe.tsx`, `src/app/brev/mappe/kort.tsx` (bare det som trengs for å kompilere; resten av saksmappen tas i Task 7)
- Test: `src/lib/brev/brev-krav.test.ts`, `src/lib/brev/brev.test.ts`

**Interfaces:**
- Consumes: `velgHenvisning`, `type ValgtHenvisning` (Task 1), biblioteket (Task 3)
- Produces:
  - `henvisningFor(input: KlageInput, idag: string, u: Utfylling): ValgtHenvisning | null` (fra `brev.ts`)
  - `JURIDISK.henvisning(v: ValgtHenvisning): string`
  - `byggBrev(input, idag?, utfylt?)` med tre parametere

- [ ] **Step 1: Skriv de nye brevtestene (feiler)**

I `src/lib/brev/brev-krav.test.ts`:
- Importen blir `import { byggBrev, henvisningFor } from "./brev";`.
- Hjelperen blir `const tekst = (input: KlageInput, idag: string, u: Utfylling = {}) => byggBrev(input, idag, { retting: "avvist", ...u }).avsnitt.join("\n");`.
- Hele `describe("lignende vedtak", …)` erstattes med:

```ts
describe("henvisning til vedtak", () => {
  const KILDE = /\((FKU|FTU)-\d{4}-\d+(-\d+)?, \d{1,2}\. [a-zø]+ \d{4}, https:\/\/\S+\)\./;

  it("står rett etter avsnittet om mangel og bevisbyrde, før kravet, med ref, dato og lenke", () => {
    const i = klage();
    const v = henvisningFor(i, IDAG, {});
    expect(v).not.toBeNull();
    const b = byggBrev(i, IDAG, { retting: "avvist" });
    const iMangel = b.avsnitt.findIndex((a) => a.includes("mangel etter forbrukerkjøpsloven § 16"));
    const iHenvisning = b.avsnitt.findIndex((a) => a.includes(v!.henvisning.ref));
    const iKrav = b.avsnitt.findIndex((a) => a.includes("Jeg reklamerer herved"));
    expect(iHenvisning).toBe(iMangel + 1);
    expect(iHenvisning).toBeLessThan(iKrav);
    expect(b.avsnitt[iHenvisning]).toMatch(KILDE);
    expect(b.avsnitt[iHenvisning]).toMatch(/^Forbruker(klage|tvist)utvalget har (behandlet en lignende sak|lagt det samme til grunn i tidligere saker)\./);
    expect(b.avsnitt[iHenvisning]).toMatch(/Jeg ber dere ta hensyn til at utvalget har vurdert (en tilsvarende sak|tilsvarende saker) slik\.$/);
    expect(b.avsnitt.filter((a) => KILDE.test(a))).toHaveLength(1);
  });

  it("«Annet» gir en regel-sak", () => {
    expect(tekst(klage({ typer: ["annet"] }), IDAG)).toContain("har lagt det samme til grunn i tidligere saker");
  });

  it("en kjøpsdato før 2024 gir aldri en sak vunnet på formodningsregelen for feil etter 6–24 måneder", () => {
    const i = klage({ oppdaget: "6_mnd_til_2_ar" }, { kjopsdato: "2023-03-12" });
    const v = henvisningFor(i, IDAG, {});
    expect(v?.henvisning.presumsjon).toBe(false);
    expect(tekst(i, IDAG)).toContain(v!.henvisning.ref);
  });

  it("bilens årstall fra registeret brukes: en 25 år gammel bil får aldri en mye nyere lignende bil", () => {
    const v = henvisningFor(klage(), IDAG, { kjoretoy: { regnr: "ZZ 99999", merke: "Testmerke", modell: "Modell X", ar: 2001 } });
    expect(v).not.toBeNull();
    if (v!.henvisning.type === "lignende") expect(v!.henvisning.alder).toBeGreaterThanOrEqual(21);
  });

  it("når loven stopper kravet, viser brevet ikke til noe vedtak", () => {
    expect(tekst(klage({}, { kjopsform: "privatperson" }), IDAG)).not.toMatch(KILDE);
  });
});
```

I `src/lib/brev/brev.test.ts`, testen «utelater avsnittet når ingenting legges ved»:

```ts
      // Five paragraphs plus the paragraph on wear and the decision the letter cites.
      expect(b.avsnitt).toHaveLength(7);
```

Run: `npx vitest run src/lib/brev`
Expected: FAIL («henvisningFor is not exported» eller tilsvarende).

- [ ] **Step 2: `brev.ts`**

- Legg til importen `import { velgHenvisning, type ValgtHenvisning } from "@/lib/vurdering/henvisninger";`.
- I `JURIDISK` blir linjen `lignende: …` til:

```ts
  // Law first, then the decision: case reference, date, one sentence on the likeness and one on the
  // outcome, and a link. No amounts, no names.
  henvisning: ({ henvisning: h }: ValgtHenvisning) => {
    const kilde = `(${h.ref}, ${norskDato(h.dato)}, ${h.kildeUrl}).`;
    return h.type === "regel"
      ? `${h.organ} har lagt det samme til grunn i tidligere saker. ${utenPunktum(h.regel)} ${kilde} Jeg ber dere ta hensyn til at utvalget har vurdert tilsvarende saker slik.`
      : `${h.organ} har behandlet en lignende sak. ${medPunktum(h.likhet)} ${utenPunktum(h.konklusjon)} ${kilde} Jeg ber dere ta hensyn til at utvalget har vurdert en tilsvarende sak slik.`;
  },
```

- Rett under `const medPunktum = …` legger du til `const utenPunktum = (t: string) => t.replace(/[.!?]+$/, "");`.
- Slett `LignendeRef`, `UTFALL_TEKST` og `lignendeAvsnitt` med kommentarene deres.
- Legg til over `byggBrev`:

```ts
// The answers do not hold the vehicle; its first registration comes from the registry lookup.
const medBilAr = (input: KlageInput, u: Utfylling): KlageInput =>
  u.kjoretoy?.ar ? { ...input, bilOgKjop: { ...input.bilOgKjop, bilAr: u.kjoretoy.ar } } : input;

// The decision the letter cites: the same choice as the assessment's, from the same facts.
export function henvisningFor(input: KlageInput, idag: string, u: Utfylling): ValgtHenvisning | null {
  return velgHenvisning(beregnFaktorer(medBilAr(input, u), idag));
}
```

- I `byggBrev`: fjern parameteren `lignende: LignendeRef[] = []`. Etter `const f = beregnFaktorer(input, idag);` legger du til `const henvisning = henvisningFor(input, idag, utfylt);`. I `avsnitt` blir `...lignendeAvsnitt(lignende),` fjernet, og rett etter `mangelOgBevisbyrde(input, idag, u),` kommer:

```ts
      ...(henvisning ? [JURIDISK.henvisning(henvisning)] : []),
```

- [ ] **Step 3: Fjern kjøperens valg i datamodellen**

`src/lib/brev/utfylling.ts`:
- Slett `lignende?: Lignende[];` i `Utfylling`.
- Slett kommentaren og linjene `export const MAKS_LIGNENDE = 3;` og `export type Lignende = …`.
- Slett funksjonen `lesLignende`.
- Slett `lignende: lesLignende,` i `LESERE`.

`src/lib/mappe/hent.ts`:
- Slett importene av `LignendeRef` og `Lignende`.
- Slett funksjonen `hentLignende` med kommentaren.

`src/lib/brev/dokument.ts`: Slett `lignendeFor` og importene av `hentLignende` og `LignendeRef`. `brevForSak` blir:

```ts
export async function brevForSak(sak: Sak, idag = iDag()): Promise<Brev | null> {
  const lest = tilKlageInput(sak.svar, idag);
  if (!lest.ok) return null;
  return byggBrev(lest.input, idag, sak.utfylling);
}
```

  Behold `async` og signaturen, siden kallerne bruker `await`.

`src/app/api/sak/[id]/route.ts`:
- Slett importen av `lignendeFor`.
- Svaret blir `return Response.json({ svar: avledet, utfylling: endeligUtfylling });`.

`src/app/brev/[id]/page.tsx`: Slett importen av `lignendeFor` og propen `startLignende={await lignendeFor(sak)}`.

`src/app/brev/brevside.tsx`:
- Importen blir `import { byggBrev, harPlassholder, henvisningFor } from "@/lib/brev/brev";`.
- Slett propen `startLignende` med typen og kommentaren.
- Slett `const [lignende, setLignende] = useState(startLignende);` og `setLignende(json.lignende ?? []);`.
- Fjern `lignende?: LignendeRef[];` fra JSON-typen i `lagre`.
- `byggBrev(parsed0.input, idag, startUtfylling, startLignende)` blir `byggBrev(parsed0.input, idag, startUtfylling)`, og `byggBrev(input, idag, utfylling, lignende)` blir `byggBrev(input, idag, utfylling)`.
- Kommentaren over `avhengighet` blir: «The numbers in the saksmappe follow the answers, the claim and the dealer; ticks do not change them, so they are left out and do not make it fetch again.»
- Legg til rett etter `const brev = byggBrev(…)`:

```ts
  const henvisning = input ? henvisningFor(input, idag, utfylling) : null;
```

- Send den til saksmappen: `<Saksmappe sakId={id} avhengighet={avhengighet} henvisning={henvisning} lagre={lagre} />` (propen `utfylling` erstattes; se neste punkt).

`src/app/brev/mappe/saksmappe.tsx`:
- Propen `utfylling: Utfylling` blir `henvisning: ValgtHenvisning | null` (importer typen fra `@/lib/vurdering/henvisninger`).
- `<AvgjordeInnhold k={m.avgjorde} valgt={utfylling.lignende ?? []} lagre={lagre} />` blir `<AvgjordeInnhold k={m.avgjorde} henvisning={henvisning} />`.
- Sjekk om `utfylling` brukes andre steder i filen (sjekklisten bruker kanskje `utfylling.sjekket`). Gjør den det, behold propen `utfylling` og legg `henvisning` til ved siden av.

`src/app/brev/mappe/kort.tsx`: Gjør bare det som trengs for å kompilere. Det endelige innholdet kommer i Task 7.
- Signaturen blir `export function AvgjordeInnhold({ k, henvisning }: { k: AvgjordeKort; henvisning: ValgtHenvisning | null })`.
- Slett `feil`, `sett`, `valgtMoment`, knappene «Siter i brevet»/«Fjern fra brevet» og feilmeldingen.
- Fjern `Lignende` (og `Endring`, hvis den ikke lenger brukes) fra importen.
- Fjern linjen «Et vedtak kan også ha punkter som gikk mot klageren. Siter bare punkter som støtter kravet ditt.». Behold `k.eksempler.length === 0`-meldingen alene.

`src/lib/brev/sak.ts`: I kommentaren over `endreSak` blir «(a tick in the checklist and a chosen decision, say)» til «(two ticks in the checklist, say)».

- [ ] **Step 4: Kjør testene**

Run: `npx vitest run src/lib/brev && npm test && npm run typecheck && npm run lint`
Expected: PASS. `grep -rn "lignendeFor\|hentLignende\|LignendeRef\|MAKS_LIGNENDE\|startLignende" src` gir ingen treff.

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/brev src/lib/mappe/hent.ts src/app/api/sak src/app/brev
git commit -m "Brevet viser til vedtaket fra biblioteket; kjøperen velger ikke lenger"
```

---

### Task 6: Klikkbar lenke på siden, i Word og i PDF

**Files:**
- Modify: `src/app/brev/brevark.tsx`
- Modify: `src/lib/brev/eksport.ts`

**Interfaces:**
- Consumes: `Brev.avsnitt` med en lenke `https://…` (Task 5)
- Produces: uendret API (`tilDocx`, `tilPdf`, `Brevark`)

Eksporten har ingen Vitest-tester (CLAUDE.md), så den verifiseres manuelt i Step 4.

- [ ] **Step 1: Siden**

I `src/app/brev/brevark.tsx`, over `function Tekst`:

```tsx
// A link in the letter (the decision it cites) is clickable on the page too.
const LENKE = /(https:\/\/[^\s)]+)/;
function MedLenker({ tekst }: { tekst: string }): ReactNode {
  return tekst.split(LENKE).map((del, n) =>
    n % 2 === 0 ? (
      del
    ) : (
      <a key={n} href={del} target="_blank" rel="noreferrer" className="break-all text-[#1f3a5f] underline underline-offset-2">
        {del}
      </a>
    ),
  );
}
```

I `Tekst` blir `if (n % 2 === 0) return del;` til `if (n % 2 === 0) return <MedLenker key={n} tekst={del} />;`.

- [ ] **Step 2: Word**

I `src/lib/brev/eksport.ts`:
- Importen blir `import { Document, ExternalHyperlink, Packer, Paragraph, TextRun } from "docx";`.
- Legg til over `tilDocx`:

```ts
const LENKE = /(https:\/\/[^\s)]+)/;

// One line of a block as runs: plain text, and the link to the cited decision as a real hyperlink.
function kjoringer(linje: string, fet: boolean | undefined, nyLinje: boolean) {
  return linje.split(LENKE).map((del, n) => {
    const brudd = nyLinje && n === 0 ? 1 : 0;
    return n % 2 === 0
      ? new TextRun({ text: del, bold: fet, break: brudd })
      : new ExternalHyperlink({ link: del, children: [new TextRun({ text: del, color: "1F3A5F", underline: {}, break: brudd })] });
  });
}
```

- I `tilDocx` blir `children: bl.linjer.map((l, n) => new TextRun({ … }))` til `children: bl.linjer.flatMap((l, n) => kjoringer(l, bl.fet, n > 0))`.

- [ ] **Step 3: PDF**

I `src/lib/brev/eksport.ts`:
- Importen blir `import { PDFArray, PDFDocument, PDFName, PDFString, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";`.
- I `brytLinjer`, i løkken som kutter for lange ord, blir `legg(rest.slice(0, n));` til et kutt etter det siste av `/ ? & =` som får plass, når det finnes:

```ts
      // A link breaks after a / ? & or =, so each piece still reads as part of the address.
      const naturlig = Math.max(...["/", "?", "&", "="].map((t) => rest.lastIndexOf(t, n - 1)));
      if (naturlig > 0) n = naturlig + 1;
      legg(rest.slice(0, n));
```

- Legg til over `tilPdf`:

```ts
// A clickable area over a piece of a link in the PDF.
function lenke(pdf: PDFDocument, side: PDFPage, x: number, y: number, bredde: number, hoyde: number, url: string) {
  const ref = pdf.context.register(
    pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, y - 2, x + bredde, y + hoyde], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) } }),
  );
  const annots = side.node.lookup(PDFName.of("Annots"));
  if (annots instanceof PDFArray) annots.push(ref);
  else side.node.set(PDFName.of("Annots"), pdf.context.obj([ref]));
}
```

- I `tilPdf` skal `skriv` ta med URL-ene til avsnittet og legge en lenke over hver bit av dem. Endre løkken og `skriv`:

```ts
  const skriv = (linje: string, font: PDFFont, urler: string[]) => {
    if (y < MARG) {
      side = pdf.addPage([BREDDE_SIDE, HOYDE_SIDE]);
      y = HOYDE_SIDE - MARG;
    }
    side.drawText(linje, { x: MARG, y, size: STR, font, color: rgb(0.09, 0.15, 0.24) });
    // Every word on the line that is a piece of a link in the paragraph gets a link to the whole address.
    let x = MARG;
    for (const ord of linje.split(" ")) {
      const bit = ord.replace(/^\(/, "").replace(/\)?[.,]?$/, "");
      const url = bit.length > 8 ? urler.find((u) => u.includes(bit)) : undefined;
      if (url) lenke(pdf, side, x + font.widthOfTextAtSize(ord.startsWith("(") ? "(" : "", STR), y, font.widthOfTextAtSize(bit, STR), STR, url);
      x += font.widthOfTextAtSize(`${ord} `, STR);
    }
    y -= HOYDE;
  };
  for (const bl of blokker(b)) {
    const font = bl.fet ? fet : normal;
    for (const l of bl.linjer) {
      const urler = l.match(/https:\/\/[^\s)]+/g) ?? [];
      for (const del of brytLinjer(l, font, STR, bredde)) skriv(del, font, urler);
    }
    y -= HOYDE * 0.6;
  }
```

- [ ] **Step 4: Verifiser filene manuelt**

Run (skriver til scratchpad, ikke til repoet):

```bash
npx tsx -e '
import { writeFileSync } from "node:fs";
import { byggBrev } from "./src/lib/brev/brev";
import { tilDocx, tilPdf } from "./src/lib/brev/eksport";
const b = byggBrev({ bilOgKjop: { kjopsdato: "2023-03-12", kjopesumNok: 150000 }, feilen: { typer: ["motor"], oppdaget: "innen_6_mnd", opplystForKjop: "nei", feilOpplysning: "nei", kontakt: "nei" }, bevis: { verkstedrapport: false, rapportSierForKjop: null, bilder: false } }, "2026-10-04");
console.log(b.avsnitt[2]);
const ut = process.env.TMPDIR ?? "/tmp";
tilPdf(b).then((p) => writeFileSync(`${ut}/brev.pdf`, p));
tilDocx(b).then((d) => writeFileSync(`${ut}/brev.docx`, d));
'
```

Expected:
- Avsnittet med henvisningen skrives ut.
- Åpne `brev.pdf` (`open $TMPDIR/brev.pdf`). Lenken er brutt etter `/ ? & =`, ikke midt i et ord, og et klikk åpner vedtaket.
- Åpne `brev.docx`. Lenken er klikkbar.
- Sjekk også brevfanen på siden (`npm run dev`): lenken er klikkbar og brytes uten horisontal scroll på mobilbredde.

- [ ] **Step 5: Kjør testene**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/brev/brevark.tsx src/lib/brev/eksport.ts
git commit -m "Klikkbar lenke til vedtaket på siden, i Word og i PDF"
```

---

### Task 7: Saksmappen viser vedtaket brevet bruker

**Files:**
- Modify: `src/app/brev/mappe/kort.tsx` (`AvgjordeInnhold`)

**Interfaces:**
- Consumes: `henvisning: ValgtHenvisning | null` som prop (Task 5), `norskDato` (`brev.ts`)

Ingen ny test: saksmappen er utenfor Vitest-omfanget (CLAUDE.md). Den verifiseres i nettleseren.

- [ ] **Step 1: Blokken «Brevet ditt viser til»**

I `src/app/brev/mappe/kort.tsx`: importer `type Treff, type ValgtHenvisning` fra `@/lib/vurdering/henvisninger`. `norskDato` er allerede importert. Over `AvgjordeInnhold`:

```tsx
const HVORFOR: Record<Treff, string> = {
  lignende: "Valgt fordi saken gjaldt samme type feil, feilen viste seg omtrent like lenge etter kjøpet, bilen var omtrent like gammel, og kjøperen vant mot forhandleren.",
  tilnaermet: "Valgt fordi saken gjaldt samme type feil, bilen var omtrent like gammel, og kjøperen vant mot forhandleren. Feilen viste seg på et annet tidspunkt enn i din sak.",
  regel: "Valgt fordi utvalget brukte den samme regelen som brevet ditt bygger på, og kjøperen vant mot forhandleren.",
};

// The decision the letter cites, as it stands in the letter. Chosen for the buyer, not by them.
function Henvisningsblokk({ v }: { v: ValgtHenvisning }) {
  const h = v.henvisning;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#c9d3e3] bg-[#f4f7fb] p-3.5">
      <strong className="text-[13px] uppercase tracking-[.04em] text-[#5b6472]">Brevet ditt viser til</strong>
      <strong>
        {h.organ}, {h.ref} · {norskDato(h.dato)}
      </strong>
      <p className="m-0">{h.type === "regel" ? h.regel : `${h.likhet} ${h.konklusjon}`}</p>
      <p className={SMA}>{HVORFOR[v.treff]}</p>
      <a href={h.kildeUrl} target="_blank" rel="noreferrer" className="self-start text-[14px] font-semibold text-[#1f3a5f] underline underline-offset-2">
        Les vedtaket
      </a>
    </div>
  );
}
```

Øverst i det `AvgjordeInnhold` returnerer, før temaene:

```tsx
      {henvisning && <Henvisningsblokk v={henvisning} />}
```

- [ ] **Step 2: Sjekk i nettleseren**

Run: `npm run dev`. Åpne en sak via vurderingen (motor, innen 6 måneder) og fanen «Saksmappe».
Expected:
- Kortet «Hva avgjorde lignende saker?» begynner med «Brevet ditt viser til» med samme ref som brevet.
- Eksempellisten med 3 vunne og 2 tapte vedtak står under, uten knappene «Siter i brevet» og «Fjern fra brevet».

- [ ] **Step 3: Kjør testene**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/brev/mappe/kort.tsx
git commit -m "Saksmappen viser vedtaket brevet viser til"
```

---

### Task 8: Dokumentasjon og full verifisering

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: `CLAUDE.md`**

- I `## Tabellen brevsak`, punktet **Nivåer**: «eksempelvedtaket i vurderingen er alltid ett kjøperen vant (`finnEksempel`)» blir «vedtaket i vurderingen er det brevet viser til, og alltid ett kjøperen vant (`velgHenvisning`)».
- I `## Saksmappe`: Erstatt punktet **Sitert i brevet** med: «**Vedtaket brevet viser til** står øverst i «Hva avgjorde lignende saker?». Det velges av `velgHenvisning`, ikke av kjøperen (se «Henvisning i brevet»).» Fjern `utfylling.lignende` fra punktet «Andre felt i `utfylling`».
- Nytt avsnitt før `## Tester`:

```markdown
## Henvisning i brevet

Brevet og vurderingen viser til samme vedtak, valgt av `velgHenvisning` i `src/lib/vurdering/henvisninger.ts` fra et kuratert bibliotek (`HENVISNINGER`), aldri fra databasen ved kjøring.

- **Stige:** lignende sak (samme feilgruppe, tidsrom og aldersgruppe) → samme feilgruppe i nabotidsrommet → en sak der utvalget la samme regel til grunn som brevet bygger på (formodning, rapport, opplysning eller forventning). Det siste trinnet finnes alltid, så alle saker som loven ikke stopper, får en henvisning.
- **Aldri vunnet på en fordel kjøperen mangler:** ingen sak vunnet på formodningsregelen for en kjøper uten den, ingen sak etter ny lov for kjøp før 1.1.2024, og ingen lignende bil mer enn 4 år nyere enn kjøperens (bilens årstall kommer fra Vegvesen-oppslaget).
- **Form i brevet** (`JURIDISK.henvisning`): rett etter avsnittet om mangel og bevisbyrde; organ, ref i utvalgets egen form (FKU-2023-13923), dato og lenke; ingen beløp og ingen navn.
- **Biblioteket** fylles og kontrolleres etter `docs/henvisninger.md` (agenter, belegg i `scripts/henvisninger-belegg.json`). `npm run sjekk-henvisninger` må gi 0 feil etter hver endring. Endres biblioteket, kan henvisningen i åpne saker skifte; det lagres ikke i `brevsak`.
```

- [ ] **Step 2: `README.md`**

Under vedlikehold, etter rekkefølgen `hent` → `klassifiser` → `tolk` → `rapport`, legg til:

```markdown
Etter nye vedtak: `npm run henvisning-kandidater` og kurateringen i `docs/henvisninger.md` for listene som har fått nye kandidater (vedtak om kjøp fra 2024 foretrekkes), deretter `npm run sjekk-henvisninger`.
```

- [ ] **Step 3: Full verifisering**

Run:

```bash
npm test && npm run typecheck && npm run lint && npm run sjekk-henvisninger && npm run test:e2e
```

Expected: alt grønt, «0 feil».

I nettleseren (Playwright MCP eller manuelt, `npm run dev`):
1. **Motor, innen 6 måneder, kjøp 2025, bil fra 2016:** Vurderingen viser «Her er en lignende sak:», lenken «Forbrukerklageutvalget, FKU-…» og «Brevet ditt viser til denne saken.». Åpne brevet. Avsnittet rett etter § 18 har samme ref, og saksmappen viser samme vedtak uten valgknapper. Last ned PDF og Word, og klikk lenken i begge.
2. **Bremser, 6–24 måneder, kjøp 2023, med verkstedrapport:** Henvisningen er aldri et «rask»-vedtak. Den er enten en lignende sak med `presumsjon: false`, eller regel-saken for rapport.
3. **Bare «Annet»:** Vurderingen viser «Her er en sak der utvalget la samme regel til grunn:», og brevet har den samme.
4. **På brevsiden, rett kjøpsdatoen** fra 2025 til 2023 med feil etter 6–24 måneder. Henvisningen i brevet skifter, men blir ikke borte.
5. **Gammel sak med `lignende` i JSON:** Åpne en eksisterende sak fra før endringen, hvis det finnes en i utviklingsbasen. Siden laster, og lagring av et steg gir ingen feil.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "Dokumenter henvisningen i brevet"
```
