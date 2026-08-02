/**
 * LO QUE EL SERVIDOR ACEPTA COMO UNA DOSIS ADMINISTRADA.
 *
 * ── LO QUE ESTABA ABIERTO ────────────────────────────────────────────────────
 *
 * La ruta guardaba `{ ...(p.adm ?? {}) }`: el objeto del cliente entero, tal
 * cual, dentro del registro de administración de medicamentos. Sella el autor y
 * la hora —eso ya se reparó— pero TODO lo demás pasa sin mirarse.
 *
 * Dos consecuencias, y la segunda es la grave:
 *
 *  1. `cincoCorrectos` e `identidadVerificada` son afirmaciones de enfermería
 *     («verifiqué los 5 correctos», «confirmé el brazalete»). Llegaban del
 *     navegador sin ser booleanos siquiera: una cadena `"no"` es *truthy* y se
 *     lee después como una verificación hecha.
 *
 *  2. `estado` sólo puede ser `administrado` u `omitido`, y nadie lo comprobaba.
 *     El motor del MAR reparte las administraciones en esas dos cubetas
 *     (`lib/uci/mar.ts`): **una dosis con cualquier otro estado no cae en
 *     ninguna**. Desaparece del MAR — la dosis se registró, la enfermera la vio
 *     confirmada en pantalla, y el pase de visita lee «sin administraciones» y
 *     un atraso que no existe. Un fallo de escritura se vería; éste no.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Lista blanca de campos y estado validado en la puerta. Lo que no se entiende
 * se RECHAZA, no se corrige a un valor por omisión: guardar «omitido» porque el
 * estado venía raro es inventar una decisión clínica que nadie tomó.
 *
 * Módulo PURO. El autor, el uid y la hora los sigue poniendo el servidor.
 */
import type { Administracion } from '@/types/hospital'

/** Los dos únicos estados que existen. */
export const ESTADOS_ADMINISTRACION = ['administrado', 'omitido'] as const

/** Lo que el cliente puede decidir de una administración. Nada más. */
export type AdministracionEntrante = Pick<
  Administracion,
  'estado' | 'nota' | 'cincoCorrectos' | 'identidadVerificada'
>

export const MOTIVO_ESTADO_INVALIDO =
  'BLOQUEADO: el estado de la administración no es válido. Sólo se puede ' +
  'registrar «administrado» u «omitido»: una dosis con otro estado desaparece ' +
  'del MAR y el pase de visita leería un atraso que no ocurrió.'

/**
 * Deja pasar sólo lo que el cliente tiene derecho a decidir.
 *
 * @throws si el estado no es uno de los dos válidos.
 */
export function sanearAdministracionEntrante(bruto: unknown): AdministracionEntrante {
  const o = (bruto ?? {}) as Record<string, unknown>

  const estado = String(o.estado ?? '')
  if (!(ESTADOS_ADMINISTRACION as readonly string[]).includes(estado)) {
    throw new Error(MOTIVO_ESTADO_INVALIDO)
  }

  const nota = typeof o.nota === 'string' ? o.nota.trim() : ''

  return {
    estado: estado as Administracion['estado'],
    ...(nota ? { nota } : {}),
    /**
     * `=== true` a propósito. Son afirmaciones de quien administra, y cualquier
     * cosa que no sea un `true` explícito significa que no se afirmó — no que
     * el valor sea raro. Una cadena `"no"` pasaba como verificación hecha.
     */
    cincoCorrectos: o.cincoCorrectos === true,
    identidadVerificada: o.identidadVerificada === true,
  }
}

export const POR_QUE_NO_SE_CORRIGE_SOLO =
  'Porque guardar «omitido» cuando el estado viene raro es inventar una ' +
  'decisión clínica que nadie tomó: omitir una dosis lo decide una persona y ' +
  'queda a su nombre.'
