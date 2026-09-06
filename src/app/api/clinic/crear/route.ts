import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarUsuario } from '@/lib/auth-server'
import { DEFAULT_CONFIG } from '@/types'
import { zonaMXDe } from '@/lib/zona-horaria-mx'
import { safeLog } from '@/lib/security/sanitize'
import { errorAlCliente } from '@/lib/security/error-al-cliente'
import { huellaDeIdentidad, decidirFinDePrueba } from '@/lib/security/prueba-por-identidad'

/**
 * Alta del consultorio, ATÓMICA.
 *
 * Antes vivía en el cliente (`createClinic`) como cuatro escrituras sueltas:
 * leer `clinic_members/{uid}` → `addDoc(clinics)` → `setDoc(clinic_members)` →
 * `setDoc(config/main)`. El comentario decía que el candado anti-duplicado estaba
 * cerrado, pero un leer-y-luego-escribir no es atómico:
 *
 *  - Dos pestañas en /setup enviando con menos de un segundo de diferencia: ambas
 *    leen que no hay membresía, ambas crean un consultorio, y la segunda PISA la
 *    membresía de la primera. Queda un consultorio huérfano —y facturable— al que
 *    el usuario ya no puede entrar.
 *  - Si `addDoc(clinics)` funciona pero `setDoc(clinic_members)` falla (red,
 *    reglas), queda el consultorio huérfano Y el usuario vuelve a /setup: el
 *    siguiente intento crea otro más.
 *
 * En una transacción las tres escrituras se aplican o no se aplica ninguna, y la
 * lectura de la membresía queda dentro del mismo ámbito. Es el mismo patrón que
 * ya usaba /api/clinic/unirse.
 */
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  let body: { nombreClinica?: string; nombreMedico?: string; especialidad?: string; telefono?: string; cedulaProfesional?: string; zonaHoraria?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  const nombreClinica = String(body.nombreClinica ?? '').trim().slice(0, 160)
  const nombreMedico = String(body.nombreMedico ?? '').trim().slice(0, 160)
  // /setup los pedía y `createClinic` no los aceptaba: se perdían en silencio, y
  // la especialidad alimenta después la firma de la nota y el PDF.
  const especialidad = String(body.especialidad ?? '').trim().slice(0, 120)
  const telefono = String(body.telefono ?? '').replace(/\D/g, '').slice(0, 20)
  /**
   * La cédula, si la escribió. Sin ella `validarNOM004` bloquea la firma de la
   * PRIMERA nota, así que se pide en el alta (opcional) y se rescata con un
   * arreglo de un clic dentro de la propia consulta.
   */
  const cedulaProfesional = String(body.cedulaProfesional ?? '').trim().slice(0, 40)
  /**
   * La zona horaria la manda el navegador y se NORMALIZA aquí.
   *
   * No se confía en lo que llegue: la agenda, los recordatorios y el corte de
   * caja asumen una zona de México, y un `Europe/Madrid` de un portátil mal
   * configurado se propagaría a todos esos cálculos. `zonaMXDe` acepta las cinco
   * conocidas, traduce los nombres que la IANA retiró, y cae a CDMX ante
   * cualquier otra cosa. El valor de `DEFAULT_CONFIG` era la zona del DUEÑO, que
   * dejaba la agenda corrida una hora a todo médico de otra zona.
   */
  const zonaHoraria = zonaMXDe(String(body.zonaHoraria ?? ''))
  if (!nombreClinica || !nombreMedico) {
    return NextResponse.json({ ok: false, error: 'Faltan el nombre del consultorio y el del médico' }, { status: 400 })
  }

  const uid = acceso.uid
  const ahoraMs = Date.now()
  const ahora = new Date(ahoraMs).toISOString()
  /**
   * UNA PRUEBA POR IDENTIDAD (Panel de Lujo N-007 · decisión N-1 por su valor
   * seguro). La huella del correo verificado decide si la prueba se concede o
   * nace vencida; el alta ocurre igual. Ver `prueba-por-identidad.ts`.
   */
  const huella = huellaDeIdentidad(String(acceso.email ?? ''))
  const huellaRef = huella ? adminDb.collection('pruebas_estrenadas').doc(huella) : null

  try {
    const clinicId = await adminDb.runTransaction(async (tx) => {
      const miembroRef = adminDb.collection('clinic_members').doc(uid)
      const [miembro, estreno] = await Promise.all([
        tx.get(miembroRef),
        huellaRef ? tx.get(huellaRef) : Promise.resolve(null),
      ])
      // Si ya pertenece a un consultorio, se devuelve ese: nunca se crea un segundo
      // ni se pisa la membresía existente.
      if (miembro.exists) {
        const cid = miembro.data()?.clinicId
        if (cid) return String(cid)
      }

      // Fin de prueba en DOS formas: ISO (lo lee la UI) y epoch-ms (lo compara la regla
      // Firestore, que no sabe parsear ISO). El paywall del servidor usa trialEndsAtMs.
      const prueba = decidirFinDePrueba({ yaEstrenada: !!estreno?.exists, ahoraMs })
      const finPruebaMs = prueba.finMs
      const finPrueba = new Date(finPruebaMs).toISOString()
      if (huellaRef && prueba.concedida) {
        tx.set(huellaRef, { estrenadaEn: ahora })
      }

      // Ref con id generado por adelantado: hace falta para poder escribir la
      // clínica, la membresía y la config en la MISMA transacción.
      const clinicaRef = adminDb.collection('clinics').doc()
      tx.set(clinicaRef, {
        nombreClinica, nombreMedico,
        plan: 'trial', status: 'trial', ownerId: uid,
        trialEndsAt: finPrueba, trialEndsAtMs: finPruebaMs, createdAt: ahora, updatedAt: ahora,
      })
      tx.set(miembroRef, { clinicId: clinicaRef.id, role: 'admin', createdAt: ahora })
      tx.set(clinicaRef.collection('config').doc('main'), {
        ...DEFAULT_CONFIG, nombreClinica, nombreMedico, zonaHoraria,
        ...(especialidad ? { especialidad } : {}),
        /**
         * EL TELÉFONO SE GUARDA DONDE EL IMPRESO LO BUSCA.
         *
         * Se guardaba sólo como `config.telefono`, y la receta lee
         * `telefonoAdmin || whatsappConsultorio`. Resultado: el dato existía,
         * viajaba, se persistía… y la primera receta del médico salía SIN
         * teléfono. Se conserva `telefono` para no romper lo ya guardado.
         */
        ...(telefono ? { telefono, telefonoAdmin: telefono } : {}),
        ...(cedulaProfesional ? { cedulaProfesional } : {}),
        createdAt: ahora, updatedAt: ahora,
      })
      return clinicaRef.id
    })

    return NextResponse.json({ ok: true, clinicId })
  } catch (e) {
    // El texto del Admin SDK trae rutas de documento y nombres de colección:
    // al log redactado, no al navegador (S-006 · REG-534).
    safeLog.error('[clinic/crear]', e)
    return errorAlCliente('No se pudo crear el consultorio. Intenta de nuevo en un momento.', 502)
  }
}
