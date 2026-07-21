'use client'
/**
 * TABLA FUNCIONAL DE IA POR NIVEL — transparencia clínica.
 *
 * Los planes venden "Rápida / Estándar / Máxima" (nombre comercial), pero el
 * médico necesita saber QUÉ CAMBIA CLÍNICAMENTE, no solo el precio. Esta tabla
 * lee la fuente única (MOTORES en planes-ia) y la muestra en /precios y en el
 * selector de la nota. Si mañana cambia un nivel, la tabla cambia sola.
 */
import { MOTORES, type ClaveMotor } from '@/lib/planes-ia'
import { Check } from 'lucide-react'

const ORDEN: ClaveMotor[] = ['rapida', 'estandar', 'maxima']

export function TablaNivelesIA({ compacto = false }: { compacto?: boolean }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compacto ? 12.5 : 13.5, minWidth: 560 }}>
        <thead>
          <tr>
            <th style={th}>Nivel</th>
            <th style={th}>Uso recomendado</th>
            <th style={th}>Qué incluye clínicamente</th>
            {!compacto && <th style={{ ...th, textAlign: 'right' }}>Créditos · latencia</th>}
          </tr>
        </thead>
        <tbody>
          {ORDEN.map(c => {
            const m = MOTORES[c]
            return (
              <tr key={c}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 15 }}>{m.emoji}</span>{' '}
                  <strong style={{ color: 'var(--text)' }}>{m.nombre}</strong>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.modelos}</div>
                </td>
                <td style={{ ...td, color: 'var(--text2)' }}>{m.usoRecomendado}</td>
                <td style={td}>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
                    {m.incluye.map((x, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--text2)' }}>
                        <Check size={13} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 2 }} /> {x}
                      </li>
                    ))}
                  </ul>
                </td>
                {!compacto && (
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text3)' }}>
                    <div><strong style={{ color: 'var(--text)' }}>{m.creditos}</strong> créd.</div>
                    <div style={{ fontSize: 11 }}>{m.latencia}</div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border)',
  fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text3)', fontWeight: 700,
  background: 'var(--s1, rgba(127,127,127,0.05))',
}
const td: React.CSSProperties = {
  padding: '11px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'top',
}
