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
import { leerLatidos, diagnosticar, PERIODO_MIN, type Latido } from '@/lib/ops/latido'

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

  /**
   * ── ¿Y QUIÉN VIGILA AL VIGILANTE? ─────────────────────────────────────────
   *
   * `cron/vigilante` mira los latidos de los demás trabajos y avisa por el
   * buzón de operación. Pero tiene un punto ciego que él mismo declara: **si el
   * que se cae es él**, no queda nadie leyendo los latidos. Su propio latido
   * sólo lo consulta él.
   *
   * Y el buzón (`OPS_ALERTA_WEBHOOK`) está sin configurar, así que hoy ni
   * siquiera el camino normal avisa a nadie.
   *
   * La salida no necesita infraestructura nueva: esta franja ya la ve el dueño
   * cada vez que abre la aplicación, y los latidos ya están guardados. Se leen
   * aquí. Si un trabajo automático —el vigilante incluido— lleva demasiado sin
   * correr, se dice donde él ya mira.
   *
   * Sólo `nunca` y `tarde`. Un trabajo que corrió y falló ya se reporta por sus
   * propios medios; lo que nadie más puede contar es el que **dejó de correr**,
   * porque un trabajo muerto no levanta la mano.
   */
  const problemasDeCron: { titulo: string; queHacer: string; urgente: boolean; veces: number }[] = []
  try {
    const latidos = await leerLatidos()
    const porJob = new Map<string, Latido>(latidos.map(l => [l.job, l]))
    const ahora = Date.now()
    const mudos = Object.keys(PERIODO_MIN)
      .map((j: string) => diagnosticar(j, porJob.get(j), ahora))
      .filter(d => d.estado === 'nunca' || d.estado === 'tarde')
    if (mudos.length) {
      problemasDeCron.push({
        titulo: `${mudos.length} trabajo(s) automático(s) dejaron de correr`,
        queHacer: mudos.map(d => `${d.job}: ${d.porQue}`).join(' · ').slice(0, 300),
        urgente: true,
        veces: mudos.length,
      })
    }
  } catch {
    /**
     * Si no se pueden leer los latidos no se inventa un problema NI se calla uno:
     * simplemente esta comprobación no aporta nada esta vez. La franja no puede
     * convertirse en un problema encima del que ya haya.
     */
  }

  return NextResponse.json({
    ok: true,
    horasVigentes: HORAS_VIGENTES,
    urgentes: porTitulo.size + problemasDeCron.length,
    /** Lo NO urgente sigue existiendo — en el tablero, que es su sitio. */
    noUrgentesEnElTablero: vigentes.length - urgentes.length,
    /** Los trabajos caídos van PRIMERO: nada de lo demás corre si ellos no corren. */
    incidentes: [...problemasDeCron, ...porTitulo.values()],
  })
}
