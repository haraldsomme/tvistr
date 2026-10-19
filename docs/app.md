# Appen: forside, sjekk, vurdering og brev

Appen er en React-port av artefakten «Bilreklamasjon», som eieren bygde utenfor repoet (design: `docs/superpowers/specs/2026-10-16-ny-app-design.md`). Utseende, tekster og flyt følger artefakten. Unntakene er navnet (Tvistr), at bare bruktbil er med, og at frister og paragrafer følger lovversjonen.

## Sidene

| Rute | Fil | Innhold |
|---|---|---|
| `/` | `src/app/page.tsx` | Forsiden. Antall vedtak leses fra `statistikk_kategori` ved bygging. |
| `/sak` | `src/app/sak/sjekk.tsx`, `resultat.tsx` | Gratis sjekk: ett spørsmål per skjerm (`sporsmal.ts`), deretter vurderingen og tilbudet. |
| `/sak/[id]` | `src/app/sak/[id]/page.tsx`, `skriver.tsx` | Brevet for en betalt sak, med fanene Skjema, Vurdering, Vedtak og Brevet. En ukjent id eller en sak som ikke er betalt gir 404. Er brukeren ikke innlogget, sendes hun til `/logg-inn?til=/sak/<id>`; er hun innlogget som en annen enn eieren, vises «annen konto» (`annen-konto.tsx`) uten å si noe om saken. |
| `/brevet` | `src/app/brevet/page.tsx` | Hva brevet inneholder, i ord (ikke et eksempelbrev). Lenket fra hero-kortet på forsiden. Hver påstand skal stemme med koden: rangeringen (`src/lib/matching`), sitatkontrollen (`src/lib/avgjorende`) og brevet (`src/lib/app/brev.ts`). |
| `/min-side` | `src/app/min-side/` | Sakene til den innloggede (`sak.vipps_sub`), nyeste først, og «Logg ut». Uten innlogging sendes brukeren til `/logg-inn`. |
| `/logg-inn`, `/logg-inn/vipps`, `/logg-inn/feil` | `src/app/logg-inn/` | Innlogging med Vipps Login (OIDC med PKCE). `/logg-inn?til=/sak/<id>` starter og husker hvor brukeren skal etterpå; `/logg-inn/vipps` er tilbakekallet fra Vipps og lager økten; `/logg-inn/feil` forklarer når det ikke gikk. Utlogging er serverhandlingen `loggUtHandling` (`src/app/min-side/actions.ts`), som sletter økten og kapslene. |
| `/betaling/[ref]` | `src/app/betaling/[ref]/` | Retursiden fra Vipps: venter på svaret og viser bekreftelsen («Takk for handelen!», lenken til saken, om kjøperen er innlogget, neste steg og kvitteringen), med «Fortsett til brevet» (se «Betaling»). |
| `/vilkar`, `/personvern` | `src/app/vilkar/page.tsx`, `src/app/personvern/page.tsx` | Vilkår for kjøp og personvernerklæringen, i `Juridisk` (`src/app/deler/juridisk.tsx`). Hver påstand der skal stemme med koden; endres lagring, modellkall eller betaling, endres sidene. |
| `/hvis-forhandleren-avviser` | `src/app/hvis-forhandleren-avviser/page.tsx` | Hva kjøperen kan gjøre hvis forhandleren avviser: mekling hos Forbrukertilsynet, Forbrukerklageutvalget, konkurs og namsmannen, i `Juridisk`. Lenket fra Brevet-fanen. Bare påstander fra Forbrukertilsynets sider; gebyrene følger rettsgebyret og må oppdateres hvert år. |

Sjekken og vurderingen ligger bare i nettleseren (`localStorage`: `tvistr-sjekk`, se `src/lib/app/lagring.ts`). En betalt sak ligger i databasen (`sak` og `ordre`, migrasjon 0017):
- `sak`: id-en, sjekken slik den var ved kjøpet, hele skjemaet og når saken ble betalt.
- `ordre`: ett betalingsforsøk per rad, med beløp i øre, leverandør, status, transaksjons-id og betalingstidspunkt.

