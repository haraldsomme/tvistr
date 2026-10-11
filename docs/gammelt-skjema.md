# Det gamle skjemaet for reklamasjon på bruktbil (fjernet)

**Arkivert 2026-10-10.** Skjemaet, sammenligningsmotoren og praksisavsnittet ble fjernet da løsningen startet på nytt med et enklere konsept (se `CLAUDE.md`). Siste versjon med alt dette er commit `9cc4dc9` på grenen `pass2`. Filene som nevnes under (`src/app/sak/skjema.tsx`, `src/lib/skjema/skjema.ts`, `docs/sammenligningsmotor.md` og andre) finnes bare i git-historikken. Resten av dokumentet er spesifikasjonen slik den sto.

## Slik så siden ut

Én lang side på `/sak` (`src/app/sak/skjema.tsx`, 830 linjer). Beige bakgrunn (`#f6f4ef`), hvite kort, én kolonne på høyst 720 px.

1. **Overskrift:** «Reklamasjon på bruktbil». Under: «Svar på spørsmålene om kjøpet og feilen. Du får en vurdering av saken og brevet under skjemaet.»
2. **Bilen:** feltet for registreringsnummer, med «Hent bilen». Oppslaget gikk mot Statens vegvesen (`/api/kjoretoy`) og fylte inn merke og modell, årsmodell (første registrering) og kjøpsdato (dagen bilen ble registrert på nåværende eier). Alt kunne endres etterpå.
3. **Kjøpet:** forhandler eller privatperson (privat stoppet skjemaet), kjøpsdato i en datovelger, pris, km ved kjøp, årsmodell, merke og modell.
4. **Selger:** firmavelger (`forhandler.tsx`) som søkte i Brønnøysund (`/api/firma`) mens brukeren skrev, og spørsmålet om «som den er» sto i kontrakten.
5. **Feil:** opptil 3 feilkort. Hvert kort hadde kategori (23 nøkler fra pass 2), «Feilen er at …», dato oppdaget, om bilen kan brukes, hva selger sa (skriftlig eller muntlig, hvor det sto, avskrift, svar på direkte spørsmål) og verkstedet (navn og dato, hva rapporten sier, kostnad, avskrift). Var kostnaden høyere enn kjøpesummen, måtte brukeren bekrefte begge beløpene.
6. **Kontakt med selger:** km nå, om saken var tatt opp med selger, dato, selgers svar, avtale eller forlik (med hvilke feil avtalen gjaldt) og om selger la fram dokumentasjon.
7. **Ønske:** reparasjon, prisavslag eller angre kjøpet, og kjøpers navn, adresse og e-post.
8. **Bekreft:** to avkrysninger: at opplysningene er riktige, og at brevet ikke er juridisk rådgivning.
9. **Valideringsfeil** ble vist samlet over knappen. Knappen «Se vurderingen og brevet» lå klistret nederst i vinduet.
10. **Under skjemaet:** «Vurderingen» per feil (styrke, grunn, beste vedtak som lenke, advarsel om fkjl. § 27, hva lignende saker tapte på) og «Praksis fra Forbrukerklageutvalget». Praksisavsnittet ble skrevet av en modell på knappetrykk.

---

*Byggespesifikasjon v1.1, 2026-10-09. v1.0 ble skrevet utenfor prosjektet. v1.1 deler 16a i to (16a, 16a2) og legger til 21c (hvilke feil avtalen gjelder). Skjemaet ligger på `/sak`, med vurderingen og brevet under (2026-10-10; `/vurdering` er fjernet). JSON-strukturen og valideringen står i `src/lib/skjema/skjema.ts`. Sammenligningsmotoren (`docs/sammenligningsmotor.md`) leser JSON-en uendret. Tilpasningene til prosjektet står i siste avsnitt.*

## 1. Prinsipper

1. **Bare spørsmål og svar.** Ingen opplastinger. Dokumenter brukeren har, listes som vedlegg i brevet. Motoren trenger bare det brukeren skriver av.
2. **Minst mulig input.** Rundt 25 spørsmål, de fleste betinget, så en typisk bruker ser 12–15. Det som kan utledes, spørres aldri om: lovversjon, frister, alder, km siden kjøp og spor.
3. **Setningsstubber, ikke åpne felt.** Fritekst spørres som fullføring av en setning («Feilen er at …», «Verkstedet skriver at …»). Da passer svaret rett inn i brevets maler uten omskriving.
4. **Hver feil gjentas.** Del 3–5 fylles ut per feil, høyst 3 feil.
5. **Ingen ledende valg.** Spørsmål som kan svekke brukeren hvis de besvares feil, stilles ikke (var feilen synlig ved visning?). Motoren utleder det den trenger.
6. **Lukkede lister** med nøyaktig strengene som står her. Datoer er `ÅÅÅÅ-MM-DD`; beløp og km er heltall.

