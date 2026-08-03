'use client'
/**
 * PANEL DE CIRUGÍA — valoración perioperatoria en la consulta.
 *  · Riesgo: ASA, RCRI (cardiaco), Caprini (trombosis), Apfel (náusea).
 *  · Profilaxis antibiótica con los momentos de RE-DOSIS intraoperatoria.
 *  · Lista de verificación de la cirugía segura (OMS).
 * Apoyo a la decisión: la indicación la da el médico.
 */
import { useMemo, useState } from 'react'
import { Activity, ClipboardCheck, Plus, Scissors, Syringe } from 'lucide-react'
import {
  ASA, asaTexto, rcri, RCRI_FACTORES,
  caprini, sumarCaprini, CAPRINI_FACTORES,
  apfel, APFEL_FACTORES,
  ANTIBIOTICOS_PROFILAXIS, ESQUEMAS_POR_CIRUGIA, planProfilaxis,
  CHECKLIST_OMS,
} from '@/lib/expediente/cirugia'

interface Props {
  onAgregarANota?: (texto: string) => void
  /** Dentro de la barra de herramientas: sin marco ni título propios. */
  embebido?: boolean
}

type Tab = 'riesgo' | 'profilaxis' | 'checklist'

export function PanelCirugia({ onAgregarANota, embebido }: Props) {
  const [tab, setTab] = useState<Tab>('riesgo')

  // Riesgo
  const [clase, setClase] = useState('II')
  const [urgencia, setUrgencia] = useState(false)
  const [rc, setRc] = useState<Set<string>>(new Set())
  const [cap, setCap] = useState<Set<string>>(new Set())
  const [apf, setApf] = useState<Set<string>>(new Set())

  const rRcri = useMemo(() => rcri(rc.size), [rc])
  const rCap = useMemo(() => caprini(sumarCaprini([...cap])), [cap])
  const rApf = useMemo(() => apfel(apf.size), [apf])

  // Profilaxis
  const [abIdx, setAbIdx] = useState(0)
  const [dur, setDur] = useState('3')
  const plan = useMemo(
    () => planProfilaxis(ANTIBIOTICOS_PROFILAXIS[abIdx], Number(dur) || 0),
    [abIdx, dur],
  )

  // Checklist
  const [hechos, setHechos] = useState<Set<string>>(new Set())

  const alternar = (s: Set<string>, put: (n: Set<string>) => void, v: string) => {
    const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); put(n)
  }

  const capPuntos = sumarCaprini([...cap])

  return (
    <div style={embebido ? {} : { border: '1px solid rgba(59,130,246,.3)', borderRadius: 12, background: 'rgba(59,130,246,.05)', padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
        {!embebido && <>
          <Scissors size={15} color="var(--blue)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>Valoración perioperatoria</span>
        </>}
        <span style={pill('#60a5fa', 'rgba(59,130,246,.15)')}>{asaTexto(clase, urgencia)}</span>
        {rc.size > 0 && <span style={pill(col(rRcri.nivel), bg(rRcri.nivel))}>RCRI {rRcri.puntaje}</span>}
        {capPuntos > 0 && <span style={pill(col(rCap.nivel), bg(rCap.nivel))}>Caprini {capPuntos}</span>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 11, flexWrap: 'wrap' }}>
        <Tb a={tab === 'riesgo'} on={() => setTab('riesgo')} i={<Activity size={13} />} t="Riesgo" />
        <Tb a={tab === 'profilaxis'} on={() => setTab('profilaxis')} i={<Syringe size={13} />} t="Profilaxis antibiótica" />
        <Tb a={tab === 'checklist'} on={() => setTab('checklist')} i={<ClipboardCheck size={13} />} t="Cirugía segura (OMS)" />
      </div>

      {/* ── RIESGO ── */}
      {tab === 'riesgo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Bloque titulo="ASA · estado físico">
            <select value={clase} onChange={e => setClase(e.target.value)} style={{ ...campo, width: '100%' }}>
              {ASA.map(a => <option key={a.clase} value={a.clase}>ASA {a.clase} — {a.titulo}</option>)}
            </select>
            <p style={{ fontSize: 11, color: 'var(--text3)', margin: '6px 0 0', lineHeight: 1.5 }}>
              {ASA.find(a => a.clase === clase)?.ejemplos}
            </p>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 7, cursor: 'pointer' }}>
              <input type="checkbox" checked={urgencia} onChange={e => setUrgencia(e.target.checked)} />
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Cirugía de urgencia (agrega el modificador E)</span>
            </label>
          </Bloque>

          <Bloque titulo={`RCRI · riesgo cardiaco — ${rRcri.puntaje}/6`}>
            <Opciones items={RCRI_FACTORES} sel={rc} on={v => alternar(rc, setRc, v)} color="var(--blue)" />
            <Resultado nivel={rRcri.nivel} titulo={`RCRI ${rRcri.puntaje} — ${rRcri.categoria}`} texto={rRcri.interpretacion} cita="Lee, Circulation 1999 · ACC/AHA"
              onNota={onAgregarANota && (() => onAgregarANota(`RCRI ${rRcri.puntaje}/6 — ${rRcri.categoria}. ${rRcri.interpretacion}`))} />
          </Bloque>

          <Bloque titulo={`Caprini · riesgo de trombosis — ${capPuntos} puntos`}>
            <Pesos sel={cap} on={v => alternar(cap, setCap, v)} />
            <Resultado nivel={rCap.nivel} titulo={`Caprini ${capPuntos} — ${rCap.categoria}`} texto={rCap.profilaxis} cita="Caprini · ACCP"
              onNota={onAgregarANota && (() => onAgregarANota(`Caprini ${capPuntos} puntos — ${rCap.categoria}. ${rCap.profilaxis}`))} />
          </Bloque>

          <Bloque titulo={`Apfel · náusea y vómito postoperatorios — ${rApf.puntaje}/4`}>
            <Opciones items={APFEL_FACTORES} sel={apf} on={v => alternar(apf, setApf, v)} color="var(--blue)" />
            <Resultado nivel={rApf.puntaje <= 1 ? 'bajo' : rApf.puntaje === 2 ? 'medio' : 'alto'}
              titulo={`Apfel ${rApf.puntaje}/4 — riesgo aproximado ${rApf.riesgo}%`} texto={rApf.conducta} cita="Apfel, Anesthesiology 1999"
              onNota={onAgregarANota && (() => onAgregarANota(`Apfel ${rApf.puntaje}/4 (riesgo aproximado de NVPO ${rApf.riesgo}%). ${rApf.conducta}`))} />
          </Bloque>
        </div>
      )}

      {/* ── PROFILAXIS ── */}
      {tab === 'profilaxis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Bloque titulo="Esquema según el tipo de cirugía">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
              {ESQUEMAS_POR_CIRUGIA.map(e => (
                <div key={e.cirugia} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--s1)', padding: '8px 11px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{e.cirugia}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--blue)', marginTop: 2 }}>{e.esquema}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Alergia a betalactámicos: {e.alergia}</div>
                </div>
              ))}
            </div>
          </Bloque>

          <Bloque titulo="Dosis, momento y RE-DOSIS intraoperatoria">
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 9 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 190 }}>
                <span style={rotulo}>Antibiótico</span>
                <select value={abIdx} onChange={e => setAbIdx(Number(e.target.value))} style={{ ...campo, width: '100%' }}>
                  {ANTIBIOTICOS_PROFILAXIS.map((a, i) => <option key={a.nombre} value={i}>{a.nombre}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={rotulo}>Duración estimada (horas)</span>
                <input type="number" min="0" step="0.5" value={dur} onChange={e => setDur(e.target.value)} style={{ ...campo, width: 110 }} />
              </label>
            </div>

            <div style={{ border: '1px solid rgba(59,130,246,.35)', background: 'rgba(59,130,246,.08)', borderRadius: 9, padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--blue)' }}>{plan.antibiotico} — {plan.dosis}</div>
              <ul style={{ margin: '7px 0 0', paddingLeft: 17, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                <li>{plan.inicio}</li>
                <li><b style={{ color: plan.momentosRedosis.length ? '#f59e0b' : 'inherit' }}>{plan.redosis}</b></li>
                <li>{plan.duracion}</li>
                {plan.nota && <li style={{ color: 'var(--text3)' }}>{plan.nota}</li>}
              </ul>
              {onAgregarANota && (
                <button type="button" style={{ ...btnMini, marginTop: 8 }} onClick={() => onAgregarANota(
                  `Profilaxis antibiótica: ${plan.antibiotico} ${plan.dosis}. ${plan.inicio} ${plan.redosis} ${plan.duracion}`
                )}><Plus size={12} /> Agregar a la nota</button>
              )}
            </div>
          </Bloque>
        </div>
      )}

      {/* ── CHECKLIST ── */}
      {tab === 'checklist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CHECKLIST_OMS.map(f => {
            const total = f.puntos.length
            const listos = f.puntos.filter(p => hechos.has(p)).length
            return (
              <Bloque key={f.fase} titulo={`${f.fase} · ${f.momento}`} extra={
                <span style={pill(listos === total ? '#10b981' : 'var(--text3)', listos === total ? 'rgba(16,185,129,.15)' : 'var(--s2)')}>
                  {listos}/{total}
                </span>
              }>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {f.puntos.map(p => (
                    <label key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, cursor: 'pointer' }}>
                      <input type="checkbox" checked={hechos.has(p)} onChange={() => alternar(hechos, setHechos, p)} style={{ marginTop: 2 }} />
                      <span style={{ fontSize: 12, color: hechos.has(p) ? 'var(--text3)' : 'var(--text2)', lineHeight: 1.45, textDecoration: hechos.has(p) ? 'line-through' : 'none' }}>{p}</span>
                    </label>
                  ))}
                </div>
              </Bloque>
            )
          })}
          {onAgregarANota && (
            <button type="button" style={btnMini} onClick={() => {
              const resumen = CHECKLIST_OMS.map(f => {
                const l = f.puntos.filter(p => hechos.has(p)).length
                return `${f.fase}: ${l}/${f.puntos.length}`
              }).join(' · ')
              onAgregarANota(`Lista de verificación de la cirugía segura (OMS) — ${resumen}.`)
            }}><Plus size={12} /> Agregar el avance a la nota</button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── piezas ── */

function Bloque({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text2)', letterSpacing: 0.2 }}>{titulo}</span>
        {extra}
      </div>
      {children}
    </div>
  )
}

function Opciones({ items, sel, on, color }: { items: string[]; sel: Set<string>; on: (v: string) => void; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map(i => (
        <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, cursor: 'pointer' }}>
          <input type="checkbox" checked={sel.has(i)} onChange={() => on(i)} style={{ marginTop: 2, accentColor: color }} />
          <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.45 }}>{i}</span>
        </label>
      ))}
    </div>
  )
}

