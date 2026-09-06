/**
 * GOLDEN — el ajuste renal de la receta mira el CUADRO COMPLETO, no sólo lo
 * que se receta hoy.
 *
 * Reproducción REP-011 del Panel de Lujo (hallazgo MI-001, auditor
 * M-internista, P1), movida aquí con el arreglo.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:284`
 *   `return ajusteRenalFarmacos(meds, renal.depuracionParaDosis)`
 * `meds` era la receta de HOY. `medsDelCuadro` —hoy + la medicación vigente del
 * expediente— ya existía dos líneas más arriba y ya alimentaba
 * `interaccionesDelCuadro`. La metformina crónica del diabético con ERC nunca
 * llegaba al motor renal de la pantalla donde se imprime lo que se dispensa.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditoría Panel de Lujo, sep-2026: auditor M-internista, hallazgo MI-001;
 * equipo rojo CONFIRMADO en P1 ejecutando los motores reales con jiti:
 * `evaluarFuncionRenal(mgPorDl(1.9), 78, ♂, kg(62))` → CrCl 28.1;
 * `ajusteRenalFarmacos([Ciprofloxacino])` → sólo cipro; con la metformina
 * vigente añadida → además «Metformina con CrCl 28 (<30): contraindicada».
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * REG-527 llevó el cuadro completo a las interacciones y la creatinina del
 * panel al motor renal, y dejó la LISTA de fármacos del motor renal en la de
 * hoy. Dos entradas distintas al mismo motor en la misma pantalla: el médico ve
 * avisos de interacción sobre la metformina y ninguno renal, y lee esa ausencia
 * como que el riñón ya se revisó.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * CLAUDE.md, invariantes: un modelo de medicamento, muchas vistas. La receta es
 * donde se imprime lo que se dispensa; lo vigente cuenta ahí igual que en la
 * consulta (REG-188).
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * `cuadro-completo.ts` NO expone una función que una cuadro + revisión renal:
 * la unión ocurre en la página (React + Firestore, no importable). Por eso:
 *   (a) CONTRATO TEXTUAL declarado sobre la página: el argumento de
 *       `ajusteRenalFarmacos(` debe derivar de `medsDelCuadro`, no de `meds`.
 *   (b) COMPORTAMIENTO con los motores reales (`medicacionDelCuadro` +
 *       `ajusteRenalFarmacos`): demuestra qué aviso se pierde al pasar sólo lo
 *       de hoy y cuál aparece con el cuadro. Ningún umbral se toca.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No monta la pantalla. No comprueba cómo se redacta «vigente» vs «de hoy» en
 * el aviso (la página lo marca con `deHoy`, pero eso exige render). No toca el
 * cruce alergia↔fármaco de la misma página, que conserva la misma asimetría a
 * propósito: desde la receta no se puede des-prescribir lo vigente y el aviso
 * de alergia sobre un fármaco que no está en este papel no tendría acción.
 * Ningún umbral se añade ni se cambia.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { evaluarFuncionRenal, ajusteRenalFarmacos } from '@/lib/expediente/funcion-renal'
import { medicacionDelCuadro } from '@/lib/expediente/cuadro-completo'
import { mgPorDl, kg } from '@/types/clinical-quantity'

const raiz = process.cwd()
const PAGINA = path.join(raiz, 'src', 'app', '(dashboard)', 'receta', '[patientId]', '[notaId]', 'page.tsx')

describe('MI-001 · el ajuste renal de la receta mira el cuadro completo', () => {
  it('contrato: `ajusteRenalFarmacos(` en la página recibe lo derivado de `medsDelCuadro`, no `meds` (sólo hoy)', () => {
    const s = readFileSync(PAGINA, 'utf8')
    const llamadas = [...s.matchAll(/ajusteRenalFarmacos\(\s*([^,)]+)\s*,/g)].map(m => m[1].trim())
    expect(llamadas.length, 'la página ya no llama a ajusteRenalFarmacos').toBeGreaterThan(0)
    for (const arg of llamadas) {
      expect(arg, `argumento «${arg}»: es la receta de hoy, no el cuadro`).not.toBe('meds')
      expect(arg, `argumento «${arg}» no deriva de medsDelCuadro`).toMatch(/medsDelCuadro|[cC]uadro/)
    }
  })

  it('control (motor real): con sólo lo de hoy no hay aviso de metformina; con el cuadro sí', () => {
    // Paciente sintético del hallazgo: 78 años, 62 kg, creatinina 1.9 → CrCl < 30.
    const renal = evaluarFuncionRenal(mgPorDl(1.9), 78, 'Masculino', kg(62))
    expect(renal.depuracionParaDosis).not.toBeNull()
    const dep = renal.depuracionParaDosis!

    const hoy = [{ nombre: 'Ciprofloxacino 500 mg', dosis: '500 mg', via: 'oral' }]
    const vigentes = [{ medicamento: { nombre: 'Metformina 850 mg', dosis: '850 mg', via: 'oral' } }]

    const soloHoy = ajusteRenalFarmacos(hoy.map(m => ({ nombre: m.nombre })), dep)
    expect(soloHoy.some(a => /metformina/i.test(a.farmaco))).toBe(false)

    const cuadro = medicacionDelCuadro(hoy as never, vigentes as never)
    const conCuadro = ajusteRenalFarmacos(cuadro.map(m => ({ nombre: m.nombre })), dep)
    const metf = conCuadro.find(a => /metformina/i.test(a.farmaco))
    expect(metf?.severidad).toBe('evitar')
  })
})
