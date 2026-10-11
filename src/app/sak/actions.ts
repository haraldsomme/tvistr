"use server";

import { headers } from "next/headers";
import { and, arrayOverlaps, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { vedtak } from "@/db/schema";
import { brukerNiva, HOVEDKATEGORIER, rensFeilvalg, rensTidsvalg } from "@/lib/feil/kategorier";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { ranger, type Brukersak, type Krav, type Rangert } from "@/lib/matching/ranger";
import { VEKTER } from "@/lib/matching/vekter";
import { lagGrense } from "@/lib/rategrense";

// A ranked decision with what is needed to check by eye that it matches.
export type Toppvedtak = Rangert & {
  saksnummer: string | null;
  vedtaksdato: string | null;
  kildeUrl: string;
  merke: string | null;
  modell: string | null;
  arsmodell: number | null;
  km: number | null;
  alder: number | null;
  kjopesum: number | null;
  somDenEr: boolean | null;
  sanksjoner: string[] | null;
  prisavslagProsent: number | null;
  sammendrag: string | null;
  nokkelmomenter: string[] | null;
};

// One count per chosen main category; null for «vet ikke ennå», which is never compared.
export type Funn =
  | {
      ok: true;
      totalt: number;
      kategorier: { id: string; navn: string; antall: number | null }[];
      topp: Toppvedtak[];
      svaktGrunnlag: boolean;
      utenTidsfilter: boolean;
    }
  | { ok: false; melding: string };

const forMange = lagGrense({ antall: 20, vinduMs: 60_000 });

// Decisions with medhold for a dealer sale of a car or van under the consumer purchase act, where the
// committee granted something. The registry lookup does not give the vehicle type, so both are taken.
const GRUNNFILTER = and(
  inArray(vedtak.utfall, ["medhold", "delvis_medhold"]),
  inArray(vedtak.kjoretoytype, ["personbil", "varebil"]),
  eq(vedtak.lov, "forbrukerkjøpsloven"),
  eq(vedtak.selgerType, "forhandler"),
  sql`cardinality(${vedtak.sanksjoner}) > 0`,
);

const gyldigDato = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const heltall = (v: unknown, min: number, maks: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= maks ? v : null);
const KRAV: readonly Krav[] = ["retting", "prisavslag", "heving"];
// «Ja, skriftlig» or «Ja, muntlig» is yes; anything else unknown.
const kilde = (v: unknown): boolean | null => (v === "skriftlig" || v === "muntlig" ? true : v === "nei" ? false : null);

// kjopsdato: the day the car was registered on its current owner. ar: the year it was first
// registered; the decisions' age is from the model year, so the user's age is an approximation.
export async function finnVedtak(inn: unknown): Promise<Funn> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";
  if (forMange(ip))
    return {
      ok: false,
      melding: "For mange forsøk. Vent et minutt og prøv igjen.",
    };
  const s = (inn && typeof inn === "object" ? inn : {}) as Record<string, unknown>;
  const rent = rensFeilvalg(s.valg);
  const valgte = HOVEDKATEGORIER.filter((h) => h.id in rent);
  if (!valgte.length) return { ok: false, melding: "Velg minst én feil." };
  const tider = rensTidsvalg(s.tid);
  if (valgte.some((h) => !tider[h.id])) return { ok: false, melding: "Velg når hver feil viste seg." };
  const dato = gyldigDato(s.kjopsdato);
  const ar = heltall(s.ar, 1950, 2100);
  const kjopsar = dato ? Number(dato.slice(0, 4)) : new Date().getFullYear();
  const detaljer = (s.detaljer && typeof s.detaljer === "object" ? s.detaljer : {}) as Record<string, { opplysning?: unknown; verksted?: unknown } | undefined>;
  const sak: Brukersak = {
    kategorier: valgte
      .filter((h) => h.id !== "vet_ikke")
      .map((h) => ({
        hoved: h.id,
        under: rent[h.id],
        niva: brukerNiva(tider[h.id]!, dato),
        opplysning: kilde(detaljer[h.id]?.opplysning),
        verksted: kilde(detaljer[h.id]?.verksted),
      })),
    km: heltall(s.km, 1, 1_500_000),
    alder: ar === null ? null : Math.max(0, kjopsar - ar),
    somDenEr: s.somDenEr === "ja" ? true : s.somDenEr === "nei" ? false : null,
    krav: KRAV.find((k) => k === s.krav) ?? null,
  };
  try {
    const kandidater = sak.kategorier.length
      ? await db
          .select({
            id: vedtak.id,
            vedtaksdato: vedtak.vedtaksdato,
            km: vedtak.kmVedKjop,
            alder: vedtak.alderVedKjop,
            somDenEr: vedtak.somDenEr,
            sanksjoner: vedtak.sanksjoner,
            mangelsgrunnlag: vedtak.mangelsgrunnlag,
            paragrafer: vedtak.paragrafer,
            feil: sql<AvledetFeil[] | null>`${vedtak.feilvurdering}->'feil'`,
          })
          .from(vedtak)
          .where(
            and(
              GRUNNFILTER,
              arrayOverlaps(
                vedtak.godtatteKategorier,
                sak.kategorier.map((k) => k.hoved),
              ),
            ),
          )
      : [];
    const r = ranger(
      kandidater.map((k) => ({ ...k, feil: k.feil ?? [] })),
      sak,
    );
    const beste = r.rangert.slice(0, VEKTER.topp);
    const detaljer = beste.length
      ? await db
          .select({
            id: vedtak.id,
            saksnummer: vedtak.saksnummer,
            vedtaksdato: vedtak.vedtaksdato,
            kildeUrl: vedtak.kildeUrl,
            merke: vedtak.merke,
            modell: vedtak.modell,
            arsmodell: vedtak.arsmodell,
            km: vedtak.kmVedKjop,
            alder: vedtak.alderVedKjop,
            kjopesum: vedtak.kjopesumNok,
            somDenEr: vedtak.somDenEr,
            sanksjoner: vedtak.sanksjoner,
            prisavslagProsent: vedtak.prisavslagProsent,
            sammendrag: vedtak.sammendrag,
            nokkelmomenter: vedtak.utvalgetsNokkelmomenter,
          })
          .from(vedtak)
          .where(
            inArray(
              vedtak.id,
              beste.map((b) => b.id),
            ),
          )
      : [];
    const perId = new Map(detaljer.map((d) => [d.id, d]));
    return {
      ok: true,
      totalt: r.antall,
      kategorier: valgte.map((h) => ({
        id: h.id,
        navn: h.navn,
        antall: h.id === "vet_ikke" ? null : r.perKategori[h.id],
      })),
      topp: beste.map((b) => ({ ...perId.get(b.id)!, ...b })),
      svaktGrunnlag: r.svaktGrunnlag,
      utenTidsfilter: r.utenTidsfilter,
    };
  } catch (e) {
    console.error("søket feilet", e);
    return { ok: false, melding: "Noe gikk galt. Prøv igjen." };
  }
}
