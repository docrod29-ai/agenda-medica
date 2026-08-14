'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ClinicConfig, DEFAULT_CONFIG, AppointmentType, APPOINTMENT_TYPE_CONFIG } from '@/types'
import { saveConfig, saveConfigPartial, updateDoctor } from '@/lib/firestore'
import { subirImagen as subirImagenServidor } from '@/lib/subir-imagen'
import { EntregasWhatsAppTab, PerfilPublicoSection, PlantillasHsmSection } from './secciones-comunicacion'
import { SeguridadTab } from './secciones-seguridad'
import { cfgInput, cfgLabel } from './estilos'
import { RecetasTab } from './secciones-recetas'
import { LlavesIASection, FirmaUploadSection, MembreteNotaSection, MiembrosActivos } from './secciones-cuenta'
import { PLANES, PLANES_ORDEN, precioTexto } from '@/lib/planes-ia'
import { ESPECIALIDADES_CLINICAS, ESPECIALIDADES_QUIRURGICAS, ESPECIALIDADES_DIAGNOSTICAS, OTROS_PROFESIONALES } from '@/lib/especialidades'
import { X as IconX } from 'lucide-react'
import { fetchAutenticado } from '@/lib/auth-client'
import { useConfig } from '@/hooks/useConfig'
import { descansosEnMinutos, pisaDescanso } from '@/lib/availability'
import { instanteMX } from '@/lib/timezone'

/** Si el consultorio no declaró zona, la misma que usa el resto del producto. */
const TZ_CONSULTORIO_DEFECTO = 'America/Mexico_City'
import { AvisoConfigNoCargada } from '@/components/AvisoConfigNoCargada'
import { useDoctors } from '@/hooks/useDoctors'
import { useToast } from '@/context/ToastContext'
import { useClinic } from '@/context/ClinicContext'
import { auth, storage } from '@/lib/firebase'
import { Loader2, Save, Copy, Calendar, CheckCircle2, XCircle, Link, Bot, CreditCard, ExternalLink, MessageCircle, Smartphone, AlertTriangle, UserRound, QrCode, Code, Lightbulb, Star, Ruler, KeyRound, Lock, PenLine, Sparkles, ShieldCheck, BedDouble, Trash2 } from 'lucide-react'
import { TipoCitaIcon } from '@/components/TipoCitaIcon'
import { msgConfirmacion, msgRecordatorio24h, msgRecordatorioDia } from '@/lib/whatsapp'
import { copyToClipboard } from '@/lib/whatsapp'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { esSuperadminCliente } from '@/lib/superadmin-client'
import FacturacionSection from '@/components/FacturacionSection'
import AsientosSection from '@/components/AsientosSection'
import SoporteSection from '@/components/SoporteSection'
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

import { leerAprendido, olvidar, type PalabraAprendida } from '@/lib/asr/aprendizaje-firestore'

type Tab = 'general' | 'horario' | 'duraciones' | 'bloqueos' | 'notificaciones' | 'integraciones' | 'plantillas' | 'portal' | 'recetas' | 'seguridad' | 'bot' | 'medicos' | 'equipo' | 'suscripcion' | 'entregas' | 'dictado'

