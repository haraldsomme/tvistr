# Henvisning etter det utvalget la vekt på (a fortiori)

Dato: 2026-10-08. Erstatter valget i `2026-10-04-henvisning-i-brevet-design.md` og omleggingen samme dag (alder først).

## Hvorfor

En jurist leste brevet og sa hva som gir et vedtak vekt, i prioritert rekkefølge:

1. **Samme rettsspørsmål.** Utvalget tok stilling til nøyaktig det spørsmålet kjøperens sak gjelder, og brevet sier det.
2. **Samme partskonstellasjon.** Forbruker som kjøper av profesjonell forhandler. Nevnes alltid.
3. **Momentene utvalget la vekt på, holdt opp mot kjøperens sak.** Ikke «det var en bil med feil der også», men «det som ga medhold der, trekker minst like sterkt her».
4. **Resultat og sanksjon.** Hva kjøperen fikk, og hvordan et prisavslag ble beregnet.

Forskjeller som styrker kjøperen, fremheves i én setning (fra det mer til det mindre). Forskjeller som svekker, adresseres kort. Bilmerke, modell og annen gjenfortelling tas ut.

**Det en gjennomlesning viste:** i de tre vedtakene som scoret best for en sak med feil etter mer enn to år (FKU-2016-1844 rust, FKU-2016-2138 girkasse, FKU-2019-116 frontrute) la utvalget ikke vekt på alder, kilometerstand og pris for seg. Det la vekt på en sakkyndig uttalelse om at feilen var en fabrikasjonsfeil eller unormal for alder og kjørelengde, og på at forhandleren ikke hadde noe som trakk i en annen retning. Alder og kilometerstand kom inn gjennom den uttalelsen. En sammenligning bare på fakta ville derfor påstått at kjøperen står «minst like sterkt» når det avgjørende momentet mangler.

## Beslutninger

- **Valget skjer i brevet, med momentene.** Vedtaket velges ut fra hva utvalget la vekt på, holdt opp mot kjøperens svar i stegene (momentene, verkstedet, rapporten), og så ut fra fakta (alder, km, pris, opplyst, tid) a fortiori. Ingen grense for hvor mye eldre den siterte bilen kan være.
- **Vurderingen viser ingen henvisning,** men sier hva brevet gjør: finner en lignende sak som fikk medhold og argumenterer for at kjøperens sak står minst like sterkt (avsnitt 5). Regelen om at vurderingen og brevet viser til samme vedtak går ut.
- **Sanksjon:** type og beregningsmåte («prisavslag satt lik utbedringskostnadene»), aldri tilkjent beløp. Kjøpesummen er et moment og kan stå.
- **Tilnærming A:** strukturerte felt per vedtak; `planlegg` bygger føringen fra vedtakets og kjøperens data. Forfatteren formulerer i registeret, men endrer ikke innholdet. `kontroll` godtar allerede tall som står i føringen og dens data.
- **Kvalitetsmålet** er eksempelet i avsnitt 4.

## 1. Data per vedtak

```ts
type Sporsmal = "forventning" | "opplysning" | "levering";
type Opplyst = "ingenting" | "som_den_er" | "feilen_opplyst";

type Henvisning = {
  vedtakId: number; ref: string; organ: Organ; dato: string; kildeUrl: string;
  lov: "før_2024" | "etter_2024";
  presumsjon: boolean;          // som nå: vedtaket kan hvile på § 18
  sporsmal: Sporsmal[];         // det utvalget tok stilling til; minst ett
  vekt: MomentId[];             // momentene utvalget la avgjørende vekt på (id-er i MOMENTER)
  begrunnelse: string;          // «Utvalget la vekt på at …», én til to setninger, uten navn, merke og modell
  alder: number; km: number | null; pris: number;  // pris = kjøpesum
  opplyst: Opplyst;             // hva kjøperen der var gjort kjent med eller godtok
  botte: Reklamasjonsbotte;
  tid: string;                  // «nær tre år etter kjøpet»
  gruppe: Gruppe;               // bare for «vedtaket gjaldt rust, ikke bremser»
  feil: string;                 // kort, uten merke og modell: «rust i dører, panser og tak»
  utfall: string;               // «prisavslag satt lik utbedringskostnadene»
};
```

