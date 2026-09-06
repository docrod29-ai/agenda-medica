'use client'
import { conMayusculaInicial } from '@/lib/texto-es'
import { FECHA_MAXIMA_AGENDA } from '@/lib/agenda/horizonte'
import { useEffect, useId, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Calendar, Clock, MapPin, Stethoscope, CheckCircle2, CalendarClock, XCircle,
  Loader2, Phone, CalendarPlus, AlertTriangle, Download, Pill, ShieldCheck, CreditCard, Video,
  Home, MessageCircle, HeartPulse, FileText, User, Send, Quote,
} from 'lucide-react'
import { descargarRecetaWord } from '@/lib/receta-word'
import { instanteMX, TZ_DEFAULT } from '@/lib/timezone'
import { fechaFlexible } from '@/lib/portal/fechas'
import { ventanaDeSala, enlaceSalaPaciente } from '@/lib/telesalud/ventana-sala'
import { CAMPOS_PREVIOS, MAX_CARACTERES, AVISO_URGENCIA } from '@/lib/portal/formulario-previo'
import { TELEFONO_EMERGENCIAS } from '@/lib/paciente/urgencia'
import ViaDeUrgencia from '@/components/portal/ViaDeUrgencia'
import type { Medicamento } from '@/types/expediente'

interface DocReceta {
  id: string
  fecha: string
  /** Del snapshot de firma de la nota, no de la configuración viva. Ver la ruta. */
  medico: string
  cedulaProfesional: string
  especialidad: string
  diagnostico: string
  /**
   * SÓLO lo que el médico prescribió de verdad. La ruta ya aplicó
   * `medicamentosDeLaReceta`: aquí no llegan antecedentes, borradores de la IA,
   * suspendidos ni órdenes vencidas sin revisar (H-01).
   */
  medicamentos: Medicamento[]
}

const RECETA_CONFIG_DEFAULT = {
  paperSize: 'media-carta' as const,
  estilo: 'minimalista' as const,
  colorAccento: 'var(--nexus)',
  mostrarQR: false,
  vigenciaDias: 30,
  /**
   * SE DECIDE AL DESCARGAR, NO AQUÍ — H-01.
   *
   * Estaba fijo en `false`, así que la copia del paciente era la única receta
   * del producto sin el recuadro de alergias: la misma alergia que el impreso
   * del médico destaca en rojo desaparecía del documento que el paciente lleva
   * a la farmacia. Y encenderlo sin más habría sido peor —`receta-word` imprime
   * «Sin registro en el expediente» cuando no le mandan el campo—, que es
   * afirmar una ausencia que nadie comprobó.
   *
   * Ahora manda `alergiasLeidas`: se enseña cuando el expediente se pudo leer,
   * y se calla cuando no. Error ≠ ausencia.
   */
  mostrarAlergias: false,
  mostrarDiagnostico: true,
  avisoLegal: 'Esta receta es personal e intransferible.',
}

/**
 * EL PAQUETE DE LA VISITA, TAL COMO LLEGA DEL SERVIDOR.
 *
 * Sólo llegan los `RELEASED`: `/api/portal` los filtra con
 * `visibleParaElPaciente` antes de responder, así que esta pantalla no puede
 * pintar un borrador ni equivocándose. La compuerta vive en el servidor porque
 * esconder una pestaña no cierra una ruta HTTP.
 */
/**
 * Una pregunta ya hecha, tal como la devuelve el servidor.
 *
 * NO trae `motivo` — el servidor no se lo manda al paciente, y este tipo lo
 * refleja: saber que su frase encajó en `cambio_de_dosis` no le sirve y le
 * enseña a esquivar el clasificador. El motivo es para el consultorio.
 */
interface PreguntaHecha {
  id: string
  /** Lo que preguntó el paciente. */
  texto: string
  /** Lo que se le contestó, CONGELADO — no se recalcula al leerlo. */
  respuesta: string
  clase: string
  procedencia: { fechaConsulta?: string; version?: number } | null
  escalada: boolean
  atendidaEn: number | null
  creadaEn: number
}

