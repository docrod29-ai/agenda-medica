'use client'
import { useState, useEffect } from 'react'
import { ClinicConfig, DEFAULT_CONFIG, AppointmentType, APPOINTMENT_TYPE_CONFIG } from '@/types'
import { saveConfig, updateDoctor } from '@/lib/firestore'
import { useConfig } from '@/hooks/useConfig'
import { useDoctors } from '@/hooks/useDoctors'
import { useToast } from '@/context/ToastContext'
import { useClinic } from '@/context/ClinicContext'
import { auth } from '@/lib/firebase'
import { Loader2, Save, Copy, Calendar, CheckCircle2, XCircle, Link, Bot, CreditCard, ExternalLink, MessageCircle, Smartphone } from 'lucide-react'
import { msgConfirmacion, msgRecordatorio24h, msgRecordatorioDia } from '@/lib/whatsapp'
import { copyToClipboard } from '@/lib/whatsapp'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  crearInvitacion, listarInvitaciones, revocarInvitacion,
  type Invitacion, type RolInvitacion,
} from '@/lib/invitations'

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
const DIAS_LABELS = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' }

type Tab = 'general' | 'horario' | 'duraciones' | 'notificaciones' | 'integraciones' | 'plantillas' | 'bot' | 'medicos' | 'equipo' | 'suscripcion'

