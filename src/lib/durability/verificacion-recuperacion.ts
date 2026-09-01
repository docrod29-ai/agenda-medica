/**
 * ¿SE PERDIÓ ALGO CLÍNICO AL RECUPERAR? — el veredicto, y el aviso accionable.
 *
 * ── EL HUECO (R-13) ──────────────────────────────────────────────────────────
 *
 * `reconciliacion.ts` ya sabe comparar dos fotografías y decir qué falta, qué
 * sobra, qué difiere, qué volvió rancio y qué volvió forastero. Lo que faltaba
 * era lo que se hace CON eso:
 *
 *  · nadie obligaba a que un duplicado de identidad clínica —dos documentos
 *    legítimos con el mismo contenido, el modo en que se duplica una cita
 *    cuando un reintento la vuelve a crear— tumbara el veredicto de la
 *    recuperación. Ese caso no produce `FALTA` ni tiene por qué producir
 *    `SOBRA`, así que podía pasar entero;
 *  · no había un aviso que alguien pudiera LEER a las tres de la mañana. Había
 *    un objeto con la lista completa de pérdidas, que es otra cosa;
 *  · y no había nada escrito que dijera, en el código y no en un documento,
 *    que un total que cuadra no prueba nada.
 *
 * ── ESTE MÓDULO NO ES UN SEGUNDO RECONCILIADOR ───────────────────────────────
 *
 * No compara nada. Recibe la `Reconciliacion` que produjo `reconciliar` —la
 * única— y la fotografía resultante, y hace tres cosas: junta las clases de
 * defecto en una sola, dictamina, y redacta el aviso. Si algún día la
 * comparación cambia, cambia en un sitio.
 *
 * ── EL AVISO NO PUEDE LLEVAR PHI ─────────────────────────────────────────────
 *
 * Un aviso de incidente se copia a un correo, a un chat de guardia y a un
 * ticket. Por eso lleva **sólo** identidad de consultorio y de trabajo, clase y
 * severidad del defecto, recuentos, huellas y rutas — identificadores opacos.
 * El texto de cada clase es FIJO: no se interpola ni un campo del documento, de
 * modo que no hay forma de que una frase clínica se cuele por el camino.
 *
 * ── Y LA DETECCIÓN NO REPARA ─────────────────────────────────────────────────
 *
 * Ni reescribe, ni borra, ni «reconcilia» un duplicado eligiendo uno. La misma
 * regla que `integridad-referencial.ts`: reconectar una adenda a la nota que más
 * se parece es inventarle un padre a una corrección medicolegal. La ausencia de
 * cualquier función que escriba ES el control.
 *
 * Módulo PURO.
 */
import {
  duplicadosPorContenido, severidadDe, POR_QUE_LOS_CONTEOS_NO_BASTAN,
  type ClaseDePerdida, type FotoDeDocumento, type Reconciliacion,
} from '@/lib/durability/reconciliacion'

export type ClaseDeDefecto = ClaseDePerdida | 'DUPLICADO_DE_IDENTIDAD'

export type SeveridadDeDefecto = 'P0' | 'P1' | 'P2'

/** Cuántas rutas se detallan por clase. El resto se cuenta y se declara. */
export const TOPE_DE_RUTAS = 20

/**
 * Qué significa cada clase, en el idioma de quien tiene que actuar.
 *
 * Texto FIJO. Es lo que hace el aviso seguro de reenviar: nada de aquí sale del
 * documento afectado.
 */
export const QUE_SIGNIFICA: Record<ClaseDeDefecto, string> = {
  FALTA: 'estaba antes del incidente y no volvió. La recuperación dejó fuera documentos que existían.',
  SOBRA: 'apareció un documento que no estaba: o es un duplicado con otra identidad, o la recuperación trajo algo de otro sitio.',
  DIFIERE: 'volvió con contenido distinto del que había. En un documento firmado o de sólo-añadir eso es una alteración, no una recuperación.',
  RANCIO: 'la recuperación escribió una versión ANTERIOR encima de una posterior. No es una pérdida del incidente: la causó la recuperación.',
  FORASTERO: 'el documento quedó en este consultorio con referencias internas a otro. La ruta se re-enraizó; el contenido, no.',
  DUPLICADO_DE_IDENTIDAD: 'dos documentos con identidades legítimas distintas y el mismo contenido. Un recuento total NO lo ve: el total sube y parece que se restauró de más.',
}

