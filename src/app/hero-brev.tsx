import type { ReactNode } from "react";

// The example letter in the hero, written here (not drawn from the letter the app writes, src/lib/app/
// brev.ts). The buyer and the dealer are made up; the decision it refers to is real: 22/10322 of 1 June
// 2023, as it stands in the table `vedtak` (id 1869): a VW Golf 2017, bought in 2021 at 35 500 km, whose
// air-conditioning sensors failed; the committee found a manufacturing fault and granted a price
// reduction (checked against the table 2026-10-20). The censored parts (S) are words made of n's, drawn
// as grey bars and never read out. A numbered marker in the margin ties a section to its point beside
// the sheet (page.tsx); point 4, the decision, marks the paragraph «Praksis fra …» under «Rettslig
// grunnlag», as the letter now cites a decision under each fault. Amounts and distances do not break inside the number (&nbsp;). The component
// has no script: the sheet is part of the page when it is built.

const S = ({ children }: { children: string }) => (
  <span className="hb-sladd" aria-hidden="true">
    {children}
  </span>
);

const Nr = ({ n }: { n: number }) => (
  <span className="hb-nr" aria-label={`Punkt ${n}`}>
    {n}
  </span>
);

// One row of the sheet: its marker, if any, and the paragraph with the row's class.
const Rad = ({ nr, k, children }: { nr?: number; k?: string; children: ReactNode }) => (
  <div className="hb-rad">
    {nr && <Nr n={nr} />}
    <p className={k}>{children}</p>
  </div>
);

const Adresse = ({ l, klasse }: { l: string[]; klasse?: string }) => (
  <p className={`l-addr${klasse ? ` ${klasse}` : ""}`}>
    {l.map((x, i) => (
      <span key={i}>
        {i > 0 && <br />}
        {x}
      </span>
    ))}
  </p>
);

export function HeroBrev() {
  return (
    <div className="hb">
      <article className="letter hb-ark" aria-label="Eksempel på reklamasjonsbrev" style={{ whiteSpace: "pre-line" }}>
        <span className="hb-stempel">Forenklet eksempel</span>
        <div className="hb-rad">
          <Nr n={1} />
          <div className="l-adr2">
            <div className="l-adr2-in">
              <Adresse l={["Kari Nordmann", "Storgata 12", "0155 Oslo"]} />
              <Adresse l={["Bilhuset Vest AS", "Industriveien 4", "1337 Sandvika"]} klasse="l-adr-b" />
            </div>
          </div>
        </div>
        <Rad k="l-date">Oslo, 16. oktober 2026</Rad>
        <Rad k="l-subj">Reklamasjon på mangel ved Volkswagen Golf, reg.nr. AB 12345</Rad>
        <Rad>Jeg viser til mitt kjøp av brukt Volkswagen Golf, årsmodell 2022, reg.nr. AB 12345. Kjøpekontrakten ble inngått 20. juni 2026 til kr 259&nbsp;900, og jeg overtok bilen 24. juni 2026 med en kilometerstand på 39&nbsp;800 km. Bilen har en mangel, og jeg reklamerer med dette <S>nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn</S>.</Rad>
        <Rad nr={2} k="l-h">Mangelen</Rad>
        <Rad>Bilen har en feil som jeg reklamerer på.</Rad>
        <Rad>Den 30. september 2026 oppdaget jeg feil ved klimaanlegget (AC). Anlegget blåser bare varm luft, og frontruta dugger igjen når det er fuktig ute.</Rad>
        <Rad>Konsekvensen av feilen er at <S>nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn</S>.</Rad>
        <Rad>Verkstedet har funnet en defekt trykksensor i kjølekretsen, og anlegget kjøler derfor ikke. <S>nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn</S>.</Rad>
        <Rad nr={3} k="l-h">Rettslig grunnlag</Rad>
        <Rad>Etter forbrukerkjøpsloven § 15 skal bilen være i samsvar med avtalen og ha de egenskapene jeg med rette kunne forvente. Når den ikke er det, foreligger det en mangel, jf. § 16 første ledd bokstav a.</Rad>
        <Rad>
          <em>Mangelen forelå ved leveringen.</em> Feilen viste seg innen to år etter overtakelsen. Etter § 18 annet ledd skal en mangel som viser seg innen to år etter leveringen, formodes å ha eksistert ved leveringen, med mindre noe annet bevises. Det er derfor dere som må <S>nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn</S>.
        </Rad>
        <Rad>
          <em>Reklamasjonen er rettidig.</em> Jeg reklamerer med dette brevet, innen to måneder etter at jeg oppdaget feilen 30. september 2026, jf. § 27 første ledd.
        </Rad>
        <Rad nr={4}>
          <em>Praksis fra Forbrukerklageutvalget.</em> Det vises til Forbrukerklageutvalgets vedtak i sak 22/10322 av 1.6.2023. Saken gjaldt defekte sensorer i klimaanlegget på en Volkswagen Golf 2017 som hadde gått 35&nbsp;500 km ved kjøpet. Utvalget uttalte: «<S>nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn</S>» Kjøperen fikk medhold i krav om prisavslag. Saken gjaldt samme type feil som min, og min sak bør derfor vurderes på samme måte. <S>nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn</S>
        </Rad>
        <Rad nr={5} k="l-h">Krav</Rad>
        <Rad>Prinsipalt krever jeg retting av mangelen, jf. § 29 første ledd. Rettingen skal skje uten kostnad for meg, uten vesentlig ulempe og innen rimelig tid, jf. § 30 første ledd. Bilen stilles til rådighet for undersøkelse og utbedring etter nærmere avtale, jf. § 30 annet ledd. <S>nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn</S>.</Rad>
        <Rad>Dersom retting ikke skjer innen rimelig tid, eller ikke lykkes, krever jeg subsidiært <S>nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn</S>.</Rad>
        <Rad nr={6}>Jeg ber om en skriftlig tilbakemelding innen 30. oktober 2026 med forslag til hvordan dere vil løse saken. <S>nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn nnnnnn nnnnnn nnnnnn nnnnnn nn</S>.</Rad>
        <Rad k="l-sign">{"Med vennlig hilsen\nKari Nordmann"}</Rad>
        <Rad k="l-h">Vedlegg</Rad>
        <Rad>Kjøpekontrakt · Verkstedrapport · Overslag på utbedring · <S>nnnnnn nnnnnn nnnnnn nnnnnn nn</S></Rad>
      </article>
      <p className="hb-note">Eksempelbrevet er forenklet, og deler av det er sladdet. Du får hele brevet.</p>
    </div>
  );
}
