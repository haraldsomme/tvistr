@AGENTS.md

## Hva Tvistr er

Tvistr skal la en bruker fylle ut et kort skjema om et bruktbilkjøp som gikk galt, og få en vurdering av hvor god klagesak de har før de bestemmer seg for å kjøpe et profesjonelt klagebrev. Vurderingen skal bygge på de cirka 3 600 vedtakene i tabellen `vedtak` (Forbrukerklageutvalget, bruktkjøretøy). Vurderingen trenger bare et utvalg av feltene, men alle feltene i `vedtak` skal beholdes: de er grunnlag for det endelige klagebrevet.

**Hovedproduktet er klagebrevet, og dette er grunnleggende for alt som bygges:** Brevet skal alltid inneholde et lignende vedtak som har fått medhold, og argumentere som en jurist for hvorfor brukerens sak står like sterkt eller sterkere. Vurderingen er veien dit; brevet er det vi selger.

## Tabellen `vedtak`

Inneholder ett rad per vedtak fra Forbrukertvistutvalget/Forbrukerklageutvalget (2013 →) om **kjøp av brukt kjøretøy** (personbil, varebil, bobil, campingvogn, MC/moped; ikke båt og nybil). Cirka 3 600 rader, tolket av `claude-sonnet-5-5` (`prompt_versjon`, `ai_modell` står på hver rad). Skjema: `src/db/schema.ts`. Tilgang: `import { db } from "@/db"` (Drizzle mot Neon, `DATABASE_URL` i `.env.local`). Koblet til `kildedokument` via `kildedokument_id` (kilde-URL, år, arkiv).

**Felt i grove trekk:** selger (`selger_type`, `selger_navn`, `selger_navn_norm`, `selger_orgnr`, `verksted_navn`), kjøretøy (`kjoretoytype`, `merke` normalisert, `modell`, `arsmodell`, `drivstoff`, `km_ved_kjop`, `kjopesum_nok`, `alder_ved_kjop`), tidslinje (`kjopsdato`, `forste_reklamasjon_dato`, `dager_til_reklamasjon`), avtale (`forbehold[]`), feil (`feiltyper[]`, `utbedringskostnad_nok`), bevis (`bevistyper[]`), krav (`kravtyper[]`, `prinsipalt_krav`, `krevd_*_nok`), sakens art (`mangelsgrunnlag[]`, `tvistetema[]`), utfall (`utfall`, `tilkjent_*_nok`, `enstemmig`, `dissens`), jus (`lov`, `paragrafer[]` som `fkjl § 16` / `kjl § 17` / `forsinkelsesrentelov § 2`), innhold (`sammendrag`, `utvalgets_nokkelmomenter[]`, `fulltekst_renset`), sporbarhet (`sitater` JSON, `konfidens`, `trenger_kontroll`, `kontroll_arsaker[]`, `qa_status`).

**Bruk**
- Statistikk og «lignende saker»: filtrer på `kjoretoytype`, `feiltyper`, `selger_type`, `forbehold`, `bevistyper`, `krevd_totalt_nok`. Medhold = `utfall in ('medhold','delvis_medhold')`. `docs/datagrunnlag.md` er en øyeblikksrapport over dataene (skriptet som laget den er fjernet).
- Forhandleroppslag: `selger_orgnr` hvis satt, ellers `selger_navn_norm` (org.nr. står sjelden i vedtakene).
- Hvilke lover/paragrafer som brukes i lignende saker: tell `paragrafer` og `lov` for samme feiltype.
- Vis sitater fra `sitater` og lenke til `kilde_url` når tall eller utfall presenteres for en bruker.

**Begrensninger man må ta hensyn til**
- Bare saker som endte med vedtak er med (ingen forlik/trukne saker): «vinnersjanse» er sjanse *gitt vedtak*.
- `feiltyper` er feil klageren *påberopte*, ikke det utvalget godtok; vinnersjanse per feiltype er skjev oppover. `lovversjon` er nesten alltid `ukjent`.
- `trenger_kontroll = true` (cirka 10 %) betyr at et felt bør dobbeltsjekkes; se `kontroll_arsaker`. Få rader er manuelt kontrollert (`qa_status`); automatisk revisjon står i `docs/datagrunnlag.md`.
- Tekstfeltene er renset: klager = `[KLAGER]`, alle andre personer = `[PERSON]`, plassholdere for adresse/regnr/telefon. **Ikke lagre eller vis rå PDF-tekst, navn, adresser eller regnummer**; rå PDF-er ligger bare i `data/raw/` (git-ignorert).

**Pass 2-tabellene** (`vedtak_analyse`, `vedtak_feil`, viewet `vedtak_feil_sok`) og `brevsak` står i databasen, men koden som brukte dem er fjernet (siste versjon: grenen `pass2`, commit `9cc4dc9`). Pass 2 dekker 994 vedtak og kan brukes som fasit.

