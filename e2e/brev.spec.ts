import type { Page } from "@playwright/test";
import { finnesSak, settSvarDirekte, settUtlopt } from "./db";
import { expect, idFra, KJORETOY, mockKjoretoy, test, type Brev, type Saker } from "./fixtures";
import { fraParametre, TOM_INNSENDING, tilParametre, type Innsending } from "../src/lib/vurdering/innsending";

// A letter is a case in the database, so each test opens a real case with made-up answers (the `sak`
// fixture deletes it afterwards). Lookups in Statens vegvesen and Brreg are mocked.

const AR = new Date().getFullYear();

// Bought in March last year, defect within six months, dealer not contacted, no evidence.
const svar = (endring: Partial<Innsending> = {}): Innsending => ({
  ...TOM_INNSENDING,
  kjopsdato: `${AR - 1}-03-12`,
  kjopesum: "250000",
  kmVedKjop: "80000",
  feiltyper: ["motor"],
  oppdaget: "innen_6_mnd",
  opplystForKjop: "nei",
  feilOpplysning: "nei",
  kontakt: "nei",
  verkstedrapport: "nei",
  bilder: "nei",
  ...endring,
});

test("brevet følger skisse: overskrift, lovhenvisninger, beløp, frist og plassholdere", async ({ page, brev, sak }) => {
  await page.goto(await sak.apne(svar()));

  // The vehicle was chosen in the assessment and comes with the case.
  await expect(brev.overskrift).toHaveText("Reklamasjon på mangel – Testmerke Modell X (2019), reg.nr. ZZ 99999");
  await expect(brev.ark).not.toContainText("[reg.nr.]");
  for (const tekst of ["forbrukerkjøpsloven § 16", "§ 18", "forbrukerkjøpsloven § 27", "jf. § 29 og § 30", "250 000 kr", "Jeg ble heller ikke opplyst om feilen før kjøpet."]) {
    await expect(brev.ark).toContainText(tekst);
  }
  await expect(brev.ark).toContainText(/innen 14 dager fra dette brevets dato, det vil si innen \d{1,2}\. [a-zæøå]+ \d{4}\./);
  for (const plassholder of ["[Ditt navn]", "[Forhandlerens navn]", "[Beskriv feilen"]) {
    await expect(brev.plassholder(plassholder)).toBeVisible();
  }
});

test("avvist av forhandleren: krever prisavslag eller heving, ikke retting", async ({ page, brev, sak }) => {
  await page.goto(await sak.apne(svar({ kontakt: "avvist" })));

  await expect(brev.ark).toContainText("jf. § 31 og § 32");
  await expect(brev.plassholder("[prisavslag / heving av kjøpet]")).toBeVisible();
  await expect(brev.ark).not.toContainText("§ 29");
});

test("feil som viste seg etter mer enn to år gir ingen henvisning til § 18", async ({ page, brev, sak }) => {
  await page.goto(await sak.apne(svar({ kjopsdato: `${AR - 3}-03-12`, oppdaget: "over_2_ar" })));

  await expect(brev.ark).toContainText("Feilen viste seg mer enn to år etter levering.");
  await expect(brev.ark).not.toContainText("§ 18");
});

test("vedlegget følger beviset brukeren har", async ({ page, brev, sak }) => {
  await page.goto(await sak.apne(svar()));
  await expect(brev.ark).toContainText("Vedlagt følger kjøpekontrakt.");
  await expect(brev.ark).not.toContainText("verkstedrapport");

  await page.goto(await sak.apne(svar({ verkstedrapport: "ja", rapportSierForKjop: "ja", bilder: "" })));
  await expect(brev.ark).toContainText("Vedlagt følger kjøpekontrakt og verkstedrapport.");
});

test("uten svar sendes brukeren til første steg i skjemaet", async ({ page, skjema }) => {
  await page.goto("/brev");

  await expect(page).toHaveURL(/\/vurdering/);
  await expect(skjema.tittel("Hvilken bil kjøpte du?")).toBeVisible();
});

test("en gammel lenke med svarene i adressen sendes til vurderingen, med svarene i behold", async ({ page }) => {
  await page.route("**/api/vurder", (route) =>
    route.fulfill({ json: { niva: "middels", tittel: "Du kan ha krav på at forhandleren retter feilen.", begrunnelse: "Feilen ble oppdaget innen seks måneder etter kjøpet.", grunnlag: [], tiltak: [], utvalg: null, eksempel: null } }),
  );
  await page.goto(`/brev?${tilParametre(svar())}`);

  await expect(page).toHaveURL(/\/vurdering\?/);
  expect(fraParametre(new URL(page.url()).searchParams)).toEqual(svar());
  await expect(page.getByRole("heading", { level: 1, name: "Du kan ha krav på at forhandleren retter feilen." })).toBeVisible();
});

