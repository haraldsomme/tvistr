import { Skjema } from "./skjema";
import { erSakId } from "@/lib/brev/utfylling";
import { fraParametre } from "@/lib/vurdering/innsending";

export const metadata = { title: "Vurder saken din – Tvistr" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sak = typeof params.sak === "string" && erSakId(params.sak) ? params.sak : undefined;
  return <Skjema startSvar={fraParametre(params)} startSteg={Number(params.steg)} sakId={sak} />;
}
