"use server";

// The paid case (tables sak and ordre): buying it, saving the form as the buyer types, and the
// decisions the letter can cite. The decisions, after payment: the ranking in code, one Sonnet call for the
// choice, the paragraph from the template (docs/vedtaksvalg.md). The chosen one comes first, then the
// rest of the ranking's top ten, each with its likeness to the buyer's case. The model's answer is kept
// on the case (sak.vedtaksvalg), so the same answers never cost a second call. Nothing here reaches the browser before payment: no quote, no link.
import { headers } from "next/headers";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { ordre, sak, vedtak } from "@/db/schema";
import { rensSjekk, rensSvar } from "@/app/sak/rens";
import { hentAlle, hentBilnavn } from "@/app/sak/vedtak-db";
import type { Presedens } from "@/lib/app/brev";
import { idag } from "@/lib/app/dato";
import { gjelderSaken, type Kjopt, kjopt, laas, manglerForKjop, nyttKjop, rensSkjema } from "@/lib/app/saken";
import { standard } from "@/lib/app/skjema";
import { komponentnavn } from "@/lib/feil/kategorier";
import { likhet } from "@/lib/matching/likhet";
import { avgjorendeFor, type Rangert, ranger } from "@/lib/matching/ranger";
import { poengtekst } from "@/lib/matching/rett";
import type { Kandidat } from "@/lib/matching/typer";
import { GRATIS, PRIS } from "@/lib/pris";
import { lagGrense } from "@/lib/rategrense";
import { hentBetaltSak } from "@/lib/sak/db";
import { nyId } from "@/lib/sak/id";
import { byggSaken } from "@/lib/vedtaksvalg/kjoper";
import { visSaksnummer } from "@/lib/vedtaksvalg/mal";
import { byggValg, type Endring, endringMot, fraLagret, grunnlagFor, type LagretSvar, type Modellsvar, sitaterFor, sporModellen, tilLagret, UTVALG_I_TEKSTEN, type Valggrunnlag, type Vedtaksdetaljer } from "@/lib/vedtaksvalg/valg";
import { HELT_BREV_UTEN_BETALING } from "@/lib/vipps/profil";

export type Funn = { ok: true; valg: Presedens[]; endring: Endring | null } | { ok: false; melding: string };

// Model calls a case may make. Past it the stored answer stands while its decision is on the list,
// else the ranking's first; the letter works either way.
const MAKS_MODELLKALL_PER_SAK = 5;
// Answers kept per case, so changing an answer back costs nothing.
const LAGREDE_SVAR = 5;

const forMange = lagGrense({ antall: 20, vinduMs: 60_000 });
const forMangeKjop = lagGrense({ antall: 10, vinduMs: 60_000 });
const forMangeLagringer = lagGrense({ antall: 120, vinduMs: 60_000 });
const ipAdresse = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";

const SANKSJONSNAVN = new Set(["heving", "prisavslag", "retting", "erstatning", "omlevering"]);

// Claims one of the case's model calls; false when they are used up. One statement, so two requests
// at once cannot both take the last.
async function tarModellkall(id: string): Promise<boolean> {
  const rader = await db
    .update(sak)
    .set({ modellkall: sql`${sak.modellkall} + 1` })
    .where(and(eq(sak.id, id), lt(sak.modellkall, MAKS_MODELLKALL_PER_SAK)))
    .returning({ n: sak.modellkall });
  return rader.length > 0;
}