test("ufullstendige svar gir ingen sak", async ({ request }) => {
  const res = await request.post("/api/sak", { data: svar({ kontakt: "", verkstedrapport: "" }) });
  expect(res.status()).toBe(400);
  expect(((await res.json()) as { id?: string }).id).toBeUndefined();
});

test("en sak kan ikke åpnes uten en bil fra registeret", async ({ request }) => {
  expect((await request.post("/api/sak", { data: svar() })).status()).toBe(400);
  const ugyldig = { regnr: "<script>", merke: "Testmerke", modell: "Modell X", ar: 2019 };
  expect((await request.post("/api/sak", { data: { ...svar(), kjoretoy: ugyldig } })).status()).toBe(400);
});

test("en sak som ikke finnes, eller som er utløpt, vises som «finnes ikke» og slettes", async ({ page, sak }) => {
  await page.goto("/brev/AAAAAAAAAAAAAAAAAAAAAA");
  await expect(page.getByRole("heading", { level: 1, name: "Vi finner ikke dette brevet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start vurderingen" })).toBeVisible();

  const url = await sak.apne(svar());
  await settUtlopt(idFra(url));
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1, name: "Vi finner ikke dette brevet" })).toBeVisible();
  expect(await finnesSak(idFra(url))).toBe(false);
});

test("«Slett saken» spør først, og sletter så saken for godt", async ({ page, brev, sak }) => {
  const url = await sak.apne(svar());
  await page.goto(url);

  await page.getByRole("button", { name: "Slett saken" }).click();
  await page.getByRole("button", { name: "Avbryt" }).click();
  await expect(brev.ark).toBeVisible();
  expect(await finnesSak(idFra(url))).toBe(true);

  await page.getByRole("button", { name: "Slett saken" }).click();
  await page.getByRole("button", { name: "Ja, slett" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await finnesSak(idFra(url))).toBe(false);

  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1, name: "Vi finner ikke dette brevet" })).toBeVisible();
});

const VURDERING = {
  niva: "middels",
  tittel: "Du kan ha krav på at forhandleren retter feilen.",
  begrunnelse: "Feilen ble oppdaget innen seks måneder etter kjøpet.",
  grunnlag: [],
  tiltak: [],
  utvalg: null,
  eksempel: null,
};

test("fra vurderingen til brevet: bilen vises før betaling, og følger saken", async ({ page, brev, sak, skjema }) => {
  await page.route("**/api/vurder", (route) => route.fulfill({ json: VURDERING }));
  await mockKjoretoy(page);

  // The answers are in the link; the car is chosen in the first step, and the rest is read through.
  await page.goto(`/vurdering?${tilParametre(svar())}&steg=1`);
  await skjema.hentKjoretoy("ZZ 99999");
  for (let n = 0; n < 4; n++) await skjema.neste();
  await expect(page.getByRole("heading", { level: 1, name: VURDERING.tittel })).toBeVisible();

  // The buyer sees which car the letter is for, and cannot change it here.
  await expect(skjema.bilKort).toContainText("ZZ 99999");
  await expect(skjema.bilKort).toContainText("Testmerke Modell X");
  await expect(skjema.bilKort).toContainText("Første gang registrert 2019");
  await expect(skjema.bilKort).toContainText("Bilen kan ikke byttes etter kjøpet");
  await expect(skjema.regnr).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Endre", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Betal med vipps" }).click();
  // The letter is a case of its own; the answers are no longer in the address.
  await expect(page).toHaveURL(/\/brev\/[\w-]{22}$/);
  sak.rydd(idFra(page.url()));
  await expect(brev.overskrift).toHaveText("Reklamasjon på mangel – Testmerke Modell X (2019), reg.nr. ZZ 99999");
  await expect(brev.ark).not.toContainText("[reg.nr.]");

  // The buyer has bought the letter: the vehicle is fixed, and the way back is the answers on this page.
  await expect(page.getByRole("link", { name: /Tilbake til vurderingen/ })).toHaveCount(0);
  await expect(brev.steg("Registreringsnummer")).toHaveCount(0);
  await expect(brev.svarKort).toContainText("Testmerke Modell X (2019), ZZ 99999 (kan ikke endres)");
});

test("en vurdering uten bil kan ikke kjøpes: registreringsnummeret legges inn først, og svarene beholdes", async ({ page, skjema }) => {
  await page.route("**/api/vurder", (route) => route.fulfill({ json: VURDERING }));
  await mockKjoretoy(page);

  // A link with the answers has no car.
  await page.goto(`/vurdering?${tilParametre(svar())}`);
  await expect(page.getByRole("heading", { level: 1, name: VURDERING.tittel })).toBeVisible();
  await expect(skjema.manglerBil).toBeVisible();
  await expect(skjema.bilKort).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Betal med vipps" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Betal med kort" })).toBeDisabled();
  // The car cannot be looked up from the purchase panel.
  await expect(skjema.regnr).toHaveCount(0);

  await page.getByRole("button", { name: "Legg inn registreringsnummer" }).click();
  await expect(skjema.tittel("Hvilken bil kjøpte du?")).toBeVisible();
  await expect(skjema.kjopesum).toHaveValue("250 000");
  await skjema.hentKjoretoy("ZZ 99999");
  for (let n = 0; n < 4; n++) await skjema.neste();

  await expect(skjema.bilKort).toContainText("Testmerke Modell X");
  await expect(skjema.manglerBil).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Betal med vipps" })).toBeEnabled();
});

