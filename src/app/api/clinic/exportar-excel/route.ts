/**
 * GET /api/clinic/exportar-excel?clinicId=…
 *
 * EL LIBRO DE EXCEL — una pestaña por dominio, en un solo archivo.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * No existía exportación a Excel. Ninguna. Y `csv-clinico.ts` lo dejó escrito el
 * día que se creó: «una pestaña por dominio es como se piensa esa información, y
 * un CSV por dominio es la versión **sin dependencias nuevas** de esa idea».
 * Esto es la idea entera — y sigue sin dependencias nuevas, porque el escritor
 * de `.xlsx` es nuestro (`lib/xlsx.ts`).
 *
 * Para el consultorio la diferencia es concreta: **una** descarga en vez de
 * seis, y se abre con las pestañas puestas en lugar de tener que pegarlas.
 *
 * ── POR QUÉ ESTA RUTA NO TRANSMITE Y LA DEL CSV SÍ ───────────────────────────
 *
 * Un CSV se puede ir escribiendo fila a fila. Un `.xlsx` es un ZIP: el índice
 * central va al FINAL y necesita el tamaño y el CRC de cada parte, así que el
 * libro se arma entero en memoria. De ahí los topes de abajo — y de ahí que se
 * DECLAREN, en su propia pestaña, en vez de recortar callando.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { DOMINIOS, celdasDe, type Dominio } from '@/lib/clinica/csv-clinico'
import { libroXlsx, TIPO_MIME_XLSX, type Hoja, type Celda } from '@/lib/xlsx'

export const maxDuration = 300

const PAGINA = 300
/** Tope de pacientes recorridos. Si se alcanza, se declara en la pestaña de resumen. */
const TOPE_PACIENTES = 5000
/**
 * Tope de filas POR PESTAÑA.
 *
 * El libro se arma en memoria, así que el techo existe de todas formas: mejor
 * uno elegido y dicho que uno que aparece como un lambda muerto sin explicación.
 * Excel aguanta ~1 048 575 filas; esto es dos órdenes de magnitud por debajo, y
 * el consultorio que lo alcance tiene el respaldo NDJSON completo para lo demás.
 */
