# Ny flyt: kjøperen bygger brevet før betaling

Dato: 2026-10-21. Kilde: eierens mockup «Tvistr Sjekk saken», lagret som
`docs/superpowers/specs/2026-10-21-ny-flyt-mockup.html` (én HTML-fil, åpnes i nettleseren; kjør
`python3 -m http.server` i mappen hvis `file://` ikke virker). Under kalt «mockupen».

## Hvorfor

Hovedproduktet er klagebrevet (CLAUDE.md). I dag ser kjøperen bare en vurdering før betaling, og
brevet først etter. Eieren vil at kjøperen skal bygge brevet sitt ferdig før betaling og se det vokse
mens hen svarer, med viktige deler sladdet, slik at hen får lyst til å betale for å bruke det hen ser.
Brevet skal ikke være brukbart uten det som mangler.

Dette er en endring av **UI og flyt**. Argumentasjonen i brevet, vurderingen og valget av vedtak er
de samme som i dag.

## Eierens beslutninger

1. **Mockupen er fasit for utseende og flyt**: spørsmålene til venstre, ett om gangen med segmentert
   fremdrift; brevet til høyre som et A4-ark som oppdateres underveis; et ark nederst på smale skjermer;
   toppen med lagringsstatus og konto. Farger, skrifter og komponenter følger mockupen.
2. **Kjernen endres ikke.** `byggBrev`, `tilTekst`, `emne` (`src/lib/app/brev.ts`), `evaluate`
   (`src/lib/app/vurdering.ts`), `lov.ts`, rangeringen (`src/lib/matching/`), vedtaksvalget
   (`src/lib/vedtaksvalg/`, `finnVedtak`), `vurderSaken`, betalingen (`kjop`, `avstem`, Vipps),
   innloggingen, låsen (`LAASTE_FELT`, `laas`), autolagringen og `rensSkjema` beholder sin oppførsel.
   Alt innhold i dagens skjema og brev beholdes. Snapshot-testen av eksempelbrevet (`brev.test.ts`)
   skal stå uendret som bevis.
3. **Alt som påvirker innholdet i reklamasjonen, Mangelen, Rettslig grunnlag, Praksis fra
   Forbrukerklageutvalget og Krav fylles inn før betaling.** Det som ikke endrer hovedinnholdet
   (person, forhandler, vedlegg, tone o.l.) fylles inn etter. Delingen står under «Før og etter».
4. **Deler av hvert avsnitt er sladdet før betaling**, slik at viktige deler mangler og brevet ikke er
   brukbart, men det synes at noe viktig kommer («teaser»). Nøyaktig hva som skjules, finpusses senere
   (se «Sladding»).
5. **Sladdingen skal være ekte.** En kjøper som leser kildekoden, nettverkstrafikken eller
   JavaScript-bunten, skal ikke kunne få hele brevet uten å betale. Bare visuell skjuling holder ikke.

## Før og etter betaling

Feltnavn fra `Skjema` (`src/lib/app/skjema.ts`). Dagens sjekkspørsmål (`src/app/sak/sporsmal.ts`) går
inn i de samme skjermene.

**Før betaling**

| Skjerm (forslag) | Felt | Hva det endrer |
|---|---|---|
| Selger | `seller` (forhandler/privat/leasing), `buyer` (privat/næring) | Om saken dekkes (`evaluate` gir «utenfor») |
| Bilen | `c_reg` (+ Vegvesen-oppslag), `c_make`, `c_model`, `c_year`, `c_lastreg`, `c_delivery`, `c_km` | Første avsnitt, formodning, rangering. Låses ved betaling. |
| Kjøpet | `c_purchase`, `c_price`, `c_asis`, `c_warranty` | Lovversjon, heving/prisavslag, forbehold, garanti |
| Feilen | `f_cats`, `f_parts` | Mangelen, rangering. Låses ved betaling. |
| Per område | `f_area[c].found`, `.impact`, `.known` | Formodning per feil, konsekvens, alvor, vurdering |
| Beskrivelse | `f_catdesc[c]`, `f_desc` | Mangelen |
| Årsak | `f_cause_check` (sjekkens `cause`) | Vurderingen |
| Verksted | `ws`, `ws_who`, `ws_says`, `ws_name`, `ws_date`, `ws_quote` | Mangelen, unntaket fra formodningen, «fraråder bruk» |
| Hva selgeren sa | `seller_said`, `seller_txt` | § 16-avsnittet, hevingsgrunn, rangering |
| Sagt fra før | `f_prior`, `f_prior_date`, `f_prior_how`, `f_prior_svar`, `f_prior_resp` | Rettidig, motsvarene, rentestart |
| Kravet | `k_main`, `k_alt`, `k_amount`, `k_basis` | Krav |
| Mer om kravet | `k_forsok`, `k_cost` | Hevingsgrunner, avvise retting, rangering |
| Tillegg | `k_loaner`, `k_exp`, `exp`, `k_hold`, `k_hold_amt` | Krav, erstatningsliste |

