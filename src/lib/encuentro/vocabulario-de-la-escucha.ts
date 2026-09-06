/**
 * ── UN ESTADO, DICHO UNA VEZ ────────────────────────────────────────────────
 *
 * MEDIDO en navegador el 1-sep-2026, con la consulta grabando de verdad
 * (micrófono falso, ciclo completo desde el consentimiento):
 *
 *   relojes a la vez ........ 4   →  «0:39», «0:39», «00:39», «00:39»
 *   palabras de estado ...... 3   →  «Grabando», «Escuchando», «Esperando voz»
 *   controles de detener .... 2   →  «Terminar», «Detener y generar nota»
 *   regiones aria-live ...... 6
 *
 * Los cuatro relojes cuentan el MISMO segundo en DOS formatos, y las tres
 * palabras describen el MISMO estado — una de ellas, «Esperando voz…»,
 * contradiciendo a las otras dos mientras la barra de nivel se movía. El médico
 * no puede saber, mirando, si el micrófono está captando.
 *
 * ── POR QUÉ PASÓ, QUE NO ES LO QUE PARECE ───────────────────────────────────
 *
 * NO hay cuatro fuentes de verdad: hay una sola, el `EVENTO_GRABANDO` que ya
 * escuchan `MarcoEscuchando`, `InstrumentStrip`, `FlowRail` y `BottomNav`, y el
 * propio código lo declara. El invariante de arquitectura se respeta.
 *
 * Lo que se duplicó fue la PRESENTACIÓN. «La misma entidad se pinta distinto
 * según dónde se mire» permite que la barra superior sea discreta y la banda del
 * encuentro sea grande. No permite que una diga «Escuchando» y otra «Grabando»
 * del mismo segundo: eso no es pintar distinto, es DECIR distinto.
 *
 * Por eso el vocabulario vive aquí y no en cada componente.
 *
 * ── POR QUÉ «GRABANDO» Y NO «ESCUCHANDO» ────────────────────────────────────
 *
 * «Escuchando» suena mejor y es la palabra equivocada. El paciente firmó un
 * consentimiento para que la conversación **se grabe** y se transcriba; el audio
 * se guarda y `data-privacy` declara que la voz es biométrica. Llamarle
 * «escuchar» a un acto que el paciente consintió como grabar suaviza justo lo
 * que no se debe suavizar, y en la pantalla donde está delante.
 *
 * ── POR QUÉ `mm:ss` Y NO `m:ss` ─────────────────────────────────────────────
 *
 * Ancho estable. Un reloj que corre dentro del texto y pasa de `9:59` a `10:00`
 * empuja lo que tiene al lado: salto de composición cada consulta larga, en la
 * pantalla que más se mira. Con minutos rellenos y cifras tabulares (`.nx-num`,
 * §2 de la gramática) el renglón no se mueve nunca.
 */

/** Los estados que el médico puede VER. Traducen la máquina de `useGrabacionAudio`. */
export type EstadoDeLaEscucha =
  | 'inactivo'      // aún no se ha pulsado nada
  | 'preparando'    // se pulsó; el micrófono todavía no abre
  | 'grabando'      // el micrófono está abierto y capta
  | 'pausado'       // abierto y detenido a propósito por el médico
  | 'subiendo'      // el audio viaja al transcriptor
  | 'estructurando' // el modelo redacta la nota
  | 'listo'         // hay transcripción y la nota se puede revisar
  | 'error'

/**
 * LA PALABRA. Una por estado, y la misma en la barra superior, en la banda del
 * encuentro, en el control flotante y en cualquier sitio que venga después.
 */
export const PALABRA: Record<EstadoDeLaEscucha, string> = {
  inactivo: '',
  preparando: 'Preparando el micrófono',
  grabando: 'Grabando',
  pausado: 'En pausa',
  subiendo: 'Enviando el audio',
  estructurando: 'Estructurando la nota',
  listo: 'Listo para revisar',
  error: 'No se pudo grabar',
}

/**
 * SI ESTE ESTADO SE ANUNCIA A UN LECTOR DE PANTALLA.
 *
 * `grabando` NO se anuncia, y es deliberado: su rótulo lleva un reloj que cambia
 * cada segundo, y seis regiones `aria-live` leyéndolo a la vez convierten la
 * consulta en un goteo continuo de cifras. Lo que hay que anunciar es el CAMBIO
 * —empezó, se pausó, terminó, falló—, no el paso del tiempo.
 */
export const SE_ANUNCIA: Record<EstadoDeLaEscucha, boolean> = {
  inactivo: false,
  preparando: true,
  grabando: false,
  pausado: true,
  subiendo: true,
  estructurando: true,
  listo: true,
  error: true,
}

/** `mm:ss`, siempre. Ver la cabecera: el ancho estable no es estética. */
export function reloj(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos || 0))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * El rótulo completo de un estado. Sin reloj cuando el estado no dura —no tiene
 * sentido cronometrar «No se pudo grabar»— y sin palabra cuando no hay estado.
 */
export function rotulo(estado: EstadoDeLaEscucha, segundos?: number): string {
  const p = PALABRA[estado]
  if (!p) return ''
  const conReloj = estado === 'grabando' || estado === 'pausado'
  return conReloj && segundos != null ? `${p} · ${reloj(segundos)}` : p
}
