'use client'
/**
 * Portal público de reserva de citas.
 *
 * Flujo: tipo → médico (si hay varios) → fecha → hora → datos → consentimientos → confirmación.
 * Funciona 24/7, sin requerir cuenta.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Stethoscope, Calendar, Clock, User, CheckCircle2, Loader2, ArrowLeft, MapPin, Phone,
} from 'lucide-react'
import { hoyISO, sumarDiasISO } from '@/lib/timezone'

interface ClinicInfo {
  ok: boolean
  clinic: {
    id: string
    nombre: string
    nombreMedico: string
    especialidad: string
    direccion: string
    telefono: string
    googleMapsUrl: string
    publicBookingEnabled: boolean
  }
  medicos: { id: string; nombre: string; especialidad: string }[]
  tiposCita: { tipo: string; duracion: number }[]
  horarios: Record<string, { activo: boolean; inicio: string; fin: string }>
  /** La zona del CONSULTORIO. Los días se arman con su reloj, no con el del paciente. */
  zonaHoraria?: string
}

type Step = 'tipo' | 'fecha' | 'hora' | 'datos' | 'consentimientos' | 'exito' | 'error'

const TIPO_LABEL: Record<string, string> = {
  'primera-vez': 'Primera vez',
  'seguimiento': 'Seguimiento',
  'urgente': 'Urgente',
  'estudios': 'Revisión de estudios',
  'teleconsulta': 'Teleconsulta',
  'prequirurgica': 'Valoración prequirúrgica',
  'procedimiento': 'Procedimiento',
  'otro': 'Otro',
}

/**
 * Los próximos `n` días SEGÚN EL RELOJ DEL CONSULTORIO.
 *
 * Esto usaba el reloj del navegador. Un paciente en España a las 09:00 del 2 de
 * agosto está viendo un consultorio donde son las 23:00 del 1: el portal
 * empezaba la lista el día 3 y el 2 de agosto entero desaparecía, sin mensaje.
 * El generador de huecos ya usaba `cfg.zonaHoraria`; la lista de días no.
 */
function nextDays(n: number, tz?: string): string[] {
  const out: string[] = []
  const hoy = hoyISO(tz || 'America/Mexico_City')
  for (let i = 1; i <= n; i++) out.push(sumarDiasISO(hoy, i))
  return out
}

