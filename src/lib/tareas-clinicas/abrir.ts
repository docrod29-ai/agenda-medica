/**
 * ABRIR PENDIENTES — UN SOLO SITIO QUE DECIDE QUÉ PASA SI NO ENTRAN.
 *
 * ── LA CAUSA RAÍZ QUE ESTE ARCHIVO CIERRA ───────────────────────────────────
 *
 * `crearTareas` tenía CUATRO llamadores en pantallas, y cada uno decidía por su
 * cuenta qué hacer con el resultado. REG-344 arregló el silencio en uno; los
 * otros tres siguieron con `.catch(() => {})` — y uno de ellos con el comentario
 * «igual que arriba», que es exactamente lo que no era.
 *
 * Mientras la decisión viva en el llamador, la próxima pantalla que abra
 * pendientes volverá a elegir mal, y nadie lo notará porque no falla nada.
 *
 * Aquí se decide una vez: se cuenta lo que entró, se guarda lo que no, y se
 * avisa. El llamador sólo dice de dónde vienen.
 */
import { crearTareas } from './firestore'
import { comoQuedo, guardarPerdidos, leerPerdidos, LLAVE, type DeDonde } from './no-se-abrieron'
import type { TareaClinica } from './modelo'

/**
 * El almacenamiento local, con la puerta cerrada por si no hay.
 *
 * En modo privado, con las cookies bloqueadas o en un render de servidor,
 * `localStorage` lanza al tocarlo. Que eso tumbara la firma de una nota sería
 * cambiar un pendiente perdido por una consulta perdida — la misma regla que
 * REG-344 dejó escrita.
 */
const almacenLocal = {
  leer: () => { try { return localStorage.getItem(LLAVE) } catch { return null } },
  escribir: (v: string) => { try { localStorage.setItem(LLAVE, v) } catch { /* sin espacio */ } },
}

export interface ComoAvisar {
  avisar: (mensaje: string) => void
  leer?: () => string | null
  escribir?: (v: string) => void
}

/**
 * Abre los pendientes y se hace cargo de los que no entren.
 *
 * NO espera: la firma y la emisión de la orden no pueden depender de esto. Lo
 * que sí hace es no perder lo que falló.
 */
export function abrirPendientes(
  clinicId: string,
  tareas: readonly Omit<TareaClinica, 'id'>[],
  deDonde: DeDonde,
  io: ComoAvisar,
): void {
  if (!clinicId || !tareas.length) return
  const guardar = (noEntraron: readonly Omit<TareaClinica, 'id'>[]) => guardarPerdidos(
    { clinicId, deDonde, cuando: new Date().toISOString(), noEntraron },
    { leer: io.leer ?? almacenLocal.leer, escribir: io.escribir ?? almacenLocal.escribir },
  )

  void crearTareas(clinicId, tareas)
    .then(({ creadas, noEntraron }) => {
      const q = comoQuedo(tareas.length, creadas, deDonde)
      if (q.estado !== 'faltaron') return
      guardar(noEntraron)
      io.avisar(q.aviso)
    })
    .catch(() => {
      /**
       * La promesa entera falló: no entró ninguna. `crearTareas` traga los
       * fallos de una en una, así que llegar aquí significa que ni siquiera
       * empezó — y entonces las perdidas son TODAS.
       */
      guardar(tareas)
      io.avisar(comoQuedo(tareas.length, 0, deDonde).estado === 'faltaron'
        ? (comoQuedo(tareas.length, 0, deDonde) as { aviso: string }).aviso
        : '')
    })
}

