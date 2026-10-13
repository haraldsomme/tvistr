// Walks /sak at 1280 and 390 px against a running dev server (docs/ferdigkriterier.md):
//   - step 1: the seller search against Brreg, required before «Fortsett»
//   - step 3: the discovery date, a report dated before the discovery (stops), then the report filled
//     in, and «Samme rapport som forrige feil»
//   - step 4: contact with the seller, and a complaint more than two months after a discovery (warns
//     here, on the defect's card in step 3 and in the summary)
//   - step 5: the summary with its warnings, «Endre» back to the field, then the letter, and with
//     TVISTR_HELT_BREV_UTEN_BETALING=1 also «Kopier tekst» and the Word download
// It saves screenshots, the downloaded .docx files and rapport.json in the folder given.
//
//   npm run dev                      (with TVISTR_HELT_BREV_UTEN_BETALING=1 in .env.local for the whole letter)
//   node scripts/ferdig-brevskjema.mjs <utmappe>
//
// The case is put in sessionStorage and the walk starts at step 1. The dates are chosen for October
// 2026: the calendar opens on the current month.
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const UT = process.argv[2];
const SAK = {
  step: 0, regnr: "AB12345",
  car: { k: { regnr: "AB 12345", merke: "Volkswagen", modell: "Golf", ar: 2016, bruktimportert: false }, eierFra: "2025-03-10" },
  kjopsdato: "2025-03-10", valg: { motor: ["turbo"], historikk: ["km"] }, km: "142000", kjopesum: "185000", somDenEr: "ja",
  detaljer: { motor: { beskrivelse: "Bilen mistet kraft etter tre uker.", opplysning: "nei" }, historikk: { oppdaget: "2026-06-20", opplysning: "skriftlig", verksted: "nei" } },
  krav: null, forsok: null, kreverUtlegg: false, utlegg: [], selger: null, reklamert: null, reklamertDato: "", reklamertForm: null, selgerSvar: null,
};
const DAG = { "2026-10-01": "torsdag 1. oktober 2026", "2026-10-02": "fredag 2. oktober 2026" };

