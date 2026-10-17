# Appen: forside, sjekk, vurdering og brev

Appen er en React-port av artefakten «Bilreklamasjon», som eieren bygde utenfor repoet (design: `docs/superpowers/specs/2026-10-16-ny-app-design.md`). Utseende, tekster og flyt følger artefakten. Unntakene er navnet (Tvistr), at bare bruktbil er med, og at frister og paragrafer følger lovversjonen.

## Sidene

| Rute | Fil | Innhold |
|---|---|---|
| `/` | `src/app/page.tsx` | Forsiden. Antall vedtak leses fra `statistikk_kategori` ved bygging. |
| `/sak` | `src/app/sak/sjekk.tsx`, `resultat.tsx` | Gratis sjekk: ett spørsmål per skjerm (`sporsmal.ts`), deretter vurderingen og tilbudet. |
| `/brev` | `src/app/brev/skriver.tsx` | Brevskriveren med fanene Skjema, Vurdering, Vedtak og Brevet. Krever betaling, ellers sendes kjøperen til `/sak`. |

Svarene ligger bare i nettleseren (`localStorage`: `tvistr-sjekk`, `tvistr-skjema`, `tvistr-ordre`, se `src/lib/app/lagring.ts`). Ingenting om saken lagres på serveren.

## Sjekken

Spørsmålene er artefaktens, uten «ny eller brukt». Selger privat, leasing eller kjøp i næring gir resultatet «Utenfor det vi dekker». Bilen hentes fra Statens vegvesen (`/api/kjoretoy`), og overtakelsesdatoen starter som datoen bilen ble registrert på eieren. Kilometerstand er valgfri. Feilene er Tvistrs kategorier (`src/lib/feil/kategorier.ts`): område, så underkategorier, så én dato per område.

## Vurderingen

`evaluate()` (`src/lib/app/vurdering.ts`) gir sterk, mulig, svak eller utenfor ut fra svarene, med en rad per forhold under «Dette sier loven om din sak». Formodningsperioden er seks måneder for kjøp før 1.1.2024 og to år etter. «Som den er» vurderes etter gamle § 17 før 2024 og § 15 annet ledd etter. Paragrafene kommer fra `src/lib/brev/paragrafer.ts` (`src/lib/app/lov.ts`).

Reglene for tid regnes i kalendermåneder fra overtakelsen, som i rangeringen (`tidsnivaFor`):
- Formodningen gjelder bare feil som viste seg innen perioden. Feil i det selgeren opplyste eller lovet (historikk, service, utstyr, garanti) fantes ved salget, så formodningen brukes ikke for dem.
- Etter fem år fra overtakelsen er fristen ute, også når feilen viste seg før.
- Uten datoer er vurderingen «Foreløpig». Er en dato frem i tid, trekkes ingen konklusjon om fristene; kjøperen bes sjekke datoene.

«Lignende saker» kommer fra databasen gjennom `vurderSaken` (`src/app/sak/vurdering.ts`, ingen modellkall). Den gir tallene for den første kategorien med nok vedtak, og de tre nærmeste vedtakene med medhold fra `ranger()`. Kortene viser bil, utfall, saksnummer og år. De er ikke lenker, og ingen sitater sendes før betaling.

## Betaling

Vipps er ikke koblet på. «Gå til betaling» kaller `lasOpp` (`src/app/brev/actions.ts`). Med `TVISTR_HELT_BREV_UTEN_BETALING=1` (bare utenom produksjon) gir den en ordre-id som regnes som betalt (`betalt()` i `src/lib/vipps/profil.ts`). Ellers sier den at betaling ikke er koblet til ennå. Når kjøperen låser opp, fylles skjemaet fra sjekken (`fraSjekk` i `src/lib/app/saken.ts`).

## Brevskriveren

Et kjøp gjelder én bil og feilene som er valgt i sjekken (område og underkategori):
- Før betaling må sjekken ha registreringsnummer, merke og modell, og minst én feil (`manglerForKjop` i `src/lib/app/saken.ts`).
- I brevskriveren er bilen låst (registreringsnummer, merke, modell og årsmodell) og feilvalgene låst. Sjekken krever derfor bilen før betaling: hentet fra Vegvesen eller skrevet inn. Km-stand, datoer, beskrivelser, verksted og krav kan fortsatt endres. Understellsnummer er ikke med.
- Velger kjøperen en annen bil eller feil i sjekken etter betaling, sier tilbudet at det krever et nytt kjøp (`sammeSak`). Et nytt kjøp starter et nytt brev og beholder bare kjøperens navn og adresse (`nyttKjop`).
- Låsen er i nettleseren. Når Vipps kobles på, bør ordren på serveren lagre bilen og feilene, og `finnVedtak` sjekke at svaret gjelder dem.

