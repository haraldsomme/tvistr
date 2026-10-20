import { describe, expect, it } from "vitest";
import { tilTekst } from "@/lib/app/brev";
import { avsnittA } from "@/lib/vedtaksvalg/mal";
import { DATO, EMNE, eksempelBlokker, eksempelPresedens, eksempelRader, fyll, IDAG, kilder, SEKSJONER, SLADD, synligTekst, VEDTAK_URL } from "./eksempelbrev";

// The landing page's sheet is drawn from the letter written for the example case: six sections, each one
// paragraph that is legible from the top and censored at the bottom, and every legible word the letter's.
const B = eksempelBlokker();
const brev = tilTekst(B);
const rader = eksempelRader(B);
const seksjoner = rader.filter((r) => r.rad === "seksjon");
const synlig = synligTekst(rader);
// The letter's text run together as the sections run it: no line breaks, no list dashes.
const lopende = (s: string) => s.replace(/^– /gm, "").replace(/\s+/g, " ");

describe("eksempelbrevet på forsiden", () => {
  it("dato og emne er brevets", () => {
    expect(brev).toContain(DATO);
    expect(brev).toContain(EMNE);
    expect(IDAG).toBe("2026-10-16");
  });
  it("hele brevet er med, i brevets rekkefølge", () => expect(kilder(rader).join("\n\n")).toBe(brev));
  it("seks seksjoner, nummerert 1–6, i brevets rekkefølge", () => expect(seksjoner.map((r) => r.merke)).toEqual([1, 2, 3, 4, 5, 6]));
  it("seksjonene begynner der punktene sier", () => {
    expect(seksjoner.map((r) => r.overskrift)).toEqual([null, "Mangelen", "Rettslig grunnlag", "Praksis fra Forbrukerklageutvalget", "Krav", null]);
    expect(seksjoner[0].tekst).toMatch(/^Jeg viser til mitt kjøp/);
    expect(seksjoner[5].tekst).toMatch(/^Jeg ber om en skriftlig tilbakemelding innen 30\. oktober 2026/);
  });
  it("punkt 1 står ved adressene, der opplysningene og datoene begynner", () => {
    const a = rader.find((r) => r.rad === "adresser");
    expect(a && "merke" in a && a.merke).toBe(1);
    expect(seksjoner[0].visMerke).toBe(false);
    expect(seksjoner.slice(1).every((r) => r.visMerke)).toBe(true);
  });
  it.each(SEKSJONER.map((s) => [s.merke, s] as const))("seksjon %s: lesbar fra toppen, sladdet nederst", (_m, s) => {
    const r = seksjoner.find((x) => x.merke === s.merke)!;
    expect(r.tekst.endsWith(s.til)).toBe(true);
    expect(r.skjult.kort).toBeGreaterThan(0);
    expect(r.skjult.kort).toBeLessThanOrEqual(SLADD.kort);
    expect(r.skjult.bred).toBeLessThanOrEqual(SLADD.bred);
  });
  it("alt som er lesbart står ordrett i brevet, bortsett fra setningene eksempelet utelater", () => {
    const utelatt = SEKSJONER.flatMap((s) => s.utelat ?? []);
    utelatt.forEach((u) => expect(brev).toContain(u));
    const uten = utelatt.reduce((t, u) => t.replace(` ${u}`, ""), lopende(brev));
    synlig.forEach((t) => expect(uten).toContain(lopende(t)));
  });
  it("mangelen: feilen, beskrivelsen og verkstedets funn, så sladd", () =>
    expect(seksjoner[1].tekst).toBe("Jeg har oppdaget følgende feil ved bilen: AC, oppdaget 30. september 2026. Klimaanlegget blåser bare varm luft, og frontruta dugger igjen når det er fuktig ute. Verkstedet har funnet en defekt trykksensor i kjølekretsen, og anlegget kjøler derfor ikke. Konsekvensen er at"));
  it("rettslig grunnlag: § 15, formodningen og starten på bevisbyrden", () =>
    expect(seksjoner[2].tekst).toBe("Etter forbrukerkjøpsloven § 15 skal bilen være i samsvar med avtalen og ha de egenskapene jeg med rette kunne forvente. Feilen viste seg tre måneder etter overtakelsen. Etter § 18 annet ledd skal en mangel som viser seg innen to år etter leveringen, formodes å ha eksistert ved leveringen, med mindre noe annet bevises. Det er dermed dere som må"));
  it("ingen plassholdere er synlige", () => expect(synlig.join("\n")).not.toMatch(/\[[^\]]+\]/));
  it("lesbar andel", () => {
    const tegn = (x: string) => x.replace(/\s/g, "").length;
    const andel = tegn(synlig.join("")) / tegn(brev);
    console.log(`Lesbar andel: ${Math.round(100 * andel)} %`);
    expect(andel).toBeLessThanOrEqual(0.7);
  });
  it("adressene står først, på én rad", () => expect(rader[0].rad).toBe("adresser"));
  it("kravet: prisavslaget og tilbudet om retting, så sladd", () =>
    expect(seksjoner[4].tekst).toBe("Mitt krav er et forholdsmessig prisavslag på kr 12 900, jf. § 31. Beløpet bygger på et overslag over utbedringskostnaden på kr 12 900. Jeg er kjent med at dere kan tilby å rette mangelen, jf. § 29 tredje ledd. Rettingen må i så fall skje uten kostnad, uten vesentlig ulempe for meg og innen rimelig tid, jf. § 30 første ledd. Skjer ikke det, fastholder jeg kravet om"));
  it("sladden er fylltekst, ikke brevets ord", () => {
    expect(fyll(20)).toMatch(/^[n ]+$/);
    expect(Math.abs(fyll(20).length - 20)).toBeLessThanOrEqual(3);
  });

  describe("vedtaket", () => {
    const p = eksempelPresedens();
    const t = seksjoner[3].tekst;
    it("henvisningen og bilen er lesbare; sitatene, utfallet, lenken og slutningen er sladdet", () => {
      expect(t).toContain("sak 22/10322 av 1.6.2023");
      expect(t).toContain("på en Volkswagen Golf 2017-modell som hadde gått 35 500 km ved kjøpet");
      expect(t.endsWith("Utvalget uttalte")).toBe(true);
      expect(t).not.toContain("Gumpens");
      expect(t).not.toContain("Etter utvalgets syn");
      expect(t).not.toContain("Kjøperen fikk medhold");
      expect(t).not.toContain(VEDTAK_URL);
      expect(p.kildeUrl).toBe(VEDTAK_URL);
      expect(VEDTAK_URL).toContain("journalpostid=2023030866");
    });
    it("avsnittet er malens: begge sitatene og utfallet", () => {
      const v = { utvalg: "Forbrukerklageutvalget", saksnummer: "22/10322", vedtaksdato: "2023-06-01", bil: "Volkswagen Golf 2017-modell", merke: "Volkswagen", modell: "Golf", arsmodell: 2017, km: 35500, alder: 4, somDenEr: false };
      const sitater = [p.avsnitt.match(/Utvalget uttalte: «([^»]+)»/)![1], p.avsnitt.match(/videre: «([^»]+)»/)![1]];
      expect(p.avsnitt).toBe(avsnittA(v, "sensorer klimaanlegg", sitater, ["prisavslag"], { km: 39800, alder: 4, somDenEr: false }));
      expect(brev).toContain(p.avsnitt.replace(/[\u00a0\u202f]/g, " "));
    });
    it("nivå A, og brevet krever det vedtaket ga, uten å sammenligne bilene", () => {
      expect(p.niva).toBe("A");
      expect(brev).toContain("Kjøperen fikk medhold i prisavslag, som er det jeg krever.");
      expect(brev).toContain("Bilen i min sak var ikke i et svakere utgangspunkt.");
    });
  });
});
