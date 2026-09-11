/**
 * GET /api/cumplimiento/bitacora?clinicId=…&desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&patientId=…]
 *
 * LA BITÁCORA DE ACCESOS, EN CSV Y DEL PERIODO QUE SE PIDA.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * El panel de Cumplimiento pinta la bitácora y cita NOM-024 en el título de la
 * sección. Pero **no se puede sacar de ahí**: no hay descarga, y lo que se ve
 * son los 200 asientos más recientes —500 si se filtra por paciente—.
 *
 * Ante una auditoría, una queja ante el INAI o un litigio, lo que se pide es el
 * rastro **del periodo**. Un registro que sólo se puede mirar no es un registro
 * entregable.
 *
 * ── POR QUÉ DEL SERVIDOR ─────────────────────────────────────────────────────
 *
 * El periodo puede ser de meses. Leerlo desde el navegador significaría paginar
 * a mano con el médico esperando, y el asiento de que alguien se llevó la
 * bitácora lo escribiría el mismo código que podría saltárselo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad, exigeAdministrador } from '@/lib/authz/verificar'
import { puedeVerExpediente } from '@/lib/authz/alcance-del-paciente'
import { cabecera, fila, type AsientoBitacora } from '@/lib/expediente/bitacora-csv'

export const maxDuration = 300

/** Documentos por página. */
const PAGINA = 500
/**
 * Tope duro de asientos por descarga.
 *
 * No es un límite de producto: es el freno para que una petición mal formada no
 * intente escribir años enteros en un solo archivo. Si se alcanza, **se
 * declara** en la última línea — un recorte que nadie ve se lee como «eso era
 * todo el rastro», que en una auditoría es exactamente la conclusión errónea.
 */
const TOPE = 50_000

