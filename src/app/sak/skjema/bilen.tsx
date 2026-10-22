// The car and the purchase, as blocks for a page to place under its own heading. Before payment the
// plate is looked up at Statens vegvesen and make, model and year can be typed; after payment (`laast`)
// the car is the one bought for, and only the mileage can be filled in.
import { useState } from "react";
import { type Bil, Skilt } from "@/app/deler/skilt";
import { fmtD } from "@/lib/app/dato";
import { regler } from "@/lib/app/lov";
import { Bryter, Felt, type StegProps } from "./felt";

export function Bilen({ s, sett, laast }: StegProps & { laast?: boolean }) {
  const funnet: Bil | null = s.c_lastreg && s.c_make ? { make: s.c_make, model: s.c_model, year: s.c_year, lastReg: s.c_lastreg } : null;
  // The handover date starts as the day the car was registered on its current owner, unless the buyer
  // gave another (one still equal to the last registration came from an earlier lookup).
  const onBil = (b: Bil) => sett({ c_make: b.make, c_model: b.model, c_year: b.year, c_lastreg: b.lastReg, c_delivery: s.c_delivery && s.c_delivery !== s.c_lastreg ? s.c_delivery : b.lastReg || s.c_delivery });
  return (
    <div className="block">
      <div className="grid">
        <div className="f c6">
          <label className="lb" htmlFor="c_reg">
            Registreringsnummer
          </label>
          <Skilt id="c_reg" verdi={s.c_reg} laast={laast} funnet={funnet} onEndre={(c_reg) => sett({ c_reg })} onBil={onBil} />
        </div>
        <Felt s={s} sett={sett} k="c_make" label="Merke" klasse="c2" placeholder="Volkswagen" disabled={laast} />
        <Felt s={s} sett={sett} k="c_model" label="Modell" klasse="c2 m3" placeholder="ID.4" disabled={laast} />
        <Felt s={s} sett={sett} k="c_year" label="Årsmodell" klasse="c2 m3" fmt="year" inputMode="numeric" placeholder="2022" mono disabled={laast} />
        <Felt s={s} sett={sett} k="c_km" label="Km-stand ved overtakelse" klasse="c3" fmt="num" inputMode="numeric" placeholder="38 500" suffiks="km" />
        {!laast && s.c_lastreg && s.c_delivery === s.c_lastreg && (
          <p className="hint c6" style={{ margin: 0 }}>
            Overtakelsesdatoen er fylt inn med datoen bilen sist ble registrert. Endre den hvis du fikk bilen en annen dag. Fristene regnes herfra.
          </p>
        )}
      </div>
    </div>
  );
}

// Without `medForbehold` the «som den er» switch is left out (the question flow asks it on its own).
// The handover date is asked; the purchase date only when the buyer says it was another day.
export function Kjopet({ s, sett, medForbehold }: StegProps & { medForbehold?: boolean }) {
  const [annenDag, settAnnenDag] = useState(() => !!s.c_purchase && s.c_purchase !== s.c_delivery);
  const d = s.c_lastreg;
  return (
    <>
      <div className="block">
        <div className="grid">
          <Felt s={s} sett={sett} k="c_delivery" label="Overtakelsesdato" klasse="c3" type="date" />
          <Felt s={s} sett={sett} k="c_price" label="Kjøpesum" klasse="c3" fmt="num" inputMode="numeric" placeholder="329 900" suffiks="kr" />
          {d && s.c_delivery !== d && (
            <div className="c6 sugg">
              <span>
                Bilen ble registrert på ny eier <b>{fmtD(d)}</b>. Var det da du overtok den?
              </span>
              <button type="button" className="btn sm" onClick={() => sett({ c_delivery: d })}>
                Bruk datoen
              </button>
            </div>
          )}
          {annenDag ? (
            <Felt s={s} sett={sett} k="c_purchase" label="Kjøpsdato" klasse="c3" type="date" hint="Datoen du skrev under kontrakten." />
          ) : (
            <p className="hint c6" style={{ margin: 0 }}>
              <button type="button" className="lnk" onClick={() => settAnnenDag(true)}>
                Kjøpte du bilen en annen dag enn du overtok den?
              </button>
            </p>
          )}
        </div>
      </div>
      {medForbehold && (
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
        </div>
      )}
    </>
  );
}
