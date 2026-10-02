import { expect, test } from "./fixtures";

// Runs against the real /api/vurder and the database, so it checks the shape of the assessment and
// not the number of decisions, which changes when `hent` adds more.

// A day last year is always a valid purchase date, inside the presumption period and the five-year deadline.
const KJOPSDATO = `${new Date().getFullYear() - 1}-03-15`;

test("kjøpsdatoen velges med datovelger og kan ikke ligge i fremtiden", async ({ page, skjema }) => {
  await page.goto("/vurdering");
  await skjema.kjopesum.fill("250000");
  await skjema.kmVedKjop.fill("80000");
  await expect(skjema.nesteKnapp).toBeDisabled();

  const imorgen = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await expect(skjema.kjopsdato).toHaveAttribute("type", "date");
  await skjema.velgKjop(imorgen);
  await expect(skjema.nesteKnapp).toBeDisabled();

  await skjema.velgKjop(KJOPSDATO);
  await expect(skjema.nesteKnapp).toBeEnabled();
});

test("en gammel lenke med kjøpt måned og år åpner skjemaet med siste dag i måneden", async ({ page, skjema }) => {
  await page.goto(`/vurdering?kjopAr=${new Date().getFullYear() - 1}&kjopManed=2&kjopesum=250000&kmVedKjop=80000&steg=1`);
  await expect(skjema.kjopsdato).toHaveValue(`${new Date().getFullYear() - 1}-02-28`);
});

test("fra forsiden gjennom de fire stegene til vurderingen", async ({ page, skjema }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start vurderingen" }).click();

  await expect(skjema.tittel("Hvilken bil kjøpte du?")).toBeVisible();
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.velgKjop(KJOPSDATO);
  await skjema.kjopesum.fill("250000");
  await expect(skjema.kjopesum).toHaveValue("250 000");
  await skjema.kmVedKjop.fill("80000");
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
    await expect(page.getByText("Den er veiledende og ikke juridisk rådgivning")).toBeVisible();
  };
  await vurdering();

  // The address is now a link to the assessment itself.
  const url = new URL(page.url());
  expect(url.searchParams.has("steg")).toBe(false);
  expect(url.searchParams.get("kjopsdato")).toBe(KJOPSDATO);
  await page.reload();
  await vurdering();

  await page.getByRole("button", { name: "← Endre svar" }).click();
  await expect(skjema.tittel("Hvilken bil kjøpte du?")).toBeVisible();
  await expect(skjema.kjopsdato).toHaveValue(KJOPSDATO);
  await expect(skjema.kjopesum).toHaveValue("250 000");
});
