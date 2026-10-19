import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Topp } from "@/app/deler/topp";
import { erId } from "@/lib/sak/id";
import { Venter } from "./venter";

export const metadata: Metadata = { title: "Betaling – Tvistr", robots: { index: false, follow: false } };

// Vipps sends the buyer here after the app (returnUrl), maybe in another browser than the one they
// bought in. Opening the page changes nothing by itself: venter.tsx asks the server, which asks Vipps.
export default async function Page({ params }: PageProps<"/betaling/[ref]">) {
  const { ref } = await params;
  if (!erId(ref)) notFound();
  return (
    <div className="home" style={{ minHeight: "100vh", background: "#F5F6F8" }}>
      <Topp />
      <main className="wrap">
        <Venter referanse={ref} />
      </main>
    </div>
  );
}
