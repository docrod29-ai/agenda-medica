/**
 * V15-NOTE-PLAN-CONTINUITY-001 (Fase 8, §33 / §20 del Master Loop V15) —
 * el checklist de cierre olvidaba lo que el médico ACABABA de hacer.
 *
 * ── CÓMO SE DESCUBRIÓ ─────────────────────────────────────────────────────
 *
 * Leyendo `ComoCerrarLaConsulta.tsx` (REG-244) para empezar la Fase 8: el
 * componente ya declaraba una prop `hechos?: readonly string[]` — «los que
 * ya se hicieron en esta sesión»— pero `grep hechos=` en
 * `/consulta/[patientId]/page.tsx`, su único punto de montaje, no daba nada.
 * La prop nunca se pasaba. El patrón es el de la regla
 * `.claude/rules/el-dato-tiene-que-llegar.md`: el componente sabía DECIR lo
 * hecho, pero nadie se lo decía.
 *
 * ── LA CAUSA RAÍZ ─────────────────────────────────────────────────────────
 *
 * Firmar → «Imprimir la receta» → `/receta/[patientId]/[notaId]` → volver
 * (con `useSmartBack`, que reusa la entrada de historial) → el checklist de
 * cierre se vuelve a montar y enseña EXACTAMENTE la misma lista, sin marcar
 * la receta que el médico acaba de imprimir. Es lo contrario de la
 * continuidad que pide §20: en vez de «el mismo objeto haciéndose más
 * detallado», el médico ve un formulario que no recuerda nada de lo que
 * pasó hace diez segundos.
 *
 * Un segundo defecto emparentado, encontrado en el mismo lugar: el paso
 * «hoja_del_paciente» llevaba `ruta: null` desde REG-244, con el comentario
 * «vive en la propia consulta: no hay a dónde ir» — pero `ComoCerrarLaConsulta`
 * deshabilita cualquier botón sin `ruta`. El paso aparecía en la lista y NUNCA
 * se podía pulsar ni marcar hecho: un botón muerto disfrazado de tarea.
 *
 * ── QUÉ NO CUBRE ──────────────────────────────────────────────────────────
 *
 * No prueba que el médico haya LEÍDO la receta o la orden — sólo que pasó
 * por la ruta de imprimirla. Tampoco decide si «hoja_del_paciente» se marca
 * al copiar O al imprimir (las dos cuentan): eso es intencional, cualquiera
 * de las dos es evidencia de que se usó, no sólo se vio.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const { leerHechosDeCierre, marcarHechoDeCierre } = await import('@/lib/expediente/cierre-hechos')

/** `sessionStorage` mínimo en memoria — el proyecto corre en entorno `node`, sin jsdom. */
function ventanaConSessionStorage() {
  const almacen = new Map<string, string>()
  return {
    sessionStorage: {
      getItem: (k: string) => (almacen.has(k) ? almacen.get(k)! : null),
      setItem: (k: string, v: string) => { almacen.set(k, v) },
      removeItem: (k: string) => { almacen.delete(k) },
    },
  } as unknown as Window & typeof globalThis
}

describe('cierre-hechos — módulo puro', () => {
  it('sin notaId, no lee ni escribe nada', () => {
    expect(leerHechosDeCierre(null)).toEqual([])
    expect(leerHechosDeCierre(undefined)).toEqual([])
    expect(marcarHechoDeCierre(null, 'receta')).toEqual([])
  })

  describe('con una ventana real (fake) de por medio', () => {
    const original = globalThis.window

    beforeEach(() => {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: ventanaConSessionStorage() })
    })
    afterAll(() => {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: original })
    })

    it('lo marcado se puede releer', () => {
      marcarHechoDeCierre('nota-1', 'receta')
      expect(leerHechosDeCierre('nota-1')).toEqual(['receta'])
    })

    it('marcar dos veces lo mismo no lo duplica', () => {
      marcarHechoDeCierre('nota-1', 'receta')
      marcarHechoDeCierre('nota-1', 'receta')
      expect(leerHechosDeCierre('nota-1')).toEqual(['receta'])
    })

    it('acumula pasos distintos de la misma nota', () => {
      marcarHechoDeCierre('nota-1', 'receta')
      marcarHechoDeCierre('nota-1', 'orden')
      expect(leerHechosDeCierre('nota-1')).toEqual(['receta', 'orden'])
    })

    it('dos notas NO comparten lo hecho — es lo hecho de ESTA nota', () => {
      marcarHechoDeCierre('nota-1', 'receta')
      expect(leerHechosDeCierre('nota-2')).toEqual([])
    })

    it('JSON corrupto en sessionStorage no revienta la lectura', () => {
      window.sessionStorage.setItem('nx-cierre-hechos:nota-3', '{esto no es json válido')
      expect(leerHechosDeCierre('nota-3')).toEqual([])
    })
  })
})

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const cierre = leer('src', 'lib', 'expediente', 'que-falta-para-cerrar.ts')
const hoja = leer('src', 'components', 'HojaParaElPaciente.tsx')

describe('está CONECTADO — no sólo escrito', () => {
  it('la consulta importa el módulo de lo hecho', () => {
    expect(consulta).toContain("from '@/lib/expediente/cierre-hechos'")
  })

  it('el checklist SÍ recibe lo que ya se hizo — antes no se pasaba nunca', () => {
    expect(consulta).toMatch(/hechos=\{hechosCierre\}/)
  })

  it('ir a receta u orden marca el paso ANTES de navegar', () => {
    expect(consulta).toMatch(/marcarHechoDeCierre\(notaId, 'receta'\)/)
    expect(consulta).toMatch(/marcarHechoDeCierre\(notaId, 'orden'\)/)
  })

  it('un paso con # se resuelve en la propia pantalla, no como URL', () => {
    expect(consulta).toMatch(/r\.startsWith\('#'\)/)
    expect(consulta).toMatch(/scrollIntoView/)
  })

  it('la hoja del paciente ya no es un botón muerto: tiene ancla real', () => {
    expect(cierre).toContain("ruta: '#hoja-para-el-paciente'")
    expect(cierre).not.toMatch(/que: 'hoja_del_paciente'[\s\S]{0,120}ruta: null/)
  })

  it('el ancla existe de verdad en la hoja del paciente', () => {
    expect(hoja).toContain('id="hoja-para-el-paciente"')
  })

  it('copiar e imprimir avisan que el médico USÓ la hoja, no sólo la vio', () => {
    expect(hoja).toContain('onInteraccion?.()')
    // Las dos acciones reales de la hoja — no una tercera inventada.
    expect(hoja).toMatch(/copiar = async[\s\S]{0,200}onInteraccion\?\.\(\)/)
    expect(hoja).toMatch(/imprimir = \(\)[\s\S]{0,80}onInteraccion\?\.\(\)/)
  })

  it('la consulta conecta el aviso al checklist', () => {
    expect(consulta).toMatch(/onInteraccion=\{\(\) => setHechosCierre\(marcarHechoDeCierre\(notaId, 'hoja_del_paciente'\)\)\}/)
  })
})
