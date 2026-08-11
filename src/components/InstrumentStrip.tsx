'use client'
/**
 * INSTRUMENT STRIP — V15-SHELL-GREYBOX-001, Capa 1.
 *
 * V15 §5 la define como «estado periférico persistente»: paciente actual,
 * estado de encuentro, grabación activa, sync/autoguardado, consultorio.
 * Advierte explícitamente: «no debe volverse una segunda barra de navegación».
 *
 * ── ALCANCE DE ESTA CORRIDA ──────────────────────────────────────────────────
 *
 * Se implementan las dos señales que YA existen como fuente de verdad y no
 * requieren inventar un concepto nuevo:
 *
 *   - consultorio activo (mismo dato que ya pinta `Sidebar`/`FlowRail`);
 *   - grabación activa, releyendo el MISMO evento `EVENTO_GRABANDO` que ya
 *     escucha `MarcoEscuchando` — no es una segunda fuente de verdad, es la
 *     misma señal PINTADA distinto (el marco perimetral es la advertencia
 *     ambiental; esta franja es la confirmación textual con hora transcurrida).
 *
 * Paciente actual / última novedad quedan para V15-PATIENT-WORKSPACE-001
 * (Fase 4): pintarlos aquí ahora exigiría o inventar un selector nuevo o leer
 * PHI fuera del componente que ya lo hace con permisos verificados, y el
 * routine prohíbe cambiar lógica clínica/negocio en esta fase. Se anota como
 * pendiente explícito, no se rellena con un placeholder que aparente estar
 * completo.
 */
import { useEffect, useState } from 'react'
import { Circle } from 'lucide-react'
import { useConfig } from '@/hooks/useConfig'
import { EVENTO_GRABANDO, type DetalleDeEscucha } from '@/lib/seguridad/estoy-grabando'

function useSegundosGrabando(): number | null {
  const [segundos, setSegundos] = useState<number | null>(null)
  useEffect(() => {
    let inicio: number | null = null
    let intervalo: ReturnType<typeof setInterval> | null = null
    const detener = () => { if (intervalo != null) { clearInterval(intervalo); intervalo = null } }
    const alSonar = (ev: Event) => {
      const d = (ev as CustomEvent<DetalleDeEscucha>).detail
      if (!d || typeof d.activo !== 'boolean') return
      if (!d.activo) { inicio = null; detener(); setSegundos(null); return }
      if (inicio != null) return   // ya estaba contando; el latido de EVENTO_GRABANDO no reinicia
      inicio = performance.now()
      setSegundos(0)
      intervalo = setInterval(() => {
        setSegundos(Math.max(0, Math.round((performance.now() - (inicio as number)) / 1000)))
      }, 1000)
    }
    window.addEventListener(EVENTO_GRABANDO, alSonar)
    return () => { window.removeEventListener(EVENTO_GRABANDO, alSonar); detener() }
  }, [])
  return segundos
}

function formatearDuracion(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function InstrumentStrip() {
  const { config } = useConfig()
  const segundos = useSegundosGrabando()

  return (
    <div
      role="status"
      aria-label="Estado clínico y de sistema"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, minHeight: 30,
        padding: '5px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--s1)', fontSize: 12, color: 'var(--text3)',
      }}
      className="nx-instrument-strip"
    >
      <span style={{ fontWeight: 600, color: 'var(--text2)' }}>
        {config.nombreClinica || 'Ausculta'}
      </span>
      {segundos != null && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text)', fontWeight: 600 }}>
          <Circle size={8} fill="currentColor" style={{ animation: 'pulse 1.6s ease-in-out infinite' }} />
          Grabando · {formatearDuracion(segundos)}
        </span>
      )}
    </div>
  )
}
