'use client'
/**
 * FLOW RAIL — V15-SHELL-GREYBOX-001.
 *
 * ── QUÉ REEMPLAZA ────────────────────────────────────────────────────────────
 *
 * El `Sidebar` de médico tenía 21 destinos + 2 de «Sistema» = 23 (medido en
 * `docs/design/capturas/v15-baseline-before/BASELINE.md`). V15 §14 lo llama
 * «feature-menu warehouse» y exige ≤5. Este componente es ESO: los cinco
 * contextos que el routine V15 fija en su prioridad 4 —
 * TODAY · PATIENT · ENCOUNTER · WORK/FOLLOW-UP · SEARCH/COMMAND — y nada más
 * como navegación primaria.
 *
 * Los 18 destinos restantes no desaparecen: viven en `/operaciones`
 * (§11 «Operations es separada del trabajo clínico»), enlazada aquí de forma
 * subordinada, no como un sexto ítem del mismo peso.
 *
 * ── POR QUÉ SÓLO MÉDICO ──────────────────────────────────────────────────────
 *
 * El routine dice «Primary PHYSICIAN navigation must be ≤5 contexts» — no
 * toca el rol de asistente. La asistente sigue con `Sidebar` sin cambio: no es
 * reskin, es que su IA de navegación no es el sujeto de esta fase. Se reevalúa
 * cuando V15 llegue a esa superficie (ver plan de compatibilidad en
 * `docs/design/v15/IA-001-sitemap.md`).
 *
 * ── POR QUÉ GREYBOX (SIN --teal) ─────────────────────────────────────────────
 *
 * §12 exige revisar la nueva IA/jerarquía SIN color de marca antes de aplicar
 * estilo. Este componente usa sólo `--s1/--s2/--s3/--text/--text2/--text3/
 * --border` — que en este repo YA son neutros/grises (`globals.css`), no
 * inventa una paleta gris aparte — y ninguna variable de acento. El estado
 * activo se marca con peso tipográfico + fondo neutro, no con --teal. La
 * fase de estilo (V15-VISUAL-SYSTEM-001, Fase 10) decide si el acento entra
 * aquí después de pasar la Greybox Gate.
 *
 * ── ENCOUNTER: por qué apunta a /pacientes cuando no hay encuentro activo ────
 *
 * No existe todavía un concepto de "encuentro activo" fuera de una ruta
 * /consulta/[id] concreta — no hay que inventarlo aquí (V15-ENCOUNTER-MODE-001,
 * Fase 5, es quien construye ese modo real). Mientras tanto, ENCOUNTER se
 * resuelve exactamente como ya resolvía la antigua entrada «Consulta» del
 * Sidebar: to /pacientes. No es una regresión — es el mismo comportamiento
 * de hoy, con IA explícita en vez de una sola entrada ambigua llamada
 * «Consulta» que en realidad abría la lista de pacientes.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarClock, UserSquare2, Stethoscope, ListChecks, Search, Settings2, LogOut,
} from 'lucide-react'
import { useConfig } from '@/hooks/useConfig'
import { useAuth } from '@/hooks/useAuth'
import { MarcaAusculta } from '@/components/MarcaAusculta'
import { salirSeguro } from '@/lib/salir-seguro'

const ES_CONTEXTO_PACIENTE = (p: string) =>
  p.startsWith('/pacientes') || p.startsWith('/expedientes') || p.startsWith('/expediente/')

const ES_CONTEXTO_ENCUENTRO = (p: string) =>
  p.startsWith('/consulta/') || p.startsWith('/nota/') || p.startsWith('/receta/') ||
  p.startsWith('/orden/') || p.startsWith('/referencia/')

export function FlowRail({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? ''
  const { config } = useConfig()
  const { user } = useAuth()

  const enEncuentro = ES_CONTEXTO_ENCUENTRO(pathname)
  const encounterHref = enEncuentro ? pathname : '/pacientes'

  const abrirBusqueda = () => {
    onNavigate?.()
    window.dispatchEvent(new Event('nexus:open-palette'))
  }
  const handleLogout = async () => { await salirSeguro('/login') }

  return (
    <aside className="sidebar nx-flow-rail" aria-label="Navegación clínica principal">
      {/* Identidad — mínima, sin acento de marca */}
      <div className="sidebar-logo">
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--s2)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MarcaAusculta size={20} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {config.nombreClinica || 'Ausculta'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {config.nombreMedico
              ? (/^Dr\.?\s+|^Dra\.?\s+/i.test(config.nombreMedico) ? config.nombreMedico : `Dr. ${config.nombreMedico}`)
              : 'Consultorio'}
          </div>
        </div>
      </div>

      {/* SEARCH / COMMAND — quinto contexto, es acción, no ruta */}
      <button
        onClick={abrirBusqueda}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '8px 12px', margin: '4px 0 10px', cursor: 'pointer', color: 'var(--text3)',
        }}
      >
        <Search size={15} />
        <span style={{ fontSize: 12, flex: 1, textAlign: 'left' }}>Buscar…</span>
        <span style={{ fontSize: 10.5, border: '1px solid var(--border)', borderRadius: 6, padding: '1px 5px' }}>⌘K</span>
      </button>

      {/* Los cuatro contextos que SÍ son ruta */}
      <nav className="sidebar-nav" aria-label="Contextos clínicos">
        <RailLink href="/dashboard" label="Hoy" icon={CalendarClock}
          activo={pathname === '/dashboard'} onNavigate={onNavigate} />
        <RailLink href="/pacientes" label="Paciente" icon={UserSquare2}
          activo={ES_CONTEXTO_PACIENTE(pathname)} onNavigate={onNavigate} />
        <RailLink href={encounterHref} label="Encuentro" icon={Stethoscope}
          activo={enEncuentro} onNavigate={onNavigate} />
        <RailLink href="/pendientes" label="Seguimiento" icon={ListChecks}
          activo={pathname.startsWith('/pendientes')} onNavigate={onNavigate} />

        <div className="nav-section-title" style={{ marginTop: 14 }}>Operaciones</div>
        <RailLink href="/operaciones" label="Operaciones" icon={Settings2}
          activo={pathname.startsWith('/operaciones') || pathname.startsWith('/configuracion') || pathname.startsWith('/guia')}
          onNavigate={onNavigate} subordinado />
      </nav>

      <div style={{ padding: '12px 8px 16px', borderTop: '1px solid var(--border)' }}>
        <button onClick={handleLogout} className="nav-item" style={{ color: 'var(--text3)', width: '100%' }}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
        {user?.email && (
          <div style={{ fontSize: 10.5, color: 'var(--text3)', padding: '6px 8px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
        )}
      </div>
    </aside>
  )
}

function RailLink({ href, label, icon: Icon, activo, onNavigate, subordinado }: {
  href: string; label: string; icon: typeof CalendarClock; activo: boolean
  onNavigate?: () => void; subordinado?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`nav-item${activo ? ' active' : ''}`}
      aria-current={activo ? 'page' : undefined}
      style={subordinado ? { color: 'var(--text3)', fontSize: 12 } : undefined}
    >
      <Icon size={17} className="nav-icon" />
      <span style={{ flex: 1 }}>{label}</span>
    </Link>
  )
}
