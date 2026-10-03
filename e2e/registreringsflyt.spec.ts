import { expect, idFra, mockKjoretoy, test } from "./fixtures";

// The one flow test: from the landing page, through the four steps and the assessment, to the finished letter.
// Runs against the real /api/vurder and the database, so it checks the shape of the assessment and
// not the number of decisions, which changes when `hent` adds more.

// A day last year is always a valid purchase date, inside the presumption period and the five-year deadline.
const KJOPSDATO = `${new Date().getFullYear() - 1}-03-15`;

test("fra forsiden gjennom de fire stegene og vurderingen til ferdig brev", async ({ page, skjema, brev, sak }) => {
  await mockKjoretoy(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Start vurderingen" }).click();

  await expect(skjema.tittel("Hvilken bil kjøpte du?")).toBeVisible();
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.velgKjop(KJOPSDATO);
  await skjema.kjopesum.fill("250000");
  await expect(skjema.kjopesum).toHaveValue("250 000");
  await skjema.kmVedKjop.fill("80000");
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.hentKjoretoy("ZZ 99999");
  await skjema.neste();

  await expect(skjema.tittel("Hva er galt med bilen?")).toBeVisible();
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.velgFeiltype("Motor");
  await skjema.svar("Hvor lenge etter kjøpet oppdaget du feilen?", "Innen 6 måneder");
  await skjema.neste();

  await expect(skjema.tittel("Hva har forhandleren sagt?")).toBeVisible();
  await skjema.svar("Ble du fortalt om feilen før kjøpet?", "Nei");
  await skjema.svar("Ble du feilaktig informert av selger eller annonse?", "Nei");
  await expect(skjema.sporsmal("Hva har skjedd siden?")).toBeHidden();
  await skjema.svar("Har du tatt opp feilen med forhandleren?", "Ja");
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.svar("Hva har skjedd siden?", "Forhandleren avviste");
  await skjema.neste();

  await expect(skjema.tittel("Hvilke bevis har du?")).toBeVisible();
  await skjema.svar("Har du en verksted- eller tilstandsrapport?", "Ja");
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.svar("Sier rapporten at feilen sannsynligvis var til stede før kjøpet?", "Ja");

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
    await expect(page.getByText("Sterk sak", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
    const grunnlag = page.getByRole("region", { name: "Dette bygger vurderingen på" });
    await expect(grunnlag).toContainText(/\d+ (lignende )?vedtak/);
    await expect(grunnlag.getByRole("link", { name: /^Forbrukerklageutvalget, sak / })).toBeVisible();
    await expect(grunnlag.getByRole("link", { name: "forbrukerkjøpsloven § 18" })).toHaveAttribute("href", /lovdata\.no/);
    await expect(page.getByRole("heading", { name: "Få reklamasjonsbrevet" })).toBeVisible();
    // Before paying, the car the letter is for is shown, and cannot be changed there.
    await expect(page.getByRole("group", { name: "Brevet skrives for" })).toContainText("Testmerke Modell X");
    await expect(page.getByRole("group", { name: "Brevet skrives for" })).toContainText("ZZ 99999");
    await expect(page.getByText("Den er veiledende og ikke juridisk rådgivning")).toBeVisible();
  };
  await vurdering();

  await page.getByRole("button", { name: "Betal med vipps" }).click();
  await expect(page).toHaveURL(/\/brev\/[\w-]{22}$/);
  sak.rydd(idFra(page.url()));
  await expect(brev.overskrift).toHaveText("Reklamasjon på mangel – Testmerke Modell X (2019), reg.nr. ZZ 99999");
  await expect(brev.ark).not.toContainText("[reg.nr.]");
});
