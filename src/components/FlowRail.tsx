'use client'
/**
 * FLOW RAIL — V15-SHELL-GREYBOX-001.
 *
 * ── QUÉ REEMPLAZA ────────────────────────────────────────────────────────────
 *
 * El `Sidebar` de médico tenía 21 destinos + 2 de «Sistema» = 23 (medido en
 * `docs/design/capturas/v15-baseline-before/BASELINE.md`). V15 §14 lo llama
 * «feature-menu warehouse» y exige ≤5. Este componente es ESO: los cinco
 * contextos que el routine V15 fija en su prioridad 4 —
 * TODAY · PATIENT · ENCOUNTER · WORK/FOLLOW-UP · SEARCH/COMMAND — y nada más
 * como navegación primaria.
 *
 * Los 18 destinos restantes no desaparecen: viven en `/operaciones`
 * (§11 «Operations es separada del trabajo clínico»), enlazada aquí de forma
 * subordinada, no como un sexto ítem del mismo peso.
 *
 * ── POR QUÉ SÓLO MÉDICO ──────────────────────────────────────────────────────
 *
 * El routine dice «Primary PHYSICIAN navigation must be ≤5 contexts» — no
 * toca el rol de asistente. La asistente sigue con `Sidebar` sin cambio: no es
 * reskin, es que su IA de navegación no es el sujeto de esta fase. Se reevalúa
 * cuando V15 llegue a esa superficie (ver plan de compatibilidad en
 * `docs/design/v15/IA-001-sitemap.md`).
 *
 * ── GREYBOX PRIMERO, ACENTO DESPUÉS (§12 → §18) ──────────────────────────────
 *
 * §12 exige revisar la nueva IA/jerarquía SIN color de marca antes de aplicar
 * estilo. Este componente nació greybox (sólo `--s1/--s2/--s3/--text/--text2/
 * --text3/--border`, estado activo con `var(--text)`) y ASÍ pasó la compuerta
 * el 11-ago-2026 (capturas en `docs/design/capturas/v15-shell-greybox/`).
 * V15-VISUAL-SYSTEM-001 (Fase 10) tomó después la decisión que quedaba: el
 * estado activo volvió a las reglas base de `.nav-item.active` (barra + icono
 * en `var(--nexus)`) quitando el override greybox de `globals.css` — cobalto
 * = acción/selección/AHORA (VISUAL_DNA §3), el mismo idioma que `BottomNav`
 * ya hablaba en móvil. La jerarquía que aprobó el gate no se tocó: misma
 * barra, mismo peso, sólo el color del acento.
 *
 * ── ENCOUNTER: de «apunta a /pacientes» a estado real (RTC-08) ───────────────
 *
 * Aquí decía que no existía todavía un concepto de «encuentro activo» fuera de
 * una ruta /consulta/[id] concreta, y que mientras tanto ENCOUNTER se resolvía
 * como la vieja entrada «Consulta» del Sidebar: a /pacientes. Era cierto y era
 * defendible — hasta que el equipo rojo lo usó por primera vez (RTC-08): pides
 * «Encuentro», apareces en la lista de pacientes, y el riel ilumina
 * «Paciente». El destino no mentía solo: encima marcaba el otro sitio como si
 * fuera el que habías pedido. Eso rompe la pregunta de §15 justo cuando el
 * médico está decidiendo si puede fiarse de la barra.
 *
 * Hoy el estado existe sin inventar nada: el producto ya guarda un respaldo
 * local por consulta en curso, y eso ES un encuentro abierto
 * (`@/lib/nav/encuentro-abierto`). Con uno abierto, ENCOUNTER lo RETOMA y lo
 * señala; sin ninguno sigue llevando a /pacientes —así se empieza uno— pero lo
 * DICE en su nombre accesible. La regla: o hay un lugar, o se dice que no lo
 * hay. Teletransportar en silencio no es una tercera opción.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarClock, UserSquare2, Stethoscope, ListChecks, Search, Settings2, LogOut, HelpCircle,
} from 'lucide-react'
import { useConfig } from '@/hooks/useConfig'
import { useAuth } from '@/hooks/useAuth'
import { MarcaAusculta } from '@/components/MarcaAusculta'
import { DisparadorAyuda } from '@/components/BotonAyuda'
import { salirSeguro } from '@/lib/salir-seguro'
import { useGrabando } from '@/hooks/useGrabando'
import { useEncuentroAbierto } from '@/hooks/useEncuentroAbierto'
import { rutaDelEncuentro } from '@/lib/nav/encuentro-abierto'

/**
 * V15-ENCOUNTER-MODE-001, §8.1 «navigation visually quiets»: medido en la
 * corrida de baseline de esta fase, el marco perimetral de `MarcoEscuchando`
 * se encendía durante la grabación pero este riel seguía con su peso visual
 * íntegro al lado — la navegación no reaccionaba en absoluto. Se suscribe al
 * MISMO `EVENTO_GRABANDO` que ya escuchan `MarcoEscuchando` e
 * `InstrumentStrip` (no es una fuente de verdad nueva).
 *
 * ── POR QUÉ NO ES UN `opacity` PLANO SOBRE EL TEXTO ─────────────────────────
 *
 * El primer intento atenuaba con `opacity` TODO lo no esencial, texto de
 * etiqueta incluido. `node scripts/design/probar-opacidad-quieta-v15.mjs`
 * (axe real contra el riel real) lo cazó: `--text3` sobre `--s1` en modo oscuro
 * ya mide ~5.6:1 — apenas por encima del mínimo AA de 4.5:1 — así que
 * CUALQUIER opacidad perceptible sobre esa combinación cae por debajo del
 * umbral. Bajar la opacidad hasta un valor que pasara AA (~0.95) dejaba el
 * atenuado invisible a simple vista: ni cumplía §8.1 ni pasaba la compuerta
 * de accesibilidad — las dos cosas a la vez, no una a costa de la otra.
 *
 * La forma que sí funciona separa qué se atenúa de qué desaparece:
 *
 *   - `.nx-flow-rail-quiet-icon` — SVG decorativos (ícono de marca, lupa,
 *     cerrar sesión, y los `.nav-icon` de los ítems NO activos). El texto
 *     alternativo vive en la etiqueta de al lado, no en el ícono, así que
 *     WCAG 1.4.11 (contraste no-textual, 3:1) aplica en vez de 1.4.3 (4.5:1)
 *     — hay margen real para atenuar sin violar nada. Verificado con el
 *     mismo arnés: 0 violaciones en 0.3–0.5 de opacidad.
 *   - `.nx-flow-rail-quiet-hide` — texto puramente secundario y NO
 *     interactivo (nombre del médico bajo el de la clínica, el correo bajo
 *     "Cerrar sesión", el atajo "⌘K", el rótulo "Operaciones"): se OCULTA
 *     de verdad (`display:none`) mientras se graba, no se atenúa. Es seguro
 *     porque ninguno es un control enfocable — no hay tabulación que
 *     "pierda" un elemento que nunca recibía el foco. Es además la lectura
 *     correcta de §8.5 («nonessential admin disappears»): esta información
 *     no es indispensable durante el encuentro.
 *   - Las ETIQUETAS de los ítems de navegación (Hoy, Paciente, Encuentro,
 *     Seguimiento, Operaciones) y el nombre del consultorio NO se tocan:
 *     siguen con su color y opacidad de siempre. Bajarles el contraste
 *     sería vulnerar exactamente lo que §24 del master loop llama defecto
 *     bloqueante en una acción clínica — no hay "modo distinto" que valga
 *     ese precio.
 *
 * La suscripción a `EVENTO_GRABANDO` vive desde RTC-04 en la compuerta
 * compartida `@/hooks/useGrabando` — este archivo tenía una de las DOS copias
 * privadas idénticas del hook (la otra en BottomNav) que dejaron a la pila de
 * avisos del layout sin cubrir.
 */
