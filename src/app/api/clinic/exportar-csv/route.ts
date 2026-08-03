/**
 * GET /api/clinic/exportar-csv?clinicId=…&dominio=consultas|diagnosticos|…
 *
 * LA EXPORTACIÓN QUE UN COMPRADOR ABRE.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * La pantalla se llama **Migración** y su exportación son once columnas de
 * demografía. **Cero contenido clínico.** Y el argumento que sostiene esa
 * pantalla es «no te secuestro tus datos»: un competidor abre ese CSV en una
 * demo y gana la reunión sin decir una palabra.
 *
 * ── POR QUÉ NO SUSTITUYE AL RESPALDO ─────────────────────────────────────────
 *
 * `clinic/exportar` da el consultorio entero en NDJSON: sirve para
 * **reconstruir**. Esto es lo otro — lo que se abre en una hoja de cálculo para
 * mirarlo, contarlo o dárselo al contador. Los dos hacen falta.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { DOMINIOS, cabeceraDe, filasDe, type Dominio } from '@/lib/clinica/csv-clinico'

export const maxDuration = 300

const PAGINA = 300
/** Tope de pacientes recorridos por descarga; si se alcanza, se declara. */
const TOPE_PACIENTES = 5000

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  const dominio = req.nextUrl.searchParams.get('dominio') as Dominio | null
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })
  if (!dominio || !(dominio in DOMINIOS)) {
    return NextResponse.json({
      error: `dominio inválido. Los que hay: ${Object.keys(DOMINIOS).join(', ')}.`,
    }, { status: 400 })
  }

  /**
   * `clinico.escribir`: esto vuelca diagnósticos y medicamentos de todos los
   * pacientes. NOM-004 los reserva al médico, y el permiso de mostrador no
   * alcanza — ni siquiera para «sólo exportar».
   */
  const acc = await verificarCapacidad(req, clinicId, 'clinico.escribir')
  if (!acc.ok) return acc.response

  const def = DOMINIOS[dominio]
  const clinicRef = adminDb.collection('clinics').doc(clinicId)
  const codificador = new TextEncoder()

  const flujo = new ReadableStream<Uint8Array>({
    async start(controlador) {
      const escribir = (s: string) => controlador.enqueue(codificador.encode(s + '\n'))
      // BOM: sin él, Excel abre el archivo en Latin-1 y destroza los acentos —
      // «Rodríguez» sale «RodrÃ­guez» en la primera columna que se ve.
      controlador.enqueue(codificador.encode('﻿'))
      escribir(cabeceraDe(dominio))

      let filas = 0
      let recortado = false
      try {
        if (def.origen === 'clinica') {
          let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined
          for (;;) {
            let q = clinicRef.collection(def.coleccion).orderBy('__name__').limit(PAGINA)
            if (cursor) q = q.startAfter(cursor)
            const snap = await q.get()
            if (snap.empty) break
            for (const d of snap.docs) {
              for (const f of filasDe(dominio, { id: d.id, ...d.data() }, {})) { escribir(f); filas++ }
            }
            cursor = snap.docs[snap.docs.length - 1]
            if (snap.size < PAGINA) break
          }
        } else {
          // Por paciente: se necesita su nombre para que la fila se pueda leer
          // sin cruzar identificadores a mano.
          const pacientes = await clinicRef.collection('patients').limit(TOPE_PACIENTES).get()
          if (pacientes.size >= TOPE_PACIENTES) recortado = true
          for (const p of pacientes.docs) {
            const ctx = { pacienteNombre: String((p.data() as { nombre?: string }).nombre ?? ''), pacienteId: p.id }
            let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined
            for (;;) {
              let q = p.ref.collection(def.coleccion).orderBy('__name__').limit(PAGINA)
              if (cursor) q = q.startAfter(cursor)
              const snap = await q.get()
              if (snap.empty) break
              for (const d of snap.docs) {
                for (const f of filasDe(dominio, { id: d.id, ...d.data() }, ctx)) { escribir(f); filas++ }
              }
              cursor = snap.docs[snap.docs.length - 1]
              if (snap.size < PAGINA) break
            }
          }
        }
      } catch (e) {
        safeLog.error(`[clinic/exportar-csv] ${dominio}`, e)
        escribir(`ERROR_DE_LECTURA,"La descarga se interrumpió: este archivo NO está completo."`)
        controlador.close()
        return
      }

      /**
       * La última fila declara el alcance. Sin ella, un CSV cortado se ve igual
       * que uno completo — y quien lo abra contará sobre datos incompletos
       * creyendo que los tiene todos.
       */
      escribir(`_RESUMEN,"${filas} fila(s) de ${dominio}.${recortado ? ` SE ALCANZÓ EL TOPE DE ${TOPE_PACIENTES} PACIENTES: HAY MÁS QUE NO VIENEN.` : ''}"`)

      void clinicRef.collection('audit_log').add({
        evento: 'export_datos', clinicId,
        medicoUid: acc.uid, medicoEmail: acc.email ?? '',
        meta: { accion: 'csv_clinico', dominio, filas, recortado },
        timestamp: new Date().toISOString(),
      }).catch(() => { /* la bitácora no puede impedir que el dueño se lleve lo suyo */ })

      controlador.close()
    },
  })

  return new Response(flujo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${dominio}_${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
