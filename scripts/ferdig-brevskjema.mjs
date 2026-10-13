// Walks step 4 and step 5 of /sak at 1280 and 390 px against a running dev server (criterion 4 in
// docs/ferdigkriterier.md): the seller search against Brreg, an earlier notice, the cost estimate, the
// letter, and with TVISTR_HELT_BREV_UTEN_BETALING=1 also «Kopier tekst» and the Word download. Saves
// screenshots, the downloaded .docx files and rapport.json in the folder given.
//
//   npm run dev                      (with TVISTR_HELT_BREV_UTEN_BETALING=1 in .env.local for the whole letter)
//   node scripts/ferdig-brevskjema.mjs <utmappe>
//
// The case is put in sessionStorage, so the walk starts at step 4. Without the variable the same walk
// shows the preview, with the rest of the letter hidden.
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const UT = process.argv[2];
const SAK = {
  step: 3, regnr: "AB12345",
  car: { k: { regnr: "AB 12345", merke: "Volkswagen", modell: "Golf", ar: 2016, bruktimportert: false }, eierFra: "2025-03-10" },
  kjopsdato: "2025-03-10", valg: { motor: ["turbo"], historikk: ["km"] },
  tid: { motor: "6_til_24_mnd", historikk: "innen_6_mnd" }, km: "142000", kjopesum: "185000", somDenEr: "ja",
  detaljer: { motor: { beskrivelse: "Bilen mistet kraft etter tre uker.", verksted: "skriftlig", opplysning: "nei" }, historikk: { verksted: "nei", opplysning: "skriftlig" } },
  krav: null, forsok: null, kreverUtlegg: false, utlegg: [], selger: null, tidligere: null, tidligereDato: "", overslag: "",
};

const browser = await chromium.launch();
const rapport = {};
for (const [navn, vp, mobil] of [["desktop", { width: 1280, height: 900 }, false], ["mobil", { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobil, hasTouch: mobil, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const r = (rapport[navn] = {});
  const feil = [];
  page.on("console", (m) => m.type() === "error" && feil.push(m.text()));
  page.on("pageerror", (e) => feil.push(String(e)));
  await page.goto("http://localhost:3000/sak");
  await page.evaluate((s) => sessionStorage.setItem("tvistr:sak", JSON.stringify(s)), SAK);
  await page.reload();
  await page.waitForSelector("text=Hva krever du av forhandleren?");

  // the new fields are there, and «Fortsett»/«Lag brev» waits for them
  r.overslagSynlig = await page.getByText("Kostnadsoverslag for utbedring").isVisible();
  await page.getByRole("radio", { name: /Prisavslag/ }).click();
  await page.getByRole("button", { name: "1 gang" }).click();
  const lagBrev = page.getByRole("button", { name: "Lag brev" });
  r.knappFoerSelger = await lagBrev.evaluate((b) => getComputedStyle(b).backgroundColor);

  await page.getByLabel("Kostnadsoverslag for utbedring").or(page.locator("input[inputmode=numeric]").first()).first().scrollIntoViewIfNeeded();
  await page.getByText("Kostnadsoverslag for utbedring").locator("xpath=ancestor::label").locator("input").fill("12500");

  await page.getByRole("button", { name: "Ja, skriftlig" }).click();
  if (mobil) await page.getByLabel("Dato for tidligere reklamasjon").fill("2026-10-01");
  else {
    await page.getByLabel("Dato for tidligere reklamasjon").click();
    await page.getByRole("button", { name: "torsdag 1. oktober 2026" }).click();
  }
  r.datoValgt = await page.getByLabel("Dato for tidligere reklamasjon").evaluate((e) => e.value ?? e.textContent);

  await page.getByRole("textbox", { name: "Søk etter selgeren" }).fill("equinor");
  await page.waitForSelector("[role=option]", { timeout: 8000 });
  r.treff = (await page.locator("[role=option]").allInnerTexts()).slice(0, 3);
  await page.screenshot({ path: `${UT}/${navn}-steg4-sok.png` });
  await page.locator("[role=option]").first().click();
  r.valgtSelger = await page.getByText(/Org\.nr\./).first().innerText();
  r.horisontalScrollSteg4 = await page.evaluate(() => [...document.querySelectorAll("*")].some((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible" && e.getBoundingClientRect().right > innerWidth + 1));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${UT}/${navn}-steg4.png` });

  await lagBrev.click();
  await page.waitForSelector('article[aria-label="Reklamasjonsbrev"]', { timeout: 60000 });
  r.tittel = await page.locator("h1").first().innerText();
  r.brevTekst = await page.locator('article[aria-label="Reklamasjonsbrev"]').innerText();
  r.bredde = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: innerWidth, brevRight: document.querySelector('article[aria-label="Reklamasjonsbrev"]').getBoundingClientRect().right }));
  await page.waitForTimeout(1200);
  await page.locator('article[aria-label="Reklamasjonsbrev"]').screenshot({ path: `${UT}/${navn}-brev.png` });

  if (r.tittel === "Ditt reklamasjonsbrev") {
    await page.getByRole("button", { name: "Kopier tekst" }).click();
    r.kopiert = await page.getByRole("button", { name: "Kopiert" }).waitFor({ timeout: 3000 }).then(() => true, () => false);
    r.utklipp = await page.evaluate(() => navigator.clipboard.readText());
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Last ned som Word" }).click()]);
    r.docxNavn = dl.suggestedFilename();
    await dl.saveAs(`${UT}/${navn}-brev.docx`);
  }
  r.konsollfeil = feil;
  await ctx.close();
}
await browser.close();
writeFileSync(`${UT}/rapport.json`, JSON.stringify(rapport, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(rapport).map(([k, v]) => [k, { ...v, brevTekst: v.brevTekst?.length + " tegn", utklipp: v.utklipp?.length + " tegn" }])), null, 1));
