// «Svarene dine» (mockup, after payment): one row per section of the form with what it says now and
// «Endre». A row opens in place with the section's question and its fields, and «Ferdig» closes it.
// The sections answered after payment come first. The car is locked to the purchase except its mileage,
// the faults are locked altogether, and «Vedtaket» opens the dialog where the decision is picked.
import type { ReactNode } from "react";
import { Bilen, Kjopet } from "@/app/sak/skjema/bilen";
import type { Sett, StegProps } from "@/app/sak/skjema/felt";
import { Krav } from "@/app/sak/skjema/krav";
import { Omrader, SagtFra, SelgerSa, Verksted } from "@/app/sak/skjema/mangelen";
import { Brevvalg, Deg, Forhandleren } from "@/app/sak/skjema/partene";
import { ETTER, FOR, type Seksjon } from "@/app/sak/skjema/steg";
import { fmtD } from "@/lib/app/dato";
import { cap } from "@/lib/app/format";
import { sakTekst } from "@/lib/app/saken";
import { type Skjema, syncAreas } from "@/lib/app/skjema";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { GRATIS } from "@/lib/pris";
import type { Vedtaksvalg } from "./vedtaksvindu";

const IKKE = "Ikke fylt ut";
const ledd = (...x: (string | false | null | undefined)[]) => x.filter(Boolean).join(" · ") || IKKE;
const WS: Record<string, string> = { rapport: "Ja, med rapport", uten: "Ja, uten rapport", nei: "Nei" };
const SAGT: Record<string, string> = { nei: "Nei", lovet: "Lovet at bilen var fri for slike feil", opplyste: "Opplyste om feilen" };

// One line for a section's row: what its answers say now, or «Ikke fylt ut».
export function oppsummering(id: string, skjema: Skjema): string {
  const s = syncAreas(skjema);
  switch (id) {
    case "deg":
      return ledd(s.b_name.trim(), [s.b_addr.trim(), `${s.b_zip} ${s.b_city}`.trim()].filter(Boolean).join(", "));
    case "forhandleren":
      return ledd(s.d_name.trim(), s.d_org && `org.nr. ${s.d_org}`);
    case "brevet":
      return ledd([s.l_place.trim(), s.l_date && fmtD(s.l_date)].filter(Boolean).join(", "), s.l_tone && `${cap(s.l_tone)} tone`, s.k_days && `svarfrist ${s.k_days} dager`);
    case "bilen":
      return ledd(`${s.c_make} ${s.c_model} ${s.c_year}`.trim(), s.c_reg);
    case "kjopet":
      return ledd((s.c_purchase || s.c_delivery) && fmtD(s.c_purchase || s.c_delivery), s.c_price && `${s.c_price} kr`);
    case "feilen":
      // The parts chosen, or the area where none is.
      return ledd(
        s.f_cats
          .flatMap((c) => {
            const h = HOVEDKATEGORIER.find((x) => x.id === c);
            const deler = (s.f_parts[c] ?? []).map((u) => h?.under.find((x) => x.id === u)?.navn).filter((x): x is string => !!x);
            return deler.length ? deler : h ? [h.navn] : [];
          })
          .join(", "),
      );
    case "omrader":
      return ledd(s.f_found && `Oppdaget ${fmtD(s.f_found)}`, [...s.f_cats.map((c) => s.f_catdesc[c] ?? ""), s.f_desc].map((t) => t.trim()).find(Boolean));
    case "verksted":
      return ledd(WS[s.ws], s.ws !== "nei" && s.ws_name.trim());
    case "selger_sa":
      return ledd(SAGT[s.seller_said]);
    case "sagt_fra":
      return s.f_prior ? ledd(s.f_prior_date ? `Ja, ${fmtD(s.f_prior_date)}` : "Ja", s.f_prior_how) : "Nei";
    case "kravet":
      return s.k_main ? `${cap(s.k_main)}${s.k_alt && s.k_alt !== "ingen" ? `, ellers ${s.k_alt}` : ""}` : IKKE;
    default:
      return IKKE;
  }
}

const LAAST_BIL = `Bilen er låst fordi brevet gjelder bilen ${GRATIS ? "du valgte" : "du betalte for"}. Overtakelsesdato og km-stand kan du endre.`;

// The fields of each row that opens, with the car locked and the «som den er» switch in Kjøpet.
const STEG: Record<string, (p: StegProps) => ReactNode> = {
  deg: Deg,
  forhandleren: Forhandleren,
  brevet: Brevvalg,
  bilen: (p) => <Bilen {...p} laast />,
  kjopet: (p) => <Kjopet {...p} medForbehold />,
  omrader: Omrader,
  verksted: Verksted,
  selger_sa: SelgerSa,
  sagt_fra: SagtFra,
  kravet: Krav,
};

