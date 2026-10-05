@AGENTS.md

## Hva Tvistr er

Tvistr skal la en bruker fylle ut et kort skjema (tre eller fire steg) om et bruktbilkjøp som gikk galt, og få en vurdering av hvor god klagesak de har før de bestemmer seg for å kjøpe et profesjonelt klagebrev. Vurderingen skal bygge på de cirka 3 600 vedtakene i tabellen `vedtak` (Forbrukerklageutvalget, bruktkjøretøy). Vurderingen trenger bare et utvalg av feltene, men alle feltene i `vedtak` skal beholdes: de er grunnlag for det endelige klagebrevet.

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

## Tabellen `brevsak`

Én rad per reklamasjonsbrev en bruker jobber med: svarene fra vurderingsskjemaet (`svar`) og det som er fylt inn på brevsiden (`utfylling`). Skjema: `src/db/schema.ts`. All tilgang går gjennom `src/lib/brev/sak.ts`, og alt som lagres valideres i `src/lib/brev/utfylling.ts`.

- **Inneholder personopplysninger** (navn, adresse, registreringsnummer), i motsetning til `vedtak`. Derfor: tabellen er ikke med i `npm run db:backup`, ingenting fra en sak skal logges, og fritekst og navn sendes aldri til en språkmodell sammen (bare feilbeskrivelsen sendes, se under).
- **Tilgang:** `id` er 128 tilfeldige bit og er eneste adgangskontroll (`/brev/[id]`). Ikke lag lister over saker eller ruter som slår opp på noe annet enn id.
- **Sletting:** en sak utløper 30 dager etter siste endring. Den slettes når den åpnes etter utløp, av `npm run rydd`, eller når brukeren trykker «Slett saken».
- **Brevsiden er etter kjøp.** En sak opprettes først når brevet åpnes (senere: etter betaling), og det er ingen vei tilbake til vurderingen derfra. Registreringsnummeret tas i steg 1 i vurderingen (oppslag mot Statens vegvesen), holdes utenfor adressen (bare i skjemaets state og `sessionStorage` i fanen), følger med `POST /api/sak` og er låst til saken: `utfylling.kjoretoy` kan ikke endres med `PATCH`.
- **Veiviser etter kjøp:** rett etter kjøpet kommer kjøperen til `/brev/[id]/veiviser` (`src/app/brev/veiviser/`).
  - **Innhold:** en takk, så alle utfyllingsstegene, én skjerm hver med «Neste», «Tilbake» og «Hopp over», og til slutt brevsiden.
  - **Stegene finnes ett sted**, `lagSteg` i `src/app/brev/steg/liste.tsx`, som både brevsiden og veiviseren bruker. Et nytt steg legges inn der.
  - **Knappene:** veiviseren gir `Skjema` sine knapper gjennom `VeiviserKontekst` i `src/app/brev/felt.tsx`. Stegkomponentene vet ikke om veiviseren.
  - **Hopp over:** alle steg kan hoppes over. Det som mangler, står gult i brevet.
  - **Etter gjennomgangen:** når veiviseren er ferdig, lagres `utfylling.gjennomgatt`. Til da sender `/brev/[id]` til veiviseren, som fortsetter på første steg som ikke er ferdig.
  - **Ett steg alene:** `?steg=<id>&tilbake=brev` åpner bare det steget og går tilbake til brevet. Det brukes for «Feilen».
