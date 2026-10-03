import type { Faktorer, Reklamasjonsbotte } from "./faktorer";
import type { Feiltype } from "./typer";

export type Eksempel = { vedtakId: number; saksnummer: string; kildeUrl: string; setning: string };
// lignende: same defect group and timing. tilnaermet: same group, nearest timing. generell: only «Annet» picked.
export type Treff = "lignende" | "tilnaermet" | "generell";
// Only decisions the buyer won are shown: the assessment lists what speaks for and against the case, and
// a lost decision would read as a verdict on the buyer's own.
export type ValgtEksempel = Eksempel & { utfall: "vunnet"; treff: Treff };

// The defect groups from most to fewest dealer decisions. With several defects picked, the example
// comes from the most common group that has one.
const GRUPPER = ["motor", "elektrisk", "understell", "km_service", "rust", "bremser", "girkasse", "fukt", "klimaanlegg", "skade", "batteri"] as const;
type Gruppe = (typeof GRUPPER)[number];
type Celler = Partial<Record<`${Gruppe}/${Reklamasjonsbotte}`, Eksempel>>;

// A group is recognised by its first defect type (see KNAPP_TIL_FEILTYPE in faktorer.ts).
const GRUPPE_FOR: Partial<Record<Feiltype, Gruppe>> = {
  motor: "motor",
  elektrisk: "elektrisk",
  understell_hjuloppheng: "understell",
  km_avvik: "km_service",
  rust: "rust",
  bremser: "bremser",
  girkasse: "girkasse",
  fukt_lekkasje: "fukt",
  klimaanlegg: "klimaanlegg",
  kollisjonsskade: "skade",
  batteri_elbil: "batteri",
};

// Which timing to try when the buyer's own has no decision, nearest first.
const NAERMEST: Record<Reklamasjonsbotte, Reklamasjonsbotte[]> = { rask: ["middels", "sen"], middels: ["rask", "sen"], sen: ["middels", "rask"] };

// All decisions below are picked by hand and checked against the decision text; docs/eksempelsaker.md
// says how and lists the weaknesses. The sentences follow one template and name no dealer.

