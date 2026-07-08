'use client'
/**
 * Generador de órdenes médicas (laboratorios, imagen, procedimientos).
 *
 * Comparte el template visual con recetas pero pre-pobla con estudios sugeridos
 * según el contenido de la nota (signos vitales anormales, diagnósticos, etc.).
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSmartBack } from '@/hooks/useSmartBack'
import { imprimirElemento } from '@/lib/print-element'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { getNota } from '@/lib/expediente/firestore'
import { getPatients } from '@/lib/firestore'
import type { NotaMedica } from '@/types/expediente'
import type { Patient } from '@/types'
import { RecetaDocumento, dimensionesImpresion, contarPaginas } from '@/components/RecetaDocumento'
import { RecetaPreviewWrapper } from '@/components/RecetaPreviewWrapper'
import { PAPER_SIZES } from '@/lib/receta-template'
import { descargarComoPDF } from '@/lib/pdf-download'
import { descargarRecetaWord } from '@/lib/receta-word'
import {
  ArrowLeft, Download, Loader2, Plus, Trash2, Printer, Settings, AlertCircle, ChevronDown, FileText, Check, Scissors,
} from 'lucide-react'
import { Spinner } from '@/components/ui'

/** Sugerencias de estudios agrupadas por categoría (catálogo amplio por especialidad) */
const SUGERENCIAS: Record<string, string[]> = {
  'Laboratorio general': [
    'Biometría hemática completa',
    'Química sanguínea de 6 elementos',
    'Química sanguínea de 27 elementos',
    'Glucosa en ayuno',
    'Curva de tolerancia a la glucosa (CTOG)',
    'Hemoglobina glucosilada (HbA1c)',
    'Electrolitos séricos (Na, K, Cl)',
    'Electrolitos ampliados (Ca, Mg, P)',
    'Perfil de lípidos (colesterol, HDL, LDL, triglicéridos)',
    'Pruebas de función hepática',
    'Ácido úrico',
    'Proteína C reactiva (PCR)',
    'Velocidad de sedimentación globular (VSG)',
    'Procalcitonina',
    'Deshidrogenasa láctica (DHL)',
    'Examen general de orina (EGO)',
    'Proteínas totales y albúmina',
  ],
  'Hematología': [
    'Biometría hemática completa',
    'Frotis de sangre periférica',
    'Reticulocitos',
    'Grupo sanguíneo y Rh',
    'Coombs directo e indirecto',
    'Hierro sérico, ferritina, transferrina, % saturación',
    'Vitamina B12 y ácido fólico',
    'Haptoglobina',
    'Electroforesis de hemoglobina',
    'Electroforesis de proteínas séricas',
    'Inmunofijación en suero y orina',
    'Cadenas ligeras libres (kappa/lambda)',
    'Beta-2 microglobulina',
  ],
  'Coagulación': [
    'Tiempo de protrombina (TP) e INR',
    'Tiempo de tromboplastina parcial (TTPa)',
    'Fibrinógeno',
    'Dímero D',
    'Tiempo de trombina',
    'Anticoagulante lúpico',
    'Antitrombina III, proteína C, proteína S',
    'Agregometría plaquetaria',
  ],
  'Cardiología': [
    'Troponina I/T de alta sensibilidad',
    'CK-MB',
    'Péptido natriurético (BNP / NT-proBNP)',
    'Perfil de lípidos',
    'Electrocardiograma de 12 derivaciones',
    'Ecocardiograma transtorácico',
    'Ecocardiograma transesofágico',
    'Prueba de esfuerzo (ergometría)',
    'Holter de 24-48 horas',
    'MAPA (monitoreo ambulatorio de presión arterial)',
    'Angiotomografía coronaria',
    'Gammagrama de perfusión miocárdica',
    'Cateterismo cardiaco / coronariografía',
  ],
  'Endocrinología': [
    'TSH, T4 libre y T3',
    'Anticuerpos antitiroideos (anti-TPO, anti-tiroglobulina)',
    'Cortisol basal (AM/PM)',
    'ACTH',
    'Prueba de supresión con dexametasona',
    'Insulina en ayuno / HOMA-IR',
    'Péptido C',
    'Hemoglobina glucosilada (HbA1c)',
    'Prolactina',
    'Hormona de crecimiento / IGF-1',
    'Perfil hormonal (FSH, LH, estradiol, testosterona)',
    'PTH (paratohormona)',
    'Vitamina D (25-OH)',
    'Calcio, fósforo y fosfatasa alcalina',
    'Metanefrinas plasmáticas/urinarias',
    'Aldosterona y renina',
  ],
  'Nefrología': [
    'Creatinina sérica + TFG estimada',
    'Urea / BUN',
    'Cistatina C',
    'Examen general de orina',
    'Relación albúmina/creatinina en orina',
    'Relación proteína/creatinina en orina',
    'Proteinuria de 24 horas',
    'Depuración de creatinina (orina 24 h)',
    'Electrolitos séricos y urinarios',
    'Gasometría venosa/arterial',
    'Complemento C3 y C4',
    'Anticuerpos anti-MBG y ANCA',
    'Ultrasonido renal y de vías urinarias',
  ],
  'Reumatología / Inmunología': [
    'Factor reumatoide',
    'Anticuerpos anti-CCP (péptido citrulinado)',
    'Anticuerpos antinucleares (ANA)',
    'Anti-DNA de doble cadena',
    'Perfil ENA (Sm, RNP, Ro/SSA, La/SSB, Scl-70, Jo-1)',
    'Complemento C3, C4 y CH50',
    'ANCA (anti-PR3 / anti-MPO)',
    'Anticuerpos antifosfolípidos (anticardiolipina, anti-β2GP1)',
    'HLA-B27',
    'Inmunoglobulinas séricas (IgG, IgA, IgM, IgE)',
    'Subclases de IgG',
    'Crioglobulinas',
    'Enzima convertidora de angiotensina (ECA)',
    'Ácido úrico',
  ],
  'Gastroenterología / Hepatología': [
    'Pruebas de función hepática completas',
    'Bilirrubinas (total, directa, indirecta)',
    'Amilasa y lipasa',
    'Anticuerpos antimitocondriales / antimúsculo liso / anti-LKM',
    'Alfa-fetoproteína (AFP)',
    'Panel de hepatitis (HBsAg, anti-HBc, anti-HBs, anti-VHC)',
    'Anticuerpos anti-transglutaminasa (celiaquía)',
    'Calprotectina fecal',
    'Sangre oculta en heces',
    'Coproparasitoscópico en serie',
    'Antígeno de H. pylori en heces',
  ],
  'Microbiología / Infectología': [
    'Hemocultivos (2-3 tomas)',
    'Urocultivo',
    'Coprocultivo',
    'Cultivo de expectoración / esputo',
    'Cultivo de secreción de herida',
    'Cultivo de líquido (LCR, pleural, articular, ascítico)',
    'Cultivo de punta de catéter',
    'Tinción de Gram',
    'Baciloscopía (BAAR) seriada',
    'GeneXpert MTB/RIF / cultivo para micobacterias',
    'Antígeno urinario de neumococo y Legionella',
    'Panel respiratorio viral por PCR',
    'PCR SARS-CoV-2',
    'Toxina / PCR de Clostridioides difficile',
    'Serología VIH (Ag/Ab 4ª generación)',
    'Reacciones febriles (Widal)',
    'VDRL / RPR',
    'Antígeno y anticuerpos de dengue',
    'Gota gruesa / prueba rápida de malaria',
    'Galactomanano y (1,3)-β-D-glucano',
    'Antígeno criptocócico (CrAg)',
    'Cultivos de vigilancia MDR (hisopado nasal/rectal)',
  ],
  'Ginecología / Obstetricia': [
    'Citología cervical (Papanicolaou)',
    'Prueba de VPH (PCR / captura híbrida)',
    'Cultivo cervicovaginal / exudado vaginal',
    'Fracción beta de hCG cuantitativa',
    'Perfil hormonal (FSH, LH, estradiol, progesterona, prolactina)',
    'Ultrasonido pélvico / transvaginal',
    'Ultrasonido obstétrico',
    'Ultrasonido mamario',
    'Mastografía',
    'Tamiz prenatal (dúo / triple / cuádruple marcador)',
    'Curva de tolerancia a la glucosa (tamiz gestacional)',
    'Marcadores tumorales (CA-125, HE4)',
    'Colposcopía',
  ],
  'Urología': [
    'Antígeno prostático específico (APE total y libre)',
    'Examen general de orina',
    'Urocultivo',
    'Citología urinaria',
    'Ultrasonido renal y vesical (con residuo posmiccional)',
    'Ultrasonido prostático transrectal',
    'Uroflujometría',
    'Urotomografía',
    'Cistoscopía',
    'Espermatobioscopía (espermograma)',
    'Testosterona total y libre',
  ],
  'Neumología': [
    'Gasometría arterial',
    'Espirometría con broncodilatador',
    'Pletismografía / difusión de CO (DLCO)',
    'Radiografía de tórax',
    'TC de tórax de alta resolución',
    'Caminata de 6 minutos',
    'Óxido nítrico exhalado (FeNO)',
    'Polisomnografía',
    'IgE específica / panel de alérgenos',
  ],
  'Neurología': [
    'Punción lumbar y análisis de LCR',
    'Electroencefalograma',
    'Electromiografía y neuroconducción',
    'TC de cráneo',
    'RM de cráneo',
    'Bandas oligoclonales en LCR',
    'Anticuerpos anti-receptor de acetilcolina',
  ],
  'Marcadores tumorales': [
    'Alfa-fetoproteína (AFP)',
    'Antígeno carcinoembrionario (CEA)',
    'CA 19-9',
    'CA 125',
    'CA 15-3',
    'Antígeno prostático (APE)',
    'Beta-hCG',
    'Enolasa neuronal específica (NSE)',
    'Cromogranina A',
    'Tiroglobulina',
  ],
  'Cirugía / Preoperatorio': [
    'Biometría hemática completa',
    'Química sanguínea',
    'Tiempos de coagulación (TP, TTPa, INR)',
    'Grupo sanguíneo y Rh',
    'Pruebas cruzadas',
    'Electrolitos séricos',
    'Examen general de orina',
    'Electrocardiograma',
    'Radiografía de tórax',
    'Prueba de embarazo (mujeres en edad fértil)',
    'Valoración preanestésica',
    'Serologías (VIH, VHB, VHC)',
  ],
  'Imagen — Radiografía': [
    'Radiografía de tórax (PA y lateral)',
    'Radiografía de abdomen (simple y de pie)',
    'Radiografía de columna (cervical / dorsal / lumbar)',
    'Radiografía de cráneo',
    'Radiografía de pelvis',
    'Radiografía de extremidades',
    'Serie ósea metastásica',
  ],
  'Imagen — Ultrasonido': [
    'Ultrasonido abdominal completo',
    'Ultrasonido hepático y de vías biliares',
    'Ultrasonido renal y de vías urinarias',
    'Ultrasonido pélvico / transvaginal',
    'Ultrasonido prostático',
    'Ultrasonido de tiroides',
    'Ultrasonido mamario',
    'Ultrasonido Doppler venoso/arterial de miembros',
    'Ultrasonido Doppler carotídeo',
    'Ultrasonido de partes blandas / articular',
  ],
  'Imagen — Tomografía (TC)': [
    'TC de cráneo simple',
    'TC de cráneo contrastada',
    'TC de tórax (simple / contrastada)',
    'Angiotomografía pulmonar',
    'TC de abdomen y pelvis contrastada',
    'Urotomografía',
    'Angiotomografía coronaria',
    'TC de senos paranasales',
    'TC de columna',
  ],
  'Imagen — Resonancia (RM)': [
    'RM de cráneo',
    'RM de columna (cervical / dorsal / lumbar)',
    'RM de abdomen / colangiorresonancia',
    'RM de pelvis',
    'RM articular (rodilla / hombro / cadera)',
    'Angiorresonancia',
    'RM cardiaca',
  ],
  'Imagen — Nuclear / Otros': [
    'Mastografía',
    'Densitometría ósea (DEXA)',
    'Gammagrama óseo',
    'Gammagrama tiroideo',
    'Gammagrama de perfusión miocárdica',
    'PET-CT',
    'Endoscopia digestiva alta',
    'Colonoscopia',
    'Broncoscopía',
    'Espirometría',
    'Audiometría',
  ],
}

