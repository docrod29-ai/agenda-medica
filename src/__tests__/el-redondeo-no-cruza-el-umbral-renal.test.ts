import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  cockcroftGault, evaluarFuncionRenal, ajusteRenalFarmacos,
} from '@/lib/expediente/funcion-renal'
import { mgPorDl, kg, cantidad, valorEn } from '@/types/clinical-quantity'

/**
 * REG-192 — EL REDONDEO DEL MOTOR SE COMÍA LAS ALERTAS RENALES DEL BORDE
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `cockcroftGault` devolvía `Math.round(crcl)`, y ese entero era el que
 * `ajusteRenalFarmacos` comparaba contra los 18 umbrales de `REGLAS_RENALES`.
 * Toda depuración en [umbral−0.5, umbral) se redondeaba HACIA ARRIBA hasta el
 * umbral exacto, y `crcl < umbral` pasaba de verdadero a falso: la alerta no
 * salía. La ventana ciega existía en los 18 umbrales a la vez (30, 40, 50, 60).
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría del 8-ago-2026 de `src/lib/expediente/funcion-renal.ts`. La pista
 * fue la asimetría dentro del propio archivo: `ckdEpi2021` lleva escrito, por
 * decisión del Dr. (L6), que devuelve precisión completa «porque un Math.round
 * interno podía cambiar clasificaciones, comparaciones o cálculos posteriores»,
 * y Cockcroft —el que de verdad alimenta los umbrales de dosis— redondeaba.
 *
 * Reproducido con el motor real antes de tocar nada: hombre de 80 años, 64 kg,
 * creatinina 1.8 mg/dL → CrCl 29.6296 mL/min. Con metformina y nitrofurantoína
 * en la receta, `ajusteRenalFarmacos` devolvía **cero alertas**.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Ese paciente es un caso de consultorio, no un extremo de laboratorio: un
 * anciano delgado con creatinina de 1.8 está justo donde metformina deja de
 * poder darse (riesgo de acidosis láctica) y donde nitrofurantoína ni siquiera
 * llega a la orina en concentración útil. El sistema callaba precisamente en el
 * borde, que es donde el médico más agradece que algo hable.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El motor devuelve precisión completa; **redondea quien pinta**. Se compara con
 * el número completo y se escribe el redondeado. Es la misma regla que CKD-EPI
 * ya seguía: aquí sólo se extendió a Cockcroft, que se había quedado fuera.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - NO cambia ni un umbral, ni un mensaje, ni un fármaco de `REGLAS_RENALES`:
 *   los umbrales son los que ya estaban y siguen siendo decisión del médico.
 * - NO opina sobre si debe alertarse cuando la base es la TFG indexada
 *   (mL/min/1.73 m²) en vez de la depuración: eso es la Q2 abierta con el Dr.
 * - NO cubre el otro sentido del borde: un CrCl real de 30.4 sigue sin alertar,
 *   y debe seguir sin hacerlo — el umbral es «por debajo de», no «cerca de».
 * - NO vigila los demás motores que redondean por dentro. Si alguno compara
 *   contra un umbral con el valor ya redondeado, tiene este mismo defecto y este
 *   golden no lo ve.
 */

const RECETA = path.join(
  process.cwd(), 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx',
)

/** El paciente del hallazgo. Sintético: no existe, se construyó para el borde. */
const ANCIANO_EN_EL_BORDE = { creatinina: 1.8, edad: 80, sexo: 'Masculino' as const, peso: 64 }

const depDe = (p: typeof ANCIANO_EN_EL_BORDE) =>
  evaluarFuncionRenal(mgPorDl(p.creatinina), p.edad, p.sexo, kg(p.peso))

