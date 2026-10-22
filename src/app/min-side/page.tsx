import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Side } from "@/app/deler/juridisk";
import { LoggUt } from "@/app/deler/logg-ut";
import { mineBrev } from "@/app/sak/mine";
import { fmtD } from "@/lib/app/dato";
import { innlogget } from "@/lib/innlogging/okt";

export const metadata: Metadata = { title: "Min side – Tvistr", robots: { index: false, follow: false } };

const kort = { background: "#FFFFFF", border: "1px solid #E3E6E8", borderRadius: 16, padding: "18px 20px" } as const;
const lenke = { textDecoration: "none" } as const;

// The owner's letters: every paid case on the logged-in Vipps account, newest first.
export default async function Page() {
  const sub = await innlogget();
  if (!sub) redirect("/logg-inn?til=/min-side");
  const { navn, brev: saker } = await mineBrev();
  return (
    <Side>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "48px 0 64px", display: "flex", flexDirection: "column", gap: 20 }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em" }}>Dine brev</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", fontSize: 15, color: "#465150" }}>
          <span>Innlogget med Vipps{navn ? <> · <b style={{ color: "#111515" }}>{navn}</b></> : null}</span>
          <LoggUt />
        </div>
        {saker.length === 0 && (
          <section style={kort}>
            <p style={{ margin: "0 0 12px", fontSize: 15, color: "#465150" }}>Du har ingen brev på denne Vipps-kontoen.</p>
            <Link href="/sak?ny" className="btn pri" style={lenke}>
              Sjekk en ny sak
            </Link>
          </section>
        )}
        {saker.map((s) => (
          <section key={s.id} style={kort}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 600 }}>
              {s.bil || "Bil"}
              {s.reg ? ` (${s.reg})` : ""}
            </h2>
            <p style={{ margin: "0 0 4px", fontSize: 15, color: "#465150" }}>{s.feil}</p>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#869190" }}>Kjøpt {fmtD(s.betalt!)}</p>
            <Link href={`/sak/${s.id}`} className="btn pri" style={lenke}>
              Åpne brevet
            </Link>
          </section>
        ))}
        {saker.length > 0 && (
          <div>
            <Link href="/sak?ny" className="btn" style={lenke}>
              Sjekk en ny sak
            </Link>
          </div>
        )}
      </div>
    </Side>
  );
}
