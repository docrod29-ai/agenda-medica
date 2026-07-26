'use client'
/**
 * PANEL DE UCI — vertical slice del ICU Hands-Free Note Engine (icu-005/013).
 *
 * El médico captura los valores (a mano o, más adelante, dictados) y VE cómo el
 * CÓDIGO calcula en vivo: ventilación (P/F, driving pressure, compliance),
 * gasometría (ácido-base), hemodinamia (PAM), SOFA — y las ALERTAS citadas, en un
 * panel SEPARADO de la nota. Ningún cálculo lo hace la IA. Si falta un dato, el
 * motor lo declara y no inventa. Gateado bajo el módulo de Expediente (consulta).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Wind, Droplets, HeartPulse, ShieldAlert, Info, Mic, Square, Waves } from 'lucide-react'
import { analizarVentilacion } from '@/lib/uci/ventilacion'
import { analizarGasometria } from '@/lib/uci/gasometria'
import { presionArterialMedia } from '@/lib/uci/hemodinamia'
import { calcularSOFA } from '@/lib/uci/scores'
import { vexus, respuestaPLR, disfuncionVD_TAPSE, sobrecargaVD_VDVI, lineasB as lineasBPocus, type PatronVena, type ParametroPLR } from '@/lib/uci/pocus'
import { analizarSeguridadUCI, type NivelAlerta } from '@/lib/uci/seguridad'
import { extraerValoresUCI } from '@/lib/uci/extraccion'
import { atribuirRolesDiscusion, formatearDiscusion } from '@/lib/uci/discusion'
import { useGrabacionAudio } from '@/hooks/useGrabacionAudio'

type Campos = Record<string, string>

const colorNivel: Record<NivelAlerta, string> = {
  critica: '#dc2626', alta: '#d97706', moderada: 'var(--nexus)', informativa: 'var(--text3)',
}

function Campo({ label, k, v, set, sufijo, w }: { label: string; k: string; v: Campos; set: (k: string, val: string) => void; sufijo?: string; w?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'var(--text3)', width: w ?? 92 }}>
      {label}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input value={v[k] ?? ''} onChange={e => set(k, e.target.value)} inputMode="decimal"
          style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 13 }} />
        {sufijo && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{sufijo}</span>}
      </span>
    </label>
  )
}

function Selector({ label, k, v, set, opciones, w }: { label: string; k: string; v: Campos; set: (k: string, val: string) => void; opciones: { val: string; txt: string }[]; w?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'var(--text3)', width: w ?? 120 }}>
      {label}
      <select value={v[k] ?? ''} onChange={e => set(k, e.target.value)}
        style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 13 }}>
        <option value="">—</option>
        {opciones.map(o => <option key={o.val} value={o.val}>{o.txt}</option>)}
      </select>
    </label>
  )
}

function Bloque({ icon: Icon, titulo, children }: { icon: typeof Wind; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
        <Icon size={16} style={{ color: 'var(--nexus)' }} /> {titulo}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{children}</div>
    </div>
  )
}

function Resultado({ label, r }: { label: string; r: { ok: boolean; valor: number | null; unidad?: string; motivoBloqueo?: string | null; interpretacion?: string } }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 9, background: 'var(--s2)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: 'var(--text3)' }}>{label}</span>
        <strong style={{ color: r.ok ? 'var(--text)' : '#d97706' }}>{r.ok ? `${r.valor} ${r.unidad ?? ''}` : 'bloqueado'}</strong>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{r.ok ? r.interpretacion : r.motivoBloqueo}</div>
    </div>
  )
}

export default function UciPanelPage() {
  const [v, setV] = useState<Campos>({})
  const set = (k: string, val: string) => setV(prev => ({ ...prev, [k]: val }))
  const n = (k: string) => (v[k] === undefined || v[k] === '' ? undefined : v[k])

  // ── Voz del pase de visita (multi-voz) → prellena el panel ──
  const audio = useGrabacionAudio()
  const [discusionTxt, setDiscusionTxt] = useState('')
  const [detectados, setDetectados] = useState<string[]>([])
  const procesadoRef = useRef('')
  useEffect(() => {
    const t = audio.transcripcion?.trim()
    if (!t || t === procesadoRef.current) return
    procesadoRef.current = t
    // 1) Discusión etiquetada por rol (adscrito/residente/enfermería) si hubo diarización.
    const turnos = (audio.utterances && audio.utterances.length)
      ? audio.utterances.map(u => ({ hablante: u.speaker, texto: u.text }))
      : [{ hablante: 'A', texto: t }]
    setDiscusionTxt(formatearDiscusion(atribuirRolesDiscusion(turnos)))
    // 2) Extrae los valores dictados y prellena el panel (el médico confirma).
    const extraidos = extraerValoresUCI(t)
    if (Object.keys(extraidos).length) {
      setV(prev => ({ ...prev, ...extraidos }))
      setDetectados(Object.keys(extraidos))
    }
  }, [audio.transcripcion, audio.utterances])
  const grabando = audio.estado === 'grabando' || audio.estado === 'pausado'

  const vent = useMemo(() => analizarVentilacion({
    sexo: v.sexo === 'F' ? 'F' : v.sexo === 'M' ? 'M' : undefined, tallaCm: n('talla'), vtMl: n('vt'),
    fio2: n('fio2'), fio2Unidad: '%', pplat: n('pplat'), peep: n('peep'),
    pao2: n('pao2'), muestraGasometria: (v.muestra as 'arterial' | 'venosa' | 'capilar') || undefined,
  }), [v])
  const gaso = useMemo(() => analizarGasometria({ ph: n('ph'), paco2: n('paco2'), hco3: n('hco3'), na: n('na'), cl: n('cl'), albumina: n('alb') }), [v])
  const pam = useMemo(() => presionArterialMedia(n('pas'), n('pad')), [v])
  const sofa = useMemo(() => calcularSOFA({
    pafi: vent.indiceKirby.ok ? vent.indiceKirby.valor ?? undefined : undefined, soporteRespiratorio: v.soporte === 'si',
    plaquetas: n('plaquetas'), bilirrubina: n('bili'), pam: pam.ok ? pam.valor ?? undefined : n('pas') ? undefined : undefined,
    norepinefrina: n('norepi'), glasgow: n('glasgow'), creatinina: n('creat'),
  }), [v, vent, pam])
  const alertas = useMemo(() => analizarSeguridadUCI({
    ph: n('ph'), glucosa: n('glucosa'), potasio: n('k'), pam: pam.ok ? pam.valor ?? undefined : undefined,
    pplat: n('pplat'), drivingPressure: vent.drivingPressure.ok ? vent.drivingPressure.valor ?? undefined : undefined,
    vtPorPbw: vent.vtPorPbw.ok ? vent.vtPorPbw.valor ?? undefined : undefined, spo2: n('spo2'), fio2: vent.fio2.valor ?? undefined,
    lactato: n('lactato'),
  }), [v, vent, pam])

  // ── POCUS: congestión venosa (VExUS-C), respuesta a líquidos (PLR), corazón derecho ──
  const patron = (k: string): PatronVena | undefined => (v[k] === 'normal' || v[k] === 'leve' || v[k] === 'grave' ? v[k] : undefined)
  const vex = useMemo(() => vexus({ vciCm: n('vci'), hepatica: patron('vHep'), porta: patron('vPor'), renal: patron('vRen') }), [v])
  const plr = useMemo(() => respuestaPLR(n('plrDelta'), (v.plrParam as ParametroPLR) || undefined), [v])
  const tapse = useMemo(() => disfuncionVD_TAPSE(n('tapse')), [v])
  const vdvi = useMemo(() => sobrecargaVD_VDVI(n('vdvi')), [v])
  const lb = useMemo(() => lineasBPocus(n('lineasB')), [v])

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 20px 80px', color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Activity size={22} style={{ color: 'var(--nexus)' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Panel de UCI</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Info size={14} /> Apoyo decisional. El código calcula, el motor verifica; tú revisas y firmas. Si falta un dato, no se inventa.
      </p>

      {/* Voz del pase de visita (adscritos + residentes) → prellena el panel */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {audio.soportado ? (
            <button onClick={() => (grabando ? audio.detener() : audio.iniciar({ recoveryKey: 'uci-panel' }))}
              className={grabando ? 'btn' : 'btn btn-primary'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...(grabando ? { background: '#dc2626', color: '#fff', border: 'none' } : {}) }}>
              {grabando ? <Square size={15} /> : <Mic size={15} />}{grabando ? 'Detener' : 'Dictar pase de visita'}
            </button>
          ) : <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>Este dispositivo no soporta grabación.</span>}
          <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
            {audio.estado === 'grabando' && <span className="nx-pulse" style={{ color: '#dc2626' }}>● Grabando… {Math.floor(audio.duracion)}s</span>}
            {audio.estado === 'pausado' && 'En pausa'}
            {audio.estado === 'subiendo' && 'Transcribiendo…'}
            {audio.estado === 'listo' && detectados.length > 0 && <span style={{ color: 'var(--nexus)' }}>✓ {detectados.length} valores prellenados — revísalos</span>}
          </span>
        </div>
        {audio.transcripcionParcial && grabando && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text2)', background: 'var(--s2)', borderRadius: 8, padding: '8px 10px', maxHeight: 80, overflow: 'auto' }}>{audio.transcripcionParcial}<span className="nx-caret">▍</span></div>
        )}
        {discusionTxt && (
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: 12.5, color: 'var(--text3)', cursor: 'pointer' }}>Ver la discusión etiquetada por rol</summary>
            <pre style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{discusionTxt}</pre>
          </details>
        )}
        {audio.error && <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>{audio.error}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16 }} className="nx-uci-grid">
        {/* Captura */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Bloque icon={Wind} titulo="Respiratorio / ventilación">
            <Campo label="Sexo (M/F)" k="sexo" v={v} set={set} w={70} />
            <Campo label="Talla" k="talla" v={v} set={set} sufijo="cm" />
            <Campo label="VT" k="vt" v={v} set={set} sufijo="mL" />
            <Campo label="FiO₂" k="fio2" v={v} set={set} sufijo="%" />
            <Campo label="PEEP" k="peep" v={v} set={set} sufijo="cmH₂O" />
            <Campo label="Pplateau" k="pplat" v={v} set={set} sufijo="cmH₂O" />
            <Campo label="PaO₂" k="pao2" v={v} set={set} sufijo="mmHg" />
            <Campo label="Muestra gaso." k="muestra" v={v} set={set} w={110} />
            <Campo label="Soporte resp (si)" k="soporte" v={v} set={set} w={110} />
            <Campo label="SpO₂" k="spo2" v={v} set={set} sufijo="%" />
          </Bloque>
          <Bloque icon={Droplets} titulo="Gasometría / metabólico">
            <Campo label="pH" k="ph" v={v} set={set} />
            <Campo label="PaCO₂" k="paco2" v={v} set={set} sufijo="mmHg" />
            <Campo label="HCO₃" k="hco3" v={v} set={set} />
            <Campo label="Na" k="na" v={v} set={set} />
            <Campo label="Cl" k="cl" v={v} set={set} />
            <Campo label="Albúmina" k="alb" v={v} set={set} sufijo="g/dL" />
            <Campo label="Lactato" k="lactato" v={v} set={set} />
            <Campo label="Glucosa" k="glucosa" v={v} set={set} sufijo="mg/dL" />
            <Campo label="Potasio" k="k" v={v} set={set} />
          </Bloque>
          <Bloque icon={HeartPulse} titulo="Hemodinámico + SOFA">
            <Campo label="PAS" k="pas" v={v} set={set} />
            <Campo label="PAD" k="pad" v={v} set={set} />
            <Campo label="Norepi" k="norepi" v={v} set={set} sufijo="µg/kg/min" w={110} />
            <Campo label="Glasgow" k="glasgow" v={v} set={set} />
            <Campo label="Creatinina" k="creat" v={v} set={set} />
            <Campo label="Plaquetas" k="plaquetas" v={v} set={set} sufijo="×10³" />
            <Campo label="Bilirrubina" k="bili" v={v} set={set} />
          </Bloque>
          <Bloque icon={Waves} titulo="POCUS · ultrasonido a pie de cama">
            <Campo label="VCI" k="vci" v={v} set={set} sufijo="cm" w={80} />
            <Selector label="V. hepática" k="vHep" v={v} set={set} opciones={[{ val: 'normal', txt: 'Normal (S≥D)' }, { val: 'leve', txt: 'Leve (S<D)' }, { val: 'grave', txt: 'Grave (S invertida)' }]} />
            <Selector label="V. porta" k="vPor" v={v} set={set} opciones={[{ val: 'normal', txt: 'Normal (<30%)' }, { val: 'leve', txt: 'Leve (30–49%)' }, { val: 'grave', txt: 'Grave (≥50%)' }]} />
            <Selector label="V. renal" k="vRen" v={v} set={set} opciones={[{ val: 'normal', txt: 'Normal (cont.)' }, { val: 'leve', txt: 'Leve (bifásico)' }, { val: 'grave', txt: 'Grave (solo diast.)' }]} />
            <Campo label="PLR Δ" k="plrDelta" v={v} set={set} sufijo="%" w={80} />
            <Selector label="PLR parámetro" k="plrParam" v={v} set={set} opciones={[{ val: 'CO', txt: 'Gasto (CO)' }, { val: 'SV', txt: 'Vol. sistólico (SV)' }, { val: 'LVOT_VTI', txt: 'LVOT-VTI' }]} w={130} />
            <Campo label="TAPSE" k="tapse" v={v} set={set} sufijo="mm" w={80} />
            <Campo label="VD/VI" k="vdvi" v={v} set={set} w={80} />
            <Campo label="Líneas B/esp." k="lineasB" v={v} set={set} w={100} />
          </Bloque>
        </div>

        {/* Cálculos + alertas (SEPARADOS de la nota) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Cálculos deterministas</div>
            <div style={{ display: 'grid', gap: 8 }}>
              <Resultado label="PaO₂/FiO₂ (Kirby)" r={vent.indiceKirby} />
              <Resultado label="Driving pressure" r={vent.drivingPressure} />
              <Resultado label="Compliance estática" r={vent.complianceEstatica} />
              <Resultado label="VT/PBW" r={vent.vtPorPbw} />
              <Resultado label="PAM" r={pam} />
              <div style={{ padding: '8px 10px', borderRadius: 9, background: 'var(--s2)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text3)' }}>Gasometría</span>
                  <strong>{gaso.ok ? gaso.trastornoPrimario.replace('_', ' ') : '—'}</strong>
                </div>
                {gaso.ok && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{gaso.mixto ? 'MIXTO · ' : ''}{gaso.anionGap.elevado ? 'AG elevado' : ''} {gaso.compensacion.comentario}</div>}
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 9, background: 'var(--nexus-soft)', border: '1px solid var(--border2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text3)' }}>SOFA</span>
                  <strong>{sofa.total ?? '—'}{sofa.parcial ? ' (parcial)' : ''}</strong>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
              <Waves size={16} style={{ color: 'var(--nexus)' }} /> POCUS
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <Resultado label="VExUS-C (congestión)" r={{ ...vex, unidad: vex.ok ? 'grado' : undefined }} />
              <Resultado label="PLR (respuesta a líquidos)" r={{ ...plr, unidad: '%' }} />
              <Resultado label="TAPSE (VD)" r={{ ...tapse, unidad: 'mm' }} />
              <Resultado label="VD/VI" r={vdvi} />
              <Resultado label="Líneas B" r={lb} />
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.4 }}>
              VExUS-C requiere VCI ≥ 2.0 cm + Doppler venoso. PLR: ≥10 % en gasto/VS/LVOT-VTI = respondedor (la presión de pulso no es criterio válido). Ninguna medida aislada decide conducta.
            </div>
          </div>

          <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
              <ShieldAlert size={16} style={{ color: '#d97706' }} /> Alertas ({alertas.length})
            </div>
            {alertas.length === 0
              ? <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Sin alertas con los datos actuales.</div>
              : <div style={{ display: 'grid', gap: 7 }}>
                  {alertas.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '7px 9px', borderRadius: 8, background: 'var(--s2)', borderLeft: `3px solid ${colorNivel[a.nivel]}` }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: colorNivel[a.nivel], textTransform: 'uppercase', width: 62, flexShrink: 0 }}>{a.nivel}</span>
                      <span style={{ color: 'var(--text)' }}>{a.mensaje}</span>
                    </div>
                  ))}
                </div>}
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 820px){ .nx-uci-grid { grid-template-columns: 1fr !important; } }`}</style>
    </main>
  )
}
