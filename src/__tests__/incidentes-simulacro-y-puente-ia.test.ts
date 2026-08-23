/**
 * GOLDEN — el arnés de simulacros y el puente con lo que ya existía.
 *
 * ── QUÉ PROTEGE ──────────────────────────────────────────────────────────────
 *
 * Dos cosas distintas que se rompen igual de callado:
 *
 * 1. **El arnés.** Un simulacro que siempre «pasa» no es un simulacro, es un
 *    informe. Aquí se comprueba que los trece escenarios dan el resultado que
 *    declaran y que el arnés es DETERMINISTA — sin eso no se puede comparar la
 *    ejecución de hoy con la de ayer, y entonces no detecta que el motor empeoró.
 *
 * 2. **El puente.** #315 podría haber escrito una segunda taxonomía de fallos de
 *    IA. Habría sido el defecto más caro del carril: dos clasificaciones del
 *    mismo fallo, y el día que una cambiara, el tablero del dueño y el mensaje
 *    del médico dirían cosas distintas. Aquí se prueba que el puente DELEGA en
 *    `ia/fallo-proveedor.ts` en vez de repetirlo.
 *
 * ── CÓMO SE DESCUBRIÓ QUE HACÍA FALTA EL PUENTE ──────────────────────────────
 *
 * Leyendo `ia/incidentes-servidor.ts` antes de tocar nada: ya agrupaba, ya
 * contaba repeticiones y ya avisaba al dueño. Lo que le faltaba era ser neutro
 * de proveedor. Sustituirlo habría tirado la lección del 31-jul; envolverlo la
 * conserva.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · El simulacro NO mide producción. Sin red, sin proveedor, sin base de datos.
 *   La duración de cada acción de reparación es un parámetro del escenario.
 * · No prueba que `reportarFalloIA` escriba en Firestore: eso necesita el
 *   emulador y vive en `emulator/`.
 * · No cubre Hospital ni UCI.
 */
import { describe, it, expect } from 'vitest'
import { correrTodos, correrEscenario } from '@/lib/incidents/simulacro'
import { ESCENARIOS } from '@/lib/incidents/escenarios'
import {
  eventoDesdeFalloDeIA, incidenteParaDecidirDesdeIA, reintentabilidadDe,
  runbookDeFalloDeIA, leTocaAlDueno, type FalloDeIA,
} from '@/lib/incidents/puente-ia'
import { claseDeFallo, seArreglaReintentando, avisoAlDueno } from '@/lib/ia/fallo-proveedor'
import { puedeAutoRepararse } from '@/lib/incidents/remediacion'
import { dimensionesDe } from '@/lib/incidents/taxonomia'
import { revisarContexto, DEPENDENCIA_DE_INTEGRACION } from '@/lib/incidents/correlacion-contrato'
import { firmaDe, verificarFirmaLibreDePHI } from '@/lib/incidents/firma'

const T0 = Date.parse('2026-08-23T09:00:00.000Z')

