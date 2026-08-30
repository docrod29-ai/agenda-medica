'use client'
/**
 * OPERACIONES — V15-SHELL-GREYBOX-001 / V15-IA-001.
 *
 * §11: «Administrative surfaces remain available but must not dominate
 * physician navigation.» Esta pantalla es el destino de eso: los 18 destinos
 * que salieron del `FlowRail` de 5 (ver `docs/design/v15/IA-001-sitemap.md`
 * para el mapa completo pre/post) siguen existiendo en las MISMAS rutas —
 * nada se movió, nada se borró — sólo cambió desde dónde se llega.
 *
 * No es un dashboard nuevo: es un índice. La jerarquía visual es plana a
 * propósito: agrupar y listar, sin promover ninguna capacidad administrativa
 * a «destino que pesa». El cromo habla las clases del sistema (t-h1,
 * t-overline, t-body) — V15-REMAINING-SCREENS-001, 5ª rebanada.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui'
import {
  CalendarPlus, CalendarDays, Calendar, Clock, BedDouble, Activity,
  TrendingUp, Star, HeartHandshake, Pill, ShieldCheck, FileText, ArrowLeftRight,
  MessageCircle, BookOpen, Settings, CreditCard, LogOut, Moon, Sun, Monitor,
  Download, Loader2,
  type LucideIcon,
} from 'lucide-react'
import { useClinic } from '@/context/ClinicContext'
import { getAppointments, getWaitlist } from '@/lib/firestore'
import { listarItems } from '@/lib/farmacia'
import { hoyISO } from '@/lib/timezone'
import { estadoDeOperaciones, type EstadoDeOperaciones as EstadoOps } from '@/lib/operaciones/estado-de-operaciones'
import { EstadoDeOperaciones } from '@/components/operaciones/EstadoDeOperaciones'
import { useMode } from '@/context/ModeContext'
import { rutaPermitida } from '@/lib/modulos'
import { salirSeguro } from '@/lib/salir-seguro'
import { useTema } from '@/hooks/useTema'
import { useToast } from '@/context/ToastContext'
import { descargarRespaldo } from '@/lib/clinica/descargar-respaldo'

/**
 * RTC-29 — POR QUÉ CADA DESTINO TRAE UN `para`.
 *
 * La re-puntuación §29 del 14-ago dejó esta pantalla en **4.0/10** con el
 * diagnóstico dicho por su nombre: **es un lanzador de aplicaciones**.
 * Diecinueve azulejos idénticos —mismo borde, mismo radio, mismo peso— bajo
 * antetítulos en versalitas. RTC-09 arregló QUÉ vive aquí; nadie había tocado
 * QUÉ ES esto. §34 lo nombra sin rodeos: «un tablero donde todo pesa lo mismo
 * no tiene jerarquía: tiene inventario».
 *
 * La diferencia entre un lanzador y un índice útil no es el adorno: es que el
 * índice dice **para qué sirve cada cosa**, para que se pueda decidir sin
 * entrar. «Reactivación» no significa nada; «avisar a quien lleva meses sin
 * volver» sí.
 *
 * El patrón NO se inventa aquí: es el mismo `para` que `capacidades-del-
 * paciente` declara desde RTC-09 y el que la barra de Herramientas del
 * expediente y la lista de «Herramientas clínicas» de la consulta ya pintan
 * («Antibiograma — interpretar un cultivo: fenotipo, mecanismo de
 * resistencia»). Esta pantalla era la última que hablaba sólo con etiquetas.
 */
type Item = { href: string; label: string; para: string; icon: LucideIcon; modos: 'ambos' | 'medico' }
/** `cadencia` ordena la página: lo de todos los días arriba, lo de una vez abajo. */
type Grupo = { titulo: string; cadencia: string; items: Item[] }

