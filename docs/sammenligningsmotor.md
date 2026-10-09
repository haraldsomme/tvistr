# Sammenligningsmotor

*Bygget 2026-10-09 etter spesifikasjon v1.0, som ble skrevet utenfor prosjektet, og rettet samme dag etter gjennomgang. Kode: `src/lib/sammenligning/`. Kjøring: `npm run sammenlign -- <skjema.json> [--idag ÅÅÅÅ-MM-DD] [--ut fil.json]`.*

*Tester:*
- *`sammenligning.test.ts` (T1–T14 og rettelsene) kjører uten database.*
- *`regresjon.test.ts` (`npm run test:db`) kjører Enyaq-saken (`testdata/enyaq-skjema.json`, skjema v0.5) mot indeksen og sammenligner med den frosne fasiten i `testdata/enyaq-fasit.json`.*

Motoren tar skjemaet og finner for hver feil **høyst ett vunnet vedtak** som brukerens sak er minst like sterk som. Deretter bygger den **praksisavsnittet** som brevet setter inn uendret. Motoren bruker ingen LLM: samme skjema gir samme vedtak og samme tekst. Avsnittsnumrene (§) under er spesifikasjonens og brukes i kodekommentarene.

## Flyt

| Steg | Fil | Hva |
|---|---|---|
| § 5.1 Sak | `avled.ts` `avledSak` | Lov, frist, bånd, km-svakhet og ønsket løsning (`reparasjon` → `retting`, `angre_kjopet` → `heving`) |
| § 5.2–5.4 Feil | `avled.ts` `avledFeil` | Kategori til pass 2, frist, slitedel, A-form, rapportsvar og spor i rekkefølgen A → C → B |
| § 6 Kandidater | `kandidater.ts` | SQL mot `vedtak_feil_sok`, joinet med `vedtak` og `vedtak_analyse`. Høyst 30 per spor. |
| § 7 Kriterier | `kriterier.ts` | Kriterietabellen per spor |
| § 8 Sterkere enn | `ranger.ts` `sterkereEnn` | Krav, adresserbar svakhet og regler som alltid gir forkasting |
| § 9 Rangering og valg | `ranger.ts` `ranger`, `fordel`, `velgTilBrev` | Ett vedtak per feil og inntil to feil til brevet |
| § 10–10b Tekst | `argumenter.ts`, `fraser.ts` | Faste setninger, sitatvalg og avsnitt i fem ledd |
| Samlet | `index.ts` `sammenlign(skjema, hent, idag)` | `hent` gis inn utenfra, så testene kan kjøre uten database |

## Tilpasninger til prosjektet

**Datakilden.** Disse feltene finnes ikke i `vedtak_feil_sok` og hentes med join: `sanksjon`, `tilkjent_totalt_nok`, `forbehold[]`, `selger_bevis_finnes`, `forste_henvendelse_dato`, `opplysninger`, `bevis` og `begrunnelse_sitater`. Viewet er ikke endret.

**Sanksjon** lagres i `vedtak_analyse.sanksjon` (migrasjon 0010). Den settes av `pass2:importer` og fylles ut på nytt med `npm run pass2:sanksjon` (`src/lib/analyse/avled.ts` `avledSanksjon`).
- **Heving leses fra vedtaksslutningen**, ikke fra beløpene. Beløpet kan være et nettooppgjør (17/1629: 11 535 av 209 000 kr), og totalen kan inkludere gebyr.
- **Mønsteret** bygger på datasjekkens brede mønster (sjekk 9), rettet på pass 2-vedtakene:
  - slutningen finnes etter overskriften («fatter slikt vedtak»), ikke som de siste 2 000 tegnene (22/880);
  - punktum inne i tall og datoer avslutter ikke leddet (21/4203);
  - «mot å stille», «til rådighet» og «skal returneres» teller med;
  - en del som leveres tilbake, er ikke heving (24/1726, ladekabel);
  - en tilbakeleveringsklausul uten hevingskrav er ikke heving (21/6296, innbytte).
- **Reserveregel:** heving var krevd, og minst 90 % av kjøpesummen ble betalt tilbake utover prisavslag og erstatning. Den fanger hevinger uten tilbakeleveringsklausul (14/1382, 23/2860). Alle ti tilfellene i pass 2 ble lest og er ekte hevinger.
- **Resultat:** 131 hevingsvedtak blant de 994 analyserte. Ingen bom gjenstår i pass 2-utvalget. Sju mulige bom før 2021 mangler tilbakeleveringsklausul og har under 90 % tilbakebetalt.
- **F9** er `a.sanksjon is distinct from 'heving'` i SQL.

