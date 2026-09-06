'use client'
/**
 * PANEL PREVENTIVO — qué tamizaje le toca a ESTE paciente por edad y sexo,
 * y análisis de tendencia de un laboratorio a lo largo del tiempo.
 */
import { useMemo, useState } from 'react'
import { CalendarCheck, LineChart, Plus, ShieldCheck } from 'lucide-react'
import {
  tamizajesPara, tamizajesProximos, ADVERTENCIA_PREVENTIVO,
  analizarTendencia, alertaDeTendencia, type PuntoLab,
} from '@/lib/expediente/preventivo'

interface Props {
  edad?: number
  sexo?: string
  onAgregarANota?: (texto: string) => void
  embebido?: boolean
}

export function PanelPreventivo({ edad, sexo, onAgregarANota, embebido }: Props) {
  const [tab, setTab] = useState<'tamizaje' | 'tendencia'>('tamizaje')
  const esMujer = !!sexo && /^f/i.test(sexo)

  const tocan = useMemo(() => (edad != null ? tamizajesPara(edad, esMujer) : []), [edad, esMujer])
  const proximos = useMemo(() => (edad != null ? tamizajesProximos(edad, esMujer) : []), [edad, esMujer])
  const vigentes = tocan.filter(t => !t.vencido)

  // Tendencia
  const [analito, setAnalito] = useState('Creatinina')
  const [unidad, setUnidad] = useState('mg/dL')
  const [puntos, setPuntos] = useState<PuntoLab[]>([
    { fecha: '', valor: NaN }, { fecha: '', valor: NaN },
  ])
  const validos = puntos.filter(p => p.fecha && Number.isFinite(p.valor))
  const tend = useMemo(() => analizarTendencia(validos, unidad), [validos, unidad])
  const alerta = useMemo(() => (tend ? alertaDeTendencia(analito, tend) : null), [analito, tend])

  const setPunto = (i: number, campo: 'fecha' | 'valor', v: string) =>
    setPuntos(p => p.map((x, j) => (j === i ? { ...x, [campo]: campo === 'valor' ? Number(v) : v } : x)))

  return (
    <div style={embebido ? {} : { border: '1px solid color-mix(in srgb, var(--blue) 30%, transparent)', borderRadius: 12, background: 'color-mix(in srgb, var(--blue) 5%, transparent)', padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 11 }}>
        <Tb a={tab === 'tamizaje'} on={() => setTab('tamizaje')} i={<ShieldCheck size={13} />} t={`Tamizajes (${vigentes.length})`} />
        <Tb a={tab === 'tendencia'} on={() => setTab('tendencia')} i={<LineChart size={13} />} t="Tendencia de laboratorio" />
      </div>

      {tab === 'tamizaje' && (
        <div>
          {edad == null ? (
            <p style={txt}>Falta la edad del paciente en el expediente.</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 330, overflowY: 'auto' }}>
                {vigentes.map(t => (
                  <div key={t.prueba} style={{ border: '1px solid var(--border)', borderRadius: 9, background: 'var(--s1)', padding: '8px 11px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{t.prueba}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--blue)', marginTop: 2 }}>{t.frecuencia}</div>
                    {t.condicion && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 2 }}>Solo si: {t.condicion}</div>}
                    {t.nota && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, lineHeight: 1.45 }}>{t.nota}</div>}
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, fontStyle: 'italic' }}>{t.organismo}</div>
                  </div>
                ))}
                {tocan.filter(t => t.vencido).map(t => (
                  <div key={t.prueba} style={{ border: '1px solid var(--border)', borderRadius: 9, background: 'var(--s1)', padding: '7px 11px', opacity: .55 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t.prueba} — fuera de la ventana de edad</span>
                  </div>
                ))}
              </div>

              {proximos.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 5 }}>Empieza en los próximos 5 años</div>
                  {proximos.map(t => (
                    <div key={t.prueba} style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                      {t.prueba} — a partir de los {t.desde} años
                    </div>
                  ))}
                </div>
              )}

              {onAgregarANota && vigentes.length > 0 && (
                <button type="button" style={{ ...btn, marginTop: 10 }} onClick={() => onAgregarANota(
                  `Tamizajes que corresponden por edad y sexo: ${vigentes.map(t => `${t.prueba} (${t.frecuencia})`).join('; ')}.`
                )}><Plus size={12} /> Agregar a la nota</button>
              )}

              <p style={{ ...txt, color: 'var(--amber)', marginTop: 10, fontSize: 10.5 }}>{ADVERTENCIA_PREVENTIVO}</p>
            </>
          )}
        </div>
      )}

      {tab === 'tendencia' && (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
            <label style={campoWrap}>
              <span style={rot}>Analito</span>
              <input value={analito} onChange={e => setAnalito(e.target.value)} style={{ ...campo, width: 170 }} />
            </label>
            <label style={campoWrap}>
              <span style={rot}>Unidad</span>
              <input value={unidad} onChange={e => setUnidad(e.target.value)} style={{ ...campo, width: 90 }} />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {puntos.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="date" value={p.fecha} onChange={e => setPunto(i, 'fecha', e.target.value)} style={{ ...campo, width: 150 }} />
                <input type="number" inputMode="decimal" placeholder="valor"
                  value={Number.isFinite(p.valor) ? String(p.valor) : ''}
                  onChange={e => setPunto(i, 'valor', e.target.value)} style={{ ...campo, width: 100 }} />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setPuntos(p => [...p, { fecha: '', valor: NaN }])}
            style={{ ...btn, marginTop: 8 }}>+ Agregar resultado</button>

          {tend && (
            <div style={{
              marginTop: 11, padding: '10px 12px', borderRadius: 9,
              border: `1px solid ${alerta ? 'color-mix(in srgb, var(--red) 40%, transparent)' : 'color-mix(in srgb, var(--blue) 35%, transparent)'}`,
              background: alerta ? 'color-mix(in srgb, var(--red) 10%, transparent)' : 'color-mix(in srgb, var(--blue) 8%, transparent)',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: alerta ? 'var(--red)' : 'var(--blue)' }}>
                {analito}: {tend.resumen}
              </div>
              {alerta && <p style={{ ...txt, fontWeight: 700, color: 'var(--red)' }}>{alerta}</p>}
              {onAgregarANota && (
                <button type="button" style={{ ...btn, marginTop: 8 }} onClick={() => onAgregarANota(
                  `${analito}: ${tend.resumen}${alerta ? ` ${alerta}` : ''}`
                )}><Plus size={12} /> Agregar a la nota</button>
              )}
            </div>
          )}
          {!tend && validos.length < 2 && (
            <p style={{ ...txt, marginTop: 9 }}>Captura al menos dos resultados con su fecha para ver la tendencia.</p>
          )}
        </div>
      )}
    </div>
  )
}

function Tb({ a, on, i, t }: { a: boolean; on: () => void; i: React.ReactNode; t: string }) {
  return (
    <button type="button" onClick={on} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7,
      fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
      border: '1px solid ' + (a ? 'var(--blue)' : 'var(--border)'),
      background: a ? 'var(--blue)' : 'var(--s2)', color: a ? 'var(--sobre-aviso)' : 'var(--text3)',
    }}>{i}{t}</button>
  )
}

const txt: React.CSSProperties = { fontSize: 12, color: 'var(--text2)', margin: '5px 0 0', lineHeight: 1.55 }
const rot: React.CSSProperties = { fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }
const campoWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 }
const campo: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 8px', fontSize: 12, color: 'var(--text)' }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'color-mix(in srgb, var(--blue) 15%, transparent)', color: 'var(--blue)', border: '1px solid color-mix(in srgb, var(--blue) 35%, transparent)', borderRadius: 7, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }

export { CalendarCheck }
