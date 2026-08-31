/**
 * LO QUE SE DIJO QUE LE HICIERON, Y NO QUEDÓ EN NINGUNA PARTE.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * El extractor de entidades reconoce **procedimientos** desde hace tiempo, con su
 * fecha, su lateralidad y la cita del dictado que los sostiene
 * (`EntidadProcedimiento`, `medical-ner.ts:62`). El panel de entidades los pinta.
 *
 * Y ahí se acaban. Medido sobre el árbol: el único consumidor de
 * `entidades.procedures` fuera del panel y de las pruebas **no existe**. No hay
 * campo en `NotaMedica`, no entra a la nota, no se sella, no se proyecta.
 *
 * Así que «le hicieron una colecistectomía en 2019» y «tiene un stent en la
 * descendente anterior desde 2022» se reconocen, se pintan en un panel, y
 * desaparecen al cerrar la consulta salvo que el médico los teclee a mano en la
 * prosa. En la consulta siguiente, nadie sabe que se dijeron.
 *
 * ── POR QUÉ IMPORTA MÁS QUE OTRAS PÉRDIDAS ───────────────────────────────────
 *
 * Un antecedente quirúrgico cambia conducta: cambia lo que se puede prescribir,
 * lo que se puede pedir, lo que se puede operar y lo que hay que anticoagular.
 * Y la **lateralidad** es uno de los pares prohibidos de este repositorio
 * (derecha ↔ izquierda), justo el dato que se pierde primero cuando algo se
 * reescribe de memoria en la consulta siguiente.
 *
 * ── LO QUE ESTE MÓDULO HACE, Y LO QUE NO ─────────────────────────────────────
 *
 * **No documenta nada por su cuenta.** Compara lo que el extractor oyó con lo
 * que la nota dice, y cuando un procedimiento no aparece **lo señala antes de
 * firmar**. Documentarlo es del médico: un módulo que escribiera un antecedente
 * quirúrgico en la nota sin que nadie lo revisara estaría redactando historia
 * clínica, y de ahí cuelga una firma con cédula profesional.
 *
 * Sale por el mismo camino que las otras cinco cosas que este producto señala
 * antes de firmar (`avisos-consulta.ts`), así que desde REG-366 **queda sellado
 * en la nota** y desde REG-367 **vuelve a salir en la consulta siguiente** si
 * sigue hablando de un problema vigente. No se añade un recuadro nuevo.
 *
 * ── LO QUE NO SE HIZO, Y POR QUÉ ─────────────────────────────────────────────
 *
 * No se creó un campo `procedimientos` en `NotaMedica`. Un campo nuevo de
 * contenido clínico tiene que ir DENTRO del sello de integridad, y el sello v3
 * es una lista explícita de campos: añadir uno exige un **sello v4** —con su
 * canónico, su vector golden y su partición de cobertura— para que las notas ya
 * firmadas con v3 sigan verificando. Eso es una unidad aparte y está declarada
 * como tal; meterlo aquí de tapadillo dejaría contenido clínico firmado **fuera
 * del sello**, que es exactamente lo que E0-12 vino a cerrar.
 *
 * Módulo PURO.
 */

/** Un procedimiento tal como lo devuelve el extractor. */
export interface ProcedimientoOido {
  texto: string
  fecha?: string
  lateralidad?: string
  /** La cita del dictado que lo sostiene. */
  source_quote?: string
}

export interface ProcedimientoSinEscribir {
  /** Tal como lo oyó el extractor. */
  texto: string
  fecha?: string
  /** Sólo cuando el extractor la determinó: `no_aplica` no es lateralidad. */
  lateralidad?: string
}

const norm = (s: string) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Longitud mínima de una palabra para buscarla dentro de la nota.
 *
 * Es el mismo criterio que `la-duda-de-la-otra-vez` y que el emparejador de
 * fármacos del copiloto, y por la misma razón: las palabras cortas casan con
 * cualquier cosa, y un aviso que salta de más se aprende a cerrar.
 */
export const MINIMO_PALABRA_UTIL = 6

/** ¿La nota habla de este procedimiento? */
function estaEnLaNota(texto: string, notaNormalizada: string): boolean {
  const palabras = norm(texto).split(/[^a-z0-9]+/).filter(w => w.length >= MINIMO_PALABRA_UTIL)
  /**
   * Sin ninguna palabra larga NO se puede comprobar, y entonces **no se avisa**.
   *
   * Es la decisión incómoda de este módulo y va escrita: un procedimiento
   * llamado «TAC» o «PET» no se puede buscar con este criterio, así que se deja
   * pasar en silencio en vez de gritar sobre algo que quizá sí está escrito.
   * Regla 5: señalar de menos, y declararlo.
   */
  if (!palabras.length) return true
  return palabras.some(w => new RegExp(`(?<![a-z0-9])${w}(?![a-z0-9])`).test(notaNormalizada))
}

/**
 * Los procedimientos que el extractor oyó y la nota no recoge.
 *
 * @param oidos      `entidades.procedures` del extractor.
 * @param textoNota  Todo lo que la nota dice: prosa, resumen, diagnósticos.
 */
export function procedimientosQueNoQuedaronEscritos(
  oidos: readonly ProcedimientoOido[] | undefined,
  textoNota: string,
): ProcedimientoSinEscribir[] {
  const nota = norm(textoNota)
  const fuera: ProcedimientoSinEscribir[] = []
  const vistos = new Set<string>()

  for (const p of oidos ?? []) {
    const texto = String(p?.texto ?? '').trim()
    if (!texto) continue
    const k = norm(texto)
    if (!k || vistos.has(k)) continue
    vistos.add(k)
    if (estaEnLaNota(texto, nota)) continue
    fuera.push({
      texto,
      ...(p.fecha?.trim() ? { fecha: p.fecha.trim() } : {}),
      /* `no_aplica` es el valor por defecto del esquema: no es una lateralidad
         que alguien haya determinado, y enseñarla afirmaría un dato que nadie
         dio. Misma regla que REG-365 con `presuntivo`. */
      ...(p.lateralidad && p.lateralidad !== 'no_aplica' ? { lateralidad: p.lateralidad } : {}),
    })
  }
  return fuera
}

/** Cómo se le dice al médico, una frase por procedimiento. */
export function avisoDeProcedimientoSinEscribir(p: ProcedimientoSinEscribir): string {
  const detalles = [p.lateralidad, p.fecha].filter(Boolean).join(' · ')
  return `Se mencionó «${p.texto}»${detalles ? ` (${detalles})` : ''} y la nota no lo recoge. ` +
    'Un antecedente quirúrgico que no queda escrito no existe en la consulta siguiente.'
}

export const POR_QUE_NO_SE_ESCRIBE_SOLO =
  'Porque un módulo que escribiera un antecedente quirúrgico en la nota sin que ' +
  'nadie lo revisara estaría redactando historia clínica, y de esa nota cuelga ' +
  'una firma con cédula profesional. Se señala antes de firmar; documentarlo es ' +
  'del médico.'

export const POR_QUE_NO_HAY_CAMPO_EN_LA_NOTA =
  'Porque un campo nuevo de contenido clínico tiene que ir DENTRO del sello de ' +
  'integridad, y el sello v3 es una lista explícita de campos: añadir uno exige ' +
  'un sello v4 —canónico, vector golden y partición de cobertura— para que las ' +
  'notas ya firmadas con v3 sigan verificando. Meterlo sin eso dejaría contenido ' +
  'clínico firmado FUERA del sello, que es lo que E0-12 vino a cerrar.'