export default function ReservarPage() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const [info, setInfo] = useState<ClinicInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('tipo')
  const [tipo, setTipo] = useState('')
  const [medicoId, setMedicoId] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [motivo, setMotivo] = useState('')
  const [c1, setC1] = useState(false)
  const [c2, setC2] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!clinicId) return
    fetch(`/api/public/clinic/${clinicId}`).then(r => r.json()).then(data => {
      if (data.ok) setInfo(data)
      else setErrorMsg(data.error ?? 'Clínica no disponible')
      setLoading(false)
    }).catch(() => { setErrorMsg('Error de conexión'); setLoading(false) })
  }, [clinicId])

  useEffect(() => {
    if (step !== 'hora' || !fecha) return
    setLoadingSlots(true)
    const qs = new URLSearchParams({ fecha, tipo })
    if (medicoId) qs.set('medicoId', medicoId)
    fetch(`/api/public/availability/${clinicId}?${qs.toString()}`)
      .then(r => r.json())
      .then(data => { setSlots(data.slots ?? []); setLoadingSlots(false) })
      .catch(() => { setSlots([]); setLoadingSlots(false) })
  }, [step, fecha, tipo, medicoId, clinicId])

  const enviar = async () => {
    setEnviando(true)
    setErrorMsg('')
    try {
      const r = await fetch('/api/public/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId, tipo, fecha, hora, medicoId,
          paciente: { nombre: nombre.trim(), telefono: telefono.trim(), email: email.trim(), motivo: motivo.trim() },
          consentimientos: { avisoPrivacidad: c1, informado: c2 },
        }),
      })
      const data = await r.json().catch(() => null)
      if (r.ok && data?.ok) setStep('exito')
      else { setErrorMsg(data?.error ?? 'No se pudo agendar. Intenta de nuevo.'); setStep('error') }
    } catch {
      setErrorMsg('Error de red'); setStep('error')
    } finally { setEnviando(false) }
  }

  const dias = useMemo(() => {
    if (!info) return []
    const DAY_KEYS = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']
    return nextDays(14, info.zonaHoraria).filter(d => {
      const dk = DAY_KEYS[new Date(d + 'T12:00:00').getDay()]
      return info.horarios[dk]?.activo
    })
  }, [info])

  const tiposCita = info?.tiposCita.filter(t => Number(t.duracion) > 0) ?? []

  if (loading) {
    return (
      <FullPage>
        <Loader2 size={28} color="var(--teal)" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ color: 'var(--text3)', fontSize: 14, marginTop: 12 }}>Cargando consultorio…</div>
      </FullPage>
    )
  }

  if (errorMsg && step !== 'error') {
    return <FullPage><ErrorCard msg={errorMsg} /></FullPage>
  }

  if (!info) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 'max(24px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--s1)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Stethoscope size={20} color="var(--nexus)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{info.clinic.nombreMedico || info.clinic.nombre}</div>
              {info.clinic.especialidad && <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>{info.clinic.especialidad}</div>}
            </div>
          </div>
          {info.clinic.direccion && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              <MapPin size={12} style={{ marginTop: 2 }} /> {info.clinic.direccion}
            </div>
          )}
          {info.clinic.telefono && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              <Phone size={12} /> {info.clinic.telefono}
            </div>
          )}
        </div>

        {/* Steps */}
        {step === 'tipo' && (
          <Card title="¿Qué tipo de consulta deseas?">
            {tiposCita.map(t => (
              <button key={t.tipo} onClick={() => { setTipo(t.tipo); setStep(info.medicos.length > 1 ? 'tipo' : 'fecha'); if (info.medicos.length === 1) setMedicoId(info.medicos[0].id) }} style={btnList}>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{TIPO_LABEL[t.tipo] ?? t.tipo}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t.duracion} min</div>
              </button>
            ))}

            {info.medicos.length > 1 && tipo && (
              <>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 14, marginBottom: 6 }}>Selecciona médico:</div>
                {info.medicos.map(m => (
                  <button key={m.id} onClick={() => { setMedicoId(m.id); setStep('fecha') }} style={btnList}>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{m.nombre}</div>
                    {m.especialidad && <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{m.especialidad}</div>}
                  </button>
                ))}
              </>
            )}
          </Card>
        )}

        {step === 'fecha' && (
          <Card title="Elige el día" onBack={() => setStep('tipo')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
              {dias.map(d => {
                const dt = new Date(d + 'T12:00:00')
                const label = dt.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
                return (
                  <button key={d} onClick={() => { setFecha(d); setStep('hora') }} style={{ ...btnList, textAlign: 'center', padding: '10px 6px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{label}</div>
                  </button>
                )
              })}
            </div>
          </Card>
        )}

        {step === 'hora' && (
          <Card title={`Elige el horario · ${new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}`} onBack={() => setStep('fecha')}>
            {loadingSlots ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', display: 'inline-block', verticalAlign: 'middle' }} /> Cargando horarios…</div>
            ) : slots.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>No hay horarios disponibles este día. Elige otra fecha.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
                {slots.map(s => (
                  <button key={s} onClick={() => { setHora(s); setStep('datos') }} style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 6px', fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {step === 'datos' && (
          <Card title="Tus datos" onBack={() => setStep('hora')}>
            <FormField label="Nombre completo *">
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan García López" autoFocus />
            </FormField>
            <FormField label="Teléfono / WhatsApp *">
              <input className="input" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="614-123-4567" type="tel" />
            </FormField>
            <FormField label="Correo (opcional)">
              <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" type="email" />
            </FormField>
            <FormField label="Motivo (opcional)">
              <textarea className="input" rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Describe brevemente el motivo de tu visita" style={{ resize: 'vertical' }} />
            </FormField>
            <button
              disabled={!nombre.trim() || telefono.replace(/\D/g, '').length < 7}
              onClick={() => setStep('consentimientos')}
              style={{ ...btnPrimary, marginTop: 12, opacity: nombre.trim() && telefono.replace(/\D/g, '').length >= 7 ? 1 : 0.5 }}
            >
              Continuar →
            </button>
          </Card>
        )}

        {step === 'consentimientos' && (
          <Card title="Confirma y acepta" onBack={() => setStep('datos')}>
            <Resumen tipo={tipo} fecha={fecha} hora={hora} medico={info.medicos.find(m => m.id === medicoId)?.nombre ?? info.clinic.nombreMedico} />
            <label style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={c1} onChange={e => setC1(e.target.checked)} style={{ marginTop: 2 }} />
              <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>
                He leído y acepto el <strong style={{ color: 'var(--teal)' }}>aviso de privacidad</strong> sobre el tratamiento de mis datos personales.
              </span>
            </label>
            <label style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={c2} onChange={e => setC2(e.target.checked)} style={{ marginTop: 2 }} />
              <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>
                Doy mi <strong style={{ color: 'var(--teal)' }}>consentimiento informado</strong> para la atención médica solicitada.
              </span>
            </label>
            <button
              disabled={!c1 || !c2 || enviando}
              onClick={enviar}
              style={{ ...btnPrimary, marginTop: 14, opacity: c1 && c2 && !enviando ? 1 : 0.5 }}
            >
              {enviando
                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Agendando…</>
                : <><CheckCircle2 size={16} /> Confirmar cita</>}
            </button>
          </Card>
        )}

        {step === 'exito' && (
          <Card title="¡Cita solicitada! ✅">
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 16px' }}>
              Tu solicitud llegó al consultorio. Te contactaremos por WhatsApp para confirmar.
            </p>
            <Resumen tipo={tipo} fecha={fecha} hora={hora} medico={info.medicos.find(m => m.id === medicoId)?.nombre ?? info.clinic.nombreMedico} />
            <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 14, lineHeight: 1.5 }}>
              Si necesitas reprogramar o cancelar, comunícate al {info.clinic.telefono || 'consultorio'}.
            </p>
          </Card>
        )}

        {step === 'error' && (
          <Card title="No se pudo agendar">
            <p style={{ fontSize: 14, color: 'var(--red)', margin: '0 0 12px' }}>{errorMsg}</p>
            <button onClick={() => setStep('hora')} style={btnPrimary}>← Intentar otro horario</button>
          </Card>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/* Subcomponents */
const btnList: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10,
  padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
}
const btnPrimary: React.CSSProperties = {
  width: '100%', background: 'var(--teal)', color: '#040b12', border: 'none',
  borderRadius: 12, padding: '13px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}

function Card({ title, children, onBack }: { title: string; children: React.ReactNode; onBack?: () => void }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
      {onBack && (
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 10 }}>
          <ArrowLeft size={12} /> Volver
        </button>
      )}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }}>{title}</h2>
      {children}
    </div>
  )
}
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}
function Resumen({ tipo, fecha, hora, medico }: { tipo: string; fecha: string; hora: string; medico: string }) {
  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
        <Stethoscope size={13} color="var(--teal)" /> <strong style={{ color: 'var(--text)' }}>{TIPO_LABEL[tipo] ?? tipo}</strong> con <strong style={{ color: 'var(--text)' }}>{medico}</strong>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)' }}>
        <Calendar size={13} color="var(--teal)" /> {new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        <Clock size={13} color="var(--teal)" style={{ marginLeft: 6 }} /> {hora} h
      </div>
    </div>
  )
}
function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 24 }}>
      {children}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
function ErrorCard({ msg }: { msg: string }) {
  return (
    <div style={{ maxWidth: 380, textAlign: 'center', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
      <div style={{ fontSize: 38, marginBottom: 10 }}>😕</div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>No disponible</h2>
      <p style={{ fontSize: 13, color: 'var(--text2)' }}>{msg}</p>
    </div>
  )
}
