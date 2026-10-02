import { Skjema } from "./skjema";
import { fraParametre } from "@/lib/vurdering/innsending";

export const metadata = { title: "Vurder saken din – Tvistr" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <Skjema startSvar={fraParametre(params)} startSteg={Number(params.steg)} />;
}