const GRUPOS: Grupo[] = [
  {
    titulo: 'Agenda',
    cadencia: 'Todos los días',
    items: [
      { href: '/asistente', label: 'Agendar rápido', para: 'Dar cita en un par de frases, sin abrir el calendario', icon: CalendarPlus, modos: 'ambos' },
      { href: '/citas', label: 'Citas', para: 'La lista de citas: confirmar, mover, cancelar', icon: CalendarDays, modos: 'ambos' },
      { href: '/calendario', label: 'Calendario', para: 'La semana completa y los bloqueos de agenda', icon: Calendar, modos: 'ambos' },
      { href: '/lista-espera', label: 'Lista de espera', para: 'Quién entra si se libera un hueco', icon: Clock, modos: 'ambos' },
    ],
  },
  /**
   * RTC-09: aquí había un grupo titulado «Clínico» — dentro del índice que se
   * define a sí mismo como «lo administrativo, APARTE del trabajo clínico».
   *
   * Dos cosas distintas vivían juntas y las dos salieron mal:
   *
   * 1. **Consultor IA y Antibiograma** eran páginas-módulo de IA en un menú:
   *    IA feature-first, la antítesis de §3.2. Se fueron al PACIENTE, que es
   *    donde ocurre la pregunta que contestan (ver `capacidades-del-paciente`
   *    y la barra de Herramientas del expediente). No se borró ninguna ruta.
   *
   * 2. **Hospitalización y UCI** no son capacidades: son otro ESCENARIO de
   *    atención (producto Hospital/UCI, ALPHA tras bandera — se usa, no se
   *    vende). Se quedan en el índice secundario porque no son el flujo
   *    primario del médico de consultorio (§11), pero con el nombre de lo que
   *    son. El título viejo afirmaba que el área admin contenía «lo clínico»,
   *    y eso era justo lo que §11 pide que no pase.
   */
  {
    titulo: 'Hospital y UCI',
    cadencia: 'Cuando hay pacientes internados',
    items: [
      { href: '/hospitalizacion', label: 'Hospitalización', para: 'Pacientes internados: censo, evolución y pase de visita', icon: BedDouble, modos: 'ambos' },
      { href: '/uci', label: 'UCI', para: 'Cuidados intensivos: ventilación, sedación, escalas', icon: Activity, modos: 'medico' },
    ],
  },
  {
    titulo: 'Negocio',
    cadencia: 'Cada semana o cada mes',
    items: [
      { href: '/crm', label: 'CRM', para: 'De dónde llegan los pacientes y qué pasó con cada contacto', icon: TrendingUp, modos: 'medico' },
      { href: '/resenas', label: 'Reseñas', para: 'Lo que escriben los pacientes, y pedirlo cuando toca', icon: Star, modos: 'medico' },
      { href: '/reactivacion', label: 'Reactivación', para: 'Avisar a quien lleva meses sin volver', icon: HeartHandshake, modos: 'medico' },
      { href: '/farmacia', label: 'Farmacia', para: 'Existencias del consultorio y lo que se entrega', icon: Pill, modos: 'medico' },
      { href: '/finanzas', label: 'Finanzas', para: 'Cobros, corte del día y cómo va el mes', icon: TrendingUp, modos: 'medico' },
      { href: '/membresias', label: 'Membresías', para: 'Planes de pacientes con seguimiento incluido', icon: CreditCard, modos: 'ambos' },
    ],
  },
  {
    titulo: 'Cumplimiento y documentos',
    cadencia: 'De vez en cuando',
    items: [
      { href: '/cumplimiento', label: 'Cumplimiento', para: 'NOM-004, avisos de privacidad y derechos ARCO', icon: ShieldCheck, modos: 'medico' },
      { href: '/legal', label: 'Documentos legales', para: 'Consentimientos y formatos que el paciente firma', icon: FileText, modos: 'medico' },
      { href: '/migracion', label: 'Migración', para: 'Traer expedientes de otro sistema', icon: ArrowLeftRight, modos: 'medico' },
    ],
  },
  {
    titulo: 'Comunicación',
    cadencia: 'Todos los días',
    items: [
      { href: '/chat', label: 'Chat', para: 'Mensajes con pacientes y con el equipo', icon: MessageCircle, modos: 'ambos' },
    ],
  },
  {
    titulo: 'Sistema',
    cadencia: 'Se configura una vez',
    items: [
      { href: '/guia', label: 'Guía de uso', para: 'Cómo se hace cada cosa aquí dentro', icon: BookOpen, modos: 'ambos' },
      { href: '/configuracion', label: 'Configuración', para: 'Consultorio, receta, horario, equipo e integraciones', icon: Settings, modos: 'ambos' },
    ],
  },
]

