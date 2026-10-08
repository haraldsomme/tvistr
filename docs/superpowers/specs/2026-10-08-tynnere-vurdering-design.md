# Tynnere vurdering: bare det som avgjør om man har en sak

Dato: 2026-10-08. Henger sammen med `2026-10-08-henvisning-a-fortiori-design.md`: vurderingen viser ikke lenger et eksempelvedtak, så den trenger ikke spørsmålene som valgte det. Den bygger videre på Task 7 i planen `docs/superpowers/plans/2026-10-08-henvisning-a-fortiori.md` (eksempelvedtaket fjernet, ny tekst om hva brevet gjør).

## Hvorfor

Vurderingen før kjøp skal avgjøre om kjøperen har en sak, og si ærlig det viktigste kjøperen må vite før de betaler. Alt som bare finjusterer styrken (rapport, kontakt, feiltype, opplysninger), vet vi først etter kjøp, og der går det inn i stegene, scoren og sjekken før sending. Færre spørsmål før kjøp gir en raskere vei til brevet uten å skjule noe som stopper saken.

## Beslutninger

- **Før kjøp spørres bare** om det som stopper saken (kjøpsform, femårsfristen, en kjent feil før 2024) og når feilen viste seg (ærlig varsel om bevisbyrden).
- **Nivåene `god` og `svak` forsvinner fra vurderingen.** Resultatet er «stoppet» eller «du kan ha en sak», med et varsel om bevisbyrden.
- **«Visste du om feilen?» får tre svar.** «Ja, og den er slik jeg fikk vite» stopper saken for kjøp før 2024 (§ 16 tredje ledd slik den lød da). Fra 2024 stopper det ikke, men gir en hard advarsel etter kjøp (§ 15 andre ledd: kjøperen må være særskilt gjort oppmerksom og uttrykkelig og særskilt ha godtatt avviket). **Ikke lest av jurist.**
- **Feiltypen spørres etter kjøp,** i «Feilen». Den er ikke lenger låst til saken.

## 1. Spørsmålene før kjøp

| Steg | Spørsmål | Virkning |
|---|---|---|
| Bilen | Registreringsnummer (oppslag mot Statens vegvesen, som i dag) | Kjøpsdato og bilens årstall |
| Bilen | «Når kjøpte du bilen?» (bare når registeret ikke har datoen) | Over 5 år gir neste spørsmål |
| Bilen | «Hvem kjøpte du bilen av?» | Privatperson eller gjennom firma: stopp (`privat`, `firma`) |
| Bilen | «Tok du opp feilen med forhandleren innen fem år etter kjøpet?» (bare når kjøpet er over 5 år gammelt) | Nei: stopp (`frist`) |
| Feilen | «Hvor lenge etter kjøpet viste feilen seg?» (innen 6 måneder / 6 måneder til 2 år / mer enn 2 år) | Varselet i resultatet |
| Feilen | «Visste du om feilen da du kjøpte bilen?» Nei / Ja, men den er verre eller annerledes enn jeg fikk vite / Ja, og den er slik jeg fikk vite | Det siste for kjøp før 2024: stopp (`kjent`) |

Ut av vurderingen: feiltype, «Ble du feilaktig informert …», «Har du det skriftlig?», «Har du tatt opp feilen med forhandleren?», «Har du en verksted- eller tilstandsrapport?», «Sier rapporten …», «Har du bilder …». Femårsspørsmålet stilles nå uten å spørre om kontakt først: et nei betyr at feilen ikke er tatt opp innen fem år (`fristUte`).

## 2. Resultatet

- **Stoppet** (`utenfor`): som i dag, ett punkt, ingen kjøpsknapp, og `POST /api/sak` avviser saken. Ny stoppgrunn `kjent`:
  - Tittel: «Du kan ikke klage på en feil du kjente til da du kjøpte bilen.»
  - Begrunnelse: «Du kjøpte bilen før 1. januar 2024 og visste om feilen, slik den er. Etter forbrukerkjøpsloven § 16 tredje ledd, slik den gjaldt da, kan du ikke gjøre gjeldende som mangel noe du kjente til ved kjøpet. Er feilen verre eller annerledes enn du fikk vite, kan du gå tilbake og endre svaret.»
- **Ikke stoppet:** tittelen «Du kan ha en sak mot forhandleren.», det brevet gjør (henvisningsspec-en avsnitt 5), og ett av to varsler:
  - Innen formodningsperioden: «Feilen viste seg innen {6 måneder / 2 år} etter kjøpet. Da er det forhandleren som må vise at den ikke var der da du kjøpte bilen.»
  - Utenfor: «Feilen viste seg mer enn {6 måneder / 2 år} etter kjøpet. Da må du vise at den var der da du kjøpte bilen, og du trenger en vurdering fra verksted. Etter kjøpet sier vi nøyaktig hva den må inneholde.»
  - Med «Ja, men den er verre …» i tillegg: «Du visste om feilen, men den er verre eller annerledes enn du fikk vite. Brevet bygger på forskjellen.»
