/**
 * WS-11 — UN PENDIENTE QUE NO SE ABRIÓ NO PUEDE MORIR CON EL AVISO.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-344 arregló el silencio en UN sitio: al firmar la nota, si `crearTareas`
 * metía menos de las que había que meter, salía un aviso. Los otros TRES
 * llamadores —las dos reconciliaciones de medicación y la emisión de la orden—
 * se quedaron con `.catch(() => {})`, y uno de ellos lleva el comentario «igual
 * que arriba», que es justamente lo que no es.
 *
 * Es la misma forma de fallo que REG-410: una reparación que llega a un consumidor
 * y no a los demás, con la particularidad de que aquí el comentario **afirma** la
 * paridad que no existe.
 *
 * ── Y EL AVISO TAMPOCO BASTABA ──────────────────────────────────────────────
 *
 * Donde sí había aviso, era un `toast`. Un `toast` dura unos segundos y muere al
 * cambiar de pantalla — y este aviso sale justo cuando el médico acaba de firmar,
 * que es exactamente cuando se va al siguiente paciente.
 *
 * Así que el estado final era el mismo que REG-344 describe como el defecto: *«los
 * pendientes de esa consulta desaparecían y el médico se iba convencido de que
 * estaban»*. Sólo que ahora con un aviso que nadie llegó a leer.
 *
 * `WS-11.sobrevive-a-la-navegacion` pide literalmente que nada pendiente
 * desaparezca al cambiar de pantalla. Un aviso efímero sobre una pérdida
 * permanente no lo cumple.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Lo que no se pudo escribir **se guarda donde sobreviva a la navegación y a la
 * sesión**, con lo suficiente para volver a intentarlo. No se arregla solo y no
 * se da por perdido: se vuelve a ofrecer.
 *
 * ── POR QUÉ AQUÍ Y NO UNA COLA DE VERDAD ────────────────────────────────────
 *
 * Porque una cola con reintento automático decidiría por su cuenta cuándo volver
 * a escribir en el expediente de un paciente, y `lo-sincrono-y-lo-encolado`
 * (REG-390) reserva eso: una operación clínica no puede aparecer como completada
 * si sólo quedó encolada. Aquí no se completa nada — se conserva lo perdido y se
 * le enseña a alguien, que es la parte que faltaba.
 *
 * ── LO QUE NO SE GUARDA ─────────────────────────────────────────────────────
 *
 * El navegador es del consultorio, pero el almacenamiento local se comparte
 * entre pacientes: por eso lo guardado se limita a lo que ya iba a estar en la
 * tarea y se pone un tope. No es un expediente paralelo: es un cajón de lo que
 * no llegó.
 *
 * ── LO QUE ESTA CABECERA DECÍA Y NO ERA VERDAD (REG-576) ────────────────────
 *
 * Aquí decía que lo guardado «se borra al cerrar sesión como el resto de PHI
 * local». **No se borraba.** `limpiarBorradoresLocales` purga las claves que
 * empiezan por `nx.consulta.bkp.` o `nx.uci.`, y ésta se llama
 * `nexusmed.pendientes-no-abiertos`: no casaba con ninguna. Hasta cincuenta
 * pendientes con `patientNombre`, título y detalle dentro se quedaban en el
 * disco de un equipo compartido, indefinidamente.
 *
 * Ahora el cierre de sesión **drena** el cajón (`drenarPendientesPerdidos`): lo
 * que entra en Firestore desaparece del disco porque ya vive en el servidor, y
 * lo que no entra se queda — igual que el borrador, porque borrarlo «por
 * seguridad» convertiría un problema de red en un pendiente clínico perdido.
 *
 * Así que sigue habiendo PHI local posible, y ahora se dice: es la que no se
 * pudo salvar, no la que nadie recogió.
 */
import type { TareaClinica } from './modelo'

export const LLAVE = 'nexusmed.pendientes-no-abiertos'

/**
 * Tope de lo que se conserva.
 *
 * No es una cifra clínica: es cuántas caben sin llenar el almacenamiento local
 * que también guarda el borrador de la nota. Si hubiera que elegir entre las dos
 * cosas, el borrador gana — lo que el médico escribió no se puede reconstruir y
 * un pendiente sí.
 */
export const TOPE = 50

export type DeDonde = 'nota' | 'orden' | 'reconciliacion'

export interface Perdido {
  readonly clinicId: string
  readonly deDonde: DeDonde
  readonly cuando: string
  readonly tarea: Omit<TareaClinica, 'id'>
}

/** Cómo quedó una apertura de pendientes. */
export type Apertura =
  | { readonly estado: 'nada_que_abrir' }
  | { readonly estado: 'todas'; readonly creadas: number }
  | { readonly estado: 'faltaron'; readonly creadas: number; readonly perdidas: number; readonly aviso: string }

