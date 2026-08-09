'use client'
/**
 * DOSIFICACIÓN DE MEROPENEM EN EL ADULTO CRÍTICO — la pantalla del motor.
 *
 * ── POR QUÉ EXISTE ESTE ARCHIVO ──────────────────────────────────────────────
 *
 * `lib/uci/dosificacion-critica.ts` estaba escrito, probado y **sin un solo
 * llamador**: el algoritmo que el Dr. dictó el 30 de julio no se podía usar
 * desde ninguna pantalla. Un motor sin puerta de entrada es documentación cara.
 *
 * ── LO QUE ESTA PANTALLA NO HACE ─────────────────────────────────────────────
 *
 * No elige. Enseña **las dos columnas** —convencional y alta exposición—, dice
 * qué criterios de alta exposición se cumplen en este paciente, y deja la
 * decisión donde vive: en quien está en la cabecera. Tampoco calcula nada por su
 * cuenta: todo lo decide el motor, que es puro y está probado.
 *
 * Si falta el dato que decide la fila, no propone: dice qué falta.
 */
import { useState } from 'react'
import { Syringe, Info, AlertTriangle } from 'lucide-react'
import {
  esquemaMeropenem, MODALIDADES_RENALES, MODALIDAD_LABEL,
  CRITERIOS_ALTA_EXPOSICION, CRITERIO_LABEL, NO_ELIJO_COLUMNA,
  type ModalidadRenal, type CriterioAltaExposicion,
} from '@/lib/uci/dosificacion-critica'

const card: React.CSSProperties = {
  background: 'var(--s1)', border: '1px solid var(--border)',
  borderRadius: 14, padding: 16, marginBottom: 16,
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--text3)', marginBottom: 5,
}
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 9,
  border: '1px solid var(--border)', background: 'var(--s2)',
  color: 'var(--text)', fontSize: 14, minHeight: 40,
}

export function DosisMeropenem({ crClSugerido }: { crClSugerido?: number | null }) {
  // El CrCl del panel entra como SUGERENCIA editable: el del panel puede ser de
  // hace horas, y la dosis se decide con el de ahora.
  const [crCl, setCrCl] = useState(crClSugerido != null ? String(Math.round(crClSugerido)) : '')
  const [modalidad, setModalidad] = useState<ModalidadRenal>('ninguna')
  const [criterios, setCriterios] = useState<CriterioAltaExposicion[]>([])
  const [mic, setMic] = useState('')
  const [tdm, setTdm] = useState(false)

  const num = (s: string) => (s.trim() === '' ? null : Number(s))
  const r = esquemaMeropenem({
    crCl: num(crCl), modalidad, criterios,
    mic: num(mic), tdm,
  })

  const alternar = (c: CriterioAltaExposicion) =>
    setCriterios(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]))

  return (
    <div style={card}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Syringe size={16} style={{ color: 'var(--nexus,#3D5AFE)' }} /> Meropenem en el adulto crítico
      </h2>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 14px', lineHeight: 1.6 }}>
        Algoritmo del Dr. (2026-07-30). El orden es foco y gravedad → CrCl → ARC →
        modalidad renal → MIC → dosis → infusión → TDM. Sólo meropenem: los demás
        fármacos no están y no se infieren.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(150px, 100%),1fr))', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={lbl} htmlFor="mero-crcl">CrCl (mL/min)</label>
          <input
            id="mero-crcl" type="number" inputMode="decimal" min={0}
            value={crCl} onChange={e => setCrCl(e.target.value)}
            placeholder="—" style={inp}
          />
        </div>
        <div>
          <label style={lbl} htmlFor="mero-modalidad">Terapia de reemplazo renal</label>
          <select id="mero-modalidad" value={modalidad} onChange={e => setModalidad(e.target.value as ModalidadRenal)} style={inp}>
            {MODALIDADES_RENALES.map(m => (
              <option key={m} value={m}>{MODALIDAD_LABEL[m]}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl} htmlFor="mero-mic">MIC del germen (mg/L)</label>
          <input
            id="mero-mic" type="number" inputMode="decimal" min={0} step="any"
            value={mic} onChange={e => setMic(e.target.value)}
            placeholder="—" style={inp}
          />
        </div>
      </div>

      <fieldset style={{ border: '1px solid var(--border)', borderRadius: 11, padding: '10px 12px', margin: '0 0 12px' }}>
        <legend style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', padding: '0 6px' }}>
          Criterios de alta exposición presentes
        </legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {CRITERIOS_ALTA_EXPOSICION.map(c => (
            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', minHeight: 32, cursor: 'pointer' }}>
              <input type="checkbox" checked={criterios.includes(c)} onChange={() => alternar(c)} />
              {CRITERIO_LABEL[c]}
            </label>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', minHeight: 32, cursor: 'pointer' }}>
            <input type="checkbox" checked={tdm} onChange={e => setTdm(e.target.checked)} />
            Hay monitorización de concentraciones (TDM)
          </label>
        </div>
      </fieldset>

      {r.faltan.length > 0 && (
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: 'var(--s2)', border: '1px dashed var(--border)', borderRadius: 11, padding: '11px 13px', marginBottom: 12 }}>
          <Info size={15} style={{ color: 'var(--text3)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6 }}>
            <strong>No se propone esquema.</strong> Falta: {r.faltan.join(' · ')}
          </div>
        </div>
      )}

      {r.esquema && (
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 380 }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12 }}>Convencional</th>
                <th scope="col" style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12 }}>Alta exposición</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px', verticalAlign: 'top', color: 'var(--text)', fontWeight: 600 }}>{r.esquema.convencional}</td>
                <td style={{ padding: '10px', verticalAlign: 'top', color: 'var(--text)', fontWeight: 600 }}>{r.esquema.altaExposicion}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6, marginTop: 8 }}>
            <div><strong>Infusión:</strong> {r.esquema.infusion}</div>
            <div style={{ marginTop: 3 }}>{r.esquema.fuente}</div>
          </div>
        </div>
      )}

      {r.criteriosPresentes.length > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6, marginBottom: 10 }}>
          <strong>Criterios de alta exposición que se cumplen:</strong>{' '}
          {r.criteriosPresentes.map(c => CRITERIO_LABEL[c]).join(' · ')}
        </div>
      )}

      {r.avisos.map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: 'color-mix(in srgb, var(--amber) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)', borderRadius: 11, padding: '11px 13px', marginBottom: 8 }}>
          <AlertTriangle size={15} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6 }}>{a}</div>
        </div>
      ))}

      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        {NO_ELIJO_COLUMNA}
      </div>
    </div>
  )
}
