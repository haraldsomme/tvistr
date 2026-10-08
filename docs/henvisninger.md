# Henvisninger: vedtakene brevet viser til

Brevet viser til ett vedtak, valgt av `velgHenvisning` i `src/lib/vurdering/henvisninger.ts` fra listen `HENVISNINGER`. Denne filen sier hvordan vedtakene ble kurert og kontrollert, hvordan valget skal fungere, og hva som ble forkastet. Hvert vedtak er lest for det utvalget tok stilling til (`sporsmal`), hva det la vekt på (`vekt`, id-er i momentkatalogen), hvorfor (`begrunnelse`), hva kjøperen var gjort kjent med (`opplyst`) og hva kjøperen fikk (`utfall`). Vurderingen viser ikke vedtaket; det gjør bare brevet.

## Valget (fra oktober 2026)

Spesifikasjon: `docs/superpowers/specs/2026-10-08-henvisning-a-fortiori-design.md`. Vedtaket velges ut fra det utvalget la vekt på, holdt opp mot kjøperens svar, og så ut fra fakta, slik at brevet kan si at kjøperens sak står minst like sterkt (a fortiori).

```
velgHenvisning(sak):
  stopp → null
  kandidater = forenlig(h, f)                           // presumsjon og lov
  pool = kandidater med kjøperens hovedspørsmål i h.sporsmal, ellers alle kandidater
  for hvert vedtak:
    mangler  = momenter i h.vekt som ikke er dekket hos kjøperen
    for hvert faktum (alder, km, pris, opplyst, tid) der begge er kjent:
      sterkere (kjøperen står bedre), likt, svakere
  sorter: færrest mangler; flest sterkere − svakere; dekker levering når kjøperen trenger det;
          nærmeste alder; nyeste vedtak
```

- **Hovedspørsmål:** `opplysning` når kjøperen sier at det som ble opplyst var feil, eller feilen ikke er av en type slitasje kan forklare. Ellers `forventning`. `levering` er tilleggsspørsmål når feilen viste seg etter formodningsperioden eller kjøperen har en rapport om at feilen var der før kjøpet.
- **Momenter:** et moment i `vekt` er dekket når kjøperen har et gunstig svar på det.
- **Fakta:** `opplyst` rangeres `ingenting` < `som_den_er` < `feilen_opplyst` (svakeste kjøperstilling sist).
- **Aldri vunnet på en fordel kjøperen mangler.** Endringene i forbrukerkjøpsloven fra 1. januar 2024 gjelder bare avtaler inngått etter den datoen (LOV-2023-06-16-60), og alle styrket kjøperen: formodningsregelen gikk fra 6 måneder til 2 år, og «som den er» virker ikke lenger (§ 15 andre ledd). Derfor: ingen sak vunnet på formodningsregelen for en kjøper uten den, og ingen sak etter ny lov for kjøp før 2024. Basen har ennå ingen brukbare vedtak om kjøp etter 1.1.2024, så alle postene er etter gammel lov.

Valget i koden kommer i en senere oppgave (Task 4); inntil da velger `velgHenvisning` det nyeste forenlige vedtaket.

## Slik ble de valgt (oktober 2026)

