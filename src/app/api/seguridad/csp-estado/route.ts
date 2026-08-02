/**
 * GET /api/seguridad/csp-estado
 *
 * ¿YA SE PUEDE PONER LA CSP A BLOQUEAR DE VERDAD?
 *
 * ── EL HUECO QUE ESTO CIERRA ─────────────────────────────────────────────────
 *
 * La política va en **report-only**: el navegador avisa de lo que bloquearía,
 * pero no bloquea nada. Pasarla a `enforce` es una variable de entorno
 * (`CSP_MODE=enforce`) y `lib/security/csp-observacion.ts` tiene escrito y
 * probado el criterio para decidirlo — `veredictoEnforce`: siete días de
 * observación y cero violaciones recientes.
 *
 * Pero **nadie leía los reportes**. Se acumulaban en `platform_csp` y no había
 * una sola pantalla que dijera cuántos días llevan ni cuántas violaciones hay,
 * así que el veredicto no se podía consultar y la decisión no se podía tomar.
 * Un criterio que nadie puede consultar no es un criterio: es un comentario.
 *
 * ── LO QUE NO DEVUELVE ───────────────────────────────────────────────────────
 *
 * Ni direcciones completas ni nada del paciente: el buzón guarda a propósito
 * sólo la ruta recortada, porque en esta aplicación la URL **es** dato sensible
 * (el portal lleva el token en la dirección y el expediente el id del paciente).
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { adminDb } from '@/lib/firebase-admin'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { COLECCION_CSP } from '@/app/api/csp-report/route'
import { veredictoEnforce, DIAS_MINIMOS_DE_OBSERVACION } from '@/lib/security/csp-observacion'

export const runtime = 'nodejs'

/** Día ISO (`YYYY-MM-DD`) N días antes de hoy, en UTC — igual que el buzón. */
function diaMenos(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId') ?? ''
  // `administrar`: decide una postura de seguridad de toda la instalación, no es
  // información de un paciente.
  const acc = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acc.ok) return acc.response

  try {
    const snap = await adminDb.collection(COLECCION_CSP).get()
    const docs = snap.docs.map(d => d.data() as {
      directiva?: string; bloqueado?: string; pagina?: string; dia?: string; veces?: number
    })

    if (docs.length === 0) {
      /**
       * SIN NINGÚN REPORTE NO SE AFIRMA QUE TODO ESTÉ BIEN.
       *
       * Cero reportes puede significar dos cosas opuestas: que la política no
       * choca con nada, o que el buzón no está recibiendo (cabecera mal puesta,
       * navegador que no reporta, ruta caída). Decir «listo para bloquear» con
       * cero datos sería el mismo error que un contador en cero leído como
       * «no falta nada».
       */
      return NextResponse.json({
        ok: true, hayDatos: false,
        veredicto: { listo: false, motivo: 'Todavía no ha llegado ningún reporte. Cero reportes no es lo mismo que cero problemas: puede que el buzón no esté recibiendo. Revisa que la cabecera salga en producción antes de decidir.' },
        diasObservados: 0, violaciones7d: 0, modo: process.env.CSP_MODE === 'enforce' ? 'enforce' : 'report-only',
        top: [],
      })
    }

    const dias = [...new Set(docs.map(d => String(d.dia ?? '')).filter(Boolean))].sort()
    const primerDia = dias[0] ?? ''
    const diasObservados = primerDia
      ? Math.floor((Date.parse(diaMenos(0)) - Date.parse(primerDia)) / 86_400_000) + 1
      : 0

    const corte = diaMenos(7)
    const recientes = docs.filter(d => String(d.dia ?? '') >= corte)
    const violaciones7d = recientes.reduce((s, d) => s + Number(d.veces ?? 0), 0)

    // Lo que más choca, para poder arreglarlo en vez de sólo esperar.
    const porDirectiva = new Map<string, number>()
    for (const d of docs) {
      const k = `${d.directiva ?? '?'} · ${d.bloqueado ?? '?'}`
      porDirectiva.set(k, (porDirectiva.get(k) ?? 0) + Number(d.veces ?? 0))
    }
    const top = [...porDirectiva.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([que, veces]) => ({ que, veces }))

    return NextResponse.json({
      ok: true, hayDatos: true,
      veredicto: veredictoEnforce(diasObservados, violaciones7d),
      diasObservados, violaciones7d, diasMinimos: DIAS_MINIMOS_DE_OBSERVACION,
      modo: process.env.CSP_MODE === 'enforce' ? 'enforce' : 'report-only',
      top,
    })
  } catch (e) {
    safeLog.error('[seguridad/csp-estado]', e)
    return NextResponse.json({ ok: false, error: 'No se pudo leer el estado de la CSP.' }, { status: 500 })
  }
}
