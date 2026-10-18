# Appen: forside, sjekk, vurdering og brev

Appen er en React-port av artefakten «Bilreklamasjon», som eieren bygde utenfor repoet (design: `docs/superpowers/specs/2026-10-16-ny-app-design.md`). Utseende, tekster og flyt følger artefakten. Unntakene er navnet (Tvistr), at bare bruktbil er med, og at frister og paragrafer følger lovversjonen.

## Sidene

| Rute | Fil | Innhold |
|---|---|---|
| `/` | `src/app/page.tsx` | Forsiden. Antall vedtak leses fra `statistikk_kategori` ved bygging. |
| `/sak` | `src/app/sak/sjekk.tsx`, `resultat.tsx` | Gratis sjekk: ett spørsmål per skjerm (`sporsmal.ts`), deretter vurderingen og tilbudet. |
| `/sak/[id]` | `src/app/sak/[id]/page.tsx`, `skriver.tsx` | Brevet for en betalt sak, med fanene Skjema, Vurdering, Vedtak og Brevet. En ukjent id eller en sak som ikke er betalt gir 404. |
| `/brevet` | `src/app/brevet/page.tsx` | Hva brevet inneholder, i ord (ikke et eksempelbrev). Lenket fra hero-kortet på forsiden. Hver påstand skal stemme med koden: rangeringen (`src/lib/matching`), sitatkontrollen (`src/lib/avgjorende`) og brevet (`src/lib/app/brev.ts`). |
| `/vilkar`, `/personvern` | `src/app/vilkar/page.tsx`, `src/app/personvern/page.tsx` | Vilkår for kjøp og personvernerklæringen, i `Juridisk` (`src/app/deler/juridisk.tsx`). Hver påstand der skal stemme med koden; endres lagring, modellkall eller betaling, endres sidene. |
| `/hvis-forhandleren-avviser` | `src/app/hvis-forhandleren-avviser/page.tsx` | Hva kjøperen kan gjøre hvis forhandleren avviser: mekling hos Forbrukertilsynet, Forbrukerklageutvalget, konkurs og namsmannen, i `Juridisk`. Lenket fra Brevet-fanen. Bare påstander fra Forbrukertilsynets sider; gebyrene følger rettsgebyret og må oppdateres hvert år. |

Sjekken og vurderingen ligger bare i nettleseren (`localStorage`: `tvistr-sjekk`, se `src/lib/app/lagring.ts`). En betalt sak ligger i databasen (`sak` og `ordre`, migrasjon 0017):
- `sak`: id-en, sjekken slik den var ved kjøpet, hele skjemaet og når saken ble betalt.
- `ordre`: ett betalingsforsøk per rad, med beløp i øre, leverandør, status, transaksjons-id og betalingstidspunkt.

Id-ene er 12 tegn fra `nyId()` (`src/lib/sak/id.ts`, 32 tegn uten 0/o/1/l). Lenken er tilgangen: den som har den, ser saken. Nettleseren husker bare siste kjøp (`tvistr-sak`: id, reg.nr. og feil, `useKjopt`). Tabellene har persondata og holdes utenfor `db:backup`.

Sletting (`src/lib/sak/sletting.ts`, fristene i `lagringstid.ts`): en betalt sak slettes 3 år etter betalingen, en ubetalt 30 dager etter at den ble opprettet. Ordrene følger saken (cascade); regnskapet har betalingene. Vercel Cron kaller `/api/slett-saker` hver natt kl. 03 (`vercel.json`), med `CRON_SECRET` som bearer-token. Uten `CRON_SECRET` i Vercel svarer ruten 401 og sletter ingenting, og da holder ikke personvernerklæringen.

Bunnteksten (`src/app/deler/bunn.tsx`) viser selskapet fra `src/lib/firma.ts` og lenker til vilkårene og personvernerklæringen. Kjøpsvinduet lenker til begge.

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

Vipps er ikke koblet på. «Gå til betaling» kaller `kjop` (`src/app/sak/[id]/actions.ts`).

**Prøveperioden (fra 2026-10-17):** `GRATIS = true` i `src/lib/pris.ts`. Brevet er gratis for alle, også i produksjon:
- Knappen heter «Åpne brevet», og det er ingen kryssboks. Ingenting selges, så det er ingen angrerett å gi fra seg.
- `kjop` lagrer saken som betalt med en ordre fra leverandøren «gratis» på 0 kr. Flagget og `samtykke` betyr ingenting.
- Pris, Vipps og angrerett er skjult bak `GRATIS` i tilbudet, forsiden, vilkårene og personvernerklæringen.
- Settes `GRATIS = false`, gjelder reglene under.

