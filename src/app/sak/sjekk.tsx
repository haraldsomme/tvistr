"use client";

// The free check (artifact «CASE CHECK»): one question per screen, auto-advance on a choice, then the
// verdict. The answers stay in localStorage (tvistr-sjekk).
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Merke } from "@/app/deler/merke";
import { MaalVisning } from "@/app/maal-visning";
import { Hake, Pil, Tilbake } from "@/app/deler/ikoner";
import { type Bil, Skilt } from "@/app/deler/skilt";
import { addDays, idag, iso, relText } from "@/lib/app/dato";
import { FMT, lcFirst, listJoin } from "@/lib/app/format";
import { useLagret } from "@/lib/app/lagring";
import type { Sjekk as Svar } from "@/lib/app/saken";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { Resultat } from "./resultat";
import { anslag, type Sporsmal, synlige } from "./sporsmal";

export type Tilstand = Svar & { _screen?: "q" | "result"; _i?: number };

const ADV_MS = 750;
const HURTIG = [["I dag", 0], ["I går", 1], ["For en uke siden", 7], ["For to uker siden", 14], ["For en måned siden", 30]] as const;

export function Sjekk({ utvikling, fraStart }: { utvikling: boolean; fraStart: boolean }) {
  const router = useRouter();
  const [a, settA, klar] = useLagret<Tilstand>("tvistr-sjekk", () => ({ _i: 0, cats: [], issues: {}, fdates: {} }));
  const [ordre] = useLagret("tvistr-ordre", () => "");
  const [retning, settRetning] = useState<1 | -1>(1);
  const [adv, settAdv] = useState<string | null>(null);
  const tid = useRef<ReturnType<typeof setTimeout>>(undefined);

  const skjerm = a._screen ?? "q";
  const vq = synlige(a);
  const i = Math.min(a._i ?? 0, vq.length - 1);
  const q = vq[i];

  const avbryt = useCallback(() => {
    clearTimeout(tid.current);
    settAdv(null);
  }, []);

  const neste = useCallback(() => {
    avbryt();
    settRetning(1);
    window.scrollTo({ top: 0 });
    settA((f) => {
      const v = synlige(f);
      const n = Math.min(f._i ?? 0, v.length - 1);
      const d = v[n];
      if ((d?.terminal && d.terminal(f[d.id])) || n >= v.length - 1) return { ...f, _screen: "result" };
      return { ...f, _i: n + 1 };
    });
  }, [avbryt, settA]);

  function tilbake() {
    avbryt();
    settRetning(-1);
    window.scrollTo({ top: 0 });
    if (skjerm === "result") {
      const t = vq.findIndex((x) => x.terminal && x.terminal(a[x.id]));
      return settA({ ...a, _screen: "q", _i: t >= 0 ? t : vq.length - 1 });
    }
    if (i > 0) settA({ ...a, _i: i - 1 });
    else router.push("/");
  }

  const omStart = () => {
    avbryt();
    settRetning(1);
    settA({ _screen: "q", _i: 0, cats: [], issues: {}, fdates: {} });
  };

  function velg(id: keyof Svar, v: string, nokkel: string) {
    settA((f) => ({ ...f, [id]: v }));
    avbryt();
    settAdv(nokkel);
    tid.current = setTimeout(neste, matchMedia("(prefers-reduced-motion: reduce)").matches ? 450 : ADV_MS);
  }

  // 1–9 picks an answer, Enter goes on.
  useEffect(() => {
    if (skjerm !== "q" || !q) return;
    const tast = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || document.querySelector(".modal.open")) return;
      const t = e.target as HTMLElement;
      if (e.key === "Enter" && !t.closest("button")) {
        e.preventDefault();
        neste();
      } else if (t.tagName !== "INPUT" && q.type === "single" && /^[1-9]$/.test(e.key)) {
        const o = q.opts?.[+e.key - 1];
        if (o) velg(q.id, o[0], o[0]);
      }
    };
    document.addEventListener("keydown", tast);
    return () => document.removeEventListener("keydown", tast);
  });

  useEffect(() => () => clearTimeout(tid.current), []);

  // From the front page: back to question 1 with the answers kept, before the stored position is
  // painted. The parameter is dropped so a reload stays where the buyer is.
  useLayoutEffect(() => {
    if (!klar || !fraStart) return;
    settA((f) => ({ ...f, _screen: "q", _i: 0 }));
    router.replace("/sak");
  }, [klar, fraStart, settA, router]);

  const tot = Math.max(anslag(a), i + 1);
  return (
    <section className={`ob${skjerm === "result" ? " has-bar" : ""}`} aria-label="Saksvurdering">
      {klar && skjerm === "q" && i === 0 && <MaalVisning hendelse="sjekk_startet" />}
      <div className="ob-top">
        <Merke undertekst="Gratis saksvurdering" />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {skjerm === "q" && klar && (
            <span className="kbd-hint">
              Spørsmål {i + 1} av {tot}
            </span>
          )}
          {ordre && (
            <button type="button" className="btn sm" onClick={() => router.push("/brev")}>
              Til brevskriveren
            </button>
          )}
        </div>
        <div className="ob-prog" id="obProg" aria-hidden="true">
          <i style={{ width: skjerm === "q" ? `${((i + 1) / tot) * 100}%` : "100%" }} />
        </div>
      </div>
      <div className="ob-stage">
        {klar && (
          <div key={`${skjerm}-${i}`} className={retning < 0 ? "anim-b" : "anim-f"} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
            {skjerm === "result" ? (
              <Resultat a={a} ordre={ordre} utvikling={utvikling} onTilSporsmal={(id) => settA((f) => ({ ...f, _screen: "q", _i: Math.max(0, synlige(f).findIndex((q) => q.id === id)) }))} onTilbake={tilbake} onOmStart={omStart} />
            ) : (
              <Sporsmalet q={q} a={a} settA={settA} adv={adv} siste={i === vq.length - 1} onVelg={velg} onNeste={neste} onTilbake={tilbake} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

type Props = {
  q: Sporsmal;
  a: Tilstand;
  settA: (f: (a: Tilstand) => Tilstand) => void;
  adv: string | null;
  siste: boolean;
  onVelg: (id: keyof Svar, v: string, nokkel: string) => void;
  onNeste: () => void;
  onTilbake: () => void;
};

function Sporsmalet({ q, a, settA, adv, siste, onVelg, onNeste, onTilbake }: Props) {
  const svar = a[q.id];
  return (
    <div className="q">
      <h2>{q.title}</h2>
      {q.hint && <p className="q-hint">{q.hint}</p>}
      <div className="q-body">
        {q.type === "single" && (
          <div className="q-opts" role="radiogroup" aria-label={q.title}>
            {q.opts!.map(([v, t, d], k) => (
              <button key={v} type="button" role="radio" aria-checked={svar === v} className={`q-opt${svar === v ? " sel" : ""}${adv === v ? " adv" : ""}`} onClick={() => onVelg(q.id, v, v)}>
                <span className="q-key">{k + 1}</span>
                <span className="q-txt">
                  <b>{t}</b>
                  {d && <small>{d}</small>}
                </span>
                <span className="q-ok">
                  <Hake s={13} />
                </span>
              </button>
            ))}
          </div>
        )}
        {q.type === "car" && <Bilen a={a} settA={settA} />}
        {q.type === "date" && <Dato q={q} a={a} settA={settA} adv={adv} onVelg={onVelg} />}
        {q.type === "faults" && <Feilene a={a} settA={settA} />}
      </div>
      <div className="q-foot">
        <button type="button" className="btn gh" onClick={onTilbake}>
          <Tilbake />
          Tilbake
        </button>
        <div>
          {adv && <span className="adv-hint">Går videre …</span>}
          {q.type === "single" && (
            <span className="kbd-hint">
              <kbd>1</kbd>–<kbd>{q.opts!.length}</kbd> for å velge
            </span>
          )}
          <button type="button" className="btn gh" onClick={onNeste}>
            Hopp over
          </button>
          {(q.type !== "single" || svar !== undefined) && (
            <button type="button" className="btn pri" onClick={onNeste}>
              {siste ? "Se vurderingen" : "Neste"}
              <Pil />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Bilen({ a, settA }: Pick<Props, "a" | "settA">) {
  const funnet: Bil | null = a.lastReg && a.make ? { make: a.make, model: "", year: a.year ?? "", lastReg: a.lastReg } : null;
  return (
    <div className="grid" style={{ maxWidth: 560 }}>
      <div className="f c6">
        <label className="lb" htmlFor="qReg">
          Registreringsnummer
        </label>
        {/* The handover date starts as the day the car was registered on its current owner, unless the buyer changed it. */}
        <Skilt id="qReg" verdi={a.reg ?? ""} funnet={funnet} onEndre={(reg) => settA((f) => ({ ...f, reg }))} onBil={(b) => settA((f) => ({ ...f, make: `${b.make} ${b.model}`.trim(), year: b.year, lastReg: b.lastReg, delivery: f.delivery && f.delivery !== f.lastReg ? f.delivery : b.lastReg || f.delivery }))} />
      </div>
      {/* Filled by «Hent bilen»; typed by hand when the register does not have the car. The car is fixed at payment. */}
      <div className="f c4">
        <label className="lb" htmlFor="qMake">
          Merke og modell
        </label>
        <input className="in" id="qMake" placeholder="Volkswagen Golf" value={a.make ?? ""} onChange={(e) => settA((f) => ({ ...f, make: e.target.value }))} />
      </div>
      <div className="f c2">
        <label className="lb" htmlFor="qYear">
          Årsmodell
        </label>
        <input className="in mono" id="qYear" inputMode="numeric" placeholder="2016" value={a.year ?? ""} onChange={(e) => settA((f) => ({ ...f, year: FMT.year(e.target.value) }))} />
      </div>
      <div className="f c3">
        <label className="lb" htmlFor="qDelivery">
          Overtakelsesdato
        </label>
        <input className="in" type="date" id="qDelivery" max={idag()} value={a.delivery ?? ""} onChange={(e) => settA((f) => ({ ...f, delivery: e.target.value }))} />
      </div>
      <div className="f c3">
        <label className="lb" htmlFor="qKm">
          Km-stand ved overtakelse <em>valgfritt</em>
        </label>
        <div className="ad">
          <input className="in" id="qKm" inputMode="numeric" placeholder="38 500" value={a.km ?? ""} onChange={(e) => settA((f) => ({ ...f, km: FMT.num(e.target.value) }))} />
          <span className="sx">km</span>
        </div>
      </div>
      {a.lastReg && a.delivery === a.lastReg && (
        <p className="hint c6" style={{ margin: 0 }}>
          Overtakelsesdatoen er fylt inn med datoen bilen sist ble registrert. Endre den hvis du fikk bilen en annen dag. Fristene regnes herfra.
        </p>
      )}
    </div>
  );
}

function Dato({ q, a, settA, adv, onVelg }: Pick<Props, "q" | "a" | "settA" | "adv" | "onVelg">) {
  const v = (a[q.id] as string | undefined) ?? "";
  return (
    <>
      <div className="f q-datef">
        <label className="lb" htmlFor="qDate">
          Dato du sa fra
        </label>
        <input className="in q-date" type="date" id="qDate" max={idag()} value={v} onChange={(e) => settA((f) => ({ ...f, [q.id]: e.target.value }))} />
      </div>
      <div className="q-quick" role="group" aria-label="Hurtigvalg">
        {HURTIG.map(([l, d]) => {
          const dato = iso(addDays(new Date(), -d));
          return (
            <button key={l} type="button" className={`q-chip${adv === dato ? " adv" : ""}`} aria-pressed={v === dato} onClick={() => onVelg(q.id, dato, dato)}>
              {l}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Feilene({ a, settA }: Pick<Props, "a" | "settA">) {
  const cats = a.cats ?? [];
  const veksle = (c: string) =>
    settA((f) => {
      const valgt = new Set(f.cats ?? []);
      if (valgt.has(c)) valgt.delete(c);
      else valgt.add(c);
      return { ...f, cats: HOVEDKATEGORIER.filter((h) => valgt.has(h.id)).map((h) => h.id) };
    });
  const veksleUnder = (c: string, u: string) =>
    settA((f) => {
      const valgt = new Set(f.issues?.[c] ?? []);
      if (valgt.has(u)) valgt.delete(u);
      else valgt.add(u);
      const h = HOVEDKATEGORIER.find((x) => x.id === c)!;
      return { ...f, issues: { ...f.issues, [c]: h.under.filter((x) => valgt.has(x.id)).map((x) => x.id) } };
    });
  return (
    <div className="fq">
      <div className="fq-sec">
        <div className="fq-k">
          Hvilke deler gjelder det? <em className="fq-e">velg en eller flere</em>
        </div>
        <div className="q-chips">
          {HOVEDKATEGORIER.map((h) => (
            <button key={h.id} type="button" className="q-chip" aria-pressed={cats.includes(h.id)} onClick={() => veksle(h.id)}>
              <Hake />
              {h.navn}
            </button>
          ))}
        </div>
      </div>
      {cats.map((c) => {
        const h = HOVEDKATEGORIER.find((x) => x.id === c)!;
        const sel = a.issues?.[c] ?? [];
        return (
          <div key={c} className="fq-sec">
            <div className="fq-k">{h.navn} · Hva har du observert?</div>
            <div className="q-chips">
              {h.under.map((u) => (
                <button key={u.id} type="button" className="q-chip" aria-pressed={sel.includes(u.id)} onClick={() => veksleUnder(c, u.id)}>
                  <Hake />
                  {u.navn}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {cats.length > 0 && (
        <div className="fq-sec">
          <h3 className="fq-h">{cats.length > 1 ? "Når oppdaget du hver feil?" : "Når oppdaget du feilen?"}</h3>
          <div className="fd-list">
            {cats.map((c) => {
              const h = HOVEDKATEGORIER.find((x) => x.id === c)!;
              const d = a.fdates?.[c] ?? "";
              const sett = (h.under.filter((u) => a.issues?.[c]?.includes(u.id)) ?? []).map((u) => lcFirst(u.navn));
              return (
                <div key={c} className="fd">
                  <div className="fd-t">
                    <b>{h.navn}</b>
                    {sett.length > 0 && <span className="fd-s">{listJoin(sett).replace(/^./, (m) => m.toUpperCase())}</span>}
                    <span className="fd-r">{relText(d, a.delivery)}</span>
                  </div>
                  <label className="fd-in">
                    <span>Oppdaget</span>
                    <input className="in" type="date" max={idag()} value={d} aria-label={`Oppdaget: ${h.navn}`} onChange={(e) => settA((f) => ({ ...f, fdates: { ...f.fdates, [c]: e.target.value } }))} />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
