'use client'

/**
 * CambiosCifrasPanel — las cifras, unidades y siglas que el pipeline reescribió.
 *
 * Por qué existe: el pipeline calculaba estas dos listas en cada dictado y **no
 * las devolvía nadie**. El médico veía las correcciones de fármacos —hay un panel
 * para eso desde hace versiones— y no veía las de **dosis**.
 *
 * La regla ya estaba escrita en el panel de al lado: en un documento clínico-legal
 * nada cambia en silencio. Si «dos gramos» quedó como «2 g», eso es una edición a
 * su dictado y tiene que poder verla y deshacerla.
 *
 * Colapsado por defecto, salvo cuando hay cifras o unidades: ésas se abren solas.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, RotateCcw, Hash } from 'lucide-react'
import { cuantosTocanCifra, type CambioVisible } from '@/lib/asr/cambios-visibles'

interface Props {
  cambios: CambioVisible[]
  /** Deshace un cambio concreto en el texto del editor. */
  onRevertir: (c: CambioVisible) => void
}

const VACIO: ReadonlySet<number> = new Set()

export function CambiosCifrasPanel({ cambios, onRevertir }: Props) {
  const conCifra = cuantosTocanCifra(cambios)
  /**
   * EL ESTADO VA ATADO A **ESTA** LISTA, no a un efecto que la persiga.
   *
   * Los índices son de la lista actual: tras un segundo dictado, la posición 2
   * ya es otro cambio y se quedaría marcada como revertida —en gris y sin botón
   * de deshacer—. Es el mismo defecto que ya se corrigió una vez en el panel de
   * correcciones léxicas.
   *
   * Se guarda junto a la referencia de la lista y se **deriva** en el render, en
   * vez de sincronizarlo con un `useEffect`: un efecto que llama a `setState`
   * provoca un render en cascada, y además deja un fotograma con los datos
   * viejos — el botón «deshacer» del dictado anterior, encima del nuevo.
   */
  const [marcados, setMarcados] = useState<{ lista: CambioVisible[]; idx: ReadonlySet<number> } | null>(null)
  const revertidos = marcados?.lista === cambios ? marcados.idx : VACIO

  const [plegado, setPlegado] = useState<{ lista: CambioVisible[]; abierto: boolean } | null>(null)
  // Por defecto: abierto si hay cifras o unidades —son dosis—, cerrado si sólo
  // hay siglas. Mientras el médico no toque la cabecera, manda el defecto.
  const abierto = plegado?.lista === cambios ? plegado.abierto : conCifra > 0
  const setAbierto = (v: boolean) => setPlegado({ lista: cambios, abierto: v })

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