/**
 * El veredicto, en un solo sitio.
 *
 * La causa raíz de que REG-344 llegara a un llamador y no a cuatro es que cada
 * uno decidía por su cuenta qué hacer con el resultado. Con esto, el que se
 * escriba mañana hereda el trato.
 */
export function comoQuedo(esperadas: number, creadas: number, deDonde: DeDonde): Apertura {
  if (esperadas <= 0) return { estado: 'nada_que_abrir' }
  const perdidas = Math.max(0, esperadas - creadas)
  if (perdidas === 0) return { estado: 'todas', creadas }
  return {
    estado: 'faltaron', creadas, perdidas,
    aviso: `${perdidas} pendiente(s) de ${COMO_SE_LLAMA[deDonde]} NO se abrieron. `
      + 'Se guardaron y se te vuelven a ofrecer en Pendientes.',
  }
}

const COMO_SE_LLAMA: Record<DeDonde, string> = {
  nota: 'esta consulta',
  orden: 'esta orden',
  reconciliacion: 'la reconciliación de medicamentos',
}

const nuevoPerdido = (clinicId: string, deDonde: DeDonde, cuando: string) =>
  (tarea: Omit<TareaClinica, 'id'>): Perdido => ({ clinicId, deDonde, cuando, tarea })

/**
 * Guarda lo que no entró.
 *
 * `leer` y `escribir` se inyectan: el módulo es puro y quien lo llama decide si
 * eso es `localStorage`, memoria o nada. Es el mismo trato que
 * `el-borrador-no-se-pierde`, y por la misma razón — en una prueba no hay
 * `localStorage`, y un módulo que lo asume no se puede probar al revés.
 */
export function guardarPerdidos(
  entrada: { clinicId: string; deDonde: DeDonde; cuando: string; noEntraron: readonly Omit<TareaClinica, 'id'>[] },
  io: { leer: () => string | null; escribir: (v: string) => void },
): 'guardado' | 'nada_que_guardar' | 'no_se_pudo' {
  if (!entrada.noEntraron.length) return 'nada_que_guardar'
  try {
    const previos = leerPerdidos(io.leer)
    const nuevos = entrada.noEntraron.map(nuevoPerdido(entrada.clinicId, entrada.deDonde, entrada.cuando))
    /**
     * Los NUEVOS al principio y el recorte por la cola: si hay que perder algo,
     * que sea lo más viejo. Lo que acaba de fallar es lo que el médico todavía
     * puede recordar.
     */
    io.escribir(JSON.stringify([...nuevos, ...previos].slice(0, TOPE)))
    return 'guardado'
  } catch {
    /* Sin espacio, en modo privado, o con el almacenamiento bloqueado. No se
       puede hacer nada más, y decir que se guardó sería la mentira exacta que
       este módulo existe para no repetir. */
    return 'no_se_pudo'
  }
}

/** Lo guardado, o vacío. Nunca lanza: esto se lee al pintar una pantalla. */
export function leerPerdidos(leer: () => string | null): Perdido[] {
  try {
    const crudo = leer()
    if (!crudo) return []
    const v = JSON.parse(crudo)
    if (!Array.isArray(v)) return []
    return v.filter((x): x is Perdido =>
      !!x && typeof x === 'object' && typeof x.clinicId === 'string' && !!x.tarea)
  } catch {
    return []
  }
}

/**
 * Los de ESTE consultorio, y sólo ésos.
 *
 * El aislamiento entre consultorios también vale en el navegador: dos cuentas en
 * el mismo equipo no pueden verse los pendientes. Filtrar al leer es más barato
 * que acordarse de filtrar en cada pantalla.
 */
export const perdidosDe = (clinicId: string, todos: readonly Perdido[]): Perdido[] =>
  todos.filter(p => p.clinicId === clinicId)

/** Quita los que ya se reabrieron. Se comparan por título y paciente, que es lo que hay. */
export function olvidar(
  todos: readonly Perdido[], yaAbiertos: readonly Omit<TareaClinica, 'id'>[],
): Perdido[] {
  const fuera = new Set(yaAbiertos.map(t => `${t.patientId}|${t.titulo}`))
  return todos.filter(p => !fuera.has(`${p.tarea.patientId}|${p.tarea.titulo}`))
}

export const POR_QUE_NO_SE_REINTENTA_SOLO =
  'Un reintento automático decidiría por su cuenta cuándo volver a escribir en el '
  + 'expediente de un paciente. REG-390 reserva eso: una operación clínica no puede '
  + 'aparecer como completada si sólo quedó encolada. Aquí no se completa nada — se '
  + 'conserva lo perdido y se le enseña a alguien.'

export const POR_QUE_NO_BASTA_EL_TOAST =
  'Un toast dura segundos y muere al cambiar de pantalla, y este aviso sale justo '
  + 'cuando el médico acaba de firmar — que es cuando se va al siguiente paciente. '
  + 'Un aviso efímero sobre una pérdida permanente deja el mismo resultado que no avisar.'
