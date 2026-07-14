'use client'
/**
 * Generador de recetas médicas.
 *
 * Flujo: el médico firma una nota → aparece botón "Generar receta" → llega aquí
 * con la nota pre-cargada. Los medicamentos vienen pre-llenados. Puede editarlos,
 * agregar/quitar, escribir indicaciones generales, y descargar el PDF con su template.
 *
 * El médico configura el template (membrete, tamaño, estilo) en Configuración → Recetas.
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSmartBack } from '@/hooks/useSmartBack'
import { imprimirElemento } from '@/lib/print-element'
import { entradaPorMedico, overrideRecetaValido, firmaValida } from '@/lib/impreso-medico'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { getNota } from '@/lib/expediente/firestore'
import { getPatient } from '@/lib/firestore'
import type { NotaMedica, Medicamento } from '@/types/expediente'
import type { Patient } from '@/types'
import { RecetaDocumento, dimensionesImpresion, contarPaginas } from '@/components/RecetaDocumento'
import { RecetaPreviewWrapper } from '@/components/RecetaPreviewWrapper'
import { PAPER_SIZES } from '@/lib/receta-template'
import { descargarComoPDF } from '@/lib/pdf-download'
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { detectarInteracciones, detectarControlados } from '@/lib/expediente/farmacovigilancia'
import { evaluarFuncionRenal, ajusteRenalFarmacos } from '@/lib/expediente/funcion-renal'
import { descargarRecetaWord } from '@/lib/receta-word'
import {
  ArrowLeft, Download, Loader2, Plus, Trash2, Printer, Settings, AlertCircle, FileText,
  AlertTriangle, Lock, Droplet, Ban, Scale, Lightbulb, Scissors,
} from 'lucide-react'
import { Spinner } from '@/components/ui'

const VIAS: Medicamento['via'][] = ['oral', 'iv', 'im', 'sc', 'topica', 'inhalatoria', 'sublingual', 'rectal', 'otra']

export default function GeneradorRecetaPage() {
  const { patientId, notaId } = useParams<{ patientId: string; notaId: string }>()
  const router = useRouter()
  const volver = useSmartBack(`/expediente/${patientId}`)
  const { clinicId } = useClinic()
  const { config } = useConfig()

  const [nota, setNota] = useState<NotaMedica | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [indicaciones, setIndicaciones] = useState('')
  const [notaParaPaciente, setNotaParaPaciente] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [descargando, setDescargando] = useState(false)

  // Folio único (timestamp corto)
  const folio = useMemo(() => `RX-${Date.now().toString(36).toUpperCase().slice(-7)}`, [])

  // URL de verificación firmada (destino del QR): /verificar/<token HMAC>. Se pide
  // más abajo (después de calcular recetaConfig) para respetar el orden de hooks.
  const [verificacionUrl, setVerificacionUrl] = useState<string | undefined>(undefined)

  // SEGURIDAD CLÍNICA: cruce alergia↔medicamento EN LA RECETA — el artefacto
  // que se dispensa. Reactivo a cada cambio de medicamento. Antes solo se
  // chequeaba en la consulta; aquí se podía agregar un fármaco peligroso sin alerta.
  const alertasAlergia = useMemo(() => {
    if (!patient?.alergias?.trim()) return []
    const alergiasArr = patient.alergias.split(/[,;]+/).map(a => ({ alergeno: a.trim() })).filter(a => a.alergeno)
    return validarAlergiasVsMedicamentos(
      alergiasArr,
      medicamentos.filter(m => m.nombre?.trim()).map(m => ({ nombre: m.nombre })),
    )
  }, [patient?.alergias, medicamentos])

  // Interacciones fármaco-fármaco + controlados COFEPRIS (apoyo decisional)
  const meds = useMemo(() => medicamentos.filter(m => m.nombre?.trim()).map(m => ({ nombre: m.nombre })), [medicamentos])
  const interacciones = useMemo(() => detectarInteracciones(meds), [meds])
  const controlados = useMemo(() => detectarControlados(meds), [meds])

  // Función renal — opcional: el médico teclea creatinina (y peso opcional)
  // y se calcula TFG + ajuste de antimicrobianos por depuración (PROA).
  const [creatinina, setCreatinina] = useState('')
  const [pesoKg, setPesoKg] = useState('')
  const renal = useMemo(() => {
    const cr = parseFloat(creatinina)
    if (!cr || cr <= 0 || !patient?.edad) return null
    const peso = parseFloat(pesoKg)
    return evaluarFuncionRenal(cr, patient.edad, patient.sexo, peso > 0 ? peso : undefined)
  }, [creatinina, pesoKg, patient?.edad, patient?.sexo])
  const alertasRenales = useMemo(() => {
    if (!renal) return []
    return ajusteRenalFarmacos(meds, renal.depuracionParaDosis)
  }, [renal, meds])

  useEffect(() => {
    if (!clinicId || !patientId || !notaId) return
    Promise.all([
      getNota(clinicId, patientId, notaId),
      getPatient(clinicId, patientId),
    ]).then(([n, ps]) => {
      setNota(n)
      setPatient(ps)
      if (n) {
        setMedicamentos(n.medicamentos ?? [])
        // Diagnóstico principal: primero activo de tipo definitivo, o el primero
        const dxs = n.diagnosticos ?? []
        const principal = dxs.find(d => d.tipo === 'definitivo') ?? dxs[0]
        if (principal) setDiagnostico(principal.descripcion + (principal.codigoCIE10 ? ` (${principal.codigoCIE10})` : ''))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clinicId, patientId, notaId])

  // Plantilla efectiva: la del MÉDICO de la nota (si tiene una propia)
  // sobre la general de la clínica. Cada médico ya tiene su papel impreso.
  const recetaConfig = useMemo(() => {
    const base = config?.recetaConfig ?? {
      paperSize: 'media-carta' as const,
      estilo: 'minimalista' as const,
      colorAccento: '#14b8a6',
      mostrarQR: true,
      vigenciaDias: 30,
      mostrarAlergias: true,
      mostrarDiagnostico: true,
      avisoLegal: 'Esta receta es personal e intransferible.',
    }
    const medicoId = nota?.metadata?.medicoId
    const porMedico = entradaPorMedico(config?.recetasPorMedico, medicoId, overrideRecetaValido)
    const merged = porMedico ? { ...base, ...porMedico } : base
    // Impresión SIEMPRE en hoja carta (tamaño estándar que Safari y la impresora
    // respetan): la receta se centra y agranda con márgenes. El modo "papel-real"
    // (media carta exacta) NO funciona en la práctica porque Safari lo redondea a
    // A5 y recorta el diseño.
    return { ...merged, imprimirEn: 'carta' as const }
  }, [config, nota?.metadata?.medicoId])

  // Pide al servidor la URL de verificación firmada (secreto HMAC no accesible en
  // cliente). Sin datos del paciente. Si falla, el QR cae al folio.
  useEffect(() => {
    if (!clinicId || !notaId || !folio || !recetaConfig.mostrarQR) return
    let vivo = true
    fetch('/api/receta/verificacion-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicId, notaId, folio,
        doctorNombre: config?.nombreMedico ?? '',
        cedula: config?.cedulaProfesional ?? '',
      }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (vivo && j?.url) setVerificacionUrl(j.url) })
      .catch(() => { /* fallback al folio */ })
    return () => { vivo = false }
  }, [clinicId, notaId, folio, recetaConfig.mostrarQR, config?.nombreMedico, config?.cedulaProfesional])

  // Config con la firma del MÉDICO de esta nota (per-médico), si tiene la suya.
  const configFirma = useMemo(() => {
    if (!config) return config
    const medicoId = nota?.metadata?.medicoId
    const firma = entradaPorMedico(config.firmaPorMedico, medicoId, firmaValida) || config.firmaImagenDataUrl
    return { ...config, firmaImagenDataUrl: firma }
  }, [config, nota?.metadata?.medicoId])

  // Descarga un Word (.doc) editable — para el médico que prefiere ajustar
  // a su propio formato/membrete en lugar de la plantilla generada.
  const descargarWord = () => {
    descargarRecetaWord(
      {
        tipo: 'receta',
        folio,
        fecha: new Date(),
        pacienteNombre: patient?.nombre ?? '',
        pacienteEdad: patient?.edad,
        pacienteSexo: patient?.sexo,
        pacienteFechaNac: patient?.fechaNacimiento,
        alergias: patient?.alergias,
        diagnostico: diagnostico || undefined,
        medicamentos,
        indicaciones,
        notaParaPaciente,
      },
      config,
      recetaConfig,
    )
  }

  const descargarPDF = async () => {
    const el = document.getElementById('receta-doc')
    if (!el) return
    setDescargando(true)
    try {
      // El PDF usa el tamaño FÍSICO de la hoja que sale de la impresora
      // (carta si imprimirEn === 'carta', el papel de la receta si no)
      const host = dimensionesImpresion(recetaConfig)
      const nombre = (patient?.nombre ?? 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
      const fechaCorta = new Date().toISOString().slice(0, 10)
      await descargarComoPDF(el, {
        filename: `Receta_${nombre}_${fechaCorta}`,
        format: [host.widthMm, host.heightMm],
        orientation: 'portrait',
        margin: 0, // el documento ya tiene su propio padding
      })
    } catch (e) {
      console.error('PDF error:', e)
      alert('No se pudo generar el PDF. Intenta con Imprimir → Guardar como PDF.')
    } finally {
      setDescargando(false)
    }
  }

  const agregarMed = () => {
    setMedicamentos([...medicamentos, {
      nombre: '', dosis: '', via: 'oral', frecuencia: '', duracion: '',
    }])
  }

  const actualizarMed = (i: number, campo: keyof Medicamento, valor: string) => {
    const nuevos = [...medicamentos]
    nuevos[i] = { ...nuevos[i], [campo]: valor }
    setMedicamentos(nuevos)
  }

  const eliminarMed = (i: number) => {
    setMedicamentos(medicamentos.filter((_, idx) => idx !== i))
  }

  if (loading) {
    return <Spinner center label="Cargando receta…" />
  }

  if (!nota) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <AlertCircle size={28} color="#f59e0b" style={{ marginBottom: 12 }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Nota no encontrada</h2>
        <button onClick={() => router.push('/pacientes')} className="btn btn-primary" style={{ marginTop: 16 }}>
          Volver a expedientes
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Barra superior */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Atrás
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Generador de Receta</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/configuracion?tab=recetas')} className="btn btn-secondary" title="Configurar template">
            <Settings size={14} /> Template
          </button>
          <button onClick={() => { const h = dimensionesImpresion(recetaConfig); imprimirElemento(document.getElementById('receta-doc'), 'Receta', { anchoMm: h.widthMm, altoMm: h.heightMm }) }} className="btn btn-secondary">
            <Printer size={14} /> Imprimir
          </button>
          <button onClick={descargarWord} className="btn btn-secondary" title="Documento editable para tu membrete">
            <FileText size={14} /> Word
          </button>
          <button onClick={descargarPDF} disabled={descargando} className="btn btn-primary">
            {descargando
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</>
              : <><Download size={14} /> Descargar PDF</>}
          </button>
        </div>
      </div>

      <div className="receta-gen-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 24, alignItems: 'start' }}>
        {/* Editor (no se imprime) */}
        <div className="no-print" style={{ display: 'grid', gap: 16 }}>
          {/* Diagnóstico */}
          <div>
            <label style={labelStyle}>Diagnóstico (opcional)</label>
            <input
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder="Ej: Faringitis aguda (J02.9)"
              style={inputStyle}
            />
          </div>

          {/* ⚠️ Alerta de alergia ↔ medicamento — bloquea visualmente antes de imprimir */}
          {alertasAlergia.length > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(220,38,38,0.10)', border: '2px solid #b91c1c',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} className="ds-icon" /> Alerta de alergia — revisa antes de imprimir
              </div>
              {alertasAlergia.map((a, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>• {a.mensaje}</div>
              ))}
              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 4 }}>
                Paciente alérgico a: <strong>{patient?.alergias}</strong>. Si decides continuar, es bajo tu criterio clínico.
              </div>
            </div>
          )}

          {/* ⚠️ Interacciones fármaco-fármaco */}
          {interacciones.length > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(217,119,6,0.10)', border: '1.5px solid var(--amber)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} className="ds-icon" /> Posibles interacciones farmacológicas
              </div>
              {interacciones.map((it, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45, marginBottom: 3 }}>
                  <strong>{it.titulo}</strong>{it.severidad === 'mayor' ? ' (mayor)' : ''} — {it.detalle}
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>Apoyo decisional; no sustituye tu criterio.</div>
            </div>
          )}

          {/* 🔒 Controlados COFEPRIS */}
          {controlados.length > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(61,90,254,0.08)', border: '1.5px solid var(--nexus)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--nexus)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={15} className="ds-icon" /> Medicamento(s) controlado(s) — requisitos COFEPRIS
              </div>
              {controlados.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45, marginBottom: 3 }}>
                  <strong>{c.farmaco}</strong> — {c.requisito}
                </div>
              ))}
            </div>
          )}

          {/* 🩺 Función renal — ajuste de dosis PROA (opcional) */}
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--s2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Droplet size={14} className="ds-icon" /> Función renal (opcional) — ajuste de antimicrobianos
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ ...labelStyle, fontSize: 10.5 }}>Creatinina (mg/dL)</label>
                <input value={creatinina} onChange={e => setCreatinina(e.target.value)} placeholder="1.0"
                  inputMode="decimal" style={{ ...inputStyle, width: 90 }} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 10.5 }}>Peso (kg, opc.)</label>
                <input value={pesoKg} onChange={e => setPesoKg(e.target.value)} placeholder="70"
                  inputMode="decimal" style={{ ...inputStyle, width: 90 }} />
              </div>
              {renal && (
                <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.4 }}>
                  <div><strong>TFG (CKD-EPI):</strong> {renal.egfrCkdEpi} mL/min/1.73m² · <strong>{renal.estadio}</strong> ({renal.estadioDesc})</div>
                  {renal.crClCockcroft != null && <div><strong>CrCl (Cockcroft):</strong> {renal.crClCockcroft} mL/min</div>}
                </div>
              )}
            </div>
            {!patient?.edad && (
              <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 6 }}>
                Falta la edad del paciente en su expediente para calcular la TFG.
              </div>
            )}
            {alertasRenales.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {alertasRenales.map((a, i) => (
                  <div key={i} style={{
                    fontSize: 12, lineHeight: 1.45, padding: '6px 10px', borderRadius: 6,
                    background: a.severidad === 'evitar' ? 'rgba(220,38,38,0.10)' : 'rgba(217,119,6,0.10)',
                    borderLeft: `3px solid ${a.severidad === 'evitar' ? '#b91c1c' : 'var(--amber)'}`,
                    color: 'var(--text)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {a.severidad === 'evitar' ? <Ban size={13} className="ds-icon" /> : <Scale size={13} className="ds-icon" />}{a.mensaje}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medicamentos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ ...labelStyle, margin: 0 }}>Medicamentos</label>
              <button onClick={agregarMed} className="btn btn-secondary btn-sm">
                <Plus size={12} /> Agregar
              </button>
            </div>
            {medicamentos.length === 0 && (
              <div style={{ padding: 14, background: 'var(--s2)', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
                Sin medicamentos. Agrega uno o usa "Solo indicaciones".
              </div>
            )}
            {medicamentos.map((m, i) => (
              <MedRow
                key={i}
                med={m}
                onChange={(campo, valor) => actualizarMed(i, campo, valor)}
                onEliminar={() => eliminarMed(i)}
              />
            ))}
          </div>

          {/* Indicaciones */}
          <div>
            <label style={labelStyle}>Indicaciones generales</label>
            <textarea
              value={indicaciones}
              onChange={(e) => setIndicaciones(e.target.value)}
              placeholder="Ej: Reposo relativo, abundantes líquidos, dieta blanda…"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Nota destacada al paciente */}
          <div>
            <label style={labelStyle}>Nota al paciente (caja destacada)</label>
            <textarea
              value={notaParaPaciente}
              onChange={(e) => setNotaParaPaciente(e.target.value)}
              placeholder="Ej: Si presenta fiebre mayor a 39°C, acudir a urgencias."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: 10, background: 'rgba(20,184,166,0.06)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
            <Lightbulb size={14} className="ds-icon" style={{ marginTop: 1, flexShrink: 0 }} />
            <span>¿Quieres cambiar el tamaño del papel, subir tu papel membretado o cambiar el estilo?
            Ve a <strong>Configuración → Recetas y órdenes</strong>.</span>
          </div>
        </div>

        {/* Preview en vivo — escalado para nunca desbordar; multi-hoja apilada */}
        <div style={{ position: 'sticky', top: 20 }}>
          {(() => {
            const dataPreview = {
              tipo: 'receta' as const,
              folio,
              fecha: new Date(),
              paciente: patient,
              diagnostico: diagnostico || undefined,
              medicamentos,
              indicaciones,
              notaParaPaciente,
              verificacionUrl,
            }
            const host = dimensionesImpresion(recetaConfig)
            const numPages = contarPaginas(dataPreview, config, recetaConfig)
            return (
              <>
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 8 }}>
                  Vista previa · {PAPER_SIZES[recetaConfig.paperSize ?? 'media-carta'].label.split(' ')[0]}
                  {numPages > 1 && <strong> · {numPages} hojas</strong>}
                  {host.esHostCarta && <> · impresa en carta <Scissors size={11} className="ds-icon" style={{ display: 'inline' }} /></>}
                </div>
                <RecetaPreviewWrapper
                  paperWidthMm={host.widthMm}
                  paperHeightMm={host.heightMm}
                  numPages={numPages}
                  maxWidth={380}
                  maxHeight={600}
                >
                  <RecetaDocumento
                    data={dataPreview}
                    config={configFirma}
                    recetaConfig={recetaConfig}
                  />
                </RecetaPreviewWrapper>
              </>
            )
          })()}
        </div>
      </div>

      {/* CSS de impresión: solo el documento, en tamaño de papel correcto.
          Cada .receta-sheet-wrap lleva su page-break inline → multi-hoja limpia. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receta-doc, #receta-doc * { visibility: visible !important; }
          #receta-doc {
            position: absolute; top: 0; left: 0;
            margin: 0 !important;
          }
          #receta-doc .receta-sheet { box-shadow: none !important; margin: 0 !important; }
          .no-print { display: none !important; }
          @page { size: ${dimensionesImpresion(recetaConfig).cssPage}; margin: 0; }
        }
        @media (max-width: 1000px) {
          .receta-gen-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

function MedRow({
  med, onChange, onEliminar,
}: {
  med: Medicamento
  onChange: (campo: keyof Medicamento, valor: string) => void
  onEliminar: () => void
}) {
  return (
    <div style={{ padding: 12, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
        <input
          value={med.nombre}
          onChange={(e) => onChange('nombre', e.target.value)}
          placeholder="Medicamento (DCI)"
          style={inputStyle}
        />
        <input
          value={med.dosis}
          onChange={(e) => onChange('dosis', e.target.value)}
          placeholder="500 mg"
          style={inputStyle}
        />
        <button onClick={onEliminar} title="Quitar" style={{
          background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
          color: '#f87171', borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
        }}>
          <Trash2 size={12} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 6, marginTop: 6 }}>
        <select
          value={med.via}
          onChange={(e) => onChange('via', e.target.value)}
          style={inputStyle}
        >
          {VIAS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <input
          value={med.frecuencia}
          onChange={(e) => onChange('frecuencia', e.target.value)}
          placeholder="Cada 8 hrs"
          style={inputStyle}
        />
      </div>
      {/* Duración + indicación: ahora editables (antes solo salían en el Word/PDF) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 6, marginTop: 6 }}>
        <input
          value={med.duracion ?? ''}
          onChange={(e) => onChange('duracion', e.target.value)}
          placeholder="Por 7 días"
          style={inputStyle}
        />
        <input
          value={med.indicacion ?? ''}
          onChange={(e) => onChange('indicacion', e.target.value)}
          placeholder="Indicación (ej. con alimentos)"
          style={inputStyle}
        />
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}
