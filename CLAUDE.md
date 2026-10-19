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

## Løsningen nå (ny app fra 2026-10-16)

Det som finnes:
- **Appen** (`docs/app.md`, design i `docs/superpowers/specs/2026-10-16-ny-app-design.md`): en React-port av artefakten «Bilreklamasjon» som eieren bygde. Utseende, tekster og flyt følger artefakten, med navnet Tvistr, bare bruktbil og frister og paragrafer etter lovversjonen. Sjekk og vurdering ligger bare i `localStorage`. En betalt sak lagres i tabellene `sak` (sjekk, skjema, `betalt`) og `ordre` (betalingsforsøk med Vipps). Id-en er 12 tegn (`src/lib/sak/id.ts`), og lenken er tilgangen. Tabellene holdes utenfor backup.
  - `/` forsiden. `/sak` er gratis sjekk og vurdering (`src/app/sak/`). `/sak/[id]` er brevet for en betalt sak med fanene Skjema, Vurdering, Vedtak og Brevet (`src/app/sak/[id]/`). Skjemaet lagres fortløpende (`lagreSak`), og bil og feil er låst på serveren.
  - Ren logikk i `src/lib/app/`: `vurdering.ts` (`evaluate`: sterk/mulig/svak/utenfor), `brev.ts` (`byggBrev`, hele brevet bygges i nettleseren), `lov.ts` (formodning 6 måneder før 2024 og 2 år etter, paragrafer fra `src/lib/brev/paragrafer.ts`), `saken.ts` (svarene → `byggSaken`, og `fraSjekk`) og `skjema.ts`.
  - To serverhandlinger mot databasen: `vurderSaken` (`src/app/sak/vurdering.ts`) gir tall og tre vedtakskort uten sitater og lenker, uten modellkall. `finnVedtak` (`src/app/sak/[id]/actions.ts`) gir opptil ti vedtak med avsnitt fra `mal.ts` og likhetsprosent: modellens valg («Anbefalt») og resten av rangeringens topp 10. Den svarer bare for en betalt sak, og bare for sakens bil og feil. Valget lagres på saken (`sak.vedtaksvalg`): samme svar gir ikke nytt modellkall, og en sak har høyst fem kall (`docs/vedtaksvalg.md`).
  - Brevet koster kr 249 og betales med Vipps ePayment (`src/lib/vipps/`, «Betaling» i `docs/app.md`). `kjop` lagrer saken ubetalt med en ordre «opprettet» (`ordre.id` er Vipps-referansen) og sender kjøperen til Vipps. Bare `avstem` gir saken `betalt`, etter capture; den fyller også kjøperen fra Vipps' profildeling inn i skjemaet og sender kvitteringen med lenken på e-post (Resend, `src/lib/epost/kvittering.ts`). Den kalles fra retursiden `/betaling/[ref]` (bekreftelsen «Takk for handelen!»), webhooken `/api/vipps` og nattjobben. Med `TVISTR_HELT_BREV_UTEN_BETALING=1` (ikke i produksjon) åpnes saken uten Vipps (ordre fra «utvikling»). Kundestøtte: `npm run vipps`. Hendelser uten persondata lagres i `hendelse` (`src/lib/maling.ts`).
  - Tester: `npm test` og `npx playwright test` (`e2e/flyt.spec.ts`, hele flyten mot databasen og modellen).
- **Feilkategoriene** (`src/lib/feil/kategorier.ts`): 13 hovedkategorier med underkategorier. Brukeren kan velge flere av begge. Hver underkategori har en komponenttype (`KOMPONENTTYPER`); typen «opplysning» (historikk, service, utstyr, garanti) gjelder det selgeren sa eller lovet, der bilprofil og formodningsregel ikke teller. «Vet ikke ennå» er symptomer og sammenlignes på symptomet.
- **Feilvurderingen** (`src/lib/feilvurdering/`, kolonner på `vedtak`, migrasjon 0011): Claude Code-agenter leser fulltekst og vurderer hver påberopt feil. De gir kategori og underkategori, utfall (`medhold`/`avvist`/`ikke_vurdert`), avslagsgrunn eller bevisgrunnlag, når feilen viste seg, og ett ordrett sitat. De gir også sanksjoner og antall rettingsforsøk. Per feil gir agentene også når den viste seg (`viste_seg` i perioder) og om utvalget brukte formodningsregelen (`formodning`). Per vedtak gir de `som_den_er` (forbeholdet sto i kontrakten eller annonsen). Importen kontrollerer sitatene mot fulltekst og avleder resten:
  - `godtatte_kategorier`, `godtatte_underkategorier` (`hoved.under`)
  - `tidsniva` per feil: 1 innenfor presumsjonsperioden, 2 utenfor men innenfor reklamasjonsfristen, 3 fra 22 måneder. Nivået regnes etter lovversjonen i hver sak.
  - `godtatte_niva` (`hoved:n`, `hoved.under:n`), slik at kategori og nivå gjelder samme feil
  - `prisavslag_prosent`, `dager_til_feil` og `lovversjon_avledet`

  Agentene henter ut fakta, og koden trekker konklusjonene. Endres instruks eller svarformat, økes `FEILVURDERING_VERSJON`.