- `forventning`: dårligere stand enn kjøperen kunne forvente ut fra alder, kilometerstand og pris, eller ut over normal slitasje (§ 15, § 16 første ledd a). `opplysning`: uriktige eller tilbakeholdte opplysninger (§ 16 første ledd b/c). `levering`: feilen fantes ved levering (formodningsregelen i § 18, en sakkyndig uttalelse eller annet bevis).
- `vekt` bruker momentkatalogen (`src/lib/brev/momenter.ts`), som allerede har spørsmålet til kjøperen og de gunstige svarene. Mangler et moment utvalget la vekt på i katalogen, legges det til der (med `npm run sjekk-momenter`).
- `opplyst`: rekkefølge for sammenligning ingenting < som_den_er < feilen_opplyst.
- **Fjernes:** `likhet`, `konklusjon`, `regel`, `grunnlag`, `setning` (vurderingen viser ikke vedtaket), typen `Likhet`, `LIK_ALDER_AR`, `VEKT`.

## 2. Kjøperens side

Fra saken på brevsiden (`Faktorer`, `besvarteMomenter`, `utfylling`):

- **Hovedspørsmål:** `opplysning` når kjøperen sier at det som ble opplyst var feil, eller feilen ikke er av en type slitasje kan forklare (km-avvik, tidligere skade). Ellers `forventning`. **Tilleggsspørsmål:** `levering` når feilen viste seg etter formodningsperioden, eller når kjøperen har en rapport om at feilen var der før kjøpet.
- **Momenter:** et moment i `vekt` er *dekket* når kjøperen har et gunstig svar på det (`besvarteMomenter`); rapportmomentene også når `utfylling.verksted` eller `utfylling.rapport` sier det samme.
- **Fakta:** `bilAlder`, `kmVedKjop`, `kjopesumNok`, `opplyst` (`opplystForKjop`; `utfylling.forbehold` «som den er»/«uten garanti» gir `som_den_er`), `reklamasjonsbotte`.

## 3. Valget

```
velgHenvisning(sak):
  stopp → null
  kandidater = forenlig(h, f)                           // som nå: presumsjon og lov
  pool = kandidater med kjøperens hovedspørsmål i h.sporsmal, ellers alle kandidater
  for hvert vedtak:
    mangler  = momenter i h.vekt som ikke er dekket hos kjøperen
    for hvert faktum (alder, km, pris, opplyst, tid) der begge er kjent:
      sterkere (kjøperen står bedre), likt, svakere
  sorter: færrest mangler; flest sterkere − svakere; dekker levering når kjøperen trenger det;
          nærmeste alder; nyeste vedtak
  → { henvisning, dekket, mangler, sterkere, likt, svakere, annenFeil }
```

## 4. Avsnittet i brevet

`JURIDISK.henvisning` lager føringen, uten merke og modell, i fire deler:

1. **Spørsmål og parter.** «I vedtak {{henvisning}} tok Forbrukerklageutvalget stilling til det samme spørsmålet som denne saken gjelder, i et kjøp der en forbruker kjøpte bil av en næringsdrivende forhandler: {spørsmålet}.» Spørsmålet per `Sporsmal` (fast ordlyd), for eksempel `levering` + `forventning`: «om en feil som viser seg lenge etter kjøpet, likevel skyldes forhold som var der ved leveringen, slik at bilen ikke svarer til det kjøperen hadde grunn til å forvente». Reserven (annet spørsmål enn kjøperens): «tok stilling til om en bil kjøpt av en forbruker fra en næringsdrivende forhandler hadde en mangel».
2. **Vedtaket.** Fakta (alder, km, tid; pris når den sammenlignes), `begrunnelse`, `utfall`.
3. **Kjøperens sak, bare det som holder.**
   - Ingen `mangler`: «De samme momentene trekker minst like sterkt i min sak.» Så kjøperens dekkede momenter (momentets `argument`, med sitat fra kildeteksten når det finnes) og faktaene: de i `sterkere` som sammenligning («tidligere enn i vedtaket, på en nyere bil med halvparten så lang kjørelengde»), de i `likt` med «heller ikke».
   - Med `mangler`: ingen påstand om at momentene trekker like sterkt. Bare faktaene i `sterkere` og `likt`, som konstatering.
4. **Forskjeller som svekker, kort, uten motargument:** faktaene i `svakere` som konstatering («Feilen viste seg senere etter kjøpet i min sak enn i vedtaket.»), annen feiltype («Vedtaket gjaldt rust og ikke bremser, men spørsmålet er det samme: {kort spørsmål}.»), gammel lov (setningen som finnes).

Kvalitetsmål, FKU-2016-1844 for en kjøper med bremsefeil etter to år og fire måneder på en 2 år gammel bil, med verkstedvurdering:

