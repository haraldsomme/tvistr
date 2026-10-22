import { and, eq, inArray, sql } from "drizzle-orm";
import { vedtak } from "@/db/schema";

// A dealer sale of a car or van under the consumer purchase act; also the set the figures are counted
// over (src/lib/vurdering/statistikk-db.ts). The registry lookup does not give the vehicle type, so both
// are taken.
export const BASIS = and(inArray(vedtak.kjoretoytype, ["personbil", "varebil"]), eq(vedtak.lov, "forbrukerkjøpsloven"), eq(vedtak.selgerType, "forhandler"));

// Decisions in BASIS with medhold, where the committee granted something.
export const GRUNNFILTER = and(BASIS, inArray(vedtak.utfall, ["medhold", "delvis_medhold"]), sql`cardinality(${vedtak.sanksjoner}) > 0`);
