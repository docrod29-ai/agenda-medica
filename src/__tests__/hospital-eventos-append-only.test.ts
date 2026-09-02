import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  proyectarSignos,
  acvpu,
  concienciaExigeReSeleccion,
  proyectarEventos,
  contarAdministracionesVigentes,
  signosComoObservaciones,
  signosVigentesEn,
  serieSignosVigente,
  validarCorreccion,
  construirCorreccion,
  horasEntre,
  POLITICA_CORRECCION,
  type PoliticaCorreccion,
} from '@/lib/hospital/eventos'
import {
  registroDurable,
  saneaDetalle,
  ACCIONES_CON_EVENTO_DURABLE,
  ACCIONES_SIN_EVENTO_DURABLE,
} from '@/lib/hospital/registro-durable'
import { ACCIONES_HOSPITAL_MUTAR } from '@/lib/authz/registro-rutas'
import type { EventoClinicoConId, RegistroSignos } from '@/types/hospital'

/**
 * E0-09 — Eventos hospitalarios críticos APPEND-ONLY.
 *
 * Un hecho registrado no se edita ni se borra: se ANEXA una corrección y el
 * valor erróneo queda visible. Aquí se prueba TODO lo determinista de esa
 * mecánica y se fija que los cuatro huecos clínicos (Q1-Q4) sigan siendo
 * huecos: `null` en producción, nunca un default inventado.
 *
 * Datos 100 % sintéticos. Ningún dato real de paciente.
 */

// ── Fixtures sintéticos ───────────────────────────────────────
const signo = (id: string, extra: Partial<RegistroSignos> = {}): RegistroSignos => ({
  id, fecha: `2026-03-01T0${id.length}:00:00Z`, fc: 80, spo2: 97, ...extra,
})

const ev = (id: string, extra: Partial<EventoClinicoConId> = {}): EventoClinicoConId => ({
  id, tipo: 'administracion', fecha: '2026-03-01T10:00:00Z', por: 'enf@x (enfermeria)', ...extra,
})

describe('E0-09 · proyectarSignos — corrige ANEXANDO, nunca eliminando', () => {
  it('un registro con corrigeA marca el original y NO lo elimina de la salida', () => {
    const raw = [signo('a', { spo2: 80 }), signo('b', { spo2: 96, corrigeA: 'a' })]
    const p = proyectarSignos(raw)

    expect(p.registros).toHaveLength(2)                       // nada desaparece
    expect(p.registros[0].estado).toBe('corregido')
    expect(p.registros[0].corregidoPor).toEqual(['b'])
    expect(p.registros[1].estado).toBe('vigente')
    expect(p.registros[1].corrigeA).toBe('a')
    expect(p.corregidos.has('a')).toBe(true)
  })

  it('cadena A ← B ← C: sólo C queda vigente y ninguno se pierde', () => {
    const raw = [signo('A'), signo('B', { corrigeA: 'A' }), signo('C', { corrigeA: 'B' })]
    const p = proyectarSignos(raw)
    const estado = Object.fromEntries(p.registros.map(r => [r.registro.id, r.estado]))

    expect(estado).toEqual({ A: 'corregido', B: 'corregido', C: 'vigente' })
    expect(p.registros).toHaveLength(3)
  })

  it('corrigeA que se apunta a sí mismo: el enlace se IGNORA, el registro sigue', () => {
    const p = proyectarSignos([signo('x', { corrigeA: 'x' })])
    expect(p.enlacesIgnorados).toEqual(['x'])
    expect(p.registros[0].estado).toBe('vigente')
    expect(p.registros[0].corrigeA).toBeUndefined()
  })

  it('ciclo malformado A↔B: no hay recursión infinita y ambos siguen presentes', () => {
    const p = proyectarSignos([signo('A', { corrigeA: 'B' }), signo('B', { corrigeA: 'A' })])
    expect(p.registros).toHaveLength(2)
    expect(p.enlacesIgnorados.length).toBeGreaterThan(0)
  })

  it('corrección cuyo original quedó FUERA de la ventana: se devuelve, no se descarta', () => {
    // getSignos trae los últimos 200: el original puede no estar cargado.
    const p = proyectarSignos([signo('nuevo', { corrigeA: 'viejo-fuera-de-ventana' })])
    expect(p.huerfanas.map(h => h.id)).toEqual(['nuevo'])
    expect(p.registros[0].huerfana).toBe(true)
    expect(p.registros).toHaveLength(1)
  })

  it('NO muta la entrada ni sus elementos, y el orden se conserva', () => {
    const raw = Object.freeze([
      Object.freeze(signo('a')),
      Object.freeze(signo('b', { corrigeA: 'a' })),
    ]) as readonly RegistroSignos[]
    const copia = JSON.parse(JSON.stringify(raw))

    const p = proyectarSignos(raw)

    expect(JSON.parse(JSON.stringify(raw))).toEqual(copia)
    expect(p.registros.map(r => r.registro.id)).toEqual(['a', 'b'])
  })

  it('serie sin correcciones: todo vigente y sin huérfanas', () => {
    const p = proyectarSignos([signo('a'), signo('b'), signo('c')])
    expect(p.registros.every(r => r.estado === 'vigente')).toBe(true)
    expect(p.corregidos.size).toBe(0)
    expect(p.huerfanas).toEqual([])
  })
})

