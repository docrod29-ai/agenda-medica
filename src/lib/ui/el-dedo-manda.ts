/**
 * DESPUÉS DEL PRIMER GESTO MANUAL, EL USUARIO MANDA.
 *
 * ── DE DÓNDE SALE ESTA REGLA ─────────────────────────────────────────────────
 *
 * El rebote de scroll del iPhone (WS-05) no lo causa un solo defecto: lo causan
 * varios sitios que **escriben la posición de scroll** después de que el médico
 * ya empezó a moverse. Cada uno tiene su motivo legítimo —restaurar dónde ibas,
 * volver a la fuente de una cita, enseñar la sección que se acaba de tocar— y
 * cada uno, tarde, se convierte en un tirón.
 *
 * `VolverALaFuente` ya lo resolvía bien: escucha `wheel`, `touchstart` y las
 * teclas de desplazamiento, y en cuanto llega una, se aparta. El problema es que
 * esa disciplina vivía **dentro de un componente**, y los demás escritores de
 * scroll no la tenían — entre ellos el restaurador de `/consulta`, que se
 * **re-arma** cuando `notaInternamientoId` llega de un `.then()` de Firestore:
 * es decir, puede dispararse segundos después de montar, con el médico ya
 * leyendo.
 *
 * ── POR QUÉ EN WEBKIT DUELE Y EN CHROME NO ──────────────────────────────────
 *
 * `overflow-anchor` —que Chrome y Firefox implementan— compensa solo el
 * contenido insertado por encima del punto de lectura. **WebKit no lo
 * implementa.** El mismo código no salta en Android y salta en iPhone.
 *
 * ── QUÉ ES UN GESTO, Y QUÉ NO ───────────────────────────────────────────────
 *
 * Sólo señales **inequívocas** de intención de desplazarse: rueda, toque y las
 * teclas de navegación. Un clic dentro de la nota NO cancela nada: el médico
 * pulsa cosas todo el rato sin querer mover la pantalla, y cancelar con eso
 * rompería las restauraciones legítimas.
 *
 * Módulo con una sola responsabilidad, para que los cuatro escritores obedezcan
 * la MISMA regla y no cuatro parecidas.
 */

/** Teclas que significan «quiero moverme por el documento». */
const TECLAS_QUE_DESPLAZAN = new Set([
  'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ',
])

export function esTeclaQueDesplaza(key: string): boolean {
  return TECLAS_QUE_DESPLAZAN.has(key)
}

export interface Vigilancia {
  /** ¿Ya tomó el usuario el control? */
  tomoElControl(): boolean
  /** Deja de escuchar. Hay que llamarlo al desmontar. */
  soltar(): void
}

/**
 * Empieza a vigilar el gesto del usuario sobre un contenedor.
 *
 * @param contenedor el que scrollea (en el panel, `<main>`). `null` es válido:
 *   se siguen escuchando las teclas, que van a `window`.
 * @param alTomarControl se llama UNA vez, cuando el usuario toma el control.
 *
 * Devuelve un objeto con `tomoElControl()` para que quien escribe scroll pueda
 * preguntarlo **justo antes de escribir**, no sólo al armarse: entre armar y
 * escribir puede haber dos `requestAnimationFrame` y una lectura de Firestore.
 */
export function vigilarGestoDelUsuario(
  contenedor: Element | null,
  alTomarControl?: () => void,
): Vigilancia {
  let tomado = false
  const marcar = () => {
    if (tomado) return
    tomado = true
    alTomarControl?.()
  }
  const porTecla = (e: KeyboardEvent) => { if (esTeclaQueDesplaza(e.key)) marcar() }

  contenedor?.addEventListener('wheel', marcar, { passive: true })
  contenedor?.addEventListener('touchstart', marcar, { passive: true })
  // También en `window`: en WebKit el toque puede llegar antes de que el
  // contenedor exista o mientras el gesto empieza fuera de él.
  window.addEventListener('wheel', marcar, { passive: true })
  window.addEventListener('touchstart', marcar, { passive: true })
  window.addEventListener('keydown', porTecla)

  return {
    tomoElControl: () => tomado,
    soltar() {
      contenedor?.removeEventListener('wheel', marcar)
      contenedor?.removeEventListener('touchstart', marcar)
      window.removeEventListener('wheel', marcar)
      window.removeEventListener('touchstart', marcar)
      window.removeEventListener('keydown', porTecla)
    },
  }
}

export const POR_QUE_UN_CLIC_NO_CANCELA =
  'Un clic dentro de la nota no dice «quiero moverme»: el médico pulsa cosas ' +
  'todo el rato. Cancelar con eso rompería las restauraciones legítimas —volver ' +
  'donde ibas al regresar de otra pantalla— para arreglar un tirón que ese clic ' +
  'no iba a causar. Sólo rueda, toque y teclas de navegación.'
