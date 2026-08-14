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
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader, Button, EmptyState, Spinner, Modal, Textarea } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useClinic } from '@/context/ClinicContext'
import { auth } from '@/lib/firebase'
import { tareasVivas, tareasCerradasRecientes, cambiarEstado } from '@/lib/tareas-clinicas/firestore'
import { ordenWorklist, debeEscalar, estaVencida, ETIQUETA_TIPO, type TareaClinica, type EstadoTarea } from '@/lib/tareas-clinicas/modelo'
import { esTareaDeResultado } from '@/lib/tareas-clinicas/progreso-resultado'
import { estadoDeAccion, ORDEN_ESTADO_DE_ACCION, ETIQUETA_ESTADO_DE_ACCION, type EstadoDeAccion } from '@/lib/tareas-clinicas/estado-de-accion'
import { ProgresoResultado } from '@/components/tareas/ProgresoResultado'
import { navegarConContinuidad, esClickDeNavegacionSimple } from '@/lib/ui/continuidad'
import { responderPorElPendiente, siguientePaso } from '@/lib/tareas-clinicas/por-que-esta-aqui'
import { Lente } from '@/components/LenteContextual'
import { AlertTriangle, CheckCircle2, Clock, User, X, ClipboardList, ChevronDown, ChevronUp, HelpCircle, FileText } from 'lucide-react'

function fechaCorta(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : ''
}

/** Con día y hora: en la línea de tiempo de un pendiente, el día solo no basta
    para saber si el resultado se marcó antes o después de la consulta. */
function fechaLarga(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isFinite(d.getTime())
    ? d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''
}

/**
 * EL DISPARADOR DE LAS DOS PREGUNTAS QUE FALTABAN (§10).
 *
 * Va en las DOS clases de tarjeta —abierta y cerrada— a propósito: «¿qué ha
 * pasado?» es justamente lo que se le pregunta a algo que ya se cerró, y una
 * cerrada sin su historia es otra vez un documento al que nadie vuelve.
 *
 * Subordinado por posición y peso (§16: lo que no es la tarea principal se ve
 * menos), y con `aria-expanded` porque abre algo — la deuda que la medición de
 * la Capa 4 encontró en `SelloProcedencia` sin buscarla.
 *
 * **Declarado FUERA del componente de página**, como `Bloque`: el linter marcó
 * las dos primeras versiones («Cannot create components during render»), y
 * tenía razón por la misma razón que este fichero ya documenta para `Tarjeta`
 * — un componente creado en el render es un tipo nuevo en cada render, y su
 * subárbol se remonta. Aquí no había estado que perder todavía, pero el día que
 * lo hubiera el fallo sería invisible y difícil de atribuir.
 */
function AbrirPorQue({ t, abierta, onAbrir }: {
  t: TareaClinica
  abierta: boolean
  onAbrir: (t: TareaClinica, disparador: HTMLElement) => void
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-expanded={abierta}
      onClick={e => onAbrir(t, e.currentTarget as HTMLElement)}
    >
      <HelpCircle size={14} /> ¿Por qué está aquí?
    </Button>
  )
}

/**
 * Cada una de las cuatro respuestas de §10 dentro de la lente.
 *
 * El rótulo es un <h3> DE VERDAD, no un span en versalitas: la lente ya se
 * anuncia como región con nombre, y dentro de ella las cuatro preguntas son la
 * estructura por la que navega un lector de pantalla. Toda la tipografía vive
 * en la hoja (`.nx-porque*`) — el trinquete de diseño paró la primera versión,
 * que la escribía en línea fuera de la escala.
 */