**Spor A, variant.** `a_variant = :v` er utvidet til `a_variant in (:v, 'begge') and grunnlag = …`: `feil_opplysning` for uttalelse og `tilbakeholdt_opplysning` for taushet. Feil med `begge` kommer da med, og vi vet hvilken variant som faktisk vant.

**Spor A, opplysningen vi viser til.** En vunnet A-uttalelse krever bare at saken har en skriftlig uttalelse et sted (`docs/spor.md`). Brevet må kunne vise til den uttalelsen som gjaldt *denne* feilen.
- Motoren velger derfor en skriftlig uttalelse med `gjelder_feil ∋ feil_id`. Uten kobling til en feil godtas den bare når vedtaket har én feil.
- Finnes ingen slik uttalelse, forkastes kandidaten med grunnen «ingen opplysning i vedtaket knyttet til feilen». Dette er den vanligste forkastingsgrunnen.

**Ledd 2, kort ordlyd.** Er ordlyden under tre ord, skrives «Annonsen oppga «klimaanlegg».» i stedet for «Opplysningen … lød: «klimaanlegg».» Tillegget «i utstyrslisten» kommer bare når vedtakets verifiserte sitat om opplysningen sier «utstyr». Ellers ville motoren påstå noe om annonsen den ikke vet (gjelder for eksempel «Gode dekk»).

**Ledd 4, beløpet sier hva det dekker:**
- **Beløp knyttet til feilen** (`vedtak_feil.belop_tilkjent_nok`): «… for denne mangelen». Har vedtaket flere mangler og både prisavslag og erstatning, er fordelingen per feil ukjent, så teksten blir «Kjøperen fikk tilkjent X kr for denne mangelen».
- **Uten beløp per feil og med flere mangler:** «… på til sammen X kr for manglene i saken».
- **Én mangel:** samme formulering som før.
- **Heving:** «Kjøpet ble hevet.»

**Forbeholdet** gjengis med vedtakets ord når tolk-sammendraget (`forbehold_tekst`) og fulltekst begge inneholder «som den står» eller «som den er»: «Bilen i vedtaket var solgt «som den står» …».

**Direkte spørsmål** spørres om i skjemaet (v0.5). Når `hvor_sto_det` inneholder `sms_epost_chat`, spør skjemaet: «Var dette svar på et spørsmål du stilte selger?» Svaret lagres i `melding_svar_pa_sporsmal` (ja/nei). Kriteriet leser feltet. Er spørsmålet ubesvart, utelates kriteriet.

**Lovendringen** står ikke i avsnittene. Motoren returnerer den som `lovendring` på toppnivå, og brevmotoren setter den inn én gang etter det siste praksisavsnittet. Teksten er i entall eller flertall etter hvor mange av de siterte vedtakene som gjelder kjøp før 2024. Den sier hva som faktisk ble endret (fristen for formodningsregelen ble forlenget fra seks måneder til to år) i stedet for å gjenta samme setning.

**Ledd 1** bruker frasetabellen `OPPLYSNING_OM` per kategori («uriktig opplysning om klimaanlegget»), ikke agentens fritekstfelt `opplysning.gjelder`. Det feltet er ikke verifisert og ga setninger som «opplysning om Bilen har klimaanlegg». Selgers egne ord kommer i ledd 2, og bare når `ordlyd_verifisert = true`.

**Sitater.** Sitatet velges etter tema og kobling til feilen (A: `opplysning`, så `mangel`; B: `formodning`, så `mangel`; C: `bevis`, så `mangel`). To tilpasninger:
- Hele setninger uten plassholdere som `[KLAGER]` foretrekkes. Bare første setning tas med; den er fortsatt ordrett.
- Indre anførselstegn gjøres om til ' '.
- `sitat_verifisert` finnes ikke på `begrunnelse_sitater`, fordi importen sletter sitater som ikke er ordrette. Alle lagrede sitater er altså kontrollert.

**Rangering.** Ett ledd er lagt til før vedtaksdato: *siterbar*, det vil si verifisert ordlyd (spor A) og et sitat som er en hel setning. Uten det vant nyere vedtak der avsnittet manglet selgers ordlyd og sitatet var et fragment. Til slutt sorteres det på `vedtak_id` og `feil_id`, slik at rekkefølgen alltid er entydig.

**Sekundærspor** prøves bare når primærsporet ikke gir noe vedtak til feilen. Det gjelder også når et annet feilpunkt har tatt vedtakene.