Én oppdagelsesdato **per område**, som i dag (mockupen har én). Formodningen og femårsregelen regnes per
feil. Felt som bare vises under visse svar (for eksempel `ws_*` når det finnes et verksted, `f_prior_*`
når kjøperen har sagt fra), vises bare da, som i dagens skjema. Skjermene kan slås sammen eller deles
slik byggeren finner best, så lenge alle feltene er med og rekkefølgen følger brevet.

**Etter betaling**

- Deg: `b_name`, `b_addr`, `b_zip`, `b_city`, `b_phone`, `b_email` (Vipps fyller dem som i dag).
- Forhandleren: `d_name`, `d_org` (Enhetsregisteret, `/api/firma`), `d_contact`, `d_addr`, `d_zip`,
  `d_city`, `d_email`.
- Brevet: `l_place`, `l_date`, `k_days`, `l_tone`, `f_docs`, `files`.
- Vedtaket: `prec_id`, `prec_selv`, `prec_on` (valget blant de ti).

Byggerens kall (gjort i designet): brevdato og svarfrist står til i dag og 14 dager før betaling, som
i dag. Brevdatoen avgjør om brevet sier at reklamasjonen er rettidig når kjøperen ikke har sagt fra før;
det er greit, fordi den bare kan endres etter betaling. Tonen er «saklig» før betaling. Vedleggslisten
får verkstedrapport og kvitteringer automatisk fra svarene (`vedlegg()`), resten etter betaling.

## Sladding som holder

Brevet bygges **bare på serveren**, før og etter betaling. Nettleseren får aldri `byggBrev`-koden eller
tekst som er skjult.

- `brev.ts` (og det den trenger) importeres bare fra serverkode (`import "server-only"`). Klientkomponenter
  kan importere typene (`Blokk`, `Del`), aldri funksjonene.
- **Før betaling:** en ny serverhandling tar svarene (renset med `rensSkjema`, uten id og innlogging),
  kjører `byggBrev` og en sladdefunksjon, og svarer med blokker der hver skjult bit er erstattet av en
  markør med bare en omtrentlig lengde (ny `Del`-variant, for eksempel `{ skjult: n }`). Svaret
  inneholder aldri den skjulte teksten. Svarene lagres og logges ikke. Rategrense per IP som de andre
  handlingene (`lagGrense`).
- **Etter betaling:** en serverhandling bygger hele brevet, bare for eieren (`hentEgenSak`), med de
  låste feltene tatt fra saken (`laas`). Ingen andre får hele brevet, uansett hva de sender. «Kopier
  brevet» og «Kopier emnefelt» henter teksten fra serveren.
- Vedtaksavsnittet før betaling: se «Praksis før betaling».
- Nettleseren sender svarene med en kort pause mens kjøperen skriver. Brevet oppdateres når svaret
  kommer.

**Kjøperens egne opplysninger merkes i `byggBrev`** (byggerens kall, gjort i designet): en ny `Del`-variant
bærer en verdi fra et felt sammen med feltnavnet (for eksempel `{ felt: "c_km", tekst: "84 000" }`), også
der verdien i dag skrives inn i en malstreng. Dette endrer bare hvordan teksten er delt opp, ikke hva den
sier: `tilTekst` skal gi nøyaktig samme tekst som før, og snapshot-testen står uendret. Merkene brukes av
sladdefunksjonen (vis kjøperens egne svar), av markeringen av det som nettopp ble fylt inn, og av klikk
på brevet etter betaling.

**Sladderegelen** (eierens beslutning 4) er en egen ren funksjon fra `Blokk[]` til sladdede blokker, slik
at den kan finpusses uten å røre noe annet. Utgangspunkt til den finpusses: overskriftene, kjøperens egne
opplysninger og avsnittets første setning vises; resten av hvert avsnitt i Mangelen, Rettslig grunnlag,
Praksis og Krav skjules delvis, slik at hvert avsnitt mangler en viktig del. Avsnitt der kjøperen ikke
har svart ennå, viser plassholdere som i dag (grå felt med etikett), ikke sladd. Hva som er «viktig»,
bestemmer eieren senere.

