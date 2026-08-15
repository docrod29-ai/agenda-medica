'use client'
/**
 * LAS CUATRO PREGUNTAS DE §10, EN UNA SOLA PIEZA — para que las dos pantallas
 * que leen el MISMO pendiente no puedan contestarlas distinto.
 *
 * ── EL DEFECTO QUE PAGA, Y CÓMO SE MIDIÓ ────────────────────────────────────
 *
 * `tareasVivas()` es UNA fuente de verdad con DOS lectores: la cola de cierre
 * (`/pendientes`) y la zona CONTINUITY de Hoy (`ContinuidadPanel`, §6 —
 * «lo que cruzó de una consulta anterior y sigue sin cerrarse»).
 *
 * Medido en navegador real antes de tocar nada
 * (`scripts/design/medir-porque-en-hoy-v15.mjs`, acta
 * `docs/design/capturas/v15-porque-en-hoy/acta-antes.json`):
 *
 *   · Hoy pinta 5 filas de continuidad y **0 pueden preguntar nada**.
 *   · Las 5 son un `<a>` ENTERO: la fila no admitía un control dentro sin
 *     caer en `nested-interactive` — o sea que la mudez era estructural, no
 *     un botón que se olvidó.
 *   · Para llegar a las cuatro respuestas desde Hoy había que IRSE a
 *     `/pendientes`. En el teléfono eso costaba **171px de desplazamiento**
 *     que no vuelven: al regresar, Hoy arranca arriba.
 *
 * Y Hoy es donde el médico ve el pendiente **por primera vez**, a las nueve de
 * la mañana. §21 pide «fact → inspect → source → return exactly where you
 * were». Desde Hoy no había «inspect»: había navegar, que es exactamente la
 * pérdida de contexto que §21 existe para evitar.
 *
 * ── POR QUÉ UNA PIEZA Y NO COPIAR EL JSX ────────────────────────────────────
 *
 * Es la lección de REG-318, y es reciente: el sello de procedencia tenía TRES
 * listas independientes de «qué es una nota para el sello», sólo una completa,
 * y el resultado fueron dos sellos que contaban distinto sobre el mismo
 * documento. Copiar aquí el bloque de la lente habría montado la misma trampa
 * sobre la misma entidad: dos pantallas contestando «¿qué ha pasado?» con dos
 * plantillas que empiezan idénticas y divergen a la tercera edición.
 *
 * Las respuestas ya vivían en un módulo puro (`por-que-esta-aqui.ts`). Lo que
 * faltaba era que su PRESENTACIÓN —el disparador, la lente, los cuatro
 * bloques, la traza y la rama honesta de «no consta»— viviera también en un
 * solo sitio. Eso es esta pieza.
 *
 * ── LO QUE NO DECIDE ────────────────────────────────────────────────────────
 *
 * · No lee datos: recibe la `TareaClinica` que el consumidor ya tiene.
 * · No decide DÓNDE va el disparador dentro de la fila o la tarjeta: eso es
 *   composición de cada superficie.
 * · No cambia nada clínico. §1 congela la lógica; esto es exactamente lo que
 *   §1 permite: «component extraction», «presentation-layer adapters».
 */
import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui'
import { Lente } from '@/components/LenteContextual'
import { responderPorElPendiente } from '@/lib/tareas-clinicas/por-que-esta-aqui'
import type { TareaClinica } from '@/lib/tareas-clinicas/modelo'
import { AlertTriangle, FileText, HelpCircle } from 'lucide-react'

/**
 * Con día Y HORA, y la razón importa al mudarla aquí: en la línea de tiempo de
 * un pendiente el día solo no basta para saber si el resultado se marcó antes o
 * después de la consulta. Se conserva tal cual venía de `/pendientes` — una
 * extracción que «redondea» un formato al mudarlo es un cambio de conducta
 * disfrazado de refactor.
 */
function fechaLarga(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isFinite(d.getTime())
    ? d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''
}

