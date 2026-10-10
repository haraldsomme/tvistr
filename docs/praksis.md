# Praksisavsnittet

*Besluttet og bygget 2026-10-10. Kode: `src/lib/praksis/`. Kjøring på ett skjema: `npm run praksis -- <skjema.json> <feil_id> [--idag ÅÅÅÅ-MM-DD] [--opptak fil.json] [--generell]`.*

Avsnittet under «Praksis fra Forbrukerklageutvalget» er den eneste delen av brevet som krever at noen leser vedtakene. Det skrives av en modell som leser *analysen* av vedtakene (det pass 1 og pass 2 hentet ut), ikke fulltekst. En deterministisk verifisering stryker alt som ikke står ordrett i et av analysens kontrollerte sitater. Prinsippet er **aldri si noe usant**: et avsnitt som ikke kan belegges, skrives ikke.

## Flyt

Praksisdelen settes sammen av `skrivPraksisdel` (`praksisdel.ts`), i denne rekkefølgen:
1. **Spesifikt avsnitt** for hver feil i `valgt_til_brev` (høyst to), fra filterets kandidater.
2. **Generelt avsnitt** når færre enn to spesifikke kom gjennom: for den ene feilen med spor og uten spesifikt avsnitt som koster mest. Modellen skriver fra juristens faste blokk og eksempelvedtak.
3. **Den faste blokken** slik den står, med kjøperens fakta, når det generelle avsnittet ikke kan belegges.

Høyst to avsnitt i alt, og høyst ett generelt eller fast. Et vedtak siteres én gang. Feil uten spor får aldri noen av dem, og ingen av dem endrer styrken.

Hvert avsnitt lages slik:
1. **Filter** (`src/lib/sammenligning`, `docs/sammenligningsmotor.md`): 0–5 vunne vedtak i samme kategori som saken er minst like sterk som, med kriteriene.
2. **Les og skriv** (`skriv.ts`, `prompt.ts`): modellen får kjøperens sak uten personopplysninger, kriteriene og fulltekst for kandidatene. Den velger ett vedtak eller ingen, og skriver avsnittet. Hver setning om vedtaket har et belegg: et utdrag kopiert tegn for tegn fra fulltekst.
3. **Verifiser** (`verifiser.ts`): reglene under. Ren funksjon av modellens svar og kildene.

Avsnittet skrives når kjøperen trykker «Skriv praksisavsnittet» på `/sak` (`skrivPraksisFor` i `src/app/sak/actions.ts`), ikke ved innsending. Vurderingen kommer straks; avsnittet tar rundt ett minutt. Handlingen kjører filteret på nytt på serveren og tar aldri imot kandidater fra nettleseren.

## Det spesifikke avsnittet har fem ledd

1. Hva utvalget la til grunn, med nummer og dato.
2. Vedtakets faktum.
3. Utvalgets egne ord (sitatet).
4. Utfallet.
5. Sammenligningen: «Min sak står minst like sterkt …» og momentene der kjøperen er sterkere ifølge kriteriene.

Lovendringssetningen (`lovendring.ts`) står én gang etter avsnittene når kjøpet er etter 2024 og et sitert vedtak gjelder kjøp før.

## Det generelle avsnittet og den faste blokken

**Den faste blokken** (`fast.ts`, `PRAKSIS_FAST`) er én tekst per spor, skrevet og godkjent av en jurist, med 2–3 eksempelvedtak juristen har valgt. Den har to bruksmåter:
- **instruks:** modellen får blokken som disposisjon (`<fast_blokk>`) og eksempelvedtakene med fulltekst, og skriver et generelt avsnitt tilpasset kjøperens feil;
- **sikkerhetsnett:** gir det generelle avsnittet ikke noe, rendres blokken slik den står.

Blokken brukes i produksjon bare når `godkjent_av` er satt. Før det kan den prøves lokalt med `PRAKSIS_UTKAST=1`.

**Slots** i blokken: `{komponent_bestemt}`, `{dager_til_feil}`, `{alder_ved_kjop}`, `{km_ved_kjop}`, `{pris_kr}`, `{kostnad_kr}`, `{avskrift_verksted}`, `{avskrift_selger}`, `{hvor_sto_det_bestemt}` og `{eksempler}` (rendres som «sak FKU-2026-104368 (2026) og sak FKU-2025-58214 (2025)»). Mangler en slot verdi, utelates blokken. B-blokken utelates også når selger har lagt fram motbevis, fordi teksten sier at selger ikke har gjort det.

**Det generelle avsnittet** har ledd 1 (hva utvalget legger vekt på, med belegg fra et eksempelvedtak i utvalgets vurdering og «se for eksempel sak …»), ledd 2 (kjøperens fakta) og et valgfritt sitat fra et eksempel. Verifiseringen stryker i tillegg:
- ledd 4 og 5;
- sammenligning: «like sterkt», «minst like sterkt», «sterkere», «samme type», «tilsvarende sak», «i sak X fikk»;
- `{{belop}}`;
- belegg fra et vedtak som ikke er blant juristens eksempler. Nevner modellen et eksempel utenfor listen, eller velger den ett vedtak, blir det ikke noe avsnitt.

