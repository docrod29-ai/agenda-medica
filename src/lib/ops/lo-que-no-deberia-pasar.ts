/**
 * UNA DENEGACIÓN NO ES UNA ANOMALÍA. EL PATRÓN, SÍ.
 *
 * ── QUÉ FALTABA (WS-13) ─────────────────────────────────────────────────────
 *
 * El censo lo decía con precisión: «las anomalías de autorización siguen sin
 * instrumentar, y hasta que no se escriban en algún sitio no hay nada que leer».
 *
 * `verificar.ts` deniega correctamente y lo apunta con `safeLog.warn`. Un log de
 * servidor no es una señal: hay que ir a buscarlo, en el sitio correcto, el día
 * correcto y sospechando ya lo que se busca. Es exactamente el defecto que
 * REG-396 y REG-420 cerraron para los incidentes de IA y los errores del
 * navegador, aquí sin cerrar.
 *
 * ── LA FRONTERA, Y NO ES UNA CIFRA INVENTADA ────────────────────────────────
 *
 * **Una denegación es el sistema funcionando.** Alguien pulsó algo que su rol no
 * puede, o abrió una pantalla que no le toca. Avisar de cada una convierte el
 * canal en ruido, y un canal ruidoso deja de leerse justo el día que importa.
 *
 * Hay dos patrones que no son ruido, y ninguno es un número elegido:
 *
 *  1. **UN MISMO USUARIO DENEGADO EN DOS CONSULTORIOS DISTINTOS.** Un miembro de
 *     un consultorio no tiene por qué tocar otro. Que le rebote la puerta de dos
 *     inquilinos no es un rol mal configurado: es alguien probando dónde entra.
 *     Es la «anomalía de aislamiento entre inquilinos» que el charter nombra, y
 *     basta con DOS porque el segundo ya no tiene explicación inocente.
 *  2. **INSISTENCIA sobre la misma capacidad.** Un rol mal puesto da UNA
 *     denegación y el usuario se rinde o pide permiso. Volver a intentarlo muchas
 *     veces contra lo mismo es otra cosa.
 *
 * El primero es cualitativo, como en REG-420. El segundo necesita un número, y se
 * declara como lo que es: `INSISTENCIAS_PARA_MIRAR` es una cota operativa —cuánto
 * cabe en una ventana sin ser un accidente— y no una cifra clínica.
 *
 * ── QUÉ SE GUARDA, Y QUÉ NO ─────────────────────────────────────────────────
 *
 * El actor, el consultorio, la capacidad y la ruta. **Nada del paciente**: una
 * anomalía de autorización se investiga con quién y dónde, nunca con sobre qué
 * expediente. La ruta va sin sus parámetros por lo mismo — `/api/expediente/
 * <id>` llevaría un identificador de paciente dentro.
 *
 * Módulo PURO salvo `anotarDenegacion`, que escribe.
 */
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'

/** La colección. Declarada en `firestore.rules` y en la matriz de acceso. */
export const COLECCION = 'platform_authz_denegadas'

export interface Denegacion {
  readonly uid: string
  readonly clinicId: string
  readonly capacidad: string
  /** Sin parámetros: `/api/expediente/<id>` llevaría un paciente dentro. */
  readonly ruta: string
  readonly cuando: string
}

export type ClaseDeAnomalia = 'sondeo_entre_consultorios' | 'insistencia'

export interface Anomalia {
  readonly clase: ClaseDeAnomalia
  readonly uid: string
  /** Los consultorios donde le rebotó. Uno solo en la insistencia. */
  readonly consultorios: readonly string[]
  readonly capacidades: readonly string[]
  readonly veces: number
  readonly comoSeCuenta: string
}

/**
 * Cuántos intentos contra lo mismo dejan de parecer un rol mal puesto.
 *
 * **No es una cifra clínica**: es una cota operativa. Un rol mal configurado da
 * una denegación y el usuario pide permiso; cinco contra la misma capacidad en la
 * misma ventana ya no es alguien descubriendo que no puede.
 */
export const INSISTENCIAS_PARA_MIRAR = 5

/** Con dos consultorios distintos basta: el segundo ya no tiene explicación inocente. */
export const CONSULTORIOS_PARA_SER_SONDEO = 2

/**
 * Qué hay que mirar de lo que se denegó. Puro.
 *
 * Devuelve vacío cuando todo son denegaciones sueltas — que es lo normal y lo
 * correcto.
 */
