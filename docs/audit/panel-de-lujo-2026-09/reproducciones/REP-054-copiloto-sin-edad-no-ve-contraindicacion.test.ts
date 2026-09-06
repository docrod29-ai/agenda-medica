/**
 * REP-054 · MP-016 (M-pediatra) — el copiloto llama al motor pediátrico SIN
 * edad, así que las contraindicaciones por edad (ibuprofeno < 6 meses…) no se
 * evalúan: a un lactante de 4 meses le confirma el rango de ibuprofeno.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/expediente/copiloto.ts:290` `const d = calcularDosisPediatrica(f, peso)`
 * — tercer argumento `edadMeses` ausente. La regla existe y está VALIDADA:
 * `pediatria.ts:55` (`Ibuprofeno … edadMinimaMeses: 6, restriccionEdad: 'No
 * usar en menores de 6 meses…'`) y `pediatria.ts:158` la aplica sólo si
 * `edadMeses != null`. El único llamador que pasa la edad es el panel
 * (`PanelPediatria.tsx:58-61`). `EntradaCopiloto` (copiloto.ts:64) sólo tiene
 * `edad` en AÑOS: un lactante es «0» y con eso no se puede distinguir 4 de 11
 * meses.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-pediatra, MP-016; equipo rojo confirmado P1 con jiti:
 * `calcularDosisPediatrica(Ibuprofeno, 6)` → `porToma {30, 60}` sin
 * `contraindicadoPorEdad`; `calcularDosisPediatrica(Ibuprofeno, 6, 3)` →
 * `contraindicadoPorEdad: true`. El motor está bien; nadie le pasa la edad.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El dato (edad en meses) no llega al motor desde la consulta: «conectado, pero
 * el dato no llega».
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * el-dato-tiene-que-llegar; clinical-safety §4 (ausencia de dato no es dato de
 * ausencia: el motor no inventa contraindicación sin edad, correcto — pero la
 * edad EXISTE en el expediente y no se le da).
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO: `copiloto()` real. La entrada lleva la edad en meses de las
 * dos formas que el hallazgo propone (`edadMeses` y `fechaNacimiento`), porque
 * el nombre del campo nuevo lo decide el arreglo; hoy `EntradaCopiloto` no
 * tiene ninguno y por eso el caso se pasa con un cast declarado. Los 6 meses
 * NO los pone esta prueba: se leen del catálogo (`edadMinimaMeses`).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * Fármacos sin `edadMinimaMeses` en el catálogo (vocabulario, no criterio).
 * Edad máxima (MP-003 / REP-052). El verificador de la RECETA
 * (`revisarDosis` con `edadAnios: 0` → `[]`) queda fuera: `EntradaDosis` no
 * tiene edad en meses y su forma es parte del mismo arreglo. Si el arreglo
 * nombra el campo de otra manera, se ajusta la entrada, no la expectativa.
 */
import { describe, it, expect } from 'vitest'
import { copiloto, type EntradaCopiloto } from '@/lib/expediente/copiloto'
import { FARMACOS_PED } from '@/lib/expediente/pediatria'

const MESES = 4
const fechaNacimiento = (() => {
  const d = new Date(); d.setMonth(d.getMonth() - MESES); return d.toISOString().slice(0, 10)
})()

const LACTANTE = {
  edad: 0, edadMeses: MESES, fechaNacimiento,
  signos: { peso: 6 },
  medicamentos: [{ nombre: 'Ibuprofeno', dosis: '30 mg' }],
} as EntradaCopiloto

describe('REP-054 · lactante de 4 meses + ibuprofeno: el copiloto avisa la contraindicación por edad', () => {
  const ibu = FARMACOS_PED.find(f => f.nombre === 'Ibuprofeno')!
  const ped = copiloto(LACTANTE).filter(s => s.id.startsWith('ped:dosis:'))

  it('control: la regla vive en el catálogo y el lactante está por debajo (no la inventa esta prueba)', () => {
    expect(ibu.edadMinimaMeses).toBeDefined()
    expect(MESES).toBeLessThan(ibu.edadMinimaMeses!)
    expect(ped.length, 'el copiloto ni siquiera evaluó el ibuprofeno').toBeGreaterThan(0)
  })

  it('hay una sugerencia CRÍTICA sobre ibuprofeno (hoy: nivel «accion» con el rango 30 a 60 mg)', () => {
    const crit = ped.filter(s => /ibuprofeno/i.test(s.id) && s.nivel === 'critico')
    expect(crit.map(s => `${s.nivel}: ${s.titulo} — ${s.detalle}`).join(' | ') || `hoy: ${ped.map(s => `${s.nivel}: ${s.titulo}`).join(' | ')}`)
      .toMatch(/critico/)
  })

  it('y esa sugerencia dice que es por la EDAD, con el texto de restricción del catálogo', () => {
    const texto = ped.map(s => `${s.titulo} ${s.detalle}`).join(' ')
    expect(texto).toMatch(new RegExp(ibu.restriccionEdad!.split(';')[0].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  })

  it('ninguna sugerencia le presenta un rango válido como si fuera correcto', () => {
    const rango = ped.filter(s => s.nivel !== 'critico' && /\d+ a \d+ mg/.test(s.detalle))
    expect(rango.map(s => s.detalle), 'le confirma el rango a un contraindicado').toHaveLength(0)
  })
})
