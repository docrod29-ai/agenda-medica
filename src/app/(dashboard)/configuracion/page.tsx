'use client'
import { useState, useEffect } from 'react'
import { ClinicConfig, DEFAULT_CONFIG, AppointmentType, APPOINTMENT_TYPE_CONFIG } from '@/types'
import { saveConfig } from '@/lib/firestore'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { auth } from '@/lib/firebase'
import { Loader2, Save, Copy, Calendar, CheckCircle2, XCircle, Link } from 'lucide-react'
import { msgConfirmacion, msgRecordatorio24h, msgRecordatorioDia } from '@/lib/whatsapp'
import { copyToClipboard } from '@/lib/whatsapp'
import { useSearchParams } from 'next/navigation'

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
const DIAS_LABELS = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' }

type Tab = 'general' | 'horario' | 'duraciones' | 'notificaciones' | 'integraciones' | 'plantillas'

export default function ConfiguracionPage() {
  const { config, loading } = useConfig()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>('general')
  const [form, setForm] = useState<ClinicConfig>({ ...DEFAULT_CONFIG })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null)
  const [gcalLoading, setGcalLoading] = useState(false)
  const [gcalCalendars, setGcalCalendars] = useState<{ id: string; summary: string; primary: boolean }[]>([])

  // Check Google Calendar status on mount
  useEffect(() => {
    const checkGcal = async () => {
      const uid = auth.currentUser?.uid
      if (!uid) return
      try {
        const res = await fetch(`/api/calendar/status?uid=${uid}`)
        const data = await res.json()
        setGcalConnected(data.connected)
        if (data.connected) loadCalendars(uid)
      } catch {
        setGcalConnected(false)
      }
    }
    checkGcal()
  }, [])

  // Handle return from Google OAuth
  useEffect(() => {
    const gcal = searchParams.get('gcal')
    if (gcal === 'connected') {
      toast('Google Calendar conectado', 'success')
      setGcalConnected(true)
      setTab('integraciones')
      const uid = auth.currentUser?.uid
      if (uid) loadCalendars(uid)
    } else if (gcal === 'error') {
      toast('Error al conectar Google Calendar', 'error')
      setTab('integraciones')
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadCalendars = async (uid: string) => {
    try {
      const res = await fetch(`/api/calendar/calendars?uid=${uid}`)
      const data = await res.json()
      if (data.calendars) setGcalCalendars(data.calendars)
    } catch { /* ignore */ }
  }

  const handleConnectGcal = async () => {
    setGcalLoading(true)
    try {
      const uid = auth.currentUser?.uid
      if (!uid) { toast('Sesión expirada, inicia sesión nuevamente', 'error'); return }
      const res = await fetch(`/api/calendar/connect?uid=${uid}`)
      const { url } = await res.json()
      window.location.href = url
    } catch {
      toast('Error al conectar con Google', 'error')
      setGcalLoading(false)
    }
  }

  const handleDisconnectGcal = async () => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    try {
      await fetch(`/api/calendar/status?uid=${uid}`, { method: 'DELETE' })
      setGcalConnected(false)
      setGcalCalendars([])
      toast('Google Calendar desconectado', 'success')
    } catch {
      toast('Error al desconectar', 'error')
    }
  }

  useEffect(() => {
    if (!loading) setForm({ ...config })
  }, [config, loading])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveConfig(form)
      toast('Configuración guardada', 'success')
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const upd = (key: keyof ClinicConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const updBool = (key: keyof ClinicConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.checked }))

  const updHorario = (dia: typeof DIAS[number], field: 'activo' | 'inicio' | 'fin', value: string | boolean) =>
    setForm(prev => ({ ...prev, horario: { ...prev.horario, [dia]: { ...prev.horario[dia], [field]: value } } }))

  const updDuracion = (tipo: AppointmentType, value: number) =>
    setForm(prev => ({ ...prev, duraciones: { ...prev.duraciones, [tipo]: value } }))

  const handleCopy = async (text: string, key: string) => {
    await copyToClipboard(text)
    setCopied(key)
    toast('Copiado al portapapeles', 'success')
    setTimeout(() => setCopied(''), 2000)
  }

  const demoAppt = {
    id: 'demo', pacienteId: '', pacienteNombre: 'Juan Pérez', pacienteTelefono: '6641234567',
    fechaHora: `${new Date().toISOString().slice(0, 10)} 10:00`, duracion: 30,
    tipo: 'seguimiento' as const, estado: 'pendiente-confirmar' as const,
    origen: 'Manual' as const, medicoNombre: form.nombreMedico,
    confirmadoPaciente: false, recordatorio24hEnviado: false, recordatorioMismoDiaEnviado: false,
    consentimientoMensajes: true, createdAt: '', updatedAt: '', creadoPor: '', updatedPor: '',
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'horario', label: 'Horario' },
    { key: 'duraciones', label: 'Duraciones' },
    { key: 'notificaciones', label: 'Notificaciones' },
    { key: 'integraciones', label: 'Integraciones' },
    { key: 'plantillas', label: 'Plantillas WA' },
  ]

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Cargando configuración…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Configuración</h1>
        {tab !== 'integraciones' && (
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : <><Save size={15} /> Guardar</>}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === 'general' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          <div className="form-group">
            <label className="label">Nombre del médico</label>
            <input className="input" value={form.nombreMedico} onChange={upd('nombreMedico')} placeholder="Dr. García López" />
          </div>
          <div className="form-group">
            <label className="label">Nombre de la clínica / consultorio</label>
            <input className="input" value={form.nombreClinica} onChange={upd('nombreClinica')} placeholder="Consultorio Médico García" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="label">Dirección</label>
            <input className="input" value={form.direccion} onChange={upd('direccion')} placeholder="Av. Independencia 123, Col. Centro" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="label">URL Google Maps</label>
            <input className="input" value={form.googleMapsUrl} onChange={upd('googleMapsUrl')} placeholder="https://maps.google.com/…" />
          </div>
          <div className="form-group">
            <label className="label">Teléfono admin</label>
            <input className="input" type="tel" value={form.telefonoAdmin} onChange={upd('telefonoAdmin')} placeholder="6641234567" />
          </div>
          <div className="form-group">
            <label className="label">WhatsApp consultorio</label>
            <input className="input" type="tel" value={form.whatsappConsultorio} onChange={upd('whatsappConsultorio')} placeholder="6641234567" />
          </div>
          <div className="form-group">
            <label className="label">Intervalo de agenda (min)</label>
            <select className="input" value={form.intervaloMinutos} onChange={upd('intervaloMinutos')}>
              {[5, 10, 15, 20, 30].map(v => <option key={v} value={v}>{v} minutos</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Zona horaria</label>
            <select className="input" value={form.zonaHoraria} onChange={upd('zonaHoraria')}>
              <option value="America/Chihuahua">Chihuahua / Ciudad Juárez (UTC-6)</option>
              <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
              <option value="America/Monterrey">Monterrey (UTC-6)</option>
              <option value="America/Hermosillo">Hermosillo / Sonora (UTC-7)</option>
              <option value="America/Tijuana">Tijuana / Baja California (UTC-8)</option>
            </select>
          </div>
        </div>
      )}

      {/* Horario */}
      {tab === 'horario' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 8px' }}>Define los días y horarios de atención del consultorio.</p>
          {DIAS.map(dia => (
            <div key={dia} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <input
                type="checkbox"
                checked={form.horario[dia].activo}
                onChange={e => updHorario(dia, 'activo', e.target.checked)}
                style={{ accentColor: 'var(--teal)', width: 16, height: 16 }}
              />
              <div style={{ width: 80, fontSize: 14, fontWeight: 500, color: form.horario[dia].activo ? 'var(--text)' : 'var(--text3)' }}>
                {DIAS_LABELS[dia]}
              </div>
              {form.horario[dia].activo ? (
                <>
                  <input
                    type="time" className="input" value={form.horario[dia].inicio}
                    onChange={e => updHorario(dia, 'inicio', e.target.value)}
                    style={{ width: 110 }}
                  />
                  <span style={{ color: 'var(--text3)', fontSize: 14 }}>—</span>
                  <input
                    type="time" className="input" value={form.horario[dia].fin}
                    onChange={e => updHorario(dia, 'fin', e.target.value)}
                    style={{ width: 110 }}
                  />
                </>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>Cerrado</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Duraciones */}
      {tab === 'duraciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 8px' }}>Duración predeterminada por tipo de consulta (en minutos).</p>
          {(Object.entries(APPOINTMENT_TYPE_CONFIG) as [AppointmentType, { label: string; icon: string }][]).map(([tipo, cfg]) => (
            <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <span style={{ fontSize: 18 }}>{cfg.icon}</span>
              <div style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{cfg.label}</div>
              <input
                className="input" type="number" min={5} max={240} step={5}
                value={form.duraciones[tipo]}
                onChange={e => updDuracion(tipo, Number(e.target.value))}
                style={{ width: 80, textAlign: 'center' }}
              />
              <span style={{ fontSize: 13, color: 'var(--text3)', width: 20 }}>min</span>
            </div>
          ))}
        </div>
      )}

      {/* Notificaciones */}
      {tab === 'notificaciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 16, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Recordatorio 24 horas antes</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Enviar recordatorio al paciente el día anterior a su cita</div>
            </div>
            <input type="checkbox" checked={form.recordatorio24h} onChange={updBool('recordatorio24h')} style={{ accentColor: 'var(--teal)', width: 18, height: 18 }} />
          </div>
          <div style={{ padding: 16, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Recordatorio el mismo día</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Enviar recordatorio la mañana del día de la cita</div>
            </div>
            <input type="checkbox" checked={form.recordatorioMismoDia} onChange={updBool('recordatorioMismoDia')} style={{ accentColor: 'var(--teal)', width: 18, height: 18 }} />
          </div>
          <div className="form-group" style={{ maxWidth: 200 }}>
            <label className="label">Hora de resumen diario</label>
            <input className="input" type="time" value={form.horaResumenDiario} onChange={upd('horaResumenDiario')} />
          </div>
        </div>
      )}

      {/* Integraciones */}
      {tab === 'integraciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Google Calendar */}
          <div style={{ padding: 20, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,212,168,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={20} style={{ color: 'var(--teal)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Google Calendar</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    Sincroniza tus citas automáticamente con Google Calendar
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {gcalConnected === true && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '4px 10px', borderRadius: 20 }}>
                    <CheckCircle2 size={13} /> Conectado
                  </span>
                )}
                {gcalConnected === false && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3)', background: 'var(--s2)', padding: '4px 10px', borderRadius: 20 }}>
                    <XCircle size={13} /> No conectado
                  </span>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {gcalConnected ? (
                <>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleDisconnectGcal}
                    style={{ color: '#f87171' }}
                  >
                    <XCircle size={14} /> Desconectar
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { const uid = auth.currentUser?.uid; if (uid) loadCalendars(uid) }}
                  >
                    Actualizar calendarios
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleConnectGcal}
                  disabled={gcalLoading}
                >
                  {gcalLoading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Conectando…</> : <><Link size={14} /> Conectar con Google</>}
                </button>
              )}
            </div>

            {/* Calendar selector */}
            {gcalConnected && gcalCalendars.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <label className="label">Calendario destino</label>
                <select
                  className="input"
                  value={form.googleCalendarId}
                  onChange={upd('googleCalendarId')}
                  style={{ marginTop: 6 }}
                >
                  <option value="">Calendario principal</option>
                  {gcalCalendars.map(c => (
                    <option key={c.id} value={c.id ?? ''}>
                      {c.summary}{c.primary ? ' (principal)' : ''}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar calendario'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,212,168,0.05)', border: '1px solid rgba(0,212,168,0.15)', borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.6 }}>
                Al conectar Google Calendar, todas las citas nuevas y cambios se sincronizarán automáticamente.
                Las citas canceladas se marcarán en rojo en tu calendario.
              </p>
            </div>
          </div>

          {/* WhatsApp status */}
          <div style={{ padding: 20, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20 }}>💬</span>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>WhatsApp Business</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  Recordatorios automáticos enviados cada hora via Vercel Cron
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--s2)', padding: '4px 10px', borderRadius: 20 }}>
                  Configura las credenciales en Vercel
                </span>
              </div>
            </div>
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,212,168,0.05)', border: '1px solid rgba(0,212,168,0.15)', borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.6 }}>
                Para activar WhatsApp, agrega <strong style={{ color: 'var(--text2)' }}>WHATSAPP_API_TOKEN</strong> y <strong style={{ color: 'var(--text2)' }}>WHATSAPP_PHONE_NUMBER_ID</strong> en las variables de entorno de Vercel.
                Los recordatorios se envían automáticamente cada hora.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plantillas */}
      {tab === 'plantillas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Vista previa de los mensajes de WhatsApp que se envían automáticamente.</p>
          {[
            { key: 'confirmacion', label: '✅ Confirmación de cita', msg: msgConfirmacion(demoAppt, form) },
            { key: 'recordatorio24', label: '⏰ Recordatorio 24 horas', msg: msgRecordatorio24h(demoAppt, form) },
            { key: 'recordatorioDia', label: '📅 Recordatorio mismo día', msg: msgRecordatorioDia(demoAppt, form) },
          ].map(({ key, label, msg }) => (
            <div key={key} style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleCopy(msg, key)}
                  style={{ color: copied === key ? 'var(--teal)' : 'var(--text3)' }}
                >
                  <Copy size={13} /> {copied === key ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text2)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'transparent', fontFamily: 'inherit' }}>
                {msg}
              </pre>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
