'use client'
/**
 * PANEL DE UCI — vertical slice del ICU Hands-Free Note Engine (icu-005/013).
 *
 * El médico captura los valores (a mano o, más adelante, dictados) y VE cómo el
 * CÓDIGO calcula en vivo: ventilación (P/F, driving pressure, compliance),
 * gasometría (ácido-base), hemodinamia (PAM), SOFA — y las ALERTAS citadas, en un
 * panel SEPARADO de la nota. Ningún cálculo lo hace la IA. Si falta un dato, el
 * motor lo declara y no inventa. Gateado bajo el módulo de Hospitalización.
 */
import { useMemo, useState } from 'react'
import { Activity, Wind, Droplets, HeartPulse, ShieldAlert, Info } from 'lucide-react'
import { analizarVentilacion } from '@/lib/uci/ventilacion'
import { analizarGasometria } from '@/lib/uci/gasometria'
import { presionArterialMedia } from '@/lib/uci/hemodinamia'
import { calcularSOFA } from '@/lib/uci/scores'
import { analizarSeguridadUCI, type NivelAlerta } from '@/lib/uci/seguridad'

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

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 20px 80px', color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Activity size={22} style={{ color: 'var(--nexus)' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Panel de UCI</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Info size={14} /> Apoyo decisional. El código calcula, el motor verifica; tú revisas y firmas. Si falta un dato, no se inventa.
      </p>

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
