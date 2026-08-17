/**
 * EL CONTRATO DE REGRESO — §21, el tramo que faltaba.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La cadena de §21 es «fact → inspect → source → **return exactly where you
 * were**». Los tres primeros tramos existían: la lente contextual abre sobre el
 * pendiente, contesta las cuatro de §10 y ofrece la traza hacia la consulta que
 * lo originó. El cuarto no: la traza era un `<Link href>` y nada más, o sea
 * **navegación normal**. Al llegar a la consulta el médico se quedaba sin
 * ningún hilo de vuelta — ni ruta de origen, ni sitio en la lista, ni foco, ni
 * memoria de qué hecho estaba inspeccionando.
 *
 * La re-auditoría independiente `V15-ORIGINALITY-INDEPENDENT-REAUDIT-002` lo
 * nombró como P1 bloqueante con esas palabras: «the outbound transition is
 * effectively normal navigation».
 *
 * ── POR QUÉ UN MÓDULO NUEVO, Y POR QUÉ ESTE ES EL MÁS PEQUEÑO ───────────────
 *
 * Se miró primero lo que ya existe, porque un dueño nuevo para un estado que ya
 * tiene dueño es deuda:
 *
 *  · `@/lib/ui/continuidad` — coreografía UNA navegación (view transitions,
 *    el candado `data-vt-congelada` de REG-312). Su estado vive milisegundos y
 *    muere al terminar la transición. No sobrevive a un cambio de ruta, que es
 *    justo lo que aquí hace falta.
 *  · `@/lib/nav/encuentro-abierto` — responde «¿qué consulta tengo a medias en
 *    ESTE dispositivo?». Vive en `localStorage`, dura días y es por usuario.
 *    Otra pregunta y otra vida.
 *  · `@/lib/expediente/cierre-hechos` — ya usa `sessionStorage` para estado de
 *    interfaz efímero, y su cabecera argumenta por qué: si se pierde, el peor
 *    caso es que haya que rehacer un gesto. Ése es el precedente que este
 *    módulo sigue.
 *
 * Ninguno puede ser dueño de esto sin cambiar de significado. Lo que se añade
 * es lo mínimo: un contrato con vida propia, y el veredicto que decide si se
 * puede honrar.
 *
 * ── DÓNDE VIVE CADA COSA, Y POR QUÉ AHÍ ─────────────────────────────────────
 *
 * En la URL viaja **sólo un testigo opaco** (`?volver=<id>`). El cuerpo del
 * contrato —paciente, nota, ruta de origen, desplazamiento— vive en
 * `sessionStorage`, y eso no es una preferencia de implementación:
 *
 *  · **PHI nunca en la URL** (regla de datos y privacidad). Un enlace de
 *    consulta se pega en un chat; un testigo aleatorio no dice nada de nadie.
 *  · `sessionStorage` es **por pestaña**: abrir la fuente en otra pestaña o
 *    pegar el enlace a otra persona deja el testigo sin contrato, y entonces
 *    no se ofrece volver. Falla cerrado por construcción, sin escribir una
 *    comprobación.
 *  · **Sobrevive a recargar**, que es lo que sí hay que conservar.
 *
 * ── LA INVARIANTE DE SEGURIDAD ──────────────────────────────────────────────
 *
 * **Un contrato rancio o de otro paciente NUNCA devuelve al médico a un
 * contexto que no es el suyo.** No se «repara» un contrato que no cuadra: se
 * declina, y se dice por qué. Preferimos un fallo explícito a una restauración
 * lista — es la familia «paciente equivocado» (REG-312), y aquí la tentación
 * es peor porque el código que restaura parece servicial.
 *
 * Por eso `veredictoDeRegreso` compara el contrato contra **el destino real en
 * el que el navegador está de verdad**, no contra lo que el contrato dice que
 * debería ser. Un contrato no puede validarse a sí mismo.
 *
 * Módulo PURO en su núcleo: el veredicto y la construcción no tocan `window`.
 * El acceso a `sessionStorage` está aparte, al final, y siempre entre guardas.
 */

/** Qué clase de hecho se estaba inspeccionando. Cerrada: hoy hay un consumidor. */
export type ClaseDeHecho = 'pendiente'