// The answers must be about the car and the faults the case was bought for. One model call per set of
// answers the case has not had before (sak.vedtaksvalg); the paragraphs are built anew each time, so
// they always compare with the answers as they are now.
export async function finnVedtak(inn: { id: unknown; svar: unknown }): Promise<Funn> {
  if (forMange(await ipAdresse())) return { ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." };
  try {
    const lagret = await hentBetaltSak(inn?.id);
    if (!lagret) return { ok: false, melding: "Brevet er ikke betalt." };
    const svar = rensSvar(inn.svar);
    if (!svar || !gjelderSaken(svar, lagret.skjema)) return { ok: false, melding: "Noe er galt med svarene. Prøv igjen." };
    const { sak: brukersak, kjoper } = byggSaken(svar);

    const alle = await hentAlle();
    const { kandidater } = ranger(alle, brukersak);
    if (!kandidater.length) return { ok: true, valg: [], endring: null };
    const rader = await db
      .select({ id: vedtak.id, kildeUrl: vedtak.kildeUrl, utvalg: UTVALG_I_TEKSTEN, merke: vedtak.merke, modell: vedtak.modell, arsmodell: vedtak.arsmodell })
      .from(vedtak)
      .where(inArray(vedtak.id, kandidater.map((r) => r.id)));
    const detaljer = new Map<number, Vedtaksdetaljer>(rader.map((d) => [d.id, d]));
    const etterId = new Map(alle.map((k) => [k.id, k]));
    const bilnavn = await hentBilnavn();
    const grunnlag: Valggrunnlag = { kjoper, sak: brukersak, kandidater, alle: etterId, detaljer };
    const sitater = sitaterFor(grunnlag);

    // The model's answer: stored for these very answers, else a new call while the case has calls left.
    const noekkel = grunnlagFor(kjoper, kandidater);
    const lagrede = lagret.vedtaksvalg?.svar ?? [];
    const treff = lagrede.find((x) => x.grunnlag === noekkel);
    let modellsvar: Modellsvar | null;
    let nytt: LagretSvar | null = null;
    let kilde: string;
    let kostnad = 0;
    if (treff) {
      modellsvar = fraLagret(treff, kandidater, sitater);
      kilde = "lagret";
    } else if (await tarModellkall(lagret.id)) {
      const spurt = await sporModellen({ ...grunnlag, rask: true });
      modellsvar = spurt.svar;
      kostnad = spurt.forbruk.kostnadUsd;
      kilde = spurt.svar ? "nytt kall" : "kallet feilet";
      if (spurt.svar) nytt = tilLagret(noekkel, spurt.svar, sitater);
    } else {
      modellsvar = fraLagret(lagrede[0], kandidater, sitater);
      kilde = "tak nådd";
    }
    const svaret = byggValg(modellsvar, grunnlag);

    const presedens = (r: Rangert, avsnitt: string, anbefalt: boolean): Presedens => {
      const k: Kandidat = etterId.get(r.id)!;
      const egne = r.feil ? (avgjorendeFor(k.avgjorende, r.feil)?.sanksjoner ?? []) : [];
      return {
        id: k.id,
        saksnummer: visSaksnummer(k.saksnummer),
        vedtaksdato: k.vedtaksdato,
        bil: k.avgjorende?.bil ?? bilnavn(k.id) ?? "Bil",
        utfall: (egne.length ? egne : (k.sanksjoner ?? [])).filter((x) => SANKSJONSNAVN.has(x)),
        avsnitt,
        kildeUrl: detaljer.get(k.id)?.kildeUrl ?? null,
        utvalg: detaljer.get(k.id)?.utvalg ?? "Forbrukerklageutvalget",
        anbefalt,
        niva: r.niva,
        gjaldt: r.feil ? komponentnavn(r.feil) : r.rett.map(poengtekst).join("; "),
        km: k.km,
        alder: k.alder,
        somDenEr: k.somDenEr,
        likhet: likhet(r, brukersak),
        treff: r.treff,
      };
    };
    const valg = [presedens(svaret.r, svaret.avsnitt, true), ...svaret.alternativer.map((a) => presedens(a.r, a.avsnitt, false))];

    const liste = valg.map((v) => v.id);
    const forrige = lagret.vedtaksvalg?.liste;
    const endring = endringMot(forrige, liste, (id) => visSaksnummer(etterId.get(id)?.saksnummer ?? null));
    if (nytt || liste.join() !== forrige?.join()) {
      const svarene = nytt ? [nytt, ...lagrede].slice(0, LAGREDE_SVAR) : lagrede;
      try {
        await db.update(sak).set({ vedtaksvalg: { liste, svar: svarene } }).where(eq(sak.id, lagret.id));
      } catch (e) {
        console.error("vedtaksvalget ble ikke lagret", e instanceof Error ? e.message : e);
      }
    }
    console.info(`vedtaksvalg: ${etterId.get(svaret.r.id)?.saksnummer} (nivå ${svaret.niva}, ${kilde}${svaret.fulgt ? "" : ", rangeringens førstevalg"}), $${kostnad.toFixed(3)}`);
    return { ok: true, valg, endring };
  } catch (e) {
    console.error("vedtaksvalget feilet", e instanceof Error ? e.message : e);
    return { ok: false, melding: "Vi fant ikke lignende saker akkurat nå. Prøv igjen." };
  }
}

export type Kjop = { ok: true; sak: Kjopt } | { ok: false; melding: string };

// The pay button. In the trial (GRATIS) the case is opened at once, with a free order «gratis» and no
// consent to give, since nothing is sold. Otherwise, until Vipps is connected, it only works in development
// (TVISTR_HELT_BREV_UTEN_BETALING): the case is saved as paid at once, with an order from «utvikling». The writer starts from the check,
// keeping the buyer from the previous case (`forrige`) so the browser need not keep their details.
// With Vipps: save the case with `betalt` null and an order «opprettet», answer with Vipps' URL, and
// let the callback set the order's status, `transaksjon_id` and the case's `betalt`.
export async function kjop(inn: { sjekk: unknown; forrige: unknown; samtykke: unknown }): Promise<Kjop> {
  if (!GRATIS && !HELT_BREV_UTEN_BETALING()) return { ok: false, melding: "Betaling er ikke koblet til ennå." };
  // The buyer has asked for the writer now and given up the right of withdrawal (angrerettloven § 22 n).
  if (!GRATIS && inn?.samtykke !== true) return { ok: false, melding: "Kryss av for at brevet åpnes med en gang." };
  if (forMangeKjop(await ipAdresse())) return { ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." };
  const sjekk = rensSjekk(inn?.sjekk);
  if (!sjekk || manglerForKjop(sjekk)) return { ok: false, melding: "Saken mangler bil eller feil." };
  try {
    const dag = idag();
    const forrige = await hentBetaltSak(inn.forrige);
    const skjema = nyttKjop(sjekk, (forrige && rensSkjema(forrige.skjema, dag)) || standard(dag), dag);
    const id = nyId();
    const na = new Date();
    await db.batch([
      db.insert(sak).values({ id, sjekk, skjema, betalt: na }),
      db.insert(ordre).values({ id: nyId(), sakId: id, belopOre: GRATIS ? 0 : PRIS * 100, leverandor: GRATIS ? "gratis" : "utvikling", status: "betalt", betalt: na }),
    ]);
    console.info(`kjøp: ny sak (${GRATIS ? "gratis" : "utvikling"})`);
    return { ok: true, sak: kjopt(id, skjema) };
  } catch (e) {
    console.error("kjøpet feilet", e);
    return { ok: false, melding: "Vi fikk ikke lagret saken. Prøv igjen." };
  }
}

// The writer saves the form as the buyer types. The car and the faults stay as bought.
export async function lagreSak(inn: { id: unknown; skjema: unknown }): Promise<{ ok: true } | { ok: false; melding: string }> {
  if (forMangeLagringer(await ipAdresse())) return { ok: false, melding: "For mange lagringer. Vent litt." };
  try {
    const lagret = await hentBetaltSak(inn?.id);
    if (!lagret) return { ok: false, melding: "Fant ikke saken." };
    const skjema = rensSkjema(inn.skjema, idag());
    if (!skjema) return { ok: false, melding: "Noe er galt med svarene." };
    await db.update(sak).set({ skjema: laas(lagret.skjema, skjema), endret: new Date() }).where(eq(sak.id, lagret.id));
    return { ok: true };
  } catch (e) {
    console.error("lagringen feilet", e);
    return { ok: false, melding: "Vi fikk ikke lagret. Prøver igjen." };
  }
}