## 2. Flyt

```
Del 1 Kjøpet (5) → Del 2 Selger (2) → [per feil: Del 3 Feilen (4) → Del 4 Selgers opplysning (1–3) → Del 5 Verkstedet (1–3)]
→ Km nå (1) → Del 6 Kontakt med selger (1–4) → Del 7 Ønske og kontakt (2) → Bekreftelser (2)
```

**Stopp tidlig:** `selgertype = privat` avslutter skjemaet. Brukeren får beskjed om at kjøpsloven gjelder, og at tjenesten foreløpig bare dekker kjøp fra forhandler.

## 3. Spørsmål og JSON-felt

### Del 1 – Kjøpet → `del1_kjopet`

| # | Spørsmål | Felt | Verdier | Validering |
|---|---|---|---|---|
| 1 | Kjøpte du bilen av et firma (forhandler) eller en privatperson? | `selgertype` | `forhandler` \| `privat` | påkrevd; `privat` → stopp |
| 2 | Når kjøpte du bilen? | `kjopsdato` | dato | ≥ 2010-01-01, ≤ i dag |
| 3 | Hva betalte du? | `pris_kr` | heltall | 1 000–3 000 000 |
| 4 | Hva var kilometerstanden ved kjøp? | `km_ved_kjop` | heltall | 0–600 000 |
| 5 | Hvilken årsmodell er bilen? | `aarsmodell` | heltall | 1990–kjøpsåret |
| 5b | Merke og modell (valgfritt) | `merke_modell_valgfritt` | tekst \| null | høyst 60 tegn |

### Del 2 – Selger → `del2_selger`

| # | Spørsmål | Felt | Verdier |
|---|---|---|---|
| 6 | Hva heter firmaet du kjøpte av? | `firmanavn_oppgitt` | tekst, påkrevd |
| 6b | Treff fra Brønnøysund, som brukeren bekrefter | `bronnoysund_treff` | `{foretaksnavn, organisasjonsnummer, forretningsadresse}` \| null |
| 6c | Er dette riktig firma? | `treff_bekreftet` | bool. Ved `false` velger brukeren et annet treff eller går videre med null. |
| 7 | Sto det «som den er», «som forevist» eller lignende i kontrakten? | `som_den_er_i_kontrakt` | `ja` \| `nei` \| `vet_ikke` |

### Del 3 – Feilen → `del3_feil[]` (per feil, høyst 3)

| # | Spørsmål | Felt | Verdier / validering |
|---|---|---|---|
| – | settes automatisk | `id` | `F1`, `F2`, `F3` |
| 8 | Hva slags feil er det? | `kategori` | pass 2-nøkkel, se `KATEGORIER` i `src/lib/skjema/skjema.ts` |
| 8b | «Feilen er at …» | `en_setning` | én setning på 10–200 tegn, lagret uten stubben |
| 9 | Når oppdaget du feilen? | `dato_oppdaget` | ≥ kjøpsdato, ≤ i dag |
| 10 | Kan bilen brukes? | `kan_bilen_brukes` | `ja` \| `ja_begrenset` \| `nei` |

### Del 4 – Hva selger sa (per feil)

| # | Spørsmål | Felt | Vises når |
|---|---|---|---|
| 11 | Sa eller skrev selger noe om dette før kjøpet? | `selger_sa_noe`: `nei` \| `ja_skriftlig` \| `ja_muntlig` | alltid |
| 12 | Hvor sto det? (flere valg) | `hvor_sto_det`: `annonse`, `kontrakt`, `sms_epost_chat`, `salgsoppgave`, `tilstandsrapport_fra_selger`; ellers `[]` | `ja_skriftlig` |
| 13 | Skriv av det som sto, så nøyaktig du kan | `avskrift_selger`, 3–500 tegn \| null | `ja_skriftlig` |
| 14 | Var dette svar på et spørsmål du stilte selger? | `svar_pa_direkte_sporsmal`: bool; ellers `false` | `hvor_sto_det` inneholder `sms_epost_chat` |