**Svakheter som adresseres:**
- **Spor B, `tid_til_feil`:** Har verkstedet knyttet feilen til leveringen, brukes verkstedsetningen. Ellers brukes «… men innen lovens frist på to år».
- **Km-svakhet på saken:** setningen «Verkstedet har likevel knyttet feilen til leveringstidspunktet» brukes bare når rapporten faktisk sier det.

**A-taushet, ledd 2:** «… og utvalget fant at selger burde ha kjent til det» er tatt ut. Indeksen sier ikke noe om det.

**Avsnitt** lages for alle godkjente feil, slik at de kan kontrolleres. Brevet bruker bare dem i `valgt_til_brev`.

**Reklamasjonstid:** Første kontakt med selger kan gjelde en annen feil enn den som oppdages senere, slik F1 gjør i Enyaq-saken. Er kontakten datert før feilen ble oppdaget, regnes reklamasjonstiden som ukjent, og kriteriet utelates.

## Rettelser etter testsakene S01–S10

Testsakene ligger i `src/lib/sammenligning/testdata/testsaker.json`. `npm run sammenlign:testsaker` kjører dem, og resultatet ligger i `testsaker-resultat.json`.

- **Konkret opplysning** (`erSpesifikk`): regelen er snudd, slik `docs/spor.md` definerer den. En skriftlig opplysning er konkret, med mindre den bare består av helhetsutsagn og funksjonsord («god stand», «velholdt», «pen»). Listen over komponentord bommet på «WEBASTO» og «oljeforbruk er litt høyere enn vanlig» (S09, S10).
- **Kategori på spor B og C:** kategori er nå et kriterium på alle spor. På B og C rangeres samme kategori også foran antall sterkere momenter, fordi analogien der er selve feilen. Ellers vant firehjulstrekk over rust (S04).
- **Påregnelighet på spor C:** et vedtak vunnet på C regnes alltid som dokumentert utover det påregnelige, selv om bevislisten mangler det. Ellers ville et tynnere vedtak telle i brukerens favør (S04).
- **Kostnadsandel** bruker `vedtak.utbedringskostnad_nok`, ikke største bevisfaktura. En diagnosefaktura på 2 600 kr ga «0,8 % i vedtaket».
- **Km-svakheten** nevnes alltid: «Jeg har kjørt X km siden kjøpet.» Andre ledd («Verkstedet har likevel knyttet feilen …») kommer bare når rapporten sier det (S09).
- **Sitater** må være hele setninger: stor forbokstav, minst 40 tegn og ingen plassholdere. De må også ende en setning i fulltekst, enten med punktum etter sitatet eller med stor bokstav etter et mellomrom der uttrekket mistet punktumet. Sitatet som agenten kuttet («… knyttet til at bilen» fulgt av «ikke»), forkastes. Uten et helt sitat utelates ledd 3.
- **Spor B** bruker bare formodningssitater. Et `mangel`-sitat om opplysningssvikt havnet i et B-avsnitt (S06).
- **Formuleringer med 0 og 1 dag:** «samme dag som bilen ble levert» og «dagen etter leveringen».
- **Alvor:** `kan_bilen_brukes` og `alvor` står på hver feil i outputen, til brevmotorens vurdering av om feilen er vesentlig.

### Runde 2 (etter gjennomgang)

- **A-variant fra opplysningene:** en skriftlig uttalelse knyttet til feilen med `vekt = for_klager` gir uttalelse, også når grunnlaget er `tilbakeholdt_opplysning` (52074).
- **Spor B, tid til feil:** kan bare adresseres når verkstedet har knyttet feilen til leveringen. Ellers forkastes kandidaten.
- **Spor B, ledd 1:** når selger i vedtaket la frem dokumentasjon, lyder setningen «… forelå ved leveringen, og at selgers dokumentasjon ikke var tilstrekkelig til å motbevise dette».
- **Sitater som kan snus mot kjøperen,** hoppes over: setninger med «synlig», «besiktigelse», «prøvekjør» eller «burde». Ordene matches ved ordstart, slik at «sannsynliggjort» ikke treffer. Filteret gjelder setningen som vises.
- **Km-svakheten** står i avsnittet bare når verkstedet har knyttet feilen til leveringen. Ellers er `km_svakhet_i_avsnitt` false, og brevmotoren tar opp kjørelengden bare hvis selger har anført den.

## Kjente svakheter

- **`erSpesifikk`** bygger på en ordliste over helhetsutsagn. Et nytt helhetsord som ikke står i listen, gjør en generell opplysning konkret.
- **Kategoribonusen telles to ganger** i `velgTilBrev`; på B og C også i rangeringen. Den er både et kriterium i `antall_sterkere` og et tillegg på +1, slik spesifikasjonen sier.
- **Bare pass 2-data fra 2021 og senere.** Nesten alle vedtakene gjelder kjøp før 2024, så lovendringssetningen kommer i praktisk talt alle brev om kjøp etter 2024.
- **`forbehold_frase`** dekker bare «som den er» og «som den står». Andre forbehold får den generelle setningen.