export default function ConfiguracionPage() {
  const { config, loading } = useConfig()
  const { activeDoctors } = useDoctors()
  const { clinicId } = useClinic()
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

  // Handle return from Google OAuth or direct tab link
  useEffect(() => {
    const gcal = searchParams.get('gcal')
    const tabParam = searchParams.get('tab') as Tab | null
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

    const wa = searchParams.get('wa')
    if (wa === 'connected') {
      toast('¡WhatsApp conectado! El bot ya está activo.', 'success')
      setTab('integraciones')
    } else if (wa === 'error') {
      const reason = searchParams.get('reason')
      toast(`Error al conectar WhatsApp${reason ? `: ${reason}` : ''}`, 'error')
      setTab('integraciones')
    }

    if (tabParam && !gcal && !wa) setTab(tabParam)
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
      await saveConfig(clinicId!, form)
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
    { key: 'bot', label: '🤖 Bot FAQ' },
    { key: 'medicos', label: 'Médicos' },
    { key: 'equipo', label: '👥 Equipo' },
    { key: 'suscripcion', label: '💳 Suscripción' },
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
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          <div className="form-group">
            <label className="label">Nombre del médico</label>
            <input className="input" value={form.nombreMedico} onChange={upd('nombreMedico')} placeholder="Dr. García López" />
          </div>
          <div className="form-group">
            <label className="label">Nombre de la clínica / consultorio</label>
            <input className="input" value={form.nombreClinica} onChange={upd('nombreClinica')} placeholder="Consultorio Médico García" />
          </div>
          <div className="form-group">
            <label className="label">Cédula profesional <span style={{ color: '#f87171' }}>*</span></label>
            <input className="input" value={form.cedulaProfesional ?? ''} onChange={upd('cedulaProfesional')} placeholder="12345678 (requerida para firmar expedientes)" />
          </div>
          <div className="form-group">
            <label className="label">Especialidad</label>
            <input className="input" value={form.especialidad ?? ''} onChange={upd('especialidad')} placeholder="Infectología" />
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

          {/* WhatsApp — 360dialog connect */}
          <WhatsAppConnectCard clinicId={clinicId} />

          {/* Enlace de auto-agenda (click-to-WhatsApp) */}
          <AutoAgendaLink configNumero={form.whatsappConsultorio} onCopy={(t, k) => handleCopy(t, k)} copied={copied} />
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

      {/* Bot FAQ */}
      {tab === 'bot' && <BotFAQTab doctors={activeDoctors} />}

      {/* Médicos */}
      {tab === 'medicos' && <MedicosTab />}

      {/* Equipo (invitaciones) */}
      {tab === 'equipo' && <EquipoTab clinicId={clinicId} clinicNombre={form.nombreClinica || 'tu clínica'} />}

      {/* Suscripción */}
      {tab === 'suscripcion' && <SuscripcionTab clinicId={clinicId} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Bot FAQ sub-component ────────────────────────────────────

import { Doctor } from '@/types'

/* ── Enlace de auto-agenda (click-to-WhatsApp) ─────────────────── */
function AutoAgendaLink({ configNumero, onCopy, copied }: {
  configNumero: string
  onCopy: (texto: string, key: string) => void
  copied: string
}) {
  const { clinic } = useClinic()
  const [mensaje, setMensaje] = useState('Hola 👋 Quiero agendar una cita')

  // Número: preferir el de WhatsApp conectado; si no, el del consultorio
  const crudo = (clinic?.whatsapp?.phoneNumber || configNumero || '').replace(/\D/g, '')
  const numero = crudo ? (crudo.startsWith('52') ? crudo : `52${crudo}`) : ''
  const link = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : ''
  const qr = link ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}` : ''

  return (
    <div style={{ padding: 20, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,212,168,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Smartphone size={20} color="var(--teal)" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Enlace de auto-agenda</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            Pon este enlace en tu botón de WhatsApp (Facebook, web, tarjeta). Al tocarlo, el bot inicia el agendamiento.
          </div>
        </div>
      </div>

      {!numero ? (
        <div style={{ fontSize: 13, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <XCircle size={15} /> Conecta tu WhatsApp o escribe el número del consultorio (pestaña General) para generar el enlace.
        </div>
      ) : (
        <>
          <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Mensaje pre-escrito</label>
          <input className="input" value={mensaje} onChange={e => setMensaje(e.target.value)} style={{ marginBottom: 12 }} />

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Tu enlace</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="input" readOnly value={link} style={{ flex: 1, minWidth: 180, fontSize: 12 }} onFocus={e => e.currentTarget.select()} />
                <button className="btn btn-secondary btn-sm" onClick={() => onCopy(link, 'wa-link')} style={{ color: copied === 'wa-link' ? 'var(--teal)' : undefined }}>
                  <Copy size={13} /> {copied === 'wa-link' ? 'Copiado' : 'Copiar'}
                </button>
                <a className="btn btn-primary btn-sm" href={link} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={13} /> Probar
                </a>
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(0,212,168,0.05)', border: '1px solid rgba(0,212,168,0.15)', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.6 }}>
                  En tu página de Facebook: <strong style={{ color: 'var(--text2)' }}>Editar página → Botón → WhatsApp</strong> y pega este número. O usa el enlace directo en cualquier botón/web.
                </p>
              </div>
            </div>

            {qr && (
              <div style={{ textAlign: 'center' }}>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Código QR</label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR de auto-agenda" width={140} height={140} style={{ borderRadius: 8, background: '#fff', padding: 6 }} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Imprímelo en tu consultorio</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ── WhatsApp Connect Card (Meta Embedded Signup) ──────────────── */
const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? ''

/** Declare FB SDK global injected by the script tag */
declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void
      login: (cb: (response: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void
    }
    fbAsyncInit?: () => void
  }
}

function loadFBSDK(appId: string): Promise<void> {
  return new Promise(resolve => {
    if (window.FB) { resolve(); return }
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, cookie: true, xfbml: true, version: 'v20.0' })
      resolve()
    }
    if (!document.getElementById('facebook-jssdk')) {
      const s = document.createElement('script')
      s.id = 'facebook-jssdk'
      s.src = 'https://connect.facebook.net/en_US/sdk.js'
      document.head.appendChild(s)
    }
  })
}

function WhatsAppConnectCard({ clinicId }: { clinicId: string | null }) {
  const { clinic } = useClinic()
  const { toast }  = useToast()
  const [connecting,    setConnecting]    = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState({ phoneNumberId: '', token: '' })
  const [manualSaving, setManualSaving] = useState(false)

  const wa = clinic?.whatsapp
  const connected = wa?.connected === true

  const handleManualConnect = async () => {
    if (!clinicId) return
    if (!manual.phoneNumberId.trim() || !manual.token.trim()) {
      toast('Ingresa Phone Number ID y token', 'error'); return
    }
    setManualSaving(true)
    try {
      const res = await fetch('/api/whatsapp/manual-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, phoneNumberId: manual.phoneNumberId.trim(), token: manual.token.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast(`✅ WhatsApp conectado: ${data.phoneNumber}`, 'success')
        setTimeout(() => window.location.reload(), 900)
      } else {
        toast(data.error ?? 'Error al conectar', 'error')
      }
    } catch {
      toast('Error al conectar', 'error')
    } finally {
      setManualSaving(false)
    }
  }

  const handleConnect = async () => {
    if (!clinicId) { toast('Cargando clínica...', 'info'); return }
    if (!META_APP_ID) {
      toast('Configura NEXT_PUBLIC_META_APP_ID en Vercel', 'error')
      return
    }
    setConnecting(true)
    try {
      await loadFBSDK(META_APP_ID)
      window.FB!.login(async (response) => {
        const code = response.authResponse?.code
        if (!code) {
          setConnecting(false)
          toast('Conexión cancelada', 'info')
          return
        }
        // Exchange code for permanent token + save to Firestore
        const res = await fetch('/api/whatsapp/meta-connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, clinicId }),
        })
        const data = await res.json()
        if (res.ok && data.ok) {
          toast(`✅ WhatsApp conectado: ${data.phoneNumber}`, 'success')
        } else {
          toast(data.error ?? 'Error al conectar', 'error')
        }
        setConnecting(false)
      }, {
        config_id: META_APP_ID,  // use your App ID as config_id for Embedded Signup
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      })
    } catch (e) {
      toast('Error al cargar el SDK de Meta', 'error')
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!clinicId) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/clinic/whatsapp-disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      if (res.ok) toast('WhatsApp desconectado', 'success')
      else toast('Error al desconectar', 'error')
    } catch {
      toast('Error al desconectar', 'error')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div style={{ padding: 20, background: 'var(--s1)', border: `1px solid ${connected ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`, borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: connected ? 'rgba(74,222,128,0.12)' : 'rgba(0,212,168,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageCircle size={20} color={connected ? '#4ade80' : 'var(--teal)'} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>WhatsApp Business</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {connected
                ? `Conectado · ${wa?.phoneNumber ?? 'número activo'}`
                : 'Bot de agendamiento automático 24/7'
              }
            </div>
          </div>
        </div>

        {/* Status badge */}
        <span style={{
          display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
          padding: '4px 12px', borderRadius: 20,
          background: connected ? 'rgba(74,222,128,0.1)' : 'var(--s2)',
          color: connected ? '#4ade80' : 'var(--text3)',
        }}>
          {connected ? <><CheckCircle2 size={13} /> Conectado</> : <><XCircle size={13} /> No conectado</>}
        </span>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {connected ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#4ade80',
            }}>
              <Smartphone size={14} />
              <span>Bot activo — los pacientes ya pueden escribir para agendar</span>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', fontSize: 13, padding: '8px 14px',
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              {disconnecting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={13} />}
              Desconectar
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: connecting ? 'var(--s3)' : '#25D366', color: '#fff',
              border: 'none', borderRadius: 10, padding: '11px 20px',
              fontSize: 14, fontWeight: 700, cursor: connecting ? 'default' : 'pointer',
            }}
          >
            {connecting
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Conectando…</>
              : <><MessageCircle size={16} /> Conectar WhatsApp con Meta</>
            }
          </button>
        )}
      </div>

      {/* Info box + conexión manual */}
      {!connected && (
        <>
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,212,168,0.05)', border: '1px solid rgba(0,212,168,0.15)', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.6 }}>
              Al hacer clic se abrirá una ventana de Meta. Solo necesitas iniciar sesión con Facebook
              y verificar tu número de WhatsApp.
            </p>
          </div>

          <button
            onClick={() => setManualOpen(o => !o)}
            style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            {manualOpen ? 'Ocultar conexión manual' : '¿Ya tienes tus credenciales? Conectar manualmente'}
          </button>

          {manualOpen && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.6 }}>
                Desde <strong style={{ color: 'var(--text2)' }}>developers.facebook.com → tu app → WhatsApp → API Setup</strong>: copia el <strong style={{ color: 'var(--text2)' }}>Phone Number ID</strong> y el <strong style={{ color: 'var(--text2)' }}>Access Token</strong>. Funciona también con el número de prueba gratuito de Meta.
              </p>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Phone Number ID</label>
                <input className="input" value={manual.phoneNumberId} onChange={e => setManual(m => ({ ...m, phoneNumberId: e.target.value }))} placeholder="123456789012345" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Access Token</label>
                <input className="input" type="password" value={manual.token} onChange={e => setManual(m => ({ ...m, token: e.target.value }))} placeholder="EAAxxxxxxxx…" />
              </div>
              <button
                onClick={handleManualConnect}
                disabled={manualSaving}
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--teal)', color: '#000', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {manualSaving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Conectando…</> : 'Conectar'}
              </button>
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>
                Además, en Meta configura el webhook: <strong style={{ color: 'var(--text2)' }}>{`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'}/api/whatsapp/webhook`}</strong> y suscríbete a <strong style={{ color: 'var(--text2)' }}>messages</strong>.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BotFAQTab({ doctors }: { doctors: Doctor[] }) {
  const { toast } = useToast()
  const { clinicId } = useClinic()
  const doctor = doctors[0] // primary doctor
  const [values, setValues] = useState({
    padecimientos: '',
    costoConsulta: '',
    seguros: '',
    comoLlegar: '',
    infoExtra: '',
  })
  const [saving, setSaving] = useState(false)
  const [webhookToken] = useState(process.env.NEXT_PUBLIC_APP_URL || '')

  useEffect(() => {
    if (doctor?.botConfig) {
      setValues({
        padecimientos: doctor.botConfig.padecimientos || '',
        costoConsulta: doctor.botConfig.costoConsulta || '',
        seguros: doctor.botConfig.seguros || '',
        comoLlegar: doctor.botConfig.comoLlegar || '',
        infoExtra: doctor.botConfig.infoExtra || '',
      })
    }
  }, [doctor])

  const handleSave = async () => {
    if (!doctor) { toast('No hay médico configurado', 'error'); return }
    setSaving(true)
    try {
      await updateDoctor(clinicId!, doctor.id, {
        botConfig: { ...values, completado: true },
      })
      toast('Bot FAQ actualizado', 'success')
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const webhookUrl = `${appUrl}/api/whatsapp/webhook`

  const FIELDS = [
    { id: 'padecimientos', label: '🩺 Padecimientos que atiende', placeholder: 'Infecciones bacterianas, virales, VIH/SIDA, tuberculosis…' },
    { id: 'costoConsulta', label: '💰 Costo de consulta', placeholder: 'Primera vez $800, seguimiento $600…' },
    { id: 'seguros', label: '🏥 Seguros aceptados', placeholder: 'GNP, AXA… / No aceptamos IMSS/ISSSTE' },
    { id: 'comoLlegar', label: '📍 Cómo llegar / Dirección detallada', placeholder: 'Edificio X, piso 3, consultorio 304…' },
    { id: 'infoExtra', label: '💬 Información adicional (opcional)', placeholder: 'Traer estudios previos, llegar 10 min antes…' },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'rgba(0,212,168,0.05)', border: '1px solid rgba(0,212,168,0.2)', borderRadius: 12, padding: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
          🤖 <strong style={{ color: 'var(--teal)' }}>Bot de WhatsApp</strong> — estas respuestas se usan cuando los pacientes pregunten por WhatsApp sobre horarios, costos, ubicación, etc.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '8px 0 0' }}>
          URL del Webhook (para Meta): <code style={{ background: 'var(--s2)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{webhookUrl}</code>
          &nbsp;
          <button
            onClick={() => navigator.clipboard?.writeText(webhookUrl)}
            style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: 12 }}
          >
            Copiar
          </button>
        </p>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 0' }}>
          Token de verificación: <code style={{ background: 'var(--s2)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>agenda-medica-bot</code>
          &nbsp;(variable WHATSAPP_WEBHOOK_TOKEN en Vercel)
        </p>
      </div>

      {!doctor && (
        <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, padding: 14, fontSize: 13, color: '#fbbf24' }}>
          ⚠️ No hay médico configurado. Ve a Configuración → General para agregar un médico.
        </div>
      )}

      {FIELDS.map(f => (
        <div key={f.id}>
          <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
            {f.label}
          </label>
          <textarea
            value={values[f.id]}
            onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}
            placeholder={f.placeholder}
            rows={3}
            disabled={!doctor}
            style={{
              width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text)',
              outline: 'none', resize: 'vertical', lineHeight: 1.6,
            }}
          />
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving || !doctor}
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start' }}
      >
        {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : <><Save size={15} /> Guardar FAQ del bot</>}
      </button>
    </div>
  )
}

// ── Médicos sub-component ────────────────────────────────────

import { createDoctor, deleteDoctor } from '@/lib/firestore'

function MedicosTab() {
  const { doctors, loading } = useDoctors()
  const { config } = useConfig()
  const { clinicId } = useClinic()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: '', especialidad: '', telefono: '', email: '', activo: true,
  })

  const handleCreate = async () => {
    if (!form.nombre.trim()) { toast('El nombre es requerido', 'error'); return }
    setSaving(true)
    try {
      await createDoctor(clinicId!, {
        nombre: form.nombre.trim(),
        especialidad: form.especialidad.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        activo: form.activo,
        horario: config.horario || DEFAULT_CONFIG.horario,
        duraciones: config.duraciones || DEFAULT_CONFIG.duraciones,
        intervaloMinutos: config.intervaloMinutos || 10,
        zonaHoraria: config.zonaHoraria || 'America/Chihuahua',
        createdAt: '',
        updatedAt: '',
      })
      toast('Médico agregado', 'success')
      setShowForm(false)
      setForm({ nombre: '', especialidad: '', telefono: '', email: '', activo: true })
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Cargando…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
          {doctors.length} médico{doctors.length !== 1 ? 's' : ''} registrado{doctors.length !== 1 ? 's' : ''}
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancelar' : '+ Agregar médico'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Nuevo médico</h3>
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { key: 'nombre', label: 'Nombre completo *', placeholder: 'Dr. David Rodríguez' },
              { key: 'especialidad', label: 'Especialidad', placeholder: 'Infectología' },
              { key: 'telefono', label: 'Teléfono', placeholder: '656 551 8875' },
              { key: 'email', label: 'Correo', placeholder: 'doctor@email.com' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>{f.label}</label>
                <input
                  value={form[f.key as keyof typeof form] as string}
                  onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button onClick={handleCreate} disabled={saving} className="btn btn-primary">
              {saving ? 'Guardando…' : 'Guardar médico'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
            Horario y duraciones se copian de la configuración general. Puedes editarlos después.
          </p>
        </div>
      )}

      {doctors.map(doc => (
        <div key={doc.id} style={{
          background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              👨‍⚕️
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{doc.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{doc.especialidad}</div>
              {doc.botConfig?.completado && (
                <span style={{ fontSize: 11, color: 'var(--teal)', marginTop: 2, display: 'block' }}>
                  ✅ Bot FAQ configurado
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 20,
              background: doc.activo ? 'rgba(0,212,168,0.1)' : 'rgba(255,255,255,0.05)',
              color: doc.activo ? 'var(--teal)' : 'var(--text3)',
              border: doc.activo ? '1px solid rgba(0,212,168,0.3)' : '1px solid var(--border)',
            }}>
              {doc.activo ? 'Activo' : 'Inactivo'}
            </span>
            <button
              onClick={() => updateDoctor(clinicId!, doc.id, { activo: !doc.activo }).catch(() => toast('Error', 'error'))}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12, borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
            >
              {doc.activo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>
      ))}

      {doctors.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>
          No hay médicos registrados. Agrega uno para habilitar el portal del asistente.
        </div>
      )}
    </div>
  )
}

/* ── Suscripción Tab ─────────────────────────────────────────── */
const PLAN_DISPLAY: Record<string, { label: string; color: string; price: string }> = {
  trial:   { label: 'Prueba gratuita',  color: '#f59e0b', price: '$0 MXN/mes' },
  basico:  { label: 'Plan Básico',      color: '#60a5fa', price: '$299 MXN/mes' },
  pro:     { label: 'Plan Pro',         color: '#00d4a8', price: '$499 MXN/mes' },
  clinica: { label: 'Plan Clínica',     color: '#a78bfa', price: '$999 MXN/mes' },
}

const PLAN_FEATURES: Record<string, string[]> = {
  trial:   ['14 días gratuitos', 'Todas las funciones Pro', 'Sin tarjeta de crédito'],
  basico:  ['1 médico', 'Agenda y calendario', 'Recordatorios automáticos', 'Portal de secretaria'],
  pro:     ['1 médico', 'Bot de WhatsApp 24/7', 'Lista de espera automática', 'Google Calendar sync', 'Todo el plan Básico'],
  clinica: ['Hasta 5 médicos', 'Múltiples secretarias', 'Dashboard de métricas', 'Soporte prioritario', 'Todo el plan Pro'],
}

function SuscripcionTab({ clinicId }: { clinicId: string | null }) {
  const { clinic } = useClinic()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const plan    = clinic?.plan    ?? 'trial'
  const status  = clinic?.status  ?? 'trial'
  const planInfo = PLAN_DISPLAY[plan] ?? PLAN_DISPLAY.trial
  const features = PLAN_FEATURES[plan] ?? []

  const openPortal = async () => {
    if (!clinicId) return
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
      else toast(data.error ?? 'Error', 'error')
    } catch {
      toast('Error al abrir portal', 'error')
    } finally {
      setLoading(false)
    }
  }

  const startCheckout = async (targetPlan: string) => {
    if (!clinicId) return
    setCheckoutLoading(targetPlan)
    const user = auth.currentUser
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, plan: targetPlan, email: user?.email ?? '' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast(data.error ?? 'Error', 'error')
    } catch {
      toast('Error al iniciar pago', 'error')
    } finally {
      setCheckoutLoading(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Current plan */}
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Plan actual</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CreditCard size={18} color={planInfo.color} />
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{planInfo.label}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
              background: status === 'active' ? 'rgba(0,212,168,0.12)' : 'rgba(245,158,11,0.12)',
              color: status === 'active' ? 'var(--teal)' : '#f59e0b',
              border: `1px solid ${status === 'active' ? 'rgba(0,212,168,0.3)' : 'rgba(245,158,11,0.3)'}`,
            }}>
              {status === 'active' ? 'ACTIVO' : status === 'trial' ? 'PRUEBA' : status === 'suspended' ? 'SUSPENDIDO' : 'CANCELADO'}
            </span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }}>{planInfo.price}</div>
        </div>

        {clinic?.stripeSubscriptionId && (
          <button
            onClick={openPortal}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--s2)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13, fontWeight: 600,
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
            }}
          >
            {loading
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…</>
              : <><ExternalLink size={14} /> Gestionar facturación</>
            }
          </button>
        )}
      </div>

      {/* Current features */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Incluido en tu plan:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {features.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={15} color="var(--teal)" />
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade options */}
      {plan !== 'clinica' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            {plan === 'trial' ? 'Activa tu plan antes de que termine la prueba:' : 'Opciones de actualización:'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(['basico', 'pro', 'clinica'] as const)
              .filter(p => p !== plan)
              .map(p => {
                const info = PLAN_DISPLAY[p]
                return (
                  <div key={p} style={{
                    background: 'var(--s1)', border: p === 'pro' ? '1px solid rgba(0,212,168,0.4)' : '1px solid var(--border)',
                    borderRadius: 10, padding: '16px 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{info.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--text3)' }}>{info.price}</div>
                    </div>
                    <button
                      onClick={() => startCheckout(p)}
                      disabled={checkoutLoading === p}
                      style={{
                        background: p === 'pro' ? 'var(--teal)' : 'var(--s2)',
                        color: p === 'pro' ? '#000' : 'var(--text)',
                        border: p === 'pro' ? 'none' : '1px solid var(--border)',
                        fontSize: 13, fontWeight: 700,
                        padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {checkoutLoading === p
                        ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…</>
                        : `Elegir ${info.label}`
                      }
                    </button>
                  </div>
                )
              })
            }
          </div>
        </div>
      )}
    </div>
  )
}