interface PaqueteVisible {
  id: string
  fechaConsulta: string
  encounterSummary: string
  medicationInstructions: { nombre: string; instruccion: string }[]
  /** `null` = no se pudo saber qué había antes. NO es «no hubo cambios». */
  medicationChanges: { nombre: string; tipo: 'nuevo' | 'suspendido' | 'sin-cambio' }[] | null
  orders: string[]
  followUp: string
  warningSigns: string[]
  /** Lo que el médico indicó, en sus palabras (PC-020, MO-016). */
  indicaciones?: string[]
  /** `null` = el expediente no se pudo leer. Entonces no se dice NADA de alergias. */
  alergias: string | null
  prescriptor: { nombre: string; cedulaProfesional: string; especialidad: string }
  clinicianContactRules: string
  version: number
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
interface CuidadorEnPantalla {
  id: string
  nombre: string
  parentesco: string
  alcance: 'agenda' | 'clinico'
  autorizadoEn: string
  ultimoAccesoEn: string | null
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
  /**
   * QUÉ ABRE ESTE ENLACE — PP-005.
   *
   * La pantalla enseñaba lo mismo con cualquier enlace y dejaba que el servidor
   * contestara 403 pestaña por pestaña. Ahora lo sabe desde el principio y lo
   * dice: un enlace de un solo documento no finge ser el portal entero.
   */
  alcance?: 'agenda' | 'clinico' | 'documento'
  documentoDelEnlace?: string | null
  cuidadorId?: string | null
  cuidadores?: CuidadorEnPantalla[]
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
  { id: 'hoy' as const,        etiqueta: 'Hoy',        icono: Home,          pista: 'Tus citas: confirmar, reagendar o cancelar.' },
  { id: 'preguntar' as const,  etiqueta: 'Preguntar',  icono: MessageCircle, pista: 'Cómo hablar con el equipo de tu médico.' },
  { id: 'cuidado' as const,    etiqueta: 'Cuidado',    icono: HeartPulse,    pista: 'Lo que tu médico te dejó de cada consulta.' },
  { id: 'documentos' as const, etiqueta: 'Documentos', icono: FileText,      pista: 'Tus recetas, para descargar y llevar.' },
  { id: 'perfil' as const,     etiqueta: 'Perfil',     icono: User,          pista: 'Tu enlace, tu consultorio y tus datos.' },
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
  return { dia: conMayusculaInicial(dia), fecha, hora }
}

/**
 * EL EVENTO QUE EL PACIENTE SE GUARDA EN SU CALENDARIO.
 *
 * ── PO-010 · MG-012 · PC-008 — EL MOTIVO CLÍNICO IBA EN LA URL ─────────────
 *
 * `details=${encodeURIComponent(c.motivo || …)}` mandaba a Google, en un
 * PARÁMETRO DE URL, lo que el consultorio escribió como motivo de la cita:
 * «control prenatal», «interrupción», «valoración de VIH», «ajuste de
 * metformina». `security-tenant.md` no deja lugar a interpretación: PHI nunca
 * en logs, nunca en parámetros de URL, nunca en un mensaje de error.
 *
 * El servidor ya no manda el motivo con alcance `agenda` (ver `route.ts`), pero
 * eso no bastaría: con alcance clínico seguiría saliendo, y la regla no
 * distingue alcances. Aquí el `details` es el TIPO de cita, que es dato
 * administrativo —«Seguimiento», «Primera vez»— y es lo que el paciente
 * necesita para reconocer el evento en su calendario.
 *
 * Lo que se pierde y por qué no importa: el paciente ya sabe a qué va. Quien no
 * lo sabe es Google.
 */
function gcalLink(c: Cita, tz: string): string {
  // Con el offset fijo, un consultorio fuera del centro se lo agendaba a la
  // hora equivocada.
  const start = instanteMX(c.fechaHora.slice(0, 10), c.fechaHora.slice(11, 16), tz)
  const end = new Date(start.getTime() + (c.duracion || 30) * 60000)
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const txt = encodeURIComponent(`Cita médica — ${c.medicoNombre}`)
  const det = encodeURIComponent(TIPO_LABEL[c.tipo] || 'Consulta')
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${txt}&dates=${f(start)}/${f(end)}&details=${det}`
}

export default function MiPortalPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ''
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [docs, setDocs] = useState<DocReceta[] | null>(null)
  const [docsBloqueados, setDocsBloqueados] = useState(false)
  /**
   * NO SE PUDO LEER ≠ NO HAY NADA — H-01.
   *
   * Un fallo de red o de servidor acababa en `setDocs([])`, y como la lista sólo
   * se pinta cuando trae algo, el paciente veía una pantalla sin recetas: la
   * misma imagen exacta que «tu médico no te ha recetado nada». De ahí sale que
   * alguien deje de tomar un antibiótico porque «ya no aparece».
   */
  const [docsError, setDocsError] = useState(false)
  /**
   * Las alergias del expediente y si SE PUDIERON LEER. Las dos cosas, porque la
   * receta sólo puede hablar de alergias cuando la segunda es cierta.
   */
  const [alergias, setAlergias] = useState('')
  const [alergiasLeidas, setAlergiasLeidas] = useState(false)
  /**
   * LO QUE TU MÉDICO LIBERÓ. `null` mientras no se sabe; `[]` cuando se leyó y
   * no hay ninguno. Y `paquetesError` aparte, por lo mismo que `docsError`: una
   * lista vacía por un fallo de red se lee como «mi médico no me dejó nada», y
   * de ahí sale alguien que no empieza el antibiótico que sí le recetaron.
   */
  const [paquetes, setPaquetes] = useState<PaqueteVisible[] | null>(null)
  const [paquetesError, setPaquetesError] = useState(false)
  const [paquetesBloqueados, setPaquetesBloqueados] = useState(false)
  const [cargando, setCargando] = useState(true)
  /** La frontera entre «próximas» y «pasadas», congelada al abrir. Ver abajo. */
  const [ahora] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [accion, setAccion] = useState<string>('') // id de cita con acción en curso
  const [reagendando, setReagendando] = useState<string>('') // id de cita en modo reagenda
  /** id de la cita cuya cancelación se está confirmando en la propia pantalla. */
  const [cancelando, setCancelando] = useState<string>('')
  /**
   * LO QUE NO SE PUDO HACER, ESCRITO EN LA PANTALLA — no en un `alert()`.
   *
   * Tres fallos se contaban con el diálogo nativo del navegador. El paciente
   * toca «Aceptar» y la pantalla queda EXACTAMENTE igual que si hubiera
   * funcionado: no hay forma de saber después si su cita se canceló o no. Un
   * aviso que se puede cerrar sin dejar rastro no es un aviso de error, es un
   * error escondido detrás de un botón.
   */
  const [avisoAccion, setAvisoAccion] = useState('')
  /** Pago del anticipo: se abre el Checkout de Stripe atado a la cita. */
  const [pagando, setPagando] = useState(false)
  const [errorPago, setErrorPago] = useState('')
  const [destino, setDestino] = useState<(typeof DESTINOS)[number]['id']>('hoy')

  /**
   * PREGUNTAR — V9 · PATIENT-AI-001.
   *
   * `preguntas` es el historial que devuelve el servidor. Existe para que una
   * respuesta **sobreviva a recargar**: la especificación pone la pérdida de
   * estado entre las prioridades más altas, y el paciente está en un teléfono
   * que se bloquea solo. Una respuesta que sólo vive en la memoria de la
   * pestaña se pierde en el primer bloqueo de pantalla.
   *
   * `null` mientras no se sabe; `[]` cuando se leyó y no hay ninguna. Y el
   * error aparte, por lo mismo que `docsError`.
   */
  const [cuidadores, setCuidadores] = useState<CuidadorEnPantalla[]>([])
  const [enlaceNuevo, setEnlaceNuevo] = useState('')
  const [recetaAbierta, setRecetaAbierta] = useState('')
  const [enlaceDocumento, setEnlaceDocumento] = useState<Record<string, string>>({})
  const [confirmandoCierre, setConfirmandoCierre] = useState(false)
  const [cerrado, setCerrado] = useState(false)
  const [trabajandoAcceso, setTrabajandoAcceso] = useState(false)
  const [preguntas, setPreguntas] = useState<PreguntaHecha[] | null>(null)
  const [preguntasBloqueadas, setPreguntasBloqueadas] = useState(false)
  const [borrador, setBorrador] = useState('')
  const [enviandoPregunta, setEnviandoPregunta] = useState(false)
  const [errorPregunta, setErrorPregunta] = useState('')
  const idPregunta = useId()

  /**
   * UNA SOLA PETICIÓN POR APERTURA — PC-006 · PO-008 · PP-010 · PI-025.
   *
   * Esto pedía CUATRO cosas en paralelo (`session`, `documentos`, `paquetes`,
   * `preguntas`). Tres de las cuatro cuentan contra la ventana clínica —quince
   * en diez minutos—, así que a la quinta apertura del portal el paciente veía
   * «No pudimos cargar tus recetas» sin haber hecho nada raro. Y en un teléfono
   * con datos contados, pagaba cuatro veces lo mismo.
   *
   * `inicio` devuelve las cuatro y cobra un solo cupo. Cada trozo llega como
   * lista o como `null`, y `null` sigue significando «no se sabe»: la distinción
   * que impide pintar «no tienes recetas» sobre un fallo de red se conserva
   * entera.
   */
  const cargar = useCallback(async () => {
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'inicio', token }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(
          r.status === 401
            ? 'Este enlace ya no es válido o venció. Pide uno nuevo al consultorio.'
            /* PC-006: el servidor dice «espera un momento» y la pantalla lo
               tapaba con un mensaje genérico. Se enseña el suyo cuando lo hay. */
            : String(d?.error || 'No pudimos cargar tu información.'),
        )
        return
      }
      const d = await r.json()
      setSesion(d as Sesion)
      setCuidadores((d.cuidadores ?? []) as CuidadorEnPantalla[])

      const sinAlcanceClinico = d.alcance !== 'clinico'
      setDocsBloqueados(sinAlcanceClinico && d.alcance !== 'documento')
      setPaquetesBloqueados(sinAlcanceClinico)
      setPreguntasBloqueadas(sinAlcanceClinico)

      setDocsError(d.documentos === null)
      setDocs(d.documentos ?? [])
      setAlergias(String(d.alergias ?? ''))
      setAlergiasLeidas(d.alergiasLeidas === true)

      setPaquetesError(d.paquetes === null)
      setPaquetes(d.paquetes ?? [])
      setPreguntas(d.preguntas ?? null)
    } catch {
      setError('Sin conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }, [token])

  useEffect(() => { cargar() }, [cargar])

  /**
   * CON UN ENLACE DE UN SOLO DOCUMENTO, SE ABRE EN ESE DOCUMENTO — PP-005.
   *
   * El destino por omisión es «Hoy», y con este enlace «Hoy» está vacío por
   * construcción: el servidor no devuelve citas. Quien recibe la receta la
   * abriría en una pantalla en blanco y tendría que buscar la pestaña correcta
   * para ver lo único que le mandaron.
   */
  useEffect(() => {
    if (sesion?.alcance === 'documento') setDestino('documentos')
  }, [sesion?.alcance])

  /**
   * MANDAR LA PREGUNTA.
   *
   * La pantalla NO clasifica: manda el texto y pinta lo que el servidor
   * decidió. Es el §3 de `patient-facing-ai.md` dicho en el cliente — si la
   * prohibición viviera aquí, bastaría con abrir la consola para saltársela.
   *
   * Y no se limpia el borrador hasta que el servidor confirma: si falla la red,
   * el paciente no pierde lo que escribió.
   */
  const enviarPregunta = useCallback(async () => {
    const texto = borrador.trim()
    if (!texto || enviandoPregunta) return
    setEnviandoPregunta(true)
    setErrorPregunta('')
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preguntar', token, texto }),
      })
      if (r.status === 403) { setPreguntasBloqueadas(true); return }
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setErrorPregunta(String(d?.error || 'No pudimos enviar tu pregunta. Intenta de nuevo.'))
        return
      }
      const d = await r.json()
      setPreguntas(p => [
        {
          id: String(d.id ?? ''),
          texto,
          respuesta: String(d.texto ?? ''),
          clase: String(d.clase ?? ''),
          procedencia: d.procedencia ?? null,
          escalada: Boolean(d.escalada),
          atendidaEn: null,
          creadaEn: Date.now(),
        },
        ...(p ?? []),
      ])
      setBorrador('')
    } catch {
      setErrorPregunta('Sin conexión. Tu pregunta no se envió; vuelve a intentarlo.')
    } finally {
      setEnviandoPregunta(false)
    }
  }, [borrador, enviandoPregunta, token])

  /**
   * QUITARLE EL ACCESO A ALGUIEN, Y CERRAR EL ENLACE PROPIO.
   *
   * Las dos son escrituras del servidor: la pantalla no decide nada, sólo lo
   * pide y pinta el resultado. Y las dos son REVERSIBLES en el sentido que
   * importa aquí — quitar acceso no borra a nadie de la bitácora, y el enlace
   * cerrado se sustituye por otro que pide el consultorio.
   */
  const revocarAcceso = useCallback(async (cuidadorId: string) => {
    setTrabajandoAcceso(true); setAvisoAccion('')
    try {
      const r = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revocar-cuidador', token, cuidadorId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setAvisoAccion(String(d?.error || 'No se pudo quitar el acceso. Vuelve a intentarlo.')); return }
      setCuidadores((d.cuidadores ?? []) as CuidadorEnPantalla[])
    } catch {
      setAvisoAccion('Sin conexión. El acceso sigue como estaba: vuelve a intentarlo.')
    } finally { setTrabajandoAcceso(false) }
  }, [token])

  const compartirDocumento = useCallback(async (documentoId: string) => {
    setTrabajandoAcceso(true); setAvisoAccion('')
    try {
      const r = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compartir-documento', token, documentoId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setAvisoAccion(String(d?.error || 'No se pudo crear el enlace. Vuelve a intentarlo.')); return }
      setEnlaceDocumento(e => ({ ...e, [documentoId]: String(d.url ?? '') }))
    } catch {
      setAvisoAccion('Sin conexión. No se creó ningún enlace: vuelve a intentarlo.')
    } finally { setTrabajandoAcceso(false) }
  }, [token])

  const cerrarEnlace = useCallback(async () => {
    setTrabajandoAcceso(true); setAvisoAccion('')
    try {
      const r = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cerrar-enlace', token }),
      })
      if (!r.ok) { setAvisoAccion('No se pudo cerrar el enlace. Vuelve a intentarlo.'); return }
      setCerrado(true); setConfirmandoCierre(false)
    } catch {
      setAvisoAccion('Sin conexión. Tu enlace sigue abierto: vuelve a intentarlo.')
    } finally { setTrabajandoAcceso(false) }
  }, [token])

  // Título de pestaña con la marca de la clínica (confianza)
  useEffect(() => {
    const nombre = sesion?.clinica?.nombre
    document.title = nombre ? `Mi portal · ${nombre}` : 'Mi portal'
  }, [sesion?.clinica?.nombre])

  const accionCita = async (action: string, citaId: string, extra: Record<string, unknown> = {}) => {
    setAccion(citaId + action); setAvisoAccion('')
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token, citaId, ...extra }) })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { setAvisoAccion(data.error || 'No se pudo completar la acción. Tu cita sigue como estaba.'); return false }
      await cargar()
      setReagendando('')
      return true
    } catch {
      setAvisoAccion('Sin conexión. Tu cita sigue como estaba: vuelve a intentarlo.')
      return false
    } finally {
      setAccion('')
    }
  }

  /*
    A11Y-GATE-001. Las dos puertas de esta pantalla —«cargando» y «tu enlace ya
    no vale»— eran mudas. La segunda es la que importa: si el enlace del portal
    venció, ESTE cartel es lo único que le dice al paciente que tiene que pedir
    otro al consultorio. Aparecía sin que ningún lector de pantalla lo leyera,
    y lo que quedaba era una pantalla en blanco sin explicación.
  */
  if (cargando) {
    return <Centro><div role="status"><Loader2 size={26} aria-hidden="true" style={{ animation: 'spin 1s linear infinite', color: 'var(--nexus)' }} /><p style={{ color: 'var(--text3)', marginTop: 12 }}>Cargando tu información…</p></div></Centro>
  }
  if (error || !sesion) {
    /**
     * PG-020 — ENLACE VENCIDO: UNA LÍNEA, SIN ENCABEZADO Y SIN SALIDA.
     *
     * Era `<p>` con el texto del error y nada más. La paciente legítima cuyo
     * enlace caducó —que es el caso normal a los siete días— no sabía si había
     * hecho algo mal, si el consultorio la había bloqueado, ni cómo conseguir
     * otro. El silencio se lee como «esto ya no es para ti».
     *
     * Ahora dice qué pasó, que es normal, y qué hacer. No se pinta el teléfono
     * del consultorio porque aquí todavía no se sabe cuál es: sin sesión no hay
     * configuración, y un número inventado es peor que ninguno.
     */
    return (
      <Centro>
        <div role="alert" style={{ maxWidth: 360 }}>
          <AlertTriangle size={28} color="var(--amber)" aria-hidden="true" />
          <h1 className="t-h2" style={{ marginTop: 12 }}>
            {error.includes('venció') || error.includes('válido') ? 'Este enlace ya no sirve' : 'No pudimos abrir tu portal'}
          </h1>
          <p style={{ color: 'var(--text2)', marginTop: 10, fontSize: 16, lineHeight: 1.6 }}>{error || 'No encontramos tu información.'}</p>
          <p style={{ color: 'var(--text2)', marginTop: 12, fontSize: 16, lineHeight: 1.6 }}>
            Los enlaces caducan solos a los pocos días, por seguridad. Pídele uno
            nuevo a tu consultorio por el mismo número por el que agendaste tu
            cita: te lo mandan en un momento.
          </p>
          <button type="button" onClick={() => { setError(''); setCargando(true); cargar() }} className="btn btn-secondary" style={{ marginTop: 16 }}>
            Volver a intentarlo
          </button>
        </div>
      </Centro>
    )
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
    if (!fechaDoc) { setAvisoAccion('Esta receta no tiene una fecha válida. Pídesela al consultorio.'); return }
    /**
     * LA RECETA DEL PACIENTE DICE QUIÉN LA PRESCRIBIÓ — H-01.
     *
     * El segundo argumento era `null`, así que el documento salía SIN médico y
     * con «[FALTA CÉDULA PROFESIONAL]» impreso en rojo: una «RECETA MÉDICA» que
     * no se podía atribuir a nadie. Los datos salen de la FIRMA de la nota —el
     * snapshot inmutable de quien respondió por este acto— y no de la
     * configuración viva del consultorio, que cambiaría el autor de una receta
     * vieja al actualizar el perfil.
     */
    void descargarRecetaWord(
      {
        tipo: 'receta',
        folio: `RX-${doc.id.slice(-7).toUpperCase()}`,
        fecha: fechaDoc,
        pacienteNombre: sesion.paciente,
        diagnostico: doc.diagnostico || undefined,
        // `alergias` sólo viaja si el expediente se pudo leer: `receta-word`
        // imprime «Sin registro en el expediente» cuando el campo llega vacío, y
        // eso es una afirmación, no un silencio.
        alergias: alergiasLeidas ? alergias : undefined,
        medicamentos: doc.medicamentos,
      },
      {
        nombreMedico: doc.medico,
        cedulaProfesional: doc.cedulaProfesional,
        especialidad: doc.especialidad,
        nombreClinica: sesion.clinica?.nombre ?? '',
        direccion: sesion.clinica?.direccion ?? '',
        telefonoAdmin: sesion.clinica?.telefono ?? '',
      } as Parameters<typeof descargarRecetaWord>[1],
      { ...RECETA_CONFIG_DEFAULT, mostrarAlergias: alergiasLeidas },
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

  /**
   * ── PP-005 · UN ENLACE DE UN DOCUMENTO NO FINGE SER EL PORTAL ────────────
   *
   * Con alcance `documento` el servidor no devuelve citas, ni plan, ni
   * preguntas: enseñar los cinco destinos sería ofrecerle a quien recibió la
   * receta cuatro pantallas vacías y una tarjeta que le dice que le pida acceso
   * a un médico que no es el suyo. Se enseña lo que este enlace abre.
   *
   * Con alcance `agenda` los destinos se quedan TODOS: las pestañas clínicas
   * explican cómo conseguir el acceso, y esconderlas dejaría al paciente sin
   * saber que existe. Mostrar en vez de esconder.
   */
  const destinosVisibles = sesion.alcance === 'documento'
    ? DESTINOS.filter(d => d.id === 'documentos')
    : DESTINOS

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '24px 16px 96px' }}>
      {/*
        EL CONTENIDO PRINCIPAL, CON SU PUNTO DE REFERENCIA.

        Esta columna era un `<div>`, así que el portal —la ÚNICA pantalla que
        ve un paciente— no tenía `<main>`: ni punto al que saltar con «ir al
        contenido», ni región que anunciar. Seis bloques quedaban fuera de
        todo landmark (`region` ×6 en axe).

        No lo cazaba nadie porque `landmark-one-main` y `region` son reglas de
        BUENAS PRÁCTICAS de axe, y el trinquete de interfaz corre sólo las
        etiquetas WCAG A/AA — donde esta pantalla daba 0 violaciones y pasaba
        en verde. Del lado del médico eso se sortea; un paciente con lector de
        pantalla no tiene a dónde saltar.
      */}
      {/*
        ── PP-017 · «IR A LAS SECCIONES» ───────────────────────────────────

        La barra de destinos vive al FINAL del documento (va fija abajo, y en el
        orden del DOM eso es lo último). Con lector de pantalla, cambiar de
        pestaña obligaba a atravesar la pantalla entera: las citas, el
        formulario previo, el anticipo… y luego los cinco botones.

        Dos enlaces de salto, visibles sólo al enfocarlos con el teclado. No es
        una concesión de accesibilidad: es el atajo que en la pantalla táctil ya
        existe (la barra está a la vista) y que en el teclado no existía.
      */}
      <a href="#contenido-portal" className="skip-link">Ir al contenido</a>
      <a href="#secciones-portal" className="skip-link">Ir a las secciones</a>
      <main id="contenido-portal" tabIndex={-1} style={{ maxWidth: 560, margin: '0 auto' }}>
        {/*
          EL ENCABEZADO DICE DÓNDE ESTÁS.

          El subtítulo era fijo —«Aquí puedes gestionar tus citas.»— y se pintaba
          en los CINCO destinos: medido, las veinte combinaciones de ancho y tema.
          Encima del plan de cuidado, encima de las recetas y encima del aviso de
          urgencia, la única línea que orienta nombraba otra pantalla.
        */}
        <div style={{ marginBottom: 20 }}>
          <div className="t-overline" style={{ color: 'var(--nexus)' }}>{sesion.clinica?.nombre || 'Mi portal'}</div>
          <h1 className="t-display" style={{ marginTop: 4 }}>Hola{sesion.paciente ? `, ${sesion.paciente.split(' ')[0]}` : ''}</h1>
          <p style={{ color: 'var(--text2)', fontSize: 16, marginTop: 4, lineHeight: 1.55 }}>
            {destinosVisibles.find(d => d.id === destino)?.pista}
          </p>
        </div>

        {/*
          LA VÍA DE URGENCIA, ANTES QUE NADA Y EN TODOS LOS DESTINOS.
          §6 de `patient-facing-ai.md`. Estaba en el tercer párrafo de una sola
          pestaña, en la letra más pequeña del portal, y el número no se podía
          marcar. Ver `src/components/portal/ViaDeUrgencia.tsx`.
        */}
        <ViaDeUrgencia telefonoConsultorio={sesion.clinica?.telefono} />

        {avisoAccion && (
          <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid color-mix(in srgb, var(--red) 42%, transparent)', background: 'color-mix(in srgb, var(--red) var(--tinte), var(--s1))', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 20 }}>
            <AlertTriangle size={17} aria-hidden="true" style={{ color: 'var(--red-texto)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, flex: 1, fontSize: 14, color: 'var(--text2)', lineHeight: 1.55 }}>{avisoAccion}</p>
            <button type="button" onClick={() => setAvisoAccion('')} className="btn btn-ghost btn-sm">Entendido</button>
          </div>
        )}

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
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{f.dia} · {f.hora}</div>
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
                      <button onClick={() => accionCita('confirmar', c.id)} disabled={!!accion} aria-busy={accion === c.id + 'confirmar'} className="btn btn-primary btn-sm">
                        {accion === c.id + 'confirmar' ? <Loader2 size={14} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} aria-hidden="true" />} Confirmar
                      </button>
                    )}
                    <button onClick={() => setReagendando(reagendando === c.id ? '' : c.id)} disabled={!!accion} className="btn btn-secondary btn-sm">
                      <CalendarClock size={14} /> Reagendar
                    </button>
                    <button onClick={() => setCancelando(cancelando === c.id ? '' : c.id)} disabled={!!accion} aria-expanded={cancelando === c.id} className="btn btn-secondary btn-sm" style={{ color: 'var(--red-texto)' }}>
                      <XCircle size={14} aria-hidden="true" /> Cancelar
                    </button>
                    {/*
                      PC-019: se llamaba «Agendar», junto a Confirmar ·
                      Reagendar · Cancelar. Un adulto mayor lo lee como «agendar
                      otra cita» y toca el único botón que no hace nada con su
                      cita: lo que hace es copiarla a su calendario del teléfono.
                      Se dice lo que hace.
                    */}
                    <a href={gcalLink(c, tzClinica)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
                      <CalendarPlus size={14} aria-hidden="true" /> Añadir a mi calendario
                    </a>
                  </div>
                  {/*
                    CANCELAR UNA CITA MÉDICA NO SE PREGUNTA CON UN `confirm()`.

                    Comprobado disparándolo en el navegador: salía el diálogo
                    NATIVO «¿Cancelar esta cita?». Ese cuadro no se puede
                    rotular, ni traducir, ni leer con el resto de la pantalla, y
                    sus dos botones dicen «Aceptar» y «Cancelar» — donde
                    «Cancelar» significa *no cancelar*. En la pantalla del
                    paciente, la palabra del botón contradice la acción.

                    Y no decía **nada de lo que importa**: que hay una ventana de
                    aviso del consultorio, y que reagendar es una alternativa que
                    ya está ahí al lado. Se dice antes, no después.
                  */}
                  {cancelando === c.id && (
                    <div role="group" aria-label="Confirmar la cancelación" style={{ marginTop: 14, padding: 14, background: 'var(--s2)', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--red) 34%, transparent)' }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>¿Cancelar esta cita?</p>
                      <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                        {sesion.minHoras > 0
                          ? `Tu consultorio pide avisar con al menos ${sesion.minHoras} horas de anticipación. `
                          : ''}
                        Si sólo te queda mal la hora, puedes reagendarla sin perderla.
                      </p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        <button onClick={() => accionCita('cancelar', c.id).then(ok => { if (ok) setCancelando('') })} disabled={!!accion} aria-busy={accion === c.id + 'cancelar'} className="btn btn-sm nx-acc-destructiva" style={{ color: 'var(--sobre-aviso)' }}>
                          {accion === c.id + 'cancelar' ? <Loader2 size={14} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={14} aria-hidden="true" />} Sí, cancelar
                        </button>
                        <button onClick={() => { setCancelando(''); setReagendando(c.id) }} disabled={!!accion} className="btn btn-secondary btn-sm">
                          <CalendarClock size={14} aria-hidden="true" /> Mejor reagendar
                        </button>
                        <button onClick={() => setCancelando('')} disabled={!!accion} className="btn btn-ghost btn-sm">
                          Dejarla como está
                        </button>
                      </div>
                    </div>
                  )}
                  {reagendando === c.id && <PanelReagenda cita={c} token={token} tz={tzClinica} onReagendado={(fh) => accionCita('reagendar', c.id, { nuevaFechaHora: fh })} ocupado={!!accion} />}
                </>
              )}
            </div>
          )
        })}

        {/*
          ── PI-018 · MIS CITAS PASADAS NO ESTÁN EN «HOY» ────────────────────

          Estaban al final de «Cuidado», debajo del plan de cada consulta: un
          `<details>` que el paciente sólo encontraba por casualidad. «¿Cuándo
          fue mi última consulta?» es una pregunta de agenda, y la agenda es
          esta pestaña.

          Sigue plegado, porque lo que importa al abrir son las PRÓXIMAS. Lo que
          cambia es que ahora está donde se busca.
        */}
        {pasadas.length > 0 && (
          <details style={{ marginTop: 24 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text2)', fontSize: 16, fontWeight: 600, padding: '10px 0', minHeight: 44 }}>
              Mis citas anteriores ({pasadas.length})
            </summary>
            <div style={{ marginTop: 8 }}>
              {pasadas.map(c => {
                const f = fmtFecha(c.fechaHora, tzClinica)
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                    <div style={{ color: 'var(--text3)', minWidth: 110 }} className="t-num">{f.fecha}</div>
                    <div style={{ color: 'var(--text2)', flex: 1 }}>{TIPO_LABEL[c.tipo] || 'Consulta'} · {conMayusculaInicial(c.estado.replace('-', ' '))}</div>
                  </div>
                )
              })}
            </div>
          </details>
        )}

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
              aria-busy={!!pagando}
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
              <div role="alert" style={{ fontSize: 14, color: 'var(--amber-texto)', marginTop: 8, lineHeight: 1.55 }}>
                {errorPago}
              </div>
            )}
            {/*
              ── N-003 · LA LIGA QUE EL MÉDICO PEGÓ NO SE USABA NUNCA ─────────

              La pantalla de configuración le pide al médico su liga de cobro
              (MercadoPago, Clip, la que use), él la pega… y el portal cobraba
              por otro sitio: la liga sólo aparecía si el pago en línea FALLABA.
              O sea, el médico creía haber conectado su cobro y no lo había
              conectado.

              Ahora se ofrece siempre que exista, como lo que es: la otra forma
              de pagar. Se dice claramente que ese pago NO queda registrado solo
              —porque no pasa por el webhook— para que el paciente sepa que
              tiene que avisar, en vez de descubrirlo en la recepción.
            */}
            {sesion.anticipo.link && (
              <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 10, lineHeight: 1.6 }}>
                También puedes{' '}
                <a href={sesion.anticipo.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--nexus)' }}>
                  pagar por la liga de tu consultorio
                </a>
                . Por ahí el pago no se registra solo: avísales para que lo apunten.
              </p>
            )}
          </div>
        )}

        </>)}
        {destino === 'preguntar' && (<>
          {/*
            ASK NEXUS — V9 · PATIENT-AI-001.

            Esto NO es un chatbot médico. Lo que contesta sale, LITERALMENTE, de
            lo que su médico liberó: la pantalla manda el texto y pinta lo que el
            servidor decidió. Aquí no se clasifica nada — si la prohibición
            viviera en el cliente, bastaría con abrir la consola para saltarla
            (§3 de `patient-facing-ai.md`: «la prohibición vive en el servidor»).

            Y cuando no hay respuesta sostenida en material aprobado, **se
            escala**: la escalación es el producto, no el fallo.
          */}
          <h2 className="t-h2" style={{ marginBottom: 12 }}>Preguntar</h2>

          {preguntasBloqueadas ? (
            <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 12 }}>
              <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
                Este enlace no tiene permiso para preguntar. Pídele a tu médico
                que te mande uno nuevo desde su sesión.
              </p>
            </div>
          ) : (
            <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 12 }}>
              {/*
                ETIQUETA DE VERDAD, no un `placeholder`. Un campo cuyo único
                rótulo es el texto de ejemplo se queda mudo para un lector de
                pantalla en cuanto el paciente escribe la primera letra.
              */}
              <label htmlFor={idPregunta} style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                ¿Qué quieres preguntar sobre tu tratamiento?
              </label>
              <textarea
                id={idPregunta}
                value={borrador}
                onChange={e => setBorrador(e.target.value.slice(0, 300))}
                rows={3}
                maxLength={300}
                placeholder="Por ejemplo: ¿cada cuándo tomo la pastilla que me recetó?"
                style={{
                  width: '100%', padding: 12, fontSize: 16, lineHeight: 1.5,
                  border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                  background: 'var(--bg)', color: 'var(--text)', resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
                <span style={{ fontSize: 14, color: 'var(--text3)' }}>{borrador.trim().length}/300</span>
                <button
                  type="button"
                  onClick={enviarPregunta}
                  disabled={!borrador.trim() || enviandoPregunta}
                  /* `aria-busy` y no sólo `disabled`: con la ruedecita girando, un
                     lector de pantalla que sólo ve `disabled` anuncia «no
                     disponible» — que se entiende como «esto no se puede usar»,
                     no como «está trabajando». */
                  aria-busy={enviandoPregunta}
                  className="btn btn-primary"
                  /* 44×44 es el mínimo táctil de la compuerta de accesibilidad. */
                  style={{ minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  {enviandoPregunta
                    ? <><Loader2 size={16} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} /> Enviando…</>
                    : <><Send size={16} aria-hidden="true" /> Enviar</>}
                </button>
              </div>
              {errorPregunta && (
                /* El fallo se escribe en la pantalla, no en un `alert()` que se
                   cierra sin dejar rastro. */
                <p role="alert" style={{ fontSize: 14, color: 'var(--red-texto)', margin: '10px 0 0', lineHeight: 1.5 }}>
                  {errorPregunta}
                </p>
              )}
            </div>
          )}

          {/*
            LO QUE YA PREGUNTÓ, con su respuesta congelada. `null` es «todavía no
            se sabe»: no se pinta un historial vacío, que se leería como «nunca
            he preguntado».
          */}
          {preguntas && preguntas.length > 0 && (
            /*
              PP-017: era una pila de bloques sin encabezado, así que con lector
              de pantalla no había forma de saltar de una pregunta a otra.
            */
            <section aria-labelledby="tit-historial" style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
              <h3 id="tit-historial" className="t-h3" style={{ margin: '4px 0 0' }}>Lo que ya preguntaste</h3>
              {preguntas.map(p => {
                const urgente = p.clase === 'URGENT_REVIEW_REQUIRED'
                return (
                  <article
                    key={p.id || String(p.creadaEn)}
                    aria-label={`Pregunta: ${p.texto.slice(0, 60)}`}
                    style={{
                      padding: 14,
                      border: `1px solid ${urgente ? 'color-mix(in srgb, var(--red) 42%, transparent)' : 'var(--border)'}`,
                      borderRadius: 'var(--r-lg)',
                      background: 'var(--s1)',
                    }}
                  >
                    {/*
                      EL AVISO URGENTE VA EN LA PRIMERA LÍNEA (§6).
                      «Un aviso urgente que llega en el tercer párrafo no llegó.»
                      Y no se representa SÓLO con el color: lleva icono y palabra,
                      porque el riesgo clínico nunca se pinta sólo con color.
                    */}
                    {urgente && (
                      <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--red-texto)' }}>
                        <AlertTriangle size={16} aria-hidden="true" /> Esto puede ser una urgencia
                      </p>
                    )}
                    {/*
                      PP-016 · PI-017: «Preguntaste» iba a 12 px, la letra más
                      pequeña de la tarjeta. Es lo que le dice a la abuela CUÁL
                      de sus preguntas está leyendo.
                    */}
                    <p style={{ fontSize: 14, color: 'var(--text3)', margin: '0 0 6px', lineHeight: 1.55 }}>
                      Preguntaste: «{p.texto}»
                    </p>
                    <p style={{ fontSize: 16, color: 'var(--text)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {p.respuesta}
                    </p>
                    {/*
                      PROCEDENCIA — el principio del sistema de diseño, aquí.
                      Sin esto, una cita textual del plan de su médico y una
                      frase compuesta por una máquina se leen exactamente igual.
                    */}
                    {/*
                      PC-005 · PI-014 — LA VÍA DE URGENCIA, PULSABLE.

                      La respuesta urgente venía con el 911 escrito dentro del
                      texto: un número que hay que memorizar y teclear, con
                      dolor torácico. El texto ya no lo lleva (el mensaje del
                      portal es distinto del de WhatsApp); aquí va el botón.
                    */}
                    {urgente && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                        <a href={`tel:${TELEFONO_EMERGENCIAS}`} className="btn btn-primary btn-sm" style={{ minHeight: 44 }}>
                          <Phone size={14} aria-hidden="true" /> Llamar al {TELEFONO_EMERGENCIAS}
                        </a>
                        {sesion.clinica?.telefono && (
                          <a href={`tel:${sesion.clinica.telefono}`} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>
                            <Phone size={14} aria-hidden="true" /> Llamar al consultorio
                          </a>
                        )}
                      </div>
                    )}
                    {p.procedencia?.fechaConsulta && (
                      <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text3)', margin: '10px 0 0', lineHeight: 1.55 }}>
                        <Quote size={12} aria-hidden="true" />
                        {/* PI-016: llegaba como «2026-09-05». */}
                        Esto lo dejó escrito tu médico en tu consulta del {fmtFecha(p.procedencia.fechaConsulta, tzClinica).fecha}
                      </p>
                    )}
                    {p.escalada && (
                      <p style={{ fontSize: 14, color: 'var(--text3)', margin: '10px 0 0', lineHeight: 1.55 }}>
                        {p.atendidaEn ? 'Tu consultorio ya la revisó.' : 'Tu consultorio la tiene pendiente de revisar.'}
                      </p>
                    )}
                  </article>
                )
              })}
            </section>
          )}

          <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)' }}>
            <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
              Hay preguntas que sólo puede contestar tu médico. Cuando sea una de
              ésas, aquí te lo digo y tu consultorio la recibe — pero si es algo
              que no puede esperar, llámales.
            </p>
            {/*
              ESTE DESTINO NO PUEDE QUEDARSE SIN NINGUNA ACCIÓN.

              Medido en el navegador: con el consultorio sin teléfono en su
              configuración, «Preguntar» pintaba **cero botones y cero enlaces**.
              Una pantalla que existe para llevarte con tu médico, diciéndote que
              hables con él y sin decir cómo — y sin decir tampoco que no lo sabe.
              El silencio se lee como «ya lo intenté».
            */}
            {sesion.clinica?.telefono ? (
              <a href={`tel:${sesion.clinica.telefono}`} className="btn btn-primary btn-sm"
                 style={{ display: 'inline-flex', marginTop: 14 }}>
                <Phone size={14} aria-hidden="true" /> Llamar al consultorio
              </a>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text3)', margin: '14px 0 0', lineHeight: 1.6 }}>
                Tu consultorio no dejó aquí un teléfono. Usa el número por el que
                agendaste tu cita, o pídeselo cuando vayas.
              </p>
            )}
          </div>
          {/*
            Y desde aquí también se llega a lo que tu médico ya te dejó escrito:
            era la única pantalla del portal sin salida hacia otra.
          */}
          <button type="button" onClick={() => setDestino('cuidado')} className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
            <HeartPulse size={14} aria-hidden="true" /> Ver lo que me dejó mi médico
          </button>
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

          {/*
            NO SE PUDO LEER — y se dice. Es la hermana exacta del aviso de las
            recetas (H-01): una lista vacía por un fallo de red se lee como «mi
            médico no me dejó nada», y esa es una afirmación clínica que nadie
            comprobó.
          */}
          {paquetesError && (
            <div role="alert" style={{ padding: 16, border: '1px solid var(--amber)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
                No pudimos cargar el resumen de tus consultas. Esto <strong>no</strong> significa
                que no tengas ninguno: vuelve a intentarlo o llama a tu consultorio.
              </p>
            </div>
          )}

          {paquetesBloqueados && (
            <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 16, fontSize: 14, color: 'var(--text3)' }}>
              Este enlace sirve para tus citas. Pide a tu médico el acceso a la
              información de tus consultas.
            </div>
          )}

          {!paquetesError && !paquetesBloqueados && paquetes?.length === 0 && (
            <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 24 }}>
              <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0, lineHeight: 1.6 }}>
                Cuando tu médico libere el resumen de una consulta, lo verás aquí:
                tus medicamentos con instrucciones en palabras sencillas, los
                estudios que te pidió y cuándo volver.
              </p>
            </div>
          )}

          {(paquetes ?? []).map(pk => {
            const f = fmtFecha(pk.fechaConsulta, tzClinica)
            return (
              <article key={pk.id} style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 16 }}>
                <h3 className="t-h3" style={{ margin: '0 0 4px' }}>Consulta del {f.fecha}</h3>
                {pk.encounterSummary && (
                  <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 0 12px', lineHeight: 1.6 }}>{pk.encounterSummary}</p>
                )}

                {pk.medicationInstructions.length > 0 && (
                  <>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '12px 0 6px' }}>Tus medicamentos</h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
                      {pk.medicationInstructions.map(m => <li key={m.nombre}>{m.instruccion}</li>)}
                    </ul>
                  </>
                )}

                {/*
                  QUÉ CAMBIÓ. Es donde el paciente más se equivoca —sigue
                  tomando lo que ya no toca—, y por eso se enseña aparte de la
                  lista. Cuando el servidor no pudo saber qué había antes manda
                  `null`, y entonces AQUÍ NO SE DICE NADA: «no sé qué había
                  antes» no es «no hubo cambios».
                */}
                {pk.medicationChanges && pk.medicationChanges.some(c => c.tipo !== 'sin-cambio') && (
                  <>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '12px 0 6px' }}>Qué cambió desde tu visita anterior</h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
                      {pk.medicationChanges.filter(c => c.tipo !== 'sin-cambio').map(c => (
                        <li key={`${c.tipo}-${c.nombre}`}>
                          {c.tipo === 'nuevo' ? 'Empiezas' : 'Ya no tomas'}: {c.nombre}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {pk.orders.length > 0 && (
                  <>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '12px 0 6px' }}>Estudios que te pidió</h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
                      {pk.orders.map(o => <li key={o}>{o}</li>)}
                    </ul>
                  </>
                )}

                {pk.warningSigns.length > 0 && (
                  <>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '12px 0 6px' }}>Cuándo volver antes</h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 16, color: 'var(--text2)', lineHeight: 1.7 }}>
                      {pk.warningSigns.map(w => <li key={w}>{w}</li>)}
                    </ul>
                  </>
                )}

                {/*
                  ── PC-020 · MO-016 — LO QUE EL MÉDICO INDICÓ, Y NO TENÍA SITIO ──

                  El paquete se componía de diagnósticos, medicamentos, estudios
                  y próxima cita. El ayuno antes de la cirugía, qué suspender,
                  cómo cuidar la herida, cuándo bañarse, el reposo, las
                  restricciones de actividad y los ejercicios de rehabilitación
                  no cabían en ninguno de esos cuatro: el cirujano los escribía
                  en su nota y «¿puedo comer antes de la cirugía?» sólo podía
                  escalar.

                  Van LITERALES, en las palabras del médico. Reescribirlas «para
                  que se entiendan mejor» es exactamente donde se colaría un
                  consejo que él no dio.
                */}
                {(pk.indicaciones ?? []).length > 0 && (
                  <>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '12px 0 6px' }}>Lo que te indicó tu médico</h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 16, color: 'var(--text2)', lineHeight: 1.7 }}>
                      {(pk.indicaciones ?? []).map(i => <li key={i}>{i}</li>)}
                    </ul>
                  </>
                )}

                {pk.followUp && (
                  <p style={{ fontSize: 14, color: 'var(--text2)', margin: '12px 0 0' }}>
                    <strong>Tu próxima cita:</strong> {pk.followUp}
                  </p>
                )}

                {/*
                  ALERGIAS: sólo si el expediente SE PUDO LEER (`alergias !== null`).
                  Con `null` no se escribe ni «sin registro»: afirmar una ausencia
                  que nadie comprobó, delante de alguien que no puede detectar el
                  error, es exactamente lo que la regla 4 prohíbe.
                */}
                {pk.alergias !== null && pk.alergias !== '' && (
                  <p style={{ fontSize: 14, color: 'var(--text2)', margin: '12px 0 0' }}>
                    <strong>Alergias registradas:</strong> {pk.alergias}
                  </p>
                )}

                <p style={{ fontSize: 14, color: 'var(--text3)', margin: '14px 0 0', lineHeight: 1.6 }}>
                  {/* PP-016: quién firma iba a 12 px. Es de lo que más importa. */}
                  {pk.prescriptor.nombre}
                  {pk.prescriptor.cedulaProfesional ? ` · Céd. Prof. ${pk.prescriptor.cedulaProfesional}` : ''}
                  {pk.prescriptor.especialidad ? ` · ${pk.prescriptor.especialidad}` : ''}
                </p>
                {pk.clinicianContactRules && (
                  <p style={{ fontSize: 14, color: 'var(--text3)', margin: '6px 0 0', lineHeight: 1.6 }}>
                    {pk.clinicianContactRules}
                  </p>
                )}
              </article>
            )
          })}
        </>)}
        {destino === 'documentos' && (<>
        {/* Mis recetas — enlace sin alcance clínico (E0-06) */}
        {docsBloqueados && (
          <div style={{ marginTop: 28, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--text3)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Mis recetas</div>
            Este enlace sirve para tus citas. Pide a tu médico el acceso a tus recetas.
          </div>
        )}

        {/*
          NO SE PUDO LEER — y se dice, en vez de pintar una pantalla vacía.
          Una lista vacía por un fallo de red se lee como «no tienes recetas», y
          esa es una afirmación clínica que nadie comprobó (H-01).
        */}
        {docsError && (
          // Tamaños y radio EN ESCALA (12 / 10): la tarjeta hermana de arriba es
          // deuda de diseño heredada y no se copia su 13/12 — el trinquete sólo baja.
          <div style={{ marginTop: 28, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, fontSize: 12, color: 'var(--text3)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Mis recetas</div>
            No pudimos cargar tus recetas en este momento. <b>Esto no quiere decir que no tengas.</b>{' '}
            Vuelve a intentarlo en un minuto, y si sigue igual pregunta en el consultorio.
          </div>
        )}

        {/*
          PP-011 — LA PESTAÑA EN BLANCO.

          Sin recetas, «Documentos» no pintaba absolutamente nada: ni un título.
          La abuela no sabía si estaba cargando, si no había nada, o si había
          hecho algo mal. Un vacío sin explicar se lee como un error propio.
        */}
        {!docsError && !docsBloqueados && docs && docs.length === 0 && (
          <div style={{ marginTop: 28 }}>
            <h2 className="t-h2" style={{ marginBottom: 12 }}>Mis recetas</h2>
            <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)' }}>
              <p style={{ fontSize: 16, color: 'var(--text2)', margin: 0, lineHeight: 1.6 }}>
                Todavía no tienes recetas aquí. Cuando tu médico firme una, la vas
                a poder ver y descargar desde esta pantalla.
              </p>
            </div>
          </div>
        )}

        {/* Mis recetas */}
        {!docsError && docs && docs.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h2 className="t-h2" style={{ marginBottom: 12 }}>Mis recetas</h2>
            {sesion.alcance === 'documento' && (
              <p style={{ fontSize: 14, color: 'var(--text3)', margin: '0 0 12px', lineHeight: 1.6 }}>
                Este enlace abre sólo este documento. No da acceso al resto del
                expediente ni a las citas.
              </p>
            )}
            {docs.map(d => {
              const f = fmtFecha(d.fecha)
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--nexus-soft)', color: 'var(--nexus)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Pill size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }} className="t-num">{f.fecha}</div>
                    <div style={{ fontSize: 14, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.diagnostico || `${d.medicamentos.length} medicamento(s)`}{d.medico ? ` · ${d.medico}` : ''}
                    </div>
                  </div>
                  <button onClick={() => setRecetaAbierta(a => a === d.id ? '' : d.id)} aria-expanded={recetaAbierta === d.id} className="btn btn-secondary btn-sm" style={{ flexShrink: 0, minHeight: 44 }}>
                    <FileText size={14} aria-hidden="true" /> {recetaAbierta === d.id ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              )
            })}
            {/*
              ── PI-021 · PG-015 · PO-013 — «DESCARGAR» ERA LA ÚNICA FORMA ─────

              La receta se bajaba como archivo de Word. En un teléfono de gama
              baja sin Word no se abre: el paciente toca el único botón de la
              tarjeta y no pasa nada que él pueda ver. Y no había ninguna forma
              de LEERLA en pantalla, que es lo que hace el 90 % de las veces
              —comprobar cómo se llama la pastilla, o enseñársela al de la
              farmacia.

              Ahora se lee aquí, con letra de tamaño normal, y el `.doc` sigue
              existiendo para quien necesita el archivo. Lo que se pinta es lo
              MISMO que baja al documento: la puerta de prescripción y la de
              diagnósticos ya se aplicaron en el servidor.
            */}
            {docs.filter(d => d.id === recetaAbierta).map(d => (
              <article key={`vista-${d.id}`} aria-label={`Receta del ${fmtFecha(d.fecha, tzClinica).fecha}`} style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 12 }}>
                <h3 className="t-h3" style={{ margin: '0 0 4px' }}>Receta del {fmtFecha(d.fecha, tzClinica).fecha}</h3>
                <p style={{ fontSize: 14, color: 'var(--text3)', margin: '0 0 12px', lineHeight: 1.55 }}>
                  {d.medico}{d.cedulaProfesional ? ` · Céd. Prof. ${d.cedulaProfesional}` : ''}{d.especialidad ? ` · ${d.especialidad}` : ''}
                </p>
                {d.diagnostico && (
                  <p style={{ fontSize: 16, color: 'var(--text2)', margin: '0 0 12px', lineHeight: 1.6 }}>
                    <strong>Diagnóstico:</strong> {d.diagnostico}
                  </p>
                )}
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 16, color: 'var(--text)', lineHeight: 1.7 }}>
                  {d.medicamentos.map((m, i) => (
                    <li key={`${m.nombre}-${i}`}>
                      {[m.nombre, m.dosis, m.via, m.frecuencia, m.duracion].filter(Boolean).join(' · ')}
                    </li>
                  ))}
                </ul>
                {alergiasLeidas && alergias && (
                  <p style={{ fontSize: 16, color: 'var(--text2)', margin: '12px 0 0', lineHeight: 1.6 }}>
                    <strong>Alergias registradas:</strong> {alergias}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                  <button onClick={() => descargarReceta(d)} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>
                    <Download size={14} aria-hidden="true" /> Descargar el archivo
                  </button>
                  {/*
                    PO-009 · PP-005: «compartir sólo esto». Antes, enseñarle la
                    receta al jefe o a la guardería obligaba a reenviar el
                    enlace del portal entero, con las citas, el plan y las
                    preguntas dentro.
                  */}
                  {sesion.alcance === 'clinico' && (
                    <button onClick={() => compartirDocumento(d.id)} disabled={!!trabajandoAcceso} className="btn btn-ghost btn-sm" style={{ minHeight: 44 }}>
                      <ShieldCheck size={14} aria-hidden="true" /> Compartir sólo esta receta
                    </button>
                  )}
                </div>
                {enlaceDocumento[d.id] && (
                  <div role="status" style={{ marginTop: 12, padding: 12, borderRadius: 'var(--r-md)', background: 'var(--s2)', border: '1px solid var(--border)' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                      Este enlace abre <strong>sólo esta receta</strong>. Quien lo
                      reciba no verá tus citas, tu plan ni tus preguntas.
                    </p>
                    <p style={{ margin: 0, fontSize: 14, wordBreak: 'break-all', color: 'var(--text)' }}>{enlaceDocumento[d.id]}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        </>)}
        {destino === 'perfil' && (<>
          {/*
            ── PP-020 · PO-021 — «PERFIL» EXISTÍA PARA DECIR QUE NO HACÍA NADA ──

            Ocupaba uno de los CINCO destinos del móvil para enseñar «Idioma:
            Español (México)» sin control ninguno y un párrafo de disculpa. La
            decisión del dueño (PL-P10) era esconderlo «hasta que haya algo que
            gestionar».

            Ya hay algo que gestionar, y es justo lo que faltaba: quién más
            puede ver lo mío, y cómo cierro mi enlace. Así que el destino se
            queda y por fin sirve. El idioma —que no se puede cambiar— sale de
            aquí: un dato inmutable presentado como ajuste es lo que hacía que
            esta pantalla se leyera como un formulario roto.
          */}
          <h2 className="t-h2" style={{ marginBottom: 12 }}>Tu acceso</h2>

          {/* ── Quién más puede ver lo mío (§8) ─────────────────────────── */}
          <section aria-labelledby="tit-cuidadores" style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 16 }}>
            <h3 id="tit-cuidadores" className="t-h3" style={{ margin: '0 0 6px' }}>Quién más puede ver lo tuyo</h3>
            <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Puedes darle acceso a alguien que te ayude —tu hija, tu esposo, quien
              te cuida— y quitárselo cuando quieras. Queda anotado cuándo entró.
            </p>

            {cuidadores.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text3)', margin: '0 0 12px', lineHeight: 1.6 }}>
                Ahora mismo nadie más tiene acceso.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'grid', gap: 10 }}>
                {cuidadores.map(c => (
                  <li key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{c.nombre}</div>
                      <div style={{ fontSize: 14, color: 'var(--text2)' }}>
                        {c.parentesco} · {c.alcance === 'clinico' ? 've tus citas y tus documentos' : 've sólo tus citas'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                        {c.ultimoAccesoEn
                          ? `Entró por última vez el ${fmtFecha(c.ultimoAccesoEn, tzClinica).fecha}`
                          : 'Todavía no ha entrado'}
                      </div>
                    </div>
                    <button type="button" disabled={!!trabajandoAcceso} onClick={() => revocarAcceso(c.id)} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>
                      Quitarle el acceso
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {sesion.alcance === 'documento' ? (
              <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0, lineHeight: 1.6 }}>
                Este enlace abre un solo documento, así que desde aquí no se puede
                dar acceso a nadie.
              </p>
            ) : (
              <FormularioCuidador
                token={token}
                puedeDarClinico={sesion.alcance === 'clinico'}
                onAutorizado={(c, url) => { setCuidadores(l => [...l, c]); setEnlaceNuevo(url) }}
              />
            )}

            {enlaceNuevo && (
              <div role="status" style={{ marginTop: 14, padding: 14, borderRadius: 'var(--r-md)', background: 'var(--s2)', border: '1px solid var(--border)' }}>
                <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
                  Listo. Pásale este enlace a esa persona:
                </p>
                <p style={{ margin: 0, fontSize: 14, wordBreak: 'break-all', color: 'var(--text)' }}>{enlaceNuevo}</p>
              </div>
            )}
          </section>

          {/* ── Cerrar este enlace (PC-018) ─────────────────────────────── */}
          <section aria-labelledby="tit-cerrar" style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 16 }}>
            <h3 id="tit-cerrar" className="t-h3" style={{ margin: '0 0 6px' }}>Cerrar este enlace</h3>
            {/*
              PI-017: «este enlace es personal y caduca» iba en 12 px al pie de
              una tarjeta que no hacía nada. Es de lo que más le importa al
              paciente saber, y ahora vive donde puede hacer algo con ello.
            */}
            <p style={{ fontSize: 16, color: 'var(--text2)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Este enlace es tuyo y caduca solo a los pocos días.
            </p>
            <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 0 12px', lineHeight: 1.6 }}>
              Si lo reenviaste sin querer, o crees que lo tiene alguien que no
              debería, ciérralo. Dejarán de funcionar <strong>todos</strong> los
              enlaces tuyos —incluidos los que le hayas pasado a alguien— y este
              mismo. Pídele otro a tu consultorio cuando lo necesites.
            </p>
            {cerrado ? (
              <p role="status" style={{ fontSize: 16, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
                Enlace cerrado. Esta pantalla ya no se puede volver a abrir con él.
              </p>
            ) : confirmandoCierre ? (
              <div role="group" aria-label="Confirmar el cierre del enlace" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={cerrarEnlace} disabled={!!trabajandoAcceso} className="btn btn-sm nx-acc-destructiva" style={{ color: 'var(--sobre-aviso)', minHeight: 44 }}>
                  Sí, cerrar mi enlace
                </button>
                <button type="button" onClick={() => setConfirmandoCierre(false)} className="btn btn-ghost btn-sm" style={{ minHeight: 44 }}>
                  Dejarlo como está
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmandoCierre(true)} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>
                Cerrar este enlace
              </button>
            )}
          </section>

          {/* ── PO-017 · el Portal de Privacidad no tenía camino desde aquí ── */}
          {sesion.clinicId && (
            <section aria-labelledby="tit-privacidad" style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--s1)', marginBottom: 24 }}>
              <h3 id="tit-privacidad" className="t-h3" style={{ margin: '0 0 6px' }}>Tus datos</h3>
              <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 0 12px', lineHeight: 1.6 }}>
                Puedes pedir una copia de tu expediente, corregir algo que esté
                mal, o pedir que dejen de usar tus datos para ciertas cosas.
              </p>
              {/*
                Había que conocer la dirección /privacidad/<clinicId> de memoria:
                ni el portal ni la página pública del médico llevaban ahí. Un
                derecho al que no hay camino no se ejerce (PO-017, PP-013).
              */}
              <a href={`/privacidad/${sesion.clinicId}`} className="btn btn-secondary btn-sm" style={{ minHeight: 44, display: 'inline-flex' }}>
                <ShieldCheck size={14} aria-hidden="true" /> Ir al Portal de Privacidad
              </a>
            </section>
          )}

        {/* Pie: consultorio */}
        {sesion.clinica && (
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text3)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{sesion.clinica.nombre}</div>
            {sesion.clinica.direccion && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><MapPin size={13} className="ds-icon" /> {sesion.clinica.direccion}</div>}
            {sesion.clinica.telefono && <a href={`tel:${sesion.clinica.telefono}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--nexus)' }}><Phone size={13} className="ds-icon" /> {sesion.clinica.telefono}</a>}
          </div>
        )}

        {/* Confianza */}
        {/* PP-016: iba a 11.5 px, la letra más pequeña de todo el portal. */}
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14, color: 'var(--text3)' }}>
          <ShieldCheck size={14} className="ds-icon" /> Acceso privado y seguro · Ausculta
        </div>
        </>)}
      </main>

      {/*
        LOS CINCO DESTINOS — móvil primero.

        La especificación fija un máximo de 4-5 destinos primarios en móvil, y
        cinco es el techo, no el objetivo. Van fijos abajo porque esta pantalla
        se usa con una mano, de pie, en la sala de espera.
      */}
      {/*
        La colocación vive en la hoja, no aquí: un estilo en línea gana a
        cualquier media query, así que con esto puesto en el `style` la barra NO
        PODÍA tener dos formas. Es la razón mecánica de que fuera la misma
        pantalla estirada. Ver `.mi-barra-destinos` en globals.css.
      */}
      <nav id="secciones-portal" aria-label="Secciones" className="mi-barra-destinos">
        {destinosVisibles.map(d => {
          const activo = destino === d.id
          return (
            <button key={d.id} onClick={() => setDestino(d.id)}
              className="nx-destino-portal"
              aria-current={activo ? 'page' : undefined}>
              <d.icono size={20} aria-hidden />
              {/*
                PG-010: iban con `--t-overline` (10.5 px). Son los CINCO
                destinos del portal, en la pantalla que usa una paciente de 70
                años con una mano, de pie. El token de «overline» está pensado
                para rótulos de sección del lado del médico, no para la
                navegación primaria de un paciente.
              */}
              <span style={{ fontSize: 12, lineHeight: 1.2 }}>{d.etiqueta}</span>
            </button>
          )
        })}
      </nav>
      {/*
        El estilo de los saltos vive AQUÍ y no en `globals.css` a propósito: la
        hoja global es de otra rebanada, y un salto de teclado que sólo esta
        pantalla usa no tiene por qué entrar en el sistema entero. Fuera de foco
        no ocupa sitio; enfocado, se ve como cualquier otro botón.
      */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .skip-link {
          position: absolute;
          left: -9999px;
          top: 8px;
          z-index: 50;
          background: var(--s1);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 12px 16px;
          font-size: 15px;
          text-decoration: none;
        }
        .skip-link:focus-visible, .skip-link:focus {
          left: 16px;
          outline: 2px solid var(--nexus);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  )
}

