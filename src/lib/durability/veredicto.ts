/**
 * EL VEREDICTO DE UNA RESTAURACIÓN — «terminó» no es «salió bien».
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * `/api/clinic/importar` responde `{ ok: true, … }` siempre que no reviente. Con
 * el archivo cortado a la mitad responde `ok: true` y añade un `aviso`. Con
 * cuatrocientas líneas rechazadas responde `ok: true` y una lista.
 *
 * `ok: true` es lo que lee el que está esperando. El aviso es lo que lee el que
 * ya tiene tiempo de leer. No son la misma persona ni el mismo día.
 *
 * ── LAS CUATRO PALABRAS ──────────────────────────────────────────────────────
 *
 *   COMPLETA           todo lo que el archivo traía está escrito y concilia.
 *   PARCIAL            faltan cosas, se sabe cuáles, y ninguna es grave.
 *   REVISION_HUMANA    hay algo que una persona tiene que mirar ANTES de usar
 *                      el consultorio: verdad firmada, linaje o inquilino.
 *   FALLIDA            no se puede dar nada por restaurado.
 *
 * Y una regla que decide sola: **9 999 documentos bien y una nota firmada
 * corrupta no es COMPLETA**. La aritmética del porcentaje no aplica a un
 * documento medicolegal.
 *
 * Módulo PURO.
 */

export type Veredicto = 'COMPLETA' | 'PARCIAL' | 'REVISION_HUMANA' | 'FALLIDA'

/** Lo que se cuenta durante una restauración, y que decide el veredicto. */
export interface ConteosDeRestauracion {
  /** Documentos que el archivo traía y se admitían. */
  esperados: number
  /** Documentos escritos (o que se escribirían, en ensayo). */
  escritos: number
  /** Ya estaban idénticos en el destino: cuentan como restaurados. */
  yaEstaban: number
  /** Excluidos por política (llaves de API). No son pérdida. */
  excluidosPorPolitica: number
  /** Líneas que no se entendieron. */
  rechazadas: number
  /** Documentos detenidos a la espera de una persona. */
  enRevisionHumana: number
  /** Hallazgos referenciales P0. */
  bloqueantesReferenciales: number
  /** Documentos con referencia a otro consultorio. */
  contaminacionEntreConsultorios: number
  /** Notas firmadas que difieren del destino o cuyo sello no cuadra. */
  verdadFirmadaEnConflicto: number
}

export interface Dictamen {
  veredicto: Veredicto
  /** Frases en el idioma del médico, en orden de importancia. */
  porQue: string[]
  /** Lo que hay que hacer antes de usar el consultorio. Vacío si COMPLETA. */
  antesDeUsarlo: string[]
}

export const CONTEOS_EN_CERO: ConteosDeRestauracion = {
  esperados: 0, escritos: 0, yaEstaban: 0, excluidosPorPolitica: 0,
  rechazadas: 0, enRevisionHumana: 0, bloqueantesReferenciales: 0,
  contaminacionEntreConsultorios: 0, verdadFirmadaEnConflicto: 0,
}

/**
 * Dictamina.
 *
 * @param archivoCompleto el archivo traía su línea de cierre.
 * @param completitudDelRespaldo veredicto de `manifiesto.evaluarCompletitud`.
 */