Id-ene er 12 tegn fra `nyId()` (`src/lib/sak/id.ts`, 32 tegn uten 0/o/1/l). Lenken er ikke tilgangen: eieren av saken er Vipps-`sub` fra betalingen (`sak.vipps_sub`, satt ved betaling), og bare den som er innlogget med den kontoen, åpner saken (`hentEgenSak` i `src/lib/sak/db.ts`). Økten er en informasjonskapsel `tvistr_okt` (httpOnly, 90 dager) med en tilfeldig kode; tabellen `innlogging` har bare SHA-256 av koden, `sub` og utløpstid. `tvistr_inne` er en lesbar merkelapp som sier at nettleseren har logget inn før. Nettleseren husker siste kjøp (`tvistr-sak`: id, reg.nr. og feil, `useKjopt`). Tabellene har persondata og holdes utenfor `db:backup`.

Sletting (`src/lib/sak/sletting.ts`, fristene i `lagringstid.ts`): en betalt sak slettes 3 år etter betalingen, en ubetalt 30 dager etter at den ble opprettet. Ordrene følger saken (cascade); regnskapet har betalingene. Samme nattjobb sletter utløpte økter (`innlogging.utloper`) og påbegynte innlogginger eldre enn 10 minutter (`innlogging_start`) med `slettUtlopteInnlogginger`. Vercel Cron kaller `/api/slett-saker` hver natt kl. 03 (`vercel.json`), med `CRON_SECRET` som bearer-token. Uten `CRON_SECRET` i Vercel svarer ruten 401 og sletter ingenting, og da holder ikke personvernerklæringen.

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

Brevet koster kr 249 (`PRIS` i `src/lib/pris.ts`) og betales med Vipps MobilePay (ePayment API, `src/lib/vipps/`). Prøveperioden med gratis brev (`GRATIS`) varte fra 2026-10-17 til 2026-10-19. Står `GRATIS = true`, heter knappene «Åpne brevet», saken lagres som betalt med en ordre «gratis» på 0 kr, og pris, Vipps og angrerett er skjult i tilbudet, forsiden, vilkårene og personvernerklæringen.

**Flyten:**
1. I tilbudsboksen og i bunnlinjen på mobil står Vipps' egen knapp «Betal med Vipps» (`src/app/deler/vipps-knapp.tsx`, skriptet fra `cdn.vippsmobilepay.com`; knappen skal ikke tegnes om). Den åpner kjøpsvinduet (`src/app/deler/kjop.tsx`).
2. I kjøpsvinduet virker knappen først når kjøperen har krysset av for at brevet åpnes med en gang og at angreretten da går tapt (angrerettloven § 22 bokstav n). `kjop` avviser kjøpet uten `samtykke: true`.
3. Har den innloggede alt en betalt sak med samme reg.nr. og feil, svarer `kjop` med lenken til den saken og tar ikke betalt igjen. Sjekken holder også Vipps-knappen tilbake mens den henter den innloggedes saker (`mineKjop`). Ellers lagrer `kjop` (`src/app/sak/[id]/actions.ts`) saken med `betalt` null og en ordre «opprettet» fra «vipps» på 24 900 øre. `ordre.id` er referansen hos Vipps. Deretter oppretter den betalingen (`WALLET`, `WEB_REDIRECT`) med `returnUrl` `/betaling/<ordre.id>` på samme vert som forespørselen, og ber om profildeling (`PROFIL` i `klient.ts`: navn, e-post, telefon og adresse). Kjøperen godkjenner delingen i appen før betalingen. `kjop` svarer med adressen kjøperen skal til (`url`). Nettleseren åpner Vipps' side uendret. Svarer ikke Vipps, blir ordren «feilet» og kjøperen kan prøve igjen.
4. Vipps sender kjøperen til `/betaling/[ref]` (`src/app/betaling/[ref]/`), kanskje i en annen nettleser. Siden spør serveren (`sjekkBetaling`) hvert annet sekund i ett minutt. Er saken betalt, viser siden bekreftelsen: lenken til saken med «Kopier», om kjøperen er innlogget («Du er logget inn …») eller må logge inn med Vipps, neste steg og kvitteringen. Kjøperen blir eier av saken og logges inn med `sub` fra betalingen, med en engangshemmelighet på retursiden (`ordre.innlogging_hash`). Bare eieren, innlogget, får saken i svaret: bil, reg.nr. og feil (lagret i `tvistr-sak`) og hvor lenken er sendt (maskert, `k***@gmail.com`). Alle andre med ordrenummeret ser bare at ordren er betalt, beløp, dato og «Logg inn med Vipps». «Fortsett til brevet» går til `/sak/[id]`. Er betalingen avbrutt eller utløpt, får kjøperen prøve igjen fra `/sak`.
5. Et nytt forsøk gir en ny sak. En sak som aldri blir betalt, slettes etter 30 dager.

