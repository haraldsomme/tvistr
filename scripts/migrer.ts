// Applies pending SQL migrations in drizzle/ (generated with `npm run db:generate`).
import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "../src/db";

migrate(db, { migrationsFolder: "drizzle" })
  .then(() => console.log("Migreringer er oppdatert."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