- Knappen virker først når kjøperen har krysset av for at brevet åpnes med en gang og at angreretten da går tapt (angrerettloven § 22 bokstav n). `kjop` avviser kjøpet uten `samtykke: true`.
- Med `TVISTR_HELT_BREV_UTEN_BETALING=1` (bare utenom produksjon) lagres saken som betalt med én gang, med en ordre fra leverandøren «utvikling». Kjøperen sendes til `/sak/[id]`.
- Ellers sier den at betaling ikke er koblet til ennå, og ingenting lagres.
- Skjemaet fylles fra sjekken på serveren (`nyttKjop` og `fraSjekk` i `src/lib/app/saken.ts`). Kjøperens navn og adresse hentes fra forrige betalte sak i samme nettleser.

Når Vipps kobles på:
1. `kjop` lagrer saken med `betalt` null og en ordre med status «opprettet», og svarer med Vipps-adressen. `ordre.id` er referansen til Vipps.
2. Vipps' tilbakekall setter `ordre.status`, `transaksjon_id` og `betalt` på ordren og på saken.
3. Et nytt forsøk gir en ny ordre for samme sak.

## Brevet

Et kjøp gjelder én bil og feilene som er valgt i sjekken (område og underkategori):
- Før betaling må sjekken ha registreringsnummer, merke og modell, og minst én feil (`manglerForKjop` i `src/lib/app/saken.ts`).
- I brevet er bilen låst (registreringsnummer, merke, modell og årsmodell) og feilvalgene låst. Sjekken krever derfor bilen før betaling: hentet fra Vegvesen eller skrevet inn. Km-stand, datoer, beskrivelser, verksted og krav kan fortsatt endres. Understellsnummer er ikke med.
- Velger kjøperen en annen bil eller feil i sjekken etter betaling, sier tilbudet at det krever et nytt kjøp (`sammeSak`). Et nytt kjøp starter et nytt brev og beholder bare kjøperens navn og adresse (`nyttKjop`).
- Låsen håndheves på serveren. `lagreSak` beholder de låste feltene slik de ble kjøpt (`LAASTE_FELT`, `laas`). `finnVedtak` avviser svar om en annen årsmodell eller andre feil enn saken (`gjelderSaken`).
- Skjemaet lagres i saken mens kjøperen skriver (`useAutolagring` i `src/app/sak/[id]/autolagring.ts`):
  - Det lagres etter en pause på 0,8 sekunder, og med én gang når siden skjules.
  - Feiler lagringen, prøves den igjen etter fem sekunder.
  - Den som forlater siden med endringer som ikke er lagret, får spørsmål først.
  - Toppen viser «Lagret», «Lagrer …» eller «Ikke lagret, prøver igjen».
- Siden fletter det lagrede skjemaet over dagens standardverdier (`rensSkjema`). En sak som ble lagret før et nytt felt kom til, kan derfor fortsatt åpnes.

Stegene er Deg, Forhandleren, Bilen, Kjøpet, Feilen, Verksted og vedlegg, Kontakt med selger og Kravet (`src/app/sak/[id]/steg.ts`). «Endre» i Vurdering-fanen og «Fyll ut» i sjekklisten går til riktig steg (`stegFor`). Forhandleren søkes opp i Enhetsregisteret (`/api/firma`). Vurdering-fanen regner ut vurderingen på nytt mens kjøperen skriver, og har «Endre»-lenker til steget som påvirker den.