## Praksis før betaling

Valget av vedtak er uendret: det skjer i `finnVedtak` etter betaling, med ett modellkall. Før betaling
gjøres ingen modellkall.

- Resultatskjermen viser det første kortet fra `vurderSaken` (bil, utfall, saksnummer og år, ingen
  sitater eller lenker), som i dag. `vurderSaken` får nå de fulle svarene (`tilSvar` på skjemaet) i stedet
  for sjekkens (`sjekkTilSvar`); rangeringen selv endres ikke.
- I brevet før betaling har Praksis-delen overskriften og et sladdet avsnitt. Det synlige skal bare være
  felt fra det samme kortet (bil og utfall), aldri en setning med egne ord om hva vedtaket sa. Saksnummer
  og sitater er alltid skjult.
- Ingen tekst før betaling lover at akkurat dette vedtaket står i det ferdige brevet; brevet etter
  betaling viser til modellens valg, som kan være et annet (`docs/vedtaksvalg.md`).

## Flyten før betaling (`/sak`)

- Venstre: gruppe og «Spørsmål n av N», tittel og hjelpetekst, feltene, «Tilbake» og «Neste» (sticky),
  «Se vurderingen» på siste. Under: panelet «Styrken på saken».
- **Panelet viser `evaluate` slik den er**: nivået (`badge`) og radene (`factors`) med sin status. Mockupens
  faste fem punkter brukes bare som form; innholdet kommer fra `evaluate`. Panelet oppdateres underveis.
- «Privatperson», leasing og kjøp i næring gir `evaluate`s «utenfor»-resultat med rådene, og ingen
  betaling, som i dag. Mockupens advarsel er formen.
- **Resultatet**: tittel og oppsummering fra `evaluate`, vedtakskortet, «Lås opp hele brevet · kr 249»,
  «Endre svarene». Knappen åpner dagens kjøpsvindu (`src/app/deler/kjop.tsx`) med avkrysningen for
  angreretten (angrerettloven § 22 n) og Vipps' egen knapp. Videre går det som i dag: Vipps,
  `/betaling/[ref]`, saken.
- Høyre: brevet fra serveren, med markering av det som nettopp ble fylt inn, rulling til endringen,
  «Vis siste endring» når kjøperen har rullet bort, nummererte avsnitt som fylles, og «x av N opplysninger
  fylt inn». Markeringen bruker feltmerkene fra `byggBrev` (se «Sladding som holder»). Hva N teller, bestemmer
  byggeren.
- Svarene ligger i nettleseren (`localStorage`) som i dag: skjemaet, pluss de sjekksvarene `Skjema` ikke har
  (`seller`, `buyer`, og «vet ikke» for «som den er», som `c_asis` ikke kan bære). `Skjema` får ingen nye
  felt (byggerens kall): disse svarene avgjør bare om saken dekkes, og en sak som ikke dekkes, kan ikke
  kjøpes, så de trengs ikke etter betaling. `evaluate` får sine `Sjekksvar` avledet av disse og skjemaet,
  slik `resultat.tsx` gjør i dag; etter betaling som dagens Vurdering-fane. En gammel `tvistr-sjekk` gjøres
  om med `fraSjekk`.
- Mockupens «Fyll ut eksempel» er ikke med (eierens beslutning).

**Kjøpet:** `kjop` tar skjemaet (renset med `rensSkjema`) i stedet for sjekken. `manglerForKjop`,
`sammeSak`, regelen om at ingen betaler to ganger, og at kjøperens navn og adresse hentes fra den
innloggedes nyeste sak, gjelder som før. **Har den innloggede alt betalt for samme bil og feil, forkastes
svarene kjøperen nettopp har bygget** (eierens beslutning): kjøperen sendes til den betalte saken, som
beholder sine svar. Resultatskjermen sier det før kjøperen trykker («Du har alt et brev for denne bilen og
feilen. Svarene du har fylt inn nå, blir ikke overført.»), med «Åpne brevet» i stedet for kjøpsknappen, som i dag. Hva `sak.sjekk` skal inneholde (skjemaet ved kjøpet eller
sjekksvarene avledet av det), bestemmer byggeren.

## Etter betaling (`/sak/[id]`)

Samme oppsett, uten faner.

