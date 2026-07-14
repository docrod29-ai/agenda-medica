import Link from 'next/link'
import type { Metadata } from 'next'
import { Shield, Lock, Users, FileClock, DatabaseBackup, Server, Bug, Bell, Brain, ArrowLeft } from 'lucide-react'
import { SECURITY_CONTROLS, ESTADO_LABEL, esActivo, type SecurityState } from '@/config/security-controls'

export const metadata: Metadata = {
  title: 'Seguridad y confianza · NexusMED',
  description: 'Cómo protegemos la información clínica: cifrado, control de acceso, respaldos, proveedores y manejo de datos por la IA.',
}

/**
 * Página pública de Seguridad y confianza.
 * PRINCIPIO: solo se declara lo que está realmente implementado. Cada control
 * lleva un estado honesto (Activo / En proceso). Nada aspiracional se presenta
 * como si ya existiera. Los datos de identidad legal (razón social, domicilio,
 * RFC, responsable de privacidad) los completa el Dr. — ver marcadores PENDIENTE.
 */

// Los controles y su estado provienen de una config VERIFICABLE (fuente única);
// la página no afirma "Activo" por su cuenta. Ver src/config/security-controls.ts.
const ICONO: Record<string, typeof Lock> = {
  encryption: Lock, rbac: Users, 'tenant-isolation': Server, 'audit-log': FileClock,
  'session-timeout': Lock, 'rate-limit': Shield, 'app-check': Shield, 'incident-response': Bell,
  'backups-pitr': DatabaseBackup, mfa: Lock, pentest: Bug,
}

const SUBENCARGADOS = [
  { nombre: 'Google Cloud / Firebase', uso: 'Base de datos, almacenamiento y autenticación', region: 'Estados Unidos', pol: 'https://cloud.google.com/terms/data-processing-addendum' },
  { nombre: 'Anthropic (Claude)', uso: 'Redacción y revisión clínica asistida por IA', region: 'Estados Unidos', pol: 'https://www.anthropic.com/legal/privacy' },
  { nombre: 'OpenAI', uso: 'Transcripción de voz y apoyo de IA', region: 'Estados Unidos', pol: 'https://openai.com/policies/privacy-policy' },
  { nombre: 'Meta / WhatsApp', uso: 'Mensajes y recordatorios al paciente', region: 'Estados Unidos', pol: 'https://www.whatsapp.com/legal/business-data-transfer-addendum' },
  { nombre: 'Stripe', uso: 'Procesamiento de pagos de la suscripción', region: 'Estados Unidos', pol: 'https://stripe.com/privacy' },
  { nombre: 'Vercel', uso: 'Hospedaje de la aplicación web', region: 'Estados Unidos', pol: 'https://vercel.com/legal/privacy-policy' },
]

function Badge({ estado }: { estado: SecurityState }) {
  const activo = esActivo(estado)
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100, whiteSpace: 'nowrap',
      background: activo ? 'rgba(22,163,74,0.14)' : 'rgba(245,158,11,0.14)',
      color: activo ? '#16a34a' : '#d97706',
      border: `1px solid ${activo ? 'rgba(22,163,74,0.3)' : 'rgba(245,158,11,0.3)'}`,
    }}>
      {ESTADO_LABEL[estado]}
    </span>
  )
}

export default function SeguridadPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 80px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 14, textDecoration: 'none', marginBottom: 28 }}>
          <ArrowLeft size={15} /> Volver
        </Link>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--nexus-soft)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nexus)' }}>
            <Shield size={22} />
          </div>
          <h1 className="nx-display" style={{ fontSize: 34, fontWeight: 600, margin: 0 }}>Seguridad y confianza</h1>
        </div>
        <p style={{ fontSize: 16, color: 'var(--text2)', lineHeight: 1.6, maxWidth: 640 }}>
          Manejamos información clínica, que la ley mexicana considera <strong>datos personales sensibles</strong>.
          Aquí declaramos, con transparencia, qué medidas de seguridad están activas hoy y cuáles estamos
          incorporando. Distinguimos ambas cosas a propósito: preferimos ser exactos a prometer de más.
        </p>

        {/* Controles */}
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: '44px 0 16px' }}>Medidas de protección</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SECURITY_CONTROLS.map((c) => {
            const Icono = ICONO[c.id] ?? Shield
            return (
              <div key={c.id} style={{ display: 'flex', gap: 14, padding: 16, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ color: 'var(--nexus)', flexShrink: 0, paddingTop: 2 }}><Icono size={20} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{c.titulo}</span>
                    <Badge estado={c.estado} />
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.55 }}>{c.detalle}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* IA y datos */}
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: '44px 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={20} style={{ color: 'var(--nexus)' }} /> Qué recibe la inteligencia artificial
        </h2>
        <div style={{ fontSize: 14.5, color: 'var(--text2)', lineHeight: 1.65, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <p style={{ margin: '0 0 12px' }}>
            Para redactar y revisar notas, la IA procesa el texto o audio de la consulta que tú dictas.
            Este procesamiento ocurre en los proveedores listados abajo, bajo sus acuerdos de tratamiento de datos.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li><strong>No usamos tus consultas ni los expedientes de tus pacientes para entrenar modelos de IA.</strong></li>
            <li>La IA <strong>asiste</strong> la documentación; el médico revisa, corrige y confirma antes de firmar. Las decisiones clínicas son siempre del médico.</li>
            <li>Guardamos qué generó la IA y qué corrigió el médico, para trazabilidad.</li>
          </ul>
        </div>

        {/* Subencargados */}
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: '44px 0 16px' }}>Proveedores (subencargados)</h2>
        <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 16 }}>
          Empresas que procesan datos para operar el servicio. Cada una bajo su propio acuerdo de tratamiento de datos.
        </p>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 560 }}>
            <thead>
              <tr style={{ background: 'var(--s1)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Proveedor</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Uso</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Región</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Política</th>
              </tr>
            </thead>
            <tbody>
              {SUBENCARGADOS.map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.nombre}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{s.uso}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{s.region}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <a href={s.pol} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--nexus)', textDecoration: 'none' }}>Ver →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Identidad / contacto — PENDIENTE datos del Dr. */}
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: '44px 0 16px' }}>Responsable y contacto</h2>
        <div style={{ fontSize: 14.5, color: 'var(--text2)', lineHeight: 1.65 }}>
          <p style={{ margin: '0 0 8px' }}>
            Para ejercer tus derechos ARCO (acceso, rectificación, cancelación, oposición) o reportar un
            incidente de seguridad, escríbenos a{' '}
            <a href="mailto:privacidad@nexusmed.mx" style={{ color: 'var(--nexus)' }}>privacidad@nexusmed.mx</a>.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>
            Consulta también nuestro <Link href="/terminos" style={{ color: 'var(--nexus)' }}>aviso de privacidad y términos</Link>.
          </p>
        </div>
      </div>
    </main>
  )
}
