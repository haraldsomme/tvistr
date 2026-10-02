# Testplaner

Én fil per feature: `specs/<feature>.md`. Planen beskriver scenariene i klartekst (steg og forventet resultat) og godkjennes før testene skrives i `e2e/`.

- Lages av `playwright-test-planner` eller for hånd, med `e2e/seed.spec.ts` som utgangspunkt.
- `playwright-test-generator` gjør et godkjent scenario om til en test i `e2e/`.
- Testdata er oppdiktede tall. Ingen navn, adresser eller regnummer.

Arbeidsgang og regler står under «E2E-testing med Playwright» i `CLAUDE.md`.