> I vedtak {{henvisning}} tok Forbrukerklageutvalget stilling til det samme spørsmålet som denne saken gjelder, i et kjøp der en forbruker kjøpte bil av en næringsdrivende forhandler: om en feil som viser seg lenge etter kjøpet, likevel skyldes forhold som var der ved leveringen, slik at bilen ikke svarer til det kjøperen hadde grunn til å forvente. Bilen var 3 år gammel og hadde gått 42 855 km da den ble kjøpt, og feilen viste seg nær tre år senere. Utvalget la vekt på at en sakkyndig hadde uttalt at skadene ikke skyldtes ytre påvirkning og var unormale sett i forhold til alder og kjørelengde. Selv om uttalelsen var kort og det var gått nær tre år, fant utvalget det mer sannsynlig at feilen skyldtes en svakhet som forelå ved leveringen, enn forhold på kjøperens side. Kjøperen fikk prisavslag satt lik utbedringskostnadene.
>
> De samme momentene trekker minst like sterkt i min sak. [Verkstedet] har uttalt at «[…]». Bilen var 2 år gammel og hadde gått 22 000 km da jeg kjøpte den, og feilen viste seg etter to år og fire måneder: tidligere enn i vedtaket, på en nyere bil med halvparten så lang kjørelengde. Feilen gjør at bilen ikke kan brukes.
>
> Vedtaket gjaldt rust og ikke bremser, men spørsmålet er det samme: om feilen var der ved leveringen. Vedtaket gjelder et kjøp før lovendringen 1. januar 2024. Reglene vedtaket bygger på, er ikke endret til kjøperens ugunst.

Føringens `data` får vedtakets og kjøperens tall. Eksempelbrevene i `prompter.ts` skrives om til den nye formen. `BREVSKRIV_VERSJON` økes.

## 5. Sjekk før sending, saksmappen og vurderingen

- **`sjekkBrev`:** når det valgte vedtaket har `mangler`, en advarsel (myk): «Vedtaket brevet viser til, ble vunnet fordi {momentets navn}. Det har du ikke ennå.» med «Rett dette» til steget som spør om momentet (`MOMENTER[].steg`). Når et moment mangler i alle kandidatene i `pool`, sier advarselen det: «Vedtakene som ligner din sak, ble vunnet på …». Når kjøperen fyller inn momentet, kan valget skifte; brevet viser da «Du har endret opplysninger …» som i dag.
- **Saksmappen** («Brevet ditt viser til»): spørsmålet, `begrunnelse`, `utfall` og en tabell «I vedtaket / Din sak» for momentene i `vekt` og faktaene, med dekket, mangler, sterkere og svakere merket. `LIKHET_TEKST` fjernes.
- **Vurderingen:** `eksempel` fjernes fra `vurder`, `/api/vurder` og skjemaet. I stedet sier siden hva brevet gjør med vedtakene, og lover bare det brevet alltid holder («minst like sterkt», ikke «enda bedre»; brevet sier «minst like sterkt» bare når kjøperen har alle momentene, ellers sier sjekken fra):
  - Sammenligningen: «Vi har sjekket saken din opp mot {n} lignende vedtak fra Forbrukerklageutvalget som fikk medhold. I brevet viser vi til den av dem som passer best, og går gjennom det utvalget la vekt på, punkt for punkt mot din sak, så forhandleren ser hvorfor din sak står minst like sterkt.»
  - Første punkt i «Dette får du» (erstatter `BREV_MED_LIGNENDE`): «Vi finner en lignende sak som fikk medhold, og argumenterer for hvorfor din sak står minst like sterkt.»
  - Nytt punkt etter det: «Mangler du noe utvalget la vekt på, for eksempel en vurdering fra verksted, sier vi fra før du sender.»
- CLAUDE.md («Nivåer», «Henvisning i brevet», «Saksmappe») oppdateres.

## 6. Kurering

- **Alle 54 vedtak leses på nytt** etter `docs/henvisninger.md`: én agent setter `sporsmal`, `vekt`, `begrunnelse`, `opplyst`, `tid`, `feil` og `utfall` med ordrett belegg (`sporsmal`, hver id i `vekt`, `opplyst`, `utfall`), en uavhengig agent kontrollerer. `pris` hentes fra databasen.
- **Dekning:** for hvert hovedspørsmål, med og uten formodningsregelen, vedtak som er vunnet på ulike momenter (sakkyndig uttalelse, forhandlerens erkjennelse eller utbedringsforsøk, bruksstans, positiv beskrivelse), så en kjøper uten sakkyndig uttalelse kan få et vedtak der det ikke var avgjørende. Mangler det, kurateres nye.
- **`sjekk-henvisninger`:** belegg for de nye nøklene; id-ene i `vekt` finnes i `MOMENTER`; `pris` står i vedtaket; `begrunnelse`, `feil` og `utfall` inneholder ikke merke, modell eller beløp.