describe('REG-192 · el caso que lo destapó', () => {
  it('CrCl 29.63 (no 30): el motor ya no redondea', () => {
    const crcl = valorEn(cockcroftGault(mgPorDl(1.8), 80, 'Masculino', kg(64)), 'mL/min')
    expect(crcl).toBeCloseTo(29.63, 2)
    expect(Number.isInteger(crcl)).toBe(false)
  })

  it('con CrCl 29.63 salen las DOS alertas de <30 que antes se perdían', () => {
    const renal = depDe(ANCIANO_EN_EL_BORDE)
    const alertas = ajusteRenalFarmacos(
      [{ nombre: 'Metformina 850 mg' }, { nombre: 'Nitrofurantoína 100 mg' }],
      renal.depuracionParaDosis!,
    )
    expect(alertas).toHaveLength(2)
    // Las dos son de EVITAR, que es el nivel que el médico no puede perderse.
    expect(alertas.every(a => a.severidad === 'evitar')).toBe(true)
    expect(alertas.map(a => a.farmaco)).toEqual(['Metformina 850 mg', 'Nitrofurantoína 100 mg'])
  })

  it('el mensaje sigue escribiendo un entero, no 29.629629629629626', () => {
    const renal = depDe(ANCIANO_EN_EL_BORDE)
    const [alerta] = ajusteRenalFarmacos([{ nombre: 'Metformina 850 mg' }], renal.depuracionParaDosis!)
    expect(alerta.mensaje).toContain('CrCl 30')
    expect(alerta.mensaje).not.toMatch(/\d+\.\d/)
  })
})

describe('REG-192 · la ventana ciega, umbral por umbral', () => {
  /**
   * Un fármaco por cada umbral distinto de REGLAS_RENALES. El valor de prueba es
   * `umbral − 0.4`: por debajo del umbral de verdad, pero redondeaba hacia arriba
   * hasta el umbral exacto — exactamente el rango que se perdía.
   */
  const EN_EL_BORDE: Array<[string, number]> = [
    ['Metformina 850 mg', 30],
    ['Nitrofurantoína 100 mg', 30],
    ['Ertapenem 1 g', 30],
    ['Enoxaparina 40 mg', 30],
    ['Piperacilina/tazobactam 4.5 g', 40],
    ['Vancomicina 1 g', 50],
    ['Meropenem 1 g', 50],
    ['Fluconazol 200 mg', 50],
    ['Cefepime 2 g', 60],
    ['Amikacina 1 g', 60],
  ]

  it.each(EN_EL_BORDE)('%s con CrCl umbral−0.4 (%d) sí alerta', (farmaco, umbral) => {
    const dep = {
      base: 'cockcroft-gault' as const,
      q: cantidad(umbral - 0.4, 'mL/min', 'depuracion'),
    }
    expect(ajusteRenalFarmacos([{ nombre: farmaco }], dep)).toHaveLength(1)
  })

  /**
   * El otro lado del borde: quitar el redondeo NO debe convertir esto en un motor
   * que alerta «por si acaso». Por encima del umbral se sigue callando, y ahora
   * además se calla en el rango (umbral, umbral+0.5) que el redondeo hacia abajo
   * convertía en alerta falsa.
   */
  it.each(EN_EL_BORDE)('%s con CrCl umbral+0.4 (%d) sigue sin alertar', (farmaco, umbral) => {
    const dep = {
      base: 'cockcroft-gault' as const,
      q: cantidad(umbral + 0.4, 'mL/min', 'depuracion'),
    }
    expect(ajusteRenalFarmacos([{ nombre: farmaco }], dep)).toHaveLength(0)
  })
})

describe('REG-192 · el redondeo llega a la pantalla', () => {
  /**
   * «El dato tiene que LLEGAR»: quitar el Math.round del motor sin ponerlo donde
   * se pinta dejaría al médico leyendo «CrCl 29.629629629629626 mL/min» en la
   * receta. La pantalla es el único consumidor de `crClCockcroft` fuera de los
   * tests, así que se comprueba ahí mismo.
   */
  it('la receta redondea el CrCl al mostrarlo', () => {
    const receta = fs.readFileSync(RECETA, 'utf8')
    expect(receta).toContain("Math.round(valorEn(renal.crClCockcroft, 'mL/min'))")
  })

  it('el motor ya no lleva el Math.round dentro', () => {
    const motor = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/expediente/funcion-renal.ts'), 'utf8',
    )
    expect(motor).not.toContain("cantidad(Math.round(crcl), 'mL/min', 'depuracion')")
  })
})
