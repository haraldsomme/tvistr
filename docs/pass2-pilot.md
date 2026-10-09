# Pass 2 – pilotresultat

## Versjon 3 på de berørte vedtakene (pass2-v3), 2026-10-09

**Hva er endret i instruksen:**
- **Regler for når `ikke_vurdert` ikke skal brukes:**
  - samlet konklusjon → `samlet_vurdering`, eksempel 22/880;
  - én konklusjon for hele saken → `ikke_mangel` for alle feil, eksempel 21/3423;
  - feil selger ikke har bestridt og som er tilkjent noe for → `mangel` med `uomtvistet`;
  - feil utenfor utvalgets avgrensning → tas ikke med.
- **Krav om å registrere alle dokumenter vedtaket nevner,** særlig korrespondanse, selgers motbevis og fakturaer for undersøkelser.

**Hvilke vedtak:** de 319 av 940 vedtak fra 2021 og senere som hadde `ikke_vurdert`-feil eller mangler uten vunnet spor. De 621 øvrige beholder `pass2-v2`; hver rad har sin versjon.

**Import:** 319 importert, 0 avvist. 26 av 5 612 sitater ble slettet fordi de ikke var ordrette.

### v2 mot v3 på de 319 vedtakene

| | v2 | v3 |
|---|---|---|
| Andel feil satt til `ikke_vurdert` | 27,9 % | **16,3 %** |
| Feil som ble funnet å være mangler | 480 | **530** |
| Mangler med vunnet spor | 199 | 201 |
| Registrerte bevis | 1 698 | **2 797** |
| – herav korrespondanse | 211 | 803 |
| – herav lagt frem av selger | 137 | 316 |

De nye manglene er nesten alle samlede vurderinger på utvalgets skjønn. De har derfor sjelden vunnet spor, og dekningen øker lite.

**Hele 2021+ etter v3:** 658 av 987 mangler har vunnet spor (66,7 %).

### Stikkprøve, kontrollert av Opus
50 tilfeldige vedtak blant de 319, utenom de to eksempelsakene i instruksen.

**Ikke direkte sammenlignbar med stikkprøven for v2.** Disse 50 er trukket fra de vanskelige sakene, mens stikkprøven for v2 var trukket fra alle 894.

Ett vedtak, 21/5745, med 15 påberopte feil, står alene for 7 av 17 utfallsavvik og 13 av 35 tidsavvik. Tallene er derfor vist både med og uten det.

| Måling | v3, alle 50 (224 feil) | v3 uten 21/5745 (209 feil) | v2, stikkprøve av alle 894 |
|---|---|---|---|
| Utfall per feil | 92,4 % | **95,2 %** | 93,2 % |
| Grunnlag og bevisgrunnlag | 89,7 % | 89,0 % | 92,5 % |
| Vunnet spor | 93,8 % | 93,3 % | 94,5 % |
| Når feilen viste seg | 84,4 % | 89,5 % | 96,6 % |
| Formodning | 91,5 % | 93,3 % | 97,9 % |
| **Bevis** | **82,8 %** | **83,0 %** | 79,5 % |
| Opplysninger | 81,9 % | 82,1 % | 87,4 % |

**Vurdering:**
- **Det v3 skulle rette, er bedre:**
  - `ikke_vurdert` er nesten halvert;
  - bevisregistreringen er 65 % mer fullstendig, uten at kontrollen fant overregistrering;
  - bevis går fra 79,5 % til 83 %, selv om utvalget nå er vanskeligere.
- **Bevis er fortsatt under 90 %.** 46 av 105 merknader gjelder dokumenter som fortsatt mangler.
- **Grunnlag og tidspunkt ligger rundt 89 %** på de vanskelige sakene. Utvalget er for lite og for skjevt til å si om det er dårligere enn i v2.
- **Utfall per feil er ikke verre:** 95,2 % uten 21/5745. Flere av avvikene i den saken er `ikke_mangel` mot `samlet_vurdering` med `samlet_utfall: ikke_mangel`, som gir samme utfall.

---

## Fullkjøring 2021+ (pass2-v2), 2026-10-09

