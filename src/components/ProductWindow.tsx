/**
 * ProductWindow — mockup FIEL de la interfaz de NexusMED para la landing/tiendas.
 *
 * No es una captura (real ni falsa): se construye con los MISMOS tokens del
 * design system y datos FICTICIOS (pacientes por iniciales, reutilizados del
 * sandbox), de modo que representa el producto con honestidad. Componente puro
 * (sin hooks, sin red) → sirve en server o client y se puede renderizar a HTML
 * en pruebas.
 */
import { Calendar, Users, Stethoscope, FileText, CreditCard, Mic, CheckCircle2 } from 'lucide-react'
import { DEMO_ESCENARIOS } from '@/lib/demo-sandbox'

const NAV = [
  { icon: Calendar, label: 'Agenda', activo: true },
  { icon: Users, label: 'Pacientes' },
  { icon: Stethoscope, label: 'Consulta' },
  { icon: FileText, label: 'Recetas' },
  { icon: CreditCard, label: 'Finanzas' },
]

export function ProductWindow() {
  return (
    <div
      role="img"
      aria-label="Vista del producto NexusMED: agenda del día y nota de consulta (interfaz de ejemplo con datos ficticios)"
      style={{
        background: 'var(--s1)', border: '1px solid var(--border2)', borderRadius: 16,
        overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.45)', width: '100%',
      }}
    >
      {/* Barra de ventana */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--s2)' }}>
        <span style={{ width: 11, height: 11, borderRadius: 100, background: '#ff5f57' }} />
        <span style={{ width: 11, height: 11, borderRadius: 100, background: '#febc2e' }} />
        <span style={{ width: 11, height: 11, borderRadius: 100, background: '#28c840' }} />
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11.5, color: 'var(--text3)', fontFamily: 'var(--font-mono, monospace)' }}>
          app.nexusmed · Agenda
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr', minHeight: 320 }} className="nx-pw-body">
        {/* Sidebar */}
        <div style={{ borderRight: '1px solid var(--border)', padding: '14px 10px', background: 'var(--bg)' }} className="nx-pw-side">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 14px' }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--nexus)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, border: '2px solid #0B0C0E' }} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>NexusMED</span>
          </div>
          {NAV.map(n => (
            <div key={n.label} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '8px 8px', borderRadius: 8, marginBottom: 2,
              fontSize: 12.5, fontWeight: n.activo ? 700 : 500,
              color: n.activo ? 'var(--nexus)' : 'var(--text3)',
              background: n.activo ? 'var(--nexus-soft)' : 'transparent',
            }}>
              <n.icon size={15} /> {n.label}
            </div>
          ))}
        </div>

        {/* Contenido: agenda del día + tarjeta de nota */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Hoy · lunes 14 de julio</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{DEMO_ESCENARIOS.length + 1} citas</div>
          </div>

          {/* Citas (ficticias, por iniciales) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {DEMO_ESCENARIOS.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 9, background: 'var(--s2)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', width: 40 }}>{e.cita.hora}</span>
                <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: e.cita.color }} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>Paciente {e.cita.iniciales}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{e.cita.motivo}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 9, background: 'var(--s2)', border: '1px solid var(--border)', opacity: 0.65 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', width: 40 }}>12:00</span>
              <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: '#d97706' }} />
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>Paciente A. R.</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Control</span>
            </div>
          </div>

          {/* Tarjeta de nota por voz en curso */}
          <div style={{ marginTop: 'auto', padding: 12, borderRadius: 10, background: 'var(--nexus-soft)', border: '1px solid var(--border2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--nexus)' }}>
                <Mic size={13} /> Nota por voz
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#16a34a', marginLeft: 'auto' }}>
                <CheckCircle2 size={13} /> Lista para firmar
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 }}>
              Femenino de 54 años en control de HTA. Buen apego; TA 138/84. Continuar losartán…
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
