// The car and the purchase, as blocks for a page to place under its own heading. Before payment the
// plate is looked up at Statens vegvesen and make, model and year can be typed; after payment (`laast`)
// the car is the one bought for, and only the mileage can be filled in.
import { type Bil, Skilt } from "@/app/deler/skilt";
import { regler } from "@/lib/app/lov";
import { Bryter, Felt, type StegProps } from "./felt";

export function Bilen({ s, sett, laast }: StegProps & { laast?: boolean }) {
  const funnet: Bil | null = s.c_lastreg && s.c_make ? { make: s.c_make, model: s.c_model, year: s.c_year, lastReg: s.c_lastreg } : null;
  // The purchase date starts as the day the car was registered on its current owner, unless the buyer
  // gave another (one still equal to the last registration came from an earlier lookup).
  const onBil = (b: Bil) => {
    const dato = s.c_delivery && s.c_delivery !== s.c_lastreg ? s.c_delivery : b.lastReg || s.c_delivery;
    sett({ c_make: b.make, c_model: b.model, c_year: b.year, c_lastreg: b.lastReg, c_delivery: dato, c_purchase: dato });
  };
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
      </div>
    </div>
  );
}

// Without `medForbehold` the «som den er» switch is left out (the question flow asks it on its own).
// One date: the buyer is taken to have bought and taken over the car the same day, so the field sets both.
export function Kjopet({ s, sett, medForbehold }: StegProps & { medForbehold?: boolean }) {
  const fraVegvesen = !!s.c_lastreg && s.c_delivery === s.c_lastreg;
  return (
    <>
      <div className="block">
        <div className="grid">
          <Felt
            s={s}
            sett={(d) => sett({ ...d, c_purchase: d.c_delivery })}
            k="c_delivery"
            label="Kjøpsdato"
            klasse="c3"
            type="date"
            hint={fraVegvesen ? "Fylt inn med datoen bilen ble registrert på deg hos Statens vegvesen. Endre den hvis du kjøpte bilen en annen dag." : undefined}
          />
          <Felt s={s} sett={sett} k="c_price" label="Kjøpesum" klasse="c3" fmt="num" inputMode="numeric" placeholder="329 900" suffiks="kr" />
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
