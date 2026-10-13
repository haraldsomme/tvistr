export const meta = {
  name: 'standpunkt',
  description: 'Feltpass for sitater: agenter vurderer om hvert sitat er utvalgets eget standpunkt',
  phases: [{ title: 'Vurdering', detail: 'én agent per bolk' }],
}

// args: { ider: number[], bolk?: number } from data/avgjorende/standpunkt/liste.json (npm run
// standpunkt:hent). Import with npm run avgjorende:importer afterwards.
const bolk = args.bolk || 25
const bolker = []
for (let i = 0; i < args.ider.length; i += bolk) bolker.push(args.ider.slice(i, i + bolk))
log(`${args.ider.length} vedtak i ${bolker.length} bolker à ${bolk}`)

const RESULTAT = {
  type: 'object',
  properties: {
    skrevet: { type: 'array', items: { type: 'integer' } },
    hoppet_over: { type: 'array', items: { type: 'object', properties: { vedtak_id: { type: 'integer' }, grunn: { type: 'string' } }, required: ['vedtak_id', 'grunn'] } },
  },
  required: ['skrevet', 'hoppet_over'],
}

const prompt = (b) => `Du vurderer sitater fra vedtak fra Forbrukerklageutvalget for Tvistr.

1. Les instruksen i src/lib/avgjorende/standpunkt.md nøye.
2. Behandle disse vedtakene ETT OM GANGEN, i denne rekkefølgen: ${b.join(', ')}.
   For hvert vedtak: les data/avgjorende/standpunkt/inn/<id>.txt og skriv svaret som gyldig JSON til data/avgjorende/standpunkt/ut/<id>.json med Write-verktøyet. Skriv fila ferdig FØR du leser neste inn-fil.
3. Les ingen andre filer enn instruksen og disse inn-filene. Ikke kjør kommandoer mot databasen, ikke bruk nettet, og les aldri data/raw/.
4. Når alle er skrevet: returner id-ene du skrev, og eventuelle du måtte hoppe over, med grunn.`

const resultater = await parallel(bolker.map((b, i) => () => agent(prompt(b), { label: `bolk ${i + 1}: ${b[0]}–${b[b.length - 1]}`, phase: 'Vurdering', schema: RESULTAT })))
const skrevet = resultater.filter(Boolean).flatMap((r) => r.skrevet)
const mistet = bolker.filter((_, i) => !resultater[i]).flat()
if (mistet.length) log(`Bolker som feilet, ${mistet.length} vedtak: ${mistet.join(',')}`)
return { skrevet: skrevet.length, hoppet: resultater.filter(Boolean).flatMap((r) => r.hoppet_over), mistet }
