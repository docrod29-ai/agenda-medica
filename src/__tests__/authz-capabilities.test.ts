import { describe, it, expect } from 'vitest'
import {
  CAPACIDADES, CAPACIDADES_POR_ROL, ROLES, ROLES_ASIGNABLES, ROLES_NO_CLINICOS,
  capacidadesDe, tieneCapacidad, rolesCon, rolesDe, GUARDA_EQUIVALENTE,
  type Capacidad, type Rol,
} from '@/lib/authz/capabilities'
import { ACCIONES_HOSPITAL_MUTAR } from '@/lib/authz/registro-rutas'
import { permisosPorRol, type Permisos } from '@/lib/permissions'

/**
 * Núcleo de capacidades (unidad Nexus OS E0-07). SIN MOCKS: `capabilities.ts` es un
 * módulo puro a propósito, así que aquí no hay Firebase ni `next/server`.
 *
 * Lo que este archivo defiende NO es la tabla en sí (una tabla se puede escribir
 * mal), son los INVARIANTES:
 *  · la tabla coincide con `rolesDe()` de E0-06, que es la transcripción PROBADA de
 *    `firestore.rules` — así la matriz no se justifica con prosa,
 *  · migrar una ruta de `verificarMedico` a una capacidad NO cambia el conjunto de
 *    roles autorizados (oráculos copiados literales de lo que había antes),
 *  · y cuando una capacidad amplía respecto al gate viejo, la ampliación solo
 *    alcanza roles que HOY NO SON ASIGNABLES, o sea a nadie real.
 */

/** Comparación de conjuntos: el orden de las listas de roles no es significativo. */
function mismoConjunto(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')
}

describe('E0-07 · catálogo de capacidades cerrado', () => {
  it('cada capacidad la tiene al menos un rol (nada declarado y muerto)', () => {
    const huerfanas = CAPACIDADES.filter(c => rolesCon(c).length === 0)
    expect(huerfanas, `capacidades que nadie tiene: ${huerfanas.join(', ')}`).toEqual([])
  })

  it('ningún rol declara una capacidad fuera del catálogo', () => {
    const catalogo = new Set<string>(CAPACIDADES)
    const invenciones: string[] = []
    for (const rol of ROLES) {
      for (const c of CAPACIDADES_POR_ROL[rol]) if (!catalogo.has(c)) invenciones.push(`${rol}:${c}`)
    }
    expect(invenciones).toEqual([])
  })

  it('la matriz cubre EXACTAMENTE los roles canónicos de E0-06 (ni uno más, ni uno menos)', () => {
    expect(mismoConjunto(Object.keys(CAPACIDADES_POR_ROL), ROLES)).toBe(true)
  })

  it('ningún rol repite una capacidad (una tabla con duplicados esconde una edición a medias)', () => {
    for (const rol of ROLES) {
      const lista = CAPACIDADES_POR_ROL[rol]
      expect(new Set(lista).size, rol).toBe(lista.length)
    }
  })

  it('ROLES_ASIGNABLES es un subconjunto real de ROLES y deja fuera solo a los roles fantasma', () => {
    for (const r of ROLES_ASIGNABLES) expect(ROLES).toContain(r)
    const noAsignables = ROLES.filter(r => !ROLES_ASIGNABLES.includes(r))
    expect(mismoConjunto(noAsignables, ['recepcion', 'facturacion'])).toBe(true)
  })
})

describe('E0-07 · mínimo privilegio ante datos ausentes', () => {
  it('rol nulo, indefinido o desconocido → NINGUNA capacidad', () => {
    expect(capacidadesDe(null)).toEqual([])
    expect(capacidadesDe(undefined)).toEqual([])
    expect(capacidadesDe('')).toEqual([])
    expect(capacidadesDe('director-general')).toEqual([])
  })

  it('tieneCapacidad falla-CERRADO con cualquiera de esos valores', () => {
    for (const rol of [null, undefined, '', 'director-general', 'MEDICO']) {
      for (const c of CAPACIDADES) expect(tieneCapacidad(rol, c), `${rol}/${c}`).toBe(false)
    }
  })
})

describe('E0-07 · no hay escalada de privilegios', () => {
  const SOLO_MEDICO_ADMIN: Capacidad[] = ['administrar', 'firmar', 'prescribir', 'clinico.escribir']

  it.each(SOLO_MEDICO_ADMIN)('%s es exclusiva de medico/admin', (c) => {
    expect(mismoConjunto(rolesCon(c), ['admin', 'medico'])).toBe(true)
  })

  it('ningún rol NO CLÍNICO puede leer ni escribir contenido clínico (aceptación de E0-06)', () => {
    for (const rol of ROLES_NO_CLINICOS) {
      expect(capacidadesDe(rol), rol).not.toContain('clinico.leer')
      expect(capacidadesDe(rol), rol).not.toContain('clinico.escribir')
    }
  })
})