- **Hva som avgjorde** (`src/lib/avgjorende/`, kolonnene `avgjorende*` på `vedtak`, migrasjon 0014): Claude Code-agenter (Opus) har lest hvert vedtak i grunnsettet til brevet, med saksfremstilling og utvalgets vurdering adskilt (`avgjorende-v5`).
  - Per feil med medhold: `nevnt_i_vurderingen`, `vurdert_for_seg`, `samlet_med`, `sanksjoner` for feilen alene, `sitater` (hele setninger fra utvalgets vurdering), `avgjorende`, `hjemmel`, `bevis` og `under_tvil`.
  - Per vedtak: `bil` slik vedtaket skriver den, `forbehold`, `lovversjon_brukt`, `selger_svarte` og `rettslige_sitater` (én setning per rettslig poeng).
  - Importen beholder bare sitater som står ordrett i utvalgets vurdering uten utelatelser. Den leser `signaturdato` fra teksten og bruker datavaskene «standpunkt» og «rettslig» (`data/avgjorende/`), og funnene i `kontrollfunn` som ikke er angret.
  - Rekkefølge: se `docs/vedtaksvalg.md`. Endres instruks eller svarformat, økes `AVGJORENDE_VERSJON`.
- **Filtrene dette gir:** kategori og eventuelt underkategori, bare feil med medhold, tidsnivå, bilprofil (`alder_ved_kjop`, `km_ved_kjop`, `kjopesum_nok` fra tolk, i intervaller), «som den er» og sanksjon (`sanksjoner` på `vedtak` gjelder hele vedtaket; `avgjorende` har sanksjonen per feil).
- **Vedtaksvalget** (`docs/vedtaksvalg.md` beskriver det, `docs/ferdigkriterier.md` kravene og målingene): Fanen Vedtak gir topp 10 og avsnittet i brevet som viser til det valgte. Brevløpet er rangering i kode → ett Sonnet-kall for valget → malen. Det har ingen kontroll per brev; kvaliteten sikres i datavaskene.
  - Rangering (`src/lib/matching/`): nivå A er samme feil, vurdert for seg av utvalget, med minst to verifiserte sitater og en bil som ikke er mildere enn kjøperens. Nivå B er et vedtak som avgjorde et av kjøperens rettslige poeng (`rett.ts`), med utvalgets egen setning om poenget. Poengene i `vekter.ts` sorterer innenfor nivået, og de ti beste går videre.
  - Valget (`src/lib/vedtaksvalg/valg.ts`): Sonnet svarer bare med vedtak og sitat-id-er. Holder ikke svaret, brukes rangeringens førstevalg. Endres instruksen, økes `VEDTAKSVALG_VERSJON`.
  - Malen (`mal.ts`): avsnittet bygges bare av felt og ordrette sitater. Uten kandidater blir det lovsetningen «Kravet bygger på lovens vilkår.».
  - Fanen Vedtak tilbyr opptil ti vedtak: valget og resten av rangeringen (`alternativer` i `valg.ts`), med sine første sitater og en likhetsprosent (`src/lib/matching/likhet.ts`; ikke en vinnersjanse).
  - Målinger: `npm run ferdig:dekning`, `ferdig:stikkprove`, `simuler`.

**Vedlikehold:** `README.md` beskriver kjøringsrekkefølge (`hent` → `klassifiser` → `tolk`) og sikkerhetskopi (`npm run db:backup`). Ta kopi før `tolk --på-nytt`. Endres prompt eller skjema i `src/lib/ai/`, øk versjonen i `src/lib/ai/prompter.ts`.
