'use client'
/**
 * EL WORKLIST: todo lo que quedó abierto, en un solo sitio.
 *
 * La pantalla existe porque el pendiente no tenía dónde reclamarse. Estaba en
 * una frase dentro de una nota firmada, y una nota firmada es un documento al
 * que nadie vuelve.
 *
 * Dos decisiones de diseño que no son estéticas:
 *
 *  · **Lo que hay que escalar va arriba y aparte.** Si un resultado crítico sin
 *    dueño se dibuja igual que un seguimiento de rutina, la lista deja de
 *    ordenar y hay que leerla entera — que es como no tenerla.
 *
 *  · **«Completada» no saca la tarea de la lista.** Sale al CERRARLA, que es
 *    cuando alguien dice que la miró. Entre «el laboratorio está hecho» y
 *    «alguien leyó el resultado» vive exactamente el daño que esto evita.
 *
 * ── LAS CUATRO PREGUNTAS DE §10 (V15) ───────────────────────────────────────
 *
 * §10 exige que cada entrada conteste cuatro: por qué está aquí · quién
 * responde · qué ha pasado · qué sigue. La tarjeta contestaba DOS —dueño y
 * siguiente paso—; las otras dos no estaban en la pantalla de ninguna forma, y
 * la traza hacia atrás (`notaId`, «de qué consulta salió») llevaba desde
 * `derivar.ts` guardándose sin que ningún ojo la viera.
 *
 * Las cuatro se contestan ahora en la LENTE CONTEXTUAL (§5 Capa 4 / §21), no en
 * línea: la respuesta a «¿qué ha pasado?» es la fuente del hecho, y §21 pide
 * inspeccionarla sin salir del sitio ni empujar la cola bajo el dedo.
 *
 * **La lente es UNA, y vive en la página, no dentro de la tarjeta.** No es
 * estilo: `Tarjeta` se declara dentro de este componente, así que React la ve
 * como un TIPO NUEVO en cada render y remonta su subárbol — un `useState`
 * dentro de la tarjeta se perdería en cuanto cualquier cosa de la página
 * cambiara de estado (recargar, filtrar, mover una tarea), y la lente se
 * cerraría sola sin que nadie la cerrara.
 *
 * **Y ya no es de esta pantalla.** El disparador, la lente, los cuatro bloques
 * y la traza viven en `@/components/tareas/PorQueEstaAqui` desde que Hoy
 * necesitó contestar lo mismo sobre el mismo pendiente: `tareasVivas()` es una
 * fuente con dos lectores, y dos plantillas para las cuatro respuestas es la
 * trampa de REG-318 montada otra vez sobre la misma entidad. Esta pantalla
 * conserva lo suyo —los filtros, mover de estado, cancelar con motivo— y
 * consume la pieza.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader, Button, EmptyState, Spinner, Modal, Textarea } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useClinic } from '@/context/ClinicContext'
import { auth } from '@/lib/firebase'
import { tareasVivas, tareasCerradasRecientes, cambiarEstado } from '@/lib/tareas-clinicas/firestore'
import {
  ordenWorklist, debeEscalar, estaVencida, ETIQUETA_TIPO, preguntasAlCerrar,
  COMO_SE_AVISO_ETIQUETA,
  type TareaClinica, type EstadoTarea, type CierreDeTarea, type AvisoAlPaciente, type ComoSeAviso,
} from '@/lib/tareas-clinicas/modelo'
import { esTareaDeResultado } from '@/lib/tareas-clinicas/progreso-resultado'
import {
  leerPerdidos, perdidosDe, olvidar, LLAVE as LLAVE_PERDIDOS, type Perdido,
} from '@/lib/tareas-clinicas/no-se-abrieron'
import { crearTareas } from '@/lib/tareas-clinicas/firestore'
import { estadoDeAccion, ORDEN_ESTADO_DE_ACCION, ETIQUETA_ESTADO_DE_ACCION, type EstadoDeAccion } from '@/lib/tareas-clinicas/estado-de-accion'
import { ProgresoResultado } from '@/components/tareas/ProgresoResultado'
import { navegarConContinuidad, esClickDeNavegacionSimple } from '@/lib/ui/continuidad'
import { siguientePaso } from '@/lib/tareas-clinicas/por-que-esta-aqui'
import { loQueElCalendarioDice, citasQueHayQueLeer, type CitaLeible } from '@/lib/tareas-clinicas/lo-que-el-calendario-dice'
import { getAppointments, getAppointment } from '@/lib/firestore'
import { formatDateMX } from '@/lib/availability'
import type { Appointment, AppointmentStatus } from '@/types'
import { DisparadorPorQue, LentePorQue, usePorQue } from '@/components/tareas/PorQueEstaAqui'
import { AlertTriangle, CheckCircle2, Clock, User, X, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react'

function fechaCorta(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : ''
}

/*
  LOS TOKENS SON LOS DE ESTA APP, NO LOS GENÉRICOS.
  La primera versión usaba --danger, --primary, --warning y --text-muted, que
  NO existen aquí: en el navegador real las tarjetas salían con colores
  inválidos —texto sin color propio y urgencia invisible— y ninguna prueba lo
  veía, porque ningún test resuelve variables CSS. Los de verdad son --red,
  --teal, --amber y --text3.

  ── POR QUÉ VIVE FUERA DEL COMPONENTE DE PÁGINA ─────────────────────────────

  Estaba declarada DENTRO de `PendientesPage`, y esta corrida lo pagó. React ve
  un componente declarado en el render como un TIPO NUEVO en cada render, así
  que remonta su subárbol entero: cada `setState` de la página —recargar,
  filtrar, mover una tarea, abrir la lente— tiraba los nodos de las siete
  tarjetas y creaba otros.

  Sin estado dentro no se notaba. Al abrir la lente sí: la medición en
  navegador real (`medir-por-que-esta-aqui-v15.mjs`, fase «antes») lo cazó
  como tres síntomas que parecían de CSS y eran el mismo defecto de React —
  `aria-expanded` que no cambiaba nunca (false → false), el disparador
  «moviéndose» 357-455px, y el foco que NO volvía al cerrar con Escape. Los
  tres porque el botón que la sonda tenía en la mano ya estaba desconectado
  del documento: el que se veía en pantalla era otro nodo.

  La vuelta del foco es §21 —«return exactly where you were»—, así que esto no
  era una optimización: era la interacción que la rebanada viene a entregar,
  rota por una declaración mal colocada. Ninguna prueba de fuente lo habría
  visto.
*/
/**
 * Las citas que NO sirven para sostener un «agendada»: ya no hay nada puesto.
 *
 * `reagendada` está aquí a propósito — esa cita concreta dejó de existir. Que
 * haya otra nueva se verá en la lista, porque la lista son las citas FUTURAS.
 */