// Decisions the buyer won, per defect group and time from purchase to complaint. Shown for good cases. Some combinations have no decision that holds up. «Batteri» has one only for
// the shortest time; the others use it.
const VUNNET: Celler = {
  "motor/rask": {
    vedtakId: 3154,
    saksnummer: "FKU-2025-140302",
    kildeUrl: "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-140302.pdf",
    setning: "I 2025 fikk kjøperen av en Toyota Proace medhold etter å ha klaget på motorfeil 8 dager etter kjøpet. Utvalget tilkjente 12 400 kr.",
  },
  "motor/middels": {
    vedtakId: 1691,
    saksnummer: "23/13923",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023121274&dokid=1115606&versjon=1&variant=A&",
    setning: "I 2024 fikk kjøperen av en BMW X5 delvis medhold etter å ha klaget på motorfeil om lag 14 måneder etter kjøpet. Utvalget tilkjente 60 637 kr.",
  },
  "motor/sen": {
    vedtakId: 1684,
    saksnummer: "23/13195",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024000896&dokid=1122688&versjon=1&variant=A&",
    setning: "I 2024 fikk kjøperen av en BMW 3-serie medhold etter å ha klaget på motorfeil om lag 4,5 år etter kjøpet. Utvalget tilkjente 59 975 kr.",
  },
  "girkasse/rask": {
    vedtakId: 2626,
    saksnummer: "21/6249",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2021092984&dokid=532845&versjon=1&variant=A&",
    setning: "I 2021 fikk kjøperen av en Audi A6 delvis medhold etter å ha klaget på feil på girkassen 2 dager etter kjøpet. Utvalget tilkjente 41 425 kr.",
  },
  "girkasse/middels": {
    vedtakId: 1776,
    saksnummer: "22/906",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023072630&dokid=1002019&versjon=1&variant=A&",
    setning: "I 2023 fikk kjøperen av en Opel Astra delvis medhold etter å ha klaget på feil på girkassen om lag 7 måneder etter kjøpet. Utvalget tilkjente 16 980 kr.",
  },
  "girkasse/sen": {
    vedtakId: 551,
    saksnummer: "16/2138",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017002902&dokid=303020&versjon=2&variant=A&",
    setning: "I 2017 fikk kjøperen av en Mercedes-Benz GLK delvis medhold etter å ha klaget på feil på girkassen om lag 2,5 år etter kjøpet. Utvalget tilkjente 39 829 kr.",
  },
  "elektrisk/rask": {
    vedtakId: 3085,
    saksnummer: "FKU-2026-93206",
    kildeUrl: "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-93206.pdf",
    setning: "I 2026 fikk kjøperen av en BMW X6 delvis medhold etter å ha klaget på elektrisk feil én dag etter kjøpet. Utvalget tilkjente 4 350 kr.",
  },
  "elektrisk/sen": {
    vedtakId: 1525,
    saksnummer: "24/3868",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024064380&dokid=1248687&versjon=2&variant=A&",
    setning: "I 2025 fikk kjøperen av en Kia Niro delvis medhold etter å ha klaget på elektrisk feil om lag 4,5 år etter kjøpet. Utvalget tilkjente 45 836 kr.",
  },
  "understell/rask": {
    vedtakId: 3258,
    saksnummer: "19/890",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2020008016&dokid=445153&versjon=1&variant=A&",
    setning: "I 2020 fikk kjøperen av en Mitsubishi Outlander delvis medhold etter å ha klaget på feil på understellet 11 dager etter kjøpet. Utvalget tilkjente 38 700 kr.",
  },
  "understell/middels": {
    vedtakId: 3170,
    saksnummer: "FKU-2025-140833",
    kildeUrl: "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-140833.pdf",
    setning: "I 2025 fikk kjøperen av en Tesla Model S medhold etter å ha klaget på feil på understellet om lag 22 måneder etter kjøpet. Utvalget tilkjente 50 363 kr.",
  },
  "bremser/rask": {
    vedtakId: 2454,
    saksnummer: "21/4018",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022034016&dokid=653560&versjon=1&variant=A&",
    setning: "I 2022 fikk kjøperen av en Toyota RAV4 medhold etter å ha klaget på bremsefeil om lag en måned etter kjøpet. Utvalget tilkjente 21 442 kr.",
  },
  "rust/rask": {
    vedtakId: 1689,
    saksnummer: "23/10066",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023109660&dokid=1089894&versjon=2&variant=A&",
    setning: "I 2024 fikk kjøperen av en Toyota Land Cruiser delvis medhold etter å ha klaget på rust om lag 5 måneder etter kjøpet. Utvalget tilkjente 65 050 kr.",
  },
  "rust/middels": {
    vedtakId: 1579,
    saksnummer: "24/81",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024047333&dokid=1217790&versjon=1&variant=A&",
    setning: "I 2024 fikk kjøperen av en Subaru Forester medhold etter å ha klaget på rust om lag 8 måneder etter kjøpet. Utvalget kom til at kjøpet kunne heves.",
  },
  "rust/sen": {
    vedtakId: 606,
    saksnummer: "16/1844",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2017001606&dokid=288585&versjon=1&variant=A&",
    setning: "I 2017 fikk kjøperen av en Volkswagen Passat delvis medhold etter å ha klaget på rust om lag 3 år etter kjøpet. Utvalget tilkjente 82 650 kr.",
  },
  "fukt/rask": {
    vedtakId: 1916,
    saksnummer: "22/4734",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023028939&dokid=898144&versjon=1&variant=A&",
    setning: "I 2023 fikk kjøperen av en Ford Transit Custom delvis medhold etter å ha klaget på fukt eller lekkasje om lag 6 måneder etter kjøpet. Utvalget tilkjente 17 364 kr.",
  },
  "fukt/middels": {
    vedtakId: 2355,
    saksnummer: "21/5035",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022056587&dokid=700048&versjon=1&variant=A&",
    setning: "I 2022 fikk kjøperen av en Nissan Leaf delvis medhold etter å ha klaget på fukt eller lekkasje om lag 21 måneder etter kjøpet. Utvalget tilkjente 29 631 kr.",
  },
  "fukt/sen": {
    vedtakId: 3470,
    saksnummer: "19/116",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/hist/wfdocument.ashx?journalpostid=2019004189&dokid=401510&versjon=1&variant=A&",
    setning: "I 2019 fikk kjøperen av en Audi A1 delvis medhold etter å ha klaget på fukt eller lekkasje om lag 2,5 år etter kjøpet. Utvalget tilkjente 8 548 kr.",
  },
  "klimaanlegg/rask": {
    vedtakId: 1869,
    saksnummer: "22/10322",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023030866&dokid=902671&versjon=1&variant=A&",
    setning: "I 2023 fikk kjøperen av en Volkswagen Golf medhold etter å ha klaget på feil på klimaanlegget om lag 5 måneder etter kjøpet. Utvalget tilkjente 11 149 kr.",
  },
  "klimaanlegg/sen": {
    vedtakId: 2510,
    saksnummer: "21/4356",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022017294&dokid=617370&versjon=1&variant=A&",
    setning: "I 2022 fikk kjøperen av en Volkswagen e-Golf medhold etter å ha klaget på feil på klimaanlegget om lag 2 år etter kjøpet. Utvalget tilkjente 21 165 kr.",
  },
  "km_service/rask": {
    vedtakId: 3081,
    saksnummer: "FKU-2026-73613",
    kildeUrl: "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-73613.pdf",
    setning: "I 2026 fikk kjøperen av en Volvo V60 delvis medhold etter å ha klaget på uriktige opplysninger om kilometerstand eller service 39 dager etter kjøpet. Utvalget tilkjente 7 000 kr.",
  },
  "km_service/middels": {
    vedtakId: 10,
    saksnummer: "21/9897",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023000879&dokid=832691&versjon=1&variant=A&",
    setning: "I 2023 fikk kjøperen av en Ford Focus delvis medhold etter å ha klaget på uriktige opplysninger om kilometerstand eller service om lag 14 måneder etter kjøpet. Utvalget tilkjente 10 000 kr.",
  },
  "km_service/sen": {
    vedtakId: 1941,
    saksnummer: "21/16984",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023009979&dokid=853932&versjon=2&variant=A&",
    setning: "I 2023 fikk kjøperen av en Volkswagen e-Golf delvis medhold etter å ha klaget på uriktige opplysninger om kilometerstand eller service om lag 2,5 år etter kjøpet. Utvalget tilkjente 5 000 kr.",
  },
  "skade/rask": {
    vedtakId: 1820,
    saksnummer: "22/5565",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023052294&dokid=953303&versjon=1&variant=A&",
    setning: "I 2023 fikk kjøperen av en Mitsubishi Outlander medhold etter å ha klaget på en tidligere kollisjonsskade 14 dager etter kjøpet. Utvalget tilkjente 42 723 kr.",
  },
  "skade/middels": {
    vedtakId: 1967,
    saksnummer: "22/6291",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023021551&dokid=880996&versjon=1&variant=A&",
    setning: "I 2023 fikk kjøperen av en Volvo XC60 delvis medhold etter å ha klaget på en tidligere kollisjonsskade om lag 17 måneder etter kjøpet. Utvalget tilkjente 25 000 kr.",
  },
  "skade/sen": {
    vedtakId: 2486,
    saksnummer: "21/5368",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2022027852&dokid=639892&versjon=1&variant=A&",
    setning: "I 2022 fikk kjøperen av en Volvo XC60 medhold etter å ha klaget på en tidligere kollisjonsskade om lag 2 år etter kjøpet. Utvalget tilkjente 25 000 kr.",
  },
  "batteri/rask": {
    vedtakId: 1598,
    saksnummer: "23/16392",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2024044754&dokid=1213139&versjon=1&variant=A&",
    setning: "I 2024 fikk kjøperen av en Tesla Model S medhold etter å ha klaget på feil på elbilbatteriet om lag 5 måneder etter kjøpet. Utvalget kom til at kjøpet kunne heves.",
  },
};