describe('E0-09/Q1 · RESUELTA — la versión clínicamente vigente entra al cálculo', () => {
  /**
   * GUARDIÁN REESCRITO el 29-jul-2026, no eliminado.
   *
   * Antes exigía que la política valiera `null` y que el cálculo LANZARA: era
   * correcto mientras la pregunta estaba abierta. El médico dueño la respondió
   * dentro de la decisión ICU-Q3, y su respuesta no cabía en el booleano que
   * había, así que ese tipo se retiró. Estos casos congelan la decisión ESCRITA.
   *
   * Fuente: docs/clinical-decisions/DECISIONES-ICU-VOICE-INFUSION-OBSERVATION.md
   */
  const T = (hhmm: string) => `2026-03-01T${hhmm}:00Z`
  const SIN_VENTANA = null

  it('el adaptador NO exige migración: un registro viejo sólo con `fecha` funciona', () => {
    // Compatibilidad hacia atrás — es la condición para poder revertir.
    const viejo = { id: 'v', fecha: T('08:00'), spo2: 95 } as RegistroSignos
    const [o] = signosComoObservaciones([viejo])
    expect(o.fechaEfectiva).toBe(T('08:00'))
    expect(o.fechaRegistro).toBe(T('08:00'))
    expect(o.estado).toBe('CONFIRMED')
  })

  it('un registro apuntado por una corrección se DERIVA como CORRECTED', () => {
    const raw = [
      { id: 'a', fecha: T('08:00'), spo2: 82 },
      { id: 'b', fecha: T('08:03'), spo2: 92, corrigeA: 'a' },
    ] as RegistroSignos[]
    const porId = Object.fromEntries(signosComoObservaciones(raw).map(o => [o.id, o.estado]))
    expect(porId).toEqual({ a: 'CORRECTED', b: 'CONFIRMED' })
  })

  it('EL VALOR CORREGIDO alimenta el cálculo, no el erróneo ← decisión ICU-Q3', () => {
    const raw = [
      { id: 'a', fecha: T('08:00'), fechaEfectiva: T('08:00'), spo2: 82 },
      { id: 'b', fecha: T('08:03'), fechaEfectiva: T('08:00'), fechaRegistro: T('08:03'), spo2: 92, corrigeA: 'a' },
    ] as RegistroSignos[]
    // El retrospectivo de las 08:00 usa 92: es el Ejemplo A del Dr.
    expect(signosVigentesEn(raw, T('08:00'), SIN_VENTANA)?.spo2).toBe(92)
  })

  it('el valor erróneo NO desaparece del expediente', () => {
    const raw = [
      { id: 'a', fecha: T('08:00'), spo2: 82 },
      { id: 'b', fecha: T('08:03'), fechaEfectiva: T('08:00'), spo2: 92, corrigeA: 'a' },
    ] as RegistroSignos[]
    // proyectarSignos sigue devolviéndolos TODOS: el cálculo filtra, el expediente no.
    expect(proyectarSignos(raw).registros).toHaveLength(2)
  })

  it('dos observaciones VÁLIDAS no se pisan: cada instante usa su valor ← Ejemplo B', () => {
    const raw = [
      { id: 'x', fecha: T('08:00'), spo2: 82 },
      { id: 'y', fecha: T('08:10'), spo2: 92 },   // tras intervención, NO corrección
    ] as RegistroSignos[]
    expect(signosVigentesEn(raw, T('08:00'), SIN_VENTANA)?.spo2).toBe(82)
    expect(signosVigentesEn(raw, T('08:05'), SIN_VENTANA)?.spo2).toBe(82)
    expect(signosVigentesEn(raw, T('08:10'), SIN_VENTANA)?.spo2).toBe(92)
    expect(serieSignosVigente(raw).map(r => r.spo2)).toEqual([82, 92])
  })

  it('la ventana temporal sigue siendo OBLIGATORIA (la decisión lo exige)', () => {
    // «No mezclar variables tomadas en horas diferentes sin política explícita.»
    const raw = [{ id: 'a', fecha: T('08:00'), spo2: 95 }] as RegistroSignos[]
    // @ts-expect-error — omitirla es justo lo que se prohíbe
    expect(() => signosVigentesEn(raw, T('09:00'))).toThrowError(/NEEDS_CLINICAL_REVIEW/)
  })

  it('la política binaria vieja YA NO EXISTE (no se puede volver a cablear)', async () => {
    const mod = await import('@/lib/hospital/eventos')
    expect('POLITICA_SIGNOS_EN_CALCULO' in mod).toBe(false)
    expect('signosParaCalculoClinico' in mod).toBe(false)
  })
})

