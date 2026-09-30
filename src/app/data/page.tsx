import type { Metadata } from "next";
import { FEILTYPER, KJORETOYTYPER, UTFALL } from "@/lib/ai/skjema";
import { datakvalitet, nokkeltall, vinnersjanse } from "@/lib/data/statistikk";
import { filterverdier, kvalitetsutvalg, sok } from "@/lib/data/vedtakliste";
import { formatKr, formatProsent, formatTekst } from "./format";
import { Fordeling, Seksjon, Tall, Vedtakskort, Vinnertabell } from "./komponenter";

export const metadata: Metadata = {
  title: "Datagrunnlag – tvistr",
  robots: { index: false, follow: false },
};

type Params = Record<string, string | string[] | undefined>;
const en = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

// Derives the next sample key from the current one, so "Nytt utvalg" is deterministic per page.
function nesteUtvalg(frø: string): string {
  let h = 2166136261;
  for (const c of frø + "+") h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36);
}

const velgKlasse = "h-9 rounded-md border bg-background px-2 text-sm";

export default async function DataSide({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const kjoretoy = en(p.kjoretoy);
  const filter = { kjoretoy, feiltype: en(p.feiltype), utfall: en(p.utfall), ar: en(p.ar), selger: en(p.selger) };
  const frø = en(p.utvalg) ?? new Date().toISOString().slice(0, 10);

  const [tall, vinn, kvalitet, utvalg, treff, verdier] = await Promise.all([
    nokkeltall(kjoretoy),
    vinnersjanse(kjoretoy),
    datakvalitet(),
    kvalitetsutvalg(frø),
    sok(filter),
    filterverdier(),
  ]);
  const maks = Math.max(1, ...tall.perAr.map((r) => r.n));

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Datagrunnlag: vedtak om brukte kjøretøy</h1>
        <p className="max-w-3xl text-muted-foreground">
          Vedtak fra Forbrukertvistutvalget og Forbrukerklageutvalget fra 2013, tolket automatisk. Personnavn er fjernet. Vinnersjanse gjelder
          saker som endte med vedtak – forlik og trukne saker er ikke med.
        </p>
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="kjoretoy" className="text-muted-foreground">
            Kjøretøytype for statistikken:
          </label>
          <select id="kjoretoy" name="kjoretoy" defaultValue={kjoretoy ?? ""} className={velgKlasse}>
            <option value="">Alle</option>
            {KJORETOYTYPER.map((k) => (
              <option key={k} value={k}>
                {formatTekst(k)}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-md border px-3">Vis</button>
        </form>
      </header>

      <Seksjon tittel="1. Nøkkeltall">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tall etikett="Vedtak" verdi={String(tall.n)} />
          <Tall etikett="Median krevd" verdi={formatKr(tall.median_krevd)} />
          <Tall etikett="Median tilkjent" verdi={formatKr(tall.median_tilkjent)} under="alle saker med beløp" />
          <Tall etikett="Median tilkjent når noe ble tilkjent" verdi={formatKr(tall.median_tilkjent_vunnet)} />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-medium">Vedtak per år</h3>
            <div className="flex h-40 items-end gap-1">
              {tall.perAr.map((r) => (
                <div key={r.ar ?? "?"} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${r.ar}: ${r.n}`}>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{r.n}</span>
                  <div className="w-full rounded-t bg-foreground/70" style={{ height: `${(r.n / maks) * 100}%` }} />
                  <span className="text-[10px] text-muted-foreground">{String(r.ar ?? "?").slice(2)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-5 rounded-lg border bg-card p-4">
            <div>
              <h3 className="mb-2 text-sm font-medium">Utfall</h3>
              <Fordeling rader={tall.utfall.map((r) => ({ navn: r.utfall ?? "ukjent", n: r.n }))} total={tall.n} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Selger</h3>
              <Fordeling rader={tall.selger.map((r) => ({ navn: r.selger_type ?? "ukjent", n: r.n }))} total={tall.n} />
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-medium">Kjøretøytype (alle vedtak)</h3>
            <Fordeling rader={tall.kjoretoy.map((r) => ({ navn: r.kjoretoytype ?? "ukjent", n: r.n }))} total={tall.kjoretoy.reduce((a, r) => a + r.n, 0)} />
          </div>
          <div className="max-h-96 overflow-y-auto rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-medium">Merker ({tall.merker.length})</h3>
            <Fordeling rader={tall.merker.map((r) => ({ navn: r.merke ?? "ukjent", n: r.n }))} total={tall.n} />
          </div>
        </div>
      </Seksjon>

      <Seksjon
        tittel="2. Vinnersjanse per gruppe"
        beskrivelse="Andel vedtak med medhold eller delvis medhold. Grå rader har færre enn 10 saker; intervallet viser usikkerheten."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <Vinnertabell tittel="Feiltype" grupper={vinn.perFeiltype} />
            <Vinnertabell tittel="Mangelsgrunnlag" grupper={vinn.perGrunnlag} />
            <Vinnertabell tittel="Tvistetema" grupper={vinn.perTvistetema} />
          </div>
          <div className="space-y-4">
            <Vinnertabell tittel="Hovedkrav" grupper={vinn.perHovedkrav} />
            <Vinnertabell tittel="Selger" grupper={vinn.perSelger} />
            <Vinnertabell tittel="Forbehold" grupper={vinn.perForbehold} />
            <Vinnertabell tittel="Bevis" grupper={vinn.perBevis} />
            <Vinnertabell tittel="Kravstørrelse" grupper={vinn.perKrav} />
          </div>
        </div>
      </Seksjon>

      <Seksjon tittel="3. Datakvalitet" beskrivelse="Gjelder alle tolkede vedtak.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Tall etikett="Tolket" verdi={String(kvalitet.n)} />
          <Tall etikett="Flagget for kontroll" verdi={String(kvalitet.flagget)} under={kvalitet.n ? formatProsent(kvalitet.flagget / kvalitet.n) : undefined} />
          <Tall etikett="Kontrollert" verdi={String(kvalitet.kontrollert)} />
          <Tall
            etikett="Riktige av kontrollerte"
            verdi={kvalitet.kontrollert ? formatProsent(kvalitet.riktig / kvalitet.kontrollert) : "–"}
            under={`${kvalitet.riktig} riktig, ${kvalitet.feil} feil`}
          />
          <Tall etikett="Kostnad tolking" verdi={`$${(kvalitet.kostnad ?? 0).toFixed(2)}`} under={kvalitet.n ? `$${((kvalitet.kostnad ?? 0) / kvalitet.n).toFixed(3)} per vedtak` : undefined} />
        </div>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-medium">Andel utfylt per felt</h3>
            <Fordeling rader={kvalitet.dekning.map((d) => ({ navn: d.felt, n: d.utfylt }))} total={kvalitet.n} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-medium">Vanligste grunner til flagg</h3>
            <ul className="space-y-1 text-sm">
              {kvalitet.arsaker.map((a) => (
                <li key={a.arsak} className="flex justify-between gap-2">
                  <span>{a.arsak}</span>
                  <span className="tabular-nums text-muted-foreground">{a.n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Seksjon>

      <Seksjon
        tittel="4. Kvalitetssjekk"
        beskrivelse={`30 tilfeldige vedtak (utvalg «${frø}»). Sammenlign feltene med original-PDF-en og marker riktig eller feil.`}
      >
        <form className="flex items-center gap-2 text-sm">
          {kjoretoy && <input type="hidden" name="kjoretoy" value={kjoretoy} />}
          <input type="hidden" name="utvalg" value={nesteUtvalg(frø)} />
          <button className="h-9 rounded-md border px-3">Nytt utvalg</button>
        </form>
        <div className="space-y-4">
          {utvalg.map((v) => (
            <Vedtakskort key={v.id} v={v} medQa />
          ))}
        </div>
      </Seksjon>

      <Seksjon tittel="5. Søk og filter" beskrivelse={`${treff.n} vedtak passer filteret; de 50 nyeste vises.`}>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          {kjoretoy && <input type="hidden" name="kjoretoy" value={kjoretoy} />}
          <select name="feiltype" defaultValue={filter.feiltype ?? ""} className={velgKlasse} aria-label="Feiltype">
            <option value="">Alle feiltyper</option>
            {FEILTYPER.map((f) => (
              <option key={f} value={f}>
                {formatTekst(f)}
              </option>
            ))}
          </select>
          <select name="utfall" defaultValue={filter.utfall ?? ""} className={velgKlasse} aria-label="Utfall">
            <option value="">Alle utfall</option>
            {UTFALL.map((u) => (
              <option key={u} value={u}>
                {formatTekst(u)}
              </option>
            ))}
          </select>
          <select name="ar" defaultValue={filter.ar ?? ""} className={velgKlasse} aria-label="År">
            <option value="">Alle år</option>
            {verdier.ar.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input
            name="selger"
            defaultValue={filter.selger ?? ""}
            placeholder="Selger (navn eller org.nr.)"
            className="h-9 w-64 rounded-md border bg-background px-3"
          />
          <button className="h-9 rounded-md bg-primary px-4 font-medium text-primary-foreground">Søk</button>
        </form>
        <div className="space-y-4">
          {treff.treff.map((v) => (
            <Vedtakskort key={v.id} v={v} />
          ))}
        </div>
      </Seksjon>
    </div>
  );
}
