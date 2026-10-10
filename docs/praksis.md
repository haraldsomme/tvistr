# Praksisavsnittet

*Besluttet og bygget 2026-10-10. Kode: `src/lib/praksis/`. Kjøring på ett skjema: `npm run praksis -- <skjema.json> <feil_id> [--idag ÅÅÅÅ-MM-DD] [--opptak fil.json]`.*

Avsnittet under «Praksis fra Forbrukerklageutvalget» er den eneste delen av brevet som krever at noen leser vedtakene. Det skrives av en modell, og en deterministisk verifisering stryker alt modellen ikke kan belegge med vedtakets egen tekst. Prinsippet er **aldri si noe usant**: et avsnitt som ikke kan belegges, skrives ikke.

## Flyt

1. **Filter** (`src/lib/sammenligning`, `docs/sammenligningsmotor.md`): 0–5 vunne vedtak i samme kategori som saken er minst like sterk som, med kriteriene.
2. **Les og skriv** (`skriv.ts`, `prompt.ts`): modellen får kjøperens sak uten personopplysninger, kriteriene og fulltekst for kandidatene. Den velger ett vedtak eller ingen, og skriver avsnittet. Hver setning om vedtaket har et belegg: et utdrag kopiert tegn for tegn fra fulltekst.
3. **Verifiser** (`verifiser.ts`): reglene under. Ren funksjon av modellens svar og kildene.

Avsnittet skrives når kjøperen trykker «Skriv praksisavsnittet» på `/sak` (`skrivPraksisFor` i `src/app/sak/actions.ts`), ikke ved innsending. Vurderingen kommer straks; avsnittet tar rundt ett minutt. Handlingen kjører filteret på nytt på serveren og tar aldri imot kandidater fra nettleseren.

## Avsnittet har fem ledd

1. Hva utvalget la til grunn, med nummer og dato.
2. Vedtakets faktum.
3. Utvalgets egne ord (sitatet).
4. Utfallet.
5. Sammenligningen: «Min sak står minst like sterkt …» og momentene der kjøperen er sterkere ifølge kriteriene.

Lovendringssetningen (`lovendring.ts`) står én gang etter avsnittene når kjøpet er etter 2024 og et sitert vedtak gjelder kjøp før.

## Verifiseringen

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
- Målt 2026-10-10: Enyaq F1 0,36 USD (45 000 tokens inn med det første budsjettet på 100 000 tegn), S04 0,33 USD (37 000 inn, 8 700 ut). Rundt 0,35 USD per feil og inntil 0,70 USD per brev.
- Personopplysninger: kjøperens navn, adresse og e-post sendes aldri til modellen (`rens.ts`). Fulltekstene er de rensede (`fulltekst_renset`).

## Tester

- `verifiser.test.ts`: reglene over, på en oppdiktet vedtakstekst.
- `prompt.test.ts`: budsjettet og rensingen.
- `skriv.test.ts`: opptak av ekte modellsvar (`testdata/*.json`, laget med `--opptak`) spilles av mot dagens verifisering uten API. Endres reglene med vilje: `npm run praksis -- --oppdater-opptak <fil>`.
- `e2e/sak.spec.ts`: knappen vises; med `MED_MODELL=1` skrives avsnittet med den ekte modellen.
