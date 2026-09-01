/**
 * UNA SOLA RESPUESTA A «¿POR QUÉ NO PUEDO FIRMAR?».
 *
 * ── EL DEFECTO (6-ago-2026, REG-189) ─────────────────────────────────────────
 *
 * La razón por la que no se podía firmar estaba repartida en **dos sitios que no
 * se hablaban**, y cada uno mentía a su manera:
 *
 *   · El BOTÓN se apagaba con `validacion.valida` — sólo NOM-004. La compuerta
 *     de dosis (REG-174/175) vive dentro de `firmar()`, así que con una dosis
 *     incompleta el botón se veía **encendido**: el médico lo pulsaba, salía un
 *     toast, y no pasaba nada.
 *   · La BARRA «Antes de firmar» contaba los bloqueos desde los avisos de
 *     dosis, y **no miraba NOM-004**. Con una sección obligatoria vacía decía
 *     «nada te impide firmar» junto a un botón apagado.
 *
 * Las dos mitades decían la verdad a medias, y el médico veía la contradicción
 * completa.
 *
 * ── LO QUE ESTO NO ES ────────────────────────────────────────────────────────
 *
 * **No cambia la política.** Ni una sola condición se añade ni se quita: lo que
 * impedía firmar ayer impide firmar hoy. Lo único que cambia es que **se dice en
 * un solo sitio, antes de pulsar**, en vez de en dos que se contradicen.
 *
 * Que la falta de dosis bloquee fue decisión del médico dueño (5-ago, con el
 * dato delante). Aquí sólo se hace visible lo que ya estaba decidido: un botón
 * que se apaga sin decir por qué es la misma decisión, peor contada.
 *
 * Módulo PURO.
 */

export interface MotivoDeBloqueo {
  /** De dónde sale: NOM-004, la compuerta de dosis, o la atribución de la firma. */
  origen: 'nom004' | 'dosis' | 'atribucion'
  /** El texto que ya redacta cada motor. No se parafrasea. */
  texto: string
}

export interface EntradaBloqueo {
  /** `validarNOM004(...).errores` — secciones obligatorias, cédula, diagnóstico. */
  erroresNOM004?: readonly string[]
  /** Los medicamentos con la dosis incompleta, con el mensaje de su motor. */
  dosisIncompletas?: readonly { nombre: string; mensaje: string }[]
  /**
   * NO SE SABE A QUIÉN ATRIBUIR LA FIRMA — REG-336.
   *
   * `true` cuando la identidad que se va a estampar en `nota.firma` no trae
   * nombre. Lo aporta la consulta desde `identidadFirma`, que es EXACTAMENTE el
   * objeto que acaba dentro del snapshot: vigilar cualquier otra cosa dejaría
   * la compuerta mirando un valor distinto del que se guarda.
   *
   * ── POR QUÉ ES UN BLOQUEO Y NO UN AVISO ──────────────────────────────────
   *
   * `nota.firma` es INMUTABLE. Una nota firmada sin nombre pasa NOM-004 —que
   * pide `medicoId` y cédula, no el nombre—, se guarda bien, imprime su receta…
   * y no se le puede entregar nunca al paciente, porque `componerPaquete` sí
   * exige el nombre. Cuando se descubre, ya no hay nada que corregir.
   *
   * Es la familia de REG-189 y la del aviso de dosis: el aviso llegaba DESPUÉS
   * de firmar. La cura es la misma — decirlo cuando todavía se puede arreglar.
   */
  sinQuienFirma?: boolean
}

/**
 * Todo lo que impide firmar, en un orden estable.
 *
 * Primero la ATRIBUCIÓN (REG-336): es el único motivo que no está en esta
 * pantalla, así que es el único que el médico no puede resolver sin que se lo
 * digan. Después NOM-004, porque una sección obligatoria vacía es más barata de
 * arreglar que buscar una dosis, y por último las dosis.
 */
export function motivosParaNoFirmar(e: EntradaBloqueo): MotivoDeBloqueo[] {
  const out: MotivoDeBloqueo[] = []
  /**
   * LA ATRIBUCIÓN VA PRIMERA, Y NO POR IMPORTANCIA — REG-336.
   *
   * `porQueNoSePuedeFirmar` enseña el PRIMER motivo y remata con «y N más
   * arriba». Para las secciones vacías y las dosis eso es literal: están en esta
   * pantalla, más arriba, y el médico las ve.
   *
   * El nombre de quien firma NO está arriba: vive en Configuración. Puesto el
   * último, el único motivo que el médico no puede encontrar solo era también el
   * único que el mensaje nunca le enseñaba, y encima lo mandaba a mirar donde no
   * está. Primero, el mensaje que se ve es el accionable.
   */
  if (e.sinQuienFirma) {
    out.push({
      origen: 'atribucion',
      texto: 'Falta el nombre del médico que firma: sin él la nota queda sin a quién atribuirse '
        + 'y no se le puede entregar nada al paciente. Se escribe en Configuración → General.',
    })
  }
  for (const t of e.erroresNOM004 ?? []) {
    const texto = String(t ?? '').trim()
    if (texto) out.push({ origen: 'nom004', texto })
  }
  for (const d of e.dosisIncompletas ?? []) {
    const texto = String(d?.mensaje ?? '').trim()
    if (texto) out.push({ origen: 'dosis', texto })
  }
  return out
}

/** ¿Se puede firmar? Una sola pregunta, una sola respuesta. */
export function sePuedeFirmar(e: EntradaBloqueo): boolean {
  return motivosParaNoFirmar(e).length === 0
}

/**
 * La frase para el `title` del botón apagado y para el renglón de al lado.
 *
 * ── POR QUÉ ESTO IMPORTA MÁS DE LO QUE PARECE ────────────────────────────────
 *
 * El mensaje que explica el bloqueo **ya existía** —lo redacta cada motor— y era
 * inalcanzable: el del toast sólo salía al pulsar, y el de NOM-004 vive en un
 * recuadro que puede quedar fuera de la pantalla cuando el médico está abajo,
 * junto al botón, que es donde tiene el dedo.
 *
 * Un botón gris sin explicación es la peor forma de decir que no.
 */
export function porQueNoSePuedeFirmar(e: EntradaBloqueo): string {
  const m = motivosParaNoFirmar(e)
  if (m.length === 0) return ''
  if (m.length === 1) return `No se puede firmar todavía: ${m[0].texto}`
  return `No se puede firmar todavía — ${m.length} cosas por resolver: ${m[0].texto}`
}

export const POR_QUE_UNA_SOLA_FUENTE =
  'El botón se apagaba con NOM-004 y la barra contaba sólo la dosis. Con una ' +
  'dosis incompleta el botón se veía encendido y fallaba al pulsarlo; con una ' +
  'sección vacía la barra decía «nada te impide firmar» junto a un botón ' +
  'apagado. Cada mitad decía la verdad a medias.'

export const POR_QUE_LA_ATRIBUCION_BLOQUEA =
  'NOM-004 pide medicoId y cédula, no el nombre; `componerPaquete` pide nombre ' +
  'y cédula. Entre las dos cabía una nota firmable e inentregable, y `nota.firma` ' +
  'es inmutable: cuando se nota, ya no hay nada que corregir. Se exige antes de ' +
  'estampar, que es el único momento en que todavía se puede arreglar.'

export const NO_CAMBIA_LA_POLITICA =
  'Ni una condición se añade ni se quita: lo que impedía firmar ayer impide ' +
  'firmar hoy. Lo que cambia es que se dice en un sitio y ANTES de pulsar.'