describe('E0-07 · puente con E0-06: la matriz NO se inventa, se deriva de firestore.rules', () => {
  it('`clinico.escribir` es exactamente `isMedico`', () => {
    expect(GUARDA_EQUIVALENTE['clinico.escribir']).toBe('isMedico')
    expect(mismoConjunto(rolesCon('clinico.escribir'), rolesDe('isMedico'))).toBe(true)
  })

  it('`clinico.leer` es exactamente `isClinicoHospital`', () => {
    expect(GUARDA_EQUIVALENTE['clinico.leer']).toBe('isClinicoHospital')
    expect(mismoConjunto(rolesCon('clinico.leer'), rolesDe('isClinicoHospital'))).toBe(true)
  })

  it('`auditoria.registrar` es un «todos» DECLARADO, no un any-member implícito', () => {
    // Estrecharla perdería entradas de bitácora EN SILENCIO (el cliente no muestra
    // el fallo): daño invisible sobre el rastro NOM-024.
    expect(mismoConjunto(rolesCon('auditoria.registrar'), ROLES)).toBe(true)
  })
})

describe('E0-07 · Fase B: migrar `verificarMedico` no cambia quién pasa', () => {
  /**
   * ORÁCULO: las 18 llamadas a `verificarMedico` que existían antes de esta unidad,
   * con la capacidad a la que se migró cada una. `verificarMedico` autorizaba
   * exactamente {medico, admin} en las 18.
   */
  const FASE_B: ReadonlyArray<readonly [string, Capacidad]> = [
    ['clinic/ai-keys POST', 'administrar'],
    ['clinic/whatsapp-disconnect POST', 'administrar'],
    ['facturacion/solicitar POST', 'facturar'],
    ['fhir/paciente/[patientId] GET', 'clinico.escribir'],
    ['mantenimiento/backfill-contadores POST', 'administrar'],
    ['receta/verificacion-url POST', 'firmar'],
    ['stripe/asientos POST', 'administrar'],
    ['stripe/checkout POST', 'administrar'],
    ['stripe/portal POST', 'administrar'],
    ['stripe/recarga POST', 'administrar'],
    ['telesalud/token POST', 'clinico.escribir'],
    ['voz/comandos-config GET', 'administrar'],
    ['voz/comandos-config POST', 'administrar'],
    ['whatsapp/360dialog-connect POST', 'administrar'],
    ['whatsapp/manual-connect POST', 'administrar'],
    ['whatsapp/meta-connect POST', 'administrar'],
    ['whatsapp/plantillas-config GET', 'administrar'],
    ['whatsapp/plantillas-config POST', 'administrar'],
  ]

  /** La única fila que AMPLÍA, y solo hacia un rol que hoy nadie puede tener. */
  const AMPLIAN = new Set(['facturacion/solicitar POST'])

  it('el oráculo tiene las 18 llamadas contadas en el diseño', () => {
    expect(FASE_B.length).toBe(18)
  })

  it.each(FASE_B)('%s no pierde a medico ni a admin', (_ruta, capacidad) => {
    expect(rolesCon(capacidad)).toContain('admin')
    expect(rolesCon(capacidad)).toContain('medico')
  })

  it.each(FASE_B.filter(([r]) => !AMPLIAN.has(r)))('%s es NEUTRA: sigue siendo {medico, admin}', (_ruta, capacidad) => {
    expect(mismoConjunto(rolesCon(capacidad), ['admin', 'medico'])).toBe(true)
  })

  /**
   * AMPLIACIONES DECIDIDAS POR EL DUEÑO, UNA POR UNA.
   *
   * La invariante original era «ninguna ampliación alcanza a un usuario real»:
   * la política se escribía completa sin dar acceso a nadie todavía. Eso ya no
   * es cierto, y no por descuido — el 2026-08-01 el médico dueño resolvió la
   * pregunta que el propio registro de rutas dejó abierta («Q4: ¿la asistente
   * descarga CFDI o sólo cobra?»): la asistente FACTURA.
   *
   * El razonamiento: cobrar y no poder timbrar el CFDI del cobro que acabas de
   * registrar era un corte artificial. Es el mismo trabajo, en el mismo
   * mostrador, y la factura la pide el paciente ahí mismo.
   *
   * Cada excepción se lista con su fecha y su motivo. Una ampliación que NO
   * esté aquí sigue rompiendo la prueba, que es justo lo que se quiere: nadie
   * gana acceso por accidente ni por un refactor.
   */
  const AMPLIACIONES_AUTORIZADAS: Record<string, { rol: Rol; decidido: string; porQue: string }[]> = {
    'facturacion/solicitar POST': [{
      rol: 'secretaria',
      decidido: '2026-08-01',
      porQue: 'El dueño resolvió Q4: la asistente factura, no sólo cobra. Timbrar el CFDI del cobro que acaba de registrar es el mismo trabajo.',
    }],
  }

  it('INVARIANTE: ninguna ampliación alcanza a un usuario real sin decisión escrita', () => {
    const rolesHoy = new Set<Rol>(['admin', 'medico'])
    for (const [ruta, capacidad] of FASE_B) {
      const ganan = rolesCon(capacidad).filter(r => !rolesHoy.has(r))
      const autorizadas = new Set((AMPLIACIONES_AUTORIZADAS[ruta] ?? []).map(a => a.rol))
      for (const r of ganan) {
        if (autorizadas.has(r)) continue
        expect(ROLES_ASIGNABLES, `${ruta} amplía a ${r}, que SÍ es asignable, y no hay decisión escrita`).not.toContain(r)
      }
    }
  })

  it('toda ampliación autorizada sigue vigente (si se revierte, sobra la excepción)', () => {
    // Si alguien quita la capacidad y olvida borrar la excepción, esta prueba lo
    // dice: una lista de permisos con excepciones muertas deja de leerse.
    for (const [ruta, casos] of Object.entries(AMPLIACIONES_AUTORIZADAS)) {
      const capacidad = FASE_B.find(([r]) => r === ruta)?.[1]
      expect(capacidad, `${ruta} ya no está en FASE_B: borra la excepción`).toBeDefined()
      for (const c of casos) {
        expect(rolesCon(capacidad!), `${ruta}: la excepción para ${c.rol} ya no aplica`).toContain(c.rol)
      }
    }
  })
})

