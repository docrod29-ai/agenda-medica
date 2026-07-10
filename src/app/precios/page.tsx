import Link from 'next/link'
import { PLANES_IA } from '@/lib/planes-ia'

export const metadata = {
  title: 'Precios · NexusMED',
  description: 'Planes de NexusMED: documentación clínica con IA, separación médico-paciente, evidencia con citas y segunda opinión.',
}

const bulletsBasico = [
  'Nota clínica con IA (NOM-004) — dictas y se estructura sola',
  'Separación automática médico-paciente al grabar',
  'Recetas, órdenes y agenda incluidas',
  'Análisis basado en evidencia (NEJM · JAMA · Cochrane · PubMed) con citas',
  'Segunda opinión de IA a demanda',
  `Hasta ${PLANES_IA.pro.limiteConsultas} consultas con IA al mes`,
  `Hasta ${PLANES_IA.pro.pacientesMax} pacientes`,
]
const bulletsPremium = [
  'Todo lo del plan Básico',
  'IA de razonamiento máximo (Opus 4.8 con razonamiento clínico)',
  'Segunda opinión de IA AUTOMÁTICA en cada nota',
  'Evidencia médica con citas en cada caso',
  `Hasta ${PLANES_IA.premium.limiteConsultas} consultas con IA al mes`,
  'Pacientes ilimitados',
  'Soporte prioritario',
]

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
      <path d="M20 6L9 17l-5-5" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Card({ destacado, nombre, tagline, precio, bullets }: {
  destacado?: boolean; nombre: string; tagline: string; precio: number; bullets: string[]
}) {
  return (
    <div style={{
      position: 'relative', flex: '1 1 320px', maxWidth: 420, background: 'var(--s1, #fff)',
      border: '1px solid ' + (destacado ? 'var(--nexus, #3d5afe)' : 'var(--border, #e5e7eb)'),
      borderRadius: 18, padding: '28px 26px',
      boxShadow: destacado ? '0 12px 40px rgba(61,90,254,0.14)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {destacado && (
        <div style={{
          position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--nexus, #3d5afe)', color: '#fff', fontSize: 12, fontWeight: 700,
          padding: '4px 14px', borderRadius: 100, letterSpacing: 0.3,
        }}>Más popular</div>
      )}
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text, #0f172a)' }}>{nombre}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text3, #64748b)', marginTop: 6, minHeight: 40, lineHeight: 1.4 }}>{tagline}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 18 }}>
        <span style={{ fontSize: 40, fontWeight: 800, color: 'var(--text, #0f172a)', letterSpacing: -1 }}>${precio.toLocaleString('es-MX')}</span>
        <span style={{ fontSize: 15, color: 'var(--text3, #64748b)' }}>MXN/mes</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3, #64748b)', marginTop: 2 }}>por médico · sin permanencia</div>
      <Link href="/registro" style={{
        display: 'block', textAlign: 'center', marginTop: 20, padding: '12px 0', borderRadius: 12,
        fontSize: 15, fontWeight: 700, textDecoration: 'none',
        background: destacado ? 'var(--nexus, #3d5afe)' : 'transparent',
        color: destacado ? '#fff' : 'var(--nexus, #3d5afe)',
        border: '1px solid var(--nexus, #3d5afe)',
      }}>Prueba gratis 7 días</Link>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 22 }}>
        {bullets.map((b, i) => (
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
          Un expediente con IA que sí te deja ganancia
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text3, #64748b)', maxWidth: 620, margin: '14px auto 0', lineHeight: 1.5 }}>
          Documentación clínica, separación médico-paciente, evidencia con citas reales y segunda opinión.
          Sin instalar nada, sin configurar llaves — abres y dictas.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, justifyContent: 'center', alignItems: 'stretch', marginTop: 44 }}>
        <Card
          nombre={PLANES_IA.pro.nombre}
          tagline="Para el médico que quiere documentar rápido y con respaldo de evidencia."
          precio={PLANES_IA.pro.precioMXN}
          bullets={bulletsBasico}
        />
        <Card
          destacado
          nombre={PLANES_IA.premium.nombre}
          tagline="Máxima inteligencia clínica: razonamiento avanzado y segunda opinión automática."
          precio={PLANES_IA.premium.precioMXN}
          bullets={bulletsPremium}
        />
      </div>

      <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text3, #64748b)', marginTop: 34 }}>
        Precios en pesos mexicanos, por médico. La evidencia proviene de PubMed (fuentes públicas); el texto completo
        de revistas de paga no se reproduce. Cancela cuando quieras.
      </p>
    </div>
  )
}