**Avstemming** (`avstem` i `src/lib/vipps/avstem.ts`) er det eneste som flytter en Vipps-ordre fra «opprettet». Den spør alltid Vipps (`GET /epayment/v1/payments/{ref}`) og stoler aldri på nettleseren eller webhooken:
- `AUTHORIZED`: capture med en gang. Brevet er digitalt innhold som leveres straks, og ePayment har ikke direkte capture. Først når capture har gått gjennom, blir ordren «betalt» med `transaksjon_id` (pspReference), og saken får `betalt`. Feiler capture, forblir ordren «opprettet», og neste kall prøver igjen.
- `ABORTED`, `EXPIRED`, `TERMINATED` eller en kansellert betaling: ordren blir «avbrutt».
- Den tåler å kjøres flere ganger samtidig. Capture har en fast `Idempotency-Key` (`<ref>-capture`), og oppdateringene skjer med vilkår i én `db.batch`.
- Bare kallet som gjør ordren betalt (`.returning()`), fyller kjøperen fra Vipps inn i skjemaet (`fyllKjoper` i `src/lib/vipps/kjoper.ts`: bare tomme felt, adressen bare samlet) og sender kvitteringen.

**Kvitteringen** (`src/lib/epost/kvittering.ts`) går på e-post med Resend (EU-region, avsender `kvittering@tvistr.no`, svar til `hei@tvistr.no`) til adressen kjøperen delte i Vipps. Den har lenken til saken (knapp og ren lenke), en lenke til Min side og setningen om at saken åpnes med Vipps-kontoen kjøperen betalte med, neste steg og kvitteringen: selger med org.nr., dato, ordrenummer, vare, beløp, at foretaket ikke er mva-registrert, og at angreretten gikk tapt. Den sendes én gang per ordre: `ordre.kvittering_sendt` (migrasjon 0019) settes før sendingen og nullstilles hvis den feiler, og Resend får `Idempotency-Key: kvittering-<ref>`. Nattjobben sender kvitteringer som mangler, for ordrer betalt de siste 7 dagene; adressen hentes da fra Vipps igjen og lagres ikke utenfor skjemaet. Kvitteringen er aldri brevet; det sender kjøperen selv.

Tre veier kaller den: retursiden, webhooken `POST /api/vipps` (signaturen sjekkes med `VIPPS_WEBHOOK_SECRET`, se `src/lib/vipps/signatur.ts`) og nattjobben `/api/slett-saker`. Nattjobben tar Vipps-ordrer som fortsatt er «opprettet» etter 15 minutter (`src/lib/vipps/uavklart.ts`).

