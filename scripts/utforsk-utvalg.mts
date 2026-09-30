import { sql } from "drizzle-orm";
import { db } from "../src/db";
const r = await db.execute(sql`
  select selger_type t, selger_navn n, count(*)::int c, count(selger_orgnr)::int med_org
  from vedtak where selger_navn is not null and selger_type in ('forhandler','formidling','ukjent')
  group by 1,2 order by c desc`);
console.log(r.rows.length, "distinkte");
const t = await db.execute(sql`select selger_type, count(*)::int n, count(selger_orgnr)::int org, count(selger_navn)::int navn from vedtak group by 1`);
console.log(JSON.stringify(t.rows));
const firma = r.rows.filter((x:any)=>/\b(AS|ASA|A\/S|ANS|DA|ENK|KS)\b/i.test(x.n));
console.log("med selskapsform:", firma.length);
console.log(JSON.stringify(r.rows.slice(0,12)));
console.log(JSON.stringify(r.rows.filter((x:any)=>!/\b(AS|ASA|A\/S|ANS|DA|ENK|KS)\b/i.test(x.n)).slice(0,15)));
