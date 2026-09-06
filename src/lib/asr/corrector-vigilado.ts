/**
 * CORRECTOR VIGILADO — el corrector léxico de siempre, con el guardián delante.
 *
 * ── POR QUÉ ENVUELVE Y NO REEMPLAZA ──────────────────────────────────────────
 *
 * `corregirTranscripcion()` funciona: une lo que Whisper parte («em pagli
 * flozina» → «empagliflozina»), arregla confusiones medidas en el corpus y
 * expande siglas. Tirarlo para poner un pipeline nuevo sería cambiar algo que
 * sirve por algo sin medir.
 *
 * Lo que le faltaba no era capacidad: era **alguien que mirara su salida**. El
 * corrector ya anotaba cada cambio en `cambios[]` — y nadie los leía, así que
 * durante meses se comió dosis en producción sin que nada avisara (REG-065).
 *
 * Esto es ese alguien. Misma entrada, misma salida, más un veredicto.
 *
 * ── CONTRATO ─────────────────────────────────────────────────────────────────
 *
 * `corregido` es lo que debe usarse: la corrección si pasó el guardián, y el
 * **texto crudo** si no pasó. `crudo` siempre está disponible — nunca se borra el
 * transcript original, es la regla nº 5 del paquete del Dr.
 *
 * Módulo PURO.
 */

import {
  corregirTranscripcion,
  type CambioTranscripcion, type ResultadoCorreccion,
} from '@/lib/expediente/medical-vocabulary'
import { verificar, type Violacion } from '@/lib/asr/guardian-sustituciones'
import { dosisSinNumero, type DosisRota } from '@/lib/uci/dosis-sin-numero'

export interface ResultadoVigilado extends ResultadoCorreccion {
  /** El transcript tal cual llegó del reconocedor. NUNCA se descarta. */
  crudo: string
  /** Lo que el corrector había propuesto, aunque se haya revertido. */
  propuesto: string
  /** `true` si el guardián descartó la corrección. */
  revertido: boolean
  /**
   * Cuántas frases se revirtieron, de cuántas.
   *
   * Es el ALCANCE real. Antes la alerta decía «se revirtió» sobre un documento
   * entero sin decir cuánto: el médico no podía saber si había perdido una
   * corrección o todas.
   */
  frasesRevertidas: number
  frasesTotales: number
  violaciones: Violacion[]
  /** Unidades de dosis que se quedaron sin cantidad delante. */
  dosisRotas: DosisRota[]
  /** La pantalla debe pedirle confirmación al médico. */
  requiereConfirmacion: boolean
}

/**
 * Corrige y vigila.
 *
 * @param texto lo que devolvió el reconocedor.
 */
/**
 * Trocea por frases conservando el separador, para poder recomponer sin perder
 * ni un espacio. Lo que no se toca no se puede estropear.
 */
export function frasesConSeparador(t: string): string[] {
  return t.split(/(?<=[.?!\n])/).filter(x => x.length > 0)
}

/**
 * ── LA REVERSIÓN DEJA DE SER TODO-O-NADA ─────────────────────────────────────
 *
 * El guardián compara los textos **completos** y, ante una sola violación,
 * devuelve el crudo entero. Consecuencia: bastaba que UNA cifra desapareciera en
 * el minuto 18 para que se descartaran **todas** las correcciones de fármacos de
 * la consulta — «sefriaxona» incluida.
 *
 * Y el daño crecía con la duración: cuantas más cifras tiene un dictado, más
 * probable es perderlo todo. Justo al revés de lo que conviene, porque la
 * consulta larga es la que más se beneficia del corrector.
 *
 * ── POR QUÉ ESTO NO DEBILITA LA GARANTÍA ─────────────────────────────────────
 *
 * La reversión por frase es sólo el intento. Después se **vuelve a verificar el
 * documento recompuesto contra el crudo**, y si queda cualquier violación se cae
 * al comportamiento de siempre: crudo entero.
 *
 * O sea que la salida sigue pasando `verificar()` exactamente igual que antes.
 * Lo único que cambia es cuánto se tira cuando el problema está en una frase.
 */