**Ved `ja_muntlig`** vises én linje: «Muntlige løfter er vanskelige å bevise og teller sjelden alene. Vi tar det med i beskrivelsen, men bygger ikke kravet på det.» Ingen oppfølging.

### Del 5 – Verkstedet (per feil)

| # | Spørsmål | Felt | Vises når |
|---|---|---|---|
| 15 | Har et verksted sett på feilen? | `verksted_sett_pa`: `nei` \| `ja_skriftlig` \| `ja_muntlig` | alltid |
| 15b | Hvilket verksted, og når? | `verksted_navn_dato` | `ja_skriftlig` |
| 16a | Står det hvilken del som er feil? | `rapport_sier.hva`: `ja` \| `nei` \| `star_ikke` | `ja_skriftlig` |
| 16a2 | Står det hvorfor den sviktet (årsak)? | `rapport_sier.hvorfor`: `ja` \| `nei` \| `star_ikke` | `ja_skriftlig` |
| 16b | Står det at feilen sannsynligvis var der da du overtok bilen? | `rapport_sier.var_der_ved_overtakelse` | `ja_skriftlig` |
| 16c | Står det at feilen er mer enn normal slitasje for alder og kjørelengde? | `rapport_sier.mer_enn_normal_slitasje` | `ja_skriftlig` |
| 16d | Står det hva reparasjonen koster? | `rapport_sier.kostnad` | `ja_skriftlig` |
| 16e | Hvor mye? | `kostnad_kr` | `kostnad = ja` |
| 17 | «Verkstedet skriver at …» | `avskrift_verksted`, 10–600 tegn | `ja_skriftlig` |

**Ved `nei` eller `ja_muntlig`:**
- alle fem feltene i `rapport_sier` er `star_ikke`;
- `kostnad_kr`, `avskrift_verksted` og `verksted_navn_dato` er `null`.

Brukeren får beskjed om at et ark til verkstedet følger med brevet.

### Km nå og Del 6 – Kontakt med selger

| # | Spørsmål | Felt | Vises når |
|---|---|---|---|
| 18 | Hva er kilometerstanden nå? | `km_na` (≥ `km_ved_kjop`) | alltid |
| 19 | Har du tatt dette opp med selger? | `tatt_opp_med_selger`: `nei` \| `ja_muntlig` \| `ja_skriftlig` | alltid |
| 19b | Når tok du det opp første gang? | `dato_forste_gang` (≥ tidligste `dato_oppdaget`) | `ja_*` |
| 20 | Hva svarte selger? | `selgers_svar`: `ikke_svart` \| `avvist` \| `tilbudt_reparasjon` \| `tilbudt_delvis` \| `enige_om_noe` | `ja_*` |
| 21 | Har dere inngått en avtale eller et forlik? | `avtale_inngatt`: `ja` \| `nei` | svaret er `tilbudt_delvis` eller `enige_om_noe`; ellers `nei` |
| 21b | «Avtalen går ut på at …» | `avtale_beskrivelse` | `avtale_inngatt = ja` |
| 21c | Hvilke av feilene gjelder avtalen? (flere valg) | `avtale_gjelder_feil`: `del3_feil[].id`, minst én; ellers `[]` | `avtale_inngatt = ja` |
| 22 | La selger frem dokumentasjon (rapport, verkstedhistorikk)? | `selger_la_frem_dokumentasjon`: `ja` \| `nei` | svaret er `avvist`; ellers `nei` |
| 22b | Hva slags? | `selger_dokumentasjon_kort`, høyst 200 tegn | `ja` |

### Del 7 – Ønske og kontakt, og bekreftelser

| # | Spørsmål | Felt |
|---|---|---|
| 23 | Hva ønsker du? | `onsket_losning`: `reparasjon` \| `prisavslag` \| `angre_kjopet` |
| 24 | Navn, adresse, e-post | `kjoper.{navn, adresse, epost}` |
| – | Bekreftelser | `bekreftelser.opplysningene_er_riktige`, `bekreftelser.lest_at_brevet_ikke_er_juridisk_radgivning`; begge må være `true` |

**Ved `angre_kjopet`** vises: «Å gå fra kjøpet krever at feilen er vesentlig. Brevet vil kreve det, men også ta forbehold om prisavslag.»

## 4. Valideringsregler på tvers av felt

