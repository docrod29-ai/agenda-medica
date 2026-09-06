/**
 * POST /api/pacientes/fundir
 *
 * JUNTAR DOS EXPEDIENTES QUE SON LA MISMA PERSONA — ASE-009.
 *
 * ── POR QUÉ NO EXISTÍA, Y POR QUÉ DOLÍA ──────────────────────────────────────
 *
 * El barrido de `/pacientes` encuentra las parejas repetidas y el diálogo dice
 * «nada se junta ni se borra solo». Era verdad y no había alternativa:
 * `firestore.rules` cierra el borrado de pacientes desde el navegador (`allow
 * delete: if false`) y el único borrado real del producto vive en
 * `/api/arco/cancelar`. El único camino para deshacer un duplicado era **fingir
 * una solicitud ARCO de cancelación** de un paciente que nunca la pidió:
 * falsificar un registro legal para arreglar un problema de datos.
 *
 * Mientras tanto el historial sigue partido, que es el daño de verdad: las
 * alergias en un expediente y las notas recientes en el otro.
 *
 * ── POR QUÉ EN EL SERVIDOR ───────────────────────────────────────────────────
 *
 * Mover subcolecciones (notas con sus adendas y versiones, laboratorios, fotos,
 * el resto del expediente) necesita el SDK admin: desde el navegador dependería
 * de que las reglas permitieran cada documento uno por uno, y las de notas
 * firmadas —con razón— no lo permiten. Y la decisión tiene que quedar auditada
 * del lado que no se puede manipular desde una consola.
 *
 * ── LO QUE HACE, EN ORDEN ────────────────────────────────────────────────────
 *
 *  1. Vuelve a calcular el plan EN EL SERVIDOR con los documentos reales. El
 *     cliente manda los dos ids y nada más: si el plan viajara desde la
 *     pantalla, quien controle el navegador elegiría qué expediente absorbe a
 *     cuál y qué campos se pisan.
 *  2. Copia las subcolecciones del absorbido al superviviente CONSERVANDO el id
 *     y el contenido verbatim: una nota firmada mantiene su hash y su autor
 *     porque no se le toca ni un campo. Si el id ya existe en el destino, no se
 *     pisa — se deja donde está y se cuenta como no movido.
 *  3. Re-apunta lo que señala al paciente por id (citas, cobros, tareas
 *     clínicas, lista de espera).
 *  4. Rellena los HUECOS del superviviente y marca al absorbido `fusionadoEn`.
 *     No lo borra: fundir a dos personas distintas por error es el daño caro, y
 *     sin rastro sería además irreparable.
 *  5. Deja asiento con los dos ids, el conteo movido y los conflictos que NO se
 *     copiaron.
 *
 * ── LO QUE NO HACE, DECLARADO ────────────────────────────────────────────────
 *
 * No deshace una fusión. No borra el absorbido (para eso está la «C» de ARCO,
 * que es otro acto con otro fundamento). No toca documentos de otros
 * consultorios: todo cuelga de `clinics/{clinicId}`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { planDeFusion } from '@/lib/pacientes/fusion'
import type { Patient } from '@/types'

export const maxDuration = 60

/** Subcolecciones del expediente que se mudan con el paciente. */
const SUBCOLECCIONES: { ruta: string; hijas?: string[] }[] = [
  { ruta: 'notas', hijas: ['adendas', 'versions'] },
  { ruta: 'laboratorios' },
  { ruta: 'fotos' },
  { ruta: 'clinico' },
  { ruta: 'formularios_previos' },
  { ruta: 'paquetes_visita' },
  { ruta: 'preguntas_paciente' },
]

/** Colecciones del consultorio que señalan a un paciente por id. */
const QUE_SENALA_AL_PACIENTE: { coleccion: string; campo: string }[] = [
  { coleccion: 'appointments', campo: 'pacienteId' },
  { coleccion: 'cobros', campo: 'pacienteId' },
  { coleccion: 'tareas_clinicas', campo: 'pacienteId' },
  { coleccion: 'lista_espera', campo: 'pacienteId' },
]

type Ref = FirebaseFirestore.DocumentReference

