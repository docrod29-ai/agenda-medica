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
import { idDeEstanciaArchivada, hayQueArchivar } from '@/lib/hospital/estancias-uci'
import { verificarMiembro } from '@/lib/auth-server'
import { exigeCapacidad } from '@/lib/authz/verificar'
import { ACCIONES_HOSPITAL_MUTAR } from '@/lib/authz/registro-rutas'
import { adminDb } from '@/lib/firebase-admin'
import { esCritica, type Unidad } from '@/lib/hospital/unidades'
import { camaVigenteDe, trasladar as trasladarCama } from '@/lib/hospital/bed-assignment'
import { POLITICA_CAMAS_SEGURA, transicionar } from '@/lib/hospital/estados-cama'
import type { BedAssignment, EstadoCama } from '@/types/hospital'
import { registroDurable } from '@/lib/hospital/registro-durable'
import { mismaCama } from '@/lib/hospital/cama'
import { randomUUID } from 'crypto'

/**
 * Qué CAPACIDAD exige cada acción (E0-07). Antes era un mapa `GATES` de listas de
 * roles sueltas aquí mismo — una de las seis copias de la política de acceso que
 * había en el repo. Ahora la tabla vive en `src/lib/authz/registro-rutas.ts` y un
 * test de tabla comprueba, acción por acción, que el conjunto de roles resultante
 * es IDÉNTICO al del `GATES` viejo (copiado literal como oráculo): esto es una
 * traducción de vocabulario, no un cambio de política.
 */
const ACCIONES = ACCIONES_HOSPITAL_MUTAR

type Any = Record<string, unknown>

// Calcula el patch para el doc de internamiento según la acción (mismo comportamiento que la lib cliente).
/** Identidad sellada por el servidor: quién ejecuta la acción, de verdad. */
interface Actor { uid: string; nombre: string }

