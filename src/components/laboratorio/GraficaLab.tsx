'use client'
// Gráfica de tendencia de un analito de laboratorio — SVG puro, sin dependencias.
// Banda de referencia + puntos fuera de rango/críticos en rojo. Etiqueta la fecha
// del primer y último punto para orientar en el tiempo.

export interface PuntoLab { fecha: string; valor: number; critico: boolean }

export function GraficaLab({
  titulo, unidad, puntos, refMin, refMax,
}: {
  titulo: string
  unidad: string
  puntos: PuntoLab[]
  refMin?: number
  refMax?: number
}) {
  const vals = puntos.map(p => p.valor)
  if (vals.length === 0) return null

  const W = 320, H = 96, padL = 34, padR = 10, padT = 12, padB = 18
  const min = Math.min(...vals, refMin ?? Infinity)
  const max = Math.max(...vals, refMax ?? -Infinity)
  const span = (max - min) || Math.abs(max) || 1
  const lo = min - span * 0.15
  const hi = max + span * 0.15
  const rango = (hi - lo) || 1

  const x = (i: number) => padL + (puntos.length === 1 ? (W - padL - padR) / 2 : (i / (puntos.length - 1)) * (W - padL - padR))
  const y = (v: number) => padT + (1 - (v - lo) / rango) * (H - padT - padB)
  const fuera = (v: number) => (refMin != null && v < refMin) || (refMax != null && v > refMax)
  const path = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ')
  const fmtFecha = (f: string) => { const [, m, d] = f.split('-'); return `${d}/${m}` }
  const ultimo = puntos[puntos.length - 1]

  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2, gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{titulo} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({unidad})</span></div>
        <div style={{ fontSize: 13, fontWeight: 700, color: ultimo.critico || fuera(ultimo.valor) ? 'var(--red)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{ultimo.valor}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {refMin != null && refMax != null && (
          <rect x={padL} y={y(refMax)} width={W - padL - padR} height={Math.max(0, y(refMin) - y(refMax))} fill="color-mix(in srgb, var(--nexus) 8%, transparent)" />
        )}
        <text x={2} y={y(hi) + 4} fontSize="9" fill="var(--text3)">{Math.round(hi)}</text>
        <text x={2} y={y(lo) + 4} fontSize="9" fill="var(--text3)">{Math.round(lo)}</text>
        {puntos.length > 1 && <path d={path} fill="none" stroke="var(--nexus)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {puntos.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.valor)} r={3} fill={p.critico || fuera(p.valor) ? 'var(--red)' : 'var(--nexus)'} />
        ))}
        <text x={x(0)} y={H - 4} fontSize="8.5" fill="var(--text3)" textAnchor="start">{fmtFecha(puntos[0].fecha)}</text>
        {puntos.length > 1 && <text x={x(puntos.length - 1)} y={H - 4} fontSize="8.5" fill="var(--text3)" textAnchor="end">{fmtFecha(ultimo.fecha)}</text>}
      </svg>
    </div>
  )
}