- Venstre: «Betalt · kr 249», «Brevet er låst opp», «Kopier brevet», «Kopier emnefelt», hjelpeteksten om
  å sende det selv, sjekklisten (`mangler`, `datoavvik`), lenken til `/hvis-forhandleren-avviser`, og
  «Svarene dine» med én rad per del og «Endre». Bilen (unntatt overtakelse og km) og feilen vises
  «Låst» med mockupens forklaring. Delene som hører til etter betaling (Deg, Forhandleren, Brevet), står
  først og er åpne til de er fylt ut.
- Vurderingen (dagens fane) blir panelet «Styrken på saken» med «Endre»-lenkene (`stegFor`).
- **Vedtaket**: raden «Vedtaket» åpner vinduet «Lignende vedtak» med innholdet fra dagens fane
  (`vedtaksfane.tsx`): opptil ti, «Anbefalt», «I brevet nå», «Ny», meldingen om endringer, «Les vedtaket»,
  «Bruk i brevet». Merkelappene («Samme feil», «Din bil er eldre», «Samme krav» …) lages av `niva` og
  `treff` som `finnVedtak` alt gir. Om likhetsprosenten også vises, er finpuss. Vedtakene hentes som i dag.
- Klikk på en del av brevet åpner raden den hører til.
- Autolagringen som i dag; toppen viser «Lagret på kontoen din», «Lagrer …» eller «Ikke lagret, prøver igjen».

## Toppen

Logo (til `/`), lagringsstatus («Lagret i nettleseren» før betaling) og «Logg inn med Vipps» eller kontomenyen: navn, «Dine brev» (den innloggedes betalte saker, som
`/min-side`: bil, reg.nr., feil, dato; den åpne er merket), «Start en ny sak» og «Logg ut»
(`loggUtHandling`). `/min-side` blir stående.

## Følger utenfor flyten

- **Personvernerklæringen** (`src/app/personvern/page.tsx`) sier i dag at svarene ligger i nettleseren og
  at bare kjøpsdato, km, årsmodell, feil og datoer sendes til serveren. Nå sendes alle svarene før betaling
  (også beskrivelsene) for å bygge brevet, uten å lagres. Teksten endres slik at hver påstand stemmer.
  Vilkårene sjekkes på samme måte.
- `docs/app.md` og «Løsningen nå» i `CLAUDE.md` oppdateres.
- Målingene (`src/lib/maling.ts`) beholdes; `sjekk_startet`, `resultat_vist`, `kjop_klikket` osv. sendes på
  tilsvarende steder.

## Ikke-mål og anti-mål

- Ikke endre hva brevet sier, hvilke vedtak som velges eller hvordan vurderingen regnes.
- Ikke endre forsiden, `/betaling/[ref]`, e-posten, de juridiske sidene (utover personvernteksten) eller
  datagrunnlaget.
- **Feil selv om det virker:** hele brevet (eller den skjulte teksten) kan leses ut før betaling; noe vises
  før betaling som ikke stemmer med vedtaket eller svarene; et modellkall gjøres før betaling; en sak
  lagres før kjøpet; en ikke-eier får hele brevet til en sak.

## Hvordan vi vet at det er ferdig

- `npm test` grønt, med `brev.test.ts`-snapshot uendret.
- Test: sladdefunksjonen og serverhandlingen før betaling svarer aldri med tekst som er skjult (sjekk at
  ingen skjult setning fra eksempelbrevet finnes i svaret).
- Test: handlingen for hele brevet avviser uten eierskap og bruker de låste feltene fra saken.
- Sjekk av produksjonsbygget: ingen av brevets egne setninger fra `brev.ts` (for eksempel «Det er dermed
  dere som må bevise», «Jeg er kjent med at dere kan tilby å rette mangelen») finnes i `.next/static`.
  Lovens ord (`LOVORD`, paragrafene i `paragrafer.ts`) kan ligge i bunten, fordi `evaluate` bruker dem i
  nettleseren (byggerens kall: lovteksten er offentlig; det som beskyttes, er brevet).
- `e2e/flyt.spec.ts` oppdatert til den nye flyten, grønn på desktop og mobil.

## Overlatt til byggeren

Komponentstruktur og filplassering; skjermrekkefølgen innenfor «før»-tabellen; hvordan pausen og
svarene fra serveren håndteres; diff-algoritmen for markeringen; hva N teller; hvordan sladdemarkøren
tegnes; om CSS følger dagens klasser eller nye; animasjoner.

## Finpusses senere

- Sladderegelen: nøyaktig hva som skjules i hvert avsnitt.
- Om likhetsprosenten vises i vedtaksvinduet.
