// The form at /sak (docs/skjema.md § 6): filling in the Enyaq case gives the test data's JSON, a
// private sale stops at once, and an unanswered step says what is missing. Needs the database
// (.env.local), since the form ends in the comparison engine.
import { expect, type Page, test } from "@playwright/test";
import enyaq from "../src/lib/sammenligning/testdata/enyaq-skjema.json";

// The dealer is made up, so Brønnøysund's answer is too.
async function falskBrreg(page: Page) {
  await page.route("**/api/firma?*", (route) =>
    route.fulfill({
      json: {
        forslag: [
          { orgnr: "999000123", navn: "FJORDBIL HAUGESUND AS", kommune: "HAUGESUND", bransje: null, status: null, adresse: null, forretningsadresse: "Industrigata 7, 5537 Haugesund" },
        ],
      },
    }),
  );
}

const sporsmal = (page: Page, tittel: string) => page.getByRole("group", { name: tittel });
const velg = (page: Page, tittel: string, svar: string) => sporsmal(page, tittel).getByRole("radio", { name: svar, exact: true }).check();
const neste = (page: Page) => page.getByRole("button", { name: "Neste" }).click();

type Feil = (typeof enyaq.del3_feil)[number];
const RAPPORT: [keyof Feil["rapport_sier"], string][] = [
  ["hva", "Står det hvilken del som er feil?"],
  ["hvorfor", "Står det hvorfor den sviktet (årsak)?"],
  ["var_der_ved_overtakelse", "Står det at feilen sannsynligvis var der da du overtok bilen?"],
  ["mer_enn_normal_slitasje", "Står det at feilen er mer enn normal slitasje for bilens alder og kjørelengde?"],
  ["kostnad", "Står det hva reparasjonen koster?"],
];
const SVAR: Record<string, string> = { ja: "Ja", nei: "Nei", star_ikke: "Står ikke" };
const HVOR: Record<string, string> = { annonse: "Annonsen", sms_epost_chat: "SMS, e-post eller chat", kontrakt: "Kontrakten" };

async function fyllFeil(page: Page, f: Feil) {
  await page.getByLabel("Type feil").selectOption(f.kategori);
  await page.getByLabel("«Feilen er at …»").fill(f.en_setning);
  await page.getByLabel("Dato oppdaget").fill(f.dato_oppdaget);
  await velg(page, "Kan bilen brukes?", { ja: "Ja", ja_begrenset: "Ja, men begrenset", nei: "Nei" }[f.kan_bilen_brukes]!);
  await sporsmal(page, "Sa eller skrev selger noe om dette før kjøpet?").getByRole("radio", { name: "Ja, skriftlig" }).check();
  for (const h of f.hvor_sto_det) await page.getByRole("checkbox", { name: HVOR[h] }).check();
  await page.getByLabel("Det selger skrev").fill(f.avskrift_selger!);
  if (f.hvor_sto_det.includes("sms_epost_chat")) await velg(page, "Var meldingen svar på et spørsmål du stilte selger?", f.svar_pa_direkte_sporsmal ? "Ja" : "Nei");
  await sporsmal(page, "Har et verksted sett på feilen?").getByRole("radio", { name: "Ja, og jeg har det skriftlig" }).check();
  await page.getByLabel("Verksted og dato").fill(f.verksted_navn_dato!);
  for (const [felt, tittel] of RAPPORT) await velg(page, tittel, SVAR[f.rapport_sier[felt]]);
  if (f.kostnad_kr != null) await page.getByLabel("Kostnad").fill(String(f.kostnad_kr));
  await page.getByLabel("«Verkstedet skriver at …»").fill(f.avskrift_verksted!);
}

test("Enyaq-saken gir testdataens JSON", async ({ page }) => {
  test.setTimeout(120_000);
  await falskBrreg(page);
  await page.goto("/sak");

  const k = enyaq.del1_kjopet;
  await velg(page, "Kjøpte du bilen av et firma (forhandler) eller en privatperson?", "Et firma (forhandler)");
  await page.getByLabel("Kjøpsdato").fill(k.kjopsdato);
  await page.getByLabel("Pris").fill("478 000");
  await page.getByLabel("Kilometerstand ved kjøp").fill("41 200");
  await page.getByLabel("Årsmodell").fill(String(k.aarsmodell));
  await page.getByLabel("Merke og modell").fill(k.merke_modell_valgfritt!);
  await neste(page);

  await page.getByLabel("Firmanavn").fill(enyaq.del2_selger.firmanavn_oppgitt!);
  await page.getByRole("button", { name: /Fjordbil Haugesund AS/ }).click();
  await page.getByRole("button", { name: "Ja, det stemmer" }).click();
  await velg(page, "Sto det «som den er», «som forevist» eller lignende i kontrakten?", "Nei");
  await neste(page);

  for (const [i, f] of enyaq.del3_feil.entries()) {
    await fyllFeil(page, f);
    if (i < enyaq.del3_feil.length - 1) await page.getByRole("button", { name: "+ Meld en feil til" }).click();
    else await neste(page);
  }

  const d6 = enyaq.del6_kontakt_med_selger;
  await page.getByLabel("Kilometerstand nå").fill("52 900");
  await velg(page, "Har du tatt dette opp med selger?", "Ja, skriftlig");
  await page.getByLabel("Første kontakt").fill(d6.dato_forste_gang!);
  await velg(page, "Hva svarte selger?", "Selger avviste kravet");
  await velg(page, "La selger frem noen dokumentasjon, for eksempel en rapport eller verkstedhistorikk?", "Nei");
  await neste(page);

  const kj = enyaq.del7_onske_og_kontakt.kjoper;
  await velg(page, "Hva ønsker du?", "At selger reparerer feilen");
  await page.getByLabel("Navn").fill(kj.navn);
  await page.getByLabel("Adresse").fill(kj.adresse);
  await page.getByLabel("E-post").fill(kj.epost);
  await neste(page);

  await page.getByRole("checkbox", { name: /Opplysningene jeg har gitt/ }).check();
  await page.getByRole("checkbox", { name: /ikke er juridisk rådgivning/ }).check();
  await page.getByRole("button", { name: "Se vurderingen" }).click();

  await expect(page.getByRole("heading", { name: "Dette fant vi i Forbrukerklageutvalgets vedtak" })).toBeVisible({ timeout: 60_000 });
  await page.getByText("Svarene dine (JSON)").click();
  const json = JSON.parse((await page.getByTestId("skjema-json").textContent())!);
  expect({ ...json, _meta: { ...json._meta, registrert: enyaq._meta.registrert } }).toEqual(enyaq);
  // The engine's choices for Enyaq (testdata/enyaq-fasit.json).
  await expect(page.getByRole("link", { name: /vedtak 22\/2952/ })).toBeVisible();
});

test("privatkjøp stopper skjemaet", async ({ page }) => {
  await page.goto("/sak");
  await velg(page, "Kjøpte du bilen av et firma (forhandler) eller en privatperson?", "En privatperson");
  await expect(page.getByText(/kjøpsloven/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Neste" })).toHaveCount(0);
});

test("ubesvarte spørsmål vises før brukeren kommer videre", async ({ page }) => {
  await page.goto("/sak");
  await velg(page, "Kjøpte du bilen av et firma (forhandler) eller en privatperson?", "Et firma (forhandler)");
  await neste(page);
  await expect(page.getByRole("heading", { name: "Kjøpet" })).toBeVisible();
  await expect(sporsmal(page, "Hva betalte du?").getByRole("alert")).toHaveText(/1 000 og 3 000 000/);
});
