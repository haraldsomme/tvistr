import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { rensSkjema } from "@/lib/app/saken";
import { idag } from "@/lib/app/dato";
import { hentBetaltSak } from "@/lib/sak/db";
import { Skriver } from "./skriver";

export const metadata: Metadata = { title: "Brevet – Tvistr", robots: { index: false, follow: false } };

// The letter writer for a paid case (skriver.tsx). The link is the access: an unknown, malformed or
// unpaid id is not found. The stored form is merged over today's defaults, so a case saved before a
// field was added still opens.
export default async function Page({ params }: PageProps<"/sak/[id]">) {
  const { id } = await params;
  const sak = await hentBetaltSak(id);
  if (!sak) notFound();
  const skjema = rensSkjema(sak.skjema, idag());
  if (!skjema) notFound();
  return <Skriver id={sak.id} start={skjema} />;
}
