/**
 * LO QUE VE SOPORTE — suficiente para repararlo, insuficiente para leer un expediente.
 *
 * ── LA TENSIÓN REAL ──────────────────────────────────────────────────────────
 *
 * Un incidente sin contexto técnico no se puede arreglar. Un incidente con
 * demasiado contexto es una copia del expediente en un sistema con otro control
 * de acceso — y quien atiende soporte no tiene por qué poder leer la nota de
 * nadie.
 *
 * La línea se traza así: **la unidad es la operación, no la persona.** Se puede
 * saber que fallaron 812 guardados en `/consulta/[id]` de la versión v1019
 * contra `anthropic` con `sin_saldo`, y no se puede saber de quién eran.
 *
 * ── POR QUÉ LA PROYECCIÓN SE CONSTRUYE Y NO SE FILTRA ────────────────────────
 *
 * Filtrar es quitar de un objeto lo que no debe salir, y esa lista se queda
 * corta el día que alguien añade un campo. Construir es empezar de cero y poner
 * sólo lo que se decidió. `proyectarParaSoporte()` no recibe el incidente y le
 * quita cosas: lo lee y escribe uno nuevo, campo a campo. Un campo nuevo en el
 * origen no aparece aquí hasta que alguien lo escriba, que es donde debe
 * discutirse.
 *
 * Módulo PURO.
 */
import { redactarString } from '@/lib/security/sanitize'
import type { GrupoIncidente } from './agrupacion'
import type { EstadoRemediacion } from './maquina'
import { runbookPara } from './runbooks'
import type { Veredicto } from './umbrales'

export interface VistaDeSoporte {
  readonly incidentId: string
  readonly signature: string
  readonly family: string
  readonly status: string
  readonly severity: string
  readonly category: string
  readonly subtype: string
  readonly features: readonly string[]
  readonly routes: readonly string[]
  readonly provider?: string
  readonly firstSeen: string
  readonly lastSeen: string
  readonly count: number
  readonly affectedOperations: number
  /** `true` = `affectedOperations` es un SUELO, no el total. */
  readonly affectedOperationsTruncated: boolean
  readonly affectedTenants: number
  readonly appVersion: string
  /** SHA del despliegue, cuando el entorno lo expone. */
  readonly buildSha: string | null
  readonly correlationIds: readonly string[]
  readonly remediationAttempts: ReadonlyArray<{
    readonly numero: number
    readonly accion: string
    readonly resultado: string
    readonly razon: string
    readonly iniciadoEn: string
    readonly terminadoEn: string | null
  }>
  readonly retriesLeft: number
  readonly currentWorkaround: string
  readonly owner: string
  readonly runbookId: string
  readonly whyIncident: string
  /** Lo que el motor no pudo evaluar. Se declara: un hueco callado se lee como un cero. */
  readonly notEvaluated: readonly string[]
}

export interface EntradaDeProyeccion {
  readonly grupo: GrupoIncidente
  readonly estado: EstadoRemediacion
  readonly veredicto: Veredicto
  /** SHA del build. Se pasa: este módulo es puro y no lee el entorno. */
  readonly buildSha?: string | null
}

/**
 * El identificador visible del incidente.
 *
 * Derivado de la firma, que ya es vocabulario cerrado y ya está probada libre de
 * PHI. Un identificador aleatorio obligaría a guardar la correspondencia en otro
 * sitio; uno derivado se puede reconstruir desde los datos.
 */
export function incidentIdDe(firma: string): string {
  return `INC-${firma.replace(/\|/g, '.').replace(/[^a-z0-9._[\]/-]/g, '')}`
}

