'use client'
// Gráfica de tendencia (línea) para signos vitales — SVG puro, sin dependencias.
// Muestra una banda de rango normal y marca los puntos fuera de rango en rojo.

export interface PuntoSigno { fecha: string; valor: number }

export function GraficaSignos({
  titulo, unidad, puntos, normalMin, normalMax, color = '#3D5AFE',
}: {
  titulo: string
  unidad: string
  puntos: PuntoSigno[]
  normalMin?: number
  normalMax?: number
  color?: string
}) {
  const vals = puntos.map(p => p.valor)
  if (vals.length === 0) return null

  const W = 300, H = 90, padL = 30, padR = 8, padT = 10, padB = 16
  const min = Math.min(...vals, normalMin ?? Infinity)
  const max = Math.max(...vals, normalMax ?? -Infinity)
  const lo = Math.floor(min - (max - min || 1) * 0.15)
  const hi = Math.ceil(max + (max - min || 1) * 0.15)
  const rango = hi - lo || 1

  const x = (i: number) => padL + (puntos.length === 1 ? (W - padL - padR) / 2 : (i / (puntos.length - 1)) * (W - padL - padR))
  const y = (v: number) => padT + (1 - (v - lo) / rango) * (H - padT - padB)

  const fueraDeRango = (v: number) => (normalMin != null && v < normalMin) || (normalMax != null && v > normalMax)
  const path = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ')

  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', marginBottom: 2 }}>{titulo} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({unidad})</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* banda normal */}
        {normalMin != null && normalMax != null && (
          <rect x={padL} y={y(normalMax)} width={W - padL - padR} height={Math.max(0, y(normalMin) - y(normalMax))} fill="#0d948818" />
        )}
        {/* ejes min/max */}
        <text x={2} y={y(hi) + 4} fontSize="9" fill="var(--text3)">{hi}</text>
        <text x={2} y={y(lo) + 4} fontSize="9" fill="var(--text3)">{lo}</text>
        {/* línea */}
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* puntos — fuera del rango de REFERENCIA en ámbar (no rojo): la banda es
            referencia visual, NO los cortes de NEWS2 (decisión del Dr, L6). El
            score/color de NEWS2 se muestra aparte, calculado por news2.ts. */}
        {puntos.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.valor)} r={2.6} fill={fueraDeRango(p.valor) ? '#d97706' : color} />
        ))}
      </svg>
    </div>
  )
}
