# Vurderingen før betaling

Før betalingsmuren skal kjøperen få svar på «kan jeg ha en reklamasjonssak?» og se hva brevet vil inneholde. Alt før muren er kode og oppslag i databasen: ingen modellkall, ingen tekst skrevet av en modell, ingen sannsynlighet for utfall. Vi viser hva loven sier og hva utvalget har gjort i lignende saker; vi lover aldri et utfall.

Kravene og målingene står i `docs/ferdigkriterier.md` («Før betalingsmuren»). Skjemaet er beskrevet i `docs/skjema.md`, brevet i `docs/brev.md`.

## Flyten

```
Landingsside → 1 Bilen → 2 Kjøpet → 3 Feilen → 4 Vurdering (gratis)
→ 5 Detaljer → 6 Krav og selger → 7 Forhåndsvisning (betaling) → 8 Brevet
```

Ett skjema, så ingen spørsmål stilles to ganger. Det vurderingen trenger (bil, kjøpsdato, km, kjøpesum, «som den er», feil og datoen hver feil ble oppdaget) kommer før steg 4; det brevet trenger i tillegg (verksted og rapport, hva selger sa, beskrivelse, krav, kontakt med selger, utlegg, selger) kommer etter.

| Steg | Kode | Modell |
|---|---|---|
| Landingsside | `src/app/page.tsx` | nei |
| 1–3 | `src/app/sak/skjema.tsx` | nei |
| 4 Vurdering | `vurderSaken` (`src/app/sak/vurdering.ts`) → `byggVurdering` (`src/lib/vurdering/vurdering.ts`) | nei |
| 5–6 | `skjema.tsx` | nei |
| 7 Forhåndsvisning | `finnVedtak` → `byggBrevet` (`src/app/sak/actions.ts`) | ett Sonnet-kall for vedtaksvalget |
| 8 Brevet | `byggBrevet` med ordre-id | nei (samme vedtak som i steg 7) |

## Landingssiden

Én handling: registreringsnummeret, som er steg 1. Skjemaet er et vanlig `<form action="/sak">`, så det virker før sidens skript er lastet; `/sak?regnr=` slår opp bilen med en gang. Under står tre faste punkter om hva brevet inneholder og «{N} vedtak fra Forbrukerklageutvalget ligger til grunn», der N er antall vedtak i telle-grunnsettet (raden `alle` i `statistikk_kategori`), lest når siden bygges. Ingen omtaler, ingen prosentløfter. Prisen står i `src/lib/pris.ts`.

## Status (3.1)

Én av tre, bestemt av `vurderStatus`. `svak` er bare en status for målingen og loggen: kjøperen ser samme ikon, overskrift og side som ved `sak`, og grunnene vises ikke i steg 4. Det som gjelder saken, står i «Dette sier loven om din sak», og advarslene står ved feltene i skjemaet og samlet i steg 7. Ordet «svak» står aldri i tekst til kjøperen (testen for forbudte ord).

| Status | Vilkår | Overskrift |
|---|---|---|
| `ute` | mer enn fem år siden kjøpet (samme grense som tidslinjen, `kjop_fem_aar`) | «Fristen for å reklamere er ute» |
| `svak` | én eller flere grunner under | «Du kan ha en reklamasjonssak» |
| `sak` | ellers | «Du kan ha en reklamasjonssak» |

Grunnene, i denne rekkefølgen. Tekstene er de samme som advarslene i skjemaet (steg 2 og 3), der de vises:

| Regel | Vilkår | Tekst (vises også i skjemaet) |
|---|---|---|
| `feil_over_to_aar` | en feil oppdaget mer enn to år (24 kalendermåneder) etter overtakelsen | `OVER_TO_AAR_FEIL` fra `tidslinje.ts` (steg 3) |
| `som_den_er_gammel` | «som den er», kjøp før 2024, og bilen over 10 år ved kjøpet eller over 200 000 km | `SOM_DEN_ER_GAMMEL` (steg 2) |
| `slitedel_sen` | en valgt underkategori er slitedel (`KOMPONENTTYPER.slitedel`) og feilen ble oppdaget mer enn 6 måneder etter kjøpet | «{Delen} regnes som en slitedel, og feilen ble oppdaget mer enn 6 måneder etter kjøpet. Selger kan hevde at feilen skyldes normal slitasje.» (steg 3) |
| `ingen_niva_a` | rangeringen finner ikke noe vedtak på nivå A | «Vi har ingen vedtak om akkurat denne feilen på en bil som din.» |

