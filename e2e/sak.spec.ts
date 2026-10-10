// The buyer's form at /sak with the assessment and the letter under it (2026-10-10). The full flow runs
// the engine against the index, so it needs the database (.env.local).
import { expect, type Page, test } from "@playwright/test";
import enyaq from "../src/lib/sammenligning/testdata/enyaq-skjema.json";

const felt = (page: Page, navn: string) => page.locator("label", { hasText: navn });
const knapp = (page: Page, gruppe: string, valg: string) => page.getByRole("group", { name: gruppe }).getByRole("button", { name: valg, exact: true });

// The date fields are a calendar in a popover: pick year and month in its dropdowns, then the day.
async function dato(page: Page, navn: string, iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  await felt(page, navn).getByRole("button").first().click();
  const dialog = page.getByRole("dialog");
  for (const valg of await dialog.locator("select").all()) {
    const harAr = (await valg.locator(`option[value="${a}"]`).count()) > 0;
    await valg.selectOption(harAr ? String(a) : String(m - 1));
  }
  await dialog.locator(`[data-day="${d}.${m}.${a}"]`).click();
}

async function tall(page: Page, navn: string, verdi: number) {
  await felt(page, navn).locator("input").fill(String(verdi));
}

test("/sak sender ikke før svarene er gyldige", async ({ page }) => {
  await page.goto("/sak");
  await expect(page.getByRole("heading", { name: "Reklamasjon på bruktbil" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Opplysningene jeg har gitt/ })).not.toBeChecked();
  await page.getByRole("button", { name: "Se vurderingen og brevet" }).click();
  // Next's route announcer is an empty alert too; ours is the one with the list.
  const mangler = page.getByRole("alert").filter({ hasText: "Noen svar mangler" });
  await expect(mangler).toBeVisible();
  await expect(mangler).toContainText("Kjøpet");
});