const browser = await chromium.launch();
const rapport = {};
for (const [navn, vp, mobil] of [["desktop", { width: 1280, height: 900 }, false], ["mobil", { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobil, hasTouch: mobil, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const r = (rapport[navn] = {});
  const feil = [];
  page.on("console", (m) => m.type() === "error" && feil.push(m.text()));
  page.on("pageerror", (e) => feil.push(String(e)));
  const velgDato = async (etikett, iso) => {
    if (mobil) await page.getByLabel(etikett).fill(iso);
    else {
      await page.getByLabel(etikett).click();
      await page.getByRole("button", { name: DAG[iso] }).click();
    }
  };
  const fortsett = page.getByRole("button", { name: "Fortsett" });
  const farge = (k) => k.evaluate((b) => getComputedStyle(b).backgroundColor);
  const GRAA = "rgb(196, 199, 202)";

  await page.goto("http://localhost:3000/sak");
  await page.evaluate((s) => sessionStorage.setItem("tvistr:sak:v2", JSON.stringify(s)), SAK);
  await page.reload();

  // Step 1: the seller is chosen with the purchase, and «Fortsett» waits for it.
  await page.waitForSelector("text=Hvem kjøpte du bilen av?");
  r.fortsettUtenSelger = await farge(fortsett);
  await page.getByRole("textbox", { name: "Søk etter selgeren" }).fill("equinor");
  await page.waitForSelector("[role=option]", { timeout: 8000 });
  await page.locator("[role=option]").first().click();
  r.fortsettMedSelger = await farge(fortsett);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${UT}/${navn}-steg1-selger.png` });
  await fortsett.click();
  await page.waitForSelector("text=Hva er galt med bilen?");
  await fortsett.click();
  await page.waitForSelector("text=Beskriv feilene");

  // Step 3: the discovery date, then a report dated before it, which stops.
  r.intervallspørsmåletErBorte = (await page.getByText("Når viste feilen seg?").count()) === 0;
  await velgDato("Når oppdaget du Motor og eksos?", "2026-10-02");
  await page.getByRole("group", { name: "Har et verksted undersøkt Motor og eksos?" }).getByRole("button", { name: "Ja, skriftlig" }).click();
  await page.getByRole("group", { name: "Hvem undersøkte Motor og eksos?" }).getByRole("button", { name: "Merkeverksted" }).click();
  await page.getByLabel("Verkstedets navn").fill("Volkswagen Senter Nord");
  for (const t of [/bekrefter feilen/, /inneholder kostnadsoverslag/]) await page.getByRole("checkbox", { name: t }).click();
  await page.locator("label", { hasText: "Kostnadsoverslag for utbedring" }).locator("input").fill("38000");
  await velgDato("Dato for rapporten om Motor og eksos", "2026-10-01");
  r.stoppRapportFørOppdaget = await page.getByText("Rapporten kan ikke være datert før du oppdaget feilen.").isVisible();
  r.fortsettVedStopp = await farge(fortsett);
  await page.screenshot({ path: `${UT}/${navn}-steg3-stopp.png` });
  await velgDato("Dato for rapporten om Motor og eksos", "2026-10-02");
  r.stoppBorteEtterRetting = (await page.getByText("Rapporten kan ikke være datert før du oppdaget feilen.").count()) === 0;
  await page.getByRole("group", { name: "Skrev eller sa selger noe om Motor og eksos før kjøpet?" }).getByRole("button", { name: "Nei" }).click();

  // The second defect: the same report, ticked again for this defect.
  await page.locator("button[aria-expanded]", { hasText: "Bilens historikk" }).click();
  await page.getByRole("group", { name: "Har et verksted undersøkt Bilens historikk?" }).getByRole("button", { name: "Ja, skriftlig" }).click();
  await page.getByRole("button", { name: "Samme rapport som forrige feil" }).click();
  r.kopiertNavn = await page.getByLabel("Verkstedets navn").inputValue();
  await page.getByRole("checkbox", { name: /bekrefter feilen/ }).click();
  await page.waitForTimeout(600);
  r.fortsettEtterRapport = await farge(fortsett);
  await fortsett.click();

  // Step 4: contact with the seller, complained on 2 October, more than three months after 20 June.
  await page.waitForSelector("text=Hva krever du av forhandleren?");
  await page.getByRole("radio", { name: /Prisavslag/ }).click();
  await page.getByRole("group", { name: "Har du reklamert til selger?" }).getByRole("button", { name: "Ja", exact: true }).click();
  await velgDato("Dato for første reklamasjon", "2026-10-02");
  await page.getByRole("group", { name: "Hvordan reklamerte du?" }).getByRole("button", { name: "Skriftlig" }).click();
  // One question: «1 gang» is asked only when the seller has tried to repair.
  r.forsøkSkjultFørForsøkt = (await page.getByText("Hvor mange ganger?").count()) === 0;
  await page.getByRole("group", { name: "Hva har selger gjort?" }).getByRole("button", { name: "Forsøkt å rette" }).click();
  r.forsøkVistVedForsøkt = await page.getByText("Hvor mange ganger?").isVisible();
  r.lagBrevUtenAntall = await farge(page.getByRole("button", { name: "Se over" }));
  await page.getByRole("group", { name: "Hvor mange ganger har selger forsøkt å rette?" }).getByRole("button", { name: "1 gang" }).click();
  await page.getByRole("group", { name: "Hva har selger gjort?" }).getByRole("button", { name: "Avvist kravet" }).click();
  r.forsøkSkjultEtterBytte = (await page.getByText("Hvor mange ganger?").count()) === 0;
  const SEN = "Du reklamerer mer enn to måneder etter at feilen ble oppdaget.";
  r.advarselISteg4 = await page.locator("#felt-kontakt").getByText(SEN).isVisible();
  await page.screenshot({ path: `${UT}/${navn}-steg4.png` });

  // The warning on the defect's card in step 3.
  await page.getByRole("button", { name: "Tilbake" }).click();
  await page.waitForSelector("text=Beskriv feilene");
  // The card may still be open from before; open it only if it is closed.
  const kort = page.locator("button[aria-expanded]", { hasText: "Bilens historikk" });
  if ((await kort.getAttribute("aria-expanded")) !== "true") await kort.click();
  r.advarselISteg3 = await page.locator("#felt-feil-historikk").getByText(SEN).isVisible();
  await fortsett.click();
  await page.waitForSelector("text=Hva krever du av forhandleren?");

  // Step 5: the summary with the warnings; «Endre» goes back to the field.
  const seOver = page.getByRole("button", { name: "Se over" });
  r.seOverKlar = (await farge(seOver)) !== GRAA;
  await seOver.click();
  await page.waitForSelector("text=Se over opplysningene");
  r.advarslerISteg5 = await page.locator("[data-advarsler] strong").innerText();
  r.radene = await page.locator('table[aria-label="Opplysningene i brevet"] th').allInnerTexts();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${UT}/${navn}-steg5-oppsummering.png`, fullPage: true });
  await page.locator("[data-advarsler]").getByRole("button", { name: "Endre" }).first().click();
  await page.waitForTimeout(900);
  r.endreGårTilSteg = await page.locator("h1").first().innerText();
  r.feltetErISyne = await page.evaluate(() => {
    const e = document.getElementById("felt-kontakt") ?? document.getElementById("felt-feil-historikk");
    const b = e?.getBoundingClientRect();
    return !!b && b.top < innerHeight && b.bottom > 0;
  });
  r.horisontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);

  // Back to the summary, then the letter.
  await page.getByRole("button", { name: "Se over" }).click();
  await page.waitForSelector("text=Se over opplysningene");
  await page.getByRole("button", { name: "Opplysningene stemmer, gå til betaling" }).click();
  await page.waitForSelector('article[aria-label="Reklamasjonsbrev"]', { timeout: 60000 });
  r.tittel = await page.locator("h1").first().innerText();
  r.brevTekst = await page.locator('article[aria-label="Reklamasjonsbrev"]').innerText();
  r.oppdagetIBrevet = r.brevTekst.includes("Feilen viste seg den 2. oktober 2026.");
  r.overslagIBrevet = r.brevTekst.includes("38 000 ifølge verkstedets overslag");
  r.rapportVedlegg = (r.brevTekst.match(/– Rapport fra/g) ?? []).length;
  r.bredde = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: innerWidth }));
  await page.waitForTimeout(1200);
  await page.locator('article[aria-label="Reklamasjonsbrev"]').screenshot({ path: `${UT}/${navn}-brev.png` });

  if (r.tittel === "Ditt reklamasjonsbrev") {
    await page.getByRole("button", { name: "Kopier tekst" }).click();
    r.kopiert = await page.getByRole("button", { name: "Kopiert" }).waitFor({ timeout: 3000 }).then(() => true, () => false);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Last ned som Word" }).click()]);
    r.docxNavn = dl.suggestedFilename();
    await dl.saveAs(`${UT}/${navn}-brev.docx`);
  }
  r.konsollfeil = feil;
  await ctx.close();
}
await browser.close();
writeFileSync(`${UT}/rapport.json`, JSON.stringify(rapport, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(rapport).map(([k, v]) => [k, { ...v, brevTekst: v.brevTekst?.length + " tegn" }])), null, 1));
