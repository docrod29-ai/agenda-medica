'use client'
/**
 * PANEL "SIGUIENTE ACCIÓN" — la cara del Workflow Orchestrator en el dashboard.
 * Unifica en una sola lista lo que necesita atención hoy (cobros pendientes,
 * membresías vencidas, citas por confirmar), priorizado. Se auto-carga.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useClinic } from '@/context/ClinicContext'
import { useAppointments } from '@/hooks/useAppointments'
import { hoyISO } from '@/lib/timezone'
import { listarCobros } from '@/lib/cobros'
import { listarMembresias, type Membresia } from '@/lib/membresias'
import { accionesPendientes, resumenAcciones, type Prioridad } from '@/lib/workflow'
import type { Cobro } from '@/lib/cobros'
import { ListChecks, ArrowRight, CircleAlert } from 'lucide-react'

const COLOR: Record<Prioridad, string> = { alta: 'var(--red)', media: 'var(--amber)', baja: 'var(--text3)' }

export function PanelPendientes() {
  const { clinicId } = useClinic()
  const hoy = hoyISO()
  const { appointments } = useAppointments(`${hoy} 00:00`)
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [membresias, setMembresias] = useState<Membresia[]>([])

  useEffect(() => {
    if (!clinicId) return
    listarCobros(clinicId, hoy, hoy).then(setCobros).catch(() => {})
    listarMembresias(clinicId).then(setMembresias).catch(() => {})
  }, [clinicId, hoy])

  const acciones = useMemo(
    () => accionesPendientes({ citas: appointments, cobros, membresias, hoy }),
    [appointments, cobros, membresias, hoy],
  )
  const r = resumenAcciones(acciones)
  if (acciones.length === 0) return null

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--panel, var(--s1))', padding: '16px 18px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <ListChecks size={16} style={{ color: 'var(--nexus, #3D5AFE)' }} />
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Siguiente acción</h2>
        {r.alta > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)' }}>
            {r.alta} urgente{r.alta > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {acciones.slice(0, 8).map((a, i) => (
          <Link key={i} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)', textDecoration: 'none' }}>
            <CircleAlert size={14} style={{ color: COLOR[a.prioridad], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.titulo}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{a.detalle}</div>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
          </Link>
        ))}
      </div>
      {acciones.length > 8 && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>+{acciones.length - 8} más</div>}
    </div>
  )
}