function patch(accion: string, inter: Any, p: Any, now: string, actor: Actor): Any {
  const arr = (k: string) => (Array.isArray(inter[k]) ? (inter[k] as Any[]) : [])
  switch (accion) {
    case 'egresar':
      // Al egresar se cierran TODAS las indicaciones activas: si no, quedaban
      // `activa: true` en un paciente ya dado de alta → la ficha seguía contando
      // "Indicaciones · MAR (N)", la conciliación las marcaba "continuado" y el
      // export FHIR las veía vigentes. (La administración ya estaba bloqueada por la
      // guarda de episodio, así que esto es consistencia de estado, no de dosis.)
      return {
        estado: 'egresado', fechaEgreso: now, tipoEgreso: p.tipoEgreso, resumenEgreso: p.resumenEgreso,
        indicaciones: arr('indicaciones').map(x => (x as Any).activa ? { ...x, activa: false, suspendidaPor: 'Cierre por egreso', fechaSuspension: now } : x),
      }
    case 'trasladar': {
      const detalle = `${inter.servicio}${inter.cama ? ' · Cama ' + inter.cama : ''} → ${p.servicio}${p.cama ? ' · Cama ' + p.cama : ''}`
      return { servicio: p.servicio, cama: p.cama, movimientos: [...arr('movimientos'), { fecha: now, tipo: 'traslado', detalle, por: actor.nombre }] }
    }
    case 'cambiar_tratante':
      return { medicoTratanteId: p.medicoTratanteId, medicoTratanteNombre: p.medicoTratanteNombre, movimientos: [...arr('movimientos'), { fecha: now, tipo: 'tratante', detalle: `${inter.medicoTratanteNombre || '—'} → ${p.medicoTratanteNombre}`, por: actor.nombre }] }
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
      return { indicaciones: arr('indicaciones').map(x => (x as Any).id === p.indId ? { ...x, verificadaFarmacia: true, verificadaPor: actor.nombre, fechaVerificacion: now } : x) }
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
    // `por: actor.nombre` — el AUTOR REAL (usuario en sesión), no el `p.por` que
    // manda el cliente (que traía config.nombreMedico = el titular de la clínica).
    // Igual que el MAR: la enfermera que registra queda registrada como ella, no
    // como el médico. Es dato clínico-legal (quién hizo qué).
    case 'balance':
      return { balanceHidrico: [...arr('balanceHidrico'), { fecha: now, ingresos: p.ingresos, egresos: p.egresos, por: actor.nombre }].slice(-100) }
    case 'escala':
      return { escalas: [...arr('escalas'), { fecha: now, tipo: p.tipo, score: p.score, riesgo: p.riesgo, por: actor.nombre }].slice(-100) }
    case 'sbar':
      return { sbar: [...arr('sbar'), { fecha: now, texto: p.texto, por: actor.nombre }].slice(-50) }
    default:
      return {}
  }
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; internamientoId?: string; accion?: string; payload?: Any }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const { clinicId, internamientoId, accion, payload = {} } = body
  if (!clinicId || !accion) return NextResponse.json({ ok: false, error: 'clinicId y accion requeridos' }, { status: 400 })

  /**
   * Membresía PRIMERO, capacidad después. El orden es deliberado y hay que
   * conservarlo: así una acción inventada solo devuelve 400 a quien YA es miembro
   * del consultorio; a un extraño se le responde 401/403 y no se le confirma qué
   * acciones existen. Por eso este gateway usa `exigeCapacidad` sobre un acceso ya
   * verificado en vez de pasarle la capacidad a `verificarCapacidad`.
   */
  const acc = await verificarMiembro(req, clinicId)
  if (!acc.ok) return acc.response
  const capacidad = ACCIONES[accion]
  if (!capacidad) return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 })
  const denegado = exigeCapacidad(acc, capacidad)
  if (denegado) return denegado

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
          // Colisión de CAMA: si se asignó cama, rechazar si otro internamiento
          // ACTIVO ya la ocupa (mismo servicio). Sin esto se metían dos pacientes en
          // la misma cama y el segundo quedaba invisible en el tablero. Se compara
          // por servicio (query, sin índice compuesto) y se normaliza la etiqueta.
          if (payload.cama) {
            const ocup = await tx.get(col.where('servicio', '==', payload.servicio ?? ''))
            if (ocup.docs.some(d => { const x = d.data(); return x.estado === 'activo' && mismaCama(x.cama as string, payload.cama as string) })) {
              throw new Error('CAMA_OCUPADA')
            }
          }
          // ALLOWLIST anti mass-assignment (auditoría P2): solo campos de INGRESO;
          // clinicId/estado/tiempos/autoría los fija el servidor.
          const CAMPOS_INGRESO = [
            'pacienteId', 'pacienteNombre', 'servicio', 'cama', 'medicoTratanteId',
            'medicoTratanteNombre', 'diagnosticoIngreso', 'motivoIngreso', 'fechaIngreso',
          ] as const
          const limpio: Record<string, unknown> = {}
          for (const k of CAMPOS_INGRESO) {
            const v = (payload as Record<string, unknown>)[k]
            if (v !== undefined) limpio[k] = v
          }
          /**
           * INGRESO DIRECTO A UNA UNIDAD CRÍTICA: abre la `ICUStay` aquí mismo.
           *
           * El traslado ya lo hacía, el ingreso NO — y se vio en la primera
           * pantalla real: un paciente admitido directo a terapia se quedaba sin
           * estancia, así que la tarjeta no podía decir su día de UCI hasta que
           * alguien tocara los soportes por casualidad.
           *
           * Se lee ANTES de escribir, como exige la transacción.
           */
          const uSnap = await tx.get(adminDb.collection('clinics').doc(clinicId).collection('unidades'))
          const unidades = uSnap.docs.map(d => ({ ...(d.data() as Any), id: d.id })) as Unidad[]
          const nref = col.doc()
          tx.set(nref, { ...limpio, clinicId, estado: 'activo', createdAt: now, updatedAt: now, creadoPor: acc.uid })

          if (esCritica(String(payload.servicio ?? ''), unidades)) {
            // El ingreso a la UNIDAD es el de este episodio: la fecha de ingreso
            // capturada si viene, y si no, ahora.
            tx.set(nref.collection('icu_stays').doc('actual'), {
              internamientoId: nref.id,
              pacienteId: payload.pacienteId,
              estado: 'activa',
              fechaIngresoUci: (payload.fechaIngreso as string) || now,
              soportes: [],
              actualizadoPor: acc.uid,
              actualizadoEn: now,
            })
          }
          return nref.id
        })
        return NextResponse.json({ ok: true, id })
      } catch (e) {
        if (e instanceof Error && e.message === 'DUPLICADO') return NextResponse.json({ ok: false, error: 'DUPLICADO: el paciente ya tiene un internamiento activo.' }, { status: 409 })
        if (e instanceof Error && e.message === 'CAMA_OCUPADA') return NextResponse.json({ ok: false, error: 'Esa cama ya está ocupada por otro paciente activo.' }, { status: 409 })
        throw e
      }
    }

    if (!internamientoId) return NextResponse.json({ ok: false, error: 'internamientoId requerido' }, { status: 400 })
    const ref = col.doc(internamientoId)
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error('no-existe')
      const inter = { id: snap.id, ...(snap.data() as Any) }
      // Traslado a una cama ya ocupada por OTRO internamiento activo → rechazar.
      // (Lectura antes de la escritura, como exige la transacción.)
      if (accion === 'trasladar' && payload.cama) {
        // Servicio DESTINO: si el traslado solo cambia la cama dentro del mismo
        // servicio, el payload puede no reenviar `servicio` → se usa el actual del
        // internamiento. Sin este fallback la query miraba servicio='' y no detectaba
        // al ocupante real (permitiendo la doble ocupación que se quiere evitar).
        const servicioDestino = (payload.servicio as string) ?? ((inter as Any).servicio as string) ?? ''
        const ocup = await tx.get(col.where('servicio', '==', servicioDestino))
        if (ocup.docs.some(d => { const x = d.data(); return d.id !== internamientoId && x.estado === 'activo' && mismaCama(x.cama as string, payload.cama as string) })) {
          throw new Error('CAMA_OCUPADA')
        }
      }
      const actor: Actor = {
        uid: acc.uid,
        // El correo verificado identifica a la PERSONA. El rol solo lo acompaña.
        nombre: acc.email ? `${acc.email} (${acc.role ?? 'clínico'})` : String(acc.role ?? 'clínico'),
      }
      /**
       * TRASLADO A / DESDE UNA UNIDAD CRÍTICA — abre y cierra la `ICUStay`.
       *
       * Sin esto, el «día de UCI» se contaba desde el ingreso al HOSPITAL: un
       * paciente con 3 días en urgencias que ayer subió a terapia aparecía como
       * «Día UCI 4». El día de UCI se cuenta desde que entra a la UNIDAD.
       *
       * El tipo de unidad NUNCA se decide por el nombre: sale de `unidades`, que
       * configura el hospital. Un servicio sin clasificar no es crítico ni deja
       * de serlo — simplemente no dispara nada, y la pantalla de UCI lo declara.
       */
      /**
       * EGRESAR TAMBIÉN CIERRA LA ESTANCIA DE TERAPIA.
       *
       * `estado: 'egresada'` sólo se escribía en el traslado crítica→piso. Un
       * paciente que fallece o se traslada fuera del hospital estando en UCI
       * dejaba su estancia en `activa` PARA SIEMPRE: el ciclo de vida existía en
       * el tipo y no en el código, y cualquier cuenta de estancias abiertas —hoy
       * o el día que alguien la escriba— saldría mal.
       */
      if (accion === 'egresar') {
        const estanciaRef = ref.collection('icu_stays').doc('actual')
        const prev = await tx.get(estanciaRef)
        if (prev.exists && (prev.data() as Any)?.estado === 'activa') {
          tx.set(estanciaRef, {
            estado: 'egresada', fechaEgresoUci: now,
            actualizadoPor: actor.uid, actualizadoEn: now,
          }, { merge: true })
        }
      }

      if (accion === 'trasladar') {
        const uSnap = await tx.get(adminDb.collection('clinics').doc(clinicId).collection('unidades'))
        const unidades = uSnap.docs.map(d => ({ ...(d.data() as Any), id: d.id })) as Unidad[]
        const destino = (payload.servicio as string) ?? ((inter as Any).servicio as string) ?? ''
        const origen = ((inter as Any).servicio as string) ?? ''
        const aCritica = esCritica(destino, unidades)
        const deCritica = esCritica(origen, unidades)
        const estanciaRef = ref.collection('icu_stays').doc('actual')

        if (aCritica && !deCritica) {
          const prev = await tx.get(estanciaRef)
          /**
           * ARCHIVAR LA ESTANCIA ANTERIOR ANTES DE REABRIR.
           *
           * `actual` es un id FIJO, así que un reingreso a terapia sobreescribía
           * la estancia previa y sus días dejaban de existir: no se podían
           * contar, ni auditar, ni saber que hubo un reingreso. El tipo promete
           * lo contrario —«cada estancia se conserva»— y el código hacía lo otro.
           *
           * `actual` sigue siendo el puntero a la vigente (lo leen la ruta de
           * estancia, la pantalla de UCI y las reglas): lo que se añade es que
           * la que se cierra se guarda aparte, con id derivado de su fecha de
           * ingreso para que un reintento de la transacción no la duplique.
           */
          const datosPrev = prev.exists ? (prev.data() as Any) : null
          if (hayQueArchivar(datosPrev)) {
            const idArchivo = idDeEstanciaArchivada(datosPrev?.fechaIngresoUci as string)
            if (idArchivo) {
              tx.set(ref.collection('icu_stays').doc(idArchivo), {
                ...datosPrev,
                // Si salió a piso ya venía cerrada; si no, se cierra AHORA, que es
                // cuando dejó de ser la vigente.
                estado: 'egresada',
                fechaEgresoUci: (datosPrev?.fechaEgresoUci as string) || now,
                archivadaEn: now,
                archivadaPor: actor.uid,
              })
            }
          }
          // Reingreso a terapia: se ABRE de nuevo con la fecha de ESTE ingreso.
          // Conservar la anterior contaría los días de la estancia previa.
          tx.set(estanciaRef, {
            internamientoId,
            pacienteId: (inter as Any).pacienteId ?? '',
            estado: 'activa',
            fechaIngresoUci: now,
            fechaEgresoUci: null,
            soportes: prev.exists ? ((prev.data() as Any).soportes ?? []) : [],
            actualizadoPor: actor.uid,
            actualizadoEn: now,
          }, { merge: true })
        } else if (deCritica && !aCritica) {
          // Alta de UCI a piso: la estancia se cierra, el EPISODIO sigue abierto.
          const prev = await tx.get(estanciaRef)
          if (prev.exists) {
            tx.set(estanciaRef, {
              estado: 'egresada', fechaEgresoUci: now,
              actualizadoPor: actor.uid, actualizadoEn: now,
            }, { merge: true })
          }
        }
      }

      /**
       * HISTORIA DE CAMAS y ESTADO DE LA CAMA QUE SE DEJA.
       *
       * Antes el traslado sólo dejaba una frase en `movimientos[].detalle`: no se
       * podía preguntar «¿en qué cama estaba el martes a las 3?». Ahora se cierra
       * la asignación vigente y se abre la nueva en intervalos semiabiertos
       * (`hasta` === `desde`), que es lo que evita el doble conteo.
       *
       * Y la cama que se deja pasa a PENDIENTE DE LIMPIEZA TERMINAL, según la
       * decisión del Dr. (2026-07-30). El motor decide si el paso es válido; aquí
       * no se repite la política.
       *
       * Nada de esto puede tumbar el traslado: es historia y logística. Si algo
       * falla, el traslado clínico ya quedó — la reconciliación es un problema
       * menor que dejar al paciente sin mover.
       */
      if (accion === 'trasladar' && payload.cama) {
        const camaDestino = String(payload.cama)
        const camaOrigen = String((inter as Any).cama ?? '')
        if (camaDestino !== camaOrigen) {
          const asigCol = ref.collection('bed_assignments')
          const asigSnap = await tx.get(asigCol)
          const asignaciones = asigSnap.docs.map(d => ({ ...(d.data() as Any), id: d.id })) as BedAssignment[]
          const vigente = asignaciones.find(a => a.hasta === undefined || a.hasta === null)

          const nuevaRef = asigCol.doc()
          if (vigente) {
            try {
              const { cierre, apertura } = trasladarCama(
                vigente, { id: nuevaRef.id, camaId: camaDestino, por: actor.uid }, now)
              tx.set(asigCol.doc(vigente.id), { hasta: cierre.hasta }, { merge: true })
              tx.set(nuevaRef, { ...apertura })
            } catch { /* asignación inconsistente: no se rompe el traslado clínico */ }
          } else {
            // Primer registro: el episodio venía de antes de que existiera la
            // historia de camas. Se abre desde AHORA, no se inventa el pasado.
            tx.set(nuevaRef, {
              id: nuevaRef.id, camaId: camaDestino, desde: now,
              motivo: 'traslado', por: actor.uid,
            })
          }

          // La cama de ORIGEN, a limpieza terminal.
          if (camaOrigen !== '') {
            const camasSnap = await tx.get(
              adminDb.collection('clinics').doc(clinicId).collection('camas')
                .where('etiqueta', '==', camaOrigen))
            for (const d of camasSnap.docs) {
              const actualEstado = ((d.data() as Any).estado ?? 'ocupada') as EstadoCama
              const r = transicionar(actualEstado, 'limpieza', POLITICA_CAMAS_SEGURA)
              if (r.permitida) tx.set(d.ref, { estado: 'limpieza' }, { merge: true })
            }
          }
        }
      }

      tx.update(ref, { ...patch(accion, inter, payload, now, actor), updatedAt: now })
      // Además del array-caché en el doc, persiste el registro clínico COMPLETO
      // a la subcolección append-only (sin truncar) → no se pierde nada (NOM-004).
      const durable = registroDurable(accion, payload, now, actor.nombre)
      if (durable) tx.set(ref.collection('registros').doc(), durable)
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    if (msg === 'no-existe') return NextResponse.json({ ok: false, error: 'El internamiento no existe' }, { status: 404 })
    if (msg === 'CAMA_OCUPADA') return NextResponse.json({ ok: false, error: 'Esa cama ya está ocupada por otro paciente activo.' }, { status: 409 })
    if (msg.startsWith('BLOQUEADO:')) return NextResponse.json({ ok: false, error: msg.replace('BLOQUEADO: ', '') }, { status: 409 })
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