export interface DefectoDeRecuperacion {
  clase: ClaseDeDefecto
  severidad: SeveridadDeDefecto
  cuantos: number
  /** Rutas afectadas: identificadores opacos, nunca contenido. Recortadas. */
  rutas: string[]
  /** Cuántas rutas no se detallaron. Un recorte silencioso miente por omisión. */
  rutasOmitidas: number
  /** Huellas de contenido, cuando la clase las tiene. Nunca el contenido. */
  huellas: string[]
  queSignifica: string
}

export interface ResumenDeIncidente {
  clinicId: string
  trabajoId: string
  severidadMaxima: SeveridadDeDefecto
  defectosTotales: number
  defectos: DefectoDeRecuperacion[]
  /** Qué hacer, en orden. Frases fijas. */
  queHacer: string[]
  noSeRepara: string
  phiSafe: true
}

export interface VerificacionDeRecuperacion {
  veredicto: 'LIMPIA' | 'NO_LIMPIA'
  limpia: boolean
  /** El total de documentos cuadra. Por sí solo NO prueba nada. */
  conteosCuadran: boolean
  porClase: Record<ClaseDeDefecto, number>
  severidadMaxima: SeveridadDeDefecto | null
  /** `null` cuando la recuperación salió limpia: no hay incidente que avisar. */
  incidente: ResumenDeIncidente | null
  porQueLosConteosNoBastan: string
}

export interface OpcionesDeVerificacion {
  /** Identidad del consultorio. Opaca: no es PHI. */
  clinicId: string
  /** Identidad del trabajo de restauración. Opaca. */
  trabajoId: string
  /**
   * Dónde dos documentos con el mismo contenido son un duplicado clínico.
   *
   * `patients` NO está y no es un olvido: dos pacientes distintos con el mismo
   * nombre y la misma fecha de nacimiento son un problema de identidad de
   * paciente (#306), no de recuperación, y marcarlos aquí llenaría el aviso de
   * ruido que taparía lo que sí importa.
   */
  coleccionesDeIdentidad?: readonly string[]
}

export const COLECCIONES_DE_IDENTIDAD_CLINICA: readonly string[] = [
  'appointments', 'cobros', 'internamientos', 'patients.notas', 'patients.notas.adendas',
]

const PEOR: Record<SeveridadDeDefecto, number> = { P0: 3, P1: 2, P2: 1 }

function laPeor(a: SeveridadDeDefecto | null, b: SeveridadDeDefecto): SeveridadDeDefecto {
  return a === null || PEOR[b] > PEOR[a] ? b : a
}

/**
 * Dictamina si la recuperación se puede dar por buena, y redacta el aviso.
 *
 * @param rec lo que devolvió `reconciliar`. NO se recalcula aquí.
 * @param despues la fotografía resultante, para los duplicados por contenido.
 */
