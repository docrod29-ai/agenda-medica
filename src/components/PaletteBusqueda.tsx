'use client'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { getPatients } from '@/lib/firestore'
import { normalizarNombre } from '@/lib/csv-pacientes'
import type { Patient } from '@/types'
import { Search, User, CornerDownLeft } from 'lucide-react'

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

  // Atajo global ⌘K / Ctrl+K para abrir; Escape para cerrar.
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
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])

  // Carga perezosa del directorio al abrir (getPatients está cacheado).
  useEffect(() => {
    if (open && clinicId && pacientes.length === 0) {
      getPatients(clinicId).then(setPacientes).catch(() => {})
    }
    if (open) { setActivo(0); setTimeout(() => inputRef.current?.focus(), 30) }
    else setQuery('')
  }, [open, clinicId, pacientes.length])

  const resultados = useMemo(() => {
    const q = normalizarNombre(query)
    const tel = query.replace(/\D/g, '')
    if (q.length < 1 && tel.length < 3) return pacientes.slice(0, 8)
    return pacientes.filter(p =>
      (q.length >= 1 && normalizarNombre(p.nombre).includes(q)) ||
      (tel.length >= 3 && (p.telefono || '').replace(/\D/g, '').includes(tel)),
    ).slice(0, 8)
  }, [query, pacientes])

  const abrir = useCallback((p: Patient) => {
    setOpen(false)
    router.push(`/expediente/${p.id}`)
  }, [router])

  const onKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(a => Math.min(a + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && resultados[activo]) { e.preventDefault(); abrir(resultados[activo]) }
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
            placeholder="Buscar paciente por nombre o teléfono…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text)' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>Esc</span>
        </div>

        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {resultados.length === 0 ? (
            <div style={{ padding: '22px 16px', fontSize: 13.5, color: 'var(--text3)', textAlign: 'center' }}>
              {pacientes.length === 0 ? 'Cargando pacientes…' : 'Sin coincidencias.'}
            </div>
          ) : resultados.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseEnter={() => setActivo(i)}
              onClick={() => abrir(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                border: 'none', cursor: 'pointer', padding: '11px 16px',
                background: i === activo ? 'var(--s2)' : 'transparent',
              }}
            >
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--nexus-soft)', color: 'var(--nexus)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <User size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
                {p.telefono && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.telefono}</div>}
              </div>
              {i === activo && <CornerDownLeft size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
            </button>
          ))}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 14 }}>
          <span>↑↓ moverse</span><span>↵ abrir expediente</span><span>⌘K abrir/cerrar</span>
        </div>
      </div>
    </div>
  )
}