const ES_CONTEXTO_PACIENTE = (p: string) =>
  p.startsWith('/pacientes') || p.startsWith('/expedientes') || p.startsWith('/expediente/')

const ES_CONTEXTO_ENCUENTRO = (p: string) =>
  p.startsWith('/consulta/') || p.startsWith('/nota/') || p.startsWith('/receta/') ||
  p.startsWith('/orden/') || p.startsWith('/referencia/')

export function FlowRail({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? ''
  const { config } = useConfig()
  const { user } = useAuth()
  const grabando = useGrabando()

  /**
   * RTC-08 — ENCUENTRO deja de teletransportar en silencio.
   *
   * Tres estados, y el riel dice cuál es en vez de fingir que siempre es el
   * mismo (§15: «¿dónde estoy y a dónde puedo ir?»):
   *
   *   1. Estás DENTRO de un encuentro → el destino es donde ya estás, y se
   *      ilumina (comportamiento de siempre).
   *   2. Hay uno ABIERTO en otra parte → el destino lo RETOMA. Antes esto no
   *      existía: la consulta a medio escribir se quedaba esperando a que el
   *      médico recordara de qué paciente era.
   *   3. No hay ninguno → sigue llevando a /pacientes, porque elegir paciente
   *      es como se empieza uno, pero el nombre accesible lo DICE. El defecto
   *      no era el destino: era la promesa. Un ítem que dice «Encuentro», te
   *      deja en la lista de pacientes y encima ilumina «Paciente» rompe la
   *      pregunta de §15 en el primer uso.
   */
  const enEncuentro = ES_CONTEXTO_ENCUENTRO(pathname)
  const abierto = useEncuentroAbierto()
  const encounterHref = enEncuentro
    ? pathname
    : abierto ? rutaDelEncuentro(abierto) : '/pacientes'
  const encounterTitulo = enEncuentro
    ? 'Encuentro — estás en él'
    : abierto ? 'Encuentro — retomar la consulta abierta' : 'Encuentro — ninguno abierto; elige un paciente para empezar'

  const abrirBusqueda = () => {
    onNavigate?.()
    window.dispatchEvent(new Event('nexus:open-palette'))
  }
  const handleLogout = async () => { await salirSeguro('/login') }

  return (
    <aside
      className={`sidebar nx-flow-rail${grabando ? ' nx-flow-rail--quieto' : ''}`}
      aria-label="Navegación clínica principal"
    >
      {/* Identidad — mínima, sin acento de marca */}
      <div className="sidebar-logo">
        <div className="nx-flow-rail-quiet-icon" style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--s2)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MarcaAusculta size={20} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {config.nombreClinica || 'Ausculta'}
          </div>
          <div className="nx-flow-rail-quiet-hide" style={{ fontSize: 12, color: 'var(--text3)' }}>
            {config.nombreMedico
              ? (/^Dr\.?\s+|^Dra\.?\s+/i.test(config.nombreMedico) ? config.nombreMedico : `Dr. ${config.nombreMedico}`)
              : 'Consultorio'}
          </div>
        </div>
      </div>

      {/* SEARCH / COMMAND — quinto contexto, es acción, no ruta */}
      <button
        onClick={abrirBusqueda}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '8px 12px', margin: '4px 0 10px', cursor: 'pointer', color: 'var(--text3)',
        }}
      >
        <Search size={15} className="nx-flow-rail-quiet-icon" />
        <span style={{ fontSize: 12, flex: 1, textAlign: 'left' }}>Buscar…</span>
        <span className="nx-flow-rail-quiet-hide" style={{ fontSize: 10.5, border: '1px solid var(--border)', borderRadius: 6, padding: '1px 5px' }}>⌘K</span>
      </button>

      {/* Los cuatro contextos que SÍ son ruta */}
      <nav className="sidebar-nav" aria-label="Contextos clínicos">
        <RailLink href="/dashboard" label="Hoy" icon={CalendarClock}
          activo={pathname === '/dashboard'} onNavigate={onNavigate} />
        <RailLink href="/pacientes" label="Paciente" icon={UserSquare2}
          activo={ES_CONTEXTO_PACIENTE(pathname)} onNavigate={onNavigate} />
        <RailLink href={encounterHref} label="Encuentro" icon={Stethoscope}
          activo={enEncuentro} onNavigate={onNavigate}
          titulo={encounterTitulo}
          /* La señal de «hay uno abierto» sólo se pinta cuando NO estás dentro:
             estando dentro, el estado activo ya lo dice y un punto más sería
             ruido sobre la superficie clínica (§8.5). */
          senal={!enEncuentro && !!abierto} />
        <RailLink href="/pendientes" label="Seguimiento" icon={ListChecks}
          activo={pathname.startsWith('/pendientes')} onNavigate={onNavigate} />

        <div className="nav-section-title nx-flow-rail-quiet-hide" style={{ marginTop: 14 }}>Operaciones</div>
        <RailLink href="/operaciones" label="Operaciones" icon={Settings2}
          activo={pathname.startsWith('/operaciones') || pathname.startsWith('/configuracion') || pathname.startsWith('/guia')}
          onNavigate={onNavigate} subordinado />
      </nav>

      <div style={{ padding: '12px 8px 16px', borderTop: '1px solid var(--border)' }}>
        {/* RTC-32 — la ayuda ya no flota sobre la columna clínica: vive aquí,
            en el pie subordinado, que es su familia (sistema, no destino
            clínico — §15). No suma un destino al riel: es un botón que abre un
            panel, y por eso está FUERA del <nav> que cuenta los ≤5 contextos.
            La compuerta de grabación viene dentro de `DisparadorAyuda`. */}
        <DisparadorAyuda className="nav-item" style={{ color: 'var(--text3)', width: '100%' }}>
          <HelpCircle size={16} className="nx-flow-rail-quiet-icon" />
          Ayuda
        </DisparadorAyuda>
        <button onClick={handleLogout} className="nav-item" style={{ color: 'var(--text3)', width: '100%' }}>
          <LogOut size={16} className="nx-flow-rail-quiet-icon" />
          Cerrar sesión
        </button>
        {user?.email && (
          <div className="nx-flow-rail-quiet-hide" style={{ fontSize: 10.5, color: 'var(--text3)', padding: '6px 8px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
        )}
      </div>
    </aside>
  )
}

