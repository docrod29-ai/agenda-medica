/**
 * RESTAURAR EL RESPALDO — el camino de vuelta que no existía.
 *
 * ── POR QUÉ ESTE ARCHIVO ES LA MITAD QUE FALTABA ─────────────────────────────
 *
 * v947 dejó el respaldo del consultorio bien: servidor, NDJSON, paginado, con
 * cabecera y pie. Pero **no había importador**. Y un respaldo que no se puede
 * volver a meter no es un respaldo: es un archivo del que nadie sabe si sirve.
 *
 * «Tenemos respaldos» sin una restauración probada es una hipótesis, no un
 * hecho. El propio `scripts/respaldos-verificar.mjs` lo dice al terminar: «falta
 * una cosa que esto no puede comprobar: haber RESTAURADO alguna vez».
 *
 * ── LAS TRES REGLAS QUE ORDENAN LA RESTAURACIÓN ──────────────────────────────
 *
 * 1. **Una línea que no se entiende NO se escribe.** Adivinar dónde va un
 *    documento es peor que dejarlo fuera: lo deja mal puesto y nadie se entera.
 * 2. **Se re-enraíza al consultorio destino, y se DICE.** Un respaldo trae rutas
 *    con el `clinicId` de origen; escribirlas tal cual metería los pacientes de
 *    un consultorio en otro. Se reescribe la raíz y el informe lo declara.
 * 3. **Las llaves de API no entran nunca.** El respaldo las excluye, pero un
 *    archivo editado a mano podría traerlas — y escribir credenciales desde un
 *    archivo subido es exactamente la puerta que no se deja abierta.
 *
 * Módulo PURO: quien escriba en Firestore es la ruta.
 */
import { EXCLUIDAS } from '@/lib/clinica/respaldo'

/** Una línea del NDJSON, ya interpretada. */
export type LineaLeida =
  | { clase: 'cabecera'; datos: Record<string, unknown> }
  | { clase: 'pie'; datos: Record<string, unknown> }
  | { clase: 'documento'; ruta: string; coleccion: string; datos: Record<string, unknown> }
  | { clase: 'rechazada'; porQue: string; crudo: string }

/**
 * LA COLECCIÓN QUE UNA RUTA REPRESENTA DE VERDAD.
 *
 * `clinics/X/patients/P`                       → `patients`
 * `clinics/X/patients/P/notas/N`               → `patients.notas`
 * `clinics/X/patients/P/notas/N/adendas/A`     → `patients.notas.adendas`
 *
 * Se salta `clinics/{id}` y se queda con los segmentos IMPARES, que en Firestore
 * son los nombres de colección. Devuelve `null` si la forma no cuadra, para que
 * el llamador la rechace en vez de inventarse un destino.
 */
export function coleccionDeLaRuta(ruta: string): string | null {
  const partes = String(ruta ?? '').split('/')
  if (partes[0] !== 'clinics' || partes.length < 4 || partes.length % 2 !== 0) return null
  const nombres: string[] = []
  for (let i = 2; i < partes.length; i += 2) {
    if (!partes[i]) return null
    nombres.push(partes[i])
  }
  return nombres.join('.')
}

/**
 * Interpreta una línea del archivo.
 *
 * @returns `rechazada` con su razón cuando no se entiende. Nunca lanza: una
 *   línea rota no puede abortar la restauración de las otras diez mil.
 */
