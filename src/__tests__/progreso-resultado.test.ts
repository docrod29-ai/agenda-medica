/**
 * `progresoResultado()` — las ocho etapas de §9 del master loop V15 mapeadas
 * sobre lo que `TareaClinica` de verdad sabe.
 *
 * ── QUÉ PROTEGE ──────────────────────────────────────────────────────────────
 *
 * El riesgo real no es que falte una etapa: es que alguien, buscando "cerrar
 * el hallazgo" de esta fase, marque DECISION/ACTION/PATIENT COMMUNICATION
 * como "hecha" en cuanto la tarea se cierra — porque `estado === 'cerrada'`
 * SE SIENTE como "ya se decidió, ya se actuó, ya se avisó". El modelo no lo
 * dice: sólo dice que alguien la cerró. Inventar esas tres sería la regla 5
 * de seguridad clínica rota en código («señalar de menos, nunca de más»).
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * El caso "las tres etapas sin dato siguen sin dato incluso cerrada" es
 * exactamente el que fallaría si alguien "arreglara" la función para que
 * `cerrada` también marcara DECISION/ACTION/PATIENT COMMUNICATION como
 * `hecha` — cambio tentador y equivocado.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No prueba el pintado (`ProgresoResultado.tsx`) ni que esté conectado en
 * `/pendientes` — eso es `v15-progreso-resultado-conectado.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { esTareaDeResultado, progresoResultado, type EtapaResultado } from '@/lib/tareas-clinicas/progreso-resultado'
import type { EstadoTarea } from '@/lib/tareas-clinicas/modelo'

const etapa = (etapas: EtapaResultado[], clave: string) => etapas.find(e => e.clave === clave)!

describe('esTareaDeResultado — sólo dos tipos son "un resultado" en el sentido de §9', () => {
  it('estudio_pendiente y resultado_por_revisar sí lo son', () => {
    expect(esTareaDeResultado('estudio_pendiente')).toBe(true)
    expect(esTareaDeResultado('resultado_por_revisar')).toBe(true)
  })

  it('seguimiento, receta_por_entregar y el resto NO lo son', () => {
    expect(esTareaDeResultado('seguimiento')).toBe(false)
    expect(esTareaDeResultado('receta_por_entregar')).toBe(false)
    expect(esTareaDeResultado('reconciliacion_medicamento')).toBe(false)
    expect(esTareaDeResultado('otra')).toBe(false)
  })
})

describe('progresoResultado — RESULT y SIGNIFICANCE siempre "hecha"', () => {
  it('una tarea recién nacida ya tiene resultado y significado', () => {
    const etapas = progresoResultado({ estado: 'solicitada', ownerUid: undefined })
    expect(etapa(etapas, 'resultado').estado).toBe('hecha')
    expect(etapa(etapas, 'significado').estado).toBe('hecha')
  })
})

describe('progresoResultado — OWNER, REVIEW y CLOSED siguen la progresión real de `estado`', () => {
  it('sin dueño: la etapa "actual" es Dueño, no Revisión', () => {
    const etapas = progresoResultado({ estado: 'solicitada', ownerUid: undefined })
    expect(etapa(etapas, 'dueno').estado).toBe('actual')
    expect(etapa(etapas, 'revision').estado).toBe('pendiente')
  })

  it('con dueño pero sin empezar a trabajarla: Dueño hecha, Revisión es la actual', () => {
    const etapas = progresoResultado({ estado: 'aceptada', ownerUid: 'uid-1' })
    expect(etapa(etapas, 'dueno').estado).toBe('hecha')
    expect(etapa(etapas, 'revision').estado).toBe('actual')
  })

  it('en curso o completada: Revisión ya está hecha, Cerrado es la actual', () => {
    for (const estado of ['en_curso', 'completada'] as EstadoTarea[]) {
      const etapas = progresoResultado({ estado, ownerUid: 'uid-1' })
      expect(etapa(etapas, 'revision').estado, estado).toBe('hecha')
      expect(etapa(etapas, 'cerrado').estado, estado).toBe('actual')
    }
  })

  it('cerrada: Cerrado hecha, y NINGUNA etapa queda como "actual" (no hay siguiente paso)', () => {
    const etapas = progresoResultado({ estado: 'cerrada', ownerUid: 'uid-1' })
    expect(etapa(etapas, 'cerrado').estado).toBe('hecha')
    expect(etapas.some(e => e.estado === 'actual')).toBe(false)
  })

  it('cancelada: terminal igual que cerrada, sin etapa "actual"', () => {
    const etapas = progresoResultado({ estado: 'cancelada', ownerUid: undefined })
    expect(etapas.some(e => e.estado === 'actual')).toBe(false)
    // Cancelada NO es cerrada — no se le atribuye el cierre real.
    expect(etapa(etapas, 'cerrado').estado).toBe('pendiente')
  })
})

describe('progresoResultado — DECISION, ACTION y PATIENT COMMUNICATION: sin_dato SIEMPRE, cerrada o no', () => {
  const SIN_DATO = ['decision', 'accion', 'aviso_paciente'] as const

  it.each(['solicitada', 'aceptada', 'en_curso', 'completada', 'cerrada', 'cancelada'] as EstadoTarea[])(
    'con estado=%s, las tres etapas sin campo propio siguen en sin_dato',
    (estado) => {
      const etapas = progresoResultado({ estado, ownerUid: 'uid-1' })
      for (const clave of SIN_DATO) {
        const e = etapa(etapas, clave)
        expect(e.estado, `${clave} en estado=${estado}`).toBe('sin_dato')
        expect(e.motivoSinDato, `${clave} debe explicar POR QUÉ falta el dato`).toBeTruthy()
      }
    },
  )

  it('el motivo declarado no es genérico: nombra que "cerrar" es el único acto hoy', () => {
    const etapas = progresoResultado({ estado: 'cerrada', ownerUid: 'uid-1' })
    expect(etapa(etapas, 'decision').motivoSinDato).toMatch(/cerrar/i)
  })
})

describe('progresoResultado — ocho etapas exactas, en el orden de §9', () => {
  it('devuelve las ocho claves en el orden RESULT→…→CLOSED', () => {
    const etapas = progresoResultado({ estado: 'solicitada', ownerUid: undefined })
    expect(etapas.map(e => e.clave)).toEqual([
      'resultado', 'significado', 'dueno', 'revision', 'decision', 'accion', 'aviso_paciente', 'cerrado',
    ])
  })
})