describe('E0-09 · proyectarEventos — el libro `registros`', () => {
  it('una corrección con efecto "anula" deja el original VISIBLE y marcado', () => {
    const raw: EventoClinicoConId[] = [
      ev('e1'),
      ev('c1', { tipo: 'correccion', corrigeEventoId: 'e1', efecto: 'anula', motivo: 'No se administró' }),
    ]
    const p = proyectarEventos(raw)
    expect(p.eventos).toHaveLength(2)
    expect(p.eventos[0].estado).toBe('anulado')
    expect(p.eventos[0].correcciones.map(c => c.id)).toEqual(['c1'])
  })

  it('"aclara" y "sustituye" dejan el evento como corregido, no anulado', () => {
    for (const efecto of ['aclara', 'sustituye'] as const) {
      const p = proyectarEventos([ev('e1'), ev('c', { tipo: 'correccion', corrigeEventoId: 'e1', efecto })])
      expect(p.eventos[0].estado).toBe('corregido')
    }
  })

  it('el conteo de dosis vigentes baja en 1 con una anulación, y sólo con ella', () => {
    const base: EventoClinicoConId[] = [ev('d1'), ev('d2'), ev('d3')]
    expect(contarAdministracionesVigentes(base)).toBe(3)

    const conAnulacion = [...base, ev('c', { tipo: 'correccion', corrigeEventoId: 'd2', efecto: 'anula' })]
    expect(contarAdministracionesVigentes(conAnulacion)).toBe(2)

    const conAclaracion = [...base, ev('c', { tipo: 'correccion', corrigeEventoId: 'd2', efecto: 'aclara' })]
    expect(contarAdministracionesVigentes(conAclaracion)).toBe(3)
  })

  it('corrección cuyo evento original no está en el lote: se conserva como huérfana', () => {
    const p = proyectarEventos([ev('c', { tipo: 'correccion', corrigeEventoId: 'no-cargado', efecto: 'anula' })])
    expect(p.huerfanas.map(h => h.id)).toEqual(['c'])
    expect(p.eventos).toHaveLength(1)
  })

  it('no muta la entrada', () => {
    const raw: EventoClinicoConId[] = [ev('e1'), ev('c1', { tipo: 'correccion', corrigeEventoId: 'e1', efecto: 'anula' })]
    const copia = JSON.parse(JSON.stringify(raw))
    proyectarEventos(raw)
    expect(JSON.parse(JSON.stringify(raw))).toEqual(copia)
  })
})