**Omfang:** alle 940 vedtak i grunnutvalget fra 2021 og senere er analysert med `pass2-v2`.
- 46 av dem var analysert i pilot 2. De øvrige 894 ble kjørt med agenter i Claude Code, ikke via API: 6 Workflows parallelt, bolker på 10.
- **Kostnad:** cirka 20 millioner tokens til uttrekket og 1,4 millioner til kontrollen.
- Vedtak fra før 2021 er ikke kjørt (se vurderingen av omfang i samtalen: de kan ikke siteres og trengs bare til statistikk).

**Import:** 894 importert, 0 avvist.
- **Sitater:** 49 av 14 194 sitater (0,35 %) ble slettet fordi de ikke var ordrette.
- **Kontrollårsaker:** 65 vedtak er flagget. De vanligste årsakene er slettede sitater og summen av beløp per feil.

### Kvalitet i full skala: stikkprøve på 50 tilfeldige vedtak, kontrollert av Opus
Stikkprøven har 146 feilpunkter, og kravet gjelder andelen (n ≥ 100).

| Måling | Resultat | Nedre Wilson | Pilot 2 | Krav |
|---|---|---|---|---|
| Utfall per feil | 136/146 = 93,2 % | 87,9 % | 98,5 % | oppfylt |
| Grunnlag og bevisgrunnlag | 135/146 = 92,5 % | 87,0 % | 94,6 % | oppfylt |
| Vunnet spor | 138/146 = 94,5 % | 89,6 % | 96,7 % | oppfylt |
| Når feilen viste seg | 141/146 = 96,6 % | 92,2 % | 93,1 % | oppfylt |
| Formodning | 143/146 = 97,9 % | 94,1 % | 96,4 % | – |
| Prøvd spor | 121/146 = 82,9 % | 75,9 % | ≈ 76 % | – |
| Opplysninger | 146/167 = 87,4 % | 81,5 % | 84,8 % | – |
| **Bevis** | 182/229 = **79,5 %** | 73,8 % | 85,6 % | **ikke oppfylt** |

**Utfall per feil er lavere enn i piloten, men avvikene går i den trygge retningen.**
- 8 av 10 avvik er feil agenten satte som `ikke_vurdert`, der utvalget i realiteten tok dem med i en samlet vurdering («På grunn av omfanget av feil …») eller avgjorde dem stilltiende. Slike feil holdes utenfor matchingen, så de gir **tapt dekning**, ikke gale utfall.
- Bare 2 av 146 feil har snudd utfall. Én av dem er en falsk seier: 3097, der bremser ble satt til mangel, mens utvalget kalte dem slitedeler.

### Dekning (alle 940)

| | |
|---|---|
| Saker uten mangelsvurdering | 46 (forlik eller avtale 22, foreldelse 8, annet 8, avbestilling 3, ikke forbruker 3, innbytte 1, partsforhold 1) |
| Vedtak med minst én feil med vunnet spor | 406 |
| Feil, alle (utenom ikke-mangelssaker) | 2 999 |
| Feil som ble funnet å være mangler | 937 |
| **Mangler med vunnet spor** | **656 av 937 = 70 %** |
| Vunne spor | A 308, B 184, C 102, AB 54, AC 8 |
| Vunnet A etter variant | uttalelse 213, taushet 94, begge 63 |
| Feil uten noe spor | 691 av 2 999 (23 %, de fleste er `ikke_vurdert`, eller ikke mangel uten spor) |

**Vunne feil i de største kategoriene:**
- motor 87, elektrisk 79, utstyr 63, servicehistorikk 52, dekk og felger 39;
- understell 36, karosseri 35, rust 32, bremser 24, klimaanlegg 21, eksos 19.

### Kjente svakheter før data brukes i brev
1. **Bevis (79,5 %):** dokumenter mangler, særlig korrespondanse, selgers motbevis og fakturaer for undersøkelser.
2. **`ikke_vurdert` brukes for ofte** når utvalget vurderer feil samlet eller stilltiende. Det gir tapt dekning.
3. **Kategorivalget varierer mellom kjøringer** (paring 76,6 % i stabilitetstesten).

Alle tre kan rettes med presiseringer i instruksen (`pass2-v3`). En ny kjøring trenger bare å omfatte vedtakene der det betyr noe, for eksempel de med `ikke_vurdert`-feil, eller bevis i saker med vunnet spor C.

---

## Pilot 2 (pass2-v2), 2026-10-09