- **Feilbeskrivelsen** er steg 3 i veiviseren. Kode i `src/app/brev/feilen/intervju.tsx` og `src/lib/brev/feilbeskrivelse.ts`, rute `POST /api/sak/[id]/feilen`. `/brev/[id]/feilen` sender bare videre til veiviseren.
  - **Flyt:** kjøperen skriver fritt. Claude stiller 0–8 oppfølgingsspørsmål etter en fast sjekkliste (`FEILEN_SPORSMAL_SYSTEM` i `src/lib/ai/prompter.ts`) og skriver et utkast bare fra kjøperens fakta (`FEILEN_SKRIV_SYSTEM`). Kjøperen redigerer og velger «Bruk vårt forslag» eller «Bruk din tekst».
  - **Hva som lagres:** `utfylling.feilen` har `avsnitt` (ett per feil, eller inntil tre for én feil), `feil` (titler) og `fakta` (svarene).
  - **Datoen:** én dato, den dagen den første feilen viste seg. Ved flere feil står det «Den første feilen viste seg …».
  - **Ikke i feilteksten:** kostnad, forhandlerens svar, hva som ble sagt før kjøpet og rapporten. Det fylles ut i egne steg og vises som «utelatt».
  - **Til modellen sendes bare** tekst, svar og feiltyper. «Bruk din tekst» sender ingenting.
  - **Ingen språkmodell andre steder i brevet.**
- **Rette svar:** vurderingen spør bare om det som avgjør nivået: hvor lenge siden kjøpet (under 2 år, 2–5 år eller over 5 år), hvem bilen ble kjøpt av (forhandler, privatperson eller firma), feil, når den viste seg, om kjøperen visste om feilen før kjøpet, om feilen er tatt opp med forhandleren (ja/nei), om det finnes en verkstedrapport som sier at feilen var der før kjøpet (steg 4, alltid med unntatt ved harde stopp; teller for med slik rapport, mot uten), og bare når det betyr noe: om det ble reklamert innen fem år (kjøp over 5 år, se `sporOmFemarsfrist` i `src/lib/vurdering/innsending.ts`). Brevsidens utfyllingsliste er temainndelt (Kjøpet, Forhandler, Feilen, Før kjøpet, Kontakt med forhandleren, Tilstandsrapport, Vedlegg, Kravet, Om deg; navnene er også overskriftene i veiviseren, spørsmålene står ved feltene), og svarene fra vurderingen står forhåndsutfylt i steget de hører til; det er ikke noe eget kort for dem. Eksakt kjøpsdato (hentes fra Statens vegvesen når registeret har den), kjøpesum og kilometerstand fylles ut i steget «Kjøpet»; «visste du om feilen» og «skriftlig» i «Før kjøpet»; hva forhandleren har gjort (`utfylling.retting`: venter, avvist, forsøkt, reparert selv; avgjør kravet i brevet) i «Kontakt med forhandleren»; rapportsvarene i «Tilstandsrapport». Noen svar utledes i stedet for å spørres på nytt (`avledSvar` i `src/lib/brev/svar.ts`): hvor lenge etter kjøpet feilen viste seg (av datoen i «Feilen»), om det ble reklamert innen fem år (av datoen i «Kontakt med forhandleren»), om en uriktig opplysning er skriftlig (av hvor den ble gitt) og om det finnes bilder (av vedlegget i «Vedlegg»). Et steg som retter et svar fra vurderingen sender hele svaret som `svar` til `PATCH /api/sak/[id]` sammen med det som er fylt ut; serveren tar bare med svarene et steg retter (`REDIGERBARE_SVAR` i `rettSvar`; kjøpsform og feiltyper er låst til saken som bilen), dropper datoer som ikke lenger passer (`tilpassTilSvar`), regner ut de utledede svarene på nytt (`avledSvar`) og kontrollerer resultatet som vurderingen gjør (`kontrollerRettelse`) i samme lagring. En rettelse som gir svar vurderingen ville avvist, eller som loven stopper, lagres ikke. Bare når tiden alene har gjort svarene utdaterte (kjøpet har passert fem år) kan saken lagres stoppet, med et varsel over brevet; brevet tas aldri bort fra en som har kjøpt det. Et gult felt i brevet åpner steget det hører til (feilen åpnes i veiviseren).
- **Nivåer:** `god`, `svak` og `utenfor`. `utenfor` er harde stopp fra loven (kjøp fra privatperson eller gjennom firma, § 1; over 5 år uten reklamasjon, § 27): skjemaet slutter å spørre, resultatet har ett punkt og ingen kjøpsknapp, og `POST /api/sak` avviser saken. Kjøpsdato og «hvor lenge etter kjøpet» gir også om en kjøper som ikke har tatt opp feilen har ventet over ett år (`venterOverEttAr`, gir `svak`); det spørres ikke om to ganger. Resultatet har to lister, «Dette styrker saken din» og «Dette svekker saken din» (`synligGrunnlag`); innvendinger står aldri i tittelen. Tittelen er alltid «Du kan ha en sak mot forhandleren.» for `god` og `svak`, og vedtaket i vurderingen er det brevet viser til, og alltid ett kjøperen vant (`velgHenvisning`): kjøperen vurderer selv ut fra det som taler for og mot. Saksmappen etter kjøp viser også tapte saker. Vedtakene skiller ikke grupper nær null (alder, km og «som den er» gir 55–70 % medhold), så de brukes ikke til å stoppe saker.
- **Fil og purring:** `GET /api/sak/[id]/dokument/{brev,purring}.{pdf,docx}` lager filene på serveren fra samme `Brev` som siden viser (`src/lib/brev/eksport.ts`); brevet lastes ned fra verktøymenyen. Plassholdere i hakeparenteser står igjen i filen; siden advarer.

