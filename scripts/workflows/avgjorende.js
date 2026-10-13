export const meta = {
  name: 'avgjorende',
  description: 'Hva som avgjorde: agenter leser vedtak i data/avgjorende/inn og skriver ett JSON-svar per vedtak',
  phases: [{ title: 'Uttrekk', detail: 'én agent per bolk' }],
}

// args: { ider?: number[], omrader?: [fra, til][], bolk: number, versjon: string, modell?: string }
// Without `modell` the agents run on the session's model; the pilot showed Opus makes far fewer
// serious errors than Sonnet here (1 against 7 of 49).
// Ids come from data/avgjorende/lister/<navn>.json (npm run avgjorende:hent); `omrader` is
// the same list written as inclusive ranges when it is long. Import with
// npm run avgjorende:importer afterwards; a missing answer is picked up by --mangler next time.
const ider = args.ider || args.omrader.flatMap(([fra, til]) => Array.from({ length: til - fra + 1 }, (_, i) => fra + i))
const bolk = args.bolk || 10
const versjon = args.versjon
const modell = args.modell
if (!versjon) throw new Error('versjon mangler')

const bolker = []
for (let i = 0; i < ider.length; i += bolk) bolker.push(ider.slice(i, i + bolk))
log(`${ider.length} vedtak i ${bolker.length} bolker à ${bolk}`)

const RESULTAT = {
  type: 'object',
  properties: {
    skrevet: { type: 'array', items: { type: 'integer' } },
    hoppet_over: {
      type: 'array',
      items: { type: 'object', properties: { vedtak_id: { type: 'integer' }, grunn: { type: 'string' } }, required: ['vedtak_id', 'grunn'] },
    },
  },
  required: ['skrevet', 'hoppet_over'],
}

const prompt = (b) => `Du henter ut hva som avgjorde vedtak fra Forbrukerklageutvalget for Tvistr.

1. Les instruksen i src/lib/avgjorende/instruks.md nøye. Den bestemmer alle felt, alle tillatte verdier og sitatregelen.
2. Behandle disse vedtakene ETT OM GANGEN, i denne rekkefølgen: ${b.join(', ')}.
   For hvert vedtak: les data/avgjorende/inn/<id>.txt og skriv svaret som gyldig JSON til data/avgjorende/ut/<id>.${versjon}.json med Write-verktøyet. Skriv fila ferdig FØR du leser neste inn-fil.
3. Les ingen andre filer enn instruksen og disse inn-filene. Ikke kjør kommandoer mot databasen, ikke bruk nettet, og les aldri data/raw/.
4. Når alle er skrevet: returner id-ene du skrev, og eventuelle du måtte hoppe over, med grunn.`

const resultater = await parallel(
  bolker.map((b, i) => () => agent(prompt(b), { label: `bolk ${i + 1}: ${b[0]}–${b[b.length - 1]}`, phase: 'Uttrekk', schema: RESULTAT, ...(modell ? { model: modell } : {}) })),
)
const skrevet = resultater.filter(Boolean).flatMap((r) => r.skrevet)
const hoppet = resultater.filter(Boolean).flatMap((r) => r.hoppet_over)
const mistet = bolker.filter((_, i) => !resultater[i]).flat()
if (hoppet.length) log(`Hoppet over: ${hoppet.map((h) => h.vedtak_id).join(',')}`)
if (mistet.length) log(`Bolker som feilet, ${mistet.length} vedtak: ${mistet.join(',')}`)
return { skrevet: skrevet.length, hoppet, mistet }
