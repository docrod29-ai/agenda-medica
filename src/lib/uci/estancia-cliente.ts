/**
 * Cliente de la ESTANCIA en UCI (`ICUStay`).
 *
 * Pasa por `/api/uci/estancia` y no por Firestore directo porque `icu_stays`
 * tiene `create, update, delete: if false` en las reglas: la estancia define de
 * qué soportes depende el paciente, y de eso cuelga cómo se adapta la interfaz
 * (charter §32). Es un dato de estructura, no una toma a pie de cama.
 *
 * Compárese con `@/lib/uci/observaciones`, que SÍ escribe desde el navegador:
 * ahí el dato se está tomando y meter un salto al servidor añadiría latencia en
 * el peor momento.
 */

import type { TipoPesoDosificacion } from '@/types/hospital'
import { fetchAutenticado } from '@/lib/auth-client'
import type { ICUStay, SoporteActivo } from '@/types/hospital'

export type EstanciaUciDoc = Partial<ICUStay> & { id: string }

/** La estancia del internamiento, o `null` si todavía no se ha declarado. */
export async function getEstanciaUci(
  clinicId: string, internamientoId: string,
): Promise<EstanciaUciDoc | null> {
  const r = await fetchAutenticado(
    `/api/uci/estancia?clinicId=${encodeURIComponent(clinicId)}` +
    `&internamientoId=${encodeURIComponent(internamientoId)}`)
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo leer la estancia')
  return (await r.json()).estancia ?? null
}

/**
 * Declara los soportes activos.
 *
 * El servidor los valida contra el catálogo y **rechaza** los desconocidos: si
 * entrara texto libre, la pantalla que se adapta a los soportes recibiría
 * valores que no sabe interpretar y ocultaría módulos sin decir por qué.
 */
export async function guardarSoportesUci(
  clinicId: string,
  internamientoId: string,
  soportes: readonly SoporteActivo[],
  pacienteId?: string,
): Promise<EstanciaUciDoc> {
  const r = await fetchAutenticado('/api/uci/estancia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId, internamientoId, pacienteId, soportes }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'No se pudieron guardar los soportes')
  return j.estancia
}


/**
 * FIJA EL PESO DE DOSIFICACIÓN (charter §16).
 *
 * Un solo peso por estancia, a propósito y con su autor —que sella el
 * servidor, no el navegador—. Los soportes viajan porque la ruta los exige en
 * cada escritura; se mandan los que ya están para no borrarlos.
 */
export async function fijarPesoDosificacion(
  clinicId: string,
  internamientoId: string,
  peso: { valorKg: number; tipo: TipoPesoDosificacion },
  soportesActuales: readonly SoporteActivo[],
  pacienteId?: string,
): Promise<EstanciaUciDoc> {
  const r = await fetchAutenticado('/api/uci/estancia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId, internamientoId, pacienteId, soportes: soportesActuales, pesoDosificacion: peso }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'No se pudo fijar el peso de dosificación')
  return j.estancia as EstanciaUciDoc
}