export function corregirVigilado(texto: string): ResultadoVigilado {
  const { corregido, cambios } = corregirTranscripcion(texto)
  const vDoc = verificar(texto, corregido)

  let v = vDoc
  let cambiosAplicados = cambios
  let frasesRevertidas = 0
  let frasesTotales = 1

  if (vDoc.revertido) {
    const partes = frasesConSeparador(texto)
    frasesTotales = partes.length
    if (partes.length > 1) {
      /**
       * Frase por frase: cada una se corrige y se juzga sola. La que pasa se
       * queda corregida; la que no, se queda cruda.
       */
      const recompuesto = partes.map(fr => {
        const c = corregirTranscripcion(fr)
        const vf = verificar(fr, c.corregido)
        if (vf.revertido) { frasesRevertidas++; return fr }
        return c.corregido
      }).join('')

      /**
       * LA COMPROBACIÓN QUE LO HACE SEGURO.
       *
       * Corregir por frases puede producir un documento que, visto entero,
       * todavía viole algo —el guardián cuenta apariciones, y una frase no ve a
       * las demás—. Si eso pasa, se cae al crudo entero, igual que antes.
       */
      const vFinal = verificar(texto, recompuesto)
      if (!vFinal.revertido) {
        v = vFinal
        // Sólo se anuncian los cambios que de verdad sobrevivieron.
        cambiosAplicados = cambios.filter(c => recompuesto.includes(c.corregido))
      } else {
        frasesRevertidas = frasesTotales
      }
    } else {
      frasesRevertidas = 1
    }
  }

  // La dosis sin número se busca en el texto QUE SE VA A USAR: si el guardián
  // revirtió, el que importa es el crudo.
  const dosisRotas = dosisSinNumero(v.texto)

  return {
    corregido: v.texto,
    // Si se revirtió, los cambios no se aplicaron: no se anuncian como hechos.
    cambios: v.revertido ? [] : cambiosAplicados,
    crudo: texto,
    propuesto: corregido,
    revertido: v.revertido,
    /**
     * Las violaciones son SIEMPRE las del documento entero.
     *
     * Aunque el texto que se use sea el recompuesto, lo que el médico tiene que
     * ver es qué pasó — y pasó sobre el dictado completo. Enseñar sólo las de
     * las frases revertidas escondería la mitad del problema.
     */
    violaciones: vDoc.violaciones,
    frasesRevertidas,
    frasesTotales,
    dosisRotas,
    requiereConfirmacion: v.requiereConfirmacion || vDoc.requiereConfirmacion || dosisRotas.length > 0,
  }
}

/**
 * Lo que hay que enseñarle al médico, ya aplanado.
 *
 * La pantalla no debe razonar sobre clases de error ni sobre estructuras: recibe
 * una lista de avisos con título y explicación, y los muestra.
 */
export interface AlertaDictado {
  tipo: 'sustitucion' | 'dosis-sin-cantidad' | 'lateralidad'
  titulo: string
  detalle: string
}

export function alertasDe(r: ResultadoVigilado): AlertaDictado[] {
  return [
    ...r.violaciones.map((v): AlertaDictado => ({
      tipo: 'sustitucion',
      titulo: v.despues === '—'
        ? `Se descartó una corrección que borraba «${v.antes}»`
        : `Se descartó una corrección: «${v.antes}» → «${v.despues}»`,
      detalle: `${v.mensaje} Se conservó lo que usted dictó; revise esa parte.`,
    })),
    /**
     * EL ALCANCE, que antes no se decía.
     *
     * «Se descartó una corrección» sobre un dictado de veinte minutos no dice si
     * se perdió una frase o la consulta entera. Con la reversión por frases esa
     * diferencia ya existe, así que hay que contarla.
     */
    ...(r.frasesRevertidas > 0 && r.frasesTotales > 1
      ? [{
          tipo: 'sustitucion' as const,
          titulo: r.frasesRevertidas === r.frasesTotales
            ? 'Se conservó el dictado completo sin corregir'
            : `Se conservaron ${r.frasesRevertidas} de ${r.frasesTotales} frases sin corregir`,
          detalle: r.frasesRevertidas === r.frasesTotales
            ? 'El guardián no pudo garantizar ninguna corrección en este dictado.'
            : 'El resto del dictado sí se corrigió: sólo se dejó intacto lo que no se pudo garantizar.',
        }]
      : []),
    ...r.dosisRotas.map((d): AlertaDictado => ({
      tipo: 'dosis-sin-cantidad',
      titulo: `Falta la cantidad en «${d.antes} ${d.unidad}»`,
      detalle: d.mensaje,
    })),
  ]
}

/** Los cambios que el corrector propuso y el guardián tiró. Para auditoría. */
export function cambiosDescartados(r: ResultadoVigilado): CambioTranscripcion[] {
  if (!r.revertido) return []
  return corregirTranscripcion(r.crudo).cambios
}

export const POR_QUE_VIGILADO =
  'El corrector léxico no se reemplaza: se vigila. Cada corrección se compara ' +
  'contra el texto crudo y se descarta si toca una cifra, una unidad, una sigla ' +
  'crítica, una negación o la lateralidad. El transcript crudo nunca se borra.'
