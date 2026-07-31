/**
 * UNIDADES — el nombre lo pone el hospital, el TIPO lo entiende el software.
 *
 * ── EL DEFECTO QUE CIERRA ────────────────────────────────────────────────────
 *
 * El listado de UCI decidía quién era paciente crítico con una expresión sobre
 * el TEXTO del servicio: `/uci|intensiv/`. Si un hospital llama a su unidad
 * «UTI», «Terapia Adultos», «5º Norte» o «Torre B», el paciente **no aparecía**
 * en la pantalla de terapia. Sin error y sin aviso.
 *
 * Y al revés: «Terapia Física» habría entrado como terapia intensiva.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * **Nunca se razona sobre el nombre.** El hospital nombra su unidad como quiera
 * y le asigna un `tipo`; el software razona sobre el tipo. Renombrar una unidad
 * no puede cambiar el comportamiento clínico de la aplicación.
 *
 * Es el modelo de HL7/FHIR (`Location` + tipo físico), y es lo único que
 * sobrevive a que cada hospital nombre distinto.
 *
 * ── UN SERVICIO SIN TIPO NO DESAPARECE: SE DECLARA ───────────────────────────
 *
 * Si un servicio no está configurado ni en el catálogo, el resultado es
 * `desconocida` — **no** «no es crítica». La diferencia importa: tratarlo como
 * no-crítico haría desaparecer pacientes de la pantalla en silencio, que es
 * exactamente el defecto que este módulo existe para cerrar. La pantalla tiene
 * que decir «hay N pacientes en servicios sin tipo configurado».
 *
 * ── EL CATÁLOGO ES UNA SUGERENCIA, NO UNA VERDAD ─────────────────────────────
 *
 * `TIPO_SUGERIDO` da un tipo de arranque a los 17 servicios que la aplicación
 * trae de fábrica, para que nada deje de funcionar el día del cambio. Una unidad
 * configurada por el hospital **siempre gana**. Y no se adivina fuera de esa
 * lista: «Terapia» puede ser terapia intensiva o terapia física, y esa la
 * confirma el hospital.
 *
 * Módulo PURO.
 */

import { SERVICIOS_HOSPITAL } from '@/types/hospital'

export const TIPOS_UNIDAD = [
  'critica', 'intermedia', 'piso', 'urgencias', 'quirofano', 'recuperacion', 'otro',
] as const
export type TipoUnidad = (typeof TIPOS_UNIDAD)[number]

export const TIPO_UNIDAD_LABEL: Record<TipoUnidad, string> = {
  critica: 'Cuidados críticos',
  intermedia: 'Cuidados intermedios',
  piso: 'Hospitalización (piso)',
  urgencias: 'Urgencias',
  quirofano: 'Quirófano',
  recuperacion: 'Recuperación',
  otro: 'Otro',
}

/** Una unidad del hospital. `clinics/{c}/unidades/{id}` */
export interface Unidad {
  id: string
  /** Como lo llama el hospital: «5º Norte», «UTI Adultos», «Torre B piso 3». */
  nombre: string
  tipo: TipoUnidad
  activa: boolean
}

/**
 * Tipo de arranque para los 17 servicios de fábrica.
 *
 * **Sugerencia, no verdad.** Sirve para que el día del cambio nada deje de
 * funcionar; en cuanto el hospital configure su unidad, ésta manda.
 */
export const TIPO_SUGERIDO: Readonly<Record<string, TipoUnidad>> = {
  'UCI / Terapia Intensiva': 'critica',
  'Urgencias': 'urgencias',
  'Medicina Interna': 'piso',
  'Cirugía General': 'piso',
  'Pediatría': 'piso',
  'Ginecología y Obstetricia': 'piso',
  'Traumatología y Ortopedia': 'piso',
  'Cardiología': 'piso',
  'Nefrología': 'piso',
  'Neurología': 'piso',
  'Neumología': 'piso',
  'Oncología': 'piso',
  'Infectología': 'piso',
  'Gastroenterología': 'piso',
  'Urología': 'piso',
  'Cuidados Paliativos': 'piso',
  'Otro': 'otro',
}

export type FuenteTipo = 'configurada' | 'catalogo' | 'desconocida'

export interface ResolucionUnidad {
  nombre: string
  /** `null` sólo cuando la fuente es `desconocida`. */
  tipo: TipoUnidad | null
  fuente: FuenteTipo
  unidad: Unidad | null
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Resuelve el tipo de un servicio.
 *
 * Prioridad: **unidad configurada por el hospital** > catálogo de fábrica >
 * desconocida. El nombre se compara COMPLETO y sin distinguir mayúsculas —
 * nunca por subcadena: «Terapia Física» no puede casar con «Terapia Intensiva».
 */
export function resolverUnidad(
  nombreServicio: string | null | undefined,
  unidades: readonly Unidad[] = [],
): ResolucionUnidad {
  const nombre = (nombreServicio ?? '').trim()
  if (nombre === '') {
    return { nombre, tipo: null, fuente: 'desconocida', unidad: null }
  }

  const configurada = unidades.find(u => u.activa && norm(u.nombre) === norm(nombre))
  if (configurada) {
    return { nombre, tipo: configurada.tipo, fuente: 'configurada', unidad: configurada }
  }

  const delCatalogo = Object.keys(TIPO_SUGERIDO).find(k => norm(k) === norm(nombre))
  if (delCatalogo !== undefined) {
    return { nombre, tipo: TIPO_SUGERIDO[delCatalogo], fuente: 'catalogo', unidad: null }
  }

  return { nombre, tipo: null, fuente: 'desconocida', unidad: null }
}

/**
 * ¿Es una unidad de cuidados críticos?
 *
 * **Nunca por el nombre.** Un servicio desconocido devuelve `false` aquí, pero
 * el llamador debe usar `sinTipoConfigurado()` para decirlo en pantalla en vez
 * de dejar al paciente fuera en silencio.
 */
export function esCritica(nombreServicio: string | null | undefined, unidades: readonly Unidad[] = []): boolean {
  return resolverUnidad(nombreServicio, unidades).tipo === 'critica'
}

/**
 * Servicios presentes en el censo que no tienen tipo por ningún lado.
 *
 * Es la lista que la pantalla tiene que mostrar: sin ella, un paciente en una
 * unidad sin configurar desaparece sin que nadie lo sepa.
 */
export function sinTipoConfigurado(
  servicios: readonly (string | null | undefined)[],
  unidades: readonly Unidad[] = [],
): string[] {
  const fuera = new Set<string>()
  for (const s of servicios) {
    const r = resolverUnidad(s, unidades)
    if (r.fuente === 'desconocida' && r.nombre !== '') fuera.add(r.nombre)
  }
  return [...fuera].sort((a, b) => a.localeCompare(b, 'es'))
}

/**
 * Unidades de arranque a partir del catálogo de fábrica, para sembrar la
 * pantalla de configuración. El hospital las renombra y reclasifica; **nada de
 * esto se aplica solo**.
 */
export function unidadesDelCatalogo(): Unidad[] {
  return SERVICIOS_HOSPITAL.map((nombre, i) => ({
    id: `cat-${i}`,
    nombre,
    tipo: TIPO_SUGERIDO[nombre] ?? 'otro',
    activa: true,
  }))
}

export const AVISO_SIN_TIPO =
  'Hay pacientes en servicios sin tipo de unidad configurado. El sistema NO ' +
  'adivina por el nombre —«Terapia» puede ser intensiva o física—, así que no ' +
  'puede saber si son de cuidados críticos. Configúrelos para que aparezcan ' +
  'donde corresponde.'