**Grunnlaget til juristen:** `npx tsx --env-file=.env.local scripts/praksis-grunnlag.ts` skriver `docs/praksis-grunnlag-<spor>.md` med de 20 nyeste vunne vedtaksfeilene per spor mot en forhandler, med kontrollerte sitater. Utkastene i `fast.ts` har eksempelforslag derfra:
- **A:** FKU-2026-11954 (feilopplysning om hengerfeste) og FKU-2026-89285 (feilaktig opplysning om fullført serviceprogram);
- **B:** FKU-2026-11234 (§ 18 annet ledd ordrett) og FKU-2026-110357 (selger har ikke bevist at feilen oppsto senere);
- **C:** FKU-2026-104368 (NAF: komponenter som skal vare lenger enn 7 år) og FKU-2025-58214 (rust ut over det man kan forvente, ført tilbake til leveringen).

**Til juristen:**
1. C-teksten sier «i saker om {komponent_bestemt}» og viser deretter til eksempler om andre komponenter (motor og rust for et høyvoltbatteri). Holder det, eller bør innledningen være generell?
2. B-teksten sier ikke hvor lang fristen er. Eksemplene kan gjelde seksmånedersregelen (før 2024) eller toårsregelen. Lovendringssetningen står etter avsnittet.

## Verifiseringen (begge modi)

Avsnittet forkastes helt når:
- modellen valgte et vedtak som ikke er blant kandidatene;
- vedtaket mangler fulltekst;
- sitatet ikke står ordrett i vedtaket, ikke står i utvalgets vurdering (etter «Utvalget ser slik på saken»), ikke er en hel setning, kan snus mot kjøperen («synlig», «besiktigelse», «prøvekjør», «burde») eller inneholder en personopplysning;
- mer enn én setning er strøket;
- ingen setning i ledd 1 er igjen.

En setning strykes, ved første regel som slår til, når:
- **ledd:** leddet er ikke tillatt;
- **belegg:** den sier noe om vedtaket uten et belegg på minst 20 tegn som står ordrett i det valgte vedtaket, uten «…»;
- **vurderingsdel:** den er i ledd 1 og belegget står ikke i utvalgets vurdering (det partene hevder, er ikke det utvalget fant);
- **plassholder:** `{{saksnummer}}`, `{{vedtaksdato}}` eller `{{belop}}` står i en setning om kjøperens sak, eller kan ikke fylles ut. `{{belop}}` krever at beløpet står i belegget. Verdiene hentes fra databasen, aldri fra modellen;
- **dato:** en dato som ikke er vedtakets (vedtaksdato, overtakelse, første henvendelse, eller i belegget) eller kjøperens (kjøp, oppdaget, første kontakt, eller i kjøperens avskrifter);
- **paragraf:** en paragraf som ikke står i belegget;
- **tall:** et tall som ikke er vedtakets (radene i basen og belegget) eller kjøperens (skjemaet, avledede tall som km siden kjøpet og kostnadsandelen, og tall i avskriftene), med unntak av faste frister (2, 5, 6, 24, 183, 730, 2024);
- **ord:** en setning om vedtaket har et av ordene som kan snus mot kjøperen;
- **like_sterkt:** «like sterkt» uten «minst» når kjøperen er sterkere på noe eller har en svakhet;
- **personopplysning:** kjøperens navn, adresse eller e-post, `[KLAGER]`/`[PERSON]`, eller noe som ser ut som en e-postadresse, et telefonnummer eller et regnummer.

Belegget viser at teksten finnes, ikke at setningen gjengir den riktig. Det siste sjekker kontrollagentene i testkjøringen (`docs/testkriterier-sak.md`, F1).

## Modell, budsjett og kostnad

- Modell `MODELL_FORFATTER` (Opus 5.5), effort `high`, ett kall per feil, høyst to feil per brev. Ingen nytt forsøk når verifiseringen sier nei: da strammes belegg-kravet, ikke reglene.
- Fulltekstene får plass innenfor 65 000 tegn. De beste tas hele; de lavest rangerte trimmes til hodet og utvalgets vurdering, eller utelates. Vedtakene har rundt 2,2 tegn per token.
- Målt 2026-10-10: spesifikt avsnitt for Enyaq F1 0,36 USD (45 000 tokens inn med det første budsjettet på 100 000 tegn), for S04 0,33 USD (37 000 inn, 8 700 ut); generelt avsnitt for batterivarianten av S04 0,15 USD (14 000 inn). Et brev koster dermed inntil rundt 0,85 USD: to spesifikke forsøk og ett generelt.
- Personopplysninger: kjøperens navn, adresse og e-post sendes aldri til modellen (`rens.ts`). Fulltekstene er de rensede (`fulltekst_renset`).

## Tester

- `verifiser.test.ts`: reglene over, på en oppdiktet vedtakstekst.
- `prompt.test.ts`: budsjettet og rensingen.
- `fast.test.ts`: slotene, godkjenningen, B ved motbevis, og rekkefølgen spesifikk → generell → fast i `skrivPraksisdel`.
- `skriv.test.ts`: opptak av ekte modellsvar (`testdata/*.json`, laget med `--opptak`) spilles av mot dagens verifisering uten API. Endres reglene med vilje: `npm run praksis -- --oppdater-opptak <fil>`.
- `e2e/sak.spec.ts`: knappen vises; med `MED_MODELL=1` skrives avsnittet med den ekte modellen.
