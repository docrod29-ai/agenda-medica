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
import { comoQuedo, guardarPerdidos, LLAVE, type DeDonde } from './no-se-abrieron'
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
