'use client'
/**
 * Bottom Navigation para móvil (≤768px).
 * 4 destinos + 1 ACCIÓN CENTRAL contextual (botón elevado) que cambia según
 * dónde estás: en un expediente/consulta ofrece "Consulta" de ese paciente;
 * en el resto, "Nueva cita". Así la acción más probable siempre está a un toque,
 * en la zona del pulgar.
 *
 * En modo Secretaria se reemplaza CRM por Chat (CRM es solo-médico).
 * Solo se muestra en móvil (.bottom-nav-wrap: display none en escritorio).
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, Users, MessageCircle, TrendingUp, Stethoscope, CalendarPlus } from 'lucide-react'
import { useMode } from '@/context/ModeContext'
import { useClinic } from '@/context/ClinicContext'
import { rutaPermitida } from '@/lib/modulos'

type Item = {
  href: string; label: string; icon: typeof LayoutDashboard
  active: (path: string) => boolean
}

const COMMON: Item[] = [
  { href: '/dashboard', label: 'Inicio',    icon: LayoutDashboard, active: p => p === '/dashboard' },
  { href: '/calendario', label: 'Agenda',   icon: Calendar,        active: p => p.startsWith('/calendario') || p.startsWith('/citas') },
  { href: '/pacientes', label: 'Pacientes', icon: Users,           active: p => p.startsWith('/pacientes') || p.startsWith('/expediente') },
]

/**
 * Acción central según contexto. Solo rutas que existen con seguridad:
 * en /expediente/[id] o /consulta/[id] → ir a la consulta de ESE paciente;
 * en cualquier otro lado → agendar (asistente). Puro y testeable.
 */
export function accionContextual(pathname: string): { label: string; href: string; kind: 'consulta' | 'cita' } {
  const m = pathname.match(/^\/(?:expediente|consulta)\/([^/]+)/)
  if (m) return { label: 'Consulta', href: `/consulta/${m[1]}`, kind: 'consulta' }
  return { label: 'Nueva cita', href: '/asistente', kind: 'cita' }
}

export function BottomNav() {
  const pathname = usePathname()
  const { mode } = useMode()
  const { clinic } = useClinic()

  const lastItem: Item = mode === 'medico'
    ? { href: '/crm', label: 'CRM', icon: TrendingUp, active: p => p.startsWith('/crm') }
    : { href: '/chat', label: 'Chat', icon: MessageCircle, active: p => p.startsWith('/chat') }

  // Oculta accesos a módulos que la clínica no contrató (su paquete).
  const destinos: Item[] = [...COMMON, lastItem].filter(it => rutaPermitida(clinic, it.href))
  const accion = accionContextual(pathname)
  const AccionIcon = accion.kind === 'consulta' ? Stethoscope : CalendarPlus

  // La acción central va en medio de los destinos (zona del pulgar).
  const medio = Math.ceil(destinos.length / 2)
  const izq = destinos.slice(0, medio)
  const der = destinos.slice(medio)

  return (
    <nav
      role="navigation"
      aria-label="Navegación principal"
      style={{
        position: 'sticky', bottom: 0, left: 0, right: 0,
        background: 'var(--s1)', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'space-around',
        zIndex: 45, flexShrink: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      className="bottom-nav"
    >
      {izq.map(it => <NavItem key={it.href} it={it} active={it.active(pathname)} />)}

      {/* Acción central contextual — elevada, en la zona del pulgar */}
      <Link
        href={accion.href}
        aria-label={accion.label}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'flex-start', textDecoration: 'none', minHeight: 52, paddingTop: 4,
        }}
      >
        <span style={{
          width: 46, height: 46, borderRadius: '50%', marginTop: -18,
          background: 'var(--nexus-solido)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(20,184,166,0.45)', border: '3px solid var(--s1)',
        }}>
          <AccionIcon size={22} strokeWidth={2.2} />
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal)', lineHeight: 1, marginTop: 3 }}>
          {accion.label}
        </span>
      </Link>

      {der.map(it => <NavItem key={it.href} it={it} active={it.active(pathname)} />)}
    </nav>
  )
}

function NavItem({ it, active }: { it: Item; active: boolean }) {
  const Icon = it.icon
  return (
    <Link
      href={it.href}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '7px 4px 9px',
        color: active ? 'var(--teal)' : 'var(--text3)',
        textDecoration: 'none', gap: 3, minHeight: 52,
        transition: 'color 0.15s',
      }}
    >
      <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
      <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{it.label}</span>
    </Link>
  )
}
