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
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { getNota } from '@/lib/expediente/firestore'
import { getPatients } from '@/lib/firestore'
import type { NotaMedica, Medicamento } from '@/types/expediente'
import type { Patient } from '@/types'
import { RecetaDocumento } from '@/components/RecetaDocumento'
import { PAPER_SIZES } from '@/lib/receta-template'
import { descargarComoPDF } from '@/lib/pdf-download'
import {
  ArrowLeft, Download, Loader2, Plus, Trash2, Printer, Settings, AlertCircle,
} from 'lucide-react'

const VIAS: Medicamento['via'][] = ['oral', 'iv', 'im', 'sc', 'topica', 'inhalatoria', 'sublingual', 'rectal', 'otra']

export default function GeneradorRecetaPage() {
  const { patientId, notaId } = useParams<{ patientId: string; notaId: string }>()
  const router = useRouter()
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

  useEffect(() => {
    if (!clinicId || !patientId || !notaId) return
    Promise.all([
      getNota(clinicId, patientId, notaId),
      getPatients(clinicId),
    ]).then(([n, ps]) => {
      setNota(n)
      setPatient(ps.find(p => p.id === patientId) ?? null)
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

  const recetaConfig = config?.recetaConfig ?? {
    paperSize: 'media-carta' as const,
    estilo: 'minimalista' as const,
    colorAccento: '#14b8a6',
    mostrarQR: true,
    vigenciaDias: 30,
    mostrarAlergias: true,
    mostrarDiagnostico: true,
    avisoLegal: 'Esta receta es personal e intransferible.',
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
        filename: `Receta_${nombre}_${fechaCorta}`,
        format: [paper.widthMm, paper.heightMm],
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
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 10, color: 'var(--text3)' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Cargando receta…
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
      {/* Barra superior */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <button onClick={() => router.push(`/expediente/${patientId}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Expediente
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Generador de Receta</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/configuracion?tab=recetas')} className="btn btn-secondary" title="Configurar template">
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 24, alignItems: 'start' }}>
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

          <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: 10, background: 'rgba(20,184,166,0.06)', borderRadius: 8 }}>
            💡 ¿Quieres cambiar el tamaño del papel, subir tu papel membretado o cambiar el estilo?
            Ve a <strong>Configuración → 🩺 Recetas y órdenes</strong>.
          </div>
        </div>

        {/* Preview en vivo */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <RecetaDocumento
            data={{
              tipo: 'receta',
              folio,
              fecha: new Date(),
              paciente: patient,
              diagnostico: diagnostico || undefined,
              medicamentos,
              indicaciones,
              notaParaPaciente,
            }}
            config={config}
            recetaConfig={recetaConfig}
          />
        </div>
      </div>

      {/* CSS de impresión: solo el documento, en tamaño de papel correcto */}
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
        @media (max-width: 900px) {
          [style*="gridTemplateColumns"][style*="auto"] {
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 6, marginTop: 6 }}>
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
        <input
          value={med.duracion}
          onChange={(e) => onChange('duracion', e.target.value)}
          placeholder="7 días"
          style={inputStyle}
        />
      </div>
      <input
        value={med.indicacion ?? ''}
        onChange={(e) => onChange('indicacion', e.target.value)}
        placeholder="Indicación o nota (opcional)"
        style={{ ...inputStyle, marginTop: 6 }}
      />
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
