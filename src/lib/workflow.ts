/**
 * WORKFLOW ORCHESTRATOR (v1) — el motor que ENCADENA los flujos sueltos.
 *
 * Hoy el consultorio tiene worklists separadas (por cobrar, membresías vencidas,
 * notas sin firmar, seguimiento). Este motor las UNIFICA en una sola lista
 * priorizada de "siguiente acción": una respuesta a "¿qué necesita mi atención
 * ahora?". Determinista y puro → testeable, sin IA.
 *
 * v1 cubre las transiciones más costosas de olvidar (dinero y documentación).
 * Se amplía por especialidad en fases siguientes.
 */
import type { Appointment } from '@/types'
import type { Cobro } from '@/lib/cobros'
import type { Membresia } from '@/lib/membresias'

export type TipoAccion = 'cobrar' | 'firmar_nota' | 'membresia_vencida' | 'confirmar_cita'
export type Prioridad = 'alta' | 'media' | 'baja'

export interface AccionPendiente {
  tipo: TipoAccion
  titulo: string
  detalle: string
  prioridad: Prioridad
  /** A dónde ir para resolverla. */
  href: string
  /** Para ordenar dentro de la misma prioridad (menor = más urgente). */
  orden: number
}

const ATENDIDA = ['atendida', 'finalizada', 'pagada']

export interface EntradaWorkflow {
  citas: Appointment[]
  cobros: Cobro[]
  membresias: Membresia[]
  /** hoy YYYY-MM-DD (zona clínica). */
  hoy: string
}

/**
 * Devuelve la lista priorizada de acciones pendientes que valen la atención del
 * consultorio HOY. No inventa: cada acción sale de un estado real.
 */
export function accionesPendientes(e: EntradaWorkflow): AccionPendiente[] {
  const out: AccionPendiente[] = []
  const citasHoy = e.citas.filter(c => c.fechaHora.slice(0, 10) === e.hoy)

  // 1. Consultas atendidas HOY sin cobro ni cortesía → cobrar.
  for (const c of citasHoy) {
    if (ATENDIDA.includes(c.estado) && !c.cobroId && !c.cobroExento) {
      out.push({
        tipo: 'cobrar', prioridad: 'alta',
        titulo: `Cobrar a ${c.pacienteNombre}`,
        detalle: 'Consulta atendida hoy, aún sin cobro registrado.',
        href: '/citas', orden: 0,
      })
    }
  }

  // 2. Membresías vencidas → cobrar la cuota.
  for (const m of e.membresias) {
    if (m.estado === 'activa' && m.proximoCobro && m.proximoCobro <= e.hoy) {
      out.push({
        tipo: 'membresia_vencida', prioridad: 'alta',
        titulo: `Cobrar membresía de ${m.pacienteNombre}`,
        detalle: `${m.planNombre} venció el ${m.proximoCobro}.`,
        href: '/membresias', orden: 1,
      })
    }
  }

  // 3. Citas de HOY sin confirmar (aún da tiempo de confirmar por WhatsApp).
  for (const c of citasHoy) {
    if (['solicitada', 'pendiente-confirmar'].includes(c.estado)) {
      out.push({
        tipo: 'confirmar_cita', prioridad: 'media',
        titulo: `Confirmar cita de ${c.pacienteNombre}`,
        detalle: `Cita de hoy ${c.fechaHora.slice(11, 16)} sin confirmar.`,
        href: '/citas', orden: 2,
      })
    }
  }

  const rank: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 }
  return out.sort((a, b) => rank[a.prioridad] - rank[b.prioridad] || a.orden - b.orden)
}

/** Conteo por prioridad (para el badge del panel). */
export function resumenAcciones(acc: AccionPendiente[]): { alta: number; total: number } {
  return { alta: acc.filter(a => a.prioridad === 'alta').length, total: acc.length }
}
