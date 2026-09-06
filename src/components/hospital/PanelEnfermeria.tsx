'use client'
// Panel de enfermería: balance hídrico + escalas (Braden/Morse) + entrega de turno (SBAR).
/**
 * UNA ESCALA QUE NADIE VALORÓ NO QUEDA REGISTRADA COMO VALORADA — Panel de Lujo
 * ZC-003.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El estado nacía con TODOS los ítems en su valor más benigno:
 *
 *     braden = { percepcion: 4, humedad: 4, actividad: 4, movilidad: 4,
 *                nutricion: 4, friccion: 3 }   → 23 puntos = «sin riesgo»
 *     morse  = { …todo en 0 }                  → 0 puntos  = «riesgo bajo»
 *
 * y «Guardar» estaba habilitado desde el primer render. Un clic —el de quien
 * abre la pestaña para mirar y se le va el dedo, o el de quien cree que
 * «Guardar» confirma lo que ya estaba— escribía en el expediente una valoración
 * de úlceras por presión y otra de riesgo de caídas que **nadie hizo**, con la
 * conclusión más tranquilizadora posible y con nombre de quien la «hizo».
 *
 * Es la regla 4 de seguridad clínica en su forma más cara: ausencia de dato
 * convertida, por el valor por defecto de un `useState`, en dato de ausencia de
 * riesgo.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría del Panel de Lujo (6-sep-2026), oleada de cierre de componentes,
 * hallazgo ZC-003, confirmado por el equipo rojo.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El tipo `BradenInput` obliga a un número por ítem, así que el estado inicial
 * tenía que inventar seis. El arreglo es que el ESTADO DE LA PANTALLA admita
 * «todavía no» (`undefined`) aunque el tipo del motor no lo admita: el motor
 * sólo se llama cuando la valoración está completa. El motor no cambia — sigue
 * siendo determinista y sigue exigiendo sus seis ítems.
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * No impide que alguien elija seis valores al azar: eso ya no es un defecto de
 * la interfaz. Y no toca las escalas ya guardadas con el defecto vivo — no hay
 * forma de saber cuáles se valoraron de verdad, y reescribir el expediente por
 * una sospecha sería peor que dejarlo como está.
 */
import { useState } from 'react'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui'
import { agregarBalance, agregarEscala, agregarSbar } from '@/lib/hospital/firestore'
import { calcBraden, calcMorse, BRADEN_ITEMS, MORSE_ITEMS, type BradenInput, type MorseInput } from '@/lib/hospital/escalas'
import type { Internamiento } from '@/types/hospital'
import { Droplets, Ruler, ClipboardList } from 'lucide-react'
import { zonaActiva } from '@/lib/timezone'
import { plural } from '@/lib/texto-es'

const inputCls = 'w-full rounded-md border px-2.5 py-2 text-sm bg-transparent'

