"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { kroner, norskDato } from "@/lib/brev/brev";
import { FELT_TEKST, rettelseTilLagring, type Avklaringsrunde, type Rettelse } from "@/lib/brev/skriving/rettelse";
import type { Avklaring, Utfylling } from "@/lib/brev/utfylling";
import type { Innsending } from "@/lib/vurdering/innsending";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Flervalgsfelt, HJELP, Sammendrag, Skjema, Tekstfelt, Valgfelt, VeiviserKontekst, VEIVISER_KNAPPER, type Felles } from "../felt";

// The clarifying round, the last step: questions about what is missing or does not fit, and corrections
// the buyer can accept. The answers are saved as `avklaringer`; a correction is saved only on «Bruk»,
// through the same save as any step. When there is nothing more to ask, the case is marked `avklart`.

type Svar = { valg: string[]; utdyping: string };
type Status = "venter" | "brukt" | "beholdt" | "feilet";

const visVerdi = (r: Rettelse) => (/^\d{4}-\d{2}-\d{2}$/.test(r.verdi) ? norskDato(r.verdi) : r.felt === "kmVedKjop" ? `${r.verdi} km` : kroner(Number(r.verdi)));
// One round from the server, or the message to show when there is none.
async function hentRunde(sakId: string): Promise<Avklaringsrunde | string> {
  const ingenKontakt = "Vi får ikke kontakt akkurat nå. Du kan gå videre til brevet og komme tilbake senere.";
  try {
    const res = await fetch(`/api/sak/${sakId}/avklaring`, { method: "POST" });
    const json = (await res.json()) as Avklaringsrunde & { feil?: string };
    return res.ok ? json : (json.feil ?? ingenKontakt);
  } catch {
    return ingenKontakt;
  }
}

const svarTekst = (s: Svar | undefined) => [s?.valg.join("; "), s?.utdyping.trim()].filter(Boolean).join(". ") || null;

export function GjennomgangFelt({ sakId, svar, utfylling, aktiv, lagre }: Felles & { sakId: string; svar: Innsending; utfylling: Utfylling }) {
  const veiviser = useContext(VeiviserKontekst);
  const [runde, setRunde] = useState<Avklaringsrunde | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [svarene, setSvarene] = useState<Record<string, Svar>>({});
  const [status, setStatus] = useState<Record<number, Status>>({});

  // Each round is a call to the model: asked for once, even when the effect runs twice in development.
  const spurt = useRef(false);
  const venter = aktiv && !utfylling.avklart && !runde && !feil;
  useEffect(() => {
    if (!venter || spurt.current) return;
    spurt.current = true;
    void hentRunde(sakId).then((r) => {
      if (typeof r === "string") return setFeil(r);
      setSvarene({});
      setStatus({});
      setRunde(r);
    });
  }, [venter, sakId]);
  // The next round, or another try: cleared, so the effect asks again.
  function hent() {
    spurt.current = false;
    setFeil(null);
    setRunde(null);
  }

  const besvart = (utfylling.avklaringer ?? []).filter((a) => a.svar !== null).length;
  if (!aktiv) return utfylling.avklart ? <Sammendrag linjer={["Saken er gjennomgått", besvart ? `${besvart} spørsmål besvart` : null]} /> : null;

  // Done before, or nothing more to ask: the buyer goes on to the letter.
  if (utfylling.avklart || runde?.status === "klar") {
    return (
      <Skjema klar send={() => (utfylling.avklart ? Promise.resolve(true) : lagre({ avklart: true }))}>
        <p className="m-0 text-[15px] leading-[1.6]">Vi har det vi trenger for å skrive brevet.</p>
      </Skjema>
    );
  }
  if (feil) {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="m-0 text-[15px] leading-[1.6]">
          {feil}
        </p>
        <div className={`flex flex-wrap gap-2 ${veiviser ? VEIVISER_KNAPPER : ""}`}>
          <Button type="button" variant="ghost" onClick={hent}>
            Prøv igjen
          </Button>
          {veiviser && (
            <Button type="button" onClick={veiviser.neste} className="ml-auto">
              {veiviser.nesteTekst}
            </Button>
          )}
        </div>
      </div>
    );
  }
  if (!runde) {
    return (
      <p className="m-0 flex items-center gap-2 text-[15px]">
        <Spinner aria-hidden /> Vi går gjennom saken din …
      </p>
    );
  }

  const sett = (id: string, endring: Partial<Svar>) => setSvarene((s) => ({ ...s, [id]: { ...(s[id] ?? { valg: [], utdyping: "" }), ...endring } }));
  async function bruk(r: Rettelse, n: number) {
    const lagring = rettelseTilLagring(r, { svar, utfylling });
    const ok = lagring ? await lagre(lagring) : false;
    setStatus((s) => ({ ...s, [n]: ok ? "brukt" : "feilet" }));
  }
  // The answers of this round, unanswered ones as null so they are not asked again; then the next round.
  async function send() {
    const nye: Avklaring[] = runde!.sporsmal.map((s) => ({ runde: runde!.runde, ...(s.moment && { moment: s.moment }), tema: s.tema, sporsmal: s.tekst.slice(0, 300), svar: svarTekst(svarene[s.id])?.slice(0, 500) ?? null }));
    if (nye.length && !(await lagre({ avklaringer: [...(utfylling.avklaringer ?? []), ...nye] }))) return false;
    hent();
    return false;
  }

  return (
    <Skjema klar send={send} knapp="Neste">
      <p className={HJELP}>Noen spørsmål før vi skriver brevet. Svar på det du vet; resten kan du la stå.</p>
      {runde.rettelser.map((r, n) => (
        <div key={`r${n}`} className="flex flex-col gap-2 rounded-md border border-input p-3">
          <p className="m-0 text-[15px] leading-[1.5]">
            {FELT_TEKST[r.felt]} ser ut til å være <strong>{visVerdi(r)}</strong>. {r.begrunnelse}
          </p>
          {status[n] === "brukt" ? (
            <p className={HJELP}>Rettet.</p>
          ) : status[n] === "beholdt" ? (
            <p className={HJELP}>Beholdt som det var.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void bruk(r, n)}>
                Bruk
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setStatus((s) => ({ ...s, [n]: "beholdt" }))}>
                Behold
              </Button>
              {status[n] === "feilet" && <p className={HJELP}>Rettelsen ble ikke lagret.</p>}
            </div>
          )}
        </div>
      ))}
      {runde.sporsmal.map((s) => (
        <div key={s.id} className="flex flex-col gap-2">
          {s.alternativer.length === 0 ? null : s.flervalg ? (
            <Flervalgsfelt label={s.tekst} verdi={svarene[s.id]?.valg ?? []} velg={(v) => sett(s.id, { valg: v })} valg={s.alternativer.map((a) => ({ verdi: a, tekst: a }))} />
          ) : (
            <Valgfelt label={s.tekst} verdi={svarene[s.id]?.valg[0] ?? ""} velg={(v) => sett(s.id, { valg: [v] })} valg={s.alternativer.map((a) => ({ verdi: a, tekst: a }))} />
          )}
          <Tekstfelt
            label={s.alternativer.length ? "Utdyp (valgfritt)" : s.tekst}
            value={svarene[s.id]?.utdyping ?? ""}
            onChange={(e) => sett(s.id, { utdyping: e.target.value.slice(0, 300) })}
          />
        </div>
      ))}
    </Skjema>
  );
}