## Saksmappe (i verktøymenyen ved siden av brevet)

Kode i `src/lib/mappe/`, vist i `src/app/brev/mappe/`. Beregnes per forespørsel fra `vedtak` (`GET /api/sak/[id]/mappe`), lagres ikke og bruker ingen språkmodell. Rene byggere per kort i `kort/` får tallene fra `MappeData` (SQL i `hent.ts`).

- **Utvalget** er første trinn i vurderingens stige (`trinnFor`) med minst `MIN_UTVALG` (30) forhandlervedtak, så mappen og vurderingen er enige. Under `MIN_N` (10) i delinndelinger, `MIN_N_FORHANDLER` (3) og `MIN_N_MODELL` (5) står «for få saker», aldri et tall. Et tall vises alltid med antall saker.
- **Eksempelvedtak** må oppfylle `KVALIFISERT` i `hent.ts` (ikke `trenger_kontroll`, konfidens ≥ 0,85, `qa_status` ≠ feil, sitat for utfall, saksnummer, minst ett nøkkelpunkt). Nøkkelpunktene er modellens sammendrag, ikke ordrett tekst; de vises med kilde-lenke og «les vedtaket». `rens()` gjør `[KLAGER]` o.l. om til ord, fordi brevet bruker hakeparenteser for felt som mangler.
- **Vedtaket brevet viser til** står øverst i «Hva avgjorde lignende saker?». Det velges av `velgHenvisning`, ikke av kjøperen (se «Henvisning i brevet»).
- Andre felt i `utfylling`: `forbehold` (trinnet «Forbehold i kjøpet»), `sjekket` (sjekklisten), `sendt` (datoen brevet ble sendt, for frister og purring), `rapport` (hvem som skrev verkstedrapporten, datoen og kjøperens avskrift av hva den sier om årsak og tidspunkt; bare når rapporten sier at feilen var der før kjøpet, i steget «Tilstandsrapport»). Avskriften siteres ordrett i brevet og i motsvaret, uten språkmodell. Den er frivillig, men teller som manglende under første gjennomgang av veiviseren, så en kjøper som kommer tilbake, havner der.
- Juridisk ordlyd som ikke bare gjentar en regel (subsidiært prisavslag, rente, forbehold, slitasje, motsvarene) står i `JURIDISK` i `src/lib/brev/brev.ts` og i `src/lib/brev/motsvar.ts` (svarene under «Motsvar» i verktøymenyen ved siden av brevet). **Ikke lest av jurist.**

## Henvisning i brevet

Brevet og vurderingen viser til samme vedtak, valgt av `velgHenvisning` i `src/lib/vurdering/henvisninger.ts` fra et kuratert bibliotek (`HENVISNINGER`), aldri fra databasen ved kjøring.

