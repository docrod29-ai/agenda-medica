/**
 * GOLDEN — lo que el sistema PUEDE arreglar solo, y sobre todo lo que no.
 *
 * ── QUÉ PROTEGE ──────────────────────────────────────────────────────────────
 *
 * La instrucción del dueño para #315 fue explícita sobre lo que NO quería: un
 * agente con permiso para hacer cualquier cosa, reintentos infinitos y
 * auto-reparación de contenido clínico.
 *
 * ── CÓMO SE DESCUBRIÓ QUE HACÍA FALTA UNA COMPUERTA ──────────────────────────
 *
 * Buscando reintentos en el repositorio: existen, dispersos y sin presupuesto
 * común. Un `.catch(() => reintentar())` no se puede contar, ni parar, ni
 * auditar; y basta con que dos se llamen entre sí para tener un bucle que nadie
 * escribió.
 *
 * ── CAUSA RAÍZ QUE ESTE GOLDEN VIGILA ────────────────────────────────────────
 *
 * Una lista de acciones PROHIBIDAS siempre va por detrás: la acción nueva no
 * está prohibida, luego está permitida. La compuerta invierte la carga — la
 * acción que no está declarada no se ejecuta — y ese es el invariante que aquí
 * se prueba, incluida la prueba AL REVÉS con acciones destructivas concretas.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · No prueba que ninguna ruta del producto ejecute estas acciones: hoy NADIE
 *   las ejecuta. El kernel decide; el cableado es un handoff.
 * · No cubre Hospital ni UCI.
 * · No prueba la idempotencia REAL de una escritura: prueba que la política
 *   exige que alguien la garantice y que sin esa garantía dice que no.
 */
import { describe, it, expect } from 'vitest'
import {
  CATALOGO, accion, puedeAutoRepararse, accionesElegibles,
  type IncidenteParaDecidir,
} from '@/lib/incidents/remediacion'
import { dimensionesDe } from '@/lib/incidents/taxonomia'
import {
  PRESUPUESTO_POR_OMISION, cerrarIntento, iniciarIntento, nuevoEstado,
  avanzar, transicionLegal, quedaPresupuesto, esperaAntesDe,
} from '@/lib/incidents/maquina'

const inc = (categoria: IncidenteParaDecidir['categoria'], extra: Partial<IncidenteParaDecidir> = {}): IncidenteParaDecidir => ({
  categoria,
  dimensiones: dimensionesDe({ categoria }),
  ...extra,
})

describe('Lo irreversible NUNCA se repara solo', () => {
  const destructivas = [
    'editar_receta', 'editar_nota_firmada', 'aceptar_diagnostico_sugerido',
    'borrar_encuentro', 'cambiar_permisos', 'rotar_llave_de_proveedor',
    'recargar_saldo_de_proveedor', 'reembolsar_cobro',
    'copiar_datos_entre_consultorios', 'desplegar_correccion',
  ]

  it.each(destructivas)('«%s» se rechaza siempre, con cualquier incidente', clave => {
    for (const cat of ['ai_provider', 'persistence', 'ui', 'network', 'scheduling'] as const) {
      const d = puedeAutoRepararse(inc(cat, { idempotenciaGarantizada: true }), clave)
      expect(d.permitida, `${clave} en ${cat}`).toBe(false)
      expect(d.reglas.length).toBeGreaterThan(0)
    }
  })

  it('editar una nota FIRMADA se rechaza por el estado firmado, no sólo por ser irreversible', () => {
    const d = puedeAutoRepararse(inc('persistence', { idempotenciaGarantizada: true }), 'editar_nota_firmada')
    expect(d.reglas).toContain('toca_documento_firmado')
    expect(d.reglas).toContain('toca_verdad_clinica')
  })

  it('cambiar diagnóstico o tratamiento se rechaza por su propia regla', () => {
    expect(puedeAutoRepararse(inc('ai_reasoning'), 'aceptar_diagnostico_sugerido').reglas)
      .toContain('cambia_diagnostico_o_tratamiento')
    expect(puedeAutoRepararse(inc('ai_reasoning'), 'editar_receta').reglas)
      .toContain('cambia_diagnostico_o_tratamiento')
  })

  /** La puerta que cierra la lista blanca: lo que no existe, no pasa. */
  it('AL REVÉS: una acción inventada se rechaza aunque suene inocente', () => {
    const d = puedeAutoRepararse(inc('ui'), 'limpiar_borradores_huerfanos')
    expect(d.permitida).toBe(false)
    expect(d.reglas).toEqual(['accion_desconocida'])
  })

  it('el catálogo declara TODAS sus banderas: ninguna queda sin contestar', () => {
    const banderas = [
      'reversible', 'idempotente', 'tocaVerdadClinica', 'tocaDocumentoFirmado',
      'cambiaDiagnosticoOTratamiento', 'cambiaPermisos', 'rotaSecretos',
      'cobraOReembolsa', 'destruyeDatos', 'implicaGasto', 'cruzaInquilinos', 'soloCliente',
    ]
    for (const a of CATALOGO) {
      for (const b of banderas) {
        expect(typeof (a as unknown as Record<string, unknown>)[b], `${a.clave}.${b}`).toBe('boolean')
      }
    }
  })
})

