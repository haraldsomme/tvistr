import { expect, idFra, mockKjoretoy, test } from "./fixtures";

// The one flow test: from the landing page, through the four steps and the assessment, to the finished letter.
// Runs against the real /api/vurder and the database, so it checks the shape of the assessment and
// not the number of decisions, which changes when `hent` adds more.

test("fra forsiden gjennom stegene og vurderingen til ferdig brev", async ({ page, skjema, brev, veiviser, sak }) => {
  await mockKjoretoy(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Start vurderingen" }).click();

  await expect(skjema.tittel("Hvilken bil kjøpte du?")).toBeVisible();
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.velgKjop("Mindre enn 2 år siden");
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.hentKjoretoy("ZZ 99999");
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.svar("Hvem kjøpte du bilen av?", "Bilforhandler");
  await skjema.neste();

  await expect(skjema.tittel("Hva er galt med bilen?")).toBeVisible();
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.velgFeiltype("Motor");
  await skjema.svar("Hvor lenge etter kjøpet oppdaget du feilen?", "Innen 6 måneder");
  await skjema.neste();

  await expect(skjema.tittel("Hva har forhandleren sagt?")).toBeVisible();
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.svar("Visste du om feilen før du kjøpte?", "Nei");
  await skjema.svar("Har du tatt opp feilen med forhandleren?", "Ja");
  await skjema.neste();

  await expect(skjema.tittel("Hvilke bevis har du?")).toBeVisible();
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.svar("Har du en verksted- eller tilstandsrapport?", "Ja");
  await skjema.svar("Sier rapporten at feilen sannsynligvis var til stede før kjøpet?", "Ja");
  await expect(skjema.nesteKnapp).toHaveText("Se vurderingen →");

  // Hold the answer back so the waiting page is certain to be on screen when we look for it.
  let slipp = () => {};
  const holdt = new Promise<void>((r) => (slipp = r));
  await page.route("**/api/vurder", async (route) => {
    await holdt;
    await route.continue();
  });
  await skjema.neste();
  await expect(page.getByRole("status")).toContainText("Vi sjekker saken din opp mot lignende saker");
  slipp();

  const vurdering = async () => {
    await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
    await expect(page.getByText(/Vi har sjekket saken din opp mot \d+ (lignende )?vedtak/)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Forbruker(klage|tvist)utvalget, (FKU|FTU)-\d{4}-\d+/ })).toBeVisible();
    const grunnlag = page.getByRole("region", { name: "Dette styrker saken din" });
    await expect(grunnlag.getByRole("listitem")).toHaveCount(3);
    // The presumption and the report both rest on § 18.
    const paragraf18 = grunnlag.getByRole("link", { name: "forbrukerkjøpsloven § 18" });
    await expect(paragraf18).toHaveCount(2);
    await expect(paragraf18.first()).toHaveAttribute("href", /lovdata\.no/);
    // What the dealer may object (wear on an engine) stands in its own list, not in the title.
    await expect(page.getByRole("region", { name: "Dette svekker saken din" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Få reklamasjonsbrevet" })).toBeVisible();
    // Before paying, the car the letter is for is shown, and cannot be changed there.
    await expect(page.getByRole("group", { name: "Brevet skrives for" })).toContainText("Testmerke Modell X");
    await expect(page.getByRole("group", { name: "Brevet skrives for" })).toContainText("ZZ 99999");
    await expect(page.getByText("Den er veiledende og ikke juridisk rådgivning")).toBeVisible();
  };
  await vurdering();

  await page.getByRole("button", { name: "Betal med vipps" }).click();
  await expect(page).toHaveURL(/\/brev\/[\w-]{22}\/veiviser$/);
  sak.rydd(idFra(page.url()));

  // Right after buying, a wizard asks for everything the letter needs, one step per screen, before
  // the letter is shown. Every step, in order, to a finished letter.
  await expect(veiviser.tittel("Takk! Nå lager vi brevet ditt.")).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  // The registry gave no purchase date, so the first step asks for it.
  await expect(veiviser.tittel("Om kjøpet")).toBeVisible();
  await page.getByLabel("Når kjøpte du bilen?").fill("2024-03-12");
  await page.getByLabel("Hva kostet bilen?").fill("250000");
  await page.getByRole("radio", { name: "Ja, bilen ble solgt «som den er»" }).check();
  await veiviser.neste();

  await expect(veiviser.tittel("Hvem kjøpte du bilen av?")).toBeVisible();
  await brev.forhandler.fill("Testbil AS");
  // Choosing the dealer moves on by itself.
  await page.getByRole("button", { name: /Bruk «.*» som skrevet/ }).click();

  // The defect in the buyer's own words: nothing goes to the language model.
  await expect(veiviser.tittel("Beskriv feilen")).toBeVisible();
  await page.getByLabel("Når viste den første feilen seg?").fill("2024-06-01");
  await page.getByLabel("Beskriv feilen eller feilene med dine egne ord").fill("Motorlampen lyser, og bilen mister kraft i motbakker.");
  await page.getByRole("button", { name: "Bruk teksten min som den er" }).click();

  await expect(veiviser.tittel("Hva visste du før kjøpet?")).toBeVisible();
  await page.getByLabel("Visste du om feilen før du kjøpte?").selectOption({ label: "Nei" });
  await page.getByLabel("Sa annonsen eller selgeren noe om bilen som ikke stemte?").selectOption({ label: "Nei" });
  await veiviser.neste();

  await expect(veiviser.tittel("Har du tatt opp feilen med forhandleren?")).toBeVisible();
  await page.getByLabel("Når tok du opp feilen første gang?").fill("2024-06-10");
  await page.getByLabel("Hvordan tok du kontakt?").selectOption({ label: "E-post" });
  await page.getByLabel("Hva har forhandleren gjort?").selectOption({ label: "Forhandleren vil forsøke, eller har ikke svart ennå" });
  await veiviser.neste();

  await expect(veiviser.tittel("Hva har du av dokumentasjon?")).toBeVisible();
  await page.getByLabel("Har du en verksted- eller tilstandsrapport?").selectOption({ label: "Nei" });
  await page.getByRole("button", { name: "Bekreft vedlegg" }).click();

  // The dealer has not had the chance to repair yet, so the claim is repair: nothing to choose.
  await expect(veiviser.tittel("Hva krever du?")).toBeVisible();
  await veiviser.neste();

  await expect(veiviser.tittel("Hvem sender brevet?")).toBeVisible();
  await page.getByLabel("Navn").fill("Test Testesen");
  await page.getByLabel("Adresse").fill("Testveien 1");
  await page.getByLabel("Postnummer").fill("0184");
  await page.getByLabel("Sted").fill("Oslo");
  await page.getByRole("button", { name: "Se brevet" }).click();
  await expect(page).toHaveURL(/\/brev\/[\w-]{22}$/);

  await page.getByRole("tab", { name: "Brev" }).click();
  await expect(brev.overskrift).toHaveText("Reklamasjon på mangel – Testmerke Modell X (2019), reg.nr. ZZ 99999");
  await expect(brev.ark).not.toContainText("[reg.nr.]");
  await expect(brev.ark).toContainText("Test Testesen");
  await expect(brev.ark).toContainText("Testbil AS");
  await expect(brev.ark).toContainText("solgt «som den er»");
  await expect(brev.ark).not.toContainText("[Beskriv feilen");
  await expect(brev.ark).not.toContainText("[Ditt navn]");
});