Alder ved kjøpet er kjøpsåret minus året bilen første gang ble registrert, som i rangeringen.

Ved «Fristen er ute» stopper flyten: teksten er den samme som stoppet i tidslinjen, med «Gå til Forbrukerrådet» og «Endre kjøpsdato». Ingen betalingsknapp. Kjøperen kommer hit rett fra steg 2, uten å fylle ut feilene, og skjemaet viser ikke lenger det røde stoppet ved kjøpsdatoen.

## «Dette sier loven om din sak» (3.2)

Faste tekster valgt av `lovlinjer`. Hver sak som ikke er over fem år, har minst én linje i kjøperens favør (✓). En test går gjennom over 10 000 kombinasjoner for å sjekke det: alle kategorier og underkategorier, alene og med en feil til, kjøp før og etter 2024, feilen tidlig og sent, og alle svar om «som den er». Paragrafen kommer fra `paragrafer.ts` for lovversjonen kjøpet følger; ingen tekst har et paragrafnummer i seg. Alle kombinasjonene står i `src/lib/vurdering/__snapshots__/lovlinjer.txt`.

- **Mangel**, først, én linje per type feil kjøperen valgte (samme grunnlag som brevets mangelsetning i `rettslig.ts`):
  - teknisk feil eller «vet ikke ennå»: «Bilen skal ha den holdbarheten og de egenskapene du hadde grunn til å forvente. Gjør den ikke det, har den en mangel.» (§ 16 første ledd bokstav a). Utelates før 2024 ved «som den er» = ja, der linjen om forbeholdet (§ 17) gjelder i stedet.
  - det selger sa eller lovet: «Bilen skal svare til det selger opplyste før kjøpet.» (§ 16 første ledd bokstav c)
  - garanti: «Bilen skal svare til det som er avtalt, også garantien.» (§ 15 første ledd)
- **Frist** (fra overtakelsen til i dag, siden brevet er reklamasjonen hvis kjøperen ikke har reklamert før):
  - innen to år: «Du er innenfor fristen for å reklamere (to år fra overtakelsen).» (§ 27 annet ledd første punktum)
  - mellom to og fem år, og en feil er slitedel eller av ukjent type (for eksempel «vet ikke ennå»): «Fristen er fem år for deler som er ment å vare vesentlig lenger enn to år, ellers to år.» (§ 27 annet ledd)
  - ellers: «Du er innenfor fristen for å reklamere (fem år fra overtakelsen).» (§ 27 annet ledd annet punktum)
- **Bevisbyrde** (§ 18 annet ledd), for feil som ikke gjelder det selgeren sa eller lovet (der fantes feilen ved salget, og formodningen spiller ingen rolle). Fristen er 6 måneder før 2024 og 2 år fra 2024.
  - innen fristen, uthevet: «Feilen viste seg innen {frist}. Da er det selger som må bevise at feilen ikke var der da du overtok bilen.»
  - etter fristen: «Feilen viste seg etter {frist}. Da må du selv sannsynliggjøre at feilen var der ved levering, typisk med en verkstedrapport. Brevet legger opp til det.»
  - Flere feil: «Feilene …» når alle er på samme side, og «Feilen ved {kategori} …» per gruppe når de er på hver sin side.
- **Forbehold**, bare ved «som den er» = ja: før 2024 «Bilen ble solgt «som den er». Du kan likevel reklamere hvis bilen er i dårligere stand enn du kunne forvente.» (§ 17 første ledd bokstav a); fra 2024 «Et alminnelig «som den er»-forbehold gjelder ikke lenger etter loven fra 2024.» (§ 15 annet ledd).
- **Lovversjon:** «Kjøpet følger forbrukerkjøpsloven slik den gjaldt før 2024.» / «… slik den gjelder fra 2024.»

## «Lignende saker i Forbrukerklageutvalget» (3.3)

### Tallene

Fra `statistikk_kategori`, én blokk per valgt hovedkategori:
- underkategorien når nøyaktig én er valgt og den har minst 5 saker,
- ellers hovedkategorien,
- under 5 saker vises ingen tall, bare «Vi har vedtak om {kategori}»,
- uten saker vises ingenting.

