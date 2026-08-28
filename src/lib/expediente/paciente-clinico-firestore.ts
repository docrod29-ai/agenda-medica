/**
 * SUPERFICIE CLÍNICA PROTEGIDA DEL PACIENTE — acceso con el SDK cliente.
 *
 * La política y todas las decisiones viven en `paciente-clinico.ts`, que es puro.
 * Aquí sólo está lo que habla con Firestore. La separación no es estética: el
 * núcleo se prueba entero sin levantar nada, y este archivo no tiene ninguna regla
 * propia que se pueda desincronizar de aquél.
 *
 * ── LO QUE HACE DISTINTO A ESTE MÓDULO ──────────────────────────────────────
 *
 * Un `catch` que devuelve `null` sería aquí un defecto de seguridad clínica, no un
 * atajo: la pantalla no podría distinguir «este paciente no tiene alergias» de «no
 * pude leerlas». Por eso `leerClinico` **nunca lanza y nunca devuelve un null
 * desnudo**: devuelve el par `{ datos, estado }`, y el estado dice cuál de las
 * cuatro situaciones es. Quien lo consuma tiene que mirarlo — para eso está
 * `sePuedeAfirmarSobreLoClinico`.
 *
 * ESTADO DE LA MIGRACIÓN (secuencia del dueño: add → backfill → verify → switch
 * reads → verify → remove legacy): esto es el paso «add». Ninguna pantalla lee
 * todavía por aquí; el `switch reads` es un paso posterior y está sin autorizar.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Patient, ResumenClinicoPaciente } from '@/types'
import {
  ID_RESUMEN_CLINICO,
  fusionarPaciente,
  indicadorAdministrativo,
  repartirCamposDePaciente,
  type LecturaClinica,
  type PacienteFusionado,
} from '@/lib/expediente/paciente-clinico'

function refResumen(clinicId: string, patientId: string) {
  return doc(db, 'clinics', clinicId, 'patients', patientId, 'clinico', ID_RESUMEN_CLINICO)
}

/**
 * ¿Este fallo es «la regla te dijo que no» o «algo se rompió»?
 *
 * Importa mucho más de lo que parece. `permission-denied` es la respuesta
 * ESPERADA para recepción y significa que la política funciona; cualquier otro
 * error es un incidente. Confundirlos haría que un corte de red se contara como
 * «la separación de PHI está operando».
 */
function esDenegacion(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code
  return code === 'permission-denied' || code === 'firestore/permission-denied'
}

/**
 * Lee el resumen clínico del paciente. NUNCA lanza.
 *
 * `no_migrado` (el documento no existe) se distingue de `ok` con documento vacío:
 * el primero manda leer el campo legado, el segundo es una afirmación del médico.
 */
export async function leerClinico(clinicId: string, patientId: string): Promise<LecturaClinica> {
  try {
    const snap = await getDoc(refResumen(clinicId, patientId))
    if (!snap.exists()) return { datos: null, estado: 'no_migrado' }
    return { datos: snap.data() as ResumenClinicoPaciente, estado: 'ok' }
  } catch (e) {
    return { datos: null, estado: esDenegacion(e) ? 'sin_permiso' : 'error' }
  }
}

/**
 * Escribe contenido clínico del paciente. Va SIEMPRE al subdocumento y sólo ahí:
 * duplicarlo en `patients/{id}` crearía la segunda Clinical Truth que la política
 * del dueño prohíbe (punto 6).
 *
 * `merge: true` porque el documento es único y se parchea por partes (la
 * valoración del inmunocomprometido guarda campo a campo mientras el médico
 * escribe). Sin merge, guardar una alergia borraría la valoración.
 *
 * Esto SÍ lanza: una escritura clínica que falla en silencio deja al médico creyendo
 * que apuntó la alergia. El llamador tiene que enterarse.
 */
export async function guardarClinico(
  clinicId: string,
  patientId: string,
  uid: string,
  parche: Partial<ResumenClinicoPaciente>,
): Promise<void> {
  await setDoc(
    refResumen(clinicId, patientId),
    { ...parche, actualizadoEn: new Date().toISOString(), actualizadoPor: uid },
    { merge: true },
  )
}

/**
 * Reparte un parche de paciente entre los dos documentos y escribe cada mitad
 * donde le toca. Es el `updatePatient` del mundo ya separado.
 *
 * Devuelve el reparto para que el llamador sepa qué fue a dónde — y para que la
 * parte administrativa la siga escribiendo `updatePatient`, con su guardia de
 * concurrencia y su bitácora, que no se duplican aquí.
 */
export async function guardarParteClinicaDelPaciente(
  clinicId: string,
  patientId: string,
  uid: string,
  parche: Partial<Patient>,
): Promise<{ administrativo: Partial<Patient>; escribioClinico: boolean }> {
  const { administrativo, clinico, tocaLoClinico } = repartirCamposDePaciente(parche)
  if (!tocaLoClinico) return { administrativo, escribioClinico: false }

  await guardarClinico(clinicId, patientId, uid, clinico)

  /**
   * EL INDICADOR SE CALCULA DEL OTRO LADO DE LA FRONTERA, NO DEL PARCHE.
   *
   * Con el parche bastaría para encenderlo, pero no para APAGARLO: un médico que
   * borra la última alergia manda un parche vacío de contenido, y mirar sólo el
   * parche dejaría el aviso puesto para siempre sobre un expediente ya limpio. Se
   * relee el documento entero —el que de verdad quedó escrito— y de ahí sale.
   *
   * Si la relectura falla, NO se toca el indicador: dejarlo como estaba es lo
   * único honesto cuando no se sabe. Y no se rompe la operación clínica por un
   * aviso de mostrador — la alergia ya quedó guardada, que es lo que importa.
   */
  const despues = await leerClinico(clinicId, patientId)
  if (despues.estado !== 'ok') return { administrativo, escribioClinico: true }

  return {
    administrativo: {
      ...administrativo,
      requiereRevisionClinica: indicadorAdministrativo(despues.datos) === 'requiere_revision_clinica',
    },
    escribioClinico: true,
  }
}

/**
 * El paciente ADMINISTRATIVO ya leído, más su contenido clínico, más el estado de
 * esa segunda lectura.
 *
 * Recibe el paciente en vez de leerlo para no duplicar `getPatient` (su caché, su
 * bitácora y su manejo de errores ya existen) y para que esto se pueda enchufar
 * detrás de cualquiera de las pantallas que ya lo llaman, sin cambiar dos cosas.
 */
export async function completarConLoClinico(
  clinicId: string,
  administrativo: Patient,
): Promise<PacienteFusionado> {
  return fusionarPaciente(administrativo, await leerClinico(clinicId, administrativo.id))
}
