import { expect, idFra, mockKjoretoy, test } from "./fixtures";

// The one flow test: from the landing page, through the two steps and the assessment, to the finished letter.
// Runs against the real /api/vurder and the database, so it checks the shape of the assessment and
// not the number of decisions, which changes when `hent` adds more.

test("fra forsiden gjennom stegene og vurderingen til ferdig brev", async ({ page, skjema, brev, veiviser, sak }) => {
  // The letter steps' questions with a few answers are radio groups named by the question.
  const velg = (sporsmal: string, svar: string) => page.getByRole("radiogroup", { name: sporsmal }).getByRole("radio", { name: svar, exact: true }).click();
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

  // The assessment asks only what can stop the claim and when the defect showed; the defect type, contact
  // and the report are asked after purchase.
  await expect(skjema.tittel("Når viste feilen seg?")).toBeVisible();
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.svar("Hvor lenge etter kjøpet viste feilen seg?", "Innen 6 måneder");
  await expect(skjema.nesteKnapp).toBeDisabled();
  await skjema.svar("Visste du om feilen da du kjøpte bilen?", "Nei");
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Du kan ha en sak mot forhandleren.");
    // Bought less than two years ago: inside the two-year presumption, so the dealer has the burden of proof.
    await expect(page.getByRole("note", { name: "Dette må du vite" })).toHaveText(
      "Feilen viste seg innen 2 år etter kjøpet. Da er det forhandleren som må vise at den ikke var der da du kjøpte bilen.",
    );
    await expect(page.getByText(/^Vi har sjekket saken din opp mot \d+ vedtak om bruktbil kjøpt fra forhandler som fikk medhold\./)).toBeVisible();
    // No lists of strengths and weaknesses before purchase.
    await expect(page.getByRole("region", { name: "Dette styrker saken din" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Dette svekker saken din" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Få reklamasjonsbrevet" })).toBeVisible();
    // Before paying, the car the letter is for is shown, and cannot be changed there.
    await expect(page.getByRole("group", { name: "Brevet skrives for" })).toContainText("Testmerke Modell X");
    await expect(page.getByRole("group", { name: "Brevet skrives for" })).toContainText("ZZ 99999");
    await expect(page.getByText("Den er veiledende og ikke juridisk rådgivning")).toBeVisible();
  };
  await vurdering();

  // On a phone a bar at the bottom has the same button until the card is in view; pay in the card.
  await page.getByRole("complementary", { name: "Få reklamasjonsbrevet" }).getByRole("button", { name: "Betal med vipps" }).click();
  await expect(page).toHaveURL(/\/brev\/[\w-]{22}\/veiviser$/);
  sak.rydd(idFra(page.url()));

  // Right after buying, a wizard asks for everything the letter needs, one step per screen, before
  // the letter is shown. Every step, in order, to a finished letter.
  await expect(veiviser.tittel("Takk! Nå lager vi brevet ditt.")).toBeVisible();
  // The clarifying round calls the language model; here it answers with one question, then «klar».
  let avklaringer = 0;
  // Writing the letter calls the language model; here a made-up letter comes back as the stream would,
  // laid on the case as the server has it (an empty save returns it unchanged).
  await page.route("**/api/sak/*/skriv", async (route) => {
    const lagret = await route.fetch({ url: route.request().url().replace(/\/skriv$/, ""), method: "PATCH", headers: { "Content-Type": "application/json" }, postData: "{}" });
    const { utfylling } = (await lagret.json()) as { utfylling: Record<string, unknown> };
    const setning = (tekst: string) => ({ tekst, argumenter: [] });
    const brev = {
      utkast: {
        sitater: [],
        avsnitt: [
          { setninger: [setning("Jeg viser til kjøpet av bilen fra dere 12. mars 2024 for 250 000 kr."), setning("Motorlampen lyser, og bilen mister kraft i motbakker.")] },
          { setninger: [setning("Et alminnelig forbehold om at bilen selges «som den er», har ingen virkning overfor meg som forbruker, jf. § 15 andre ledd og § 3.")] },
          { setninger: [setning("Jeg ber om skriftlig svar innen {{dato:svarfrist}}.")] },
        ],
      },
      avvik: [],
      funn: [],
      grunnlag: "test",
      versjon: "test",
      skrevet: "2026-10-07T00:00:00.000Z",
    };
    const linjer = [{ fremdrift: "skriver" }, { fremdrift: "leser" }, { ferdig: true, utfylling: { ...utfylling, brev } }];
    return route.fulfill({ contentType: "application/x-ndjson", body: linjer.map((l) => JSON.stringify(l)).join("\n") + "\n" });
  });
  await page.route("**/api/sak/*/avklaring", (route) => {
    avklaringer++;
    const sporsmal = [{ id: "r1s1", tema: "feilen", tekst: "Hvor ofte lyser motorlampen?", alternativer: ["Hver gang bilen kjøres", "Av og til"], flervalg: false }];
    return route.fulfill({ json: avklaringer === 1 ? { status: "sporsmal", runde: 1, sporsmal, rettelser: [] } : { status: "klar", runde: 2, sporsmal: [], rettelser: [] } });
  });
  await page.getByRole("button", { name: "Start" }).click();

  // The registry gave no purchase date, so the first step asks for it.
  await expect(veiviser.tittel("Kjøpet")).toBeVisible();
  await page.getByLabel("Når kjøpte du bilen?").fill("12.03.2024");
  await page.getByLabel("Hva kostet bilen?").fill("250000");
  await page.getByRole("radio", { name: "Ja, bilen ble solgt «som den er»" }).check();
  await veiviser.neste();

  await expect(veiviser.tittel("Forhandler")).toBeVisible();
  await brev.forhandler.fill("Testbil AS");
  // A name not found in the register is saved as written.
  await veiviser.neste();

  // What the defect concerns, then the defect in the buyer's own words: nothing goes to the language model.
  await expect(veiviser.tittel("Feilen")).toBeVisible();
  await page.getByRole("group", { name: "Hva gjelder feilen?" }).getByRole("button", { name: "Motor", exact: true }).click();
  await page.getByLabel("Når viste den første feilen seg?").fill("01.06.2024");
  await page.getByLabel("Beskriv feilen med dine egne ord").fill("Motorlampen lyser, og bilen mister kraft i motbakker.");
  await veiviser.neste();

  // «Visste du om feilen» was answered in the assessment and stands pre-filled.
  await expect(veiviser.tittel("Før kjøpet")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Visste du om feilen da du kjøpte bilen?" }).getByRole("radio", { name: "Nei", exact: true })).toBeChecked();
  await velg("Sa annonsen eller selgeren noe om bilen som ikke stemte?", "Nei");
  await veiviser.neste();

  // Not asked in the assessment, so nothing is chosen yet.
  await expect(veiviser.tittel("Kontakt med forhandleren")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Har du tatt opp feilen med forhandleren?" }).getByRole("radio", { checked: true })).toHaveCount(0);
  await velg("Har du tatt opp feilen med forhandleren?", "Ja");
  await page.getByLabel("Når tok du opp feilen første gang?").fill("10.06.2024");
  await velg("Hvordan tok du kontakt?", "E-post");
  await velg("Hva har forhandleren gjort?", "Forhandleren vil forsøke, eller har ikke svart ennå");
  await veiviser.neste();

  await expect(veiviser.tittel("Tilstandsrapport")).toBeVisible();
  await velg("Har du en verksted- eller tilstandsrapport?", "Nei");
  await veiviser.neste();

  // The dealer has not had the chance to repair yet, so the claim is repair: nothing to choose.
  await expect(veiviser.tittel("Kravet")).toBeVisible();
  await veiviser.neste();

  await expect(veiviser.tittel("Om deg")).toBeVisible();
  await page.getByLabel("Navn").fill("Test Testesen");
  await page.getByLabel("Adresse").fill("Testveien 1");
  await page.getByLabel("Postnummer").fill("0184");
  await page.getByLabel("Sted").fill("Oslo");
  await veiviser.neste();

  await expect(veiviser.tittel("Vedlegg")).toBeVisible();
  await page.getByRole("button", { name: "Bekreft vedlegg" }).click();

  // The clarifying round (the model is mocked): one question, then nothing more to ask.
  await expect(veiviser.tittel("Gjennomgang")).toBeVisible();
  await velg("Hvor ofte lyser motorlampen?", "Hver gang bilen kjøres");
  await veiviser.neste();
  await expect(page.getByText("Vi har det vi trenger for å skrive brevet.")).toBeVisible();
  await page.getByRole("button", { name: "Se brevet" }).click();
  await expect(page).toHaveURL(/\/brev\/[\w-]{22}$/);

  await page.getByRole("tab", { name: "Brev" }).click();
  await expect(brev.overskrift).toHaveText("Reklamasjon på mangel – Testmerke Modell X (2019), reg.nr. ZZ 99999");
  await expect(brev.ark).not.toContainText("[reg.nr.]");
  await expect(brev.ark).toContainText("Test Testesen");
  await expect(brev.ark).toContainText("Testbil AS");
  // Bought in 2024: a general «som den er» has no effect against a consumer (§ 15 andre ledd).
  await expect(brev.ark).toContainText("selges «som den er», har ingen virkning");
  await expect(brev.ark).not.toContainText("[Ditt navn]");
  await expect(brev.ark).not.toContainText("{{");
});
