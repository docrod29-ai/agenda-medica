/**
 * EL BLOQUE HOSPITALARIO DE LA NOTA: DECLARADO, SELLADO Y SIEMPRE VACÍO.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `NotaMedica.hospital` existe en el modelo desde que existe el módulo de
 * hospitalización, y **entra en el hash de integridad** (`integrity.ts` lo
 * incluye entre los campos sellados, y la lista de campos protegidos lo nombra).
 * O sea: la nota firmada se sella prometiendo que ese bloque es inmutable.
 *
 * Pero **nadie lo escribe**. Ni una pantalla, ni una ruta, ni el ensamblado de
 * la nota. Se sella un hueco.
 *
 * El resultado es una nota de hospital que **no dice en qué servicio ni en qué
 * cama estaba el paciente, ni qué día de internamiento era** — datos que la
 * propia aplicación ya tiene en el episodio, a un identificador de distancia
 * (`nota.internamientoId`).
 *
 * Es el mismo patrón que ya salió con el motor de dosis y con «rango horario
 * preferido», en su forma de dato: **un campo que el sistema promete y nunca
 * llena**.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * **No rellena `condicion`.** «Estable / grave / crítico» es un juicio clínico
 * del médico que escribe la nota, no algo que se derive del episodio. Un campo
 * vacío es honesto; un «estable» puesto por un programa es una afirmación
 * médica que nadie hizo.
 *
 * Tampoco toca el balance hídrico: lo registra enfermería y tiene su propio
 * camino.
 *
 * Módulo PURO.
 */

/** Lo que hace falta del episodio. Se pide lo mínimo, no el documento entero. */
export interface EpisodioParaNota {
  servicio?: string
  cama?: string
  fechaIngreso?: string
  fechaEgreso?: string
  estado?: string
}

export interface BloqueHospital {
  servicio?: string
  cama?: string
  diaHospitalizacion?: number
  fechaIngreso?: string
  fechaEgreso?: string
}

const texto = (v: unknown): string | undefined => {
  const t = String(v ?? '').trim()
  return t === '' ? undefined : t
}

/**
 * En qué día de internamiento cae una fecha.
 *
 * ── POR QUÉ SE CUENTA POR DÍAS DE CALENDARIO ─────────────────────────────────
 *
 * El día de hospitalización es el que se dice en el pase de visita: quien
 * ingresó ayer a las 23:00 y es visto hoy a las 08:00 está en su **día 2**, no
 * en «9 horas». Contar por horas transcurridas daría 0 y contradiría al pizarrón
 * del servicio.
 *
 * Es una cuenta de calendario, no un umbral clínico: no decide nada, sólo
 * numera lo que el equipo ya numera en voz alta.
 *
 * @returns el día (1 = el del ingreso) o `undefined` si no se puede calcular.
 */
export function diaDeHospitalizacion(
  fechaIngreso: string | undefined | null,
  ahoraISO: string,
): number | undefined {
  const ing = Date.parse(String(fechaIngreso ?? ''))
  const hoy = Date.parse(String(ahoraISO ?? ''))
  if (!Number.isFinite(ing) || !Number.isFinite(hoy)) return undefined
  // A medianoche local de cada fecha: lo que cuenta es cuántas veces cambió el día.
  const aDia = (ms: number) => { const d = new Date(ms); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) }
  const dias = Math.round((aDia(hoy) - aDia(ing)) / 86_400_000)
  // Una nota fechada ANTES del ingreso no tiene día de internamiento: es un dato
  // incoherente, y ponerle «día 1» sería inventar una coherencia que no hay.
  if (dias < 0) return undefined
  return dias + 1
}

/**
 * Arma el bloque hospitalario de la nota a partir del episodio.
 *
 * Todo lo que no venga en el episodio queda **ausente**, no en blanco: un
 * `servicio: ''` en un documento sellado dice «no tiene servicio», y lo cierto
 * es «no se sabe».
 *
 * @returns el bloque, o `undefined` si no hay nada que decir — porque un objeto
 *   vacío dentro de la nota firmada es exactamente el hueco que se está
 *   reparando.
 */
export function bloqueHospitalDe(
  ep: EpisodioParaNota | null | undefined,
  ahoraISO: string,
): BloqueHospital | undefined {
  if (!ep) return undefined
  const bloque: BloqueHospital = {}
  const servicio = texto(ep.servicio)
  const cama = texto(ep.cama)
  const ingreso = texto(ep.fechaIngreso)
  const egreso = texto(ep.fechaEgreso)
  if (servicio) bloque.servicio = servicio
  if (cama) bloque.cama = cama
  if (ingreso) bloque.fechaIngreso = ingreso
  if (egreso) bloque.fechaEgreso = egreso
  const dia = diaDeHospitalizacion(ingreso, ahoraISO)
  if (dia !== undefined) bloque.diaHospitalizacion = dia
  return Object.keys(bloque).length > 0 ? bloque : undefined
}

/** Una línea para el encabezado del impreso. Vacía si no hay nada que poner. */
export function encabezadoHospital(b: BloqueHospital | undefined): string {
  if (!b) return ''
  const partes: string[] = []
  if (b.servicio) partes.push(`Servicio: ${b.servicio}`)
  if (b.cama) partes.push(`Cama: ${b.cama}`)
  if (b.diaHospitalizacion !== undefined) partes.push(`Día de hospitalización: ${b.diaHospitalizacion}`)
  return partes.join(' · ')
}

export const POR_QUE_NO_SE_INFIERE_LA_CONDICION =
  'Estable, grave o crítico es un juicio del médico que escribe la nota. Un ' +
  'campo vacío es honesto; un «estable» puesto por un programa es una ' +
  'afirmación médica que nadie hizo, dentro de un documento que se firma.'