- **Stige:** lignende sak (samme feilgruppe, tidsrom og aldersgruppe) → samme feilgruppe i nabotidsrommet → en sak der utvalget la samme regel til grunn som brevet bygger på (formodning, rapport, opplysning eller forventning). Det siste trinnet finnes alltid, så alle saker som loven ikke stopper, får en henvisning.
- **Aldri vunnet på en fordel kjøperen mangler:** ingen sak vunnet på formodningsregelen for en kjøper uten den, ingen sak etter ny lov for kjøp før 1.1.2024, og ingen lignende bil mer enn 4 år nyere eller 10 år eldre enn kjøperens (bilens årstall kommer fra Vegvesen-oppslaget).
- **Form i brevet** (`JURIDISK.henvisning`): rett etter avsnittet om mangel og bevisbyrde; organ, ref i utvalgets egen form (FKU-2023-13923), dato og lenke; ingen beløp og ingen navn.
- **Biblioteket** fylles og kontrolleres etter `docs/henvisninger.md` (agenter, belegg i `scripts/henvisninger-belegg.json`). `npm run sjekk-henvisninger` må gi 0 feil etter hver endring. Endres biblioteket, kan henvisningen i åpne saker skifte; det lagres ikke i `brevsak`.

## Skjema og komponenter

- **shadcn/ui** (`radix-nova`) i `src/components/ui/`, lagt inn med `npx shadcn@latest add` og justert til Tvistrs mål (16 px tekst, 48 px høye felt). Paletten står som tokens i `src/app/globals.css` (`--primary` #17263d, `--input` #bfbab0 osv.); bruk tokenklasser (`bg-primary`, `text-muted-foreground`), ikke hex, i skjema.
- **Felles felt** i `src/app/brev/felt.tsx`: `Tekstfelt`, `Valgfelt` (få svar som rader med radio, tittel og forklaring; hele raden klikkes), `Flervalgsfelt` (samme rader med avkryssing, flere svar kan stemme), `Nedtrekk` (Select, bare for lange lister) og `Skjema`.
- **Datoer** skrives eller velges i `Datofelt` (`src/app/brev/datofelt.tsx`): dd.mm.åååå inn, ÅÅÅÅ-MM-DD ut, `""` til datoen er hel og innenfor `min`/`max`. Ingen `type="date"`.
- **Bekreftelse** (`src/app/brev/bekreft.tsx`): `BekreftKnapp` (AlertDialog) foran det som ikke kan angres; `useBekreftLagring` foran en lagring som gjør brevet svakere, regnet ut av `konsekvenserAv` i `src/lib/brev/konsekvenser.ts` (samme kjede som `PATCH /api/sak/[id]`).

## Tester

Få tester med vilje: små features skal gå raskt å bygge.

- **Vitest (`npm test`)** dekker bare vurderingsmotoren (`src/lib/vurdering/`: samme input gir forventet vurdering) og brevet (`src/lib/brev/brev.test.ts`, `brev-krav.test.ts`: brevet bygges riktig ut fra input). Ikke skriv enhetstester for andre deler.
- **Playwright (`npm run test:e2e`)** har én test: `e2e/registreringsflyt.spec.ts`, fra forsiden gjennom stegene og vurderingen til ferdig brev. Oppslag mot Statens vegvesen mockes; `/api/vurder` går mot ekte database.
- **Ikke lag nye tester (Vitest eller Playwright) uten at brukeren ber om det.** Ingen «E2E-tester»-seksjon i planer.
- Underveis i avanserte features kan Playwright (MCP) brukes til å sjekke UI-et i nettleseren. Det er verktøy for utvikling, ikke tester som sjekkes inn.
- Rød test: les feilen før noe endres. Skyldes den en bevisst endring, oppdater testen; skyldes den en feil i appen, rett appen. Aldri svekk forventninger eller bruk `skip`/`fixme` for å få grønt.
- Testdata er oppdiktede tall. Ingen navn, adresser eller regnummer.