function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="nx-porque-bloque">
      <h3 className="nx-porque-rotulo">{titulo}</h3>
      {children}
    </section>
  )
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
function Tarjeta({ t, ahora, porQueId, onAbrirPorQue, onMover, onCancelar, onIrAlExpediente }: {
  t: TareaClinica
  ahora: number
  porQueId: string | null
  onAbrirPorQue: (t: TareaClinica, disparador: HTMLElement) => void
  onMover: (t: TareaClinica, nuevo: EstadoTarea) => void
  onCancelar: (t: TareaClinica) => void
  onIrAlExpediente: (e: React.MouseEvent<HTMLAnchorElement>, patientId: string) => void
}) {
    const esc = debeEscalar(t, ahora)
    const vencida = estaVencida(t, ahora)
    const paso = siguientePaso(t)
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
            <Button size="sm" onClick={() => onMover(t, paso.estado)}>
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
          <AbrirPorQue t={t} abierta={porQueId === t.id} onAbrir={onAbrirPorQue} />
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
        <AbrirPorQue t={t} abierta={porQueId === t.id} onAbrir={onAbrirPorQue} />
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
  const [cancelando, setCancelando] = useState<TareaClinica | null>(null)
  const [motivo, setMotivo] = useState('')
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
   * §10 — el pendiente cuyas cuatro respuestas están abiertas. UNA a la vez y
   * en la página: ver la cabecera de este fichero para por qué no puede vivir
   * dentro de `Tarjeta`.
   *
   * Se guarda el ID y no la tarea: si `mover()` recarga la lista con la lente
   * abierta, una copia del objeto seguiría enseñando el estado viejo — la foto
   * de un dato clínico en vez del dato (la razón por la que la propia lente
   * renderiza `children` del consumidor y no guarda copia).
   */
  const [porQueId, setPorQueId] = useState<string | null>(null)
  /** El control que abrió la lente, para que el foco vuelva ahí al cerrarla. */
  const disparadorPorQue = useRef<HTMLElement | null>(null)

  const uid = auth.currentUser?.uid ?? ''

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    tareasVivas(clinicId)
      .then(t => { if (vivo) { setTareas(t); setErrorCarga(''); setAhora(Date.now()) } })
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
  }, [clinicId, recarga])

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

  const mover = useCallback(async (t: TareaClinica, nuevo: EstadoTarea, motivoCancelacion?: string) => {
    if (!clinicId) return
    const r = await cambiarEstado(clinicId, t, nuevo, { motivoCancelacion })
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

  /** Abrir el diálogo de cancelación. Vivía en línea dentro de `Tarjeta`, que
      ahora es un componente de módulo y no ve el estado de la página. */
  const abrirCancelar = useCallback((t: TareaClinica) => {
    setCancelando(t)
    setMotivo('')
  }, [])

  /** Abrir/cerrar la lente de §10, recordando a qué control vuelve el foco. */
  const alternarPorQue = useCallback((t: TareaClinica, disparador: HTMLElement) => {
    disparadorPorQue.current = disparador
    setPorQueId(id => (id === t.id ? null : t.id ?? null))
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
              {urgentes.map(t => <Tarjeta key={t.id} t={t} ahora={ahora} porQueId={porQueId} onAbrirPorQue={alternarPorQue} onMover={mover} onCancelar={abrirCancelar} onIrAlExpediente={irAlExpediente} />)}
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
                {items.map(t => <Tarjeta key={t.id} t={t} ahora={ahora} porQueId={porQueId} onAbrirPorQue={alternarPorQue} onMover={mover} onCancelar={abrirCancelar} onIrAlExpediente={irAlExpediente} />)}
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
      */}
      {(() => {
        const t = porQueId
          ? ([...tareas, ...(cerradas ?? [])].find(x => x.id === porQueId) ?? null)
          : null
        if (!t) return null
        const r = responderPorElPendiente(t, uid)
        return (
          <Lente
            abierta
            titulo={t.titulo}
            subtitulo={t.patientNombre}
            invocador={disparadorPorQue}
            alCerrar={() => setPorQueId(null)}
          >
            <div className="nx-porque">
              <Bloque titulo="Por qué está aquí">
                <p className="nx-porque-texto">{r.porQue}</p>
                {/*
                  LA TRAZA HACIA ATRÁS, POR FIN A LA VISTA. `notaId` se escribe
                  desde que existe `derivar.ts` y hasta hoy sólo lo leía el
                  compositor de ids de Firestore. Aterriza en la consulta con la
                  nota abierta: ahí está el sello de procedencia, y con él el
                  segundo exacto del dictado. La cadena de §21 sin saltos.
                */}
                {r.traza && (
                  <Link
                    href={r.traza.href}
                    className="nx-porque-traza"
                  >
                    <FileText size={14} /> Ver la consulta de la que salió
                  </Link>
                )}
                {/* Ausencia de dato no es dato de ausencia: se dice que no
                    consta la traza, no que la tarea nació de la nada. */}
                {!r.traza && (
                  <p className="nx-meta" style={{ margin: 0 }}>
                    No consta de qué consulta salió.
                  </p>
                )}
              </Bloque>

              <Bloque titulo="Quién responde">
                <p className="nx-porque-texto">{r.quienResponde}</p>
              </Bloque>

              <Bloque titulo="Qué ha pasado">
                {r.queHaPasado.length === 0 ? (
                  <p className="nx-meta" style={{ margin: 0 }}>No consta ningún movimiento.</p>
                ) : (
                  <ol className="nx-porque-hitos">
                    {r.queHaPasado.map((h, i) => (
                      <li key={i} className="nx-porque-hito">
                        <span className="nx-porque-texto">{h.que}</span>
                        {h.cuando && <span className="nx-num nx-meta">{fechaLarga(h.cuando)}</span>}
                        {/*
                          El hueco entero por el que se pierde un resultado: el
                          estudio hecho, el resultado en el sistema, y nadie que
                          lo haya leído. Va en rojo y con su nombre porque leer
                          «el trabajo se hizo» y entender «listo» es el error.
                        */}
                        {h.sinRevisar && (
                          <span className="nx-critico" style={{ margin: 0 }}>
                            <AlertTriangle size={13} /> Hecho, pero nadie lo ha revisado todavía.
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </Bloque>

              <Bloque titulo="Qué sigue">
                <p className="nx-porque-texto">{r.queSigue}</p>
              </Bloque>
            </div>
          </Lente>
        )
      })()}

      {/*
        Cancelar EXIGE motivo. Sin él, «ya no aplica» y «lo quité de la lista»
        son el mismo gesto, y el segundo es justo lo que hay que poder auditar.
      */}
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
                if (t) mover(t, 'cancelada', motivo.trim())
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
