import Link from 'next/link'
import { NavPublica } from '@/components/landing/NavPublica'
import type { Metadata } from 'next'
import { Shield, Lock, Users, FileClock, DatabaseBackup, Server, Bug, Bell, Brain, ArrowLeft } from 'lucide-react'
import { SECURITY_CONTROLS, ESTADO_LABEL, esActivo, type SecurityState } from '@/config/security-controls'
import { SUBENCARGADOS } from '@/lib/legal/subencargados'
import { CORREO_PRIVACIDAD } from '@/lib/contacto'

export const metadata: Metadata = {
  title: 'Seguridad y confianza · Ausculta',
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


function Badge({ estado }: { estado: SecurityState }) {
  const activo = esActivo(estado)
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap',
      /* El fondo salía del token y el texto era un literal: media pareja
         seguía al tema. En claro daba 2,61 : 1, medido por axe sobre la página
         servida. Ver la nota en Copiloto.tsx. */
      background: activo ? 'color-mix(in srgb, var(--green) var(--tinte), transparent)' : 'color-mix(in srgb, var(--amber) var(--tinte), transparent)',
      color: activo ? 'var(--green-texto)' : 'var(--amber-texto)',
      border: `1px solid ${activo ? 'color-mix(in srgb, var(--green) 30%, transparent)' : 'color-mix(in srgb, var(--amber) 30%, transparent)'}`,
    }}>
      {ESTADO_LABEL[estado]}
    </span>
  )
}

export default function SeguridadPage() {
  return (
    /*
      LA NAVEGACIÓN DEL SITIO, QUE ESTA PÁGINA NO TENÍA — y FUERA de `<main>`.

      Medido: `NavPublica` estaba en 3 de las 11 páginas públicas, y el propio
      menú lista «Evidencia» y «Seguridad» como destinos: se pulsaba y se
      aterrizaba en una página sin menú. `/evidencia` tenía UNA sola salida
      interna medida.

      Puesto sin más dentro de la raíz quedaba DENTRO de `<main>` —medido:
      `main .nx-nav-publica` daba 1— y un landmark de navegación dentro del
      landmark de contenido principal le miente a quien recorre la página por
      landmarks. Se envuelve: menú fuera, contenido dentro.
    */
    <div className="nx-pub">
      <NavPublica />
      <main style={{ color: 'var(--text)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 80px' }}>
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
            {/*
              SUBRAYADO, NO SÓLO COLOR. axe lo midió sobre la página servida:
              el acento contra el texto que lo rodea da 1,28 : 1 —el mínimo
              para distinguir un enlace SÓLO por color es 3 : 1— y no llevaba
              ninguna otra marca. Es WCAG 1.4.1: un enlace dentro de una frase
              que sólo se distingue por el tono no existe para quien no
              distingue ese tono. Misma razón que `a.nx-ident` y que el
              «Crea una gratis →» de la puerta.
            */}
            <a
              href={`mailto:${CORREO_PRIVACIDAD}`}
              className="nx-enlace-tactil"
              style={{ color: 'var(--nexus)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >{CORREO_PRIVACIDAD}</a>.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>
            Consulta también nuestro <Link href="/terminos" style={{ color: 'var(--nexus)' }}>aviso de privacidad y términos</Link>.
          </p>
        </div>
      </div>
      </main>
    </div>
  )
}
