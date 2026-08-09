'use client'
/**
 * DEMOSTRACIÓN PÚBLICA DEL WORKFLOW ORCHESTRATOR — sembrada, determinista.
 *
 * Igual que /demo/razonamiento respalda al Clinical Reasoning Engine, esto respalda
 * al Workflow Orchestrator: un consultorio ficticio con estados REALES (una consulta
 * atendida sin cobro, una membresía vencida, una cita sin confirmar) pasa por el
 * MISMO motor puro (`accionesPendientes`) que corre en el dashboard, y sale la lista
 * priorizada. No inventa: cada renglón proviene de un estado; lo que ya está cobrado
 * NO aparece (se incluye a propósito para probar que filtra de verdad).
 */
import type { Appointment } from '@/types'
import type { Membresia } from '@/lib/membresias'
import { accionesPendientes, resumenAcciones, type Prioridad } from '@/lib/workflow'
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'

const COLOR: Record<Prioridad, string> = { alta: 'var(--red, #DC2626)', media: 'var(--amber, #B45309)', baja: 'var(--text3)' }
const ETIQUETA: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function ayerISO(): string {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DemoWorkflow() {
  const hoy = hoyISO()

  // Consultorio ficticio: solo los campos que el motor realmente lee.
  const citas = [
    { pacienteNombre: 'Laura Méndez', fechaHora: `${hoy} 09:30`, estado: 'atendida', cobroId: undefined, cobroExento: false },
    { pacienteNombre: 'Jorge Salinas', fechaHora: `${hoy} 12:00`, estado: 'solicitada' },
    // Este YA está cobrado → el motor NO debe listarlo (prueba de que filtra de verdad).
    { pacienteNombre: 'Ana Torres', fechaHora: `${hoy} 08:00`, estado: 'atendida', cobroId: 'cob_123' },
  ] as unknown as Appointment[]

  const membresias = [
    { pacienteNombre: 'Roberto Gil', planNombre: 'Plan Mensual', estado: 'activa', proximoCobro: ayerISO() },
  ] as unknown as Membresia[]

  const acciones = accionesPendientes({ citas, cobros: [], membresias, hoy })
  const { alta, total } = resumenAcciones(acciones)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--s1, rgba(127,127,127,.03))', padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Siguiente acción</h3>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--red, #DC2626)', background: 'color-mix(in srgb, var(--red) 12%, transparent)', padding: '3px 9px', borderRadius: 'var(--r-pill)' }}>{alta} urgentes</span>
        <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>· {total} pendientes hoy</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '2px 0 12px', lineHeight: 1.5 }}>
        Consultorio ficticio, mismo motor que el dashboard. Lo ya cobrado no aparece.
      </p>

      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
        {acciones.map((a, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid var(--border)', borderLeft: `3px solid ${COLOR[a.prioridad]}`, borderRadius: 9, background: 'var(--bg)', padding: '10px 12px' }}>
            <AlertCircle size={16} style={{ color: COLOR[a.prioridad], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{a.titulo}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{a.detalle}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.02em', color: COLOR[a.prioridad], border: `1px solid ${COLOR[a.prioridad]}`, borderRadius: 'var(--r-pill)', padding: '2px 8px', whiteSpace: 'nowrap' }}>{ETIQUETA[a.prioridad]}</span>
            <ArrowRight size={15} style={{ color: 'var(--text3)', flexShrink: 0 }} />
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--teal)', marginTop: 10 }}>
        <CheckCircle2 size={13} /> El cobro de Ana Torres (ya registrado) se omitió correctamente.
      </div>
    </div>
  )
}
