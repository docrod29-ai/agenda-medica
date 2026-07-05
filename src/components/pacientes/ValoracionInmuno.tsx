'use client'
// ════════════════════════════════════════════════════════════════════
// Valoración infectológica del paciente inmunocomprometido — pestaña (port de StewardMX).
// La lógica clínica vive en src/lib/inmuno/* (puro, probado). Este componente es la UI:
// COPILOTO en 2 columnas — a la izquierda captura (motivo, huésped, chips colapsables,
// estudios); a la derecha, PEGADO, el plan de Infectología que se actualiza EN VIVO con
// citas de guías. Redacción por IA (api/inmuno/redactar), historial fechado y Word.
// ════════════════════════════════════════════════════════════════════
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useClinic } from '@/context/ClinicContext'
import { fetchAutenticado } from '@/lib/auth-client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Download, Sparkles, Save, ClipboardPlus, ChevronDown, ShieldCheck, FlaskConical, Activity } from 'lucide-react'
import type { Patient } from '@/types'
import { TX_CHIPS, TX_EST_CATS, TX_EST_QUANT, TX_MOT_TIT, hostFlags } from '@/lib/inmuno/catalogos'
import { compose } from '@/lib/inmuno/compose'
import { recomendaciones, type Sev } from '@/lib/inmuno/recomendaciones'
import { construirNotaInmuno, type NotaInmuno } from '@/lib/inmuno/nota'

type V = Record<string, string>
type Modo = 'inicial' | 'seguimiento'
interface HistEntry { fecha: string; modo: string; huesped: string; texto: string }

const MOTIVOS = [
  { v: 'aptitud_pretx', t: 'Aptitud pretrasplante' },
  { v: 'fiebre', t: 'Fiebre / foco infeccioso' },
  { v: 'profilaxis', t: 'Profilaxis antiinfecciosa' },
  { v: 'aptitud_biologico', t: 'Aptitud para biológico / IS' },
  { v: 'vacunacion', t: 'Vacunación' },
  { v: 'otro', t: 'Otro' },
]
const HUESPEDES = ['—', 'SOT — Renal', 'SOT — Hepático', 'SOT — Cardiaco', 'SOT — Pulmonar', 'TCMH — Autólogo', 'TCMH — Alogénico', 'VIH', 'No-VIH — Biológicos/Corticoides', 'Neutropenia/Quimioterapia', 'Asplenia']
const IS_ESTADO = ['—', 'En curso', 'Va a iniciar (pre-protocolo)', 'Ninguna / suspendida']
const RES_OPTS = ['—', 'Positivo', 'Negativo', 'Pendiente']
const SEV_COLOR: Record<Sev, string> = { alta: '#dc2626', media: '#d97706', baja: '#0d9488' }
const CARGA_COLOR: Record<string, string> = { alta: '#dc2626', media: '#d97706', baja: '#0d9488' }
const ALTA_CARGA = ['atg', 'alemtuzumab', 'anticd20', 'quimio', 'cicfos', 'purinas', 'anticd38']

const inputCls = 'w-full rounded-md border px-2.5 py-1.5 text-sm bg-transparent'
const SHOWN = new Set(Object.keys(TX_CHIPS))

/** Sección colapsable con contador de seleccionados. */
function Grupo({ titulo, count, accent = '#0d9488', defaultOpen, children }: { titulo: string; count: number; accent?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--s1)' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text)' }}>
          {titulo}
          {count > 0 && <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: accent + '26', color: accent }}>{count}</span>}
        </span>
        <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', color: 'var(--text3)' }} />
      </button>
      {open && <div className="px-3 pb-3 pt-0.5">{children}</div>}
    </div>
  )
}

/** Píldora de estratificación (cabecera del copiloto). */
function Pill({ label, color }: { label: string; color?: string }) {
  return (
    <span className="text-[11px] font-semibold rounded-full px-2 py-1" style={{ background: (color ?? '#64748b') + '1f', color: color ?? 'var(--text2)', border: `1px solid ${(color ?? '#64748b')}44` }}>{label}</span>
  )
}

