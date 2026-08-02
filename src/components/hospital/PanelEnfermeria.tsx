'use client'
// Panel de enfermería: balance hídrico + escalas (Braden/Morse) + entrega de turno (SBAR).
import { useState } from 'react'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui'
import { agregarBalance, agregarEscala, agregarSbar } from '@/lib/hospital/firestore'
import { calcBraden, calcMorse, BRADEN_ITEMS, MORSE_ITEMS, type BradenInput, type MorseInput } from '@/lib/hospital/escalas'
import type { Internamiento } from '@/types/hospital'
import { Droplets, Ruler, ClipboardList } from 'lucide-react'

const inputCls = 'w-full rounded-md border px-2.5 py-2 text-sm bg-transparent'

export function PanelEnfermeria({ clinicId, internamiento, por, puedeEditar, onSaved }: {
  clinicId: string; internamiento: Internamiento; por: string; puedeEditar: boolean; onSaved: () => void
}) {
  const { toast } = useToast()
  const iid = internamiento.id
  const [ing, setIng] = useState(''); const [egr, setEgr] = useState('')
  const [braden, setBraden] = useState<BradenInput>({ percepcion: 4, humedad: 4, actividad: 4, movilidad: 4, nutricion: 4, friccion: 3 })
  const [morse, setMorse] = useState<MorseInput>({ caidasPrevias: 0, dxSecundario: 0, ayudaAmbulacion: 0, viaIV: 0, marcha: 0, estadoMental: 0 })
  const [sbar, setSbar] = useState('')
  const [busy, setBusy] = useState<string>('')

  const rB = calcBraden(braden); const rM = calcMorse(morse)
  const balances = internamiento.balanceHidrico ?? []
  const escalas = internamiento.escalas ?? []
  const sbars = internamiento.sbar ?? []
  const ultBraden = [...escalas].reverse().find(e => e.tipo === 'braden')
  const ultMorse = [...escalas].reverse().find(e => e.tipo === 'morse')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Balance hídrico */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><Droplets size={15} style={{ color: '#0ea5e9' }} /> Balance hídrico</div>
        {puedeEditar && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
            <div><label style={{ fontSize: 11, color: 'var(--text3)' }}>Ingresos (mL)</label><input className={inputCls} type="number" inputMode="decimal" min="0" style={{ width: 110 }} value={ing} onChange={e => setIng(e.target.value)} /></div>
            <div><label style={{ fontSize: 11, color: 'var(--text3)' }}>Egresos (mL)</label><input className={inputCls} type="number" inputMode="decimal" min="0" style={{ width: 110 }} value={egr} onChange={e => setEgr(e.target.value)} /></div>
            <Button size="sm" loading={busy === 'bal'} disabled={!ing && !egr} onClick={async () => { setBusy('bal'); try { await agregarBalance(clinicId, iid, { ingresos: Number(ing) || 0, egresos: Number(egr) || 0, por }); setIng(''); setEgr(''); onSaved(); toast('Balance registrado', 'success') } catch (e) { toast(e instanceof Error ? e.message : 'NO se registró el balance hídrico', 'error') } finally { setBusy('') } }}>Agregar</Button>
          </div>
        )}
        {balances.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[...balances].reverse().slice(0, 6).map((b, i) => { const neto = b.ingresos - b.egresos; return (
              <div key={i} style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{new Date(b.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span>+{b.ingresos} / −{b.egresos} · <strong style={{ color: neto >= 0 ? '#0d9488' : '#dc2626' }}>neto {neto >= 0 ? '+' : ''}{neto} mL</strong></span>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Escalas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {/* Braden */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><Ruler size={15} style={{ color: 'var(--purple)' }} /> Braden <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>· úlceras por presión</span></div>
          {ultBraden && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Último: {ultBraden.score} ({ultBraden.riesgo})</div>}
          {puedeEditar && (<>
            {BRADEN_ITEMS.map(it => (
              <div key={it.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{it.label}</span>
                <select className="rounded-md border px-2 py-1 text-xs bg-transparent" value={braden[it.key]} onChange={e => setBraden(b => ({ ...b, [it.key]: Number(e.target.value) }))}>
                  {Array.from({ length: it.max }, (_, n) => n + 1).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: rB.color }}>{rB.score} · {rB.riesgo}</span>
              <Button size="sm" variant="secondary" loading={busy === 'braden'} onClick={async () => { setBusy('braden'); try { await agregarEscala(clinicId, iid, { tipo: 'braden', score: rB.score, riesgo: rB.riesgo, por }); onSaved(); toast('Braden registrada', 'success') } catch (e) { toast(e instanceof Error ? e.message : 'NO se registró la escala de Braden', 'error') } finally { setBusy('') } }}>Guardar</Button>
            </div>
          </>)}
        </div>
        {/* Morse */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><Ruler size={15} style={{ color: 'var(--amber)' }} /> Morse <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>· riesgo de caídas</span></div>
          {ultMorse && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Último: {ultMorse.score} ({ultMorse.riesgo})</div>}
          {puedeEditar && (<>
            {MORSE_ITEMS.map(it => (
              <div key={it.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{it.label}</span>
                <select className="rounded-md border px-2 py-1 text-xs bg-transparent" value={morse[it.key]} onChange={e => setMorse(m => ({ ...m, [it.key]: Number(e.target.value) }))}>
                  {it.opciones.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: rM.color }}>{rM.score} · {rM.riesgo}</span>
              <Button size="sm" variant="secondary" loading={busy === 'morse'} onClick={async () => { setBusy('morse'); try { await agregarEscala(clinicId, iid, { tipo: 'morse', score: rM.score, riesgo: rM.riesgo, por }); onSaved(); toast('Morse registrada', 'success') } catch (e) { toast(e instanceof Error ? e.message : 'NO se registró la escala de Morse', 'error') } finally { setBusy('') } }}>Guardar</Button>
            </div>
          </>)}
        </div>
      </div>

      {/* Entrega de turno SBAR */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><ClipboardList size={15} style={{ color: 'var(--teal)' }} /> Entrega de turno (SBAR)</div>
        {puedeEditar && (<>
          <textarea className={inputCls} rows={3} placeholder="Situación · Antecedentes · Evaluación · Recomendación" value={sbar} onChange={e => setSbar(e.target.value)} />
          <div style={{ marginTop: 6 }}><Button size="sm" loading={busy === 'sbar'} disabled={!sbar.trim()} onClick={async () => { setBusy('sbar'); try { await agregarSbar(clinicId, iid, { texto: sbar.trim(), por }); setSbar(''); onSaved(); toast('Entrega de turno registrada', 'success') } catch (e) { toast(e instanceof Error ? e.message : 'NO se guardó la entrega de turno. NO cierres: el texto sigue aquí, reintenta.', 'error') } finally { setBusy('') } }}>Guardar entrega</Button></div>
        </>)}
        {sbars.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {[...sbars].reverse().slice(0, 5).map((s, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', borderLeft: '3px solid var(--border)', paddingLeft: 8 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{new Date(s.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}{s.por ? ' · ' + s.por : ''}</div>
                {s.texto}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