// Fills in Enyaq's F1 (heat pump) and sends it; one defect is enough to see the assessment.
async function enyaqF1(page: Page) {
  await page.goto("/sak");
  const k = enyaq.del1_kjopet;
  await dato(page, "Når kjøpte du bilen?", k.kjopsdato);
  await tall(page, "Hva betalte du?", k.pris_kr);
  await tall(page, "Kilometerstand ved kjøp", k.km_ved_kjop);
  await tall(page, "Årsmodell", k.aarsmodell);
  // The dealer is made up, so Brønnøysund's answer is too; picking it links the match.
  await page.route("**/api/firma?*", (route) =>
    route.fulfill({ json: { forslag: [{ orgnr: "999000123", navn: "FJORDBIL HAUGESUND AS", kommune: "HAUGESUND", bransje: null, status: null, adresse: null, forretningsadresse: "Industrigata 7, 5537 Haugesund" }] } }),
  );
  await page.getByRole("combobox", { name: "Hva heter firmaet du kjøpte av?" }).fill(enyaq.del2_selger.firmanavn_oppgitt!);
  await page.getByRole("option", { name: /Fjordbil Haugesund AS/ }).click();
  await expect(page.getByText("Koblet til Enhetsregisteret · org.nr 999 000 123")).toBeVisible();
  await knapp(page, "Sto det «som den er», «som forevist» eller lignende i kontrakten?", "Nei").click();

  // One defect is enough to see the assessment: F1 (heat pump).
  const f = enyaq.del3_feil[0];
  await felt(page, "Hva slags feil er det?").locator("select").selectOption(f.kategori);
  await felt(page, "Beskriv feilen med èn setning").locator("textarea").fill(f.en_setning);
  await dato(page, "Når oppdaget du feilen?", f.dato_oppdaget);
  await knapp(page, "Kan bilen brukes?", "Ja, men begrenset").click();
  await knapp(page, "Sa eller skrev selger noe om dette før kjøpet?", "Ja, skriftlig").click();
  for (const h of ["Annonsen", "SMS, e-post eller chat"]) await page.getByRole("checkbox", { name: h }).check();
  await felt(page, "Skriv av det som sto").locator("textarea").fill(f.avskrift_selger!);
  await knapp(page, "Var dette svar på et spørsmål du stilte selger?", "Ja").click();
  await knapp(page, "Har et verksted sett på feilen?", "Ja, skriftlig").click();
  await felt(page, "Hvilket verksted, og når?").locator("input").fill(f.verksted_navn_dato!);
  for (const [sporsmal, svar] of [
    ["Står det hvilken del som er feil?", "Ja"],
    ["Står det hvorfor den sviktet (årsak)?", "Ja"],
    ["Står det at feilen sannsynligvis var der da du overtok bilen?", "Ja"],
    ["Står det at feilen er mer enn normal slitasje for alder og kjørelengde?", "Ja"],
    ["Står det hva reparasjonen koster?", "Ja"],
  ])
    await knapp(page, sporsmal, svar).click();
  await tall(page, "Hvor mye? (kr)", f.kostnad_kr!);
  await felt(page, "Verkstedet skriver at").locator("textarea").fill(f.avskrift_verksted!);

  await tall(page, "Hva er kilometerstanden nå?", enyaq.km_na);
  await knapp(page, "Har du tatt dette opp med selger?", "Ja, skriftlig").click();
  await dato(page, "Når tok du det opp første gang?", "2025-11-21");
  await knapp(page, "Hva svarte selger?", "Avvist").click();
  await knapp(page, "La selger frem dokumentasjon (rapport, verkstedhistorikk)?", "Nei").click();
  const kj = enyaq.del7_onske_og_kontakt.kjoper;
  await felt(page, "Navnet ditt").locator("input").fill(kj.navn);
  await felt(page, "Adressen din (avsender i brevet)").locator("input").fill(kj.adresse);
  await felt(page, "E-postadressen din").locator("input").fill(kj.epost);
  await page.getByRole("checkbox", { name: /Opplysningene jeg har gitt/ }).check();
  await page.getByRole("checkbox", { name: /ikke er juridisk rådgivning/ }).check();
  await page.getByRole("button", { name: "Se vurderingen og brevet" }).click();
  await expect(page.getByRole("heading", { name: "Vurderingen" })).toBeVisible({ timeout: 60_000 });
}

test("Enyaq-saken gir vurderingen med vedtaket under skjemaet", async ({ page }) => {
  test.setTimeout(120_000);
  await enyaqF1(page);
  const feil1 = page.getByRole("article").filter({ hasText: "Feil 1" });
  await expect(feil1).toContainText("Sterk");
  await expect(feil1.getByRole("link", { name: "vedtak 22/2952" })).toBeVisible();
  // The practice paragraph is written on request (a model call), so this test stops at the button.
  await expect(page.getByRole("button", { name: "Skriv praksisavsnittet" })).toBeVisible();
});

// Calls the model (about 0,35 USD): MED_MODELL=1 npx playwright test -g praksisavsnittet --project desktop
test("praksisavsnittet skrives fra vedtaket og står under overskriften", async ({ page }) => {
  test.skip(!process.env.MED_MODELL, "kaller modellen; sett MED_MODELL=1");
  test.setTimeout(300_000);
  await enyaqF1(page);
  await page.getByRole("button", { name: "Skriv praksisavsnittet" }).click();
  const brevet = page.getByRole("article").filter({ hasText: "Praksis fra Forbrukerklageutvalget" });
  await expect(brevet).toContainText("Forbrukerklageutvalget har i vedtak", { timeout: 240_000 });
  await expect(brevet).toContainText("Vedtaket gjelder et kjøp før forbrukerkjøpsloven ble endret 1. januar 2024");
});

test("forsiden lenker til /sak, og /vurdering finnes ikke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Start vurderingen" })).toHaveAttribute("href", "/sak");
  expect((await page.goto("/vurdering"))?.status()).toBe(404);
});
