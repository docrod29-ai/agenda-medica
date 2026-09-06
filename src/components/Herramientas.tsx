'use client'
/**
 * BARRA DE HERRAMIENTAS CLÍNICAS — un solo bloque plegado.
 *
 * Antes cada herramienta era una caja siempre abierta apilada en la consulta:
 * cinco bloques ocupando pantalla aunque la mayoría de las consultas no use
 * ninguno. Ahora son renglones delgados que se abren solo cuando se necesitan;
 * el aviso (badge) es lo que hace que una herramienta pida atención sola.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Search, Wrench } from 'lucide-react'

export interface Herramienta {
  id: string
  nombre: string
  icono: React.ReactNode
  /** Color de acento de la herramienta. */
  color: string
  /** Una línea de para qué sirve. */
  para: string
  /** Aviso que se muestra sin abrir: "3 vacunas atrasadas", "2 fotos". */
  aviso?: { texto: string; urgente?: boolean }
  /** Se abre sola la primera vez (para lo que no se puede pasar por alto). */
  abrirPorDefecto?: boolean
  contenido: React.ReactNode
}

export function Herramientas({ items, ocultas = [] }: {
  items: Herramienta[]
  /**
   * Herramientas que NO son de la especialidad del médico. No desaparecen: se
   * llega a ellas por el buscador. Filtrar no es quitar — una herramienta que no
   * se puede encontrar es una herramienta que no existe.
   */
  ocultas?: Herramienta[]
}) {
  const [abierta, setAbierta] = useState<string | null>(
    () => items.find(i => i.abrirPorDefecto)?.id ?? null,
  )
  const tocadoPorElUsuario = useRef(false)

  /**
   * El paciente se carga DESPUÉS del primer render, así que en ese momento las
   * herramientas que dependen de sus datos todavía no existen y el inicializador
   * del useState no las veía: la apertura automática por vacunas atrasadas nunca
   * llegaba a dispararse. Se sincroniza cuando aparecen, salvo que el usuario ya
   * haya abierto o cerrado algo por su cuenta.
   */
  const idPorDefecto = items.find(i => i.abrirPorDefecto)?.id ?? null
  useEffect(() => {
    if (idPorDefecto && !tocadoPorElUsuario.current) setAbierta(idPorDefecto)
  }, [idPorDefecto])

  /**
   * BUSCADOR. Con la lista filtrada por especialidad hace falta una vía para
   * llegar al resto — y de paso resuelve el problema de siempre: con nueve
   * herramientas, encontrar la que se busca cuesta leerlas todas.
   */
  const [q, setQ] = useState('')
  const [buscando, setBuscando] = useState(false)
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const coincide = (h: Herramienta) => {
    const t = norm(q.trim())
    return !t || norm(h.nombre).includes(t) || norm(h.para).includes(t)
  }
  const visibles = q.trim() ? [...items, ...ocultas].filter(coincide) : items
  const encontradasFueraDeEspecialidad = q.trim() ? ocultas.filter(coincide).length : 0

  if (items.length === 0 && ocultas.length === 0) return null

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', marginBottom: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderBottom: '1px solid var(--border)' }}>
        <Wrench size={13} color="var(--text3)" />
        <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: 0.3 }}>HERRAMIENTAS CLÍNICAS</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>({items.length})</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {buscando ? (
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              onBlur={() => { if (!q.trim()) setBuscando(false) }}
              placeholder="Buscar herramienta…"
              style={{
                background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '5px 9px', fontSize: 12, color: 'var(--text)', width: 190,
              }}
            />
          ) : (
            <button type="button" onClick={() => setBuscando(true)} title="Buscar entre todas las herramientas"
              className="nx-acc-texto nx-acc-texto--tenue"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, padding: 2 }}>
              <Search size={13} /> Buscar
            </button>
          )}
          {q.trim() && (
            <button type="button" onClick={() => { setQ(''); setBuscando(false) }}
              className="nx-acc-texto nx-acc-texto--tenue"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5 }}>
              limpiar
            </button>
          )}
        </div>
      </div>

      {q.trim() && (
        <div style={{ padding: '7px 13px', fontSize: 11.5, color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
          {visibles.length === 0
            ? 'Ninguna herramienta coincide.'
            : encontradasFueraDeEspecialidad > 0
              ? `${visibles.length} resultado(s) — incluye ${encontradasFueraDeEspecialidad} fuera de tu especialidad.`
              : `${visibles.length} resultado(s).`}
        </div>
      )}

      {visibles.map((h, i) => {
        const abierto = abierta === h.id
        return (
          <div key={h.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => { tocadoPorElUsuario.current = true; setAbierta(a => (a === h.id ? null : h.id)) }}
              aria-expanded={abierto}
              className="nx-acc-plana"
              data-abierto={abierto || undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '10px 13px',
                border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              {abierto ? <ChevronDown size={14} color="var(--text3)" /> : <ChevronRight size={14} color="var(--text3)" />}
              <span style={{ display: 'flex', alignItems: 'center', color: h.color }}>{h.icono}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{h.nombre}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {h.para}
              </span>
              {h.aviso && (
                <span style={{
                  flexShrink: 0, fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 'var(--r-pill)',
                  background: h.aviso.urgente ? 'color-mix(in srgb, var(--red) 15%, transparent)' : 'var(--s2)',
                  color: h.aviso.urgente ? 'var(--red)' : 'var(--text3)',
                  border: h.aviso.urgente ? '1px solid color-mix(in srgb, var(--red) 30%, transparent)' : '1px solid var(--border)',
                }}>{h.aviso.texto}</span>
              )}
            </button>
            {abierto && <div style={{ padding: '2px 13px 13px' }}>{h.contenido}</div>}
          </div>
        )
      })}
    </div>
  )
}
