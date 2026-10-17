// The writer's Vedtak tab: the ranking's top ten decisions with medhold, the model's choice first
// («Anbefalt»), each with its likeness to the buyer's case. The buyer picks the one the letter cites.
import { useEffect, useState } from "react";
import { cap, tall } from "@/lib/app/format";
import type { Presedens } from "@/lib/app/brev";
import { husk } from "@/lib/app/kall";
import { nokkel, sakTekst, tilSvar } from "@/lib/app/saken";
import type { Skjema } from "@/lib/app/skjema";
import type { Kriterium, Treff } from "@/lib/matching/ranger";
import { type Funn, finnVedtak } from "./actions";
import type { Sett } from "./felt";

// One model call per set of answers in this page session, however often the tabs are opened.
const hent = (svar: NonNullable<ReturnType<typeof tilSvar>>, ordreId: string) =>
  husk(`${ordreId}|${nokkel(svar)}`, () => finnVedtak({ svar, ordreId }), "Vi fikk ikke kontakt. Prøv igjen.");

export type Vedtaksvalg = {
  // The dates are missing, so there is nothing to look up yet.
  mangler: boolean;
  funn: Funn | null;
  valg: Presedens[];
  valgt: Presedens | null;
  // The letter waits for the decision.
  venter: boolean;
  provIgjen: () => void;
};

