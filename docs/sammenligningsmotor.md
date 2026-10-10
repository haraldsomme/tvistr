# Sammenligningsmotor

*Bygget 2026-10-09 etter spesifikasjon v1.0. Gjort om til et filter 2026-10-10 etter piloten på 40 fiktive saker (`docs/testrapport-sak.md`). Kode: `src/lib/sammenligning/`. Kjøring: `npm run sammenlign -- <skjema.json> [--idag ÅÅÅÅ-MM-DD] [--ut fil.json]`.*

*Tester:*
- *`sammenligning.test.ts` kjører uten database.*
- *`regresjon.test.ts` (`npm run test:db`) kjører Enyaq-saken (`testdata/enyaq-skjema.json`) mot indeksen og sammenligner med `testdata/enyaq-fasit.json`.*
- *`npm run sveip` sjekker invariantene på 61 824 kombinasjoner.*

Motoren er et **filter**. Den tar skjemaet og gir for hver feil:
- **styrken** (`svak`, `middels`, `sterk`) og hvorfor den ikke er sterk;
- **0–5 vunne vedtak i samme kategori** som saken er minst like sterk som, med kriteriene som ble sammenlignet.

Den skriver ingen tekst og bruker ingen LLM: samme skjema gir samme svar. Praksisavsnittet i brevet skrives av `src/lib/praksis` fra kandidatene, med ordrett belegg fra vedtakets fulltekst (`docs/praksis.md`).

## Hvorfor et filter (besluttet 2026-10-10)

Piloten viste at den maskinelle delen holdt (spor, styrke, filtre: 100 %), men at praksisavsnittet sa ting som ikke var sanne om vedtakene:
- taushet omtalt som «uriktig opplysning»;
- «selgers dokumentasjon var ikke tilstrekkelig» der selger ikke la frem noe om feilen;
- «samme type feil» på tvers av kategorier.

Årsaken var at setningsmalene bygde på felt som er grovere enn setningene (`selger_bevis_finnes` gjelder hele saken, ikke feilen). Regelsettet hadde dessuten vokst for å alltid finne et vedtak. Beslutningen er **aldri si noe usant**: omtrent halvparten av brevene får da ikke et praksisavsnitt om et konkret vedtak, og det aksepteres.

**Fjernet:**
- nabokategori på alle spor (trinn 2 og `kategoritrinn`): samme kategori eller ingenting;
- det generelle avsnittet (`generelt.ts`): erstattes av en fast blokk skrevet av jurist (`docs/praksis.md`);
- alle setningsmaler (`argumenter.ts`, `fraser.ts`) og sitatvalget;
- rangeringsnøkler som kom til sak for sak: identisk ordlyd, siterbarhet, forhandler først, lovversjon, sanksjon som passer;
- kriteriet `kategori`, som er konstant når bare samme kategori hentes;
- `praksis`, `naermeste` og `motstridende` med profilsammenligningen;
- fordelingen av ett vedtak per feil (`fordel`).

## Flyt

| Steg | Fil | Hva |
|---|---|---|
| Sak | `avled.ts` `avledSak` | Lov, frist, bånd, km-svakhet, ønsket løsning (`reparasjon` → `retting`, `angre_kjopet` → `heving`) og reklamasjonsdato |
| Feil | `avled.ts` `avledFeil` | Frist, slitedel, A-variant og A-form, rapportsvar, spor i rekkefølgen A → C → B, dager til reklamasjon |
| Kandidater | `kandidater.ts` | SQL mot `vedtak_feil_sok` med join mot `vedtak` og `vedtak_analyse`: samme kategori, ett spor per spørring, høyst 30 |
| Kriterier | `kriterier.ts` | Kriterietabellen per spor |
| Sterkere enn | `ranger.ts` `sterkereEnn` | Porten: krav, høyst én adresserbar svakhet, selgers motbevis på B og C |
| Rangering | `ranger.ts` `ranger`, `velgTilBrev` | Flest sterkere, ingen svakhet, nyest; inntil to feil til brevet |
| Samlet | `index.ts` `sammenlign(skjema, hent, idag)` | `hent` gis inn utenfra, så testene kan kjøre uten database |

## Reglene

