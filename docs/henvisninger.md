# Henvisninger: vedtakene brevet viser til

Brevet og vurderingen viser til samme vedtak, valgt av `velgHenvisning` i `src/lib/vurdering/henvisninger.ts` fra listen `HENVISNINGER`. Denne filen sier hvordan vedtakene ble valgt og kontrollert, og hva som ble forkastet.

## Stigen

1. **Lignende sak:** samme feilgruppe og samme tidsrom fra kjøp til feilen viste seg, og en bil som ikke er mer enn fire år nyere enn kjøperens.
2. **Nærmeste lignende sak:** samme feilgruppe i nabotidsrommet (innen 6 måneder ↔ 6 måneder til 2 år ↔ mer enn 2 år).
3. **Samme regel:** en sak der utvalget la til grunn den regelen brevet bygger på: formodningsregelen, en rapport som viser at feilen var der ved levering, uriktige opplysninger, eller at bilen var dårligere enn kjøperen kunne forvente. Dette trinnet finnes alltid, så alle saker som loven ikke stopper, får en henvisning.

**Aldri vunnet på en fordel kjøperen mangler.** Endringene i forbrukerkjøpsloven fra 1. januar 2024 gjelder bare avtaler inngått etter den datoen (LOV-2023-06-16-60), og alle styrket kjøperen: formodningsregelen gikk fra 6 måneder til 2 år, og «som den er» virker ikke lenger (§ 15 andre ledd). En sak vunnet etter gammel lov holder derfor også etter ny lov, unntatt når kjøperen vant fordi formodningsregelen gjaldt og brukeren ikke har den. Derfor: ingen sak vunnet på formodningsregelen for en kjøper uten den, og ingen sak etter ny lov for kjøp før 2024. Basen har ennå ingen brukbare vedtak om kjøp etter 1.1.2024 (#3023 brukte toårsregelen, men forhandleren svarte ikke), så alle postene er etter gammel lov.

## Slik ble de valgt (oktober 2026)

1. **Kandidater:** `npm run henvisning-kandidater` hentet de ti nyeste vunne forhandlersakene (personbil og varebil, ikke merket for kontroll) for hver kombinasjon av feilgruppe, tidsrom og aldersgruppe (0–7 og 8+ år ved kjøpet), og for hvert regelgrunnlag: 70 lister.
2. **Utvelgelse:** tre uavhengige vurderere (agenter) leste kandidatene og valgte ett vedtak eller ingen per liste, etter kriteriene: kjøperen vant på akkurat denne feilen eller regelen; forhandleren svarte; vanlige mangelsregler, ikke garanti; tid og alder stemmer med teksten (databasens dager til reklamasjon var feil i flere saker); enstemmig og ikke «under tvil»; så nytt som mulig; gjenkjennelig bil og klart utfall. Flertallet var enige i 68 av 70 lister.
3. **Avgjørelse:** en fjerde agent avgjorde uenighetene, la hvert vedtak i bare én liste, og prøvde flertallsvalgene mot kriteriene på nytt (ni ble byttet ut eller satt til ingen). Regel-sakene ble valgt for seg, blant vedtak som ikke var brukt som lignende sak, med eldre biler slik at de passer alle kjøpere med samme grunnlag.
4. **Tekst og belegg:** en agent skrev setningene og et ordrett sitat for hver påstand (`scripts/henvisninger-belegg.json`).
5. **Kontroll:** en uavhengig agent sjekket hver påstand mot vedtaksteksten. Rettede poster ble kontrollert på nytt av en ny agent. To poster ble forkastet.
6. **Skript:** `npm run sjekk-henvisninger` sjekker id, forhandler, utfall, lenke, dato, ref, organ, lov, formodning, alder, alle tall i setningene og alle sitater mot databasen og vedtaksteksten. Det må gi 0 feil.

Brevet oppgir ikke beløp; setningen til kjøperen i vurderingen gjør det, uten renter og saksbehandlingsgebyr.

## Regel-saker

### Formodningsregelen (§ 18) (`regel/formodning`)

> I en sak om en 14 år gammel Volkswagen Tiguan kjøpt hos forhandler kom utvalget til at et motorhavari som viste seg om lag halvannen måned etter kjøpet, skyldtes forhold som måtte anses å ha vært der ved leveringen, fordi forhandleren ikke hadde sannsynliggjort noe annet.

- **Sak:** #1758 · FKU-2023-4974 · 2023-10-04 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023069233&dokid=993879&versjon=1&variant=A&)
- **Til kjøperen:** I 2023 fikk kjøperen av en Volkswagen Tiguan medhold etter å ha klaget på motorhavari om lag halvannen måned etter kjøpet. Utvalget kom til at kjøpet kunne heves.
- **Bil:** 14 år, 201 000 km · lov: før_2024

### Rapport viser at feilen var der ved levering (`regel/rapport`)

> I en sak om en 11 år gammel Mitsubishi Outlander kjøpt hos forhandler la utvalget vekt på en verkstedrapport om at store rustskader i bærende deler av understellet hadde kommet over tid og var der da kjøperen kjøpte bilen, og fant det sannsynliggjort at rusten kunne knyttes til leveringen, selv om den ble oppdaget først nesten åtte måneder etter kjøpet.

- **Sak:** #2694 · FKU-2021-4419 · 2021-10-13 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2021075274&dokid=489776&versjon=1&variant=A&)
- **Til kjøperen:** I 2021 fikk kjøperen av en Mitsubishi Outlander medhold etter å ha klaget på rust nesten åtte måneder etter kjøpet. Utvalget kom til at kjøpet kunne heves.
- **Bil:** 11 år, 186 000 km · lov: før_2024

### Uriktige opplysninger (§ 16) (`regel/opplysning`)

> I en sak om en 10 år gammel Ford S-max kjøpt hos forhandler kom utvalget til at bilen hadde en mangel fordi den ikke svarte til opplysningen i annonsen om at serviceheftet var komplett.

- **Sak:** #1992 · FKU-2022-2868 · 2023-03-22 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023006127&dokid=845007&versjon=1&variant=A&)
- **Til kjøperen:** I 2023 fikk kjøperen av en Ford S-max delvis medhold etter å ha klaget på uriktige opplysninger om servicehistorikken drøyt halvannet år etter kjøpet. Utvalget tilkjente 7 000 kr.
- **Bil:** 10 år, 106 500 km · lov: før_2024

### Dårligere enn kjøperen kunne forvente (§ 15) (`regel/forventning`)

> I en sak om en 16 år gammel Nissan Patrol med 191 397 km kjøpt hos forhandler kom utvalget til at omfattende rustskader var mer enn kjøperen måtte regne med ut fra alder og kilometerstand, selv om forhandleren hadde opplyst at bilen hadde rustskader.

- **Sak:** #2612 · FKU-2021-4203 · 2021-12-01 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2021095135&dokid=537047&versjon=1&variant=A&)
- **Til kjøperen:** I 2021 fikk kjøperen av en Nissan Patrol medhold etter å ha klaget på omfattende rustskader om lag halvannet år etter kjøpet. Utvalget kom til at kjøpet kunne heves.
- **Bil:** 16 år, 191 397 km · lov: før_2024

## Lignende saker

### Motor

**innen 6 måneder, 7 år gammel bil** (`motor/rask`)

> En BMW 316i som var 7 år gammel og hadde gått 136 400 km, ble kjøpt hos forhandler og fikk slakk i registerkjedet om lag to måneder etter kjøpet. Utvalget kom til at feilen med registerkjedet var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #3065 · FKU-2026-66298 · 2026-03-04 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-66298.pdf)
- **Til kjøperen:** I 2026 fikk kjøperen av en BMW 316i delvis medhold etter å ha klaget på motorfeil om lag to måneder etter kjøpet. Utvalget kom til at feilen med registerkjedet var en mangel og satte prisavslaget for den til 12 000 kr.

**innen 6 måneder, 12 år gammel bil** (`motor/rask`)

> En Toyota Avensis som var 12 år gammel og hadde gått 126 269 km, ble kjøpt hos forhandler og fikk startproblemer tre dager etter kjøpet. Utvalget kom til at startproblemene var en mangel forhandleren var ansvarlig for, og kjøperen fikk erstatning.

- **Sak:** #3127 · FKU-2025-61654 · 2025-11-11 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-61654.pdf)
- **Til kjøperen:** I 2025 fikk kjøperen av en Toyota Avensis delvis medhold etter å ha klaget på motorfeil tre dager etter kjøpet. Utvalget tilkjente 14 287 kr.

**6 måneder til 2 år, 5 år gammel bil** (`motor/middels`)

> En Renault Twizy som var fem år gammel og hadde gått 2 079 km, ble kjøpt hos forhandler og fikk påvist feil på elmotoren og girkassen om lag ni måneder etter kjøpet. Utvalget kom til at feilen på elmotoren og girkassen var en mangel forhandleren var ansvarlig for, og kjøperen fikk heving av kjøpet.

- **Sak:** #3086 · FKU-2026-104368 · 2026-02-02 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-104368.pdf)
- **Til kjøperen:** I 2026 fikk kjøperen av en Renault Twizy medhold etter å ha klaget på motorfeil om lag ni måneder etter kjøpet. Utvalget kom til at kjøperen kunne heve kjøpet og få tilbake 63 000 kr.

**6 måneder til 2 år, 14 år gammel bil** (`motor/middels`)

> En Volvo V50 som var 14 år gammel og hadde gått 136 000 km, ble kjøpt hos forhandler og fikk en skadet turbo sju til åtte måneder etter kjøpet. Utvalget kom til at turboskaden, som verkstedet knyttet til en tidligere reparasjon, var en mangel forhandleren var ansvarlig for, og kjøperen fikk erstatning.

- **Sak:** #2235 · FKU-2021-8891 · 2022-11-03 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022088606&dokid=772157&versjon=1&variant=A&)
- **Til kjøperen:** I 2022 fikk kjøperen av en Volvo V50 delvis medhold etter å ha klaget på motorfeil sju til åtte måneder etter kjøpet. Utvalget tilkjente 10 000 kr.

**mer enn 2 år, 2 år gammel bil** (`motor/sen`)

> En Audi Q7 3.0 TDI som var 2 år gammel og hadde gått 50 000 km, ble kjøpt hos forhandler og fikk motorhavari fordi en innsprøytningsdyse hadde sprengt ut fra festet, om lag to og et halvt år etter kjøpet. Utvalget kom til at feilen med festet til innsprøytningsdysen var en mangel forhandleren var ansvarlig for, og kjøperen fikk erstatning.

- **Sak:** #465 · FKU-2017-56 · 2017-08-24 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017007533&dokid=313350&versjon=1&variant=A&)
- **Til kjøperen:** I 2017 fikk kjøperen av en Audi Q7 3.0 TDI delvis medhold etter å ha klaget på motorfeil om lag to og et halvt år etter kjøpet. Utvalget tilkjente 40 000 kr.

Uten lignende sak: sen · eldre. Der brukes nabotidsrommet eller regel-saken.

### Elektrisk

**innen 6 måneder, 4 år gammel bil** (`elektrisk/rask`)

> En Volkswagen Golf som var 4 år gammel og hadde gått 35 500 km, ble kjøpt hos forhandler og fikk en elektrisk feil i en sensor til klimaanlegget om lag fem måneder etter kjøpet. Utvalget kom til at feilen i sensoren var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #1869 · FKU-2022-10322 · 2023-06-01 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023030866&dokid=902671&versjon=1&variant=A&)
- **Til kjøperen:** I 2023 fikk kjøperen av en Volkswagen Golf medhold etter å ha klaget på elektrisk feil om lag fem måneder etter kjøpet. Utvalget tilkjente 11 149 kr.

**innen 6 måneder, 16 år gammel bil** (`elektrisk/rask`)

> En Nissan X-Trail som var 16 år gammel og hadde gått 205 000 km, ble kjøpt hos forhandler og fikk feil i det elektriske anlegget om lag tre måneder etter kjøpet. Utvalget kom til at feilene i det elektriske anlegget var en mangel forhandleren var ansvarlig for, og kjøperen fikk heving av kjøpet.

- **Sak:** #3053 · FKU-2026-137555 · 2026-03-11 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-137555.pdf)
- **Til kjøperen:** I 2026 fikk kjøperen av en Nissan X-Trail delvis medhold etter å ha klaget på elektrisk feil om lag tre måneder etter kjøpet. Utvalget kom til at kjøperen kunne heve kjøpet og få tilbake 81 729 kr, og tilkjente i tillegg 10 876 kr i erstatning.

**6 måneder til 2 år, 7 år gammel bil** (`elektrisk/middels`)

> En Mercedes-Benz Sprinter som var 7 år gammel og hadde gått rundt 136 000 km, ble kjøpt hos forhandler og fikk påvist feil på varsellys og parkeringsvarmer i overkant av sju måneder etter kjøpet. Utvalget kom til at feilene var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #2837 · FKU-2021-2759 · 2021-03-24 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2021017255&dokid=359852&versjon=1&variant=A&)
- **Til kjøperen:** I 2021 fikk kjøperen av en Mercedes-Benz Sprinter delvis medhold etter å ha klaget på elektrisk feil i overkant av sju måneder etter kjøpet. Utvalget tilkjente 25 000 kr.

**6 måneder til 2 år, 8 år gammel bil** (`elektrisk/middels`)

> En Audi A6 3.0 TDI Q som var 8 år gammel og hadde gått 118 642 km, ble kjøpt hos forhandler og stoppet i overkant av 8 måneder etter kjøpet fordi vann hadde trengt inn i el-boksen og skadet ledningsnettet. Utvalget kom til at skadene på ledningsnettet og motorstyreenheten var en mangel forhandleren var ansvarlig for, og kjøperen fikk dekket reparasjonene.

- **Sak:** #1355 · FTU-2014-164 · 2014-04-11 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2014006347&dokid=151734&versjon=10&variant=P&)
- **Til kjøperen:** I 2014 fikk kjøperen av en Audi A6 3.0 TDI Q medhold etter å ha klaget på elektrisk feil i overkant av 8 måneder etter kjøpet. Utvalget tilkjente 62 562 kr.

**mer enn 2 år, 1 år gammel bil** (`elektrisk/sen`)

> En Kia Niro som var 1 år gammel og hadde gått 12 000 km, ble kjøpt hos forhandler og fikk en elektrisk feil i styreenheten for ryggekameraet over fire år etter kjøpet. Utvalget kom til at feilen i styreenheten for ryggekameraet var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #1525 · FKU-2024-3868 · 2025-01-13 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024064380&dokid=1248687&versjon=2&variant=A&)
- **Til kjøperen:** I 2025 fikk kjøperen av en Kia Niro medhold etter å ha klaget på elektrisk feil over fire år etter kjøpet. Utvalget tilkjente 45 836 kr.

Uten lignende sak: sen · eldre. Der brukes nabotidsrommet eller regel-saken.

### Understell og hjul

**innen 6 måneder, 14 år gammel bil** (`understell/rask`)

> En Nissan Qashqai som var 14 år gammel og hadde gått 178 800 km, ble kjøpt hos forhandler og fikk påvist feil på understellet, bremsene og flere andre deler om lag fire måneder etter kjøpet. Utvalget kom til at feilene var en mangel forhandleren var ansvarlig for, og kjøperen fikk heving av kjøpet.

- **Sak:** #3067 · FKU-2026-77134 · 2026-03-11 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-77134.pdf)
- **Til kjøperen:** I 2026 fikk kjøperen av en Nissan Qashqai medhold etter å ha klaget på feil på understellet om lag fire måneder etter kjøpet. Utvalget kom til at kjøperen kunne heve kjøpet og få tilbake 59 729 kr.

**6 måneder til 2 år, 4 år gammel bil** (`understell/middels`)

> En Tesla Model S som var 4 år gammel og hadde gått 61 200 km, ble kjøpt hos forhandler og fikk en sprukket tannstang i styringen om lag 22 måneder etter kjøpet. Utvalget kom til at feilen med tannstangen var en mangel forhandleren var ansvarlig for, og kjøperen fikk erstatning.

- **Sak:** #3170 · FKU-2025-140833 · 2025-05-21 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-140833.pdf)
- **Til kjøperen:** I 2025 fikk kjøperen av en Tesla Model S medhold etter å ha klaget på feil på understellet om lag 22 måneder etter kjøpet. Utvalget tilkjente 50 363 kr.

Uten lignende sak: rask · yngre, sen · yngre, sen · eldre. Der brukes nabotidsrommet eller regel-saken.

### Kilometer og servicehistorikk

**innen 6 måneder, 5 år gammel bil** (`km_service/rask`)

> En Volvo V60 som var 5 år gammel og hadde gått 35 000 km, ble kjøpt hos forhandler og viste seg om lag seks uker etter kjøpet ikke å ha fått service etter fabrikkens program, selv om annonsen sa at serviceprogrammet var fulgt. Utvalget kom til at den uriktige opplysningen om service var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #3081 · FKU-2026-73613 · 2026-02-18 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-73613.pdf)
- **Til kjøperen:** I 2026 fikk kjøperen av en Volvo V60 delvis medhold etter å ha klaget på uriktige opplysninger om kilometerstand eller service om lag seks uker etter kjøpet. Utvalget tilkjente 7 000 kr.

**innen 6 måneder, 10 år gammel bil** (`km_service/rask`)

> En Volkswagen Tiguan som var ti år gammel og hadde gått 126 000 km, ble kjøpt hos forhandler med opplysning om at registerreimen var skiftet og at det nylig var tatt stor service, og om lag fire måneder etter kjøpet viste en NAF-test at registerreimen var ti år gammel. Utvalget kom til at registerreimen som ikke var skiftet og den manglende dokumentasjonen på service var mangler forhandleren var ansvarlig for, og kjøperen fikk prisavslag og erstatning.

- **Sak:** #3141 · FKU-2025-115321 · 2025-09-17 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-115321.pdf)
- **Til kjøperen:** I 2025 fikk kjøperen av en Volkswagen Tiguan delvis medhold etter å ha klaget på uriktige opplysninger om service og skifte av registerreim tre til fire måneder etter kjøpet. Utvalget tilkjente 22 315 kr.

**6 måneder til 2 år, 5 år gammel bil** (`km_service/middels`)

> En Volkswagen Golf som var 5 år gammel og hadde gått 88 000 km, ble kjøpt hos forhandler med opplyst full servicehistorikk, og om lag 17 måneder etter kjøpet viste det seg at ikke alle servicer var utført. Utvalget kom til at den manglende servicehistorikken var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #3040 · FKU-2026-28973 · 2026-04-29 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-28973.pdf)
- **Til kjøperen:** I 2026 fikk kjøperen av en Volkswagen Golf delvis medhold etter å ha klaget på at ikke alle servicer var utført selv om annonsen opplyste om full servicehistorikk, om lag 17 måneder etter kjøpet. Utvalget kom til at den manglende servicehistorikken var en mangel og satte prisavslaget til 50 000 kr.

**6 måneder til 2 år, 8 år gammel bil** (`km_service/middels`)

> En Ford Focus som var 8 år gammel og hadde gått 138 940 km, ble kjøpt hos forhandler med annonsen «Service historikk fulgt», og om lag 14 måneder etter kjøpet klaget kjøperen på at service ikke var fulgt. Utvalget kom til at de uriktige opplysningene om servicehistorikken var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #10 · FKU-2021-9897 · 2023-02-01 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023000879&dokid=832691&versjon=1&variant=A&)
- **Til kjøperen:** I 2023 fikk kjøperen av en Ford Focus delvis medhold etter å ha klaget på uriktige opplysninger om kilometerstand eller service om lag 14 måneder etter kjøpet. Utvalget tilkjente 10 000 kr.

**mer enn 2 år, 2 år gammel bil** (`km_service/sen`)

> En Volkswagen e-Golf som var 2 år gammel og hadde gått 66 850 km, ble kjøpt hos forhandler og viste seg om lag to år og fem måneder etter kjøpet ikke å ha fått service etter fabrikkens intervaller, selv om annonsen oppga servicehistorikk. Utvalget kom til at de uriktige opplysningene om servicehistorikken var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #1941 · FKU-2021-16984 · 2023-04-19 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023009979&dokid=853932&versjon=2&variant=A&)
- **Til kjøperen:** I 2023 fikk kjøperen av en Volkswagen e-Golf delvis medhold etter å ha klaget på uriktige opplysninger om kilometerstand eller service om lag to år og fem måneder etter kjøpet. Utvalget tilkjente 5 000 kr.

Uten lignende sak: sen · eldre. Der brukes nabotidsrommet eller regel-saken.

### Rust

**innen 6 måneder, 3 år gammel bil** (`rust/rask`)

> En Skoda Superb som var tre år gammel og hadde gått 136 500 km, ble kjøpt hos forhandler, og kjøperen oppdaget rust rundt skiltlysene bak dagen etter kjøpet. Utvalget kom til at rusten var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #3294 · FKU-2019-748 · 2020-02-26 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2020001273&dokid=433590&versjon=1&variant=A&)
- **Til kjøperen:** I 2020 fikk kjøperen av en Skoda Superb delvis medhold etter å ha klaget på rust få dager etter kjøpet. Utvalget tilkjente 10 000 kr.

**innen 6 måneder, 7 år gammel bil** (`rust/rask`)

> En Toyota Land Cruiser som var sju og et halvt år gammel og hadde gått 179 800 km, ble kjøpt hos forhandler og fikk påvist rust på bremsecalipere, bremserør og dører omtrent fire måneder etter kjøpet. Utvalget kom til at rusten var en mangel forhandleren var ansvarlig for, og kjøperen fikk erstatning og prisavslag.

- **Sak:** #1689 · FKU-2023-10066 · 2024-02-05 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023109660&dokid=1089894&versjon=2&variant=A&)
- **Til kjøperen:** I 2024 fikk kjøperen av en Toyota Land Cruiser delvis medhold etter å ha klaget på rust omtrent fire måneder etter kjøpet. Utvalget tilkjente 65 050 kr.

**6 måneder til 2 år, 6 år gammel bil** (`rust/middels`)

> En Mazda CX-5 2.2DESport som var 6 år gammel og hadde gått 62 600 km, ble kjøpt hos forhandler og fikk rustbobler på bakluken i overkant av sju måneder etter kjøpet. Utvalget kom til at rusten på bakluken var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #3387 · FKU-2019-432 · 2019-06-27 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2019008533&dokid=410376&versjon=1&variant=A&)
- **Til kjøperen:** I 2019 fikk kjøperen av en Mazda CX-5 2.2DESport delvis medhold etter å ha klaget på rust i overkant av sju måneder etter kjøpet. Utvalget tilkjente 17 205 kr.

**6 måneder til 2 år, 17 år gammel bil** (`rust/middels`)

> En Mitsubishi Pajero som var 17 år gammel og hadde gått 233 000 km, ble kjøpt hos forhandler og fikk påvist for stor korrosjon i bærende deler om lag halvannet år etter kjøpet. Utvalget kom til at rusten var en mangel forhandleren var ansvarlig for, og kjøperen fikk heving av kjøpet.

- **Sak:** #2102 · FKU-2021-17769 · 2023-01-18 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022109676&dokid=819450&versjon=1&variant=A&)
- **Til kjøperen:** I 2023 fikk kjøperen av en Mitsubishi Pajero delvis medhold etter å ha klaget på rust om lag halvannet år etter kjøpet. Utvalget kom til at kjøperen kunne heve kjøpet og få tilbake kjøpesummen.

**mer enn 2 år, 3 år gammel bil** (`rust/sen`)

> En Volkswagen Passat som var tre år gammel og hadde gått 42 855 km, ble kjøpt hos forhandler og fikk rust nærmere tre år etter kjøpet. Utvalget kom til at rusten var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #606 · FKU-2016-1844 · 2017-04-25 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017001606&dokid=288585&versjon=1&variant=A&)
- **Til kjøperen:** I 2017 fikk kjøperen av en Volkswagen Passat delvis medhold etter å ha klaget på rust om lag tre år etter kjøpet. Utvalget tilkjente 82 650 kr.

Uten lignende sak: sen · eldre. Der brukes nabotidsrommet eller regel-saken.

### Bremser

**6 måneder til 2 år, 37 år gammel bil** (`bremser/middels`)

> En Porsche 911 som var 37 år gammel og hadde gått 143 000 km, ble kjøpt hos forhandler og fikk de uoriginale bremsene underkjent ved EU-kontroll sju til åtte måneder etter kjøpet. Utvalget kom til at de ikke-godkjente bremsene var en mangel forhandleren var ansvarlig for, og kjøperen fikk dekket reparasjonen.

- **Sak:** #2298 · FKU-2021-4001 · 2022-09-28 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022059346&dokid=705701&versjon=1&variant=A&)
- **Til kjøperen:** I 2022 fikk kjøperen av en Porsche 911 medhold etter å ha klaget på bremsefeil sju til åtte måneder etter kjøpet. Utvalget tilkjente 23 000 kr.

Uten lignende sak: rask · yngre, rask · eldre, middels · yngre, sen · yngre, sen · eldre. Der brukes nabotidsrommet eller regel-saken.

### Girkasse og clutch

**innen 6 måneder, 6 år gammel bil** (`girkasse/rask`)

> En Volkswagen Golf GTE som var 6 år gammel og hadde gått 145 000 km, ble kjøpt hos forhandler «som den er» og fikk feil på girkassens mekatronikk to måneder etter kjøpet. Utvalget kom til at feilen på girkassens mekatronikk var en mangel forhandleren var ansvarlig for, og kjøperen fikk erstatning.

- **Sak:** #1905 · FKU-2022-4730 · 2023-05-03 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023028760&dokid=897733&versjon=1&variant=A&)
- **Til kjøperen:** I 2023 fikk kjøperen av en Volkswagen Golf GTE delvis medhold etter å ha klaget på feil på girkassen to måneder etter kjøpet. Utvalget tilkjente 40 000 kr.

**innen 6 måneder, 13 år gammel bil** (`girkasse/rask`)

> En Volkswagen Golf som var 13 år gammel og hadde gått 97 000 km, ble kjøpt hos forhandler og fikk hull i girkassen etter at en drivaksel løsnet, om lag tre måneder etter kjøpet. Utvalget kom til at skadene på drivakselen og girkassen var en mangel forhandleren var ansvarlig for, og kjøperen fikk heving av kjøpet.

- **Sak:** #1600 · FKU-2023-16164 · 2024-08-14 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024038848&dokid=1202556&versjon=1&variant=A&)
- **Til kjøperen:** I 2024 fikk kjøperen av en Volkswagen Golf delvis medhold etter å ha klaget på feil på girkassen om lag tre måneder etter kjøpet. Utvalget kom til at kjøperen kunne heve kjøpet og få tilbake kjøpesummen.

**6 måneder til 2 år, 7 år gammel bil** (`girkasse/middels`)

> En Fiat Scudo som var sju år gammel og hadde gått 94 000 km, ble kjøpt hos forhandler og fikk påvist unormal slitasje i girkassen og ulyd fra clutchen om lag 14 måneder etter kjøpet. Utvalget kom til at feilen på girkassen og clutchen var en mangel forhandleren var ansvarlig for, og kjøperen fikk heving av kjøpet.

- **Sak:** #2316 · FKU-2021-6457 · 2022-09-21 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022071563&dokid=732899&versjon=1&variant=A&)
- **Til kjøperen:** I 2022 fikk kjøperen av en Fiat Scudo medhold etter å ha klaget på feil på girkassen om lag 14 måneder etter kjøpet. Utvalget kom til at kjøperen kunne heve kjøpet, og tilkjente 82 950 kr.

**6 måneder til 2 år, 9 år gammel bil** (`girkasse/middels`)

> En Opel Astra Sports Tourer som var 9 år gammel og hadde gått 125 000 km, ble kjøpt hos forhandler og fikk påvist skade på hovedlagrene i girkassen om lag sju måneder etter kjøpet. Utvalget kom til at girkassefeilen, sammen med en oljelekkasje, var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag.

- **Sak:** #1776 · FKU-2022-906 · 2023-09-06 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023072630&dokid=1002019&versjon=1&variant=A&)
- **Til kjøperen:** I 2023 fikk kjøperen av en Opel Astra Sports Tourer delvis medhold etter å ha klaget på feil på girkassen og en oljelekkasje om lag sju måneder etter kjøpet. Utvalget kom til at bilen var i dårligere stand enn kjøperen kunne forvente, og satte prisavslaget til 15 000 kr.

**mer enn 2 år, 3 år gammel bil** (`girkasse/sen`)

> En Mercedes-Benz GLK Offroad CDI 4Matic som var 3 år gammel og hadde gått 74 064 km, ble kjøpt hos forhandler og fikk ulyder fra girkassen, som skyldtes for trangt monterte lagre i fordelerkassen, drøyt to år etter kjøpet. Utvalget kom til at feilen ved girkassen var en mangel forhandleren var ansvarlig for, og kjøperen fikk dekket reparasjonen.

- **Sak:** #551 · FKU-2016-2138 · 2017-06-01 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017002902&dokid=303020&versjon=2&variant=A&)
- **Til kjøperen:** I 2017 fikk kjøperen av en Mercedes-Benz GLK Offroad CDI 4Matic delvis medhold etter å ha klaget på feil på girkassen drøyt to år etter kjøpet. Utvalget tilkjente 39 829 kr.

Uten lignende sak: sen · eldre. Der brukes nabotidsrommet eller regel-saken.

### Fukt og lekkasje

**innen 6 måneder, 4 år gammel bil** (`fukt/rask`)

> En Mercedes-Benz C 300DE som var 4 år gammel og hadde gått 108 000 km, ble kjøpt hos forhandler og fikk påvist vann og is på innsiden av begge frontlyktene om lag fire måneder etter kjøpet. Utvalget kom til at feilen med frontlyktene var en mangel forhandleren var ansvarlig for, og kjøperen fikk heving av kjøpet, blant annet på grunn av denne mangelen.

- **Sak:** #3129 · FKU-2025-136079 · 2025-05-26 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-136079.pdf)
- **Til kjøperen:** I 2025 fikk kjøperen av en Mercedes-Benz C 300DE medhold etter å ha klaget på fukt eller lekkasje fire til fem måneder etter kjøpet. Utvalget kom til at kjøperen kunne heve kjøpet, blant annet fordi vann i frontlyktene gjorde at bilen ikke kunne brukes lovlig.

**innen 6 måneder, 8 år gammel bil** (`fukt/rask`)

> En Ford Transit Custom som var åtte år gammel og hadde gått 118 000 km, ble kjøpt hos forhandler og fikk vannlekkasje ved frontruten som ga feil på det elektriske anlegget om lag fem måneder etter kjøpet. Utvalget kom til at vannlekkasjen og feilen på det elektriske anlegget var en mangel forhandleren var ansvarlig for, og kjøperen fikk dekket reparasjonen.

- **Sak:** #1916 · FKU-2022-4734 · 2023-04-26 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023028939&dokid=898144&versjon=1&variant=A&)
- **Til kjøperen:** I 2023 fikk kjøperen av en Ford Transit Custom delvis medhold etter å ha klaget på fukt eller lekkasje under seks måneder etter kjøpet. Utvalget tilkjente 17 364 kr.

**6 måneder til 2 år, 4 år gammel bil** (`fukt/middels`)

> En Nissan Leaf som var 4 år gammel og hadde gått 34 250 km, ble kjøpt hos forhandler og fikk mye dugg og vann i bilen fra en lekkasje i taket om lag 21 måneder etter kjøpet. Utvalget kom til at lekkasjen var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag og erstatning.

- **Sak:** #2355 · FKU-2021-5035 · 2022-08-31 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022056587&dokid=700048&versjon=1&variant=A&)
- **Til kjøperen:** I 2022 fikk kjøperen av en Nissan Leaf delvis medhold etter å ha klaget på fukt eller lekkasje om lag 21 måneder etter kjøpet. Utvalget tilkjente 29 631 kr.

**6 måneder til 2 år, 11 år gammel bil** (`fukt/middels`)

> En Volvo XC70 som var 11 år gammel og hadde gått 247 300 km, ble kjøpt hos forhandler og fikk vannlekkasje fra frontruten med følgefeil på det elektriske anlegget om lag ni måneder etter kjøpet. Utvalget kom til at vannlekkasjen og følgefeilene var en mangel forhandleren var ansvarlig for, og kjøperen fikk heving av kjøpet.

- **Sak:** #911 · FTU-2016-176 · 2016-04-15 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2016007477&dokid=224502&versjon=1&variant=A&)
- **Til kjøperen:** I 2016 fikk kjøperen av en Volvo XC70 delvis medhold etter å ha klaget på fukt eller lekkasje om lag ni måneder etter kjøpet. Utvalget kom til at kjøperen kunne heve kjøpet.

**mer enn 2 år, 4 år gammel bil** (`fukt/sen`)

> En Audi A1 som var 4 år gammel og hadde gått 57 000 km, ble kjøpt hos forhandler og fikk vannlekkasje ved frontruta drøye to år etter kjøpet. Utvalget kom til at lekkasjen, som skyldtes at limet på den originale frontruta hadde sluppet, var en mangel forhandleren var ansvarlig for, og kjøperen fikk erstatning.

- **Sak:** #3470 · FKU-2019-116 · 2019-04-25 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2019004189&dokid=401510&versjon=1&variant=A&)
- **Til kjøperen:** I 2019 fikk kjøperen av en Audi A1 delvis medhold etter å ha klaget på fukt eller lekkasje drøye to år etter kjøpet. Utvalget tilkjente 8 548 kr.

Uten lignende sak: sen · eldre. Der brukes nabotidsrommet eller regel-saken.

### Klimaanlegg

**innen 6 måneder, 6 år gammel bil** (`klimaanlegg/rask`)

> En Volkswagen Caddy Maxi som var seks år gammel og hadde gått 109 600 km, ble kjøpt hos forhandler, og om lag sju uker etter kjøpet oppdaget kjøperen at klimaanlegget ikke virket. Utvalget kom til at feilen på klimaanlegget var en mangel forhandleren var ansvarlig for, og kjøperen fikk dekket reparasjonen.

- **Sak:** #1566 · FKU-2024-1215 · 2024-10-09 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024042231&dokid=1208671&versjon=1&variant=A&)
- **Til kjøperen:** I 2024 fikk kjøperen av en Volkswagen Caddy Maxi delvis medhold etter å ha klaget på feil på klimaanlegget om lag to måneder etter kjøpet. Utvalget tilkjente 34 336 kr.

**innen 6 måneder, 12 år gammel bil** (`klimaanlegg/rask`)

> En Volkswagen Touareg som var 12 år gammel og hadde gått 205 287 km, ble kjøpt hos forhandler og fikk påvist feil på blant annet klimaanlegget under én måned etter kjøpet. Utvalget kom til at feilene på klimaanlegget og annet utstyr oppført i annonsen var en mangel forhandleren var ansvarlig for, og kjøperen fikk prisavslag og erstatning.

- **Sak:** #3165 · FKU-2025-141296 · 2025-06-23 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-141296.pdf)
- **Til kjøperen:** I 2025 fikk kjøperen av en Volkswagen Touareg delvis medhold etter å ha klaget på feil på klimaanlegget under én måned etter kjøpet. Utvalget tilkjente 22 710 kr.

**mer enn 2 år, 2 år gammel bil** (`klimaanlegg/sen`)

> En Volkswagen E-golf som var 2 år gammel og hadde gått 9 990 km, ble kjøpt hos forhandler og fikk feil på sensorene til klimaanlegget, og senere lekkasje i ventil og pakninger, drøyt to år etter kjøpet. Utvalget kom til at de defekte sensorene og lekkasjen i klimaanlegget var en mangel forhandleren var ansvarlig for, og kjøperen fikk erstatning.

- **Sak:** #2510 · FKU-2021-4356 · 2022-03-23 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022017294&dokid=617370&versjon=1&variant=A&)
- **Til kjøperen:** I 2022 fikk kjøperen av en Volkswagen E-golf medhold etter å ha klaget på feil på klimaanlegget drøyt to år etter kjøpet. Utvalget tilkjente 21 165 kr.

Uten lignende sak: middels · yngre, middels · eldre, sen · eldre. Der brukes nabotidsrommet eller regel-saken.

### Tidligere skade

**innen 6 måneder, 7 år gammel bil** (`skade/rask`)

> En Toyota Auris som var 7 år gammel og hadde gått 171 000 km, ble kjøpt hos forhandler og fikk påvist en tidligere kollisjonsskade foran om lag seks uker etter kjøpet. Utvalget kom til at skaden var en mangel forhandleren var ansvarlig for, og kjøperne fikk prisavslag.

- **Sak:** #3125 · FKU-2025-55355 · 2025-10-01 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-55355.pdf)
- **Til kjøperen:** I 2025 fikk kjøperne av en Toyota Auris delvis medhold etter å ha klaget på en tidligere kollisjonsskade om lag seks uker etter kjøpet. Utvalget kom til at skaden var en mangel og satte prisavslaget for den til 21 976 kr.

**innen 6 måneder, 8 år gammel bil** (`skade/rask`)

> En Nissan Leaf som var åtte år gammel og hadde gått 68 800 km, ble kjøpt hos forhandler, og innen fire uker etter kjøpet oppdaget kjøperen at den tidligere hadde hatt omfattende skader som forhandleren ikke hadde opplyst om. Utvalget kom til at de tidligere skadene, som kjøperen ikke var blitt opplyst om, var en mangel forhandleren var ansvarlig for, og kjøperen fikk heving av kjøpet på grunn av manglene samlet.

- **Sak:** #3143 · FKU-2025-116737 · 2025-08-27 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-116737.pdf)
- **Til kjøperen:** I 2025 fikk kjøperen av en Nissan Leaf medhold etter å ha klaget på blant annet en tidligere kollisjonsskade om lag fire uker etter kjøpet. Utvalget kom til at manglene samlet ga kjøperen rett til å heve kjøpet og få tilbake 81 000 kr, og tilkjente i tillegg 2 710 kr i erstatning.

**6 måneder til 2 år, 6 år gammel bil** (`skade/middels`)

> En Volvo XC60 som var 6 år gammel og hadde gått 80 573 km, ble kjøpt hos forhandler, og om lag 17 måneder etter kjøpet viste en NAF-test at bilen var delvis omlakkert etter en tidligere skade. Utvalget kom til at det var en mangel at forhandleren ikke hadde opplyst om den tidligere skaden, og kjøperen fikk prisavslag.

- **Sak:** #1967 · FKU-2022-6291 · 2023-03-29 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023021551&dokid=880996&versjon=1&variant=A&)
- **Til kjøperen:** I 2023 fikk kjøperen av en Volvo XC60 delvis medhold etter å ha klaget på en tidligere skade som ikke var opplyst, om lag 17 måneder etter kjøpet. Utvalget tilkjente 25 000 kr.

**mer enn 2 år, 2 år gammel bil** (`skade/sen`)

> En Volvo XC60 som var 2 år gammel og hadde gått 49 600 km, ble kjøpt hos forhandler og viste seg om lag to år og tre måneder etter kjøpet å ha hatt en tidligere skade og delvis omlakkering som forhandleren ikke hadde opplyst om. Utvalget kom til at det var en mangel at forhandleren ikke hadde opplyst om den tidligere skaden, og kjøperen fikk prisavslag.

- **Sak:** #2486 · FKU-2021-5368 · 2022-04-20 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022027852&dokid=639892&versjon=1&variant=A&)
- **Til kjøperen:** I 2022 fikk kjøperen av en Volvo XC60 medhold etter å ha klaget på en tidligere skade forhandleren ikke hadde opplyst om, om lag to år og tre måneder etter kjøpet. Utvalget tilkjente 25 000 kr.

Uten lignende sak: sen · eldre. Der brukes nabotidsrommet eller regel-saken.

### Batteri (elbil)

**6 måneder til 2 år, 7 år gammel bil** (`batteri/middels`)

> En Tesla Model S som var sju år gammel og hadde gått 109 765 km, ble kjøpt fra en næringsdrivende på auksjon og fikk feil på høyvoltsbatteriet vel 14 måneder etter kjøpet. Utvalget kom til at feilene med batteriet og sikkerhetsfunksjonene samlet sett var en mangel selgeren var ansvarlig for, og kjøperen fikk prisavslag og erstatning.

- **Sak:** #3105 · FKU-2026-117158 · 2025-11-11 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-117158.pdf)
- **Til kjøperen:** I 2025 fikk kjøperen av en Tesla Model S delvis medhold etter å ha klaget på feil på elbilbatteriet vel 14 måneder etter kjøpet. Utvalget tilkjente 70 540 kr.

Uten lignende sak: rask · yngre, rask · eldre, middels · eldre, sen · yngre, sen · eldre. Der brukes nabotidsrommet eller regel-saken.

## Forkastet

- **I kontrollen:** #1548 (Land Cruiser): vunnet på at kontrakten lovet nye luftfjærer, mens selve feilene i understellet ble ansett som påregnelige. #382 (Audi A3): hevingen ble avgjort «under noe tvil».
- **Ved avgjørelsen:** #3545 (vunnet på «helt ny motor», ikke på motorfeilen), #3005 (vant bare på DAB-radio), #2263 (12 V-startbatteri), #1035 (ladeenhet, ikke drivbatteri), #2454 og #899 (avgjort «under (noe) tvil»/«med tvil»), #3117 (kjølevæske i drivenhet, ikke fukt), #1872 (takskade med følgerust), #1689 flyttet fra bremser til rust.
- **Av vurdererne, blant annet:** #3154, #1598, #1936, #3023 og flere andre der forhandleren ikke svarte; #1684, #2034, #2469 «under tvil»; #1579 og #3128 der feilen viste seg innen seks måneder selv om databasen sa noe annet.
- **Fra de tidligere eksempelsakene** er #3154, #1598 og #1936 (forhandleren svarte ikke) og #1684 og #2454 («under noe tvil») tatt ut.

## Vedlikehold

Når nye vedtak er hentet og tolket: kjør `npm run henvisning-kandidater`, kurater listene som har fått nye kandidater på samme måte, og kjør `npm run sjekk-henvisninger` og `npm test`. Vedtak om kjøp fra 2024 foretrekkes når de holder; de får `lov: "etter_2024"` og brukes bare for kjøp fra 2024.