- `dato_oppdaget ≥ kjopsdato`, og `dato_forste_gang ≥ min(dato_oppdaget)`.
- `km_na ≥ km_ved_kjop`.
- `kostnad_kr` kreves når `rapport_sier.kostnad = ja`, ellers `null`.
- `avskrift_selger` kreves, og `hvor_sto_det` kan ikke være tom, når `selger_sa_noe = ja_skriftlig`. Ellers er de `null` og `[]`.
- Minst én feil, høyst tre.
- `avtale_gjelder_feil` har minst én id når `avtale_inngatt = ja`, bare id-er som finnes og ingen dubletter. Ellers er den `[]`. Fjernes en feil, nummereres valget om (`fjernFeil`).
- Alle felt er til stede i JSON, også når de er `null`. Ingen ekstra felt.
- Motoren leser `_meta.skjema_versjon` og avviser versjoner den ikke kjenner.

## 5. Hjelpetekster

- **8b:** «Én setning. Skriv hva som skjer, ikke hva du tror årsaken er.»
- **13:** «Kopier ordene slik de sto i annonsen, kontrakten eller meldingen. Ikke omskriv.»
- **16a:** «En faktura eller en diagnoseutskrift som nevner delen, holder.»
- **21c:** «Feilene avtalen gjelder, tar vi ikke med i kravet. De andre tar vi med som vanlig.»
- **16a–16d:** «Svar ut fra det som faktisk står i rapporten. ‘Står ikke’ er et vanlig svar – da forteller vi deg hva du bør be verkstedet legge til.»
- **17:** «Skriv av verkstedets konklusjon, gjerne den setningen som sier hva som er feil og hvorfor.»
- **22:** «Dette er viktig. Har selger vist til en egen rapport eller verkstedhistorikk, må brevet svare på den.»

## 6. Test

1. Fyll skjemaet med Enyaq-saken, og sammenlign JSON-en med `src/lib/sammenligning/testdata/enyaq-skjema.json` (bortsett fra `_meta.registrert`).
2. De ti testsakene i `testsaker.json` skal passere valideringen.

## Tilpasninger til prosjektet

**Filer**

| Del | Fil |
|---|---|
| JSON-type, lukkede lister, `validerSkjema`, `stubb` | `src/lib/skjema/skjema.ts` |
| Skjemaet med regnr- og Brønnøysund-oppslag | `src/app/sak/{page,skjema,forhandler,actions}.tsx` |
| Regnr-oppslag (Statens vegvesen) | `src/app/api/kjoretoy/route.ts`, `src/lib/kjoretoy/vegvesen.ts` |
| Tester | `src/lib/skjema/skjema.test.ts` |

*Veiviseren, Server Action-en `sendSak`, `utkast.ts` (`byggSkjema`) og `e2e/sak.spec.ts` ble fjernet 2026-10-10 og ligger i git-historikken (commit før fjerningen). Avsnittene «Skjemaet», «Selger og Brønnøysund» og «Etter innsending» under beskriver den veiviseren og står som grunnlag når den bygges på nytt.*

**Regnr-oppslaget på `/sak`**

- Registreringsnummeret fylles inn først. Oppslaget fyller ut merke og modell (`merke_modell_valgfritt`), årsmodell (registerets første registreringsår, som kan bomme med ett år) og kjøpsdato (dagen bilen ble registrert på nåværende eier). Alle feltene kan endres etterpå.
- Regnr lagres ikke og er ikke et felt i skjemaet.

**Skjemaet**

- **Rute:** skjemaet lå på `/sak`.
- **Felles validering:** skjemaet og serveren kjører samme `validerSkjema`. Klienten viser feilene per steg før brukeren kommer videre. Serveren validerer på nytt, fordi en Server Action er et åpent POST-endepunkt.
- **Veiviseren:**
  - Del 1, Del 2, én side per feil (del 3–5), «Kontakt med selger» (km nå og del 6), Del 7 og Send.
  - «+ Meld en feil til» legger til et steg, høyst tre feil.
- **Skjulte spørsmål:** `byggSkjema` setter det et skjult spørsmål ville ha holdt, til `null`, `[]`, `false` eller `star_ikke`, slik spesifikasjonen sier. Svar som brukeren ga før et spørsmål ble skjult, lekker derfor ikke ut.
- **Setningsstubber** (`Feilen er at`, `Verkstedet skriver at`, `Avtalen går ut på at`):
  - svaret lagres uten stubben og uten sluttpunktum;
  - første bokstav blir liten, med mindre teksten begynner med en forkortelse («AC-anlegget», «EU-kontrollen»).
