import { describe, expect, it } from "vitest";
import { planlegg, type Brevplan } from "./brevplan";
import { kontroller } from "./kontroll";
import type { Setning, Utkast } from "./typer";
import { avsender, feilen, modell, svar } from "./testdata";

// One sentence per argument, with the marks the plan requires, and every placeholder: a letter that
// passes every rule.
function godt(plan: Brevplan): Utkast {
  const tekst = (id: string) =>
    id === "henvisning" ? "henvisning {{henvisning}}." : id === "svarfrist" ? "svarfrist {{dato:svarfrist}}." : id === "kontonummer" ? "kontonummer {{kontonummer}}." : `${id}.`;
  return {
    sitater: [],
    avsnitt: [{ setninger: [...plan.argumenter.map((a) => ({ tekst: tekst(a.id), argumenter: [a.id] })), ...plan.mangler.map((x) => ({ tekst: `[MANGLER: ${x.tekst}]`, argumenter: [] }))] }],
  };
}
const med = (u: Utkast, ...ekstra: Setning[]): Utkast => ({ ...u, avsnitt: [...u.avsnitt, { setninger: ekstra }] });
const regler = (u: Utkast, p: Brevplan, m: ReturnType<typeof modell>) => kontroller(u, p, m).map((a) => a.regel);

