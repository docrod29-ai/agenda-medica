'use client'
/**
 * Generador de órdenes médicas (laboratorios, imagen, procedimientos).
 *
 * Comparte el template visual con recetas pero pre-pobla con estudios sugeridos
 * según el contenido de la nota (signos vitales anormales, diagnósticos, etc.).
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { getNota } from '@/lib/expediente/firestore'
import { getPatients } from '@/lib/firestore'
import type { NotaMedica } from '@/types/expediente'
import type { Patient } from '@/types'
import { RecetaDocumento } from '@/components/RecetaDocumento'
import { RecetaPreviewWrapper } from '@/components/RecetaPreviewWrapper'
import { PAPER_SIZES } from '@/lib/receta-template'
import { descargarComoPDF } from '@/lib/pdf-download'
import {
  ArrowLeft, Download, Loader2, Plus, Trash2, Printer, Settings, AlertCircle, ChevronDown,
} from 'lucide-react'

/** Sugerencias de estudios agrupadas por categoría */
const SUGERENCIAS = {
  'Laboratorio': [
    'Biometría hemática completa',
    'Química sanguínea (glucosa, urea, creatinina)',
    'Perfil de lípidos',
    'Pruebas de función hepática',
    'Examen general de orina',
    'Electrolitos séricos',
    'TSH y T4 libre',
    'Hemoglobina glucosilada (HbA1c)',
    'PCR (Proteína C reactiva)',
    'Velocidad de sedimentación globular',
    'Tiempos de coagulación (TP, TTP, INR)',
  ],
  'Imagen': [
    'Radiografía de tórax (PA y lateral)',
    'Ultrasonido abdominal',
    'Tomografía de cráneo simple',
    'Tomografía de tórax con contraste',
    'Resonancia magnética de columna',
    'Mastografía bilateral',
    'Ultrasonido renal',
  ],
  'Cardiología': [
    'Electrocardiograma de 12 derivaciones',
    'Ecocardiograma transtorácico',
    'Prueba de esfuerzo',
    'Holter de 24 horas',
  ],
  'Otros': [
    'Espirometría',
    'Endoscopia digestiva alta',
    'Colonoscopia',
    'Audiometría',
  ],
}