function PanelReagenda({ cita, token, tz, onReagendado, ocupado }: { cita: Cita; token: string; tz: string; onReagendado: (fh: string) => void; ocupado: boolean }) {
  /*
    C-016: «hoy» se calculaba con `America/Mexico_City` fijo. En un consultorio
    de Tijuana, a las 23:30 hora local, este panel ya estaba en el día siguiente
    y el paciente no podía elegir la fecha de HOY — con el `min` del campo
    cerrándosela. El resto de la pantalla ya usa la zona del consultorio.
  */
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const [fecha, setFecha] = useState(hoy)
  const [slots, setSlots] = useState<string[] | null>(null)
  const [cargandoSlots, setCargandoSlots] = useState(false)
  const idFecha = useId()

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
      {/*
        A11Y-GATE-001: este bloque era un <div> de título y un <input type="date">
        sin etiqueta. El <div> se ve como un rótulo y no lo es — el campo se
        anunciaba «fecha, cuadro de edición», sin decir para qué. Ahora el rótulo
        ES el <label> del campo, así que rotularlo y etiquetarlo son el mismo
        acto y no se pueden separar por descuido.
      */}
      <label htmlFor={idFecha} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><CalendarClock size={14} className="ds-icon" aria-hidden="true" /> Elige un nuevo horario</label>
      <input id={idFecha} type="date" value={fecha} min={hoy} max={FECHA_MAXIMA_AGENDA} onChange={e => setFecha(e.target.value)} className="input" style={{ marginBottom: 12 }} />
      {/*
        Los horarios se rellenan solos al cambiar el día: sin región viva, el
        cambio ocurre en silencio.
      */}
      {cargandoSlots ? (
        <div role="status" style={{ color: 'var(--text3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={14} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} /> Buscando horarios…</div>
      ) : slots && slots.length === 0 ? (
        <div role="status" style={{ color: 'var(--text3)', fontSize: 13 }}>No hay horarios libres ese día. Prueba otra fecha.</div>
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

/**
 * DAR ACCESO A ALGUIEN QUE ME AYUDA — §8, PI-013, PG-011, PO-014.
 *
 * Pide las dos cosas que hacen que una autorización sea una autorización:
 * QUIÉN es y QUÉ RELACIÓN tiene conmigo. El parentesco es texto libre a
 * propósito: «mi hija», «la señora que me cuida», «mi nuera». Encasillarlo
 * obligaría a inventar un catálogo de familias.
 *
 * El alcance por omisión es el que MENOS abre —sólo las citas—, y la casilla
 * para ampliarlo dice exactamente lo que amplía.
 */
function FormularioCuidador({
  token, puedeDarClinico, onAutorizado,
}: {
  token: string
  puedeDarClinico: boolean
  onAutorizado: (c: CuidadorEnPantalla, url: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [parentesco, setParentesco] = useState('')
  const [conDocumentos, setConDocumentos] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const idNombre = useId()
  const idParentesco = useId()
  const idDocs = useId()

  const enviar = async () => {
    setEnviando(true); setError('')
    try {
      const r = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'autorizar-cuidador', token,
          cuidador: { nombre, parentesco, alcance: conDocumentos && puedeDarClinico ? 'clinico' : 'agenda' },
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(String(d?.error || 'No se pudo dar el acceso. Vuelve a intentarlo.')); return }
      onAutorizado(d.cuidador as CuidadorEnPantalla, String(d.url ?? ''))
      setNombre(''); setParentesco(''); setConDocumentos(false); setAbierto(false)
    } catch {
      setError('Sin conexión. No se dio ningún acceso: vuelve a intentarlo.')
    } finally { setEnviando(false) }
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>
        <User size={14} aria-hidden="true" /> Dar acceso a alguien
      </button>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <label htmlFor={idNombre} style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          ¿Cómo se llama?
        </label>
        <input id={idNombre} value={nombre} onChange={e => setNombre(e.target.value.slice(0, 80))} className="input" />
      </div>
      <div>
        <label htmlFor={idParentesco} style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          ¿Quién es para ti?
        </label>
        <input id={idParentesco} value={parentesco} onChange={e => setParentesco(e.target.value.slice(0, 40))} placeholder="Por ejemplo: mi hija" className="input" />
      </div>
      {puedeDarClinico && (
        <label htmlFor={idDocs} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, color: 'var(--text2)', lineHeight: 1.55 }}>
          <input id={idDocs} type="checkbox" checked={conDocumentos} onChange={e => setConDocumentos(e.target.checked)} style={{ marginTop: 3, width: 20, height: 20 }} />
          <span>También puede ver tus recetas y el resumen de tus consultas. Sin esto, sólo verá tus citas.</span>
        </label>
      )}
      {error && <p role="alert" style={{ fontSize: 14, color: 'var(--red-texto)', margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={enviar} disabled={enviando || !nombre.trim() || !parentesco.trim()} aria-busy={enviando} className="btn btn-primary btn-sm" style={{ minHeight: 44 }}>
          {enviando ? <Loader2 size={14} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} aria-hidden="true" />} Dar acceso
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="btn btn-ghost btn-sm" style={{ minHeight: 44 }}>Cancelar</button>
      </div>
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
        <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
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
        className="nx-acc-plana"
        aria-expanded={abierto}
        data-abierto={abierto ? '' : undefined}
        style={{ width: '100%', textAlign: 'left', border: 'none', padding: 8, margin: -8, borderRadius: 10, cursor: 'pointer' }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Cuéntale a tu médico antes de la consulta</div>
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
          {error && <div role="alert" style={{ fontSize: 13, color: 'var(--red)' }}>{error}</div>}
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !Object.values(valores).some(v => v.trim())}
            aria-busy={enviando}
            className="btn btn-primary btn-sm"
            style={{ alignSelf: 'flex-start' }}
          >
            {enviando ? <Loader2 size={14} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} aria-hidden="true" />} Enviar a mi médico
          </button>
        </div>
      )}
    </div>
  )
}
