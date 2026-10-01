@AGENTS.md

## Hva Tvistr er

Tvistr skal la en bruker fylle ut et tre-stegs skjema om et bruktbilkjøp som gikk galt, og få en vurdering av hvor god klagesak de har før de bestemmer seg for å kjøpe et profesjonelt klagebrev. Vurderingen skal bygge på de cirka 3 600 vedtakene i tabellen `vedtak` (Forbrukerklageutvalget, bruktkjøretøy). Vurderingen trenger bare et utvalg av feltene, men alle feltene i `vedtak` skal beholdes: de er grunnlag for det endelige klagebrevet.

## Tabellen `vedtak`

Inneholder ett rad per vedtak fra Forbrukertvistutvalget/Forbrukerklageutvalget (2013 →) om **kjøp av brukt kjøretøy** (personbil, varebil, bobil, campingvogn, MC/moped; ikke båt og nybil). Cirka 3 600 rader, tolket av `claude-sonnet-5-5` (`prompt_versjon`, `ai_modell` står på hver rad). Skjema: `src/db/schema.ts`. Tilgang: `import { db } from "@/db"` (Drizzle mot Neon, `DATABASE_URL` i `.env.local`). Koblet til `kildedokument` via `kildedokument_id` (kilde-URL, år, arkiv).

**Felt i grove trekk:** selger (`selger_type`, `selger_navn`, `selger_navn_norm`, `selger_orgnr`, `verksted_navn`), kjøretøy (`kjoretoytype`, `merke` normalisert, `modell`, `arsmodell`, `drivstoff`, `km_ved_kjop`, `kjopesum_nok`, `alder_ved_kjop`), tidslinje (`kjopsdato`, `forste_reklamasjon_dato`, `dager_til_reklamasjon`), avtale (`forbehold[]`), feil (`feiltyper[]`, `utbedringskostnad_nok`), bevis (`bevistyper[]`), krav (`kravtyper[]`, `prinsipalt_krav`, `krevd_*_nok`), sakens art (`mangelsgrunnlag[]`, `tvistetema[]`), utfall (`utfall`, `tilkjent_*_nok`, `enstemmig`, `dissens`), jus (`lov`, `paragrafer[]` som `fkjl § 16` / `kjl § 17` / `forsinkelsesrentelov § 2`), innhold (`sammendrag`, `utvalgets_nokkelmomenter[]`, `fulltekst_renset`), sporbarhet (`sitater` JSON, `konfidens`, `trenger_kontroll`, `kontroll_arsaker[]`, `qa_status`).

**Bruk**
- Statistikk og «lignende saker»: filtrer på `kjoretoytype`, `feiltyper`, `selger_type`, `forbehold`, `bevistyper`, `krevd_totalt_nok`. Medhold = `utfall in ('medhold','delvis_medhold')`. Se `src/lib/data/statistikk.ts` (inkl. Wilson-intervall for små grupper); `npm run rapport` skriver `docs/datagrunnlag.md`.
- Forhandleroppslag: `selger_orgnr` hvis satt, ellers `selger_navn_norm` (org.nr. står sjelden i vedtakene).
- Hvilke lover/paragrafer som brukes i lignende saker: tell `paragrafer` og `lov` for samme feiltype.
- Vis sitater fra `sitater` og lenke til `kilde_url` når tall eller utfall presenteres for en bruker.

**Begrensninger man må ta hensyn til**
- Bare saker som endte med vedtak er med (ingen forlik/trukne saker): «vinnersjanse» er sjanse *gitt vedtak*.
- `feiltyper` er feil klageren *påberopte*, ikke det utvalget godtok; vinnersjanse per feiltype er skjev oppover. `lovversjon` er nesten alltid `ukjent`.
- `trenger_kontroll = true` (cirka 10 %) betyr at et felt bør dobbeltsjekkes; se `kontroll_arsaker`. Få rader er manuelt kontrollert (`qa_status`); automatisk revisjon står i `docs/datagrunnlag.md`.
- Tekstfeltene er renset: klager = `[KLAGER]`, alle andre personer = `[PERSON]`, plassholdere for adresse/regnr/telefon. **Ikke lagre eller vis rå PDF-tekst, navn, adresser eller regnummer**; rå PDF-er ligger bare i `data/raw/` (git-ignorert).

**Vedlikehold:** `README.md` beskriver kjøringsrekkefølge (`hent` → `klassifiser` → `tolk` → `rapport`) og sikkerhetskopi (`npm run db:backup`). Ta kopi før `tolk --på-nytt`. Endres prompt eller skjema i `src/lib/ai/`, øk versjonen i `src/lib/ai/prompter.ts`.
