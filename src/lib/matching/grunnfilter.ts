import { and, eq, inArray, sql } from "drizzle-orm";
import { vedtak } from "@/db/schema";

// Decisions with medhold for a dealer sale of a car or van under the consumer purchase act, where the
// committee granted something. The registry lookup does not give the vehicle type, so both are taken.
export const GRUNNFILTER = and(
  inArray(vedtak.utfall, ["medhold", "delvis_medhold"]),
  inArray(vedtak.kjoretoytype, ["personbil", "varebil"]),
  eq(vedtak.lov, "forbrukerkjøpsloven"),
  eq(vedtak.selgerType, "forhandler"),
  sql`cardinality(${vedtak.sanksjoner}) > 0`,
);