**Spor** (`docs/spor.md`):
- **A-uttalelse:** skriftlig og konkret opplysning med avskrift (`erSpesifikk`). Helhetsutsagn som «pen og velholdt» gir ikke A. Muntlige løfter gir aldri A.
- **A-taushet:** selger sa ingenting om skadehistorikk, servicehistorikk, km-avvik, bruktimport eller årsmodell.
- **C:** rapporten sier både «mer enn normal slitasje» og «var der ved overtakelsen».
- **B:** innen fristen (seks måneder før 2024, to år etter), og rapporten sier hvilken del som er feil.

**Kandidatfiltre** (alle i SQL):
- `vurdering = 'mangel'` og sporet er vunnet;
- **samme kategori som feilen**;
- forhandler eller formidling (formidling dømmes etter forbrukerkjøpsloven med solidaransvar, 56288);
- utfall ≠ avvist, vedtak fra 2021 og senere, ikke en ikke-mangelssak;
- ikke heving når brukeren ikke vil heve (F9, `a.sanksjon is distinct from 'heving'`);
- på A: varianten leses fra opplysningene. En skriftlig uttalelse knyttet til feilen med `vekt = for_klager` gir uttalelse, også når grunnlaget er `tilbakeholdt_opplysning` (52074). Taushet krever `tilbakeholdt_opplysning`.

**Sterkere enn** (porten):
- ingen kravkriterier kan være svakere;
- høyst én svakhet, og den må kunne adresseres;
- har selger motbevis og selger i vedtaket ikke, forkastes vedtaket alltid på B og C. På A er det bare et flagg;
- på A må vedtaket ha en skriftlig uttalelse knyttet til *denne* feilen. Ellers forkastes det («ingen opplysning i vedtaket knyttet til feilen»);
- en slitedel sammenlignes på B bare med et B-vedtak på samme slitedel (`ikke_slitedel`).

**Kandidatene:** ett kall per spor feilen har, i sporrekkefølgen. Godkjente vedtak slås sammen med primærsporet først. Et vedtak som er godkjent på to spor, telles én gang. Høyst fem (`MAKS_KANDIDATER`).

**Rangering innenfor et spor:** flest sterkere momenter, ingen svakhet, nyeste vedtak, så `vedtak_id` og `feil_id`.

**Til brevet** (`valgt_til_brev`): inntil to feil med kandidater, etter antall sterkere hos den beste kandidaten, deretter kostnad.

## Styrke

| `styrke` | `styrke_grunn` | Når |
|---|---|---|
| `svak` | `ingen_spor` | Feilen har ikke spor (`ingen_spor_arsak` sier hvorfor). |
| `middels` | `ingen_vedtak` | Feilen har spor, men ingen godkjente kandidater i kategorien. |
| `middels` | `reklamert_sent` | Feilen har kandidater, men ble tatt opp med selger mer enn to måneder etter at den ble oppdaget (fkjl. § 27). |
| `sterk` | – | Feilen har kandidater og ble reklamert i tide. |

**Reklamasjonstid** regnes fra feilen ble oppdaget til første kontakt med selger. Har kjøperen ikke tatt den opp ennå, er brevet reklamasjonen, og tiden regnes til i dag. Er kontakten datert før feilen ble oppdaget (den gjaldt en annen feil, som F1 i Enyaq), regnes tiden som ukjent.

Et forlik dekker bare feilene avtalen gjelder (`avtale_gjelder_feil`, 110357). De matches ikke og står med `styrke: null`.

**Tapte saker** (`tapte`) er informasjon, ikke styrke: fordelingen av utvalgets grunner i tapte saker i samme kategori på primærsporet, og de to nyeste. Filter: `vurdering = 'ikke_mangel'`, sporet er prøvd, forhandler eller formidling, 2021 og senere, ikke tapt på `reklamert_for_sent` eller `utbedret_av_selger`. Kjøperen ser dem i vurderingen når saken mangler vedtak, som grunnlag for å bestille rapport. De står aldri i brevet.

## Datakilden og sanksjon

Disse feltene finnes ikke i `vedtak_feil_sok` og hentes med join: `sanksjon`, `tilkjent_totalt_nok`, `forbehold[]`, `selger_bevis_finnes`, `forste_henvendelse_dato`, `opplysninger` og `bevis`.