export default function GeneradorOrdenPage() {
  const { patientId, notaId } = useParams<{ patientId: string; notaId: string }>()
  const router = useRouter()
  const volver = useSmartBack(`/expediente/${patientId}`)
  const { clinicId } = useClinic()
  const { config } = useConfig()

  const [nota, setNota] = useState<NotaMedica | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [estudios, setEstudios] = useState<string[]>([])
  const [indicaciones, setIndicaciones] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [descargando, setDescargando] = useState(false)
  const [categoriaAbierta, setCategoriaAbierta] = useState<string | null>('Laboratorio general')

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
        // Estudios pre-poblados por la nota (p. ej. valoración del inmunocomprometido)
        if (Array.isArray(n.estudiosOrden) && n.estudiosOrden.length) setEstudios(n.estudiosOrden)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clinicId, patientId, notaId])

  // Plantilla efectiva: la del MÉDICO de la nota sobre la general de la clínica
  const recetaConfig = useMemo(() => {
    const base = config?.recetaConfig ?? {
      paperSize: 'media-carta' as const,
      estilo: 'minimalista' as const,
      colorAccento: '#14b8a6',
      mostrarQR: true,
      mostrarAlergias: false,
      mostrarDiagnostico: true,
    }
    const medicoId = nota?.metadata?.medicoId
    const porMedico = medicoId ? config?.recetasPorMedico?.[medicoId] : undefined
    return porMedico ? { ...base, ...porMedico } : base
  }, [config, nota?.metadata?.medicoId])

  const descargarWord = () => {
    descargarRecetaWord(
      {
        tipo: 'orden',
        folio,
        fecha: new Date(),
        pacienteNombre: patient?.nombre ?? '',
        pacienteEdad: patient?.edad,
        pacienteSexo: patient?.sexo,
        pacienteFechaNac: patient?.fechaNacimiento,
        diagnostico: diagnostico || undefined,
        estudios,
        indicaciones,
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
      const host = dimensionesImpresion(recetaConfig)
      const nombre = (patient?.nombre ?? 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
      const fechaCorta = new Date().toISOString().slice(0, 10)
      await descargarComoPDF(el, {
        filename: `Orden_${nombre}_${fechaCorta}`,
        format: [host.widthMm, host.heightMm],
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
    return <Spinner center label="Cargando…" />
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
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Atrás
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Orden Médica</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/configuracion?tab=recetas')} className="btn btn-secondary">
            <Settings size={14} /> Template
          </button>
          <button onClick={() => imprimirElemento(document.getElementById('receta-doc'), 'Orden')} className="btn btn-secondary">
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
                              {seleccionado && <Check size={11} color="#000" strokeWidth={3} />}
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
          {(() => {
            const dataPreview = {
              tipo: 'orden' as const,
              folio,
              fecha: new Date(),
              paciente: patient,
              diagnostico: diagnostico || undefined,
              estudios,
              indicaciones,
            }
            const host = dimensionesImpresion(recetaConfig)
            const numPages = contarPaginas(dataPreview, config, recetaConfig)
            return (
              <>
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 8 }}>
                  Vista previa · {PAPER_SIZES[recetaConfig.paperSize ?? 'media-carta'].label.split(' ')[0]}
                  {numPages > 1 && <strong> · {numPages} hojas</strong>}
                  {estudios.length > 6 && ' · checklist 2 columnas'}
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
                    config={config}
                    recetaConfig={recetaConfig}
                  />
                </RecetaPreviewWrapper>
              </>
            )
          })()}
        </div>
      </div>

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
