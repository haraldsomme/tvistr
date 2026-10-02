import { randomInt } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import type { Innsending } from "../src/lib/vurdering/innsending";

// A made-up vehicle, as /api/kjoretoy answers with it. The lookup in Statens vegvesen is always mocked.
export const KJORETOY = { regnr: "ZZ 99999", merke: "Testmerke", modell: "Modell X", ar: 2019 };

// `eierFra` is the day the registry has the vehicle on its current owner, when it has one.
export async function mockKjoretoy(page: Page, eierFra: string | null = null) {
  await page.route("**/api/kjoretoy?*", (route) => route.fulfill({ json: { kjoretoy: KJORETOY, eierFra } }));
}

// The four-step form on /vurdering, addressed the way a user reads it: by question and answer text.
export class Skjema {
  constructor(private readonly page: Page) {}

  tittel(tekst: string) {
    return this.page.getByRole("heading", { level: 2, name: tekst });
  }

  get nesteKnapp() {
    return this.page.getByRole("button", { name: /^(Neste:|Se vurderingen)/ });
  }

  get kjopsdato() {
    return this.page.getByLabel("Når kjøpte du bilen?");
  }

  get kjopesum() {
    return this.page.getByLabel("Hva kostet bilen?");
  }

  get kmVedKjop() {
    return this.page.getByLabel("Kilometerstand ved kjøpet");
  }

  // The vehicle is the first thing the assessment asks for.
  get regnr() {
    return this.page.getByLabel("Registreringsnummer");
  }

  get hentKnapp() {
    return this.page.getByRole("button", { name: "Hent bilen" });
  }

  async hentKjoretoy(regnr: string) {
    await this.regnr.fill(regnr);
    await this.hentKnapp.click();
  }

  // On the assessment, before the letter is bought: the car the letter is written for, which cannot be changed there.
  get bilKort() {
    return this.page.getByRole("group", { name: "Brevet skrives for" });
  }

  get manglerBil() {
    return this.page.getByRole("group", { name: "Bilen mangler" });
  }

  sporsmal(tekst: string) {
    return this.page.getByRole("radiogroup", { name: tekst });
  }

  // The date picker takes the date as ÅÅÅÅ-MM-DD.
  async velgKjop(dato: string) {
    await this.kjopsdato.fill(dato);
  }

  async velgFeiltype(navn: string) {
    await this.page.getByRole("button", { name: navn, exact: true }).click();
  }

  async svar(sporsmal: string, valg: string) {
    await this.sporsmal(sporsmal).getByRole("radio", { name: valg, exact: true }).click();
  }

  async neste() {
    await this.nesteKnapp.click();
  }
}

// The letter on /brev, addressed by what a reader sees: the sheet and the bracketed placeholders.
export class Brev {
  constructor(private readonly page: Page) {}

  get ark() {
    return this.page.getByRole("article", { name: "Reklamasjonsbrev" });
  }

  get overskrift() {
    return this.page.getByRole("heading", { level: 1 });
  }

  // The answers from the assessment, which the buyer can correct once the letter is bought.
  get svarKort() {
    return this.page.getByRole("region", { name: "Svarene fra vurderingen" });
  }

  async endreSvar() {
    await this.svarKort.getByRole("button", { name: "Endre svar" }).click();
  }

  async lagreSvar() {
    await this.svarKort.getByRole("button", { name: "Lagre" }).click();
  }

  // A step in the numbered fill-in list, found by its title.
  steg(tittel: string) {
    return this.page.getByRole("listitem").filter({ has: this.page.getByRole("heading", { name: tittel, exact: true }) });
  }

  get forhandler() {
    return this.page.getByRole("combobox", { name: "Forhandler" });
  }

  // The save button of the step that is open.
  lagreKnapp(tittel: string) {
    return this.steg(tittel).getByRole("button", { name: /^(Lagre|Bekreft vedlegg)$/ });
  }

  async endre(tittel: string) {
    await this.steg(tittel).getByRole("button", { name: "Endre" }).click();
  }

  plassholder(tekst: string) {
    return this.ark.getByText(tekst).first();
  }
}

// Letter cases live in the database, so tests make real ones (with made-up answers) and this deletes
// them afterwards. `apne` returns the address of the new case, with steps already filled in when
// `utfylling` is given; `rydd` registers a case the app made.
export type Saker = { apne: (svar: Innsending, utfylling?: Record<string, unknown>) => Promise<string>; rydd: (id: string) => void };

export const idFra = (url: string) => new URL(url, "http://x").pathname.split("/").pop()!;

export const test = base.extend<{ skjema: Skjema; brev: Brev; sak: Saker }>({
  // /api/vurder allows ten calls a minute per address; each test gets its own.
  extraHTTPHeaders: async ({}, bruk) => {
    await bruk({ "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}` });
  },
  skjema: async ({ page }, bruk) => {
    await bruk(new Skjema(page));
  },
  brev: async ({ page }, bruk) => {
    await bruk(new Brev(page));
  },
  sak: async ({ request }, bruk) => {
    const ider: string[] = [];
    await bruk({
      async apne(svar, utfylling) {
        const res = await request.post("/api/sak", { data: { ...svar, kjoretoy: KJORETOY } });
        expect(res.status(), "POST /api/sak").toBe(200);
        const { id } = (await res.json()) as { id: string };
        ider.push(id);
        if (utfylling) {
          const lagret = await request.patch(`/api/sak/${id}`, { data: utfylling });
          expect(lagret.status(), "PATCH /api/sak/[id]").toBe(200);
        }
        return `/brev/${id}`;
      },
      rydd: (id) => void ider.push(id),
    });
    for (const id of ider) await request.delete(`/api/sak/${id}`);
  },
});

export { expect };
