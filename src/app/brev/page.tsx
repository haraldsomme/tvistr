import { redirect } from "next/navigation";
import { fraParametre, tilParametre } from "@/lib/vurdering/innsending";

// A letter lives at /brev/[id]. This address without an id (an old link, or typed by hand) goes to
// the assessment, where the letter is opened from.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(`/vurdering?${tilParametre(fraParametre(await searchParams))}`);
}
