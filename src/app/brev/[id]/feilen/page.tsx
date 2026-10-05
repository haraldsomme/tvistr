import { redirect } from "next/navigation";

// The defect is described in step 3 of the wizard; this address, used before the wizard existed,
// opens that step and goes back to the letter after.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/brev/${id}/veiviser?steg=feilen&tilbake=brev`);
}