/**
 * LAS TRES PIEZAS DE ESTA PANTALLA, DECLARADAS UNA VEZ.
 *
 * Antes de RTC-29 había tres anatomías distintas para lo mismo: los azulejos
 * de los destinos, el botón suelto del tema y el botón suelto de cerrar
 * sesión — cada uno con su borde, su radio y sus números. Tres dialectos en
 * una pantalla que es UNA lista.
 *
 * Y la cadencia va en la cabecera de TODOS los grupos, incluidos «Apariencia»
 * y «Sesión»: un grupo que no dice cada cuánto se usa, en una página cuya
 * jerarquía ES la cadencia, se lee como un olvido. Lo cazó el arnés en
 * navegador, no el guardián: en el fuente esas dos secciones ni siquiera
 * pasaban por el catálogo.
 */
const CAJA_DE_GRUPO: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--s1)',
}

const FILA_DE_GRUPO: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
  padding: '10px 14px', minHeight: 44, boxSizing: 'border-box',
  background: 'transparent', border: 0, color: 'var(--text)', fontFamily: 'inherit',
}

function CabeceraDeGrupo({ titulo, cadencia }: { titulo: string; cadencia: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', margin: '0 0 10px' }}>
      <h2 className="t-overline" style={{ margin: 0 }}>{titulo}</h2>
      {/* CADENCIA: la única jerarquía honesta que esta pantalla puede dar sin
          inventarse datos. No dice «tienes 3 pendientes aquí» —contarlo
          costaría una lectura por área y una cifra equivocada es peor que
          ninguna—; dice cada cuánto se usa, que es un hecho del oficio y
          ordena la página igual de bien. */}
      <span className="nx-meta" style={{ color: 'var(--text3)' }}>{cadencia}</span>
    </div>
  )
}

/**
 * LO QUE PIDE ATENCIÓN, ANTES DE LOS DESTINOS.
 *
 * Las tres lecturas van EN PARALELO y cada una se rescata por separado: si
 * farmacia falla, citas y lista de espera siguen contestando y farmacia queda
 * `null` — que el motor traduce a «no se pudo leer», no a «sin novedad». Un
 * `Promise.all` sin `catch` por rama dejaría la franja entera muda por una
 * colección rota, y una franja muda se lee como consultorio en orden.
 */