export function leerLinea(crudo: string): LineaLeida | null {
  const t = crudo.trim()
  if (!t) return null
  let o: Record<string, unknown>
  try {
    o = JSON.parse(t) as Record<string, unknown>
  } catch {
    return { clase: 'rechazada', porQue: 'no es JSON válido', crudo: t.slice(0, 120) }
  }
  if (o._tipo === 'cabecera') return { clase: 'cabecera', datos: o }
  if (o._tipo === 'pie') return { clase: 'pie', datos: o }

  const ruta = String(o._ruta ?? '')
  const coleccion = String(o._coleccion ?? '')
  if (!ruta || !coleccion) {
    return { clase: 'rechazada', porQue: 'sin `_ruta` o `_coleccion`: no se sabe dónde va', crudo: t.slice(0, 120) }
  }
  /**
   * La ruta tiene que ser un DOCUMENTO: número par de segmentos, empezando por
   * `clinics/{id}`. Una ruta impar apunta a una colección, y escribir un
   * documento en una colección es inventarle un identificador.
   */
  const partes = ruta.split('/')
  if (partes[0] !== 'clinics' || partes.length < 4 || partes.length % 2 !== 0) {
    return { clase: 'rechazada', porQue: `ruta con forma inesperada: ${ruta}`, crudo: t.slice(0, 120) }
  }
  /**
   * ── LA COLECCIÓN SE DERIVA DE LA RUTA, NO SE CREE LO QUE DECLARA ──────────
   *
   * Aquí se devolvía el `_coleccion` del archivo, y el importador validaba ESE
   * campo mientras escribía en `_ruta`. Los dos vienen del mismo archivo y nada
   * obligaba a que concordaran: un respaldo manipulado podía declarar
   * `_coleccion: "patients"` —inocua y admitida— y apuntar `_ruta` a
   * `clinics/X/patients/P/notas/N`, una **nota firmada**.
   *
   * El importador usa el SDK admin, que **ignora las reglas de Firestore**: la
   * regla que hace inmutable una nota firmada (NOM-024) no se evalúa por este
   * camino. La validación era, literalmente, sobre un campo distinto del que
   * decidía el destino.
   *
   * Derivándola de la ruta, declarar una cosa y escribir en otra deja de ser
   * posible: lo que se valida y lo que se escribe son el mismo dato.
   */
  const derivada = coleccionDeLaRuta(ruta)
  if (!derivada) {
    return { clase: 'rechazada', porQue: `no se pudo derivar la colección de: ${ruta}`, crudo: t.slice(0, 120) }
  }
  const { _ruta, _coleccion, ...datos } = o
  void _ruta; void _coleccion
  return { clase: 'documento', ruta, coleccion: derivada, datos }
}

/**
 * Reescribe la raíz de la ruta al consultorio destino.
 *
 * Un respaldo trae `clinics/<origen>/patients/…`. Escribirlo tal cual metería
 * los pacientes de un consultorio en otro — o los devolvería al de origen, que
 * puede ser justo el que se está intentando reconstruir desde cero.
 */
export function reenraizar(ruta: string, clinicIdDestino: string): string {
  const partes = ruta.split('/')
  partes[1] = clinicIdDestino
  return partes.join('/')
}

export interface Veredicto {
  escribir: boolean
  porQue: string
}

/**
 * ¿Se escribe este documento?
 *
 * `EXCLUIDAS` se consulta en los dos sentidos: lo que no sale en un respaldo
 * tampoco entra por uno. Si algún día se decide respaldar algo que hoy está
 * excluido, las dos mitades cambian a la vez y solas.
 */
export function admitir(coleccion: string): Veredicto {
  const raiz = coleccion.split('.')[0]
  if (raiz in EXCLUIDAS) {
    return {
      escribir: false,
      porQue: `«${raiz}» no se respalda y tampoco se restaura: ${EXCLUIDAS[raiz]}`,
    }
  }
  return { escribir: true, porQue: '' }
}

export interface InformeRestauracion {
  /** Documentos escritos (o que se escribirían, en modo ensayo). */
  escritos: number
  /** Por colección, para poder comparar con el respaldo. */
  porColeccion: Record<string, number>
  /** Líneas que no se entendieron o no se admiten, con su razón. */
  rechazadas: { porQue: string; crudo: string }[]
  /** ¿Traía pie? Sin él, el archivo puede estar cortado a la mitad. */
  archivoCompleto: boolean
  /** El `clinicId` del que salió el respaldo, si la cabecera lo decía. */
  origen: string | null
  /** `true` si se reescribió la raíz porque origen ≠ destino. */
  reenraizado: boolean
}

export const POR_QUE_SOLO_A_CLINICA_VACIA =
  'Restaurar sobre un consultorio que ya tiene datos mezcla dos historias ' +
  'clínicas sin que nadie pueda distinguirlas después. El respaldo se restaura ' +
  'a un consultorio vacío; sobrescribir uno con datos exige pedirlo a propósito.'

export const POR_QUE_UNA_LINEA_ROTA_NO_ABORTA =
  'Una línea corrupta no puede tumbar la restauración de las otras diez mil: ' +
  'ése es el motivo de que el respaldo sea NDJSON y no un JSON único. Se ' +
  'rechaza con su razón y el informe la enseña, porque una restauración que no ' +
  'dice qué se quedó fuera no se puede dar por buena.'