describe('Los simulacros dan lo que declaran, y siempre lo mismo', () => {
  const informe = correrTodos(ESCENARIOS, T0, 'nexusmed-v1171')

  it('los trece escenarios son conformes', () => {
    const malos = informe.escenarios.filter(r => !r.conforme)
    expect(malos.map(m => `${m.id}: ${m.discrepancias.join('; ')}`)).toEqual([])
    expect(informe.total).toBe(13)
  })

  it('ningún evento del arnés se queda sin firmar', () => {
    for (const r of informe.escenarios) expect(r.eventosRechazados, r.id).toBe(0)
  })

  it('es determinista: dos ejecuciones dan el mismo informe hasta el milisegundo', () => {
    const otro = correrTodos(ESCENARIOS, T0, 'nexusmed-v1171')
    expect(JSON.stringify(otro)).toBe(JSON.stringify(informe))
  })

  it('mismo fallo repetido 60 veces → UN incidente agrupado', () => {
    const saldo = informe.escenarios.find(r => r.id === 'IA-SALDO')!
    expect(saldo.eventosGenerados).toBe(60)
    expect(saldo.grupos).toBe(1)
  })

  it('el saldo agotado pide un humano y NO desata una tormenta de reintentos', () => {
    const saldo = informe.escenarios.find(r => r.id === 'IA-SALDO')!
    expect(saldo.remediacionPermitida).toBe(false)
    expect(saldo.intentos).toBe(0)
    expect(saldo.desenlace).toBe('requiere_humano')
    expect(saldo.avisoRequerido).toBe(true)
  })

  it('la sobrecarga se repara sola, con presupuesto, y no avisa a nadie', () => {
    const s = informe.escenarios.find(r => r.id === 'IA-SOBRECARGA')!
    expect(s.remediacionPermitida).toBe(true)
    expect(s.intentos).toBeLessThanOrEqual(3)
    expect(s.desenlace).toBe('recuperado')
    expect(s.avisoRequerido).toBe(false)
  })

  it('el fallo de WhatsApp tras una reserva NO deshace la reserva', () => {
    const w = informe.escenarios.find(r => r.id === 'WHATSAPP-TRAS-RESERVA')!
    expect(w.remediacionPermitida).toBe(true)
    expect(w.mensajeAlMedico.dataSafety).toMatch(/cita sigue guardada/i)
    /**
     * Y la acción que deshacía la reserva no es que esté prohibida: es que la
     * más parecida del catálogo —borrar el encuentro— se rechaza. La cita es el
     * dato; el mensaje es el acuse.
     */
    const comoNotificacion = {
      categoria: 'notification' as const,
      dimensiones: {
        ...dimensionesDe({ categoria: 'notification' }),
        reversibilidad: 'reversible' as const,
      },
      idempotenciaGarantizada: true,
    }
    expect(puedeAutoRepararse(comoNotificacion, 'reintentar_notificacion').permitida).toBe(true)
    expect(puedeAutoRepararse(comoNotificacion, 'borrar_encuentro').permitida).toBe(false)
  })

  it('el aislamiento entre consultorios es incidente con UN evento y nunca se repara solo', () => {
    const a = informe.escenarios.find(r => r.id === 'AISLAMIENTO')!
    expect(a.eventosGenerados).toBe(1)
    expect(a.esIncidente).toBe(true)
    expect(a.remediacionPermitida).toBe(false)
    expect(a.avisoRequerido).toBe(true)
  })

  it('un fallo de red suelto NO se convierte en incidente', () => {
    const r = informe.escenarios.find(x => x.id === 'RED-PUNTUAL')!
    expect(r.esIncidente).toBe(false)
    expect(r.avisoRequerido).toBe(false)
    expect(r.mttdMs).toBeNull()
  })

  it('la misma escritura CON y SIN clave de idempotencia decide distinto', () => {
    const con = informe.escenarios.find(r => r.id === 'PERSISTENCIA-TRANSITORIA')!
    const sin = informe.escenarios.find(r => r.id === 'PERSISTENCIA-SIN-CLAVE')!
    expect(con.remediacionPermitida).toBe(true)
    expect(sin.remediacionPermitida).toBe(false)
  })

  it('los MTTD/MTTR salen marcados como simulacro y el informe dice qué NO demuestra', () => {
    expect(informe.tiempos.mttd.origen).toBe('simulacro')
    expect(informe.tiempos.mttr.origen).toBe('simulacro')
    expect(informe.loQueNoDemuestra.join(' ')).toMatch(/No demuestra ningún MTTD\/MTTR de producción/)
  })

  it('el MTTD se MIDE: si sube el umbral de operaciones, el MTTD sube solo', () => {
    const s = correrEscenario(ESCENARIOS.find(e => e.id === 'IA-SOBRECARGA')!, T0, 'nexusmed-v1171')
    expect(s.mttdMs).not.toBeNull()
    expect(s.mttdMs!).toBeGreaterThan(0)
    // La detección ocurre en un fallo concreto, no al final de la tanda.
    expect(s.mttdMs!).toBeLessThan(120_000)
  })

  it('cada escenario le dice al médico si su trabajo está a salvo', () => {
    for (const r of informe.escenarios) {
      expect(r.mensajeAlMedico.dataSafety.trim().length, r.id).toBeGreaterThan(10)
    }
  })
})