100 nye vedtak, trukket stratifisert på samme måte som i pilot 1, men utenom pilot 1, prøvesettet og datasjekken. Bolker på 10. Stabilitetstesten gjelder 40 vedtak kjørt to ganger. Kontrollen er Opus på alle 100; en uavhengig Opus-kontroll tok 20 av dem.

### Konklusjon
**Det brevet skal bruke, holder:** utfall per feil, grunnlag, vunnet spor, tidspunkt og ordrette sitater ligger alle over kravet, og to uavhengige kontrollagenter er enige i 96,5 % av tilfellene.

**To krav er ikke oppfylt:**
- **Bevis (sjekk 6c):** 85,6 % mot et bindende krav på 90 %.
- **Paring mellom kjøringer:** 76,6 % mot målet på 85 %.

Begge er avgrensede feil i instruksen, ikke feil i lesingen. Se «Det som gjenstår».

| Måling | Pilot 1 | Pilot 2 | Krav | |
|---|---|---|---|---|
| Utfall per feil (sjekk 3) | 99,1 % | 330/335 = 98,5 % | > 90 % | **oppfylt** |
| Grunnlag og bevisgrunnlag (sjekk 4) | 97,3 % | 317/335 = 94,6 % | > 90 % | **oppfylt** |
| **Vunnet spor** (krav for brevet) | ≈ 51 % | 324/335 = **96,7 %** | > 90 % | **oppfylt** |
| Prøvd spor (statistikk) | – | 64,8 %; ≈ 76 % etter rettingen under | – | rapporteres |
| Når feilen viste seg (sjekk 8) | 83,0 % | 312/335 = **93,1 %** | > 90 % | **oppfylt** |
| Bevis (sjekk 6c) | 83,9 % | 439/513 = 85,6 % | > 90 % | **ikke oppfylt** |
| Selgers opplysninger (sjekk 5c) | 87,0 % | 306/361 = 84,8 % | – | rapporteres |
| Formodning (sjekk 7) | 99,0 % | 323/335 = 96,4 % | – | rapporteres |
| Kalibrering: enighet mellom to kontrollagenter | 97,8 % | 439/455 = 96,5 % | ≥ 90 % | **oppfylt** |
| Stabilitet: vurdering, grunnlag og bevisgrunnlag blant parede feil (40 vedtak) | 94,5 % (20 vedtak) | 109/121 = 90,1 % | ≥ 90 % | **oppfylt** (akkurat) |
| Stabilitet: avgjorte feil som lot seg pare | – | 95/124 = 76,6 % | mål 85 % | **ikke oppfylt** |
| Feilpunkter per vedtak | 5,8 | 3,35 | – | |

**Import:** 100 importert, 0 avvist, 4 av 1 618 sitater slettet. Alle lagrede sitater er kontrollert mot fulltekst.

**Posisjon i bolken:** utfall per feil ligger mellom 95,2 og 100 % på alle ti plassene i bolken. Bolker på 10 holder.

### Spor
Tallene gjelder alle feil utenom saker uten mangelsvurdering, tatt fra importen.

| | |
|---|---|
| Feil uten noe spor (verken prøvd eller vunnet) | 47/324 = 14,5 % |
| **Mangler uten vunnet spor** | **47/118 = 39,8 %** |
| Vunnet spor A etter variant | uttalelse 27, taushet 13, begge 13 |
| Vunne spor i alt | A 48, C 10, B 8, AB 2, AC 3, ingen 47 |

**Øvre grense for praksisavsnittet:** cirka 60 % av feilene som utvalget fant var mangler, har et vunnet spor. Det er grensen for hvor ofte brevet kan vise til et vunnet, sammenlignbart vedtak per feil.

**De øvrige 40 %:** bevisgrunnlaget er typisk utvalgets skjønn, eller at selger ikke bestred feilen. Det er saker som ikke passer i noen av de tre sporene.

**A-taushet:** står for halvparten av vunne A-feil, alene eller sammen med en uttalelse (26 av 53).

### Rettet etter kontrollen
**Prøvd spor A** ble fortsatt satt for alle feil når en spesifikk opplysning gjaldt hele saken, for eksempel «3 mnd. bruktbilgaranti» i kontrakten. Nå må en spesifikk opplysning være knyttet til feilen.
- Prøvd spor steg fra 64,8 % til ≈ 76 % mot kontrollens fasit.
- Vunnet spor er uendret.

