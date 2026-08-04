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

  return NextResponse.json({
    ok: true,
    horasVigentes: HORAS_VIGENTES,
    urgentes: vigentes.filter(i => i.urgente === true).length,
    incidentes: vigentes.map(i => ({
      titulo: i.titulo, queHacer: i.queHacer, urgente: i.urgente === true,
      proveedor: i.proveedor, clase: i.clase, veces: i.veces, hora: i.hora,
    })),
  })
}