function useEstadoOperativo(clinicId: string | null | undefined) {
  /**
   * La lectura se guarda CON el consultorio del que salió, y «cargando» se
   * DERIVA de comparar ese consultorio con el actual. Así no hace falta poner
   * `setCargando(true)` en el cuerpo del efecto —que es una cascada de renders
   * y la regla `react-hooks/set-state-in-effect` lo caza— y de paso se cierra
   * un defecto que la versión con dos estados tenía: al cambiar de consultorio,
   * la franja seguía enseñando las excepciones del anterior hasta que llegaran
   * las nuevas. Estado operativo de OTRO consultorio es exactamente lo que esta
   * pantalla no puede pintar.
   */
  const [leido, setLeido] = useState<{ clinicId: string; estado: EstadoOps } | null>(null)

  useEffect(() => {
    if (!clinicId) return
    let vivo = true
    const rescatar = <T,>(p: Promise<T[]>, que: string): Promise<T[] | null> =>
      p.catch(e => { console.error(`[operaciones] no se pudo leer ${que}`, e); return null })

    // Sólo de hoy en adelante, y con el filtro EN LA CONSULTA: el motor
    // vuelve a descartar las viejas, pero traerse el histórico entero de citas
    // para tirarlo en el cliente crece con los años del consultorio.
    const desde = hoyISO()
    Promise.all([
      rescatar(getAppointments(clinicId, { desde: desde + ' 00:00' }), 'citas'),
      rescatar(getWaitlist(clinicId), 'lista de espera'),
      rescatar(listarItems(clinicId), 'farmacia'),
    ]).then(([citas, listaEspera, farmacia]) => {
      if (!vivo) return
      setLeido({ clinicId, estado: estadoDeOperaciones({ citas, listaEspera, farmacia, hoyISO: desde }) })
    })
    return () => { vivo = false }
  }, [clinicId])

  const listo = !!leido && leido.clinicId === clinicId
  return { estado: listo ? leido.estado : null, cargando: !listo }
}