function RailLink({ href, label, icon: Icon, activo, onNavigate, subordinado, titulo, senal }: {
  href: string; label: string; icon: typeof CalendarClock; activo: boolean
  onNavigate?: () => void; subordinado?: boolean
  /**
   * RTC-08: lo que el ítem promete de verdad, cuando el rótulo por sí solo no
   * alcanza. Va a `title` Y a `aria-label`: el ratón y el lector de pantalla
   * merecen la misma frase — un `title` suelto no lo oye nadie.
   */
  titulo?: string
  /** Punto de estado real (hay un encuentro abierto que retomar). */
  senal?: boolean
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`nav-item${activo ? ' active' : ''}`}
      aria-current={activo ? 'page' : undefined}
      title={titulo}
      aria-label={titulo}
      style={subordinado ? { color: 'var(--text3)', fontSize: 12 } : undefined}
    >
      <Icon size={17} className="nav-icon" />
      <span style={{ flex: 1 }}>{label}</span>
      {senal && (
        /* Punto SÓLIDO (no halo: el trinquete de genericidad cuenta los halos
           de color, y con razón) y con su color en la HOJA, no aquí: el
           guardián de Fase 10 exige que el riel no pinte acento propio — el
           acento vive en las reglas base compartidas. Es estado, no adorno, y
           su significado viaja en el nombre accesible del enlace, nunca en el
           color a solas (§24). */
        <span aria-hidden="true" className="nx-rail-senal" />
      )}
    </Link>
  )
}
