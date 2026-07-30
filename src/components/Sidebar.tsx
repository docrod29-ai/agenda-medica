'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useMode } from '@/context/ModeContext'
import { useConfig } from '@/hooks/useConfig'
import {
  LayoutDashboard, CalendarDays, Calendar, Users, Clock,
  Settings, LogOut, Stethoscope, Shield, Bot, UserSquare2, FileText, Search,
  MessageCircle, TrendingUp, Star, ShieldCheck, Pill, BedDouble, BookOpen, FlaskConical, ArrowLeftRight, HeartHandshake, Bug, CreditCard, Activity,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { rutaPermitida } from '@/lib/modulos'
import { suscribirMensajes, suscribirLectura, contarNoLeidos, type ChatMessage } from '@/lib/chat'
import { limpiarBorradoresLocales, limpiarAudioLocal } from '@/lib/mobile/local-drafts'
import { limpiarCacheFirestore } from '@/lib/firebase'
import { EVENTO_GUARDAR_TODO } from '@/components/AutoLogout'

// Cada item declara en qué modos aparece:
//   medico       → solo cuando el usuario está en modo Médico
//   secretaria   → solo cuando está en modo Secretaria
//   ambos        → siempre visible
const NAV: { href: string; label: string; icon: typeof LayoutDashboard; modos: 'ambos' | 'medico' | 'secretaria' }[] = [
  { href: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard, modos: 'ambos' },
  { href: '/asistente',     label: 'Agendar rápido', icon: UserSquare2,     modos: 'ambos' },
  { href: '/citas',         label: 'Citas',          icon: CalendarDays,    modos: 'ambos' },
  { href: '/calendario',    label: 'Calendario',     icon: Calendar,        modos: 'ambos' },
  { href: '/pacientes',     label: 'Consulta',       icon: Users,           modos: 'ambos' },
  { href: '/hospitalizacion', label: 'Hospitalización', icon: BedDouble,     modos: 'ambos' },
  { href: '/uci',           label: 'UCI',            icon: Activity,        modos: 'medico' },   // /uci es el expediente de terapia, no la calculadora
  { href: '/consultor',     label: 'Consultor IA',   icon: FlaskConical,    modos: 'medico' },
  { href: '/antibiograma',  label: 'Antibiograma',   icon: Bug,             modos: 'medico' },
  { href: '/lista-espera',  label: 'Lista de espera',icon: Clock,           modos: 'ambos' },
  { href: '/crm',           label: 'CRM',            icon: TrendingUp,      modos: 'medico' },
  { href: '/resenas',       label: 'Reseñas',        icon: Star,            modos: 'medico' },
  { href: '/reactivacion',  label: 'Reactivación',   icon: HeartHandshake,  modos: 'medico' },
  { href: '/chat',          label: 'Chat',           icon: MessageCircle,   modos: 'ambos' },
  { href: '/farmacia',      label: 'Farmacia',       icon: Pill,            modos: 'medico' },
  { href: '/finanzas',      label: 'Finanzas',       icon: TrendingUp,      modos: 'medico' },
  { href: '/membresias',    label: 'Membresías',     icon: CreditCard,      modos: 'ambos' },
  // 'Corte de caja' ahora es una PESTAÑA dentro de Finanzas (era una 2ª entrada
  // que confundía). La ruta /corte-caja sigue viva por si hay marcadores.
  { href: '/cumplimiento',  label: 'Cumplimiento',   icon: ShieldCheck,     modos: 'medico' },
  { href: '/legal',         label: 'Documentos legales', icon: FileText,    modos: 'medico' },
  { href: '/migracion',     label: 'Migración',      icon: ArrowLeftRight,  modos: 'medico' },
]

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { mode, setMode, isDoctor, esMedicoReal } = useMode()
  const { config } = useConfig()
  const { user } = useAuth()
  const { clinicId, clinic } = useClinic()
  const [mensajes, setMensajes] = useState<ChatMessage[]>([])
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)

  // Suscripción a mensajes del chat para badge de no-leídos
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

  // Filtrar NAV según el modo activo Y los módulos contratados por la clínica
  // (el paquete que compró). rutaPermitida da acceso a TODO si no hay módulos
  // definidos (clínicas previas) y siempre a las rutas core.
  const navVisible = NAV.filter(item =>
    (item.modos === 'ambos' || (mode === 'medico' ? item.modos === 'medico' : item.modos === 'secretaria'))
    && rutaPermitida(clinic, item.href)
  )

  const handleLogout = async () => {
    // Pide a la pantalla abierta que persista antes de purgar lo local: si el
    // médico cierra sesión con una consulta dictada sin guardar, se guarda.
    window.dispatchEvent(new CustomEvent(EVENTO_GUARDAR_TODO))
    await new Promise(r => setTimeout(r, 1200))
    limpiarBorradoresLocales() // borradores en localStorage (+ pestillo anti-resurrección)
    await signOut(auth)
    // Limpia el grueso del PHI en disco (dispositivo compartido): audio crudo y la
    // caché offline de Firestore en IndexedDB. Antes solo se borraba localStorage.
    limpiarAudioLocal()
    await limpiarCacheFirestore()
    router.replace('/login')
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--nexus-soft)', border: '1px solid rgba(61,90,254,0.32)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Mark NexusMED en miniatura */}
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <g stroke="#3D5AFE" strokeWidth="5" strokeLinecap="round" fill="none">
              <line x1="8" y1="8" x2="8" y2="40"/>
              <line x1="40" y1="8" x2="40" y2="40"/>
              <line x1="8" y1="8" x2="40" y2="40"/>
            </g>
            <circle cx="24" cy="24" r="3" fill="#F2EFE9"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {config.nombreClinica || 'NexusMED'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {(() => {
              // Asistente: muestra SU nombre y rol, no el del médico
              if (!esMedicoReal) {
                const miNombre = user?.displayName || user?.email?.split('@')[0]
                return miNombre ? `${miNombre} · Asistente` : 'Asistente'
              }
              // Médico: muestra el nombre del consultorio
              if (!config.nombreMedico) return 'Consultorio'
              const yaTienePrefijo = /^Dr\.?\s+|^Dra\.?\s+/i.test(config.nombreMedico)
              return yaTienePrefijo ? config.nombreMedico : `Dr. ${config.nombreMedico}`
            })()}
          </div>
        </div>
      </div>

      {/* Buscador global (abre la paleta ⌘K). Visible = descubrible, y en móvil
          es la única forma de abrirla (no hay atajo de teclado). Solo médico. */}
      {esMedicoReal && (
        <button
          onClick={() => { onClose?.(); window.dispatchEvent(new Event('nexus:open-palette')) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '8px 12px', margin: '4px 0 10px', cursor: 'pointer', color: 'var(--text3)',
          }}
        >
          <Search size={15} />
          <span style={{ fontSize: 13, flex: 1, textAlign: 'left' }}>Buscar…</span>
          <span style={{ fontSize: 10.5, border: '1px solid var(--border)', borderRadius: 5, padding: '1px 5px' }}>⌘K</span>
        </button>
      )}

      {/* Nav */}
      <nav className="sidebar-nav">
        {navVisible.map(({ href, label, icon: Icon }) => {
          const esChat = href === '/chat'
          const mostrarBadge = esChat && noLeidos > 0 && pathname !== '/chat'
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`nav-item${pathname === href || (href !== '/dashboard' && pathname.startsWith(href)) ? ' active' : ''}`}
              style={{ position: 'relative' }}
            >
              <Icon size={17} className="nav-icon" />
              <span style={{ flex: 1 }}>{label}</span>
              {mostrarBadge && (
                <span style={{
                  background: 'var(--teal)', color: '#040b12',
                  fontSize: 10, fontWeight: 800, borderRadius: 100,
                  padding: '1px 7px', minWidth: 18, textAlign: 'center',
                }}>
                  {noLeidos > 99 ? '99+' : noLeidos}
                </span>
              )}
            </Link>
          )
        })}

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
        {/* Mode toggle — solo visible para médicos/admin reales.
            La asistente no tiene este toggle: su rol está fijo. */}
        {esMedicoReal ? (
          <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '4px', display: 'flex', gap: 2 }}>
            <button
              onClick={() => setMode('medico')}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: mode === 'medico' ? 'var(--s3)' : 'transparent',
                color: mode === 'medico' ? 'var(--teal)' : 'var(--text3)',
                transition: 'all 0.15s',
              }}
            >
              <Stethoscope size={13} /> Médico
            </button>
            <button
              onClick={() => setMode('secretaria')}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: mode === 'secretaria' ? 'var(--s3)' : 'transparent',
                color: mode === 'secretaria' ? 'var(--blue)' : 'var(--text3)',
                transition: 'all 0.15s',
              }}
            >
              <Shield size={13} /> Secretaria
            </button>
          </div>
        ) : (
          <div style={{
            background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)',
            borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11.5, color: '#a78bfa', fontWeight: 600,
          }}>
            <Shield size={12} /> Cuenta de Asistente
          </div>
        )}

        <button onClick={handleLogout} className="nav-item" style={{ color: 'var(--text3)' }}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