// The vehicle comes with the case, so the dealer is the first step and is open at once.
async function tilForhandlerSteget(page: Page, brev: Brev, sak: Saker) {
  await page.goto(await sak.apne(svar()));
  await expect(brev.steg("Forhandler")).toHaveAttribute("aria-current", "step");
}

const TESTBIL = {
  orgnr: "999888777",
  navn: "TESTBIL AS",
  kommune: "OSLO",
  bransje: "Detaljhandel med biler",
  status: null,
  adresse: { linjer: ["Industriveien 3"], postnummer: "0184", poststed: "Oslo" },
};

test("forhandler søkes opp på navn og settes inn som mottaker, og kan endres", async ({ page, brev, sak }) => {
  await page.route("**/api/firma?*", (route) => route.fulfill({ json: { forslag: [TESTBIL] } }));
  await tilForhandlerSteget(page, brev, sak);

  await brev.forhandler.fill("testbil");
  // Under the name the list shows only the place and the org.nr., not the line of business.
  const forslag = page.getByRole("option", { name: /Testbil AS/ });
  await expect(forslag).toContainText("Oslo · org.nr 999 888 777");
  await expect(forslag).not.toContainText("Detaljhandel");
  await forslag.click();

  const mottaker = brev.ark.getByText("Testbil AS", { exact: true });
  await expect(mottaker).toBeVisible();
  await expect(brev.ark).toContainText("Org.nr. 999 888 777");
  // The postal address comes with the dealer.
  await expect(brev.ark.getByText("Industriveien 3")).toBeVisible();
  await expect(brev.ark.getByText("0184 Oslo")).toBeVisible();
  await expect(brev.ark).not.toContainText("[Forhandlerens navn]");
  await expect(brev.ark).not.toContainText("[Forhandlerens adresse]");
  await expect(brev.steg("Forhandler").getByRole("img", { name: "Ferdig" })).toBeVisible();
  await expect(brev.steg("Forhandler")).toContainText("Koblet til Enhetsregisteret · org.nr 999 888 777");
  await page.reload();
  await expect(brev.ark.getByText("0184 Oslo")).toBeVisible();
  await expect(brev.steg("Forhandler")).toContainText("Koblet til Enhetsregisteret · org.nr 999 888 777");

  await brev.steg("Forhandler").getByRole("button", { name: "Endre" }).click();
  await expect(brev.steg("Forhandler")).toHaveAttribute("aria-current", "step");
  await expect(brev.plassholder("[Forhandlerens navn]")).toBeVisible();
  await expect(brev.plassholder("[Forhandlerens adresse]")).toBeVisible();
});

test("forhandler kan søkes opp på organisasjonsnummer, også med mellomrom", async ({ page, brev, sak }) => {
  const sok: string[] = [];
  await page.route("**/api/firma?*", (route) => {
    sok.push(new URL(route.request().url()).searchParams.get("q") ?? "");
    return route.fulfill({ json: { forslag: [TESTBIL] } });
  });
  await tilForhandlerSteget(page, brev, sak);

  await brev.forhandler.fill("999 888 777");
  await page.getByRole("option", { name: /999 888 777/ }).click();

  await expect(brev.ark).toContainText("Testbil AS");
  expect(sok.at(-1)).toBe("999 888 777");
});

test("forhandler som ikke finnes i registeret kan brukes som skrevet, og beholdes ved ny innlasting", async ({ page, brev, sak }) => {
  await page.route("**/api/firma?*", (route) => route.fulfill({ json: { forslag: [] } }));
  await tilForhandlerSteget(page, brev, sak);

  await expect(page.getByRole("button", { name: "Bruk som skrevet" })).toBeDisabled();
  await brev.forhandler.fill("Bilsalget");
  await page.getByRole("button", { name: "Bruk «Bilsalget» som skrevet" }).click();

  await expect(brev.ark).toContainText("Bilsalget");
  await expect(brev.steg("Forhandler")).toContainText("Ikke koblet til Enhetsregisteret");
  await expect(brev.ark).not.toContainText("Org.nr.");
  // No register entry, so no address: the placeholders stay.
  await expect(brev.plassholder("[Forhandlerens adresse]")).toBeVisible();

  await page.reload();
  await expect(brev.ark).toContainText("Bilsalget");
  await expect(brev.steg("Forhandler")).toContainText("Ikke koblet til Enhetsregisteret");
});

