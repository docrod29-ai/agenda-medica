/**
 * GOLDEN — LA TELEMETRÍA NO LLEVA PACIENTES.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El repositorio ya tenía redacción (`src/lib/security/sanitize.ts`): busca
 * CURP, RFC, correos, teléfonos y transcripciones dentro de cualquier objeto y
 * los tapa. Es buena, y es una lista de lo PROHIBIDO.
 *
 * Una lista de lo prohibido siempre va por detrás. El día que alguien añada un
 * campo `motivoConsulta` —texto libre dictado por el paciente— ningún patrón lo
 * caza: no parece un CURP ni un teléfono, parece una frase. Y es PHI.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Preparando el contrato de observabilidad de #310 («correlation IDs, tracing y
 * métricas por inquilino SIN PHI en los registros»): se buscó qué impedía que
 * un campo clínico entrara en un evento de telemetría, y la respuesta era «que
 * a nadie se le ocurra».
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Conjunto CERRADO de campos. Lo que no está en `CAMPOS_PERMITIDOS` hace fallar
 * la validación — no se poda en silencio. Podar en silencio no le enseña nada a
 * quien lo escribió: lo volvería a poner mañana en un sitio que no pase por
 * aquí. Y `sanitize` queda de segunda barrera para el contenido de los valores.
 *
 * De paciente no hay identificador. Ninguno, ni seudonimizado: la unidad de
 * observación es la OPERACIÓN, no la persona.
 *
 * ── LO QUE **NO** CUBRE ──────────────────────────────────────────────────────
 *
 * No garantiza que el resto de la aplicación pase por este contrato: hoy los
 * `console.error` sueltos no lo hacen, y `safeLog` sigue siendo el camino para
 * ésos. Tampoco es criptografía: `seudonimo` es reversible por fuerza bruta con
 * la sal, y su objetivo es que un volcado de métricas SIN la sal no sea un
 * directorio de clientes, no resistir a un adversario con la sal.
 */
import { describe, it, expect } from 'vitest'
import { CAMPOS_PERMITIDOS, seudonimo, validarEvento } from '@/lib/observability/evento'
import { CABECERA_CORRELACION, correlacionDeCabecera, encounterOpId, nuevoCorrelationId } from '@/lib/observability/correlacion'

const BASE = {
  correlationId: 'abc123def456ghjk',
  tenantRef: 'a1b2c3d4e5f60718',
  taskClass: 'hot:guardar-borrador' as const,
  latencyMs: 240,
  outcome: 'ok' as const,
  retryCount: 0,
}

describe('contrato de telemetría', () => {
  it('un evento con sólo campos permitidos pasa', () => {
    const r = validarEvento({ ...BASE })
    expect(r.valido).toBe(true)
  })

  it('un campo clínico de texto libre NO pasa, aunque ningún patrón lo detecte', () => {
    // El caso que la redacción por patrones no puede cazar: parece una frase.
    const r = validarEvento({ ...BASE, motivoConsulta: 'dolor toracico opresivo de 2 horas' })
    expect(r.valido).toBe(false)
    if (!r.valido) expect(r.camposProhibidos).toEqual(['motivoConsulta'])
  })

  it('tampoco pasa un identificador de paciente, ni seudonimizado', () => {
    const r = validarEvento({ ...BASE, patientRef: 'deadbeefdeadbeef' })
    expect(r.valido).toBe(false)
  })

  it('un valor con correo o teléfono dentro de un campo PERMITIDO también se rechaza', () => {
    // Segunda barrera: el campo está permitido, el contenido no.
    const r = validarEvento({ ...BASE, provider: 'proveedor-de mario@ejemplo.mx' })
    expect(r.valido).toBe(false)
    if (!r.valido) expect(r.motivo).toMatch(/patrón identificable/i)
  })

  it('AL REVÉS: si la lista fuese de lo prohibido en vez de lo permitido, el campo clínico entraría', () => {
    const listaNegra = new Set(['patientName', 'curp', 'email'])
    const colado = Object.keys({ ...BASE, motivoConsulta: 'x' }).filter(k => listaNegra.has(k))
    expect(colado).toEqual([])   // no lo caza: por eso la lista es de permitidos
  })

  it('faltar un campo obligatorio es un defecto, no un evento parcial', () => {
    const { retryCount: _omitido, ...sinRetry } = BASE
    const r = validarEvento(sinRetry)
    expect(r.valido).toBe(false)
    if (!r.valido) expect(r.motivo).toMatch(/retryCount/)
  })

  it('latencyMs y retryCount se validan como números sanos', () => {
    expect(validarEvento({ ...BASE, latencyMs: -1 }).valido).toBe(false)
    expect(validarEvento({ ...BASE, latencyMs: Number.NaN }).valido).toBe(false)
    expect(validarEvento({ ...BASE, retryCount: 1.5 }).valido).toBe(false)
  })

  it('la lista de permitidos no contiene ningún campo de persona', () => {
    for (const c of CAMPOS_PERMITIDOS) {
      expect(c).not.toMatch(/patient|paciente|nombre|name|email|phone|telefono|diagnos|medicament|transcrip/i)
    }
  })
})