Rettingen gjelder bare importen.

### Det som gjenstår
1. **Bevis, 85,6 %.** 38 av 88 merknader fra kontrollen gjelder dokumenter som ikke er registrert. De typiske er:
   - tekstmeldinger eller e-post der selger erkjenner feilen;
   - selgers motrapporter;
   - fakturaer for selve undersøkelsen.

   Resten gjelder koblingen til feil (`gjelder_feil` for snever eller for vid), påregnelighet og avslagsgrunn. Det rammer ikke vunnet spor, men svekker sammenligningen av dokumentasjonen.
2. **Paring, 76,6 %.** Blant 40 avgjorte feil uten par skyldes:
   - 22 ulik oppdeling, for eksempel tre utstyrspunkter mot ett;
   - 14 ulik kategori for samme feil, for eksempel `fukt_lekkasje` mot `elektrisk`;
   - 4 at feilen bare finnes i den ene kjøringen.

   Vurderingen av de feilene som pares, er stabil (90,1 %). Det som varierer, er hvilken kategori feilen havner i, og det rammer matchingen per kategori.

---

## Pilot 1 (pass2-v1)

*Pilot kjørt 2026-10-09 på 100 vedtak fra grunnutvalget (personbil eller varebil, forbrukerkjøpsloven, ikke avvist), trukket stratifisert utenom sakene fra datasjekken. Kravene står i [pass2-design.md](pass2-design.md) § 9.*

## Konklusjon

**Delvis godkjent. Fullkjøring anbefales ikke ennå.**

| Område | Status |
|---|---|
| Utfall per feil og grunnlag per feil, det datasjekken viste at manglet | **Klart over kravet.** Kontrollen er pålitelig. |
| Spor og stabilitet | **Under kravet.** Årsaken er to uavklarte definisjoner, ikke svak lesing av vedtakene. |

Begge definisjonene må avgjøres før en ny pilot med `pass2-v2`.

## Tall

Kontrollen er gjort av Opus. Andelene gjelder per feilpunkt, der piloten har 582 feilpunkter.

| Måling | Resultat | Nedre Wilson | Krav | |
|---|---|---|---|---|
| Utfall per feil (sjekk 3) | 577/582 = 99,1 % | 98,0 % | > 90 % | **oppfylt** |
| Grunnlag og bevisgrunnlag (sjekk 4) | 566/582 = 97,3 % | 95,6 % | > 90 % | **oppfylt** |
| Kalibrering: enighet mellom to uavhengige kontrollagenter | 883/903 = 97,8 % | 96,6 % | ≥ 90 % | **oppfylt** |
| Spor og vunnet spor | 299/582 = 51,4 % (≈ 58 % etter rettingen nedenfor) | 47,3 % | > 90 % | **ikke oppfylt** |
| Stabilitet: alt identisk inkl. spor, 20 vedtak kjørt to ganger | 92/138 = 66,7 % | 58,4 % | ≥ 90 % | **ikke oppfylt** |
| – herav feil som lot seg pare mellom kjøringene | 109/138 = 79,0 % | | | |
| – vurdering, grunnlag og bevisgrunnlag blant parede feil | 103/109 = 94,5 % | | | |
| Formodning (sjekk 7) | 576/582 = 99,0 % | | | |
| Når feilen viste seg (sjekk 8) | 483/582 = 83,0 % | | | |
| Selgers opplysninger (sjekk 5c) | 309/355 = 87,0 % | | | |
| Bevis (sjekk 6c) | 406/484 = 83,9 % | | | |

**Import:** 100 importert, 0 avvist.
- **Sitater:** 2 av 1 764 sitater var ikke ordrette og ble slettet. Alle lagrede sitater er kontrollert mot fulltekst.
- **Kontrollårsaker:** 5 vedtak er flagget:
  - 2: summen av beløp per feil er høyere enn tilkjent totalt;
  - 2: et sitat ble slettet;
  - 1: en mangel er registrert uten grunnlag.
- **Feilpunkter:** agentene fant i snitt 5,8 per vedtak, omtrent dobbelt så mange som `vedtak.feiltyper` har, fordi feil fra NAF-oppramsinger nå tas med.