/**
 * Lee las citas que los pendientes `agendada` nombran. REG-437.
 *
 * Por identificador y no por ventana: los casos que importan —el paciente no
 * vino, la cita se canceló— ya PASARON, así que una ventana futura los perdería
 * justo a ellos. Topado por `citasQueHayQueLeer`.
 *
 * Una lectura que falla devuelve lo que sí pudo: el resto queda `no_consta`,
 * que es «no se pudo saber», nunca «la cita ya no está».
 */
async function citasDeLasTareas(
  clinicId: string, tareas: readonly TareaClinica[],
): Promise<ReadonlyMap<string, CitaLeible>> {
  const ids = citasQueHayQueLeer(tareas)
  const out = new Map<string, CitaLeible>()
  await Promise.all(ids.map(async id => {
    try {
      const c = await getAppointment(clinicId, id)
      if (c) out.set(id, { id: c.id, estado: c.estado })
    } catch { /* no_consta: no se pudo leer ésta */ }
  }))
  return out
}

const CITA_MUERTA: ReadonlySet<AppointmentStatus> = new Set<AppointmentStatus>([
  'cancelada', 'reagendada', 'no-asistio',
])

function Tarjeta({ t, cita, ahora, porQueId, onAbrirPorQue, onMover, onAgendar, onCerrar, onCancelar, onIrAlExpediente }: {
  t: TareaClinica
  ahora: number
  porQueId: string | null
  onAbrirPorQue: (t: TareaClinica, disparador: HTMLElement) => void
  onMover: (t: TareaClinica, nuevo: EstadoTarea) => void
  onAgendar: (t: TareaClinica) => void
  cita?: CitaLeible
  /** Cerrar pasa por un formulario: no es lo mismo que avanzar de estado (REG-361). */
  onCerrar: (t: TareaClinica) => void
  onCancelar: (t: TareaClinica) => void
  onIrAlExpediente: (e: React.MouseEvent<HTMLAnchorElement>, patientId: string) => void
}) {
    const esc = debeEscalar(t, ahora)
    const vencida = estaVencida(t, ahora)
    const paso = siguientePaso(t)
    const calendario = loQueElCalendarioDice(t, t.citaId ? cita : undefined)
    return (
      <div style={{
        border: `1px solid ${esc.escalar ? 'var(--red)' : 'var(--border)'}`,
        borderLeft: `4px solid ${t.prioridad === 'critica' ? 'var(--red)' : t.prioridad === 'alta' ? 'var(--amber)' : 'var(--border)'}`,
        borderRadius: 10, padding: 14, background: 'var(--panel)', display: 'grid', gap: 8,
      }}>
        {/*
          Roles tipográficos de VISUAL_DNA §2 (V15-VISUAL-SYSTEM-001, 2ª
          rebanada). R3: la identidad del paciente es el elemento tipográfico
          DOMINANTE de su entrada — «tarea» está en la lista literal de R3, y
          el modelo de producto V15 (§4) lo dice en clínico: el médico no
          piensa «abro el módulo de labs», piensa «el resultado de ESTE
          paciente necesita mi decisión». Antes el paciente era un enlace de
          13px enterrado en la fila de metadatos; ahora encabeza la entrada y
          sigue navegando al expediente. El título de la tarea baja a segunda
          línea: dice QUÉ, el paciente dice QUIÉN, y quién manda.
        */}
        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            {t.patientNombre && t.patientId && (
              <Link
                href={`/expediente/${t.patientId}`}
                className="nx-ident"
                onClick={e => onIrAlExpediente(e, t.patientId!)}
              >
                {t.patientNombre}
              </Link>
            )}
            {t.patientNombre && !t.patientId && <span className="nx-ident">{t.patientNombre}</span>}
            <span className="nx-estado">{ETIQUETA_TIPO[t.tipo] ?? 'Pendiente'}</span>
          </div>
          <strong style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>{t.titulo}</strong>
        </div>

        {/*
          §9 del master loop V15: un resultado es una cola de trabajo de ocho
          etapas, no una tabla estática. Sólo se pinta para los DOS tipos que
          de verdad son "un resultado" (estudio pedido / resultado por
          revisar) — un seguimiento o una receta no tienen esas etapas.
        */}
        {esTareaDeResultado(t.tipo) && (
          <ProgresoResultado estado={t.estado} ownerUid={t.ownerUid} prioridad={t.prioridad} />
        )}

        {/**
          * REG-437 · lo que el calendario dice de un «agendada».
          *
          * `agendada` era una declaración que nadie contrastaba: con la cita
          * cancelada o el paciente sin acudir, el pendiente seguía leyéndose
          * como «esperando al paciente» para siempre. Se pinta SÓLO cuando hay
          * algo que decir — el caso normal (la cita sigue en pie) calla, porque
          * decirlo en cada tarjeta sería ruido que enseña a ignorar el aviso.
          */}
        {calendario.pideAtencion && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 2,
            fontSize: 12, lineHeight: 1.45, color: 'var(--amber)',
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{calendario.frase}</span>
          </div>
        )}

        {/* El paciente ya no vive aquí: subió a la cabecera como identidad.
            El metadato queda para dueño y vencimiento — .nx-meta, fechas en
            .nx-num (tabulares). */}
        <div className="nx-meta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <User size={13} /> {t.ownerNombre || 'sin dueño'}
          </span>
          {t.venceEn && (
            <span className="nx-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: vencida ? 'var(--red)' : undefined }}>
              <Clock size={13} /> {vencida ? 'venció' : 'vence'} {fechaCorta(t.venceEn)}
            </span>
          )}
        </div>

        {t.detalle && <p className="nx-meta" style={{ margin: 0 }}>{t.detalle}</p>}

        {esc.escalar && (
          <p className="nx-critico" style={{ margin: 0 }}>
            <AlertTriangle size={14} /> {esc.motivo}
          </p>
        )}

        {/*
          «Ya se hizo» y «lo revisé» son DOS botones a propósito. Fundirlos en uno
          dejaría cerrar sin haber mirado el resultado, que es el fallo entero.
        */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {paso && (
            <Button
              size="sm"
              onClick={() => {
                if (paso.estado === 'cerrada') return onCerrar(t)
                /* REG-437 · «agendada» no se declara: se señala una cita. */
                if (paso.estado === 'agendada') return onAgendar(t)
                return onMover(t, paso.estado)
              }}
            >
              {paso.estado === 'cerrada' ? <CheckCircle2 size={14} /> : null} {paso.texto}
            </Button>
          )}
          {t.estado === 'completada' && (
            <span className="nx-meta" style={{ alignSelf: 'center' }}>
              Hecha, pero nadie la ha revisado todavía.
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={() => onCancelar(t)}>
            <X size={14} /> Ya no aplica
          </Button>
          <DisparadorPorQue tarea={t} abierta={porQueId === t.id} onAbrir={onAbrirPorQue} />
        </div>
      </div>
    )
  }

/**
 * Sólo lectura, a propósito: una tarea `cerrada` no tiene transición legal
 * hacia ningún otro estado (`TRANSICIONES.cerrada = []`) — pintarle los
 * mismos botones que `Tarjeta` (Tomarla / Ya se hizo / Ya no aplica) le
 * ofrecería al médico una acción que `cambiarEstado` va a rechazar. La
 * constancia de quién y cuándo la cerró es el contenido que importa aquí.
 */
function TarjetaCerrada({ t, porQueId, onAbrirPorQue, onIrAlExpediente }: {
  t: TareaClinica
  porQueId: string | null
  onAbrirPorQue: (t: TareaClinica, disparador: HTMLElement) => void
  onIrAlExpediente: (e: React.MouseEvent<HTMLAnchorElement>, patientId: string) => void
}) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10, padding: 14,
      background: 'var(--panel)', display: 'grid', gap: 6, opacity: 0.85,
    }}>
      {/* Misma estructura de cabecera que Tarjeta (identidad → tipo → título):
          una tarjeta cerrada es la misma entidad, subordinada por opacidad,
          no un diseño aparte. El punto del tipo va en verde: «cerrado/
          completo (atenuado, nunca celebratorio)» — VISUAL_DNA §3. */}
      <div style={{ display: 'grid', gap: 2 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          {t.patientNombre && t.patientId && (
            <Link
              href={`/expediente/${t.patientId}`}
              className="nx-ident"
              onClick={e => onIrAlExpediente(e, t.patientId!)}
            >
              {t.patientNombre}
            </Link>
          )}
          {t.patientNombre && !t.patientId && <span className="nx-ident">{t.patientNombre}</span>}
          <span className="nx-estado" style={{ ['--estado-tono' as string]: 'var(--green)' }}>
            {ETIQUETA_TIPO[t.tipo] ?? 'Pendiente'}
          </span>
        </div>
        <strong style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>{t.titulo}</strong>
      </div>
      <div className="nx-meta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="nx-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle2 size={13} /> Cerrada {fechaCorta(t.cerradaEn)}
        </span>
        <DisparadorPorQue tarea={t} abierta={porQueId === t.id} onAbrir={onAbrirPorQue} />
      </div>
    </div>
  )
}


