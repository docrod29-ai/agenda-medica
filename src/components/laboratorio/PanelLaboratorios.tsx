'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useCerrarConEscape } from '@/lib/ui/activable'
import { fetchAutenticado } from '@/lib/auth-client'
import { useToast } from '@/context/ToastContext'
import { guardarPanelLab, listarPanelesLab, borrarPanelLab, type PanelLaboratorio } from '@/lib/expediente/laboratorio/firestore'
import { seriesDesdeHistorial, type PanelValidado } from '@/lib/expediente/laboratorio/extraccion'
import { dictaminarSujeto, vinculoDeSujeto, type DictamenSujeto, type DestinoPaciente } from '@/lib/expediente/laboratorio/sujeto'
import { claveDeIntento } from '@/lib/idempotencia'
import { getPatient } from '@/lib/firestore'
import { GraficaLab } from './GraficaLab'
import { FlaskConical, Upload, Loader2, AlertTriangle, ShieldAlert, Trash2, Check, X } from 'lucide-react'

const GRUPO_LABEL: Record<string, string> = {
  renal: 'Función renal', hepatico: 'Función hepática', lipidos: 'Perfil de lípidos',
  glucemia: 'Glucemia', hematologia: 'Hematología', electrolitos: 'Electrolitos',
  tiroides: 'Tiroides', inflamacion: 'Inflamación', otro: 'Otros',
}

