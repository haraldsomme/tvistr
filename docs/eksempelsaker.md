# Eksempelsaker til vurderingssiden

Vurderingssiden viser alltid én sak fra Forbrukerklageutvalget når saken er vurdert. Koden ligger i `src/lib/vurdering/eksempler.ts`.

# Vunnede saker (vises ved god sak)

Én forhåndsvalgt sak per kombinasjon av feilgruppe og tid fra kjøp til klage. 25 av 30 kombinasjoner har en sak; fem står tomme fordi ingen kandidat holdt.

**Slik ble de valgt.** For hver kombinasjon ble de 14 nyeste vunnede forhandlersakene hentet ut (personbil eller varebil, ikke merket for kontroll). Tre uavhengige vurderere leste alle 314 kandidatene og valgte hver sin sak; de var enige i 24 av 30. Deretter ble valgene kontrollert mot selve vedtaksteksten, og de omstridte ble avgjort der. Kriteriene var, i rekkefølge: riktig feil og tid, nyest mulig vedtak, gjenkjennelig bil og feil, vunnet på vanlige mangelsregler (ikke garanti), klart utfall.

**Setningene** følger én mal. År, bil, tid, utfall og beløp er kontrollert mot vedtaksteksten, ikke bare mot databasen. Beløp er uten renter.

**Flere feil valgt:** eksemplet hentes fra den vanligste gruppen, i denne rekkefølgen: motor, elektrisk, understell, kilometer og servicehistorikk, rust, bremser, girkasse, fukt, klimaanlegg, kollisjonsskade. «Dårlig sak» får en tapt sak og «Annet» et generelt eksempel; se nederst.

## Motor

### Innen 6 måneder (`motor/rask`)

> I 2025 fikk kjøperen av en Toyota Proace medhold etter å ha klaget på motorfeil 8 dager etter kjøpet. Utvalget tilkjente 12 400 kr.

- **Sak:** #3154 · FKU-2025-140302 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-140302.pdf)
- **Fikk:** erstatning, medhold
- **Merk:** Forhandleren svarte ikke i saken, og bilen er en varebil. Reserve: #2423 (2022, BMW, heving), eldre og uten modellnavn.

### 6 måneder til 2 år (`motor/middels`)

> I 2024 fikk kjøperen av en BMW X5 delvis medhold etter å ha klaget på motorfeil om lag 14 måneder etter kjøpet. Utvalget tilkjente 60 637 kr.

- **Sak:** #1691 · 23/13923 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023121274&dokid=1115606&versjon=1&variant=A&)
- **Fikk:** erstatning, delvis medhold
- **Merk:** Krevde 90 637 kr. Vedtaket sier ikke uttrykkelig at det er enstemmig.

### Mer enn 2 år (`motor/sen`)

> I 2024 fikk kjøperen av en BMW 3-serie medhold etter å ha klaget på motorfeil om lag 4,5 år etter kjøpet. Utvalget tilkjente 59 975 kr.

- **Sak:** #1684 · 23/13195 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024000896&dokid=1122688&versjon=1&variant=A&)
- **Fikk:** erstatning, medhold
- **Merk:** Vedtaket skriver «BMW 316D Touring». Utvalget kom til resultatet «under noe tvil».

## Girkasse og clutch

### Innen 6 måneder (`girkasse/rask`)

> I 2021 fikk kjøperen av en Audi A6 delvis medhold etter å ha klaget på feil på girkassen 2 dager etter kjøpet. Utvalget tilkjente 41 425 kr.

- **Sak:** #2626 · 21/6249 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2021092984&dokid=532845&versjon=1&variant=A&)
- **Fikk:** prisavslag og erstatning, delvis medhold
- **Merk:** Valgt foran #3104 (2025), som ble vunnet på garanti. Hviler delvis på at kontrakten bagatelliserte en NAF-anmerkning.

### 6 måneder til 2 år (`girkasse/middels`)

> I 2023 fikk kjøperen av en Opel Astra delvis medhold etter å ha klaget på feil på girkassen om lag 7 måneder etter kjøpet. Utvalget tilkjente 16 980 kr.

- **Sak:** #1776 · 22/906 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023072630&dokid=1002019&versjon=1&variant=A&)
- **Fikk:** prisavslag og erstatning, delvis medhold
- **Merk:** Prisavslaget dekker også en oljelekkasje på motoren.

### Mer enn 2 år (`girkasse/sen`)

> I 2017 fikk kjøperen av en Mercedes-Benz GLK delvis medhold etter å ha klaget på feil på girkassen om lag 2,5 år etter kjøpet. Utvalget tilkjente 39 829 kr.

