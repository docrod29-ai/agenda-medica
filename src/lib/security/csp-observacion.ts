/**
 * LA OBSERVACIÓN DE LA CSP, QUE NO PODÍA EMPEZAR.
 *
 * ── EL PLAN QUE NO FUNCIONABA ────────────────────────────────────────────────
 *
 * La política de seguridad de contenido va en modo AVISO: no bloquea nada, sólo
 * reporta lo que se saldría de ella. El plan era «una semana de reportes y ya
 * sabremos qué apretar antes de pasar a bloquear de verdad».
 *
 * El problema es que los reportes se escribían en el log del servidor. Nadie lee
 * ese log, y además caduca. Una semana después no habría NADA que mirar, así que
 * la observación no podía terminar — ni empezar. Pasar a bloqueo sin ese dato es
 * lo que rompe pantallas legítimas de golpe, así que la CSP se quedaba en aviso
 * para siempre: la seguridad de la que todo el mundo habla y nadie enciende.
 *
 * ── LO QUE HACE FALTA PARA QUE TERMINE ───────────────────────────────────────
 *
 * Que los reportes se ACUMULEN en algo que siga ahí mañana, agrupados de forma
 * que se puedan leer de un vistazo: no mil líneas, sino «esta directiva, este
 * origen, 340 veces». Eso ya es una decisión: apretar o permitir.
 *
 * ── LA PARTE DELICADA: EL BUZÓN ES PÚBLICO ───────────────────────────────────
 *
 * El navegador manda estos reportes SIN autenticación — tiene que ser así. O
 * sea que cualquiera en internet puede escribir en él. Guardar un documento por
 * reporte convertiría el endpoint en una manguera para inflar la base de datos y
 * la factura.
 *
 * Tres límites, todos aquí:
 *
 *  1. **Se agrupa.** La clave es `directiva|origen|día`, así que mil reportes
 *     iguales son un contador, no mil documentos.
 *  2. **Se descarta lo ajeno.** Un reporte cuya página no es de esta aplicación
 *     no dice nada de esta aplicación.
 *  3. **Se recorta.** Un tope de grupos por petición y de largo por campo: nadie
 *     escribe una novela en el nombre de una directiva.
 *
 * ── Y LA PARTE QUE NO SE NEGOCIA: PHI ────────────────────────────────────────
 *
 * El navegador manda `document-uri`, y en esta aplicación esa dirección puede
 * traer el token del enlace mágico del paciente (`/mi/{token}`) o el id de un
 * expediente. Aquí NUNCA se guarda una dirección completa: sólo el origen y el
 * primer segmento de la ruta. `/expediente/abc123` se guarda como
 * `https://…/expediente/…`, que es todo lo que hace falta para decidir y nada de
 * lo que hace falta proteger.
 *
 * Módulo PURO: decide y devuelve. Quien llama escribe.
 */

/** Un grupo de violaciones equivalentes. Lo que se guarda y lo que se lee. */
export interface GrupoCsp {
  /** `directiva|origenBloqueado|día` — también es el id del documento. */
  clave: string
  directiva: string
  /** Origen del recurso que se habría bloqueado. Sin ruta ni parámetros. */
  bloqueado: string
  /** Dónde pasó, recortado a origen + primer segmento. */
  pagina: string
  /** Día ISO. Agrupar por día acota cuánto puede crecer esto. */
  dia: string
}

/** Cuántos grupos distintos se aceptan de UNA petición. */
export const MAXIMO_GRUPOS_POR_PETICION = 10
/** Ningún campo de un reporte legítimo pasa de esto. */
export const MAXIMO_LARGO_CAMPO = 200

/**
 * Origen + primer segmento de la ruta. El resto se redacta.
 *
 * Es la única forma en que una dirección de esta aplicación puede guardarse: las
 * rutas del portal del paciente llevan un token de sesión en la URL y las del
 * expediente llevan el id del paciente.
 */
export function rutaSegura(url: unknown): string {
  if (typeof url !== 'string' || !url) return ''
  try {
    const u = new URL(url)
    const seg = u.pathname.split('/').filter(Boolean)
    return u.origin + (seg.length ? '/' + seg[0] : '/') + (seg.length > 1 ? '/…' : '')
  } catch {
    // `blocked-uri` no siempre es una URL: puede ser 'inline', 'eval' o 'data'.
    // Son valores legítimos y significativos, así que se conservan tal cual.
    const s = String(url).trim()
    return /^(inline|eval|data|blob|self)$/i.test(s) ? s.toLowerCase() : ''
  }
}

const recortar = (v: unknown): string => String(v ?? '').slice(0, MAXIMO_LARGO_CAMPO)