describe('E0-07 · Fase C: `hospital/mutar` traduce GATES 1:1', () => {
  /**
   * ORÁCULO copiado LITERAL del mapa `GATES` que vivía en
   * `src/app/api/hospital/mutar/route.ts` antes de esta unidad. No se toca: es la
   * única no-regresión disponible para el pase de visita de enfermería y la
   * verificación de farmacia.
   */
  const GATES_VIEJO: Readonly<Record<string, string[]>> = {
    crear:                 ['medico', 'admin'],
    egresar:               ['medico', 'admin'],
    trasladar:             ['medico', 'admin'],
    cambiar_tratante:      ['medico', 'admin'],
    indicacion_agregar:    ['medico', 'admin'],
    indicacion_suspender:  ['medico', 'admin'],
    indicacion_editar:     ['medico', 'admin'],
    indicacion_borrar:     ['medico', 'admin'],
    interconsulta_agregar: ['medico', 'admin'],
    interconsulta_responder: ['medico', 'admin'],
    interconsulta_editar:  ['medico', 'admin'],
    interconsulta_borrar:  ['medico', 'admin'],
    conciliar:             ['medico', 'admin'],
    administrar:           ['enfermeria', 'medico', 'admin'],
    balance:               ['enfermeria', 'medico', 'admin'],
    escala:                ['enfermeria', 'medico', 'admin'],
    sbar:                  ['enfermeria', 'medico', 'admin'],
    verificar_farmacia:    ['farmacia', 'medico', 'admin'],
  }

  it('el oráculo tiene 18 acciones (un oráculo con el número mal delata que se copió a ojo)', () => {
    expect(Object.keys(GATES_VIEJO).length).toBe(18)
  })

  it('el mapa nuevo cubre exactamente las mismas acciones', () => {
    expect(mismoConjunto(Object.keys(ACCIONES_HOSPITAL_MUTAR), Object.keys(GATES_VIEJO))).toBe(true)
  })

  it.each(Object.keys(GATES_VIEJO))('acción `%s`: mismos roles antes y después', (accion) => {
    const capacidad = ACCIONES_HOSPITAL_MUTAR[accion]
    expect(capacidad, `la acción ${accion} no tiene capacidad declarada`).toBeTruthy()
    expect(
      mismoConjunto(rolesCon(capacidad), GATES_VIEJO[accion]),
      `${accion}: antes ${GATES_VIEJO[accion].join(',')} · ahora ${rolesCon(capacidad).join(',')}`,
    ).toBe(true)
  })
})

