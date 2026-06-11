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
import { useMode } from '@/context/ModeContext'
import {
  crearInvitacion, listarInvitaciones, revocarInvitacion,
  type Invitacion, type RolInvitacion,
} from '@/lib/invitations'
import {
  crearBloque, listarBloques, borrarBloque,
  type TimeBlock, type TipoBloque, TIPO_BLOQUE_LABEL,
} from '@/lib/time-blocks'

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
const DIAS_LABELS = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' }

type Tab = 'general' | 'horario' | 'duraciones' | 'bloqueos' | 'notificaciones' | 'integraciones' | 'plantillas' | 'portal' | 'recetas' | 'seguridad' | 'bot' | 'medicos' | 'equipo' | 'suscripcion'

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

  const { mode } = useMode()
  // Tabs organizadas en GRUPOS para que no se vea un menú interminable arriba.
  // Ahora salen en una columna lateral (desktop) o un select (móvil).
  const TAB_GROUPS: { titulo: string; tabs: { key: Tab; label: string; modoMin?: 'medico' }[] }[] = [
    {
      titulo: 'Mi consultorio',
      tabs: [
        { key: 'general', label: '🏥 Datos del consultorio' },
        { key: 'horario', label: '⏰ Horario de atención' },
        { key: 'duraciones', label: '⌛ Duración de citas' },
        { key: 'bloqueos', label: '🌴 Vacaciones y bloqueos' },
      ],
    },
    {
      titulo: 'Comunicación con pacientes',
      tabs: [
        { key: 'notificaciones', label: '🔔 Notificaciones' },
        { key: 'plantillas', label: '💬 Mensajes de WhatsApp' },
        { key: 'portal', label: '🔗 Portal de auto-agenda' },
        { key: 'bot', label: '🤖 Bot de preguntas frecuentes', modoMin: 'medico' },
      ],
    },
    {
      titulo: 'Documentos clínicos',
      tabs: [
        { key: 'recetas', label: '🩺 Recetas y órdenes', modoMin: 'medico' },
      ],
    },
    {
      titulo: 'Equipo y permisos',
      tabs: [
        // La asistente puede gestionar perfiles de médicos en agenda
        { key: 'medicos', label: '👨‍⚕️ Médicos (hasta 5)' },
        { key: 'equipo', label: '👥 Asistentes y secretarias' },
      ],
    },
    {
      titulo: 'Sistema',
      tabs: [
        { key: 'integraciones', label: '🔌 Integraciones' },
        { key: 'seguridad', label: '🔐 Seguridad', modoMin: 'medico' },
        { key: 'suscripcion', label: '💳 Mi suscripción', modoMin: 'medico' },
      ],
    },
  ]
  // Aplanar para verificación + filtrar por modo
  const TABS = TAB_GROUPS.flatMap(g => g.tabs.filter(t => !t.modoMin || mode === t.modoMin))

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Cargando configuración…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Encontrar la label del tab actual (para el título móvil)
  const tabActual = TABS.find(t => t.key === tab)

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>⚙️ Configuración</h1>
        {tab !== 'integraciones' && tab !== 'recetas' && tab !== 'portal' && tab !== 'seguridad' && tab !== 'equipo' && tab !== 'medicos' && tab !== 'bloqueos' && tab !== 'suscripcion' && tab !== 'bot' && (
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : <><Save size={15} /> Guardar</>}
          </button>
        )}
      </div>

      {/* Layout: sidebar agrupado (desktop) / select (móvil) + contenido */}
      <div className="config-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Sidebar agrupado — solo desktop */}
        <nav className="config-sidebar" style={{
          background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 12, position: 'sticky', top: 16,
        }}>
          {TAB_GROUPS.map(grupo => {
            const visibles = grupo.tabs.filter(t => !t.modoMin || mode === t.modoMin)
            if (visibles.length === 0) return null
            return (
              <div key={grupo.titulo} style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 700, color: 'var(--text3)',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  padding: '6px 10px', marginBottom: 2,
                }}>
                  {grupo.titulo}
                </div>
                {visibles.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 10px', borderRadius: 8, fontSize: 13,
                      background: tab === t.key ? 'rgba(20,184,166,0.12)' : 'transparent',
                      color: tab === t.key ? 'var(--teal)' : 'var(--text2)',
                      border: tab === t.key ? '1px solid rgba(20,184,166,0.3)' : '1px solid transparent',
                      cursor: 'pointer', marginBottom: 2,
                      fontWeight: tab === t.key ? 600 : 500,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )
          })}
        </nav>

        {/* Select para móvil */}
        <div className="config-mobile-select" style={{ display: 'none', marginBottom: 16 }}>
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
              fontSize: 14, fontWeight: 600,
            }}
          >
            {TAB_GROUPS.map(grupo => {
              const visibles = grupo.tabs.filter(t => !t.modoMin || mode === t.modoMin)
              if (visibles.length === 0) return null
              return (
                <optgroup key={grupo.titulo} label={grupo.titulo}>
                  {visibles.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>

        {/* Contenido del tab activo */}
        <div style={{ minWidth: 0 }}>
          {tabActual && (
            <div className="config-tab-header" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{tabActual.label}</h2>
            </div>
          )}

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

          {/* 🖋️ Firma + sello — se renderiza encima de la línea de firma en notas, recetas y órdenes */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <FirmaUploadSection
              firmaDataUrl={form.firmaImagenDataUrl}
              onChange={(dataUrl) => setForm({ ...form, firmaImagenDataUrl: dataUrl })}
            />
          </div>
        </div>
      )}

      {/* Horario */}
      {tab === 'horario' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 8px' }}>Define los días y horarios de atención del consultorio. El preview muestra cuántos espacios generará cada día.</p>
          {DIAS.map(dia => {
            const h = form.horario[dia]
            // Preview de slots por día — usa la duración de "primera vez" o 30 min default
            const duracionDefault = Number(form.duraciones?.['primera-vez'] ?? form.duraciones?.['seguimiento'] ?? 30)
            const intervalo = Math.max(Number(form.intervaloMinutos ?? 10), duracionDefault)
            let cantidadSlots = 0
            let minutos = 0
            if (h.activo && h.inicio && h.fin) {
              const [hI, mI] = h.inicio.split(':').map(Number)
              const [hF, mF] = h.fin.split(':').map(Number)
              minutos = (hF * 60 + mF) - (hI * 60 + mI)
              if (minutos > 0) {
                cantidadSlots = Math.floor((minutos - duracionDefault) / intervalo) + 1
                if (cantidadSlots < 0) cantidadSlots = 0
              }
            }
            const horas = (minutos / 60).toFixed(1).replace('.0', '')
            // Warning si el día parece desproporcionado (>16 slots = >8h con citas de 30min)
            const esSospechoso = cantidadSlots > 16
            return (
              <div key={dia} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--s1)', border: `1px solid ${esSospechoso ? 'var(--amber)' : 'var(--border)'}`, borderRadius: 10 }}>
                <input
                  type="checkbox"
                  checked={h.activo}
                  onChange={e => updHorario(dia, 'activo', e.target.checked)}
                  style={{ accentColor: 'var(--teal)', width: 16, height: 16 }}
                />
                <div style={{ width: 80, fontSize: 14, fontWeight: 500, color: h.activo ? 'var(--text)' : 'var(--text3)' }}>
                  {DIAS_LABELS[dia]}
                </div>
                {h.activo ? (
                  <>
                    <input
                      type="time" className="input" value={h.inicio}
                      onChange={e => updHorario(dia, 'inicio', e.target.value)}
                      style={{ width: 110 }}
                    />
                    <span style={{ color: 'var(--text3)', fontSize: 14 }}>—</span>
                    <input
                      type="time" className="input" value={h.fin}
                      onChange={e => updHorario(dia, 'fin', e.target.value)}
                      style={{ width: 110 }}
                    />
                    {/* Preview en vivo de cuántos espacios resultan */}
                    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: esSospechoso ? 'var(--amber)' : cantidadSlots > 0 ? 'var(--text2)' : 'var(--red)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {cantidadSlots > 0 ? `${cantidadSlots} espacios` : minutos <= 0 ? 'Horario inválido' : '0 espacios'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {minutos > 0 ? `${horas}h · cada ${intervalo} min` : '—'}
                      </span>
                      {esSospechoso && (
                        <span style={{ fontSize: 10.5, color: 'var(--amber)', fontWeight: 500 }}>
                          ⚠️ ¿Atiendes tantas horas?
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>Cerrado</span>
                )}
              </div>
            )
          })}
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
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(61,90,254,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(61,90,254,0.05)', border: '1px solid rgba(61,90,254,0.15)', borderRadius: 8 }}>
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

      {/* Bloqueos de horario */}
      {tab === 'bloqueos' && <BloqueosTab clinicId={clinicId} />}

      {/* Portal del paciente */}
      {tab === 'portal' && <PortalTab clinicId={clinicId} clinicNombre={form.nombreClinica || 'tu clínica'} />}

      {/* Recetas y órdenes */}
      {tab === 'recetas' && <RecetasTab clinicId={clinicId} />}

      {/* Seguridad — MFA / 2FA */}
      {tab === 'seguridad' && <SeguridadTab />}

      {/* Suscripción */}
      {tab === 'suscripcion' && <SuscripcionTab clinicId={clinicId} />}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .config-layout {
            grid-template-columns: 1fr !important;
          }
          .config-sidebar { display: none !important; }
          .config-mobile-select { display: block !important; }
        }
      `}</style>
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
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(61,90,254,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(61,90,254,0.05)', border: '1px solid rgba(61,90,254,0.15)', borderRadius: 8 }}>
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
            background: connected ? 'rgba(74,222,128,0.12)' : 'rgba(61,90,254,0.08)',
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
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(61,90,254,0.05)', border: '1px solid rgba(61,90,254,0.15)', borderRadius: 8 }}>
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
      <div style={{ background: 'rgba(61,90,254,0.05)', border: '1px solid rgba(61,90,254,0.2)', borderRadius: 12, padding: 16 }}>
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

  const MAX_DOCTORS = 5
  const handleCreate = async () => {
    if (!form.nombre.trim()) { toast('El nombre es requerido', 'error'); return }
    if (doctors.length >= MAX_DOCTORS) {
      toast(`Máximo ${MAX_DOCTORS} médicos por clínica`, 'error')
      return
    }
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
          {doctors.length} de {MAX_DOCTORS} médicos registrados
          {doctors.length >= MAX_DOCTORS && <span style={{ color: '#f87171', marginLeft: 8 }}>· Límite alcanzado</span>}
        </p>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowForm(s => !s)}
          disabled={!showForm && doctors.length >= MAX_DOCTORS}
        >
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
              background: doc.activo ? 'rgba(61,90,254,0.1)' : 'rgba(255,255,255,0.05)',
              color: doc.activo ? 'var(--teal)' : 'var(--text3)',
              border: doc.activo ? '1px solid rgba(61,90,254,0.3)' : '1px solid var(--border)',
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
  pro:     { label: 'Plan Pro',         color: '#3D5AFE', price: '$499 MXN/mes' },
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
              background: status === 'active' ? 'rgba(61,90,254,0.12)' : 'rgba(245,158,11,0.12)',
              color: status === 'active' ? 'var(--teal)' : '#f59e0b',
              border: `1px solid ${status === 'active' ? 'rgba(61,90,254,0.3)' : 'rgba(245,158,11,0.3)'}`,
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
                    background: 'var(--s1)', border: p === 'pro' ? '1px solid rgba(61,90,254,0.4)' : '1px solid var(--border)',
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

      {/* Miembros activos del equipo */}
      <MiembrosActivos clinicId={clinicId} miUid={user?.uid} />

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
          <div style={{ marginTop: 14, padding: 12, background: 'rgba(61,90,254,0.06)', border: '1px solid rgba(61,90,254,0.25)', borderRadius: 10 }}>
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



/* ── Bloqueos de horario ─────────────────────────────────── */
function BloqueosTab({ clinicId }: { clinicId: string | null }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [bloques, setBloques] = useState<TimeBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [tipo, setTipo] = useState<TipoBloque>("vacaciones")
  const [motivo, setMotivo] = useState("")
  const [saving, setSaving] = useState(false)

  const cargar = async () => {
    if (!clinicId) return
    setLoading(true)
    try { setBloques(await listarBloques(clinicId)) } finally { setLoading(false) }
  }
  useEffect(() => { cargar() }, [clinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  const crear = async () => {
    if (!clinicId || !user) return
    if (!desde || !hasta) { toast("Indica fecha y hora de inicio y fin", "error"); return }
    setSaving(true)
    try {
      await crearBloque(clinicId, {
        desde: new Date(desde).toISOString(),
        hasta: new Date(hasta).toISOString(),
        tipo, motivo: motivo.trim() || undefined,
        creadoPor: user.email ?? "",
      })
      setDesde(""); setHasta(""); setMotivo("")
      await cargar()
      toast("Bloqueo creado", "success")
    } catch (e) {
      toast((e as Error).message || "Error al crear", "error")
    } finally { setSaving(false) }
  }

  const borrar = async (id: string) => {
    if (!clinicId) return
    if (!window.confirm("¿Eliminar este bloqueo? Los slots volverán a estar disponibles.")) return
    try { await borrarBloque(clinicId, id); await cargar(); toast("Bloqueo eliminado", "info") }
    catch { toast("Error al eliminar", "error") }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("es-MX", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.55, margin: 0 }}>
        Los bloqueos impiden que los pacientes agenden durante esos horarios — útil para vacaciones,
        ausencias puntuales, eventos o mantenimiento. Aplica a la agenda manual, al bot de WhatsApp y al portal público.
      </p>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Nuevo bloqueo</div>
        <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 4 }}>Desde</label>
            <input className="input" type="datetime-local" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 4 }}>Hasta</label>
            <input className="input" type="datetime-local" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 4 }}>Tipo</label>
            <select className="input" value={tipo} onChange={e => setTipo(e.target.value as TipoBloque)}>
              {Object.entries(TIPO_BLOQUE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 4 }}>Motivo (opcional)</label>
            <input className="input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Vacaciones de verano" />
          </div>
        </div>
        <button onClick={crear} disabled={saving} style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, background: "var(--teal)", color: "#040b12", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer" }}>
          {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "+ Crear bloqueo"}
        </button>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
          Bloqueos activos ({bloques.length})
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: "var(--text3)" }}>Cargando…</div>
        ) : bloques.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text3)" }}>No hay bloqueos activos.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bloques.map(b => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{TIPO_BLOQUE_LABEL[b.tipo]} {b.motivo && <span style={{ color: "var(--text3)", fontWeight: 400 }}>· {b.motivo}</span>}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text3)" }}>{fmt(b.desde)} → {fmt(b.hasta)}</div>
                </div>
                <button onClick={() => borrar(b.id)} style={{ background: "none", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 6, padding: "5px 10px", fontSize: 11.5, cursor: "pointer" }}>Eliminar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Portal del paciente Tab ─────────────────────────────────── */

function PortalTab({ clinicId, clinicNombre }: { clinicId: string | null; clinicNombre: string }) {
  const { config } = useConfig()
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(config?.publicBookingEnabled !== false)
  const [note, setNote] = useState(config?.publicBookingNote ?? '')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (config) {
      setEnabled(config.publicBookingEnabled !== false)
      setNote(config.publicBookingNote ?? '')
    }
  }, [config])

  // URL pública del portal. No expone clinicId más allá de lo necesario (es el id real, pero el endpoint público filtra qué datos devuelve).
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = clinicId ? `${origin}/reservar/${clinicId}` : ''
  // QR vía servicio externo. La URL ya es pública, no hay fuga de PII al solicitar el QR.
  const qrUrl = url ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=240x240&margin=10` : ''

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('No se pudo copiar el link', 'error')
    }
  }

  const compartirWA = () => {
    const texto = encodeURIComponent(
      `Hola, soy ${clinicNombre}. Puedes agendar tu cita aquí: ${url}`,
    )
    window.open(`https://wa.me/?text=${texto}`, '_blank', 'noopener,noreferrer')
  }

  const guardar = async () => {
    if (!clinicId || !config) return
    setSaving(true)
    try {
      await saveConfig(clinicId, { ...config, publicBookingEnabled: enabled, publicBookingNote: note })
      toast('Portal actualizado', 'success')
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!clinicId) {
    return <div style={{ color: 'var(--text3)', padding: 16 }}>Cargando…</div>
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Estado */}
      <div style={{ padding: 16, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              Portal de auto-agenda 24/7
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 4 }}>
              Tus pacientes pueden reservar cita solos, sin necesidad de llamar.
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--teal)' }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: enabled ? 'var(--teal)' : 'var(--text3)' }}>
              {enabled ? 'Activado' : 'Desactivado'}
            </span>
          </label>
        </div>
      </div>

      {/* Link público + QR */}
      <div style={{ padding: 16, background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
          Tu link para compartir
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            value={url}
            readOnly
            style={{
              flex: 1, minWidth: 220, padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
              fontSize: 13, fontFamily: 'monospace',
            }}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button onClick={copiar} className="btn btn-primary" style={{ minWidth: 110 }}>
            <Copy size={14} /> {copied ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={compartirWA} className="btn" style={{ background: '#25D366', color: '#000', border: 'none', fontWeight: 700 }}>
            <MessageCircle size={14} /> Compartir por WhatsApp
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            <ExternalLink size={14} /> Ver portal
          </a>
        </div>

        {/* QR */}
        {qrUrl && (
          <div style={{ marginTop: 18, padding: 14, background: 'var(--s2)', borderRadius: 10, border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 10, fontWeight: 600 }}>
              📱 QR para imprimir o pegar en el consultorio
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="QR del portal de reservas" style={{ background: '#fff', padding: 8, borderRadius: 8 }} width={240} height={240} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 10, textAlign: 'center' }}>
              Los pacientes escanean con la cámara del celular → abre el portal automáticamente
            </div>
          </div>
        )}
      </div>

      {/* Mensaje opcional para pacientes */}
      <div style={{ padding: 16, background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Mensaje para pacientes (opcional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 280))}
          placeholder='Ej: "Solo primeras consultas por este portal. Para seguimientos, contacta directamente."'
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
            fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, textAlign: 'right' }}>
          {note.length}/280
        </div>
      </div>

      {/* Embeber en tu sitio web */}
      <EmbedSnippets url={url} clinicNombre={clinicNombre} />

      {/* Cómo funciona */}
      <div style={{ padding: 16, background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)', marginBottom: 10 }}>
          ¿Cómo funciona?
        </div>
        <ol style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
          <li>El paciente abre tu link (por WhatsApp, web, QR, etc.)</li>
          <li>Elige el tipo de cita, fecha y hora disponibles según <strong>tu horario</strong> y <strong>tus bloqueos</strong></li>
          <li>Llena nombre + teléfono y acepta el aviso de privacidad</li>
          <li>La cita queda <strong>automáticamente en tu agenda</strong> y se le envía confirmación por WhatsApp</li>
          <li>Tú la ves al instante en Citas / Calendario</li>
        </ol>
      </div>

      {/* Guardar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={guardar} disabled={saving} className="btn btn-primary">
          {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : <><Save size={14} /> Guardar cambios</>}
        </button>
      </div>
    </div>
  )
}

/* ── Snippets embebibles para sitio web ──────────────────────── */

function EmbedSnippets({ url, clinicNombre }: { url: string; clinicNombre: string }) {
  const { toast } = useToast()
  const [tipo, setTipo] = useState<'boton' | 'flotante' | 'iframe'>('boton')
  const [copied, setCopied] = useState(false)

  if (!url) return null

  // Escapamos comillas para que el snippet sea válido HTML al pegarse
  const safeUrl = url.replace(/"/g, '&quot;')
  const safeName = clinicNombre.replace(/"/g, '&quot;').replace(/</g, '&lt;')

  // 1) Botón inline (a tag con estilos inline → funciona en cualquier sitio sin clases CSS)
  const snippetBoton = `<a href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:#14b8a6;color:#000;font-family:system-ui,-apple-system,sans-serif;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;text-decoration:none;box-shadow:0 2px 8px rgba(20,184,166,.3)">📅 Agendar cita</a>`

  // 2) Botón flotante (sticky bottom-right)
  const snippetFlotante = `<a href="${safeUrl}" target="_blank" rel="noopener" style="position:fixed;bottom:20px;right:20px;display:inline-flex;align-items:center;gap:8px;background:#14b8a6;color:#000;font-family:system-ui,-apple-system,sans-serif;font-weight:700;font-size:15px;padding:14px 22px;border-radius:50px;text-decoration:none;box-shadow:0 4px 16px rgba(20,184,166,.4);z-index:9999">📅 Agendar cita</a>`

  // 3) Iframe (portal completo embebido). Requiere que el sitio host permita iframes.
  const snippetIframe = `<iframe src="${safeUrl}" title="Agendar cita con ${safeName}" style="width:100%;max-width:540px;height:720px;border:1px solid #ddd;border-radius:12px;background:#fff" loading="lazy"></iframe>`

  const actual = tipo === 'boton' ? snippetBoton : tipo === 'flotante' ? snippetFlotante : snippetIframe

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(actual)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('No se pudo copiar', 'error')
    }
  }

  const tabs: { key: typeof tipo; label: string; desc: string }[] = [
    { key: 'boton', label: 'Botón en línea', desc: 'Pega en cualquier parte del HTML — botón verde estándar' },
    { key: 'flotante', label: 'Botón flotante', desc: 'Botón fijo en esquina inferior derecha — siempre visible' },
    { key: 'iframe', label: 'Portal embebido', desc: 'El portal completo dentro de tu página' },
  ]

  return (
    <div style={{ padding: 16, background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        💻 Embeber en tu sitio web
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        Pega este código en tu página web (WordPress, Wix, Squarespace, Webflow, etc.) y aparecerá el botón / portal.
      </div>

      {/* Selector de tipo */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTipo(t.key)}
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: tipo === t.key ? '1px solid var(--teal)' : '1px solid var(--border)',
              background: tipo === t.key ? 'rgba(20,184,166,0.1)' : 'var(--s2)',
              color: tipo === t.key ? 'var(--teal)' : 'var(--text2)',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8 }}>
        {tabs.find(t => t.key === tipo)?.desc}
      </div>

      {/* Preview del botón (solo para 'boton' y 'flotante') */}
      {tipo === 'boton' && (
        <div style={{ padding: 16, background: '#fafafa', borderRadius: 8, marginBottom: 10, border: '1px dashed var(--border)', display: 'flex', justifyContent: 'center' }}>
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#14b8a6', color: '#000', fontWeight: 700, fontSize: 15, padding: '12px 22px', borderRadius: 10, textDecoration: 'none', boxShadow: '0 2px 8px rgba(20,184,166,.3)' }}
          >
            📅 Agendar cita
          </a>
        </div>
      )}
      {tipo === 'flotante' && (
        <div style={{ padding: 16, background: '#fafafa', borderRadius: 8, marginBottom: 10, border: '1px dashed var(--border)', position: 'relative', height: 110, overflow: 'hidden' }}>
          <div style={{ fontSize: 11, color: '#999', position: 'absolute', top: 8, left: 12 }}>↓ Simulación del botón flotante</div>
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            style={{ position: 'absolute', bottom: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 8, background: '#14b8a6', color: '#000', fontWeight: 700, fontSize: 15, padding: '14px 22px', borderRadius: 50, textDecoration: 'none', boxShadow: '0 4px 16px rgba(20,184,166,.4)' }}
          >
            📅 Agendar cita
          </a>
        </div>
      )}

      {/* Código */}
      <div style={{ position: 'relative' }}>
        <pre style={{
          margin: 0, padding: '12px 14px', background: '#0a0a0a', color: '#a3e635',
          borderRadius: 8, fontSize: 11.5, fontFamily: 'ui-monospace, "SF Mono", monospace',
          overflow: 'auto', maxHeight: 200, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          border: '1px solid var(--border)',
        }}>
          <code>{actual}</code>
        </pre>
        <button onClick={copiar} className="btn btn-primary" style={{ position: 'absolute', top: 8, right: 8, padding: '6px 10px', fontSize: 11.5 }}>
          <Copy size={12} /> {copied ? '¡Copiado!' : 'Copiar código'}
        </button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
        💡 Tip: Si usas <strong>WordPress</strong>, pega el código en un bloque <em>HTML personalizado</em>.
        En <strong>Wix/Squarespace</strong> busca el elemento "Código embebido".
      </div>
    </div>
  )
}

/* ── Recetas y órdenes Tab ───────────────────────────────────── */

import { RecetaDocumento } from '@/components/RecetaDocumento'
import { resizeImageFile, formatBytes } from '@/lib/image-utils'
import { PAPER_SIZES, ESTILOS_RECETA, detectarPaperSize } from '@/lib/receta-template'
import type { RecetaConfig, PaperSize as PaperSizeT, EstiloReceta as EstiloT, Patient, Doctor as DoctorT } from '@/types'
import { getDoctors } from '@/lib/firestore'
import { Upload, X as IconX, Pill, ClipboardList } from 'lucide-react'

const RX_DEFAULTS: RecetaConfig = {
  paperSize: 'media-carta',
  estilo: 'minimalista',
  colorAccento: '#14b8a6',
  mostrarQR: true,
  copiasEnHoja: 1,
  vigenciaDias: 30,
  mostrarAlergias: true,
  mostrarDiagnostico: true,
  mostrarSignosVitales: false,
  avisoLegal: 'Esta receta es personal e intransferible. Conserve este documento como respaldo médico.',
}

function RecetasTab({ clinicId }: { clinicId: string | null }) {
  const { config } = useConfig()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [tipoPreview, setTipoPreview] = useState<'receta' | 'orden'>('receta')

  // ── Plantilla por médico ──────────────────────────────────────
  // '' = plantilla general de la clínica. Un medicoId = override de ese
  // médico (cada quien tiene su propio papel impreso).
  const [doctores, setDoctores] = useState<DoctorT[]>([])
  const [medicoSel, setMedicoSel] = useState<string>('')

  useEffect(() => {
    if (!clinicId) return
    getDoctors(clinicId).then(setDoctores).catch(() => {})
  }, [clinicId])

  const [rx, setRx] = useState<RecetaConfig>({ ...RX_DEFAULTS })

  // Cargar la plantilla efectiva al cambiar de médico o de config:
  // general → directa; médico → general + overrides del médico encima.
  useEffect(() => {
    const base = { ...RX_DEFAULTS, ...(config?.recetaConfig ?? {}) }
    if (!medicoSel) { setRx(base); return }
    setRx({ ...base, ...(config?.recetasPorMedico?.[medicoSel] ?? {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, medicoSel])

  const guardar = async () => {
    if (!clinicId || !config) return
    setSaving(true)
    try {
      if (!medicoSel) {
        await saveConfig(clinicId, { ...config, recetaConfig: rx })
        toast('Plantilla general guardada', 'success')
      } else {
        // El override del médico guarda TODO el rx editado — al cargar se
        // mergea sobre la general, por lo que es consistente y simple.
        await saveConfig(clinicId, {
          ...config,
          recetasPorMedico: { ...(config.recetasPorMedico ?? {}), [medicoSel]: rx },
        })
        const dr = doctores.find(d => d.id === medicoSel)
        toast(`Plantilla de ${dr?.nombre ?? 'médico'} guardada`, 'success')
      }
    } catch (e) {
      // Mostrar la causa real — un "Error al guardar" mudo es indepurable
      const msg = e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120)
      toast(`Error al guardar: ${msg}`, 'error')
      console.error('[recetas/guardar]', e)
    } finally {
      setSaving(false)
    }
  }

  const subirImagen = async (campo: 'membreteDataUrl' | 'pieDataUrl', file: File) => {
    try {
      const { dataUrl, sizeBytes } = await resizeImageFile(file, {
        maxWidth: campo === 'membreteDataUrl' ? 1400 : 1200,
        maxHeight: campo === 'membreteDataUrl' ? 600 : 250,
        quality: 0.85,
      })
      if (sizeBytes > 800_000) {
        toast(`Imagen muy grande (${formatBytes(sizeBytes)}). Intenta con una más chica o menos detallada.`, 'error')
        return
      }
      setRx({ ...rx, [campo]: dataUrl })
      toast(`Imagen cargada (${formatBytes(sizeBytes)})`, 'success')
    } catch (e) {
      toast(`No se pudo procesar: ${(e as Error).message}`, 'error')
    }
  }

  /**
   * Sube el diseño COMPLETO de la receta del médico (su propio papel).
   * Acepta PDF (renderiza primera página) o imagen. Se resizea para que quepa
   * cómodo en Firestore (<800KB).
   */
  const [subiendoDiseno, setSubiendoDiseno] = useState(false)
  const [progresoDiseno, setProgresoDiseno] = useState('')

  /**
   * Sube el diseño completo del médico — PDF o imagen.
   * Estrategia de CALIDAD:
   *  1. PDFs se renderizan a 240 DPI como PNG (texto y líneas perfectas, sin JPEG artifacts).
   *  2. Si pesa más de 900KB (límite Firestore), reintenta a 200 DPI, luego 160 DPI.
   *  3. Si AÚN pesa mucho, cae a JPEG q92 — última opción para no perder demasiado.
   *  4. Las imágenes se redimensionan a max 2200px ancho (más generoso que antes), q95.
   *  5. Detecta dimensiones del PDF en mm → auto-selecciona el paperSize que coincide
   *     → CERO distorsión por aspect ratio mismatch.
   */
  const subirDisenoCompleto = async (file: File) => {
    setSubiendoDiseno(true)
    setProgresoDiseno('Iniciando…')
    try {
      let dataUrl: string
      let sizeBytes: number
      let widthMm: number | null = null
      let heightMm: number | null = null

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const { pdfFileToImageDataUrl } = await import('@/lib/pdf-to-image')

        // Intento 1: PNG 240 DPI (máxima calidad)
        let result = await pdfFileToImageDataUrl(file, {
          dpi: 240, quality: 0.95, type: 'image/png',
          onProgress: setProgresoDiseno, timeoutMs: 60_000,
        })
        // Si pesa demasiado: PNG 200 DPI
        if (result.sizeBytes > 900_000) {
          setProgresoDiseno('Reduciendo tamaño (200 DPI)…')
          result = await pdfFileToImageDataUrl(file, {
            dpi: 200, quality: 0.95, type: 'image/png',
            onProgress: setProgresoDiseno, timeoutMs: 60_000,
          })
        }
        // Si aún pesa: PNG 160 DPI
        if (result.sizeBytes > 900_000) {
          setProgresoDiseno('Reduciendo tamaño (160 DPI)…')
          result = await pdfFileToImageDataUrl(file, {
            dpi: 160, quality: 0.95, type: 'image/png',
            onProgress: setProgresoDiseno, timeoutMs: 60_000,
          })
        }
        // Último recurso: JPEG alta calidad
        if (result.sizeBytes > 900_000) {
          setProgresoDiseno('Optimizando (JPEG alta calidad)…')
          result = await pdfFileToImageDataUrl(file, {
            dpi: 200, quality: 0.92, type: 'image/jpeg',
            onProgress: setProgresoDiseno, timeoutMs: 60_000,
          })
        }
        dataUrl = result.dataUrl
        sizeBytes = result.sizeBytes
        widthMm = result.widthMm
        heightMm = result.heightMm
      } else if (file.type.startsWith('image/')) {
        setProgresoDiseno('Optimizando imagen…')
        // Mucho mejor que antes: 2200px de ancho máx, q95
        const result = await resizeImageFile(file, {
          maxWidth: 2200, maxHeight: 3200, quality: 0.95,
          type: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        })
        dataUrl = result.dataUrl
        sizeBytes = result.sizeBytes
        // Aproximamos el tamaño mm asumiendo 96 DPI (escaneados típicos)
        widthMm = (result.width * 25.4) / 96
        heightMm = (result.height * 25.4) / 96
      } else {
        toast('Sube un PDF o una imagen (PNG/JPG)', 'error')
        return
      }

      if (sizeBytes > 900_000) {
        toast(`Aún muy pesado (${formatBytes(sizeBytes)}). Sube como JPG en menor resolución.`, 'error')
        return
      }

      // Auto-detectar tamaño de papel para evitar distorsión por aspect ratio
      let nuevoPaperSize = rx.paperSize
      let auto = false
      if (widthMm && heightMm) {
        const detectado = detectarPaperSize(widthMm, heightMm)
        if (detectado && detectado !== rx.paperSize) {
          nuevoPaperSize = detectado
          auto = true
        }
      }

      setRx({ ...rx, disenoCompletoDataUrl: dataUrl, paperSize: nuevoPaperSize })
      if (auto) {
        toast(`Diseño cargado (${formatBytes(sizeBytes)}) · papel ajustado a ${PAPER_SIZES[nuevoPaperSize].label}`, 'success')
      } else {
        toast(`Diseño cargado (${formatBytes(sizeBytes)})`, 'success')
      }
    } catch (e) {
      console.error('[disenoCompleto] error:', e)
      toast(`No se pudo procesar: ${(e as Error).message}`, 'error')
    } finally {
      setSubiendoDiseno(false)
      setProgresoDiseno('')
    }
  }

  if (!clinicId) return <div style={{ color: 'var(--text3)' }}>Cargando…</div>

  return (
    <div className="recetas-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 20, alignItems: 'start' }}>
      {/* Editor */}
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>

        {/* PLANTILLA POR MÉDICO — cada quien tiene su propio papel impreso */}
        {doctores.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--border2)', borderRadius: 10,
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)' }}>Editando plantilla de:</span>
            <select
              value={medicoSel}
              onChange={(e) => setMedicoSel(e.target.value)}
              style={{ ...cfgInput, width: 'auto', minWidth: 220 }}
            >
              <option value="">🏥 General (toda la clínica)</option>
              {doctores.map(d => (
                <option key={d.id} value={d.id}>👨‍⚕️ {d.nombre}{config?.recetasPorMedico?.[d.id] ? ' · personalizada ✓' : ''}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text3)', flexBasis: '100%' }}>
              {medicoSel
                ? 'Los cambios solo aplican a las recetas/órdenes de este médico. Lo no definido cae a la plantilla general.'
                : 'Esta plantilla aplica a todos los médicos que no tengan una propia.'}
            </span>
          </div>
        )}

        {/* MODO TU PROPIO DISEÑO — primera sección, destacada */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(20,184,166,0.10), rgba(167,139,250,0.10))',
          border: '1px solid rgba(20,184,166,0.4)', borderRadius: 12, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                ⭐ Usa TU propia receta
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>
                Sube tu diseño actual (PDF o imagen). Lo usamos como fondo y solo
                sobreponemos los datos del paciente, Rx, indicaciones y firma.
              </div>
            </div>
            {rx.disenoCompletoDataUrl && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: '4px 10px',
                background: 'var(--teal)', color: '#000', borderRadius: 100,
              }}>
                ACTIVO
              </span>
            )}
          </div>

          {rx.disenoCompletoDataUrl ? (
            <div style={{ position: 'relative', background: '#fff', borderRadius: 8, padding: 8, border: '1px solid var(--border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={rx.disenoCompletoDataUrl}
                alt="Diseño de receta"
                style={{ width: '100%', maxHeight: 240, objectFit: 'contain', display: 'block' }}
              />
              <button
                onClick={() => setRx(prev => {
                  // delete (no undefined): Firestore rechaza valores undefined
                  const limpio = { ...prev }
                  delete limpio.disenoCompletoDataUrl
                  return limpio
                })}
                style={{
                  position: 'absolute', top: 12, right: 12,
                  background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <IconX size={11} /> Quitar diseño
              </button>
            </div>
          ) : (
            <label style={{
              display: 'block', textAlign: 'center', padding: '26px 14px',
              border: '2px dashed rgba(20,184,166,0.5)', borderRadius: 10,
              background: 'rgba(20,184,166,0.06)', cursor: subiendoDiseno ? 'wait' : 'pointer',
              color: 'var(--text2)',
            }}>
              {subiendoDiseno ? (
                <>
                  <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', marginBottom: 6 }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{progresoDiseno || 'Procesando…'}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6 }}>
                    La primera vez puede tardar 5-15 seg (descarga la librería PDF).
                    Si pasa de 1 minuto, intenta subir tu PDF como imagen PNG.
                  </div>
                </>
              ) : (
                <>
                  <Upload size={22} style={{ marginBottom: 6, color: 'var(--teal)' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Sube tu receta</div>
                  <div style={{ fontSize: 11.5, marginTop: 4 }}>PDF o imagen PNG/JPG · Recomendado: tu receta en blanco con logo y datos</div>
                </>
              )}
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                disabled={subiendoDiseno}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDisenoCompleto(f) }}
                style={{ display: 'none' }}
              />
            </label>
          )}

          {/* Calibración de márgenes — solo cuando hay diseño */}
          {rx.disenoCompletoDataUrl && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                📐 Calibrar área de contenido (mm)
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                Define dónde caen los datos del paciente y la receta. Mira la vista previa →
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <MargenInput label="Arriba" value={rx.disenoMargenes?.top ?? 35} onChange={(v) => setRx({ ...rx, disenoMargenes: { ...defaultMargenes(rx), top: v } })} />
                <MargenInput label="Abajo" value={rx.disenoMargenes?.bottom ?? 30} onChange={(v) => setRx({ ...rx, disenoMargenes: { ...defaultMargenes(rx), bottom: v } })} />
                <MargenInput label="Izquierda" value={rx.disenoMargenes?.left ?? 12} onChange={(v) => setRx({ ...rx, disenoMargenes: { ...defaultMargenes(rx), left: v } })} />
                <MargenInput label="Derecha" value={rx.disenoMargenes?.right ?? 12} onChange={(v) => setRx({ ...rx, disenoMargenes: { ...defaultMargenes(rx), right: v } })} />
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={cfgLabel}>Tamaño de letra del contenido (px)</label>
                <input
                  type="range" min={8} max={16} step={0.5}
                  value={rx.disenoFontSize ?? 11}
                  onChange={(e) => setRx({ ...rx, disenoFontSize: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{rx.disenoFontSize ?? 11}px</div>
              </div>

              {/* Toggle "Solo Rx" — para diseños que ya tienen campos pre-impresos */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, marginTop: 12,
                padding: 10, background: 'rgba(20,184,166,0.06)', borderRadius: 6,
                border: '1px solid rgba(20,184,166,0.25)', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={rx.disenoSoloRx === true}
                  onChange={(e) => setRx({ ...rx, disenoSoloRx: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: 'var(--teal)' }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    Mi diseño ya tiene campos del paciente impresos
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.4 }}>
                    Si tu receta tiene líneas pre-impresas para Nombre, Edad, Fecha, etc.,
                    activa esto. Solo se sobreponen los medicamentos / estudios en la zona libre.
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Tamaño de papel */}
        <Section title="Tamaño de papel">
          <select
            value={rx.paperSize}
            onChange={(e) => setRx({ ...rx, paperSize: e.target.value as PaperSizeT })}
            style={cfgInput}
          >
            {(Object.keys(PAPER_SIZES) as PaperSizeT[]).map(k => (
              <option key={k} value={k}>{PAPER_SIZES[k].label}</option>
            ))}
          </select>
        </Section>

        {/* Dónde se imprime físicamente — resuelve "no se imprime en formato receta" */}
        {rx.paperSize !== 'carta' && rx.paperSize !== 'oficio' && (
          <Section title="🖨️ ¿En qué papel imprime tu impresora?">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                { valor: 'carta' as const, titulo: 'Hoja carta + corte ✂ (recomendado)', desc: 'Funciona con CUALQUIER impresora. La receta sale arriba de la hoja carta con línea punteada para recortar.' },
                { valor: 'papel-real' as const, titulo: 'Papel de receta exacto', desc: `Solo si tu impresora tiene cargado papel ${PAPER_SIZES[rx.paperSize].label.split(' (')[0].toLowerCase()}. Ojo: el diálogo de impresión debe ofrecer ese tamaño.` },
              ]).map(op => {
                const activo = (rx.imprimirEn ?? 'carta') === op.valor
                return (
                  <button
                    key={op.valor}
                    onClick={() => setRx({ ...rx, imprimirEn: op.valor })}
                    style={{
                      padding: 12, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      background: activo ? 'rgba(20,184,166,0.1)' : 'var(--s2)',
                      border: activo ? '1px solid var(--teal)' : '1px solid var(--border)',
                      color: activo ? 'var(--teal)' : 'var(--text2)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{op.titulo}</div>
                    <div style={{ fontSize: 10.5, marginTop: 3, lineHeight: 1.35 }}>{op.desc}</div>
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {/* Estilo visual */}
        <Section title="Estilo visual">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(Object.keys(ESTILOS_RECETA) as EstiloT[]).map(k => {
              const activo = rx.estilo === k
              return (
                <button
                  key={k}
                  onClick={() => setRx({ ...rx, estilo: k })}
                  style={{
                    padding: 12, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: activo ? 'rgba(20,184,166,0.1)' : 'var(--s2)',
                    border: activo ? '1px solid var(--teal)' : '1px solid var(--border)',
                    color: activo ? 'var(--teal)' : 'var(--text2)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{ESTILOS_RECETA[k].label}</div>
                  <div style={{ fontSize: 10.5, marginTop: 3, lineHeight: 1.3 }}>{ESTILOS_RECETA[k].descripcion}</div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* Color de acento */}
        <Section title="Color de acento (líneas, encabezado)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color"
              value={rx.colorAccento ?? '#14b8a6'}
              onChange={(e) => setRx({ ...rx, colorAccento: e.target.value })}
              style={{ width: 50, height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'var(--s2)' }}
            />
            <input
              value={rx.colorAccento ?? '#14b8a6'}
              onChange={(e) => setRx({ ...rx, colorAccento: e.target.value })}
              style={{ ...cfgInput, width: 110, fontFamily: 'monospace' }}
            />
          </div>
        </Section>

        {/* Membrete */}
        <Section title="📄 Membrete (encabezado custom)">
          <p style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8 }}>
            Sube una imagen del encabezado de tu papel membretado (logo, nombre, datos del consultorio).
            Si no subes nada, se usa un encabezado generado con los datos de tu clínica.
          </p>
          {rx.membreteDataUrl ? (
            <div style={{ position: 'relative', border: '1px dashed var(--border)', borderRadius: 8, padding: 10, background: 'var(--s2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={rx.membreteDataUrl} alt="Membrete" style={{ maxWidth: '100%', maxHeight: 120, display: 'block', margin: '0 auto', background: '#fff' }} />
              <button
                onClick={() => setRx({ ...rx, membreteDataUrl: undefined })}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
              >
                <IconX size={11} /> Quitar
              </button>
            </div>
          ) : (
            <label style={{
              display: 'block', textAlign: 'center', padding: '20px 12px',
              border: '2px dashed var(--border)', borderRadius: 8, background: 'var(--s2)',
              cursor: 'pointer', color: 'var(--text3)',
            }}>
              <Upload size={20} style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Subir membrete</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>PNG o JPG · Máx 800 KB después de optimizar</div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagen('membreteDataUrl', f) }}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </Section>

        {/* Pie de página */}
        <Section title="📑 Pie de página (opcional)">
          {rx.pieDataUrl ? (
            <div style={{ position: 'relative', border: '1px dashed var(--border)', borderRadius: 8, padding: 10, background: 'var(--s2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={rx.pieDataUrl} alt="Pie" style={{ maxWidth: '100%', maxHeight: 60, display: 'block', margin: '0 auto', background: '#fff' }} />
              <button
                onClick={() => setRx({ ...rx, pieDataUrl: undefined })}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '3px 6px', fontSize: 11, cursor: 'pointer' }}
              >
                <IconX size={11} /> Quitar
              </button>
            </div>
          ) : (
            <label style={{
              display: 'block', textAlign: 'center', padding: '14px 12px',
              border: '2px dashed var(--border)', borderRadius: 8, background: 'var(--s2)',
              cursor: 'pointer', color: 'var(--text3)',
            }}>
              <Upload size={16} />
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Subir pie de página</div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagen('pieDataUrl', f) }}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </Section>

        {/* Opciones */}
        <Section title="Opciones">
          <div style={{ display: 'grid', gap: 8 }}>
            <Toggle label="Mostrar caja de alergias" checked={rx.mostrarAlergias !== false} onChange={(v) => setRx({ ...rx, mostrarAlergias: v })} />
            <Toggle label="Mostrar diagnóstico" checked={rx.mostrarDiagnostico !== false} onChange={(v) => setRx({ ...rx, mostrarDiagnostico: v })} />
            <Toggle label="Mostrar signos vitales (en órdenes)" checked={rx.mostrarSignosVitales === true} onChange={(v) => setRx({ ...rx, mostrarSignosVitales: v })} />
            <Toggle label="QR de verificación al pie" checked={rx.mostrarQR !== false} onChange={(v) => setRx({ ...rx, mostrarQR: v })} />
          </div>
        </Section>

        <Section title="Datos legales adicionales (opcional)">
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <label style={cfgLabel}>RFC</label>
              <input value={rx.rfc ?? ''} onChange={(e) => setRx({ ...rx, rfc: e.target.value })} style={cfgInput} placeholder="RODR890101ABC" />
            </div>
            <div>
              <label style={cfgLabel}>Registro DGP/SSA (psicotrópicos)</label>
              <input value={rx.registroDGP ?? ''} onChange={(e) => setRx({ ...rx, registroDGP: e.target.value })} style={cfgInput} placeholder="Para Rx de medicamentos controlados" />
            </div>
            <div>
              <label style={cfgLabel}>Vigencia default (días)</label>
              <input type="number" value={rx.vigenciaDias ?? 30} onChange={(e) => setRx({ ...rx, vigenciaDias: parseInt(e.target.value) || 30 })} style={cfgInput} min={1} max={365} />
            </div>
            <div>
              <label style={cfgLabel}>Aviso legal al pie</label>
              <textarea value={rx.avisoLegal ?? ''} onChange={(e) => setRx({ ...rx, avisoLegal: e.target.value.slice(0, 240) })} rows={2} style={{ ...cfgInput, resize: 'vertical' }} />
            </div>
          </div>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={guardar} disabled={saving} className="btn btn-primary">
            {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : <><Save size={14} /> Guardar template</>}
          </button>
        </div>
      </div>

      {/* Preview en vivo — contenedor de ancho fijo, escala dinámica */}
      <PreviewReceta tipoPreview={tipoPreview} setTipoPreview={setTipoPreview} rx={rx} config={config} />

      {/* CSS responsive — colapsa preview en pantallas pequeñas */}
      <style>{`
        @media (max-width: 1000px) {
          .recetas-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

/**
 * Preview con escala dinámica que SIEMPRE cabe en su contenedor (ancho fijo 360px).
 * Calcula la escala según el tamaño de papel para que la receta se vea proporcional
 * sin desbordar el layout — independientemente de si eliges media-carta u oficio.
 *
 * También dibuja una GUÍA VISUAL (rectángulo translúcido cian) sobre el diseño
 * custom mostrando dónde caen los datos. Así el médico calibra sin adivinar.
 */
function PreviewReceta({
  tipoPreview, setTipoPreview, rx, config,
}: {
  tipoPreview: 'receta' | 'orden'
  setTipoPreview: (t: 'receta' | 'orden') => void
  rx: RecetaConfig
  config: ClinicConfig | null
}) {
  const paper = PAPER_SIZES[rx.paperSize ?? 'media-carta']
  // 96 DPI estándar web: 1mm ≈ 3.78 px
  const paperWidthPx = (paper.widthMm * 96) / 25.4
  const paperHeightPx = (paper.heightMm * 96) / 25.4
  // Ancho objetivo del contenedor sticky en el lado derecho
  const TARGET_WIDTH = 340
  const TARGET_MAX_HEIGHT = 520
  const scaleByWidth = TARGET_WIDTH / paperWidthPx
  const scaleByHeight = TARGET_MAX_HEIGHT / paperHeightPx
  const scale = Math.min(scaleByWidth, scaleByHeight, 1)
  const containerWidth = paperWidthPx * scale
  const containerHeight = paperHeightPx * scale

  const margenes = rx.disenoMargenes ?? { top: 35, right: 12, bottom: 30, left: 12 }
  const usarGuia = !!rx.disenoCompletoDataUrl

  return (
    <div style={{ position: 'sticky', top: 20 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 8 }}>
        Vista previa · {paper.label.split(' ')[0]}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
        <button
          onClick={() => setTipoPreview('receta')}
          style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: tipoPreview === 'receta' ? 'rgba(20,184,166,0.15)' : 'var(--s2)',
            border: tipoPreview === 'receta' ? '1px solid var(--teal)' : '1px solid var(--border)',
            color: tipoPreview === 'receta' ? 'var(--teal)' : 'var(--text3)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <Pill size={12} /> Receta
        </button>
        <button
          onClick={() => setTipoPreview('orden')}
          style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: tipoPreview === 'orden' ? 'rgba(167,139,250,0.15)' : 'var(--s2)',
            border: tipoPreview === 'orden' ? '1px solid #a78bfa' : '1px solid var(--border)',
            color: tipoPreview === 'orden' ? '#a78bfa' : 'var(--text3)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <ClipboardList size={12} /> Orden
        </button>
      </div>

      {/* Contenedor que limita el tamaño visible y reserva espacio scaled */}
      <div style={{
        width: containerWidth,
        height: containerHeight,
        margin: '0 auto',
        overflow: 'hidden',
        position: 'relative',
        background: '#1a2333',
        borderRadius: 6,
      }}>
        <div style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: paperWidthPx,
          height: paperHeightPx,
          position: 'relative',
        }}>
          <RecetaDocumento
            data={{
              tipo: tipoPreview,
              folio: 'RX-DEMO-01',
              fecha: new Date(),
              paciente: { id: 'demo', nombre: 'Juan Pérez García', edad: 42, sexo: 'Masculino', telefono: '614 123 4567', alergias: 'Penicilina', noShowCount: 0, cancelacionCount: 0, createdAt: '', updatedAt: '', creadoPor: '' } as Patient,
              diagnostico: 'Faringitis aguda (J02.9)',
              medicamentos: tipoPreview === 'receta' ? [
                { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'Cada 8 horas', duracion: '7 días', indicacion: 'Tomar con alimentos' },
                { nombre: 'Paracetamol', dosis: '500 mg', via: 'oral', frecuencia: 'Cada 6 hrs si dolor o fiebre', duracion: '5 días' },
              ] : undefined,
              estudios: tipoPreview === 'orden' ? ['Biometría hemática completa', 'PCR cuantitativa', 'Cultivo faríngeo'] : undefined,
              indicaciones: 'Reposo relativo, hidratación abundante. Acudir a control en 5 días.',
              notaParaPaciente: 'Si presenta fiebre >39°C, acudir a urgencias.',
            }}
            config={config ?? null}
            recetaConfig={rx}
          />
          {/* GUÍA VISUAL: rectángulo cian translúcido sobre la zona de contenido
              cuando se usa diseño custom. Le muestra al médico DÓNDE caen los datos. */}
          {usarGuia && (
            <div style={{
              position: 'absolute',
              top: `${margenes.top}mm`,
              right: `${margenes.right}mm`,
              bottom: `${margenes.bottom}mm`,
              left: `${margenes.left}mm`,
              border: '2px dashed #14b8a6',
              background: 'rgba(20,184,166,0.08)',
              pointerEvents: 'none',
              borderRadius: 2,
            }}>
              <div style={{
                position: 'absolute', top: -22, left: 0,
                background: '#14b8a6', color: '#000',
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              }}>
                ↓ Zona de contenido
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nota informativa sobre la guía */}
      {usarGuia && (
        <div style={{
          fontSize: 10.5, color: 'var(--text3)', marginTop: 8, textAlign: 'center', lineHeight: 1.4,
        }}>
          🔵 El recuadro cian muestra dónde caen los datos.<br />
          Ajusta los márgenes hasta que NO se sobreponga al diseño impreso.
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--teal)', cursor: 'pointer' }} />
    </label>
  )
}

const cfgInput: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}
const cfgLabel: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', marginBottom: 3,
}

function defaultMargenes(rx: RecetaConfig) {
  return rx.disenoMargenes ?? { top: 35, right: 12, bottom: 30, left: 12 }
}

/* ── Seguridad Tab (2FA) ─────────────────────────────────────── */

import { iniciarEnrolamientoTotp, completarEnrolamientoTotp, listarFactores, desactivarFactor } from '@/lib/mfa'
import type { TotpSecret } from 'firebase/auth'

function SeguridadTab() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [factores, setFactores] = useState<{ uid: string; displayName?: string | null; enrollmentTime?: string; factorId?: string }[]>([])
  const [paso, setPaso] = useState<'idle' | 'enrolando' | 'verificando'>('idle')
  const [secret, setSecret] = useState<TotpSecret | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [codigo, setCodigo] = useState('')
  const [aliasNuevo, setAliasNuevo] = useState('Llave principal')

  useEffect(() => { setFactores(listarFactores(user)) }, [user])

  const iniciar = async () => {
    setPaso('enrolando')
    try {
      const r = await iniciarEnrolamientoTotp('Agenda Médica')
      setSecret(r.secret)
      setQrUrl(r.qrCodeUrl)
      setManualKey(r.manualKey)
      setPaso('verificando')
    } catch (e) {
      const msg = (e as Error).message
      toast(msg.includes('multi-factor') ? 'Tu proyecto Firebase no tiene Identity Platform habilitado. Activalo en Firebase Console → Authentication.' : msg, 'error')
      setPaso('idle')
    }
  }

  const verificar = async () => {
    if (!secret) return
    try {
      await completarEnrolamientoTotp(secret, codigo.trim(), aliasNuevo || 'Llave TOTP')
      toast('2FA activado ✅', 'success')
      setFactores(listarFactores(user))
      setPaso('idle')
      setSecret(null)
      setCodigo('')
    } catch (e) {
      toast(`Código inválido: ${(e as Error).message}`, 'error')
    }
  }

  const remover = async (uid: string) => {
    if (!confirm('¿Quitar este factor 2FA?')) return
    try {
      await desactivarFactor(uid)
      toast('Factor eliminado', 'success')
      setFactores(listarFactores(user))
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'error')
    }
  }

  return (
    <div style={{ maxWidth: 600, display: 'grid', gap: 16 }}>
      <div style={{ padding: 16, background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>🔐</span>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Autenticación de dos factores (2FA)</div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.55 }}>
          Mejora la protección de tu expediente clínico. Después de tu contraseña, te pediremos
          un código de 6 dígitos generado por una app como Google Authenticator, Authy o 1Password.
          Recomendado por <strong>LFPDPPP Art. 19</strong> (medidas de seguridad razonables).
        </div>
      </div>

      {/* Factores actuales */}
      <div style={{ padding: 16, background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
          Factores activos ({factores.length})
        </div>
        {factores.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: 10, background: 'var(--s2)', borderRadius: 6, textAlign: 'center' }}>
            Aún no tienes 2FA configurado.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {factores.map(f => (
              <div key={f.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: 'var(--s2)', borderRadius: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{f.displayName || 'Llave sin nombre'}</div>
                  {f.enrollmentTime && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Agregada {new Date(f.enrollmentTime).toLocaleDateString('es-MX')}</div>}
                </div>
                <button onClick={() => remover(f.uid)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer' }}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activar nuevo */}
      {paso === 'idle' && (
        <button onClick={iniciar} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          🔑 Activar 2FA con app autenticadora
        </button>
      )}

      {paso === 'verificando' && (
        <div style={{ padding: 16, background: 'var(--s)', border: '1px solid var(--teal)', borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
            Paso 1: Escanea el QR con tu app
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}&size=200x200&margin=4`}
              alt="QR TOTP"
              style={{ width: 200, height: 200, background: '#fff', padding: 8, borderRadius: 6 }}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginBottom: 4 }}>O pega esta clave manualmente:</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, textAlign: 'center', padding: '6px 10px', background: 'var(--s2)', borderRadius: 6, marginBottom: 14, userSelect: 'all', wordBreak: 'break-all' }}>
            {manualKey}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Paso 2: Ingresa el código de 6 dígitos que muestra tu app
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              style={{ ...cfgInput, fontFamily: 'monospace', fontSize: 18, textAlign: 'center', letterSpacing: 4 }}
            />
            <input
              value={aliasNuevo}
              onChange={(e) => setAliasNuevo(e.target.value)}
              placeholder='Nombre para esta llave (ej "iPhone")'
              style={cfgInput}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setPaso('idle'); setSecret(null); setCodigo('') }} className="btn btn-secondary">Cancelar</button>
              <button onClick={verificar} disabled={codigo.length !== 6} className="btn btn-primary">
                Verificar y activar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MargenInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 2 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number" min={0} max={100} step={1}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: '100%', padding: '4px 6px', borderRadius: 4,
            border: '1px solid var(--border)', background: 'var(--s2)',
            color: 'var(--text)', fontSize: 12,
          }}
        />
        <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>mm</span>
      </div>
    </div>
  )
}

/**
 * Sección para subir la firma + sello del médico.
 *
 * Se renderiza después automáticamente en:
 *  - Notas firmadas (vista imprimible)
 *  - Recetas (modo template y modo diseño custom)
 *  - Órdenes médicas
 *
 * Recomendado: PNG con FONDO TRANSPARENTE para que se vea bien sobre cualquier papel.
 * Si el médico sube un JPG, le agregamos fondo blanco igualmente.
 */
function FirmaUploadSection({ firmaDataUrl, onChange }: { firmaDataUrl?: string; onChange: (dataUrl: string | undefined) => void }) {
  const { toast } = useToast()
  const [procesando, setProcesando] = useState(false)

  const subir = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Sube una imagen PNG o JPG', 'error')
      return
    }
    setProcesando(true)
    try {
      // Para firma, preferimos PNG (preserva transparencia)
      // Si el archivo original es PNG, lo mantenemos como PNG; si es JPG, redimensionamos
      const esPNG = file.type === 'image/png'
      const { dataUrl, sizeBytes } = await resizeImageFile(file, {
        maxWidth: 800,
        maxHeight: 400,
        quality: 0.9,
        type: esPNG ? 'image/png' : 'image/jpeg',
      })
      if (sizeBytes > 400_000) {
        toast(`Imagen muy pesada (${formatBytes(sizeBytes)}). Sube una versión más pequeña.`, 'error')
        return
      }
      onChange(dataUrl)
      toast(`Firma cargada (${formatBytes(sizeBytes)})`, 'success')
    } catch (e) {
      toast(`No se pudo procesar: ${(e as Error).message}`, 'error')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(20,184,166,0.06), rgba(20,184,166,0.02))',
      border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginTop: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>🖋️</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Firma + sello (imagen)</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
            Aparece automáticamente sobre la línea de firma en <strong>notas firmadas, recetas y órdenes médicas</strong>.
          </div>
        </div>
      </div>

      {firmaDataUrl ? (
        <div style={{ position: 'relative', background: '#fff', borderRadius: 8, padding: 14, border: '1px solid var(--border)', textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={firmaDataUrl}
            alt="Firma del médico"
            style={{ maxWidth: '100%', maxHeight: 120, display: 'block', margin: '0 auto' }}
          />
          <button
            onClick={() => onChange(undefined)}
            style={{
              position: 'absolute', top: 8, right: 8,
              background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <IconX size={11} /> Quitar
          </button>
        </div>
      ) : (
        <label style={{
          display: 'block', textAlign: 'center', padding: '20px 14px',
          border: '2px dashed rgba(20,184,166,0.4)', borderRadius: 10,
          background: 'rgba(20,184,166,0.04)', cursor: procesando ? 'wait' : 'pointer',
          color: 'var(--text2)',
        }}>
          {procesando ? (
            <>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 6 }} />
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Procesando…</div>
            </>
          ) : (
            <>
              <Upload size={20} style={{ marginBottom: 6, color: 'var(--teal)' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Sube tu firma + sello</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                PNG (recomendado, fondo transparente) o JPG · Máx 400 KB
              </div>
            </>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={procesando}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f) }}
            style={{ display: 'none' }}
          />
        </label>
      )}

      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 8, padding: '6px 10px', background: 'rgba(255,200,0,0.05)', borderLeft: '2px solid #f59e0b', borderRadius: 3 }}>
        💡 Tip: Escanea tu firma en una hoja blanca con tu sello al lado, recórtalo en blanco y súbelo como PNG con fondo transparente. Mide unos 6 × 3 cm en la vida real.
      </div>
    </div>
  )
}

/* ── Miembros activos del equipo ─────────────────────────────── */

import { listarMiembros, removerMiembro, cambiarRolMiembro, type MiembroActivo } from '@/lib/miembros'

function MiembrosActivos({ clinicId, miUid }: { clinicId: string | null; miUid?: string }) {
  const { toast } = useToast()
  const [miembros, setMiembros] = useState<MiembroActivo[]>([])
  const [cargando, setCargando] = useState(true)

  const recargar = async () => {
    if (!clinicId) return
    setCargando(true)
    try {
      const list = await listarMiembros(clinicId)
      setMiembros(list)
    } catch (e) {
      console.error('[miembros]', e)
    } finally { setCargando(false) }
  }
  useEffect(() => { recargar() /* eslint-disable-next-line */ }, [clinicId])

  const remover = async (m: MiembroActivo) => {
    if (m.uid === miUid) { toast('No puedes removerte a ti misma/o', 'error'); return }
    if (!window.confirm(`¿Remover a ${m.email} del equipo? Perderá acceso inmediatamente.`)) return
    try {
      await removerMiembro(m.uid)
      toast('Miembro removido', 'info')
      recargar()
    } catch {
      toast('Error al remover (revisa que seas admin)', 'error')
    }
  }

  const cambiarRol = async (m: MiembroActivo, nuevo: 'admin' | 'medico' | 'secretaria') => {
    if (m.role === nuevo) return
    try {
      await cambiarRolMiembro(m.uid, nuevo)
      toast(`Rol actualizado a ${nuevo}`, 'success')
      recargar()
    } catch {
      toast('Error al cambiar rol', 'error')
    }
  }

  const ROL_LABEL: Record<string, string> = { admin: '👑 Admin', medico: '👨‍⚕️ Médico', secretaria: '👩‍💼 Asistente' }
  const ROL_COLOR: Record<string, string> = { admin: '#f59e0b', medico: '#14b8a6', secretaria: '#a78bfa' }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          Equipo activo {miembros.length > 0 && `(${miembros.length})`}
        </div>
        <button onClick={recargar} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11.5, cursor: 'pointer' }}>
          ↻ Actualizar
        </button>
      </div>
      {cargando ? (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: 8 }}>Cargando…</div>
      ) : miembros.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: 10 }}>
          Sin miembros aún. Genera tu primera invitación abajo.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {miembros.map(m => (
            <div key={m.uid} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', background: 'var(--s2)', borderRadius: 8,
              border: m.uid === miUid ? '1px solid rgba(20,184,166,0.4)' : '1px solid var(--border)',
            }}>
              {/* Avatar inicial */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: ROL_COLOR[m.role] ?? '#9ca3af', color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12, flexShrink: 0,
              }}>
                {(m.email ?? '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                  {m.uid === miUid && <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--teal)', fontWeight: 700 }}>(TÚ)</span>}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }}>
                  Miembro desde {m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </div>
              </div>
              {/* Selector de rol — deshabilitado si soy yo */}
              <select
                value={m.role}
                onChange={(e) => cambiarRol(m, e.target.value as 'admin' | 'medico' | 'secretaria')}
                disabled={m.uid === miUid}
                style={{
                  padding: '5px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                  background: 'var(--s)', color: ROL_COLOR[m.role] ?? 'var(--text)',
                  border: `1px solid ${ROL_COLOR[m.role] ?? 'var(--border)'}55`,
                  cursor: m.uid === miUid ? 'not-allowed' : 'pointer',
                  opacity: m.uid === miUid ? 0.6 : 1,
                }}
              >
                <option value="admin">{ROL_LABEL.admin}</option>
                <option value="medico">{ROL_LABEL.medico}</option>
                <option value="secretaria">{ROL_LABEL.secretaria}</option>
              </select>
              {m.uid !== miUid && (
                <button
                  onClick={() => remover(m)}
                  title="Quitar del equipo"
                  style={{
                    background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6,
                    padding: '5px 8px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Quitar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
