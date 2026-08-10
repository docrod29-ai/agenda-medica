'use client'
/**
 * V14-SHELL-001 — La navegación deja de ser un almacén de módulos.
 *
 * ANTES: 22 destinos en una lista plana — el «feature menu warehouse» que la
 * directiva V14 §11 declara defecto fatal de categoría: presentarse como
 * Agenda+Pacientes+EHR+IA+Cobros es presentarse como cualquier otro.
 *
 * AHORA: la experiencia primaria se organiza por el trabajo clínico
 * (AHORA · PACIENTE · ATENCIÓN · CLÍNICA), y la infraestructura del
 * consultorio —cobros, CRM, reseñas, cumplimiento— existe pero no ES la
 * identidad: vive en un grupo plegado que se abre a demanda.
 *
 * Reglas conservadas del menú anterior (ninguna ruta se vuelve inalcanzable):
 * filtro por modo (médico/secretaria), filtro por módulos contratados
 * (rutaPermitida), badge de chat no leído (sube al encabezado del grupo cuando
 * está plegado), salida segura, y el toggle de modo.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMode } from '@/context/ModeContext'
import { useConfig } from '@/hooks/useConfig'
import {
  CalendarDays, Users, Clock,
  Settings, LogOut, Stethoscope, Shield, UserSquare2, Search,
  Sun, ClipboardList, Activity, BedDouble, HeartHandshake, FlaskConical, Bug,
  BookOpen, Building2, ChevronDown, MessageCircle, Calendar,
  TrendingUp, Star, Pill, CreditCard, ShieldCheck, FileText, ArrowLeftRight,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { rutaPermitida } from '@/lib/modulos'
import { suscribirMensajes, suscribirLectura, contarNoLeidos, type ChatMessage } from '@/lib/chat'
import { salirSeguro } from '@/lib/salir-seguro'

type Modos = 'ambos' | 'medico' | 'secretaria'
type Item = { href: string; label: string; icon: typeof Sun; modos: Modos }

/**
 * La gramática V14 en español de consultorio:
 *   AHORA     → lo que está pasando hoy (NOW / temporal context)
 *   PACIENTE  → la persona a través del tiempo (PATIENT / CLINICAL STATE)
 *   ATENCIÓN  → lo que espera una decisión o sigue abierto (ATTENTION / OPEN /
 *               CONTINUITY — la reactivación es continuidad, no marketing)
 *   CLÍNICA   → inteligencia contextual del médico (no «módulos de IA»)
 */
const SECCIONES: { titulo: string | null; items: Item[] }[] = [
  {
    titulo: null, // AHORA no lleva rótulo: es el punto de partida, no una categoría más
    items: [
      { href: '/dashboard',    label: 'Hoy',             icon: Sun,           modos: 'ambos' },
      { href: '/citas',        label: 'Agenda',          icon: CalendarDays,  modos: 'ambos' },
      { href: '/asistente',    label: 'Agendar rápido',  icon: UserSquare2,   modos: 'ambos' },
      { href: '/lista-espera', label: 'Lista de espera', icon: Clock,         modos: 'ambos' },
    ],
  },
  {
    titulo: 'Paciente',
    items: [
      { href: '/pacientes',       label: 'Consulta',        icon: Users,     modos: 'ambos' },
      { href: '/pendientes',      label: 'Pendientes',      icon: ClipboardList, modos: 'ambos' },
      { href: '/hospitalizacion', label: 'Hospitalización', icon: BedDouble, modos: 'ambos' },
      { href: '/uci',             label: 'UCI',             icon: Activity,  modos: 'medico' },
      { href: '/reactivacion',    label: 'Continuidad',     icon: HeartHandshake, modos: 'medico' },
    ],
  },
  {
    titulo: 'Clínica',
    items: [
      { href: '/consultor',    label: 'Consultor IA', icon: FlaskConical, modos: 'medico' },
      { href: '/antibiograma', label: 'Antibiograma', icon: Bug,          modos: 'medico' },
    ],
  },
]