/**
 * ── LO PERDIDO SE INTENTA UNA ÚLTIMA VEZ ANTES DE CERRAR SESIÓN — REG-428 ───
 *
 * `no-se-abrieron.ts` decía en su cabecera que lo guardado «se borra al cerrar
 * sesión como el resto de PHI local». **No era verdad.** La purga del logout
 * borra las claves que empiezan por `nx.consulta.bkp.` o `nx.uci.`, y ésta se
 * llama `nexusmed.pendientes-no-abiertos`: no casaba con ninguna.
 *
 * Así que hasta cincuenta pendientes clínicos —con `patientNombre`, el título y
 * el detalle dentro— se quedaban en el `localStorage` de un equipo de
 * consultorio, que se comparte, indefinidamente. Un comentario que describe una
 * limpieza que no ocurre es peor que no tenerlo: da por revisado lo que no lo
 * está.
 *
 * ── POR QUÉ SE DRENA Y NO SE BORRA ──────────────────────────────────────────
 *
 * Añadir la clave a la lista de purga habría cerrado la fuga de PHI **y perdido
 * los pendientes en silencio**, que es justo lo que REG-411 existe para impedir.
 *
 * Se hace lo que ya hace la cola de auditoría en este mismo cierre de sesión:
 * **se manda mientras el token todavía sirve**. Lo que entra desaparece del
 * disco porque ya vive en el servidor; lo que no entra se queda, igual que el
 * borrador, porque borrarlo «por seguridad» convertiría un problema de red en un
 * pendiente clínico perdido.
 *
 * Y esto no contradice a REG-390 —«una operación no puede aparecer como
 * completada si sólo quedó encolada»—: aquí nada se marca completado. O la tarea
 * queda escrita en Firestore, o sigue en el cajón.
 *
 * ── TIENE QUE CORRER ANTES DEL `signOut` ────────────────────────────────────
 *
 * Después, `crearTareas` ya no tiene con qué autenticar y el cajón no se vaciaría
 * nunca. Es el mismo motivo por el que `drenarCola` va donde va.
 */
export interface ComoQuedoElCajon {
  readonly habia: number
  readonly entraron: number
  /** Lo que sigue en el disco. Si es > 0, hay PHI local y alguien debe saberlo. */
  readonly siguenPerdidos: number
}

export async function drenarPendientesPerdidos(
  io: Pick<ComoAvisar, 'leer' | 'escribir'> = {},
): Promise<ComoQuedoElCajon> {
  const leer = io.leer ?? almacenLocal.leer
  const escribir = io.escribir ?? almacenLocal.escribir
  const perdidos = leerPerdidos(leer)
  if (!perdidos.length) return { habia: 0, entraron: 0, siguenPerdidos: 0 }

  /* Por consultorio: `crearTareas` escribe bajo un `clinicId`, y mezclar los de
     dos consultorios en una sola llamada escribiría en el que no es. */
  const porClinica = new Map<string, typeof perdidos>()
  for (const p of perdidos) {
    const lista = porClinica.get(p.clinicId) ?? []
    lista.push(p)
    porClinica.set(p.clinicId, lista)
  }

  const quedan: typeof perdidos = []
  let entraron = 0
  for (const [clinicId, lista] of porClinica) {
    try {
      const { noEntraron } = await crearTareas(clinicId, lista.map(p => p.tarea))
      entraron += lista.length - noEntraron.length
      /**
       * Se emparejan por CONTENIDO y no por referencia.
       *
       * Hoy `crearTareas` devuelve los mismos objetos que recibió, así que
       * comparar por identidad funcionaría — y ataría este drenaje a un detalle
       * interno de otro módulo. Una tarea que sale de `JSON.parse` y vuelve por
       * otro camino dejaría de reconocerse, y el cajón se vaciaría dando por
       * escritas tareas que no lo están: exactamente la mentira que este módulo
       * existe para no repetir.
       *
       * Se conserva el sobre entero —`deDonde` y `cuando`— de lo que no entró:
       * sin él, un reintento posterior no sabría de dónde salió.
       */
      const fallidas = new Set(noEntraron.map(t => JSON.stringify(t)))
      for (const p of lista) {
        if (fallidas.has(JSON.stringify(p.tarea))) quedan.push(p)
      }
    } catch {
      /* Ni siquiera se pudo intentar: se quedan todas. */
      quedan.push(...lista)
    }
  }

  try {
    if (quedan.length) escribir(JSON.stringify(quedan))
    else escribir('[]')
  } catch { /* si no se puede escribir, lo que había sigue donde estaba */ }

  return { habia: perdidos.length, entraron, siguenPerdidos: quedan.length }
}

export const POR_QUE_SE_DRENA_Y_NO_SE_BORRA =
  'Porque borrar el cajon al cerrar sesion cerraria la fuga de PHI y perderia los '
  + 'pendientes en silencio, que es lo que REG-411 existe para impedir. Se hace lo '
  + 'que ya hace la cola de auditoria: se manda mientras el token sirve. Lo que '
  + 'entra desaparece del disco porque ya vive en el servidor; lo que no entra se '
  + 'queda, igual que el borrador.'