// The vehicle comes with the case and the dealer is done, so the tests below start at the step they are about.
const FEILEN = { dato: `${AR - 1}-09-02`, egen: "Motorlampen lyser og bilen mister kraft.", tekst: "Motorlampen lyser, og bilen mister trekkraft." };
const FORHANDLER_SVAR = {
  forhandler: { type: "brreg", orgnr: "999888777", navn: "Testbil AS", adresse: { linjer: ["Industriveien 3"], postnummer: "0184", poststed: "Oslo" } },
};

test("feilen, krav, vedlegg og avsender fylles ut i rekkefølge og havner i brevet", async ({ page, brev, sak }) => {
  await page.goto(await sak.apne(svar(), FORHANDLER_SVAR));

  // Dealer not contacted: no step about earlier contact.
  await expect(brev.steg("Kontakt med forhandleren")).toHaveCount(0);

  // The purchase date comes from the assessment: there is no step for it.
  await expect(brev.steg("Kjøpsdato")).toHaveCount(0);
  await expect(brev.ark).toContainText(`fra dere 12. mars ${AR - 1} for 250 000 kr`);

  // The defect in the buyer's own words, without asking the language model.
  const feilen = brev.steg("Feilen");
  await expect(feilen).toHaveAttribute("aria-current", "step");
  await expect(feilen.getByRole("button", { name: "Bruk min egen tekst" })).toBeDisabled();
  await feilen.getByLabel("Når viste feilen seg første gang?").fill(`${AR - 1}-09-02`);
  await feilen.getByLabel("Beskriv feilen med egne ord").fill("Motorlampen lyser, og bilen mister trekkraft i motbakker.");
  await feilen.getByRole("button", { name: "Bruk min egen tekst" }).click();
  await expect(brev.ark).toContainText(`Feilen viste seg første gang 2. september ${AR - 1}. Motorlampen lyser, og bilen mister trekkraft i motbakker.`);
  await expect(brev.ark).not.toContainText("[Beskriv feilen");
  // No wrong information before the purchase, so no step about it.
  await expect(brev.steg("Opplysninger før kjøpet")).toHaveCount(0);

  // The dealer may still repair, so there is nothing to choose: the claim is repair.
  await expect(brev.steg("Kravet")).toHaveAttribute("aria-current", "step");
  await expect(brev.steg("Kravet").getByRole("radio")).toHaveCount(0);
  await brev.lagreKnapp("Kravet").click();
  await expect(brev.steg("Kravet")).toContainText("Retting uten kostnad for deg");

  await expect(brev.steg("Vedlegg")).toHaveAttribute("aria-current", "step");
  await expect(brev.steg("Vedlegg").getByLabel("Kjøpekontrakt")).toBeChecked();
  await brev.steg("Vedlegg").getByLabel("Annonsen bilen ble solgt med").check();
  await brev.lagreKnapp("Vedlegg").click();
  await expect(brev.ark).toContainText("Vedlagt følger kjøpekontrakt og annonsen.");

  const deg = brev.steg("Deg");
  await expect(deg).toHaveAttribute("aria-current", "step");
  await deg.getByLabel("Navn").fill("Test Testesen");
  await deg.getByLabel("Adresse").fill("Testveien 1");
  await deg.getByLabel("Postnummer").fill("0184");
  await expect(brev.lagreKnapp("Deg")).toBeDisabled();
  await deg.getByLabel("Sted").fill("Oslo");
  await brev.lagreKnapp("Deg").click();

  await expect(brev.ark).toContainText(/Oslo, \d{1,2}\. [a-zæøå]+ \d{4}/);
  await expect(brev.ark).not.toContainText("[Ditt navn]");
  await expect(brev.ark).not.toContainText("[Sted]");
  await expect(brev.ark.getByText("Test Testesen")).toHaveCount(2);
  await expect(brev.ark.getByText("Testveien 1")).toBeVisible();
  await expect(page.getByText("Mangler", { exact: true })).toHaveCount(0);
  // Every step is done: the letter has nothing left to fill in.
  await expect(brev.ark).not.toContainText("[");
  // What has been filled in reads as ordinary text: nothing in the letter is marked.
  await expect(brev.ark.locator("mark")).toHaveCount(0);

  // Everything is saved with the case.
  await page.reload();
  await expect(brev.ark.getByText("Test Testesen")).toHaveCount(2);
  await expect(brev.ark).toContainText("Vedlagt følger kjøpekontrakt og annonsen.");

  // Changing a finished step keeps its value until the change is saved.
  await brev.endre("Deg");
  await deg.getByLabel("Navn").fill("Noe annet");
  await deg.getByRole("button", { name: "Avbryt" }).click();
  await expect(brev.ark.getByText("Test Testesen")).toHaveCount(2);
});