**Sanksjon** lagres i `vedtak_analyse.sanksjon` (migrasjon 0010). Den settes av `pass2:importer` og fylles ut på nytt med `npm run pass2:sanksjon` (`src/lib/analyse/avled.ts` `avledSanksjon`).
- **Heving leses fra vedtaksslutningen**, ikke fra beløpene. Beløpet kan være et nettooppgjør (17/1629: 11 535 av 209 000 kr).
- **Mønsteret:** slutningen finnes etter overskriften («fatter slikt vedtak»); punktum i tall og datoer avslutter ikke leddet (21/4203); «mot å stille», «til rådighet» og «skal returneres» teller; en del som leveres tilbake er ikke heving (24/1726); en tilbakeleveringsklausul uten hevingskrav er ikke heving (21/6296).
- **Reserveregel:** heving var krevd, og minst 90 % av kjøpesummen ble betalt tilbake (14/1382, 23/2860).
- **Resultat:** 131 hevingsvedtak blant de 994 analyserte.

## Kriterier verdt å kjenne

- **Direkte spørsmål** spørres om i skjemaet når opplysningen sto i en melding, og leses ikke ut fra at det var en melding.
- **Kostnad over kjøpesummen:** kriteriet `kostnad_pris` utelates når kostnaden er over kjøpesummen uten at kjøperen har bekreftet beløpet (skrivefeil som 52 000 for 520 000 kr).
- **Kostnadsandel** bruker vedtakets `utbedringskostnad_nok`, ikke største bevisfaktura (22/3370).
- **Påregnelighet på C:** et vedtak vunnet på C regnes alltid som dokumentert utover det påregnelige.
- **Tid fra en bevisdato** (`viste_seg_kilde = bevisdato`) er en øvre grense: `tid_til_feil` blir ikke sterkere innenfor den, og reklamasjonstiden blir ikke svakere (21/5099).
- **Spor B, tid til feil:** kan bare adresseres når verkstedet har knyttet feilen til leveringen (S06).

## Sveipet (invarianter)

`npm run sveip` kjører 61 824 skjemakombinasjoner mot indeksen på rundt 15 sekunder: 23 kategorier × selgers opplysning × verksted og rapport × tid og lov × bilens alder × ønske × motbevis × forbehold. Det gir exit 1 når en invariant brytes:
- privatkjøp stopper før matching, og ingen annen kombinasjon stopper;
- uten ønske om heving har ingen kandidat `sanksjon = 'heving'`;
- uten spor ingen kandidater;
- styrken følger tabellen over;
- høyst fem kandidater, alle på et spor feilen har.

Fordelingen skrives ut til informasjon og sammenlignes ikke med en fasit. Alle kombinasjonene teller likt, så tallene er ikke produktstatistikk. Tall 2026-10-10: svak 40,4 %, middels 23,1 %, sterk 36,6 %.

## Kjente svakheter

- **`erSpesifikk`** (`spesifikk.ts`) er optimalisert for presisjon, fordi en falsk A er verre enn en manglende. `npm run spesifikk` måler regelen mot de 1 843 skriftlige uttalelsene pass 2 har merket og feiler over 10 % generelle kalt spesifikke. Tall 2026-10-10: 5,8 % generelle kalt spesifikke og 19,7 % spesifikke kalt generelle på hele settet; 9,6 % og 22,1 % på testhalvdelen. Piloten fant ett tilfelle der en konkret uttalelse ble kalt generell («Lakk i god stand, ingen lakkskader på dører eller bakluke»).
- **Skriftlig melding rangeres under annonse og kontrakt** (`FORM_RANG`). Et A-vedtak med opplysningen i en annonse forkastes derfor når kjøperens opplysning sto i en SMS. Piloten mente dette er for strengt rettslig; det er ikke endret.
- **Samme sak kan ligge to ganger i basen** med ulik `vedtak_id` (FKU-2025-55355 og FKU-2025-55355-2). Kandidatlisten dedupliserer bare på `vedtak_id`.
- **Bare pass 2-data fra 2021 og senere.** Nesten alle vedtakene gjelder kjøp før 2024.
