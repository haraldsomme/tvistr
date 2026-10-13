// Reads the logged findings (funn.ts) for the imports.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { kontrollfunn } from "@/db/schema";
import type { Kontrollfunn } from "./funn";

// The findings for one decision that are not undone, for the imports to apply again.
export const gjeldendeFunn = (vedtakId: number) =>
  db.select({ feilId: kontrollfunn.feilId, sporsmal: kontrollfunn.sporsmal, sitat: kontrollfunn.sitat }).from(kontrollfunn).where(and(eq(kontrollfunn.vedtakId, vedtakId), isNull(kontrollfunn.angret))) as Promise<Pick<Kontrollfunn, "feilId" | "sporsmal" | "sitat">[]>;
