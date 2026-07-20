/**
 * POST /api/hospital/mutar
 *
 * GATEWAY de mutaciones del internamiento con RBAC POR ACCIÓN validado en el
 * SERVIDOR (Admin SDK). Las Firestore Rules bloquean la escritura directa del
 * cliente al doc de internamiento; todo cambio pasa por aquí, donde el rol del
 * usuario (clinic_members) decide si la acción está permitida.
 *
 * Body: { clinicId, internamientoId?, accion, payload }
 * Resp: { ok, id? } | { ok:false, error }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarMiembro } from '@/lib/auth-server'
import { adminDb } from '@/lib/firebase-admin'
import { registroDurable } from '@/lib/hospital/registro-durable'
import { randomUUID } from 'crypto'

// Qué rol puede ejecutar cada acción.
const GATES: Record<string, string[]> = {
  crear:                 ['medico', 'admin'],
  egresar:               ['medico', 'admin'],
  trasladar:             ['medico', 'admin'],
  cambiar_tratante:      ['medico', 'admin'],
  indicacion_agregar:    ['medico', 'admin'],
  indicacion_suspender:  ['medico', 'admin'],
  indicacion_editar:     ['medico', 'admin'],
  indicacion_borrar:     ['medico', 'admin'],
  interconsulta_agregar: ['medico', 'admin'],
  interconsulta_responder: ['medico', 'admin'],
  interconsulta_editar:  ['medico', 'admin'],
  interconsulta_borrar:  ['medico', 'admin'],
  conciliar:             ['medico', 'admin'],
  administrar:           ['enfermeria', 'medico', 'admin'],
  balance:               ['enfermeria', 'medico', 'admin'],
  escala:                ['enfermeria', 'medico', 'admin'],
  sbar:                  ['enfermeria', 'medico', 'admin'],
  verificar_farmacia:    ['farmacia', 'medico', 'admin'],
}

type Any = Record<string, unknown>

// Calcula el patch para el doc de internamiento según la acción (mismo comportamiento que la lib cliente).
/** Identidad sellada por el servidor: quién ejecuta la acción, de verdad. */
interface Actor { uid: string; nombre: string }

