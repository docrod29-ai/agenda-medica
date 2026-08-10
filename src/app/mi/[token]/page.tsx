'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Calendar, Clock, MapPin, Stethoscope, CheckCircle2, CalendarClock, XCircle,
  Loader2, Phone, CalendarPlus, AlertTriangle, Download, Pill, ShieldCheck, CreditCard, Video,
  Home, MessageCircle, HeartPulse, FileText, User,
} from 'lucide-react'
import { descargarRecetaWord } from '@/lib/receta-word'
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'
import { fechaFlexible } from '@/lib/portal/fechas'
import { ventanaDeSala, enlaceSalaPaciente } from '@/lib/telesalud/ventana-sala'
import { CAMPOS_PREVIOS, MAX_CARACTERES, AVISO_URGENCIA } from '@/lib/portal/formulario-previo'
import type { Medicamento } from '@/types/expediente'

interface DocReceta {
  id: string
  fecha: string
  medico: string
  diagnostico: string
  medicamentos: Medicamento[]
}

const RECETA_CONFIG_DEFAULT = {
  paperSize: 'media-carta' as const,
  estilo: 'minimalista' as const,
  colorAccento: '#3D5AFE',
  mostrarQR: false,
  vigenciaDias: 30,
  mostrarAlergias: false,
  mostrarDiagnostico: true,
  avisoLegal: 'Esta receta es personal e intransferible.',
}

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
  /** Para armar el enlace de la sala de teleconsulta. */
  clinicId?: string
  clinica: { nombre: string; medico: string; telefono: string; direccion: string } | null
  minHoras: number
  anticipo: { link: string; monto: number } | null
  citas: Cita[]
  /** Zona del consultorio: las horas de las citas son hora de pared, sin offset. */
  zonaHoraria?: string
}

const API = '/api/portal'

/**
 * LOS CINCO DESTINOS DEL COMPAÑERO — TODAY · ASK NEXUS · CARE · DOCUMENTS · PROFILE.
 *
 * Los ids vienen de `lib/paciente/paquete-de-visita`, que es donde los declara
 * el modelo, para que la pantalla y el servidor no puedan discrepar sobre
 * cuántos destinos hay ni cómo se llaman.
 */
const DESTINOS = [
  { id: 'hoy' as const,        etiqueta: 'Hoy',        icono: Home },
  { id: 'preguntar' as const,  etiqueta: 'Preguntar',  icono: MessageCircle },
  { id: 'cuidado' as const,    etiqueta: 'Cuidado',    icono: HeartPulse },
  { id: 'documentos' as const, etiqueta: 'Documentos', icono: FileText },
  { id: 'perfil' as const,     etiqueta: 'Perfil',     icono: User },
]

const ESTADO_TERMINAL = new Set(['atendida', 'finalizada', 'cancelada', 'no-asistio', 'reagendada'])
const TIPO_LABEL: Record<string, string> = {
  'primera-vez': 'Primera vez', 'seguimiento': 'Seguimiento', 'urgente': 'Urgente',
  'estudios': 'Revisión de estudios', 'teleconsulta': 'Teleconsulta',
  'prequirurgica': 'Val. prequirúrgica', 'procedimiento': 'Procedimiento', 'otro': 'Consulta',
}

/**
 * Fecha legible para el paciente.
 *
 * Tolera los DOS formatos que llegan aquí —la hora de pared de una cita y el
 * ISO de una nota— porque la pantalla los mezcla. Lo que no se entiende se dice
 * («sin fecha»), en vez de imprimir «Invalid Date», que es lo que hacía.
 */
function fmtFecha(fh: string, tz = 'America/Mexico_City'): { dia: string; fecha: string; hora: string } {
  const d = fechaFlexible(fh, tz)
  if (!d) return { dia: '', fecha: 'Sin fecha', hora: '' }
  const dia = d.toLocaleDateString('es-MX', { weekday: 'long', timeZone: tz })
  const fecha = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: tz })
  const hora = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(fh)
    ? fh.slice(11, 16)
    : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  return { dia: dia.charAt(0).toUpperCase() + dia.slice(1), fecha, hora }
}