Brevet bygges i nettleseren av `byggBrev` (`src/lib/app/brev.ts`). Manglende svar vises som grå plassholdere, og «Kopier brevet» bruker samme blokker (`tilTekst`).
- Formodningen nevnes per feil: bare for feilene innenfor perioden, og femårsregelen bare for feil mellom to og fem år.
- Brevet sier at reklamasjonen er rettidig bare når den er innen to måneder etter oppdagelsen og innen fem år. Ellers sier det ingenting om det.
- Brevet er satt som et juristbrev: én skrift, fete overskrifter i brødtekststørrelse («Mangelen», «Rettslig grunnlag», «Praksis fra Forbrukerklageutvalget», «Krav», «Vedlegg»), ingen innrykk eller farger, og vedleggslisten etter underskriften. Tidsrom skrives med ord opp til tolv («tre måneder»).
- Etter malens avsnitt om vedtaket legger brevet til sin egen slutning (`slutning` i `brev.ts`), utenfor det ferdigkriteriene måler: nivå A «samme type feil», nivå B «samme rettslige spørsmål»; «ikke i et svakere utgangspunkt» bare når km, alder og «som den er» i `treff` alle er like eller i kjøperens favør; «fikk medhold i …, som er det jeg krever» bare når vedtakets `utfall` har kjøperens krav; og en avslutning som i bestemt tone sier «minst like sterkt» bare når utgangspunktet kunne sies.
- Heving begrunnes av svarene (`hevingsgrunner`): anslått utbedringskostnad mot kjøpesummen (bare fra 5 %), rettingsforsøk (før 2024: to forsøk på samme feil, gamle § 30 annet ledd; fra 2024: ett, og kjøperen kan avvise videre retting, § 30 fjerde ledd), bilen kan ikke brukes, sikkerhet, verkstedet fraråder bruk, og selgerens løfte. Uten grunner står setningen «Mangelen er ikke uvesentlig» alene. Fra 2024 sier brevet også at det er selgeren som har bevisbyrden for at mangelen er uvesentlig (§ 32).
- Selgerens rett til å rette (§ 29 tredje ledd), som i Forbrukerrådets mal («dere har rett til å undersøke feilen og reparere»): Er heving eller prisavslag hovedkravet og selgeren ikke har brukt opp forsøkene, sier brevet at selgeren kan tilby retting, før 2024 bare «uten opphold». Retting må da skje uten kostnad, uten vesentlig ulempe og innen rimelig tid (§ 30 første ledd), ellers står kravet fast. Ved heving står da «jeg krever å heve kjøpet», ikke «jeg hever». Fra 2024 kreves heving eller prisavslag med en gang, med lovens ord fra § 29 tredje ledd tredje punktum, når svarene viser alvor: bilen kan ikke brukes, sikkerheten er rammet, eller verkstedet fraråder bruk. Alle brev med krav sier at bilen kan stilles til rådighet for undersøkelse, fra 2024 med § 30 annet ledd.
- Lånebil: før 2024 en rett når rettingen tar mer enn en uke og kravet er rimelig (gamle § 30 tredje ledd). Fra 2024 er det et moment i om rettingen skjer uten vesentlig ulempe (§ 30 første ledd annet punktum).
- Unntaket fra formodningen («uforenlig med varens eller mangelens art», § 18 annet ledd) besvares når verkstedrapporten sier at feilen ikke er normal slitasje.
- Forhandlerens svar (`f_prior_svar`, valgene i `SVAR`) bygger på Forbrukerrådets «vanlige spørsmål og svar». Hvert svar får et motsvar i «Rettslig grunnlag» (`svarPaInnvendinger`):
  - Produsent eller importør: § 26 og § 35.
  - Reparasjon mot betaling: uten kostnad, § 30 første ledd.
  - Garantien er utløpt: § 18 a fjerde ledd.
  - For sent: lovens frister i § 27, bare når brevet ikke alt har slått fast at reklamasjonen er rettidig.
  - Slitasje: bare innenfor formodningen eller med verkstedrapport.
  - «Som den er»: forbeholdsavsnittet. De to valgfrie feltene `k_forsok` og `k_cost` står i steget Kravet; `k_forsok` går også til rangeringen (`forsok` i `tilSvar`), som dermed kan treffe det rettslige poenget «tapt retting».