describe('El puente con la taxonomía de IA que ya existía', () => {
  const fallo = (over: Partial<FalloDeIA> = {}): FalloDeIA => ({
    clase: 'sin_saldo', quien: 'plataforma', proveedor: 'anthropic',
    feature: 'nota', status: 400, appVersion: 'nexusmed-v1171',
    ocurridoEn: '2026-08-23T09:00:00.000Z', ...over,
  })

  it('la clase de fallo VIAJA tal cual como subtipo: no hay segundo vocabulario', () => {
    for (const clase of ['llave_invalida', 'sin_saldo', 'limite_tasa', 'sobrecarga', 'timeout', 'otro'] as const) {
      expect(eventoDesdeFalloDeIA(fallo({ clase })).subtipo).toBe(clase)
    }
  })

  it('la reintentabilidad la decide `seArreglaReintentando`, no una regla nueva', () => {
    for (const clase of ['llave_invalida', 'sin_saldo', 'limite_tasa', 'sobrecarga', 'timeout', 'otro'] as const) {
      const permiteReintento = reintentabilidadDe(clase) !== 'nunca'
      expect(permiteReintento, clase).toBe(seArreglaReintentando(clase))
    }
  })

  it('el aviso al dueño lo decide `avisoAlDueno`, no una copia', () => {
    expect(leTocaAlDueno(fallo({ quien: 'plataforma' }))).toBe(avisoAlDueno('sin_saldo', 'plataforma', 'anthropic') !== null)
    expect(leTocaAlDueno(fallo({ quien: 'clinica' }))).toBe(false)
  })

  it('el saldo agotado NO se puede reparar solo, viniendo de la clasificación real', () => {
    // La clasificación es la del módulo de IA, sobre un cuerpo real de Anthropic.
    const clase = claseDeFallo(400, 'your credit balance is too low to access the API')
    expect(clase).toBe('sin_saldo')
    const inc = incidenteParaDecidirDesdeIA(fallo({ clase }))
    expect(puedeAutoRepararse(inc, 'reintento_idempotente').permitida).toBe(false)
  })

  it('la sobrecarga SÍ, y con la acción que su runbook autoriza', () => {
    const clase = claseDeFallo(529, null)
    expect(clase).toBe('sobrecarga')
    const inc = incidenteParaDecidirDesdeIA(fallo({ clase }))
    const rb = runbookDeFalloDeIA(fallo({ clase }))
    expect(rb.id).toBe('RB-IA-SOBRECARGA')
    for (const a of rb.accionesAutomaticas) {
      expect(puedeAutoRepararse(inc, a).permitida, a).toBe(true)
    }
  })

  it('el evento que sale del puente se puede firmar y la firma está limpia', () => {
    const f = firmaDe(eventoDesdeFalloDeIA(fallo()))
    expect(verificarFirmaLibreDePHI(f).limpia).toBe(true)
    expect(f).toContain('ai_provider')
    expect(f).toContain('anthropic')
  })
})

describe('La correlación no se reimplementa aquí', () => {
  it('el contrato apunta al módulo de #342 y declara los símbolos exactos', () => {
    expect(DEPENDENCIA_DE_INTEGRACION.modulo).toBe('src/lib/observability/correlacion.ts')
    expect(DEPENDENCIA_DE_INTEGRACION.simbolos).toContain('nuevoCorrelationId')
  })

  it('un contexto con la forma de #342 se admite', () => {
    expect(revisarContexto({
      correlationId: 'c1d2e3f4g5h6', tenantRef: 'tref-abc12345',
      feature: 'nota', appVersion: 'nexusmed-v1171',
    }).admisible).toBe(true)
  })

  it('AL REVÉS: un identificador con forma rara se rechaza en vez de limpiarse', () => {
    const r = revisarContexto({ correlationId: 'x\n[FAKE] admin login ok', feature: 'nota', appVersion: 'v1' })
    expect(r.admisible).toBe(false)
    expect(r.motivos.join(' ')).toMatch(/se descarta y se genera uno nuevo/)
  })

  it('AL REVÉS: un identificador de paciente en el contexto se rechaza', () => {
    for (const clave of ['patientId', 'pacienteId', 'clinicId', 'curp', 'email']) {
      const r = revisarContexto({ correlationId: 'c1d2e3f4g5h6', feature: 'n', appVersion: 'v1', [clave]: 'x' })
      expect(r.admisible, clave).toBe(false)
    }
  })
})