**Posisjon i bolken:** utfall per feil var 99,2 %, 100 %, 98,3 %, 99,2 % og 99,2 % for vedtak 1–5 i hver bolk. Kvaliteten faller altså ikke utover i bolken, og bolkstørrelsen kan økes til 10.

## Hvorfor spor og stabilitet ikke holder

### 1. Spor A: teller en generell opplysning for alle feil?
Avvikene i spor A går begge veier, og omtrent like ofte:
- kontrollen fjerner A som avledningen har satt ut fra en generell opplysning («pen bil i god stand», `gjelder_feil` tom);
- kontrollen legger til A der en slik opplysning burde vært knyttet til en bestemt feil.

Kontrollagentene er heller ikke konsekvente: 10 av de 20 punktene der de to uavhengige kontrollene var uenige, gjelder spor.

Vi prøvde to regler:

| Regel | Andel riktige spor |
|---|---|
| Generell opplysning gir A for alle feil | ≈ 58 % |
| Bare uttrykkelig knyttede opplysninger gir A | ≈ 57 % |

Ingen av dem løser problemet. [spor.md](spor.md) sier ikke hvilken som gjelder, og det er en produktbeslutning.

### 2. Spor B: tidspunktet er ofte bare indirekte kjent
Vedtakene sier ofte «kort tid etter kjøpet», eller gir datoen på en test i stedet for datoen feilen viste seg. Et eksempel: «Den fremlagte garantiutløpstesten viser at bilen mindre enn en måned etter kjøpet hadde flere feil …».

**Rettet etter piloten:** datoen på et bevis som er knyttet til feilen, brukes nå som øvre grense for når feilen viste seg. Det løftet sporandelen fra 51 % til 58 %. Det er målt mot kontrollens dommer på den gamle avledningen, så tallet er et anslag.

### 3. Stabilitet: oppdelingen i feil varierer
Når feilene lar seg pare, gir de to kjøringene samme vurdering, grunnlag og bevisgrunnlag i 94,5 % av tilfellene. Men 21 % av feilene lar seg ikke pare, fordi kjøringene deler opp og slår sammen feil ulikt, for eksempel 2 mot 5 feil i samme sak når klager viser til en NAF-test. Matchingen per feil blir da ustabil, selv om lesingen av hver feil er god.

## Typiske feil fra kontrollen
- **Tidspunkt (344, f7):** «Utvalget viser til at feilene ble påvist umiddelbart etter overtakelsen.» Uttrekket hadde ukjent tid. Riktig er dag 0–2.
- **Grunnlag (748, f1):** «Utvalget legger dermed til grunn at det er gitt uriktige opplysninger om bilen» gir `feil_opplysning`, men uttrekket hadde et annet grunnlag. Den uavhengige kontrollen fant feilen; den første kontrollen gjorde det ikke.
- **Spor B mangler (16):** «Den fremlagte garantiutløpstesten viser at bilen mindre enn en måned etter kjøpet hadde flere feil …», der fristen er tydelig overholdt.
- **Bevis (sjekk 6c):** fakturaer og pristilbud som bare oppgir en kostnad, ble av og til utelatt, selv om instruksen ble presisert etter prøvekjøringen.

## Beslutninger som trengs før ny pilot

1. **Spor A og generelle opplysninger:** gir en skriftlig, generell opplysning («god stand», «topp stand») spor A for alle feilene i saken, bare for feil agenten knytter den til, eller aldri? Svaret skal inn i [spor.md](spor.md), og deretter i avledningen og instruksen.
2. **Hvordan feil skal deles opp:** én post per komponent klageren nevner (finest, best for matching, men flest poster), eller én post per feil slik utvalget vurderer dem (grovere, men mer stabilt)? Valget avgjør stabiliteten.

## Neste steg (etter beslutningene)
1. Oppdater [spor.md](spor.md), `avled.ts` og instruksen. Øk til `pass2-v2`.
2. Kjør piloten på nytt på 100 nye vedtak, med bolker på 10. Gjenta stabilitet og kontroll.
3. **Godkjent:** fullkjøring. Ellers: ny runde.

Råtall og kontrolldommene ligger i `data/pass2/` (git-ignorert): `rapport-pass2-v1.md`, `kontroll/`, `kontroll2/`, `import-pass2-v1.json`.
