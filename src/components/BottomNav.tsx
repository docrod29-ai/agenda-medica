'use client'
/**
 * Bottom Navigation para móvil (≤768px).
 *
 * ── V15-MOBILE-001 (Fase 9, §22): la misma IA que el FlowRail ─────────────────
 *
 * Hasta esta fase el móvil del médico seguía con la IA VIEJA (Inicio · Agenda ·
 * Pacientes · CRM) mientras el escritorio ya navegaba por los cinco contextos
 * de V15 — el mismo médico tenía dos mapas mentales según el tamaño de su
 * pantalla. Ahora, cuando la navegación primaria V15 aplica (`navPrimaria`,
 * decidido por el layout con el MISMO criterio que elige FlowRail vs Sidebar),
 * los destinos del pulgar son los mismos cuatro contextos-ruta del FlowRail:
 *
 *   Hoy · Paciente · [acción central] · Seguimiento · Operaciones
 *
 * ENCUENTRO no es una quinta pestaña: es la ACCIÓN CENTRAL contextual que este
 * componente ya tenía (en un expediente/consulta ofrece la consulta de ESE
 * paciente; en el resto, «Nueva cita») — §22 pide exactamente eso: «start
 * encounter» como trabajo primario del móvil, no como un destino más.
 *
 * Agenda y CRM no desaparecen: viven en /operaciones (§11), igual que en
 * escritorio. La agenda de HOY ya se ve en /dashboard (zona TODAY de §6).
 *
 * En modo Secretaria (o rol no-médico) se conserva la barra anterior sin
 * cambio — mismo alcance que decidió FlowRail: la IA de la asistente no es el
 * sujeto de esta fase.
 *
 * ── §8.1 también en móvil: la navegación se aquieta al grabar ────────────────
 *
 * Se suscribe al MISMO `EVENTO_GRABANDO` que ya escuchan `MarcoEscuchando`,
 * `InstrumentStrip` y `FlowRail` (el evento es la única fuente de verdad; cada
 * pieza del shell se suscribe por su cuenta, patrón ya fijado en FlowRail).
 * Sólo se atenúan los ÍCONOS de los destinos no activos (WCAG 1.4.11,
 * contraste no-textual 3:1 — hay margen); las ETIQUETAS de texto no se tocan
 * (la lección de contraste de FlowRail: `--text3` sobre `--s1` no tiene margen
 * AA para atenuarse). La acción central tampoco se atenúa: es la entrada al
 * encuentro, la única acción que §8.6 quiere dominante.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Calendar, Users, MessageCircle, TrendingUp, Stethoscope,
  CalendarPlus, CalendarClock, UserSquare2, ListChecks, Settings2,
} from 'lucide-react'
import { useMode } from '@/context/ModeContext'
import { useClinic } from '@/context/ClinicContext'
import { rutaPermitida } from '@/lib/modulos'
import { EVENTO_GRABANDO, type DetalleDeEscucha } from '@/lib/seguridad/estoy-grabando'

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
 * Los cuatro contextos-ruta de V15, los MISMOS hrefs que pinta FlowRail
 * (guardián: v15-bottom-nav-cinco-contextos.test.ts compara los dos archivos).
 * Sin filtro de `rutaPermitida`: FlowRail decidió que los contextos núcleo no
 * se recortan por paquete, y el móvil no debe divergir del escritorio.
 */
const CONTEXTOS_V15: Item[] = [
  { href: '/dashboard', label: 'Hoy', icon: CalendarClock, active: p => p === '/dashboard' },
  { href: '/pacientes', label: 'Paciente', icon: UserSquare2,
    active: p => p.startsWith('/pacientes') || p.startsWith('/expedientes') || p.startsWith('/expediente/') },
  { href: '/pendientes', label: 'Seguimiento', icon: ListChecks, active: p => p.startsWith('/pendientes') },
  { href: '/operaciones', label: 'Operaciones', icon: Settings2,
    active: p => p.startsWith('/operaciones') || p.startsWith('/configuracion') || p.startsWith('/guia') },
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

/**
 * ¿Este ícono se atenúa mientras se graba? Sólo los de destinos NO activos, y
 * sólo mientras la grabación está viva. Puro y testeable — el guardián lo
 * prueba al revés (grabando+activo, sin grabar, etc.).
 */
export function iconoAtenuado(grabando: boolean, activo: boolean): boolean {
  return grabando && !activo
}

function useGrabando(): boolean {
  const [grabando, setGrabando] = useState(false)
  useEffect(() => {
    const alSonar = (ev: Event) => {
      const d = (ev as CustomEvent<DetalleDeEscucha>).detail
      if (!d || typeof d.activo !== 'boolean') return
      setGrabando(d.activo)
    }
    window.addEventListener(EVENTO_GRABANDO, alSonar)
    return () => window.removeEventListener(EVENTO_GRABANDO, alSonar)
  }, [])
  return grabando
}

export function BottomNav({ navPrimaria = false }: { navPrimaria?: boolean }) {
  const pathname = usePathname()
  const { mode } = useMode()
  const { clinic } = useClinic()
  const grabando = useGrabando()

  const lastItem: Item = mode === 'medico'
    ? { href: '/crm', label: 'CRM', icon: TrendingUp, active: p => p.startsWith('/crm') }
    : { href: '/chat', label: 'Chat', icon: MessageCircle, active: p => p.startsWith('/chat') }

  // V15: los contextos núcleo no se filtran por paquete (paridad con FlowRail).
  // Barra anterior: oculta módulos que la clínica no contrató, como siempre.
  const destinos: Item[] = navPrimaria
    ? CONTEXTOS_V15
    : [...COMMON, lastItem].filter(it => rutaPermitida(clinic, it.href))
  const accion = accionContextual(pathname)
  const AccionIcon = accion.kind === 'consulta' ? Stethoscope : CalendarPlus

  // El aquietado sólo aplica a la navegación V15 del médico: la barra
  // heredada de Secretaria queda byte-idéntica a su conducta anterior.
  const quieto = navPrimaria && grabando

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
      {izq.map(it => <NavItem key={it.href} it={it} active={it.active(pathname)} quieto={quieto} />)}

      {/* Acción central contextual — elevada, en la zona del pulgar.
          Nunca se atenúa: es la entrada al encuentro (§8.6). */}
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

      {der.map(it => <NavItem key={it.href} it={it} active={it.active(pathname)} quieto={quieto} />)}
    </nav>
  )
}

function NavItem({ it, active, quieto }: { it: Item; active: boolean; quieto: boolean }) {
  const Icon = it.icon
  return (
    <Link
      href={it.href}
      aria-current={active ? 'page' : undefined}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '7px 4px 9px',
        color: active ? 'var(--teal)' : 'var(--text3)',
        textDecoration: 'none', gap: 3, minHeight: 52,
        transition: 'color 0.15s',
      }}
    >
      {/* Sólo el ícono se atenúa (no-textual, WCAG 1.4.11); la etiqueta nunca. */}
      <Icon
        size={20}
        strokeWidth={active ? 2.2 : 1.8}
        style={{ opacity: iconoAtenuado(quieto, active) ? 0.4 : 1, transition: 'opacity 0.2s' }}
      />
      <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{it.label}</span>
    </Link>
  )
}