Setningene (`tallsetninger`):
- «Utvalget har behandlet {N} saker om {kategori} i brukte biler kjøpt fra forhandler. I {M} av dem fikk kjøperen medhold.»
- «Kjøperen fikk heving i {h}, prisavslag i {p}, retting i {r} og erstatning i {e} av sakene med medhold.» (bare utfallene som finnes; et vedtak kan ha flere, så tallene summerer ikke til M, og stolpene på skjermen er hver sin andel av M)
- «Prisavslagene lå typisk på {median} % av kjøpesummen.», når minst 10 vedtak har kjent prosent.

Der navnet i skjemaet ikke passer etter «saker om», har kategorien en egen form (`TEMA` i `vurdering.ts`), for eksempel «manglende servicehefte».

### Statistikk-tabellen

`statistikk_kategori` (migrasjon 0016) bygges ved import, ikke per forespørsel: `feilvurdering:importer` og `avgjorende:importer` kjører `lagreStatistikk` til slutt, og `npm run statistikk:bygg` gjør det alene. Tellingen er en ren funksjon (`byggStatistikk` i `src/lib/vurdering/statistikk.ts`).

- **Grunnsettet** er brevets (`grunnfilter.ts`) uten medhold-filteret: personbil eller varebil, forbrukerkjøpsloven, forhandler, utfall medhold, delvis medhold eller ikke medhold. Vedtak som ble avvist uten realitetsbehandling (utfall «avvist», 9 vedtak) er ikke med. Saker som løses før utvalget, finnes ikke i tallene, og teksten sier derfor «saker utvalget har behandlet».
- **N** er vedtak der utvalget vurderte en feil i kategorien (feilvurderingens utfall `medhold` eller `avvist`). En påberopt feil utvalget ikke tok stilling til (`ikke_vurdert`) telles ikke.
- **M** er vedtak der feilen fikk medhold.
- **Utfallene** er det kjøperen fikk for feilen alene: svaret fra `avgjorende` når det finnes, ellers vedtakets sanksjoner når dette var den eneste feilen med medhold. Ellers telles ikke utfallet.
- **Median prisavslag** er `prisavslag_prosent` i vedtak med medhold i kategorien og prisavslag for feilen, null under 10 vedtak.
- `alder_median` og `km_median` (vedtak med medhold) står i tabellen; skjermen sammenligner med kortene, ikke med medianene.

Kontrollert mot en fersk telling i SQL med `npm run ferdig:vurdering`.

### Kortene

De tre øverste vedtakene på nivå A fra `ranger()` med kjøperens sak slik den er etter steg 3 (krav, verksted, hva selger sa og rettingsforsøk er ikke spurt ennå; de endrer poengene, aldri nivået). Hvert kort: saksnummer, år, bilen slik vedtaket skriver den, km ved kjøp (utelatt når saken gjaldt kilometerstanden), «som den er» hvis ja, og hva kjøperen fikk for feilen. Ingen sitater, ingen lenker.

Under kortene: «Bilen din er yngre og har gått kortere enn i disse sakene.», bare de delene som gjelder alle tre kortene, med brevets grenser (minst 2 år yngre, høyst 90 % av km).

Uten nivå A: ingen kort, og «Vi har ingen vedtak om akkurat denne feilen på en bil som din. Brevet vil vise til et vedtak om det rettslige poenget i saken din ({poeng}).» Poenget er det beste nivå B-vedtakets (`POENGNAVN`). Finnes heller ikke det, sier teksten at brevet viser til et vedtak om et rettslig poeng hvis det finnes et som passer til kravet, ellers bygger det på lovens vilkår.

## «Dette får du» (3.4)

Faste punkter: brevet etter loven {før 2024 / fra 2024}, henvisningen til vedtaket, kravet med riktig hjemmel, fristen og hva som skjer uten svar, Word og kopierbar tekst; «{pris} kr. Betal når brevet er klart, ikke nå.», knappen «Fortsett til brevet» og «Tre korte steg til …». Nederst: «Tjenesten gir ikke juridisk rådgivning. Vurderingen bygger på svarene dine og på publiserte vedtak.»

