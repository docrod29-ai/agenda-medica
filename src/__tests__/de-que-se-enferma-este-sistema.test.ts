/**
 * DE QUÉ SE ENFERMA ESTE SISTEMA.
 *
 * Guardián de la taxonomía de defectos (`src/lib/calidad/familias-de-defecto.ts`
 * y `docs/quality/FAMILIAS-DE-DEFECTO.md`).
 *
 * ── QUÉ IMPIDE ───────────────────────────────────────────────────────────────
 *
 * Que la clasificación se quede atrás del ledger. En cuanto aterriza un REG
 * nuevo, esta prueba falla hasta que alguien lo clasifique — y clasificarlo
 * obliga a hacerse la única pregunta que convierte un defecto en aprendizaje:
 * **«¿de qué familia es éste?»**.
 *
 * Sin este guardián, la tabla diría 51 para siempre y el conteo —que es lo
 * único que aquí tiene valor— se volvería decorativo.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  FAMILIAS,
  LO_QUE_EL_CONTEO_NO_DICE,
  porTamano,
  regsClasificados,
  regsDuplicados,
} from '@/lib/calidad/familias-de-defecto'

const RAIZ = process.cwd()
const LEDGER = join(RAIZ, 'docs/audit/regression-ledger.md')
const DOC = join(RAIZ, 'docs/quality/FAMILIAS-DE-DEFECTO.md')

/** Los REG que el ledger declara hoy, leídos de sus encabezados. */
function regsDelLedger(): number[] {
  const texto = readFileSync(LEDGER, 'utf8')
  const nums = new Set<number>()
  for (const linea of texto.split('\n')) {
    if (!linea.startsWith('## REG-')) continue
    // Un encabezado puede nombrar dos (REG-179 / REG-180 comparten causa).
    for (const m of linea.matchAll(/REG-(\d+)/g)) nums.add(Number(m[1]))
  }
  return [...nums].sort((a, b) => a - b)
}

describe('de qué se enferma este sistema', () => {
  it('el documento existe', () => {
    expect(existsSync(DOC)).toBe(true)
  })

  it('ningún REG cae en dos familias — un defecto tiene UNA causa raíz', () => {
    expect(regsDuplicados()).toEqual([])
  })

  it('todos los REG del ledger están clasificados', () => {
    const sinClasificar = regsDelLedger().filter(r => !regsClasificados().includes(r))
    expect(
      sinClasificar,
      `REG sin familia: ${sinClasificar.join(', ')} — clasifícalos en familias-de-defecto.ts`,
    ).toEqual([])
  })

  it('no se clasifica ningún REG que el ledger no tenga', () => {
    const delLedger = regsDelLedger()
    const inventados = regsClasificados().filter(r => !delLedger.includes(r))
    expect(inventados, `REG inexistentes: ${inventados.join(', ')}`).toEqual([])
  })

  it('cada familia dice cómo reconocer el siguiente caso, no sólo cómo se llama', () => {
    for (const f of FAMILIAS) {
      expect(f.patron.length, `${f.clave}: el patrón es demasiado corto`).toBeGreaterThan(80)
      expect(f.regs.length, `${f.clave}: una familia sin casos no es una familia`).toBeGreaterThan(0)
    }
  })

  it('las claves son únicas y estables', () => {
    expect(new Set(FAMILIAS.map(f => f.clave)).size).toBe(FAMILIAS.length)
  })

  it('el documento nombra la familia más grande y su cuenta', () => {
    const texto = readFileSync(DOC, 'utf8')
    const mayor = porTamano()[0]
    expect(texto).toContain(mayor.nombre)
    expect(texto).toContain(`${mayor.regs.length} de ${regsClasificados().length}`)
  })

  it('el documento advierte lo que el conteo NO dice', () => {
    const texto = readFileSync(DOC, 'utf8')
    // Sin esta advertencia, el conteo se lee como un mapa del sistema cuando
    // sólo es un mapa de dónde se ha mirado.
    expect(texto).toContain('porque nadie la busca')
    expect(LO_QUE_EL_CONTEO_NO_DICE).toContain('porque nadie la busca')
  })

  it('las decisiones del médico dueño se cuentan aparte de los defectos', () => {
    // Meterlas en el saco de «defectos» inflaría la cuenta con cosas que nadie
    // rompió: las decidió el médico responsable.
    const f = FAMILIAS.find(x => x.clave === 'decision_del_dueno')
    expect(f).toBeDefined()
    expect(f!.regs.length).toBeGreaterThan(0)
  })
})
