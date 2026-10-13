// Walks steps 3, 4 and 5 of /sak at 1280 and 390 px against a running dev server (criterion 4 in
// docs/ferdigkriterier.md): the workshop report and «Samme rapport som forrige feil» in step 3, contact
// with the seller and the seller search against Brreg in step 4, then the letter. With
// TVISTR_HELT_BREV_UTEN_BETALING=1 it also takes «Kopier tekst» and the Word download. It saves
// screenshots, the downloaded .docx files and rapport.json in the folder given.
//
//   npm run dev                      (with TVISTR_HELT_BREV_UTEN_BETALING=1 in .env.local for the whole letter)
//   node scripts/ferdig-brevskjema.mjs <utmappe>
//
// The case is put in sessionStorage, so the walk starts at step 3. Without the variable the same walk
// shows the preview, with the rest of the letter hidden.
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const UT = process.argv[2];
const SAK = {
  step: 2, regnr: "AB12345",
  car: { k: { regnr: "AB 12345", merke: "Volkswagen", modell: "Golf", ar: 2016, bruktimportert: false }, eierFra: "2025-03-10" },
  kjopsdato: "2025-03-10", valg: { motor: ["turbo"], historikk: ["km"] },
  tid: { motor: "6_til_24_mnd", historikk: "innen_6_mnd" }, km: "142000", kjopesum: "185000", somDenEr: "ja",
  detaljer: { motor: { beskrivelse: "Bilen mistet kraft etter tre uker.", opplysning: "nei" }, historikk: { opplysning: "skriftlig", verksted: "nei" } },
  krav: null, forsok: null, kreverUtlegg: false, utlegg: [], selger: null, reklamert: null, reklamertDato: "", reklamertForm: null, selgerSvar: null,
};
// A day after the purchase and before today, as the calendar names it in October 2026.
const DAG = { iso: "2026-10-01", kalender: "torsdag 1. oktober 2026" };

const browser = await chromium.launch();
const rapport = {};
for (const [navn, vp, mobil] of [["desktop", { width: 1280, height: 900 }, false], ["mobil", { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobil, hasTouch: mobil, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const r = (rapport[navn] = {});
  const feil = [];
  page.on("console", (m) => m.type() === "error" && feil.push(m.text()));
  page.on("pageerror", (e) => feil.push(String(e)));
  const velgDato = async (etikett) => {
    if (mobil) await page.getByLabel(etikett).fill(DAG.iso);
    else {
      await page.getByLabel(etikett).click();
      await page.getByRole("button", { name: DAG.kalender }).click();
    }
  };
  const fortsett = page.getByRole("button", { name: "Fortsett" });
  const farge = (k) => k.evaluate((b) => getComputedStyle(b).backgroundColor);

  await page.goto("http://localhost:3000/sak");
  await page.evaluate((s) => sessionStorage.setItem("tvistr:sak", JSON.stringify(s)), SAK);
  await page.reload();
  await page.waitForSelector("text=Beskriv feilene");

  // Step 3: a written assessment asks for the report, and the card is not done before it is.
  r.fortsettFoerRapport = await farge(fortsett);
  await page.getByRole("group", { name: "Har et verksted undersøkt Motor og eksos?" }).getByRole("button", { name: "Ja, skriftlig" }).click();
  await page.waitForSelector("text=Rapporten fra verkstedet");
  r.rapportSkjemaSynlig = true;
  r.kortetErIkkeFerdig = await page.getByText("Mangler rapport").first().isVisible().catch(() => false);
  await page.getByRole("group", { name: "Hvem undersøkte Motor og eksos?" }).getByRole("button", { name: "Merkeverksted" }).click();
  await page.getByLabel("Verkstedets navn").fill("Volkswagen Senter Nord");
  await velgDato("Dato for rapporten om Motor og eksos");
  for (const t of [/bekrefter feilen/, /angir årsaken/, /ikke er normal slitasje/, /inneholder kostnadsoverslag/]) await page.getByRole("checkbox", { name: t }).click();
  await page.locator("label", { hasText: "Kostnadsoverslag for utbedring" }).locator("input").fill("38000");
  await page.locator("textarea").fill('Turbolader "defekt" og må skiftes. Ikke normal slitasje.');
  await page.screenshot({ path: `${UT}/${navn}-steg3-rapport.png` });

  // The second defect: the same report, ticked again for this defect.
  await page.locator("button[aria-expanded]", { hasText: "Bilens historikk" }).click();
  await page.getByRole("group", { name: "Har et verksted undersøkt Bilens historikk?" }).getByRole("button", { name: "Ja, skriftlig" }).click();
  await page.getByRole("button", { name: "Samme rapport som forrige feil" }).click();
  r.kopiertNavn = await page.getByLabel("Verkstedets navn").inputValue();
  r.kopiertAvkrysninger = await page.getByRole("checkbox", { checked: true }).count();
  await page.getByRole("checkbox", { name: /bekrefter feilen/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${UT}/${navn}-steg3-kopi.png` });
  r.fortsettEtterRapport = await farge(fortsett);
  await fortsett.click();

  // Step 4: «Nei» leaves no questions about repairs; «Ja» asks for all four answers.
  await page.waitForSelector("text=Hva krever du av forhandleren?");
  await page.getByRole("radio", { name: /Prisavslag/ }).click();
  const lagBrev = page.getByRole("button", { name: "Lag brev" });
  await page.getByRole("group", { name: "Har du reklamert til selger?" }).getByRole("button", { name: "Nei" }).click();
  r.rettingsforsokVisesVedNei = await page.getByText("Har selger forsøkt å rette feilen?").count();
  await page.getByRole("group", { name: "Har du reklamert til selger?" }).getByRole("button", { name: "Ja", exact: true }).click();
  await velgDato("Dato for første reklamasjon");
  await page.getByRole("group", { name: "Hvordan reklamerte du?" }).getByRole("button", { name: "Skriftlig" }).click();
  await page.getByRole("group", { name: "Har selger forsøkt å rette feilen?" }).getByRole("button", { name: "1 gang" }).click();
  await page.getByRole("textbox", { name: "Søk etter selgeren" }).fill("equinor");
  await page.waitForSelector("[role=option]", { timeout: 8000 });
  await page.locator("[role=option]").first().click();
  r.knappUtenSelgersSvar = await farge(lagBrev);
  await page.getByRole("group", { name: "Hva svarte selger?" }).getByRole("button", { name: "Avviste kravet" }).click();
  await page.waitForTimeout(500);
  r.knappMedAlt = await farge(lagBrev);
  await page.screenshot({ path: `${UT}/${navn}-steg4.png` });
  r.horisontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);

  await lagBrev.click();
  await page.waitForSelector('article[aria-label="Reklamasjonsbrev"]', { timeout: 60000 });
  r.tittel = await page.locator("h1").first().innerText();
  r.brevTekst = await page.locator('article[aria-label="Reklamasjonsbrev"]').innerText();
  // The estimate typed in step 3 is in the claim, and the report is one enclosure for both defects.
  r.overslagILetter = r.brevTekst.includes("38\u00a0000 ifølge verkstedets overslag");
  r.rapportVedlegg = (r.brevTekst.match(/– Rapport fra/g) ?? []).length;
  r.bredde = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: innerWidth }));
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