function patch(accion: string, inter: Any, p: Any, now: string, actor: Actor): Any {
  const arr = (k: string) => (Array.isArray(inter[k]) ? (inter[k] as Any[]) : [])
  switch (accion) {
    case 'egresar':
      return { estado: 'egresado', fechaEgreso: now, tipoEgreso: p.tipoEgreso, resumenEgreso: p.resumenEgreso }
    case 'trasladar': {
      const detalle = `${inter.servicio}${inter.cama ? ' · Cama ' + inter.cama : ''} → ${p.servicio}${p.cama ? ' · Cama ' + p.cama : ''}`
      return { servicio: p.servicio, cama: p.cama, movimientos: [...arr('movimientos'), { fecha: now, tipo: 'traslado', detalle, por: p.por }] }
    }
    case 'cambiar_tratante':
      return { medicoTratanteId: p.medicoTratanteId, medicoTratanteNombre: p.medicoTratanteNombre, movimientos: [...arr('movimientos'), { fecha: now, tipo: 'tratante', detalle: `${inter.medicoTratanteNombre || '—'} → ${p.medicoTratanteNombre}`, por: p.por }] }
    case 'indicacion_agregar':
      return { indicaciones: [...arr('indicaciones'), { id: randomUUID(), tipo: p.tipo, descripcion: p.descripcion, frecuencia: p.frecuencia, creadaPor: p.creadaPor, activa: true, fecha: now, administraciones: [] }] }
    case 'indicacion_suspender':
      return { indicaciones: arr('indicaciones').map(x => (x as Any).id === p.indId ? { ...x, activa: p.activa } : x) }
    case 'indicacion_editar': {
      // Editable SOLO mientras no se haya administrado (si ya hay MAR, es registro clínico → suspender).
      const ind = arr('indicaciones').find(x => (x as Any).id === p.indId) as Any | undefined
      if (!ind) throw new Error('BLOQUEADO: la indicación no existe')
      if (Array.isArray(ind.administraciones) && ind.administraciones.length > 0) throw new Error('BLOQUEADO: la indicación ya se administró; suspéndela en vez de editarla')
      return { indicaciones: arr('indicaciones').map(x => (x as Any).id === p.indId ? { ...x, tipo: p.tipo, descripcion: p.descripcion, frecuencia: p.frecuencia } : x) }
    }
    case 'indicacion_borrar': {
      const ind = arr('indicaciones').find(x => (x as Any).id === p.indId) as Any | undefined
      if (ind && Array.isArray(ind.administraciones) && ind.administraciones.length > 0) throw new Error('BLOQUEADO: la indicación ya se administró; suspéndela en vez de borrarla')
      return { indicaciones: arr('indicaciones').filter(x => (x as Any).id !== p.indId) }
    }
    case 'administrar': {
      /**
       * TRES INVARIANTES QUE ANTES SOLO VIVÍAN EN LA INTERFAZ.
       *
       * 1. EPISODIO ACTIVO. El botón "Administrar" era la única acción del MAR sin
       *    la guarda de egresado, y `egresar` no cierra las indicaciones: quedaban
       *    `activa: true` para siempre. Se podía abrir el episodio de un paciente
       *    YA EGRESADO por URL directa o desde el tablero de camas y registrar una
       *    dosis. El servidor la aceptaba.
       *
       * 2. INDICACIÓN ACTIVA. El servidor no comprobaba `activa`. Carrera real:
       *    enfermería abre el modal de administración, el médico suspende el
       *    fármaco desde otra sesión, el modal sigue abierto y no se revalida →
       *    se registra una dosis de un fármaco suspendido.
       *
       * 3. AUTOR Y HORA LOS PONE EL SERVIDOR. El cliente enviaba `por` con
       *    `config.nombreMedico` —un documento COMPARTIDO por toda la clínica, no
       *    el usuario en sesión—, así que la enfermera que administró quedaba
       *    registrada con el nombre del médico titular. Y la `fecha` venía del
       *    reloj de la tablet, que puede estar desajustado y además es
       *    manipulable. La hora de administración es dato clínico duro.
       */
      if (inter.estado !== 'activo') {
        throw new Error('BLOQUEADO: el paciente ya fue egresado; no se puede registrar una administración.')
      }
      const indAdm = arr('indicaciones').find(x => (x as Any).id === p.indId) as Any | undefined
      if (!indAdm) throw new Error('BLOQUEADO: la indicación no existe')
      if (indAdm.activa === false) {
        throw new Error('BLOQUEADO: la indicación está suspendida; no se puede administrar.')
      }
      const adm = {
        ...(p.adm ?? {}),
        por: actor.nombre,          // quien lo hizo DE VERDAD, no el titular del consultorio
        porUid: actor.uid,
        fecha: now,                 // reloj del servidor, no el de la tablet
      }
      return { indicaciones: arr('indicaciones').map(x => (x as Any).id === p.indId ? { ...x, administraciones: [...((x as Any).administraciones as Any[] ?? []), adm] } : x) }
    }
    case 'verificar_farmacia':
      return { indicaciones: arr('indicaciones').map(x => (x as Any).id === p.indId ? { ...x, verificadaFarmacia: true, verificadaPor: p.por, fechaVerificacion: now } : x) }
    case 'interconsulta_agregar':
      return { interconsultas: [...arr('interconsultas'), { id: randomUUID(), especialidad: p.especialidad, motivo: p.motivo, solicitanteNombre: p.solicitanteNombre, solicitanteId: p.solicitanteId ?? null, medicoSolicitadoId: p.medicoSolicitadoId ?? null, medicoSolicitadoNombre: p.medicoSolicitadoNombre ?? null, estado: 'solicitada', fecha: now }] }
    case 'interconsulta_responder':
      return { interconsultas: arr('interconsultas').map(x => (x as Any).id === p.icId ? { ...x, estado: 'respondida', fechaRespuesta: now, respuesta: p.respuesta, respondidaPor: p.respondidaPor } : x) }
    case 'interconsulta_editar': {
      // Editable SOLO mientras esté 'solicitada' (una vez respondida es registro clínico definitivo).
      const ic = arr('interconsultas').find(x => (x as Any).id === p.icId) as Any | undefined
      if (!ic) throw new Error('BLOQUEADO: la interconsulta no existe')
      if (ic.estado === 'respondida') throw new Error('BLOQUEADO: una interconsulta ya respondida no se edita')
      return { interconsultas: arr('interconsultas').map(x => (x as Any).id === p.icId ? { ...x, especialidad: p.especialidad, motivo: p.motivo, medicoSolicitadoId: p.medicoSolicitadoId ?? null, medicoSolicitadoNombre: p.medicoSolicitadoNombre ?? null } : x) }
    }
    case 'interconsulta_borrar': {
      const ic = arr('interconsultas').find(x => (x as Any).id === p.icId) as Any | undefined
      if (ic && ic.estado === 'respondida') throw new Error('BLOQUEADO: una interconsulta ya respondida no se borra')
      return { interconsultas: arr('interconsultas').filter(x => (x as Any).id !== p.icId) }
    }
    case 'conciliar': {
      /**
       * BLOQUEO OPTIMISTA. La conciliación reemplaza la lista ENTERA con lo que
       * manda el cliente, no la fusiona. Sin control, dos dispositivos que abren
       * la conciliación, editan por separado y guardan producen un lost-update:
       * gana el último y borra en silencio los medicamentos que agregó el otro —
       * en una lista de la que dependen decisiones de prescripción.
       *
       * El cliente envía el `conciliadoAl` que vio al cargar. Si ya no coincide,
       * alguien más guardó en medio: se rechaza y se le pide recargar, en vez de
       * pisar su trabajo. `undefined` del cliente contra `undefined` en el doc
       * (primera conciliación) sí coincide, que es lo correcto.
       */
      const baseVista = (p as Any).baseConciliadoAl ?? null
      const actual = (inter as Any).conciliadoAl ?? null
      if (baseVista !== actual) {
        throw new Error('BLOQUEADO: otra persona actualizó la conciliación mientras la editabas. Recárgala y vuelve a aplicar tus cambios.')
      }
      return { medicamentosCasa: p.meds, conciliadoAl: now }
    }
    // NOTA: los arrays balanceHidrico/escalas/sbar en el DOC se limitan por
    // tamaño (tope de 1 MB por documento Firestore) y son solo CACHÉ DE DISPLAY.
    // El registro clínico-legal COMPLETO (sin truncar) se persiste en la
    // subcolección append-only `registros` — ver registroDurable() y la
    // transacción de POST. Así ningún registro se pierde (NOM-004).
    case 'balance':
      return { balanceHidrico: [...arr('balanceHidrico'), { fecha: now, ingresos: p.ingresos, egresos: p.egresos, por: p.por }].slice(-100) }
    case 'escala':
      return { escalas: [...arr('escalas'), { fecha: now, tipo: p.tipo, score: p.score, riesgo: p.riesgo, por: p.por }].slice(-100) }
    case 'sbar':
      return { sbar: [...arr('sbar'), { fecha: now, texto: p.texto, por: p.por }].slice(-50) }
    default:
      return {}
  }
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; internamientoId?: string; accion?: string; payload?: Any }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const { clinicId, internamientoId, accion, payload = {} } = body
  if (!clinicId || !accion) return NextResponse.json({ ok: false, error: 'clinicId y accion requeridos' }, { status: 400 })

  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response
  const roles = GATES[accion]
  if (!roles) return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 })
  if (!roles.includes(String(acc.role ?? ''))) return NextResponse.json({ ok: false, error: `Tu rol (${acc.role}) no puede: ${accion}` }, { status: 403 })

  const now = new Date().toISOString()
  const col = adminDb.collection('clinics').doc(clinicId).collection('internamientos')

  try {
    // Ingreso: create con guard de duplicado activo ATÓMICO (transacción: la
    // consulta y la escritura van juntas → dos ingresos simultáneos no cuelan).
    if (accion === 'crear') {
      if (!payload.pacienteId) return NextResponse.json({ ok: false, error: 'Falta el paciente' }, { status: 400 })
      try {
        const id = await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(col.where('pacienteId', '==', payload.pacienteId))
          if (snap.docs.some(d => d.data().estado === 'activo')) throw new Error('DUPLICADO')
          const nref = col.doc()
          tx.set(nref, { ...payload, clinicId, estado: 'activo', createdAt: now, updatedAt: now })
          return nref.id
        })
        return NextResponse.json({ ok: true, id })
      } catch (e) {
        if (e instanceof Error && e.message === 'DUPLICADO') return NextResponse.json({ ok: false, error: 'DUPLICADO: el paciente ya tiene un internamiento activo.' }, { status: 409 })
        throw e
      }
    }

    if (!internamientoId) return NextResponse.json({ ok: false, error: 'internamientoId requerido' }, { status: 400 })
    const ref = col.doc(internamientoId)
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('no-existe')
      const inter = { id: snap.id, ...(snap.data() as Any) }
      const actor: Actor = {
        uid: acc.uid,
        // El correo verificado identifica a la PERSONA. El rol solo lo acompaña.
        nombre: acc.email ? `${acc.email} (${acc.role ?? 'clínico'})` : String(acc.role ?? 'clínico'),
      }
      tx.update(ref, { ...patch(accion, inter, payload, now, actor), updatedAt: now })
      // Además del array-caché en el doc, persiste el registro clínico COMPLETO
      // a la subcolección append-only (sin truncar) → no se pierde nada (NOM-004).
      const durable = registroDurable(accion, payload, now)
      if (durable) tx.set(ref.collection('registros').doc(), durable)
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    if (msg === 'no-existe') return NextResponse.json({ ok: false, error: 'El internamiento no existe' }, { status: 404 })
    if (msg.startsWith('BLOQUEADO:')) return NextResponse.json({ ok: false, error: msg.replace('BLOQUEADO: ', '') }, { status: 409 })
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
