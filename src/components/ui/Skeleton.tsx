/**
 * Skeletons de carga — velocidad PERCIBIDA (hallazgo de producto: sin estados de
 * carga la app "se siente hecha en casa"). Se usan en los loading.tsx por ruta:
 * Next.js los muestra al instante durante la navegación, antes de que los datos
 * lleguen. Respeta prefers-reduced-motion (el shimmer se desactiva).
 */
import type { CSSProperties } from 'react'

const base: CSSProperties = {
  background: 'linear-gradient(90deg, var(--s2) 25%, var(--s3) 37%, var(--s2) 63%)',
  backgroundSize: '400% 100%',
  animation: 'shimmer 1.4s ease infinite',
  borderRadius: 8,
}

export function Skeleton({ w = '100%', h = 16, r = 8, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <div aria-hidden style={{ ...base, width: w, height: h, borderRadius: r, ...style }} />
}

/** Página genérica de carga: encabezado + fila de tarjetas + lista. */
export function SkeletonPage() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }} aria-busy="true" aria-label="Cargando…">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton w={220} h={26} />
        <Skeleton w={320} h={14} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skeleton w={90} h={12} />
            <Skeleton w={70} h={26} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10 }}>
            <Skeleton w={40} h={40} r={20} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton w="45%" h={13} />
              <Skeleton w="70%" h={11} />
            </div>
            <Skeleton w={64} h={22} r={999} />
          </div>
        ))}
      </div>
    </div>
  )
}
