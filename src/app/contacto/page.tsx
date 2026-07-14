import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Mail, MessageCircle, LifeBuoy } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contacto y soporte · NexusMED',
  description: 'Ponte en contacto con el equipo de NexusMED. Correo de soporte y canales de ayuda.',
}

const CORREO = 'soporte@nexusmed.mx'

/**
 * Página pública de contacto/soporte. Sustituye al enlace `mailto:` del pie, que
 * en móvil (sobre todo apps instaladas) puede cerrar la página al intentar abrir
 * el correo. Aquí el correo se MUESTRA a la vista (copiable) y no depende de que
 * el dispositivo tenga un cliente de correo configurado.
 */
export default function ContactoPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 22px 80px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 14, textDecoration: 'none', marginBottom: 22 }}>
          <ArrowLeft size={15} /> Volver
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <LifeBuoy size={26} style={{ color: 'var(--nexus)' }} />
          <h1 className="nx-display" style={{ fontSize: 'clamp(26px,4.5vw,38px)', fontWeight: 600, margin: 0, letterSpacing: '-0.03em' }}>
            Contacto y soporte
          </h1>
        </div>
        <p style={{ fontSize: 16, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 26px' }}>
          ¿Una duda, una falla o una idea? Escríbenos — leemos todo y respondemos.
        </p>

        {/* Correo — mostrado a la vista (copiable), con enlace opcional */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            <Mail size={15} /> Correo de soporte
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, userSelect: 'all' }}>{CORREO}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 4 }}>
            Cópialo o toca “Escribir correo”. Si tu teléfono no abre el correo solo, pega esta dirección en tu app de correo.
          </div>
          <a
            href={`mailto:${CORREO}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12, background: 'var(--nexus)', color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '9px 16px', borderRadius: 10, textDecoration: 'none' }}
          >
            <Mail size={15} /> Escribir correo
          </a>
        </div>

        {/* Si ya tienes cuenta, el soporte in-app es más directo */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            <MessageCircle size={15} /> ¿Ya tienes cuenta?
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.55, margin: '0 0 12px' }}>
            Desde tu cuenta puedes enviarnos una falla, duda o sugerencia directamente en <strong>Configuración → Soporte y sugerencias</strong>, y la recibimos con el contexto de tu consultorio.
          </p>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: 'var(--nexus)', textDecoration: 'none', border: '1px solid var(--border2)', borderRadius: 10, padding: '9px 16px' }}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  )
}
