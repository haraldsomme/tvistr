"use server";

// The decisions the letter can cite, after payment: the ranking in code, one Sonnet call for the
// choice, the paragraph from the template (docs/vedtaksvalg.md). The chosen one comes first, then two
// alternatives from the ranking. Nothing here reaches the browser before payment: no quote, no link.
import { headers } from "next/headers";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { vedtak } from "@/db/schema";
import { rensSvar } from "@/app/sak/rens";
import { hentAlle, hentBilnavn } from "@/app/sak/vedtak-db";
import type { Presedens } from "@/lib/app/brev";
import { avgjorendeFor, type Rangert, ranger } from "@/lib/matching/ranger";
import type { Kandidat } from "@/lib/matching/typer";
import { lagGrense } from "@/lib/rategrense";
import { byggSaken } from "@/lib/vedtaksvalg/kjoper";
import { visSaksnummer } from "@/lib/vedtaksvalg/mal";
import { UTVALG_I_TEKSTEN, type Vedtaksdetaljer, velgVedtak } from "@/lib/vedtaksvalg/valg";
import { betalt, HELT_BREV_UTEN_BETALING } from "@/lib/vipps/profil";

export type Funn = { ok: true; valg: Presedens[] } | { ok: false; melding: string };

const forMange = lagGrense({ antall: 20, vinduMs: 60_000 });

const SANKSJONSNAVN = new Set(["heving", "prisavslag", "retting", "erstatning", "omlevering"]);

export async function finnVedtak(inn: { svar: unknown; ordreId: unknown }): Promise<Funn> {
  if (!betalt(inn?.ordreId)) return { ok: false, melding: "Brevet er ikke betalt." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent";
  if (forMange(ip)) return { ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." };
  const svar = rensSvar(inn.svar);
  if (!svar) return { ok: false, melding: "Noe er galt med svarene. Prøv igjen." };
  const { sak, kjoper } = byggSaken(svar);

  try {
    const alle = await hentAlle();
    const { kandidater } = ranger(alle, sak);
    if (!kandidater.length) return { ok: true, valg: [] };
    const rader = await db
      .select({ id: vedtak.id, kildeUrl: vedtak.kildeUrl, utvalg: UTVALG_I_TEKSTEN, merke: vedtak.merke, modell: vedtak.modell, arsmodell: vedtak.arsmodell })
      .from(vedtak)
      .where(inArray(vedtak.id, kandidater.map((r) => r.id)));
    const detaljer = new Map<number, Vedtaksdetaljer>(rader.map((d) => [d.id, d]));
    const etterId = new Map(alle.map((k) => [k.id, k]));
    const bilnavn = await hentBilnavn();

    const svaret = await velgVedtak({ kjoper, sak, kandidater, alle: etterId, detaljer });
    const presedens = (r: Rangert, avsnitt: string, best: boolean): Presedens => {
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
        best,
      };
    };
    console.info(`vedtaksvalg: ${etterId.get(svaret.r.id)?.saksnummer} (nivå ${svaret.niva}${svaret.fulgt ? "" : ", rangeringens førstevalg"}), $${svaret.forbruk.kostnadUsd.toFixed(3)}`);
    return { ok: true, valg: [presedens(svaret.r, svaret.avsnitt, true), ...svaret.alternativer.map((a) => presedens(a.r, a.avsnitt, false))] };
  } catch (e) {
    console.error("vedtaksvalget feilet", e);
    return { ok: false, melding: "Vi fant ikke lignende saker akkurat nå. Prøv igjen." };
  }
}

// The pay button until Vipps is connected: in development it gives an order id that counts as paid.
export async function lasOpp(): Promise<{ ok: true; ordreId: string } | { ok: false; melding: string }> {
  return HELT_BREV_UTEN_BETALING() ? { ok: true, ordreId: crypto.randomUUID() } : { ok: false, melding: "Betaling er ikke koblet til ennå." };
}
