/**
 * GOLDEN — LA COLA CON FONDO, LA CARTA MUERTA VISIBLE Y EL RESULTADO CADUCO.
 *
 * ── QUÉ SE VIGILA ────────────────────────────────────────────────────────────
 *
 * #320 Golden Path B, punto 9: «el contenido firmado y la verdad clínica final
 * no pueden ser reemplazados por un reintento de proveedor, un cliente caduco o
 * un resultado de IA de fondo». Eso, en código, es una comprobación de versión
 * antes de aplicar un resultado — y no existía en ninguna parte.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Buscando en el repositorio quién decidía si un resultado asíncrono seguía
 * siendo válido al volver. No había nadie: los resultados se aplican cuando
 * llegan. Con una consulta de veinte minutos y un proveedor que reintenta, la
 * ventana para pisar texto ya editado no es teórica.
 *
 * ── LAS REGLAS QUE LO HACEN SEGURO ───────────────────────────────────────────
 *
 * 1. Una cola tiene fondo. Llena, rechaza en voz alta; no crece. Una cola
 *    infinita no es resiliencia: es el mismo fallo más tarde y con más trabajo
 *    perdido dentro.
 * 2. Lo que agota su presupuesto pasa a carta muerta VISIBLE. Un trabajo que
 *    desaparece en silencio es peor que uno que falla: nadie sabe que faltaba.
 * 3. Un resultado que vuelve tarde no se aplica. Si el encuentro está firmado,
 *    no se aplica nunca — no hay versión que valga.
 * 4. Ninguna clase asíncrona bloquea al médico, y todo modo limitado dice qué
 *    se conserva y qué ve el médico.
 *
 * ── LO QUE **NO** CUBRE ──────────────────────────────────────────────────────
 *
 * `ColaEnMemoria` no es una cola durable: si el proceso muere, se pierde. Sirve
 * de contrato y de banco de pruebas. Una cola durable real es infraestructura y
 * necesita autorización del dueño (ver `docs/reliability/CAPACITY-REPORT.md`).
 * Esta prueba tampoco comprueba que la aplicación use la cola: hoy no la usa.
 */
import { describe, it, expect } from 'vitest'
import { ColaEnMemoria, resultadoCaduco, type Trabajo } from '@/lib/reliability/cola'
import { MODOS_LIMITADOS, modosQueBloquean, modosSinMensaje, type SubsistemaCaido } from '@/lib/reliability/degradacion'

const azarFijo = () => 0.5

function trabajo(id: string, extra: Partial<Trabajo> = {}) {
  return { id, clase: 'async:razonamiento' as const, clinicId: 'clinic_a', carga: {}, encoladoEnMs: 0, ...extra }
}