Stegene er Deg, Forhandleren, Bilen, Kjøpet, Feilen, Verksted og vedlegg, Kontakt med selger og Kravet (`src/app/brev/steg.ts`). «Endre» i Vurdering-fanen og «Fyll ut» i sjekklisten går til riktig steg (`stegFor`). Forhandleren søkes opp i Enhetsregisteret (`/api/firma`). Vurdering-fanen regner ut vurderingen på nytt mens kjøperen skriver, og har «Endre»-lenker til steget som påvirker den.

Brevet bygges i nettleseren av `byggBrev` (`src/lib/app/brev.ts`). Manglende svar vises som grå plassholdere, og «Kopier brevet» bruker samme blokker (`tilTekst`).
- Formodningen nevnes per feil: bare for feilene innenfor perioden, og femårsregelen bare for feil mellom to og fem år.
- Brevet sier at reklamasjonen er rettidig bare når den er innen to måneder etter oppdagelsen og innen fem år. Ellers sier det ingenting om det.
- Brevet er satt som et juristbrev: én skrift, fete overskrifter i brødtekststørrelse («Mangelen», «Rettslig grunnlag», «Praksis fra Forbrukerklageutvalget», «Krav», «Vedlegg»), ingen innrykk eller farger, og vedleggslisten etter underskriften. Tidsrom skrives med ord opp til tolv («tre måneder»).
- Etter malens avsnitt om vedtaket legger brevet til sin egen slutning (`slutning` i `brev.ts`), utenfor det ferdigkriteriene måler: nivå A «samme type feil», nivå B «samme rettslige spørsmål»; «ikke i et svakere utgangspunkt» bare når km, alder og «som den er» i `treff` alle er like eller i kjøperens favør; «fikk medhold i …, som er det jeg krever» bare når vedtakets `utfall` har kjøperens krav; og en avslutning som i bestemt tone sier «minst like sterkt» bare når utgangspunktet kunne sies.
- Heving begrunnes av svarene (`hevingsgrunner`): anslått utbedringskostnad mot kjøpesummen (bare fra 5 %), rettingsforsøk (to eller flere: selgeren har tapt retten til å rette, §§ 29 og 30), bilen kan ikke brukes, sikkerhet, verkstedet fraråder bruk, og selgerens løfte. Uten grunner står setningen «Mangelen er ikke uvesentlig» alene. De to valgfrie feltene `k_forsok` og `k_cost` står i steget Kravet; `k_forsok` går også til rangeringen (`forsok` i `tilSvar`), som dermed kan treffe det rettslige poenget «tapt retting».
- Renter: ved heving kreves renter etter forsinkelsesrenteloven på kjøpesummen, jf. fkjl. § 50 annet ledd, fra reklamasjonsdagen bare for kjøp fra 2024 (`RENTER_FRA_REKLAMASJON` i `paragrafer.ts`; startdagen er kontrollert mot lovteksten bare for gjeldende lov). Prisavslag og erstatning får «ved forsinket betaling kreves forsinkelsesrente etter forsinkelsesrenteloven § 2», uten å si når renten starter.
- Vedleggslisten kommer fra `vedlegg(s)`: det kjøperen huket av, pluss verkstedrapporten når brevet sier at den følger vedlagt.
- Mens vedtaket hentes, står en plassholder der avsnittet skal stå, og «Kopier brevet» venter.
- Sjekklisten viser datoer som ikke kan stemme (`datoavvik` i `src/lib/app/datoer.ts`): kjøp etter overtakelse, datoer frem i tid, feil oppdaget før overtakelsen, reklamasjon før oppdagelsen, brev datert før reklamasjonen og mer enn fem år siden overtakelsen. Avsnittet om vedtaket er Tvistrs: `finnVedtak` (rangering, ett Sonnet-kall, malen i `mal.ts`) gir modellens valg («Anbefalt») først og deretter resten av rangeringens topp 10, hvert med en likhetsprosent (`src/lib/matching/likhet.ts`). Kjøperen velger blant dem i fanen Vedtak (`vedtaksfane.tsx`), og Brevet viser hvilket som brukes. Vedtakene hentes bare når fanen Vedtak eller Brevet er åpen. `finnVedtak` svarer bare når ordren er betalt, og kalles én gang per sett med svar.

## Måling

`src/lib/maling.ts`: landing, sjekk_startet, resultat_vist (med nivå og kategorier), kjop_klikket, betaling_fullfort og brev_kopiert. Det lagres ingen persondata.

## Tester

- `npm test`: vurderingen per nivå og lovversjon, brevet (eksempelbrevet som snapshot, plassholdere og lovversjon), oversettelsen til rangeringen, `finnVedtak` uten betaling, topp 10 (`alternativer`), likheten og lagringen.
- `npx playwright test` (`e2e/flyt.spec.ts`): hele flyten på desktop og mobil, mot databasen og modellen. Krever `TVISTR_HELT_BREV_UTEN_BETALING=1`.