/**
 * Historial de laboratorios del paciente con gráficas de tendencia.
 *
 * Flujo: adjuntar PDF/foto → la IA transcribe (ruta laboratorio-vision) → se
 * VERIFICA de quién es la hoja → el médico REVISA lo extraído (nada se guarda
 * sin su visto bueno) → se guarda como un panel fechado → las gráficas se
 * recalculan sobre todo el historial.
 *
 * El paso de verificación no es decorativo (REG-323): «revisa lo que leyó la IA»
 * pedía repasar los NÚMEROS, nunca el SUJETO, y el panel se archivaba bajo el
 * paciente que estuviera abierto. Aquí se pinta el veredicto; quien lo hace
 * cumplir es `guardarPanelLab`, que sin vínculo no escribe — esconder el botón
 * no cierra una escritura.
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
  /**
   * La revisión guarda el DESTINO con el que se verificó, no sólo el panel. Si el
   * médico cambia de paciente con el modal abierto, el vínculo deja de valer:
   * caduca, no se re-apunta al nuevo.
   */
  const [revisionCruda, setRevision] = useState<(PanelValidado & {
    fuente: 'pdf' | 'foto'
    destino: DestinoPaciente
    dictamen: DictamenSujeto
    /** Nombre de la intención: sobrevive al reintento y evita duplicar el estudio. */
    clave: string
  }) | null>(null)
  /**
   * Una revisión PERTENECE al paciente con el que se verificó. Si cambió el
   * expediente abierto, deja de existir — no se re-apunta al nuevo. Se deriva en
   * el render en vez de limpiarse en un efecto: así no hay un instante, por
   * corto que sea, en que la pantalla ofrezca «Guardar» sobre un expediente que
   * nadie verificó.
   */
  const revision = revisionCruda
    && revisionCruda.destino.clinicId === clinicId
    && revisionCruda.destino.patientId === patientId
    ? revisionCruda : null
  /** Sólo para `sin-identificar`: el médico afirma que la hoja es de este paciente. */
  const [confirmadoSujeto, setConfirmadoSujeto] = useState(false)
  /**
   * El nombre viaja JUNTO al paciente al que pertenece, por el mismo motivo: un
   * nombre del paciente anterior sobreviviendo un render es una verificación
   * hecha contra la persona equivocada.
   */
  const [pacienteRef, setPacienteRef] = useState<{ clinicId: string; patientId: string; nombre: string } | null>(null)
  const pacienteNombre = pacienteRef && pacienteRef.clinicId === clinicId && pacienteRef.patientId === patientId
    ? pacienteRef.nombre : null
  // Un modal que sólo cierra con el ratón deja atrapado a quien navega con teclado.
  useCerrarConEscape(!!revision, () => setRevision(null))
  const fileRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(() => {
    if (!clinicId || !patientId) return
    setCargando(true)
    listarPanelesLab(clinicId, patientId).then(setPaneles).catch(() => toast('No se pudo cargar el historial de laboratorios', 'error')).finally(() => setCargando(false))
  }, [clinicId, patientId, toast])
  useEffect(cargar, [cargar])

  /**
   * El nombre del paciente sale del EXPEDIENTE, no de quien monta el componente:
   * es contra eso contra lo que se compara la hoja, y un nombre pasado por
   * parámetro sería otra vez «lo que dice la pantalla».
   */
  useEffect(() => {
    let vivo = true
    if (!clinicId || !patientId) return
    getPatient(clinicId, patientId)
      .then(p => { if (vivo) setPacienteRef({ clinicId, patientId, nombre: p?.nombre?.trim() || '' }) })
      .catch(() => { if (vivo) setPacienteRef({ clinicId, patientId, nombre: '' }) })
    return () => { vivo = false }
  }, [clinicId, patientId])

  const series = useMemo(() => seriesDesdeHistorial(paneles.map(p => ({ fecha: p.fecha, resultados: p.resultados }))), [paneles])
  const porGrupo = useMemo(() => {
    const m = new Map<string, typeof series>()
    for (const s of series) { if (!m.has(s.grupo)) m.set(s.grupo, []); m.get(s.grupo)!.push(s) }
    return [...m.entries()]
  }, [series])

  const onArchivo = async (file: File) => {
    /**
     * Sin saber a quién pertenece el expediente abierto no hay contra qué
     * verificar la hoja. Se para aquí en vez de archivar a ciegas.
     */
    if (!pacienteNombre) {
      toast('No se pudo leer el nombre del paciente de este expediente, así que no se puede verificar de quién es la hoja. Recarga e inténtalo de nuevo.', 'error')
      return
    }
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
      const panel = data.panel as PanelValidado
      const destino: DestinoPaciente = { clinicId, patientId, nombre: pacienteNombre }
      const dictamen = dictaminarSujeto(panel.sujetos ?? [], destino)
      /**
       * Lo que la hoja dice de otra persona no se enseña en el expediente de
       * ésta: se avisa y se para. Ni un renglón de PHI ajena entra a la pantalla.
       */
      if (dictamen.veredicto === 'no-coincide' || dictamen.veredicto === 'ambiguo') {
        toast(dictamen.motivo, 'error')
        return
      }
      setConfirmadoSujeto(false)
      setRevision({ ...panel, fuente: esPdf ? 'pdf' : 'foto', destino, dictamen, clave: claveDeIntento() })
    } catch { toast('Error de red al interpretar el archivo', 'error') }
    finally { setSubiendo(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const guardarRevision = async () => {
    if (!revision) return
    if (!revision.fecha) { toast('Ponle una fecha al estudio para poder graficarlo en el tiempo', 'error'); return }
    /**
     * El vínculo se acuña contra el destino con el que se VERIFICÓ, no contra el
     * paciente que esté abierto ahora. Si son distintos, `guardarPanelLab` lo
     * rechaza — aquí sólo se evita el viaje.
     */
    const vinculo = vinculoDeSujeto(revision.dictamen, revision.destino, confirmadoSujeto, new Date().toISOString())
    if (!vinculo) { toast(revision.dictamen.motivo, 'error'); return }
    try {
      await guardarPanelLab(clinicId, patientId, {
        fecha: revision.fecha, resultados: revision.resultados,
        noReconocidas: revision.noReconocidas, fuente: revision.fuente,
      }, vinculo, revision.clave)
      toast('Laboratorio guardado', 'success'); setRevision(null); setConfirmadoSujeto(false); cargar()
    } catch (e) {
      // Un rechazo por sujeto no vinculado NO es «reintenta»: es «esto no es de
      // este paciente». Decirlo mal enseñaría a insistir hasta que entre.
      toast(e instanceof Error && e.name === 'ErrorSujetoNoVinculado'
        ? e.message
        : 'NO se pudo guardar el laboratorio. Reintenta.', 'error')
    }
  }

  const criticos = series.flatMap(s => s.puntos.filter(p => p.critico).map(p => ({ etiqueta: s.etiqueta, valor: p.valor, censurada: p.censurada, unidad: s.unidad, fecha: p.fecha })))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          <FlaskConical size={18} style={{ color: 'var(--teal)' }} /> Laboratorios
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
                // El comparador va PEGADO al número: «Glucosa >400 mg/dL». Sin él
                // la nota afirmaría un valor exacto que el laboratorio no dio.
                const linea = ult.resultados.map(r => `${r.etiqueta} ${r.censurada ?? ''}${r.valor} ${r.unidad}${r.critico ? ' ⚠' : ''}`).join(' · ')
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
          <button className="btn btn-primary btn-sm" disabled={subiendo || !pacienteNombre} onClick={() => fileRef.current?.click()}
            title={pacienteNombre === null ? 'Cargando el expediente…' : !pacienteNombre ? 'No se pudo leer el nombre del paciente: sin él no se puede verificar de quién es la hoja.' : 'Adjunta el PDF o la foto del reporte'}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {subiendo ? <><Loader2 size={14} className="spin" /> Interpretando…</> : <><Upload size={14} /> Adjuntar PDF o foto</>}
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
        Sube el PDF o una foto del reporte. La IA lee los valores, tú los revisas y se grafican en el tiempo.
        Antes de guardar se comprueba que la hoja sea de <strong>{pacienteNombre || 'este paciente'}</strong>: si es de otra
        persona, se bloquea. El nombre se usa sólo para esa comprobación y no se guarda.
      </p>

      {criticos.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'color-mix(in srgb, var(--red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)', borderRadius: 12, padding: '11px 14px' }}>
          <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>
            <strong>Valores críticos en el historial:</strong> {criticos.map(c => `${c.etiqueta} ${c.censurada ?? ''}${c.valor} ${c.unidad}`).join(' · ')}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))', gap: 10 }}>
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
            {/*
              DE QUIÉN ES LA HOJA. Va ARRIBA de los valores a propósito: el
              sujeto se decide antes que las cifras, y un aviso que aparece
              debajo de una tabla no llegó (REG-323).
            */}
            {revision.dictamen.veredicto === 'sin-identificar' ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'color-mix(in srgb, var(--amber) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)', borderRadius: 10, padding: '11px 14px', marginBottom: 12 }}>
                <ShieldAlert size={16} aria-hidden="true" style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                  <strong>El archivo no dice de quién es.</strong> Nadie puede verificarlo por ti.
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8, cursor: 'pointer', minHeight: 44, padding: '4px 0' }}>
                    <input type="checkbox" checked={confirmadoSujeto} onChange={e => setConfirmadoSujeto(e.target.checked)}
                      style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1 }} />
                    <span>Confirmo que estos resultados son de <strong>{revision.destino.nombre}</strong>.</span>
                  </label>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                <Check size={14} aria-hidden="true" style={{ color: 'var(--teal)', flexShrink: 0 }} />
                <span>Verificado: la hoja es de <strong>{revision.destino.nombre}</strong>.</span>
              </div>
            )}
            <label style={{ fontSize: 12, color: 'var(--text2)' }}>Fecha del estudio</label>
            <input type="date" className="input" value={revision.fecha} onChange={e => setRevision({ ...revision, fecha: e.target.value })} style={{ marginBottom: 12 }} />
            {revision.resultados.length === 0 && <p style={{ fontSize: 13, color: 'var(--amber)' }}>No se reconoció ningún valor graficable. Revisa el archivo.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {revision.resultados.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ flex: 1, color: 'var(--text)' }}>{r.etiqueta}{r.critico && <span style={{ color: 'var(--red)', fontWeight: 700 }}> ⚠ crítico</span>}{r.noEvaluable && <span title={r.motivoNoEvaluable} style={{ color: 'var(--amber)', fontWeight: 700 }}> ⚠ verificar</span>}</span>
                  {/* El comparador del reporte, fuera del input: un `type=number`
                      no lo admite y sin él la revisión enseñaría 400 donde la
                      hoja decía «>400». No es editable porque es del laboratorio,
                      no una lectura dudosa de la IA. */}
                  {r.censurada && <span title="El laboratorio reportó un límite, no un valor exacto" style={{ color: 'var(--text2)', fontWeight: 700 }}>{r.censurada}</span>}
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
              <button className="btn btn-primary btn-sm" onClick={guardarRevision}
                disabled={revision.resultados.length === 0 || (revision.dictamen.requiereConfirmacion && !confirmadoSujeto)}
                title={revision.dictamen.requiereConfirmacion && !confirmadoSujeto ? 'Confirma primero de quién son estos resultados' : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} /> Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