export default function PendientesPage() {
  const { toast } = useToast()
  const { clinicId } = useClinic()
  const router = useRouter()
  const [tareas, setTareas] = useState<TareaClinica[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  /**
   * REG-344 — 0 = la lista está completa; N = se alcanzó el tope N y HAY
   * pendientes vivos fuera de ella. En esta pantalla eso no se puede callar:
   * quedarse corto en silencio se lee como «todo está al día», que es la
   * conclusión más peligrosa posible aquí — la misma razón por la que un fallo
   * de lectura ya se distingue de una lista vacía dos líneas más abajo.
   */
  const [truncado, setTruncado] = useState(0)
  const [cancelando, setCancelando] = useState<TareaClinica | null>(null)
  /**
   * ── EL FORMULARIO DE CIERRE (REG-361) ───────────────────────────────────
   *
   * REG-360 le dio campo a las tres etapas del §9 —decisión, acción, aviso al
   * paciente— y **nadie las llenaba**, así que en producción seguían saliendo
   * `sin_dato`. Un campo que ninguna pantalla llena es exactamente la familia
   * «escrito y sin conectar» a un paso de ocurrir.
   */
  const [cerrando, setCerrando] = useState<TareaClinica | null>(null)
  const [decision, setDecision] = useState('')
  const [accion, setAccion] = useState('')
  const [aviso, setAviso] = useState<AvisoAlPaciente | ''>('')
  /** REG-445 · de qué manera consta el aviso. Opcional. */
  const [como, setComo] = useState<ComoSeAviso | ''>('')
  const [motivo, setMotivo] = useState('')
  /**
   * REG-437 · «Ya quedó agendada» exige decir A QUÉ CITA.
   *
   * Antes era una declaración que nadie podía contrastar: si esa cita se
   * cancelaba o el paciente no venía, el pendiente se quedaba esperando a nadie
   * para siempre. Ahora se elige, y con el identificador guardado el worklist
   * puede decir después qué pasó de verdad.
   */
  const [agendando, setAgendando] = useState<TareaClinica | null>(null)
  /** Las citas que los pendientes `agendada` nombran, por identificador. */
  const [citasPorId, setCitasPorId] = useState<ReadonlyMap<string, CitaLeible>>(new Map())
  const [citasDelPaciente, setCitasDelPaciente] = useState<Appointment[] | null>(null)
  const [cargandoCitas, setCargandoCitas] = useState(false)
  const [soloMias, setSoloMias] = useState(false)
  const [recarga, setRecarga] = useState(0)
  /**
   * «Closed recently» (§10) — a propósito NO se carga con el resto: es una
   * lectura APARTE a Firestore (`tareasCerradasRecientes`, `tareasVivas()`
   * excluye `cerrada`), y esta es la pantalla que el médico más visita. Se
   * paga esa lectura sólo si el médico la pide, no en cada carga.
   */
  const [cerradas, setCerradas] = useState<TareaClinica[] | null>(null)
  const [cargandoCerradas, setCargandoCerradas] = useState(false)
  /**
   * El «ahora» con el que se decide qué está vencido se fija AL CARGAR, no en
   * cada render. Leer el reloj mientras se pinta hace que dos renders del mismo
   * segundo puedan discrepar sobre si una tarea venció — y una tarjeta que salta
   * sola entre «vence» y «venció» es exactamente la clase de detalle por la que
   * se deja de creer en una lista.
   */
  const [ahora, setAhora] = useState(0)
  /**
   * REG-411 — LOS PENDIENTES QUE NO SE PUDIERON ABRIR.
   *
   * No están en Firestore: no existen para `tareasVivas`. Viven en el
   * almacenamiento local porque es lo único que sobrevive a la navegación y al
   * cierre de la pestaña, que es cuando se perdían.
   *
   * Se ofrecen aquí y no se reintentan solos: volver a escribir en el expediente
   * de un paciente por decisión de la máquina es lo que REG-390 reserva.
   */
  const [perdidos, setPerdidos] = useState<Perdido[]>([])
  const [reabriendo, setReabriendo] = useState(false)
  /**
   * §10 — el pendiente cuyas cuatro respuestas están abiertas. UNA a la vez y
   * en la página: ver la cabecera de este fichero para por qué no puede vivir
   * dentro de `Tarjeta`.
   *
   * Se guarda el ID y no la tarea: si `mover()` recarga la lista con la lente
   * abierta, una copia del objeto seguiría enseñando el estado viejo — la foto
   * de un dato clínico en vez del dato (la razón por la que la propia lente
   * renderiza `children` del consumidor y no guarda copia).
   */
  const { porQueId, disparador: disparadorPorQue, scrollAlAbrir: scrollPorQue, alternar: alternarPorQue, cerrar: cerrarPorQue } = usePorQue()

  const uid = auth.currentUser?.uid ?? ''

  /**
   * Lo perdido se lee DENTRO de la carga del worklist, no en un efecto aparte.
   *
   * Dos razones y las dos importan: se refresca exactamente cuando se refresca
   * la lista —así el recuadro y la lista nunca discrepan— y un `setState`
   * síncrono en el cuerpo de un efecto es lo que el compilador de React rechaza
   * por cascada de renders. Aquí va en el callback, que es donde tiene que ir.
   */
  const leerAlmacen = useCallback(
    () => { try { return localStorage.getItem(LLAVE_PERDIDOS) } catch { return null } },
    [],
  )

  /** Volver a intentarlo, cuando el médico lo pide. */
  const reabrirPerdidos = useCallback(async () => {
    if (!clinicId || !perdidos.length) return
    setReabriendo(true)
    try {
      const { noEntraron } = await crearTareas(clinicId, perdidos.map(p => p.tarea))
      const quedan = olvidar(
        leerPerdidos(leerAlmacen),
        perdidos.map(p => p.tarea).filter(t => !noEntraron.includes(t)),
      )
      try { localStorage.setItem(LLAVE_PERDIDOS, JSON.stringify(quedan)) } catch { /* sin espacio */ }
      setPerdidos(perdidosDe(clinicId, quedan))
      if (noEntraron.length) toast(`${noEntraron.length} siguen sin abrirse. Se conservan.`, 'error')
      else toast('Los pendientes que faltaban ya están abiertos', 'success')
      setRecarga(r => r + 1)
    } catch {
      toast('No se pudieron reabrir. Se conservan para otro intento.', 'error')
    } finally {
      setReabriendo(false)
    }
  }, [clinicId, perdidos, toast, leerAlmacen])

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    tareasVivas(clinicId)
      .then(w => {
        if (!vivo) return
        setTareas(w.tareas); setTruncado(w.truncada ? w.tope : 0); setErrorCarga(''); setAhora(Date.now())
        /**
         * REG-437 · qué dice el calendario de los que se declararon agendados.
         *
         * Se leen SÓLO las citas que las tareas nombran, por identificador, y
         * con tope: la ventana futura no serviría —los casos que importan
         * (no-asistió, atendida) ya pasaron— y una lectura sin cota en el camino
         * diario es lo que WS-03 prohíbe.
         *
         * Si esta lectura falla no se pinta nada: `no_consta` es «no se pudo
         * saber», nunca «la cita ya no está».
         */
        void citasDeLasTareas(clinicId, w.tareas).then(m => { if (vivo) setCitasPorId(m) })
        /* Los que no están en Firestore porque no se pudieron escribir (REG-411). */
        setPerdidos(perdidosDe(clinicId, leerPerdidos(leerAlmacen)))
      })
      .catch(e => {
        // Un fallo de lectura NO puede verse igual que «no hay pendientes»:
        // en esta pantalla eso se lee como «todo está al día», que es la
        // conclusión más peligrosa posible aquí.
        //
        // Y se REGISTRA la causa: al abrir esta pantalla por primera vez en
        // producción salió el error genérico y la consola estaba muda, porque
        // este catch se tragaba el motivo. Diagnosticar a ciegas costó más que
        // escribir esta línea.
        console.error('[pendientes] no se pudo leer el worklist', e)
        if (vivo) setErrorCarga('No se pudieron cargar los pendientes. Revisa tu conexión y reintenta.')
      })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [clinicId, leerAlmacen, recarga])

  const visibles = useMemo(() => {
    const base = soloMias ? tareas.filter(t => t.ownerUid === uid) : tareas
    return [...base].sort((a, b) => ordenWorklist(a, b, ahora))
  }, [tareas, soloMias, uid, ahora])

  const urgentes = visibles.filter(t => debeEscalar(t, ahora).escalar)
  const resto = visibles.filter(t => !debeEscalar(t, ahora).escalar)

  /**
   * V15-FOLLOWUP-WORK-001 (Fase 7, §10): «group by action state, not by
   * arbitrary module». `resto` ya no se pinta como una sola lista «Abiertos»:
   * se reparte por lo que cada tarea está ESPERANDO — mismo criterio que ya
   * usa `debeEscalar` para «urgentes», sólo que aquí no hay urgencia, hay
   * un porqué distinto. Ninguna tarea vencida llega aquí (`debeEscalar` ya
   * las captura arriba), así que el grupo `vencida` de `estadoDeAccion`
   * nunca aparece en `gruposResto` — comprobado en el guardián de esta
   * pantalla, no sólo supuesto.
   */
  const gruposResto = useMemo(() => {
    const acc = {} as Record<EstadoDeAccion, TareaClinica[]>
    for (const t of resto) {
      const cat = estadoDeAccion(t, ahora)
      ;(acc[cat] ??= []).push(t)
    }
    return acc
  }, [resto, ahora])

  const mover = useCallback(async (
    t: TareaClinica, nuevo: EstadoTarea,
    extra: { motivoCancelacion?: string; cierre?: Partial<CierreDeTarea>; citaId?: string } = {},
  ) => {
    if (!clinicId) return
    const r = await cambiarEstado(clinicId, t, nuevo, extra)
    if (!r.ok) { toast(r.motivo, 'error'); return }
    toast(nuevo === 'cerrada' ? 'Cerrada' : 'Actualizada', 'success')
    setRecarga(n => n + 1)
  }, [clinicId, toast])

  /**
   * §20, segunda cadena: Result queue → Patient result. El objeto compartido
   * es la IDENTIDAD DEL PACIENTE — el mismo .nx-ident que encabeza la tarjeta
   * (R3) viaja hasta el <h1> del Patient Anchor. No es el título del
   * resultado: ese no tiene caja estable en el expediente y morfear hacia un
   * elemento invisible es animar hacia la nada (la decisión entera, con §9 y
   * §21 leídos, vive en src/lib/ui/continuidad.ts). El tramo «→ Source» es
   * Source Reveal (§21): revelación en el flujo, sin ruta que coreografiar.
   * Sólo el click simple intercepta; Ctrl/Cmd/central conservan su pestaña.
   */
  const irAlExpediente = useCallback((e: React.MouseEvent<HTMLAnchorElement>, patientId: string) => {
    if (!esClickDeNavegacionSimple(e)) return
    e.preventDefault()
    navegarConContinuidad(() => router.push(`/expediente/${patientId}`), e.currentTarget)
  }, [router])

  const verCerradas = useCallback(async () => {
    if (cerradas !== null) { setCerradas(null); return } // ya visibles: colapsar
    if (!clinicId) return
    setCargandoCerradas(true)
    try {
      const t = await tareasCerradasRecientes(clinicId)
      setCerradas([...t].sort((a, b) => (b.cerradaEn ?? '').localeCompare(a.cerradaEn ?? '')))
    } catch (e) {
      console.error('[pendientes] no se pudieron leer los cerrados recientes', e)
      toast('No se pudieron cargar los cerrados recientes.', 'error')
    } finally {
      setCargandoCerradas(false)
    }
  }, [clinicId, cerradas, toast])

  /**
   * REG-437 · abrir el elegidor de cita.
   *
   * Se leen las citas FUTURAS de ese paciente. Si hay exactamente una no hay
   * ambigüedad y se ofrece marcada; si hay varias, elige el médico; si no hay
   * ninguna, se dice — y ahí está el hallazgo: se iba a declarar «agendada» sin
   * que existiera una cita a la que apuntar.
   */
  const abrirAgendar = useCallback(async (t: TareaClinica) => {
    setAgendando(t)
    setCitasDelPaciente(null)
    if (!clinicId) return
    setCargandoCitas(true)
    try {
      const desde = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const todas = await getAppointments(clinicId, { desde })
      setCitasDelPaciente(todas.filter(c => c.pacienteId === t.patientId && !CITA_MUERTA.has(c.estado)))
    } catch (e) {
      console.error('[pendientes] no se pudieron leer las citas del paciente', e)
      /* `null` sigue significando «no se pudo leer», que NO es «no tiene citas». */
      toast('No se pudieron leer las citas de este paciente.', 'error')
    } finally {
      setCargandoCitas(false)
    }
  }, [clinicId, toast])

  /** Abrir el diálogo de cancelación. Vivía en línea dentro de `Tarjeta`, que
      ahora es un componente de módulo y no ve el estado de la página. */
  const abrirCierre = useCallback((t: TareaClinica) => {
    setDecision(''); setAccion(''); setAviso(''); setComo('')
    setCerrando(t)
  }, [])

  const abrirCancelar = useCallback((t: TareaClinica) => {
    setCancelando(t)
    setMotivo('')
  }, [])

  return (
    <div className="nx-canvas">
      <PageHeader
        title="Pendientes"
        subtitle="Estudios pedidos, resultados sin revisar y recetas sin entregar. Salen solos al firmar la nota."
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Button size="sm" variant={soloMias ? 'primary' : 'ghost'} onClick={() => setSoloMias(v => !v)}>
          {soloMias ? 'Viendo sólo los míos' : 'Ver sólo los míos'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRecarga(n => n + 1)}>Actualizar</Button>
      </div>

      {/**
        * REG-344 — «no hay nada pendiente» y «no lo he leído entero» no son lo
        * mismo, y en esta pantalla confundirlos es lo más caro que puede pasar.
        *
        * La consulta no lleva `orderBy` a propósito (evita un índice compuesto
        * que ya tumbó esta pantalla una vez), así que lo que viene es un
        * subconjunto ARBITRARIO: entre lo que falta puede estar un resultado
        * crítico sin revisar. Mientras eso siga así, el aviso es la defensa.
        */}
      {perdidos.length > 0 && (
        <div role="status" style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, marginBottom: 14,
          background: 'color-mix(in srgb, var(--red) 8%, transparent)',
          border: '1px solid var(--red)', borderRadius: 10, color: 'var(--text2)', fontSize: 14,
        }}>
          <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div>
              <strong>{perdidos.length}</strong> pendiente(s) no se pudieron abrir cuando se
              firmó la nota o se emitió la orden. <strong>No están en la lista de abajo.</strong>
            </div>
            <ul style={{ margin: '6px 0 10px', paddingLeft: 18 }}>
              {perdidos.slice(0, 5).map((p, i) => (
                <li key={i}>{p.tarea.titulo}{p.tarea.patientNombre ? ` — ${p.tarea.patientNombre}` : ''}</li>
              ))}
            </ul>
            <Button onClick={reabrirPerdidos} disabled={reabriendo}>
              {reabriendo ? 'Abriendo…' : 'Volver a abrirlos'}
            </Button>
          </div>
        </div>
      )}

      {!cargando && truncado > 0 && (
        <div role="status" style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, marginBottom: 14,
          background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
          border: '1px solid var(--amber)', borderRadius: 10, color: 'var(--text2)', fontSize: 14,
        }}>
          <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <span>
            Se están mostrando <strong>{truncado}</strong> pendientes y <strong>hay más</strong>.
            Esta lista <strong>no está completa</strong>: cierra los que puedas para volver a verla entera.
          </span>
        </div>
      )}

      {cargando ? <Spinner /> : errorCarga ? (
        <div style={{ padding: 16, border: '1px solid var(--red)', borderRadius: 10, color: 'var(--red)' }}>
          {errorCarga}
        </div>
      ) : !visibles.length ? (
        <EmptyState
          icon={<ClipboardList size={40} />}
          title="Nada abierto"
          description="Cuando firmes una consulta con estudios o receta, sus pendientes aparecen aquí con fecha y dueño."
        />
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {urgentes.length > 0 && (
            <section style={{ display: 'grid', gap: 10 }}>
              <h2 style={{ fontSize: 14, margin: 0, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} /> Requiere atención ({urgentes.length})
              </h2>
              {urgentes.map(t => <Tarjeta key={t.id} t={t} cita={t.citaId ? citasPorId.get(t.citaId) : undefined} ahora={ahora} porQueId={porQueId} onAbrirPorQue={alternarPorQue} onMover={mover} onAgendar={abrirAgendar} onCerrar={abrirCierre} onCancelar={abrirCancelar} onIrAlExpediente={irAlExpediente} />)}
            </section>
          )}
          {ORDEN_ESTADO_DE_ACCION.filter(cat => cat !== 'vencida').map(cat => {
            const items = gruposResto[cat]
            if (!items?.length) return null
            return (
              <section key={cat} style={{ display: 'grid', gap: 10 }}>
                <h2 style={{ fontSize: 14, margin: 0, color: 'var(--text3)' }}>
                  {ETIQUETA_ESTADO_DE_ACCION[cat]} ({items.length})
                </h2>
                {items.map(t => <Tarjeta key={t.id} t={t} cita={t.citaId ? citasPorId.get(t.citaId) : undefined} ahora={ahora} porQueId={porQueId} onAbrirPorQue={alternarPorQue} onMover={mover} onAgendar={abrirAgendar} onCerrar={abrirCierre} onCancelar={abrirCancelar} onIrAlExpediente={irAlExpediente} />)}
              </section>
            )
          })}
        </div>
      )}

      {/*
        «Closed recently» (§10). Colapsada por defecto y con lectura propia
        a demanda: no compite visualmente con lo abierto (regla del sistema
        de diseño — position/jerarquía antes que cajas) y no le cuesta una
        lectura de Firestore a nadie que no la pida.
      */}
      {!cargando && !errorCarga && (
        <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <Button size="sm" variant="ghost" onClick={verCerradas} disabled={cargandoCerradas}>
            {cargandoCerradas ? (
              'Cargando…'
            ) : cerradas !== null ? (
              <><ChevronUp size={14} /> Ocultar cerrados recientemente</>
            ) : (
              <><ChevronDown size={14} /> Ver cerrados recientemente</>
            )}
          </Button>
          {cerradas !== null && (
            cerradas.length === 0 ? (
              <p className="nx-meta" style={{ margin: '10px 0 0' }}>
                Nada cerrado todavía.
              </p>
            ) : (
              <section style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {cerradas.map(t => <TarjetaCerrada key={t.id} t={t} porQueId={porQueId} onAbrirPorQue={alternarPorQue} onIrAlExpediente={irAlExpediente} />)}
              </section>
            )
          )}
        </div>
      )}

      {/*
        §10 EN LA CAPA 4 — las cuatro respuestas, sin salir de la cola.

        La tarea se BUSCA por id en las dos listas en cada render, en vez de
        guardarse: así, si `mover()` recarga mientras la lente está abierta, lo
        que se lee es el pendiente de ahora. Si desaparece de las dos (se cerró
        y salió de `tareasVivas`), la lente se queda sin sujeto y no se abre —
        que es mejor que enseñar la ficha de algo que ya no está donde dice.

        Buscar aquí y no dentro de la pieza es deliberado: sólo esta pantalla
        sabe en qué listas mirar (las vivas Y las cerradas recientes). La pieza
        recibe la tarea de ahora, o `null`.
      */}
      <LentePorQue
        tarea={porQueId ? ([...tareas, ...(cerradas ?? [])].find(x => x.id === porQueId) ?? null) : null}
        uid={uid}
        invocador={disparadorPorQue}
        scrollAlAbrir={scrollPorQue}
        alCerrar={cerrarPorQue}
      />

      {/*
        ── CERRAR: QUÉ SE DECIDIÓ, QUÉ SE HIZO, SI SE AVISÓ (REG-361) ─────────

        Un resultado crítico revisado y cerrado sin que nadie llamara al paciente
        se veía igual que uno donde sí se llamó. REG-360 le dio campo a las tres
        etapas; esto es lo que las llena.

        La DECISIÓN es obligatoria: cerrar sin decirla es cerrar sin cerrar. La
        acción y el aviso NO lo son —un worklist que cuesta se abandona en una
        semana, y entonces deja de verse el resultado que sí importaba—, pero
        tampoco se inventan: lo que no se marque queda como «no consta», que es
        distinto de «no se hizo».
      */}
      <Modal open={!!cerrando} onClose={() => setCerrando(null)} title="Cerrar: ¿qué se decidió?">
        <div style={{ display: 'grid', gap: 12 }}>
          <p className="nx-meta" style={{ margin: 0 }}>
            Cerrar deja constancia de que alguien lo revisó y decidió. Lo que no marques
            queda como <strong>no consta</strong> — no como «no se hizo».
          </p>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text2)' }}>
            Qué se decidió <span style={{ color: 'var(--red)' }}>· obligatorio</span>
            <Textarea
              value={decision}
              onChange={e => setDecision(e.target.value)}
              placeholder="Se repite en 3 meses / se ajusta la dosis / se deriva a nefrología / normal, sin cambios…"
              rows={2}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text2)' }}>
            Qué se hizo <span style={{ color: 'var(--text3)' }}>(opcional)</span>
            <Textarea
              value={accion}
              onChange={e => setAccion(e.target.value)}
              placeholder="Se pidió el control / se cambió la receta / se agendó la cita…"
              rows={2}
            />
          </label>
          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            <legend style={{ fontSize: 12, color: 'var(--text2)', padding: 0 }}>¿Se le avisó al paciente?</legend>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                ['avisado', 'Sí, se le avisó'],
                ['no_avisado', 'Todavía no'],
                ['no_aplica', 'No hacía falta'],
              ] as const).map(([valor, etiqueta]) => (
                <Button
                  key={valor}
                  size="sm"
                  variant={aviso === valor ? undefined : 'secondary'}
                  onClick={() => setAviso(aviso === valor ? '' : valor)}
                >{etiqueta}</Button>
              ))}
            </div>
            <span className="nx-meta">
              Si no marcas ninguna, queda <strong>sin registrar</strong>: el expediente
              dirá que no consta, no que no se avisó.
            </span>
            {/**
              * REG-445 · DE QUÉ MANERA consta el aviso (D-028).
              *
              * El censo pedía «qué destinatarios cuentan»: hasta hoy sólo
              * constaba sí / todavía no / no hacía falta, sin a quién ni por qué
              * vía. El dueño decidió que las cuatro cuentan.
              *
              * Sólo aparece si se marcó «Sí, se le avisó» — preguntarlo cuando
              * la respuesta es «todavía no» sería pedir el detalle de algo que
              * no ha pasado. Y sigue siendo OPCIONAL: exigirlo convertiría el
              * cierre en un formulario, y un worklist que cuesta se abandona.
              */}
            {aviso === 'avisado' && (
              <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
                <span className="nx-meta">¿De qué manera? (opcional)</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(Object.keys(COMO_SE_AVISO_ETIQUETA) as ComoSeAviso[]).map(valor => (
                    <Button
                      key={valor}
                      size="sm"
                      variant={como === valor ? undefined : 'secondary'}
                      onClick={() => setComo(como === valor ? '' : valor)}
                    >{COMO_SE_AVISO_ETIQUETA[valor]}</Button>
                  ))}
                </div>
                {/**
                  * Un mensaje cuenta como avisado por decisión del dueño, y aun
                  * así esto se dice: el sistema YA SABE que un mensaje puede
                  * morir sin acuse (REG-432, REG-438). Callarlo aquí sería
                  * esconder algo que el propio producto mide.
                  */}
                {como === 'mensaje_enviado' && (
                  <span className="nx-meta" style={{ color: 'var(--amber)' }}>
                    Un mensaje enviado no confirma que se leyera. Queda registrado como avisado,
                    y también queda registrado que fue por mensaje.
                  </span>
                )}
              </div>
            )}
            {/**
              * REG-403 · un valor crítico no es un cierre cualquiera.
              *
              * `avisoAlPaciente` es opcional a propósito —exigirlo en cada cierre
              * convierte el worklist en un formulario y un worklist que cuesta se
              * abandona—, pero ese razonamiento se hizo para el resultado de
              * rutina. En un valor crítico, «lo vi» y «localicé a alguien» son
              * cosas distintas, y esa distinción es justo lo que lo hace crítico.
              *
              * PREGUNTA, no bloquea: si el aviso debe ser obligatorio, y en cuánto
              * tiempo, es política clínica y la fija el médico.
              */}
            {cerrando && preguntasAlCerrar(cerrando, { avisoAlPaciente: aviso || undefined }).map(q => (
              <div
                key={q}
                style={{
                  fontSize: 12, lineHeight: 1.5, padding: '8px 10px', borderRadius: 10,
                  color: 'var(--amber)',
                  background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--amber) 25%, transparent)',
                }}
              >{q}</div>
            ))}
          </fieldset>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setCerrando(null)}>Volver</Button>
            <Button
              disabled={!decision.trim()}
              onClick={() => {
                const t = cerrando
                setCerrando(null)
                if (t) {
                  mover(t, 'cerrada', {
                    cierre: {
                      decision: decision.trim(),
                      ...(accion.trim() ? { accion: accion.trim() } : {}),
                      ...(aviso ? { avisoAlPaciente: aviso } : {}),
                      ...(aviso === 'avisado' && como ? { comoSeAviso: como } : {}),
                    },
                  })
                }
              }}
            >
              <CheckCircle2 size={14} /> Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/*
        Cancelar EXIGE motivo. Sin él, «ya no aplica» y «lo quité de la lista»
        son el mismo gesto, y el segundo es justo lo que hay que poder auditar.
      */}
      {/**
        * REG-437 · a qué cita quedó agendado.
        *
        * El botón decía «Ya quedó agendada» y guardaba una declaración sin
        * respaldo. Con el identificador, el worklist puede decir después que esa
        * cita se canceló, se movió o que el paciente no vino — que es cuando el
        * seguimiento se perdía en silencio.
        */}
      <Modal open={!!agendando} onClose={() => setAgendando(null)} title="¿A qué cita quedó agendado?">
        <div style={{ display: 'grid', gap: 12 }}>
          {cargandoCitas && <p className="nx-meta" style={{ margin: 0 }}>Buscando sus citas…</p>}
          {!cargandoCitas && citasDelPaciente !== null && citasDelPaciente.length === 0 && (
            <p className="nx-meta" style={{ margin: 0 }}>
              Este paciente no tiene ninguna cita futura. Agéndala primero: sin cita, marcar el
              pendiente como agendado lo deja esperando a nadie.
            </p>
          )}
          {!cargandoCitas && citasDelPaciente !== null && citasDelPaciente.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              {citasDelPaciente.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    const t = agendando
                    setAgendando(null)
                    if (t) mover(t, 'agendada', { citaId: c.id })
                  }}
                  style={{
                    textAlign: 'left', minHeight: 44, padding: '10px 12px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
                    cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
                  }}
                >
                  {formatDateMX(c.fechaHora.slice(0, 10))} · {c.fechaHora.slice(11, 16)}
                  {c.motivo ? ` — ${c.motivo}` : ''}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setAgendando(null)}>Volver</Button>
          </div>
        </div>
      </Modal>
      <Modal open={!!cancelando} onClose={() => setCancelando(null)} title="¿Por qué ya no aplica?">
        <div style={{ display: 'grid', gap: 12 }}>
          <p className="nx-meta" style={{ margin: 0 }}>
            Queda constancia de quién lo canceló y por qué. Un pendiente cancelado no revive.
          </p>
          <Textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="El paciente ya trajo el resultado / se pidió por error / se resolvió en otra consulta…"
            rows={3}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setCancelando(null)}>Volver</Button>
            <Button
              disabled={!motivo.trim()}
              onClick={() => {
                const t = cancelando
                setCancelando(null)
                if (t) mover(t, 'cancelada', { motivoCancelacion: motivo.trim() })
              }}
            >
              Cancelar el pendiente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
