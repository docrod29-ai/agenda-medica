'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSmartBack } from '@/hooks/useSmartBack'
import { imprimirElemento } from '@/lib/print-element'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { getNota } from '@/lib/expediente/firestore'
import { getPatients } from '@/lib/firestore'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import type { NotaMedica } from '@/types/expediente'
import type { Patient } from '@/types'
import { ArrowLeft, Printer, Loader2, Download, Pill, ClipboardList, AlertTriangle, Check, FileText } from 'lucide-react'
import { Spinner, EmptyState } from '@/components/ui'
import { descargarComoPDF } from '@/lib/pdf-download'

export default function NotaImprimiblePage() {
  const { patientId, notaId } = useParams<{ patientId: string; notaId: string }>()
  const router = useRouter()
  const volver = useSmartBack(`/expediente/${patientId}`)
  const { clinicId } = useClinic()
  const { config } = useConfig()
  const [nota, setNota] = useState<NotaMedica | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [descargando, setDescargando] = useState(false)
  // null = sin verificar/no aplica · true = sello íntegro · false = ALTERADA
  const [integridad, setIntegridad] = useState<'verificada' | 'alterada' | 'legado' | 'sin-sello' | null>(null)

  const descargarPDF = async () => {
    const el = document.getElementById('doc')
    if (!el) return
    setDescargando(true)
    try {
      const nombre = (patient?.nombre ?? 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
      const fechaCorta = new Date(nota?.fechaConsulta ?? Date.now()).toISOString().slice(0, 10)
      await descargarComoPDF(el, { filename: `Nota_${nombre}_${fechaCorta}` })
      // NOM-024: registrar impresión/descarga del documento
      if (clinicId) {
        const { logAudit } = await import('@/lib/expediente/audit-log')
        await logAudit({ evento: 'nota_impresion', clinicId, patientId, notaId })
      }
    } catch (e) {
      console.error('PDF error:', e)
      alert('No se pudo generar el PDF. Intenta con Imprimir → Guardar como PDF.')
    } finally {
      setDescargando(false)
    }
  }

  useEffect(() => {
    if (!clinicId || !patientId || !notaId) return
    Promise.all([
      getNota(clinicId, patientId, notaId),
      getPatients(clinicId),
    ]).then(async ([n, ps]) => {
      setNota(n)
      setPatient(ps.find(p => p.id === patientId) ?? null)
      setLoading(false)
      // Verificar el sello SHA-256 de las notas firmadas. Antes el sello se
      // MOSTRABA sin recomputarse — daba garantía de no-alteración que el
      // sistema no comprobaba. Ahora se recalcula y se compara.
      if (n && n.estado === 'firmada') {
        try {
          const { verificarIntegridadEstado } = await import('@/lib/expediente/integrity')
          setIntegridad(await verificarIntegridadEstado(n))
        } catch { setIntegridad(null) }
      }
    })
    // NOM-024 Art. 6.5: registrar lectura de nota clínica
    import('@/lib/expediente/audit-log').then(({ logAudit }) => {
      logAudit({ evento: 'nota_lectura', clinicId, patientId, notaId })
    })
  }, [clinicId, patientId, notaId])

  if (loading) {
    return <Spinner center label="Cargando documento…" />
  }
  if (!nota) return <EmptyState icon={<FileText size={22} />} title="Nota no encontrada" />


  const fecha = new Date(nota.fechaConsulta).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })
  const medico = nota.firma?.nombreMedico || config?.nombreMedico || 'Médico'
  const cedula = nota.firma?.cedulaProfesional || config?.cedulaProfesional || '—'
  const especialidad = nota.firma?.especialidad || config?.especialidad || ''
  const establecimiento = nota.metadata.establecimiento || config?.nombreClinica || ''
  // Hoja membretada: la del MÉDICO de la nota si tiene una propia; si no, la
  // general del consultorio. Se ignora un valor vacío/roto (evita descuadrar).
  const medMembrete = nota.metadata?.medicoId ? config?.notaMembretePorMedico?.[nota.metadata.medicoId] : undefined
  const mem = (medMembrete?.url ?? config?.notaMembreteDataUrl)?.trim()
  const membrete = (mem && /^(https?:|\/api\/|data:image)/.test(mem)) ? mem : undefined
  const mMemb = medMembrete?.margenes ?? config?.notaMembreteMargenes ?? { top: 42, right: 22, bottom: 28, left: 22 }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: 24 }}>
      {/* Barra de acciones (no se imprime) */}
      <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Atrás
        </button>
        <div className="actions-row">
          <button onClick={descargarPDF} disabled={descargando} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--teal)', color: '#000', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: descargando ? 'default' : 'pointer' }}>
            {descargando
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</>
              : <><Download size={16} /> Descargar PDF</>}
          </button>
          <button onClick={() => imprimirElemento(document.getElementById('doc'), 'Nota médica', { formato: membrete ? 'membrete' : 'carta' })} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Printer size={16} /> Imprimir
          </button>
          {/* Generar receta y orden — solo cuando la nota está firmada */}
          {nota.estado === 'firmada' && (
            <>
              <button onClick={() => router.push(`/receta/${patientId}/${notaId}`)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(20,184,166,0.12)', color: 'var(--teal)', border: '1px solid rgba(20,184,166,0.4)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                <Pill size={16} /> Receta
              </button>
              <button onClick={() => router.push(`/orden/${patientId}/${notaId}`)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                <ClipboardList size={16} /> Orden
              </button>
            </>
          )}
        </div>
      </div>

      {/* Documento (hoja blanca o hoja membretada del médico) */}
      <div id="doc" style={membrete ? {
        maxWidth: 800, margin: '0 auto', background: '#fff', color: '#1a1a1a',
        position: 'relative', borderRadius: 4, fontFamily: '"Times New Roman", Georgia, serif',
        lineHeight: 1.4, fontSize: 13, aspectRatio: '216 / 279',  // proporción carta para la vista previa
        paddingTop: `${mMemb.top}mm`, paddingBottom: `${mMemb.bottom}mm`,
        paddingLeft: `${mMemb.left}mm`, paddingRight: `${mMemb.right}mm`, boxSizing: 'border-box',
      } : {
        maxWidth: 800, margin: '0 auto', background: '#fff', color: '#1a1a1a', position: 'relative',
        padding: '40px 48px', borderRadius: 4, fontFamily: '"Times New Roman", Georgia, serif',
        lineHeight: 1.4, fontSize: 13,
      }}>
        {/* Hoja membretada del médico como fondo (se repite en cada página al imprimir) */}
        {membrete && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="membrete-bg" src={membrete} alt="" aria-hidden
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: -1, pointerEvents: 'none' }} />
        )}
        {/* Encabezado de texto — SOLO si NO hay hoja membretada (la membretada ya lo trae) */}
        {!membrete && (
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{medico}</div>
          <div style={{ fontSize: 12 }}>{especialidad}{especialidad && cedula !== '—' ? ' · ' : ''}{cedula !== '—' ? `Cédula Prof. ${cedula}` : ''}</div>
          {establecimiento && <div style={{ fontSize: 12 }}>{establecimiento}</div>}
          {config?.direccion && <div style={{ fontSize: 11, color: '#555' }}>{config.direccion}</div>}
          {(config?.telefonoAdmin || config?.whatsappConsultorio) && <div style={{ fontSize: 11, color: '#555' }}>Tel. {config.telefonoAdmin || config.whatsappConsultorio}</div>}
        </div>
        )}

        {/* Título */}
        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>
          {TIPO_NOTA_LABEL[nota.tipo]}
        </div>

        {/* Datos del paciente */}
        <table style={{ width: '100%', fontSize: 12.5, marginBottom: 10, borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '2px 0' }}><strong>Paciente:</strong> {nota.pacienteNombre}</td>
              <td style={{ padding: '2px 0', textAlign: 'right' }}><strong>Fecha:</strong> {fecha}</td>
            </tr>
            <tr>
              <td style={{ padding: '2px 0' }}>
                {patient?.edad ? `Edad: ${patient.edad} años` : ''}{patient?.sexo ? ` · Sexo: ${patient.sexo}` : ''}
              </td>
              <td style={{ padding: '2px 0', textAlign: 'right' }}>{patient?.telefono ? `Tel: ${patient.telefono}` : ''}</td>
            </tr>
          </tbody>
        </table>

        {/* Alergias — destacadas */}
        <div style={{
          border: '1.5px solid #b91c1c', color: '#b91c1c', borderRadius: 4,
          padding: '6px 10px', fontSize: 12.5, fontWeight: 700, marginBottom: 14,
        }}>
          ALERGIAS: {patient?.alergias || 'Negadas / no referidas'}
        </div>

        {/* Resumen ejecutivo */}
        {nota.resumenEjecutivo && (
          <p style={{ fontStyle: 'italic', marginBottom: 12 }}>{nota.resumenEjecutivo}</p>
        )}

        {/* Signos vitales */}
        {nota.signosVitales && Object.values(nota.signosVitales).some(Boolean) && (
          <div style={{ marginBottom: 12 }}>
            <SecTitle>Signos vitales</SecTitle>
            <div style={{ fontSize: 12.5 }}>
              {nota.signosVitales.ta && `TA ${nota.signosVitales.ta} mmHg  `}
              {nota.signosVitales.fc && `FC ${nota.signosVitales.fc} lpm  `}
              {nota.signosVitales.fr && `FR ${nota.signosVitales.fr} rpm  `}
              {nota.signosVitales.temperatura && `T° ${nota.signosVitales.temperatura}°C  `}
              {nota.signosVitales.spo2 && `SpO₂ ${nota.signosVitales.spo2}%  `}
              {nota.signosVitales.peso && `Peso ${nota.signosVitales.peso} kg  `}
              {nota.signosVitales.talla && `Talla ${nota.signosVitales.talla} cm`}
            </div>
          </div>
        )}

        {/* Secciones narrativas */}
        {nota.secciones.filter(s => s.value.trim()).map(s => (
          <div key={s.key} style={{ marginBottom: 12 }}>
            <SecTitle>{s.label}</SecTitle>
            <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{s.value}</div>
          </div>
        ))}

        {/* Diagnósticos */}
        {nota.diagnosticos.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <SecTitle>Diagnósticos</SecTitle>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5 }}>
              {nota.diagnosticos.map((d, i) => (
                <li key={i}>{d.descripcion}{d.codigoCIE10 ? ` (CIE-10: ${d.codigoCIE10})` : ''}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Medicamentos */}
        {nota.medicamentos.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <SecTitle>Plan farmacológico</SecTitle>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5 }}>
              {nota.medicamentos.map((m, i) => (
                <li key={i}>{[`${m.nombre}${m.dosis ? ` ${m.dosis}` : ''}`.trim(), m.via, m.frecuencia, m.duracion].filter(Boolean).join(' · ')}{m.indicacion ? ` — ${m.indicacion}` : ''}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Firma — solo si la nota está firmada */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          {/* NOM-024: usar el SNAPSHOT de firma guardado en la nota (inmutable).
              Fallback al config actual solo si la nota es vieja y no tiene snapshot. */}
          {nota.estado === 'firmada' && (nota.firma?.imagenDataUrl || config?.firmaImagenDataUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nota.firma?.imagenDataUrl || config?.firmaImagenDataUrl}
              alt="Firma del médico"
              style={{
                maxHeight: 70,
                maxWidth: 280,
                display: 'block',
                margin: '0 auto -8px auto',  // overlap discreto con la línea
                objectFit: 'contain',
              }}
            />
          )}
          <div style={{ borderTop: '1px solid #1a1a1a', width: 280, margin: '0 auto', paddingTop: 4, fontSize: 12.5 }}>
            <strong>{medico}</strong><br />
            {especialidad}<br />
            Cédula Profesional {cedula}
          </div>
          {nota.estado !== 'firmada' && (
            <div className="no-print" style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text3)', fontStyle: 'italic' }}>
              La firma y el sello aparecerán automáticamente al firmar la nota.
            </div>
          )}
        </div>

        {/* Alerta ROJA solo si el sello estable NO coincide (posible alteración real) */}
        {integridad === 'alterada' && (
          <div className="no-print" style={{
            marginTop: 16, padding: '8px 12px', borderRadius: 6,
            background: 'rgba(220,38,38,0.10)', border: '1.5px solid #b91c1c',
            color: '#b91c1c', fontSize: 12, fontWeight: 700, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <AlertTriangle size={14} className="ds-icon" style={{ flexShrink: 0 }} />
            <span>INTEGRIDAD NO VERIFICADA — el contenido no coincide con el sello SHA-256
            registrado al firmar. Esta nota pudo haber sido alterada. No la uses como
            documento legal sin investigar.</span>
          </div>
        )}

        {/* Aviso NEUTRO para notas con sello de formato anterior (no re-verificable) */}
        {integridad === 'legado' && (
          <div className="no-print" style={{
            marginTop: 16, padding: '8px 12px', borderRadius: 6,
            background: 'var(--s2)', border: '1px solid var(--border)',
            color: 'var(--text3)', fontSize: 11.5, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <AlertTriangle size={13} className="ds-icon" style={{ flexShrink: 0 }} />
            <span>Nota firmada con un formato de sello anterior: el sello no puede recalcularse
            automáticamente (no implica alteración). Las notas nuevas se verifican solas.</span>
          </div>
        )}

        {/* Sello de integridad NOM-024 */}
        <div style={{ marginTop: 20, paddingTop: 8, borderTop: '1px dashed #999', fontSize: 9.5, color: '#666', textAlign: 'center' }}>
          {nota.estado === 'firmada' && nota.firma ? (
            <>
              Documento firmado electrónicamente el {new Date(nota.firma.timestamp).toLocaleString('es-MX')}
              {integridad === 'verificada' && <> · <Check size={10} className="ds-icon" style={{ display: 'inline' }} /> integridad verificada</>}
              {' · Sello (SHA-256): '}{nota.metadata.hashIntegridad || '—'}
            </>
          ) : (
            <>BORRADOR — documento no firmado. Sin validez hasta su firma.</>
          )}
          <br />Conforme a NOM-004-SSA3-2012 y NOM-024-SSA3-2012.
        </div>
      </div>

      {/* Estilos de impresión: solo el documento, en blanco y negro legible */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #doc, #doc * { visibility: visible !important; }
          #doc { position: absolute; top: 0; left: 0; width: 100%; max-width: none; margin: 0; padding: 24px 28px; border-radius: 0; box-shadow: none; }
          .no-print { display: none !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  )
}

function SecTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', borderBottom: '0.5px solid #999', marginBottom: 3, letterSpacing: 0.3 }}>
      {children}
    </div>
  )
}
