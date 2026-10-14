// Step 4, the free assessment (docs/vurdering.md), as in the mockup («Tvistr onboarding v2», 04a–04c).
// Everything shown comes from byggVurdering (src/lib/vurdering/vurdering.ts): fields, figures from the
// database and fixed texts chosen by code. No quotes and no links to the decisions before payment.
import type { CSSProperties } from "react";
import { liste } from "@/lib/brev/format";
import { PRIS } from "@/lib/pris";
import { type Lovlinje, OVERSKRIFT, type Tallblokk, tallsetninger, utenNivaA, type VurderingResultat, fristenUteTekst } from "@/lib/vurdering/vurdering";
import { A, AS, H1, INGRESS, LINE, MONO, OVERLINE, pop, Punkt, storKnapp, tall, Varsel } from "./deler";

const stor = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const GRONN = "oklch(0.48 0.12 150)";
const GUL = "oklch(0.45 0.11 65)";
const LITEN_TEKST: CSSProperties = { margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#8a8f93" };
const H2: CSSProperties = { margin: 0, fontSize: 17, lineHeight: 1.35, fontWeight: 600 };
const SANKSJONER = [
  ["heving", "Heving", A],
  ["prisavslag", "Prisavslag", "oklch(0.66 0.1 255)"],
  ["retting", "Retting", "oklch(0.83 0.06 255)"],
  ["erstatning", "Erstatning", "oklch(0.9 0.03 255)"],
] as const;

function Ikon({ type, stor }: { type: Lovlinje["ikon"]; stor?: boolean }) {
  const s = stor ? 44 : 22;
  const bg = { ja: stor ? A : "oklch(0.95 0.04 150)", nei: "oklch(0.93 0.07 80)", info: "#eef0f1" }[type];
  const farge = { ja: stor ? "#fff" : GRONN, nei: GUL, info: "#5f6468" }[type];
  return (
    <span aria-hidden="true" style={{ width: s, height: s, flex: "none", borderRadius: "50%", background: bg, color: farge, display: "grid", placeItems: "center", fontSize: stor ? 22 : 12, fontWeight: 700 }}>
      {type === "ja" ? (
        <svg width={stor ? 20 : 11} height={stor ? 20 : 11} viewBox="0 0 12 12">
          <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke={farge} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : type === "nei" ? (
        "!"
      ) : (
        "i"
      )}
    </span>
  );
}

function Paragraf({ children }: { children: string }) {
  return <span style={{ alignSelf: "flex-start", font: `500 12px ${MONO}`, color: "oklch(0.42 0.12 255)", background: "oklch(0.94 0.03 255)", padding: "3px 8px", borderRadius: 5 }}>{children.replace(/^forbrukerkjøpsloven/, "Forbrukerkjøpsloven")}</span>;
}

function Lovlinjer({ linjer }: { linjer: Lovlinje[] }) {
  return (
    <section aria-labelledby="loven" style={{ display: "flex", flexDirection: "column", gap: 12, animation: pop(1) }}>
      <h2 id="loven" style={H2}>
        Dette sier loven om din sak
      </h2>
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden" }}>
        {linjer.map((l, i) => (
          <div key={i} data-lovlinje={l.tema} style={{ padding: "16px 18px", borderTop: i ? "1px solid #eeeeeb" : "none", background: l.uthevet ? AS : undefined, display: "flex", gap: 12 }}>
            <Ikon type={l.ikon} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 14.5, lineHeight: 1.5, fontWeight: l.uthevet ? 600 : 400, textWrap: "pretty" }}>{l.tekst}</span>
              {l.paragraf && <Paragraf>{l.paragraf}</Paragraf>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// The figures for one category: the count with medhold, then what the buyers got, each as its share of
// the decisions with medhold (a decision can have more than one, so the bars do not add up).
function Tall({ b }: { b: Tallblokk }) {
  const [forste, ...resten] = tallsetninger(b);
  if (!b.tall) return <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{forste}</p>;
  const t = b.tall;
  const utfall = SANKSJONER.filter(([k]) => t[k] > 0);
  return (
    <div data-tall={b.nokkel} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 40, lineHeight: 1, fontWeight: 600, letterSpacing: "-0.03em" }}>{tall(String(t.medhold))}</span>
        <span style={{ fontSize: 17, color: "#5f6468" }}>av {tall(String(t.saker))} saker</span>
      </div>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, textWrap: "pretty" }}>{forste}</p>
      {t.medhold > 0 && utfall.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {utfall.map(([k, navn, farge]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "92px 1fr 40px", alignItems: "center", gap: 10, fontSize: 12.5, color: "#5f6468" }}>
              <span>{navn}</span>
              <span style={{ height: 8, borderRadius: 4, background: "#f0f0ed", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${Math.round((t[k] / t.medhold) * 100)}%`, background: farge, borderRadius: 4 }} />
              </span>
              <span style={{ font: `500 12.5px ${MONO}`, textAlign: "right", color: "#2c3033" }}>{t[k]}</span>
            </div>
          ))}
        </div>
      )}
      {resten.map((s) => (
        <p key={s} style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#5f6468", borderTop: "1px solid #eeeeeb", paddingTop: 12 }}>
          {s}
        </p>
      ))}
    </div>
  );
}

function Lignende({ v }: { v: VurderingResultat }) {
  return (
    <section aria-labelledby="lignende" style={{ display: "flex", flexDirection: "column", gap: 14, animation: pop(2) }}>
      <h2 id="lignende" style={H2}>
        Lignende saker i Forbrukerklageutvalget
      </h2>
      {v.tall.map((b) => (
        <Tall key={b.nokkel} b={b} />
      ))}
      {v.kort.length > 0 ? (
        <>
          <span style={OVERLINE}>Saker som ligner din</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {v.kort.map((k) => (
              <div key={k.id} data-vedtakskort style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={{ font: `500 12px ${MONO}`, color: "#5f6468" }}>{[k.saksnummer && `Sak ${k.saksnummer}`, k.ar].filter(Boolean).join(" · ")}</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{k.bil}</span>
                  <span style={{ fontSize: 13.5, color: "#5f6468" }}>{[k.km !== null && `${tall(String(k.km))} km ved kjøp`, k.somDenEr && "«som den er»"].filter(Boolean).join(" · ")}</span>
                </div>
                {k.fikk.length > 0 && (
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "oklch(0.42 0.12 255)", background: "oklch(0.94 0.03 255)", padding: "4px 9px", borderRadius: 6, whiteSpace: "nowrap" }}>{stor(liste(k.fikk))}</span>
                )}
              </div>
            ))}
          </div>
          {v.sammenligning && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Ikon type="ja" />
              <span style={{ fontSize: 14.5, lineHeight: 1.5 }}>{v.sammenligning}</span>
            </div>
          )}
        </>
      ) : (
        <Varsel type="info" ikon="§">
          {utenNivaA(v.poeng)}
        </Varsel>
      )}
    </section>
  );
}

function DetteFarDu({ v, fortsett }: { v: VurderingResultat; fortsett: () => void }) {
  const sterk = { fontWeight: 600, color: "oklch(0.42 0.12 255)" };
  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14, animation: pop(3) }}>
      <h2 style={H2}>Dette får du</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Punkt>
          Reklamasjonsbrev etter forbrukerkjøpsloven <strong style={sterk}>{v.lovversjon === "før_2024" ? "før 2024" : "fra 2024"}</strong>, klart til å sende
        </Punkt>
        {v.kort.length > 0 ? (
          <Punkt>
            Henvisning til et vedtak der kjøperen fikk medhold for <strong style={sterk}>samme feil</strong>, med ordrette sitater fra utvalget
          </Punkt>
        ) : v.poeng.length > 0 ? (
          <Punkt>
            Henvisning til et vedtak om <strong style={sterk}>{v.poeng[0]}</strong>, med ordrette sitater fra utvalget
          </Punkt>
        ) : null}
        <Punkt>Kravet (retting, prisavslag eller heving) formulert med riktig hjemmel</Punkt>
        <Punkt>Frist og hva som skjer hvis selger ikke svarer</Punkt>
        <Punkt>Word-fil og kopierbar tekst</Punkt>
      </div>
      <div style={{ borderTop: "1px solid #eeeeeb", paddingTop: 14, fontSize: 15, lineHeight: 1.5 }}>
        <strong style={{ fontWeight: 600 }}>{PRIS} kr.</strong> Betal når brevet er klart, ikke nå.
      </div>
      <button type="button" onClick={fortsett} className="rk-neste" style={storKnapp("aksent")}>
        Fortsett til brevet
      </button>
      <p style={{ ...INGRESS, fontSize: 13 }}>Tre korte steg til: dokumentasjon, krav og hvem selger er. Du betaler når du har sett sakens bakgrunn og vedtaket brevet bygger på.</p>
    </div>
  );
}

export function Vurderingsvisning({ v, kjopsdato, fortsett, endreKjopsdato, steg }: { v: VurderingResultat; kjopsdato: string; fortsett: () => void; endreKjopsdato: () => void; steg: string }) {
  if (v.status === "ute")
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }} data-status="ute">
        <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: "50%", background: "#e4e5e2", color: "#2c3033", display: "grid", placeItems: "center" }}>
            <svg width="20" height="20" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10 6v4.5l3 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <span style={OVERLINE}>Vurdering</span>
          <h1 style={H1}>{OVERSKRIFT.ute}</h1>
        </header>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "#2c3033", textWrap: "pretty" }}>{fristenUteTekst(kjopsdato)}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a href="https://www.forbrukerradet.no/" target="_blank" rel="noopener noreferrer" style={{ ...storKnapp("svart"), textDecoration: "none" }}>
            Gå til Forbrukerrådet ↗
          </a>
          <button type="button" onClick={endreKjopsdato} style={storKnapp("kant")}>
            Endre kjøpsdato
          </button>
        </div>
        <p style={{ ...INGRESS, fontSize: 13 }}>Du har ikke betalt noe.</p>
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }} data-status={v.status}>
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Ikon type={v.status === "sak" ? "ja" : "nei"} stor />
        <span style={OVERLINE}>{steg}</span>
        <h1 style={H1}>{OVERSKRIFT[v.status]}</h1>
      </header>

      {v.status === "svak" && (
        <section aria-labelledby="svekker" style={{ display: "flex", flexDirection: "column", gap: 10, animation: pop(0) }}>
          <h2 id="svekker" style={H2}>
            Dette svekker saken
          </h2>
          {v.grunner.map((g) => (
            <Varsel key={`${g.regel}${g.feilId ?? ""}`} type="advarsel">
              <span data-grunn={g.regel}>{g.tekst}</span>
            </Varsel>
          ))}
        </section>
      )}

      <Lovlinjer linjer={v.lovlinjer} />
      <Lignende v={v} />
      <DetteFarDu v={v} fortsett={fortsett} />
      <p style={LITEN_TEKST}>Tjenesten gir ikke juridisk rådgivning. Vurderingen bygger på svarene dine og på publiserte vedtak.</p>
    </div>
  );
}