const TOPE_FILAS = 50_000

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId) return NextResponse.json({ error: 'clinicId requerido' }, { status: 400 })

  /**
   * `clinico.escribir`: esto vuelca diagnósticos y medicamentos de TODOS los
   * pacientes. NOM-004 los reserva al médico, y el permiso de mostrador no
   * alcanza — ni siquiera para «sólo exportar». Mismo criterio que el CSV: dos
   * respuestas distintas a «¿quién puede llevarse el expediente?» acabarían
   * discrepando, y la puerta más floja sería la que vale.
   */
  const acc = await verificarCapacidad(req, clinicId, 'clinico.escribir')
  if (!acc.ok) return acc.response

  const clinicRef = adminDb.collection('clinics').doc(clinicId)
  const hojas: Hoja[] = []
  const recortes: string[] = []
  const errores: string[] = []
  let totalFilas = 0

  // Los pacientes se leen UNA vez para todos los dominios: son cinco de los seis,
  // y releerlos por dominio multiplicaría por cinco la factura de lecturas.
  let pacientes: FirebaseFirestore.QueryDocumentSnapshot[] = []
  try {
    const snap = await clinicRef.collection('patients').limit(TOPE_PACIENTES).get()
    pacientes = snap.docs
    if (snap.size >= TOPE_PACIENTES) {
      recortes.push(`Se alcanzó el tope de ${TOPE_PACIENTES} pacientes: HAY MÁS QUE NO VIENEN en este archivo.`)
    }
  } catch (e) {
    safeLog.error('[clinic/exportar-excel] pacientes', e)
    return NextResponse.json({ error: 'No se pudieron leer los pacientes.' }, { status: 500 })
  }

  for (const clave of Object.keys(DOMINIOS) as Dominio[]) {
    const def = DOMINIOS[clave]
    const filas: Celda[][] = []
    let topeAlcanzado = false

    const agregar = (celdas: unknown[][]) => {
      for (const f of celdas) {
        if (filas.length >= TOPE_FILAS) { topeAlcanzado = true; return }
        filas.push(f as Celda[])
      }
    }

    try {
      if (def.origen === 'clinica') {
        let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined
        for (;;) {
          let q = clinicRef.collection(def.coleccion).orderBy('__name__').limit(PAGINA)
          if (cursor) q = q.startAfter(cursor)
          const snap = await q.get()
          if (snap.empty) break
          for (const d of snap.docs) agregar(celdasDe(clave, { id: d.id, ...d.data() }, {}))
          cursor = snap.docs[snap.docs.length - 1]
          if (snap.size < PAGINA || topeAlcanzado) break
        }
      } else {
        for (const p of pacientes) {
          if (topeAlcanzado) break
          const ctx = { pacienteNombre: String((p.data() as { nombre?: string }).nombre ?? ''), pacienteId: p.id }
          let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined
          for (;;) {
            let q = p.ref.collection(def.coleccion).orderBy('__name__').limit(PAGINA)
            if (cursor) q = q.startAfter(cursor)
            const snap = await q.get()
            if (snap.empty) break
            for (const d of snap.docs) agregar(celdasDe(clave, { id: d.id, ...d.data() }, ctx))
            cursor = snap.docs[snap.docs.length - 1]
            if (snap.size < PAGINA || topeAlcanzado) break
          }
        }
      }
    } catch (e) {
      /**
       * Un dominio que falla NO tumba el libro entero: se entregan los otros
       * cinco y se dice cuál se quedó fuera. Lo que no se hace nunca es entregar
       * una pestaña corta sin avisar — se leería como «aquí no hay nada».
       */
      safeLog.error(`[clinic/exportar-excel] ${clave}`, e)
      errores.push(`${clave}: la lectura falló, esta pestaña está INCOMPLETA.`)
    }

    if (topeAlcanzado) {
      recortes.push(`${clave}: se alcanzó el tope de ${TOPE_FILAS.toLocaleString('es-MX')} filas por pestaña; hay más que no vienen.`)
    }
    totalFilas += filas.length
    hojas.push({ nombre: clave, cabecera: def.columnas, filas })
  }

  /**
   * LA PESTAÑA QUE DICE QUÉ ES ESTO Y QUÉ LE FALTA.
   *
   * Va la PRIMERA a propósito: un libro que se abre en «consultas» y trae 4 000
   * filas se lee como el consultorio entero, y si se recortó nadie va a buscar
   * la advertencia en la última pestaña. Es la misma lección del `limit` de la
   * consola: un recorte que nadie ve se lee como el total.
   */
  const resumen: Celda[][] = [
    ['Generado', new Date().toISOString()],
    ['Consultorio', clinicId],
    ['Pacientes recorridos', pacientes.length],
    ['Filas totales', totalFilas],
    [],
    ['Qué es esto', 'Los datos clínicos del consultorio para mirarlos, contarlos o dárselos al contador. Una pestaña por dominio.'],
    ['Qué NO es', 'El respaldo completo. Para reconstruir el consultorio está la exportación NDJSON (clinic/exportar); las dos hacen falta y ninguna sustituye a la otra.'],
    [],
    ...(recortes.length
      ? [['⚠ FALTAN DATOS', ''] as Celda[], ...recortes.map(r => ['', r] as Celda[])]
      : [['Alcance', 'Completo: no se alcanzó ningún tope.'] as Celda[]]),
    ...(errores.length
      ? [[], ['⚠ ERRORES DE LECTURA', ''] as Celda[], ...errores.map(e => ['', e] as Celda[])]
      : []),
  ]
  hojas.unshift({ nombre: 'RESUMEN', cabecera: ['Campo', 'Valor'], filas: resumen, anchos: [26, 100] })

  let libro: Uint8Array
  try {
    libro = libroXlsx(hojas)
  } catch (e) {
    safeLog.error('[clinic/exportar-excel] armado', e)
    return NextResponse.json({ error: 'No se pudo armar el libro.' }, { status: 500 })
  }

  void clinicRef.collection('audit_log').add({
    evento: 'export_datos', clinicId,
    medicoUid: acc.uid, medicoEmail: acc.email ?? '',
    meta: { accion: 'excel_clinico', filas: totalFilas, recortado: recortes.length > 0, errores: errores.length },
    timestamp: new Date().toISOString(),
  }).catch(() => { /* la bitácora no puede impedir que el dueño se lleve lo suyo */ })

  return new Response(new Uint8Array(libro), {
    headers: {
      'Content-Type': TIPO_MIME_XLSX,
      'Content-Disposition': `attachment; filename="nexusmed_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