function gcalLink(c: Cita, tz: string): string {
  // El evento que el paciente se guarda en su calendario: con el offset fijo,
  // un consultorio fuera del centro se lo agendaba a la hora equivocada.
  const start = instanteMX(c.fechaHora.slice(0, 10), c.fechaHora.slice(11, 16), tz)
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
  const [docs, setDocs] = useState<DocReceta[] | null>(null)
  const [docsBloqueados, setDocsBloqueados] = useState(false)
  const [cargando, setCargando] = useState(true)
  /** La frontera entre «próximas» y «pasadas», congelada al abrir. Ver abajo. */
  const [ahora] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [accion, setAccion] = useState<string>('') // id de cita con acción en curso
  const [reagendando, setReagendando] = useState<string>('') // id de cita en modo reagenda
  /** Pago del anticipo: se abre el Checkout de Stripe atado a la cita. */
  const [pagando, setPagando] = useState(false)
  const [errorPago, setErrorPago] = useState('')
  const [destino, setDestino] = useState<(typeof DESTINOS)[number]['id']>('hoy')

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'session', token }) })
      if (!r.ok) { setError(r.status === 401 ? 'Este enlace ya no es válido o venció. Pide uno nuevo al consultorio.' : 'No pudimos cargar tu información.'); return }
      setSesion(await r.json())
      // Documentos (recetas) en paralelo — no bloquea la vista de citas
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'documentos', token }) })
        .then(res => {
          // E0-06: 403 = el enlace no tiene alcance clínico (lo generó el mostrador,
          // no el médico). No es un error de red ni «no tienes recetas»: se dice.
          if (res.status === 403) { setDocsBloqueados(true); return { documentos: [] } }
          return res.ok ? res.json() : { documentos: [] }
        })
        .then(d => setDocs(d.documentos || []))
        .catch(() => setDocs([]))
    } catch {
      setError('Sin conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }, [token])

  useEffect(() => { cargar() }, [cargar])

  // Título de pestaña con la marca de la clínica (confianza)
  useEffect(() => {
    const nombre = sesion?.clinica?.nombre
    document.title = nombre ? `Mi portal · ${nombre}` : 'Mi portal'
  }, [sesion?.clinica?.nombre])

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

  /**
   * Manda al Checkout de Stripe ATADO a la cita. El monto lo pone el servidor
   * —nunca el navegador del paciente—, y el webhook deja el cobro y el estado.
   */
  const pagarAnticipo = async (cita: Cita) => {
    setPagando(true); setErrorPago('')
    try {
      const r = await fetch('/api/payment/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, citaId: cita.id }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d?.url) { window.location.assign(String(d.url)); return }
      // Se DICE por qué no se pudo, en vez de abrir un enlace suelto haciendo
      // creer que el pago quedó ligado a la cita.
      setErrorPago(d?.error || 'No se pudo abrir el pago en línea.')
    } catch {
      setErrorPago('No se pudo abrir el pago en línea. Revisa tu conexión.')
    } finally { setPagando(false) }
  }

  const descargarReceta = (doc: DocReceta) => {
    /**
     * La fecha de la receta viene de `nota.fechaConsulta`, que es un ISO
     * completo — no la hora de pared de una cita. Parsearla como pared daba
     * `Invalid Date`, y `toISOString()` lanzaba `RangeError`: el botón no
     * descargaba nada y el paciente no veía ningún error.
     */
    const fechaDoc = fechaFlexible(doc.fecha, tzClinica)
    if (!fechaDoc) { alert('Esta receta no tiene una fecha válida. Pídesela al consultorio.'); return }
    descargarRecetaWord(
      {
        tipo: 'receta',
        folio: `RX-${doc.id.slice(-7).toUpperCase()}`,
        fecha: fechaDoc,
        pacienteNombre: sesion.paciente,
        diagnostico: doc.diagnostico || undefined,
        medicamentos: doc.medicamentos,
      },
      null,
      RECETA_CONFIG_DEFAULT,
    )
  }

  /**
   * La hora se congela al abrir la pantalla, no se relee en cada pintado.
   *
   * Es la frontera entre «próximas» y «pasadas». Leída del reloj en el cuerpo
   * del componente, una cita justo en el límite podía saltar de una lista a la
   * otra sola, delante del paciente — y para él eso se ve como que su cita
   * desapareció.
   */
  const tzClinica = sesion.zonaHoraria || TZ_DEFAULT
  const proximas = sesion.citas.filter(c => !ESTADO_TERMINAL.has(c.estado) && instanteMX(c.fechaHora.slice(0, 10), c.fechaHora.slice(11, 16), tzClinica).getTime() > ahora)
  const pasadas = sesion.citas.filter(c => !proximas.includes(c)).reverse()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '24px 16px 96px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Encabezado */}
        <div style={{ marginBottom: 24 }}>
          <div className="t-overline" style={{ color: 'var(--nexus)' }}>{sesion.clinica?.nombre || 'Mi portal'}</div>
          <h1 className="t-display" style={{ marginTop: 4 }}>Hola{sesion.paciente ? `, ${sesion.paciente.split(' ')[0]}` : ''}</h1>
          <p style={{ color: 'var(--text3)', fontSize: 14, marginTop: 4 }}>Aquí puedes gestionar tus citas.</p>
        </div>

        {destino === 'hoy' && (<>
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

              {/*
                LA PUERTA DE LA VIDEOCONSULTA, QUE EL PACIENTE NO TENÍA.
                La teleconsulta se agenda, se cobra y el consultorio tiene su
                botón «Unirse»; aquí `teleconsulta` era sólo una etiqueta en el
                mapa de tipos. Ni la confirmación ni los recordatorios llevan el
                enlace de la sala: se podía vender una videoconsulta a la que el
                paciente no podía llegar.
                La ventana (30 min antes, 2 h después) es la MISMA que aplica el
                servidor al crear la sala; un botón que abre una sala caducada es
                peor que no tener botón, porque el paciente cree que el problema
                es suyo. Ver `lib/telesalud/ventana-sala.ts`.
              */}
              {c.tipo === 'teleconsulta' && (() => {
                const v = ventanaDeSala(c.fechaHora, ahora, tzClinica)
                return v.estado === 'abierta' ? (
                  <a
                    /* El token del propio portal: el paciente ya está
                       autenticado con él en esta pantalla, y `/api/telesalud/sala`
                       lo exige del otro lado. Sin propagarlo, este botón
                       contestaba «Cita no encontrada». */
                    href={enlaceSalaPaciente(c.id, sesion.clinicId ?? '', token)}
                    target="_blank" rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', marginTop: 14 }}
                  >
                    <Video size={14} /> Entrar a la videoconsulta
                  </a>
                ) : (
                  <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Video size={13} className="ds-icon" /> {v.mensaje}
                  </div>
                )
              })()}

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
                    <a href={gcalLink(c, tzClinica)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
                      <CalendarPlus size={14} /> Agendar
                    </a>
                  </div>
                  {reagendando === c.id && <PanelReagenda cita={c} token={token} onReagendado={(fh) => accionCita('reagendar', c.id, { nuevaFechaHora: fh })} ocupado={!!accion} />}
                </>
              )}
            </div>
          )
        })}

        {/*
          FORMULARIO PREVIO A LA CONSULTA (P-019).
          Lo llena el paciente con calma en su casa; en la consulta el médico
          reconstruye a las prisas lo que aquí se escribe sin presión. NO toca su
          expediente: es su declaración, y el médico decide qué pasa a la nota.
        */}
        {proximas.length > 0 && <FormularioPrevio token={token} />}

        {/*
          ANTICIPO — el botón que decía «Asegura tu lugar» y no aseguraba nada.
          Abría un enlace externo suelto: sin retorno, sin webhook, sin cambio de
          estado y sin cobro registrado. El paciente pagaba y su cita seguía
          exactamente igual — y el importe del cartel podía no ser el que cobraba
          el enlace, porque eran dos números distintos.
          La ruta que SÍ lo registra (`/api/payment/create-checkout`) existía y no
          la llamaba nadie: lee el monto en el SERVIDOR, ata el pago a la cita y
          su webhook deja el cobro y el estado. Ahora se usa ésa, y el enlace
          externo queda sólo como respaldo declarado.
        */}
        {sesion.anticipo && proximas.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              disabled={!!pagando}
              onClick={() => pagarAnticipo(proximas[0])}
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: pagando ? 'default' : 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--nexus-soft)', border: '1px solid color-mix(in srgb, var(--nexus) 30%, transparent)', borderRadius: 12, padding: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--nexus-solido)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CreditCard size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    Pagar anticipo{sesion.anticipo.monto > 0 ? ` · $${sesion.anticipo.monto} MXN` : ''}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>
                    Se aplica a tu próxima cita y queda registrado en el consultorio
                  </div>
                </div>
                <span style={{ color: 'var(--nexus)', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                  {pagando ? 'Abriendo…' : 'Pagar →'}
                </span>
              </div>
            </button>
            {errorPago && (
              <div style={{ fontSize: 12.5, color: 'var(--amber)', marginTop: 8, lineHeight: 1.5 }}>
                {errorPago}
                {sesion.anticipo.link && (
                  <> <a href={sesion.anticipo.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--nexus)' }}>Pagar por el enlace del consultorio</a> — avísales para que lo registren.</>
                )}
              </div>
            )}
          </div>
        )}

        </>)}
        {destino === 'preguntar' && (<>
          {/*
            ASK NEXUS TODAVÍA NO RESPONDE, Y ESO ES LO CORRECTO HOY.

            La especificación es explícita en que esto NO es un chatbot médico
            genérico, sino «inteligencia acotada al plan de cuidado»: cada
            respuesta clasificada, y todo dato específico del paciente sostenido
            en material que su médico aprobó. Eso llega en PATIENT-AI-001.

            Mientras tanto **la escalación es el producto, no el fallo** (§3 de
            la regla de IA de cara al paciente). Poner aquí un cuadro de texto
            que conteste «lo que sea» sería justo lo que la regla prohíbe, y se
            lo diría a alguien que no puede detectar el error.
          */}
          <h2 className="t-h2" style={{ marginBottom: 12 }}>Preguntar</h2>
          <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)' }}>
            <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
              Si tienes una duda sobre tu tratamiento, escríbele a tu consultorio.
              Quien te responde es el equipo de tu médico.
            </p>
            {sesion.clinica?.telefono && (
              <a href={`tel:${sesion.clinica.telefono}`} className="btn btn-primary btn-sm"
                 style={{ display: 'inline-flex', marginTop: 14 }}>
                Llamar al consultorio
              </a>
            )}
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 14, marginBottom: 0 }}>
              Si es una urgencia —dolor en el pecho, dificultad para respirar,
              síntomas neurológicos— no esperes respuesta por aquí: acude a
              urgencias o llama al 911.
            </p>
          </div>
        </>)}
        {destino === 'cuidado' && (<>
          {/*
            LO QUE TU MÉDICO LIBERÓ de cada consulta. Sólo aparecen los paquetes
            RELEASED: el servidor filtra con `visibleParaElPaciente` y un
            borrador no sale de ahí (REG-304). Hoy nada los crea todavía — la
            pantalla del médico para liberarlos llega en POSTVISIT-001 — así que
            el estado vacío dice la verdad en vez de fingir que no hay nada.
          */}
          <h2 className="t-h2" style={{ marginBottom: 12 }}>Tu plan de cuidado</h2>
          <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 24 }}>
            <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0, lineHeight: 1.6 }}>
              Cuando tu médico libere el resumen de una consulta, lo verás aquí:
              tus medicamentos con instrucciones en palabras sencillas, los
              estudios que te pidió y cuándo volver.
            </p>
          </div>
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

        </>)}
        {destino === 'documentos' && (<>
        {/* Mis recetas — enlace sin alcance clínico (E0-06) */}
        {docsBloqueados && (
          <div style={{ marginTop: 28, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--text3)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Mis recetas</div>
            Este enlace sirve para tus citas. Pide a tu médico el acceso a tus recetas.
          </div>
        )}

        {/* Mis recetas */}
        {docs && docs.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h2 className="t-h2" style={{ marginBottom: 12 }}>Mis recetas</h2>
            {docs.map(d => {
              const f = fmtFecha(d.fecha)
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--nexus-soft)', color: 'var(--nexus)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Pill size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }} className="t-num">{f.fecha}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.diagnostico || `${d.medicamentos.length} medicamento(s)`}{d.medico ? ` · ${d.medico}` : ''}
                    </div>
                  </div>
                  <button onClick={() => descargarReceta(d)} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                    <Download size={14} /> Descargar
                  </button>
                </div>
              )
            })}
          </div>
        )}

        </>)}
        {destino === 'perfil' && (<>
          {/*
            LO QUE TODAVÍA NO HAY, DICHO EN VOZ ALTA.

            La especificación pide cambiar el idioma y gestionar el acceso de un
            cuidador autorizado. Ninguna de las dos existe: el producto está fijo
            en es-MX (`lib/i18n.ts` está escrito y no lo importa nadie) y el
            token del portal ata a UN paciente, sin concepto de cuidador.

            Se enseña el estado real en vez de un control que no hace nada. Un
            selector de idioma con un solo idioma, o un botón de cuidador que no
            autoriza a nadie, le mienten al paciente sobre lo que puede esperar —
            y en una pantalla de salud eso se paga en confianza.
          */}
          <h2 className="t-h2" style={{ marginBottom: 12 }}>Tu perfil</h2>
          <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
              <span style={{ color: 'var(--text2)' }}>Idioma</span>
              <span style={{ color: 'var(--text3)' }}>Español (México)</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
              Este enlace es personal y caduca en unos días. Si necesitas que otra
              persona te ayude con tus citas, pídeselo al consultorio: todavía no
              podemos darle acceso desde aquí.
            </p>
          </div>
        {/* Pie: consultorio */}
        {sesion.clinica && (
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text3)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{sesion.clinica.nombre}</div>
            {sesion.clinica.direccion && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><MapPin size={13} className="ds-icon" /> {sesion.clinica.direccion}</div>}
            {sesion.clinica.telefono && <a href={`tel:${sesion.clinica.telefono}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--nexus)' }}><Phone size={13} className="ds-icon" /> {sesion.clinica.telefono}</a>}
          </div>
        )}

        {/* Confianza */}
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11.5, color: 'var(--text3)' }}>
          <ShieldCheck size={13} className="ds-icon" /> Acceso privado y seguro · Ausculta
        </div>
        </>)}

        {/*
          LOS CINCO DESTINOS — móvil primero.

          La especificación fija un máximo de 4-5 destinos primarios en móvil, y
          cinco es el techo, no el objetivo. Van fijos abajo porque esta pantalla
          se usa con una mano, de pie, en la sala de espera.
        */}
        <nav aria-label="Secciones" style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20,
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          background: 'var(--s1)', borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          {DESTINOS.map(d => {
            const activo = destino === d.id
            return (
              <button key={d.id} onClick={() => setDestino(d.id)}
                aria-current={activo ? 'page' : undefined}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '10px 4px', minHeight: 56,
                  color: activo ? 'var(--nexus)' : 'var(--text3)',
                }}>
                <d.icono size={20} aria-hidden />
                <span style={{ fontSize: 'var(--t-overline)' }}>{d.etiqueta}</span>
              </button>
            )
          })}
        </nav>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(72px, 100%), 1fr))', gap: 8 }}>
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


/**
 * FORMULARIO PREVIO A LA CONSULTA.
 *
 * Preguntas abiertas a propósito: encasillar las respuestas sería decidir por el
 * médico qué es relevante. Y nada de esto puntúa ni calcula: es una declaración
 * del paciente, no una valoración.
 */
function FormularioPrevio({ token }: { token: string }) {
  const [abierto, setAbierto] = useState(false)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const enviar = async () => {
    setEnviando(true); setError('')
    try {
      const r = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'formulario', token, respuestas: valores }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok) { setEnviado(true); setAbierto(false) }
      else setError(d.error || 'No se pudo guardar. Intenta de nuevo.')
    } catch {
      setError('Sin conexión. Intenta de nuevo.')
    } finally { setEnviando(false) }
  }

  if (enviado) {
    return (
      <div style={{ marginTop: 16, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <CheckCircle2 size={18} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>
          Gracias, tu médico lo verá antes de la consulta. Puedes volver a llenarlo si algo cambia.
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Cuéntale a tu médico antes de la consulta</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
          Con calma, desde tu casa. Le ayuda a aprovechar mejor el tiempo contigo.
        </div>
      </button>

      {abierto && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--amber)', lineHeight: 1.5 }}>{AVISO_URGENCIA}</div>
          {CAMPOS_PREVIOS.map(c => (
            <div key={c.clave}>
              <label htmlFor={`fp-${c.clave}`} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {c.etiqueta}
              </label>
              {'ayuda' in c && c.ayuda && (
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 5 }}>{c.ayuda}</div>
              )}
              <textarea
                id={`fp-${c.clave}`}
                rows={'largo' in c && c.largo ? 3 : 1}
                maxLength={MAX_CARACTERES}
                value={valores[c.clave] ?? ''}
                onChange={e => setValores(v => ({ ...v, [c.clave]: e.target.value }))}
                style={{ width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 14, resize: 'vertical' }}
              />
            </div>
          ))}
          {error && <div style={{ fontSize: 13, color: 'var(--red)' }}>{error}</div>}
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !Object.values(valores).some(v => v.trim())}
            className="btn btn-primary btn-sm"
            style={{ alignSelf: 'flex-start' }}
          >
            {enviando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />} Enviar a mi médico
          </button>
        </div>
      )}
    </div>
  )
}