export default function ConfiguracionPage() {
  const { config, loading, error: configError } = useConfig()
  const { activeDoctors } = useDoctors()
  const { clinicId, clinic } = useClinic()
  const { toast } = useToast()
  const { user: authUser } = useAuth()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>('general')
  const [form, setForm] = useState<ClinicConfig>({ ...DEFAULT_CONFIG })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null)
  const [gcalLoading, setGcalLoading] = useState(false)
  const [gcalCalendars, setGcalCalendars] = useState<{ id: string; summary: string; primary: boolean }[]>([])
  // Conectado pero suelto: por qué la agenda pública todavía no lo tiene en cuenta.
  const [gcalAviso, setGcalAviso] = useState('')

  // Check Google Calendar status on mount
  useEffect(() => {
    const checkGcal = async () => {
      const uid = auth.currentUser?.uid
      if (!uid) return
      try {
        const res = await fetchAutenticado(`/api/calendar/status`)
        if (!res.ok) { setGcalConnected(false); return }
        const data = await res.json().catch(() => null)
        setGcalConnected(!!data?.connected)
        /**
         * «Conectado» no es lo mismo que «la agenda pública ya te tiene en
         * cuenta». Si el calendario está conectado pero no se pudo ligar a la
         * ficha del médico, un paciente puede reservar encima de algo que él ya
         * tiene apuntado — y la pantalla, callándolo, le haría creer que no.
         */
        if (data?.connected && data?.vinculado === false && data?.aviso) {
          setGcalAviso(String(data.aviso))
        } else {
          setGcalAviso('')
        }
        if (data?.connected) loadCalendars(uid)
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
      /**
       * SI NO SE PUDO LIGAR A TU FICHA, SE DICE.
       *
       * El calendario queda conectado igual —el médico ya ve sus horas ocupadas
       * al agendar—, pero sin el vínculo `médico ↔ uid` la agenda PÚBLICA no
       * puede tenerlo en cuenta: un paciente podría reservar encima de algo que
       * ya tiene apuntado. Callarlo dejaría al médico creyendo que sí.
       */
      const motivoVinculo = searchParams.get('vinculo')
      if (motivoVinculo) toast(motivoVinculo, 'error')
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
      const res = await fetchAutenticado(`/api/calendar/calendars`)
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (data?.calendars) setGcalCalendars(data.calendars)
    } catch { /* ignore */ }
  }

  const handleConnectGcal = async () => {
    setGcalLoading(true)
    try {
      if (!auth.currentUser) { toast('Sesión expirada, inicia sesión nuevamente', 'error'); return }
      // Autenticado: el uid lo deriva el servidor del token (no del query).
      const res = await fetchAutenticado(`/api/calendar/connect`)
      const data = res.ok ? await res.json().catch(() => null) : null
      if (!data?.url) { toast('No se pudo iniciar la conexión con Google', 'error'); return }
      window.location.href = data.url
    } catch {
      toast('Error al conectar con Google', 'error')
    } finally {
      // Los dos `return` tempranos salían SIN reponer el estado y no había
      // finally: tras un 401 o un 500 el botón quedaba en "Conectando…" y
      // deshabilitado para siempre, hasta recargar la página.
      setGcalLoading(false)
    }
  }

  const handleDisconnectGcal = async () => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    try {
      await fetchAutenticado(`/api/calendar/status`, { method: 'DELETE' })
      setGcalConnected(false)
      setGcalCalendars([])
      toast('Google Calendar desconectado', 'success')
    } catch {
      toast('Error al desconectar', 'error')
    }
  }

  // Inicializa el formulario con la config UNA SOLA VEZ. NO en cada cambio del
  // listener en vivo — eso PISABA lo que el usuario editaba sin guardar (el bug de
  // "cambio de ventana y se me borra"). Los guardados ya persisten a Firestore.
  const formInitRef = useRef(false)
  // Snapshot de la config con la que se inicializó `form`. Guardar hace un DIFF
  // contra esto y persiste SOLO las claves que el usuario cambió (merge), para no
  // reescribir un snapshot completo que revierte lo guardado por otras pestañas.
  const configBaseRef = useRef<ClinicConfig | null>(null)
  useEffect(() => {
    if (!loading && !formInitRef.current) {
      setForm({ ...config })
      configBaseRef.current = { ...config }
      formInitRef.current = true
    }
  }, [config, loading])

  const handleSave = async () => {
    // Si la config NO cargó (error de lectura), NO guardar: el formulario tiene los
    // DEFAULT en blanco y guardar podría sobreescribir cédula/horario reales (P1).
    if (configError) {
      toast('No se pudo cargar tu configuración; recarga la página antes de guardar para no sobreescribirla.', 'error')
      return
    }
    setSaving(true)
    try {
      // Compacta las imágenes pesadas (base64 → Storage) ANTES de guardar. Si
      // quedara base64 inline, el doc de config podía pasar el tope de 1MB de
      // Firestore y hacer fallar TODO el guardado. subirImagen deja pasar las
      // URLs sin tocarlas → en el caso normal no cambia nada.
      const formCompacto: ClinicConfig = {
        ...form,
        firmaImagenDataUrl: await subirImagenServidor(form.firmaImagenDataUrl, 'firma'),
        notaMembreteDataUrl: await subirImagenServidor(form.notaMembreteDataUrl, 'nota-membrete'),
      }
      // DIFF contra el snapshot base: solo las claves de nivel superior que
      // cambiaron. Así el guardado NO pisa campos que otra pestaña persistió en
      // esta sesión (Recetas, Portal, etc.).
      const base = configBaseRef.current ?? config
      const parcial: Partial<ClinicConfig> = {}
      for (const k of Object.keys(formCompacto) as (keyof ClinicConfig)[]) {
        if (formCompacto[k] !== base[k]) (parcial as Record<string, unknown>)[k] = formCompacto[k]
      }
      if (Object.keys(parcial).length > 0) {
        await saveConfigPartial(clinicId!, parcial)   // merge: solo lo cambiado
      }
      setForm(formCompacto)              // refleja las URLs ya compactadas
      configBaseRef.current = formCompacto  // avanza la base para el siguiente diff
      toast('Configuración guardada', 'success')
    } catch (e) {
      toast(`Error al guardar: ${e instanceof Error ? e.message.slice(0, 80) : ''}`, 'error')
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

  /**
   * HORARIO PARTIDO — los descansos del día.
   *
   * Sin esto, un médico que come de 14 a 16 tenía que crear un bloqueo A MANO
   * para cada día del año, o dejar que el portal le ofreciera su comida a los
   * pacientes. Se edita aquí, junto al horario, porque es parte del horario.
   */
  const [festivoNuevo, setFestivoNuevo] = useState('')
  const [festivoAnual, setFestivoAnual] = useState(true)

  const updDescansos = (dia: typeof DIAS[number], descansos: { inicio: string; fin: string }[]) =>
    setForm(prev => ({ ...prev, horario: { ...prev.horario, [dia]: { ...prev.horario[dia], descansos } } }))

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
        { key: 'general', label: 'Datos del consultorio' },
        { key: 'horario', label: 'Horario de atención' },
        { key: 'duraciones', label: 'Duración de citas' },
        { key: 'bloqueos', label: 'Vacaciones y bloqueos' },
      ],
    },
    {
      titulo: 'Comunicación con pacientes',
      tabs: [
        { key: 'notificaciones', label: 'Notificaciones' },
        { key: 'plantillas', label: 'Mensajes de WhatsApp' },
        { key: 'entregas', label: 'Entregas de WhatsApp' },
        { key: 'portal', label: 'Portal de auto-agenda' },
        { key: 'bot', label: 'Bot de preguntas frecuentes', modoMin: 'medico' },
      ],
    },
    {
      titulo: 'Documentos clínicos',
      tabs: [
        { key: 'recetas', label: 'Recetas, órdenes y notas', modoMin: 'medico' },
        // LEARN: lo que el dictado aprendió del médico, para verlo y quitarlo.
        // Un aprendizaje que no se puede deshacer es peor que no aprender.
        { key: 'dictado', label: 'Palabras que aprendió el dictado', modoMin: 'medico' },
      ],
    },
    {
      titulo: 'Equipo y permisos',
      tabs: [
        // La asistente puede gestionar perfiles de médicos en agenda
        { key: 'medicos', label: 'Médicos (ilimitados)' },
        { key: 'equipo', label: 'Equipo (asistentes y hospital)' },
      ],
    },
    {
      titulo: 'Sistema',
      tabs: [
        { key: 'integraciones', label: 'Integraciones' },
        { key: 'seguridad', label: 'Seguridad', modoMin: 'medico' },
        { key: 'suscripcion', label: 'Mi suscripción', modoMin: 'medico' },
      ],
    },
  ]
  // Aplanar para verificación + filtrar por modo
  const TABS = TAB_GROUPS.flatMap(g => g.tabs.filter(t => !t.modoMin || mode === t.modoMin))

  if (loading) {
    return (
      <div role="status" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" /> Cargando configuración…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Encontrar la label del tab actual (para el título móvil)
  const tabActual = TABS.find(t => t.key === tab)

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Aviso si la config NO cargó (auditoría P1): sin esto se veía el formulario
          en blanco sin avisar y Guardar podía sobreescribir cédula/horario reales. */}
      <AvisoConfigNoCargada error={configError} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 className="t-h1" style={{ margin: 0 }}>Configuración</h1>
        {tab !== 'integraciones' && tab !== 'recetas' && tab !== 'portal' && tab !== 'seguridad' && tab !== 'equipo' && tab !== 'medicos' && tab !== 'bloqueos' && tab !== 'suscripcion' && tab !== 'bot' && tab !== 'entregas' && (
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : <><Save size={15} /> Guardar</>}
          </button>
        )}
      </div>

      {/* Entrada a la consola del DUEÑO — solo visible para el superadmin (el gate
          real lo hace el servidor). Discreta, fuera de las pestañas normales. */}
      {esSuperadminCliente(authUser?.email) && (
        <a href="/superadmin" style={{
          display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
          background: 'linear-gradient(90deg, color-mix(in srgb, var(--purple) 7%, transparent), transparent)',
          border: '1px solid color-mix(in srgb, var(--purple) 27%, transparent)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 18, minHeight: 44, boxSizing: 'border-box',
        }}>
          <ShieldCheck size={18} style={{ color: 'var(--purple)' }} aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Consola de suscripciones (dueño)</div>
            <div className="nx-meta">Todos los consultorios, cobranza, ingresos y pases libres</div>
          </div>
          <ExternalLink size={15} style={{ color: 'var(--text3)' }} aria-hidden="true" />
        </a>
      )}

      {/* Layout: sidebar agrupado (desktop) / select (móvil) + contenido */}
      <div className="config-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Sidebar agrupado — solo desktop */}
        {/* El riel de secciones habla el idioma del shell (.nav-item + .active:
            barra de acento + texto var(--text)), no un dialecto propio. El borde
            rgba(61,90,254,…) que traía era el ÍNDIGO VIEJO — un acento que ya no
            existe como token — y el activo pintaba teal-como-texto (la lección
            TrialBanner). V15-REMAINING-SCREENS-001, 5ª rebanada. */}
        <nav className="config-sidebar" aria-label="Secciones de configuración" style={{
          background: 'var(--s)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '2px 8px 10px', position: 'sticky', top: 16,
        }}>
          {TAB_GROUPS.map(grupo => {
            const visibles = grupo.tabs.filter(t => !t.modoMin || mode === t.modoMin)
            if (visibles.length === 0) return null
            return (
              <div key={grupo.titulo}>
                <div className="nav-section-title">
                  {grupo.titulo}
                </div>
                {visibles.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`nav-item${tab === t.key ? ' active' : ''}`}
                    aria-current={tab === t.key ? 'true' : undefined}
                    style={{ marginBottom: 2 }}
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
            aria-label="Sección de configuración"
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10, minHeight: 44,
              border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
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
              <h2 className="t-h2" style={{ margin: 0 }}>{tabActual.label}</h2>
            </div>
          )}

      {/* General */}
      {tab === 'general' && (
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          <div className="form-group">
            <label className="label" htmlFor="cfg-nombre-del-medico">Nombre del médico</label>
            <input id="cfg-nombre-del-medico" className="input" value={form.nombreMedico} onChange={upd('nombreMedico')} placeholder="Dr. García López" />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="cfg-nombre-de-la-clinica-consultorio">Nombre de la clínica / consultorio</label>
            <input id="cfg-nombre-de-la-clinica-consultorio" className="input" value={form.nombreClinica} onChange={upd('nombreClinica')} placeholder="Consultorio Médico García" />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="cfg-cedula-profesional">Cédula profesional <span style={{ color: 'var(--red)' }}>*</span></label>
            <input id="cfg-cedula-profesional" className="input" value={form.cedulaProfesional ?? ''} onChange={upd('cedulaProfesional')} placeholder="12345678 (requerida para firmar expedientes)" />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="cfg-especialidad">Especialidad</label>
            <input id="cfg-especialidad" className="input" value={form.especialidad ?? ''} onChange={upd('especialidad')} placeholder="Infectología" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="cfg-estilo-de-mis-notas-la-ia-escribe-">Estilo de mis notas (la IA escribe a tu manera)</label>
            <textarea id="cfg-estilo-de-mis-notas-la-ia-escribe-"
              className="input"
              rows={3}
              value={form.instruccionesIA ?? ''}
              onChange={upd('instruccionesIA')}
              placeholder="Ej: usa formato SOAP; abrevia los diagnósticos; incluye siempre un plan de seguimiento; tono formal."
            />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              Preferencias de redacción para tus notas por IA. Son de estilo — no cambian las reglas clínicas ni de seguridad.
            </div>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={form.pedirCobroAlCerrar === true}
                onChange={e => setForm({ ...form, pedirCobroAlCerrar: e.target.checked })}
              />
              El médico registra el cobro al terminar la consulta
            </label>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              Apagado (recomendado): el médico NO cobra ni ve el mensaje de pago; la secretaria registra
              el cobro desde <strong>Citas</strong> cuando el paciente se va, y aparece en las Finanzas del médico.
              Enciéndelo solo si el propio médico quiere cobrar al firmar.
            </div>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="cfg-direccion">Dirección</label>
            <input id="cfg-direccion" className="input" value={form.direccion} onChange={upd('direccion')} placeholder="Av. Independencia 123, Col. Centro" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="cfg-url-google-maps">URL Google Maps</label>
            <input id="cfg-url-google-maps" className="input" value={form.googleMapsUrl} onChange={upd('googleMapsUrl')} placeholder="https://maps.google.com/…" />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="cfg-telefono-admin">Teléfono admin</label>
            <input id="cfg-telefono-admin" className="input" type="tel" value={form.telefonoAdmin} onChange={upd('telefonoAdmin')} placeholder="6641234567" />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="cfg-whatsapp-consultorio">WhatsApp consultorio</label>
            <input id="cfg-whatsapp-consultorio" className="input" type="tel" value={form.whatsappConsultorio} onChange={upd('whatsappConsultorio')} placeholder="6641234567" />
          </div>

          {/* ── Identidad fiscal y de privacidad (alimenta el aviso y el contrato de encargo) ── */}
          <div style={{ gridColumn: '1 / -1', marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Datos fiscales y de privacidad</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3 }}>
              Con estos datos generamos tu aviso de privacidad y tu contrato de encargo personalizados (menú <strong>Documentos legales</strong>).
            </div>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="cfg-razon-social-o-nombre-completo-del">Razón social o nombre completo del responsable</label>
            <input id="cfg-razon-social-o-nombre-completo-del" className="input" value={form.razonSocial ?? ''} onChange={upd('razonSocial')} placeholder="Servicios Médicos del Norte, S.C. / Dr. Juan Pérez López" />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="cfg-rfc">RFC</label>
            <input id="cfg-rfc" className="input" value={form.rfc ?? ''} onChange={upd('rfc')} placeholder="XAXX010101000" />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="cfg-correo-de-contacto-arco">Correo de contacto ARCO</label>
            <input id="cfg-correo-de-contacto-arco" className="input" type="email" value={form.correoArco ?? ''} onChange={upd('correoArco')} placeholder="privacidad@tuconsultorio.mx" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="cfg-domicilio-fiscal-si-difiere-del-do">Domicilio fiscal (si difiere del domicilio del consultorio)</label>
            <input id="cfg-domicilio-fiscal-si-difiere-del-do" className="input" value={form.domicilioFiscal ?? ''} onChange={upd('domicilioFiscal')} placeholder="Av. Fiscal 100, Col. Centro, C.P. 22000, Tijuana, B.C." />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="label" htmlFor="cfg-responsable-de-privacidad-persona">Responsable de privacidad (persona)</label>
            <input id="cfg-responsable-de-privacidad-persona" className="input" value={form.responsablePrivacidad ?? ''} onChange={upd('responsablePrivacidad')} placeholder="Nombre de quien atiende solicitudes de datos personales" />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="cfg-intervalo-de-agenda-min">Intervalo de agenda (min)</label>
            <select id="cfg-intervalo-de-agenda-min" className="input" value={form.intervaloMinutos} onChange={upd('intervaloMinutos')}>
              {[5, 10, 15, 20, 30].map(v => <option key={v} value={v}>{v} minutos</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label" htmlFor="cfg-zona-horaria">Zona horaria</label>
            <select id="cfg-zona-horaria" className="input" value={form.zonaHoraria} onChange={upd('zonaHoraria')}>
              <option value="America/Chihuahua">Chihuahua / Ciudad Juárez (UTC-6)</option>
              <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
              <option value="America/Monterrey">Monterrey (UTC-6)</option>
              <option value="America/Hermosillo">Hermosillo / Sonora (UTC-7)</option>
              <option value="America/Tijuana">Tijuana / Baja California (UTC-8)</option>
            </select>
          </div>

          {/* La FIRMA y la HOJA MEMBRETADA DE NOTAS se movieron a la pestaña
              "Recetas, órdenes y notas": son ajustes de impresos y estaban
              perdidos entre los datos del consultorio. Se guardan solas
              (saveConfigPartial), así que el cambio de pestaña no las afecta. */}

          {/* 🔑 Llaves de IA por consultorio — SOLO el dueño la ve. El cliente NO
              configura llaves (el dueño las provee en Vercel); mostrarla confunde. */}
          {clinicId && esSuperadminCliente(authUser?.email) && (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <LlavesIASection clinicId={clinicId} />
            </div>
          )}
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
                // Se CUENTAN los huecos uno por uno en vez de dividir, porque con
                // descansos la fórmula deja de valer: el preview diría 22 espacios
                // y el paciente vería 18. Un preview que miente es peor que no tenerlo.
                const pausas = descansosEnMinutos(h.descansos)
                const desde = hI * 60 + mI
                const hasta = hF * 60 + mF
                for (let m = desde; m + duracionDefault <= hasta; m += intervalo) {
                  if (pisaDescanso(m, m + duracionDefault, pausas)) continue
                  cantidadSlots++
                }
              }
            }
            const horas = (minutos / 60).toFixed(1).replace('.0', '')
            // Warning si el día parece desproporcionado (>16 slots = >8h con citas de 30min)
            const esSospechoso = cantidadSlots > 16
            return (
              <div key={dia} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 16px', background: 'var(--s1)', border: `1px solid ${esSospechoso ? 'var(--amber)' : 'var(--border)'}`, borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <input
                  type="checkbox"
                  checked={h.activo}
                  onChange={e => updHorario(dia, 'activo', e.target.checked)}
                  aria-label={`Atender los ${DIAS_LABELS[dia].toLowerCase()}`}
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
                      aria-label={`Hora de inicio del ${DIAS_LABELS[dia].toLowerCase()}`}
                      style={{ width: 110 }}
                    />
                    <span style={{ color: 'var(--text3)', fontSize: 14 }} aria-hidden="true">—</span>
                    <input
                      type="time" className="input" value={h.fin}
                      onChange={e => updHorario(dia, 'fin', e.target.value)}
                      aria-label={`Hora de fin del ${DIAS_LABELS[dia].toLowerCase()}`}
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
                        <span style={{ fontSize: 10.5, color: 'var(--amber)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={11} className="ds-icon" /> ¿Atiendes tantas horas?
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>Cerrado</span>
                )}
                </div>
                {h.activo && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingLeft: 30 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Descansos:</span>
                    {(h.descansos ?? []).map((d, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="time" className="input" value={d.inicio} aria-label={`Inicio del descanso ${i + 1} de ${DIAS_LABELS[dia]}`}
                          onChange={e => updDescansos(dia, (h.descansos ?? []).map((x, j) => j === i ? { ...x, inicio: e.target.value } : x))}
                          style={{ width: 100, padding: '4px 8px', fontSize: 13 }}
                        />
                        <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
                        <input
                          type="time" className="input" value={d.fin} aria-label={`Fin del descanso ${i + 1} de ${DIAS_LABELS[dia]}`}
                          onChange={e => updDescansos(dia, (h.descansos ?? []).map((x, j) => j === i ? { ...x, fin: e.target.value } : x))}
                          style={{ width: 100, padding: '4px 8px', fontSize: 13 }}
                        />
                        <button
                          type="button" className="btn-ghost" aria-label={`Quitar el descanso ${i + 1} de ${DIAS_LABELS[dia]}`}
                          onClick={() => updDescansos(dia, (h.descansos ?? []).filter((_, j) => j !== i))}
                          style={{ padding: '4px 8px', fontSize: 12, color: 'var(--red)' }}
                        >Quitar</button>
                      </span>
                    ))}
                    <button
                      type="button" className="btn-ghost"
                      onClick={() => updDescansos(dia, [...(h.descansos ?? []), { inicio: '14:00', fin: '16:00' }])}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >+ Añadir descanso</button>
                    {(h.descansos ?? []).some(d => descansosEnMinutos([d]).length === 0) && (
                      <span style={{ fontSize: 11.5, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={11} className="ds-icon" /> Un descanso está incompleto o al revés — ese no se aplica.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/*
            DÍAS FESTIVOS — antes se leían en cuatro sitios y no se escribían en
            ninguno: no había ni una pantalla que los editara, así que la lista
            estaba SIEMPRE vacía y el 25 de diciembre se agendaba como cualquier
            día. El único cierre disponible era crear un bloqueo a mano.

            Se admite «MM-DD» para los que se repiten todos los años. Una fecha
            exacta cargada para 2026 deja de aplicar en 2027 sin que nadie se
            entere, y eso es peor que no tenerla.
          */}
          <div style={{ marginTop: 6, padding: '12px 16px', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Días festivos</div>
            <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: 0, lineHeight: 1.5 }}>
              Días en los que no se atiende. Se aplican a la agenda, al portal público y al bot de WhatsApp.
              Marca <strong>«se repite cada año»</strong> para los fijos (Navidad, Año Nuevo); si no, sólo aplica a esa fecha.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(form.diasFestivos ?? []).map((f, i) => (
                <span key={`${f}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--s2, rgba(127,127,127,0.08))', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', fontSize: 12.5, color: 'var(--text2)' }}>
                  {f.length === 5 ? `${f} · cada año` : f}
                  <button
                    type="button" aria-label={`Quitar el día festivo ${f}`}
                    onClick={() => setForm(prev => ({ ...prev, diasFestivos: (prev.diasFestivos ?? []).filter((_, j) => j !== i) }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 14, lineHeight: 1, padding: 0 }}
                  >×</button>
                </span>
              ))}
              {(form.diasFestivos ?? []).length === 0 && (
                <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>Ninguno cargado — hoy se agenda en todos los días activos.</span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <input
                type="date" className="input" value={festivoNuevo} aria-label="Fecha del día festivo"
                onChange={e => setFestivoNuevo(e.target.value)}
                style={{ width: 165 }}
              />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)' }}>
                <input type="checkbox" checked={festivoAnual} onChange={e => setFestivoAnual(e.target.checked)} style={{ accentColor: 'var(--teal)' }} />
                Se repite cada año
              </label>
              <button
                type="button" className="btn btn-secondary btn-sm"
                disabled={!festivoNuevo}
                onClick={() => {
                  const valor = festivoAnual ? festivoNuevo.slice(5, 10) : festivoNuevo
                  if (!valor) return
                  setForm(prev => (prev.diasFestivos ?? []).includes(valor)
                    ? prev
                    : { ...prev, diasFestivos: [...(prev.diasFestivos ?? []), valor].sort() })
                  setFestivoNuevo('')
                }}
              >Añadir</button>
            </div>
          </div>
        </div>
      )}

      {/* Duraciones */}
      {tab === 'duraciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 8px' }}>Duración predeterminada por tipo de consulta (en minutos).</p>
          {(Object.entries(APPOINTMENT_TYPE_CONFIG) as [AppointmentType, { label: string }][]).map(([tipo, cfg]) => (
            <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <span style={{ display: 'inline-flex', color: 'var(--text2)' }}><TipoCitaIcon tipo={tipo} size={18} /></span>
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
          {/*
            DOS INTERRUPTORES EN VERDE QUE NO MANDABAN NADA.
            `recordatorio24h` y `recordatorioMismoDia` nacen en `true` por
            omisión, y sin proveedor de WhatsApp conectado `sendWhatsApp`
            devuelve «No WhatsApp provider configured». El médico veía dos
            casillas marcadas que decían «Enviar recordatorio al paciente el día
            anterior», daba por hecho que estaba cubierto, y lo descubría cuando
            tres pacientes no llegaban. Y la página de registro se lo había
            vendido explícitamente.
            No se apagan solos —apagarle una preferencia al médico sin avisar es
            otra forma de mentir—: se le dice la verdad y se le enseña dónde
            conectarlo.
          */}
          {!clinic?.whatsapp?.provider || clinic.whatsapp.provider === 'none' ? (
            <div style={{
              padding: 14, borderRadius: 10, background: 'var(--s2)',
              border: '1px solid var(--amber)', display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text)' }}>WhatsApp no está conectado todavía.</strong> Estos
                avisos están activados, pero <strong>no se está enviando ninguno</strong> hasta que conectes
                el número del consultorio en la pestaña <em>WhatsApp</em>.
              </div>
            </div>
          ) : null}
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
          <div style={{ padding: 16, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Pedir reseña automáticamente</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Tras cada cita atendida, enviar por WhatsApp una invitación a dejar reseña</div>
            </div>
            <input type="checkbox" checked={!!form.resenaAutomatica} onChange={updBool('resenaAutomatica')} style={{ accentColor: 'var(--teal)', width: 18, height: 18 }} />
          </div>
          <div style={{ padding: 16, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Anticipo / pago en línea</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5 }}>
              Pega tu link de pago propio (Stripe Payment Link, MercadoPago, Clip…). El paciente verá un botón <strong>Pagar anticipo</strong> en su portal. Reduce inasistencias.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
              <input className="input" placeholder="https://mpago.la/… o https://buy.stripe.com/…" value={form.anticipoLink ?? ''} onChange={upd('anticipoLink')} />
              <input className="input" type="number" min={0} placeholder="Monto $" value={form.anticipoMonto ?? ''} onChange={(e) => setForm({ ...form, anticipoMonto: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          </div>
          <div className="form-group" style={{ maxWidth: 200 }}>
            <label className="label" htmlFor="cfg-hora-de-resumen-diario">Hora de resumen diario</label>
            <input id="cfg-hora-de-resumen-diario" className="input" type="time" value={form.horaResumenDiario} onChange={upd('horaResumenDiario')} />
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
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'color-mix(in srgb, var(--nexus) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--green)', background: 'color-mix(in srgb, var(--green) 10%, transparent)', padding: '4px 10px', borderRadius: 20 }}>
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

            {/*
              CONECTADO NO ES LO MISMO QUE «LA AGENDA PÚBLICA YA TE VE».

              Sin el vínculo médico ↔ calendario, el portal y el bot no pueden
              descontar los eventos de Google al ofrecer huecos: un paciente
              puede reservar encima de algo que el médico ya tiene apuntado. La
              insignia verde de arriba, sola, le haría creer que está cubierto.
            */}
            {gcalAviso && (
              <div
                className="alert alert-amber"
                role="status"
                style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}
              >
                <AlertTriangle size={15} className="alert-icon" />
                <div>
                  <div className="alert-title">Conectado, pero sin ligar a tu ficha</div>
                  {gcalAviso}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {gcalConnected ? (
                <>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleDisconnectGcal}
                    style={{ color: 'var(--red)' }}
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
                <label className="label" htmlFor="cfg-calendario-destino">Calendario destino</label>
                <select id="cfg-calendario-destino"
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

            <div style={{ marginTop: 14, padding: '10px 14px', background: 'color-mix(in srgb, var(--nexus) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--nexus) 15%, transparent)', borderRadius: 8 }}>
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
            { key: 'confirmacion', label: 'Confirmación de cita', msg: msgConfirmacion(demoAppt, form) },
            { key: 'recordatorio24', label: '⏰ Recordatorio 24 horas', msg: msgRecordatorio24h(demoAppt, form) },
            { key: 'recordatorioDia', label: 'Recordatorio mismo día', msg: msgRecordatorioDia(demoAppt, form) },
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

          <PlantillasHsmSection clinicId={clinicId} />
        </div>
      )}

      {/* Bot FAQ */}
      {tab === 'bot' && <BotFAQTab doctors={activeDoctors} />}

      {/* Médicos */}
      {tab === 'medicos' && <MedicosTab />}

      {/* Equipo (invitaciones) */}
      {tab === 'equipo' && <EquipoTab clinicId={clinicId} clinicNombre={form.nombreClinica || 'tu clínica'} />}

      {/* Bloqueos de horario */}
      {tab === 'bloqueos' && <BloqueosTab clinicId={clinicId} zonaHoraria={form.zonaHoraria} />}
      {tab === 'dictado' && <DictadoAprendidoTab clinicId={clinicId} />}

      {/* Portal del paciente */}
      {tab === 'portal' && <PortalTab clinicId={clinicId} clinicNombre={form.nombreClinica || 'tu clínica'} />}

      {/* Recetas y órdenes */}
      {/* TODO lo de impresos en UNA pestaña: receta/orden, firma y hoja de notas.
          Antes la firma y el membrete de notas vivían en "Datos del consultorio",
          lejos de donde se configura lo que se imprime. */}
      {tab === 'recetas' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <RecetasTab clinicId={clinicId} />

          {/* 🖋️ Firma + sello POR MÉDICO — sale en notas, recetas y órdenes */}
          <FirmaUploadSection
            form={form}
            clinicId={clinicId}
            onLocalChange={(patch) => setForm(f => ({ ...f, ...patch }))}
          />

          {/* 📄 Hoja membretada para NOTAS — general o por médico */}
          <MembreteNotaSection
            form={form}
            clinicId={clinicId}
            onLocalChange={(patch) => setForm(f => ({ ...f, ...patch }))}
          />
        </div>
      )}

      {/* Seguridad — MFA / 2FA */}
      {tab === 'seguridad' && <SeguridadTab />}

      {/* Suscripción */}
      {tab === 'suscripcion' && <SuscripcionTab clinicId={clinicId} />}

      {/* Entregas de WhatsApp (Iter. 7) */}
      {tab === 'entregas' && <EntregasWhatsAppTab clinicId={clinicId} />}
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
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'color-mix(in srgb, var(--nexus) 8%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
        <div style={{ fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
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
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'color-mix(in srgb, var(--nexus) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--nexus) 15%, transparent)', borderRadius: 8 }}>
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
// El Embedded Signup EXIGE un "config_id" propio (la Configuración de registro
// integrado que creas en el panel de Meta → WhatsApp). NO es el App ID. Si no
// está, el flujo de un clic no abre correctamente.
const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID ?? ''

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
      const res = await fetchAutenticado('/api/whatsapp/manual-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, phoneNumberId: manual.phoneNumberId.trim(), token: manual.token.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast(`WhatsApp conectado: ${data.phoneNumber}`, 'success')
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
    if (!META_CONFIG_ID) {
      toast('Configura NEXT_PUBLIC_META_CONFIG_ID en Vercel (el config del registro integrado)', 'error')
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
        const res = await fetchAutenticado('/api/whatsapp/meta-connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, clinicId }),
        })
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok) {
          toast(`WhatsApp conectado: ${data.phoneNumber}`, 'success')
        } else {
          toast(data?.error ?? 'Error al conectar', 'error')
        }
        setConnecting(false)
      }, {
        config_id: META_CONFIG_ID,  // Configuración de Embedded Signup (NO el App ID)
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
      const res = await fetchAutenticado('/api/clinic/whatsapp-disconnect', {
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
    <div style={{ padding: 20, background: 'var(--s1)', border: `1px solid ${connected ? 'color-mix(in srgb, var(--green) 30%, transparent)' : 'var(--border)'}`, borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: connected ? 'color-mix(in srgb, var(--green) 12%, transparent)' : 'color-mix(in srgb, var(--nexus) 8%, transparent)',
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
          background: connected ? 'color-mix(in srgb, var(--green) 10%, transparent)' : 'var(--s2)',
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
              background: 'color-mix(in srgb, var(--green) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 20%, transparent)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--green)',
            }}>
              <Smartphone size={14} />
              <span>Bot activo — los pacientes ya pueden escribir para agendar</span>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
                color: 'var(--red)', fontSize: 13, padding: '8px 14px',
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              {disconnecting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={13} />}
              Desconectar
            </button>
          </>
        ) : (META_APP_ID && META_CONFIG_ID) ? (
          // El botón de un-clic de Meta SOLO aparece cuando Meta está configurado
          // (env NEXT_PUBLIC_META_APP_ID + NEXT_PUBLIC_META_CONFIG_ID). Mientras no
          // lo esté, se oculta para no confundir; reaparece solo al configurarlo.
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
        ) : null}
      </div>

      {/* Info box + conexión manual */}
      {!connected && (
        <>
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'color-mix(in srgb, var(--nexus) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--nexus) 15%, transparent)', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, lineHeight: 1.6 }}>
              {(META_APP_ID && META_CONFIG_ID)
                ? 'Al hacer clic se abrirá una ventana de Meta. Solo necesitas iniciar sesión con Facebook y verificar tu número de WhatsApp.'
                : 'Conecta tu WhatsApp cuando lo necesites: pega tus credenciales de WhatsApp Business abajo. (El conector de un clic de Meta aparecerá aquí cuando configures la app de Meta.)'}
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
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
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
    { id: 'padecimientos', label: 'Padecimientos que atiende', placeholder: 'Infecciones bacterianas, virales, VIH/SIDA, tuberculosis…' },
    { id: 'costoConsulta', label: 'Costo de consulta', placeholder: 'Primera vez $800, seguimiento $600…' },
    { id: 'seguros', label: 'Seguros aceptados', placeholder: 'GNP, AXA… / No aceptamos IMSS/ISSSTE' },
    { id: 'comoLlegar', label: 'Cómo llegar / Dirección detallada', placeholder: 'Edificio X, piso 3, consultorio 304…' },
    { id: 'infoExtra', label: 'Información adicional (opcional)', placeholder: 'Traer estudios previos, llegar 10 min antes…' },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'color-mix(in srgb, var(--nexus) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--nexus) 20%, transparent)', borderRadius: 12, padding: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0, lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <Bot size={16} className="ds-icon" style={{ marginTop: 2, flexShrink: 0, color: 'var(--teal)' }} />
          <span><strong style={{ color: 'var(--teal)' }}>Bot de WhatsApp</strong> — estas respuestas se usan cuando los pacientes pregunten por WhatsApp sobre horarios, costos, ubicación, etc.</span>
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
        <div style={{ background: 'color-mix(in srgb, var(--amber) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)', borderRadius: 10, padding: 14, fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <AlertTriangle size={15} className="ds-icon" style={{ flexShrink: 0 }} /> No hay médico configurado. Ve a Configuración → General para agregar un médico.
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
  const { toast, confirm } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: '', especialidad: '', telefono: '', email: '', cedulaProfesional: '', activo: true,
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
        // NO se copia aquí el horario del consultorio. Esa copia no se volvia a
        // escribir nunca —no hay editor por médico— y sin embargo la agenda la
        // prefería, así que congelaba el horario en el día del alta: cambiar el
        // horario en Configuración decía «guardado» y no llegaba a la agenda.
        // Ver `lib/horario-medico.ts`.
        createdAt: '',
        updatedAt: '',
      })
      toast('Médico agregado', 'success')
      setShowForm(false)
      setForm({ nombre: '', especialidad: '', telefono: '', email: '', cedulaProfesional: '', activo: true })
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
          {doctors.length} {doctors.length === 1 ? 'médico registrado' : 'médicos registrados'} · sin límite
        </p>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowForm(s => !s)}
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
              // La cédula es DE CADA MÉDICO: con la de la clínica, la nota de la
              // Dra. salía firmada con la cédula del dueño.
              { key: 'cedulaProfesional', label: 'Cédula profesional', placeholder: '12345678' },
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
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
              <UserRound size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{doc.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{doc.especialidad}</div>
              {doc.botConfig?.completado && (
                <span style={{ fontSize: 11, color: 'var(--teal)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} className="ds-icon" /> Bot FAQ configurado
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 12, padding: '3px 8px', borderRadius: 'var(--r-pill)', fontWeight: 600,
              background: doc.activo ? 'color-mix(in srgb, var(--nexus) 10%, transparent)' : 'var(--s2)',
              color: 'var(--text)',
              border: doc.activo ? '1px solid color-mix(in srgb, var(--nexus) 30%, transparent)' : '1px solid var(--border)',
            }}>
              {doc.activo ? 'Activo' : 'Inactivo'}
            </span>
            <button
              onClick={() => updateDoctor(clinicId!, doc.id, { activo: !doc.activo }).catch(() => toast('Error', 'error'))}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12, borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
            >
              {doc.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button
              title="Borrar médico"
              onClick={async () => {
                if (!(await confirm(`¿Borrar a ${doc.nombre}? Sus citas anteriores no se borran, pero ya no aparecerá para agendar.`, { peligro: true, confirmar: 'Borrar' }))) return
                deleteDoctor(clinicId!, doc.id).then(() => toast('Médico borrado', 'success')).catch(() => toast('No se pudo borrar', 'error'))
              }}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', fontSize: 12, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <IconX size={12} /> Borrar
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
/**
 * El precio sale de `PLANES`; aquí sólo vive lo que es de esta pantalla: el
 * color del distintivo y el «Plan …» delante del nombre.
 *
 * Estaban los cuatro precios escritos a mano, y esta es LA pantalla donde el
 * médico va a comprobar qué está pagando. Un número tecleado aquí no se entera
 * de una subida de tarifa — y quien lo descubre es él, comparando con su recibo.
 */
const COLOR_PLAN: Record<string, string> = {
  trial: 'var(--amber)', agenda: '#60a5fa', clinica: 'var(--nexus)', premium: '#a78bfa', hospital: '#7c5cd6',
}
const PLAN_DISPLAY: Record<string, { label: string; color: string; price: string }> = {
  trial: { label: 'Prueba gratuita', color: COLOR_PLAN.trial, price: '$0 MXN/mes' },
  ...Object.fromEntries(PLANES_ORDEN.map(c => [c, {
    label: `Plan ${PLANES[c].nombre}`,
    color: COLOR_PLAN[c],
    price: `${precioTexto(PLANES[c])} MXN/mes`,
  }])),
}

const PLAN_FEATURES: Record<string, string[]> = {
  trial:    ['14 días gratuitos', 'Todas las funciones', 'Sin tarjeta de crédito'],
  agenda:   ['Agenda y calendario', 'Recordatorios por WhatsApp', 'Expediente básico', 'Portal del paciente'],
  // Los créditos también se leen de `PLANES`. Hospital decía «400 créditos/mes»
  // y son 500: el número se quedó de una versión anterior de la oferta y nadie
  // volvió a mirarlo. Prometer de menos en la pantalla donde se decide pagar es
  // tan malo como prometer de más.
  clinica:  [`${PLANES.clinica.creditos} créditos de IA/mes`, 'Nota por voz + separación de voces', 'Menú de IA (⚡/⭐/💎)', 'Consultor de evidencia', 'Todo el plan Agenda'],
  premium:  [`${PLANES.premium.creditos} créditos/mes`, 'IA de máximo razonamiento clínico por defecto', 'Revisión de seguridad clínica automática', 'Soporte prioritario', 'Todo el plan Clínica'],
  hospital: ['Módulo de Hospitalización', `${PLANES.hospital.creditos} créditos/mes`, 'Censo, camas, MAR, NEWS2', 'Notas de ingreso/evolución/egreso'],
}

function SuscripcionTab({ clinicId }: { clinicId: string | null }) {
  const { clinic } = useClinic()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  /**
   * El ciclo que el consultorio tiene HOY, para conservarlo al cambiar de plan.
   * Se guarda en la clínica al activar (ver el webhook); si no está, mensual.
   */
  const cicloActual: 'mensual' | 'anual' = (clinic as { ciclo?: string } | null)?.ciclo === 'anual' ? 'anual' : 'mensual'

  const plan    = clinic?.plan    ?? 'trial'
  const status  = clinic?.status  ?? 'trial'
  const planInfo = PLAN_DISPLAY[plan] ?? PLAN_DISPLAY.trial
  const features = PLAN_FEATURES[plan] ?? []

  const openPortal = async () => {
    if (!clinicId) return
    setLoading(true)
    try {
      const res = await fetchAutenticado('/api/stripe/portal', {
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
      const res = await fetchAutenticado('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /**
         * EL CICLO VIAJA. Antes NO se mandaba, así que el servidor lo forzaba a
         * 'mensual': un cliente que había contratado ANUAL y cambiaba de plan
         * desde aquí pasaba a mensual, y su suscripción anual se cancelaba sin
         * prorrateo — perdía los meses del año que ya había pagado, sin nota ni
         * abono en ninguna parte.
         */
        body: JSON.stringify({ clinicId, plan: targetPlan, email: user?.email ?? '', ciclo: cicloActual }),
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
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)',
              background: status === 'active' ? 'var(--nexus-soft)' : 'color-mix(in srgb, var(--amber) 12%, transparent)',
              color: status === 'active' ? 'var(--teal)' : '#f59e0b',
              border: `1px solid ${status === 'active' ? 'color-mix(in srgb, var(--nexus) 30%, transparent)' : 'color-mix(in srgb, var(--amber) 30%, transparent)'}`,
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
      {plan !== 'premium' && plan !== 'hospital' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
            {plan === 'trial' ? 'Activa tu plan antes de que termine la prueba:' : 'Opciones de actualización:'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(['agenda', 'clinica', 'premium'] as const)
              .filter(p => p !== plan)
              .map(p => {
                const info = PLAN_DISPLAY[p]
                return (
                  <div key={p} style={{
                    background: 'var(--s1)', border: p === 'premium' ? '1px solid color-mix(in srgb, var(--nexus) 40%, transparent)' : '1px solid var(--border)',
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
                        background: p === 'premium' ? 'var(--teal)' : 'var(--s2)',
                        color: p === 'premium' ? '#000' : 'var(--text)',
                        border: p === 'premium' ? 'none' : '1px solid var(--border)',
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

      {/* Médicos y cobro por asiento */}
      {clinicId && <AsientosSection clinicId={clinicId} />}

      {/* Facturas (CFDI) — el cliente pide factura solo si la necesita */}
      {clinicId && <FacturacionSection clinicId={clinicId} />}

      {/* Soporte y sugerencias — abierto a todos */}
      <SoporteSection clinicId={clinicId ?? undefined} />
    </div>
  )
}


/* ── Catálogo de roles/profesiones para invitar ──────────────
 * Cada opción define el PERMISO (role) y, si aplica, la ESPECIALIDAD que se
 * guarda en su ficha. Médicos y profesionales clínicos (psicología, nutrición…)
 * usan el rol 'medico' porque necesitan acceso al EXPEDIENTE. */
type OpcionRol = { label: string; role: RolInvitacion; especialidad?: string }
const GRUPOS_ROL: { grupo: string; opciones: OpcionRol[] }[] = [
  { grupo: 'Administrativo', opciones: [
    { label: 'Asistente / Secretaria', role: 'secretaria' },
    { label: 'Administrador', role: 'admin' },
  ]},
  { grupo: 'Médicos · especialidades clínicas', opciones:
    ESPECIALIDADES_CLINICAS.map(e => ({ label: e, role: 'medico' as RolInvitacion, especialidad: e })) },
  { grupo: 'Médicos · especialidades quirúrgicas', opciones:
    ESPECIALIDADES_QUIRURGICAS.map(e => ({ label: e, role: 'medico' as RolInvitacion, especialidad: e })) },
  { grupo: 'Médicos · diagnóstico y apoyo', opciones:
    ESPECIALIDADES_DIAGNOSTICAS.map(e => ({ label: e, role: 'medico' as RolInvitacion, especialidad: e })) },
  { grupo: 'Otros profesionales de la salud (acceden al expediente)', opciones:
    OTROS_PROFESIONALES.map(e => ({ label: e, role: 'medico' as RolInvitacion, especialidad: e })) },
  { grupo: 'Hospitalización', opciones: [
    { label: 'Enfermería', role: 'enfermeria' },
    { label: 'Farmacia', role: 'farmacia' },
    { label: 'Laboratorio', role: 'laboratorio' },
  ]},
]
const OPCIONES_ROL_FLAT = GRUPOS_ROL.flatMap(g => g.opciones)

/* ── Equipo (invitar asistente / colaboradores) ──────────── */
function EquipoTab({ clinicId, clinicNombre }: { clinicId: string | null; clinicNombre: string }) {
  const { user } = useAuth()
  const { toast, confirm } = useToast()

  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)
  const [nombreInv, setNombreInv] = useState('')
  const [profesion, setProfesion] = useState('Asistente / Secretaria')  // etiqueta elegida
  const opcionRol = OPCIONES_ROL_FLAT.find(o => o.label === profesion) ?? OPCIONES_ROL_FLAT[0]
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
        clinicId, clinicNombre, opcionRol.role,
        { uid: user.uid, email: user.email ?? '' },
        nombreInv, opcionRol.especialidad,
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
    if (!(await confirm('¿Revocar esta invitación? El enlace dejará de funcionar.', { peligro: true, confirmar: 'Revocar' }))) return
    try { await revocarInvitacion(code); recargar(); toast('Invitación revocada', 'info') }
    catch { toast('Error al revocar', 'error') }
  }

  const pendientes = invitaciones.filter(i => !i.used)
  const usadas    = invitaciones.filter(i =>  i.used)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.55 }}>
        Genera un enlace que la persona abrirá para crear su cuenta y unirse a esta clínica.
        Los enlaces expiran en 7 días. <strong style={{ color: 'var(--text2)' }}>Sin límite de personas.</strong>
      </div>

      {/* Aviso: aquí también se agrega al equipo hospitalario */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: 'color-mix(in srgb, var(--nexus) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--nexus) 30%, transparent)' }}>
        <BedDouble size={18} style={{ color: 'var(--nexus)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>
          Aquí agregas a <strong>todo tu equipo</strong> (asistentes, médicos, enfermería, farmacia, laboratorio) para que
          cada quien entre con su usuario. <strong>Cuando invitas a un Médico, su agenda se crea sola</strong> al aceptar —
          ya no tienes que darlo de alta aparte. Puedes invitar a <strong>cuantas personas necesites</strong>.
        </div>
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
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Rol / profesión</label>
            <select className="input" value={profesion} onChange={e => setProfesion(e.target.value)}>
              {GRUPOS_ROL.map(g => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.opciones.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
            {opcionRol.role === 'medico' && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                Accede al expediente y tendrá su propia agenda (se crea sola al aceptar).
              </div>
            )}
          </div>
        </div>
        <button onClick={generar} disabled={creando} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--teal)', color: '#040b12', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: creando ? 'default' : 'pointer' }}>
          {creando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</> : <><Sparkles size={15} /> Generar enlace de invitación</>}
        </button>

        {generada && (
          <div style={{ marginTop: 14, padding: 12, background: 'color-mix(in srgb, var(--nexus) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--nexus) 25%, transparent)', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={14} className="ds-icon" /> Enlace listo</div>
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
                <button onClick={() => revocar(inv.code)} style={{ background: 'none', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', color: 'var(--red)', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer' }}>
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
              <div key={inv.code} style={{ fontSize: 12.5, color: 'var(--text2)', padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={13} className="ds-icon" style={{ color: 'var(--teal)', flexShrink: 0 }} /> {inv.nombreInvitado || '(Sin nombre)'} ({inv.role}) — aceptada {inv.usedAt ? new Date(inv.usedAt).toLocaleDateString('es-MX') : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}



/* ── Bloqueos de horario ─────────────────────────────────── */
function BloqueosTab({ clinicId, zonaHoraria }: { clinicId: string | null; zonaHoraria?: string }) {
  const { user } = useAuth()
  const { toast, confirm } = useToast()
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
      /**
       * LA HORA ES LA DEL CONSULTORIO, NO LA DEL NAVEGADOR.
       *
       * `new Date('2026-08-10T14:00')` interpreta ese texto en la zona de QUIEN
       * lo teclea. Todo lo que consume estos bloqueos ancla la hora de pared a
       * `config.zonaHoraria`, así que un médico creando el bloqueo desde otro
       * huso —de viaje, o simplemente con el equipo mal configurado— lo guardaba
       * corrido: escribía 14:00–18:00 y quedaba 13:00–17:00 del consultorio. Las
       * 17:00 seguían reservables y las 13:00 desaparecían.
       */
      const tz = zonaHoraria || TZ_CONSULTORIO_DEFECTO
      const aInstante = (v: string) => instanteMX(v.slice(0, 10), v.slice(11, 16), tz).toISOString()
      await crearBloque(clinicId, {
        desde: aInstante(desde),
        hasta: aInstante(hasta),
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
    if (!(await confirm("¿Eliminar este bloqueo? Los slots volverán a estar disponibles.", { peligro: true, confirmar: 'Eliminar' }))) return
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
                <button onClick={() => borrar(b.id)} style={{ background: "none", border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)", color: "var(--red)", borderRadius: 6, padding: "5px 10px", fontSize: 11.5, cursor: "pointer" }}>Eliminar</button>
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

  // Se siembra UNA sola vez. Sin la guarda, este efecto corría con cada emisión
  // del listener en vivo de la config: cualquier escritura al documento (otra
  // pestaña, el autoguardado de otra sección) BORRABA lo que el médico estaba
  // escribiendo en la nota del portal. El mismo archivo ya lo resuelve así con
  // formInitRef y rxKeyRef.
  const portalInitRef = useRef(false)
  useEffect(() => {
    if (portalInitRef.current || !config) return
    setEnabled(config.publicBookingEnabled !== false)
    setNote(config.publicBookingNote ?? '')
    portalInitRef.current = true
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
      {/* Perfil público /dr (foto, bio, cédula, precios) */}
      <PerfilPublicoSection clinicId={clinicId} />

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

        {/* Perfil público SEO — la página indexable por Google */}
        {clinicId && (
          <div style={{ marginTop: 14, padding: 14, background: 'var(--nexus-soft)', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--nexus) 30%, transparent)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Tu perfil público (aparece en Google)</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.5 }}>
              Página indexable con tu especialidad, servicios y reseñas (con estrellas en los resultados de búsqueda). Compártela en tu Instagram, tarjeta o firma de correo — es tu presencia propia, sin comisiones.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <code style={{ fontSize: 12, background: 'var(--s2)', padding: '6px 10px', borderRadius: 6, flex: 1, minWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{origin}/dr/{clinicId}</code>
              <button onClick={() => { navigator.clipboard?.writeText(`${origin}/dr/${clinicId}`); toast('Enlace copiado', 'success') }} className="btn btn-secondary btn-sm"><Copy size={13} /> Copiar</button>
              <a href={`/dr/${clinicId}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><ExternalLink size={13} /> Ver</a>
            </div>
          </div>
        )}

        {/* QR */}
        {qrUrl && (
          <div style={{ marginTop: 18, padding: 14, background: 'var(--s2)', borderRadius: 10, border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <QrCode size={14} className="ds-icon" /> QR para imprimir o pegar en el consultorio
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
      <div style={{ padding: 16, background: 'var(--nexus-soft)', border: '1px solid color-mix(in srgb, var(--nexus) 20%, transparent)', borderRadius: 12 }}>
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

  /*
    LOS HEX DE ESTOS FRAGMENTOS SE QUEDAN LITERALES, Y ES LA RAZÓN DE QUE
    EXISTAN (RTC-19).

    Este código se copia y se pega en el SITIO WEB DEL CONSULTORIO. Allí no
    existe `globals.css`, así que un `var(--nexus)` no resolvería: el médico
    pegaría un botón sin color en su propia página y no sabría por qué.

    Y las vistas previas de más abajo llevan el MISMO hex a propósito: una
    previsualización que se pinta con el token del producto enseñaría un botón
    distinto del que el médico va a pegar.

    Barrer estos literales «para terminar el trabajo» rompería un contrato
    externo sin que ninguna prueba de esta aplicación se pusiera roja.
  */
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
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Code size={15} className="ds-icon" /> Embeber en tu sitio web
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
              background: tipo === t.key ? 'var(--nexus-soft)' : 'var(--s2)',
              color: tipo === t.key ? 'var(--nexus)' : 'var(--text2)',
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
            style={{ position: 'absolute', bottom: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 8, background: '#14b8a6', color: '#000', fontWeight: 700, fontSize: 15, padding: '14px 22px', borderRadius: 'var(--r-pill)', textDecoration: 'none', boxShadow: '0 4px 16px rgba(20,184,166,.4)' }}
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
        <Lightbulb size={12} className="ds-icon" style={{ display: 'inline', verticalAlign: '-2px' }} /> Tip: Si usas <strong>WordPress</strong>, pega el código en un bloque <em>HTML personalizado</em>.
        En <strong>Wix/Squarespace</strong> busca el elemento &laquo;Código embebido&raquo;.
      </div>
    </div>
  )
}

/**
 * LO QUE EL DICTADO APRENDIÓ — y el botón para quitárselo.
 *
 * El sistema aprende las palabras que el médico corrige a mano más de una vez y
 * se las sugiere al reconocedor en la siguiente grabación. Aquí las ve, con
 * cuántas veces las corrigió y cómo se oían mal.
 *
 * **El botón de olvidar no es un adorno.** Un aprendizaje que no se puede
 * deshacer es peor que no aprender: si el sistema se queda con una palabra
 * torcida, la va a estar empujando en cada consulta y el médico no tendría cómo
 * pararlo.
 */
function DictadoAprendidoTab({ clinicId }: { clinicId: string | null }) {
  const [lista, setLista] = useState<PalabraAprendida[]>([])
  const [cargando, setCargando] = useState(true)
  const { toast } = useToast()

  /**
   * El estado nace en «cargando» y sólo se apaga cuando llega la respuesta.
   *
   * Nada de `setCargando(true)` dentro del efecto: llamar a `setState` de forma
   * síncrona ahí provoca un render en cascada —lo caza el trinquete de lint— y
   * además parpadea. Al recargar tras olvidar una palabra tampoco hace falta el
   * spinner: la lista simplemente se actualiza.
   */
  const cargar = useCallback(() => {
    if (!clinicId) return
    leerAprendido(clinicId).then(setLista).finally(() => setCargando(false))
  }, [clinicId])
  useEffect(() => { cargar() }, [cargar])

  // Sin consultorio no hay nada que cargar ni que esperar: se sale por lo que
  // se sabe, no apagando un estado desde dentro del efecto.
  if (clinicId && cargando) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Cargando…</div>

  return (
    <div>
      <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14 }}>
        Cuando corriges una palabra en el dictado más de una vez, el sistema se la aprende y
        se la sugiere al reconocedor en la siguiente grabación. <b>No reescribe nada</b>: sólo
        empuja hacia la palabra que tú usas. Nunca aprende cifras, unidades ni el nombre del paciente.
      </div>
      {lista.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Todavía no ha aprendido ninguna palabra. Aparecen aquí cuando corriges la misma dos veces.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lista.map(p => (
            <div key={p.palabra} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px',
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--s1)', fontSize: 13,
            }}>
              <b>{p.palabra}</b>
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>
                corregida {p.veces} {p.veces === 1 ? 'vez' : 'veces'}
                {p.oidoComo?.length ? ` · se oía como «${p.oidoComo.join('», «')}»` : ''}
              </span>
              <button
                onClick={async () => {
                  if (!clinicId) return
                  const ok = await olvidar(clinicId, p.palabra)
                  toast(ok ? `«${p.palabra}» olvidada` : 'No se pudo olvidar', ok ? 'success' : 'error')
                  if (ok) cargar()
                }}
                style={{
                  marginLeft: 'auto', background: 'none', border: '1px solid var(--border2)',
                  borderRadius: 6, color: 'var(--text2)', cursor: 'pointer', padding: '3px 9px', fontSize: 12,
                }}
              >
                Olvidar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
