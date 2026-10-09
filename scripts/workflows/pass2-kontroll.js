export const meta = {
  name: 'pass2-kontroll',
  description: 'Pass 2: Opus-agenter kontrollerer uttrekket mot fulltekst og skriver dom med sitat per uenighet',
  phases: [{ title: 'Kontroll', detail: 'én agent per bolk', model: 'opus' }],
}

// args: { ider: number[], bolk: number, versjon: string, kontrollMappe?: string, uavhengig?: boolean }
// uavhengig = the second control used for calibration: its own folder and an explicit brief to look for errors.
const ider = args.ider
const bolk = args.bolk || 5
const versjon = args.versjon
const kontrollMappe = args.kontrollMappe || 'data/pass2/kontroll'
const uavhengig = !!args.uavhengig

const bolker = []
for (let i = 0; i < ider.length; i += bolk) bolker.push(ider.slice(i, i + bolk))

const FORMAT = `{
  "vedtak_id": 123,
  "feil": [
    { "feil_id": "f1",
      "vurdering":     { "riktig": true,  "riktig_verdi": null, "sitat": null },
      "grunnlag":      { "riktig": true,  "riktig_verdi": null, "sitat": null },
      "bevisgrunnlag": { "riktig": false, "riktig_verdi": "uomtvistet", "sitat": "ordrett fra vedtaket" },
      "spor":          { "riktig": true,  "riktig_verdi": null, "sitat": null },
      "spor_vunnet":   { "riktig": true,  "riktig_verdi": null, "sitat": null },
      "formodning":    { "riktig": true,  "riktig_verdi": null, "sitat": null },
      "viste_seg":     { "riktig": true,  "riktig_verdi": null, "sitat": null } }
  ],
  "manglende_feil": [ { "beskrivelse": "feil klageren påberopte som mangler i svaret", "sitat": "ordrett" } ],
  "overflodige_feil": [ "f3" ],
  "opplysninger": { "riktige": 2, "feil": 1, "merknader": [ { "hva": "kort", "sitat": "ordrett" } ] },
  "bevis": { "riktige": 3, "feil": 0, "merknader": [] }
}`

const vinkel = uavhengig
  ? 'Gå ut fra at uttrekket inneholder feil, og let aktivt etter dem, særlig i vurdering per feil, grunnlag mot bevisgrunnlag, og hva bevisene selv sier mot hva utvalget konkluderte. Men merk bare det du kan belegge med sitat.'
  : 'Vær streng og konkret.'

const prompt = (b) => `Du kontrollerer et automatisk uttrekk fra vedtak fra Forbrukerklageutvalget (Tvistr, pass 2). ${vinkel}

For hvert vedtak (id-er: ${b.join(', ')}), ett om gangen:
1. Les src/lib/analyse/instruks.md (reglene uttrekket skulle følge) og docs/spor.md (spordefinisjonen).
2. Les fulltekst: data/pass2/inn/<id>.txt. Les uttrekket: data/pass2/ut/<id>.${versjon}.json. Les avledede spor per feil: data/pass2/avledet/<id>.${versjon}.json (feltene spor og sporVunnet).
3. Vurder hver feil i uttrekket: er vurdering, grunnlag, bevisgrunnlag, formodning og viste_seg riktige etter instruksen? Er spor og spor_vunnet riktige etter docs/spor.md, gitt hva vedtaket faktisk sier?
4. For HVER uenighet: sett riktig=false, oppgi riktig_verdi, og sitér ordrett fra fulltekst det som viser det. Uten sitat: ikke uenig.
5. Tell opp opplysninger[] og bevis[] som er riktige eller feil, med merknad og sitat for hver feil.
6. Skriv dommen som JSON til ${kontrollMappe}/<id>.${versjon}.json i dette formatet, før du går videre til neste vedtak:
${FORMAT}

Les ikke docs/vedtakssammenligning-datasjekk.md og ingen andre filer under data/pass2/ enn de som er nevnt. Les særlig ikke andre kontrollmapper. Ikke bruk databasen eller nettet.
Returner listen over id-er du skrev.`

const SVAR = { type: 'object', properties: { skrevet: { type: 'array', items: { type: 'integer' } } }, required: ['skrevet'] }
const resultater = await parallel(
  bolker.map((b, i) => () => agent(prompt(b), { label: `kontroll ${i + 1}: ${b.join(',')}`, phase: 'Kontroll', schema: SVAR, model: 'opus' })),
)
const skrevet = resultater.filter(Boolean).flatMap((r) => r.skrevet)
const mistet = bolker.filter((_, i) => !resultater[i]).flat()
if (mistet.length) log(`Bolker som feilet, ${mistet.length} vedtak: ${mistet.join(',')}`)
return { skrevet, mistet }
