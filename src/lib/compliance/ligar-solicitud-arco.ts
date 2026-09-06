/**
 * LIGAR UNA SOLICITUD ARCO CON EL EXPEDIENTE DE SU TITULAR.
 *
 * ── EL FALLO QUE ESTO REPARA (ASE-010) ───────────────────────────────────────
 *
 * Las solicitudes ARCO reales no se podían ejecutar. Nacen en el portal público
 * (`/privacidad/[clinicId]`), y las reglas prohíben —con razón— que quien
 * escribe desde internet señale un expediente: si pudiera, cualquiera pediría
 * la supresión del expediente de un tercero y el panel la ofrecería de un clic.
 *
 * Así que toda solicitud real llegaba **sin `patientId`**. Y:
 *
 *  · «Marcar resuelta» sobre un acceso contestaba «Esta solicitud no está
 *    ligada a un expediente. Identifícala primero» — sin decir dónde;
 *  · la cancelación mandaba a «ejecutarla desde su expediente», y en
 *    `/expediente/[patientId]` no hay ninguna acción ARCO (grep: 0 resultados);
 *  · `firestore.rules:775-786` deja la puerta abierta a ligarlo después, y
 *    **ningún código la cruzaba**.
 *
 * El derecho estaba escrito, contado con su plazo de 20 días hábiles, y no se
 * podía ejercer. Esto es la línea que faltaba.
 *
 * ── LA IDENTIDAD LA ACREDITA UNA PERSONA, NO UN FORMULARIO ───────────────────
 *
 * Ligar es un acto de la clínica con la identificación oficial delante (Art. 29
 * LFPDPPP), no un emparejamiento automático por nombre parecido. Por eso esta
 * función EXIGE la afirmación explícita de quien lo hace y la guarda con su
 * nombre: `identidadVerificada` deja de ser una constante escrita a fuego en el
 * cliente (ASE-011) y pasa a ser lo que alguien afirmó, cuándo y quién.
 *
 * Un emparejamiento «probable» sugerido por el motor sería exactamente el
 * defecto que este repositorio ya conoce: fundir con quien no es no se ve como
 * un error.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No desliga. Una vez ligada y verificada, cambiar de expediente es reescribir
 * un registro legal: si se ligó al que no era, se rechaza la solicitud dejando
 * dicho por qué y se abre otra. Las reglas tampoco congelan `patientId`, así
 * que la restricción vive aquí y está declarada, no supuesta.
 */
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logAudit } from '@/lib/expediente/audit-log'
import type { ArcoRequest } from '@/lib/arco'

/** Por qué una solicitud no se puede ligar. `null` = sí se puede. */
export function porQueNoSePuedeLigar(req: Pick<ArcoRequest, 'id' | 'patientId' | 'estado'>): string | null {
  if (!req.id) return 'La solicitud no tiene identificador.'
  if (req.patientId) return 'Ya está ligada a un expediente.'
  if (req.estado === 'resuelta' || req.estado === 'rechazada') return 'La solicitud ya está cerrada.'
  return null
}

export interface QuienLiga {
  /** UID de quien lo hace. Queda en el documento y en la bitácora. */
  uid: string
  /** Correo, para poder leer la bitácora sin resolver UIDs. */
  email?: string
  /** Qué documento vio. Texto libre: «INE folio 1234». NUNCA una imagen. */
  identificacionVista: string
  /** Instante ISO. Por parámetro: una función que mira el reloj no se prueba dos veces igual. */
  ahora: string
}

/**
 * Escribe el vínculo. Devuelve el motivo del rechazo, o `null` si se hizo.
 *
 * No lanza por reglas de negocio —eso es una respuesta, no una excepción—, pero
 * sí deja subir el fallo de red o de permisos: ésos la pantalla los tiene que
 * distinguir de «no se podía».
 */
export async function ligarSolicitudArcoAExpediente(
  clinicId: string,
  req: Pick<ArcoRequest, 'id' | 'patientId' | 'estado' | 'tipo'>,
  patientId: string,
  quien: QuienLiga,
): Promise<string | null> {
  const noSePuede = porQueNoSePuedeLigar(req)
  if (noSePuede) return noSePuede
  if (!patientId.trim()) return 'No se eligió ningún expediente.'
  if (!quien.identificacionVista.trim()) {
    return 'Falta anotar qué identificación se vio. Sin eso, ligar sería adivinar.'
  }

  await updateDoc(doc(db, 'clinics', clinicId, 'arco_requests', req.id!), {
    patientId,
    identidadVerificada: true,
    identidadVerificadaPor: quien.uid,
    identidadVerificadaEn: quien.ahora,
    identidadDocumento: quien.identificacionVista.trim(),
  })

  /**
   * BITÁCORA. Ligar decide a QUIÉN se le va a entregar —o a quién se le va a
   * suprimir— el expediente: es el acto que un auditor va a querer ver, y sin
   * asiento no queda constancia de quién lo afirmó.
   */
  void logAudit({
    evento: 'arco_solicitud_recibida', clinicId, patientId,
    meta: {
      solicitudId: req.id, tipo: req.tipo, accion: 'ligada-a-expediente',
      verificadaPor: quien.email ?? quien.uid, documento: quien.identificacionVista.trim(),
    },
  })
  return null
}
