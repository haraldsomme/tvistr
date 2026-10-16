// Step 2, «Bilen og kjøpet». Used cars only: no «Ny bil» tile.
import { Skilt } from "@/app/deler/skilt";
import { fmtD } from "@/lib/app/dato";
import { regler } from "@/lib/app/lov";
import { Bryter, Felt, type StegProps } from "./felt";

export function Bilen({ s, sett }: StegProps) {
  const d = s.c_lastreg;
  const brukt = d && s.c_delivery === d && s.c_purchase === d;
  return (
    <section className="panel">
      <div className="head">
        <h2>Bilen og kjøpet</h2>
        <p>Hent opplysningene fra kjøpekontrakten og vognkortet. Overtakelsesdatoen er utgangspunktet for alle fristene.</p>
      </div>
      <div className="block">
        <div className="grid">
          <div className="f c6">
            <label className="lb" htmlFor="c_reg">
              Registreringsnummer
            </label>
            <Skilt
              id="c_reg"
              verdi={s.c_reg}
              funnet={s.c_make && s.c_lastreg ? { make: s.c_make, model: s.c_model, year: s.c_year, lastReg: s.c_lastreg } : null}
              laast
              onEndre={(c_reg) => sett({ c_reg })}
              onBil={(b) => sett({ c_make: b.make, c_model: b.model, c_year: b.year, c_lastreg: b.lastReg })}
            />
          </div>
          {/* From the vehicle register in the check: locked to the purchase. Typed by hand when the register had nothing. */}
          <Felt s={s} sett={sett} k="c_make" label="Merke" klasse="c2" placeholder="Volkswagen" disabled={s.c_registrert} />
          <Felt s={s} sett={sett} k="c_model" label="Modell" klasse="c2 m3" placeholder="ID.4" disabled={s.c_registrert} />
          <Felt s={s} sett={sett} k="c_year" label="Årsmodell" klasse="c2 m3" fmt="year" inputMode="numeric" placeholder="2022" mono disabled={s.c_registrert} />
          <Felt
            s={s}
            sett={sett}
            k="c_vin"
            label={
              <>
                Understellsnummer{" "}
                <em>{/[IOQ]/.test(s.c_vin) ? <span className="tag warn">I, O og Q brukes ikke</span> : s.c_vin.length === 17 ? <span className="tag good">17/17</span> : `${s.c_vin.length}/17`}</em>
              </>
            }
            fmt="vin"
            maks={17}
            placeholder="WVGZZZE2ZNP012345"
            mono
            hint="Står i vognkortet, felt E"
          />
          <Felt s={s} sett={sett} k="c_purchase" label="Kjøpsdato" klasse="c3" type="date" />
          <Felt s={s} sett={sett} k="c_delivery" label="Overtakelsesdato" klasse="c3" type="date" />
          {d && !brukt && (
            <div className="c6 sugg">
              <span>
                Bilen ble registrert på ny eier <b>{fmtD(d)}</b>. Var det da du kjøpte og overtok den?
              </span>
              <button type="button" className="btn sm" onClick={() => sett({ c_purchase: d, c_delivery: d })}>
                Bruk datoen
              </button>
            </div>
          )}
          <Felt s={s} sett={sett} k="c_price" label="Kjøpesum" klasse="c3" fmt="num" inputMode="numeric" placeholder="329 900" suffiks="kr" />
          <Felt s={s} sett={sett} k="c_km" label="Km-stand ved overtakelse" klasse="c3" fmt="num" inputMode="numeric" placeholder="38 500" suffiks="km" />
        </div>
      </div>
      <div className="block">
        <Bryter
          s={s}
          sett={sett}
          k="c_asis"
          tittel="Solgt «som den er»"
          tekst={
            regler(s.c_purchase || s.c_delivery).versjon === "før_2024"
              ? "Forhandleren kan likevel ha ansvar hvis bilen er i dårligere stand enn du hadde grunn til å forvente."
              : "Fra 2024 er et generelt forbehold ikke nok. Det gjelder bare egenskaper du ble spesielt opplyst om og uttrykkelig godtok."
          }
        />
        <Bryter s={s} sett={sett} k="c_warranty" tittel="Bilen har garanti" tekst="Fabrikkgaranti, bruktbilgaranti eller lignende. Garantien kommer i tillegg til rettighetene dine etter loven." />
      </div>
    </section>
  );
}