**Oppsett** (`.env.example`): `VIPPS_BASE_URL` (standard `https://apitest.vipps.no`; `https://api.vipps.no` i produksjon), `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET`, `VIPPS_SUBSCRIPTION_KEY`, `VIPPS_MERCHANT_SERIAL_NUMBER` og `VIPPS_WEBHOOK_SECRET`. Mangler nøklene, svarer `kjop` at betaling ikke er tilgjengelig, og ingenting lagres. For e-posten: `RESEND_API_KEY`, `EPOST_FRA` og `TVISTR_URL` (lenken i e-posten; webhooken vet ikke kjøperens vert). Uten `RESEND_API_KEY` sendes ingen kvittering, og betalingen går som før. Innloggingen bruker de samme `VIPPS_CLIENT_ID` og `VIPPS_CLIENT_SECRET`; redirect-URI-ene `<TVISTR_URL>/logg-inn/vipps` (og `http://localhost:3000/logg-inn/vipps` og `http://localhost:3001/logg-inn/vipps` for utvikling og produksjonsbygget lokalt) registreres i Vipps' utviklerportal. `EPOST_TEST_TIL` sender alle kvitteringer til utvikleren, men bare mens Vipps kjører mot testmiljøet, der testbrukerens e-post ikke er ekte.

**Kundestøtte** (`scripts/vipps.ts`):
- `npm run vipps -- webhook <https://vert/api/vipps>` registrerer webhooken for authorized, aborted, expired, terminated, captured, cancelled og refunded. Hemmeligheten i svaret legges i `VIPPS_WEBHOOK_SECRET`.
- `webhooker` lister webhookene.
- `status <ref>` viser betalingen og hendelsesloggen.
- `avstem <ref>` avstemmer én ordre.
- `refunder <ref>` refunderer hele beløpet og setter ordren til «refundert». Saken forblir åpen.
- `kanseller <ref>` kansellerer en betaling som ikke er tatt capture på.

**Utvikling:** Med `TVISTR_HELT_BREV_UTEN_BETALING=1` (bare utenom produksjon) går Vipps-knappen rett til bekreftelsen uten Vipps, med en betalt ordre fra «utvikling» og uten e-post. Saken får eieren «utvikling» (`UTVIKLINGSEIER`), og bekreftelsen logger nettleseren inn som den. En økt for «utvikling» gjelder bare i utvikling: i produksjon gir `innlogget` null for den, og retursiden logger aldri inn som den. Den e2e-testen trenger dette. For å prøve Vipps lokalt fjerner du flagget. Den hele runden med webhook krever en offentlig `https`-adresse, for eksempel en preview på Vercel. Betalingen godkjennes i testappen Vipps MT.

Skjemaet fylles fra sjekken på serveren (`nyttKjop` og `fraSjekk` i `src/lib/app/saken.ts`). Kjøperens navn og adresse hentes fra den innloggedes nyeste betalte sak.

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

`src/lib/maling.ts`: landing, sjekk_startet, resultat_vist (med nivå og kategorier), kjop_klikket, betaling_fullfort (fra retursiden `/betaling/[ref]`, eller fra kjøpsvinduet uten Vipps) og brev_kopiert. Det lagres ingen persondata.

## Tester

- `npm test`: Vipps-avstemmingen, webhook-signaturen og kjøperen fra Vipps (`src/lib/vipps/*.test.ts`), kvitteringen (`src/lib/epost/kvittering.test.ts`), vurderingen per nivå og lovversjon, brevet (eksempelbrevet som snapshot, plassholdere og lovversjon), oversettelsen til rangeringen, `kjop`, `lagreSak` og `finnVedtak` (uten betalt sak, andre feil enn saken), låsen og id-ene, topp 10 (`alternativer`), likheten og lagringen.
- `npx playwright test` (`e2e/flyt.spec.ts`): hele flyten på desktop og mobil, mot databasen og modellen. Testen sjekker også at en ukjent id og `/brev` gir 404. Krever `TVISTR_HELT_BREV_UTEN_BETALING=1` for dev-serveren, slik at Vipps-knappen åpner saken uten appen. Tester for innloggingen ligger i `src/lib/innlogging/*.test.ts` (økt, flyt, Vipps Login), `src/lib/sak/db.test.ts` (`hentEgenSak`) og kvitteringen. Selve betalingen og Vipps-innloggingen prøves for hånd mot testmiljøet. Hver kjøring lagrer en testsak i `sak`.
