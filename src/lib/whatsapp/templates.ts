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
  /** Enlace de la reseña (sólo `resena`). */
  enlace?: string
}

export interface PlantillaWa {
  /** Nombre aprobado en Meta (por defecto; la clínica puede sobrescribirlo). */
  name: string
  /** Código de idioma aprobado (p. ej. es_MX). */
  lang: string
  /** Construye los parámetros del BODY en orden {{1}}..{{n}}. */
  construirParametros: (d: DatosProactivos) => string[]
}

export type ClavePlantilla = 'recordatorio24h' | 'recordatorioMismoDia' | 'listaEspera' | 'resena'

/**
 * LO QUE ESTAS PLANTILLAS **NO** PUEDEN LLEVAR HOY: el enlace de la teleconsulta.
 *
 * El recordatorio es el mensaje que le hace llegar al paciente el enlace de su
 * sala de videoconsulta (`api/cron/reminders` firma el token y lo mete en el
 * texto). Pero eso sólo vale por el camino de TEXTO LIBRE, es decir cuando la
 * ventana de servicio de 24 h está abierta — y el caso normal de un recordatorio
 * es justo el contrario: el paciente no ha escrito, la ventana está cerrada, y
 * sale una PLANTILLA HSM.
 *
 * Los parámetros de abajo son los que Meta aprobó: paciente, médico, fecha, hora
 * y consultorio. Ninguno es una URL. Añadir uno no se hace aquí: exige someter y
 * que aprueben una plantilla NUEVA con botón de URL dinámica, y eso es un paso
 * externo del dueño en Meta/360dialog. No se simula, no se mete la URL dentro de
 * un parámetro de texto (Meta lo rechaza) y no se manda texto libre fuera de la
 * ventana (también lo rechaza).
 *
 * ESTADO: OWNER_APPROVAL_REQUIRED. Mientras no exista esa plantilla, el paciente
 * de videoconsulta cuya ventana está cerrada recibe el recordatorio SIN enlace.
 * Se declara aquí en vez de dejarlo pasar en silencio: la ausencia de este dato
 * es una limitación conocida, no una función que ya funciona.
 */
export const ENLACE_TELECONSULTA_NO_CABE_EN_PLANTILLA =
  'Las plantillas HSM aprobadas llevan parámetros de TEXTO (paciente, médico, ' +
  'fecha, hora, consultorio). El enlace de la sala exige una plantilla nueva con ' +
  'botón de URL dinámica, aprobada por Meta: es un paso externo del dueño. ' +
  'Hasta entonces el enlace sólo llega por el camino de texto libre, es decir ' +
  'con la ventana de 24 h abierta.'

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
  /**
   * La solicitud de reseña era el ÚNICO envío del cron que no pasaba por aquí
   * (Panel de Lujo ASM-008): salía como texto libre fuera de la ventana de
   * 24 h, sin plantilla, sin horas de silencio ni tope, y se marcaba
   * «solicitada» aunque el proveedor la rechazara. Ahora es la cuarta clave.
   */
  resena: {
    name: 'solicitud_resena',
    lang: 'es_MX',
    // {{1}} paciente · {{2}} médico · {{3}} enlace
    construirParametros: d => [d.paciente ?? '', d.medico ?? '', d.enlace ?? ''],
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
