import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { LoggUt } from "@/app/deler/logg-ut";
import { Topp } from "@/app/deler/topp";
import { db } from "@/db";
import { sak } from "@/db/schema";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { innlogget } from "@/lib/innlogging/okt";

export const metadata: Metadata = { title: "Min side – Tvistr", robots: { index: false, follow: false } };

const kort = { background: "#FFFFFF", border: "1px solid #E2E6EC", borderRadius: 16, padding: "18px 20px" } as const;
const lenke = { textDecoration: "none" } as const;

// The faults of a case by name: the chosen subcategories, else the category.
function feilnavn(cats: string[], parts: Record<string, string[]>): string {
  return cats
    .flatMap((c) => {
      const h = HOVEDKATEGORIER.find((x) => x.id === c);
      if (!h) return [];
      const valgt = (parts[c] ?? []).map((u) => h.under.find((x) => x.id === u)?.navn).filter((n): n is string => !!n);
      return valgt.length ? valgt : [h.navn];
    })
    .join(", ");
}

// The owner's letters: every paid case on the logged-in Vipps account, newest first.
export default async function Page() {
  const sub = await innlogget();
  if (!sub) redirect("/logg-inn?til=/min-side");
  const saker = await db
    .select({ id: sak.id, skjema: sak.skjema, betalt: sak.betalt })
    .from(sak)
    .where(and(eq(sak.vippsSub, sub), isNotNull(sak.betalt)))
    .orderBy(desc(sak.betalt));
  const navn = saker[0]?.skjema.b_name;
  return (
    <div className="home" style={{ minHeight: "100vh", background: "#F5F6F8" }}>
      <Topp />
      <main className="wrap">
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "48px 0 64px", display: "flex", flexDirection: "column", gap: 20 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em" }}>Dine brev</h1>
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", fontSize: 15, color: "#455063" }}>
            <span>Innlogget med Vipps{navn ? <> · <b style={{ color: "#10141A" }}>{navn}</b></> : null}</span>
            <LoggUt />
          </div>
          {saker.length === 0 && (
            <section style={kort}>
              <p style={{ margin: "0 0 12px", fontSize: 15, color: "#455063" }}>Du har ingen brev på denne Vipps-kontoen.</p>
              <Link href="/sak?start" className="btn pri" style={lenke}>
                Sjekk en ny sak
              </Link>
            </section>
          )}
          {saker.map((s) => {
            const bil = `${s.skjema.c_make} ${s.skjema.c_model}`.trim();
            const dato = s.betalt!.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
            return (
              <section key={s.id} style={kort}>
                <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 600 }}>
                  {bil || "Bil"}
                  {s.skjema.c_reg ? ` (${s.skjema.c_reg})` : ""}
                </h2>
                <p style={{ margin: "0 0 4px", fontSize: 15, color: "#455063" }}>{feilnavn(s.skjema.f_cats, s.skjema.f_parts)}</p>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "#7A8597" }}>Kjøpt {dato}</p>
                <Link href={`/sak/${s.id}`} className="btn pri" style={lenke}>
                  Åpne brevet
                </Link>
              </section>
            );
          })}
          {saker.length > 0 && (
            <div>
              <Link href="/sak?start" className="btn" style={lenke}>
                Sjekk en ny sak
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