/** Caprini agrupado por peso: el puntaje de cada factor es la información clave. */
function Pesos({ sel, on }: { sel: Set<string>; on: (v: string) => void }) {
  const grupos: [number, string][] = [[5, '5 puntos'], [3, '3 puntos'], [2, '2 puntos'], [1, '1 punto']]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
      {grupos.map(([p, etq]) => (
        <div key={p}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: p >= 3 ? '#f87171' : p === 2 ? '#f59e0b' : 'var(--text3)', marginBottom: 3 }}>{etq}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {CAPRINI_FACTORES.filter(f => f.puntos === p).map(f => (
              <label key={f.texto} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, cursor: 'pointer' }}>
                <input type="checkbox" checked={sel.has(f.texto)} onChange={() => on(f.texto)} style={{ marginTop: 2 }} />
                <span style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.4 }}>{f.texto}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Resultado({ nivel, titulo, texto, cita, onNota }: {
  nivel: 'bajo' | 'medio' | 'alto'; titulo: string; texto: string; cita: string; onNota?: () => void
}) {
  return (
    <div style={{ marginTop: 8, padding: '9px 11px', borderRadius: 9, border: `1px solid ${bd(nivel)}`, background: bg(nivel) }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: col(nivel) }}>{titulo}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3, lineHeight: 1.5 }}>{texto}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>{cita}</div>
      {onNota && <button type="button" style={{ ...btnMini, marginTop: 7 }} onClick={onNota}><Plus size={12} /> Agregar a la nota</button>}
    </div>
  )
}