describe('E0-07 · `permissions.ts` DERIVA de la matriz sin cambiar una casilla', () => {
  /**
   * ORÁCULO: la tabla de `permissions.ts` tal como estaba antes de derivarla.
   * `permisosPorRol` no tiene consumidores en producción (solo tests), pero si algún
   * día se cablea no puede decir lo contrario que la autorización real — y esta
   * unidad no está autorizada a cambiar su semántica de paso.
   */
  const ESPERADO: Readonly<Record<Rol, Permisos>> = {
    admin: {
      verAgenda: true, editarAgenda: true, verExpediente: true, editarExpediente: true,
      firmarNota: true, verCRM: true, verFinanzas: true, configurarClinica: true,
      invitarMiembros: true, moderarResenas: true, manejarPagos: true, cobrarPagos: true,
    },
    medico: {
      verAgenda: true, editarAgenda: true, verExpediente: true, editarExpediente: true,
      firmarNota: true, verCRM: true, verFinanzas: true, configurarClinica: true,
      invitarMiembros: true, moderarResenas: true, manejarPagos: false, cobrarPagos: true,
    },
    /**
     * `manejarPagos: true` desde el 2026-08-01 por decisión del médico dueño:
     * la asistente FACTURA, no sólo cobra. Cobrar y no poder timbrar el CFDI
     * del cobro que acaba de registrar era un corte artificial — mismo trabajo,
     * mismo mostrador, y el paciente pide la factura ahí mismo.
     *
     * `verFinanzas` se enciende como consecuencia, y es lo correcto: el CORTE
     * DE CAJA vive en esa pantalla y es trabajo del mostrador — quien cuenta el
     * cajón al cerrar tiene que poder ver lo que cobró.
     *
     * Lo que NO cambia: `verExpediente` y `editarExpediente` siguen en false.
     * La ampliación es administrativa, no clínica.
     */
    secretaria: {
      verAgenda: true, editarAgenda: true, verExpediente: false, editarExpediente: false,
      firmarNota: false, verCRM: true, verFinanzas: true, configurarClinica: false,
      invitarMiembros: false, moderarResenas: false, manejarPagos: true, cobrarPagos: true,
    },
    recepcion: {
      verAgenda: true, editarAgenda: true, verExpediente: false, editarExpediente: false,
      firmarNota: false, verCRM: false, verFinanzas: false, configurarClinica: false,
      invitarMiembros: false, moderarResenas: false, manejarPagos: false, cobrarPagos: false,
    },
    facturacion: {
      verAgenda: true, editarAgenda: false, verExpediente: false, editarExpediente: false,
      firmarNota: false, verCRM: false, verFinanzas: true, configurarClinica: false,
      invitarMiembros: false, moderarResenas: false, manejarPagos: true, cobrarPagos: true,
    },
    enfermeria: {
      verAgenda: false, editarAgenda: false, verExpediente: false, editarExpediente: false,
      firmarNota: false, verCRM: false, verFinanzas: false, configurarClinica: false,
      invitarMiembros: false, moderarResenas: false, manejarPagos: false, cobrarPagos: false,
    },
    farmacia: {
      verAgenda: false, editarAgenda: false, verExpediente: false, editarExpediente: false,
      firmarNota: false, verCRM: false, verFinanzas: false, configurarClinica: false,
      invitarMiembros: false, moderarResenas: false, manejarPagos: false, cobrarPagos: false,
    },
    laboratorio: {
      verAgenda: false, editarAgenda: false, verExpediente: false, editarExpediente: false,
      firmarNota: false, verCRM: false, verFinanzas: false, configurarClinica: false,
      invitarMiembros: false, moderarResenas: false, manejarPagos: false, cobrarPagos: false,
    },
  }

  it.each(ROLES)('%s conserva sus 12 permisos exactamente', (rol) => {
    expect(permisosPorRol(rol)).toEqual(ESPERADO[rol])
  })

  it('ASIMETRÍA DELIBERADA: en el servidor un rol ausente no tiene NADA, pero el helper de UX sigue devolviendo RECEPCION', () => {
    // `permisosPorRol` es capa de presentación: devolver undefined reventaría a
    // cualquier llamador que haga `.verAgenda`. La decisión de acceso real la toma
    // `capacidadesDe`, que ante lo mismo devuelve [].
    for (const rol of [null, undefined, 'director-general']) {
      expect(permisosPorRol(rol)).toEqual(ESPERADO.recepcion)
      expect(capacidadesDe(rol)).toEqual([])
    }
  })
})
