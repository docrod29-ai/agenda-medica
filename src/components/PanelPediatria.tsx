'use client'
/**
 * PANEL DE PEDIATRÍA — aparece solo si el paciente es menor de edad.
 *  · Dosis por peso con TOPE de adulto (el error más peligroso en pediatría).
 *  · Esquema de vacunación de México con detección de atrasos.
 * Apoyo a la decisión: la dosis final la ajusta el médico.
 */
import { useMemo, useState } from 'react'
import { Baby, Syringe, Pill, Plus, AlertTriangle } from 'lucide-react'
import {
  FARMACOS_PED, calcularDosisPediatrica, vacunasSegunEdad, imc,
} from '@/lib/expediente/pediatria'

interface Props {
  /** Edad del paciente en años (si es ≥ 18 el panel no se muestra). */
  edadAnios?: number
  onAgregarANota?: (texto: string) => void
}

export function PanelPediatria({ edadAnios, onAgregarANota }: Props) {
  const [tab, setTab] = useState<'dosis' | 'vacunas'>('dosis')
  const [peso, setPeso] = useState('')
  const [talla, setTalla] = useState('')
  const [meses, setMeses] = useState(edadAnios != null ? String(Math.round(edadAnios * 12)) : '')
  const [busca, setBusca] = useState('')

  const pesoKg = Number(peso)
  const edadMeses = Number(meses)

  const dosis = useMemo(() => {
    if (!(pesoKg > 0)) return []
    const q = busca.trim().toLowerCase()
    return FARMACOS_PED
      .filter(f => !q || f.nombre.toLowerCase().includes(q))
      .map(f => calcularDosisPediatrica(f, pesoKg))
      .filter(Boolean)
  }, [pesoKg, busca])

  const vacunas = useMemo(
    () => (edadMeses >= 0 && meses !== '' ? vacunasSegunEdad(edadMeses) : []),
    [edadMeses, meses],
  )
  const atrasadas = vacunas.filter(v => v.estado === 'atrasada')
  const indice = useMemo(() => (pesoKg > 0 && Number(talla) > 0 ? imc(pesoKg, Number(talla)) : null), [pesoKg, talla])

  if (edadAnios != null && edadAnios >= 18) return null

  return (
    <div style={{ border: '1px solid rgba(139,92,246,.3)', borderRadius: 12, background: 'rgba(139,92,246,.05)', padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <Baby size={15} color="#a78bfa" />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>Pediatría</span>
        {atrasadas.length > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 100, background: 'rgba(239,68,68,.15)', color: '#f87171' }}>
            {atrasadas.length} vacuna{atrasadas.length > 1 ? 's' : ''} atrasada{atrasadas.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Datos base */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Campo label="Peso (kg)" valor={peso} set={setPeso} />
        <Campo label="Talla (cm)" valor={talla} set={setTalla} />
        <Campo label="Edad (meses)" valor={meses} set={setMeses} />
        {indice != null && Number.isFinite(indice) && (
          <div style={{ alignSelf: 'flex-end', fontSize: 11.5, color: 'var(--text2)', paddingBottom: 6 }}>
            IMC <b style={{ color: 'var(--text)' }}>{indice}</b>
            <span style={{ color: 'var(--text3)' }}> — interpretar por percentil para edad y sexo, no por cortes de adulto</span>
          </div>
        )}
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <Tab activo={tab === 'dosis'} onClick={() => setTab('dosis')} icono={<Pill size={13} />} texto="Dosis por peso" />
        <Tab activo={tab === 'vacunas'} onClick={() => setTab('vacunas')} icono={<Syringe size={13} />} texto="Vacunación" />
      </div>

      {tab === 'dosis' && (
        <div>
          {!(pesoKg > 0) ? (
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Captura el peso para calcular las dosis.</p>
          ) : (
            <>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar fármaco…"
                style={{ ...campoBase, width: '100%', marginBottom: 8 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                {dosis.map(d => d && (
                  <div key={d.farmaco} style={{ border: '1px solid var(--border)', borderRadius: 9, background: 'var(--s1)', padding: '9px 11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{d.farmaco}</span>
                      <span style={{ fontSize: 12.5, color: '#a78bfa', fontWeight: 700 }}>
                        {d.porToma.min === d.porToma.max ? d.porToma.max : `${d.porToma.min}–${d.porToma.max}`} {d.unidad} {d.intervalo}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        (total {d.porDia.min === d.porDia.max ? d.porDia.max : `${d.porDia.min}–${d.porDia.max}`} {d.unidad}/día)
                      </span>
                      {d.topeAplicado && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 100, background: 'rgba(245,158,11,.15)', color: '#f59e0b' }}>
                          <AlertTriangle size={11} /> tope de adulto
                        </span>
                      )}
                      {onAgregarANota && (
                        <button type="button" onClick={() => onAgregarANota(
                          `${d.farmaco} ${d.porToma.min === d.porToma.max ? d.porToma.max : `${d.porToma.min}-${d.porToma.max}`} ${d.unidad} ${d.intervalo} (peso ${pesoKg} kg).`
                        )} style={btnMini}><Plus size={12} /> Nota</button>
                      )}
                    </div>
                    {d.nota && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.45 }}>{d.nota}</div>}
                  </div>
                ))}
                {dosis.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)' }}>Sin coincidencias.</p>}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'vacunas' && (
        <div>
          {meses === '' ? (
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Captura la edad en meses para revisar el esquema.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 340, overflowY: 'auto' }}>
              {vacunas.map((v, i) => (
                <div key={i} style={{
                  border: '1px solid ' + (v.estado === 'atrasada' ? 'rgba(239,68,68,.35)' : 'var(--border)'),
                  background: v.estado === 'atrasada' ? 'rgba(239,68,68,.08)' : 'var(--s1)',
                  borderRadius: 9, padding: '8px 11px', opacity: v.estado === 'pendiente' ? 0.6 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{v.vacuna.nombre}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {v.vacuna.mes === 0 ? 'al nacer' : v.vacuna.mes < 24 ? `${v.vacuna.mes} meses` : `${v.vacuna.mes / 12} años`}
                    </span>
                    {v.estado === 'atrasada' && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 100, background: 'rgba(239,68,68,.15)', color: '#f87171' }}>ATRASADA</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, lineHeight: 1.45 }}>{v.vacuna.detalle}</div>
                </div>
              ))}
              {onAgregarANota && atrasadas.length > 0 && (
                <button type="button" onClick={() => onAgregarANota(
                  `Esquema de vacunación incompleto para la edad. Pendientes/atrasadas: ${atrasadas.map(a => `${a.vacuna.nombre} (${a.vacuna.mes} m)`).join(', ')}. Se indica regularización.`
                )} style={{ ...btnMini, alignSelf: 'flex-start', marginTop: 4 }}>
                  <Plus size={12} /> Agregar atrasos a la nota
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Campo({ label, valor, set }: { label: string; valor: string; set: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>{label}</span>
      <input type="number" inputMode="decimal" value={valor} onChange={e => set(e.target.value)}
        style={{ ...campoBase, width: 96 }} />
    </label>
  )
}

function Tab({ activo, onClick, icono, texto }: { activo: boolean; onClick: () => void; icono: React.ReactNode; texto: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7,
      fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
      border: '1px solid ' + (activo ? '#8b5cf6' : 'var(--border)'),
      background: activo ? '#8b5cf6' : 'var(--s2)', color: activo ? '#fff' : 'var(--text3)',
    }}>{icono}{texto}</button>
  )
}

const campoBase: React.CSSProperties = {
  background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '5px 8px', fontSize: 12, color: 'var(--text)', outline: 'none',
}
const btnMini: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(139,92,246,.15)',
  color: '#a78bfa', border: '1px solid rgba(139,92,246,.35)', borderRadius: 6,
  padding: '3px 9px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
}
