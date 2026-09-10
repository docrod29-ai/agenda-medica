/**
 * CIEN MIL PERSONAS ACTIVAS A LA VEZ NO SON CIEN MIL MÉDICOS — WS-02, segundo objetivo.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * El modelo de concurrencia traduce REGISTRADOS a sesiones. El dueño confirmó
 * («Las dos», 9-sep-2026) un objetivo aparte: 100 000 personas ACTIVAS al mismo
 * tiempo. No se deriva de nada: es la entrada. Y sin decir QUIÉNES son esas
 * personas, «100 000 activos» tampoco nombra un experimento — 100 000 médicos
 * dictando y 100 000 pacientes mirando su cita cuestan cosas distintas.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * `escenarioActivos(n)` declara la mezcla de roles (con base y `medidoEn: null`),
 * cuenta UNA sesión por persona (contrato del dueño), deriva caudal, escrituras
 * e IA por rol, dice con nombre qué falta fuera, y ofrece un CORTE LOCAL
 * etiquetado como lo que es: humo del generador, no evidencia del objetivo.
 * Ningún umbral es un número.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - No corre nada: el ensayo distribuido necesita proyecto de ensayo,
 *   generadores en varias máquinas y presupuesto (`faltaFuera` lo enumera).
 * - La mezcla es un supuesto declarado; sólo la telemetría del producto lo
 *   sustituirá por una medida.
 */
import { describe, it, expect } from 'vitest'
import {
  escenarioActivos, MEZCLA_DE_ROLES, ACTIVIDAD_POR_ROL, USUARIOS_ACTIVOS, ESCENARIOS_DE_ACTIVOS,
} from '../../scripts/escala/escenario-de-activos.mjs'
import { COTAS_LOCALES, PENDIENTE_DEL_DUENO, escenarioDe } from '../../scripts/escala/modelo-de-concurrencia.mjs'

describe('la mezcla se declara, no se supone en silencio', () => {
  it('suma uno, cada rol trae base y ningún rol dice estar medido', () => {
    expect(MEZCLA_DE_ROLES.reduce((a, r) => a + r.fraccion, 0)).toBeCloseTo(1, 9)
    for (const r of MEZCLA_DE_ROLES) {
      expect(r.base.length).toBeGreaterThan(20)
      expect(r.medidoEn).toBeNull()
      expect(ACTIVIDAD_POR_ROL[r.rol as keyof typeof ACTIVIDAD_POR_ROL]).toBeDefined()
    }
  })
  it('los pacientes son la mayoría y los médicos una minoría: no son 100 000 médicos dictando', () => {
    const e = escenarioActivos(100_000)
    expect(e.derivado.porRol.paciente.personas).toBeGreaterThan(e.derivado.porRol.medico.personas * 5)
    expect(e.derivado.porRol.medico.personas).toBeLessThan(20_000)
    expect(e.derivado.llamadasIaPorSegundo).toBeCloseTo(e.derivado.porRol.medico.llamadasIaPorSegundo, 2)
    expect(e.derivado.porRol.paciente.llamadasIaPorSegundo).toBe(0)
  })
})

describe('una persona activa es una sesión, y el objetivo no se deriva de los registrados', () => {
  it('sesiones concurrentes = usuarios activos, exactamente', () => {
    for (const n of USUARIOS_ACTIVOS) {
      const e = escenarioActivos(n)
      expect(e.derivado.sesionesConcurrentes).toBe(n)
      expect(e.derivado.identidadesSinteticasNecesarias).toBe(n)
      expect(e.duracion.factorDeRafaga).toBeGreaterThan(1)
      expect(e.derivado.concurrenciaEnRafaga).toBeGreaterThan(n)
    }
  })
  it('100 000 activos no es el escenario de 100 000 registrados: éste pide veinte veces más sesiones', () => {
    const activos = escenarioActivos(100_000)
    const registrados = escenarioDe(100_000)
    expect(activos.id).not.toBe(registrados.id)
    expect(activos.derivado.sesionesConcurrentes).toBeGreaterThan(registrados.derivado.sesionesConcurrentes * 20)
    expect(activos.noEsElMismoQue).toMatch(/registrados/)
  })
  it('los tres escenarios son exactamente los de la lista, derivados y no escritos a mano', () => {
    expect(ESCENARIOS_DE_ACTIVOS.map(e => e.usuariosActivos)).toEqual([...USUARIOS_ACTIVOS])
    expect(() => escenarioActivos(0)).toThrow()
    expect(() => escenarioActivos(1.5)).toThrow()
  })
})

describe('lo que no cabe aquí lo dice con nombre, y no se aprueba nada', () => {
  it('100 000 activos no cabe en la cota local por concurrencia ni volumen, y enumera qué hace falta', () => {
    const e = escenarioActivos(100_000)
    expect(e.ejecutable.concurrenciaAqui).toBe(false)
    expect(e.ejecutable.volumenAqui).toBe(false)
    const ejes = e.ejecutable.faltaFuera.map(f => f.eje)
    expect(ejes).toEqual(['concurrencia', 'volumen', 'proveedores', 'navegador'])
    for (const f of e.ejecutable.faltaFuera) { expect(f.necesita).toMatch(/\S/); expect(f.conQue).toMatch(/\S/) }
    expect(e.ejecutable.faltaFuera[0].conQue).toMatch(/proyecto de Firebase de ENSAYO/)
  })
  it('mil activos SÍ caben en concurrencia local — el generador se puede probar de verdad', () => {
    expect(escenarioActivos(COTAS_LOCALES.sesiones).ejecutable.concurrenciaAqui).toBe(true)
    expect(escenarioActivos(COTAS_LOCALES.sesiones + 1).ejecutable.concurrenciaAqui).toBe(false)
  })
  it('el corte local está etiquetado como NO evidencia, con la misma mezcla y dentro de la cota', () => {
    const e = escenarioActivos(100_000)
    expect(e.corteLocal.noEsEvidenciaDelObjetivo).toBe(true)
    expect(e.corteLocal.sesiones).toBe(COTAS_LOCALES.sesiones)
    const suma = Object.values(e.corteLocal.porRol).reduce((a, b) => a + b, 0)
    expect(suma).toBeGreaterThanOrEqual(COTAS_LOCALES.sesiones - 2)
    expect(suma).toBeLessThanOrEqual(COTAS_LOCALES.sesiones + 2)
  })
  it('las casillas medidas nacen en null y los umbrales siguen siendo del dueño', () => {
    const e = escenarioActivos(10_000)
    expect(Object.values(e.medido).every(v => v === null)).toBe(true)
    expect(e.umbrales).toBe(PENDIENTE_DEL_DUENO)
  })
})
