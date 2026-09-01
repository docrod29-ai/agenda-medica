/**
 * LA SUPRESIÓN ARCO VIGENTE — restaurar no puede deshacer un derecho ejercido.
 *
 * ── EL HUECO (R-09) ──────────────────────────────────────────────────────────
 *
 * `/api/clinic/importar` ya no confunde «sin pacientes» con «vacío»: mira cinco
 * señales. Pero eso sólo detiene la restauración sobre un consultorio que TIENE
 * datos. Con `sobrescribir=1` —que existe y se pide a propósito— un respaldo
 * ANTERIOR a una supresión vuelve a escribir al paciente suprimido, sus notas,
 * sus laboratorios, sus fotografías y sus citas.
 *
 * Un paciente ejerció su cancelación (LFPDPPP Art. 25-26), el consultorio la
 * ejecutó, quedó el asiento en la bitácora — y una restauración rutinaria lo
 * deshace sin que nadie lo pida y sin que nadie se entere. El expediente vuelve
 * a estar ahí, otra vez legible, otra vez indexado.
 *
 * ── DE DÓNDE SALE LA LISTA DE SUPRIMIDOS ─────────────────────────────────────
 *
 * Del `audit_log` del consultorio DESTINO, y sólo de los asientos que cumplen
 * las tres condiciones a la vez:
 *
 *     evento === 'paciente_borrado'   ·   meta.accion === 'supresion_arco'
 *     patientId no vacío
 *
 * Las tres, porque `paciente_borrado` también lo escribe un borrado ordinario y
 * porque la otra rama de la cancelación —`bloqueo`, cuando hay nota firmada y la
 * ley obliga a conservar— **no suprime nada**: el expediente sigue existiendo y
 * restaurarlo es correcto. Confundirlas dejaría de restaurar expedientes que sí
 * deben volver, que es la otra forma de perder datos clínicos.
 *
 * No se lee `arco_requests`: una solicitud «resuelta» puede haberlo sido por
 * bloqueo, y una resolución escrita en prosa no dice qué se ejecutó. El asiento
 * de bitácora sí: lo escribe la ruta que borró.
 *
 * ── LA ATRIBUCIÓN, Y POR QUÉ FALLA CERRADO ───────────────────────────────────
 *
 * Un documento pertenece a un paciente por su RUTA canónica
 * (`clinics/{c}/patients/{p}/…`) o porque lo NOMBRA en su contenido. La segunda
 * lectura la hace `pacienteDeclarado`, la misma que usa la integridad
 * referencial: dos maneras distintas de responder «¿de quién es esto?» son dos
 * respuestas que pueden divergir, y la que divergiera sería justo la que deja
 * pasar el expediente suprimido.
 *
 * Cuando un documento **clínicamente relevante** no se puede atar con seguridad
 * a un paciente —no nombra a ninguno, o la ruta dice uno y el contenido otro— no
 * se adivina: se manda a revisión humana. Es la regla 6 de seguridad clínica
 * («se pregunta, no se adivina») aplicada a un dato que, si se acierta de menos,
 * resucita un expediente cancelado.
 *
 * ── LO QUE ESTE MÓDULO NO HACE, Y ES DELIBERADO ──────────────────────────────
 *
 *  · **No borra ni modifica nada.** Sólo dice «esto no se escribe».
 *  · **No toca el asiento de la supresión.** Es la prueba de que el derecho se
 *    atendió; alterarlo o dejar de restaurarlo borraría la evidencia.
 *  · **No decide si un paciente puede reactivarse.** Eso es una decisión legal
 *    del responsable del tratamiento de los datos, con el titular delante.
 *    NEEDS_LEGAL_REVIEW. Aquí sólo se detiene y se dice por qué.
 *
 * Módulo PURO: no lee Firestore. Quien consulta la bitácora es la ruta.
 */
import { partirRuta, pacienteDeclarado } from '@/lib/durability/integridad-referencial'

/** Un documento del destino o del archivo, sin interpretar. */
export type AsientoDeBitacora = Record<string, unknown>

/** El documento pertenece o se refiere a un paciente con supresión vigente. */
export const MOTIVO_VIGENTE = 'supresion-arco-vigente'
/** El documento es clínicamente relevante y no se puede atar a UN paciente. */
export const MOTIVO_NO_ATRIBUIBLE = 'supresion-arco-no-atribuible'