export function verificarRecuperacion(
  rec: Reconciliacion,
  despues: readonly FotoDeDocumento[],
  op: OpcionesDeVerificacion,
): VerificacionDeRecuperacion {
  const colecciones = op.coleccionesDeIdentidad ?? COLECCIONES_DE_IDENTIDAD_CLINICA
  const duplicados = duplicadosPorContenido(despues, colecciones)
  const porInmutable = new Map(despues.map(f => [f.ruta, f.esInmutable]))

  const porClase: Record<ClaseDeDefecto, number> = {
    FALTA: 0, SOBRA: 0, DIFIERE: 0, RANCIO: 0, FORASTERO: 0, DUPLICADO_DE_IDENTIDAD: 0,
  }
  const agrupadas = new Map<ClaseDeDefecto, { rutas: string[]; severidad: SeveridadDeDefecto }>()
  const toma = (clase: ClaseDeDefecto, ruta: string, severidad: SeveridadDeDefecto) => {
    porClase[clase]++
    const g = agrupadas.get(clase) ?? { rutas: [], severidad }
    g.rutas.push(ruta)
    g.severidad = laPeor(g.severidad, severidad)
    agrupadas.set(clase, g)
  }

  for (const p of rec.perdidas) toma(p.clase, p.ruta, p.severidad)

  const huellasPorClase = new Map<ClaseDeDefecto, string[]>()
  for (const d of duplicados) {
    /**
     * La severidad del duplicado es la de su colección: una nota firmada
     * duplicada no pesa lo mismo que una cita duplicada, y el aviso tiene que
     * poder ordenarse por lo que hay que mirar primero.
     */
    const severidad = severidadDe(d.coleccion, d.rutas.some(r => porInmutable.get(r) === true))
    for (const r of d.rutas) toma('DUPLICADO_DE_IDENTIDAD', r, severidad)
    const hs = huellasPorClase.get('DUPLICADO_DE_IDENTIDAD') ?? []
    hs.push(d.huella)
    huellasPorClase.set('DUPLICADO_DE_IDENTIDAD', hs)
  }

  const defectos: DefectoDeRecuperacion[] = []
  let severidadMaxima: SeveridadDeDefecto | null = null
  for (const [clase, g] of agrupadas) {
    severidadMaxima = laPeor(severidadMaxima, g.severidad)
    const rutas = g.rutas.slice().sort()
    defectos.push({
      clase, severidad: g.severidad, cuantos: rutas.length,
      rutas: rutas.slice(0, TOPE_DE_RUTAS),
      rutasOmitidas: Math.max(0, rutas.length - TOPE_DE_RUTAS),
      huellas: (huellasPorClase.get(clase) ?? []).slice(0, TOPE_DE_RUTAS),
      queSignifica: QUE_SIGNIFICA[clase],
    })
  }
  defectos.sort((a, b) => PEOR[b.severidad] - PEOR[a.severidad] || a.clase.localeCompare(b.clase))

  const limpia = defectos.length === 0
  const conteosCuadran = rec.base === rec.despues

  return {
    veredicto: limpia ? 'LIMPIA' : 'NO_LIMPIA',
    limpia,
    conteosCuadran,
    porClase,
    severidadMaxima,
    incidente: limpia ? null : {
      clinicId: op.clinicId,
      trabajoId: op.trabajoId,
      severidadMaxima: severidadMaxima ?? 'P2',
      defectosTotales: defectos.reduce((a, d) => a + d.cuantos, 0),
      defectos,
      queHacer: queHacer(defectos, conteosCuadran),
      noSeRepara: NO_SE_REPARA,
      phiSafe: true,
    },
    porQueLosConteosNoBastan: POR_QUE_LOS_CONTEOS_NO_BASTAN,
  }
}

/** Los pasos, en orden de lo que hay que mirar primero. Frases fijas. */
function queHacer(defectos: readonly DefectoDeRecuperacion[], conteosCuadran: boolean): string[] {
  const out: string[] = ['NO dejar entrar a nadie al consultorio hasta que una persona haya mirado los defectos de arriba.']
  if (conteosCuadran) {
    out.push('El total de documentos CUADRA y aun así hay defectos: quien mire el recuento va a decir que volvió todo. No se puede cerrar el incidente con el recuento.')
  }
  const clases = new Set(defectos.map(d => d.clase))
  if (clases.has('FALTA')) out.push('Localizar los documentos que no volvieron y buscar una copia anterior antes de sobrescribir nada.')
  if (clases.has('DIFIERE')) out.push('Comparar uno por uno los documentos que volvieron distintos. Si alguno es firmado o de sólo-añadir, decidir cuál es el bueno es un acto medicolegal.')
  if (clases.has('RANCIO')) out.push('La recuperación retrocedió documentos: hay trabajo posterior al respaldo que se perdió. Detener la restauración antes de repetirla.')
  if (clases.has('FORASTERO')) out.push('Resolver las referencias a otro consultorio ANTES de abrir: un expediente que declara pertenecer a otro se filtra o desaparece de las consultas sin avisar.')
  if (clases.has('DUPLICADO_DE_IDENTIDAD')) out.push('Revisar los duplicados de identidad: dos documentos con el mismo contenido y distinta identidad. Elegir cuál sobra es una decisión clínica, no una limpieza.')
  if (clases.has('SOBRA')) out.push('Revisar de dónde salieron los documentos que no estaban antes del incidente.')
  return out
}

export const NO_SE_REPARA =
  'Esta comprobación DETECTA. No reescribe, no borra y no elige entre dos ' +
  'documentos. Reparar aquí sería tocar verdad firmada o inventar una identidad ' +
  'de paciente sin nadie delante, que es exactamente el fallo del que se está ' +
  'avisando. Lo que sigue lo decide una persona.'

export const POR_QUE_UN_TOTAL_QUE_CUADRA_NO_ES_UNA_RECUPERACION_LIMPIA =
  'Un documento de menos y uno de más dan el mismo total. La comprobación que ' +
  'importa es identidad por identidad: el recuento sirve para saber que hay que ' +
  'mirar, nunca para saber que no hace falta.'
