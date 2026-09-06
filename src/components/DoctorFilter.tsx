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

  /**
   * Color del avatar. Es `colorMedico`, no una segunda copia: aquí había una
   * implementación idéntica al helper exportado de abajo, y el sentido de
   * este color es que sea EL MISMO para un médico en toda la aplicación. Dos
   * copias de la tabla es la forma de que un día deje de serlo.
   */
  const colorFor = colorMedico

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
              background: colorFor(seleccionado.id), color: 'var(--sobre-aviso)',
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
                  background: !medicoId ? 'color-mix(in srgb, var(--nexus) 12%, transparent)' : 'transparent',
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
                    background: activo ? 'color-mix(in srgb, var(--nexus) 12%, transparent)' : 'transparent',
                    border: 'none', color: activo ? 'var(--teal)' : 'var(--text)',
                    cursor: 'pointer', fontSize: 13, textAlign: 'left',
                  }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: colorFor(d.id), color: 'var(--sobre-aviso)', flexShrink: 0,
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

/**
 * Color del médico, consistente por id y ÚNICO en toda la aplicación.
 *
 * Los cinco tonos salen de los tokens: escritos a mano eran pasteles de tema
 * oscuro (`#14b8a6`, `#a78bfa`, `#f59e0b`, `#3b82f6`, `#ec4899`) y en tema
 * claro tres de los cinco quedaban por debajo de 4,5:1. La inicial que va
 * encima usa `--sobre-aviso`, que es tinta en oscuro y blanco en claro.
 */
/**
 * EL COLOR POR MÉDICO SÓLO SIRVE SI HAY MÁS DE UN MÉDICO.
 *
 * ── QUÉ SE VEÍA ───────────────────────────────────────────────────────────
 *
 * En el consultorio de UN solo médico —que es el caso comercial principal— la
 * agenda entera salía ROSA. No por un error de tono: `colorMedico` reparte
 * cinco colores por hash del id, y con un solo médico toca el que toque, para
 * siempre. Medido en el arnés con la consulta sembrada: `rgb(244,114,182)`,
 * el rosa que este sistema reserva al acento de ginecología, en las ocho citas
 * del día y en las dos de la semana siguiente.
 *
 * ── POR QUÉ ESTABA ASÍ, Y POR QUÉ ES «ESCRITO Y SIN CONECTAR» ─────────────
 *
 * La intención correcta ya estaba ESCRITA, en el comentario de quien llama:
 *
 *     // Multi-doctor: colorea según el médico; un solo médico → cobalto de marca
 *     const color = a.medicoId ? colorMedico(a.medicoId) : 'var(--nexus)'
 *
 * Pero la condición no implementa lo que dice el comentario. Pregunta si la
 * cita TIENE médico, no si el consultorio tiene VARIOS — y una cita de un
 * consultorio de un solo médico también tiene `medicoId`. Así que la rama del
 * cobalto no se ejecutaba nunca en el caso para el que se escribió.
 *
 * ── LA REGLA ──────────────────────────────────────────────────────────────
 *
 * El criterio es el mismo que ya decide si el SELECTOR se dibuja
 * (`activeDoctors.length <= 1`, arriba en este archivo): un color por médico
 * distingue médicos, y donde no hay a quién distinguir no distingue nada —
 * sólo gasta el único acento que el producto tiene para decir «esto es
 * Ausculta».
 *
 * Vive aquí, junto al selector, para que las dos decisiones no puedan
 * separarse: el día que una cambie de criterio, la otra está a tres líneas.
 */
export function colorMedico(id: string, cuantosMedicos = 2): string {
  if (cuantosMedicos <= 1) return 'var(--nexus)'
  const colores = ['var(--nexus)', 'var(--purple)', 'var(--amber)', 'var(--blue)', 'var(--rosa)']
  const hash = Array.from(id).reduce((s, c) => s + c.charCodeAt(0), 0)
  return colores[hash % colores.length]
}

function iniciales(nombre: string): string {
  const partes = nombre.replace(/^Dr\.?\s+|^Dra\.?\s+/i, '').trim().split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}
