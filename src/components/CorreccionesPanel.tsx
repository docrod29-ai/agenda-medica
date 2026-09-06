'use client'

/**
 * CorreccionesPanel — transparencia de las correcciones léxicas automáticas.
 *
 * ── POR QUÉ VUELVE A VERSE EN LA CONSULTA (D-001, Panel de Lujo 2026-09) ────
 *
 * Igual que su hermano `CambiosCifrasPanel`: se apagaba solo en `/consulta/`,
 * así que el médico de consultorio no podía ver —ni deshacer— qué palabras le
 * cambió el corrector a su dictado. Seguridad clínica §3 no tiene una excepción
 * por ruta, y no hay decisión del dueño que respalde el filtro.
 *
 * Llega PLEGADO y con su conteo: enseñarlo no es abrir una tarea, es dejar la
 * puerta a la vista para quien quiera abrirla.
 */

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, RotateCcw, Wand2 } from 'lucide-react'
import type { CambioTranscripcion } from '@/lib/expediente/medical-vocabulary'

const MOTIVO_LABEL: Record<CambioTranscripcion['motivo'], string> = {
  diccionario: 'Confusión conocida',
  'fonético': 'Coincidencia fonética',
  levenshtein: 'Corrección aproximada',
  abreviatura: 'Abreviatura',
}

interface CorreccionesPanelProps {
  correcciones: CambioTranscripcion[]
  /** Deshace una corrección concreta en el texto del editor. */
  onRevertir: (c: CambioTranscripcion) => void
}

export function CorreccionesPanel({ correcciones, onRevertir }: CorreccionesPanelProps) {
  const [abierto, setAbierto] = useState(false)
  const [revertidas, setRevertidas] = useState<Set<number>>(new Set())

  // `revertidas` guarda ÍNDICES, así que tras un segundo dictado la posición 2
  // ya es otra corrección: quedaba marcada como revertida, en gris y sin botón
  // de deshacer. Si el ASR había cambiado mal el nombre de un fármaco, esa
  // corrección se volvía imposible de revertir con un clic. Se reinicia cuando
  // cambia la lista.
  useEffect(() => { setRevertidas(new Set()) }, [correcciones])

  if (correcciones.length === 0) return null
  const activas = correcciones.length - revertidas.size

  return (
    <div style={{
      marginTop: 8,
      border: '1px solid var(--border2)',
      borderRadius: 8,
      background: 'var(--s2)',
      overflow: 'hidden',
      fontSize: 12.5,
    }}>
      <button
        onClick={() => setAbierto(a => !a)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text2)', textAlign: 'left',
        }}
      >
        {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Wand2 size={13} style={{ color: 'var(--teal)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
          {activas} {activas === 1 ? 'término corregido' : 'términos corregidos'} automáticamente
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          {abierto ? 'ocultar' : 'revisar'}
        </span>
      </button>

      {abierto && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 2 }}>
            Revisa que cada cambio sea correcto. Si alguno está mal, deshazlo y déjalo como lo dictaste.
          </div>
          {correcciones.map((c, i) => {
            const yaRevertida = revertidas.has(i)
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', borderRadius: 6,
                background: yaRevertida ? 'transparent' : 'var(--s1)',
                opacity: yaRevertida ? 0.5 : 1,
              }}>
                <span style={{ textDecoration: yaRevertida ? 'none' : 'line-through', color: 'var(--text3)' }}>
                  {c.original}
                </span>
                <span style={{ color: 'var(--text3)' }}>→</span>
                <span style={{ fontWeight: 600, color: yaRevertida ? 'var(--text3)' : 'var(--teal)' }}>
                  {c.corregido}
                </span>
                <span style={{
                  fontSize: 9.5, color: 'var(--text3)', padding: '1px 6px',
                  border: '1px solid var(--border)', borderRadius: 4,
                }}>
                  {MOTIVO_LABEL[c.motivo]}
                </span>
                {!yaRevertida && (
                  <button
                    onClick={() => { onRevertir(c); setRevertidas(prev => new Set(prev).add(i)) }}
                    title="Deshacer esta corrección"
                    style={{
                      marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
                      background: 'none', border: '1px solid var(--border2)', borderRadius: 5,
                      color: 'var(--text2)', cursor: 'pointer', padding: '3px 7px', fontSize: 11,
                    }}
                  >
                    <RotateCcw size={11} /> Deshacer
                  </button>
                )}
                {yaRevertida && (
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text3)' }}>revertido</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
