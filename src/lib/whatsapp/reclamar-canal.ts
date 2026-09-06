/**
 * UN CANAL DE WHATSAPP NO SE LE PUEDE QUITAR A OTRO CONSULTORIO.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * `whatsapp_channels/{id}` es el índice que usa el webhook para saber **a qué
 * consultorio pertenece un mensaje entrante**. Los tres caminos de conexión
 * —`manual-connect`, `meta-connect` y el callback de 360dialog— lo escribían con
 * un `set()` plano:
 *
 *     await adminDb.collection('whatsapp_channels').doc(phoneNumberId)
 *       .set({ clinicId, … })
 *
 * Sin mirar de quién era. Si un segundo consultorio reclama un identificador que
 * ya está tomado, el índice se reescribe y **todos los mensajes entrantes de ese
 * número pasan a entregarse en el consultorio nuevo** — incluidos los de los
 * pacientes del primero, que siguen escribiendo al mismo teléfono de siempre.
 *
 * Es una fuga entre inquilinos por la puerta de atrás: nadie lee el expediente
 * de nadie, pero los mensajes de los pacientes de A acaban en la bandeja de B, y
 * el bot de B contesta con la agenda de B.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Reclamar un canal ocupado por OTRO consultorio se rechaza. Reclamarlo estando
 * ya a nombre del mismo consultorio se permite: es una reconexión normal —cambio
 * de token, reinstalación— y bloquearla dejaría a un cliente legítimo sin poder
 * arreglar su propia integración.
 *
 * El desenlace es deliberadamente *fail-closed*: si no se puede leer el índice,
 * NO se reclama. Un índice que no se puede comprobar es exactamente el caso en
 * el que un `set()` optimista causaría el daño.
 *
 * ── LO QUE ESTO NO ES ────────────────────────────────────────────────────────
 *
 * No es un candado de propiedad del número ante Meta o 360dialog: eso lo decide
 * el proveedor. Es la garantía de que **nuestro enrutado** no cambia de dueño en
 * silencio. Liberar un canal para dárselo a otro consultorio existe y tiene su
 * propio camino: `whatsapp-disconnect`, que lo borra desde el consultorio dueño.
 */
import { adminDb } from '@/lib/firebase-admin'

export interface ResultadoReclamo {
  ok: boolean
  /** Por qué no se pudo. Se le enseña a quien intenta conectar. */
  error?: string
  /** De quién era, cuando estaba tomado. Sólo para la bitácora. */
  dueñoPrevio?: string
}

/**
 * Reclama el canal para `clinicId`, o explica por qué no.
 *
 * @param id  El identificador con el que el webhook busca: `phoneNumberId` en
 *            Meta, `apiKey` en 360dialog.
 * @param datos  Lo que se guarda además de `clinicId`.
 */
export async function reclamarCanal(
  id: string,
  clinicId: string,
  datos: Record<string, unknown>,
): Promise<ResultadoReclamo> {
  const canal = String(id ?? '').trim()
  if (!canal || !clinicId) return { ok: false, error: 'Falta el identificador del canal.' }

  const ref = adminDb.collection('whatsapp_channels').doc(canal)

  /**
   * EN UNA TRANSACCIÓN — REG-529. La primera versión leía, decidía y escribía
   * en tres pasos sueltos: dos consultorios reclamando el mismo canal en la
   * misma ventana leían los dos «libre» y el último `set` ganaba, que es
   * exactamente el secuestro que este módulo existe para impedir, sólo que
   * más difícil de reproducir. Con la transacción, la lectura queda fijada y
   * Firestore reintenta al que llegó tarde, que entonces ve al dueño.
   */
  try {
    return await adminDb.runTransaction(async tx => {
      const previo = await tx.get(ref)
      if (previo.exists) {
        const dueño = String((previo.data() as { clinicId?: string })?.clinicId ?? '')
        if (dueño && dueño !== clinicId) {
          return {
            ok: false,
            dueñoPrevio: dueño,
            error: 'Ese número de WhatsApp ya está conectado a otro consultorio. Tiene que desconectarlo desde ahí antes de conectarlo aquí.',
          } satisfies ResultadoReclamo
        }
      }
      // Libre, o ya nuestro: se escribe. `merge` conserva lo que otro camino de
      // conexión hubiera dejado (p. ej. `channelId` de 360dialog). Un documento
      // sin `clinicId` cuenta como libre a propósito: lo deja el alta de
      // 360dialog antes de que el callback diga de quién es.
      tx.set(ref, { ...datos, clinicId }, { merge: true })
      return { ok: true } satisfies ResultadoReclamo
    })
  } catch {
    /**
     * FAIL-CLOSED. Sin poder comprobar de quién es, no se reclama.
     *
     * Es justo el caso en el que el `set()` optimista de antes causaba el daño:
     * escribir sin saber. Que falle la conexión es un inconveniente; que los
     * mensajes de los pacientes de otro consultorio acaben aquí, no.
     */
    return { ok: false, error: 'No se pudo comprobar si el canal ya está en uso. Inténtalo de nuevo.' }
  }
}
