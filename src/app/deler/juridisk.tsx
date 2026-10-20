import type { ReactNode } from "react";
import { Bunn } from "./bunn";
import { Topp } from "./topp";

// The terms and the privacy statement: the landing page's header and footer around one text column.
export function Juridisk({ tittel, oppdatert, children }: { tittel: string; oppdatert: string; children: ReactNode }) {
  return (
    <div className="home" style={{ minHeight: "100vh", background: "#F4F5F6" }}>
      <Topp />
      <main className="wrap">
        <article className="jur" style={{ margin: "0 auto" }}>
          <h1>{tittel}</h1>
          <p className="jur-dato">Sist oppdatert {oppdatert}</p>
          {children}
        </article>
      </main>
      <Bunn />
    </div>
  );
}
