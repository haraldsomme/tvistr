# Spor A/B/C

Et spor er den bevismessige veien kjøperen har til å vise at bilen har en mangel. Sporene er ikke det samme som paragrafgrunnlaget i `vedtak.mangelsgrunnlag` (§ 15 / § 16 / § 17). Brevmotoren velger spor, matcher vedtak og sammenligner styrke etter denne definisjonen, og pass 2 skal klassifisere vedtakene etter den.

| Spor | Definisjon | Hva det bygger på i vedtakene (pass 2) |
|---|---|---|
| **A** | **Opplysningssvikt fra selger.** Enten en **skriftlig og konkret uttalelse** som bilen ikke svarer til (*A-uttalelse*), eller **taushet** om et forhold selger skulle ha opplyst om, der det fortiede forholdet er dokumentert i saken (*A-taushet*). | `opplysninger[]` (type, form, `rekkevidde`, ordlyd), `grunnlag`, og bevis for det fortiede forholdet i `bevis[]` |
| **B** | Feilen viste seg **innen formodningsfristen**, og selgeren har ikke motbevist at den forelå ved levering. | `formodning`, `viste_seg`, datoer på bevis, selgers motbevis i `bevis[]` |
| **C** | Det finnes **sakkyndig dokumentasjon** av at feilen går **utover det påregnelige** for alder, kjørelengde og pris. | `bevis[]` med svar på årsak, ved levering, påregnelig og kostnad |

En feil kan ha flere spor. For brevet er det **vunnet spor** som teller. Sporet feilen ble **prøvd** på, brukes til statistikk.

## Regler for spor A (fra pass2-v2)
Spor A er opplysningssvikt. For uttalelser kreves skriftlig form; for taushet kreves at det fortiede forholdet er dokumentert. Hver feil med spor A får `a_variant`: `uttalelse`, `taushet` eller `begge`. Matchingen bruker varianten. Har brukerens selger sagt noe skriftlig, sammenlignes med `uttalelse`. Har selger ikke sagt noe, og feilen gjelder skadehistorikk, servicehistorikk, km-avvik eller tidligere reparasjon, sammenlignes med `taushet`.

### A-uttalelse
- **Generelle helhetsutsagn gir ikke spor A.** «God stand», «velholdt», «pen», «strøken» og lignende har `rekkevidde: "generell"`. Utvalget la nesten aldri vekt på slike utsagn alene, og regnes de med, får de fleste saker spor A på alle feil, så sporet mister skillekraften.
- **A prøvd for en feil:** feilen er knyttet til en skriftlig uttalelse med `rekkevidde: "spesifikk"`. En spesifikk uttalelse nevner komponent, utstyr, egenskap eller konkret tilstand: service, EU-kontroll, km, skade, «ingen rust». Unntak: en *generell* skriftlig uttalelse gir også A prøvd hvis utvalget la den til grunn i klagers favør (`status: "lagt_til_grunn"`, `vekt: "for_klager"`).
- **A-uttalelse vunnet:** utfallet er mangel, `grunnlag: "feil_opplysning"`, og saken har minst én skriftlig uttalelse fra selger. Vunnet spor forankres i grunnlaget, som pass 2 måler sikkert (97 % i pilot 1), og ikke i koblingen mellom opplysning og feil, som var det ustabile.
- **Muntlige opplysninger gir aldri A-uttalelse.**

### A-taushet
- **A-taushet prøvd:** feilen er knyttet til en opplysning med `type: "taushet"`, og minst ett bevis er knyttet til feilen.
- **A-taushet vunnet:** utfallet er mangel, `grunnlag: "tilbakeholdt_opplysning"`, og det fortiede forholdet er dokumentert, det vil si at minst ett bevis er knyttet til feilen. Typiske saker: kollisjonsskade dokumentert med selgers egen faktura eller reparasjonsdokumenter, servicehull eller km-avvik. Det gjelder også taushet i et dokument selger la frem, for eksempel en tilstandsrapport som ikke nevner en kollisjonsskade (24/1223).
- **Taushet uten dokumentasjon av det fortiede forholdet gir ikke spor A.**

### Muntlige opplysninger
- **Muntlige opplysninger gir aldri spor A.** Ingen av 6 muntlige opplysninger i datasjekken ble lagt vekt på i kjøpers favør (regel F6). De registreres likevel, slik at tallet kan sjekkes på hele korpuset.

## Regler for spor B
- **B bruker fristen som gjaldt for kjøpet.** Fkjl § 18 annet ledd: seks måneder for kjøp før 1. januar 2024, to år fra og med den datoen (lov 16. juni 2023 nr. 60). Nesten alle vedtakene gjelder seksmånedersfristen. Har brukerens feil vist seg etter 6–24 måneder, finnes det ingen sammenlignbare B-vedtak. Gamle saker der kjøperen tapte i den perioden, må ikke brukes mot brukeren.
- **B prøvd:** feilen viste seg innen fristen, eller utvalget anvendte eller avkreftet formodningen for feilen.
  - Er tidspunktet ikke oppgitt, brukes datoen på et bevis som er knyttet til feilen, som øvre grense (`viste_seg_kilde: "bevisdato"`). Den regnes ut i importen, ikke av agenten, og kan skilles fra tidspunkter vedtaket selv oppgir.
- **B vunnet:** utfallet er mangel og `bevisgrunnlag: "formodning_ikke_motbevist"`.

### B for brukerens feil (sammenligningsmotoren, regler fra 2026-10-09)
- **B krever skriftlig dokumentasjon av at feilen finnes.** Den må si hvilken del som er feil (skjema 16a); en faktura eller diagnoseutskrift holder, et muntlig verksted gjør det ikke. Årsaken (16a2) er et vanlig kriterium på B (`arsak`), ikke et krav.
- **B og C krever samme kategori som brukerens feil;** det påregnelige er kategorispesifikt. A kan falle tilbake til samme opplysningsgruppe når kategorien ikke har vedtak (docs/sammenligningsmotor.md).
- **Utenfor formodningsfristen: bare C, aldri B.**
- **En slitedel kan gå på B,** men bare mot et B-vedtak på en slitedel i samme kategori. Da er kravkriteriet `ikke_slitedel` «lik», for utvalget har selv godtatt formodningen for den typen del (57255 dekk, 77134 bremser). Mot alle andre vedtak er brukeren svakere, og vedtaket forkastes. Slitedel avgjøres likt for bruker og vedtak: bremser, dekk og drivlinje, og motor, girkasse og clutch på biler som er minst 8 år og har gått minst 120 000 km.

## Regler for spor C
- **C krever at rapporten selv uttaler seg om det påregnelige eller om tilstanden ved levering.** At utvalget kom til at feilen var en mangel, er ikke nok. Den vanligste grunnen til tap med verkstedrapport var at rapporten ikke sa noe om dette (7 av 15 i datasjekken).
- **C prøvd:** feilen er knyttet til et sakkyndig bevis fra klager (verkstedrapport, NAF-test, takst, sakkyndig uttalelse, tilstandsrapport) som uttaler seg om påregnelighet eller tilstanden ved levering.
- **C vunnet:** utfallet er mangel og `bevisgrunnlag: "dokumentert_utover_paregnelig"`.

«Utfallet er mangel» betyr `vurdering: "mangel"`, eller `samlet_vurdering` med `samlet_utfall: "mangel"`.

Grunnlag og tall: [vedtakssammenligning-datasjekk.md](vedtakssammenligning-datasjekk.md) og [pass2-pilot.md](pass2-pilot.md).