**Avvik fra planen:** planen sier «Henvisning til vedtak {saksnummer fra kort 1}». Vedtaket brevet bruker velges i steg 7, når kravet er kjent, blant de ti beste på samme nivå, og det er ofte et annet enn kort 1 (i prøvekjøringen 13/1222, ikke 18/437). Punktet sier derfor «Henvisning til et vedtak der kjøperen fikk medhold for samme feil, med ordrette sitater fra utvalget» (nivå A) eller «… et vedtak om {poeng}» (nivå B). Saksnummeret står i steg 7, der det er sikkert.

## Før og etter betaling

| | Steg 4 og 7 | Steg 8 |
|---|---|---|
| Lovens regler for saken | ja | ja |
| Antall saker, utfall, median prisavslag | ja | |
| Vedtakskort: saksnummer, bil, km, utfall | ja (3) | |
| Sitater fra utvalget | nei | ja |
| Lenke til vedtaket | nei | ja |
| Sakens bakgrunn (avsnitt 1) | ja, i steg 7 | ja |
| Vedtaksavsnittet | første setning («Det vises til … vedtak i sak … av …») | ja |
| Resten av brevet, Word | nei | ja |

- `forhandsvisning` (`src/lib/brev/brev.ts`) beholder bare første setning av vedtaksavsnittet (`forsteSetning` i `mal.ts`), uten lenke; resten er bare en lengde, så teksten sendes aldri.
- `finnVedtak` sender ikke avsnittet eller lenken til nettleseren. Det forsegles med AES-256-GCM (`src/app/sak/signatur.ts`); nettleseren ser bare nivå, saksnummer og dato, og `byggBrevet` åpner forseglingen. Forhåndsvisningen og det betalte brevet bygger derfor på samme vedtak.
- Steg 7 viser også advarslene (med «Endre») og oppsummeringen av opplysningene i brevet, sammenslått under «Se over opplysningene i brevet».

## Betaling

Vipps er ikke koblet på. Knappene «Betal med Vipps» og «Betal med kort» er grå («kommer»). I utvikling, med `TVISTR_HELT_BREV_UTEN_BETALING=1`, simulerer «Betal med Vipps» betalingen: skjemaet lager en ordre-id (`tvistr:ordre`), og `hentProfil` gir stub-profilen bare når det finnes en ordre-id.

## Måling

Hendelser per økt, uten persondata (`src/lib/maling.ts`, `POST /api/hendelse`, tabellen `hendelse`): `landing`, `regnr_ok`, `steg2_ferdig`, `steg3_ferdig`, `vurdering_vist` (med status), `fortsett_klikket`, `steg7_vist`, `betaling_startet`, `betaling_fullfort`, `brev_lastet_ned`. Økt-id er en tilfeldig UUID i `sessionStorage`. Bare status og kategorier («motor.turbo») lagres; serveren forkaster alt annet. I utvikling sendes `landing` to ganger (React strict mode).

```sql
-- frafall per steg, og konvertering per status
select hendelse, count(distinct okt) from hendelse group by 1;
select v.status, count(distinct v.okt) vist, count(distinct b.okt) betalt
from hendelse v left join hendelse b on b.okt = v.okt and b.hendelse = 'betaling_fullfort'
where v.hendelse = 'vurdering_vist' group by 1;
```

## Tester og målinger

- `src/lib/vurdering/vurdering.test.ts`: status per gren, «fristen er ute» uten betaling, lovlinjene (snapshot), tall under 5, tellingen, kortene uten sitater og lenker, ingen modell i steg 4, og forbudte ord («vinne», «sannsynlig», «garanter», «svak» som stamme, brevets forsterkere) i alle tekster før muren, også advarslene (`riktighet.ts`, `tidslinje.ts`, `skjema.tsx`).
- `src/lib/vurdering/gylne.test.ts`: de tolv simulerte sakene mot `__fixtures__/forventet.json` (satt fra reglene før kjøringen) og `__fixtures__/gylne.json` (`npm run vurdering:gylne`, som også skriver skjermene til `docs/jurist-gjennomgang.md`).
- `src/lib/brev/brev.test.ts`: forhåndsvisningen har bare første setning av vedtaksavsnittet.
- `e2e/flyt.spec.ts` (Playwright, desktop og mobil): landing → steg 7 for hver status (samme overskrift ved `sak` og `svak`, og aldri ordet «svak» på siden), tid til vurdering, ett serverkall før steg 7, ingen sitater eller lenker, ingen sideveis rulling, og hele brevet og Word med dev-flagget.
- `npm run ferdig:vurdering`: tabellen mot en fersk telling.
