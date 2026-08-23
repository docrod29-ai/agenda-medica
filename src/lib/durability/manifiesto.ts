/**
 * COMPLETITUD DEL RESPALDO — «la exportación terminó» no es «el respaldo está
 * completo».
 *
 * ── EL HUECO QUE ESTE MÓDULO CIERRA ──────────────────────────────────────────
 *
 * El respaldo NDJSON de `clinic/exportar` ya trae cabecera y pie, y el pie ya
 * dice `completo: true|false`. Pero ese booleano se calcula de UNA sola cosa:
 * si alguna colección lanzó una excepción al leerse.
 *
 * Eso deja pasar el fallo caro, que no lanza nada:
 *
 *   · una rama del árbol que nadie declaró → se exporta un nivel de más arriba,
 *     no falla nada, y el pie dice `completo: true` (es EXACTAMENTE lo que pasó
 *     con `patients/{p}/notas/{n}/adendas`, y el archivo lo certificaba);
 *   · una colección que se lee bien y devuelve cero documentos porque el cursor
 *     se perdió a mitad de página;
 *   · una descarga que se corta después del último documento y antes del pie —
 *     que sí se detecta, pero sólo si alguien mira.
 *
 * Un pie que no lleva **el recuento por colección** no permite conciliar nada:
 * el que restaura no puede comparar lo que llegó con lo que debía llegar. Y sin
 * esa comparación, «restauramos 10 000 documentos» no dice si faltaban 300.
 *
 * ── LO QUE SE EXIGE PARA DECIR «COMPLETO» ────────────────────────────────────
 *
 *  1. cabecera con `formato`, `clinicId`, `generadoEn`, `schemaVersion`;
 *  2. pie presente (sin pie el archivo está cortado, punto);
 *  3. recuento por colección en el pie;
 *  4. huella del conjunto en el pie;
 *  5. lo observado al releer coincide con lo declarado, colección por colección.
 *
 * Falla cualquiera de las cinco → INCOMPLETO o INVÁLIDO. Nunca «completo con
 * advertencias»: un respaldo con advertencias es un respaldo que alguien va a
 * dar por bueno a las tres de la mañana.
 *
 * Módulo PURO.
 */
import { EXCLUIDAS, indiceRespaldo } from '@/lib/clinica/respaldo'

/**
 * Versión del contrato del archivo.
 *
 * `nexusmed-respaldo-1` es el formato que hay en producción: cabecera + pie con
 * `documentos` y `problemas`, sin recuentos por colección y sin huella. Se
 * sigue leyendo —los archivos ya descargados por médicos no se invalidan— pero
 * NO puede alcanzar el veredicto `completo`, porque le faltan los datos con los
 * que se comprueba. Eso se dice, en vez de degradarlo en silencio.
 */
export const FORMATO_V1 = 'nexusmed-respaldo-1'
export const FORMATO_V2 = 'nexusmed-respaldo-2'
export const FORMATOS_LEGIBLES = [FORMATO_V1, FORMATO_V2] as const

/** Cabecera del archivo, primera línea. */
export interface CabeceraRespaldo {
  _tipo: 'cabecera'
  formato: string
  /** Versión del ÁRBOL de colecciones con el que se generó. */
  schemaVersion: number
  clinicId: string
  generadoEn: string
  indice: Record<string, string>
  excluidas: Record<string, string>
  /**
   * Lo que este archivo NO contiene aunque exista en el consultorio, con su
   * razón. Sin esto, el que restaura cree que un metadato de foto restaurado es
   * una foto restaurada.
   */
  fueraDelArchivo: Record<string, string>
}

/** Pie del archivo, última línea. Sin él, el archivo se cortó. */
export interface PieRespaldo {
  _tipo: 'pie'
  documentos: number
  /** Recuento por colección de primer nivel y por rama. La base de la conciliación. */
  conteos: Record<string, number>
  /** Huella del conjunto de documentos (ver `huellas.ts`). */
  huella: string
  /** Ramas que no se pudieron leer. Cada una es una pérdida declarada. */
  problemas: string[]
  completo: boolean
}

