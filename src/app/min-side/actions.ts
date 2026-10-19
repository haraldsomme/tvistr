"use server";

import { loggUt } from "@/lib/innlogging/okt";

// Ends the session on the server (row and cookies). The browser's own copy is cleared by LoggUt.
export async function loggUtHandling(): Promise<void> {
  await loggUt();
}