## Spesifikasjonen (v1.0) i kortform

- **Input:** skjemaet i `reklamasjon_skjema_qa.json` (v0.4). `selgertype = privat` stopper motoren før matching.
- **Spor:**
  - **A-uttalelse:** skriftlig og konkret opplysning med avskrift. Helhetsutsagn som «pen og velholdt» gir ikke A.
  - **A-taushet:** selger sa ingenting om skadehistorikk, servicehistorikk, km-avvik, bruktimport eller årsmodell.
  - **C:** rapporten sier både «mer enn normal slitasje» og «var der ved overtakelsen».
  - **B:** innen fristen, og rapporten sier hvilken del som er feil (16a). Årsaken (16a2) er kriteriet `arsak`: sterkere når brukeren har årsak og vedtakets bevis bare nevnte komponenten. En slitedel sammenlignes bare med B-vedtak på samme slitedel (`ikke_slitedel`, docs/spor.md).
- **Kandidatfiltre:**
  - `vurdering = 'mangel'`;
  - vunnet spor;
  - forhandler eller formidling (formidling dømmes etter forbrukerkjøpsloven med solidaransvar, 56288);
  - utfall ≠ avvist;
  - vedtak fra 2021 og senere;
  - ikke en ikke-mangelssak;
  - ikke heving når brukeren ikke vil heve;
  - samme kategori. På A kjøres en egen spørring mot resten av opplysningsgruppen bare når ingen vedtak i kategorien ble godkjent. Det er to spørringer med 30 rader hver, så forkastede treff i kategorien kan ikke skygge for gruppen.
- **Sterkere enn:**
  - Ingen kravkriterier kan være svakere. `kategori` er krav på alle spor: lik kategori er sterkere; på A er samme gruppe lik (speil → ryggekamera), og alt annet er svakere (pant → DAB-radio).
  - Høyst én svakhet, og den må kunne adresseres.
  - Har selger motbevis og selger i vedtaket ikke, forkastes vedtaket alltid på B og C. På A gjelder spørsmålet om opplysningen var uriktig, så der er `sak.selger_motbevis` bare et flagg til brevmotoren (innsigelsesblokken).
- **Rangering:**
  1. samme kategori (på B og C; på A er kategorien et kriterium);
  2. forhandlervedtak foran formidlingsvedtak, siden brukeren alltid har kjøpt av en forhandler (lagt til 2026-10-10);
  3. antall sterkere;
  4. ingen svakhet;
  5. samme kategori;
  6. samme lovversjon;
  7. sanksjonen passer ønsket løsning;
  8. siterbar: verifisert ordlyd og et sitat som er en hel setning (lagt til i v1.1);
  9. nyeste vedtak.
- **Til brevet:** inntil to feil, rangert etter antall sterkere pluss 1 ved samme kategori, deretter kostnad.
- **Avsnittet** har fem ledd: hva utvalget la til grunn, vedtakets faktum, utvalgets ord, resultat og sammenligningen. Lovendringen står ikke i avsnittet, men én gang etter det siste praksisavsnittet (`lovendring` i outputen).
- **Utenfor modulen:** styrkevurdering, rapportbestilling og resten av brevet.

## Feil uten vedtak (regler fra 2026-10-09)

- **Bare privat selger stopper motoren.** For sen reklamasjon og forlik er flagg til brevmotoren: `reklamasjon_over_to_mnd` og `forlik` per feil. Om tiden var rimelig (fkjl § 27), avgjør ikke motoren. Et forlik dekker bare feilene avtalen gjelder (`avtale_gjelder_feil`, 110357). De får `forlik = true`, matches ikke, og står med `styrke: null` og uten vedtak. Da kan de aldri ta et vedtak fra en feil som går i brevet. De andre feilene behandles som før.
- **Et vedtak som ikke består «sterkere enn», siteres aldri.** En feil uten vedtak får `styrke: "svak"`, og brevet skrives uten praksisavsnitt for den. Det gjelder både når feilen mangler spor (`ingen_spor_arsak`) og når alle kandidatene er forkastet.
- **`naermeste`** er det nærmeste vinnende vedtaket, med det brukeren mangler (`mangler`: kriterienavn, pluss `rapport_ok` når B krever dokumentasjon). Det er grunnlaget for styrkevurderingen og rapportbestillingen: «Nærmeste vinnende sak er X; den hadde Y, som du mangler». Det står aldri i brevet.
  - Kandidatene er de forkastede på feilens egne spor og på sporene en rapport kunne åpnet: C alltid, og B innen fristen.
  - Rekkefølge: samme kategori, færrest mangler som en rapport ikke kan rette (`RAPPORT_KAN_GI`), færrest mangler, nyeste vedtak.
  - Med kategori som krav kan en feil stå uten nærmeste vedtak når kategorien ikke har vunne vedtak på sporene.