describe('seudónimo de inquilino', () => {
  it('es estable para el mismo valor y sal', () => {
    expect(seudonimo('clinic_a', 'sal-1')).toBe(seudonimo('clinic_a', 'sal-1'))
  })

  it('cambia con el inquilino y con la sal', () => {
    expect(seudonimo('clinic_a', 'sal-1')).not.toBe(seudonimo('clinic_b', 'sal-1'))
    expect(seudonimo('clinic_a', 'sal-1')).not.toBe(seudonimo('clinic_a', 'sal-2'))
  })

  it('no deja ver el identificador original', () => {
    expect(seudonimo('clinic_muy_reconocible', 'sal')).not.toContain('clinic')
  })
})

describe('correlación', () => {
  it('el identificador nuevo no se deriva de nada del dominio', () => {
    // La firma no acepta semilla de dominio: el error no se puede cometer.
    const id = nuevoCorrelationId(() => 0.5)
    expect(id).toHaveLength(16)
    expect(id).toMatch(/^[a-z0-9]+$/)
  })

  it('una cabecera entrante se hereda saneada', () => {
    const r = correlacionDeCabecera('AbC123-def456gh')
    expect(r.heredado).toBe(true)
    expect(r.correlationId).toBe('abc123-def456gh')
  })

  it('una cabecera con inyección de registro se DESCARTA entera, no se limpia', () => {
    // Limpiándola quedaría `xfakeadminloginok`: inofensivo para el registro y
    // aun así texto elegido por un tercero paseándose por toda la telemetría.
    const r = correlacionDeCabecera('x\n[FAKE] admin login ok', () => 0.5)
    expect(r.heredado).toBe(false)
    expect(r.correlationId).not.toContain('\n')
    expect(r.correlationId).not.toMatch(/fake/i)
  })

  it('una cabecera vacía o demasiado corta genera una nueva en vez de perder el hilo', () => {
    expect(correlacionDeCabecera('', () => 0.5).heredado).toBe(false)
    expect(correlacionDeCabecera('abc', () => 0.5).heredado).toBe(false)
  })

  it('una cabecera enorme se descarta: 5 000 caracteres no son un identificador', () => {
    const r = correlacionDeCabecera('a'.repeat(5000), () => 0.5)
    expect(r.heredado).toBe(false)
    expect(r.correlationId).toHaveLength(16)
  })

  it('el identificador de operación de encuentro es opaco y ordenable', () => {
    expect(encounterOpId('a1b2c3d4', 7)).toBe('a1b2c3d4-0007')
    expect(CABECERA_CORRELACION).toBe('x-ausculta-correlation-id')
  })
})