test("har forhandleren forsøkt å rette, spør vi når og hvordan det ble klaget, og hvor mange forsøk", async ({ page, brev, sak }) => {
  await page.goto(await sak.apne(svar({ kontakt: "forsokt" }), { ...FORHANDLER_SVAR, feilen: FEILEN }));

  const kontakt = brev.steg("Kontakt med forhandleren");
  await expect(kontakt).toHaveAttribute("aria-current", "step");
  await kontakt.getByLabel("Når tok du opp feilen første gang?").fill(`${AR - 1}-09-03`);
  await kontakt.getByLabel("Hvordan tok du kontakt?").selectOption({ label: "E-post" });
  await expect(brev.lagreKnapp("Kontakt med forhandleren")).toBeDisabled();
  await kontakt.getByLabel("Hvor mange ganger har forhandleren forsøkt å rette feilen?").selectOption("2");
  await brev.lagreKnapp("Kontakt med forhandleren").click();

  await expect(brev.ark).toContainText(`Jeg tok opp feilen med dere første gang 3. september ${AR - 1} på e-post. Dere har forsøkt å rette feilen to ganger uten å lykkes.`);
  await expect(kontakt).toContainText("2 rettingsforsøk");
  await expect(brev.steg("Kravet")).toHaveAttribute("aria-current", "step");
});

test("har forhandleren avvist, velger brukeren prisavslag eller heving, med beløp og utgifter", async ({ page, brev, sak }) => {
  const url = await sak.apne(svar({ kontakt: "avvist" }), { ...FORHANDLER_SVAR, feilen: FEILEN, reklamasjon: { dato: `${AR - 1}-09-03`, mate: "epost" } });
  await page.goto(url);

  const krav = brev.steg("Kravet");
  await expect(krav).toHaveAttribute("aria-current", "step");
  await expect(brev.plassholder("[prisavslag / heving av kjøpet]")).toBeVisible();
  await expect(brev.lagreKnapp("Kravet")).toBeDisabled();

  await krav.getByRole("radio", { name: /^Prisavslag/ }).check();
  await krav.getByLabel("Hva koster det å rette feilen? (valgfritt)").fill("38000");
  await expect(krav.getByLabel("Hva koster det å rette feilen? (valgfritt)")).toHaveValue("38 000");

  await krav.getByRole("button", { name: "Legg til utgift" }).click();
  // An expense without an amount cannot be saved.
  await expect(brev.lagreKnapp("Kravet")).toBeDisabled();
  await krav.getByRole("group", { name: "Utgift 1" }).getByLabel("Beløp i kroner").fill("4500");
  await krav.getByRole("button", { name: "Legg til utgift" }).click();
  await krav.getByRole("group", { name: "Utgift 2" }).getByLabel("Type utgift").selectOption({ label: "Tauing" });
  await krav.getByRole("group", { name: "Utgift 2" }).getByLabel("Beløp i kroner").fill("2000");
  await brev.lagreKnapp("Kravet").click();

  await expect(brev.ark).toContainText("krever prisavslag på 38 000 kr, som tilsvarer kostnaden ved å få mangelen rettet, jf. § 31.");
  await expect(brev.ark).toContainText("verksted og feilsøking 4 500 kr og tauing 2 000 kr, til sammen 6 500 kr.");
  await expect(brev.ark).not.toContainText("[prisavslag / heving av kjøpet]");
  await expect(krav).toContainText("Prisavslag på 38 000 kr");
  await expect(krav).toContainText("Erstatning for utgifter: 6 500 kr");

  await brev.endre("Kravet");
  await krav.getByRole("radio", { name: /^Heving/ }).check();
  await krav.getByRole("group", { name: "Utgift 2" }).getByRole("button", { name: "Fjern" }).click();
  await brev.lagreKnapp("Kravet").click();
  await expect(brev.ark).toContainText("hever kjøpet, jf. § 32, og krever kjøpesummen på 250 000 kr tilbakebetalt mot at bilen leveres tilbake.");
  await expect(brev.ark).toContainText("jf. § 33: verksted og feilsøking 4 500 kr.");
  await expect(krav).toContainText("Heving av kjøpet");
});

test("endrer brukeren kjøpsdatoen, forkastes datoer som ikke lenger kan stemme", async ({ page, brev, sak }) => {
  const reklamasjon = { dato: `${AR - 1}-09-03`, mate: "epost" };
  await page.goto(await sak.apne(svar({ kontakt: "avvist" }), { ...FORHANDLER_SVAR, feilen: FEILEN, reklamasjon }));
  await expect(brev.ark).toContainText(`Feilen viste seg første gang 2. september ${AR - 1}`);
  await expect(brev.steg("Feilen")).toContainText("Viste seg");

  // The purchase moves to 1 October: the defect cannot have shown on 2 September.
  await brev.endreSvar();
  await brev.svarKort.getByLabel("Når kjøpte du bilen?").fill(`${AR - 1}-10-01`);
  await brev.lagreSvar();
  await expect(brev.svarKort).toContainText(`Kjøpt 1. oktober ${AR - 1}`);
  await expect(brev.plassholder("[Beskriv feilen")).toBeVisible();
  await expect(brev.steg("Feilen")).toHaveAttribute("aria-current", "step");
  // The date of the first complaint (3 September) is also before the new purchase date.
  await expect(brev.steg("Kontakt med forhandleren")).not.toContainText("3. september");
  await expect(brev.steg("Kontakt med forhandleren").getByRole("img", { name: "Ferdig" })).toHaveCount(0);
  await expect(brev.steg("Feilen")).toContainText(`Tidligst 1. oktober ${AR - 1}`);
  // Values that still fit are kept.
  await expect(brev.steg("Forhandler")).toContainText("Testbil AS");
  await page.reload();
  await expect(brev.plassholder("[Beskriv feilen")).toBeVisible();
});