- **Tall** kan tastes med mellomrom eller «kr» («478 000 kr»).

**Selger og Brønnøysund**

- **Oppslag:** det eksisterende `/api/firma` (`src/lib/brreg.ts`) brukes. Det utelater ENK med vilje, fordi navnene der ofte er personnavn. En forhandler som er ENK, gir derfor ikke treff, og skjemaet går videre med navnet brukeren har skrevet.
- **Feltene i `bronnoysund_treff`:**
  - `foretaksnavn` er skrevet med vanlige store og små bokstaver;
  - `organisasjonsnummer` har formatet «999 000 123»;
  - `forretningsadresse` er én linje fra Brønnøysund. `Forslag` har fått feltet `forretningsadresse` ved siden av `adresse`, som er postadressen brevet skal sendes til.
- **Ubekreftet treff** lagres ikke.

**Etter innsending**

- **Server Action** (`sendSak`) validerer på nytt, kjører motoren og returnerer bare det siden viser: per feil spor, vedtak med lenke og om vedtaket brukes i brevet. Selve praksisavsnittet sendes ikke til nettleseren, fordi det er brevets innhold.
- **Rategrensen** er 10 per minutt, men `GRENSER_PA` i `src/lib/rategrense.ts` er fortsatt av.
- **Resultatsiden** er foreløpig: én boks per feil, og hvis motoren ikke fant noe spor, hvorfor (`ingen_spor_arsak` i klartekst). Styrkevurderingen er ikke bygget. Svarene vises som JSON under «Svarene dine», som den ende-til-ende-testen leser.
- **Lagring:** saken lagres ikke. Navn, adresse og e-post brukes bare i forespørselen.

**Motoren og testdataene**

- **Motoren** (`src/lib/sammenligning`) leser v1.1:
  - spor B krever bare `hva = ja`; `hvorfor` er kriteriet `arsak` på B og inngår i rapportbestillingen når det mangler (pass 2: `arsak` er `komponent` eller `rotarsak`);
  - feil i `avtale_gjelder_feil` får `forlik = true` og tas ikke med i brevet; de andre behandles som før (110357);
  - kategori brukes direkte, uten mapping;
  - `a_direkte` kommer fra `svar_pa_direkte_sporsmal`;
  - andre versjoner gir en feil;
  - `Skjema` importeres fra `src/lib/skjema`.
- **Testdataene** (`enyaq-skjema.json` og input i `testsaker.json`) er konvertert til v1.1: `hva` og `hvorfor` arver det gamle `hva_og_hvorfor`, bortsett fra S02 («rapport uten årsak»), der `hvorfor` er `star_ikke`. `avtale_gjelder_feil` er `[]`.

## Versjon 1.2 (2026-10-10)

- **Nytt felt per feil:** `kostnad_over_pris_bekreftet` (bool).
- **Når det vises:** når `kostnad_kr` er høyere enn `pris_kr`, får brukeren en dialog: «Reparasjonen koster X kr, mer enn de Y kr du betalte for bilen. Stemmer begge beløpene?»
- **Validering:** feltet må være `true` når kostnaden er over kjøpesummen, og `false` ellers.
- **Hvorfor:** en kostnad over kjøpesummen er enten en hevingssak eller en skrivefeil, og motoren kan ikke vite hvilken. Brevet viser aldri en kostnadsandel over 100 % uten bekreftelse.

## Skjemaet på `/sak` (2026-10-10)

`src/app/sak/skjema.tsx` er det eneste skjemaet. `/vurdering` er fjernet, med testmodusen.
- **Validering:** skjemaet sender ikke før valideringen består, og serveren validerer på nytt (`sendSak`).
- **Firmavelgeren** (`forhandler.tsx`) søker i Brønnøysund via `/api/firma` mens brukeren skriver. Når brukeren velger et treff, kobles det (`treff_bekreftet`). Skriver brukeren videre, kobles det fra.
- **Under skjemaet** vises vurderingen per feil straks, uten modellkall (`docs/sammenligningsmotor.md`): styrken, hvorfor den ikke er sterk, det beste vedtaket som lenke, og ved sen reklamasjon en advarsel om fkjl. § 27. Mangler saken vedtak, vises hva lignende saker tapte på.
- **Brevets praksisdel** skrives når kjøperen ber om det, i en egen server-handling (`docs/praksis.md`). Resten av brevet bygges videre her.