export default function GeneradorOrdenPage() {
  const { patientId, notaId } = useParams<{ patientId: string; notaId: string }>()
  const router = useRouter()
  const { clinicId } = useClinic()
  const { config } = useConfig()

  const [nota, setNota] = useState<NotaMedica | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [estudios, setEstudios] = useState<string[]>([])
  const [indicaciones, setIndicaciones] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [descargando, setDescargando] = useState(false)
  const [categoriaAbierta, setCategoriaAbierta] = useState<string | null>('Laboratorio')

  const folio = useMemo(() => `OM-${Date.now().toString(36).toUpperCase().slice(-7)}`, [])

  useEffect(() => {
    if (!clinicId || !patientId || !notaId) return
    Promise.all([
      getNota(clinicId, patientId, notaId),
      getPatients(clinicId),
    ]).then(([n, ps]) => {
      setNota(n)
      setPatient(ps.find(p => p.id === patientId) ?? null)
      if (n) {
        const dxs = n.diagnosticos ?? []
        const principal = dxs.find(d => d.tipo === 'definitivo') ?? dxs[0]
        if (principal) setDiagnostico(principal.descripcion + (principal.codigoCIE10 ? ` (${principal.codigoCIE10})` : ''))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clinicId, patientId, notaId])

  const recetaConfig = config?.recetaConfig ?? {
    paperSize: 'media-carta' as const,
    estilo: 'minimalista' as const,
    colorAccento: '#14b8a6',
    mostrarQR: true,
    mostrarAlergias: false,
    mostrarDiagnostico: true,
  }

  const descargarPDF = async () => {
    const el = document.getElementById('receta-doc')
    if (!el) return
    setDescargando(true)
    try {
      const paper = PAPER_SIZES[recetaConfig.paperSize ?? 'media-carta']
      const nombre = (patient?.nombre ?? 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
      const fechaCorta = new Date().toISOString().slice(0, 10)
      await descargarComoPDF(el, {
        filename: `Orden_${nombre}_${fechaCorta}`,
        format: [paper.widthMm, paper.heightMm],
        orientation: 'portrait',
        margin: 0,
      })
    } catch (e) {
      console.error('PDF error:', e)
      alert('No se pudo generar el PDF. Intenta con Imprimir → Guardar como PDF.')
    } finally {
      setDescargando(false)
    }
  }

  const toggleEstudio = (estudio: string) => {
    setEstudios(estudios.includes(estudio)
      ? estudios.filter(e => e !== estudio)
      : [...estudios, estudio]
    )
  }

  const agregarCustom = () => {
    const txt = prompt('Estudio personalizado:')
    if (txt && txt.trim()) setEstudios([...estudios, txt.trim()])
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 10, color: 'var(--text3)' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!nota) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <AlertCircle size={28} color="#f59e0b" style={{ marginBottom: 12 }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Nota no encontrada</h2>
        <button onClick={() => router.push('/expedientes')} className="btn btn-primary" style={{ marginTop: 16 }}>
          Volver a expedientes
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <button onClick={() => router.push(`/expediente/${patientId}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Expediente
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Orden Médica</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/configuracion?tab=recetas')} className="btn btn-secondary">
            <Settings size={14} /> Template
          </button>
          <button onClick={() => window.print()} className="btn btn-secondary">
            <Printer size={14} /> Imprimir
          </button>
          <button onClick={descargarPDF} disabled={descargando} className="btn btn-primary">
            {descargando
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</>
              : <><Download size={14} /> Descargar PDF</>}
          </button>
        </div>
      </div>

      <div className="orden-gen-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 24, alignItems: 'start' }}>
        <div className="no-print" style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={labelStyle}>Diagnóstico de sospecha</label>
            <input
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder="Ej: Síndrome doloroso abdominal a estudiar"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ ...labelStyle, margin: 0 }}>Estudios solicitados ({estudios.length})</label>
              <button onClick={agregarCustom} className="btn btn-secondary btn-sm">
                <Plus size={12} /> Personalizado
              </button>
            </div>

            {/* Estudios seleccionados (chips) */}
            {estudios.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {estudios.map((e, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(20,184,166,0.15)', color: 'var(--teal)',
                    padding: '6px 10px', borderRadius: 100, fontSize: 12.5, fontWeight: 600,
                  }}>
                    {e}
                    <button onClick={() => setEstudios(estudios.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', padding: 0 }}>
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Catálogo agrupado */}
            {Object.entries(SUGERENCIAS).map(([cat, items]) => {
              const abierta = categoriaAbierta === cat
              return (
                <div key={cat} style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
                  <button
                    onClick={() => setCategoriaAbierta(abierta ? null : cat)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {cat}
                    <ChevronDown size={14} style={{ transform: abierta ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .15s' }} />
                  </button>
                  {abierta && (
                    <div style={{ padding: '0 14px 12px', display: 'grid', gap: 4 }}>
                      {items.map(item => {
                        const seleccionado = estudios.includes(item)
                        return (
                          <button
                            key={item}
                            onClick={() => toggleEstudio(item)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 8px', borderRadius: 6,
                              background: seleccionado ? 'rgba(20,184,166,0.1)' : 'transparent',
                              border: seleccionado ? '1px solid rgba(20,184,166,0.4)' : '1px solid transparent',
                              color: seleccionado ? 'var(--teal)' : 'var(--text2)',
                              fontSize: 12.5, cursor: 'pointer', textAlign: 'left',
                            }}
                          >
                            <span style={{
                              width: 14, height: 14, borderRadius: 3,
                              border: `1.5px solid ${seleccionado ? 'var(--teal)' : 'var(--border)'}`,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              background: seleccionado ? 'var(--teal)' : 'transparent', flexShrink: 0,
                            }}>
                              {seleccionado && <span style={{ color: '#000', fontSize: 11, lineHeight: 1 }}>✓</span>}
                            </span>
                            {item}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div>
            <label style={labelStyle}>Indicaciones para el estudio</label>
            <textarea
              value={indicaciones}
              onChange={(e) => setIndicaciones(e.target.value)}
              placeholder="Ej: Ayuno de 8 hrs para glucosa. Sin medio de contraste por antecedente de alergia."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 8 }}>
            Vista previa · {PAPER_SIZES[recetaConfig.paperSize ?? 'media-carta'].label.split(' ')[0]}
          </div>
          <RecetaPreviewWrapper
            paperWidthMm={PAPER_SIZES[recetaConfig.paperSize ?? 'media-carta'].widthMm}
            paperHeightMm={PAPER_SIZES[recetaConfig.paperSize ?? 'media-carta'].heightMm}
            maxWidth={380}
            maxHeight={600}
          >
            <RecetaDocumento
              data={{
                tipo: 'orden',
                folio,
                fecha: new Date(),
                paciente: patient,
                diagnostico: diagnostico || undefined,
                estudios,
                indicaciones,
              }}
              config={config}
              recetaConfig={recetaConfig}
            />
          </RecetaPreviewWrapper>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receta-doc, #receta-doc * { visibility: visible !important; }
          #receta-doc {
            position: absolute; top: 0; left: 0;
            margin: 0 !important; box-shadow: none !important;
          }
          .no-print { display: none !important; }
          @page { size: ${PAPER_SIZES[recetaConfig.paperSize ?? 'media-carta'].cssPage}; margin: 0; }
        }
        @media (max-width: 1000px) {
          .orden-gen-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
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