// For buyers who only picked «Annet»: a decision anyone can recognise, per timing.
const GENERELLE: Partial<Record<Reklamasjonsbotte, Eksempel>> = {
  rask: {
    vedtakId: 1508,
    saksnummer: "24/3736",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2025001882&dokid=1269133&versjon=1&variant=A&",
    setning: "I 2025 fikk kjøperen av en Kia Stonic medhold etter å ha klaget på at bilen var ett år eldre enn oppgitt om lag 3 måneder etter kjøpet. Utvalget tilkjente 20 000 kr.",
  },
  middels: {
    vedtakId: 3047,
    saksnummer: "FKU-2026-11954",
    kildeUrl: "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-11954.pdf",
    setning: "I 2026 fikk kjøperen av en Mitsubishi Outlander delvis medhold etter å ha klaget på at hengerfestet fra annonsen manglet om lag 6 måneder etter kjøpet. Utvalget tilkjente 20 000 kr.",
  },
  sen: {
    vedtakId: 1936,
    saksnummer: "22/5982",
    kildeUrl: "https://innsyn.onacos.no/forbrukertilsynet/prod/wfdocument.ashx?journalpostid=2023026224&dokid=891836&versjon=1&variant=A&",
    setning: "I 2023 fikk kjøperen av en BMW 5-serie medhold etter å ha klaget på at bilen var ett år eldre enn oppgitt om lag 2 år etter kjøpet. Utvalget tilkjente 25 000 kr.",
  },
};

// Always gives a won decision when the case has been assessed: same group and timing first, then the
// same group with the nearest timing, then a general one.
export function finnEksempel(f: Faktorer): ValgtEksempel | null {
  const utfall = "vunnet";
  const har = new Set(f.feilgrupper.map((g) => GRUPPE_FOR[g[0]]));
  const valgt = GRUPPER.filter((g) => har.has(g));
  const botte = f.reklamasjonsbotte;

  for (const g of valgt) {
    const e = VUNNET[`${g}/${botte}`];
    if (e) return { ...e, utfall, treff: "lignende" };
  }
  for (const g of valgt) {
    for (const b of NAERMEST[botte]) {
      const e = VUNNET[`${g}/${b}`];
      if (e) return { ...e, utfall, treff: "tilnaermet" };
    }
  }
  const generell = [botte, ...NAERMEST[botte]].map((b) => GENERELLE[b]).find((e) => e !== undefined);
  return generell ? { ...generell, utfall, treff: "generell" } : null;
}

export const alleEksempler = (): Eksempel[] => [VUNNET, GENERELLE].flatMap((t) => Object.values(t));
