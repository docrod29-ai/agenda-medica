import type { NotaMedica } from '@/types/expediente'

/**
 * NOM-024-SSA3-2012 — Integridad del dato.
 * Hash SHA-256 sobre los campos clínicos críticos. Si la nota se altera
 * después de la firma, el hash deja de coincidir → se detecta la alteración.
 *
 * Usa Web Crypto API (crypto.subtle) — disponible en navegador y en
 * Node 18+ / Edge runtime. Sin dependencias externas.
 */

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Serialización ESTABLE: ordena las llaves de todo objeto de forma determinista
 * y omite `undefined`. Es indispensable porque Firestore NO conserva el orden de
 * las llaves de los mapas al recargar la nota; sin esto, el JSON —y por tanto el
 * hash— cambiaría al releer una nota intacta y daría un falso "alterada".
 */
function estable(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(estable)
  if (x && typeof x === 'object') {
    const src = x as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(src).sort()) {
      if (src[k] !== undefined) out[k] = estable(src[k])
    }
    return out
  }
  return x
}

/** Contenido canónico de la nota para hashing (independiente del orden de llaves) */
function contenidoCanonico(nota: NotaMedica): string {
  return JSON.stringify(estable({
    id: nota.metadata.id,
    tipo: nota.tipo,
    pacienteId: nota.pacienteId,
    medicoId: nota.metadata.medicoId,
    fechaConsulta: nota.fechaConsulta,
    secciones: nota.secciones.map(s => ({ k: s.key, v: s.value })),
    diagnosticos: nota.diagnosticos,
    medicamentos: nota.medicamentos,
    alergias: nota.alergias,
    signosVitales: nota.signosVitales ?? null,
  }))
}

/** Versión actual del algoritmo de sello (canonicalización estable). */
export const HASH_VERSION = 2

/** Hash de integridad del contenido clínico (NOM-024) */
export async function generarHashIntegridad(nota: NotaMedica): Promise<string> {
  return sha256Hex(contenidoCanonico(nota))
}

/** Hash de la firma (timestamp + médico + nota) */
export async function generarHashFirma(
  notaId: string,
  medicoId: string,
  timestamp: string,
): Promise<string> {
  return sha256Hex(`${notaId}|${medicoId}|${timestamp}`)
}

export type EstadoIntegridad = 'verificada' | 'alterada' | 'legado' | 'sin-sello'

/**
 * Verifica el sello de una nota firmada.
 * - 'sin-sello': la nota no tiene hash guardado.
 * - 'legado': sello con el algoritmo antiguo (hashVersion ausente/1). No es
 *   re-verificable porque Firestore ya reordenó las llaves; NO implica alteración.
 * - 'verificada' / 'alterada': para sellos estables (hashVersion ≥ 2).
 */
export async function verificarIntegridadEstado(nota: NotaMedica): Promise<EstadoIntegridad> {
  if (!nota.metadata.hashIntegridad) return 'sin-sello'
  if ((nota.metadata.hashVersion ?? 1) < HASH_VERSION) return 'legado'
  const actual = await generarHashIntegridad(nota)
  return actual === nota.metadata.hashIntegridad ? 'verificada' : 'alterada'
}

/** Compat: booleano estricto (true solo si el sello estable coincide). */
export async function verificarIntegridad(nota: NotaMedica): Promise<boolean> {
  return (await verificarIntegridadEstado(nota)) === 'verificada'
}
