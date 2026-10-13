export const meta = {
  name: 'stikkprove',
  description: 'Ferdigkriterium 1: to dommere svarer per felt i malen mot fulltekst; en tredje avgjør uenighet',
  phases: [{ title: 'Dommere' }, { title: 'Avgjørelse' }],
}

// args: { ider: number[], mappe?: string }. Criterion 1: ids from data/ferdig/stikkprove/liste.json
// (npm run ferdig:stikkprove -- --trekk). Criterion 3: mappe data/ferdig/simulert, one file per
// paragraph. Returns per file every field with the final verdict; count with --tell.
const mappe = args.mappe || 'data/ferdig/stikkprove'
const bolker = []
for (let i = 0; i < args.ider.length; i += 10) bolker.push(args.ider.slice(i, i + 10))

const DOM = {
  type: 'object',
  properties: {
    vedtak: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          vedtak_id: { type: 'integer' },
          felt: {
            type: 'array',
            items: {
              type: 'object',
              properties: { nokkel: { type: 'string' }, stemmer: { type: 'boolean' }, hva: { type: 'string' } },
              required: ['nokkel', 'stemmer', 'hva'],
            },
          },
        },
        required: ['vedtak_id', 'felt'],
      },
    },
  },
  required: ['vedtak'],
}
const AVGJORELSE = { type: 'object', properties: { stemmer: { type: 'boolean' }, begrunnelse: { type: 'string' } }, required: ['stemmer', 'begrunnelse'] }

const FELTENE = `- utvalg: utvalgets navn slik vedtaket bruker det (nynorsk «Forbrukarklageutvalet» er det samme som «Forbrukerklageutvalget»)
- bil: bilen slik verdien beskriver den, er det bilen saken gjaldt
- forbehold: «solgt «som den er»» stemmer når bilen var solgt «som den er» eller med lignende generelt forbehold; «ikke oppgitt» stemmer når vedtaket ikke sier at den var det
- komponent: en feil utvalget godtok som mangel
- vurdert_for_seg: true stemmer bare når utvalgets vurdering nevner feilen og fant at den alene var en mangel; false stemmer når den bare inngikk i en samlet vurdering eller ikke er nevnt i vurderingen
- sanksjon: det utvalget ga for denne feilen alene; tom liste stemmer når utvalget bare ga noe for feilene samlet
- sitat: står ordrett i <utvalgets_vurdering>, er utvalgets eget standpunkt, og handler om feilen eller det rettslige poenget nøkkelen viser
- saksnummer og dato: slik vedtaket oppgir dem
- km: kilometerstand ved kjøpet
- sammenligning: vedtakets tall (alder ved kjøpet, km) i setningen er riktige`

const dom = (b) => `Du kontrollerer data et klagebrev bygges av, mot vedtakene fra Forbrukerklageutvalget. For hvert av disse vedtakene: ${b.join(', ')}
- les ${mappe}/<id>.json: feltet \`sjekk\` er en liste med nøkler, felt og verdien brevet ville skrevet
- les fullteksten fila viser til i \`fulltekst\` (delt i <saksfremstilling> og <utvalgets_vurdering>)
- svar for HVER nøkkel i \`sjekk\`, med nøyaktig samme nøkkel: stemmer verdien med fullteksten (true/false), og kort hva som ikke stemmer

Feltene:
${FELTENE}

Les ingen andre filer, ikke kjør kommandoer mot databasen, og les aldri data/raw/.`

const avgjor = (id, nokkel, a, b) => `To kontrollører er uenige om ett felt i data et klagebrev bygges av. Les ${mappe}/${id}.json (feltet \`sjekk\`, nøkkel «${nokkel}») og fullteksten fila viser til i \`fulltekst\`.

Feltene:
${FELTENE}

Kontrollør 1: ${a.stemmer ? 'stemmer' : 'stemmer ikke'}. ${a.hva}
Kontrollør 2: ${b.stemmer ? 'stemmer' : 'stemmer ikke'}. ${b.hva}

Avgjør mot fullteksten om verdien stemmer. Les aldri data/raw/.`

const res = await pipeline(
  bolker,
  (b, _, i) =>
    parallel([
      () => agent(dom(b), { label: `dommer opus ${i + 1}`, phase: 'Dommere', schema: DOM }),
      () => agent(dom(b), { label: `dommer sonnet ${i + 1}`, phase: 'Dommere', schema: DOM, model: 'sonnet' }),
    ]),
  async ([x, y], b) => {
    const svar = (r, id) => new Map((((r && r.vedtak) || []).find((v) => v.vedtak_id === id) || { felt: [] }).felt.map((f) => [f.nokkel, f]))
    const ut = []
    for (const id of b) {
      const a = svar(x, id)
      const c = svar(y, id)
      const nokler = [...new Set([...a.keys(), ...c.keys()])]
      const felt = await parallel(
        nokler.map((n) => async () => {
          const fa = a.get(n)
          const fc = c.get(n)
          const felt = n.includes('.') ? n.split('.')[1].replace(/\d+$/, '').replace(/^(?!komponent|vurdert_for_seg|sanksjon).*/, 'sitat') : n === 'som_den_er' ? 'forbehold' : n.replace(/\d+$/, '')
          if (fa && fc && fa.stemmer === fc.stemmer) return { nokkel: n, felt, stemmer: fa.stemmer }
          // One judge missing the field counts as a disagreement: the third agent decides.
          const d = await agent(avgjor(id, n, fa || { stemmer: true, hva: '(ikke vurdert)' }, fc || { stemmer: true, hva: '(ikke vurdert)' }), { label: `avgjør ${id} ${n}`, phase: 'Avgjørelse', schema: AVGJORELSE })
          return { nokkel: n, felt, stemmer: d ? d.stemmer : false, avgjort: true }
        }),
      )
      ut.push({ vedtak_id: id, felt: felt.filter(Boolean) })
    }
    return ut
  },
)
return res.filter(Boolean).flat()
