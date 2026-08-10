/**
 * POST /api/expediente/paquete-visita
 *
 * POSTVISIT-001 — el paquete se genera del encuentro y SÓLO se libera con
 * aprobación del médico. Dos acciones, misma capacidad (`clinico.escribir`,
 * porque componer un paquete lee diagnósticos y medicación, secreto médico
 * bajo NOM-004):
 *
 *   `componer` → arma un `PaqueteDeVisita` en `DRAFT` desde una nota FIRMADA
 *                y lo guarda. Vuelve a componer si ya había un DRAFT para esa
 *                nota (la nota pudo cambiar por adenda); un paquete ya
 *                `RELEASED` es inmutable y esta acción lo rechaza.
 *   `liberar`  → pasa un `DRAFT` a `RELEASED`. Quién y cuándo los pone el
 *                SERVIDOR (`acceso.email` + `Date.now()`), nunca el body: un
 *                paquete liberado «por quien diga el cliente» es exactamente
 *                el hueco que `liberar()` existe para cerrar.
 *
 * Body: { clinicId, patientId, action: 'componer', notaId }
 *     | { clinicId, patientId, action: 'liberar', paqueteId }
 *
 * La composición en sí es pura (`componerPaquete`, en
 * `lib/paciente/paquete-de-visita.ts`) — aquí sólo se lee Firestore, se arma
 * el insumo y se persiste. Ningún modelo de lenguaje interviene.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { safeLog } from '@/lib/security/sanitize'
import type { NotaMedica, Medicamento } from '@/types/expediente'
import { medicamentosVigentes } from '@/lib/expediente/ordenes-medicamento'
import { telefonoDelConsultorio } from '@/lib/whatsapp/avisar-consultorio'
import { componerPaquete, liberar, type PaqueteDeVisita } from '@/lib/paciente/paquete-de-visita'

interface NotaFirmadaResumida {
  id: string
  fecha: string
  medicamentos?: Medicamento[]
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; patientId?: string; action?: string; notaId?: string; paqueteId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const clinicId = String(body.clinicId ?? '')
  const patientId = String(body.patientId ?? '')
  if (!clinicId || !patientId) {
    return NextResponse.json({ ok: false, error: 'Faltan clinicId y patientId' }, { status: 400 })
  }

  const acceso = await verificarCapacidad(req, clinicId, 'clinico.escribir')
  if (!acceso.ok) return acceso.response

  const patientRef = adminDb.collection('clinics').doc(clinicId).collection('patients').doc(patientId)

  try {
    if (body.action === 'componer') {
      const notaId = String(body.notaId ?? '')
      if (!notaId) return NextResponse.json({ ok: false, error: 'Falta notaId' }, { status: 400 })

      const notaSnap = await patientRef.collection('notas').doc(notaId).get()
      if (!notaSnap.exists) {
        return NextResponse.json({ ok: false, error: 'Nota no encontrada' }, { status: 404 })
      }
      const nota = { id: notaSnap.id, ...(notaSnap.data() as Omit<NotaMedica, 'id'>) }
      if (nota.estado !== 'firmada') {
        return NextResponse.json(
          { ok: false, error: 'La nota tiene que estar firmada antes de componer el paquete de la visita' },
          { status: 409 },
        )
      }

      const existenteSnap = await patientRef.collection('paquetes_visita').where('notaId', '==', notaId).limit(1).get()
      const existente = existenteSnap.docs[0]
      if (existente && (existente.data() as PaqueteDeVisita).estado === 'RELEASED') {
        return NextResponse.json(
          { ok: false, error: 'Esta consulta ya tiene un paquete liberado; no se puede recomponer.' },
          { status: 409 },
        )
      }

      /**
       * `medicamentosVigentes` decide qué es «cambio» leyendo TODAS las notas
       * firmadas del paciente, antes y después de incluir ésta — no la nota
       * cruda. Es lo que evita que un fármaco crónico no repetido hoy salga
       * como «suspendido» (ver el comentario de `cambiosDeMedicacion`).
       */
      const todasSnap = await patientRef.collection('notas').where('estado', '==', 'firmada').get()
      const todas: NotaFirmadaResumida[] = todasSnap.docs.map(d => {
        const data = d.data() as Omit<NotaMedica, 'id'>
        return { id: d.id, fecha: data.fechaConsulta, medicamentos: data.medicamentos }
      })
      const antes = todas.filter(n => n.id !== notaId)
      const medicacionVigenteAntes = medicamentosVigentes(antes).map(v => ({ nombre: v.medicamento.nombre }))
      const medicacionVigenteDespues = medicamentosVigentes(todas).map(v => ({ nombre: v.medicamento.nombre }))

      const configSnap = await adminDb.collection('clinics').doc(clinicId).collection('config').doc('main').get()
      const telefono = telefonoDelConsultorio(
        configSnap.data() as { whatsappConsultorio?: string; telefonoAdmin?: string } | undefined,
      )
      const clinicianContactRules = telefono
        ? `Si tiene dudas sobre esta consulta, comuníquese a su consultorio: ${telefono}.`
        : 'Si tiene dudas sobre esta consulta, comuníquese a su consultorio.'

      const paquete = componerPaquete(nota, {
        medicacionVigenteAntes: antes.length ? medicacionVigenteAntes : null,
        medicacionVigenteDespues,
        clinicianContactRules,
      })

      const ref = existente ? existente.ref : patientRef.collection('paquetes_visita').doc()
      await ref.set(paquete)
      safeLog.info(`[paquete-visita] compuesto clinic=${clinicId} nota=${notaId} paquete=${ref.id}`)
      return NextResponse.json({ ok: true, paqueteId: ref.id, paquete })
    }

    if (body.action === 'liberar') {
      const paqueteId = String(body.paqueteId ?? '')
      if (!paqueteId) return NextResponse.json({ ok: false, error: 'Falta paqueteId' }, { status: 400 })

      const ref = patientRef.collection('paquetes_visita').doc(paqueteId)
      const snap = await ref.get()
      if (!snap.exists) return NextResponse.json({ ok: false, error: 'Paquete no encontrado' }, { status: 404 })
      const paquete = snap.data() as PaqueteDeVisita
      if (paquete.estado === 'RELEASED') {
        return NextResponse.json({ ok: false, error: 'Este paquete ya fue liberado' }, { status: 409 })
      }

      const liberado = liberar(paquete, acceso.email ?? acceso.uid, Date.now())
      await ref.set(liberado)
      safeLog.info(`[paquete-visita] liberado clinic=${clinicId} paquete=${paqueteId}`)
      return NextResponse.json({ ok: true, paquete: liberado })
    }

    return NextResponse.json({ ok: false, error: 'Acción no soportada' }, { status: 400 })
  } catch (e) {
    safeLog.error('[paquete-visita] error', e)
    const msg = e instanceof Error ? e.message : 'Error del servidor'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
