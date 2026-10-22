import type { HTMLAttributes, ReactNode } from "react";
import { Bunn } from "./bunn";
import { Topp } from "./topp";

// The pages outside the flow: the header, one column, and the footer where it is asked for.
export function Side({ bunn, children }: { bunn?: boolean; children: ReactNode }) {
  return (
    <div className="home" style={{ minHeight: "100vh", background: "#F4F5F6" }}>
      <Topp />
      <main className="wrap">{children}</main>
      {bunn && <Bunn />}
    </div>
  );
}

// A short message on such a page: the heading, maybe a line under it, and a row of buttons.
export function Melding({ tittel, tekst, children, ...p }: { tittel: string; tekst?: string; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "64px 0", display: "flex", flexDirection: "column", gap: 16 }} {...p}>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em" }}>{tittel}</h1>
      {tekst && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "#465150" }}>{tekst}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

// The terms and the privacy statement: the landing page's header and footer around one text column.
export function Juridisk({ tittel, oppdatert, children }: { tittel: string; oppdatert: string; children: ReactNode }) {
  return (
    <Side bunn>
      <article className="jur" style={{ margin: "0 auto" }}>
        <h1>{tittel}</h1>
        <p className="jur-dato">Sist oppdatert {oppdatert}</p>
        {children}
      </article>
    </Side>
  );
}
