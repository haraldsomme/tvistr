import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Side } from "@/app/deler/juridisk";
import { erId } from "@/lib/sak/id";
import { Venter } from "./venter";

export const metadata: Metadata = { title: "Betaling – Tvistr", robots: { index: false, follow: false } };

// Vipps sends the buyer here after the app (returnUrl), maybe in another browser than the one they
// bought in. Opening the page changes nothing by itself: venter.tsx asks the server, which asks Vipps.
// `n` is the secret from the return address that logs the payer in (sjekkBetaling); it is never shown.
export default async function Page({ params, searchParams }: PageProps<"/betaling/[ref]">) {
  const { ref } = await params;
  const { n } = await searchParams;
  if (!erId(ref)) notFound();
  return (
    <Side>
      <Venter referanse={ref} n={typeof n === "string" ? n : null} />
    </Side>
  );
}