## Styrke

| `styrke` | Når |
|---|---|
| `sterk` | Feilen har et vedtak, og det finnes ikke noe tapt vedtak med lignende fakta. |
| `middels` | Feilen har et vedtak, men et tapt vedtak i samme kategori og på samme spor har minst like god profil (`motstridende`). Praksisavsnittet beholdes. Brukeren ser begge: «Utvalget har gitt medhold i X, men avvist Y med lignende fakta. Det som skilte: …» |
| `svak` | Feilen har ikke vedtak. |

**Tapte vedtak** (`hent` med `tapte: true`):
- `vurdering = 'ikke_mangel'` og sporet er prøvd;
- forhandler eller formidling (56288 var formidling);
- samme kategori, også på A (aldri gruppen);
- fra 2021 og senere;
- ikke tapt på `reklamert_for_sent` eller `utbedret_av_selger`.

**Minst like god profil** betyr tre ting:
- Brukeren er ikke sterkere på noe kvalitativt kriterium. Gradsforskjeller (dager, alder, km, pris, kostnadsandel, alvor) er «lignende fakta» og teller ikke.
- Ukjent på den tapte siden teller ikke som like godt der brukeren har noe.
- På B og C er brukeren sterkere når brukerens selger ikke har motbevis, men selgeren i tapet hadde det. På A teller selgers motbevis ikke, verken her eller i «sterkere enn».
- Har brukeren selv det tapet manglet, teller tapet ikke (`BESVART`):
  - påregnelig slitasje mot en rapport om mer enn normal slitasje;
  - ikke dokumentert mot skriftlig dokumentasjon;
  - ikke sannsynliggjort ved levering, eller oppstått etter levering, mot en rapport om leveringen;
  - forbehold mot et salg uten forbehold.

Av flere tap vises det med mest like fakta: færrest kriterier som skiller i noen retning, deretter nærmeste bil. `skilte` er grunnen til tapet og de største faktaforskjellene mellom X og Y.

## Sveipet (regresjon for reglene)

`npm run sveip` kjører 61 824 skjemakombinasjoner gjennom motoren mot indeksen på rundt 30 sekunder: 23 kategorier × selgers opplysning × verksted og rapport × tid og lov × bilens alder × ønske × motbevis × forbehold.

**Invariantene** gir exit 1 når de brytes:
- ingen stopp uten privat selger;
- vedtak hvis og bare hvis styrken ikke er svak;
- ingen avsnitt for svake feil;
- `middels` hvis og bare hvis `motstridende` er satt;
- B og C har aldri vedtak fra en annen kategori;
- ingen vedtak kommer fra en annen opplysningsgruppe.

**Sveipet er regresjon, ikke produktstatistikk.** Alle kombinasjonene teller likt, men virkelige brukere har en annen miks: langt flere har annonse og rapport. Tallene skal derfor ikke brukes til forventningsstyring. En realistisk fordeling krever at kombinasjonene vektes med pass 1-andelene for kategori, bevistype og opplysning.

**Tallene** sammenlignes med `testdata/sveip-fasit.json`: styrkefordelingen, årsakene til svak, andelen svake med nærmeste vedtak, kategoriblandingen, og svak-andelen etter selgers opplysning, rapport, tid og selgers motbevis. Kjør sveipet hver gang spor, kriterier eller kandidatfiltre endres. Les forskjellene, og frys med `npm run sveip -- --frys`.

Tall 2026-10-10:
- **Styrke:** sterk 10,8 %, middels 29,6 %, svak 59,6 %.
- **Vedtakenes kategori:** 21 760 fra samme kategori, 3 216 fra samme gruppe på A, 0 fra en annen gruppe.
- **Nærmeste vedtak:** 73,9 % av de svake har et.
- **Fra 2026-10-09 til 2026-10-10** falt svak fra 67,2 til 59,6 %, målt ved å slå av én endring om gangen:
  - todelt A-spørring: cirka 4,5 prosentpoeng. Den forklarer nesten hele fallet for spesifikke skriftlige uttalelser (23,2 → 2,1 %).
  - formidling på vinnersiden: 2,3 poeng;
  - motbevis bare på B og C: 0,8 poeng.
