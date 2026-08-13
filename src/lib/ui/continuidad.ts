'use client'
/**
 * COREOGRAFÍA DE CONTINUIDAD — §20 del master loop V15: «Hoy → Paciente →
 * Encuentro debe sentirse como EL MISMO OBJETO ganando detalle», no como tres
 * pantallas que se reemplazan.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * El crossfade de `template.tsx` comunica CAMBIO, no continuidad de objeto:
 * al pasar de la cita de Hoy al expediente, el nombre del paciente desaparece
 * en un sitio y reaparece en otro, y el médico reconstruye mentalmente que es
 * el mismo. La novena rebanada de Fase 10 lo midió y lo difirió aquí
 * (V15-MOTION-001) porque exige diseño de movimiento entre rutas, no un ajuste
 * de duración.
 *
 * ── LA DECISIÓN DE MECANISMO ─────────────────────────────────────────────────
 *
 * `document.startViewTransition` NATIVO, no la bandera experimental de Next
 * (`experimental.viewTransition`): esa bandera cambia TODO el runtime de React
 * al canal experimental empaquetado (react-experimental) — un cambio de motor
 * de toda la app para pagar una coreografía es la clase de riesgo que la regla
 * de congelamiento funcional (§1) prohíbe. El API nativo es mejora progresiva:
 * donde no existe, o donde el usuario pidió menos movimiento, la navegación es
 * EXACTAMENTE la de siempre (mismo `router.push`, mismo crossfade de template).
 *
 * ── CÓMO FUNCIONA ────────────────────────────────────────────────────────────
 *
 *   1. El sitio de origen llama `navegarConContinuidad(navegar, origen)`.
 *   2. Si se puede coreografiar: el `origen` (el nombre del paciente en la
 *      fila) recibe `view-transition-name: nx-paciente` inline, y <html> gana
 *      `data-vt-continuidad` — que en globals.css le da el MISMO nombre al
 *      destino (`.nx-vt-paciente`: el <h1> del Patient Anchor, el <h1> de la
 *      consulta). El navegador mopha la caja del nombre de la posición vieja
 *      a la nueva: el mismo objeto, ganando detalle.
 *   3. La promesa del callback se resuelve cuando la ruta COMMITEÓ — lo avisa
 *      `template.tsx` al remontarse (eso es lo que un template hace en cada
 *      navegación) — con un tope de espera para que una ruta lenta no congele
 *      la pantalla vieja.
 *   4. `finished` limpia SIEMPRE (atributo y nombre inline), gane, se
 *      interrumpa o falle la transición.
 *
 * Encadenado gratis: en Expediente → Consulta el <h1> del ancla ya lleva
 * `.nx-vt-paciente`, así que es el ORIGEN automático sin pasar `origen` — el
 * mismo mecanismo cubre los dos saltos de la cadena.
 *
 * ── LA SEGUNDA CADENA (§20): RESULT QUEUE → PATIENT RESULT → SOURCE ─────────
 *
 * El objeto compartido de la cadena de resultados es la IDENTIDAD DEL
 * PACIENTE, no el título del resultado. Se decidió leyendo §9 y §21 y no por
 * comodidad: (1) el modelo de producto (§4) dice que el médico no piensa
 * «abro el módulo de labs», piensa «el resultado de ESTE paciente necesita mi
 * decisión» — el QUIÉN es lo que cruza pantallas; (2) R3 de VISUAL_DNA ya
 * hace de la identidad el elemento dominante de la tarjeta de /pendientes
 * (.nx-ident encabeza la entrada), así que el objeto que viaja es el que el
 * ojo ya tiene agarrado; y (3) el «título del resultado» NO tiene caja
 * estable en el destino — el expediente no pinta un encabezado por resultado,
 * y morfear hacia un elemento que puede no estar visible es animar hacia la
 * nada (§20: no animar por decorar). El tramo «→ Source» dentro del destino
 * es Source Reveal (§21): revelación EN el flujo, sin navegación — no hay
 * ruta que coreografiar ahí.
 *
 * ── LO QUE **NO** CUBRE ──────────────────────────────────────────────────────
 *
 * No decide QUÉ navegación merece coreografía: sólo los saltos de continuidad
 * de paciente la piden; el resto conserva el crossfade. Y no anima nada por
 * decorar: si no hay objeto compartido que preservar, no se usa.
 */