describe('cola con contrapresión', () => {
  it('la segunda entrega del mismo trabajo se rechaza por identidad', () => {
    const cola = new ColaEnMemoria()
    expect(cola.encolar(trabajo('t1'))).toEqual({ encolado: true })
    expect(cola.encolar(trabajo('t1'))).toEqual({ encolado: false, motivo: 'duplicado' })
    expect(cola.profundidad).toBe(1)
    expect(cola.metricas().duplicateCount).toBe(1)
  })

  it('llena, rechaza en voz alta en vez de crecer sin fondo', () => {
    const cola = new ColaEnMemoria({ profundidadMaxima: 2, politica: { reintentosMaximos: 1, baseMs: 1, topeMs: 10, presupuestoTotalMs: 100, factorSaturacion: 2 } })
    cola.encolar(trabajo('a')); cola.encolar(trabajo('b'))
    expect(cola.encolar(trabajo('c'))).toEqual({ encolado: false, motivo: 'cola-llena' })
  })

  it('un trabajo del camino caliente NO puede entrar a una cola', () => {
    const cola = new ColaEnMemoria()
    // El tipo ya lo impide; la comprobación en ejecución protege del `as`, del
    // JSON que viene de fuera y del día que alguien reclasifique una clase.
    expect(cola.encolar(trabajo('x', { clase: 'hot:guardar-borrador' as never }))).toEqual({ encolado: false, motivo: 'clase-invalida' })
  })

  it('un trabajo sin inquilino no entra: encaminarlo sería adivinar consultorio', () => {
    const cola = new ColaEnMemoria()
    expect(cola.encolar(trabajo('x', { clinicId: '' }))).toEqual({ encolado: false, motivo: 'sin-inquilino' })
  })

  it('agotado el presupuesto, el trabajo va a carta muerta VISIBLE, no al olvido', () => {
    const cola = new ColaEnMemoria()
    cola.encolar(trabajo('t1'))
    // `async:razonamiento` declara 2 reintentos como máximo.
    for (let i = 0; i < 4; i += 1) {
      const t = cola.tomar()
      if (!t) break
      cola.fallar(t.id, 'transitorio', 10, azarFijo)
    }
    const muertos = cola.cartaMuerta()
    expect(muertos).toHaveLength(1)
    expect(muertos[0].motivoTerminal).toBe('intentos-agotados')
    expect(cola.metricas().deadLetterCount).toBe(1)
  })

  it('un fallo permanente no consume reintentos: va directo a carta muerta', () => {
    const cola = new ColaEnMemoria()
    cola.encolar(trabajo('t1'))
    const t = cola.tomar()!
    expect(cola.fallar(t.id, 'permanente', 5, azarFijo)).toEqual({ reencolado: false, motivo: 'permanente' })
  })

  it('las métricas tienen la forma que consume el contrato de evidencia de #310', () => {
    const cola = new ColaEnMemoria()
    cola.encolar(trabajo('t1'))
    expect(Object.keys(cola.metricas()).sort()).toEqual(['deadLetterCount', 'duplicateCount', 'maxDepth', 'retryCount'])
  })
})

describe('resultado caduco', () => {
  it('un resultado que vuelve con el encuentro ya avanzado NO se aplica', () => {
    expect(resultadoCaduco({ versionAlEncolar: 3 }, 4, false)).toBe(true)
    expect(resultadoCaduco({ versionAlEncolar: 3 }, 3, false)).toBe(false)
  })

  it('sobre un encuentro FIRMADO no se aplica nunca, aunque la versión coincida', () => {
    // La verdad clínica firmada no la mueve un proveedor que contestó tarde.
    expect(resultadoCaduco({ versionAlEncolar: 3 }, 3, true)).toBe(true)
  })

  it('AL REVÉS: comparando sólo la versión, el caso firmado se colaría', () => {
    const guardianIncompleto = (v?: number, actual = 0) => v !== undefined && actual > v
    expect(guardianIncompleto(3, 3)).toBe(false)   // dejaría pisar la nota firmada
  })
})

describe('modos limitados', () => {
  it('ningún subsistema caído bloquea al médico', () => {
    expect(modosQueBloquean()).toEqual([])
  })

  it('todo subsistema caído dice qué se conserva y qué ve el médico', () => {
    expect(modosSinMensaje()).toEqual([])
  })

  it('la evidencia caída se dice, no se rellena', () => {
    const m = MODOS_LIMITADOS.evidencia
    expect(m.loQueVeElMedico).toMatch(/no disponible/i)
    expect(m.seDegrada).toContain('citas bibliográficas')
    expect(m.seBloquea).toEqual([])
  })

  it('WhatsApp caído no toca la cita canónica', () => {
    expect(MODOS_LIMITADOS.whatsapp.seConserva.join(' ')).toMatch(/cita canónica/i)
    expect(MODOS_LIMITADOS.whatsapp.seBloquea).toEqual([])
  })

  it('un componente secundario que revienta se lleva su panel, no la pantalla', () => {
    expect(MODOS_LIMITADOS['componente-secundario'].seConserva).toContain('todo lo demás de la pantalla')
  })

  it('cada modo responde a las CUATRO preguntas, sin dejar ninguna vacía por olvido', () => {
    for (const s of Object.keys(MODOS_LIMITADOS) as SubsistemaCaido[]) {
      const m = MODOS_LIMITADOS[s]
      expect(m.seConserva.length, `${s}: nada declarado como conservado`).toBeGreaterThan(0)
      expect(m.seDegrada.length, `${s}: nada declarado como degradado`).toBeGreaterThan(0)
      expect(Array.isArray(m.seReintenta)).toBe(true)
      expect(Array.isArray(m.seBloquea)).toBe(true)
    }
  })
})
