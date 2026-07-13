import Link from 'next/link'
import { PLANES, RECARGA, MOTORES, precioAnual, type PlanCreditos } from '@/lib/planes-ia'

export const metadata = {
  title: 'Precios · NexusMED',
  description: 'Planes de NexusMED por créditos: agenda, notas clínicas con IA, evidencia con citas y revisión de seguridad clínica. Precios en pesos.',
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
      <path d="M20 6L9 17l-5-5" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Card({ plan }: { plan: PlanCreditos }) {
  const destacado = plan.destacado
  return (
    <div style={{
      position: 'relative', flex: '1 1 300px', maxWidth: 380, background: 'var(--s1, #fff)',
      border: '1px solid ' + (destacado ? 'var(--nexus, #3d5afe)' : 'var(--border, #e5e7eb)'),
      borderRadius: 18, padding: '26px 24px',
      boxShadow: destacado ? '0 12px 40px rgba(61,90,254,0.14)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {destacado && (
        <div style={{
          position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--nexus, #3d5afe)', color: '#fff', fontSize: 12, fontWeight: 700,
          padding: '4px 14px', borderRadius: 100, letterSpacing: 0.3,
        }}>Más popular</div>
      )}
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text, #0f172a)' }}>{plan.nombre}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
        <span style={{ fontSize: 38, fontWeight: 800, color: 'var(--text, #0f172a)', letterSpacing: -1 }}>${plan.precioMXN.toLocaleString('es-MX')}</span>
        <span style={{ fontSize: 15, color: 'var(--text3, #64748b)' }}>MXN/mes</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3, #64748b)', marginTop: 2, minHeight: 18 }}>
        {plan.creditos > 0 ? `${plan.creditos} créditos de IA al mes · por médico` : 'sin IA · por médico'}
      </div>
      <div style={{ fontSize: 11.5, color: '#14b8a6', fontWeight: 600, marginTop: 4 }}>
        o ${precioAnual(plan).toLocaleString('es-MX')}/año · 2 meses gratis
      </div>
      <Link href="/registro" style={{
        display: 'block', textAlign: 'center', marginTop: 18, padding: '12px 0', borderRadius: 12,
        fontSize: 15, fontWeight: 700, textDecoration: 'none',
        background: destacado ? 'var(--nexus, #3d5afe)' : 'transparent',
        color: destacado ? '#fff' : 'var(--nexus, #3d5afe)',
        border: '1px solid var(--nexus, #3d5afe)',
      }}>Prueba gratis 14 días</Link>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
        {plan.incluye.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: 'var(--text2, #334155)', lineHeight: 1.45 }}>
            <Check /> <span>{b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PreciosPage() {
  return (
    <div style={{ background: 'var(--bg, #f8fafc)', minHeight: '100vh', padding: '56px 20px 80px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nexus, #3d5afe)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Precios</div>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: 'var(--text, #0f172a)', margin: '10px 0 0', letterSpacing: -0.5 }}>
          Paga por lo que usas, con IA de nivel mundial
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text3, #64748b)', maxWidth: 640, margin: '14px auto 0', lineHeight: 1.5 }}>
          Cada plan incluye créditos de IA al mes. Documentas por voz, la nota se arma sola, con separación
          médico-paciente, evidencia con citas y revisión de consistencia y seguridad clínica. Si se acaban,
          compras más o subes de plan — nunca te cobran de sorpresa.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', alignItems: 'stretch', marginTop: 44 }}>
        <Card plan={PLANES.agenda} />
        <Card plan={PLANES.clinica} />
        <Card plan={PLANES.premium} />
      </div>

      {/* ── Menú de IA: los 3 motores ── */}
      <div style={{ maxWidth: 780, margin: '40px auto 0' }}>
        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: 4 }}>
          Elige el motor de IA en cada nota
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3, #64748b)', margin: '0 auto 16px', maxWidth: 560, lineHeight: 1.5 }}>
          Cada nota gasta créditos según el motor que uses — paga poco por lo rutinario, mucho solo cuando lo necesitas.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {(['rapida', 'estandar', 'maxima'] as const).map(k => {
            const m = MOTORES[k]
            return (
              <div key={k} style={{ flex: '1 1 210px', maxWidth: 250, background: 'var(--s1, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)' }}>{m.emoji} {m.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text3, #64748b)', marginTop: 3 }}>{m.modelos}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--nexus, #3d5afe)', marginTop: 10 }}>
                  {m.creditos} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3, #64748b)' }}>{m.creditos === 1 ? 'crédito/nota' : 'créditos/nota'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '22px auto 0', textAlign: 'center', fontSize: 13, color: 'var(--text2, #334155)', background: 'var(--s2, #f1f5f9)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, padding: '12px 16px' }}>
        ¿Se te acaban los créditos del mes? Recarga <strong>{RECARGA.creditos} créditos</strong> por <strong>${RECARGA.precioMXN} MXN</strong> — o sigue con ⚡ Rápida sin costo. Nunca te quedas sin IA.
      </div>

      <div style={{ maxWidth: 560, margin: '40px auto 0', textAlign: 'center', fontSize: 13, color: 'var(--text2, #334155)', background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 12, padding: '12px 16px' }}>
        <strong>Precio fundador</strong> — los primeros 50 médicos congelan su tarifa de por vida. Aplica tu código <strong>FUNDADOR</strong> al pagar.
      </div>

      <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text3, #64748b)', marginTop: 24 }}>
        Precios en pesos mexicanos, por médico. Paga <strong>anual y llévate 2 meses gratis</strong> (−17%). Cada nota gasta créditos
        según el motor de IA que elijas (⚡ 1 · ⭐ 3 · 💎 10). Al agotar tus créditos sigues con ⚡ Rápida sin costo o recargas. Cancela cuando quieras.
      </p>
    </div>
  )
}
