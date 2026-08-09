'use client'
/**
 * Portal público para que el paciente ejerza sus derechos ARCO conforme a LFPDPPP.
 *
 * El paciente NO necesita cuenta — solo identificarse con sus datos básicos.
 * La solicitud llega a la clínica que la atiende en máximo 20 días hábiles.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { crearSolicitudArco, ARCO_TIPO_LABEL, type ArcoTipo } from '@/lib/arco'
import { generarAvisoPrivacidad } from '@/lib/aviso-privacidad'
import type { ClinicConfig } from '@/types'
import { Shield, Check, Loader2, FileText, AlertCircle } from 'lucide-react'

interface ClinicInfo {
  ok: boolean
  clinic?: {
    nombre: string
    nombreMedico: string
    telefono: string
  }
}

export default function PortalPrivacidadPage() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const [clinic, setClinic] = useState<ClinicInfo['clinic'] | null>(null)
  const [config, setConfig] = useState<ClinicConfig | null>(null)
  const [paso, setPaso] = useState<'info' | 'formulario' | 'enviado' | 'aviso'>('info')
  const [enviando, setEnviando] = useState(false)
  const [folioConfirmacion, setFolioConfirmacion] = useState('')

  const [tipo, setTipo] = useState<ArcoTipo>('acceso')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [curp, setCurp] = useState('')
  const [identificacion, setIdentificacion] = useState('')
  const [descripcion, setDescripcion] = useState('')

  useEffect(() => {
    if (!clinicId) return
    // Una sola petición alimenta tanto los datos públicos de la clínica como la
    // config para el aviso (antes se llamaba DOS veces al mismo endpoint).
    fetch(`/api/public/clinic/${clinicId}`)
      .then(r => r.json())
      .then((d: ClinicInfo & { clinic?: { nombreMedico: string; especialidad?: string; direccion?: string; razonSocial?: string; responsablePrivacidad?: string; correoArco?: string } }) => {
        if (!d.ok || !d.clinic) return
        setClinic(d.clinic)
        setConfig({
          nombreClinica: d.clinic.nombre,
          nombreMedico: d.clinic.nombreMedico,
          direccion: d.clinic.direccion ?? '',
          telefonoAdmin: d.clinic.telefono,
          // RFC y domicilio fiscal NO llegan al portal público (protección de datos)
          razonSocial: d.clinic.razonSocial || undefined,
          responsablePrivacidad: d.clinic.responsablePrivacidad || undefined,
          correoArco: d.clinic.correoArco || undefined,
        } as ClinicConfig)
      })
      .catch(() => {})
  }, [clinicId])

  const enviar = async () => {
    if (!nombre || !telefono || !descripcion) {
      alert('Por favor llena los campos obligatorios')
      return
    }
    setEnviando(true)
    try {
      const id = await crearSolicitudArco({
        clinicId,
        solicitante: {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: email.trim() || undefined,
          curp: curp.trim() || undefined,
          identificacion: identificacion.trim() || undefined,
        },
        tipo,
        descripcion: descripcion.trim(),
      })
      setFolioConfirmacion(id.slice(-8).toUpperCase())
      setPaso('enviado')
    } catch (e) {
      alert(`Error al enviar: ${(e as Error).message}`)
    } finally {
      setEnviando(false)
    }
  }

  // === Vista: confirmación ===
  if (paso === 'enviado') {
    return (
      <div style={layoutStyle}>
        <div style={cardStyle}>
          <Check size={48} color="#10B981" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Solicitud recibida</h1>
          <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 16, lineHeight: 1.6 }}>
            Tu solicitud fue registrada con el folio:
          </p>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: 'var(--teal)', marginBottom: 18 }}>
            #{folioConfirmacion}
          </div>
          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 20 }}>
            Conforme al Art. 32 de la LFPDPPP, recibirás respuesta en un plazo
            máximo de <strong>20 días hábiles</strong>.
            {clinic?.nombre && <> El responsable es <strong>{clinic.nombre}</strong>.</>}
          </p>
          <button onClick={() => window.close()} className="btn btn-primary">
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  // === Vista: aviso completo ===
  if (paso === 'aviso') {
    return (
      <div style={layoutStyle}>
        <div style={{ ...cardStyle, maxWidth: 720, textAlign: 'left' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Aviso de Privacidad</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.65, color: '#374151' }}>
            {generarAvisoPrivacidad(config)}
          </pre>
          <button onClick={() => setPaso('info')} className="btn btn-secondary" style={{ marginTop: 16 }}>
            ← Volver
          </button>
        </div>
      </div>
    )
  }

  // === Vista: info y portal ===
  return (
    <div style={layoutStyle}>
      <div style={{ ...cardStyle, maxWidth: 560, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Shield size={24} color="var(--teal)" />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
            Portal de Privacidad
          </h1>
        </div>
        {clinic && (
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
            {clinic.nombre} · {clinic.nombreMedico}
          </div>
        )}

        {paso === 'info' && (
          <>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 14 }}>
              Aquí puedes ejercer tus <strong>derechos ARCO</strong> conforme a la Ley Federal de
              Protección de Datos Personales en Posesión de los Particulares.
            </p>
            <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
              {(['acceso', 'rectificacion', 'cancelacion', 'oposicion', 'revocacion'] as ArcoTipo[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTipo(t); setPaso('formulario') }}
                  style={{
                    padding: '12px 14px', textAlign: 'left', background: '#F9FAFB',
                    border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer',
                    fontSize: 14, fontWeight: 500, color: '#111827',
                  }}
                >
                  {ARCO_TIPO_LABEL[t]}
                </button>
              ))}
            </div>
            <button onClick={() => setPaso('aviso')} style={{
              background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer',
              fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <FileText size={13} /> Ver Aviso de Privacidad completo
            </button>
          </>
        )}

        {paso === 'formulario' && (
          <>
            <button onClick={() => setPaso('info')} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
              ← Volver
            </button>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {ARCO_TIPO_LABEL[tipo]}
            </h2>
            <p style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 14 }}>
              Llena tus datos para identificarte. Te responderemos en máximo 20 días hábiles.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <Field label="Nombre completo *" value={nombre} onChange={setNombre} placeholder="Como aparece en tu INE" />
              <Field label="Teléfono *" value={telefono} onChange={setTelefono} placeholder="10 dígitos" type="tel" />
              <Field label="Correo electrónico" value={email} onChange={setEmail} type="email" />
              <Field label="CURP (opcional, ayuda a localizar tu expediente)" value={curp} onChange={(v) => setCurp(v.toUpperCase())} maxLength={18} />
              <Field label="Identificación oficial (ej. INE folio 1234)" value={identificacion} onChange={setIdentificacion} />
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Describe tu solicitud *
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value.slice(0, 1000))}
                  rows={4}
                  placeholder={tipo === 'acceso' ? 'Solicito una copia de mi expediente médico completo.' : tipo === 'rectificacion' ? 'Mi nombre está mal escrito. Debería decir...' : tipo === 'cancelacion' ? 'Solicito que se elimine...' : 'Me opongo a que mis datos se usen para...'}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB',
                    fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 10.5, color: '#9CA3AF', textAlign: 'right', marginTop: 2 }}>{descripcion.length}/1000</div>
              </div>
              <div style={{
                padding: 10, background: '#FEF3C7', borderRadius: 6, fontSize: 12, color: 'var(--amber)',
                display: 'flex', alignItems: 'flex-start', gap: 6,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  Para confirmar tu identidad, la clínica puede pedirte una copia de tu identificación
                  oficial cuando responda tu solicitud.
                </div>
              </div>
              <button
                onClick={enviar}
                disabled={enviando || !nombre || !telefono || !descripcion}
                className="btn btn-primary"
                style={{ marginTop: 6 }}
              >
                {enviando ? <><Loader2 size={14} className="spin" /> Enviando…</> : 'Enviar solicitud'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, maxLength }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; maxLength?: number }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
      <input
        type={type} value={value} maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 6,
          border: '1px solid #D1D5DB', fontSize: 13, boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

const layoutStyle: React.CSSProperties = {
  minHeight: '100vh', background: '#F3F4F6', padding: 20,
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}
const cardStyle: React.CSSProperties = {
  background: '#FFF', borderRadius: 12, padding: 24, maxWidth: 440, width: '100%',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', textAlign: 'center',
}
