'use client'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { getPatients } from '@/lib/firestore'
import { normalizarNombre } from '@/lib/csv-pacientes'
import type { Patient } from '@/types'
import { useDialogoDeTeclado } from '@/hooks/useDialogoDeTeclado'
import { Search, User, CornerDownLeft, CalendarPlus, FlaskConical, Calculator, CalendarDays, TrendingUp, Settings, type LucideIcon } from 'lucide-react'

/** Acciones rápidas del centro de comandos (navegación teclado-primero). */
const ACCIONES: { label: string; icon: LucideIcon; route: string }[] = [
  { label: 'Nueva cita', icon: CalendarPlus, route: '/asistente' },
  { label: 'Consultor de evidencia', icon: FlaskConical, route: '/consultor' },
  { label: 'Corte de caja', icon: Calculator, route: '/corte-caja' },
  { label: 'Agenda / Calendario', icon: CalendarDays, route: '/calendario' },
  { label: 'Finanzas', icon: TrendingUp, route: '/finanzas' },
  { label: 'Configuración', icon: Settings, route: '/configuracion' },
]

/**
 * Paleta de búsqueda global (⌘K / Ctrl+K): abre el expediente de cualquier
 * paciente desde CUALQUIER pantalla, sin navegar a Consulta primero. Patrón
 * Linear/Raycast/Notion (reconocer > recordar, teclado primero).
 * Solo para médico/admin (el expediente es de acceso médico).
 */
