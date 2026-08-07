/**
 * LAS CIFRAS DE LA SALA DE DATOS SE DERIVAN, NO SE TECLEAN.
 *
 * ── POR QUÉ EXISTE (6-ago-2026, REG-202) ─────────────────────────────────────
 *
 * `docs/data-room/INDICE.md` cita números del repositorio: archivos sellados,
 * casos, regresiones documentadas. La primera versión los llevaba escritos a
 * mano y pasaron dos cosas **en la misma sesión**:
 *
 * 1. Escribí «49 REG» cuando eran 48 — una cifra inflada, sin querer, en el
 *    documento cuya primera línea dice «nada de tracción falsa».
 * 2. Al añadir dos archivos de prueba, el sello pasó de 225 a 227 archivos y el
 *    documento quedó **desfasado en el acto**.
 *
 * La segunda es la que importa: no fue un descuido, es estructural. **Un
 * documento con cifras tecleadas miente el día que el repositorio crece**, y en
 * una sala de datos ese desfase se lee como falta de rigor — o peor, se
 * descubre en diligencia debida.
 *
 * Por eso las cifras se regeneran desde la fuente. Correr esto es parte de
 * cerrar una iteración, igual que subir el service worker.
 *
 * Uso:  node scripts/data-room/actualizar-cifras.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const INDICE = 'docs/data-room/INDICE.md'

const sello = JSON.parse(readFileSync('src/lib/clinical/invariantes-clinicos.json', 'utf8'))
const ledger = readFileSync('docs/audit/regression-ledger.md', 'utf8')
const peligros = readFileSync('docs/clinical-safety/REGISTRO-DE-PELIGROS.md', 'utf8')

const cifras = {
  archivos: sello.archivos.length,
  casos: sello.totalCasos,
  regs: (ledger.match(/^## REG-\d+/gm) || []).length,
  peligros: (peligros.match(/^## PEL-\d+/gm) || []).length,
}

let doc = readFileSync(INDICE, 'utf8')
const antes = doc

/** Cada sustitución es un patrón anclado, no un reemplazo ciego de números. */
const REGLAS = [
  [/\*\*\d+ archivos, [\d.]+ casos\*\*/g, `**${cifras.archivos} archivos, ${cifras.casos} casos**`],
  [/`docs\/audit\/regression-ledger\.md` — \*\*\d+ REG\*\*/g, `\`docs/audit/regression-ledger.md\` — **${cifras.regs} REG**`],
  [/es\*\* el historial: \d+ defectos/g, `es** el historial: ${cifras.regs} defectos`],
  [/ve \d+ defectos documentados/g, `ve ${cifras.regs} defectos documentados`],
  [/— \*\*\d+ peligros\*\*, ninguno hipot/g, `— **${cifras.peligros} peligros**, ninguno hipot`],
  [/\*\*Última verificación\*\*: [^\n]+/g, `**Última verificación**: ${process.env.FECHA || '6-ago-2026'}`],
]
for (const [patron, valor] of REGLAS) doc = doc.replace(patron, valor)

/**
 * El total de pruebas NO se deriva aquí: exige correr la suite, y este script
 * tiene que poder ejecutarse en un segundo. Se avisa en vez de adivinarlo —
 * inventarlo sería el mismo defecto que este script existe para evitar.
 */
const totalCitado = doc.match(/\*\*(\d[\d.,]*) pruebas\*\* en verde/)?.[1]

writeFileSync(INDICE, doc)

console.log(`\nCifras derivadas del repositorio:`)
console.log(`  archivos sellados : ${cifras.archivos}`)
console.log(`  casos sellados    : ${cifras.casos}`)
console.log(`  REG documentados  : ${cifras.regs}`)
console.log(`  peligros clínicos : ${cifras.peligros}`)
console.log(doc === antes ? '\n  Sin cambios: el índice ya estaba al día.\n'
                          : `\n  ${INDICE} actualizado.\n`)
if (totalCitado) {
  console.log(`  RECUERDA: el total de pruebas citado (${totalCitado}) se teclea a mano.`)
  console.log(`  Compruébalo con "npx vitest run" antes de enseñar la sala de datos.\n`)
}