/** Los dos formatos que existen: `report-uri` (con guiones) y `report-to` (camelCase). */
function normalizar(r: Record<string, unknown>) {
  return {
    directiva: recortar(r['violated-directive'] ?? r['effectiveDirective'] ?? r['effective-directive'] ?? ''),
    bloqueado: r['blocked-uri'] ?? r['blockedURL'] ?? r['blocked-url'] ?? '',
    documento: r['document-uri'] ?? r['documentURL'] ?? r['document-url'] ?? '',
  }
}

/**
 * De un cuerpo crudo a los grupos que vale la pena guardar.
 *
 * `origenesPropios` son los orígenes de esta aplicación. Un reporte cuya página
 * no está en la lista se descarta: o es ruido de una extensión del navegador en
 * otro sitio, o es alguien escribiendo en el buzón a propósito. Ninguno de los
 * dos dice nada de lo que hay que apretar aquí.
 *
 * Si la lista viene vacía NO se filtra — es el caso de un entorno donde el
 * origen no está configurado, y perder la observación entera por eso sería peor
 * que aceptar algo de ruido.
 */
export function gruposDeReporte(
  cuerpo: unknown,
  dia: string,
  origenesPropios: readonly string[] = [],
): GrupoCsp[] {
  const crudos: Record<string, unknown>[] = []
  if (Array.isArray(cuerpo)) {
    for (const r of cuerpo) {
      const b = (r as { body?: unknown })?.body ?? r
      if (b && typeof b === 'object') crudos.push(b as Record<string, unknown>)
    }
  } else if (cuerpo && typeof cuerpo === 'object') {
    const c = cuerpo as Record<string, unknown>
    crudos.push((c['csp-report'] as Record<string, unknown>) ?? c)
  }

  const vistos = new Set<string>()
  const salida: GrupoCsp[] = []
  for (const crudo of crudos) {
    if (salida.length >= MAXIMO_GRUPOS_POR_PETICION) break
    const { directiva, bloqueado, documento } = normalizar(crudo)
    if (!directiva) continue
    const pagina = rutaSegura(documento)
    if (!pagina) continue
    if (origenesPropios.length && !origenesPropios.some(o => pagina.startsWith(o))) continue

    const dest = rutaSegura(bloqueado) || 'desconocido'
    const clave = `${directiva}|${dest}|${dia}`
    if (vistos.has(clave)) continue         // dentro de una misma petición ya se agrupó
    vistos.add(clave)
    salida.push({ clave, directiva, bloqueado: dest, pagina, dia })
  }
  return salida
}

/**
 * Firestore no acepta `/` en el id de un documento, y las claves los llevan
 * porque los orígenes son URLs. Se cambian por `~`, que no aparece en ninguno de
 * los dos campos — así el id sigue siendo LEGIBLE, que es medio motivo de tener
 * un id determinista.
 */
export function idDocumento(clave: string): string {
  return clave.replace(/\//g, '~').slice(0, 400)
}

/**
 * ¿Se puede pasar la CSP a bloquear de verdad?
 *
 * DOS condiciones, y ninguna sobra:
 *
 *  · **Días observando.** Un solo día no ve el cierre de mes, el día que alguien
 *    imprime, ni la pantalla que se usa una vez por semana.
 *  · **Cero violaciones recientes.** Si todavía saltan, pasar a bloquear rompe
 *    exactamente eso que está saltando — con un paciente enfrente.
 *
 * Devuelve el motivo escrito para poder enseñarlo, no sólo un sí o un no: la
 * pantalla tiene que decir QUÉ falta, o no sirve para decidir.
 */
export const DIAS_MINIMOS_DE_OBSERVACION = 7

export function veredictoEnforce(
  diasObservados: number,
  violacionesUltimos7Dias: number,
): { listo: boolean; motivo: string } {
  if (diasObservados < DIAS_MINIMOS_DE_OBSERVACION) {
    const faltan = DIAS_MINIMOS_DE_OBSERVACION - diasObservados
    return { listo: false, motivo: `Faltan ${faltan} día(s) de observación (van ${diasObservados} de ${DIAS_MINIMOS_DE_OBSERVACION}).` }
  }
  if (violacionesUltimos7Dias > 0) {
    return { listo: false, motivo: `Todavía hay ${violacionesUltimos7Dias} violación(es) en los últimos 7 días. Pasar a bloqueo rompería justo eso.` }
  }
  return { listo: true, motivo: `${diasObservados} días observando y ninguna violación en los últimos 7. Se puede poner CSP_MODE=enforce.` }
}

export const POR_QUE_NO_SE_GUARDA_LA_URL_COMPLETA =
  'Porque en esta aplicación la dirección de la página ES un dato sensible: el ' +
  'portal del paciente lleva su token de sesión en la URL y el expediente lleva ' +
  'el id del paciente. Un buzón de reportes que guardara direcciones completas ' +
  'sería una fuga de PHI construida a propósito, y encima en una colección que ' +
  'existe para mejorar la seguridad.'