export default function ValoracionInmuno({ patient, onAplicarNota }: { patient: Patient; onAplicarNota?: (n: NotaInmuno) => void }) {
  const { clinicId, clinic } = useClinic()
  const [v, setV] = useState<V>(() => ({ ...(patient.txValoracion || {}) }))
  const [modo, setModo] = useState<Modo>('inicial')
  const [hist, setHist] = useState<HistEntry[]>(() => [...(patient.txValoracionHist || [])])
  const [iaTexto, setIaTexto] = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const [status, setStatus] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback((next: V) => {
    if (!clinicId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateDoc(doc(db, 'clinics', clinicId, 'patients', patient.id), { txValoracion: next, txValoracionAt: new Date().toISOString() }).catch(() => {})
    }, 900)
  }, [clinicId, patient.id])

  const set = useCallback((id: string, val: string) => setV((prev) => { const next = { ...prev, [id]: val }; persist(next); return next }), [persist])
  const toggle = (id: string) => set(id, v[id] === '1' ? '' : '1')

  const motivo = v.hc_motivo || ''
  const huesped = v.hc_huesped || ''
  const flags = useMemo(() => hostFlags(huesped), [huesped])
  const recs = useMemo(() => recomendaciones({ v }), [v])
  const estudiosSolicitados = useMemo(() => Object.keys(v).filter((k) => k.startsWith('hc_est_') && v[k] === '1').map((k) => k.slice(7)), [v])

  // Resultados en seguimiento: estudios solicitados + serologías basales (siempre).
  const resultadoKeys = useMemo(() => {
    const req = new Set(estudiosSolicitados)
    const basal = TX_EST_CATS.find((c) => c.cat === 'Serologías basales')
    const out: { cat: string; k: string; label: string }[] = []
    for (const c of TX_EST_CATS) {
      for (const k in c.items) {
        if (req.has(k) || (basal && c === basal)) out.push({ cat: c.cat, k, label: c.items[k] })
      }
    }
    return out
  }, [estudiosSolicitados])

  function buildContexto(): string {
    let t = ''
    const motTxt = MOTIVOS.find((m) => m.v === motivo)?.t || ''
    if (motTxt) t += 'Motivo: ' + motTxt + '\n'
    if (huesped && huesped !== '—') t += 'Huésped: ' + huesped + (v.hc_fechatx ? ' (desde ' + v.hc_fechatx + ')' : '') + (v.hc_cd4 ? ' · CD4 ' + v.hc_cd4 : '') + '\n'
    for (const r of compose(v, SHOWN)) t += r[0] + ': ' + r[1] + '\n'
    if (estudiosSolicitados.length) t += 'Estudios solicitados: ' + estudiosSolicitados.map((k) => TX_EST_CATS.flatMap((c) => Object.entries(c.items)).find(([kk]) => kk === k)?.[1] || k).join('; ') + '\n'
    if (recs.length) t += '\nPLAN DEFINIDO (motor determinista basado en guías — no lo cambies, solo redáctalo y conserva las citas):\n' + recs.map((r) => '- ' + r.titulo + ': ' + r.detalle + (r.fuente ? ' [' + r.fuente + ']' : '')).join('\n') + '\n'
    return t.trim()
  }

  async function redactarIA() {
    setIaLoading(true); setStatus('')
    try {
      const res = await fetchAutenticado('/api/inmuno/redactar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contexto: buildContexto() }) })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error de la IA')
      setIaTexto(data.texto)
    } catch (e) { setStatus(e instanceof Error ? e.message : 'Error de la IA') } finally { setIaLoading(false) }
  }

  function snapshotText(): string {
    let t = buildContexto()
    if (v.hc_evolucion) t += '\nEvolución: ' + v.hc_evolucion
    return t.trim()
  }

  async function guardarHist() {
    const texto = snapshotText()
    if (!texto) { setStatus('Captura la valoración primero'); return }
    const entry: HistEntry = { fecha: new Date().toISOString(), modo, huesped, texto }
    const next = [...hist, entry].slice(-50)
    setHist(next)
    setStatus('Valoración guardada al historial')
    if (clinicId) await updateDoc(doc(db, 'clinics', clinicId, 'patients', patient.id), { txValoracionHist: next }).catch(() => {})
  }

  function descargarWord(texto?: string) {
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c))
    const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    const titulo = TX_MOT_TIT[motivo] || 'Valoración infectológica del paciente inmunocomprometido'
    const cuerpo = texto
      ? esc(texto).replace(/\n/g, '<br>')
      : compose(v, SHOWN).map((r) => '<p><b>' + esc(r[0]) + ':</b> ' + esc(r[1]) + '</p>').join('') +
        (recs.length ? '<h3>Impresión y plan — Infectología</h3><ol>' + recs.map((r) => '<li><b>' + esc(r.titulo) + '.</b> ' + esc(r.detalle) + (r.fuente ? ' <i style="color:#667;">[' + esc(r.fuente) + ']</i>' : '') + '</li>').join('') + '</ol>' : '')
    const html = '<html><head><meta charset="utf-8"></head><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#15201d;">' +
      '<div style="border-bottom:3px solid #1a6b52;padding-bottom:8px;margin-bottom:12px;"><div style="font-size:17px;font-weight:bold;color:#1a6b52;">' + esc(clinic?.nombreClinica || '') + '</div><div style="font-size:10px;color:#557;text-transform:uppercase;letter-spacing:1.5px;">Valoración por Infectología</div></div>' +
      '<div style="font-family:Cambria,Georgia,serif;font-size:15px;font-weight:bold;">' + esc(titulo) + '</div>' +
      '<div style="font-size:11px;color:#667;margin-bottom:10px;">' + esc(patient.nombre || '') + (patient.edad ? ' · ' + patient.edad + ' a' : '') + (patient.sexo ? ' · ' + esc(patient.sexo) : '') + ' · ' + (modo === 'inicial' ? 'Valoración inicial' : 'Seguimiento') + ' · ' + fecha + '</div>' +
      cuerpo +
      '<div style="margin-top:16px;font-size:10px;color:#778;border-top:1px solid #dde;padding-top:6px;">Documento de apoyo — Infectología. Las dosis y decisiones requieren validación del médico tratante.</div></body></html>'
    const blob = new Blob(['﻿' + html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = 'ValoracionID_' + (patient.nombre || 'paciente').replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.doc'
    document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(url) }, 200)
  }

  // ── Derivados para la cabecera de estratificación (copiloto) ──
  const countGrupo = (gk: string) => Object.keys(TX_CHIPS[gk].items).filter((ck) => v['hc_cb_' + gk + '_' + ck] === '1').length
  const farmSel = Object.keys(TX_CHIPS.inmuno.items).filter((ck) => v['hc_cb_inmuno_' + ck] === '1')
  const cargaIS = farmSel.some((f) => ALTA_CARGA.includes(f)) ? 'alta' : farmSel.length ? 'media' : 'baja'
  const diasTx = (() => { if (!v.hc_fechatx) return null; const d = Math.floor((Date.now() - new Date(v.hc_fechatx).getTime()) / 86400000); return isNaN(d) ? null : d })()
  const isEstado = v.hc_is_estado && v.hc_is_estado !== '—' ? v.hc_is_estado : ''
  const recCounts = { alta: recs.filter((r) => r.sev === 'alta').length, media: recs.filter((r) => r.sev === 'media').length, baja: recs.filter((r) => r.sev === 'baja').length }

  // Panel del copiloto (derecha, pegado) — se reutiliza el bloque de recomendaciones en vivo.
  const copiloto = (
    <div className="flex flex-col gap-3" style={{ position: 'sticky', top: 12 }}>
      {/* Estratificación */}
      <Card padding={14}>
        <div className="flex items-center gap-2 mb-2">
          <span style={{ width: 7, height: 7, borderRadius: 99, background: '#7c3aed', boxShadow: '0 0 0 3px rgba(124,58,237,.18)' }} />
          <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'var(--purple,#7c3aed)' }}>Copiloto de Infectología · en vivo</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {huesped && huesped !== '—' && <Pill label={huesped} color="#0ea5e9" />}
          {isEstado && <Pill label={'IS: ' + isEstado} color="#7c3aed" />}
          {diasTx != null && diasTx >= 0 && <Pill label={'Día +' + diasTx} color="#0d9488" />}
          {farmSel.length > 0 && <Pill label={'Carga IS ' + cargaIS} color={CARGA_COLOR[cargaIS]} />}
          {v.hc_cd4 && <Pill label={'CD4 ' + v.hc_cd4} color="#d97706" />}
        </div>
        <div className="flex flex-wrap gap-3 mt-2.5 text-[11px]" style={{ color: 'var(--text3)' }}>
          <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 99, background: SEV_COLOR.alta }} /> {recCounts.alta} prioritarias</span>
          <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 99, background: SEV_COLOR.media }} /> {recCounts.media} intermedias</span>
          <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 99, background: SEV_COLOR.baja }} /> {recCounts.baja} bajas</span>
        </div>
      </Card>

      {/* Plan en vivo */}
      <Card padding={14}>
        <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><ShieldCheck size={15} style={{ color: '#7c3aed' }} /> Impresión y plan {recs.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {recs.length}</span>}</div>
        {recs.length === 0
          ? <div className="text-sm" style={{ color: 'var(--text3)' }}>Elige el huésped y el estado de inmunosupresión (o marca los fármacos) y el plan aparecerá aquí, con su cita de guía.</div>
          : <div className="flex flex-col gap-2" style={{ maxHeight: 620, overflowY: 'auto' }}>
              {recs.map((r, i) => (
                <div key={i} className="pl-2.5" style={{ borderLeft: `3px solid ${SEV_COLOR[r.sev]}` }}>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{r.titulo}</div>
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{r.detalle}</div>
                  {r.fuente && <div className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text3)' }}>▸ {r.fuente}</div>}
                </div>
              ))}
            </div>}
      </Card>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <Card padding={14}>
        <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Datos generales</div>
        <div className="text-sm mt-1">{patient.nombre}{patient.edad ? ` · ${patient.edad} años` : ''}{patient.sexo ? ` · ${patient.sexo}` : ''}{patient.alergias ? ` · Alergias: ${patient.alergias}` : ''}</div>
      </Card>

      {/* Motivo + huésped + estado de IS */}
      <Card padding={14}>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <label className="text-sm">Motivo de la interconsulta
            <select className={inputCls} value={motivo} onChange={(e) => set('hc_motivo', e.target.value)}>
              <option value="">— elige el motivo —</option>
              {MOTIVOS.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}
            </select>
          </label>
          {motivo && (
            <label className="text-sm">Tipo de huésped
              <select className={inputCls} value={huesped} onChange={(e) => set('hc_huesped', e.target.value)}>
                {HUESPEDES.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
          )}
          {motivo && (
            <label className="text-sm">¿Inmunosupresión hoy?
              <select className={inputCls} value={v.hc_is_estado || '—'} onChange={(e) => set('hc_is_estado', e.target.value)}>
                {IS_ESTADO.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
          {motivo && (<>
            <label className="text-sm">Fecha TX / inicio IS
              <input className={inputCls} placeholder="AAAA-MM-DD" value={v.hc_fechatx || ''} onChange={(e) => set('hc_fechatx', e.target.value)} />
            </label>
            <label className="text-sm">CD4 (si VIH)
              <input className={inputCls} placeholder="ej. 350" value={v.hc_cd4 || ''} onChange={(e) => set('hc_cd4', e.target.value)} />
            </label>
          </>)}
        </div>
      </Card>

      {!motivo && <Card padding={14}><div className="text-sm" style={{ color: 'var(--text3)' }}>Elige el motivo de la interconsulta para iniciar la valoración.</div></Card>}

      {motivo && <>
        {/* Modo */}
        <div className="flex gap-2">
          {(['inicial', 'seguimiento'] as Modo[]).map((m) => (
            <Button key={m} variant={modo === m ? 'primary' : 'ghost'} size="sm" onClick={() => setModo(m)}>{m === 'inicial' ? 'Inicial' : 'Seguimiento'}</Button>
          ))}
        </div>

        {/* Copiloto: captura (izq) + plan en vivo pegado (der) */}
        <div className="grid gap-3 items-start lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* ── Columna izquierda: captura ── */}
          <div className="flex flex-col gap-3 min-w-0">
            {/* Historia por chips (colapsable) */}
            <Card padding={14}>
              <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Activity size={15} style={{ color: 'var(--teal)' }} /> Historia clínica dirigida</div>
              <div className="flex flex-col gap-2">
                {Object.entries(TX_CHIPS).map(([gk, grp]) => (
                  <Grupo key={gk} titulo={grp.label} count={countGrupo(gk)} defaultOpen={gk === 'comorb' || gk === 'inmuno'}>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(grp.items).map(([ck, label]) => {
                        const on = v['hc_cb_' + gk + '_' + ck] === '1'
                        return <button key={ck} type="button" onClick={() => toggle('hc_cb_' + gk + '_' + ck)} className="rounded-full border px-2.5 py-1 text-xs" style={on ? { borderColor: '#0d9488', background: 'rgba(13,148,136,.12)', color: '#0d9488' } : { borderColor: 'var(--border)', color: 'var(--text2)' }}>{label}</button>
                      })}
                    </div>
                  </Grupo>
                ))}
              </div>
              <label className="text-sm block mt-3">Notas / texto libre
                <textarea className={inputCls} rows={3} value={v.hc_notas || ''} onChange={(e) => set('hc_notas', e.target.value)} />
              </label>
              <label className="text-sm block mt-2">Alergias a antimicrobianos
                <input className={inputCls} value={v.hc_alergias || ''} onChange={(e) => set('hc_alergias', e.target.value)} />
              </label>
            </Card>

            {/* Estudios (inicial) — colapsable por categoría */}
            {modo === 'inicial' && (
              <Card padding={14}>
                <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><FlaskConical size={15} style={{ color: '#3b82f6' }} /> Estudios a solicitar {estudiosSolicitados.length > 0 && <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: '#3b82f626', color: '#3b82f6' }}>{estudiosSolicitados.length}</span>}</div>
                <div className="flex flex-col gap-2">
                  {TX_EST_CATS.filter((c) => c.g(flags)).map((c, ci) => {
                    const sel = Object.keys(c.items).filter((k) => v['hc_est_' + k] === '1').length
                    return (
                      <Grupo key={c.cat} titulo={c.cat} count={sel} accent="#3b82f6" defaultOpen={ci === 0}>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(c.items).map(([k, label]) => {
                            const on = v['hc_est_' + k] === '1'
                            return <button key={k} type="button" onClick={() => toggle('hc_est_' + k)} className="rounded-full border px-2.5 py-1 text-xs" style={on ? { borderColor: '#3b82f6', background: 'rgba(59,130,246,.12)', color: '#3b82f6' } : { borderColor: 'var(--border)', color: 'var(--text2)' }}>{label}</button>
                          })}
                        </div>
                      </Grupo>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Resultados (seguimiento) */}
            {modo === 'seguimiento' && (
              <Card padding={14}>
                <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><FlaskConical size={15} style={{ color: '#3b82f6' }} /> Resultados</div>
                {resultadoKeys.map(({ k, label }) => (
                  <div key={k} className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs flex-1" style={{ color: 'var(--text2)' }}>{label}</span>
                    {TX_EST_QUANT.has(k)
                      ? <input className="rounded-md border px-2 py-1 text-xs bg-transparent" style={{ width: 170 }} placeholder="valor / hallazgo" value={v['hc_res_' + k] || ''} onChange={(e) => set('hc_res_' + k, e.target.value)} />
                      : <select className="rounded-md border px-2 py-1 text-xs bg-transparent" style={{ width: 120 }} value={v['hc_res_' + k] || '—'} onChange={(e) => set('hc_res_' + k, e.target.value)}>{RES_OPTS.map((o) => <option key={o}>{o}</option>)}</select>}
                  </div>
                ))}
                <label className="text-sm block mt-2">Evolución / cambios
                  <textarea className={inputCls} rows={2} value={v.hc_evolucion || ''} onChange={(e) => set('hc_evolucion', e.target.value)} />
                </label>
              </Card>
            )}

            {/* Acciones */}
            <div className="flex flex-wrap gap-2">
              {onAplicarNota && (
                <Button variant="primary" size="sm" icon={<ClipboardPlus size={15} />} onClick={() => { onAplicarNota(construirNotaInmuno(v)); setStatus('Valoración aplicada a la nota — revisa secciones, medicamentos y estudios') }}>
                  Aplicar a la nota clínica
                </Button>
              )}
              <Button variant={onAplicarNota ? 'secondary' : 'primary'} size="sm" icon={<Download size={15} />} onClick={() => descargarWord()}>Word completo</Button>
              <Button variant="secondary" size="sm" icon={<Sparkles size={15} />} loading={iaLoading} onClick={redactarIA}>Redactar con IA</Button>
              <Button variant="secondary" size="sm" icon={<Save size={15} />} onClick={guardarHist}>Guardar al historial</Button>
            </div>
            {status && <div className="text-xs" style={{ color: 'var(--text3)' }}>{status}</div>}
          </div>

          {/* ── Columna derecha: copiloto pegado ── */}
          {copiloto}
        </div>

        {/* Borrador IA */}
        {iaTexto && (
          <Card padding={14}>
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--purple,#7c3aed)' }}>Borrador IA — valida y edita antes de usar</div>
            <textarea className={inputCls} rows={12} value={iaTexto} onChange={(e) => setIaTexto(e.target.value)} />
            <div className="flex gap-2 mt-2">
              <Button variant="secondary" size="sm" icon={<Download size={15} />} onClick={() => descargarWord(iaTexto)}>Descargar Word</Button>
            </div>
          </Card>
        )}

        {/* Historial */}
        {hist.length > 0 && (
          <Card padding={14}>
            <div className="text-sm font-semibold mb-2">Valoraciones previas ({hist.length})</div>
            {[...hist].reverse().map((e, i) => (
              <details key={i} className="mb-1.5 rounded-md border px-3 py-2">
                <summary className="cursor-pointer text-sm">{(() => { try { return new Date(e.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return e.fecha } })()} · {e.modo === 'inicial' ? 'Inicial' : 'Seguimiento'}{e.huesped ? ' · ' + e.huesped : ''}</summary>
                <pre className="whitespace-pre-wrap text-xs mt-2" style={{ color: 'var(--text2)', fontFamily: 'inherit' }}>{e.texto}</pre>
              </details>
            ))}
          </Card>
        )}
      </>}
    </div>
  )
}