export function PaletteBusqueda({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const { clinicId } = useClinic()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [activo, setActivo] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const cajaRef = useRef<HTMLDivElement>(null)
  /**
   * Estable, para que el efecto del teclado no se remonte en cada pintado.
   * El Escape de la paleta ya lo trae su atajo global de arriba; éste es el
   * mismo cierre, dicho una vez, y el que recibe el gancho del diálogo.
   */
  const cerrar = useCallback(() => setOpen(false), [])

  // Atajo global ⌘K / Ctrl+K para abrir; Escape para cerrar. También se abre por
  // un evento (`nexus:open-palette`) que dispara el botón visible del sidebar —
  // así funciona en móvil, donde no hay ⌘K.
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    const onAbrir = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('nexus:open-palette', onAbrir)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('nexus:open-palette', onAbrir)
    }
  }, [enabled])

  // Carga perezosa del directorio al abrir (getPatients está cacheado).
  useEffect(() => {
    if (open && clinicId && pacientes.length === 0) {
      getPatients(clinicId).then(setPacientes).catch(() => {})
    }
    if (open) { setActivo(0); setTimeout(() => inputRef.current?.focus(), 30) }
    else setQuery('')
  }, [open, clinicId, pacientes.length])

  // Lista combinada: acciones rápidas + pacientes, filtradas por el texto, con un
  // índice plano para navegar con teclado sobre ambas.
  type Entrada = { kind: 'accion'; label: string; icon: LucideIcon; route: string } | { kind: 'paciente'; p: Patient }
  const entradas = useMemo<Entrada[]>(() => {
    const q = normalizarNombre(query)
    const tel = query.replace(/\D/g, '')
    const acciones: Entrada[] = ACCIONES
      .filter(a => q.length < 1 || normalizarNombre(a.label).includes(q))
      .map(a => ({ kind: 'accion', ...a }))
    const pac = (q.length < 1 && tel.length < 3
      ? pacientes.slice(0, 6)
      : pacientes.filter(p =>
          (q.length >= 1 && normalizarNombre(p.nombre).includes(q)) ||
          (tel.length >= 3 && (p.telefono || '').replace(/\D/g, '').includes(tel)),
        ).slice(0, 6)
    ).map<Entrada>(p => ({ kind: 'paciente', p }))
    return [...acciones, ...pac]
  }, [query, pacientes])

  const ejecutar = useCallback((e: Entrada) => {
    setOpen(false)
    router.push(e.kind === 'accion' ? e.route : `/expediente/${e.p.id}`)
  }, [router])

  const onKeyNav = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActivo(a => Math.min(a + 1, entradas.length - 1)) }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActivo(a => Math.max(a - 1, 0)) }
    else if (ev.key === 'Enter' && entradas[activo]) { ev.preventDefault(); ejecutar(entradas[activo]) }
  }

  /**
   * LA PALETA ES TECLADO-PRIMERO Y ERA LA ÚNICA SIN TRAMPA DE FOCO.
   *
   * Tenía Escape y enfocaba su campo, que es lo que se nota al usarla con
   * ratón. Lo que faltaba sólo se nota con el teclado: **tabular desde el campo
   * de búsqueda se iba a la página de detrás**, con la paleta abierta encima. En
   * el centro de comandos —lo único de este producto que existe para no tocar el
   * ratón— eso es el defecto más caro de todos.
   *
   * `enfocaAlAbrir: false`: el foco inicial ya lo pone el efecto de arriba,
   * sobre el campo de búsqueda, que es donde debe ir. Pelearse por él parpadea.
   */
  useDialogoDeTeclado(open, cajaRef, cerrar, { enfocaAlAbrir: false })

  if (!enabled || !open) return null

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
      }}
    >
      <div
        ref={cajaRef}
        role="dialog"
        aria-modal="true"
        aria-label="Centro de comandos"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, background: 'var(--s1)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,0.4)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={18} style={{ color: 'var(--text3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActivo(0) }}
            onKeyDown={onKeyNav}
            placeholder="Buscar paciente o acción (nueva cita, corte de caja…)"
            style={{ flex: 1, background: 'none', border: 'none', fontSize: 15, color: 'var(--text)' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>Esc</span>
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {entradas.length === 0 ? (
            <div style={{ padding: '22px 16px', fontSize: 13.5, color: 'var(--text3)', textAlign: 'center' }}>
              {pacientes.length === 0 ? 'Cargando…' : 'Sin coincidencias.'}
            </div>
          ) : entradas.map((e, i) => {
            const Icono = e.kind === 'accion' ? e.icon : User
            const titulo = e.kind === 'accion' ? e.label : e.p.nombre
            const sub = e.kind === 'paciente' ? e.p.telefono : undefined
            return (
              <button
                key={e.kind === 'accion' ? `a-${e.route}` : `p-${e.p.id}`}
                type="button"
                onMouseEnter={() => setActivo(i)}
                onClick={() => ejecutar(e)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                  border: 'none', cursor: 'pointer', padding: '11px 16px',
                  background: i === activo ? 'var(--s2)' : 'transparent',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: e.kind === 'paciente' ? '50%' : 8,
                  background: 'var(--nexus-soft)', color: 'var(--nexus)', display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  <Icono size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</div>
                  {sub && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{sub}</div>}
                </div>
                <span style={{ fontSize: 10.5, color: 'var(--text3)', flexShrink: 0 }}>{e.kind === 'accion' ? 'Ir' : 'Expediente'}</span>
                {i === activo && <CornerDownLeft size={14} style={{ color: 'var(--text3)', flexShrink: 0, marginLeft: 6 }} />}
              </button>
            )
          })}
        </div>

        {/* Pistas de teclado: en un teléfono no existen ⌘K ni flechas — el pie
            entero es un desktop-ism (§25, hallazgo de la captura móvil de
            V15-MOBILE-001) y se oculta por CSS bajo 768px. El display vive en
            la HOJA, no inline: un display inline vencería al media query en
            silencio (misma trampa que documenta nx-stat-grid-cableada — el
            primer intento de esta rebanada cayó en ella y el arnés lo cazó). */}
        <div className="nx-pista-teclado" style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
          <span>↑↓ moverse</span><span>↵ abrir</span><span>⌘K abrir/cerrar</span>
        </div>
      </div>
    </div>
  )
}