export interface ContratoDeRegreso {
  /** Testigo opaco. Es lo ÚNICO que viaja en la URL. */
  id: string
  creadoEnMs: number
  /** A dónde se vuelve, y en qué punto exacto. */
  origen: {
    ruta: string
    scrollTop: number
    /** `id` del control que abrió la inspección, para devolverle el foco. */
    disparadorId: string | null
    /** Cómo se llama la pantalla de origen, para poder rotular el regreso. */
    nombre: string
  }
  /** Qué hecho se estaba inspeccionando. */
  hecho: { clase: ClaseDeHecho; id: string }
  /**
   * DE QUIÉN es todo esto. Es lo que se compara contra el destino real.
   * Los tres, no uno: consultorio, paciente y encuentro son tres fronteras
   * distintas y perder cualquiera de ellas es un incidente distinto.
   */
  limite: { clinicId: string; patientId: string; notaId: string }
}

/**
 * Cuánto vale un contrato de regreso.
 *
 * Treinta minutos: más que cualquier inspección real —mirar de dónde salió un
 * pendiente son segundos— y menos que una jornada. El número no es clínico y
 * por eso puede ser redondo; lo que no puede es no existir, porque un contrato
 * sin caducidad convierte una pestaña abierta desde ayer en una invitación a
 * volver a un sitio que ya no significa lo mismo.
 */
export const VIGENCIA_MS = 30 * 60_000

/** El nombre del parámetro. Se declara UNA vez; nadie lo teclea. */
export const PARAM_REGRESO = 'volver'

export interface DestinoReal {
  clinicId: string
  patientId: string
  notaId: string
}

export type MotivoSinRegreso =
  | 'sin-contrato'
  | 'caducado'
  | 'otro-consultorio'
  | 'otro-paciente'
  | 'otro-encuentro'

export type Veredicto =
  | { puedeVolver: true; contrato: ContratoDeRegreso }
  | { puedeVolver: false; motivo: MotivoSinRegreso }

/**
 * QUÉ SE LE DICE AL MÉDICO CUANDO NO SE PUEDE VOLVER.
 *
 * Sólo se PINTA lo que le sirve. «Sin contrato» es el caso normal —llegó aquí
 * por su cuenta, o abrió el enlace en otra pestaña— y ahí no hay nada que
 * anunciar: enseñar «no puedo devolverte» a quien nunca pidió volver es ruido.
 *
 * Los otros tres sí se dicen, porque significan que **había** un hilo de vuelta
 * y se declinó a propósito. Callarlos dejaría al médico creyendo que el
 * producto se olvidó, cuando en realidad se negó — y esa distinción es la que
 * hace confiable el resto de la función.
 */
export const MOTIVO_VISIBLE: Record<MotivoSinRegreso, string | null> = {
  'sin-contrato': null,
  caducado: 'El hilo de vuelta caducó. Vuelve por el menú para no aterrizar en un sitio que ya cambió.',
  'otro-consultorio': 'Ese hilo de vuelta es de otro consultorio y no se usa.',
  'otro-paciente': 'Ese hilo de vuelta es de otro paciente y no se usa.',
  'otro-encuentro': 'Ese hilo de vuelta es de otra consulta y no se usa.',
}

/**
 * ¿SE PUEDE HONRAR ESTE CONTRATO, AQUÍ Y AHORA?
 *
 * `destino` es dónde está el navegador DE VERDAD —consultorio de la sesión,
 * paciente de la ruta, nota del parámetro—, no lo que el contrato afirma. Un
 * contrato que se valida contra sus propios datos siempre dice que sí.
 *
 * El orden de las comprobaciones va de lo más barato a lo más grave, pero lo
 * que importa es que las tres fronteras se comprueban por separado: si sólo se
 * comparara el paciente, un testigo de OTRA nota del MISMO paciente devolvería
 * al médico a la lista diciendo que venía de un encuentro en el que nunca
 * estuvo.
 */
export function veredictoDeRegreso(
  contrato: ContratoDeRegreso | null | undefined,
  destino: DestinoReal,
  ahoraMs: number,
): Veredicto {
  if (!contrato) return { puedeVolver: false, motivo: 'sin-contrato' }
  if (!Number.isFinite(contrato.creadoEnMs) || ahoraMs - contrato.creadoEnMs > VIGENCIA_MS) {
    return { puedeVolver: false, motivo: 'caducado' }
  }
  if (contrato.limite.clinicId !== destino.clinicId) return { puedeVolver: false, motivo: 'otro-consultorio' }
  if (contrato.limite.patientId !== destino.patientId) return { puedeVolver: false, motivo: 'otro-paciente' }
  if (contrato.limite.notaId !== destino.notaId) return { puedeVolver: false, motivo: 'otro-encuentro' }
  return { puedeVolver: true, contrato }
}