const Laas = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

// What the letter cites, for the row «Vedtaket».
function vedtakTekst(s: Skjema, v: Vedtaksvalg): string {
  if (!s.prec_on) return "Brevet viser ikke til et vedtak";
  if (v.mangler) return "Legg inn datoene først";
  if (!v.funn) return "Finner lignende saker …";
  if (!v.funn.ok) return "Fikk ikke hentet vedtakene";
  if (!v.valgt) return "Ingen lignende sak med medhold";
  return [sakTekst(v.valgt.saksnummer, v.valgt.vedtaksdato?.slice(0, 4) ?? null), v.valgt.bil, v.valgt.anbefalt && "Anbefalt"].filter(Boolean).join(" · ");
}

// The row's element id, for scrolling to it from the letter, the checklist and the verdict.
export const radId = (id: string) => `svar-${id}`;

function Rad({ sk, s, sett, pa, settApen }: { sk: Seksjon; s: Skjema; sett: Sett; pa: boolean; settApen: (id: string, pa: boolean) => void }) {
  const tekst = oppsummering(sk.id, s);
  if (sk.id === "feilen")
    return (
      <div className="fl-svar" id={radId(sk.id)} data-laast>
        <span className="fl-svar-h">
          <span className="fl-svar-t">
            <span className="fl-svar-n">{sk.navn}</span>
            <span className="fl-svar-v">{tekst}</span>
          </span>
          <span className="fl-svar-l">
            <Laas />
            Låst
          </span>
        </span>
      </div>
    );
  const Steget = STEG[sk.id];
  const inn = `${radId(sk.id)}-inn`;
  const lukk = () => {
    settApen(sk.id, false);
    document.querySelector<HTMLElement>(`#${radId(sk.id)} > button`)?.focus({ preventScroll: true });
  };
  return (
    <div className="fl-svar" id={radId(sk.id)} data-apen={pa || undefined}>
      <button type="button" className="fl-svar-h" aria-expanded={pa} aria-controls={pa ? inn : undefined} onClick={() => settApen(sk.id, !pa)}>
        <span className="fl-svar-t">
          {/* Open, the question names the row; its name above only when it says something else. */}
          {(!pa || sk.tittel !== sk.navn) && <span className="fl-svar-n">{sk.navn}</span>}
          {pa ? <span className="fl-svar-q">{sk.tittel}</span> : <span className="fl-svar-v" data-tom={tekst === IKKE || undefined}>{tekst}</span>}
        </span>
        {pa ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 15l6-6 6 6" />
          </svg>
        ) : (
          <span className="fl-svar-e">Endre</span>
        )}
      </button>
      {pa && (
        <div className="fl-svar-inn" id={inn}>
          {sk.hint && sk.id !== "bilen" && <p className="fl-svar-hint">{sk.hint}</p>}
          <div className="fl-skjerm">
            <Steget s={s} sett={sett} />
          </div>
          {sk.id === "bilen" && (
            <div className="fl-laas">
              <Laas />
              <span>{LAAST_BIL}</span>
            </div>
          )}
          <button type="button" className="fl-ferdig" onClick={lukk}>
            Ferdig
          </button>
        </div>
      )}
    </div>
  );
}

export function Svarene({ s, sett, apen, settApen, vedtak, onVedtak }: { s: Skjema; sett: Sett; apen: ReadonlySet<string>; settApen: (id: string, pa: boolean) => void; vedtak: Vedtaksvalg; onVedtak: () => void }) {
  return (
    <section className="fl-svarene" aria-labelledby="svareneTittel">
      <h2 id="svareneTittel">Svarene dine</h2>
      {/* No submit: Enter in a field must not leave the page. */}
      <form className="fl-svar-liste" noValidate autoComplete="on" onSubmit={(e) => e.preventDefault()} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && e.preventDefault()}>
        {[...ETTER, ...FOR].map((sk) => (
          <Rad key={sk.id} sk={sk} s={s} sett={sett} pa={apen.has(sk.id)} settApen={settApen} />
        ))}
        <div className="fl-svar" id={radId("vedtak")}>
          <button type="button" className="fl-svar-h" aria-haspopup="dialog" onClick={onVedtak}>
            <span className="fl-svar-t">
              <span className="fl-svar-n">Vedtaket</span>
              <span className="fl-svar-v">{vedtakTekst(s, vedtak)}</span>
            </span>
            <span className="fl-svar-e">Endre</span>
          </button>
        </div>
      </form>
    </section>
  );
}