describe('E0-09 · Q2-Q4 — validación de la corrección (determinista DADA una política)', () => {
  it('la política de corrección YA está decidida (2-sep-2026)', () => {
    /**
     * Este caso afirmaba `toBeNull()`, y tenía razón mientras nadie decidiera:
     * corregir un registro clínico estaba apagado a propósito. El dueño contestó
     * las cuatro preguntas (REG-508) y ahora la afirmación fuerte es la
     * contraria — que NO es null y que dice exactamente lo que él dijo.
     *
     * No se relaja el guardián: se le da el nuevo invariante. Volver a `null`
     * apagaría la corrección otra vez, y eso también debe ponerse rojo.
     */
    expect(POLITICA_CORRECCION).not.toBeNull()
    expect(POLITICA_CORRECCION!.rolesQueAnulanAdministracion).toEqual(['medico'])
    expect(POLITICA_CORRECCION!.motivoObligatorio).toBe(true)
  })

  // POLÍTICA DE PRUEBA — fixture sintético para ejercitar el motor.
  // NO es la política del consultorio: esa la decide el Dr. (Q2, Q3, Q4).
  const FIXTURE: PoliticaCorreccion = {
    rolesQueCorrigen: ['medico', 'enfermeria', 'admin'],
    rolesQueAnulanAdministracion: ['medico', 'admin'],
    ventanaHoras: 24,
    permiteEpisodioEgresado: false,
    motivoObligatorio: true,
  }
  const ctx = {
    rol: 'medico',
    fechaEvento: '2026-03-01T10:00:00Z',
    ahora: '2026-03-01T12:00:00Z',
    esAdministracion: true,
    episodioActivo: true,
  }
  const borrador = { corrigeEventoId: 'e1', efecto: 'aclara' as const, motivo: 'Dato mal capturado' }

  it('caso limpio: se admite', () => {
    expect(validarCorreccion(borrador, ctx, FIXTURE)).toEqual({ ok: true, rechazos: [] })
  })

  it('rol fuera de la lista → rol_no_autorizado', () => {
    const r = validarCorreccion(borrador, { ...ctx, rol: 'recepcion' }, FIXTURE)
    expect(r.ok).toBe(false)
    expect(r.rechazos).toContain('rol_no_autorizado')
  })

  it('anular una ADMINISTRACIÓN exige la lista propia de Q2-bis', () => {
    const anula = { ...borrador, efecto: 'anula' as const }
    expect(validarCorreccion(anula, { ...ctx, rol: 'enfermeria' }, FIXTURE).rechazos)
      .toContain('anulacion_no_autorizada')
    // El mismo rol SÍ puede anular algo que no es una administración.
    expect(validarCorreccion(anula, { ...ctx, rol: 'enfermeria', esAdministracion: false }, FIXTURE).ok)
      .toBe(true)
  })

  it('fuera de la ventana de tiempo → fuera_de_ventana (y dentro, no)', () => {
    const tarde = { ...ctx, ahora: '2026-03-03T12:00:00Z' }   // +50 h
    expect(validarCorreccion(borrador, tarde, FIXTURE).rechazos).toContain('fuera_de_ventana')
    expect(validarCorreccion(borrador, ctx, { ...FIXTURE, ventanaHoras: null }).ok).toBe(true)
    expect(validarCorreccion(borrador, tarde, { ...FIXTURE, ventanaHoras: null }).ok).toBe(true)
  })

  it('episodio egresado → se rechaza salvo que la política lo permita', () => {
    const egresado = { ...ctx, episodioActivo: false }
    expect(validarCorreccion(borrador, egresado, FIXTURE).rechazos).toContain('episodio_egresado')
    expect(validarCorreccion(borrador, egresado, { ...FIXTURE, permiteEpisodioEgresado: true }).ok).toBe(true)
  })

  it('motivo vacío o de puros espacios → motivo_requerido cuando es obligatorio', () => {
    expect(validarCorreccion({ ...borrador, motivo: '   ' }, ctx, FIXTURE).rechazos).toContain('motivo_requerido')
    expect(validarCorreccion({ ...borrador, motivo: undefined }, ctx, FIXTURE).rechazos).toContain('motivo_requerido')
    expect(validarCorreccion({ ...borrador, motivo: '   ' }, ctx, { ...FIXTURE, motivoObligatorio: false }).ok).toBe(true)
  })

  it('acumula TODOS los rechazos: el usuario ve la lista completa, no el primero', () => {
    const r = validarCorreccion(
      { corrigeEventoId: '', efecto: 'anula', motivo: '' },
      { ...ctx, rol: 'recepcion', episodioActivo: false, ahora: '2026-04-01T00:00:00Z' },
      FIXTURE,
    )
    expect(r.rechazos.sort()).toEqual([
      'anulacion_no_autorizada', 'episodio_egresado', 'evento_invalido',
      'fuera_de_ventana', 'motivo_requerido', 'rol_no_autorizado',
    ])
  })

  it('horasEntre devuelve null ante una fecha inválida (y eso rechaza, no admite)', () => {
    expect(horasEntre('no-es-fecha', '2026-03-01T00:00:00Z')).toBeNull()
    expect(validarCorreccion(borrador, { ...ctx, fechaEvento: 'basura' }, FIXTURE).rechazos)
      .toContain('fuera_de_ventana')
  })
})