export function dictaminar(
  c: ConteosDeRestauracion,
  archivoCompleto: boolean,
  completitudDelRespaldo: 'completo' | 'incompleto' | 'invalido',
): Dictamen {
  const porQue: string[] = []
  const antesDeUsarlo: string[] = []

  if (completitudDelRespaldo === 'invalido') {
    return {
      veredicto: 'FALLIDA',
      porQue: ['el archivo no es un respaldo legible de este producto: no se escribió nada.'],
      antesDeUsarlo: ['Conseguir un respaldo válido. Este archivo no sirve para restaurar.'],
    }
  }

  /**
   * ── LO GRAVE VA PRIMERO, Y GANA ──────────────────────────────────────────
   *
   * Un solo documento en cualquiera de estos tres estados cambia el veredicto
   * entero. No se promedia con los que salieron bien: el que salió mal es un
   * documento clínico concreto de una persona concreta.
   */
  if (c.verdadFirmadaEnConflicto > 0) {
    porQue.push(`${c.verdadFirmadaEnConflicto} nota(s) firmada(s) difieren de lo que ya hay en el consultorio, o su sello no cuadra con su contenido. NO se escribieron.`)
    antesDeUsarlo.push('Revisar una por una las notas firmadas en conflicto: decidir cuál es la buena es un acto medicolegal, no una opción de la restauración.')
  }
  if (c.contaminacionEntreConsultorios > 0) {
    porQue.push(`${c.contaminacionEntreConsultorios} documento(s) arrastran referencias a otro consultorio.`)
    antesDeUsarlo.push('Resolver las referencias entre consultorios ANTES de dejar entrar a nadie: un expediente que declara pertenecer a otro consultorio se filtra o desaparece de las consultas sin avisar.')
  }
  if (c.bloqueantesReferenciales > 0) {
    porQue.push(`${c.bloqueantesReferenciales} referencia(s) rotas graves: adendas sin su nota, notas bajo el paciente equivocado o linaje cruzado.`)
    antesDeUsarlo.push('Localizar los documentos con referencia rota. Una adenda sin su nota es una corrección legal sobre un documento que no está.')
  }

  const grave = c.verdadFirmadaEnConflicto + c.contaminacionEntreConsultorios
    + c.bloqueantesReferenciales + c.enRevisionHumana

  if (!archivoCompleto) {
    porQue.push('el archivo no traía la línea de cierre: está cortado, y lo que falta no se puede saber cuál era.')
    antesDeUsarlo.push('Conseguir el archivo entero. Lo escrito puede servir para rescatar datos; llamarlo respaldo completo es de donde salen las pérdidas que nadie ve venir.')
  }
  if (c.rechazadas > 0) {
    porQue.push(`${c.rechazadas} línea(s) no se entendieron y quedaron fuera, con su razón en el informe.`)
  }

  const restaurados = c.escritos + c.yaEstaban
  const faltan = c.esperados - restaurados
  if (faltan > 0) {
    porQue.push(`faltan ${faltan} documento(s) de los ${c.esperados} que el archivo traía.`)
  }

  if (grave > 0) {
    return { veredicto: 'REVISION_HUMANA', porQue, antesDeUsarlo }
  }
  if (restaurados === 0 && c.esperados > 0) {
    return {
      veredicto: 'FALLIDA',
      porQue: [...porQue, 'no se restauró ni un documento.'],
      antesDeUsarlo: ['Revisar el archivo y el informe de rechazos antes de volver a intentarlo.'],
    }
  }
  if (faltan > 0 || c.rechazadas > 0 || !archivoCompleto || completitudDelRespaldo !== 'completo') {
    if (completitudDelRespaldo !== 'completo' && archivoCompleto) {
      porQue.push('el respaldo no se pudo conciliar contra su propio pie (formato antiguo o descuadre de recuentos).')
    }
    return { veredicto: 'PARCIAL', porQue, antesDeUsarlo }
  }
  return { veredicto: 'COMPLETA', porQue: [], antesDeUsarlo: [] }
}

/** ¿Se puede dejar al médico usar el consultorio con este veredicto? */
export function puedeUsarseSinRevisar(v: Veredicto): boolean {
  return v === 'COMPLETA'
}

export const POR_QUE_9999_DE_10000_NO_ES_EXITO =
  'El porcentaje es la métrica de un sistema de archivos, no la de un ' +
  'expediente. Si de diez mil documentos hay uno que es una nota firmada ' +
  'corrupta, lo que ha pasado es que el expediente de una persona está mal — y ' +
  'esa persona no se entera por un 99.99 %. La restauración lo dice con una ' +
  'palabra que obliga a mirar.'
