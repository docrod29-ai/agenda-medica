'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Calendar, Clock, MapPin, Stethoscope, CheckCircle2, CalendarClock, XCircle,
  Loader2, Phone, CalendarPlus, ChevronRight, AlertTriangle,
} from 'lucide-react'

interface Cita {
  id: string
  fechaHora: string
  duracion: number
  tipo: string
  motivo?: string
  estado: string
  medicoNombre: string
  lugar?: string
  confirmadoPaciente: boolean
}
interface Sesion {
  paciente: string
  clinica: { nombre: string; medico: string; telefono: string; direccion: string } | null
  minHoras: number
  citas: Cita[]
}

const API = '/api/portal'

const ESTADO_TERMINAL = new Set(['atendida', 'finalizada', 'cancelada', 'no-asistio', 'reagendada'])
const TIPO_LABEL: Record<string, string> = {
  'primera-vez': 'Primera vez', 'seguimiento': 'Seguimiento', 'urgente': 'Urgente',
  'estudios': 'Revisión de estudios', 'teleconsulta': 'Teleconsulta',
  'prequirurgica': 'Val. prequirúrgica', 'procedimiento': 'Procedimiento', 'otro': 'Consulta',
}

function fmtFecha(fh: string): { dia: string; fecha: string; hora: string } {
  const d = new Date(fh.replace(' ', 'T') + ':00-06:00')
  const dia = d.toLocaleDateString('es-MX', { weekday: 'long', timeZone: 'America/Mexico_City' })
  const fecha = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' })
  const hora = fh.slice(11, 16)
  return { dia: dia.charAt(0).toUpperCase() + dia.slice(1), fecha, hora }
}