## 7. Råd og spørsmål

Kjøperen skal få vite hva som faktisk vinner en sak, og hva som må eller bør innhentes før brevet sendes. Grunnlaget: å ha en rapport skiller ikke vunne fra tapte saker (feil etter seks måneder: 57 % medhold med verksted-, NAF- eller takstrapport, 63 % uten), men hva rapporten konkluderer med gjør det (`rapport_upaaregnelig`: 23 vunnet mot 7 tapt av 199 leste vedtak). De to vanligste grunnene til tap er at kjøperen ikke viste at feilen var der ved levering, og at utvalget så feilen som normal slitasje (`tiltak.ts`).

**Hvor rådene står:** vurderingen viser titlene på tiltakene som i dag (fulltekst bare for svake saker). Fulltekst kommer etter kjøp: i steget «Tilstandsrapport» og i Score-fanen (avsnitt 8).

1. **«Tilstandsrapport» uten rapport:** når kjøperen svarer nei, viser steget hva et verksted bør skrive: hva feilen er, hva den skyldes, om den sannsynligvis var der da bilen ble kjøpt, og om den er mer enn normal slitasje for bilens alder og kilometerstand. Samme tekst som tiltaket i vurderingen (`tiltak.ts`), ett sted.
2. **`uten_bevis` (hard, finnes):** teksten nevner de samme fire punktene og hva utvalget la vekt på i vedtaket brevet viser til, når det var en sakkyndig uttalelse («I vedtaket brevet viser til, la utvalget vekt på at en sakkyndig uttalte at feilen var unormal for alder og kjørelengde.»).
3. **Ny advarsel `slitasje_uten_vurdering` (myk):** feilgruppen er en slitedel (`slitedel.gjelder.grupper`), feilen kan forklares med slitasje, og ingen rapport sier at den går ut over normal slitasje (`rapport_upaaregnelig` ikke gunstig). «Forhandleren vil trolig si at dette er normal slitasje. Be verkstedet skrive om feilen er mer enn det som er vanlig for en bil med denne alderen og kilometerstanden.» Rett dette: «Tilstandsrapport».
4. **Advarselen fra avsnitt 5** (vedtaket ble vunnet på et moment kjøperen mangler) står sammen med disse, med samme form: hva som mangler, og steget som spør om det.

**Spørsmål som mangler** (valget i avsnitt 3 trenger svar på momentene i `vekt`):

5. **`rapport_arsak`** får `steg: "rapport"` og spørres når kjøperen har en rapport. Det var avgjørende i alle tre vedtakene som ble lest for en sak med feil etter to år.
6. **`forhandler_annen_arsak`** får `steg: "kontakt"` og spørres når forhandleren har avvist kravet.
7. `momenterFor` spør fortsatt bare om momenter som skiller, pluss de to over og `bruksstans_sikkerhet`. `npm run sjekk-momenter` må gi 0 feil.

**Promptene** (`src/lib/ai/prompter.ts`; `BREVSKRIV_VERSJON` økes, brev-eval kjøres):

8. **Forfatteren:** «Avsnittet om vedtaket står for seg selv» erstattes med at avsnittet om vedtaket sammenligner med kjøperens sak slik føringen sier, og ikke mer.
9. **Forfatteren og rubrikkpunktet `tone`:** sammenligningen i henvisningsavsnittet («trekker minst like sterkt», «på en nyere bil med halvparten så lang kjørelengde») er ikke gradsord eller egen sannsynlighetsvurdering når den står i føringen.
10. **Rubrikkpunktet `svakheter` og `<svakheter>` til forfatteren:** forskjeller mellom vedtaket og kjøperens sak som føringen nevner (annen feiltype, gammel lov, et faktum der kjøperen står svakere), skal stå, kort og uten motargument. Andre svakheter nevnes fortsatt ikke.
11. **Eksempelbrevene og merke-regelen** (`{{henvisning}}`: «I vedtak … behandlet …») skrives om til den nye formen.
12. **Avklaringsrunden** endres ikke: den spør ikke om årsaken (kjøperens gjetning er ikke bevis), og den spør hva rapporten sier når teksten mangler.

