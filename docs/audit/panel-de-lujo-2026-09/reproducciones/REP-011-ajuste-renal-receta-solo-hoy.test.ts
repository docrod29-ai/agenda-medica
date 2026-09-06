/**
 * REP-011 · MI-001 (M-internista) — en la receta el ajuste renal corre sólo
 * sobre los fármacos de HOY, no sobre el cuadro completo.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:284`
 *   `return ajusteRenalFarmacos(meds, renal.depuracionParaDosis)`
 * `meds` (:152) es la receta de hoy; `medsDelCuadro` (:166) une hoy + vigentes
 * y ya alimenta `interaccionesDelCuadro` (:167). La metformina crónica del
 * expediente nunca llega al motor renal de la receta.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-internista, MI-001; equipo rojo confirmado P1 ejecutando el motor
 * con jiti: `evaluarFuncionRenal(mgPorDl(1.9), 78, ♂, kg(62))` → CrCl 28.1;
 * `ajusteRenalFarmacos([Ciprofloxacino])` → sólo cipro; con la metformina
 * vigente añadida → además «Metformina con CrCl 28 (<30): contraindicada».
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * REG-527 llevó el cuadro completo a las interacciones y la creatinina del
 * panel al motor renal, pero dejó la LISTA de fármacos del motor renal en la de
 * hoy. Dos entradas distintas al mismo motor en la misma pantalla.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * CLAUDE.md invariantes: un modelo de medicamento, muchas vistas. La receta es
 * donde se imprime lo que se dispensa; lo vigente cuenta ahí igual que en la
 * consulta (REG-188).
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * `cuadro-completo.ts` NO expone una función que una cuadro + revisión renal:
 * la unión ocurre en la página (React + Firestore, no importable). Por eso:
 *   (a) CONTRATO TEXTUAL declarado sobre la página: el argumento de
 *       `ajusteRenalFarmacos(` debe derivar de `medsDelCuadro`, no de `meds`.
 *   (b) COMPORTAMIENTO con los motores reales (`medicacionDelCuadro` +
 *       `ajusteRenalFarmacos`), como CONTROL: demuestra qué aviso se pierde al
 *       pasar sólo lo de hoy. Pasa hoy a propósito — es la prueba de que el
 *       arreglo de (a) produce el aviso, no un cambio de umbral.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No monta la pantalla. No dice cómo se redacta «vigente» vs «de hoy» en el
 * aviso. No toca el cruce alergia↔fármaco de la misma página (:145), que tiene
 * la misma asimetría. Ningún umbral se añade ni se cambia.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { evaluarFuncionRenal, ajusteRenalFarmacos } from '@/lib/expediente/funcion-renal'
import { medicacionDelCuadro } from '@/lib/expediente/cuadro-completo'
import { mgPorDl, kg } from '@/types/clinical-quantity'

const raiz = path.resolve(__dirname, '../../../..')
const PAGINA = path.join(raiz, 'src', 'app', '(dashboard)', 'receta', '[patientId]', '[notaId]', 'page.tsx')

describe('REP-011 · el ajuste renal de la receta mira el cuadro completo', () => {
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