/* ── Equipo (invitar asistente / colaboradores) ──────────── */
function EquipoTab({ clinicId, clinicNombre }: { clinicId: string | null; clinicNombre: string }) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)
  const [nombreInv, setNombreInv] = useState('')
  const [rol, setRol] = useState<RolInvitacion>('secretaria')
  const [generada, setGenerada] = useState<Invitacion | null>(null)
  const [copiado, setCopiado] = useState(false)

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agenda-medica-one.vercel.app'

  const recargar = async () => {
    if (!clinicId) return
    setLoading(true)
    try {
      const list = await listarInvitaciones(clinicId)
      setInvitaciones(list)
    } finally { setLoading(false) }
  }
  useEffect(() => { recargar() /* eslint-disable-next-line */ }, [clinicId])

  const generar = async () => {
    if (!clinicId || !user) { toast('No estás autenticado', 'error'); return }
    setCreando(true)
    try {
      const inv = await crearInvitacion(
        clinicId, clinicNombre, rol,
        { uid: user.uid, email: user.email ?? '' },
        nombreInv,
      )
      setGenerada(inv)
      setNombreInv('')
      recargar()
    } catch {
      toast('Error al crear la invitación', 'error')
    } finally { setCreando(false) }
  }

  const linkDe = (inv: Invitacion) => `${APP_URL}/unirse/${inv.code}`

  const copiar = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopiado(true); setTimeout(() => setCopiado(false), 2000); toast('Enlace copiado', 'success') }
    catch { toast('No se pudo copiar', 'error') }
  }
  const compartirWhatsApp = (inv: Invitacion) => {
    const msg = encodeURIComponent(
      `Te invito a unirte a ${clinicNombre} como ${inv.role === 'secretaria' ? 'asistente' : inv.role}.\n\nCrea tu cuenta aquí: ${linkDe(inv)}`,
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }
  const revocar = async (code: string) => {
    if (!window.confirm('¿Revocar esta invitación? El enlace dejará de funcionar.')) return
    try { await revocarInvitacion(code); recargar(); toast('Invitación revocada', 'info') }
    catch { toast('Error al revocar', 'error') }
  }

  const pendientes = invitaciones.filter(i => !i.used)
  const usadas    = invitaciones.filter(i =>  i.used)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.55 }}>
        Genera un enlace que tu asistente abrirá para crear su cuenta y unirse a esta clínica.
        Los enlaces expiran en 7 días.
      </div>

      {/* Crear invitación */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Invitar a alguien</div>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Nombre (opcional)</label>
            <input className="input" value={nombreInv} onChange={e => setNombreInv(e.target.value)} placeholder="María Pérez" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Rol</label>
            <select className="input" value={rol} onChange={e => setRol(e.target.value as RolInvitacion)}>
              <option value="secretaria">Asistente / Secretaria</option>
              <option value="medico">Médico</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <button onClick={generar} disabled={creando} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--teal)', color: '#040b12', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: creando ? 'default' : 'pointer' }}>
          {creando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</> : '✨ Generar enlace de invitación'}
        </button>

        {generada && (
          <div style={{ marginTop: 14, padding: 12, background: 'rgba(0,212,168,0.06)', border: '1px solid rgba(0,212,168,0.25)', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 600, marginBottom: 6 }}>✅ Enlace listo</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', wordBreak: 'break-all', marginBottom: 10 }}>
              {linkDe(generada)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => copiar(linkDe(generada))} style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Copy size={12} /> {copiado ? 'Copiado' : 'Copiar enlace'}
              </button>
              <button onClick={() => compartirWhatsApp(generada)} style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <MessageCircle size={12} /> Enviar por WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pendientes */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          Invitaciones pendientes ({pendientes.length})
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Cargando…</div>
        ) : pendientes.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>No hay invitaciones pendientes.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendientes.map(inv => (
              <div key={inv.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {inv.nombreInvitado || '(Sin nombre)'} · <span style={{ color: 'var(--teal)' }}>{inv.role}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    Creado {new Date(inv.createdAt).toLocaleDateString('es-MX')} · Expira {new Date(inv.expiresAt).toLocaleDateString('es-MX')}
                  </div>
                </div>
                <button onClick={() => copiar(linkDe(inv))} style={{ background: 'var(--s3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer' }}>
                  Copiar enlace
                </button>
                <button onClick={() => compartirWhatsApp(inv)} style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                  WhatsApp
                </button>
                <button onClick={() => revocar(inv.code)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer' }}>
                  Revocar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usadas */}
      {usadas.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
            Invitaciones aceptadas ({usadas.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {usadas.map(inv => (
              <div key={inv.code} style={{ fontSize: 12.5, color: 'var(--text2)', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                ✅ {inv.nombreInvitado || '(Sin nombre)'} ({inv.role}) — aceptada {inv.usedAt ? new Date(inv.usedAt).toLocaleDateString('es-MX') : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

