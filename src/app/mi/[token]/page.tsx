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
  const [preguntas, setPreguntas] = useState<PreguntaHecha[] | null>(null)
  const [preguntasBloqueadas, setPreguntasBloqueadas] = useState(false)
  const [borrador, setBorrador] = useState('')
  const [enviandoPregunta, setEnviandoPregunta] = useState(false)
  const [errorPregunta, setErrorPregunta] = useState('')
  const idPregunta = useId()

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'session', token }) })
      if (!r.ok) { setError(r.status === 401 ? 'Este enlace ya no es válido o venció. Pide uno nuevo al consultorio.' : 'No pudimos cargar tu información.'); return }
      setSesion(await r.json())
      // Documentos (recetas) en paralelo — no bloquea la vista de citas
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'documentos', token }) })
        .then(async res => {
          // E0-06: 403 = el enlace no tiene alcance clínico (lo generó el mostrador,
          // no el médico). No es un error de red ni «no tienes recetas»: se dice.
          if (res.status === 403) { setDocsBloqueados(true); setDocs([]); return }
          // Cualquier otro fallo se DICE. Devolver [] pintaría «no tienes
          // recetas», que es una afirmación clínica que nadie comprobó.
          if (!res.ok) { setDocsError(true); return }
          const d = await res.json()
          setDocs(d.documentos || [])
          setAlergias(String(d.alergias ?? ''))
          setAlergiasLeidas(d.alergiasLeidas === true)
        })
        .catch(() => setDocsError(true))
      /*
        EL PAQUETE DE LA VISITA (POSTVISIT-001). En paralelo y sin bloquear:
        el paciente que entra a confirmar una cita no espera a esto.
      */
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'paquetes', token }) })
        .then(async res => {
          if (res.status === 403) { setPaquetesBloqueados(true); setPaquetes([]); return }
          if (!res.ok) { setPaquetesError(true); return }
          const d = await res.json()
          setPaquetes((d.paquetes || []) as PaqueteVisible[])
        })
        .catch(() => setPaquetesError(true))
      /*
        LO QUE YA PREGUNTÓ (PATIENT-AI-001). También en paralelo. Un fallo de
        red deja `preguntas` en `null` —«no se sabe»— y la pantalla lo dice; no
        se pinta un historial vacío, que se leería como «nunca he preguntado».
      */
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preguntas', token }) })
        .then(async res => {
          if (res.status === 403) { setPreguntasBloqueadas(true); setPreguntas([]); return }
          if (!res.ok) return
          const d = await res.json()
          setPreguntas((d.preguntas || []) as PreguntaHecha[])
        })
        .catch(() => { /* se queda en null: «no se sabe» */ })
    } catch {
      setError('Sin conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }, [token])

  useEffect(() => { cargar() }, [cargar])

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
    return <Centro><div role="alert"><AlertTriangle size={28} color="var(--amber)" aria-hidden="true" /><p style={{ color: 'var(--text2)', marginTop: 12, maxWidth: 320 }}>{error || 'No encontramos tu información.'}</p></div></Centro>
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
      <main style={{ maxWidth: 560, margin: '0 auto' }}>
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
          <p style={{ color: 'var(--text3)', fontSize: 14, marginTop: 4 }}>
            {DESTINOS.find(d => d.id === destino)?.pista}
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
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{f.dia} · {f.hora}</div>
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
              <div role="alert" style={{ fontSize: 12.5, color: 'var(--amber)', marginTop: 8, lineHeight: 1.5 }}>
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
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{borrador.trim().length}/300</span>
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
            <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
              {preguntas.map(p => {
                const urgente = p.clase === 'URGENT_REVIEW_REQUIRED'
                return (
                  <div
                    key={p.id || String(p.creadaEn)}
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
                      <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--red-texto)' }}>
                        <AlertTriangle size={16} aria-hidden="true" /> Esto puede ser una urgencia
                      </p>
                    )}
                    <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 6px', lineHeight: 1.5 }}>
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
                    {p.procedencia?.fechaConsulta && (
                      <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', margin: '10px 0 0' }}>
                        <Quote size={12} aria-hidden="true" />
                        Esto lo dejó escrito tu médico en tu consulta del {p.procedencia.fechaConsulta}
                      </p>
                    )}
                    {p.escalada && (
                      <p style={{ fontSize: 12, color: 'var(--text3)', margin: '10px 0 0' }}>
                        {p.atendidaEn ? 'Tu consultorio ya la revisó.' : 'Tu consultorio la tiene pendiente de revisar.'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
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
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '12px 0 6px' }}>Cuándo volver antes</h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
                      {pk.warningSigns.map(w => <li key={w}>{w}</li>)}
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

                <p style={{ fontSize: 12, color: 'var(--text3)', margin: '14px 0 0', lineHeight: 1.6 }}>
                  {/* QUIÉN RESPONDE POR ESTE PAPEL: del sello de firma de la nota. */}
                  {pk.prescriptor.nombre}
                  {pk.prescriptor.cedulaProfesional ? ` · Céd. Prof. ${pk.prescriptor.cedulaProfesional}` : ''}
                  {pk.prescriptor.especialidad ? ` · ${pk.prescriptor.especialidad}` : ''}
                </p>
                {pk.clinicianContactRules && (
                  <p style={{ fontSize: 12, color: 'var(--text3)', margin: '6px 0 0', lineHeight: 1.6 }}>
                    {pk.clinicianContactRules}
                  </p>
                )}
              </article>
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
                    <div style={{ color: 'var(--text2)', flex: 1 }}>{TIPO_LABEL[c.tipo] || 'Consulta'} · {conMayusculaInicial(c.estado.replace('-', ' '))}</div>
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

        {/* Mis recetas */}
        {!docsError && docs && docs.length > 0 && (
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
      <nav aria-label="Secciones" className="mi-barra-destinos">
        {DESTINOS.map(d => {
          const activo = destino === d.id
          return (
            <button key={d.id} onClick={() => setDestino(d.id)}
              className="nx-destino-portal"
              aria-current={activo ? 'page' : undefined}>
              <d.icono size={20} aria-hidden />
              <span style={{ fontSize: 'var(--t-overline)' }}>{d.etiqueta}</span>
            </button>
          )
        })}
      </nav>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
        className="nx-acc-plana"
        aria-expanded={abierto}
        data-abierto={abierto ? '' : undefined}
        style={{ width: '100%', textAlign: 'left', border: 'none', padding: 8, margin: -8, borderRadius: 10, cursor: 'pointer' }}
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