describe('Lo reversible e idempotente SÍ puede ser elegible', () => {
  it('un reintento idempotente sobre una escritura con clave se permite', () => {
    const d = puedeAutoRepararse({
      categoria: 'persistence',
      dimensiones: { ...dimensionesDe({ categoria: 'persistence' }), reversibilidad: 'reversible' },
      idempotenciaGarantizada: true,
    }, 'reintento_idempotente')
    expect(d.permitida).toBe(true)
  })

  it('AL REVÉS: la MISMA escritura SIN clave de idempotencia se rechaza', () => {
    const d = puedeAutoRepararse({
      categoria: 'persistence',
      dimensiones: { ...dimensionesDe({ categoria: 'persistence' }), reversibilidad: 'reversible' },
      idempotenciaGarantizada: false,
    }, 'reintento_idempotente')
    expect(d.permitida).toBe(false)
    expect(d.reglas).toContain('sin_garantia_de_idempotencia')
  })

  it('reintentar la NOTIFICACIÓN se permite; deshacer la reserva no está ni en el catálogo', () => {
    const notif: IncidenteParaDecidir = {
      categoria: 'notification',
      dimensiones: { ...dimensionesDe({ categoria: 'notification' }), reversibilidad: 'reversible' },
      idempotenciaGarantizada: true,
    }
    expect(puedeAutoRepararse(notif, 'reintentar_notificacion').permitida).toBe(true)
    // No hay ninguna acción que cancele una cita: la cita es el dato, el mensaje el acuse.
    expect(accion('cancelar_cita')).toBeUndefined()
    expect(puedeAutoRepararse(notif, 'borrar_encuentro').permitida).toBe(false)
  })

  it('un incidente de reversibilidad DESCONOCIDA se trata como irreversible', () => {
    const d = puedeAutoRepararse(inc('api', { idempotenciaGarantizada: true }), 'reintento_idempotente')
    expect(dimensionesDe({ categoria: 'api' }).reversibilidad).toBe('desconocida')
    expect(d.permitida).toBe(false)
    expect(d.reglas).toContain('incidente_irreversible')
  })
})

describe('La seguridad nunca se repara sola', () => {
  it.each(['tenant_isolation', 'authorization', 'auth'] as const)(
    'ninguna acción del catálogo es elegible para «%s»', categoria => {
      expect(accionesElegibles(inc(categoria, { idempotenciaGarantizada: true }))).toEqual([])
    })

  it('un incidente de aislamiento se rechaza por categoría, aunque la acción sea inocua', () => {
    const d = puedeAutoRepararse(inc('tenant_isolation', { idempotenciaGarantizada: true }), 'invalidar_cache_caduca')
    expect(d.reglas).toContain('categoria_de_seguridad')
  })
})

describe('El presupuesto de reintento es finito por construcción', () => {
  const t = (n: number) => new Date(Date.parse('2026-08-23T09:00:00.000Z') + n * 1000).toISOString()

  it('agotado el presupuesto, no hay forma de abrir otro intento', () => {
    let e = nuevoEstado('f', t(0))
    e = avanzar(e, 'clasificado', t(1))
    e = avanzar(e, 'agrupado', t(1))
    e = avanzar(e, 'evaluando', t(1))
    e = avanzar(e, 'remediacion_elegible', t(1))
    for (let i = 0; i < PRESUPUESTO_POR_OMISION.maxIntentos; i += 1) {
      const abierto = iniciarIntento(e, 'reintento_idempotente', t(2 + i))
      expect(abierto, `intento ${i + 1}`).not.toBeNull()
      e = cerrarIntento(abierto!.estado, 'fallido', 'simulado', t(3 + i))
    }
    expect(quedaPresupuesto(e)).toBe(0)
    // EL FRENO: no hay parámetro para forzar uno más.
    expect(iniciarIntento(e, 'reintento_idempotente', t(99))).toBeNull()
    expect(e.fase).toBe('requiere_humano')
    expect(e.motivoDeParada).toMatch(/presupuesto agotado/)
  })

  it('un bucle que intenta reparar sin límite se para solo en 3 intentos', () => {
    let e = nuevoEstado('f', t(0))
    e = avanzar(avanzar(avanzar(avanzar(e, 'clasificado', t(1)), 'agrupado', t(1)), 'evaluando', t(1)), 'remediacion_elegible', t(1))
    let vueltas = 0
    for (;;) {
      const abierto = iniciarIntento(e, 'reintento_idempotente', t(vueltas))
      if (!abierto) break
      vueltas += 1
      e = cerrarIntento(abierto.estado, 'fallido', 'simulado', t(vueltas))
      expect(vueltas).toBeLessThanOrEqual(10)   // red de seguridad de la propia prueba
    }
    expect(vueltas).toBe(PRESUPUESTO_POR_OMISION.maxIntentos)
  })

  it('la espera crece pero tiene techo', () => {
    expect(esperaAntesDe(1)).toBe(1000)
    expect(esperaAntesDe(2)).toBe(2000)
    expect(esperaAntesDe(3)).toBe(4000)
    expect(esperaAntesDe(50)).toBe(PRESUPUESTO_POR_OMISION.esperaMaxMs)
  })

  it('AL REVÉS: una transición imposible lanza en vez de colarse', () => {
    const e = nuevoEstado('f', t(0))
    expect(transicionLegal('requiere_humano', 'recuperado')).toBe(false)
    expect(() => avanzar(e, 'resuelto', t(1))).toThrow(/transición ilegal/)
  })

  it('cada intento guarda su razón: «falló 3 veces» no repara nada', () => {
    let e = nuevoEstado('f', t(0))
    e = avanzar(avanzar(avanzar(avanzar(e, 'clasificado', t(1)), 'agrupado', t(1)), 'evaluando', t(1)), 'remediacion_elegible', t(1))
    const abierto = iniciarIntento(e, 'reintento_idempotente', t(2))!
    e = cerrarIntento(abierto.estado, 'fallido', 'sin_saldo', t(3))
    expect(e.intentos[0].razon).toBe('sin_saldo')
    expect(e.intentos[0].numero).toBe(1)
    expect(e.intentos[0].terminadoEn).toBe(t(3))
  })
})