describe('E0-09 · construirCorreccion — el original NUNCA se toca', () => {
  it('sella fecha y autor del SERVIDOR y no admite los del cliente', () => {
    const c = construirCorreccion(
      { corrigeEventoId: 'e1', efecto: 'anula', motivo: '  Se cargó en el paciente equivocado  ' },
      { ahora: '2026-03-01T12:00:00Z', por: 'dra@x (medico)', porUid: 'uid-1' },
    )
    expect(c).toEqual({
      tipo: 'correccion',
      fecha: '2026-03-01T12:00:00Z',
      por: 'dra@x (medico)',
      porUid: 'uid-1',
      corrigeEventoId: 'e1',
      efecto: 'anula',
      motivo: 'Se cargó en el paciente equivocado',
    })
  })

  it('el motivo en blanco no se guarda como cadena vacía (se omite el campo)', () => {
    const c = construirCorreccion({ corrigeEventoId: 'e1', efecto: 'aclara', motivo: '   ' },
      { ahora: '2026-03-01T12:00:00Z', por: 'x' })
    expect('motivo' in c).toBe(false)
  })

  it('la corrección es un evento NUEVO: no hay camino que edite el original', () => {
    const original = ev('e1')
    const congelado = JSON.parse(JSON.stringify(original))
    const c = construirCorreccion({ corrigeEventoId: original.id, efecto: 'anula', motivo: 'x' },
      { ahora: '2026-03-01T12:00:00Z', por: 'x' })
    expect(JSON.parse(JSON.stringify(original))).toEqual(congelado)
    expect(c.corrigeEventoId).toBe('e1')
  })
})