// What was filled in on the letter page before the answers are corrected.
const UTFYLT = { ...FORHANDLER_SVAR, feilen: FEILEN, krav: { utgifter: [] } };

test("svarene fra vurderingen rettes på brevsiden, og brevet og stegene følger", async ({ page, brev, sak }) => {
  await page.goto(await sak.apne(svar(), UTFYLT));
  const kort = brev.svarKort;
  await expect(kort).toContainText(`Kjøpt 12. mars ${AR - 1} for 250 000 kr`);
  await expect(kort).toContainText("Feil: motor");
  await expect(kort).toContainText("Kontakt med forhandleren: ingen ennå");
  await expect(kort.getByLabel("Hva kostet bilen?")).toHaveCount(0);

  await brev.endreSvar();
  await kort.getByLabel("Hva kostet bilen?").fill("260000");
  await expect(kort.getByLabel("Hva kostet bilen?")).toHaveValue("260 000");
  await kort.getByLabel("Har du tatt opp feilen med forhandleren?").selectOption({ label: "Ja, forhandleren avviste" });
  await brev.lagreSvar();

  await expect(kort).toContainText("for 260 000 kr");
  await expect(kort).toContainText("Kontakt med forhandleren: forhandleren avviste");
  await expect(brev.ark).toContainText("for 260 000 kr");
  await expect(brev.ark).toContainText("jf. § 31 og § 32");
  await expect(brev.ark).not.toContainText("§ 29");
  // What the new answers need opens: when the dealer was contacted, and the choice of claim.
  await expect(brev.steg("Kontakt med forhandleren")).toHaveAttribute("aria-current", "step");
  await expect(brev.steg("Kravet").getByRole("img", { name: "Ferdig" })).toHaveCount(0);

  // Saved with the case.
  await page.reload();
  await expect(brev.ark).toContainText("for 260 000 kr");
  await expect(brev.svarKort).toContainText("forhandleren avviste");
});

test("svaret om rapport styrer oppfølgingsspørsmålet og vedlegget i brevet", async ({ page, brev, sak }) => {
  await page.goto(await sak.apne(svar(), FORHANDLER_SVAR));
  const kort = brev.svarKort;
  const rapport = kort.getByLabel("Har du en verksted- eller tilstandsrapport?");
  const rapportSier = kort.getByLabel("Sier rapporten at feilen sannsynligvis var til stede før kjøpet?");
  const bilder = kort.getByLabel("Har du bilder eller video av feilen?");

  await brev.endreSvar();
  // No report: the follow-up is about photos.
  await expect(bilder).toBeVisible();
  await expect(rapportSier).toHaveCount(0);
  await rapport.selectOption("ja");
  await expect(rapportSier).toBeVisible();
  await expect(bilder).toHaveCount(0);
  await expect(kort.getByRole("button", { name: "Lagre" })).toBeDisabled();
  await rapportSier.selectOption("ja");
  await brev.lagreSvar();

  await expect(brev.ark).toContainText("Vedlagt følger kjøpekontrakt og verkstedrapport.");
  await expect(kort).toContainText("Verkstedrapport");
});

test("«Avbryt» forkaster det som er endret i svarene", async ({ page, brev, sak }) => {
  await page.goto(await sak.apne(svar(), FORHANDLER_SVAR));

  await brev.endreSvar();
  await brev.svarKort.getByLabel("Hva kostet bilen?").fill("999999");
  await brev.svarKort.getByRole("button", { name: "Avbryt" }).click();

  await expect(brev.svarKort.getByLabel("Hva kostet bilen?")).toHaveCount(0);
  await expect(brev.svarKort).toContainText("for 250 000 kr");
  await expect(brev.ark).toContainText("for 250 000 kr");
});

