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

/** Contenido canónico de la nota para hashing (orden estable) */
function contenidoCanonico(nota: NotaMedica): string {
  return JSON.stringify({
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
  })
}

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

/** Verifica que una nota firmada no haya sido alterada */
export async function verificarIntegridad(nota: NotaMedica): Promise<boolean> {
  if (!nota.metadata.hashIntegridad) return false
  const actual = await generarHashIntegridad(nota)
  return actual === nota.metadata.hashIntegridad
}