/** Copia una subcolección entera (y sus hijas) sin tocar el contenido. */
async function mudarSubcoleccion(origen: Ref, destino: Ref, ruta: string, hijas: string[] = []): Promise<{ movidos: number; yaEstaban: number }> {
  const snap = await origen.collection(ruta).get()
  let movidos = 0, yaEstaban = 0
  for (const doc of snap.docs) {
    const destinoDoc = destino.collection(ruta).doc(doc.id)
    const existe = await destinoDoc.get()
    if (existe.exists) { yaEstaban++; continue }
    // `set` con el dato VERBATIM: una nota firmada conserva su hash porque no se
    // le cambia ni un campo. Añadir aquí `fusionadoDe` invalidaría la firma.
    await destinoDoc.set(doc.data())
    for (const hija of hijas) {
      const nietos = await doc.ref.collection(hija).get()
      for (const n of nietos.docs) await destinoDoc.collection(hija).doc(n.id).set(n.data())
    }
    movidos++
  }
  return { movidos, yaEstaban }
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; aId?: string; bId?: string; simular?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo inválido' }, { status: 400 })
  }
  const { clinicId, aId, bId } = body
  if (!clinicId || !aId || !bId) {
    return NextResponse.json({ ok: false, error: 'Faltan clinicId, aId o bId' }, { status: 400 })
  }

  /**
   * `administrar` y no `clinico.escribir`: juntar dos historias clínicas —o
   * juntar por error las de dos personas distintas— es una decisión del
   * responsable del expediente, no del mostrador.
   */
  const acceso = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acceso.ok) return acceso.response

  try {
    const clinicRef = adminDb.collection('clinics').doc(clinicId)
    const refA = clinicRef.collection('patients').doc(aId)
    const refB = clinicRef.collection('patients').doc(bId)
    const [snapA, snapB] = await Promise.all([refA.get(), refB.get()])
    if (!snapA.exists || !snapB.exists) {
      return NextResponse.json({ ok: false, error: 'Uno de los dos expedientes no existe' }, { status: 404 })
    }
    const a = { ...(snapA.data() as Patient), id: aId }
    const b = { ...(snapB.data() as Patient), id: bId }

    // El plan se calcula AQUÍ, con los documentos reales. Si viajara desde la
    // pantalla, quien controle el navegador elegiría quién absorbe a quién.
    const [notasA, notasB] = await Promise.all([
      refA.collection('notas').count().get(),
      refB.collection('notas').count().get(),
    ])
    const plan = planDeFusion(a, { notas: notasA.data().count }, b, { notas: notasB.data().count })
    if (plan.impedimento) {
      return NextResponse.json({ ok: false, error: plan.impedimento }, { status: 409 })
    }
    if (body.simular) {
      return NextResponse.json({ ok: true, simulado: true, plan })
    }

    const sobreviveRef = clinicRef.collection('patients').doc(plan.sobreviveId)
    const absorbidoRef = clinicRef.collection('patients').doc(plan.absorbidoId)

    // 2. El expediente se muda.
    const movidos: Record<string, number> = {}
    const yaEstaban: Record<string, number> = {}
    for (const sub of SUBCOLECCIONES) {
      const r = await mudarSubcoleccion(absorbidoRef, sobreviveRef, sub.ruta, sub.hijas)
      if (r.movidos) movidos[sub.ruta] = r.movidos
      if (r.yaEstaban) yaEstaban[sub.ruta] = r.yaEstaban
    }

    // 3. Lo que señalaba al absorbido pasa a señalar al superviviente.
    const reapuntados: Record<string, number> = {}
    for (const { coleccion, campo } of QUE_SENALA_AL_PACIENTE) {
      const snap = await clinicRef.collection(coleccion).where(campo, '==', plan.absorbidoId).get()
      if (snap.empty) continue
      // En lotes de 400: el tope de un batch de Firestore son 500 escrituras.
      for (let i = 0; i < snap.docs.length; i += 400) {
        const lote = adminDb.batch()
        for (const d of snap.docs.slice(i, i + 400)) lote.update(d.ref, { [campo]: plan.sobreviveId })
        await lote.commit()
      }
      reapuntados[coleccion] = snap.size
    }

    // 4. Los huecos se rellenan; lo que ya había NO se pisa.
    const ahora = new Date().toISOString()
    if (Object.keys(plan.rellena).length) {
      await sobreviveRef.update({ ...plan.rellena, updatedAt: ahora })
    }
    await absorbidoRef.update({
      fusionadoEn: plan.sobreviveId,
      fusionadoAt: ahora,
      updatedAt: ahora,
    })

    // 5. El asiento, con los dos ids y lo que NO se copió.
    await clinicRef.collection('audit_log').add({
      evento: 'paciente_modificado',
      timestamp: ahora,
      patientId: plan.sobreviveId,
      meta: {
        accion: 'fusion-de-expedientes',
        absorbido: plan.absorbidoId,
        porQue: plan.porQueSobreviveEse,
        movidos, yaEstaban, reapuntados,
        // Lo que se pierde queda escrito, no se calla: es la mitad honesta de
        // una operación que no se puede deshacer.
        noSeCopiaron: plan.conflictos,
      },
    })

    return NextResponse.json({ ok: true, plan, movidos, yaEstaban, reapuntados })
  } catch (e) {
    safeLog.error('[pacientes/fundir] falló', e)
    return NextResponse.json({ ok: false, error: 'No se pudo fundir' }, { status: 500 })
  }
}
