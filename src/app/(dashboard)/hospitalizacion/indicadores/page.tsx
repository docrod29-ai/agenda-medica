'use client'
// ══════════════════════════════════════════════════════════════
// Tablero de indicadores hospitalarios (Administración).
// Ocupación, estancia media, egresos por tipo, distribución por servicio.
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSmartBack } from '@/hooks/useSmartBack'
import { useClinic } from '@/context/ClinicContext'
import { getInternamientos } from '@/lib/hospital/firestore'
import { diasEstancia, TIPO_EGRESO_LABEL, type Internamiento } from '@/types/hospital'
import { Spinner } from '@/components/ui'
import { ArrowLeft, BarChart3 } from 'lucide-react'

function Kpi({ valor, label, color = 'var(--nexus,#3d5afe)' }: { valor: string | number; label: string; color?: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default function IndicadoresPage() {
  const router = useRouter()
  const volver = useSmartBack('/hospitalizacion')
  const { clinicId } = useClinic()
  const [todos, setTodos] = useState<Internamiento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicId) return
    getInternamientos(clinicId).then(setTodos).catch(() => {}).finally(() => setLoading(false))
  }, [clinicId])

  const m = useMemo(() => {
    const activos = todos.filter(i => i.estado === 'activo')
    const egresados = todos.filter(i => i.estado === 'egresado')
    // Estancia media SOLO sobre egresados (los activos aún no terminan su estancia
    // → mezclarlos daba un promedio que cambiaba solo cada día).
    const estMedia = egresados.length ? Math.round(egresados.reduce((s, i) => s + diasEstancia(i), 0) / egresados.length * 10) / 10 : 0
    // por servicio (activos)
    const servicio = new Map<string, number>()
    for (const i of activos) servicio.set(i.servicio || 'Otro', (servicio.get(i.servicio || 'Otro') ?? 0) + 1)
    // egresos por tipo
    const egreso = new Map<string, number>()
    for (const i of egresados) if (i.tipoEgreso) egreso.set(i.tipoEgreso, (egreso.get(i.tipoEgreso) ?? 0) + 1)
    return {
      activos: activos.length, egresados: egresados.length, estMedia,
      servicio: [...servicio.entries()].sort((a, b) => b[1] - a[1]),
      egreso: [...egreso.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [todos])

  const maxServ = Math.max(1, ...m.servicio.map(s => s[1]))

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '8px 4px 40px' }}>
      <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
        <ArrowLeft size={15} /> Atrás
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <BarChart3 size={22} style={{ color: 'var(--nexus,#3d5afe)' }} /> Indicadores hospitalarios
      </h1>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div> : (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          <Kpi valor={m.activos} label="Internados ahora" color="var(--teal)" />
          <Kpi valor={m.estMedia} label="Estancia media (días)" />
          <Kpi valor={m.egresados} label="Egresos (histórico)" color="var(--amber)" />
          <Kpi valor={todos.length} label="Episodios totales" color="var(--purple)" />
        </div>

        {/* Ocupación por servicio */}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>Ocupación por servicio</div>
        {m.servicio.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sin pacientes internados.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {m.servicio.map(([s, n]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text2)', width: 200, flexShrink: 0 }}>{s}</span>
                <div style={{ flex: 1, height: 22, borderRadius: 6, background: 'var(--s2)', overflow: 'hidden' }}>
                  <div style={{ width: `${(n / maxServ) * 100}%`, height: '100%', background: 'var(--nexus,#3d5afe)', display: 'flex', alignItems: 'center', paddingLeft: 8, color: '#fff', fontSize: 11, fontWeight: 700 }}>{n}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Egresos por tipo */}
        {m.egreso.length > 0 && (<>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>Egresos por tipo</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {m.egreso.map(([t, n]) => (
              <span key={t} style={{ fontSize: 12.5, padding: '6px 12px', borderRadius: 100, background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>{TIPO_EGRESO_LABEL[t as keyof typeof TIPO_EGRESO_LABEL] ?? t}: <strong>{n}</strong></span>
            ))}
          </div>
        </>)}
      </>)}
    </div>
  )
}
