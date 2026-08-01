/**
 * EL CATÁLOGO DE PLANES — para poder cambiar un precio sin reprogramar la app.
 *
 * ── EL PROBLEMA ──────────────────────────────────────────────────────────────
 *
 * `PLANES` vive en el código. Ya no está disperso —eso se arregló— pero sigue
 * siendo código: subir el plan Clínica de $899 a $949 exige que alguien edite un
 * archivo, compile y despliegue. O sea, exige a un programador para una decisión
 * que es del dueño del negocio y que se toma en treinta segundos.
 *
 * ── LO QUE HACE ESTE MÓDULO ──────────────────────────────────────────────────
 *
 * Deja que un documento guardado —editable desde la consola del dueño— SOBRE-
 * ESCRIBA el precio y los créditos de cada plan. El código sigue trayendo los
 * valores de fábrica, que son la red: si el documento no existe, está corrupto o
 * dice algo imposible, se usa el de fábrica y **se dice en voz alta**.
 *
 * ── LO QUE NO HACE, Y ES DELIBERADO ──────────────────────────────────────────
 *
 * No toca lo que INCLUYE cada plan (`incluye`, `modulos`, `nivelIA`). Eso no es
 * un precio: es la promesa del producto y el permiso de acceso, y cambiarlo
 * desde un formulario abriría módulos que nadie pagó. El dinero se edita; los
 * derechos, no.
 *
 * ── LOS PRECIOS VIEJOS NO SE MUEVEN ──────────────────────────────────────────
 *
 * Un cambio de precio vale para quien contrate DESPUÉS. Quien ya está suscrito
 * sigue con lo que aceptó — eso lo respeta Stripe por su lado (la suscripción
 * conserva su precio), y aquí se refleja con `version`: cada cambio sube el
 * número, y un cobro puede decir con qué versión del catálogo se hizo.
 *
 * Cambiarle el precio a alguien que ya paga no es una edición: es una
 * renegociación, y no puede salir de un campo de texto.
 *
 * Módulo PURO.
 */
import { PLANES, PLANES_ORDEN, type ClavePlan, type PlanCreditos } from '@/lib/planes-ia'

/** Lo único que el dueño puede cambiar desde la consola: dinero y cupo. */
export interface AjustePlan {
  precioMXN?: number
  creditos?: number
}

export interface CatalogoGuardado {
  /** Sube en cada cambio. Sirve para sellar con qué catálogo se cobró. */
  version?: number
  /** Cuándo se guardó, ISO. */
  actualizadoEn?: string
  /** Quién lo guardó. Una tarifa sin autor no se puede auditar. */
  actualizadoPor?: string
  ajustes?: Partial<Record<ClavePlan, AjustePlan>>
}

export interface CatalogoEfectivo {
  planes: Record<ClavePlan, PlanCreditos>
  version: number
  /** `true` cuando se está usando el de fábrica por no haber otro válido. */
  deFabrica: boolean
  /**
   * Por qué se ignoró algo. Vacío si todo se aplicó.
   *
   * Existe porque el fallo silencioso aquí es caro: un ajuste rechazado sin
   * avisar hace creer al dueño que subió el precio cuando sigue cobrando el
   * viejo, y sólo se entera al cuadrar el mes.
   */
  avisos: string[]
}

/** Tope de cordura. Por encima, casi seguro es un dedazo (un cero de más). */
export const PRECIO_MAXIMO_MXN = 100_000

/**
 * ¿Es un ajuste que se puede aplicar? Devuelve el motivo del rechazo, o `null`.
 *
 * Se rechaza por SEPARADO cada campo, no el plan entero: si alguien escribe bien
 * el precio y mal los créditos, tirar los dos sería castigar la parte correcta.
 */
function motivoRechazoPrecio(v: unknown): string | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return 'no es un número'
  if (n <= 0) return 'un plan de $0 o negativo se cobraría mal en todas las pantallas'
  if (n > PRECIO_MAXIMO_MXN) return `pasa de $${PRECIO_MAXIMO_MXN.toLocaleString('es-MX')}, casi seguro es un cero de más`
  return null
}

