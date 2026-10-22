export const meta = {
  name: 'uttrekk',
  description: 'Agenter leser vedtak i inn-mappen til en oppgave (feilvurdering, avgjorende, standpunkt, rettslig) og skriver ett JSON-svar per vedtak',
  phases: [{ title: 'Uttrekk', detail: 'én agent per bolk' }],
}

// args: { oppgave: string, ider?: number[], omrader?: [fra, til][], bolk?: number, versjon?: string, modell?: string }
// The ids come from the task's hent script (npm run <oppgave>:hent); `omrader` is the same list
// written as inclusive ranges when it is long. Import with npm run feilvurdering:importer or
// avgjorende:importer afterwards (the latter also reads standpunkt and rettslig); a missing answer
// is picked up by --mangler next time. Without `modell` the agents run on the task's model, or the
// session's model when it has none: the avgjorende pilot showed Opus makes far fewer serious
// errors than Sonnet there (1 against 7 of 49).
const OPPGAVER = {
  feilvurdering: {
    mappe: 'data/feilvurdering',
    instruks: 'src/lib/feilvurdering/instruks.md',
    rolle: 'Du henter ut fakta fra vedtak fra Forbrukerklageutvalget for Tvistr.',
    versjonert: true,
    modell: 'sonnet',
    bolk: 10,
  },
  avgjorende: {
    mappe: 'data/avgjorende',
    instruks: 'src/lib/avgjorende/instruks.md',
    rolle: 'Du henter ut hva som avgjorde vedtak fra Forbrukerklageutvalget for Tvistr.',
    versjonert: true,
    bolk: 10,
  },
  // Ids from data/avgjorende/standpunkt/liste.json (npm run standpunkt:hent).
  standpunkt: {
    mappe: 'data/avgjorende/standpunkt',
    instruks: 'src/lib/avgjorende/standpunkt.md',
    rolle: 'Du vurderer sitater fra vedtak fra Forbrukerklageutvalget for Tvistr.',
    bolk: 25,
  },
  // Ids from data/avgjorende/rettslig/<pilot|alle>.json (npm run rettslig:hent).
  rettslig: {
    mappe: 'data/avgjorende/rettslig',
    instruks: 'src/lib/avgjorende/rettslig.md',
    rolle: 'Du vurderer rettslige sitater fra vedtak fra Forbrukerklageutvalget for Tvistr.',
    bolk: 10,
  },
}

const o = OPPGAVER[args.oppgave]
if (!o) throw new Error(`oppgave må være en av ${Object.keys(OPPGAVER).join(', ')}`)
if (o.versjonert && !args.versjon) throw new Error('versjon mangler')
const ider = args.ider || args.omrader.flatMap(([fra, til]) => Array.from({ length: til - fra + 1 }, (_, i) => fra + i))
const bolk = args.bolk || o.bolk
const modell = args.modell || o.modell
const ut = o.versjonert ? `<id>.${args.versjon}.json` : '<id>.json'

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

const prompt = (b) => `${o.rolle}

1. Les instruksen i ${o.instruks} nøye.${o.versjonert ? ' Den bestemmer alle felt, alle tillatte verdier og sitatregelen.' : ''}
2. Behandle disse vedtakene ETT OM GANGEN, i denne rekkefølgen: ${b.join(', ')}.
   For hvert vedtak: les ${o.mappe}/inn/<id>.txt og skriv svaret som gyldig JSON til ${o.mappe}/ut/${ut} med Write-verktøyet. Skriv fila ferdig FØR du leser neste inn-fil.
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