export default function OperacionesPage() {
  const { clinic, clinicId } = useClinic()
  const { mode } = useMode()
  const { estado, cargando } = useEstadoOperativo(clinicId)

  const grupos = GRUPOS
    .map(g => ({
      ...g,
      items: g.items.filter(it =>
        (it.modos === 'ambos' || mode === 'medico') && rutaPermitida(clinic, it.href)),
    }))
    .filter(g => g.items.length > 0)

  return (
    <div className="nx-canvas" style={{ paddingBottom: 60 }}>
      {/* RTC-31: la misma cabecera que el resto de pantallas. Este índice ya
          decía qué es y de dónde sale su contenido —era de las pocas que lo
          hacían— pero lo decía con su propio par de etiquetas. La pieza es
          `PageHeader`, que además garantiza el subtítulo por tipo. */}
      <PageHeader
        title="Operaciones"
        subtitle="La administración del consultorio y los módulos de hospital, aparte del trabajo clínico del día. Cada cosa dice para qué sirve, y los grupos van de lo que se usa todos los días a lo que se configura una vez."
      />

      <EstadoDeOperaciones estado={estado} cargando={cargando} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {/**
          * RTC-29 — FILAS, NO AZULEJOS.
          *
          * La rejilla de azulejos de 200px era la silueta del lanzador: el
          * ancho del azulejo sólo daba para la etiqueta, así que la pantalla
          * NO PODÍA decir para qué servía nada. La forma imponía el contenido.
          *
          * Una fila a lo ancho sí cabe: nombre + para qué, en el mismo renglón
          * o en dos. Es la misma anatomía que ya usan las «Herramientas
          * clínicas» de la consulta y la barra del expediente — no se inventa
          * una forma nueva para esta pantalla, se le da la que el producto ya
          * tenía para exactamente este trabajo.
          *
          * El grupo entero comparte UN borde en vez de uno por azulejo: 19
          * cajas iguales eran 19 fronteras compitiendo por atención. Dentro,
          * las filas se separan con una línea, que es lo que hace una lista.
          */}
        {grupos.map(g => (
          <section key={g.titulo}>
            <CabeceraDeGrupo titulo={g.titulo} cadencia={g.cadencia} />
            <div style={CAJA_DE_GRUPO}>
              {g.items.map((it, i) => (
                <Link
                  key={it.href}
                  href={it.href}
                  style={{
                    ...FILA_DE_GRUPO,
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    textDecoration: 'none',
                  }}
                >
                  <it.icon size={17} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{it.label}</span>
                    <span className="nx-meta" style={{ display: 'block' }}>{it.para}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* RTC-15 → RTC-29 (§11): el respaldo del consultorio ATERRIZA aquí.
            Vivía en la cabecera primaria de /pacientes, junto a «Nuevo
            paciente»: bajar un archivo del consultorio entero no es trabajo
            clínico. La conducta viene entera desde
            `@/lib/clinica/descargar-respaldo` — no se reescribió en el
            destino, porque mover no puede significar perder. */}
        <RespaldoSection />

        {/* RTC-05 (§11): el tema es SISTEMA, no trabajo clínico. En móvil el
            toggle flotante murió (ocluía contenido clínico); su casa es ésta.
            En escritorio conviven: el flotante y esta fila son dos VISTAS del
            mismo estado (`useTema`), sincronizadas por evento. */}
        <TemaSection />

        {/* V15-MOBILE-001 (§22): en móvil de médico el cajón lateral se retiró
            (era el árbol de escritorio clonado) y con él su botón «Cerrar
            sesión». La salida vive aquí — Operaciones ES el área de sistema
            (§11) — con el MISMO salirSeguro que usan FlowRail y Sidebar (espera
            el acuse y purga IndexedDB; no una salida propia con otro criterio). */}
        <section>
          <CabeceraDeGrupo titulo="Sesión" cadencia="Al terminar el día" />
          <div style={CAJA_DE_GRUPO}>
            <button
              onClick={() => { void salirSeguro('/login') }}
              style={{ ...FILA_DE_GRUPO, cursor: 'pointer' }}
            >
              <LogOut size={17} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>Cerrar sesión</span>
                <span className="nx-meta" style={{ display: 'block' }}>
                  Cierra y limpia este dispositivo: nada del consultorio se queda guardado aquí
                </span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function RespaldoSection() {
  const { clinicId } = useClinic()
  const { toast } = useToast()
  const [generando, setGenerando] = useState(false)
  if (!clinicId) return null
  return (
    <section>
      <CabeceraDeGrupo titulo="Respaldo" cadencia="Cuando quieras llevártelo" />
      <div style={CAJA_DE_GRUPO}>
        <button
          onClick={async () => {
            if (generando) return
            setGenerando(true)
            const r = await descargarRespaldo(clinicId)
            toast(r.mensaje, r.ok ? 'success' : 'error')
            setGenerando(false)
          }}
          disabled={generando}
          style={{ ...FILA_DE_GRUPO, cursor: generando ? 'progress' : 'pointer' }}
        >
          {generando
            ? <Loader2 size={17} style={{ color: 'var(--text3)', flexShrink: 0, animation: 'spin 1s linear infinite' }} aria-hidden="true" />
            : <Download size={17} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />}
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>
              {generando ? 'Generando el respaldo…' : 'Descargar todo el consultorio'}
            </span>
            {/* Lo que hay que saber ANTES de guardarse el archivo y dormir
                tranquilo: el propio archivo declara lo que no se pudo leer. */}
            <span className="nx-meta" style={{ display: 'block' }}>
              Pacientes, notas, laboratorios, citas y configuración. La última línea del archivo dice si quedó completo.
            </span>
          </span>
        </button>
      </div>
    </section>
  )
}

function TemaSection() {
  const { modo, ciclar, montado, titulo } = useTema()
  if (!montado) return null
  const Icono = modo === 'dark' ? Moon : modo === 'light' ? Sun : Monitor
  const etiqueta = modo === 'dark' ? 'Tema: oscuro' : modo === 'light' ? 'Tema: claro' : 'Tema: automático'
  return (
    <section>
      <CabeceraDeGrupo titulo="Apariencia" cadencia="Se elige una vez" />
      <div style={CAJA_DE_GRUPO}>
        <button
          onClick={ciclar}
          title={titulo}
          aria-label={titulo}
          style={{ ...FILA_DE_GRUPO, cursor: 'pointer' }}
        >
          <Icono size={17} style={{ color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{etiqueta}</span>
            <span className="nx-meta" style={{ display: 'block' }}>
              Claro, oscuro o el del sistema
            </span>
          </span>
        </button>
      </div>
    </section>
  )
}