export function proyectarParaSoporte(e: EntradaDeProyeccion): VistaDeSoporte {
  const { grupo: g, estado, veredicto } = e
  const rb = runbookPara(g.categoria, g.subtipo)
  return {
    incidentId: incidentIdDe(g.firma),
    signature: g.firma,
    family: g.familia,
    status: estado.fase,
    severity: g.dimensiones.severidad,
    category: g.categoria,
    subtype: g.subtipo,
    features: g.features,
    routes: g.rutas,
    ...(g.proveedor ? { provider: g.proveedor } : {}),
    firstSeen: g.firstSeen,
    lastSeen: g.lastSeen,
    count: g.count,
    affectedOperations: g.operacionesAfectadas,
    affectedOperationsTruncated: g.operacionesRecortadas,
    affectedTenants: g.inquilinosAfectados,
    appVersion: g.appVersion,
    buildSha: e.buildSha ?? null,
    correlationIds: g.correlaciones,
    remediationAttempts: estado.intentos.map(i => ({
      numero: i.numero,
      accion: i.accion,
      resultado: i.resultado ?? 'en_curso',
      razon: i.razon ?? '',
      iniciadoEn: i.iniciadoEn,
      terminadoEn: i.terminadoEn ?? null,
    })),
    retriesLeft: Math.max(0, estado.presupuesto.maxIntentos - estado.intentos.length),
    currentWorkaround: rb.mensajeAlMedico,
    owner: g.dimensiones.dueno,
    runbookId: rb.id,
    whyIncident: veredicto.porQue,
    notEvaluated: veredicto.noEvaluado,
  }
}

/**
 * Las claves que NO pueden aparecer en la vista, ni anidadas.
 *
 * No es la defensa —la defensa es que la proyección se construye campo a campo—
 * sino el guardián que lo comprueba, para que una prueba pueda fallar el día que
 * alguien añada un campo de más «sólo para depurar».
 */
const PROHIBIDAS = [
  'patient', 'paciente', 'patientid', 'pacienteid', 'clinicid', 'uid', 'nombre',
  'name', 'email', 'correo', 'telefono', 'phone', 'curp', 'rfc',
  'transcript', 'transcripcion', 'nota', 'note', 'diagnostico', 'diagnosis',
  'medicamento', 'medication', 'receta', 'prompt', 'respuesta', 'completion',
  'apikey', 'api_key', 'authorization', 'token', 'secret', 'password',
]

export interface AuditoriaDeVista {
  readonly limpia: boolean
  readonly motivos: readonly string[]
}

/**
 * ¿Esta vista lleva algo que no debería?
 *
 * Dos barreras: las CLAVES prohibidas (recursivo) y el contenido pasado por
 * `redactarString`, que ya sabe de CURP, RFC, correos, teléfonos y tokens.
 *
 * Lo que NO detecta, y hay que decirlo: un nombre propio suelto. Ningún regex lo
 * distingue de una palabra cualquiera. La defensa contra eso no es esta función:
 * es que ningún campo de esta vista acepte texto libre.
 */
export function auditarVista(v: unknown, profundidad = 0): AuditoriaDeVista {
  const motivos: string[] = []
  const visitar = (nodo: unknown, ruta: string, prof: number) => {
    if (prof > 8) return
    if (typeof nodo === 'string') {
      if (redactarString(nodo) !== nodo) motivos.push(`${ruta}: el redactor encontró un identificador`)
      return
    }
    if (Array.isArray(nodo)) { nodo.forEach((x, i) => visitar(x, `${ruta}[${i}]`, prof + 1)); return }
    if (nodo && typeof nodo === 'object') {
      for (const [k, val] of Object.entries(nodo)) {
        if (PROHIBIDAS.includes(k.toLowerCase())) motivos.push(`${ruta}.${k}: clave prohibida en la consola de soporte`)
        visitar(val, `${ruta}.${k}`, prof + 1)
      }
    }
  }
  visitar(v, 'vista', profundidad)
  return { limpia: motivos.length === 0, motivos }
}

export const POR_QUE_LA_UNIDAD_ES_LA_OPERACION_Y_NO_LA_PERSONA =
  'Porque soporte tiene que poder decir «fallaron 812 guardados en la versión ' +
  'v1019» y no tiene por qué poder decir de quién eran. La primera frase repara ' +
  'el producto; la segunda es una copia del expediente en un sistema con otro ' +
  'control de acceso.'