describe('E0-09 · el libro durable cubre el MAR y las órdenes (H1)', () => {
  const now = '2026-03-01T10:00:00Z'
  const POR = 'Enf. Real (sesión)'

  it('administrar YA produce evento durable (antes devolvía null y el MAR no llegaba al libro)', () => {
    const r = registroDurable('administrar', {
      indId: 'ind-1',
      adm: { estado: 'administrado', cincoCorrectos: true, por: 'FALSO', fecha: '1999-01-01T00:00:00Z' },
    }, now, POR)

    expect(r).toEqual({
      tipo: 'administracion',
      fecha: now,                       // reloj del servidor, no el de la tablet
      por: POR,                         // autor real, no el `por` del cliente
      indicacionId: 'ind-1',
      detalle: { estado: 'administrado', cincoCorrectos: true },
    })
  })

  it('el `detalle` es lista blanca: un campo no declarado no entra al libro legal', () => {
    const r = registroDurable('administrar', {
      indId: 'i', adm: { estado: 'omitido', inyectado: 'malicioso', rol: 'admin' },
    }, now, POR)
    expect(r?.detalle).toEqual({ estado: 'omitido' })
  })

  it('órdenes: alta, suspensión y verificación de farmacia también entran al libro', () => {
    expect(registroDurable('indicacion_agregar',
      { tipo: 'medicamento', descripcion: 'Fármaco X 1 g IV', frecuencia: 'cada 12 h' }, now, POR))
      .toMatchObject({ tipo: 'indicacion_alta', detalle: { tipo: 'medicamento', descripcion: 'Fármaco X 1 g IV' } })

    expect(registroDurable('indicacion_suspender', { indId: 'i', activa: false }, now, POR))
      .toMatchObject({ tipo: 'indicacion_suspension', indicacionId: 'i', detalle: { activa: false } })

    expect(registroDurable('verificar_farmacia', { indId: 'i' }, now, POR))
      .toEqual({ tipo: 'verificacion_farmacia', fecha: now, por: POR, indicacionId: 'i' })
  })

  it('ningún evento durable contiene `undefined` (Firestore lo rechaza)', () => {
    const casos: [string, Record<string, unknown>][] = [
      ['administrar', { adm: {} }],
      ['indicacion_agregar', {}],
      ['indicacion_suspender', {}],
      ['verificar_farmacia', {}],
      ['balance', { ingresos: 100, egresos: 50 }],
    ]
    for (const [accion, p] of casos) {
      const r = registroDurable(accion, p, now, POR) as unknown as Record<string, unknown>
      const indefinidos = Object.entries(r).filter(([, v]) => v === undefined).map(([k]) => k)
      expect(indefinidos, `${accion} emitió campos undefined`).toEqual([])
    }
  })

  it('saneaDetalle acepta sólo escalares serializables', () => {
    const d = saneaDetalle(
      { s: 'txt', n: 3, b: false, nulo: null, nan: NaN, inf: Infinity, obj: { a: 1 }, arr: [1], falta: undefined },
      ['s', 'n', 'b', 'nulo', 'nan', 'inf', 'obj', 'arr', 'falta'],
    )
    expect(d).toEqual({ s: 'txt', n: 3, b: false, nulo: null })
  })

  it('saneaDetalle es robusto ante una fuente que no es objeto', () => {
    for (const basura of [null, undefined, 'texto', 7]) {
      expect(saneaDetalle(basura, ['a'])).toEqual({})
    }
  })
})

describe('E0-09 · COBERTURA: toda acción del gateway está clasificada', () => {
  /**
   * Antes se leía el mapa `GATES` de `hospital/mutar/route.ts` como TEXTO, para no
   * obligar a exportar nada desde una ruta de producción. E0-07 movió esa tabla a
   * `src/lib/authz/registro-rutas.ts` —un módulo PURO, sin Firebase ni next/server—
   * así que ahora se importa: es la misma propiedad («toda acción del gateway está
   * clasificada») comprobada contra el dato real en vez de contra una regex, que es
   * estrictamente más fuerte y no se rompe si cambia el formato del archivo.
   */
  const acciones = Object.keys(ACCIONES_HOSPITAL_MUTAR)

  it('la tabla de acciones del gateway no está vacía (si no, este gate sería de cartón)', () => {
    expect(acciones.length).toBeGreaterThanOrEqual(15)
  })

  it('cada acción del gateway está en CON o en SIN evento durable, nunca en ninguna', () => {
    const sinClasificar = acciones.filter(
      a => !(a in ACCIONES_CON_EVENTO_DURABLE) && !(a in ACCIONES_SIN_EVENTO_DURABLE),
    )
    expect(
      sinClasificar,
      sinClasificar.length
        ? 'Acciones nuevas en el gateway hospital/mutar sin decidir si entran al libro append-only: ' +
          `${sinClasificar.join(', ')}. Añádelas a ACCIONES_CON_EVENTO_DURABLE (con su ` +
          'tipo) o a ACCIONES_SIN_EVENTO_DURABLE (con la razón escrita).'
        : '',
    ).toEqual([])
  })

  it('ninguna acción está clasificada en las dos listas a la vez', () => {
    const ambas = Object.keys(ACCIONES_CON_EVENTO_DURABLE).filter(a => a in ACCIONES_SIN_EVENTO_DURABLE)
    expect(ambas).toEqual([])
  })

  it('las dos listas sólo contienen acciones que existen en el gateway', () => {
    const declaradas = [...Object.keys(ACCIONES_CON_EVENTO_DURABLE), ...Object.keys(ACCIONES_SIN_EVENTO_DURABLE)]
    expect(declaradas.filter(a => !acciones.includes(a))).toEqual([])
  })

  it('cada acción marcada CON evento produce de verdad un evento del tipo declarado', () => {
    for (const [accion, tipo] of Object.entries(ACCIONES_CON_EVENTO_DURABLE)) {
      const r = registroDurable(accion, { adm: {} }, '2026-03-01T10:00:00Z', 'x')
      expect(r, `${accion} no emitió evento durable`).not.toBeNull()
      expect(r?.tipo).toBe(tipo)
    }
  })

  it('cada acción marcada SIN evento devuelve null y trae razón escrita', () => {
    for (const [accion, razon] of Object.entries(ACCIONES_SIN_EVENTO_DURABLE)) {
      expect(registroDurable(accion, {}, '2026-03-01T10:00:00Z', 'x'), accion).toBeNull()
      expect(razon.length, `${accion} sin razón escrita`).toBeGreaterThan(20)
    }
  })
})