- **Sak:** #551 · 16/2138 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017002902&dokid=303020&versjon=2&variant=A&)
- **Fikk:** erstatning, delvis medhold
- **Merk:** Gammelt vedtak; bare tre kandidater, alle fra 2016–2017. Feilen satt i fordelerkassen.

## Elektrisk

### Innen 6 måneder (`elektrisk/rask`)

> I 2026 fikk kjøperen av en BMW X6 delvis medhold etter å ha klaget på elektrisk feil én dag etter kjøpet. Utvalget tilkjente 4 350 kr.

- **Sak:** #3085 · FKU-2026-93206 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-93206.pdf)
- **Fikk:** erstatning, delvis medhold
- **Merk:** Lite beløp. Møtet var 17.12.2025, vedtaket er datert 19.01.2026; årstallet bør avklares.

### 6 måneder til 2 år (`elektrisk/middels`)

Ingen egen sak; nærmeste tidsrom i samme gruppe brukes. Vurderernes valg (#2679, Tesla Model S) falt i kontrollen: feilen ble tatt opp med forhandleren fra første dag, og saken er sammensatt. De rene alternativene er et feilmontert hengerfeste og en garantisak.

### Mer enn 2 år (`elektrisk/sen`)

> I 2025 fikk kjøperen av en Kia Niro delvis medhold etter å ha klaget på elektrisk feil om lag 4,5 år etter kjøpet. Utvalget tilkjente 45 836 kr.

- **Sak:** #1525 · 24/3868 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024064380&dokid=1248687&versjon=2&variant=A&)
- **Fikk:** prisavslag og erstatning, delvis medhold
- **Merk:** Krevde 106 959 kr. Feilen satt i radio- og navigasjonsenheten.

## Understell og hjul

### Innen 6 måneder (`understell/rask`)

> I 2020 fikk kjøperen av en Mitsubishi Outlander delvis medhold etter å ha klaget på feil på understellet 11 dager etter kjøpet. Utvalget tilkjente 38 700 kr.

- **Sak:** #3258 · 19/890 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2020008016&dokid=445153&versjon=1&variant=A&)
- **Fikk:** prisavslag og erstatning, delvis medhold
- **Merk:** Gjelder tannstang (styring). 11 dager fra kjøp, 9 fra overtakelse. Heving ble avslått.

### 6 måneder til 2 år (`understell/middels`)

> I 2025 fikk kjøperen av en Tesla Model S medhold etter å ha klaget på feil på understellet om lag 22 måneder etter kjøpet. Utvalget tilkjente 50 363 kr.

- **Sak:** #3170 · FKU-2025-140833 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-140833.pdf)
- **Fikk:** erstatning, medhold
- **Merk:** Gjelder tannstang (styring).

### Mer enn 2 år (`understell/sen`)

Ingen egen sak; nærmeste tidsrom i samme gruppe brukes. Ingen kandidater i databasen.

## Bremser

### Innen 6 måneder (`bremser/rask`)

> I 2022 fikk kjøperen av en Toyota RAV4 medhold etter å ha klaget på bremsefeil om lag en måned etter kjøpet. Utvalget tilkjente 21 442 kr.

- **Sak:** #2454 · 21/4018 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022034016&dokid=653560&versjon=1&variant=A&)
- **Fikk:** prisavslag og erstatning, medhold
- **Merk:** Mangelen var en vedvarende pipelyd, ikke bremsesvikt. «Under noe tvil».

### 6 måneder til 2 år (`bremser/middels`)

Ingen egen sak; nærmeste tidsrom i samme gruppe brukes. Eneste rene bremsesak er en Porsche 911 fra 1982 med ombygde bremser.

### Mer enn 2 år (`bremser/sen`)

Ingen egen sak; nærmeste tidsrom i samme gruppe brukes. Eneste kandidat er en samlesak der bremsene er én av mange feil.

## Rust

### Innen 6 måneder (`rust/rask`)

> I 2024 fikk kjøperen av en Toyota Land Cruiser delvis medhold etter å ha klaget på rust om lag 5 måneder etter kjøpet. Utvalget tilkjente 65 050 kr.

- **Sak:** #1689 · 23/10066 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023109660&dokid=1089894&versjon=2&variant=A&)
- **Fikk:** prisavslag og erstatning, delvis medhold
- **Merk:** Hentet fra en annen celleliste etter forslag fra to vurderere. Dyr bil (540 500 kr).

### 6 måneder til 2 år (`rust/middels`)

> I 2024 fikk kjøperen av en Subaru Forester medhold etter å ha klaget på rust om lag 8 måneder etter kjøpet. Utvalget kom til at kjøpet kunne heves.

- **Sak:** #1579 · 24/81 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024047333&dokid=1217790&versjon=1&variant=A&)
- **Fikk:** heving, medhold
- **Merk:** Heving, kjøpesum 57 000 kr. Valgt foran #3128 (2025), som i realiteten ble reklamert innen seks måneder.

### Mer enn 2 år (`rust/sen`)

> I 2017 fikk kjøperen av en Volkswagen Passat delvis medhold etter å ha klaget på rust om lag 3 år etter kjøpet. Utvalget tilkjente 82 650 kr.

- **Sak:** #606 · 16/1844 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017001606&dokid=288585&versjon=1&variant=A&)
- **Fikk:** prisavslag, delvis medhold
- **Merk:** Gammelt vedtak, men eneste rene rustsak med tydelig beløp.

## Fukt og lekkasje

### Innen 6 måneder (`fukt/rask`)

> I 2023 fikk kjøperen av en Ford Transit Custom delvis medhold etter å ha klaget på fukt eller lekkasje om lag 6 måneder etter kjøpet. Utvalget tilkjente 17 364 kr.

- **Sak:** #1916 · 22/4734 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023028939&dokid=898144&versjon=1&variant=A&)
- **Fikk:** erstatning, delvis medhold
- **Merk:** Varebil. Reklamert etter 177 dager, så vidt innenfor seks måneder.

### 6 måneder til 2 år (`fukt/middels`)

> I 2022 fikk kjøperen av en Nissan Leaf delvis medhold etter å ha klaget på fukt eller lekkasje om lag 21 måneder etter kjøpet. Utvalget tilkjente 29 631 kr.

- **Sak:** #2355 · 21/5035 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022056587&dokid=700048&versjon=1&variant=A&)
- **Fikk:** prisavslag og erstatning, delvis medhold
- **Merk:** Databasen sier 225 dager, men lekkasjen ble reklamert etter 649. Krevde heving, fikk prisavslag.

### Mer enn 2 år (`fukt/sen`)

> I 2019 fikk kjøperen av en Audi A1 delvis medhold etter å ha klaget på fukt eller lekkasje om lag 2,5 år etter kjøpet. Utvalget tilkjente 8 548 kr.

- **Sak:** #3470 · 19/116 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2019004189&dokid=401510&versjon=1&variant=A&)
- **Fikk:** erstatning, delvis medhold
- **Merk:** Kjøperen hadde leaset bilen hos forhandleren før kjøpet. Lite beløp.

## Klimaanlegg

### Innen 6 måneder (`klimaanlegg/rask`)

> I 2023 fikk kjøperen av en Volkswagen Golf medhold etter å ha klaget på feil på klimaanlegget om lag 5 måneder etter kjøpet. Utvalget tilkjente 11 149 kr.

- **Sak:** #1869 · 22/10322 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023030866&dokid=902671&versjon=1&variant=A&)
- **Fikk:** prisavslag, medhold

### 6 måneder til 2 år (`klimaanlegg/middels`)

Ingen egen sak; nærmeste tidsrom i samme gruppe brukes. Alle tre kandidatene ble vunnet på noe annet enn klimaanlegget (opplysning om årsmodell, garanti, eller som én av tre feil).

### Mer enn 2 år (`klimaanlegg/sen`)

> I 2022 fikk kjøperen av en Volkswagen e-Golf medhold etter å ha klaget på feil på klimaanlegget om lag 2 år etter kjøpet. Utvalget tilkjente 21 165 kr.

- **Sak:** #2510 · 21/4356 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022017294&dokid=617370&versjon=1&variant=A&)
- **Fikk:** erstatning, medhold
- **Merk:** 766 dager, bare 36 dager over toårsgrensen.

## Kilometer og servicehistorikk

### Innen 6 måneder (`km_service/rask`)

> I 2026 fikk kjøperen av en Volvo V60 delvis medhold etter å ha klaget på uriktige opplysninger om kilometerstand eller service 39 dager etter kjøpet. Utvalget tilkjente 7 000 kr.

- **Sak:** #3081 · FKU-2026-73613 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-73613.pdf)
- **Fikk:** prisavslag, delvis medhold
- **Merk:** Beløpet er prisavslaget alene; 1 277 kr i gebyr er holdt utenfor.

### 6 måneder til 2 år (`km_service/middels`)

> I 2023 fikk kjøperen av en Ford Focus delvis medhold etter å ha klaget på uriktige opplysninger om kilometerstand eller service om lag 14 måneder etter kjøpet. Utvalget tilkjente 10 000 kr.

- **Sak:** #10 · 21/9897 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023000879&dokid=832691&versjon=1&variant=A&)
- **Fikk:** prisavslag, delvis medhold
- **Merk:** Valgt av meg etter kontroll, i stedet for vurderernes #3040 (2026, Golf R til 500 000 kr, utypisk høyt prisavslag).

### Mer enn 2 år (`km_service/sen`)

> I 2023 fikk kjøperen av en Volkswagen e-Golf delvis medhold etter å ha klaget på uriktige opplysninger om kilometerstand eller service om lag 2,5 år etter kjøpet. Utvalget tilkjente 5 000 kr.

- **Sak:** #1941 · 21/16984 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023009979&dokid=853932&versjon=2&variant=A&)
- **Fikk:** prisavslag, delvis medhold
- **Merk:** Krevde over 80 000 kr og fikk 5 000. Rust og klimaanlegg førte ikke fram.

## Kollisjonsskade

### Innen 6 måneder (`skade/rask`)

> I 2023 fikk kjøperen av en Mitsubishi Outlander medhold etter å ha klaget på en tidligere kollisjonsskade 14 dager etter kjøpet. Utvalget tilkjente 42 723 kr.

- **Sak:** #1820 · 22/5565 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023052294&dokid=953303&versjon=1&variant=A&)
- **Fikk:** prisavslag og erstatning, medhold

### 6 måneder til 2 år (`skade/middels`)

> I 2023 fikk kjøperen av en Volvo XC60 delvis medhold etter å ha klaget på en tidligere kollisjonsskade om lag 17 måneder etter kjøpet. Utvalget tilkjente 25 000 kr.

- **Sak:** #1967 · 22/6291 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023021551&dokid=880996&versjon=1&variant=A&)
- **Fikk:** prisavslag, delvis medhold
- **Merk:** Samme forhandler, modell og beløp som eksemplet for mer enn 2 år.

### Mer enn 2 år (`skade/sen`)

> I 2022 fikk kjøperen av en Volvo XC60 medhold etter å ha klaget på en tidligere kollisjonsskade om lag 2 år etter kjøpet. Utvalget tilkjente 25 000 kr.

- **Sak:** #2486 · 21/5368 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022027852&dokid=639892&versjon=1&variant=A&)
- **Fikk:** prisavslag, medhold
- **Merk:** Samme forhandler, modell og beløp som eksemplet for 6 måneder til 2 år.


---

# Tapte saker (vises ved «Dårlig sak»)

26 av 30 kombinasjoner har en egen tapt sak. Valgt på samme måte som de vunnede: de ti nyeste tapte forhandlersakene per kombinasjon, tre uavhengige vurderere (enige i 35 av 46 lister), og kontroll mot vedtaksteksten. En tapt sak kan gjelde flere feil: kjøperen tapte på alle.

Siste ledd i setningen er alltid én av fire faste begrunnelser, satt etter vedtaksteksten:

- det var ikke vist at bilen hadde en mangel da den ble levert
- feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden
- kjøperen var gjort kjent med feilen før kjøpet
- det var klaget for sent

**Uten egen tapt sak:** bremser mer enn 2 år (eneste kandidat var en garantisak på en nesten ny bil), kollisjonsskade mer enn 2 år (tapt av andre grunner enn de fire), og kilometer og servicehistorikk for de to korteste tidsrommene (ingen sak ble tapt på selve servicehistorikken av en av de fire grunnene). Der brukes nærmeste tidsrom i samme gruppe.

## Motor, tapt

### Innen 6 måneder (`tapt/motor/rask`)

> I 2026 fikk kjøperen av en Volvo V70 ikke medhold etter å ha klaget på motorfeil om lag 2 måneder etter kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #3004 · FKU-2026-12573 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-12573.pdf)

### 6 måneder til 2 år (`tapt/motor/middels`)

> I 2026 fikk kjøperen av en Mazda CX-5 ikke medhold etter å ha klaget på motorfeil om lag 23 måneder etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #3009 · FKU-2026-11052 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-11052.pdf)
- **Merk:** Samme symptom ble reparert for forhandlerens regning fem uker etter kjøpet; setningen nevner ikke det.

### Mer enn 2 år (`tapt/motor/sen`)

> I 2026 fikk kjøperen av en Volkswagen Transporter ikke medhold etter å ha klaget på motorfeil om lag 3 år etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #3045 · FKU-2026-128522 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-128522.pdf)
- **Merk:** Partene var uenige om når det ble klaget; over to år uansett.

## Girkasse og clutch, tapt

### Innen 6 måneder (`tapt/girkasse/rask`)

> I 2024 fikk kjøperen av en Volkswagen Golf Plus ikke medhold etter å ha klaget på feil på girkassen om lag 5 måneder etter kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #1527 · 24/3492 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024054081&dokid=1229563&versjon=2&variant=A&)
- **Merk:** Utvalget sa at kjøperen «måtte påregne reparasjoner»; kjøperens sakkyndige mente det ikke var normal slitasje.

### 6 måneder til 2 år (`tapt/girkasse/middels`)

> I 2025 fikk kjøperen av en Ford Focus ikke medhold etter å ha klaget på feil på girkassen om lag 20 måneder etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #3135 · FKU-2025-117206 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-117206.pdf)
- **Merk:** Motorbytte var hovedsaken; girkassefeilen kom senere.

### Mer enn 2 år (`tapt/girkasse/sen`)

> I 2023 fikk kjøperen av en Chrysler Voyager ikke medhold etter å ha klaget på feil på girkassen om lag 3 år etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #2109 · 21/17506 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022106437&dokid=812380&versjon=1&variant=A&)
- **Merk:** Vedtaket skriver «to år og to måneder», men datoene gir vel tre år.

## Elektrisk, tapt

### Innen 6 måneder (`tapt/elektrisk/rask`)

> I 2024 fikk kjøperen av en Skoda Superb ikke medhold etter å ha klaget på elektrisk feil samme dag som kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #1626 · 23/15554 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024027773&dokid=1182873&versjon=4&variant=A&)
- **Merk:** Svakeste valg: avgjort på manglende dokumentasjon av årsak. Valgt av kontrollen foran vurderernes #3108.

### 6 måneder til 2 år (`tapt/elektrisk/middels`)

> I 2024 fikk kjøperen av en Volkswagen Passat Alltrack ikke medhold etter å ha klaget på elektrisk feil om lag 6 måneder etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #1620 · 23/17173 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024037023&dokid=1199368&versjon=1&variant=A&)
- **Merk:** Feilen var dørlåser som ikke låste; vedtaket sier ikke uttrykkelig at den var elektrisk. 184 dager, så vidt over seks måneder.

### Mer enn 2 år (`tapt/elektrisk/sen`)

> I 2023 fikk kjøperen av en Volkswagen Passat Alltrack ikke medhold etter å ha klaget på elektrisk feil om lag 2,5 år etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #2025 · 21/14724 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023000149&dokid=830725&versjon=1&variant=A&)
- **Merk:** Valgt av meg etter kontroll, i stedet for #3069 (Volvo XC90 til 882 000 kr, samleklage). Gjaldt Webasto og lås i bakdør.

## Understell og hjul, tapt

### Innen 6 måneder (`tapt/understell/rask`)

> I 2026 fikk kjøperen av en BMW 7-serie ikke medhold etter å ha klaget på feil på understellet om lag 2 måneder etter kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #3032 · FKU-2026-21423 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-21423.pdf)

### 6 måneder til 2 år (`tapt/understell/middels`)

> I 2022 fikk kjøperen av en Mitsubishi Outlander ikke medhold etter å ha klaget på feil på understellet om lag 11 måneder etter kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #2394 · 21/3826 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022047470&dokid=680407&versjon=1&variant=A&)
- **Merk:** Valgt av meg etter kontroll: #26 passet bedre som bremsesak. Gjaldt støtdempere.

### Mer enn 2 år (`tapt/understell/sen`)

> I 2022 fikk kjøperen av en Citroën C5 ikke medhold etter å ha klaget på feil på understellet om lag 4,5 år etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #2587 · 21/5465 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2021103678&dokid=554755&versjon=2&variant=A&)
- **Merk:** Gjaldt tannstang (styring).

## Bremser, tapt

### Innen 6 måneder (`tapt/bremser/rask`)

> I 2026 fikk kjøperen av en Ford Kuga ikke medhold etter å ha klaget på bremsefeil 8 dager etter kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #3016 · FKU-2026-17894 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-17894.pdf)
- **Merk:** Bremser var én av flere feil. 8 dager fra kjøp, 2 fra henting.

### 6 måneder til 2 år (`tapt/bremser/middels`)

> I 2025 fikk kjøperen av en Hyundai Santa Fe ikke medhold etter å ha klaget på bremsefeil om lag 10 måneder etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #26 · FKU-2025-62864 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-62864.pdf)
- **Merk:** Gjaldt parkeringsbremsen. Flyttet hit fra understell etter kontroll.

## Rust, tapt

### Innen 6 måneder (`tapt/rust/rask`)

> I 2025 fikk kjøperen av en Volkswagen Tiguan ikke medhold etter å ha klaget på rust om lag 5 måneder etter kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #3124 · FKU-2025-64269 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-64269.pdf)

### 6 måneder til 2 år (`tapt/rust/middels`)

> I 2024 fikk kjøperen av en Ford Ranger ikke medhold etter å ha klaget på rust om lag 17 måneder etter kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #1610 · 24/793 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024033193&dokid=1192563&versjon=2&variant=A&)
- **Merk:** Utvalget godtok at rusten var der ved kjøpet, men mente den var påregnelig på en 14 år gammel bil.

### Mer enn 2 år (`tapt/rust/sen`)

> I 2023 fikk kjøperen av en Nissan Navara ikke medhold etter å ha klaget på rust om lag 3,5 år etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #1890 · 22/12057 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023036720&dokid=916780&versjon=2&variant=A&)
- **Merk:** Valgt av kontrollen foran flertallets #1996.

## Fukt og lekkasje, tapt

### Innen 6 måneder (`tapt/fukt/rask`)

> I 2024 fikk kjøperen av en Nissan Qashqai ikke medhold etter å ha klaget på fukt eller lekkasje samme dag som kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #1638 · 23/15602 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024037918&dokid=1200986&versjon=1&variant=A&)

### 6 måneder til 2 år (`tapt/fukt/middels`)

> I 2022 fikk kjøperen av en Volkswagen Tiguan ikke medhold etter å ha klaget på fukt eller lekkasje om lag 8 måneder etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #2452 · 21/5356 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022034104&dokid=653727&versjon=1&variant=A&)
- **Merk:** Eldre vedtak; svinghjulet var hovedfeilen i saken.

### Mer enn 2 år (`tapt/fukt/sen`)

> I 2023 fikk kjøperen av en Mini Countryman ikke medhold etter å ha klaget på fukt eller lekkasje om lag 2,5 år etter kjøpet. Utvalget kom til at det var klaget for sent.

- **Sak:** #2103 · 21/16344 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022109709&dokid=819534&versjon=1&variant=A&)
- **Merk:** Kjøperen ventet om lag seks måneder etter at lekkasjen ble oppdaget. Setningen kan leses som at to år i seg selv var for sent.

## Klimaanlegg, tapt

### Innen 6 måneder (`tapt/klimaanlegg/rask`)

> I 2023 fikk kjøperen av en Tesla Model X ikke medhold etter å ha klaget på feil på klimaanlegget om lag fem uker etter kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #1747 · 23/9462 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023090721&dokid=1044604&versjon=2&variant=A&)
- **Merk:** Første klage kom etter 5 dager og ble rettet; de omtvistede feilene kom om lag fem uker etter kjøpet. Kravet bygget også på garanti.

### 6 måneder til 2 år (`tapt/klimaanlegg/middels`)

> I 2023 fikk kjøperen av en Volkswagen e-Golf ikke medhold etter å ha klaget på feil på klimaanlegget om lag 9 måneder etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #1942 · 22/5510 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023017414&dokid=870886&versjon=1&variant=A&)

### Mer enn 2 år (`tapt/klimaanlegg/sen`)

> I 2024 fikk kjøperen av en Audi A3 ikke medhold etter å ha klaget på feil på klimaanlegget om lag 4 år etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #1644 · 23/15980 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024023944&dokid=1175891&versjon=2&variant=A&)
- **Merk:** Kjøperen hadde leaset bilen som ny før kjøpet.

## Kilometer og servicehistorikk, tapt

### Mer enn 2 år (`tapt/km_service/sen`)

> I 2017 fikk kjøperen av en Mercedes-Benz E-klasse ikke medhold etter å ha klaget på uriktige opplysninger om kilometerstand eller service om lag 5,5 år etter kjøpet. Utvalget kom til at det var klaget for sent.

- **Sak:** #502 · 16/2334 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017005827&dokid=313729&versjon=1&variant=A&)
- **Merk:** Gammelt vedtak (2017), men eneste sak der kilometerstand er selve tvisten. Brukes også som nærmeste eksempel for de to andre tidsrommene.

## Kollisjonsskade, tapt

### Innen 6 måneder (`tapt/skade/rask`)

> I 2022 fikk kjøperen av en Volvo V70 ikke medhold etter å ha klaget på en tidligere kollisjonsskade om lag 4 måneder etter kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #2565 · 21/3925 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2021108977&dokid=566000&versjon=1&variant=A&)
- **Merk:** Utvalget sa at et skjermbytte er påregnelig på en ti år gammel bil.

### 6 måneder til 2 år (`tapt/skade/middels`)

> I 2020 fikk kjøperen av en Toyota Prius ikke medhold etter å ha klaget på en tidligere kollisjonsskade om lag 10 måneder etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #3270 · 19/844 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2019021865&dokid=433301&versjon=1&variant=A&)
- **Merk:** Tidligere drosje. Utvalget kom til resultatet «under tvil».

# Tapt fordi feilen var opplyst

Vises når brukerens sak er svak fordi feilen var opplyst før kjøpet, og bilen er kjøpt før 2024. For kjøp fra 2024 gjelder forbrukerkjøpsloven § 15 annet ledd, og sakene under er avgjort etter den gamle regelen. Bare to feilgrupper har en sak som holder; i de andre ble sakene i realiteten tapt av andre grunner, og da vises den vanlige tapte saken.

### Motor (`opplyst/motor`)

> I 2022 fikk kjøperen av en Audi A5 ikke medhold etter å ha klaget på motorfeil om lag 3 måneder etter kjøpet. Utvalget kom til at kjøperen var gjort kjent med feilen før kjøpet.

- **Sak:** #2482 · 21/4879 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022028279&dokid=640747&versjon=1&variant=A&)
- **Merk:** Opplysningen i annonsen var generell («kjente for å bruke olje»).

### Elektrisk (`opplyst/elektrisk`)

> I 2022 fikk kjøperen av en Ford S-Max ikke medhold etter å ha klaget på elektrisk feil om lag 17 måneder etter kjøpet. Utvalget kom til at kjøperen var gjort kjent med feilen før kjøpet.

- **Sak:** #2165 · 21/11498 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022095914&dokid=789088&versjon=2&variant=A&)
- **Merk:** Dato for klagen framgår ikke; forhandleren oppgir 17 måneder.

# Generelle eksempler (bare «Annet» valgt)

Én vunnet og én tapt sak per tidsrom. Tapt sak for mer enn 2 år finnes ikke; der brukes saken for 6 måneder til 2 år.

### Tapt, innen 6 måneder (`annet-tapt/rask`)

> I 2023 fikk kjøperen av en BMW X3 ikke medhold etter å ha klaget på feil på fordelerkassen dagen etter kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #2050 · 22/3851 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023008584&dokid=850475&versjon=1&variant=A&)
- **Merk:** Feilen er egentlig drivverk, ikke «annet».

### Tapt, 6 måneder til 2 år (`annet-tapt/middels`)

> I 2023 fikk kjøperen av en Volkswagen Passat ikke medhold etter å ha klaget på at firehjulstrekket ikke virket om lag 7 måneder etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #1929 · 22/7518 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023020003&dokid=877078&versjon=1&variant=A&)
- **Merk:** Feilen er egentlig drivverk, ikke «annet».

### Vunnet, innen 6 måneder (`annet-vunnet/rask`)

> I 2025 fikk kjøperen av en Kia Stonic medhold etter å ha klaget på at bilen var ett år eldre enn oppgitt om lag 3 måneder etter kjøpet. Utvalget tilkjente 20 000 kr.

- **Sak:** #1508 · 24/3736 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2025001882&dokid=1269133&versjon=1&variant=A&)

### Vunnet, 6 måneder til 2 år (`annet-vunnet/middels`)

> I 2026 fikk kjøperen av en Mitsubishi Outlander delvis medhold etter å ha klaget på at hengerfestet fra annonsen manglet om lag 6 måneder etter kjøpet. Utvalget tilkjente 20 000 kr.

- **Sak:** #3047 · FKU-2026-11954 · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-11954.pdf)
- **Merk:** Beløpet er prisavslaget alene; gebyret er holdt utenfor. 192 dager.

### Vunnet, mer enn 2 år (`annet-vunnet/sen`)

> I 2023 fikk kjøperen av en BMW 5-serie medhold etter å ha klaget på at bilen var ett år eldre enn oppgitt om lag 2 år etter kjøpet. Utvalget tilkjente 25 000 kr.

- **Sak:** #1936 · 22/5982 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023026224&dokid=891836&versjon=1&variant=A&)
- **Merk:** Forhandleren svarte ikke i saken. Samme tema som eksemplet for innen 6 måneder.

# Slik velges saken som vises

1. Sterk og middels sak gir en vunnet sak, svak sak en tapt. «Ingen sak» gir ikke eksempel.
2. Svak fordi feilen var opplyst (kjøp før 2024): saken fra «Tapt fordi feilen var opplyst», hvis en valgt feilgruppe har en.
3. Samme feilgruppe og samme tidsrom («Ett eksempel»). Med flere feil valgt prøves gruppene i rekkefølgen over.
4. Samme feilgruppe, nærmeste tidsrom («Det nærmeste eksemplet»). 6 måneder til 2 år prøver først innen 6 måneder; de to andre prøver først 6 måneder til 2 år.
5. Generelt eksempel («Ett eksempel fra grunnlaget»).

# Batteri (elbil)

Lagt til etter at knappen «Batteri (elbil)» kom. Databasens feiltype `batteri_elbil` blander elbil- og hybridbatteri med vanlig 12 V startbatteri, så utvelgelsen ble gjort av hånd på de 64 brukbare forhandlersakene (bare 7 har batteri som eneste feil): tre vurderere valgte, tre kontrollerte mot vedtaksteksten.

### Vunnet, innen 6 måneder (`batteri/rask`)

> I 2024 fikk kjøperen av en Tesla Model S medhold etter å ha klaget på feil på elbilbatteriet om lag 5 måneder etter kjøpet. Utvalget kom til at kjøpet kunne heves.

- **Sak:** #1598 · 23/16392 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024044754&dokid=1213139&versjon=1&variant=A&)
- **Merk:** Heving, 299 000 kr (hele kjøpesummen). Forhandleren svarte ikke i saken, så den ble avgjort på kjøperens fremstilling. 144 dager.

### Vunnet, 6 måneder til 2 år og mer enn 2 år

Ingen egen sak; nærmeste tidsrom (innen 6 måneder) brukes. Eneste kandidat for 6 måneder til 2 år var Tesla Model S P85D fra 2025 (#3105), forkastet i kontrollen: beløpet (70 540 kr) gjelder omtrent 15 feil og er delvis avvist, heving ble avslått, og batteriet var allerede byttet.

### Tapt, innen 6 måneder (`tapt/batteri/rask`)

> I 2024 fikk kjøperen av en Citroën C-Zero ikke medhold etter å ha klaget på feil på elbilbatteriet om lag 1 måned etter kjøpet. Utvalget kom til at feilen var noe kjøperen måtte regne med på en bil med den alderen og kjørelengden.

- **Sak:** #1606 · 23/15121 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024035718&dokid=1196919&versjon=2&variant=A&)
- **Merk:** Sju år gammel bil, 99 308 km, 39 950 kr. Forhandleren hevdet at reklamasjonen kom etter mer enn halvannet år; utvalget tok ikke stilling til datoen. Nest-grunn er at kjøperen ikke hadde sakkyndig uttalelse.

### Tapt, 6 måneder til 2 år (`tapt/batteri/middels`)

> I 2023 fikk kjøperen av en Kia Soul ikke medhold etter å ha klaget på feil på elbilbatteriet om lag 10 måneder etter kjøpet. Utvalget kom til at det ikke var vist at bilen hadde en mangel da den ble levert.

- **Sak:** #2090 · 21/16475 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022113882&dokid=828621&versjon=2&variant=A&)
- **Merk:** Importert fra USA, utløpt egen garanti, og en anførsel om 12 V-batteriet ble avvist. Kjernen er traksjonsbatteriet (kapasitet 26 %).

### Tapt, mer enn 2 år (`tapt/batteri/sen`)

> I 2023 fikk kjøperen av en Fiat 500e ikke medhold etter å ha klaget på feil på elbilbatteriet om lag 3 år etter kjøpet. Utvalget kom til at det var klaget for sent.

- **Sak:** #1975 · 22/6397 · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023023457&dokid=885375&versjon=1&variant=A&)
- **Merk:** Første skriftlige kontakt kom 3 år etter kjøpet, men «for sent» gjaldt at kjøperen lot bilen stå minst 2,5 måneder på verksted før selger ble varslet. Setningen kan leses som at tre år i seg selv var for sent. Forkastet i stedet: #1310 (Think City, 2014; bare 698 dager).

### Forkastet i kontrollen

- #2858 (Nissan Leaf, 2021): tvisten gjaldt en påstått feil batteritype, ikke en batterifeil.
- #1829 (Opel Ampera-e, 2023): produsentens tilbakekalling og brannrisiko, ikke en batterifeil.
- #3023 (Toyota Prius, 2026): trolig 12 V-batteri, og bare 5 777 av 13 694 kr gjelder batteriet.
- #844 (Nissan Leaf, 2016): selger var et eiendomsselskap, og saken ble avgjort etter kjøpsloven.
