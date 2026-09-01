'use client'

/**
 * CambiosCifrasPanel — las cifras, unidades y siglas que el pipeline reescribió.
 *
 * La lista sigue disponible donde una superficie especializada la necesita
 * (por ejemplo UCI). En el Golden Path ambulatorio de Consultorio, en cambio,
 * la normalización determinista segura es provenance y no una tarea de depuración
 * para el médico: allí este panel no se renderiza. La incertidumbre clínicamente
 * material sigue escalando por AlertasDictado/ambigüedad contextual antes de firmar.
 */

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight, RotateCcw, Hash } from 'lucide-react'
import { cuantosTocanCifra, type CambioVisible } from '@/lib/asr/cambios-visibles'

interface Props {
  cambios: CambioVisible[]
  /** Deshace un cambio concreto en el texto del editor. */
  onRevertir: (c: CambioVisible) => void
}

const VACIO: ReadonlySet<number> = new Set()

export function CambiosCifrasPanel({ cambios, onRevertir }: Props) {
  const pathname = usePathname()
  const conCifra = cuantosTocanCifra(cambios)
  /**
   * EL ESTADO VA ATADO A **ESTA** LISTA, no a un efecto que la persiga.
   *
   * Los índices son de la lista actual: tras un segundo dictado, la posición 2
   * ya es otro cambio y se quedaría marcada como revertida —en gris y sin botón
   * de deshacer—. Se guarda junto a la referencia de la lista y se deriva en el
   * render para no dejar un fotograma con datos viejos.
   */
  const [marcados, setMarcados] = useState<{ lista: CambioVisible[]; idx: ReadonlySet<number> } | null>(null)
  const revertidos = marcados?.lista === cambios ? marcados.idx : VACIO

  const [plegado, setPlegado] = useState<{ lista: CambioVisible[]; abierto: boolean } | null>(null)
  const abierto = plegado?.lista === cambios ? plegado.abierto : conCifra > 0
  const setAbierto = (v: boolean) => setPlegado({ lista: cambios, abierto: v })

  // GP12: en la consulta ambulatoria el médico no audita normalizaciones seguras.
  // No se borra `cambios`: la provenance permanece en el pipeline y las excepciones
  // clínicamente materiales siguen su gate contextual. UCI conserva esta superficie.
  if (pathname.startsWith('/consulta/')) return null
  if (cambios.length === 0) return null
  const activos = cambios.length - revertidos.size

  return (
    <div style={{
      marginTop: 8, border: '1px solid var(--border2)', borderRadius: 8,
      background: 'var(--s2)', overflow: 'hidden', fontSize: 12.5,
    }}>
      <button
        onClick={() => setAbierto(!abierto)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text2)', textAlign: 'left',
        }}
      >
        {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Hash size={13} style={{ color: conCifra > 0 ? 'var(--amber)' : 'var(--teal)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
          {activos} {activos === 1 ? 'cifra, unidad o sigla reescrita' : 'cifras, unidades o siglas reescritas'}
        </span>
        {conCifra > 0 && (
          <span style={{
            fontSize: 9.5, color: 'var(--amber)', padding: '1px 6px',
            border: '1px solid var(--amber)', borderRadius: 4,
          }}>
            {conCifra} {conCifra === 1 ? 'toca una dosis' : 'tocan dosis'}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          {abierto ? 'ocultar' : 'revisar'}
        </span>
      </button>

      {abierto && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 2 }}>
            El sistema escribió las cifras y unidades en su forma estándar. Revisa que digan
            lo que dictaste; si alguna no, deshazla.
          </div>
          {cambios.map((c, i) => {
            const ya = revertidos.has(i)
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', borderRadius: 6,
                background: ya ? 'transparent' : 'var(--s1)',
                opacity: ya ? 0.5 : 1,
              }}>
                <span style={{ textDecoration: ya ? 'none' : 'line-through', color: 'var(--text3)' }}>{c.antes}</span>
                <span style={{ color: 'var(--text3)' }}>→</span>
                <span style={{ fontWeight: 600, color: ya ? 'var(--text3)' : 'var(--teal)' }}>{c.despues}</span>
                <span style={{
                  fontSize: 9.5, color: 'var(--text3)', padding: '1px 6px',
                  border: '1px solid var(--border)', borderRadius: 4,
                }}>
                  {c.etiqueta}
                </span>
                {!ya ? (
                  <button
                    onClick={() => { onRevertir(c); setMarcados({ lista: cambios, idx: new Set(revertidos).add(i) }) }}
                    title="Deshacer este cambio"
                    style={{
                      marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
                      background: 'none', border: '1px solid var(--border2)', borderRadius: 5,
                      color: 'var(--text2)', cursor: 'pointer', padding: '3px 7px', fontSize: 11,
                    }}
                  >
                    <RotateCcw size={11} /> Deshacer
                  </button>
                ) : (
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