const FECHA = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })

  /**
   * `administrar`: la bitácora dice quién vio el expediente de quién. Es del
   * responsable del tratamiento de los datos, no del mostrador ni del médico
   * que aparece en ella.
   */
  const acc = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acc.ok) return acc.response
  // La vista de trabajo conserva acceso a los asientos de SUS pacientes.
  // El volcado íntegro CSV sigue reservado al administrador.
  if (req.nextUrl.searchParams.get('formato') === 'json') {
    const patientId = req.nextUrl.searchParams.get('patientId') ?? ''
    if (patientId.includes('/')) return NextResponse.json({ error: 'Paciente inválido' }, { status: 400 })
    try {
      const base = adminDb.collection('clinics').doc(clinicId)
      if (patientId) {
        const ficha = await base.collection('patients').doc(patientId).get()
        if (!ficha.exists || !puedeVerExpediente(ficha.data(), acc.uid, acc.role)) return NextResponse.json({ error: 'No tienes acceso a este expediente.' }, { status: 403 })
      }
      const tope = patientId ? 500 : 200
      const consulta = patientId
        ? base.collection('audit_log').where('patientId', '==', patientId)
        : base.collection('audit_log').orderBy('timestamp', 'desc')
      const permisos = new Map<string, boolean>()
      const filas: AsientoBitacora[] = []
      let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined
      let examinados = 0
      let agotada = false
      while (filas.length <= tope && examinados < 5000) {
        const cantidad = Math.min(200, 5000 - examinados)
        const snap = await (cursor ? consulta.startAfter(cursor) : consulta).limit(cantidad).get()
        examinados += snap.size
        if (acc.role !== 'admin' && !patientId) {
          const ids = [...new Set(snap.docs.map(d => d.get('patientId')).filter((id): id is string => typeof id === 'string' && !!id && !id.includes('/') && !permisos.has(id)))]
          if (ids.length) {
            const fichas = await adminDb.getAll(...ids.map(id => base.collection('patients').doc(id)), { fieldMask: ['medicoTitularUid', 'compartidoCon'] })
            for (const p of fichas) permisos.set(p.id, p.exists && puedeVerExpediente(p.data(), acc.uid, acc.role))
          }
        }
        for (const d of snap.docs) {
          const a = { id: d.id, ...d.data() } as AsientoBitacora
          if (acc.role === 'admin' || patientId || (a.patientId ? permisos.get(a.patientId) === true : d.get('medicoUid') === acc.uid)) filas.push(a)
        }
        if (snap.size < cantidad) { agotada = true; break }
        cursor = snap.docs[snap.docs.length - 1]
      }
      if (!agotada && examinados >= 5000 && filas.length <= tope) throw new Error('No se pudo completar la búsqueda dentro del límite de lectura.')
      return NextResponse.json({ filas: filas.slice(0, tope), truncada: filas.length > tope }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (e) {
      safeLog.error('[cumplimiento/bitacora] lectura privada', e)
      return NextResponse.json({ error: 'No se pudo cargar la bitácora.' }, { status: 503 })
    }
  }
  const sinAdministracion = exigeAdministrador(acc)
  if (sinAdministracion) return sinAdministracion

  const desde = req.nextUrl.searchParams.get('desde') ?? ''
  const hasta = req.nextUrl.searchParams.get('hasta') ?? ''
  const patientId = req.nextUrl.searchParams.get('patientId') ?? ''
  if (!FECHA.test(desde) || !FECHA.test(hasta)) {
    return NextResponse.json({
      error: 'Hacen falta `desde` y `hasta` en formato YYYY-MM-DD. Una bitácora sin periodo declarado no se puede presentar como prueba de nada.',
    }, { status: 400 })
  }
  if (desde > hasta) {
    return NextResponse.json({ error: 'El periodo está al revés: `desde` es posterior a `hasta`.' }, { status: 400 })
  }

  const clinicRef = adminDb.collection('clinics').doc(clinicId)
  const codificador = new TextEncoder()

  const flujo = new ReadableStream<Uint8Array>({
    async start(controlador) {
      const escribir = (s: string) => controlador.enqueue(codificador.encode(s + '\n'))
      escribir(cabecera())

      let total = 0
      let recortado = false
      try {
        /**
         * El rango va sobre `timestamp`, que es ISO-8601: el orden de la cadena
         * ES el orden cronológico, así que la comparación de texto basta y no
         * hace falta un índice compuesto.
         *
         * `hasta` se cierra con `￿` para incluir el día entero: `<= '2026-08-03'`
         * dejaría fuera todo lo de ese día salvo la medianoche exacta — el error
         * silencioso de siempre en los rangos de fecha sobre marcas ISO.
         */
        let q = clinicRef.collection('audit_log')
          .where('timestamp', '>=', desde)
          .where('timestamp', '<=', `${hasta}￿`)
          .orderBy('timestamp', 'asc')
          .limit(PAGINA)

        let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined
        for (;;) {
          const snap = await (cursor ? q.startAfter(cursor).get() : q.get())
          if (snap.empty) break
          for (const d of snap.docs) {
            // El filtro por paciente va en memoria: combinarlo con el rango
            // exigiría un índice compuesto creado a mano, y mientras no exista
            // la consulta falla ENTERA y no se entrega nada.
            const a = { id: d.id, ...d.data() } as AsientoBitacora
            if (patientId && a.patientId !== patientId) continue
            escribir(fila(a))
            total++
            if (total >= TOPE) { recortado = true; break }
          }
          if (recortado) break
          cursor = snap.docs[snap.docs.length - 1]
          if (snap.size < PAGINA) break
          q = clinicRef.collection('audit_log')
            .where('timestamp', '>=', desde)
            .where('timestamp', '<=', `${hasta}￿`)
            .orderBy('timestamp', 'asc')
            .limit(PAGINA)
        }
      } catch (e) {
        safeLog.error('[cumplimiento/bitacora] lectura', e)
        escribir(`"","ERROR_DE_LECTURA","La descarga se interrumpió: este archivo NO es el rastro completo del periodo.","","","","","",""`)
        controlador.close()
        return
      }

      /**
       * La última línea CIERRA el archivo y declara el alcance.
       *
       * Sin ella, un CSV cortado se ve igual que uno completo. Y en una
       * auditoría, «esto es todo lo que hubo» es justo la afirmación que no se
       * puede hacer a la ligera.
       */
      escribir(`"","_RESUMEN","Periodo ${desde} a ${hasta}${patientId ? ` · paciente ${patientId}` : ''}: ${total} asiento(s).${recortado ? ` SE ALCANZÓ EL TOPE DE ${TOPE}: HAY MÁS QUE NO VIENEN EN ESTE ARCHIVO.` : ''}","","","","","",""`)

      void clinicRef.collection('audit_log').add({
        evento: 'export_datos', clinicId,
        medicoUid: acc.uid, medicoEmail: acc.email ?? '',
        meta: { accion: 'bitacora_csv', desde, hasta, patientId, asientos: total, recortado },
        timestamp: new Date().toISOString(),
      }).catch(() => { /* la bitácora no puede impedir que se entregue la bitácora */ })

      controlador.close()
    },
  })

  return new Response(flujo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bitacora_${desde}_a_${hasta}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