/** Infraestructura del consultorio: existe, no es la identidad. Plegada. */
const CONSULTORIO: Item[] = [
  { href: '/calendario',   label: 'Calendario',         icon: Calendar,       modos: 'ambos' },
  { href: '/chat',         label: 'Chat',               icon: MessageCircle,  modos: 'ambos' },
  { href: '/crm',          label: 'CRM',                icon: TrendingUp,     modos: 'medico' },
  { href: '/resenas',      label: 'Reseñas',            icon: Star,           modos: 'medico' },
  { href: '/farmacia',     label: 'Farmacia',           icon: Pill,           modos: 'medico' },
  { href: '/finanzas',     label: 'Finanzas',           icon: TrendingUp,     modos: 'medico' },
  { href: '/membresias',   label: 'Membresías',         icon: CreditCard,     modos: 'ambos' },
  { href: '/cumplimiento', label: 'Cumplimiento',       icon: ShieldCheck,    modos: 'medico' },
  { href: '/legal',        label: 'Documentos legales', icon: FileText,       modos: 'medico' },
  { href: '/migracion',    label: 'Migración',          icon: ArrowLeftRight, modos: 'medico' },
]

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { mode, setMode, esMedicoReal } = useMode()
  const { config } = useConfig()
  const { user } = useAuth()
  const { clinicId, clinic } = useClinic()
  const [mensajes, setMensajes] = useState<ChatMessage[]>([])
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) return
    const unsub = suscribirMensajes(clinicId, setMensajes, 50)
    return () => unsub()
  }, [clinicId])
  useEffect(() => {
    if (!clinicId || !user?.uid) return
    const unsub = suscribirLectura(clinicId, user.uid, setLastReadAt)
    return () => unsub()
  }, [clinicId, user?.uid])

  const noLeidos = user?.uid ? contarNoLeidos(mensajes, user.uid, lastReadAt) : 0

  const visible = (item: Item) =>
    (item.modos === 'ambos' || (mode === 'medico' ? item.modos === 'medico' : item.modos === 'secretaria'))
    && rutaPermitida(clinic, item.href)

  const consultorioVisible = CONSULTORIO.filter(visible)
  const rutaEnConsultorio = consultorioVisible.some(i => pathname.startsWith(i.href))

  // El grupo se abre solo si la ruta activa vive dentro; el usuario puede
  // abrirlo/cerrarlo cuando quiera. No se persiste: es un pliegue, no un ajuste.
  const [consultorioAbierto, setConsultorioAbierto] = useState(rutaEnConsultorio)
  useEffect(() => { if (rutaEnConsultorio) setConsultorioAbierto(true) }, [rutaEnConsultorio])

  const handleLogout = async () => { await salirSeguro('/login') }

  const activo = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const renderItem = ({ href, label, icon: Icon }: Item) => {
    const esChat = href === '/chat'
    const mostrarBadge = esChat && noLeidos > 0 && pathname !== '/chat'
    return (
      <Link
        key={href}
        href={href}
        onClick={onClose}
        className={`nav-item${activo(href) ? ' active' : ''}`}
        style={{ position: 'relative' }}
      >
        <Icon size={17} className="nav-icon" />
        <span style={{ flex: 1 }}>{label}</span>
        {mostrarBadge && (
          <span style={{
            background: 'var(--nexus-solido)', color: '#FFFFFF',
            fontSize: 10, fontWeight: 800, borderRadius: 'var(--r-pill)',
            padding: '1px 7px', minWidth: 18, textAlign: 'center',
          }}>
            {noLeidos > 99 ? '99+' : noLeidos}
          </span>
        )}
      </Link>
    )
  }

  return (
    <aside className="sidebar">
      {/* Marca — jamaica sobre alabastro (Identity Lock) */}
      <div className="sidebar-logo">
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--r-md)',
          background: 'var(--nexus-soft)', border: '1px solid var(--border2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <g stroke="var(--nexus)" strokeWidth="5" strokeLinecap="round" fill="none">
              <line x1="8" y1="8" x2="8" y2="40"/>
              <line x1="40" y1="8" x2="40" y2="40"/>
              <line x1="8" y1="8" x2="40" y2="40"/>
            </g>
            <circle cx="24" cy="24" r="3" fill="var(--text)"/>
          </svg>
        </div>
        <div>
          <div className="nx-display" style={{ fontSize: 14, color: 'var(--text)' }}>
            {config.nombreClinica || 'NexusMED'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>
            {(() => {
              if (!esMedicoReal) {
                const miNombre = user?.displayName || user?.email?.split('@')[0]
                return miNombre ? `${miNombre} · Asistente` : 'Asistente'
              }
              if (!config.nombreMedico) return 'Consultorio'
              const yaTienePrefijo = /^Dr\.?\s+|^Dra\.?\s+/i.test(config.nombreMedico)
              return yaTienePrefijo ? config.nombreMedico : `Dr. ${config.nombreMedico}`
            })()}
          </div>
        </div>
      </div>

      {/* Buscador global (abre la paleta ⌘K). Visible = descubrible; en móvil
          es la única forma de abrirla. Solo médico. */}
      {esMedicoReal && (
        <button
          onClick={() => { onClose?.(); window.dispatchEvent(new Event('nexus:open-palette')) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            padding: '8px 12px', margin: '4px 0 10px', cursor: 'pointer', color: 'var(--text2)',
          }}
        >
          <Search size={15} />
          <span style={{ fontSize: 13, flex: 1, textAlign: 'left' }}>Buscar…</span>
          <span style={{ fontSize: 10.5, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '1px 5px' }}>⌘K</span>
        </button>
      )}

      <nav className="sidebar-nav">
        {SECCIONES.map(({ titulo, items }) => {
          const visibles = items.filter(visible)
          if (visibles.length === 0) return null
          return (
            <div key={titulo ?? 'ahora'}>
              {titulo && <div className="nav-section-title">{titulo}</div>}
              {visibles.map(renderItem)}
            </div>
          )
        })}

        {/* Consultorio: infraestructura plegada. El badge de chat sube aquí
            cuando el grupo está cerrado, para que un no-leído no quede mudo. */}
        {consultorioVisible.length > 0 && (
          <div>
            <button
              className="nav-item"
              aria-expanded={consultorioAbierto}
              onClick={() => setConsultorioAbierto(a => !a)}
              style={{ marginTop: 12 }}
            >
              <Building2 size={17} className="nav-icon" />
              <span style={{ flex: 1 }}>Consultorio</span>
              {!consultorioAbierto && noLeidos > 0 && pathname !== '/chat' && (
                <span aria-label={`${noLeidos} mensajes sin leer`} style={{
                  background: 'var(--nexus-solido)', borderRadius: 'var(--r-circulo)',
                  width: 8, height: 8, display: 'inline-block',
                }} />
              )}
              <ChevronDown
                size={14}
                style={{
                  transform: consultorioAbierto ? 'rotate(180deg)' : 'none',
                  transition: 'transform var(--mov-rapido) var(--mov-curva)',
                }}
              />
            </button>
            {consultorioAbierto && (
              <div style={{ paddingLeft: 8 }}>
                {consultorioVisible.map(renderItem)}
              </div>
            )}
          </div>
        )}

        <div className="nav-section-title" style={{ marginTop: 12 }}>Sistema</div>

        <Link
          href="/guia"
          onClick={onClose}
          className={`nav-item${pathname.startsWith('/guia') ? ' active' : ''}`}
        >
          <BookOpen size={17} className="nav-icon" />
          Guía de uso
        </Link>

        <Link
          href="/configuracion"
          onClick={onClose}
          className={`nav-item${pathname.startsWith('/configuracion') ? ' active' : ''}`}
        >
          <Settings size={17} className="nav-icon" />
          Configuración
        </Link>
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 8px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {esMedicoReal ? (
          <div style={{ background: 'var(--s2)', borderRadius: 'var(--r-md)', padding: '4px', display: 'flex', gap: 2 }}>
            <button
              onClick={() => setMode('medico')}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: mode === 'medico' ? 'var(--s3)' : 'transparent',
                color: mode === 'medico' ? 'var(--nexus)' : 'var(--text2)',
                transition: 'all var(--mov-rapido) var(--mov-curva)',
              }}
            >
              <Stethoscope size={13} /> Médico
            </button>
            <button
              onClick={() => setMode('secretaria')}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: mode === 'secretaria' ? 'var(--s3)' : 'transparent',
                color: mode === 'secretaria' ? 'var(--blue)' : 'var(--text2)',
                transition: 'all var(--mov-rapido) var(--mov-curva)',
              }}
            >
              <Shield size={13} /> Secretaria
            </button>
          </div>
        ) : (
          <div style={{
            background: 'var(--s2)', border: '1px solid var(--border2)',
            borderRadius: 'var(--r-md)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11.5, color: 'var(--blue)', fontWeight: 600,
          }}>
            <Shield size={12} /> Cuenta de Asistente
          </div>
        )}

        <button onClick={handleLogout} className="nav-item" style={{ color: 'var(--text2)' }}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
