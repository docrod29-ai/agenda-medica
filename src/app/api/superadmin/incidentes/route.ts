/**
 * INCIDENCIAS DE IA, LIGERAS — para el aviso que sigue al dueño por la app.
 *
 * ── POR QUÉ NO SE REUSA `/api/superadmin/costos` ─────────────────────────────
 *
 * Porque ese tablero resume el libro de costos entero, consulta Stripe y pide
 * los saldos de los proveedores. Está bien para una pantalla que se abre cinco
 * veces al día; llamarlo en cada carga de la app para pintar una franja sería
 * pagar un tablero completo para saber una sola cosa.
 *
 * Aquí sólo se leen las incidencias recientes y se responde lo mínimo.
 *
 * ── CERO PHI ─────────────────────────────────────────────────────────────────
 *
 * Lo que devuelve ya venía sin nada clínico desde `incidentes-servidor.ts`:
 * proveedor, clase de fallo, qué función lo sufrió y cuántas veces.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarSuperadmin } from '@/lib/superadmin'
import { incidentesRecientes } from '@/lib/ia/incidentes-servidor'

export const runtime = 'nodejs'

/**
 * Cuánto hacia atrás cuenta como «ahora mismo».
 *
 * Seis horas: lo bastante para que una caída de la mañana siga avisando después
 * de comer, y lo bastante corto para que la franja no se quede puesta días
 * después de algo ya resuelto. Un aviso que no se apaga deja de ser un aviso.
 */
const HORAS_VIGENTES = 6

export async function GET(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response

  const todos = await incidentesRecientes(20)
  const corte = new Date(Date.now() - HORAS_VIGENTES * 3600_000).toISOString().slice(0, 13)
  const vigentes = todos.filter(i => String(i.hora ?? '') >= corte)

  /**
   * ── SÓLO LO QUE EXIGE QUE EL DUEÑO HAGA ALGO ────────────────────────────
   *
   * La primera versión enseñaba TODO lo de las últimas horas, y el 4-ago-2026
   * el Dr. lo vio en su pantalla: tres líneas del mismo aviso —«Claude tardó
   * demasiado»— ocupando el ancho completo por encima de su lista de pacientes.
   *
   * Un timeout, una saturación o un límite de tasa **se resuelven solos** y no
   * hay nada que él pueda hacer: eso es información de tablero, no una franja
   * sobre su trabajo. Lo urgente es otra cosa — la llave rechazada o la cuenta
   * sin saldo — porque ahí la IA está caída para TODOS sus clientes y hasta que
   * él entre a Vercel no se arregla.
   *
   * Es exactamente la fatiga de alerta que se reparó esa misma mañana en la
   * compuerta de dosis (REG-141), reintroducida aquí por mí. Un aviso que salta
   * donde no debe se acaba ignorando, y con él se ignoran los que sí importan.
   */
  const urgentes = vigentes.filter(i => i.urgente === true)

  /**
   * Y UNA SOLA LÍNEA POR PROBLEMA.
   *
   * Las incidencias se agrupan por HORA, así que una caída de tres horas son
   * tres documentos idénticos. Enseñarlos como tres avisos hace ver tres
   * problemas donde hay uno, y multiplica el ruido justo cuando más estorba.
   */
  const porTitulo = new Map<string, { titulo: string; queHacer: string; urgente: boolean; veces: number }>()
  for (const i of urgentes) {
    const clave = String(i.titulo ?? '')
    const y = porTitulo.get(clave)
    const veces = Number(i.veces ?? 1) || 1
    if (y) { y.veces += veces; continue }
    porTitulo.set(clave, {
      titulo: clave, queHacer: String(i.queHacer ?? ''), urgente: true, veces,
    })
  }

  return NextResponse.json({
    ok: true,
    horasVigentes: HORAS_VIGENTES,
    urgentes: porTitulo.size,
    /** Lo NO urgente sigue existiendo — en el tablero, que es su sitio. */
    noUrgentesEnElTablero: vigentes.length - urgentes.length,
    incidentes: [...porTitulo.values()],
  })
}