describe("kontroller", () => {
  const m = modell({ utfylling: { feilen, avsender } });
  const p = planlegg(m);

  it("godtar et brev som følger planen", () => {
    expect(kontroller(godt(p), p, m)).toEqual([]);
  });

  it("finner et argument som mangler, et forbudt og et ukjent", () => {
    const u = godt(p);
    u.avsnitt[0].setninger = u.avsnitt[0].setninger.filter((s) => !s.argumenter.includes("formodning"));
    expect(regler(u, p, m)).toContain("dekning");
    expect(regler(med(godt(p), { tekst: "Jeg hever kjøpet.", argumenter: ["krav_heving"] }), p, m)).toContain("forbudt");
    expect(regler(med(godt(p), { tekst: "Mangelen er vesentlig.", argumenter: ["vesentlig"] }), p, m)).toContain("ukjent_argument");
  });

  it("godtar beløp og datoer fra saken, også skrevet på andre måter", () => {
    for (const tekst of ["Kjøpesummen var kr 250 000,-.", "Jeg betalte 250.000 kr.", "Jeg kjøpte bilen 12. mars 2026.", "Kjøpt 12.03.2026."]) {
      expect(regler(med(godt(p), { tekst, argumenter: [] }), p, m)).toEqual([]);
    }
  });

  it("finner beløp og datoer som ikke står i saken", () => {
    expect(regler(med(godt(p), { tekst: "Reparasjonen koster 300 000 kr.", argumenter: [] }), p, m)).toContain("tall");
    expect(regler(med(godt(p), { tekst: "Jeg kjøpte bilen 13. mars 2026.", argumenter: [] }), p, m)).toContain("dato");
  });

  it("sjekker at sitater står ordrett i kilden og brukes én gang", () => {
    const mk = modell({ utfylling: { feilen }, kilder: { rapport: "Reimen er sterkt slitt og har hoppet over to tenner." } });
    const pk = planlegg(mk);
    const ok: Utkast = { ...med(godt(pk), { tekst: "Rapporten sier {{sitat:r1}}.", argumenter: [] }), sitater: [{ id: "r1", kilde: "rapport", tekst: "Reimen er  sterkt slitt" }] };
    expect(kontroller(ok, pk, mk)).toEqual([]);
    expect(regler({ ...ok, sitater: [{ id: "r1", kilde: "rapport", tekst: "Reimen er helt ødelagt" }] }, pk, mk)).toContain("sitat");
    expect(regler({ ...ok, sitater: [{ id: "r1", kilde: "opplysning", tekst: "Reimen er sterkt slitt" }] }, pk, mk)).toContain("sitat");
    expect(regler(med(ok, { tekst: "Igjen: {{sitat:r1}}.", argumenter: [] }), pk, mk)).toContain("sitat");
  });

  it("finner anførselstegn utenfor sitatmerker, men godtar «som den er»", () => {
    expect(regler(med(godt(p), { tekst: "Selgeren sa «aldri hatt problemer».", argumenter: [] }), p, m)).toContain("anforselstegn");
    expect(regler(med(godt(p), { tekst: "Bilen ble solgt «som den er».", argumenter: [] }), p, m)).toEqual([]);
  });

  it("finner setninger som gjentar hverandre", () => {
    const s = { tekst: "Motorlampen lyser og bilen mister kraft i motbakker hver dag.", argumenter: [] };
    expect(regler(med(godt(p), s, { ...s }), p, m)).toContain("gjentakelse");
  });

  it("hakeparenteser: bare plassholderne i planen, og alle må stå", () => {
    expect(regler(med(godt(p), { tekst: "Kjøpt for [kjøpesum].", argumenter: [] }), p, m)).toContain("hakeparentes");
    const mm = modell({ svar: svar({ kjopesum: "" }), utfylling: { feilen } });
    const pm = planlegg(mm);
    expect(kontroller(godt(pm), pm, mm)).toEqual([]);
    const uten = godt(pm);
    uten.avsnitt[0].setninger = uten.avsnitt[0].setninger.filter((s) => !s.tekst.startsWith("[MANGLER"));
    expect(regler(uten, pm, mm)).toContain("hakeparentes");
  });

  it("finner relative tidsuttrykk, men ikke i gjengitt tale", () => {
    expect(regler(med(godt(p), { tekst: "Brevet gjelder fra i dag.", argumenter: [] }), p, m)).toContain("relativ_tid");
    expect(regler(med(godt(p), { tekst: "Renten løper fra 30 dager etter, hvis det sendes nå.", argumenter: [] }), p, m)).toContain("relativ_tid");
    expect(regler(med(godt(p), { tekst: "Selgeren sa at motoren nettopp var overhalt.", argumenter: [] }), p, m)).toEqual([]);
  });

  it("finner merker brevet ikke kan bruke, og merker som mangler", () => {
    expect(regler(med(godt(p), { tekst: "Se {{fakturanummer}}.", argumenter: [] }), p, m)).toContain("merke");
    const u = godt(p);
    u.avsnitt[0].setninger = u.avsnitt[0].setninger.map((s) => ({ ...s, tekst: s.tekst.replace("{{dato:svarfrist}}", "snart") }));
    expect(regler(u, p, m)).toContain("merke");
  });

  it("finner kjøperens navn i teksten", () => {
    expect(regler(med(godt(p), { tekst: "Hilsen Test Testesen.", argumenter: [] }), p, m)).toContain("personopplysning");
  });

  it("tar ikke vanlige ord for kjøperens navn", () => {
    const mp = modell({ utfylling: { feilen, avsender: { ...avsender, navn: "Per Dagsen" } } });
    const pp = planlegg(mp);
    expect(regler(med(godt(pp), { tekst: "Jeg betaler 500 kr per dag for leiebil.", argumenter: [] }), pp, mp)).not.toContain("personopplysning");
    expect(regler(med(godt(pp), { tekst: "Hilsen Per Dagsen.", argumenter: [] }), pp, mp)).toContain("personopplysning");
  });

  it("finner relative tidsuttrykk med tall i ord og år", () => {
    for (const tekst of ["Feilen viste seg for to uker siden.", "Bilen ble kjøpt i fjor.", "Feilen kom i år."]) {
      expect(regler(med(godt(p), { tekst, argumenter: [] }), p, m)).toContain("relativ_tid");
    }
  });

  it("godtar bare paragrafer og lover som står i planen", () => {
    expect(regler(med(godt(p), { tekst: "Bilen har en mangel, jf. § 16.", argumenter: [] }), p, m)).toEqual([]);
    expect(regler(med(godt(p), { tekst: "Jeg viser til § 34.", argumenter: [] }), p, m)).toContain("paragraf");
    expect(regler(med(godt(p), { tekst: "Det følger av kjøpsloven § 16.", argumenter: [] }), p, m)).toContain("paragraf");
  });

  it("finner argumenter i feil rekkefølge", () => {
    const u = godt(p);
    u.avsnitt[0].setninger = [...u.avsnitt[0].setninger].reverse();
    expect(regler(u, p, m)).toContain("rekkefolge");
  });

  it("finner brev som er for lange", () => {
    expect(regler(med(godt(p), { tekst: `${"ord ".repeat(700)}.`, argumenter: [] }), p, m)).toContain("lengde");
  });
});