// ── utilidad local ────────────────────────────────────────────
/** Archivos .ts/.tsx bajo `src/` que contienen `aguja` (ruta relativa a la raíz). */
function grepRepo(aguja: string): string[] {
  const encontrados: string[] = []
  const raiz = process.cwd()
  const recorrer = (rel: string) => {
    for (const e of readdirSync(resolve(raiz, rel), { withFileTypes: true })) {
      const hijo = `${rel}/${e.name}`
      if (e.isDirectory()) { recorrer(hijo); continue }
      if (!/\.tsx?$/.test(e.name)) continue
      if (readFileSync(resolve(raiz, hijo), 'utf8').includes(aguja)) encontrados.push(hijo)
    }
  }
  recorrer('src')
  return encontrados.sort()
}

/**
 * Corrección de signos vitales — decisión del médico dueño (29-jul-2026).
 *
 * Se corrige SIEMPRE, sin ventana de tiempo, pero conservando el historial: la
 * corrección se ANEXA con `corrigeA` y el original nunca se toca. Estos casos
 * congelan la parte donde un descuido inventaría un dato clínico.
 */
describe('acvpu — traducción del formato heredado', () => {
  it("'alerta' es sinónimo exacto de A y se traduce", () => {
    expect(acvpu('alerta')).toBe('A')
    expect(concienciaExigeReSeleccion('alerta')).toBe(false)
  })

  it.each(['A', 'C', 'V', 'P', 'U'] as const)('%s se conserva tal cual', (v) => {
    expect(acvpu(v)).toBe(v)
    expect(concienciaExigeReSeleccion(v)).toBe(false)
  })

  it("'alterada' EXIGE re-selección: no se puede deducir un nivel ACVPU", () => {
    // El caso peligroso. 'alterada' puede ser C, V, P o U — cuatro niveles que en
    // NEWS2 suman 3 puntos, frente a los 0 de A. Si esto se resolviera en silencio
    // a 'A', corregir un dato NO relacionado (p. ej. la glucosa) convertiría a un
    // paciente con estado alterado en uno alerta y le bajaría el score.
    expect(concienciaExigeReSeleccion('alterada')).toBe(true)
  })

  it('sin dato no exige re-selección (nunca hubo nivel que perder)', () => {
    expect(concienciaExigeReSeleccion(undefined)).toBe(false)
    expect(acvpu(undefined)).toBe('A')
  })
})

describe('proyección de una corrección de signos', () => {
  const original = { id: 's1', fecha: '2026-07-29T08:00:00Z', ta: '180/90', por: 'ENF' }
  const correccion = { id: 's2', fecha: '2026-07-29T08:03:00Z', ta: '80/50', por: 'ENF', corrigeA: 's1' }

  it('el original SIGUE presente y queda marcado como corregido', () => {
    const p = proyectarSignos([original, correccion])
    expect(p.registros).toHaveLength(2)   // nada se borra
    const o = p.registros.find(r => r.registro.id === 's1')!
    expect(o.estado).toBe('corregido')
    expect(o.corregidoPor).toEqual(['s2'])
  })

  it('la corrección apunta al original y queda vigente', () => {
    const p = proyectarSignos([original, correccion])
    const c = p.registros.find(r => r.registro.id === 's2')!
    expect(c.estado).toBe('vigente')
    expect(c.corrigeA).toBe('s1')
    expect(c.huerfana).toBe(false)
  })

  it('no muta la entrada: el original conserva su valor erróneo', () => {
    proyectarSignos([original, correccion])
    expect(original.ta).toBe('180/90')   // el expediente conserva lo capturado
  })
})
