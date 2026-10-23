// «Svarene dine» (mockup, after payment): one row per section of the form with what it says now and
// «Endre». A row opens in place with the section's question and its fields, and «Ferdig» closes it.
// The sections answered after payment come first. The car is locked to the purchase except its mileage,
// the faults are locked altogether, and «Vedtaket» opens the dialog where the decision is picked.
import type { ReactNode } from "react";
import { feilposter, feilposterSortert, virkningFor } from "@/lib/app/feil";
import { Opp } from "@/app/deler/ikoner";
import { Bilen, Kjopet } from "@/app/sak/skjema/bilen";
import type { Sett, StegProps } from "@/app/sak/skjema/felt";
import { Krav } from "@/app/sak/skjema/krav";
import { Omrader, SagtFra, SelgerSa, Vedlegg, Verksted, Virkning } from "@/app/sak/skjema/mangelen";
import { Deg, Forhandleren } from "@/app/sak/skjema/partene";
import { ETTER, FOR, type Seksjon } from "@/app/sak/skjema/steg";
import { fmtD } from "@/lib/app/dato";
import { cap } from "@/lib/app/format";
import { sakNavn, sakTekst } from "@/lib/app/saken";
import { IMPACT, type Skjema, syncAreas, vedlegg } from "@/lib/app/skjema";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { liste } from "@/lib/brev/format";
import type { Feilvalg, Vedtaksvalg } from "./vedtaksvindu";

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
      return ledd(vedlegg(s).join(", "));
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
    {
      const p = feilposter(s).filter((x) => x.found).sort((a, b) => a.found.localeCompare(b.found));
      return ledd(p.length > 1 ? `${p.length} feil, første oppdaget ${fmtD(p[0].found)}` : s.f_found && `Oppdaget ${fmtD(s.f_found)}`, p[0]?.desc);
    }
    case "virkning":
    {
      // Per fault, numbered as in the letter when there are several.
      const navn = (v: string[]) => IMPACT.filter(([x]) => v.includes(x)).map(([, n]) => n).join(", ");
      const p = feilposterSortert(s);
      return ledd(p.length > 1 ? p.map((x, i) => `${i + 1}. ${navn(virkningFor(s, x)) || "Ikke valgt"}`).join(" · ") : navn(p[0] ? virkningFor(s, p[0]) : s.f_impact));
    }
    case "verksted":
      return ledd(WS[s.ws], s.ws !== "nei" && s.ws_name.trim());
    case "selger_sa":
      return ledd(SAGT[s.seller_said]);
    case "sagt_fra":
      return s.f_prior ? (s.f_prior_date ? `Ja, ${fmtD(s.f_prior_date)}` : "Ja") : "Nei";
    case "kravet":
      return s.k_main ? `${cap(s.k_main)}${s.k_alt && s.k_alt !== "ingen" ? `, ellers ${s.k_alt}` : ""}` : IKKE;
    default:
      return IKKE;
  }
}

const LAAST_BIL = "Bilen er låst fordi brevet gjelder bilen du betalte for. Km-stand kan du endre her, kjøpsdatoen under Kjøpet.";

// The fields of each row that opens, with the car locked and the «som den er» switch in Kjøpet.
const STEG: Record<string, (p: StegProps) => ReactNode> = {
  deg: Deg,
  forhandleren: Forhandleren,
  brevet: Vedlegg,
  bilen: (p) => <Bilen {...p} laast />,
  kjopet: (p) => <Kjopet {...p} medForbehold />,
  omrader: Omrader,
  virkning: Virkning,
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

// What the letter cites, for the row «Vedtaket»: the decision, its car and «Anbefalt» for one fault;
// numbered as in the letter for several.
export function vedtakTekst(s: Skjema, v: Vedtaksvalg): string {
  if (v.mangler) return "Legg inn datoene først";
  if (!v.funn) return "Finner lignende saker …";
  if (!v.funn.ok) return "Fikk ikke hentet vedtakene";
  if (!v.feil.some((f) => f.valgt)) return "Ingen lignende sak med medhold";
  const sak = (p: NonNullable<Feilvalg["valgt"]>) => sakTekst(p.saksnummer, p.vedtaksdato?.slice(0, 4) ?? null);
  if (v.feil.length === 1) {
    const p = v.feil[0].valgt!;
    return [sak(p), p.bil, p.anbefalt && "Anbefalt"].filter(Boolean).join(" · ");
  }
  return v.feil.map((f) => `${f.nr}. ${f.valgt ? sak(f.valgt) : "Lovens vilkår"}`).join(" · ");
}

// When new lists changed the decision the letter cites under a fault, as the dialog says it (Endringsmelding).
export function vedtakEndret(s: Skjema, v: Vedtaksvalg): string | null {
  const byttet = v.feil.filter((f) => f.endring && f.valgt && (f.endring.byttetFra || f.endring.utfall === "borte"));
  return byttet.length ? `Endret: brevet viser nå til ${liste(byttet.map((f) => sakNavn(f.valgt)))}` : null;
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
          <Opp s={18} />
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
  const endret = vedtakEndret(s, vedtak);
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
              {endret && <span className="fl-svar-endret">{endret}</span>}
            </span>
            <span className="fl-svar-e">Endre</span>
          </button>
        </div>
      </form>
    </section>
  );
}