function gcalLink(c: Cita): string {
  const start = new Date(c.fechaHora.replace(' ', 'T') + ':00-06:00')
  const end = new Date(start.getTime() + (c.duracion || 30) * 60000)
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const txt = encodeURIComponent(`Cita médica — ${c.medicoNombre}`)
  const det = encodeURIComponent(c.motivo || TIPO_LABEL[c.tipo] || 'Consulta')
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${txt}&dates=${f(start)}/${f(end)}&details=${det}`
}

export default function MiPortalPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ''
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accion, setAccion] = useState<string>('') // id de cita con acción en curso
  const [reagendando, setReagendando] = useState<string>('') // id de cita en modo reagenda

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'session', token }) })
      if (!r.ok) { setError(r.status === 401 ? 'Este enlace ya no es válido o venció. Pide uno nuevo al consultorio.' : 'No pudimos cargar tu información.'); return }
      setSesion(await r.json())
    } catch {
      setError('Sin conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }, [token])

  useEffect(() => { cargar() }, [cargar])

  const accionCita = async (action: string, citaId: string, extra: Record<string, unknown> = {}) => {
    setAccion(citaId + action)
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token, citaId, ...extra }) })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { alert(data.error || 'No se pudo completar la acción.'); return false }
      await cargar()
      setReagendando('')
      return true
    } catch {
      alert('Sin conexión. Intenta de nuevo.')
      return false
    } finally {
      setAccion('')
    }
  }

  if (cargando) {
    return <Centro><Loader2 size={26} style={{ animation: 'spin 1s linear infinite', color: 'var(--nexus)' }} /><p style={{ color: 'var(--text3)', marginTop: 12 }}>Cargando tu información…</p></Centro>
  }
  if (error || !sesion) {
    return <Centro><AlertTriangle size={28} color="var(--amber)" /><p style={{ color: 'var(--text2)', marginTop: 12, maxWidth: 320 }}>{error || 'No encontramos tu información.'}</p></Centro>
  }

  const ahora = Date.now()
  const proximas = sesion.citas.filter(c => !ESTADO_TERMINAL.has(c.estado) && new Date(c.fechaHora.replace(' ', 'T') + ':00-06:00').getTime() > ahora)
  const pasadas = sesion.citas.filter(c => !proximas.includes(c)).reverse()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Encabezado */}
        <div style={{ marginBottom: 24 }}>
          <div className="t-overline" style={{ color: 'var(--nexus)' }}>{sesion.clinica?.nombre || 'Mi portal'}</div>
          <h1 className="t-display" style={{ marginTop: 4 }}>Hola{sesion.paciente ? `, ${sesion.paciente.split(' ')[0]}` : ''}</h1>
          <p style={{ color: 'var(--text3)', fontSize: 14, marginTop: 4 }}>Aquí puedes gestionar tus citas.</p>
        </div>

        {/* Próximas citas */}
        <h2 className="t-h2" style={{ marginBottom: 12 }}>Próximas citas</h2>
        {proximas.length === 0 ? (
          <div style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)', fontSize: 14, textAlign: 'center', background: 'var(--s1)' }}>
            No tienes citas próximas.
          </div>
        ) : proximas.map(c => {
          const f = fmtFecha(c.fechaHora)
          const editable = !ESTADO_TERMINAL.has(c.estado)
          return (
            <div key={c.id} style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 56, flexShrink: 0, textAlign: 'center', background: 'var(--nexus-soft)', borderRadius: 10, padding: '8px 4px' }}>
                  <div style={{ fontSize: 11, color: 'var(--nexus)', fontWeight: 700, textTransform: 'uppercase' }}>{f.fecha.split(' ')[2]?.slice(0, 3) || ''}</div>
                  <div className="t-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{f.fecha.split(' ')[0]}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{f.dia} · {f.hora}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Stethoscope size={13} className="ds-icon" /> {c.medicoNombre}</div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={13} className="ds-icon" /> {TIPO_LABEL[c.tipo] || 'Consulta'}{c.lugar ? ` · ${c.lugar}` : ''}</div>
                  {c.confirmadoPaciente && <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={13} className="ds-icon" /> Asistencia confirmada</div>}
                </div>
              </div>

              {editable && (
                <>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {!c.confirmadoPaciente && (
                      <button onClick={() => accionCita('confirmar', c.id)} disabled={!!accion} className="btn btn-primary btn-sm">
                        {accion === c.id + 'confirmar' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />} Confirmar
                      </button>
                    )}
                    <button onClick={() => setReagendando(reagendando === c.id ? '' : c.id)} disabled={!!accion} className="btn btn-secondary btn-sm">
                      <CalendarClock size={14} /> Reagendar
                    </button>
                    <button onClick={() => { if (confirm('¿Cancelar esta cita?')) accionCita('cancelar', c.id) }} disabled={!!accion} className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }}>
                      {accion === c.id + 'cancelar' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={14} />} Cancelar
                    </button>
                    <a href={gcalLink(c)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
                      <CalendarPlus size={14} /> Agendar
                    </a>
                  </div>
                  {reagendando === c.id && <PanelReagenda cita={c} token={token} onReagendado={(fh) => accionCita('reagendar', c.id, { nuevaFechaHora: fh })} ocupado={!!accion} />}
                </>
              )}
            </div>
          )
        })}

        {/* Pasadas */}
        {pasadas.length > 0 && (
          <details style={{ marginTop: 24 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text2)', fontSize: 14, fontWeight: 600, padding: '8px 0' }}>
              Citas anteriores ({pasadas.length})
            </summary>
            <div style={{ marginTop: 8 }}>
              {pasadas.map(c => {
                const f = fmtFecha(c.fechaHora)
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <div style={{ color: 'var(--text3)', minWidth: 110 }} className="t-num">{f.fecha}</div>
                    <div style={{ color: 'var(--text2)', flex: 1, textTransform: 'capitalize' }}>{TIPO_LABEL[c.tipo] || 'Consulta'} · {c.estado.replace('-', ' ')}</div>
                  </div>
                )
              })}
            </div>
          </details>
        )}

        {/* Pie: consultorio */}
        {sesion.clinica && (
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text3)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{sesion.clinica.nombre}</div>
            {sesion.clinica.direccion && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><MapPin size={13} className="ds-icon" /> {sesion.clinica.direccion}</div>}
            {sesion.clinica.telefono && <a href={`tel:${sesion.clinica.telefono}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--nexus)' }}><Phone size={13} className="ds-icon" /> {sesion.clinica.telefono}</a>}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function PanelReagenda({ cita, token, onReagendado, ocupado }: { cita: Cita; token: string; onReagendado: (fh: string) => void; ocupado: boolean }) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const [fecha, setFecha] = useState(hoy)
  const [slots, setSlots] = useState<string[] | null>(null)
  const [cargandoSlots, setCargandoSlots] = useState(false)

  const buscar = useCallback(async (f: string) => {
    setCargandoSlots(true); setSlots(null)
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'slots', token, citaId: cita.id, fecha: f }) })
      const data = await r.json().catch(() => ({ slots: [] }))
      setSlots(data.slots || [])
    } finally {
      setCargandoSlots(false)
    }
  }, [token, cita.id])

  useEffect(() => { buscar(fecha) }, [fecha, buscar])

  return (
    <div style={{ marginTop: 14, padding: 14, background: 'var(--s2)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><CalendarClock size={14} className="ds-icon" /> Elige un nuevo horario</div>
      <input type="date" value={fecha} min={hoy} onChange={e => setFecha(e.target.value)} className="input" style={{ marginBottom: 12 }} />
      {cargandoSlots ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Buscando horarios…</div>
      ) : slots && slots.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>No hay horarios libres ese día. Prueba otra fecha.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
          {slots?.map(s => (
            <button key={s} onClick={() => onReagendado(`${fecha} ${s}`)} disabled={ocupado} className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}>
              <Clock size={12} /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      {children}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
