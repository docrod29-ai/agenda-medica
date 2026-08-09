'use client'
/**
 * PANEL DE RAZONAMIENTO — la cadena de 12 pasos, visible, con provenance e
 * incertidumbre. Es la cara del Clinical Reasoning Engine: el médico ve QUÉ pensó
 * el sistema, DE DÓNDE salió y CON CUÁNTA certeza — no una caja negra.
 */
import { useMemo, useState } from 'react'
import { construirTraza, resumenTraza, type EntradaCopiloto, type PasoRazonamiento, type FuenteRazon, type ConfianzaRazon } from '@/lib/expediente/razonamiento'
import { Brain, ChevronDown, CircleCheck, CircleAlert, CircleHelp, CircleDashed, Info } from 'lucide-react'

// nota: construirTraza importa EntradaCopiloto de razonamiento (re-export)
type Props = { entrada: EntradaCopiloto; embebido?: boolean }

const FUENTE_LABEL: Record<FuenteRazon, string> = {
  determinista: 'Regla con código', modelo: 'IA', evidencia: 'PubMed', meta: 'Sistema',
}
const FUENTE_COLOR: Record<FuenteRazon, string> = {
  determinista: 'var(--teal)', modelo: 'var(--nexus,#3D5AFE)', evidencia: '#a855f7', meta: 'var(--text3)',
}
const CONF_LABEL: Record<ConfianzaRazon, string> = { alta: 'Alta', media: 'Media', baja: 'Baja', na: '—' }

function icono(estado: PasoRazonamiento['estado']) {
  const s = 15
  if (estado === 'ok') return <CircleCheck size={s} style={{ color: 'var(--teal)' }} />
  if (estado === 'alerta') return <CircleAlert size={s} style={{ color: 'var(--red)' }} />
  if (estado === 'faltante') return <CircleHelp size={s} style={{ color: 'var(--amber)' }} />
  if (estado === 'pendiente') return <CircleDashed size={s} style={{ color: 'var(--text3)' }} />
  return <CircleDashed size={s} style={{ color: 'var(--text3)', opacity: 0.5 }} />
}

export function PanelRazonamiento({ entrada, embebido }: Props) {
  const traza = useMemo(() => construirTraza(entrada), [entrada])
  const r = useMemo(() => resumenTraza(traza), [traza])
  const [abierto, setAbierto] = useState<number | null>(null)

  return (
    <div style={embebido ? {} : { border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1,rgba(127,127,127,.04))', padding: 14 }}>
      {!embebido && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Brain size={15} style={{ color: 'var(--nexus,#3D5AFE)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Razonamiento clínico</span>
        </div>
      )}
      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span><CircleCheck size={11} style={{ color: 'var(--teal)', verticalAlign: -1 }} /> {r.ok} ok</span>
        {r.alertas > 0 && <span style={{ color: 'var(--red)' }}><CircleAlert size={11} style={{ verticalAlign: -1 }} /> {r.alertas} alerta{r.alertas > 1 ? 's' : ''}</span>}
        {r.faltantes > 0 && <span style={{ color: 'var(--amber)' }}><CircleHelp size={11} style={{ verticalAlign: -1 }} /> {r.faltantes} por completar</span>}
      </div>

      <div style={{ display: 'grid', gap: 2 }}>
        {traza.map(p => {
          const tieneDetalle = !!(p.hallazgos && p.hallazgos.length) || p.detalle
          const exp = abierto === p.n
          return (
            <div key={p.n} style={{ border: '1px solid var(--border)', borderRadius: 9, background: 'var(--bg)', overflow: 'hidden' }}>
              <button
                onClick={() => setAbierto(exp ? null : p.n)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', width: 16, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{p.n}</span>
                {icono(p.estado)}
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{p.titulo}</span>
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.02em', padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'rgba(127,127,127,.1)', color: FUENTE_COLOR[p.fuente], whiteSpace: 'nowrap' }}>
                  {FUENTE_LABEL[p.fuente]}
                </span>
                {p.confianza !== 'na' && (
                  <span style={{ fontSize: 9.5, color: 'var(--text3)', whiteSpace: 'nowrap' }} title="Confianza / incertidumbre">
                    conf. {CONF_LABEL[p.confianza]}
                  </span>
                )}
                {tieneDetalle && <ChevronDown size={13} style={{ color: 'var(--text3)', transform: exp ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />}
              </button>
              {exp && (
                <div style={{ padding: '0 11px 11px 36px', fontSize: 12, color: 'var(--text2)', lineHeight: 1.55 }}>
                  {p.detalle}
                  {p.hallazgos && p.hallazgos.length > 0 && (
                    <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
                      {p.hallazgos.map((h, i) => (
                        <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ color: h.nivel === 'critico' ? 'var(--red)' : h.nivel === 'accion' ? 'var(--amber)' : 'var(--text3)', flexShrink: 0 }}>•</span>
                          {h.titulo}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, fontSize: 10.5, color: 'var(--text3)' }}>
        <Info size={11} /> Cada paso muestra su origen y su confianza. Lo determinista corre con código; la IA se marca; la evidencia se verifica contra PubMed.
      </div>
    </div>
  )
}