function motivoRechazoCreditos(v: unknown): string | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return 'no es un número'
  if (n < 0) return 'no existen los créditos negativos'
  if (!Number.isInteger(n)) return 'los créditos son enteros'
  return null
}

/**
 * El catálogo que hay que usar hoy: fábrica + ajustes válidos.
 *
 * Nunca lanza. Un catálogo que revienta dejaría la aplicación sin precios, y sin
 * precios no se puede ni cobrar ni enseñar el plan — mucho peor que cobrar el de
 * fábrica.
 */
export function catalogoEfectivo(guardado: CatalogoGuardado | null | undefined): CatalogoEfectivo {
  const avisos: string[] = []
  const planes = { ...PLANES } as Record<ClavePlan, PlanCreditos>

  const ajustes = guardado?.ajustes
  if (!ajustes || typeof ajustes !== 'object') {
    return { planes, version: Number(guardado?.version ?? 0) || 0, deFabrica: true, avisos }
  }

  let aplicados = 0
  for (const clave of PLANES_ORDEN) {
    const a = ajustes[clave]
    if (!a || typeof a !== 'object') continue
    const base = PLANES[clave]
    let plan = base

    if (a.precioMXN !== undefined) {
      const mal = motivoRechazoPrecio(a.precioMXN)
      if (mal) avisos.push(`${base.nombre}: se ignoró el precio (${mal}). Sigue en $${base.precioMXN.toLocaleString('es-MX')}.`)
      else { plan = { ...plan, precioMXN: Number(a.precioMXN) }; aplicados++ }
    }
    if (a.creditos !== undefined) {
      const mal = motivoRechazoCreditos(a.creditos)
      if (mal) avisos.push(`${base.nombre}: se ignoraron los créditos (${mal}). Siguen en ${base.creditos}.`)
      else { plan = { ...plan, creditos: Number(a.creditos) }; aplicados++ }
    }
    planes[clave] = plan
  }

  return {
    planes,
    version: Number(guardado?.version ?? 0) || 0,
    deFabrica: aplicados === 0,
    avisos,
  }
}

/**
 * Lo que se va a guardar, ya limpio.
 *
 * Se filtra ANTES de escribir y no sólo al leer: un documento con basura dentro
 * es una bomba de relojería que estalla el día que alguien cambie la validación
 * de lectura. Lo que no sirve no entra.
 */
export function prepararGuardado(
  entrada: Partial<Record<ClavePlan, AjustePlan>>,
  versionActual: number,
  autor: string,
  ahoraISO: string,
): { doc: CatalogoGuardado; rechazos: string[] } {
  const rechazos: string[] = []
  const ajustes: Partial<Record<ClavePlan, AjustePlan>> = {}

  for (const clave of PLANES_ORDEN) {
    const a = entrada?.[clave]
    if (!a) continue
    const limpio: AjustePlan = {}
    if (a.precioMXN !== undefined) {
      const mal = motivoRechazoPrecio(a.precioMXN)
      if (mal) rechazos.push(`${PLANES[clave].nombre}: precio rechazado — ${mal}.`)
      else limpio.precioMXN = Number(a.precioMXN)
    }
    if (a.creditos !== undefined) {
      const mal = motivoRechazoCreditos(a.creditos)
      if (mal) rechazos.push(`${PLANES[clave].nombre}: créditos rechazados — ${mal}.`)
      else limpio.creditos = Number(a.creditos)
    }
    if (Object.keys(limpio).length) ajustes[clave] = limpio
  }

  return {
    doc: {
      version: (Number(versionActual) || 0) + 1,
      actualizadoEn: ahoraISO,
      actualizadoPor: autor,
      ajustes,
    },
    rechazos,
  }
}

export const POR_QUE_NO_SE_EDITA_LO_QUE_INCLUYE =
  'Porque `incluye`, `modulos` y `nivelIA` no son un precio: son la promesa del ' +
  'producto y el permiso de acceso. Editarlos desde un formulario abriría ' +
  'módulos que nadie pagó, y con un dedazo. El dinero se edita; los derechos, no.'
