/**
 * REGRESIÓN DE TEXTO DEL PIPELINE — sin gastar un solo audio.
 *
 * Pasa el `canonical_text` de un manifiesto por el pipeline completo y comprueba
 * la propiedad que importa: **un texto que ya es correcto tiene que salir
 * intacto**. Si el pipeline le cambia algo a una frase perfecta, ese cambio es
 * un daño, no una mejora.
 *
 * Es la comprobación anti-sobreajuste. El corpus de 498 audios es con el que se
 * midió y calibró; el de 7 000 (V3) el pipeline **no lo ha visto nunca**. Correr
 * los dos y comparar la tasa de intactos dice si el pipeline aprendió una regla
 * o se aprendió el examen.
 *
 * Uso:
 *   npx tsx scripts/asr-regresion-texto.ts <ruta al MANIFEST.jsonl> [muestra]
 */
import { readFileSync } from 'node:fs'
import { procesarTranscript } from '../src/lib/asr/pipeline'
import { terminoPresente, evaluable } from '../src/lib/uci/benchmark-metricas'

interface Fila {
  phrase_id: string
  category: string
  canonical_text: string
  key_terms: string
}

const ruta = process.argv[2]
if (!ruta) { console.error('Falta la ruta del manifiesto.'); process.exit(1) }
const limite = Number(process.argv[3] || '0')

const filas: Fila[] = readFileSync(ruta, 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l) as Fila)

// Una frase por texto: el manifiesto repite la misma con varias voces.
const porTexto = new Map<string, Fila>()
for (const f of filas) if (!porTexto.has(f.canonical_text)) porTexto.set(f.canonical_text, f)
let unicas = [...porTexto.values()]
if (limite > 0) unicas = unicas.slice(0, limite)

let intactos = 0
const cambiados: { id: string; cat: string; antes: string; despues: string }[] = []
const perdidos: { id: string; termino: string; texto: string }[] = []
const preguntas: { id: string; motivos: string[]; texto: string }[] = []

for (const f of unicas) {
  const r = procesarTranscript(f.canonical_text)
  if (r.texto === f.canonical_text) intactos++
  else cambiados.push({ id: f.phrase_id, cat: f.category, antes: f.canonical_text, despues: r.texto })

  /**
   * Ningún término clave puede desaparecer.
   *
   * Se comprueba con `terminoPresente`, el mismo comparador calibrado del
   * benchmark, no con un `includes`: los `key_terms` del manifiesto están en su
   * forma ESCRITA («FiO2», «I:E», «VT») y el `canonical_text` en la HABLADA
   * («fracción inspirada de oxígeno»). Con `includes` se contaban como perdidos
   * términos que el pipeline nunca tocó — un fallo del medidor, no del medido.
   *
   * Y sólo se exige el término si su propio texto canónico lo satisface:
   * lo que el comparador no sabe expresar es un hueco MÍO.
   */
  for (const t of (f.key_terms || '').split('|').filter(Boolean)) {
    if (!evaluable(t, f.canonical_text)) continue
    if (!terminoPresente(t, r.texto).ok) perdidos.push({ id: f.phrase_id, termino: t, texto: r.texto })
  }
  if (r.requiereConfirmacion) preguntas.push({ id: f.phrase_id, motivos: r.motivos, texto: f.canonical_text })
}

const pct = (n: number) => `${((n / unicas.length) * 100).toFixed(2)} %`

console.log(`\n  ${ruta}`)
console.log(`  ${unicas.length} frases únicas (de ${filas.length} audios)\n`)
console.log(`  intactas .................. ${intactos}  (${pct(intactos)})`)
console.log(`  modificadas ............... ${cambiados.length}  (${pct(cambiados.length)})`)
console.log(`  con un término clave perdido  ${perdidos.length}`)
console.log(`  que piden confirmación .... ${preguntas.length}  (${pct(preguntas.length)})\n`)

if (perdidos.length > 0) {
  console.log('  ── TÉRMINOS CLAVE PERDIDOS (esto sí es un fallo) ──')
  const porTermino = new Map<string, number>()
  for (const p of perdidos) porTermino.set(p.termino, (porTermino.get(p.termino) ?? 0) + 1)
  for (const [t, n] of [...porTermino].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(4)}  «${t}»`)
  }
  console.log()
  for (const p of perdidos.slice(0, 25)) console.log(`   ${p.id}  «${p.termino}»\n      ${p.texto}`)
  if (perdidos.length > 25) console.log(`   … y ${perdidos.length - 25} más`)
  console.log()
}

if (cambiados.length > 0) {
  console.log('  ── MODIFICADAS (revisar una por una) ──')
  const porCat = new Map<string, number>()
  for (const c of cambiados) porCat.set(c.cat, (porCat.get(c.cat) ?? 0) + 1)
  for (const [c, n] of [...porCat].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`   ${String(n).padStart(4)}  ${c}`)
  }
  console.log()
  for (const c of cambiados.slice(0, 20)) console.log(`   ${c.id}\n      − ${c.antes}\n      + ${c.despues}`)
  if (cambiados.length > 20) console.log(`   … y ${cambiados.length - 20} más`)
  console.log()
}

if (preguntas.length > 0) {
  console.log('  ── PIDEN CONFIRMACIÓN ──')
  const porMotivo = new Map<string, number>()
  for (const p of preguntas) for (const m of p.motivos) porMotivo.set(m, (porMotivo.get(m) ?? 0) + 1)
  for (const [m, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${m}`)
  console.log()
  for (const p of preguntas.slice(0, 15)) console.log(`   ${p.id}  ${p.motivos.join(', ')}\n      ${p.texto}`)
  console.log()
}

process.exit(perdidos.length > 0 ? 1 : 0)