function Tb({ a, on, i, t }: { a: boolean; on: () => void; i: React.ReactNode; t: string }) {
  return (
    <button type="button" onClick={on} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7,
      fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
      border: '1px solid ' + (a ? '#3b82f6' : 'var(--border)'),
      background: a ? '#3b82f6' : 'var(--s2)', color: a ? '#fff' : 'var(--text3)',
    }}>{i}{t}</button>
  )
}

const col = (n: 'bajo' | 'medio' | 'alto') => n === 'bajo' ? '#10b981' : n === 'medio' ? '#f59e0b' : '#f87171'
const bg = (n: 'bajo' | 'medio' | 'alto') => n === 'bajo' ? 'rgba(16,185,129,.1)' : n === 'medio' ? 'color-mix(in srgb, var(--amber) 10%, transparent)' : 'color-mix(in srgb, var(--red) 10%, transparent)'
const bd = (n: 'bajo' | 'medio' | 'alto') => n === 'bajo' ? 'rgba(16,185,129,.35)' : n === 'medio' ? 'color-mix(in srgb, var(--amber) 35%, transparent)' : 'color-mix(in srgb, var(--red) 40%, transparent)'

const pill = (fg: string, fondo: string): React.CSSProperties => ({
  fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 'var(--r-pill)', background: fondo, color: fg,
})
const rotulo: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: 0.3 }
const campo: React.CSSProperties = {
  background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '6px 9px', fontSize: 12, color: 'var(--text)', outline: 'none',
}
const btnMini: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(59,130,246,.15)',
  color: 'var(--blue)', border: '1px solid rgba(59,130,246,.35)', borderRadius: 6,
  padding: '4px 10px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start',
}
