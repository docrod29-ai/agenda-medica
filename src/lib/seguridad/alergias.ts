/**
 * Alergias estructuradas — normalización para el cruce de seguridad y FHIR.
 *
 * Mantiene compatibilidad total: si el paciente tiene `alergiasEstructuradas`, se
 * usan; si solo tiene el texto libre `alergias`, se parsea a la misma forma. Así el
 * cruce alergia↔medicamento y el AllergyIntolerance FHIR trabajan siempre sobre una
 * lista estructurada, sin obligar a re-capturar.
 *
 * PURO → testeable.
 */

import type { AlergiaEstructurada } from '@/types'

/** Divide un texto libre de alergias en alérgenos ("Penicilina, Sulfas; Mariscos"). */
export function parsearAlergiasTexto(texto: string | undefined): AlergiaEstructurada[] {
  if (!texto?.trim()) return []
  return texto
    .split(/[,;/]+|\ny\b/)
    .map(a => a.trim())
    .filter(Boolean)
    .map(alergeno => ({ alergeno }))
}

/**
 * Devuelve las alergias estructuradas efectivas de un paciente: las explícitas si
 * existen, si no, las derivadas del texto libre. Deduplica por alérgeno.
 */
export function alergiasDe(p: { alergias?: string; alergiasEstructuradas?: AlergiaEstructurada[] }): AlergiaEstructurada[] {
  const base = (p.alergiasEstructuradas && p.alergiasEstructuradas.length)
    ? p.alergiasEstructuradas.filter(a => a?.alergeno?.trim())
    : parsearAlergiasTexto(p.alergias)
  const vistos = new Set<string>()
  const out: AlergiaEstructurada[] = []
  for (const a of base) {
    const k = a.alergeno.trim().toLowerCase()
    if (!k || vistos.has(k)) continue
    vistos.add(k)
    out.push({ ...a, alergeno: a.alergeno.trim() })
  }
  return out
}

/** ¿Hay alguna alergia grave registrada? (para resaltar en la UI/receta). */
export function tieneAlergiaGrave(p: { alergias?: string; alergiasEstructuradas?: AlergiaEstructurada[] }): boolean {
  return alergiasDe(p).some(a => a.severidad === 'grave')
}
