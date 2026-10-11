# Valg av sammenligningsvedtak

Hvordan brevet alltid får ett vedtak å bygge på, og hvordan det brukes uten å si noe usant. Beskrivelsen bygger på testene 2026-10-11 (se nederst). Status: ikke implementert; dagens kode (`src/lib/matching/`) dekker bare fase 1 delvis.

## Prinsipper

1. **Alltid ett vedtak.** Så lenge kjøperen kan reklamere (kjøpt av forhandler, innenfor 5 år), får brevet alltid ett vedtak med medhold. Det som trappes ned er *hva vedtaket får bære*, ikke om det er med.
2. **Koden velger kandidatene, modellen velger vedtaket.** Rangeringen er deterministisk og gir 30 kandidater i trinnrekkefølge. Claude velger ett av dem og bestemmer bruksnivået. Koden kontrollerer svaret.
3. **Ingen fulltekst i produksjon.** Modellen ser bare uttrukne felt og sammendrag. Sitater kan bare tas fra `sitat`-feltene, som allerede er kontrollert ordrett mot fullteksten.
4. **Bruksnivået er en garanti, ikke en likhetsgrad.** Brevet påstår aldri mer enn nivået gir dekning for. Et vedtak om en annen feil kan derfor aldri bli presentert som «samme feil».

## Fase 1: Kandidater (kode, `src/lib/matching/`)

### Grunnfilter
Som i dag: `utfall in (medhold, delvis_medhold)`, personbil/varebil, forbrukerkjøpsloven, forhandler, `sanksjoner` ikke tom. I tillegg:
- Seire på garanti (fkjl § 18 a i `paragrafer` og «garanti» i feilens sitat) tas bare med når kjøperen klager på garanti.
- Er kjøpsdatoen mer enn 5 år tilbake, stoppes søket med en melding om fristen (§ 27). Ingen vedtak velges.

### Stigen
Hver feil med medhold i et vedtak plasseres på det beste trinnet den oppfyller mot kjøperens sak. Vedtaket får sin beste feils trinn.

| Trinn | Vilkår |
|---|---|
| 1 | Samme underkategori. Tidsnivå kjent og likt eller strengere. Bilen ikke mildere på både km og alder. |
| 2 | Samme underkategori. Tidsnivå ukjent eller ett nivå mildere. Samme krav til profil. |
| 3 | Annen underkategori, men samme komponenttype (se under). Tidsnivå likt eller strengere, eller ukjent. |
| 4 | Samme hovedkategori. |
| 5 | Et av kjøperens rettslige poeng (se under), uansett kategori. |

Trinn 1–4 krever at feilen har et sitat. For komponenttypen *opplysning* regnes tidsnivå og profil som oppfylt: feilen fantes ved overtakelsen. Har kjøperen bare valgt hovedkategori, starter stigen på trinn 3 hvis alle underkategoriene har samme komponenttype, ellers på trinn 4. «Vet ikke ennå» starter på trinn 5.

**Komponenttype** per underkategori, i `src/lib/feil/kategorier.ts`:
- slitedel: clutch, bremser, demping, hjullager, startbatteri, dekk, eksos, registerreim, rust
- forbrenning og drivlinje: turbo, girkasse, firehjul, drivstoff, olje, kjoling, utslipp, annet_motor
- høyvolt: kapasitet, lading, hybrid
- sikkerhet: sikkerhet, styring
- klima: ac, varme, parkeringsvarmer
- karosseri og interiør: lakk, ruter, fukt, lukt, interior
- elektronikk: infotainment, lys, annet_el
- opplysning: hele historikk, service, servicehefte, utstyr, nokler, utstyrsniva, garanti

**Rettslige poeng** (trinn 5), avledet fra kjøperens svar og vedtakets felt:

| Poeng | Kjøperen … | Vedtaket har … |
|---|---|---|
| Formodningsregelen, § 18 annet ledd | tidsnivå 1 | en feil med medhold og `formodning = anvendt` |
| «Som den er» fritar ikke, § 17 | svarte ja | `som_den_er` og «fkjl § 17» i `paragrafer` |
| Feil etter to år, § 27 | tidsnivå 3 | en feil med medhold på tidsnivå 3, ikke `samlet` |
| Uriktig opplysning, § 16 c | sier selger sa noe | `feil_opplysninger` i `mangelsgrunnlag` |
| Tilbakeholdt opplysning, § 16 b | sier selger ikke sa noe | `tilbakeholdt_opplysning` i `mangelsgrunnlag` |
| Selger har tapt retten til retting, § 30 | 2 eller flere rettingsforsøk | `retting_forsok` i `tvistetema` og heving eller prisavslag i `sanksjoner` |
| Selger pålegges retting | krever retting | retting i `sanksjoner` |
| Heving | krever heving | heving i `sanksjoner` og `heving_vesentlig` i `tvistetema` |
| Prisavslag | krever prisavslag | prisavslag i `sanksjoner` og `prisavslag_storrelse` i `tvistetema` |

