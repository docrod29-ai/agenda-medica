'use client'
import React from 'react'

/**
 * Renderizador de markdown ligero → JSX bonito (SIN mostrar #, ** ni símbolos).
 * Soporta: títulos (#, ##, ###), negritas **x**, viñetas (- / *), citas [n] y
 * párrafos. Pensado para las respuestas clínicas del Consultor de Evidencia.
 */

// Parseo inline: **negritas** y citas [1] con leve realce.
function inline(texto: string, key: string): React.ReactNode[] {
  const nodos: React.ReactNode[] = []
  // Divide por **negritas** conservando los delimitadores.
  const partes = texto.split(/(\*\*[^*]+\*\*)/g)
  partes.forEach((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      nodos.push(<strong key={`${key}-b${i}`} style={{ fontWeight: 700, color: 'var(--text)' }}>{p.slice(2, -2)}</strong>)
    } else if (p) {
      // Realza las citas [1], [2] con color teal.
      const sub = p.split(/(\[\d+\](?:\[\d+\])*)/g)
      sub.forEach((s, j) => {
        if (/^\[\d+\]/.test(s)) nodos.push(<span key={`${key}-c${i}-${j}`} style={{ color: 'var(--teal)', fontWeight: 600, fontSize: '0.85em' }}>{s}</span>)
        else if (s) nodos.push(<React.Fragment key={`${key}-t${i}-${j}`}>{s}</React.Fragment>)
      })
    }
  })
  return nodos
}

export function MiniMarkdown({ texto }: { texto: string }) {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const bloques: React.ReactNode[] = []
  let lista: string[] = []

  const cerrarLista = () => {
    if (lista.length === 0) return
    const items = lista.slice()
    lista = []
    bloques.push(
      <ul key={`ul-${bloques.length}`} style={{ margin: '4px 0 10px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map((it, k) => <li key={k} style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.55 }}>{inline(it, `li-${bloques.length}-${k}`)}</li>)}
      </ul>,
    )
  }

  for (const raw of lineas) {
    const linea = raw.trimEnd()
    const th = linea.match(/^(#{1,6})\s+(.*)$/)
    const li = linea.match(/^\s*[-*]\s+(.*)$/)
    if (th) {
      cerrarLista()
      const nivel = th[1].length
      const tam = nivel <= 1 ? 17 : nivel === 2 ? 15 : 13.5
      bloques.push(
        <div key={`h-${bloques.length}`} style={{ fontSize: tam, fontWeight: 700, color: 'var(--text)', margin: bloques.length ? '14px 0 4px' : '0 0 4px' }}>
          {inline(th[2], `h-${bloques.length}`)}
        </div>,
      )
    } else if (li) {
      lista.push(li[1])
    } else if (linea.trim() === '') {
      cerrarLista()
    } else {
      cerrarLista()
      bloques.push(
        <p key={`p-${bloques.length}`} style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 8px' }}>
          {inline(linea, `p-${bloques.length}`)}
        </p>,
      )
    }
  }
  cerrarLista()
  return <div>{bloques}</div>
}