export interface SupresionesVigentes {
  /** Identificadores de paciente con supresión ARCO ejecutada en el destino. */
  pacientes: ReadonlySet<string>
  /**
   * Asientos que se parecían a una supresión y no lo eran, con su razón.
   *
   * Se guardan y se enseñan: un borrado ordinario o un asiento a medias NO
   * puede producir una disposición sobre el expediente de nadie, y la única
   * forma de comprobar que no la produjo es poder leer por qué se descartó.
   */
  descartados: { porQue: string }[]
}

export const SIN_SUPRESIONES: SupresionesVigentes = { pacientes: new Set<string>(), descartados: [] }

/**
 * Colecciones de primer nivel donde un documento SIN paciente atribuible es un
 * documento clínicamente relevante suelto.
 *
 * Es vocabulario, no criterio: que una colección falte de esta lista significa
 * que ahí no se exige atribución, no que sus documentos sean inocuos.
 */
export const EXIGEN_ATRIBUCION: readonly string[] = [
  'appointments', 'internamientos', 'cobros', 'memberships', 'waitlist',
  'laboratorio', 'tareas_clinicas', 'hospital_alertas', 'arco_requests',
]

/** ¿Este asiento de bitácora es una supresión ARCO ejecutada? Las tres condiciones. */
export function esSupresionArco(e: AsientoDeBitacora | null | undefined): boolean {
  if (!e || typeof e !== 'object') return false
  if (e.evento !== 'paciente_borrado') return false
  const meta = e.meta
  if (!meta || typeof meta !== 'object') return false
  if ((meta as Record<string, unknown>).accion !== 'supresion_arco') return false
  return typeof e.patientId === 'string' && e.patientId.trim() !== ''
}

/**
 * Deriva el conjunto de supresiones vigentes a partir de la bitácora del destino.
 *
 * La MISMA función la usan el ensayo y la restauración de verdad. Si cada una
 * derivara su propia lista, el ensayo podría prometer que un paciente no vuelve
 * y la restauración escribirlo igual.
 */
export function derivarSupresiones(eventos: readonly AsientoDeBitacora[]): SupresionesVigentes {
  const pacientes = new Set<string>()
  const descartados: { porQue: string }[] = []
  for (const e of eventos) {
    if (!e || typeof e !== 'object') {
      descartados.push({ porQue: 'asiento ilegible: no es un objeto.' })
      continue
    }
    if (e.evento !== 'paciente_borrado') {
      descartados.push({ porQue: `el asiento no es un borrado de paciente (evento: ${typeof e.evento === 'string' ? e.evento : '(sin evento)'}).` })
      continue
    }
    const meta = e.meta
    const accion = meta && typeof meta === 'object' ? (meta as Record<string, unknown>).accion : undefined
    if (accion !== 'supresion_arco') {
      descartados.push({
        porQue: `borrado de paciente que NO declara \`meta.accion: 'supresion_arco'\` (declara: ${typeof accion === 'string' ? accion : '(nada)'}). Un borrado ordinario, o un bloqueo por conservación obligatoria, no suprime el expediente: restaurarlo es correcto.`,
      })
      continue
    }
    const pid = typeof e.patientId === 'string' ? e.patientId.trim() : ''
    if (!pid) {
      descartados.push({
        porQue: 'supresión ARCO sin `patientId`: no identifica a nadie, así que no puede impedir que vuelva nadie. Queda declarada y no produce disposición alguna.',
      })
      continue
    }
    pacientes.add(pid)
  }
  return { pacientes, descartados }
}

export type VeredictoDeSupresion =
  | { admite: true; patientId: string | null }
  | { admite: false; motivo: string; patientId: string | null; porQue: string }

/**
 * ¿Se admite este documento, o lo bloquea una supresión vigente?
 *
 * @param ruta ruta canónica del documento (da igual si ya se re-enraizó: el
 *   segmento del paciente no cambia al reescribir la raíz del consultorio).
 * @param coleccion colección en punto, derivada de la ruta.
 * @param datos el contenido del documento.
 * @param s las supresiones vigentes en el consultorio DESTINO.
 */