export function PanelEnfermeria({ clinicId, internamiento, por, puedeEditar, onSaved }: {
  clinicId: string; internamiento: Internamiento; por: string; puedeEditar: boolean; onSaved: () => void
}) {
  const { toast } = useToast()
  const iid = internamiento.id
  const [ing, setIng] = useState(''); const [egr, setEgr] = useState('')
  /* Nacen VACÍAS: `undefined` es «este ítem no se ha valorado». Ver la cabecera. */
  const [braden, setBraden] = useState<Partial<BradenInput>>({})
  const [morse, setMorse] = useState<Partial<MorseInput>>({})
  const [sbar, setSbar] = useState('')
  const [busy, setBusy] = useState<string>('')

  const faltanBraden = BRADEN_ITEMS.filter(it => braden[it.key] === undefined).length
  const faltanMorse = MORSE_ITEMS.filter(it => morse[it.key] === undefined).length
  /* El motor sólo se llama con la valoración COMPLETA: sigue exigiendo sus seis
     ítems y sigue siendo determinista. Lo que cambia es cuándo se le pregunta. */
  const rB = faltanBraden === 0 ? calcBraden(braden as BradenInput) : null
  const rM = faltanMorse === 0 ? calcMorse(morse as MorseInput) : null
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
            <div><label style={{ fontSize: 11, color: 'var(--text3)' }} htmlFor="enf-ingresos">Ingresos (mL)</label><input id="enf-ingresos" className={inputCls} type="number" inputMode="decimal" min="0" style={{ width: 110 }} value={ing} onChange={e => setIng(e.target.value)} /></div>
            <div><label style={{ fontSize: 11, color: 'var(--text3)' }} htmlFor="enf-egresos">Egresos (mL)</label><input id="enf-egresos" className={inputCls} type="number" inputMode="decimal" min="0" style={{ width: 110 }} value={egr} onChange={e => setEgr(e.target.value)} /></div>
            <Button size="sm" loading={busy === 'bal'} disabled={!ing && !egr} onClick={async () => { setBusy('bal'); try { await agregarBalance(clinicId, iid, { ingresos: Number(ing) || 0, egresos: Number(egr) || 0, por }); setIng(''); setEgr(''); onSaved(); toast('Balance registrado', 'success') } catch (e) { toast(e instanceof Error ? e.message : 'NO se registró el balance hídrico', 'error') } finally { setBusy('') } }}>Agregar</Button>
          </div>
        )}
        {balances.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[...balances].reverse().slice(0, 6).map((b, i) => { const neto = b.ingresos - b.egresos; return (
              <div key={i} style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{new Date(b.fecha).toLocaleString('es-MX', { timeZone: zonaActiva(), day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span>+{b.ingresos} / −{b.egresos} · <strong style={{ color: neto >= 0 ? '#0d9488' : '#dc2626' }}>neto {neto >= 0 ? '+' : ''}{neto} mL</strong></span>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Escalas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 12 }}>
        {/* Braden */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><Ruler size={15} style={{ color: 'var(--purple)' }} /> Braden <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>· úlceras por presión</span></div>
          {ultBraden && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Último: {ultBraden.score} ({ultBraden.riesgo})</div>}
          {puedeEditar && (<>
            {BRADEN_ITEMS.map(it => (
              <div key={it.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{it.label}</span>
                <select
                  aria-label={`Braden · ${it.label}`}
                  className="rounded-md border px-2 py-1 text-xs bg-transparent"
                  value={braden[it.key] ?? ''}
                  onChange={e => setBraden(b => ({ ...b, [it.key]: Number(e.target.value) }))}
                >
                  {/* La opción vacía es el estado inicial y NO puntúa. */}
                  <option value="">— sin valorar —</option>
                  {Array.from({ length: it.max }, (_, n) => n + 1).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: rB ? rB.color : 'var(--text3)' }}>
                {rB
                  ? `${rB.score} · ${rB.riesgo}`
                  : `Sin valorar — ${plural(faltanBraden, 'ítem pendiente', 'ítems pendientes')}`}
              </span>
              <Button
                size="sm" variant="secondary" loading={busy === 'braden'}
                /* Sin los seis ítems no hay escala que guardar. */
                disabled={!rB}
                onClick={async () => { if (!rB) return; setBusy('braden'); try { await agregarEscala(clinicId, iid, { tipo: 'braden', score: rB.score, riesgo: rB.riesgo, por }); onSaved(); toast('Braden registrada', 'success') } catch (e) { toast(e instanceof Error ? e.message : 'NO se registró la escala de Braden', 'error') } finally { setBusy('') } }}
              >Guardar</Button>
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
                <select
                  aria-label={`Morse · ${it.label}`}
                  className="rounded-md border px-2 py-1 text-xs bg-transparent"
                  value={morse[it.key] ?? ''}
                  onChange={e => setMorse(m => ({ ...m, [it.key]: Number(e.target.value) }))}
                >
                  {/* «No» es una respuesta; «sin valorar» no lo es. Morse las
                      distinguía con el mismo cero, y ése era el defecto. */}
                  <option value="">— sin valorar —</option>
                  {it.opciones.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: rM ? rM.color : 'var(--text3)' }}>
                {rM
                  ? `${rM.score} · ${rM.riesgo}`
                  : `Sin valorar — ${plural(faltanMorse, 'ítem pendiente', 'ítems pendientes')}`}
              </span>
              <Button
                size="sm" variant="secondary" loading={busy === 'morse'}
                disabled={!rM}
                onClick={async () => { if (!rM) return; setBusy('morse'); try { await agregarEscala(clinicId, iid, { tipo: 'morse', score: rM.score, riesgo: rM.riesgo, por }); onSaved(); toast('Morse registrada', 'success') } catch (e) { toast(e instanceof Error ? e.message : 'NO se registró la escala de Morse', 'error') } finally { setBusy('') } }}
              >Guardar</Button>
            </div>
          </>)}
        </div>
      </div>

      {/* Entrega de turno SBAR */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><ClipboardList size={15} style={{ color: 'var(--teal)' }} /> Entrega de turno (SBAR)</div>
        {puedeEditar && (<>
          <textarea aria-label="Entrega de turno (SBAR)" className={inputCls} rows={3} placeholder="Situación · Antecedentes · Evaluación · Recomendación" value={sbar} onChange={e => setSbar(e.target.value)} />
          <div style={{ marginTop: 6 }}><Button size="sm" loading={busy === 'sbar'} disabled={!sbar.trim()} onClick={async () => { setBusy('sbar'); try { await agregarSbar(clinicId, iid, { texto: sbar.trim(), por }); setSbar(''); onSaved(); toast('Entrega de turno registrada', 'success') } catch (e) { toast(e instanceof Error ? e.message : 'NO se guardó la entrega de turno. NO cierres: el texto sigue aquí, reintenta.', 'error') } finally { setBusy('') } }}>Guardar entrega</Button></div>
        </>)}
        {sbars.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {[...sbars].reverse().slice(0, 5).map((s, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', borderLeft: '3px solid var(--border)', paddingLeft: 8 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{new Date(s.fecha).toLocaleString('es-MX', { timeZone: zonaActiva(), day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}{s.por ? ' · ' + s.por : ''}</div>
                {s.texto}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
