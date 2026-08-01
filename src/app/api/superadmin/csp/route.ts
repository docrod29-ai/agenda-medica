/**
 * GET /api/superadmin/csp
 *
 * El estado de la observación de la CSP: qué se saldría de la política, cuántas
 * veces, y si ya se puede pasar a bloquear de verdad.
 *
 * Antes esta pregunta no tenía respuesta posible. Los reportes se escribían en
 * el log del servidor —que nadie lee y que caduca—, así que la «semana de
 * observación» no podía terminar nunca y la política se quedaba en modo aviso
 * indefinidamente. Ahora se acumulan (ver `/api/csp-report`) y esto los lee.
 *
 * Sólo el dueño de la plataforma. No hay PHI aquí —la colección guarda
 * directivas, orígenes y contadores— pero sí dice qué recursos externos usa la
 * aplicación, que es información de seguridad.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarSuperadmin } from '@/lib/superadmin'
import { safeLog } from '@/lib/security/sanitize'
import { veredictoEnforce, DIAS_MINIMOS_DE_OBSERVACION } from '@/lib/security/csp-observacion'

export const runtime = 'nodejs'

interface Fila {
  directiva: string
  bloqueado: string
  pagina: string
  dia: string
  veces: number
  ultimaVez: string
}

export async function GET(req: NextRequest) {
  const acceso = await verificarSuperadmin(req)
  if (!acceso.ok) return acceso.response

  try {
    /**
     * Se leen como mucho 500 grupos. La colección está acotada por diseño
     * (violaciones distintas por día, no reportes), así que 500 es de sobra
     * — y si algún día no lo fuera, un tablero que tarda un minuto no se mira.
     */
    const snap = await adminDb.collection('platform_csp').limit(500).get()
    const filas: Fila[] = snap.docs.map(d => {
      const x = d.data() as Partial<Fila>
      return {
        directiva: String(x.directiva ?? '?'),
        bloqueado: String(x.bloqueado ?? '?'),
        pagina: String(x.pagina ?? ''),
        dia: String(x.dia ?? ''),
        veces: Number(x.veces ?? 0),
        ultimaVez: String(x.ultimaVez ?? ''),
      }
    })

    const dias = new Set(filas.map(f => f.dia).filter(Boolean))
    const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
    const recientes = filas.filter(f => f.dia >= hace7)
    const violacionesRecientes = recientes.reduce((s, f) => s + f.veces, 0)

    /**
     * El modo REAL, leído del entorno — no el que uno cree que está puesto.
     *
     * Es la clase de cosa que se supone y se supone mal: alguien pone la
     * variable en un entorno y no en el otro, y el tablero de producción enseña
     * el estado de vista previa.
     */
    const modo = (process.env.CSP_MODE ?? '').trim() === 'enforce' ? 'enforce' : 'aviso'

    return NextResponse.json({
      ok: true,
      modo,
      diasObservados: dias.size,
      diasMinimos: DIAS_MINIMOS_DE_OBSERVACION,
      violacionesRecientes,
      // Lo más frecuente primero: es lo que hay que resolver o permitir.
      grupos: filas.sort((a, b) => b.veces - a.veces).slice(0, 100),
      veredicto: veredictoEnforce(dias.size, violacionesRecientes),
    })
  } catch (e) {
    safeLog.error('[superadmin/csp]', String(e).slice(0, 200))
    /**
     * Un fallo de LECTURA no puede verse igual que «no hay violaciones»: lo
     * segundo se lee como luz verde para bloquear, y bloquear con esa
     * información equivocada rompe pantallas en producción.
     */
    return NextResponse.json({ ok: false, error: 'No se pudo leer la observación de la CSP.' }, { status: 500 })
  }
}
