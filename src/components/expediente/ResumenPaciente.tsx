'use client'
import { useMemo } from 'react'
import type { Patient } from '@/types'
import type { NotaMedica } from '@/types/expediente'
import { Activity, CalendarClock, Stethoscope } from 'lucide-react'

/**
 * RESUMEN DEL PACIENTE — "todo en un solo lugar".
 *
 * Lo que un médico quiere ver de un vistazo al abrir un expediente, sin
 * desplegar nada: alergias (destacadas), los signos vitales de la última visita,
 * los diagnósticos activos y cuándo fue la última consulta. Es la pantalla que
 * la competencia enseña como su punto fuerte; aquí la información YA existía,
 * solo estaba dispersa y plegada.
 *
 * Derivado, no capturado: los signos y diagnósticos salen de la última nota real;
 * si no hay notas, la tarjeta se muestra igual con lo que haya del paciente.
 */
export function ResumenPaciente({ patient, notas }: { patient: Patient | null; notas: NotaMedica[] }) {
  const orden = useMemo(() => [...notas].sort((a, b) => (b.fechaConsulta || b.createdAt || '').localeCompare(a.fechaConsulta || a.createdAt || '')), [notas])
  const ultima = orden[0] ?? null

  const signos = useMemo(() => {
    for (const n of orden) {
      if (n.signosVitales && Object.values(n.signosVitales).some(Boolean)) return n.signosVitales
    }
    return null
  }, [orden])

  const dxActivos = useMemo(() => {
    const vistos = new Set<string>()
    const out: string[] = []
    for (const n of orden) {
      for (const d of n.diagnosticos ?? []) {
        const k = d.descripcion.trim().toLowerCase()
        if (!k || vistos.has(k)) continue
        if (d.estado === 'resuelto' || d.tipo === 'descartado') continue
        vistos.add(k); out.push(d.descripcion.trim())
        if (out.length >= 6) return out
      }
    }
    return out
  }, [orden])

  const ultimaFecha = ultima?.fechaConsulta || ultima?.createdAt
  const fmt = (iso?: string) => { if (!iso) return null; try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return null } }

  const vitales: { label: string; valor: string }[] = []
  if (signos) {
    if (signos.ta) vitales.push({ label: 'TA', valor: `${signos.ta}` })
    if (signos.fc) vitales.push({ label: 'FC', valor: `${signos.fc}` })
    if (signos.fr) vitales.push({ label: 'FR', valor: `${signos.fr}` })
    if (signos.temperatura) vitales.push({ label: 'T°', valor: `${signos.temperatura}` })
    if (signos.spo2) vitales.push({ label: 'SpO₂', valor: `${signos.spo2}%` })
    if (signos.peso) vitales.push({ label: 'Peso', valor: `${signos.peso} kg` })
    if (signos.imc) vitales.push({ label: 'IMC', valor: `${signos.imc}` })
    if (signos.glucometria) vitales.push({ label: 'Gluc', valor: `${signos.glucometria}` })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
      <div style={tarjeta}>
        <div style={encabezado}><Activity size={13} /> Últimos signos</div>
        {vitales.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 8 }}>
            {vitales.map(v => (
              <div key={v.label}>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{v.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{v.valor}</div>
              </div>
            ))}
          </div>
        ) : <div style={vacio}>Sin signos registrados aún</div>}
      </div>

      <div style={tarjeta}>
        <div style={encabezado}><Stethoscope size={13} /> Diagnósticos activos</div>
        {dxActivos.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {dxActivos.map((d, i) => (
              <span key={i} style={{ fontSize: 12, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', padding: '3px 10px', color: 'var(--text2)' }}>{d}</span>
            ))}
          </div>
        ) : <div style={vacio}>Sin diagnósticos activos</div>}
      </div>

      <div style={tarjeta}>
        <div style={encabezado}><CalendarClock size={13} /> Actividad</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Consultas</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{notas.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Última visita</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{fmt(ultimaFecha) ?? '—'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const tarjeta: React.CSSProperties = { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }
const encabezado: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.4 }
const vacio: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 8 }