- Renter: ved heving kreves renter etter forsinkelsesrenteloven på kjøpesummen, jf. fkjl. § 50 annet ledd, fra reklamasjonsdagen bare for kjøp fra 2024 (`RENTER_FRA_REKLAMASJON` i `paragrafer.ts`; startdagen er kontrollert mot lovteksten bare for gjeldende lov). Prisavslag og erstatning får «ved forsinket betaling kreves forsinkelsesrente etter forsinkelsesrenteloven § 2», uten å si når renten starter.
- Vedleggslisten kommer fra `vedlegg(s)`: det kjøperen huket av, pluss verkstedrapporten når brevet sier at den følger vedlagt, og «Kvitteringer for utgifter» når erstatningskravet har utgifter.
- Brevet-fanen lenker under sjekklisten til siden `/hvis-forhandleren-avviser` (åpnes i ny fane).
- Mens vedtaket hentes, står en plassholder der avsnittet skal stå, og «Kopier brevet» venter.
- Sjekklisten viser datoer som ikke kan stemme (`datoavvik` i `src/lib/app/datoer.ts`): kjøp etter overtakelse, datoer frem i tid, feil oppdaget før overtakelsen, reklamasjon før oppdagelsen, brev datert før reklamasjonen og mer enn fem år siden overtakelsen. Avsnittet om vedtaket er Tvistrs: `finnVedtak` (rangering, ett Sonnet-kall, malen i `mal.ts`) gir modellens valg («Anbefalt») først og deretter resten av rangeringens topp 10, hvert med en likhetsprosent (`src/lib/matching/likhet.ts`). Kjøperen velger blant dem i fanen Vedtak (`vedtaksfane.tsx`), og Brevet viser hvilket som brukes. Vedtakene hentes bare når fanen Vedtak eller Brevet er åpen. `finnVedtak` svarer bare for en betalt sak. Valget lagres på saken, så samme svar gir aldri nytt modellkall. Endrer kjøperen svarene slik at listen blir en annen, viser fanene en melding om det. Meldingen sier hvor mange vedtak som er nye, hvilket vi anbefaler nå og hva brevet viser til. Nye vedtak er merket «Ny». Brevet følger det anbefalte, med mindre kjøperen har valgt et annet selv som fortsatt er med (se `docs/vedtaksvalg.md`).

## Lovforståelse og Forbrukerrådet

Brevet og vurderingen er sammenlignet med Forbrukerrådets klagebrevmal («Klage på kvalitet»), klageguiden og bilsidene, med Forbrukertilsynets sider om mekling og Forbrukerklageutvalget, og med lovteksten (Lovdata og Prop. 49 LS, 2026-10-18). Der guiden er upresis, følger vi lovteksten:
- Femårsfristen gjelder reklamasjonen, ikke når feilen viste seg (§ 27 annet ledd). Bilsiden sier «feil som viser seg».
- Fra 2024 er regelen om at kjøperen ikke kan påberope seg noe hen «kjente eller måtte kjenne til» (gamle § 16 tredje ledd), opphevet. Bare et avtalt unntak etter § 15 annet ledd stenger. Det kjøperen visste, teller fortsatt for hva hen kunne forvente. Bilsiden gjengir den gamle regelen. Vurderingen gir derfor gult, ikke rødt, for en kjent eller synlig feil ved kjøp fra 2024.
- Om rettingsforsøk sier guiden både «én gang» og «to ganger». Loven sier to før 2024 og ett fra 2024.

Omlevering er ikke et krav kjøperen kan velge. Ingen vedtak i databasen ga kjøperen en annen bil, og de tre som er registrert med omlevering, gjelder tilbehør som manglet. En lagret sak med omlevering åpnes med retting (`rensSkjema`). Ordlistene for vedtaksdataene har fortsatt `omlevering`.

Ikke med ennå: salg der en forhandler solgte for en privatperson (fkjl. § 1 annet ledd gjør det til forbrukerkjøp), og spørsmålet om bilen er reparert et annet sted før forhandleren fikk rette.

## Måling

`src/lib/maling.ts`: landing, sjekk_startet, resultat_vist (med nivå og kategorier), kjop_klikket, betaling_fullfort og brev_kopiert. Det lagres ingen persondata.

## Tester

- `npm test`: vurderingen per nivå og lovversjon, brevet (eksempelbrevet som snapshot, plassholdere og lovversjon), oversettelsen til rangeringen, `kjop`, `lagreSak` og `finnVedtak` (uten betalt sak, andre feil enn saken), låsen og id-ene, topp 10 (`alternativer`), likheten og lagringen.
- `npx playwright test` (`e2e/flyt.spec.ts`): hele flyten på desktop og mobil, mot databasen og modellen. Testen sjekker også at lenken til saken åpner det lagrede skjemaet i en annen nettleser, og at en ukjent id og `/brev` gir 404. Krever `TVISTR_HELT_BREV_UTEN_BETALING=1`. Hver kjøring lagrer en testsak i `sak`.