export function evaluarSupresion(
  ruta: string, coleccion: string, datos: Record<string, unknown>, s: SupresionesVigentes,
): VeredictoDeSupresion {
  /**
   * Sin supresiones no hay nada que comprobar, y —esto importa— tampoco hay
   * ambigüedad que castigar: una cita sin `patientId` en un consultorio donde
   * nadie ejerció su cancelación es un dato pobre, no un riesgo de resurrección.
   * Fallar cerrado ahí detendría restauraciones legítimas por un defecto que
   * esta compuerta no está para resolver.
   */
  if (s.pacientes.size === 0) return { admite: true, patientId: null }

  /**
   * EL ASIENTO DE LA PROPIA SUPRESIÓN NUNCA SE BLOQUEA.
   *
   * Es la prueba de que el derecho se atendió, con quién lo verificó y cuándo.
   * Dejar de restaurarlo borraría la evidencia del acto — y la evidencia no es
   * el expediente: no contiene el expediente y no lo resucita.
   */
  if (coleccion === 'audit_log' && esSupresionArco(datos)) {
    return { admite: true, patientId: typeof datos.patientId === 'string' ? datos.patientId : null }
  }

  const partes = partirRuta(ruta)
  const enRuta = partes && partes.pares[0]?.coleccion === 'patients' ? partes.pares[0].id : null
  const declarado = pacienteDeclarado(datos)

  if (enRuta && s.pacientes.has(enRuta)) {
    return {
      admite: false, motivo: MOTIVO_VIGENTE, patientId: enRuta,
      porQue: `el expediente «${enRuta}» tiene una supresión ARCO ejecutada y asentada en la bitácora de este consultorio. Escribir este documento devolvería datos que el titular pidió cancelar. Reactivarlo es una decisión legal con el titular delante, no una consecuencia de restaurar un respaldo.`,
    }
  }
  if (declarado && s.pacientes.has(declarado)) {
    return {
      admite: false, motivo: MOTIVO_VIGENTE, patientId: declarado,
      porQue: `el documento se refiere al paciente «${declarado}», cuya supresión ARCO consta en la bitácora de este consultorio. Escribirlo devolvería una referencia a un expediente cancelado.`,
    }
  }

  /**
   * La ruta dice un paciente y el contenido dice otro. Uno de los dos podría
   * estar suprimido y no se sabe cuál manda: es exactamente el caso en que
   * adivinar acierta la mitad de las veces y la mitad equivocada resucita un
   * expediente.
   */
  if (enRuta && declarado && enRuta !== declarado) {
    return {
      admite: false, motivo: MOTIVO_NO_ATRIBUIBLE, patientId: null,
      porQue: `el documento cuelga del paciente «${enRuta}» y declara ser del «${declarado}». Con una supresión ARCO vigente en este consultorio no se puede decidir a cuál de los dos pertenece sin adivinar, así que no se escribe.`,
    }
  }

  const raiz = coleccion.split('.')[0]
  if (!enRuta && !declarado && EXIGEN_ATRIBUCION.includes(raiz)) {
    return {
      admite: false, motivo: MOTIVO_NO_ATRIBUIBLE, patientId: null,
      porQue: `«${raiz}» es una colección clínicamente relevante y este documento no nombra a ningún paciente ni cuelga de uno. Con una supresión ARCO vigente no se puede comprobar que no sea del expediente cancelado, y ante la duda no se escribe.`,
    }
  }

  return { admite: true, patientId: enRuta ?? declarado }
}

export const POR_QUE_SOBRESCRIBIR_NO_LO_SALTA =
  '`sobrescribir=1` es permiso para pisar datos propios del consultorio, no ' +
  'para deshacer el derecho de un tercero. La supresión ARCO la ejerció el ' +
  'paciente, no el consultorio, y ninguna bandera de la restauración puede ' +
  'revocarla: por eso la compuerta corre en la ADMISIÓN —antes de mirar el ' +
  'destino, antes de la verdad firmada y antes de la frescura— y no consulta ' +
  'esa bandera en ninguna parte.'

export const POR_QUE_NO_SE_DECIDE_LA_REACTIVACION =
  'NEEDS_LEGAL_REVIEW. Que un paciente suprimido pueda volver —porque lo pide ' +
  'él, porque una autoridad lo ordena, porque la supresión fue un error— es una ' +
  'decisión del responsable del tratamiento de los datos, documentada y con el ' +
  'titular delante. Un importador de respaldos que la tomara solo estaría ' +
  'fijando política legal desde un archivo subido por un formulario.'