export function anomalias(denegaciones: readonly Denegacion[]): Anomalia[] {
  const porUid = new Map<string, Denegacion[]>()
  for (const d of denegaciones) {
    if (!d.uid) continue   // sin actor no hay patrón que seguir
    porUid.set(d.uid, [...(porUid.get(d.uid) ?? []), d])
  }

  const out: Anomalia[] = []
  for (const [uid, lista] of porUid) {
    const consultorios = [...new Set(lista.map(d => d.clinicId).filter(Boolean))]
    const capacidades = [...new Set(lista.map(d => d.capacidad).filter(Boolean))]

    if (consultorios.length >= CONSULTORIOS_PARA_SER_SONDEO) {
      out.push({
        clase: 'sondeo_entre_consultorios',
        uid, consultorios, capacidades, veces: lista.length,
        comoSeCuenta: `Un mismo usuario recibió denegaciones en ${consultorios.length} consultorios distintos. Un miembro de un consultorio no tiene por qué tocar otro.`,
      })
      continue   // el sondeo manda: es el más grave y no se cuenta dos veces
    }

    /* Insistencia: se cuenta POR CAPACIDAD, no en total. Diez denegaciones
       repartidas entre diez capacidades es alguien perdido por la aplicación;
       diez contra la misma es otra cosa. */
    for (const capacidad of capacidades) {
      const veces = lista.filter(d => d.capacidad === capacidad).length
      if (veces < INSISTENCIAS_PARA_MIRAR) continue
      out.push({
        clase: 'insistencia',
        uid, consultorios, capacidades: [capacidad], veces,
        comoSeCuenta: `${veces} intentos contra «${capacidad}» en la misma ventana. Un rol mal puesto da uno.`,
      })
    }
  }
  return out
}

/** Cómo se dice, sin adjetivos y sin PHI. */
export function comoSeCuentan(as: readonly Anomalia[]): string {
  if (!as.length) return 'Sin anomalías de autorización en la ventana.'
  const sondeos = as.filter(a => a.clase === 'sondeo_entre_consultorios').length
  const insistencias = as.length - sondeos
  const partes = []
  if (sondeos) partes.push(`${sondeos} posible(s) sondeo(s) entre consultorios`)
  if (insistencias) partes.push(`${insistencias} insistencia(s) sobre una capacidad`)
  return partes.join(' · ')
}

/**
 * Anota una denegación. **Nunca lanza y nunca bloquea la respuesta.**
 *
 * Se llama desde el camino que ya deniega, así que un fallo aquí no puede
 * convertir un 403 correcto en un 500. Se dispara sin esperar (`void`): la
 * respuesta al cliente no depende de que la anotación llegue.
 */
export function anotarDenegacion(d: Denegacion): void {
  try {
    void adminDb.collection(COLECCION).add({ ...d })
      .catch(() => { /* la observabilidad no rompe una denegación correcta */ })
  } catch {
    safeLog.warn('[authz] no se pudo anotar la denegación')
  }
}

/** Quita los parámetros de una ruta: `/api/expediente/abc123` → `/api/expediente/<id>`. */
export function rutaSinParametros(ruta: string): string {
  return String(ruta || '')
    .split('?')[0]
    .split('/')
    .map(seg => (/^[A-Za-z0-9_-]{12,}$/.test(seg) ? '<id>' : seg))
    .join('/')
}

export const POR_QUE_UNA_DENEGACION_NO_AVISA =
  'Porque una denegación es el sistema funcionando: alguien pulsó algo que su rol '
  + 'no puede. Avisar de cada una convierte el canal en ruido, y un canal ruidoso '
  + 'deja de leerse justo el día que importa. Lo que se mira es el PATRÓN.'

export const POR_QUE_DOS_CONSULTORIOS_BASTAN =
  'Porque un miembro de un consultorio no tiene por qué tocar otro. Que le rebote '
  + 'la puerta de dos inquilinos distintos no es un rol mal configurado: es alguien '
  + 'probando dónde entra. El segundo ya no tiene explicación inocente, así que no '
  + 'hace falta elegir un número.'

export const LO_QUE_NO_SE_ANOTA =
  'Nada del paciente. Una anomalía de autorización se investiga con quién y dónde, '
  + 'nunca con sobre qué expediente. Por eso la ruta va sin parámetros: '
  + '`/api/expediente/<id>` llevaría un identificador de paciente dentro.'