/**
 * Lo que el respaldo NDJSON no puede llevarse, y hay que decirlo en la cabecera.
 *
 * `EXCLUIDAS` cubre las colecciones de Firestore que se dejan fuera A PROPÓSITO.
 * Esto cubre lo otro: lo que ni siquiera vive en Firestore, así que ningún
 * manifiesto de colecciones lo iba a echar de menos.
 */
export const FUERA_DEL_ARCHIVO: Readonly<Record<string, string>> = {
  'storage:objetos': 'Los BYTES de las imágenes clínicas y del membrete/firma viven en Cloud Storage, no en Firestore. Este archivo lleva su metadato (incluida la `url`), NUNCA el objeto. Restaurar en otro consultorio deja el metadato apuntando a un objeto que ese consultorio puede no poder leer: se declara como pérdida conocida, no se presenta como restaurado.',
  'storage:consultas-audio': 'El audio de la consulta es efímero por diseño (lo borra el hook y, si la pestaña muere, el cron `limpiar-audio`). Lo que tiene que sobrevivir —`transcripcionMotor` y `transcripcionCruda`— viaja DENTRO de la nota.',
  'auth:usuarios': 'Las cuentas de Firebase Auth no son del consultorio: son de la plataforma. Restaurar un respaldo en un consultorio nuevo no recrea los inicios de sesión, y los `medicoId` de las notas apuntarán a cuentas que hay que volver a dar de alta.',
  'plataforma:colecciones-raiz': 'Lo que vive fuera de `clinics/{id}` (pagos de Stripe, libro de costos, bitácora de administración, telemetría) no es del consultorio y tiene su propio régimen en `src/lib/ops/retencion.ts`.',
}

export type EstadoCompletitud = 'completo' | 'incompleto' | 'invalido'

export interface VeredictoCompletitud {
  estado: EstadoCompletitud
  /** Por qué. Vacío sólo cuando el estado es `completo`. */
  motivos: string[]
  /** Colecciones donde lo declarado y lo observado no coinciden. */
  descuadres: { coleccion: string; declarado: number; observado: number }[]
  /** El formato del archivo permite alcanzar el veredicto `completo`. */
  formatoConciliable: boolean
}

/** Lo que se cuenta al releer el archivo, para comparar con el pie. */
export interface ObservadoAlReleer {
  documentos: number
  conteos: Record<string, number>
  huella: string
}

/**
 * ¿Este archivo puede darse por respaldo completo?
 *
 * @param cabecera `null` si la primera línea no era una cabecera.
 * @param pie `null` si el archivo no traía pie: se cortó.
 * @param observado lo que se contó al releerlo de verdad.
 */