// The decisions for the writer's answers. Fetched only while `aktiv` (the Vedtak or Brevet tab is open)
// and the letter is to cite one, so typing in the form makes no model call.
export function useVedtak(s: Skjema, sett: Sett, ordre: string, aktiv: boolean): Vedtaksvalg {
  const svar = tilSvar(s);
  const n = nokkel(svar);
  const [funn, settFunn] = useState<{ n: string; f: Funn } | null>(null);
  const [forsok, settForsok] = useState(0);

  useEffect(() => {
    if (!svar || !ordre || !aktiv || !s.prec_on) return;
    let gjeldende = true;
    hent(svar, ordre).then((f) => {
      if (!gjeldende) return;
      settFunn({ n, f });
      // The picker starts on the decision the model chose.
      if (f.ok && f.valg.length && !f.valg.some((v) => v.id === s.prec_id)) sett({ prec_id: f.valg[0].id });
    });
    return () => {
      gjeldende = false;
    };
    // `n` stands for `svar`; `forsok` is «Prøv igjen».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, ordre, aktiv, s.prec_on, forsok]);

  const aktuell = funn && funn.n === n ? funn.f : null;
  const valg = aktuell?.ok ? aktuell.valg : [];
  return {
    mangler: !svar,
    funn: aktuell,
    valg,
    valgt: valg.find((v) => v.id === s.prec_id) ?? valg[0] ?? null,
    venter: !!svar && s.prec_on && (!aktuell || !aktuell.ok),
    provIgjen: () => settForsok((f) => f + 1),
  };
}

type Tone = "good" | "up" | "warn";
// How each criterion compared, as the buyer reads it. «Strengere» means the decision was harder for the
// buyer than this case, so the buyer's case stands stronger. `ukjent` and `ikke_oppgitt` are not shown.
const TREFFTEKST: Record<Kriterium, Partial<Record<Treff, [Tone, string]>>> = {
  underkategori: { likt: ["good", "Samme del"], ulikt: ["warn", "Annen del"] },
  tidsniva: { likt: ["good", "Feilen viste seg på samme tidspunkt"], strengere: ["up", "Feilen viste seg senere enn din"], mildere: ["warn", "Feilen viste seg tidligere enn din"] },
  km: { likt: ["good", "Kjørt omtrent like langt"], strengere: ["up", "Bilen hadde gått lenger enn din"], mildere: ["warn", "Bilen hadde gått kortere enn din"] },
  alder: { likt: ["good", "Omtrent like gammel bil"], strengere: ["up", "Bilen var eldre enn din"], mildere: ["warn", "Bilen var yngre enn din"] },
  som_den_er: { likt: ["good", "Likt på «som den er»"], strengere: ["up", "Solgt «som den er», det var ikke din"], mildere: ["warn", "Ikke solgt «som den er», det var din"] },
  krav: { likt: ["good", "Fikk det du krever"], delvis: ["warn", "Fikk det du krever, for flere feil"], ulikt: ["warn", "Fikk et annet krav enn ditt"] },
  egen_vurdering: { likt: ["good", "Utvalget vurderte feilen for seg"], ulikt: ["warn", "Feilen ble ikke drøftet for seg"] },
  grunnlag: { likt: ["good", "Bygde på bevis du også har"], mildere: ["warn", "Bygde på bevis du ikke har"] },
};
const TEGN: Record<Tone, string> = { good: "✓", up: "↑", warn: "−" };

function Kort({ v, plass, valgt, onVelg }: { v: Presedens; plass: number; valgt: boolean; onVelg: () => void }) {
  const meta = [cap(v.gjaldt), v.km !== null ? `${tall(v.km)} km` : "", v.alder !== null ? `${v.alder} år gammel` : "", v.somDenEr ? "«som den er»" : ""].filter(Boolean).join(" · ");
  const brikker = (Object.keys(TREFFTEKST) as Kriterium[]).flatMap((k) => {
    const t = TREFFTEKST[k][v.treff[k]];
    return t ? [{ k, tone: t[0], tekst: t[1] }] : [];
  });
  return (
    <label className="pp-opt vk">
      <input type="radio" name="prec_id" value={v.id} checked={valgt} onChange={onVelg} />
      <span className="pp-b vk-b">
        <span className="vk-h">
          <span className="vk-n">
            <em className={v.anbefalt ? "vk-anb" : undefined}>{v.anbefalt ? "Anbefalt" : `Nr. ${plass}`}</em>
            <b>{v.bil}</b>
            <span className="pp-d">
              {sakTekst(v.saksnummer, v.vedtaksdato?.slice(0, 4) ?? null)}
              {v.utfall[0] && ` · Kjøperen fikk ${v.utfall.join(" og ")}`}
            </span>
          </span>
          <span className="vk-s" aria-label={`Likhet ${v.likhet} prosent`}>
            <b>{v.likhet} %</b>
            <span>likhet</span>
            <span className="meter" aria-hidden="true">
              <i style={{ width: `${v.likhet}%` }} />
            </span>
          </span>
        </span>
        {meta && <span className="vk-m">{meta}</span>}
        {brikker.length > 0 && (
          <span className="vk-t">
            {brikker.map((b) => (
              <span key={b.k} className={`tag ${b.tone}`}>
                {TEGN[b.tone]} {b.tekst}
              </span>
            ))}
          </span>
        )}
        {valgt && (
          <span className="vk-a">
            <span className="vk-al">Slik står det i brevet</span>
            <span>{v.avsnitt}</span>
            {v.kildeUrl && (
              <a href={v.kildeUrl} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                Les hele vedtaket hos Forbrukertilsynet
              </a>
            )}
          </span>
        )}
      </span>
    </label>
  );
}

export function Vedtaksfane({ s, sett, vedtak, onBrevet }: { s: Skjema; sett: Sett; vedtak: Vedtaksvalg; onBrevet: () => void }) {
  const { funn, valg, valgt } = vedtak;
  return (
    <section className="wcase" role="tabpanel" aria-label="Vedtak">
      <div className="head">
        <h2>Vedtaket brevet viser til</h2>
        <p>
          Dette er vedtakene fra Forbrukerklageutvalget som ligner saken din mest, der kjøperen fikk medhold. Vi anbefaler det øverste: det er valgt ut fra beskrivelsen din i tillegg til poengene. Likhet viser hvor mye vedtaket ligner saken din på feil, tidspunkt, bil, krav og bevis. Det er ikke en vinnersjanse.
        </p>
      </div>
      {!s.prec_on ? (
        <div className="sugg">
          <span>Du har slått av henvisningen til en lignende sak i brevet.</span>
          <button type="button" className="btn sm" onClick={() => sett({ prec_on: true })}>
            Slå på
          </button>
        </div>
      ) : vedtak.mangler ? (
        <p className="hint">Legg inn overtakelsesdato og når du oppdaget feilen, så finner vi lignende saker.</p>
      ) : !funn ? (
        <p className="hint">Finner lignende saker …</p>
      ) : !funn.ok ? (
        <div className="sugg">
          <span>{funn.melding}</span>
          <button type="button" className="btn sm" onClick={vedtak.provIgjen}>
            Prøv igjen
          </button>
        </div>
      ) : !valg.length ? (
        <p className="hint">Vi fant ingen lignende sak med medhold. Brevet bygger på lovens vilkår.</p>
      ) : (
        <div className="pp vk-l">
          {valg.map((v, i) => (
            <Kort key={v.id} v={v} plass={i + 1} valgt={v.id === valgt?.id} onVelg={() => sett({ prec_id: v.id, prec_on: true })} />
          ))}
        </div>
      )}
      <div className="wcase-cta">
        <span />
        <button type="button" className="btn pri" onClick={onBrevet}>
          Se brevet
        </button>
      </div>
    </section>
  );
}