- **Ingen `god`/`svak`.** `Niva` blir `"sak" | "utenfor"`. Listene «Dette styrker saken din» og «Dette svekker saken din» (`synligGrunnlag`) erstattes av varselet over; `byggGrunnlag` beholdes for stoppene (paragraf og lenke).
- **Statistikken** teller vedtak om bruktbil kjøpt fra forhandler i samme tidsrom (`statistikkbotte`), ikke per feiltype: «Vi har sjekket saken din opp mot {n} vedtak om bruktbil kjøpt fra forhandler som fikk medhold.»
- **Tiltakene** (`tiltak.ts`) vises ikke før kjøp; verkstedrådet kommer etter kjøp (henvisningsspec-en avsnitt 7).

## 3. Etter kjøp

- **«Feilen»** spør først «Hva gjelder feilen?» (samme knapper som i dag, flere kan velges), så dato og beskrivelse som i dag. Feiltypene lagres i `svar.feiltyper` og er med i `REDIGERBARE_SVAR`.
- **«Før kjøpet»** spør «Visste du om feilen …» (de tre svarene, forhåndsutfylt fra vurderingen), «Ble du feilaktig informert …» og «Har du det skriftlig?» (avledes av hvor opplysningen ble gitt der det går, som i dag).
- **«Kontakt med forhandleren»** og **«Tilstandsrapport»** spør som i dag om kontakt og rapport; svarene lagres i `svar` som i dag.
- **Ubesvart etter kjøp:** feiltype, kontakt og rapport som ikke er besvart, gir gule felt i brevet (`plan.mangler`) og trekk i scoren, som annen manglende utfylling. Veiviseren tar dem i stegene som før.
- **Ny hard advarsel `kjent_fra_2024`** i `sjekkBrev`: kjøp fra 2024 med «Ja, og den er slik jeg fikk vite»: «Du visste om feilen da du kjøpte bilen. For kjøp fra 2024 kan forhandleren bare avvise kravet hvis du ble gjort særskilt oppmerksom på feilen og godtok den uttrykkelig og særskilt, for eksempel ved at det sto i kontrakten. Sjekk kontrakten.» `fast: true` (scoren trekker ikke for den), steg «Før kjøpet».
- `kontrollerRettelse` og `rettSvar` stopper en rettelse som gir stoppgrunnen `kjent`, som for de andre stoppene.

## 4. Data

- `KlageInput` (`src/lib/vurdering/typer.ts`): `feilen.typer`, `feilen.feilOpplysning`, `feilen.kontakt`, `bevis.verkstedrapport`, `bevis.rapportSierForKjop` og `bevis.bilder` kan mangle (ikke besvart). `feilen.opplystForKjop: "nei" | "ja_verre" | "ja_som_opplyst"`.
- `Faktorer`: feltene som bygger på dem blir `null` når svaret mangler (`kontakt`, `feilOpplysninger`, `verkstedrapport`, `rapportSierForKjop`, `bilder`), `feilgrupper` blir `[]`, og `stopp` får `"kjent"`. `reklamertForSent` og `venterOverEttAr` blir `false` når kontakt ikke er besvart. `opplystTakSvak`/`opplystEtter2024` erstattes av `opplyst: "nei" | "ja_verre" | "ja_som_opplyst"`.
- `Innsending` (`src/lib/vurdering/innsending.ts`): feltene som ikke spørres før kjøp, er tomme strenger fra skjemaet og valideres bare når de er fylt ut. `sporOmFemarsfrist` spør når kjøpet er over 5 år, uavhengig av kontakt.
- **Gamle saker:** `opplystForKjop: "ja"` leses som `"ja_verre"` (`lesSvar`/`tilKlageInput`), så ingen som har kjøpt et brev, får saken stoppet av endringen. Gamle svar på de andre spørsmålene beholdes og brukes som i dag.
- `planlegg`: et manglende svar gir en plassholder der brevet trenger det (feilens art, om feilen er tatt opp), og ingen påstand ellers. `brevplan.test.ts` får en test for det.

## 5. Rekkefølge

1. Planen for henvisningen (`2026-10-08-henvisning-a-fortiori.md`), med Task 7.
2. Denne spec-en, som egen plan etterpå.

CLAUDE.md oppdateres i samme plan: «Nivåer» (bare `sak` og `utenfor`, stoppgrunnen `kjent`), «Rette svar» (hva vurderingen spør om, at feiltypen spørres i «Feilen» og ikke lenger er låst til saken) og «Tester».

## 6. Tester

- `vurder.test.ts`: de fire stoppene (inkludert `kjent` før 2024 og ikke fra 2024), varselet innen og utenfor formodningsperioden, «ja_verre» stopper aldri.
- `kombinasjoner.test.ts`: generatoren lager bare de nye svarene; forventet nivå er `sak` eller `utenfor`; ingen `eksempel`.
- `brevplan.test.ts`: en sak uten feiltype, kontakt og rapport gir plassholdere og ingen påstander om dem.
- E2E (`e2e/registreringsflyt.spec.ts`): to steg før vurderingen, så feiltypen i «Feilen» etter kjøp.

## Utenfor

- Ingen endring i oppslaget mot Statens vegvesen eller i registreringsnummerets vei til saken.
- Ingen nye spørsmål etter kjøp utover de som flyttes.
- Ikke lest av jurist.
