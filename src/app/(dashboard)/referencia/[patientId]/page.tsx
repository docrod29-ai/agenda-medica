'use client'
import { useState, useEffect } from 'react'
import { useToast } from '@/context/ToastContext'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { getNotas } from '@/lib/expediente/firestore'
import { getPatient } from '@/lib/firestore'
import type { NotaMedica } from '@/types/expediente'
import type { Patient } from '@/types'
import { ArrowLeft, Printer, Loader2, Send, Download } from 'lucide-react'
import { descargarComoPDF } from '@/lib/pdf-download'
import { useSmartBack } from '@/hooks/useSmartBack'
import { imprimirElemento } from '@/lib/print-element'
import { AvisoConfigNoCargada } from '@/components/AvisoConfigNoCargada'

type Tipo = 'referencia' | 'contrarreferencia'
type Urgencia = 'Rutina' | 'Prioritario' | 'Urgente'

export default function CartaReferenciaPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const volver = useSmartBack(`/expediente/${patientId}`)
  const { clinicId } = useClinic()
  const { config, error: configError } = useConfig()
  const { toast } = useToast()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  // Campos de la carta
  const [tipo, setTipo] = useState<Tipo>('referencia')
  const [destino, setDestino] = useState('')         // médico/servicio destino
  const [institucion, setInstitucion] = useState('')
  const [motivo, setMotivo] = useState('')
  const [urgencia, setUrgencia] = useState<Urgencia>('Rutina')
  const [resumen, setResumen] = useState('')
  const [diagnosticos, setDiagnosticos] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [estudios, setEstudios] = useState('')
  const [descargando, setDescargando] = useState(false)

  const descargarPDF = async () => {
    const el = document.getElementById('doc')
    if (!el) return
    setDescargando(true)
    try {
      const nombre = (patient?.nombre ?? 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
      const fechaCorta = new Date().toISOString().slice(0, 10)
      const tag = tipo === 'referencia' ? 'Referencia' : 'Contrarreferencia'
      await descargarComoPDF(el, { filename: `${tag}_${nombre}_${fechaCorta}` })
    } catch (e) {
      console.error('PDF error:', e)
      toast('No se pudo generar el PDF. Intenta con Imprimir → Guardar como PDF.', 'error')
    } finally {
      setDescargando(false)
    }
  }

  useEffect(() => {
    if (!clinicId || !patientId) return
    Promise.all([getPatient(clinicId, patientId), getNotas(clinicId, patientId)]).then(([ps, notas]) => {
      setPatient(ps)
      // Prellenar con la última nota (preferir firmada; si viene ?nota= usar esa)
      const notaParam = searchParams.get('nota')
      const nota: NotaMedica | undefined =
        (notaParam && notas.find(n => n.id === notaParam)) ||
        notas.find(n => n.estado === 'firmada') ||
        notas[0]
      if (nota) {
        setResumen(nota.resumenEjecutivo || nota.secciones.find(s => s.value)?.value || '')
        setDiagnosticos(nota.diagnosticos.map(d => `${d.descripcion}${d.codigoCIE10 ? ` (CIE-10: ${d.codigoCIE10})` : ''}`).join('\n'))
        setTratamiento(nota.medicamentos.map(m => [`${m.nombre}${m.dosis ? ` ${m.dosis}` : ''}`.trim(), m.via, m.frecuencia, m.duracion].filter(Boolean).join(' · ')).join('\n'))
      }
      setLoading(false)
    }).catch(e => {
      /**
       * Sin este catch, `setLoading(false)` vivía SOLO dentro del `then`: con la
       * red caída o sin permisos, la carta de referencia se quedaba en "Cargando…"
       * para siempre — sin botón, sin mensaje, sin salida. Receta y orden sí lo
       * tenían; esta pantalla se había quedado fuera.
       */
      console.error('[referencia] no se pudo cargar:', e)
      setErrorCarga('No pudimos cargar los datos del paciente. Revisa tu conexión y recarga.')
      setLoading(false)
    })
  }, [clinicId, patientId, searchParams])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)', padding: 40 }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const medico = config?.nombreMedico || 'Médico'
  const cedula = config?.cedulaProfesional || '—'
  const especialidad = config?.especialidad || ''
  const establecimiento = config?.nombreClinica || ''
  const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  const titulo = tipo === 'referencia' ? 'CARTA DE REFERENCIA' : 'CARTA DE CONTRARREFERENCIA'

  const input: React.CSSProperties = { width: '100%', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }
  const label: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <AvisoConfigNoCargada error={configError} />
        <AvisoConfigNoCargada error={errorCarga || null} />
      </div>
      {/* Acciones */}
      <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Atrás
        </button>
        <div className="actions-row">
          <button onClick={() => { if (configError) return; descargarPDF() }} disabled={descargando || !!configError} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--teal)', color: '#000', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: descargando ? 'default' : 'pointer' }}>
            {descargando
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</>
              : <><Download size={16} /> Descargar PDF</>}
          </button>
          <button onClick={() => { if (configError) return; imprimirElemento(document.getElementById('doc'), 'Carta de referencia', { formato: 'carta', onError: (m) => toast(m, 'error') }) }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {/* Formulario (no se imprime) */}
      <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 20px', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={label}>Tipo de carta</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as Tipo)} style={input}>
              <option value="referencia">Referencia (envío a otro médico)</option>
              <option value="contrarreferencia">Contrarreferencia (respuesta al referente)</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={label}>Urgencia</label>
            <select value={urgencia} onChange={e => setUrgencia(e.target.value as Urgencia)} style={input}>
              <option>Rutina</option><option>Prioritario</option><option>Urgente</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={label}>Dirigido a (médico / especialidad)</label>
            <input value={destino} onChange={e => setDestino(e.target.value)} placeholder="Dr(a). ___ / Cardiología" style={input} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={label}>Institución / hospital</label>
            <input value={institucion} onChange={e => setInstitucion(e.target.value)} placeholder="Hospital ___" style={input} />
          </div>
        </div>
        <div>
          <label style={label}>Motivo de la {tipo === 'referencia' ? 'referencia' : 'contrarreferencia'}</label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder="Ej. Valoración y manejo de…" style={{ ...input, resize: 'vertical' }} />
        </div>
        <div>
          <label style={label}>Resumen clínico (prellenado de la última nota — editable)</label>
          <textarea value={resumen} onChange={e => setResumen(e.target.value)} rows={4} style={{ ...input, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label style={label}>Diagnóstico(s)</label>
            <textarea value={diagnosticos} onChange={e => setDiagnosticos(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label style={label}>Tratamiento actual</label>
            <textarea value={tratamiento} onChange={e => setTratamiento(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
          </div>
        </div>
        <div>
          <label style={label}>Estudios adjuntos / realizados</label>
          <textarea value={estudios} onChange={e => setEstudios(e.target.value)} rows={2} placeholder="Laboratorios, imagen…" style={{ ...input, resize: 'vertical' }} />
        </div>
      </div>

      {/* Documento (hoja blanca) */}
      <div id="doc" style={{
        maxWidth: 800, margin: '0 auto', background: '#fff', color: '#1a1a1a',
        padding: '40px 48px', borderRadius: 4, fontFamily: '"Times New Roman", Georgia, serif',
        lineHeight: 1.5, fontSize: 13,
      }}>
        {/* Membrete */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{medico}</div>
          <div style={{ fontSize: 12 }}>{especialidad}{especialidad && cedula !== '—' ? ' · ' : ''}{cedula !== '—' ? `Cédula Prof. ${cedula}` : ''}</div>
          {establecimiento && <div style={{ fontSize: 12 }}>{establecimiento}</div>}
          {config?.direccion && <div style={{ fontSize: 11, color: '#555' }}>{config.direccion}</div>}
          {(config?.telefonoAdmin || config?.whatsappConsultorio) && <div style={{ fontSize: 11, color: '#555' }}>Tel. {config.telefonoAdmin || config.whatsappConsultorio}</div>}
        </div>

        {/* Lugar: último segmento de la dirección del consultorio si lo hay; NUNCA
            una ciudad fija (antes decía "Chihuahua, Chih." para cualquier clínica). */}
        <div style={{ textAlign: 'right', fontSize: 12.5, marginBottom: 14 }}>{(() => { const lugar = config?.direccion?.split(',').pop()?.trim(); return lugar ? `${lugar}, a ${fecha}` : `A ${fecha}` })()}</div>

        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
          {titulo}
          {urgencia !== 'Rutina' && <span style={{ color: 'var(--red)' }}> · {urgencia.toUpperCase()}</span>}
        </div>

        {(destino || institucion) && (
          <div style={{ marginBottom: 12, fontSize: 12.5 }}>
            <strong>{destino || 'A quien corresponda'}</strong>{institucion ? <><br />{institucion}</> : null}<br />P r e s e n t e.
          </div>
        )}

        {/* Datos del paciente */}
        <div style={{ marginBottom: 10, fontSize: 12.5 }}>
          <strong>Paciente:</strong> {patient?.nombre ?? ''}
          {patient?.edad ? ` · ${patient.edad} años` : ''}{patient?.sexo ? ` · ${patient.sexo}` : ''}{patient?.telefono ? ` · Tel: ${patient.telefono}` : ''}
        </div>
        <div style={{ border: '1.5px solid #b91c1c', color: 'var(--red)', borderRadius: 4, padding: '5px 10px', fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
          ALERGIAS: {patient?.alergias || 'Negadas / no referidas'}
        </div>

        {/* Cuerpo */}
        <p style={{ marginBottom: 12, fontSize: 12.5 }}>
          Por medio de la presente me permito {tipo === 'referencia' ? 'referir' : 'contrarreferir'} al paciente arriba mencionado{destino ? ` a su valiosa atención` : ''}, con el siguiente motivo:
        </p>

        {motivo && <Bloque titulo="Motivo">{motivo}</Bloque>}
        {resumen && <Bloque titulo="Resumen clínico">{resumen}</Bloque>}
        {diagnosticos && <Bloque titulo="Diagnóstico(s)">{diagnosticos}</Bloque>}
        {tratamiento && <Bloque titulo="Tratamiento actual">{tratamiento}</Bloque>}
        {estudios && <Bloque titulo="Estudios">{estudios}</Bloque>}

        <p style={{ marginTop: 14, fontSize: 12.5 }}>
          Agradezco de antemano su valiosa atención y quedo a sus órdenes para cualquier información adicional que requiera.
        </p>

        {/* Firma */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #1a1a1a', width: 280, margin: '0 auto', paddingTop: 4, fontSize: 12.5 }}>
            <strong>{medico}</strong><br />
            {especialidad}{especialidad ? <br /> : null}
            {/* Cédula = dato obligatorio: marcar su ausencia, no imprimir un guion. */}
            {cedula !== '—'
              ? <>Cédula Profesional {cedula}</>
              : <span style={{ color: 'var(--red)', fontWeight: 700 }}>[FALTA CÉDULA PROFESIONAL]</span>}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #doc, #doc * { visibility: visible !important; }
          #doc { position: absolute; top: 0; left: 0; width: 100%; max-width: none; margin: 0; padding: 24px 28px; border-radius: 0; }
          .no-print { display: none !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{titulo}:</div>
      <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{children}</div>
    </div>
  )
}