### Poeng
Innenfor et trinn sorterer dagens poengsum (`vekter.ts`), uendret:
- på feilen: underkategori 4, tidsnivå 4 (strengere 1), egen vurdering 4 (ikke `samlet`, ikke erkjent eller uomtvistet), grunnlag 4 (`bevisgrunnlag` mot det kjøperen har)
- på vedtaket: km 3 (strengere 1), alder 2 (strengere 1), «som den er» 2 (strengere 1), krav i `sanksjoner` 2 (delvis 1)
- ukjent gir 0, mildere gir 0; det kjøperen ikke har oppgitt trekkes fra maks

På trinn 5 sorteres først etter antall av kjøperens poeng vedtaket treffer.

### Kandidatlisten
30 vedtak: inntil 25 fra trinn 1–4 i trinnrekkefølge, og alltid minst 5 fra trinn 5. Samme sak (saksnummer med `-2`-suffiks) tas med én gang. Listen er aldri tom innenfor 5 år; dette er kontrollert over alle 60 264 svarkombinasjoner.

## Fase 2: Valget (Claude API)

Ett kall per sak, rundt 20 000 tokens inn.

### Kjøperens sak
`kategori`, `underkategori` (kjøperens valg er fasit for hva feilen gjelder), `beskrivelse` (fritekst fra steg 3), `tidsniva`, `kjopsdato` (lovversjon), `km`, `alder`, `som_den_er`, `krav`, `rettingsforsok`, `selger_sa_noe`, `verksted_undersokt`.

### Per kandidat
- Vedtak: `saksnummer`, `vedtaksdato`, `kilde_url`, `merke`, `modell`, `arsmodell`, `km_ved_kjop`, `alder_ved_kjop`, `kjopesum_nok`, `som_den_er`, `sanksjoner`, `prisavslag_prosent`, `rettingsforsok`, `mangelsgrunnlag` (det klageren påberopte), `tvistetema`, `paragrafer`, `enstemmig`/`dissens`, `utvalgets_nokkelmomenter`, `sammendrag`, `trinn` og poeng.
- Alle feil med medhold: `hovedkategori.underkategori`, `komponent`, `tidsniva`, `dager_etter_levering`, `viste_seg`, `samlet`, `bevisgrunnlag`, `formodning`, `sitat`.
- Alle feil som ble avvist: `komponent`, `avslagsgrunn`. Dette var det feltet som manglet mest i testen: et vedtak som godtok dugg i lyktene, men avviste de elektriske feilene som slitasje, ble valgt som elektrisk presedens.
- Hvilke rettslige poeng vedtaket treffer.

### Instruks til modellen
- Velg ett vedtak. Sett `bruk` til det høyeste nivået som er sant:
  1. `samme_feil`: samme komponent eller feil, og tidspunktet i vedtaket er likt eller senere enn kjøperens.
  2. `samme_feil_uten_tidspunkt`: samme komponent eller feil, men tidspunktet bærer ikke.
  3. `overforbar`: annen komponent, men utvalgets begrunnelse gjelder like godt for kjøperens komponent, og bilprofilen er ikke mildere.
  4. `opplysningssvikt`: samme type opplysningssvikt fra selger.
  5. `rettslig_poeng`: bare et rettslig standpunkt; feilene ligner ikke. Dette nivået finnes alltid, så svaret er aldri «ingen».
- Kjøperens underkategori er fasit. Vedtak om en annen komponent kan bare brukes som `overforbar` eller `rettslig_poeng`.
- Sitater bare fra `sitat`-feltene, ordrett. Ingen slutninger fra det som ikke står i feltene eller sammendraget.
- `verksted_undersokt` betyr at et verksted har sett på bilen, ikke at det finnes en sakkyndig uttalelse.
- Bilprofil med retning: et vedtak om en eldre og mer kjørt bil styrker kjøperen; en nyere bil svekker.
- Ikke bruk et vedtak som `samme_feil` eller `overforbar` når mangelen bygde på selgers opplysning eller avtale, og kjøperen sier selger ikke sa noe.
- Skriv `forbehold` ærlig: «under tvil», avslått heving, flere feil vurdert samlet, dissens, nyere bil, annonse som hevet forventningen.

