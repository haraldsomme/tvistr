import { neon } from "@neondatabase/serverless";

// Direct database access for the few things a test cannot do through the app: making a case expire,
// and checking that a row is really gone. Only ever touches rows the test created itself.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* the variables are already in the environment */
}

const sql = neon(process.env.DATABASE_URL!);

export async function settUtlopt(id: string): Promise<void> {
  await sql`update brevsak set utloper = now() - interval '1 day' where id = ${id}`;
}

export async function finnesSak(id: string): Promise<boolean> {
  const rader = await sql`select 1 from brevsak where id = ${id}`;
  return rader.length > 0;
}

// The answers of a case set straight in the database, for a state the app itself no longer lets a
// case into: answers that were complete when they were saved and no longer are.
export async function settSvarDirekte(id: string, svar: Record<string, unknown>): Promise<void> {
  await sql`update brevsak set svar = ${JSON.stringify(svar)}::jsonb where id = ${id}`;
}