/**
 * EL ESTADO DE LA LENTE, UNA VEZ.
 *
 * Las dos superficies necesitan lo mismo: qué pendiente está abierto, a qué
 * control vuelve el foco al cerrar (§21) y una a la vez. Repetir ese trío en
 * cada pantalla es repetir también sus fallos — la corrida anterior ya cazó
 * uno: un `useState` dentro de una tarjeta declarada en el render se perdía en
 * cada `setState` de la página y la lente se cerraba sola.
 *
 * **El estado vive en la PÁGINA, no en la fila.** Este hook se llama arriba y
 * el id viaja hacia abajo; ninguna fila guarda si está abierta.
 */
export function usePorQue() {
  const [porQueId, setPorQueId] = useState<string | null>(null)
  /** El control que abrió la lente, para que el foco vuelva ahí al cerrarla. */
  const disparador = useRef<HTMLElement | null>(null)

  const alternar = useCallback((t: TareaClinica, control: HTMLElement) => {
    disparador.current = control
    setPorQueId(id => (id === t.id ? null : t.id ?? null))
  }, [])

  const cerrar = useCallback(() => setPorQueId(null), [])

  return { porQueId, disparador, alternar, cerrar }
}

/**
 * EL DISPARADOR. Un `<button>` de verdad (§24) que declara que abre algo.
 *
 * `aria-expanded` recibe el estado REAL de la lente, no un `false` constante:
 * el control tiene que decir si lo que abre está abierto, y ése fue uno de los
 * tres síntomas que el navegador cazó la vez anterior.
 */
export function DisparadorPorQue({ tarea, abierta, onAbrir }: {
  tarea: TareaClinica
  abierta: boolean
  onAbrir: (t: TareaClinica, control: HTMLElement) => void
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-expanded={abierta}
      onClick={e => onAbrir(tarea, e.currentTarget as HTMLElement)}
    >
      <HelpCircle size={14} /> ¿Por qué está aquí?
    </Button>
  )
}

/**
 * Cada una de las cuatro respuestas dentro de la lente.
 *
 * El rótulo es un `<h3>` DE VERDAD, no un span en versalitas: la lente ya se
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

/**
 * LA LENTE CON LAS CUATRO RESPUESTAS.
 *
 * `tarea` puede ser `null`: si el pendiente abierto desapareció de la lista
 * debajo (se cerró, o `mover()` recargó), la lente se queda sin sujeto y no se
 * abre — que es mejor que enseñar la ficha de algo que ya no está donde dice.
 * Por eso el consumidor BUSCA la tarea por id en cada render en vez de
 * guardársela: lo que se lee es el pendiente de ahora, no una copia.
 */
export function LentePorQue({ tarea, uid, invocador, alCerrar }: {
  tarea: TareaClinica | null
  uid: string
  invocador: React.RefObject<HTMLElement | null>
  alCerrar: () => void
}) {
  if (!tarea) return null
  const r = responderPorElPendiente(tarea, uid)

  return (
    <Lente
      abierta
      titulo={tarea.titulo}
      subtitulo={tarea.patientNombre}
      invocador={invocador}
      alCerrar={alCerrar}
    >
      <div className="nx-porque">
        <Bloque titulo="Por qué está aquí">
          <p className="nx-porque-texto">{r.porQue}</p>
          {/*
            LA TRAZA HACIA ATRÁS. `notaId` se escribe desde que existe
            `derivar.ts` y durante versiones sólo lo leyó el compositor de ids
            de Firestore. Aterriza en la consulta con la nota abierta: ahí está
            el sello de procedencia, y con él el segundo exacto del dictado. La
            cadena de §21 sin saltos.
          */}
          {r.traza && (
            <Link href={r.traza.href} className="nx-porque-traza">
              <FileText size={14} /> Ver la consulta de la que salió
            </Link>
          )}
          {/* Ausencia de dato no es dato de ausencia: se dice que no consta la
              traza, no que la tarea nació de la nada. */}
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
                    estudio hecho, el resultado en el sistema, y nadie que lo
                    haya leído. Va en rojo y con su nombre porque leer «el
                    trabajo se hizo» y entender «listo» es el error.
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
}