### Svar
```json
{ "vedtak_id": 0, "bruk": "samme_feil", "pastand": "…", "hvorfor_sterkere": "…", "forbehold": "…" }
```

### Kontroll i kode
- `vedtak_id` er blant kandidatene.
- Hvert sitat i `pastand` finnes ordrett i et `sitat`-felt på vedtaket.
- `bruk` stemmer med strukturen: `samme_feil` og `samme_feil_uten_tidspunkt` krever samme underkategori; `samme_feil` krever kjent tidsnivå likt eller strengere; `rettslig_poeng` krever at vedtaket treffer et av kjøperens poeng.
- Feiler kontrollen, kjøres kallet én gang til med feilmeldingen. Feiler det igjen, brukes det beste trinn-5-vedtaket med `bruk = rettslig_poeng`.

## Fase 3: Henvisningen i brevet

Henvisningen skrives ut fra `bruk`. Den har alltid: saksnummer, vedtaksdato, bilen (merke, alder, km, og «som den er» hvis det gjaldt), hva utvalget ga, ett ordrett sitat i «», og forbeholdet. `kilde_url` står som kildehenvisning.

| `bruk` | Setningen i brevet | Får ikke stå |
|---|---|---|
| samme_feil | «I sak [nr] ([dato]) fikk kjøperen av en [år] år gammel [merke] med [km] km medhold i at [komponent] var en mangel [, selv om bilen var solgt «som den er»]. Utvalget uttalte: «[sitat]». Feilen viste seg [tidspunkt] etter kjøpet. [Kjøperens] sak står minst like sterkt: [hvorfor].» | Ingenting å begrense, men forbeholdet må med. |
| samme_feil_uten_tidspunkt | Som over, uten setningen om tidspunkt. Tidspunktet argumenteres for seg, på loven (§ 18 annet ledd eller § 27) og på verkstedets funn. | «Tilsvarende tidspunkt», «like lenge etter kjøpet». |
| overforbar | «I sak [nr] la utvalget til grunn at [vedtakets komponent, presist] på en [bil] var en mangel: «[sitat]». Tilsvarende må gjelde for [kjøperens komponent], som i likhet med [vedtakets komponent] er [komponenttype] med forventet levetid utover bilens alder.» | «Samme feil», «tilsvarende feil». Komponenten i vedtaket navngis alltid. |
| opplysningssvikt | «Utvalget har i sak [nr] slått fast at [uriktig/tilbakeholdt] opplysning om [forholdet] er en mangel etter fkjl § 16 første ledd [b/c]: «[sitat]». Selgeren i denne saken [hva selger sa eller tiet om].» | Argumenter om påregnelighet eller tidspunkt. |
| rettslig_poeng | «Utvalget har i sak [nr], som gjaldt [vedtakets feil], lagt til grunn at [rettssetningen]: «[sitat]».» | Enhver sammenligning av feilene. Det skal stå at saken gjaldt en annen feil. |

Faste regler:
- Krever kjøperen heving, og vedtaket avslo heving, står det i brevet.
- Var vedtaket avgjort med dissens, står det.
- Er `forbehold` ikke tomt, bygges det inn i brevet, ikke utelatt.
- Et sitat som er kuttet midt i en setning i `sitat`-feltet brukes ikke; da brukes et nøkkelmoment som gjengivelse, uten anførselstegn.

## Testene bak beskrivelsen

48 skjemakombinasjoner, overvekt av vanskelige. Velger-agenter valgte ett vedtak, uavhengige dommere med fulltekst dømte om påstanden holder mot en selger med advokat.

| | Fulltekst, topp 10 | Uten fulltekst, topp 30 |
|---|---|---|
| Holder | 7 | 5 |
| Holder med forbehold | 39 | 36 |
| Feil valg | 1 | 2 |
| Ingen mulig | 1 | 1 |
| «Ingen» bekreftet riktig | 0 | 4 |
| Usanne sitater eller tall | 3 | 0 |

12 av 44 valg uten fulltekst lå på plass 11–30. Manglende fulltekst skadet først og fremst forbeholdene, ikke valget. Det feltet som ville hjulpet mest, avviste feil med avslagsgrunn, finnes allerede og tas med i fase 2.

Felt som ville hjulpet, men som krever ny kjøring av feilvurderingen: hva mangelen bygde på per feil (teknisk stand, annonse, avtale, formodning), om selger svarte i saken, «under tvil»-flagg, og den konkrete opplysningen i annonse eller kontrakt.
