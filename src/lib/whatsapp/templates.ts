/**
 * Catálogo de plantillas HSM proactivas — Iteración WA-1 · TEMPLATES_AND_WINDOW.
 *
 * Las plantillas se aprueban EN META/360dialog (paso externo del Dr.; ver
 * docs/whatsapp/iteration-06-templates-window.md con el texto exacto a someter).
 * Aquí solo mapeamos los datos del recordatorio a los parámetros POSICIONALES
 * {{1}}..{{n}} del BODY, en el orden en que la plantilla fue aprobada.
 *
 * Puro (sin red/DB) → testeable.
 */

export interface DatosProactivos {
  paciente?: string
  fecha?: string
  hora?: string
  medico?: string
  clinica?: string
  direccion?: string
  telefono?: string
}

export interface PlantillaWa {
  /** Nombre aprobado en Meta (por defecto; la clínica puede sobrescribirlo). */
  name: string
  /** Código de idioma aprobado (p. ej. es_MX). */
  lang: string
  /** Construye los parámetros del BODY en orden {{1}}..{{n}}. */
  construirParametros: (d: DatosProactivos) => string[]
}

export type ClavePlantilla = 'recordatorio24h' | 'recordatorioMismoDia' | 'listaEspera'

/** Plantillas RECOMENDADAS (nombres por defecto). El texto exacto va en la doc. */
export const PLANTILLAS_DEFAULT: Record<ClavePlantilla, PlantillaWa> = {
  recordatorio24h: {
    name: 'recordatorio_cita_24h',
    lang: 'es_MX',
    // {{1}} paciente · {{2}} médico · {{3}} fecha · {{4}} hora · {{5}} clínica
    construirParametros: d => [d.paciente ?? '', d.medico ?? '', d.fecha ?? '', d.hora ?? '', d.clinica ?? ''],
  },
  recordatorioMismoDia: {
    name: 'recordatorio_cita_dia',
    lang: 'es_MX',
    // {{1}} paciente · {{2}} médico · {{3}} hora · {{4}} clínica
    construirParametros: d => [d.paciente ?? '', d.medico ?? '', d.hora ?? '', d.clinica ?? ''],
  },
  listaEspera: {
    name: 'lista_espera_espacio',
    lang: 'es_MX',
    // {{1}} paciente · {{2}} médico · {{3}} fecha · {{4}} hora
    construirParametros: d => [d.paciente ?? '', d.medico ?? '', d.fecha ?? '', d.hora ?? ''],
  },
}

/** Config de plantillas por clínica (en clinics/{id}.whatsapp.plantillas). */
export interface ConfigPlantillasClinica {
  plantillas?: Partial<Record<ClavePlantilla, { name?: string; lang?: string }>>
}

/**
 * Resuelve la plantilla a usar para una clínica y clave. Devuelve null si la
 * clínica NO ha configurado (=aprobado) un nombre para esa clave: sin plantilla
 * aprobada no se puede enviar fuera de la ventana → se omite (no texto libre).
 *
 * Regla dura: solo hay plantilla si la clínica registró explícitamente su
 * `name`. Los defaults son solo la forma/parametrización; el nombre debe venir
 * de la config para garantizar que corresponde a una plantilla REALMENTE aprobada.
 */
export function resolverPlantillaClinica(
  wa: ConfigPlantillasClinica | null | undefined,
  clave: ClavePlantilla,
): PlantillaWa | null {
  const conf = wa?.plantillas?.[clave]
  const name = conf?.name?.trim()
  if (!name) return null
  const base = PLANTILLAS_DEFAULT[clave]
  return { name, lang: conf?.lang?.trim() || base.lang, construirParametros: base.construirParametros }
}