## 8. Score

En egen fane «Score» ved siden av «Brev» viser hvor godt brevet er underbygget, fra 0 til 100 %, hva som trekker ned, og hva kjøperen kan gjøre.

**Hva scoren betyr** (står øverst i fanen): «Scoren viser hvor godt brevet er underbygget med det Forbrukerklageutvalget har lagt vekt på i lignende saker. Den sier ikke hvor stor sjanse du har for å vinne.» 100 % betyr at alt kjøperen kan skaffe eller fylle inn, er på plass. Den kan alltid nås.

**Bare det som kan forbedres trekker.** Hvert trekk har et «Gjør dette» og «Rett dette» til steget. Forhold kjøperen ikke kan endre (feilen viste seg sent, bilen er gammel og billig, kjøperen visste om feilen, reklamasjonen kom sent), står i en egen liste «Forhold du ikke kan endre» under, uten trekk. `Advarsel` får feltet `fast: true` for disse; resten kan forbedres.

**Trekk** (`scoreFor` i `src/lib/brev/score.ts`, ren funksjon av det `sjekkBrev` får, pluss planen og valgt henvisning; regnes ut på siden, lagres ikke):

| Hva | Trekk | Gjør dette |
|---|---|---|
| Et moment vedtaket brevet viser til ble vunnet på, mangler (`mangler`, avsnitt 5) | 20 per moment | Det momentets steg; for rapportmomentene de fire punktene til verkstedet (avsnitt 7) |
| Hard advarsel fra `sjekkBrev` som kan forbedres (`uten_bevis`, `ett_forsok`, datoer som ikke henger sammen …) | 20 | Advarselens tekst og steg |
| Gult felt i brevet (`plan.mangler`) | 10 per felt | Steget feltet hører til |
| Brevet er ikke skrevet, eller skrevet før siste endring | 10 | «Skriv brevet» / «Skriv brevet på nytt» |
| Myk advarsel som kan forbedres (`slitasje_uten_vurdering`, `prisavslag_uten_belop`, vedlegg som mangler …) | 5 | Advarselens tekst og steg |
| Ubesvart momentspørsmål i stegene (`momenterFor` uten svar) | 3 per spørsmål | Steget som spør |

Trekk som løses av samme handling, slås sammen til ett med det høyeste trekket: `uten_bevis`, `slitasje_uten_vurdering` og manglende rapportmomenter er alle «Få en vurdering fra verksted» (−20, ikke −45). Et manglende moment teller ikke også som myk advarsel. Scoren er 100 minus trekkene, ikke under 0. Trekkene vises sortert, størst først: «−20 Få en vurdering fra verksted av når feilen oppsto». Et trekk som er et «må» (20), merkes slik.

**Over brevet:** boksen «Sjekk før du sender» blir én linje: «Score 65 % · 3 ting kan gjøre brevet sterkere · Se Score». Ved 100 %: «Score 100 % · Brevet har det utvalget la vekt på i lignende saker.» Bekreftelsen før nedlasting ved hard advarsel, gule felt og utdatert brev beholdes som i dag (`useBekreftLagring`, `konsekvenserAv` uendret).

**Fanen:** tallet, setningen om hva scoren betyr, «Gjør dette»-listen og «Forhold du ikke kan endre». På mobil er den en fane som «Brev» og «Endre».

**Tester:** ingen nye (CLAUDE.md: Vitest dekker bare vurderingen og brevskrivingen). Sjekkes i nettleseren under utviklingen.

## 9. Tester

- `henvisninger.test.ts`: valgreglene (samme spørsmål først, færrest manglende momenter, så a fortiori på fakta, reserven, aldri formodning/ny lov kjøperen ikke har, nærmeste alder ved likt); «biblioteket»: alle saker får en henvisning, og hvert hovedspørsmål har vedtak med og uten formodning.
- `brevplan.test.ts`: føringen har spørsmålssetningen og forhandleren; «minst like sterkt» bare uten `mangler`; sammenligning bare med fakta i `sterkere`; ingen merke eller modell.
- `vurder.test.ts`, `kombinasjoner.test.ts`: forventningene om `eksempel` fjernes (bevisst endring).
- Brev-eval kjøres etter implementering (spør først).

## Utenfor

- Ingen nye spørsmål til kjøperen utover de to momentene i avsnitt 7; momentene spørres i stegene som i dag.
- Ingen tilkjente beløp i brevet.
- Ikke lest av jurist etter endringen.