test("en rettelse som gjør at fristen er ute, lagres med et varsel, og brevet blir stående", async ({ page, brev, sak }) => {
  const url = await sak.apne(svar(), FORHANDLER_SVAR);
  const varsel = page.getByRole("alert").filter({ hasText: "fristen for å klage ute" });
  await page.goto(url);
  await expect(brev.ark).toBeVisible();
  await expect(varsel).toHaveCount(0);

  // Forhandleren er ikke kontaktet, og kjøpet er over fem år gammelt med disse svarene.
  await brev.endreSvar();
  await brev.svarKort.getByLabel("Når kjøpte du bilen?").fill(`${AR - 6}-03-12`);
  await brev.lagreSvar();

  await expect(varsel).toBeVisible();
  await expect(brev.ark).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(varsel).toBeVisible();
  await expect(brev.ark).toContainText(`12. mars ${AR - 6}`);
});

test("svar som ikke lenger er fullstendige må rettes før brevet vises", async ({ page, brev, sak }) => {
  const url = await sak.apne(svar({ kontakt: "venter" }), FORHANDLER_SVAR);
  // Saved before the purchase passed five years, when the first complaint did not have to be dated.
  await settSvarDirekte(idFra(url), svar({ kontakt: "venter", kjopsdato: `${AR - 6}-03-12` }));
  await page.goto(url);

  await expect(page.getByRole("heading", { level: 2, name: "Svarene dine må rettes" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Velg når du første gang tok opp feilen" })).toBeVisible();
  await expect(brev.ark).toHaveCount(0);
  await expect(brev.svarKort.getByRole("button", { name: "Avbryt" })).toHaveCount(0);
  await expect(brev.svarKort.getByRole("button", { name: "Lagre" })).toBeDisabled();

  await brev.svarKort.getByLabel("År reklamert").selectOption(`${AR - 6}`);
  await brev.svarKort.getByLabel("Måned reklamert").selectOption("4");
  await brev.lagreSvar();

  await expect(brev.ark).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Fyll inn det som mangler" })).toBeVisible();
});

test("svarene erstattes bare med fullstendige og gyldige svar, på en sak som finnes", async ({ request, sak }) => {
  const id = idFra(await sak.apne(svar()));
  const put = (data: unknown, sakId = id) => request.put(`/api/sak/${sakId}/svar`, { data });

  expect((await put({ ...svar(), kontakt: "" })).status()).toBe(400);
  expect((await put({ ...svar(), kjopsdato: "2999-01-01" })).status()).toBe(400);
  expect((await put(null)).status()).toBe(400);
  expect((await put(svar(), "AAAAAAAAAAAAAAAAAAAAAA")).status()).toBe(404);

  const res = await put(svar({ kjopesum: "300000" }));
  expect(res.status()).toBe(200);
  // The vehicle is part of the case and is not touched by new answers.
  expect(await res.json()).toMatchObject({ svar: svar({ kjopesum: "300000" }), fristUte: false, utfylling: { kjoretoy: KJORETOY } });
});

test("serveren avviser utfylling som ikke passer saken", async ({ request, sak }) => {
  const id = idFra(await sak.apne(svar()));
  const lagre = async (data: unknown) => (await request.patch(`/api/sak/${id}`, { data })).status();

  // The purchase was on 12 March last year.
  expect(await lagre({ reklamasjon: { dato: `${AR - 1}-03-11`, mate: "epost" } })).toBe(400);
  expect(await lagre({ feilen: { dato: `${AR - 1}-01-01`, egen: "Motorlampen lyser hele tiden.", tekst: "Motorlampen lyser hele tiden." } })).toBe(400);
  expect(await lagre({ kjopsdato: `${AR - 1}-03-12` })).toBe(400);
  // The vehicle was chosen in the assessment and is locked to the case.
  expect(await lagre({ kjoretoy: { ...KJORETOY, regnr: "ZZ 11111" } })).toBe(400);
  expect(await lagre({ kjoretoy: null })).toBe(400);
  expect(await lagre({ krav: { type: "prisavslag", utbedringNok: -5, utgifter: [] } })).toBe(400);
  expect(await lagre({ avsender: { navn: "Test Testesen", adresse: "Testveien 1", postnummer: "abc", poststed: "Oslo" } })).toBe(400);
  expect(await lagre({ ukjent: 1 })).toBe(400);
  expect(await lagre({ reklamasjon: { dato: `${AR - 1}-03-12`, mate: "epost" } })).toBe(200);
});

const EGEN = "motorlampa lyser hele tida og bilen drar ikke i bakker, verkstedet sier turboen er ødelagt";
const FORSLAG = "Motorlampen lyser hele tiden, og bilen mister trekkraft i bakker. Verkstedet har funnet at turboen er ødelagt.";
const TIL_FEILEN = FORHANDLER_SVAR;

test("språkvasken foreslår en tekst som kan brukes, rettes eller forkastes", async ({ page, brev, sak }) => {
  const sendt: string[] = [];
  await page.route("**/api/sak/*/sprakvask", (route) => {
    sendt.push((route.request().postDataJSON() as { beskrivelse: string }).beskrivelse);
    return route.fulfill({ json: { forslag: FORSLAG } });
  });
  await page.goto(await sak.apne(svar(), TIL_FEILEN));

  const feilen = brev.steg("Feilen");
  await expect(feilen).toContainText("sendes denne teksten til en språkmodell");
  await expect(feilen.getByRole("button", { name: "Lag forslag" })).toBeDisabled();
  await feilen.getByLabel("Når viste feilen seg første gang?").fill(`${AR - 1}-09-02`);
  await feilen.getByLabel("Beskriv feilen med egne ord").fill(EGEN);
  await feilen.getByRole("button", { name: "Lag forslag" }).click();

  // Only the description is sent, and nothing is in the letter until the buyer chooses.
  const forslag = feilen.getByLabel("Forslag til tekst i brevet");
  await expect(forslag).toHaveValue(FORSLAG);
  expect(sendt).toEqual([EGEN]);
  await expect(brev.plassholder("[Beskriv feilen")).toBeVisible();

  // The suggestion can be corrected before it is used.
  await forslag.fill(`${FORSLAG} Feilen kommer hver dag.`);
  await feilen.getByRole("button", { name: "Bruk forslaget" }).click();
  await expect(brev.ark).toContainText(`Feilen viste seg første gang 2. september ${AR - 1}. ${FORSLAG} Feilen kommer hver dag.`);
  await expect(brev.ark).not.toContainText("motorlampa");
  await expect(feilen.getByRole("img", { name: "Ferdig" })).toBeVisible();

  // Changing the step shows both texts again; the buyer's own can be used instead.
  await brev.endre("Feilen");
  await expect(feilen.getByLabel("Beskriv feilen med egne ord")).toHaveValue(EGEN);
  await expect(forslag).toHaveValue(`${FORSLAG} Feilen kommer hver dag.`);
  await feilen.getByRole("button", { name: "Bruk min egen tekst" }).click();
  await expect(brev.ark).toContainText(`${EGEN}.`);
  await expect(brev.ark).not.toContainText("Feilen kommer hver dag");
});

test("når språkvasken feiler, kan brukeren bruke sin egen tekst", async ({ page, brev, sak }) => {
  await page.route("**/api/sak/*/sprakvask", (route) =>
    route.fulfill({ status: 502, json: { feil: "Vi klarte ikke å lage et forslag for denne teksten. Du kan bruke din egen tekst i brevet." } }),
  );
  await page.goto(await sak.apne(svar(), TIL_FEILEN));

  const feilen = brev.steg("Feilen");
  await feilen.getByLabel("Når viste feilen seg første gang?").fill(`${AR - 1}-09-02`);
  await feilen.getByLabel("Beskriv feilen med egne ord").fill(EGEN);
  await feilen.getByRole("button", { name: "Lag forslag" }).click();

  await expect(feilen.getByRole("alert")).toContainText("Du kan bruke din egen tekst i brevet.");
  await expect(feilen.getByLabel("Forslag til tekst i brevet")).toHaveCount(0);
  await feilen.getByRole("button", { name: "Bruk min egen tekst" }).click();
  await expect(brev.ark).toContainText(`${EGEN}.`);
});

test("uriktige opplysninger før kjøpet siteres i brevet, bare når brukeren har svart ja på det", async ({ page, brev, sak }) => {
  await page.goto(await sak.apne(svar({ feilOpplysning: "ja_dokumentert" }), { ...TIL_FEILEN, feilen: FEILEN }));

  await expect(brev.plassholder("[Skriv hva annonsen eller selgeren opplyste som ikke stemte.]")).toBeVisible();
  const steg = brev.steg("Opplysninger før kjøpet");
  await expect(steg).toHaveAttribute("aria-current", "step");
  await expect(brev.lagreKnapp("Opplysninger før kjøpet")).toBeDisabled();
  await steg.getByLabel("Hvor ble det opplyst?").selectOption({ label: "Annonsen" });
  await steg.getByLabel("Hva ble opplyst?").fill("Ny clutch i fjor");
  await brev.lagreKnapp("Opplysninger før kjøpet").click();

  await expect(brev.ark).toContainText("I annonsen ble det opplyst følgende om bilen: «Ny clutch i fjor». Dette stemmer ikke, og bilen svarer dermed ikke til opplysningene dere har gitt, jf. § 16.");
  await expect(steg).toContainText("«Ny clutch i fjor»");
});

test("språkvasken avviser for korte beskrivelser og saker som ikke finnes, uten å kalle modellen", async ({ request, sak }) => {
  const id = idFra(await sak.apne(svar()));
  expect((await request.post(`/api/sak/${id}/sprakvask`, { data: { beskrivelse: "For kort" } })).status()).toBe(400);
  expect((await request.post(`/api/sak/${id}/sprakvask`, { data: {} })).status()).toBe(400);
  expect((await request.post("/api/sak/AAAAAAAAAAAAAAAAAAAAAA/sprakvask", { data: { beskrivelse: EGEN } })).status()).toBe(404);
});
