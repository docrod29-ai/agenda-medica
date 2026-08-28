'use client'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { listarPacientesPagina, buscarPacientes } from '@/lib/firestore'
import { normalizarNombre } from '@/lib/csv-pacientes'
import type { Patient } from '@/types'
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
  /**
   * El resultado va ATADO al texto que lo produjo. Guardar sólo la lista
   * obligaría a limpiarla de forma síncrona al cambiar el texto —que encadena
   * renders— y, peor, dejaría enseñando un instante los resultados de la
   * búsqueda anterior como si fueran de ésta.
   */
  const [busqueda, setBusqueda] = useState<{ q: string; pacientes: Patient[]; truncada: boolean } | null>(null)
  const [activo, setActivo] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

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

  /**
   * A3 — LA PALETA YA NO SE BAJA EL CONSULTORIO PARA ENSEÑAR SEIS.
   *
   * Antes pedía la lista entera al abrirse y filtraba en memoria. Está montada
   * en el layout, así que era una descarga del directorio completo desde
   * CUALQUIER pantalla, para pintar como mucho seis filas.
   *
   * Ahora: al abrir, una PÁGINA corta para las sugerencias en frío; al teclear,
   * la búsqueda INDEXADA. El número de lecturas depende de lo que se enseña, no
   * de cuántos pacientes tenga el consultorio.
   *
   * Y esto importa más de lo que parece desde la escala: con la lista acotada,
   * un filtro en memoria buscaría dentro de un recorte y diría «no hay» de un
   * paciente que existe. Un buscador que se calla eso es peor que uno lento.
   */
  useEffect(() => {
    if (open && clinicId && pacientes.length === 0) {
      listarPacientesPagina(clinicId, { limite: 6 })
        .then(p => setPacientes(p.pacientes))
        .catch(() => {})
    }
    if (open) { setActivo(0); setTimeout(() => inputRef.current?.focus(), 30) }
    else setQuery('')
  }, [open, clinicId, pacientes.length])

  /** Búsqueda indexada con rebote: cada tecleo no es una consulta. */
  useEffect(() => {
    if (!open || !clinicId) return
    const q = query.trim()
    if (q.length < 2) return
    let vivo = true
    const t = setTimeout(() => {
      buscarPacientes(clinicId, q, { ventana: 20 })
        .then(r => { if (vivo) setBusqueda({ q, pacientes: r.pacientes, truncada: r.truncada }) })
        .catch(() => { /* sin red, quedan las sugerencias en frío */ })
    }, 180)
    return () => { vivo = false; clearTimeout(t) }
  }, [open, clinicId, query])

  // Lista combinada: acciones rápidas + pacientes, filtradas por el texto, con un
  // índice plano para navegar con teclado sobre ambas.
  type Entrada = { kind: 'accion'; label: string; icon: LucideIcon; route: string } | { kind: 'paciente'; p: Patient }
  const entradas = useMemo<Entrada[]>(() => {
    const q = normalizarNombre(query)
    const tel = query.replace(/\D/g, '')
    const acciones: Entrada[] = ACCIONES
      .filter(a => q.length < 1 || normalizarNombre(a.label).includes(q))
      .map(a => ({ kind: 'accion', ...a }))
    /**
     * Con menos de dos caracteres no hay consulta indexada todavía: se enseñan
     * las sugerencias en frío, y sobre ellas sí vale filtrar en memoria porque
     * son seis y son las que se tienen delante. A partir de dos, manda el
     * servidor — filtrar en memoria buscaría dentro de un recorte.
     */
    const deServidor = busqueda && busqueda.q === query.trim() ? busqueda.pacientes : null
    const base = deServidor ?? (q.length >= 1 || tel.length >= 3
      ? pacientes.filter(p =>
          (q.length >= 1 && normalizarNombre(p.nombre).includes(q)) ||
          (tel.length >= 3 && (p.telefono || '').replace(/\D/g, '').includes(tel)))
      : pacientes)
    const pac = base.slice(0, 6).map<Entrada>(p => ({ kind: 'paciente', p }))
    return [...acciones, ...pac]
  }, [query, pacientes, busqueda])

  const ejecutar = useCallback((e: Entrada) => {
    setOpen(false)
    router.push(e.kind === 'accion' ? e.route : `/expediente/${e.p.id}`)
  }, [router])

  const onKeyNav = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActivo(a => Math.min(a + 1, entradas.length - 1)) }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActivo(a => Math.max(a - 1, 0)) }
    else if (ev.key === 'Enter' && entradas[activo]) { ev.preventDefault(); ejecutar(entradas[activo]) }
  }

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
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text)' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>Esc</span>
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {/**
            * A3 — «no encontré» y «no miré entera» no son lo mismo.
            *
            * La búsqueda lee una VENTANA acotada. Cuando esa ventana se llena,
            * puede haber coincidencias fuera, y callarlo enseñaría «sin
            * coincidencias» de un paciente que existe. Es la regla 4 de
            * seguridad clínica dicha en un buscador: la ausencia de un
            * resultado no es prueba de que el paciente no esté.
            */}
          {busqueda && busqueda.q === query.trim() && busqueda.truncada && (
            <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
              Hay más coincidencias de las que caben aquí. Afina la búsqueda.
            </div>
          )}
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
