import type { Gruppe } from "@/lib/data/statistikk";
import type { VedtakRad } from "@/lib/data/vedtakliste";
import { lagreKvalitetssjekk } from "./actions";
import { formatKr, formatListe, formatProsent, formatTekst } from "./format";

export function Seksjon({ tittel, beskrivelse, children }: { tittel: string; beskrivelse?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{tittel}</h2>
        {beskrivelse && <p className="mt-1 text-sm text-muted-foreground">{beskrivelse}</p>}
      </div>
      {children}
    </section>
  );
}

export function Tall({ etikett, verdi, under }: { etikett: string; verdi: string; under?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{etikett}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{verdi}</div>
      {under && <div className="mt-1 text-xs text-muted-foreground">{under}</div>}
    </div>
  );
}

export function Fordeling({ rader, total }: { rader: { navn: string; n: number }[]; total: number }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {rader.map((r) => (
        <li key={r.navn} className="grid grid-cols-[10rem_1fr_5.5rem] items-center gap-3">
          <span className="truncate">{formatTekst(r.navn)}</span>
          <span className="h-2 rounded-full bg-muted">
            <span className="block h-2 rounded-full bg-foreground/70" style={{ width: `${total ? (r.n / total) * 100 : 0}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted-foreground">
            {r.n} ({total ? formatProsent(r.n / total) : "–"})
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Vinnertabell({ tittel, grupper }: { tittel: string; grupper: Gruppe[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <h3 className="border-b px-4 py-2 text-sm font-medium">{tittel}</h3>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-1.5 font-normal">Gruppe</th>
            <th className="px-2 py-1.5 text-right font-normal">Saker</th>
            <th className="px-2 py-1.5 text-right font-normal">Medhold</th>
            <th className="px-4 py-1.5 text-right font-normal">95 % intervall</th>
          </tr>
        </thead>
        <tbody>
          {grupper.map((g) => (
            <tr key={g.gruppe} className={`border-t ${g.n < 10 ? "text-muted-foreground" : ""}`}>
              <td className="px-4 py-1.5">{formatTekst(g.gruppe)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{g.n}</td>
              <td className="px-2 py-1.5 text-right font-medium tabular-nums">{formatProsent(g.andel)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">
                {formatProsent(g.lav)}–{formatProsent(g.hoy)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Felt({ navn, verdi }: { navn: string; verdi: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{navn}</dt>
      <dd className="min-w-0 break-words">{verdi}</dd>
    </>
  );
}

const QA_FARGE = { riktig: "bg-emerald-100 text-emerald-900", feil: "bg-red-100 text-red-900", ukontrollert: "bg-muted text-muted-foreground" };

export function Vedtakskort({ v, medQa }: { v: VedtakRad; medQa?: boolean }) {
  return (
    <article className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm">
        <span className="font-medium">Sak {v.saksnummer ?? v.id}</span>
        <span className="text-muted-foreground">
          {v.vedtaksdato ?? v.ar} · {v.arkiv}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{formatTekst(v.utfall)}</span>
        {v.trengerKontroll && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">trenger kontroll</span>}
        <span className={`rounded px-1.5 py-0.5 text-xs ${QA_FARGE[v.qaStatus]}`}>QA: {v.qaStatus}</span>
        <a href={v.kildeUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm underline underline-offset-2">
          Original-PDF ↗
        </a>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <dl className="grid grid-cols-[9.5rem_1fr] gap-x-3 gap-y-1 text-sm">
          <Felt navn="Kjøretøy" verdi={`${formatTekst(v.kjoretoytype)} · ${v.merke ?? "–"} ${v.modell ?? ""} ${v.arsmodell ?? ""}`} />
          <Felt navn="Drivstoff / km" verdi={`${formatTekst(v.drivstoff)} · ${v.kmVedKjop?.toLocaleString("nb-NO") ?? "–"} km`} />
          <Felt navn="Kjøpesum" verdi={formatKr(v.kjopesumNok)} />
          <Felt navn="Selger" verdi={`${formatTekst(v.selgerType)} · ${v.selgerNavn ?? "–"}${v.selgerOrgnr ? ` (${v.selgerOrgnr})` : ""}`} />
          <Felt navn="Verksted" verdi={formatTekst(v.verkstedNavn)} />
          <Felt navn="Kjøpt / reklamert" verdi={`${v.kjopsdato ?? "–"} / ${v.forsteReklamasjonDato ?? "–"} (${v.dagerTilReklamasjon ?? "–"} dager)`} />
          <Felt navn="Forbehold" verdi={formatListe(v.forbehold)} />
          <Felt navn="Feiltyper" verdi={formatListe(v.feiltyper)} />
          <Felt navn="Utbedring" verdi={formatKr(v.utbedringskostnadNok)} />
          <Felt navn="Bevis" verdi={formatListe(v.bevistyper)} />
          <Felt navn="Krav" verdi={`${formatListe(v.kravtyper)} (hovedkrav: ${formatTekst(v.prinsipaltKrav)}) · ${formatKr(v.krevdTotaltNok)}`} />
          <Felt navn="Mangelsgrunnlag" verdi={formatListe(v.mangelsgrunnlag)} />
          <Felt navn="Tvistetema" verdi={formatListe(v.tvistetema)} />
          <Felt navn="Tilkjent" verdi={formatKr(v.tilkjentTotaltNok)} />
          <Felt navn="Lov" verdi={`${formatTekst(v.lov)} (${formatTekst(v.lovversjon)}) · ${formatListe(v.paragrafer)}`} />
          <Felt navn="Enstemmig" verdi={formatTekst(v.enstemmig)} />
          <Felt navn="Konfidens" verdi={v.konfidens?.toFixed(2) ?? "–"} />
        </dl>

        <div className="space-y-3 text-sm">
          <p>{v.sammendrag}</p>
          {!!v.nokkelmomenter?.length && (
            <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
              {v.nokkelmomenter.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
          {v.sitater && Object.keys(v.sitater).length > 0 && (
            <details open={medQa}>
              <summary className="cursor-pointer font-medium">Sitater</summary>
              <dl className="mt-2 space-y-1.5">
                {Object.entries(v.sitater).map(([felt, sitat]) => (
                  <div key={felt}>
                    <dt className="text-xs text-muted-foreground">{felt.replaceAll("_", " ")}</dt>
                    <dd className="border-l-2 pl-2 italic">«{sitat}»</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {!!v.kontrollArsaker?.length && (
            <ul className="space-y-0.5 rounded bg-amber-50 p-2 text-xs text-amber-900">
              {v.kontrollArsaker.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {medQa && (
        <form action={lagreKvalitetssjekk} className="flex flex-wrap items-start gap-2 border-t px-4 py-3">
          <input type="hidden" name="id" value={v.id} />
          <textarea
            name="kommentar"
            defaultValue={v.qaKommentar ?? ""}
            placeholder="Kommentar (hva er feil?)"
            rows={1}
            className="min-h-9 min-w-64 flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
          />
          <button name="status" value="riktig" className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800">
            Riktig
          </button>
          <button name="status" value="feil" className="h-9 rounded-md bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800">
            Feil
          </button>
        </form>
      )}
    </article>
  );
}
