'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { fetchAutenticado } from '@/lib/auth-client'
import { useToast } from '@/context/ToastContext'
import { guardarPanelLab, listarPanelesLab, borrarPanelLab, type PanelLaboratorio } from '@/lib/expediente/laboratorio/firestore'
import { seriesDesdeHistorial, type PanelValidado } from '@/lib/expediente/laboratorio/extraccion'
import { GraficaLab } from './GraficaLab'
import { FlaskConical, Upload, Loader2, AlertTriangle, Trash2, Check, X } from 'lucide-react'

const GRUPO_LABEL: Record<string, string> = {
  renal: 'Función renal', hepatico: 'Función hepática', lipidos: 'Perfil de lípidos',
  glucemia: 'Glucemia', hematologia: 'Hematología', electrolitos: 'Electrolitos',
  tiroides: 'Tiroides', inflamacion: 'Inflamación', otro: 'Otros',
}

/**
 * Historial de laboratorios del paciente con gráficas de tendencia.
 *
 * Flujo: adjuntar PDF/foto → la IA transcribe (ruta laboratorio-vision) → el
 * médico REVISA lo extraído (nada se guarda sin su visto bueno) → se guarda como
 * un panel fechado → las gráficas se recalculan sobre todo el historial.
 */
export function PanelLaboratorios({ clinicId, patientId, onAgregarANota }: {
  clinicId: string
  patientId: string
  /** Si viene (consulta), muestra "Agregar a la nota" con un resumen del último estudio. */
  onAgregarANota?: (texto: string) => void
}) {
  const { toast, confirm } = useToast()
  const [paneles, setPaneles] = useState<PanelLaboratorio[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [revision, setRevision] = useState<(PanelValidado & { fuente: 'pdf' | 'foto' }) | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(() => {
    if (!clinicId || !patientId) return
    setCargando(true)
    listarPanelesLab(clinicId, patientId).then(setPaneles).catch(() => toast('No se pudo cargar el historial de laboratorios', 'error')).finally(() => setCargando(false))
  }, [clinicId, patientId, toast])
  useEffect(cargar, [cargar])

  const series = useMemo(() => seriesDesdeHistorial(paneles.map(p => ({ fecha: p.fecha, resultados: p.resultados }))), [paneles])
  const porGrupo = useMemo(() => {
    const m = new Map<string, typeof series>()
    for (const s of series) { if (!m.has(s.grupo)) m.set(s.grupo, []); m.get(s.grupo)!.push(s) }
    return [...m.entries()]
  }, [series])

  const onArchivo = async (file: File) => {
    const esPdf = file.type === 'application/pdf'
    const esImg = file.type.startsWith('image/')
    if (!esPdf && !esImg) { toast('Adjunta un PDF o una imagen (foto) del laboratorio', 'error'); return }
    if (file.size > 7_500_000) { toast('El archivo pesa más de 7.5 MB. Reduce la resolución o divide el PDF.', 'error'); return }
    setSubiendo(true)
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file)
      })
      const resp = await fetchAutenticado('/api/expediente/laboratorio-vision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archivo: dataUrl }),
      })
      const data = await resp.json().catch(() => null)
      if (!data?.ok) { toast(data?.error ?? 'No se pudo interpretar el archivo', 'error'); return }
      setRevision({ ...(data.panel as PanelValidado), fuente: esPdf ? 'pdf' : 'foto' })
    } catch { toast('Error de red al interpretar el archivo', 'error') }
    finally { setSubiendo(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const guardarRevision = async () => {
    if (!revision) return
    if (!revision.fecha) { toast('Ponle una fecha al estudio para poder graficarlo en el tiempo', 'error'); return }
    try {
      await guardarPanelLab(clinicId, patientId, {
        fecha: revision.fecha, resultados: revision.resultados,
        noReconocidas: revision.noReconocidas, fuente: revision.fuente,
      })
      toast('Laboratorio guardado', 'success'); setRevision(null); cargar()
    } catch { toast('NO se pudo guardar el laboratorio. Reintenta.', 'error') }
  }

  const criticos = series.flatMap(s => s.puntos.filter(p => p.critico).map(p => ({ etiqueta: s.etiqueta, valor: p.valor, unidad: s.unidad, fecha: p.fecha })))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          <FlaskConical size={18} style={{ color: 'var(--teal, #3d5afe)' }} /> Laboratorios
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onArchivo(f) }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onAgregarANota && paneles.length > 0 && (
            <button
              className="btn btn-sm"
              onClick={() => {
                // Resumen del estudio MÁS RECIENTE para la nota. El médico decide
                // agregarlo — es opt-in, como el resto de las herramientas.
                const ult = paneles[0]
                const linea = ult.resultados.map(r => `${r.etiqueta} ${r.valor} ${r.unidad}${r.critico ? ' ⚠' : ''}`).join(' · ')
                const criticos = ult.resultados.filter(r => r.critico)
                const texto = `Laboratorios (${ult.fecha || 'sin fecha'}): ${linea}.` +
                  (criticos.length ? ` Valores críticos: ${criticos.map(c => c.etiqueta).join(', ')}.` : '')
                onAgregarANota(texto)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              title="Agrega el último laboratorio a la nota clínica"
            >
              <Check size={14} /> Agregar a la nota
            </button>
          )}
          <button className="btn btn-primary btn-sm" disabled={subiendo} onClick={() => fileRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {subiendo ? <><Loader2 size={14} className="spin" /> Interpretando…</> : <><Upload size={14} /> Adjuntar PDF o foto</>}
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
        Sube el PDF o una foto del reporte. La IA lee los valores, tú los revisas y se grafican en el tiempo.
        Por privacidad, no se guarda ningún dato que identifique al paciente que venga en la hoja.
      </p>

      {criticos.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: 12, padding: '11px 14px' }}>
          <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>
            <strong>Valores críticos en el historial:</strong> {criticos.map(c => `${c.etiqueta} ${c.valor} ${c.unidad}`).join(' · ')}
          </div>
        </div>
      )}

      {cargando ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: 20, textAlign: 'center' }}>Cargando…</div>
      ) : series.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: 24, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
          Aún no hay laboratorios. Adjunta el primero para empezar a ver la evolución.
        </div>
      ) : (
        porGrupo.map(([grupo, ss]) => (
          <div key={grupo}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{GRUPO_LABEL[grupo] ?? grupo}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {ss.map(s => <GraficaLab key={s.clave} titulo={s.etiqueta} unidad={s.unidad} puntos={s.puntos} refMin={s.refMin} refMax={s.refMax} />)}
            </div>
          </div>
        ))
      )}

      {paneles.length > 0 && (
        <details>
          <summary style={{ fontSize: 12.5, color: 'var(--text3)', cursor: 'pointer' }}>{paneles.length} estudio(s) cargado(s)</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {paneles.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text2)' }}>{p.fecha || 'sin fecha'} · {p.resultados.length} valores {p.fuente === 'pdf' ? '(PDF)' : p.fuente === 'foto' ? '(foto)' : ''}</span>
                <button title="Borrar este estudio" onClick={async () => { if (!(await confirm('¿Borrar este estudio del historial?', { peligro: true, confirmar: 'Borrar' }))) return; try { await borrarPanelLab(clinicId, patientId, p.id!); toast('Estudio borrado', 'success'); cargar() } catch { toast('No se pudo borrar', 'error') } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Revisión antes de guardar */}
      {revision && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={() => setRevision(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 16, padding: 20, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Revisa lo que leyó la IA</div>
              <button onClick={() => setRevision(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
            </div>
            <label style={{ fontSize: 12, color: 'var(--text2)' }}>Fecha del estudio</label>
            <input type="date" className="input" value={revision.fecha} onChange={e => setRevision({ ...revision, fecha: e.target.value })} style={{ marginBottom: 12 }} />
            {revision.resultados.length === 0 && <p style={{ fontSize: 13, color: '#d97706' }}>No se reconoció ningún valor graficable. Revisa el archivo.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {revision.resultados.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ flex: 1, color: 'var(--text)' }}>{r.etiqueta}{r.critico && <span style={{ color: '#dc2626', fontWeight: 700 }}> ⚠ crítico</span>}{r.noEvaluable && <span title={r.motivoNoEvaluable} style={{ color: '#b45309', fontWeight: 700 }}> ⚠ verificar unidad</span>}</span>
                  <input className="input" value={r.valor} onChange={e => { const v = parseFloat(e.target.value); const rs = [...revision.resultados]; rs[i] = { ...r, valor: Number.isFinite(v) ? v : r.valor }; setRevision({ ...revision, resultados: rs }) }} style={{ width: 90, textAlign: 'right' }} type="number" step="any" />
                  <span style={{ width: 60, color: 'var(--text3)', fontSize: 12 }}>{r.unidad}</span>
                  <button title="Quitar" onClick={() => setRevision({ ...revision, resultados: revision.resultados.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            {revision.noReconocidas.length > 0 && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>{revision.noReconocidas.length} no se graficarán (no reconocidos)</summary>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
                  {revision.noReconocidas.map((n, i) => <div key={i}>{n.estudio}: {n.valor} {n.unidad ?? ''}</div>)}
                </div>
              </details>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => setRevision(null)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={guardarRevision} disabled={revision.resultados.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} /> Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
