"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { vedtak } from "@/db/schema";
import { erAdmin } from "@/lib/auth";

export async function lagreKvalitetssjekk(formData: FormData) {
  // Server actions are reachable by direct POST, so check auth here too, not only in the proxy.
  if (!erAdmin((await headers()).get("authorization"))) throw new Error("Ikke innlogget");

  const id = Number(formData.get("id"));
  const status = formData.get("status");
  const kommentar = String(formData.get("kommentar") ?? "").trim().slice(0, 2000);
  if (!Number.isInteger(id) || (status !== "riktig" && status !== "feil" && status !== "ukontrollert")) {
    throw new Error("Ugyldig kvalitetssjekk");
  }

  await db
    .update(vedtak)
    .set({ qaStatus: status, qaKommentar: kommentar || null, qaTidspunkt: status === "ukontrollert" ? null : new Date() })
    .where(eq(vedtak.id, id));
  revalidatePath("/data");
}