## Løsningen nå (startet på nytt 2026-10-10)

Bygges opp gradvis. Det som finnes:
- **`/sak`** (`src/app/sak/`): steg 1 er bilen fra regnr (Statens vegvesen), steg 2 er feilvalg, steg 3 detaljer og tidspunkt per feil, steg 4 krav. «Lag brev» rangerer vedtakene med medhold (`finnVedtak` i `actions.ts`) og går til steg 5, som viser antallet og de fem beste med nøkkelinfo, slik at matchingen kan sjekkes. Utseende og overganger følger mockupen `ReklamasjonSkjema.dc.html`. Det gamle skjemaet er beskrevet i `docs/gammelt-skjema.md`.
- **Feilkategoriene** (`src/lib/feil/kategorier.ts`): 13 hovedkategorier med underkategorier. Brukeren kan velge flere av begge. Hovedkategoriene er gruppert etter selgers typiske forsvar (teknisk feil med slitasjeforsvar, eller feil opplysning). «Vet ikke ennå» kan ikke sammenlignes.
- **Feilvurderingen** (`src/lib/feilvurdering/`, kolonner på `vedtak`, migrasjon 0011): Claude Code-agenter leser fulltekst og vurderer hver påberopt feil. De gir kategori og underkategori, utfall (`medhold`/`avvist`/`ikke_vurdert`), avslagsgrunn eller bevisgrunnlag, når feilen viste seg, og ett ordrett sitat. De gir også sanksjoner og antall rettingsforsøk. Per feil gir agentene også når den viste seg (`viste_seg` i perioder) og om utvalget brukte formodningsregelen (`formodning`). Per vedtak gir de `som_den_er` (forbeholdet sto i kontrakten eller annonsen). Importen kontrollerer sitatene mot fulltekst og avleder resten:
  - `godtatte_kategorier`, `godtatte_underkategorier` (`hoved.under`)
  - `tidsniva` per feil: 1 innenfor presumsjonsperioden, 2 utenfor men innenfor reklamasjonsfristen, 3 fra 22 måneder. Nivået regnes etter lovversjonen i hver sak.
  - `godtatte_niva` (`hoved:n`, `hoved.under:n`), slik at kategori og nivå gjelder samme feil
  - `prisavslag_prosent`, `dager_til_feil` og `lovversjon_avledet`

  Agentene henter ut fakta, og koden trekker konklusjonene. Endres instruks eller svarformat, økes `FEILVURDERING_VERSJON`.
- **Filtrene dette gir:** kategori og eventuelt underkategori, bare feil med medhold, tidsnivå, bilprofil (`alder_ved_kjop`, `km_ved_kjop`, `kjopesum_nok` fra tolk, i intervaller), «som den er» og sanksjon (`sanksjoner`, med prisavslag i prosent). Sanksjonen gjelder hele vedtaket, ikke den enkelte feilen.
- **Rangeringen** (`src/lib/matching/ranger.ts`, vekter og terskler i `vekter.ts`) er deterministisk og uten LLM. Testet og justert mot agentvurderinger av topp 5 for over 600 skjemakombinasjoner (2026-10-11).
  - Et vedtak er med bare hvis det har en feil med medhold i en av brukerens hovedkategorier, på brukerens tidsnivå eller strengere for kjøper (høyere nivå). Samme underkategori slipper gjennom ett nivå mildere. Gir det under tre vedtak, slippes tidsfilteret. Seire på garanti (fkjl § 18 a) tas bare med for kategorien garanti, og vedtak der utvalget ikke ga noe er utelatt.
  - Rekkefølge: brukerens underkategori, tidsfilteret, at utvalget vurderte feilen selv (ikke `samlet`, ikke erkjent/uomtvistet), poeng. Treff under 40 % av maks vises ikke; heller færre vedtak enn svake.
  - Poeng på den samme feilen (underkategori, tidsnivå, egen vurdering, grunnlag) og på vedtaket (km og alder i intervaller, «som den er», krav i `sanksjoner`). Tidsnivå, km, alder og «som den er» teller med retning: et vedtak som var strengere for kjøper gir delpoeng, mildere gir 0. Grunnlag sammenligner `bevisgrunnlag` med det brukeren har (selger sa noe, verksted har undersøkt); formodningsregelen passer bare brukere innenfor presumsjonsperioden, tilbakeholdt opplysning (§ 16 b) krever ingen opplysning. Krav gir halv uttelling når vedtaket hadde flere feil med medhold. Ukjent gir 0, aldri minus; det brukeren ikke har oppgitt, trekkes fra maks.

**Vedlikehold:** `README.md` beskriver kjøringsrekkefølge (`hent` → `klassifiser` → `tolk`) og sikkerhetskopi (`npm run db:backup`). Ta kopi før `tolk --på-nytt`. Endres prompt eller skjema i `src/lib/ai/`, øk versjonen i `src/lib/ai/prompter.ts`.
