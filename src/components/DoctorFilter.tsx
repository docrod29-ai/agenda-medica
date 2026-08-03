'use client'
/**
 * Selector global "Filtrar por médico" — visible en agenda, citas, calendario, asistente.
 *
 * Persiste la selección en localStorage (`agenda-medica:filtroMedico`) para que la
 * asistente no tenga que volverlo a elegir cada vez que cambia de pantalla.
 *
 * Si solo hay 1 médico activo, NO renderiza nada (sería ruido).
 * Si hay 2+, muestra dropdown con avatares de colores.
 */
import { useEffect, useState } from 'react'
import { useCerrarConEscape } from '@/lib/ui/activable'
import { useDoctors } from '@/hooks/useDoctors'
import { Users, Check } from 'lucide-react'

const STORAGE_KEY = 'agenda-medica:filtroMedico'

/** Devuelve el médicoId actualmente filtrado (o null = todos) */
export function useFiltroMedico(): [string | null, (id: string | null) => void] {
  const [medicoId, setMedicoId] = useState<string | null>(null)
  const { activeDoctors, loading } = useDoctors()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored !== 'null') setMedicoId(stored)
  }, [])

  /**
   * UN FILTRO A UN MÉDICO QUE YA NO EXISTE DEJA LA AGENDA VACÍA PARA SIEMPRE.
   *
   * El id se leía SIEMPRE de localStorage, pero el selector solo se DIBUJA si hay
   * 2 o más médicos activos. Secuencia real: la asistente filtra por la Dra. B →
   * la Dra. B se da de baja → queda un solo médico activo → el selector deja de
   * renderizarse, pero el filtro sigue aplicándose contra un médico que ya no
   * está. Cero citas, todos los días, y ningún control en pantalla para quitarlo:
   * la única salida era borrar el almacenamiento del navegador.
   *
   * Se espera a que `useDoctors` termine de cargar para no invalidar durante el
   * arranque, cuando la lista aún está vacía por motivos legítimos.
   */
  useEffect(() => {
    if (loading || !medicoId) return
    if (!activeDoctors.some(d => d.id === medicoId)) {
      setMedicoId(null)
      if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY)
    }
  }, [loading, activeDoctors, medicoId])

  const updateMedicoId = (id: string | null) => {
    setMedicoId(id)
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    }
  }

  return [medicoId, updateMedicoId]
}

/** Pinta el chip selector. Si solo hay 1 médico, no se renderiza nada. */
export function DoctorFilter({
  medicoId, onChange, mostrarTodos = true,
}: {
  medicoId: string | null
  onChange: (id: string | null) => void
  mostrarTodos?: boolean
}) {
  const { activeDoctors } = useDoctors()
  const [open, setOpen] = useState(false)
  // El desplegable sólo se cerraba HACIENDO CLIC FUERA: con el teclado no había
  // forma de salir sin recorrerlo entero.
  useCerrarConEscape(open, () => setOpen(false))

  // Con un filtro activo el selector SIEMPRE se pinta, aunque quede un solo
  // médico: si no, no habría forma de quitarlo desde la pantalla.
  if (activeDoctors.length <= 1 && !medicoId) return null

  const seleccionado = activeDoctors.find(d => d.id === medicoId)

  // Colores cíclicos para los avatares (consistentes por id)
  const colorFor = (id: string): string => {
    const colores = ['#14b8a6', '#a78bfa', '#f59e0b', '#3b82f6', '#ec4899']
    const hash = Array.from(id).reduce((s, c) => s + c.charCodeAt(0), 0)
    return colores[hash % colores.length]
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '7px 14px', borderRadius: 'var(--r-pill)',
          background: 'var(--s2)', border: '1px solid var(--border)',
          color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        {seleccionado ? (
          <>
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: colorFor(seleccionado.id), color: '#000',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 11,
            }}>
              {iniciales(seleccionado.nombre)}
            </span>
            <span>{seleccionado.nombre}</span>
          </>
        ) : (
          <>
            <Users size={14} />
            <span>Todos los médicos ({activeDoctors.length})</span>
          </>
        )}
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>▾</span>
      </button>

      {open && (
        <>
          {/* Backdrop para cerrar al hacer click afuera */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          />
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 51,
            minWidth: 240, background: 'var(--s1)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            padding: 6, overflow: 'hidden',
          }}>
            {mostrarTodos && (
              <button
                onClick={() => { onChange(null); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 10px', borderRadius: 6,
                  background: !medicoId ? 'rgba(20,184,166,0.12)' : 'transparent',
                  border: 'none', color: !medicoId ? 'var(--teal)' : 'var(--text)',
                  cursor: 'pointer', fontSize: 13, textAlign: 'left',
                }}
              >
                <Users size={14} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>Todos los médicos</span>
                {!medicoId && <Check size={13} />}
              </button>
            )}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            {activeDoctors.map(d => {
              const activo = medicoId === d.id
              return (
                <button
                  key={d.id}
                  onClick={() => { onChange(d.id); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '8px 10px', borderRadius: 6,
                    background: activo ? 'rgba(20,184,166,0.12)' : 'transparent',
                    border: 'none', color: activo ? 'var(--teal)' : 'var(--text)',
                    cursor: 'pointer', fontSize: 13, textAlign: 'left',
                  }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: colorFor(d.id), color: '#000', flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11,
                  }}>
                    {iniciales(d.nombre)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{d.nombre}</div>
                    {d.especialidad && (
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.especialidad}</div>
                    )}
                  </div>
                  {activo && <Check size={13} />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/** Helper: obtiene color del médico (consistente por id) */
export function colorMedico(id: string): string {
  const colores = ['#14b8a6', '#a78bfa', '#f59e0b', '#3b82f6', '#ec4899']
  const hash = Array.from(id).reduce((s, c) => s + c.charCodeAt(0), 0)
  return colores[hash % colores.length]
}

function iniciales(nombre: string): string {
  const partes = nombre.replace(/^Dr\.?\s+|^Dra\.?\s+/i, '').trim().split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}