/**
 * La ruta de la fuente, con el testigo colgado.
 *
 * Se compone aquí y no en el llamador para que el nombre del parámetro no se
 * teclee dos veces — y porque el `href` de la traza ya lleva un `?nota=`, así
 * que el separador depende de lo que venga: `&` si ya hay consulta, `?` si no.
 */
export function rutaConRegreso(href: string, id: string): string {
  const separador = href.includes('?') ? '&' : '?'
  return `${href}${separador}${PARAM_REGRESO}=${encodeURIComponent(id)}`
}

/* ────────────────────────────────────────────────────────────────────────────
   EL ALMACÉN — por pestaña, entre guardas, y sin PHI en ninguna llave.
   ──────────────────────────────────────────────────────────────────────────── */

const PREFIJO = 'nx:regreso:'
/** El testigo del regreso que se está ejecutando ahora mismo. */
const CLAVE_EN_CURSO = 'nx:regreso:en-curso'

const almacen = (): Storage | null => {
  try { return typeof window === 'undefined' ? null : window.sessionStorage } catch { return null }
}

/**
 * Un identificador que no dice nada de nadie.
 *
 * `crypto.randomUUID` cuando existe; si no, una cadena con la hora y azar. No
 * es un secreto —quien tenga la pestaña ya tiene el expediente delante— así
 * que lo único que se le pide es no colisionar y no llevar PHI dentro.
 */
export function nuevoTestigo(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch { /* sin crypto: el respaldo sirve igual */ }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function guardarContrato(c: ContratoDeRegreso): void {
  const s = almacen()
  if (!s) return
  try { s.setItem(PREFIJO + c.id, JSON.stringify(c)) } catch { /* cuota o modo privado: se pierde el hilo, no el dato clínico */ }
}

/**
 * El contrato TAL CUAL está guardado, sin interpretar.
 *
 * Existe aparte porque `useSyncExternalStore` compara instantáneas con
 * `Object.is`: devolver un objeto recién parseado daría una referencia nueva en
 * cada lectura y React re-renderizaría sin parar. Una cadena con el mismo
 * contenido sí es igual a sí misma.
 */
export function leerContratoSerializado(id: string | null | undefined): string | null {
  const s = almacen()
  if (!s || !id) return null
  try { return s.getItem(PREFIJO + id) } catch { return null }
}

/** Un contrato a medio escribir no se completa con supuestos: se descarta. */
export function deserializar(crudo: string | null | undefined): ContratoDeRegreso | null {
  if (!crudo) return null
  try {
    const c = JSON.parse(crudo) as ContratoDeRegreso
    if (!c?.id || !c.limite?.patientId || !c.origen?.ruta) return null
    return c
  } catch { return null }
}

export function leerContrato(id: string | null | undefined): ContratoDeRegreso | null {
  return deserializar(leerContratoSerializado(id))
}

export function olvidarContrato(id: string): void {
  const s = almacen()
  if (!s) return
  try { s.removeItem(PREFIJO + id); if (s.getItem(CLAVE_EN_CURSO) === id) s.removeItem(CLAVE_EN_CURSO) } catch { /* nada que hacer */ }
}

/**
 * «Estoy volviendo con este contrato.» Lo escribe quien pulsa el regreso, y lo
 * consume el restaurador al aterrizar. Es de un solo uso a propósito: sin eso,
 * navegar otra vez a la pantalla de origen volvería a mover el desplazamiento
 * bajo el dedo del médico sin que nadie lo hubiera pedido.
 */
export function anunciarRegreso(id: string): void {
  const s = almacen()
  if (!s) return
  try { s.setItem(CLAVE_EN_CURSO, id) } catch { /* sin almacén no hay restauración: se navega y ya */ }
}

export function regresoEnCurso(): string | null {
  const s = almacen()
  if (!s) return null
  try { return s.getItem(CLAVE_EN_CURSO) } catch { return null }
}

export const POR_QUE_EL_TESTIGO_VA_SOLO =
  'Porque un enlace de consulta acaba pegado en un chat. En la URL viaja un ' +
  'testigo aleatorio que no dice nada de nadie; el paciente, la nota y el sitio ' +
  'de la lista viven en el almacén de LA PESTAÑA. Abrir el enlace en otra ' +
  'pestaña o mandárselo a alguien deja el testigo sin contrato, y entonces no ' +
  'se ofrece volver: falla cerrado sin que nadie tenga que programarlo.'
