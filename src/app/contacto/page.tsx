import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MessageCircle, LifeBuoy } from 'lucide-react'
import { NavPublica } from '@/components/landing/NavPublica'
import { CORREO_SOPORTE } from '@/lib/contacto'

export const metadata: Metadata = {
  title: 'Contacto y soporte · Ausculta',
  description: 'Ponte en contacto con el equipo de Ausculta. Correo de soporte y canales de ayuda.',
}

const CORREO = CORREO_SOPORTE

/**
 * Página pública de contacto/soporte. Sustituye al enlace `mailto:` del pie, que
 * en móvil (sobre todo apps instaladas) puede cerrar la página al intentar abrir
 * el correo. Aquí el correo se MUESTRA a la vista (copiable) y no depende de que
 * el dispositivo tenga un cliente de correo configurado.
 */
export default function ContactoPage() {
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
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 22px 80px' }}>
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12, background: 'var(--nexus-solido)', color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '9px 16px', borderRadius: 10, textDecoration: 'none' }}
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
    </div>
  )
}