/** El nombre compartido del objeto «identidad del paciente» entre rutas. */
export const NOMBRE_VT_PACIENTE = 'nx-paciente'

/** Atributo de <html> que activa el nombre del DESTINO durante la coreografía. */
export const ATRIBUTO_VT = 'data-vt-continuidad'

/**
 * Tope de espera del commit de ruta. Mientras el callback no resuelve, el
 * navegador muestra la pantalla VIEJA congelada: una ruta que tarda no puede
 * congelar la interfaz más que esto.
 */
const TOPE_ESPERA_MS = 1200

type Resolver = () => void
let pendientes: Resolver[] = []

/**
 * `template.tsx` la llama al montarse: un template se remonta en CADA
 * navegación, así que su montaje ES la señal de que la ruta nueva commiteó.
 */
export function rutaComprometida(): void {
  const listos = pendientes
  pendientes = []
  for (const resolver of listos) resolver()
}

function esperarCambioDeRuta(): Promise<void> {
  return new Promise<void>(resolve => {
    const timer = setTimeout(() => {
      pendientes = pendientes.filter(r => r !== listo)
      resolve()
    }, TOPE_ESPERA_MS)
    const listo: Resolver = () => {
      clearTimeout(timer)
      resolve()
    }
    pendientes.push(listo)
  })
}

/**
 * ¿Se puede coreografiar AHORA? Falso sin navegador (SSR), sin el API nativo,
 * o si el usuario pidió menos movimiento — la MISMA consulta a matchMedia que
 * `comportamientoScroll()` (§24: el apagador de la hoja no llega al JS; cada
 * comportamiento de movimiento decidido en JS pregunta por su cuenta).
 */
export function puedeCoreografiar(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  if (typeof document.startViewTransition !== 'function') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  return true
}

/**
 * Navega con la coreografía de continuidad si se puede; navega a secas si no.
 *
 * @param navegar  la navegación real (el `router.push` de siempre — la
 *                 coreografía NUNCA cambia a dónde se va, sólo cómo se ve).
 * @param origen   el elemento de identidad del paciente en la pantalla de
 *                 origen (el `.nx-ident` de la fila). Omitirlo está bien si el
 *                 origen ya lleva `.nx-vt-paciente` (p. ej. el ancla del
 *                 expediente al continuar hacia la consulta).
 */
export function navegarConContinuidad(navegar: () => void, origen?: HTMLElement | null): void {
  if (!puedeCoreografiar()) {
    navegar()
    return
  }
  const raiz = document.documentElement
  raiz.setAttribute(ATRIBUTO_VT, '')
  if (origen) origen.style.viewTransitionName = NOMBRE_VT_PACIENTE

  const limpiar = () => {
    raiz.removeAttribute(ATRIBUTO_VT)
    // El origen normalmente ya se desmontó con la pantalla vieja; si sigue
    // vivo (navegación interrumpida), se le quita el nombre para que la
    // siguiente coreografía no encuentre dos elementos llamados igual.
    if (origen && origen.isConnected) origen.style.viewTransitionName = ''
  }

  const transicion = document.startViewTransition(async () => {
    navegar()
    await esperarCambioDeRuta()
    // ANTES de que el navegador capture el estado NUEVO: si el origen
    // sobrevivió a la navegación (la franja del shell persiste entre rutas),
    // su nombre inline y el del destino serían DOS elementos llamados igual
    // en la misma captura — y el navegador salta la transición entera. El
    // estado viejo ya se capturó al llamar al API; quitarle el nombre aquí
    // no le quita nada a la instantánea de origen, sólo deja al destino
    // como único dueño del nombre en la captura nueva.
    if (origen && origen.isConnected) origen.style.viewTransitionName = ''
  })
  // `finished` rechaza si la transición se saltó (otra navegación encima, un
  // nombre duplicado…). Interrumpirse es comportamiento correcto (§20:
  // «transitions must be interruptible») — lo único obligatorio es limpiar.
  transicion.finished.catch(() => {}).then(limpiar)
}

/**
 * ¿Este click es una navegación simple que un `<Link>` haría en la misma
 * pestaña? Ctrl/Cmd/Shift/Alt y el botón central abren pestañas o ventanas:
 * ahí el navegador manda y la coreografía no debe interceptar nada.
 */
export function esClickDeNavegacionSimple(e: {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented: boolean
}): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented
}
