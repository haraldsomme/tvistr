export const meta = {
  name: 'rettslig',
  description: 'Datavask for rettslige sitater: agenter svarer om hvert sitat uttrykker utvalgets standpunkt om poenget',
  phases: [{ title: 'Vurdering' }, { title: 'Dommer' }],
}

// args: { ider: number[], bolk?: number, dommer?: boolean } from data/avgjorende/rettslig/<pilot|alle>.json
// (npm run rettslig:hent). With dommer, each batch is checked against the assessment afterwards.
// Import with npm run avgjorende:importer.
const bolk = args.bolk || 10
const bolker = []
for (let i = 0; i < args.ider.length; i += bolk) bolker.push(args.ider.slice(i, i + bolk))

const RESULTAT = {
  type: 'object',
  properties: {
    skrevet: { type: 'array', items: { type: 'integer' } },
    hoppet_over: { type: 'array', items: { type: 'object', properties: { vedtak_id: { type: 'integer' }, grunn: { type: 'string' } }, required: ['vedtak_id', 'grunn'] } },
  },
  required: ['skrevet', 'hoppet_over'],
}
const DOM = {
  type: 'object',
  properties: {
    svar: {
      type: 'array',
      items: {
        type: 'object',
        properties: { vedtak_id: { type: 'integer' }, poeng: { type: 'string' }, riktig: { type: 'boolean' }, begrunnelse: { type: 'string' } },
        required: ['vedtak_id', 'poeng', 'riktig', 'begrunnelse'],
      },
    },
  },
  required: ['svar'],
}

const vurdering = (b) => `Du vurderer rettslige sitater fra vedtak fra Forbrukerklageutvalget for Tvistr.

1. Les instruksen i src/lib/avgjorende/rettslig.md nøye.
2. Behandle disse vedtakene ETT OM GANGEN, i denne rekkefølgen: ${b.join(', ')}.
   For hvert vedtak: les data/avgjorende/rettslig/inn/<id>.txt og skriv svaret som gyldig JSON til data/avgjorende/rettslig/ut/<id>.json med Write-verktøyet. Skriv fila ferdig FØR du leser neste inn-fil.
3. Les ingen andre filer enn instruksen og disse inn-filene. Ikke kjør kommandoer mot databasen, ikke bruk nettet, og les aldri data/raw/.
4. Når alle er skrevet: returner id-ene du skrev, og eventuelle du måtte hoppe over, med grunn.`

const dom = (b) => `Du kontrollerer en datavask for Tvistr. Agenter har svart om rettslige sitater fra vedtak uttrykker utvalgets standpunkt om akkurat poenget de er knyttet til.

1. Les instruksen agentene fikk: src/lib/avgjorende/rettslig.md.
2. For hvert av disse vedtakene: ${b.join(', ')}
   - les data/avgjorende/rettslig/inn/<id>.txt (sitatene med poengene, og utvalgets vurdering)
   - les svaret data/avgjorende/rettslig/ut/<id>.json
   - avgjør for hvert poeng om agentens ja/nei er riktig mot utvalgets vurdering
3. Les ingen andre filer, og les aldri data/raw/.
Svar med ett element per poeng: riktig = true når agentens svar er riktig.`

const res = await pipeline(
  bolker,
  (b, _, i) => agent(vurdering(b), { label: `vurdering ${i + 1}`, phase: 'Vurdering', schema: RESULTAT }),
  (_, b, i) => (args.dommer ? agent(dom(b), { label: `dommer ${i + 1}`, phase: 'Dommer', schema: DOM }) : null),
)
return { dommer: res.filter(Boolean).flatMap((r) => r.svar) }