1. **Kandidater:** `npm run henvisning-kandidater` hentet de ti nyeste vunne forhandlersakene (personbil og varebil, ikke merket for kontroll) for hver kombinasjon av feilgruppe, tidsrom og aldersgruppe, og for hvert regelgrunnlag.
2. **Utvelgelse og kontroll:** agenter leste kandidatene og valgte vedtak etter kriteriene: kjøperen vant på akkurat denne feilen eller regelen; forhandleren svarte; vanlige mangelsregler, ikke garanti; tid og alder stemmer med teksten; enstemmig og ikke «under tvil»; så nytt som mulig. En uavhengig agent kontrollerte hver påstand mot vedtaksteksten. To poster ble forkastet. Et eget søk fant vedtak om biler på 17–32 år.
3. **Kurering på ny (oktober 2026):** alle 54 vedtak ble lest på nytt av to agenter hver for seg (`scripts/henvisninger-kurering.json`): `sporsmal`, `vekt`, `begrunnelse`, `opplyst`, `tid`, `feil` og `utfall`, med ordrett belegg for hver påstand i `scripts/henvisninger-belegg.json` (nøklene `sporsmal`, `vekt:<id>`, `opplyst` der den ikke er «ingenting», og `utfallsform` for utfallet). Uavhengige kontrollører rettet begrunnelser, momentvalg og tidsangivelser (blant annet #2235, #3067, #3125, #3165, #1967). `pris` hentes fra databasen (`kjopesum_nok`).
4. **Skript:** `npm run sjekk-henvisninger` sjekker id, forhandler, utfall, lenke, dato, ref, organ, lov, formodning, alder, km, pris, at id-ene i `vekt` finnes i `MOMENTER`, at `begrunnelse`, `feil`, `utfall` og `tid` ikke nevner merke, modell, beløp eller forhandlerens navn, at alle tall står i vedtaket, og alle sitater ordrett mot vedtaksteksten. Hvert hovedspørsmål (`forventning`, `opplysning`) må ha minst én post med og én uten formodningsregelen. Det må gi 0 feil.

Brevet oppgir ikke tilkjent beløp, bare type og beregningsmåte (`utfall`).

## Vedtakene, etter feilgruppe

Hver post: `sporsmal` (det utvalget tok stilling til), `vekt` (momentene det la vekt på), `begrunnelse`, `utfall` og fakta (`feil`, `tid`, alder, km, pris, `opplyst`, lov).

### Motor

**#3065 · FKU-2026-66298 · 2026-03-04** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-66298.pdf)

- **Spørsmål:** forventning, levering
- **Vekt:** `positiv_beskrivelse`, `rapport_upaaregnelig`, `slitedel`, `avslo_tilbud`
- **Begrunnelse:** Utvalget la vekt på at salgsannonsen og verkstedkontrollen før kjøpet ga en berettiget forventning om at bilen var i god stand, og at en sakkyndig hadde uttalt at registerkjedet skal vare bilens levetid og at feilen er kjent for modellen. Forhandleren hadde ikke lagt frem noe som viste at feilen ikke forelå ved kjøpet, og hadde bare tilbudt å dekke en del av reparasjonen.
- **Utfall:** prisavslag satt lik reparasjonskostnaden, begrenset til egenandelen kjøperen betalte etter forsikringsoppgjøret
- **Fakta:** slakk i registerkjedet; om lag to måneder etter kjøpet; 7 år, 136 400 km, 195 000 kr; opplyst: `ingenting`; lov: før_2024; formodningsregelen

**#3086 · FKU-2026-104368 · 2026-02-02** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-104368.pdf)

- **Spørsmål:** forventning
- **Vekt:** `rapport_upaaregnelig`, `slitedel`, `avslo_tilbud`
- **Begrunnelse:** Utvalget la vekt på at en sakkyndig hadde uttalt at elmotoren og girkassen forventes å ha vesentlig lengre levetid enn bilens alder og kjørelengde, slik at det ikke var påregnelig å måtte skifte dem. Forhandlerens tilbud om å dele reparasjonskostnaden oppfylte ikke lovens krav til avhjelp.
- **Utfall:** heving av kjøpet
- **Fakta:** ulyd fra lagrene i elmotoren og innvendig feil i reduksjonskassen; om lag ni måneder etter kjøpet; 5 år, 2 079 km, 63 000 kr; opplyst: `ingenting`; lov: før_2024

**#3127 · FKU-2025-61654 · 2025-11-11** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-61654.pdf)

- **Spørsmål:** forventning, levering
- **Vekt:** ingen
- **Begrunnelse:** Utvalget la vekt på at verkstedene hadde dokumentert at bilen var tungstartet og periodisk ikke startet, og at kjøperen klaget på startproblemene tre dager etter kjøpet. Bilen var dermed i dårligere stand enn kjøperen hadde grunn til å forvente, selv om den var solgt «som den er».
- **Utfall:** erstatning for kostnadene til undersøkelse og reparasjon av startproblemene
- **Fakta:** startproblemer; tre dager etter kjøpet; 12 år, 126 269 km, 79 900 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#1758 · FKU-2023-4974 · 2023-10-04** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023069233&dokid=993879&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `positiv_beskrivelse`, `egen_bruk`
- **Begrunnelse:** Utvalget la vekt på at feilen etter formodningsregelen forelå ved leveringen, fordi forhandleren ikke hadde sannsynliggjort at den oppsto senere, og på at annonsen beskrev bilen som pen og velholdt med nylig service og ny registerreim, slik at kjøperen tross alder og kjørelengde ikke hadde grunn til å vente et registerreimhavari. Forhandlerens påstand om at kjøperen hadde oversett et varsellys, var ikke sannsynliggjort.
- **Utfall:** heving av kjøpet og erstatning for undersøkelse og bilberging
- **Fakta:** registerreimhavari med motorskade; om lag halvannen måned etter kjøpet; 14 år, 201 000 km, 61 729 kr; opplyst: `ingenting`; lov: før_2024; formodningsregelen

**#2235 · FKU-2021-8891 · 2022-11-03** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022088606&dokid=772157&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`
- **Begrunnelse:** Utvalget la vekt på at verkstedet hadde konkludert med at turboskaden var en følge av en tidligere reparasjon, og fant derfor at feilen skyldtes annet enn slitasje og bilens alder. En slik skade var ikke påregnelig ved kjøpet, selv om bilen var gammel, langt kjørt og solgt «som den er».
- **Utfall:** erstatning redusert til det utbedringen ville kostet forhandleren, med fradrag for standardheving
- **Fakta:** skadet turbo etter en tidligere reparasjon; om lag åtte måneder etter kjøpet; 14 år, 136 000 km, 37 000 kr; opplyst: `som_den_er`; lov: før_2024

**#465 · FKU-2017-56 · 2017-08-24** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017007533&dokid=313350&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_upaaregnelig`, `rapport_arsak`, `forhandler_annen_arsak`
- **Begrunnelse:** Utvalget la avgjørende vekt på at et merkeverksted hadde funnet at feilen var at festet til en innsprøytningsdyse hadde gitt etter, at feilen ikke var kjent for verkstedet, og at verkstedet ut fra bilens historikk anså den som en monteringsfeil fra fabrikken. Forhandlerens generelle forklaringer på hvorfor dyser svikter, var ikke relevante, og det var ikke grunnlag for at feilen skyldtes bruk og slitasje.
- **Utfall:** erstatning for reparasjonen med skjønnsmessig fradrag for standardheving
- **Fakta:** motorhavari etter at en innsprøytningsdyse løsnet fra festet; om lag to og et halvt år etter kjøpet; 2 år, 50 000 km, 770 000 kr; opplyst: `ingenting`; lov: før_2024

### Elektrisk

**#3053 · FKU-2026-137555 · 2026-03-11** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-137555.pdf)

- **Spørsmål:** opplysning, levering
- **Vekt:** `tidligere_skade_ikke_opplyst`, `rapport_arsak`, `dokument_for_salg`
- **Begrunnelse:** Utvalget la vekt på at en sakkyndig hadde funnet at ledninger til en sensor var kuttet og loddet sammen igjen før kjøperens eiertid, og at kvitteringer for tidligere arbeid viste at problemene hadde gått igjen. Dette var forhold forhandleren som profesjonell part burde kjenne til og opplyse om.
- **Utfall:** heving av kjøpet og erstatning for reparasjon og sakkyndig uttalelse
- **Fakta:** feil i det elektriske anlegget etter tidligere reparasjoner som ikke var faglig utført; rett under tre måneder etter kjøpet; 16 år, 205 000 km, 81 729 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#1525 · FKU-2024-3868 · 2025-01-13** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024064380&dokid=1248687&versjon=2&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `egen_bruk`
- **Begrunnelse:** Utvalget la vekt på at verkstedet hadde funnet en intern elektrisk feil i styreenheten for ryggekameraet som ikke skyldtes manglende programvareoppdatering, og at feilens karakter tilsa at den verken var en brukerfeil eller skyldtes ytre forhold.
- **Utfall:** prisavslag satt lik kostnaden ved å sette inn en brukt styreenhet, og erstatning for undersøkelsen
- **Fakta:** intern elektrisk feil i styreenheten for ryggekameraet; over fire år etter kjøpet; 1 år, 12 000 km, 269 000 kr; opplyst: `ingenting`; lov: før_2024

**#1869 · FKU-2022-10322 · 2023-06-01** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023030866&dokid=902671&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_upaaregnelig`, `rapport_arsak`
- **Begrunnelse:** Utvalget la vekt på at verkstedet hadde uttalt at feilen var en elektrisk feil i sensoren som ikke skyldtes slitasje, og at den ikke var påregnelig for en bil med denne alderen og kjørelengden. Feilen ble derfor ansett som en fabrikasjonsfeil.
- **Utfall:** prisavslag satt lik utbedringskostnadene etter pristilbud
- **Fakta:** intern elektrisk feil i en sensor til klimaanlegget; om lag fem måneder etter kjøpet; 4 år, 35 500 km, 169 000 kr; opplyst: `ingenting`; lov: før_2024; formodningsregelen

**#2837 · FKU-2021-2759 · 2021-03-24** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2021017255&dokid=359852&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `km_etter_kjop`, `positiv_beskrivelse`
- **Begrunnelse:** Utvalget la vekt på at feilene ble påvist etter relativt kort kjørelengde, slik at de sannsynligvis forelå ved kjøpet, og at annonsen beskrev bilen som godt vedlikeholdt og nevnte utstyret som sviktet. Kjøperen kunne derfor forvente at bilen ikke hadde et umiddelbart utbedringsbehov av denne størrelsen, selv om den var solgt «som forevist».
- **Utfall:** prisavslag fastsatt skjønnsmessig
- **Fakta:** feil på parkeringsvarmer og varsellys; i overkant av sju måneder etter kjøpet; 7 år, 136 000 km, 147 000 kr; opplyst: `som_den_er`; lov: før_2024

**#1355 · FTU-2014-164 · 2014-04-11** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2014006347&dokid=151734&versjon=10&variant=P&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`, `avslo_tilbud`
- **Begrunnelse:** Utvalget la vekt på at verkstedet hadde funnet at motorstoppet skyldtes vanninntrenging i el-boksen som følge av at bilen var chipet, og at skadens omfang tilsa at den ikke kunne ha oppstått etter kjøpet. Forhandleren hadde avvist ansvar og verken tilbudt eller utført retting.
- **Utfall:** erstatning og prisavslag satt lik de dokumenterte reparasjonskostnadene
- **Fakta:** vanninntrenging i el-boksen som skadet ledningsnettet og motorstyreenheten; i overkant av åtte måneder etter kjøpet; 8 år, 118 642 km, 315 000 kr; opplyst: `ingenting`; lov: før_2024

### Understell og hjul

**#3067 · FKU-2026-77134 · 2026-03-11** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-77134.pdf)

- **Spørsmål:** opplysning, levering
- **Vekt:** `bruksstans_sikkerhet`
- **Begrunnelse:** Utvalget la vekt på at en test fire måneder etter kjøpet viste en rekke feil og at bilen var trafikkfarlig, og at forhandleren burde ha undersøkt bilen før salget og opplyst kjøperen om tilstanden. Feilene viste seg innen seks måneder, og forhandleren hadde ikke sannsynliggjort at de oppsto senere.
- **Utfall:** heving av kjøpet
- **Fakta:** slitte bremser, virkningsløs parkeringsbrems, korrosjon i bærearmene og flere andre feil; innen fire måneder etter kjøpet; 14 år, 178 800 km, 59 729 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#3170 · FKU-2025-140833 · 2025-05-21** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-140833.pdf)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`, `rapport_upaaregnelig`, `slitedel`
- **Begrunnelse:** Utvalget la vekt på at en sakkyndig hadde funnet en sprekk i tannstangen med materialtretthet eller produksjonsfeil som sannsynlig årsak, og at delen er ment å vare vesentlig lengre. Feilen skyldtes derfor ikke normal slitasje eller forhold etter leveringen.
- **Utfall:** erstatning for utbedringskostnadene og utgiftene til sakkyndige uttalelser
- **Fakta:** sprekk i tannstangen i styringen; om lag 22 måneder etter kjøpet; 4 år, 61 200 km, 545 000 kr; opplyst: `ingenting`; lov: før_2024

### Kilometer og servicehistorikk

**#3040 · FKU-2026-28973 · 2026-04-29** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-28973.pdf)

- **Spørsmål:** opplysning
- **Vekt:** `uriktig_service_arbeid_utstyr`, `verditap_dokumentert`
- **Begrunnelse:** Utvalget la vekt på at annonsen opplyste om full servicehistorikk, mens et testsenter fant at service etter bilens intervaller ikke var fulgt. Prisavslaget ble satt etter en uttalelse fra en forhandler om hvor mye den manglende servicehistorikken trakk ned innbytteverdien.
- **Utfall:** prisavslag satt lik verditapet en forhandler anslo ved innbytte
- **Fakta:** ufullstendig servicehistorikk; om lag 17 måneder etter kjøpet; 5 år, 88 000 km, 500 000 kr; opplyst: `som_den_er`; lov: før_2024

**#3081 · FKU-2026-73613 · 2026-02-18** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-73613.pdf)

- **Spørsmål:** opplysning
- **Vekt:** `uriktig_service_arbeid_utstyr`
- **Begrunnelse:** Utvalget la vekt på at annonsen sa at serviceprogrammet var fulgt etter fabrikkens retningslinjer, noe som ga inntrykk av komplett servicehistorikk, mens servicehistorikken ikke var komplett. Forhandleren hadde ikke dokumentert at de manglende servicene var unødvendige.
- **Utfall:** prisavslag fastsatt skjønnsmessig
- **Fakta:** ufullstendig servicehistorikk; om lag fem uker etter kjøpet; 5 år, 35 000 km, 382 000 kr; opplyst: `ingenting`; lov: før_2024; formodningsregelen

**#3141 · FKU-2025-115321 · 2025-09-17** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-115321.pdf)

- **Spørsmål:** opplysning
- **Vekt:** `uriktig_service_arbeid_utstyr`
- **Begrunnelse:** Utvalget la vekt på at annonsen sa at registerreimen var skiftet og at det nylig var tatt stor service, mens en test viste at registerreimen var like gammel som bilen og dokumentasjon på den store servicen manglet. Forhandleren var nærmest til å legge frem dokumentasjon på arbeidet.
- **Utfall:** prisavslag fastsatt skjønnsmessig og erstatning for skifte av registerreimen, uten deler kjøperen ikke hadde krav på
- **Fakta:** registerreimen var ikke skiftet, og dokumentasjon på stor service manglet; om lag fire måneder etter kjøpet; 10 år, 126 000 km, 199 995 kr; opplyst: `ingenting`; lov: før_2024; formodningsregelen

**#1941 · FKU-2021-16984 · 2023-04-19** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023009979&dokid=853932&versjon=2&variant=A&)

- **Spørsmål:** opplysning
- **Vekt:** `uriktig_service_arbeid_utstyr`
- **Begrunnelse:** Utvalget la vekt på at opplysningen om servicehistorikk i annonsen måtte forstås slik at serviceintervallene var overholdt, mens servicene ikke var utført etter fabrikkens intervaller.
- **Utfall:** prisavslag fastsatt skjønnsmessig
- **Fakta:** servicehistorikken fulgte ikke fabrikkens intervaller; om lag to år og fem måneder etter kjøpet; 2 år, 66 850 km, 214 900 kr; opplyst: `ingenting`; lov: før_2024

**#1992 · FKU-2022-2868 · 2023-03-22** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023006127&dokid=845007&versjon=1&variant=A&)

- **Spørsmål:** opplysning
- **Vekt:** `uriktig_service_arbeid_utstyr`
- **Begrunnelse:** Utvalget la vekt på at annonsen opplyste om komplett servicehefte, slik at kjøperen hadde grunn til å regne med at produsentens serviceprogram var fulgt, mens serviceheftet viste at det ikke var anmerket service på flere år og forhandleren ikke dokumenterte annet. Opplysninger om servicehistorikk er sentrale ved kjøp av bruktbil og må antas å ha virket inn på kjøpet.
- **Utfall:** prisavslag fastsatt skjønnsmessig i mangel av dokumentasjon på verditapet
- **Fakta:** uriktig opplysning i annonsen om komplett servicehefte; drøyt halvannet år etter kjøpet; 10 år, 106 500 km, 100 000 kr; opplyst: `ingenting`; lov: før_2024

**#10 · FKU-2021-9897 · 2023-02-01** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023000879&dokid=832691&versjon=1&variant=A&)

- **Spørsmål:** opplysning
- **Vekt:** `uriktig_service_arbeid_utstyr`, `rettet_for_kjop`
- **Begrunnelse:** Utvalget la vekt på at annonsens opplysning om at servicehistorikken var fulgt, ga uttrykk for at serviceintervallene var overholdt, mens servicene i serviceheftet ikke fulgte intervallene. Et generelt forbehold om feil i annonsen var ikke tilstrekkelig til å rette opplysningen. Kjøperen hadde etter annonsen ingen oppfordring til å undersøke serviceheftet nærmere.
- **Utfall:** prisavslag fastsatt skjønnsmessig
- **Fakta:** servicehistorikken var ikke fulgt slik annonsen opplyste; om lag 14 måneder etter kjøpet; 8 år, 138 940 km, 65 000 kr; opplyst: `ingenting`; lov: før_2024

**#2475 · FKU-2021-4002 · 2022-04-27** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022028900&dokid=642081&versjon=1&variant=A&)

- **Spørsmål:** opplysning
- **Vekt:** `uriktig_service_arbeid_utstyr`
- **Begrunnelse:** Utvalget la vekt på at annonsen opplyste om nylig bytte av registerreim og vannpumpe, at en sakkyndig ikke fant holdepunkter for at byttet var gjort, og at forhandleren ikke hadde lagt frem dokumentasjon på arbeidet. Opplysningen var derfor uriktig og hadde innvirket på kjøpet.
- **Utfall:** prisavslag fastsatt skjønnsmessig ut fra bilens alder og kilometerstand, og erstatning for utgiftene til NAF-test
- **Fakta:** uriktige opplysninger om bytte av registerreim og vannpumpe; knapt en måned etter kjøpet, ved NAF-test; 31 år, 306 000 km, 47 000 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#357 · FKU-2017-805 · 2017-11-30** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017019947&dokid=326900&versjon=1&variant=A&)

- **Spørsmål:** opplysning
- **Vekt:** ingen
- **Begrunnelse:** Utvalget la vekt på at det var sannsynliggjort at kilometertelleren var manipulert, at bilens reelle kilometerstand var høyst uklar og utgjorde et salgslyte, og at kilometerstanden er en sentral opplysning ved bruktbilkjøp der avviket måtte anses betydelig.
- **Utfall:** prisavslag fastsatt skjønnsmessig etter en helhetsvurdering
- **Fakta:** tilbakestilt kilometerteller med et betydelig avvik; innen fem måneder etter kjøpet; 24 år, 201 500 km, 91 000 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

### Rust

**#1579 · FKU-2024-81 · 2024-09-18** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024047333&dokid=1217790&versjon=1&variant=A&)

- **Spørsmål:** levering
- **Vekt:** `forhandler_erkjente`, `rust_baerende`
- **Begrunnelse:** Utvalget la vekt på at verkstedenes uttalelser, at rustskader oppstår over tid og at feilen ble konstatert kort tid etter overtakelsen, viste at skadene forelå ved leveringen, og at forhandleren hadde erkjent mangelen ved å gjennomføre et utbedringsforsøk for egen regning uten forbehold. Heving ble begrunnet med at skadene i bærende struktur var så alvorlige at reparasjon ville koste mer enn bilen var verdt.
- **Utfall:** heving av kjøpet
- **Fakta:** omfattende rust i bakre hjulbuer, hjulhus og dempertårn; om lag tre måneder etter kjøpet; 18 år, 114 000 km, 57 000 kr; opplyst: `ingenting`; lov: før_2024; formodningsregelen

**#1689 · FKU-2023-10066 · 2024-02-05** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023109660&dokid=1089894&versjon=2&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_upaaregnelig`
- **Begrunnelse:** Utvalget la vekt på uttalelser fra to verksteder om at rusten var til stede ved kjøpet og var upåregnelig sett hen til bilens alder og kilometerstand.
- **Utfall:** erstatning for reparasjonen av bremsene og prisavslag satt lik utbedringskostnadene for dørene
- **Fakta:** rust på bremsecalipere, bremserør og nedre kant av dørene; om lag fire måneder etter kjøpet; 7 år, 179 800 km, 540 500 kr; opplyst: `ingenting`; lov: før_2024; formodningsregelen

**#2102 · FKU-2021-17769 · 2023-01-18** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022109676&dokid=819450&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `tidligere_skade_ikke_opplyst`, `rust_baerende`
- **Begrunnelse:** Utvalget la vekt på omfanget av rusten, at skum i bærende deler var overmalt, og at bilens historikk ble bekreftet av en tidligere eier, slik at skummet og rusten var der ved overtakelsen. Omfanget gikk betydelig ut over det kjøperen hadde grunn til å forvente, også for en gammel og langt kjørt bil som ikke var solgt «som den er».
- **Utfall:** heving av kjøpet
- **Fakta:** for stor korrosjon i rammebjelke og innerskjermer, reparert med overmalt skum; om lag 17 måneder etter kjøpet; 17 år, 233 000 km, 75 000 kr; opplyst: `ingenting`; lov: før_2024

**#2612 · FKU-2021-4203 · 2021-12-01** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2021095135&dokid=537047&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`, `rust_baerende`, `bruksstans_sikkerhet`
- **Begrunnelse:** Utvalget la vekt på at sakkyndige uttalte at rusten hadde oppstått over tid og ikke kunne ha kommet etter kjøpet, og at skadene, med gjennomrustede hull og komponenter som var rustet løs, var så omfattende at de ga en trafikksikkerhetsrisiko og nesten kostet bilens verdi å utbedre. Det gikk ut over det kjøperen måtte regne med, selv om alder og kjørelengde tilsa noe rust og forhandleren hadde opplyst om rustskader.
- **Utfall:** heving av kjøpet
- **Fakta:** omfattende rust i ramme, tverrbjelke og bremserør med gjennomrustede hull; om lag halvannet år etter kjøpet, ved EU-kontroll; 16 år, 191 397 km, 80 000 kr; opplyst: `feilen_opplyst`; lov: før_2024

**#2694 · FKU-2021-4419 · 2021-10-13** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2021075274&dokid=489776&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`, `rust_baerende`
- **Begrunnelse:** Utvalget la vekt på at en verkstedrapport uttalte at de store rustskadene i bærende deler hadde kommet over tid og var der da kjøperen kjøpte bilen, slik at rusten kunne knyttes til leveringen. Selv om noe rust må påregnes på en så gammel bil, gikk skader av dette omfanget ut over det kjøperen hadde grunn til å forvente når forhandleren bare hadde opplyst om kosmetiske feil og dårlige bremser.
- **Utfall:** heving av kjøpet
- **Fakta:** store rustskader i bærende deler av for- og bakstilling; nesten åtte måneder etter kjøpet, ved periodisk kontroll; 11 år, 186 000 km, 82 219 kr; opplyst: `ingenting`; lov: før_2024

**#3294 · FKU-2019-748 · 2020-02-26** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2020001273&dokid=433590&versjon=1&variant=A&)

- **Spørsmål:** opplysning, levering
- **Vekt:** `skjult_feil`
- **Begrunnelse:** Utvalget la vekt på at rusten ble oppdaget så kort tid etter leveringen at den sannsynligvis var der ved kjøpet, og at den ikke var lett å oppdage ved en rask undersøkelse. Forhandleren burde som profesjonell part kjenne til rustskadene og opplyse om dem.
- **Utfall:** prisavslag fastsatt skjønnsmessig
- **Fakta:** rust rundt skiltlysene på bakluken; dagen etter kjøpet; 3 år, 136 500 km, 285 000 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#3387 · FKU-2019-432 · 2019-06-27** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2019008533&dokid=410376&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`, `skjult_feil`
- **Begrunnelse:** Utvalget la vekt på at en sakkyndig etter undersøkelse med lupe fant at rustboblene i hovedsak kom fra innsiden, fra en urenhet i platen eller slipp i sinkbelegget, og at et verksted opplyste at slik feil ikke kan oppdages før lakken begynner å boble. Rusten skyldtes derfor mest sannsynlig en latent feil som forelå ved leveringen.
- **Utfall:** prisavslag satt lik kostnaden ved ny bakluke
- **Fakta:** rustbobler på bakluken fra innsiden av platen; i overkant av sju måneder etter kjøpet; 6 år, 62 600 km, 247 000 kr; opplyst: `ingenting`; lov: før_2024

**#224 · FKU-2018-809 · 2018-12-05** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2018019439&dokid=382372&versjon=1&variant=A&)

- **Spørsmål:** opplysning, levering
- **Vekt:** `positiv_beskrivelse`, `rapport_arsak`, `rettet_for_kjop`
- **Begrunnelse:** Utvalget la vekt på at annonsen, som var en del av avtalegrunnlaget, opplyste at bilen var fri for rust, mens en verkstedrapport sannsynliggjorde at bilen ved levering hadde store rustskader og en feil utbedret kollisjonsskade som førte til vannlekkasje. Forhandleren hadde verken rettet opplysningen før kjøpet eller sannsynliggjort at den ikke hadde virket inn.
- **Utfall:** heving av kjøpet og erstatning for sakkyndig undersøkelse
- **Fakta:** omfattende rust i hjulhus og gulv og en feil utbedret kollisjonsskade som ga vannlekkasje; om lag fire måneder etter kjøpet; 28 år, 166 000 km, 215 000 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#438 · FKU-2017-217 · 2017-09-21** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017006830&dokid=297713&versjon=1&variant=A&)

- **Spørsmål:** forventning
- **Vekt:** `positiv_beskrivelse`, `rust_baerende`, `bruksstans_sikkerhet`
- **Begrunnelse:** Utvalget la vekt på at bilen var EU-godkjent uten feil to dager etter kjøpet, slik at kjøperen hadde en berettiget forventning om at den ikke hadde umiddelbare reparasjonsbehov, og at kontrollen to måneder senere påviste alvorlig rust på bremserør, bærearmer og bakaksel og avskiltet bilen som trafikkfarlig.
- **Utfall:** heving av kjøpet og erstatning for bortkastede utgifter
- **Fakta:** alvorlig rust på bremserør, bærearmer og bakaksel; om lag to måneder etter kjøpet, ved kontroll hos Statens vegvesen; 22 år, 260 841 km, 49 000 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#606 · FKU-2016-1844 · 2017-04-25** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017001606&dokid=288585&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_upaaregnelig`
- **Begrunnelse:** Utvalget la vekt på at en sakkyndig hadde uttalt at skadene ikke skyldtes ytre påvirkning og var unormale sett i forhold til alder og kjørelengde. Selv om uttalelsen var kort og det var gått nær tre år, fant utvalget det mer sannsynlig at rusten skyldtes en svakhet som forelå ved leveringen, enn forhold på kjøperens side.
- **Utfall:** prisavslag satt lik utbedringskostnadene
- **Fakta:** rust i panser, tak, dører og bakskjerm; nær tre år etter kjøpet; 3 år, 42 855 km, 344 900 kr; opplyst: `ingenting`; lov: før_2024

**#967 · FTU-2015-1829 · 2016-03-31** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2016002708&dokid=217840&versjon=2&variant=P&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rust_baerende`, `bruksstans_sikkerhet`, `positiv_beskrivelse`
- **Begrunnelse:** Utvalget la vekt på at EU-kontrollen sannsynliggjorde at bilen allerede ved kjøpet hadde alvorlige rustskader i understellet som gjorde den trafikkfarlig, og at annonsen ga kjøperen grunn til å tro at reparasjonsbehovet gjaldt startvanskene og at bilen ellers var i normal stand. Det lå da ikke innenfor det påregnelige, selv for et reparasjonsobjekt, at bilen ikke kunne godkjennes uten uforholdsmessige kostnader.
- **Utfall:** heving av kjøpet med skjønnsmessig fradrag for bruken
- **Fakta:** alvorlig korrosjon i understell og bærende deler og korroderte bremserør; om lag åtte måneder etter kjøpet, ved EU-kontroll; 17 år, 287 000 km, 17 000 kr; opplyst: `som_den_er`; lov: før_2024

### Bremser

**#2184 · FKU-2021-12654 · 2022-11-30** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022099685&dokid=796852&versjon=2&variant=A&)

- **Spørsmål:** forventning
- **Vekt:** `bruksstans_sikkerhet`, `positiv_beskrivelse`
- **Begrunnelse:** Utvalget la vekt på at bremsene var helt nedslitt med umiddelbart behov for utskifting, slik at bilen ikke var i kjørbar stand, og at bilen var beskrevet som velholdt. Selv om bremser i utgangspunktet er slitedeler, lå dette utenfor det kjøperen kunne forvente, også etter et «as is»-forbehold på en gammel bil med høy kjørelengde.
- **Utfall:** erstatning for utskifting av bremseskiver og bremseklosser
- **Fakta:** helt nedslitte bremser foran; en uke etter kjøpet; 18 år, 180 000 km, 38 500 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#2298 · FKU-2021-4001 · 2022-09-28** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022059346&dokid=705701&versjon=1&variant=A&)

- **Spørsmål:** forventning
- **Vekt:** `positiv_beskrivelse`
- **Begrunnelse:** Utvalget la vekt på at annonsen sa at bilen nylig var EU-godkjent og hadde fått nye bremser, noe som ga kjøperen en berettiget forventning om at bremsene var godkjent for bilen. At kjøperen visste at bremsene var hentet fra en annen modell, endret ikke dette.
- **Utfall:** erstatning for utbedringskostnadene
- **Fakta:** uoriginale bremser som ikke var godkjent for bilen; om lag sju måneder etter kjøpet; 37 år, 143 000 km, 370 000 kr; opplyst: `som_den_er`; lov: før_2024

**#265 · FKU-2018-219 · 2018-06-20** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2018009312&dokid=361108&versjon=1&variant=A&)

- **Spørsmål:** forventning
- **Vekt:** `positiv_beskrivelse`
- **Begrunnelse:** Utvalget la vekt på at bilen ble markedsført som «nybil» og «100 % strøken», var to år gammel, hadde gått under 60 000 km og hadde en høy kjøpesum, slik at det var upåregnelig at bremsene måtte skiftes under en måned etter kjøpet.
- **Utfall:** erstatning for utbedringskostnadene med halvparten trukket fra for standardheving
- **Fakta:** kast og rust i alle bremseskivene; under en måned etter kjøpet; 1 år, 56 633 km, 468 900 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

### Girkasse og clutch

**#1600 · FKU-2023-16164 · 2024-08-14** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024038848&dokid=1202556&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `slitedel`, `rapport_arsak`
- **Begrunnelse:** Utvalget la vekt på at en sakkyndig rapport viste at boltene til drivakselen hadde løsnet og falt ut over tid, og at drivakselen ikke er en typisk slitedel som det er påregnelig å måtte bytte ved denne kilometerstanden. Feilen viste seg innen seks måneder, og unntakene fra formodningsregelen var ikke anvendelige.
- **Utfall:** heving av kjøpet
- **Fakta:** drivakselen løsnet og slo hull i girkassen; om lag tre måneder etter kjøpet; 13 år, 97 000 km, 79 000 kr; opplyst: `ingenting`; lov: før_2024; formodningsregelen

**#1776 · FKU-2022-906 · 2023-09-06** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023072630&dokid=1002019&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`, `rapport_upaaregnelig`
- **Begrunnelse:** Utvalget la vekt på at en sakkyndig uttalelse konkluderte med at ulyden skyldtes skade på hovedlagrene i girkassen, at slik ulyd ikke var vanlig for en bil med denne kjørelengden og fulgt service, og at feilen måtte ha vært til stede ved kjøpet.
- **Utfall:** prisavslag fastsatt skjønnsmessig ut fra bilens alder og kjøpesum, og erstatning for utgiftene til sakkyndig uttalelse
- **Fakta:** skade på hovedlagrene i girkassen og oljelekkasje fra motoren; knapt sju måneder etter kjøpet, etter om lag 3 400 km; 9 år, 125 000 km, 55 400 kr; opplyst: `som_den_er`; lov: før_2024

**#1905 · FKU-2022-4730 · 2023-05-03** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023028760&dokid=897733&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `positiv_beskrivelse`, `slitedel`, `rapport_upaaregnelig`
- **Begrunnelse:** Utvalget la vekt på at forhandleren før kjøpet opplyste at bilen var velholdt og hadde god servicehistorikk, og at kjøperen hadde dokumentert at mekatronikken ikke er en slitedel og at feilen mest sannsynlig var en iboende svakhet. Feilen viste seg innen seks måneder, og forhandleren hadde ikke sannsynliggjort at den ikke forelå ved leveringen.
- **Utfall:** erstatning for reparasjonen med skjønnsmessig fradrag for standardheving
- **Fakta:** feil på girkassens mekatronikk; to måneder etter kjøpet; 6 år, 145 000 km, 129 000 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#2316 · FKU-2021-6457 · 2022-09-21** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022071563&dokid=732899&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_upaaregnelig`, `slitedel`, `bruksstans_sikkerhet`
- **Begrunnelse:** Utvalget la vekt på sakkyndige uttalelser om at det var unormal slitasje på deler som ved normal bruk og vedlikehold har vesentlig lengre levetid, og at feilen derfor mest sannsynlig hadde begynt før kjøpet. Girkassen og clutchen er nødvendige for at bilen skal fungere.
- **Utfall:** heving av kjøpet og erstatning for undersøkelse og sakkyndig vurdering
- **Fakta:** unormal slitasje i girkassen og ulyd fra clutchen; om lag 14 måneder etter kjøpet; 7 år, 94 000 km, 79 900 kr; opplyst: `som_den_er`; lov: før_2024

**#551 · FKU-2016-2138 · 2017-06-01** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017002902&dokid=303020&versjon=2&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`, `rapport_upaaregnelig`, `forhandler_annen_arsak`
- **Begrunnelse:** Utvalget la vekt på at grundige og godt begrunnede sakkyndige uttalelser viste at lagrene i fordelerkassen var montert for trangt, slik at feilen var en fabrikasjonsfeil som forelå ved leveringen og ikke påregnelig slitasje, og at forhandleren ikke hadde lagt frem noen sakkyndig uttalelse om bilen som trakk i en annen retning.
- **Utfall:** erstatning for reparasjonen uten fradrag for standardheving, og for utgifter til feilsøking og reise
- **Fakta:** skadde lagre i fordelerkassen fordi lagrene var montert for trangt; våren 2016, drøyt to år etter kjøpet; 3 år, 74 064 km, 430 000 kr; opplyst: `ingenting`; lov: før_2024

**#805 · FTU-2016-736 · 2016-09-30** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2016020203&dokid=247228&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `positiv_beskrivelse`, `rapport_arsak`, `km_etter_kjop`, `bruksstans_sikkerhet`
- **Begrunnelse:** Utvalget la vekt på at girkassefeilen etter uttalelsene mest sannsynlig skyldtes kjøring med for lite olje over tid, og at den oppsto under to måneder etter overtakelsen og etter kort kjøring, slik at den kunne føres tilbake til kjøpet. Avgjørende vekt fikk annonsens rosende omtale av bilen som servicefulgt og godt vedlikeholdt, og feilen gjorde bilen ukjørbar.
- **Utfall:** heving av kjøpet og erstatning for transport av bilen
- **Fakta:** feil i girkassen etter kjøring med for lite olje over tid; i underkant av to måneder etter kjøpet, etter om lag 1 000 km; 26 år, 140 000 km, 26 000 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

### Fukt og lekkasje

**#3129 · FKU-2025-136079 · 2025-05-26** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-136079.pdf)

- **Spørsmål:** opplysning, forventning, levering
- **Vekt:** `uriktig_service_arbeid_utstyr`, `rettet_for_kjop`, `bruksstans_sikkerhet`
- **Begrunnelse:** Utvalget la vekt på at bilen manglet en funksjon som var særskilt fremhevet i annonsen, uten at opplysningen var rettet før kjøpet, og på at vann i frontlyktene, som etter formodningsregelen forelå ved leveringen, gikk ut over det en kjøper av en fire år gammel bil kunne forvente og gjorde at bilen ikke kunne brukes lovlig.
- **Utfall:** heving av kjøpet
- **Fakta:** vann og is i frontlyktene, manglende hev- og senkfunksjon som var annonsert, og skadde vinterfelger; noen dager etter overtakelsen (annonsert utstyr manglet); om lag fire måneder etter kjøpet ved periodisk kjøretøykontroll (vann i frontlyktene); 4 år, 108 000 km, 410 000 kr; opplyst: `ingenting`; lov: før_2024; formodningsregelen

**#1916 · FKU-2022-4734 · 2023-04-26** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023028939&dokid=898144&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`, `tidligere_skade_ikke_opplyst`, `forhandler_annen_arsak`
- **Begrunnelse:** Utvalget la vekt på at feilen etter formodningsregelen forelå ved leveringen, og på at verkstedet dokumenterte sammenhengen mellom en feilmontert uoriginal frontrute, vannlekkasjen og feilen i det elektriske anlegget. Når ikke annet var opplyst, kunne kjøperen forvente at tidligere reparasjoner var utført forsvarlig, og forhandleren hadde ikke sannsynliggjort at feilen ville vist seg tidligere.
- **Utfall:** erstatning for reparasjonen av det elektriske anlegget
- **Fakta:** vannlekkasje ved feilmontert frontrute som ga feil på det elektriske anlegget; om lag fem måneder etter kjøpet; 8 år, 118 000 km, 159 900 kr; opplyst: `ingenting`; lov: før_2024; formodningsregelen

**#2355 · FKU-2021-5035 · 2022-08-31** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022056587&dokid=700048&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`, `egen_bruk`
- **Begrunnelse:** Utvalget la vekt på at to verksteder hadde påvist en lekkasje fra taket, at det ikke var å forvente en feil av en slik karakter på en relativt ny bil med lav kilometerstand, og at det ikke var holdepunkter for at feilen kunne knyttes til kjøperens bruk.
- **Utfall:** prisavslag satt lik utbedringskostnadene, og erstatning for utgiftene til feilsøking
- **Fakta:** vannlekkasje fra fugemassen i taket med fukt og rust i bagasjerommet; vinteren 2019/2020, om lag 21 måneder etter kjøpet; 4 år, 34 250 km, 149 000 kr; opplyst: `ingenting`; lov: før_2024

**#3470 · FKU-2019-116 · 2019-04-25** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2019004189&dokid=401510&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`, `rapport_upaaregnelig`
- **Begrunnelse:** Utvalget la vekt på at det var dokumentert at limet på den originale frontruten hadde løsnet, og at en sakkyndig uttalte at dette var en fabrikasjonsfeil fordi limet ikke skal løsne. På bakgrunn av den vurderingen fant utvalget at feilen forelå ved leveringen, selv om den viste seg drøye to år etter kjøpet.
- **Utfall:** erstatning for ny frontrute og skjønnsmessig erstatning for rens av taket
- **Fakta:** løsnet lim på den originale frontruten som ga vannlekkasje; drøye to år etter kjøpet; 4 år, 57 000 km, 130 000 kr; opplyst: `ingenting`; lov: før_2024

**#911 · FTU-2016-176 · 2016-04-15** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2016007477&dokid=224502&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_arsak`, `tidlige_tegn`, `egen_bruk`, `positiv_beskrivelse`, `bruksstans_sikkerhet`
- **Begrunnelse:** Utvalget la vekt på at verkstedets uttalelser om at lekkasjen kom fra frontruten trakk klart i retning av at årsaken forelå ved leveringen, at kjøperen beviselig hadde reklamert på feil ved lysene noen uker etter overtakelsen, og at ingenting tydet på forhold på kjøperens side. I lys av at bilen var annonsert som velholdt, var den i dårligere stand enn kjøperen hadde grunn til å forvente. Hevingen ble begrunnet med at bilen ikke var kjørbar og at utbedringen var kostbar.
- **Utfall:** heving av kjøpet med skjønnsmessig fradrag for bruken, og erstatning for utgiftene til verkstedundersøkelse
- **Fakta:** vannlekkasje fra frontruten med følgefeil på det elektriske anlegget; om lag ni måneder etter kjøpet, med feil ved lysene noen uker etter overtakelsen; 11 år, 247 300 km, 100 000 kr; opplyst: `ingenting`; lov: før_2024

### Klimaanlegg

**#3165 · FKU-2025-141296 · 2025-06-23** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-141296.pdf)

- **Spørsmål:** forventning, levering
- **Vekt:** `positiv_beskrivelse`
- **Begrunnelse:** Utvalget la vekt på at feilene etter formodningsregelen forelå ved leveringen, og at kjøperen, selv med et alminnelig «som den er»-forbehold på en gammel bil med høy kjørelengde, i det minste kunne forvente at utstyret som var oppført i annonsen, fungerte ved overtakelsen. Øvrige feil var normal slitasje eller opplyst før kjøpet.
- **Utfall:** prisavslag fastsatt skjønnsmessig ut fra et rimeligere tilbud med brukte deler, og erstatning for utgiftene til NAF-test
- **Fakta:** klimaanlegg, hengerfeste, xenonlys og ryggekamera som var oppført i annonsen, virket ikke; under én måned etter kjøpet; 12 år, 205 287 km, 213 000 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#1566 · FKU-2024-1215 · 2024-10-09** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024042231&dokid=1208671&versjon=1&variant=A&)

- **Spørsmål:** opplysning, forventning, levering
- **Vekt:** `dokument_for_salg`, `slitedel`, `egen_bruk`
- **Begrunnelse:** Utvalget la vekt på at feilene etter formodningsregelen forelå ved leveringen, at feilen ved klimaanlegget og oljelekkasjen var bemerket i en tilstandsrapport fra før kjøpet uten at kjøperen ble opplyst om dem, og at vannpumpen sviktet lenge før anbefalt bytteintervall uten holdepunkter for forhold på kjøperens side.
- **Utfall:** erstatning for utbedringene og for utgiftene til sakkyndige uttalelser
- **Fakta:** defekt kompressor i klimaanlegget, lekkende vannpumpe og sprukket bunnpanne med oljelekkasje; om lag sju uker etter kjøpet (klimaanlegget); vannpumpen kort tid etter overtakelsen; 6 år, 109 600 km, 129 000 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#2510 · FKU-2021-4356 · 2022-03-23** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022017294&dokid=617370&versjon=1&variant=A&)

- **Spørsmål:** forventning, levering
- **Vekt:** `rapport_upaaregnelig`, `slitedel`, `forhandler_annen_arsak`
- **Begrunnelse:** Utvalget la vekt på at kjøperen av en to år gammel bil med lav kjørelengde hadde grunn til å forvente at den var i rimelig god stand, at verkstedet mente delene burde vare mer enn fem år, slik at feilen ikke knyttet seg til en slitedel, og at det ikke var holdepunkter for forhandlerens påstand om ytre påvirkning.
- **Utfall:** erstatning for reparasjon, nødvendig feilsøking og fremtidig reparasjon etter tilbud, uten utgifter til vanlig service
- **Fakta:** defekte trykksensorer og lekkasje fra ekspansjonsventil og pakninger i klimaanlegget; drøyt to år etter kjøpet, ved årlig service; 2 år, 9 990 km, 265 000 kr; opplyst: `ingenting`; lov: før_2024

### Tidligere skade

**#3125 · FKU-2025-55355 · 2025-10-01** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-55355.pdf)

- **Spørsmål:** opplysning, forventning, levering
- **Vekt:** `rapport_arsak`, `uriktig_service_arbeid_utstyr`, `rettet_for_kjop`, `positiv_beskrivelse`
- **Begrunnelse:** Utvalget la vekt på at skaden etter formodningsregelen og en skadetakst om at den oppsto før kjøpet forelå ved leveringen, og at en tidligere kollisjonsskade ikke er slitasje som må påregnes ut fra alder og kilometerstand. For utstyret og dekkene la utvalget vekt på at annonsen listet opp utstyret og lovet «gode dekk», og at et generelt forbehold om feil i annonsen ikke rettet opplysningene på en tydelig måte.
- **Utfall:** prisavslag satt lik utbedringskostnadene for skaden og det manglende utstyret, skjønnsmessig prisavslag for utstyr som ikke kan ettermonteres, og erstatning for dekk med fradrag for standardheving
- **Fakta:** tidligere kollisjonsskade foran, manglende annonsert utstyr og slitte vinterdekk; om lag seks uker etter kjøpet; 7 år, 171 000 km, 150 000 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#3143 · FKU-2025-116737 · 2025-08-27** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-116737.pdf)

- **Spørsmål:** opplysning
- **Vekt:** `tidligere_skade_ikke_opplyst`, `uriktig_service_arbeid_utstyr`
- **Begrunnelse:** Utvalget la vekt på at forhandleren hadde unnlatt å opplyse om at bilen tidligere hadde hatt omfattende skader, og at dokumenter i bilens dokumentmappe ikke var nok til at kjøperen hadde fått denne informasjonen. Utvalget la også vekt på at annonsen uriktig hadde opplyst at service var fulgt opp og at bestemt utstyr fulgte med.
- **Utfall:** heving av kjøpet på grunn av manglene samlet, og erstatning for utgiftene til NAF-test
- **Fakta:** tidligere omfattende skader som ikke var opplyst, manglende annonsert utstyr og service som ikke var fulgt; knapt fire uker etter kjøpet; 8 år, 68 800 km, 81 000 kr; opplyst: `som_den_er`; lov: før_2024; formodningsregelen

**#1967 · FKU-2022-6291 · 2023-03-29** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023021551&dokid=880996&versjon=1&variant=A&)

- **Spørsmål:** opplysning
- **Vekt:** `tidligere_skade_ikke_opplyst`
- **Begrunnelse:** Utvalget la vekt på at en kjøper av en seks år gammel bil til en relativt høy pris må kunne regne med å få opplysninger om skadehistorikk som går ut over normal bruksslitasje, at forhandleren ikke hadde dokumentert at skaden var bagatellmessig, og at kjøperen hadde dokumentert at skadehistorikken fikk potensielle kjøpere til å trekke seg.
- **Utfall:** prisavslag fastsatt skjønnsmessig
- **Fakta:** tidligere skade og delvis omlakkering som ikke var opplyst; om lag 17 måneder etter kjøpet, ved en NAF-test før videresalg; 6 år, 80 573 km, 365 000 kr; opplyst: `ingenting`; lov: før_2024

**#2486 · FKU-2021-5368 · 2022-04-20** · [vedtaket](https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022027852&dokid=639892&versjon=1&variant=A&)

- **Spørsmål:** opplysning
- **Vekt:** `tidligere_skade_ikke_opplyst`
- **Begrunnelse:** Utvalget la vekt på at en kjøper av en nyere bil til en relativt høy pris må kunne regne med å få opplysninger om skadehistorikk som går ut over normal bruksslitasje, at forhandleren burde kjent til skaden, og at forhandleren ikke hadde sannsynliggjort at skaden var bagatellmessig eller ikke hadde innvirket på kjøpet.
- **Utfall:** prisavslag fastsatt skjønnsmessig i mangel av dokumentasjon på verditapet
- **Fakta:** tidligere skade og delvis omlakkering som ikke var opplyst; om lag to år og tre måneder etter kjøpet, ved en NAF-test før garantien løp ut; 2 år, 49 600 km, 500 000 kr; opplyst: `ingenting`; lov: før_2024

### Batteri (elbil)

**#3105 · FKU-2026-117158 · 2025-11-11** · [vedtaket](https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-117158.pdf)

- **Spørsmål:** forventning
- **Vekt:** `bruksstans_sikkerhet`
- **Begrunnelse:** Utvalget la vekt på at sikkerhetsfunksjoner som automatisk nødbrems er en forutsetning for at bilen trygt kan brukes, og at feilen ved disse sammen med lavere kapasitet i høyvoltsbatteriet samlet sett gjorde bilen dårligere enn kjøperen hadde grunn til å forvente, også etter et «som den er»-forbehold.
- **Utfall:** prisavslag fastsatt skjønnsmessig, og erstatning for egenandeler og sakkyndig erklæring
- **Fakta:** svikt i høyvoltsbatteriet og sikkerhetsfunksjoner som slo seg av under kjøring; vel 14 måneder etter kjøpet; 7 år, 109 765 km, 350 990 kr; opplyst: `som_den_er`; lov: før_2024

## Forkastet

- **I kontrollen:** #1548 (Land Cruiser): vunnet på at kontrakten lovet nye luftfjærer, mens selve feilene i understellet ble ansett som påregnelige. #382 (Audi A3): hevingen ble avgjort «under noe tvil».
- **Ved avgjørelsen:** #3545 (vunnet på «helt ny motor», ikke på motorfeilen), #3005 (vant bare på DAB-radio), #2263 (12 V-startbatteri), #1035 (ladeenhet, ikke drivbatteri), #2454 og #899 (avgjort «under (noe) tvil»/«med tvil»), #3117 (kjølevæske i drivenhet, ikke fukt), #1872 (takskade med følgerust), #1689 flyttet fra bremser til rust.
- **Av vurdererne, blant annet:** #3154, #1598, #1936, #3023 og flere andre der forhandleren ikke svarte; #1684, #2034, #2469 «under tvil»; #1579 og #3128 der feilen viste seg innen seks måneder selv om databasen sa noe annet.
- **Eldre biler:** #1728 og #3268 («i tvil»/«under tvil»), #1304 («under tvil»), #3332 (forhandleren svarte ikke, «under noe tvil»), #1283 og #2208 (forhandleren svarte ikke). Basen har ingen vunnet forhandlersak med en bil over 17 år der feilen viste seg mer enn seks måneder etter kjøpet (#2099, 20 år, er merket for kontroll).

## Vedlikehold

Når nye vedtak er hentet og tolket: kjør `npm run henvisning-kandidater`, kurater listene som har fått nye kandidater på samme måte (med `sporsmal`, `vekt`, `begrunnelse`, `opplyst`, `tid`, `feil`, `utfall` og belegg), og kjør `npm run sjekk-henvisninger` og `npm test`. Vedtak om kjøp fra 2024 foretrekkes når de holder; de får `lov: "etter_2024"` og brukes bare for kjøp fra 2024. Mangler et moment utvalget la vekt på i `MOMENTER`, legges det til der (`npm run sjekk-momenter`).
