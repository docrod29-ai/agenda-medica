'use client'
/**
 * Autocomplete para códigos CIE-10. Busca por código o descripción.
 * Cuando el médico selecciona uno, llama onSelect con código + descripción.
 *
 * Cumple NOM-035-SSA3-2012 (terminología en salud) — codifica diagnósticos
 * usando el catálogo internacional ICD-10 traducido al español MX.
 */
import { useState, useRef, useEffect } from 'react'
import { buscarCie10, cargarCatalogoExtendido, totalCodigos, type Cie10Entry } from '@/lib/cie10'
import { Search, Check } from 'lucide-react'

export interface Cie10AutocompleteProps {
  /** Valor del input (puede ser libre o un código seleccionado) */
  value: string
  onChange: (descripcion: string, codigoCIE10?: string) => void
  placeholder?: string
  /**
   * C-025 — CÓMO SE LLAMA ESTE CAMPO.
   *
   * El componente no aceptaba NINGUNA prop de etiqueta, así que sus dos
   * llamadores (la consulta y el ingreso hospitalario) no podían arreglarlo
   * desde fuera aunque quisieran. El valor por defecto dice lo que el campo es
   * en las dos: un buscador de diagnóstico.
   */
  etiqueta?: string
  /** Si true, el input es solo descripción libre; el código se selecciona aparte */
  soloDescripcion?: boolean
  style?: React.CSSProperties
}

export function Cie10Autocomplete({ value, onChange, placeholder, etiqueta, style }: Cie10AutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [resultados, setResultados] = useState<Cie10Entry[]>([])
  const [open, setOpen] = useState(false)
  const [total, setTotal] = useState(totalCodigos())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  // Lazy-load del catálogo extendido al montar el componente
  useEffect(() => {
    cargarCatalogoExtendido().then(() => setTotal(totalCodigos()))
  }, [])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleInput = (v: string) => {
    setQuery(v)
    onChange(v)  // permite uso libre incluso sin código
    if (v.length >= 2) {
      const matches = buscarCie10(v)
      setResultados(matches)
      setOpen(matches.length > 0)
    } else {
      setOpen(false)
    }
  }

  const seleccionar = (entry: Cie10Entry) => {
    setQuery(entry.descripcion)
    onChange(entry.descripcion, entry.codigo)
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          aria-label={etiqueta ?? 'Diagnóstico (buscar en CIE-10)'}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => {
            if (query.length >= 2) {
              const r = buscarCie10(query)
              setResultados(r)
              if (r.length > 0) setOpen(true)
            }
          }}
          placeholder={placeholder ?? 'Ej: faringitis, J02, hipertensión…'}
          style={{
            width: '100%', padding: '8px 10px 8px 32px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
            fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
      </div>

      {open && resultados.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
          maxHeight: 280, overflow: 'auto', zIndex: 20,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <div style={{ padding: '6px 12px', fontSize: 10.5, color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
            {resultados.length} de {total.toLocaleString('es-MX')} códigos · NOM-035
          </div>
          {resultados.map(r => (
            <button
              key={r.codigo}
              onClick={() => seleccionar(r)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text)', borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', gap: 8, alignItems: 'flex-start',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--s2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                fontFamily: 'monospace', fontWeight: 700, color: 'var(--teal)',
                fontSize: 11.5, padding: '2px 6px', background: 'color-mix(in srgb, var(--nexus) 10%, transparent)',
                borderRadius: 3, flexShrink: 0, marginTop: 1,
              }}>
                {r.codigo}
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                {r.descripcion}
                {r.capitulo && <span style={{ fontSize: 10.5, color: 'var(--text3)', marginLeft: 6 }}>· {r.capitulo}</span>}
              </span>
            </button>
          ))}
          <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text3)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={10} /> Selecciona uno o sigue escribiendo libremente
          </div>
        </div>
      )}
    </div>
  )
}
