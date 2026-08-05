/**
 * ¿El detector de «separación fallida» acierta sobre el corpus actuado?
 *
 * Corre sobre las transcripciones ya pagadas (`salida/DIARIZACION`), así que no
 * cuesta nada repetirlo. Lo que se comprueba es lo único que importa aquí:
 *
 *   · marca los diálogos en los que el proveedor devolvió UNA sola voz teniendo
 *     dos personas hablando;
 *   · y NO marca ninguno de los que sí se separaron.
 *
 * Un falso positivo aquí deja un rol sin asignar (barato); un falso negativo
 * archiva lo que dijo el paciente como dicho por el médico (caro).
 *
 * Uso:  npx tsx scripts/medir-separacion.ts
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { diagnosticarSeparacion } from '../src/lib/asr/separacion-fallida'

const DIR = 'synthetic-data/dialogos-consulta/salida/DIARIZACION'
if (!existsSync(DIR)) { console.error(`No encuentro ${DIR}`); process.exit(1) }

let marcados = 0, unaVoz = 0
for (const f of readdirSync(DIR).filter(x => x.endsWith('.json')).sort()) {
  const u = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { speaker?: string; text?: string }[]
  const hablantes = Array.from(new Set(u.map(x => String(x.speaker ?? '?'))))
  const d = diagnosticarSeparacion({ hablantes, texto: u.map(x => x.text ?? '').join(' ') })
  if (hablantes.length === 1) unaVoz++
  if (d.veredicto === 'mezcla_sin_separar') marcados++
  const s = d.senales
  console.log(
    `  ${f.replace('.json', '')}  ${hablantes.length} voz(ces)  ${d.veredicto}` +
    (s ? `  ·  preguntas ${s.preguntasDirigidas} / 1ª persona ${s.respuestasPropias} / 3ª persona ${s.relatoEnTercera}` : ''),
  )
}
console.log(`\n  diálogos con UNA sola voz: ${unaVoz}`)
console.log(`  marcados como mezcla sin separar: ${marcados}\n`)
