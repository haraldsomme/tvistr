// Steps 3 and 4: the car and the purchase. The car is the one bought for: plate, make, model and year
// are locked (from the check); only the mileage can be filled in.
import { Skilt } from "@/app/deler/skilt";
import { fmtD } from "@/lib/app/dato";
import { regler } from "@/lib/app/lov";
import { GRATIS, NYTT_KJOP } from "@/lib/pris";
import { Bryter, Felt, type StegProps } from "./felt";

export function Bilen({ s, sett }: StegProps) {
  return (
    <section className="panel">
      <div className="head">
        <h2>Bilen</h2>
        <p>
          Brevet gjelder bilen {GRATIS ? "du valgte" : "du betalte for"}. Et brev for en annen bil krever {NYTT_KJOP}.
        </p>
      </div>
      <div className="block">
        <div className="grid">
          <div className="f c6">
            <label className="lb" htmlFor="c_reg">
              Registreringsnummer
            </label>
            <Skilt id="c_reg" verdi={s.c_reg} laast onEndre={() => {}} onBil={() => {}} />
          </div>
          <Felt s={s} sett={sett} k="c_make" label="Merke" klasse="c2" placeholder="Volkswagen" disabled />
          <Felt s={s} sett={sett} k="c_model" label="Modell" klasse="c2 m3" placeholder="ID.4" disabled />
          <Felt s={s} sett={sett} k="c_year" label="Årsmodell" klasse="c2 m3" placeholder="2022" mono disabled />
          <Felt s={s} sett={sett} k="c_km" label="Km-stand ved overtakelse" klasse="c3" fmt="num" inputMode="numeric" placeholder="38 500" suffiks="km" />
        </div>
      </div>
    </section>
  );
}

export function Kjopet({ s, sett }: StegProps) {
  const d = s.c_lastreg;
  const brukt = d && s.c_delivery === d && s.c_purchase === d;
  return (
    <section className="panel">
      <div className="head">
        <h2>Kjøpet</h2>
        <p>Hent opplysningene fra kjøpekontrakten. Overtakelsesdatoen er utgangspunktet for alle fristene.</p>
      </div>
      <div className="block">
        <div className="grid">
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