export function evaluarCompletitud(
  cabecera: Partial<CabeceraRespaldo> | null,
  pie: Partial<PieRespaldo> | null,
  observado: ObservadoAlReleer,
): VeredictoCompletitud {
  const motivos: string[] = []
  const descuadres: VeredictoCompletitud['descuadres'] = []

  if (!cabecera) {
    motivos.push('sin cabecera: no se sabe de qué consultorio salió ni con qué árbol de colecciones')
  } else if (!FORMATOS_LEGIBLES.includes(cabecera.formato as typeof FORMATOS_LEGIBLES[number])) {
    motivos.push(`formato desconocido: ${String(cabecera.formato)}`)
  }
  if (cabecera && !cabecera.clinicId) {
    motivos.push('la cabecera no dice de qué consultorio salió')
  }

  /**
   * SIN PIE NO HAY RESPALDO.
   *
   * No es una advertencia: es la diferencia entre «tengo el archivo entero» y
   * «tengo lo que dio tiempo a escribir antes de que se cortara la descarga».
   * Lo escrito puede servir para rescatar datos, y por eso el importador lo
   * admite — pero llamarlo respaldo completo es de dónde salen las pérdidas que
   * nadie ve venir.
   */
  if (!pie) {
    motivos.push('sin línea de cierre: el archivo está cortado y lo que falta no se puede saber cuál era')
  }

  const formatoConciliable = !!pie && !!pie.conteos && typeof pie.huella === 'string' && pie.huella.length > 0

  if (pie && !formatoConciliable) {
    motivos.push(
      'el pie no trae recuento por colección ni huella: es un archivo del formato ' +
      `${FORMATO_V1}, que se puede LEER pero no CONCILIAR. Vuelve a generarlo para poder ` +
      'compararlo, o dalo por «incompleto no verificable» — nunca por completo.',
    )
  }

  if (pie?.problemas?.length) {
    motivos.push(`ramas ilegibles declaradas en el pie: ${pie.problemas.join(', ')}`)
  }

  if (pie && typeof pie.documentos === 'number' && pie.documentos !== observado.documentos) {
    motivos.push(`el pie declara ${pie.documentos} documentos y al releer hay ${observado.documentos}`)
  }

  if (pie?.conteos) {
    const colecciones = new Set([...Object.keys(pie.conteos), ...Object.keys(observado.conteos)])
    for (const c of [...colecciones].sort()) {
      const declarado = pie.conteos[c] ?? 0
      const obs = observado.conteos[c] ?? 0
      if (declarado !== obs) descuadres.push({ coleccion: c, declarado, observado: obs })
    }
    if (descuadres.length) {
      motivos.push(`descuadre por colección en ${descuadres.length}: ${descuadres.map(d => `${d.coleccion} ${d.declarado}≠${d.observado}`).join(', ')}`)
    }
  }

  if (pie?.huella && observado.huella && pie.huella !== observado.huella) {
    motivos.push('la huella del conjunto no coincide: el contenido cambió entre generar el archivo y releerlo')
  }

  /**
   * INVÁLIDO es «no se puede ni intentar»; INCOMPLETO es «se puede intentar,
   * pero no se puede llamar respaldo». Distinguirlos importa: sobre el
   * incompleto se rescata lo que hay, sobre el inválido no se toca nada.
   */
  const invalido = !cabecera
    || !FORMATOS_LEGIBLES.includes(cabecera.formato as typeof FORMATOS_LEGIBLES[number])
    || !cabecera.clinicId
  const estado: EstadoCompletitud = invalido ? 'invalido' : motivos.length ? 'incompleto' : 'completo'
  return { estado, motivos, descuadres, formatoConciliable }
}

/** La cabecera que emite el formato v2. Un solo sitio, para que no diverja. */
export function cabeceraV2(clinicId: string, generadoEn: string, schemaVersion: number): CabeceraRespaldo {
  return {
    _tipo: 'cabecera',
    formato: FORMATO_V2,
    schemaVersion,
    clinicId,
    generadoEn,
    indice: indiceRespaldo(),
    excluidas: EXCLUIDAS,
    fueraDelArchivo: { ...FUERA_DEL_ARCHIVO },
  }
}

/** El pie que emite el formato v2. */
export function pieV2(
  documentos: number, conteos: Record<string, number>, huella: string, problemas: string[],
): PieRespaldo {
  return {
    _tipo: 'pie',
    documentos,
    conteos,
    huella,
    problemas,
    /**
     * `completo` sigue significando «ninguna rama se quedó sin leer». Lo que
     * cambia es que ahora el pie trae CON QUÉ desmentirlo: quien restaura ya no
     * tiene que creerse el booleano.
     */
    completo: problemas.length === 0,
  }
}

export const POR_QUE_UN_PIE_SIN_CONTEOS_NO_CONCILIA =
  'Un pie que sólo dice «terminé» permite comprobar que la descarga no se ' +
  'cortó. No permite comprobar que se llevó lo que había: para eso hace falta ' +
  'saber CUÁNTO había de cada cosa. Sin ese recuento, una rama que se exporta ' +
  'vacía por un error de cursor es indistinguible de una rama que estaba vacía ' +
  '— y las dos se leen como «completo».'
