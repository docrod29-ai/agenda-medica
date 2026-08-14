'use client'
/**
 * V15-RESULTS-CLOSURE-001 — la pista de las ocho etapas de §9 pintada sobre
 * una `TareaClinica` de tipo resultado. Ver `@/lib/tareas-clinicas/progreso-resultado`
 * para la razón de por qué tres de las ocho etapas nunca se pintan como
 * "hecha": no hay dato que lo respalde, y no se inventa.
 *
 * ── RTC-17 (14-ago-2026): TRES DEFECTOS QUE EL EQUIPO ROJO CONTÓ ────────────
 *
 * 1. **La etapa actual se distinguía SÓLO por color** (texto y tinte teal).
 *    En gris —una impresión, un monitor mal calibrado, un médico daltónico—
 *    la pista dejaba de decir dónde está el trabajo. §29 lo prohíbe por su
 *    nombre y ya lo cazó RTC-02 en otro sitio.
 * 2. **`sin_dato` se decía sólo en cursiva**, y su PORQUÉ vivía únicamente en
 *    el `title=` — un atributo que en una pantalla táctil no existe. La razón
 *    por la que una etapa no se puede saber es justo lo que hay que poder
 *    leer: es la diferencia entre «no ha pasado» y «no lo registramos».
 * 3. **A 390px las ocho píldoras caían en dos renglones** dentro de una fila
 *    de worklist, y ocho etiquetas de 10.5px no se leen: se miran.
 *
 * ── LO QUE SE HACE ──────────────────────────────────────────────────────────
 *
 * · Un **glifo** por estado, que es canal no cromático: `✓` hecha, `●` actual,
 *   `○` todavía no, `—` sin dato. El color acompaña; ya no informa solo.
 * · El motivo de `sin_dato` entra en el resumen accesible, no sólo en el
 *   `title`.
 * · En el teléfono, la pista se resume en una línea —«Etapa 3 de 8 · sigue:
 *   Dueño»— dentro de un `<details>` nativo que la despliega entera. Nativo
 *   porque trae teclado, foco y lectores de pantalla sin escribir nada.
 *
 * Las ocho etapas y su cálculo NO cambian: esto es cómo se dicen, no qué se
 * dice.
 */
import { progresoResultado, type EstadoEtapa, type EtapaResultado } from '@/lib/tareas-clinicas/progreso-resultado'
import type { EstadoTarea, Prioridad } from '@/lib/tareas-clinicas/modelo'

const COLOR: Record<EstadoEtapa, string> = {
  hecha: 'var(--text)',
  actual: 'var(--teal)',
  pendiente: 'var(--text3)',
  sin_dato: 'var(--text3)',
}

const FONDO: Record<EstadoEtapa, string> = {
  hecha: 'color-mix(in srgb, var(--text) 8%, transparent)',
  actual: 'color-mix(in srgb, var(--teal) 12%, transparent)',
  pendiente: 'transparent',
  sin_dato: 'transparent',
}

/**
 * EL CANAL QUE NO ES COLOR.
 *
 * Cuatro glifos, uno por estado. No son adorno: son lo que queda cuando el
 * color no llega — impresión en blanco y negro, tema de alto contraste, o un
 * médico que no distingue el teal del gris.
 */
const GLIFO: Record<EstadoEtapa, string> = {
  hecha: '✓',
  actual: '●',
  pendiente: '○',
  sin_dato: '—',
}

const ETIQUETA_ESTADO: Record<EstadoEtapa, string> = {
  hecha: 'hecha', actual: 'etapa actual', pendiente: 'todavía no', sin_dato: 'sin dato — no se registra',
}

function resumenAccesible(etapas: EtapaResultado[]): string {
  return `Progreso del resultado: ${etapas
    .map(e => {
      const base = `${e.etiqueta}: ${ETIQUETA_ESTADO[e.estado]}`
      /* El PORQUÉ de un «sin dato» vivía sólo en el `title`, que en táctil no
         existe. Aquí sí llega a quien lee la pantalla con voz. */
      return e.motivoSinDato ? `${base} (${e.motivoSinDato})` : base
    })
    .join('. ')}.`
}

/** «Etapa 3 de 8 · sigue: Dueño» — lo mismo, en una línea. */
export function resumenCompacto(etapas: EtapaResultado[]): string {
  const hechas = etapas.filter(e => e.estado === 'hecha').length
  const actual = etapas.find(e => e.estado === 'actual')
  const cola = actual
    ? ` · sigue: ${actual.etiqueta}`
    /* Sin etapa actual la tarea es terminal (cerrada o cancelada): no hay
       «siguiente paso» que prometer, y prometerlo sería inventarlo. */
    : ''
  return `Etapa ${hechas} de ${etapas.length}${cola}`
}

export function ProgresoResultado({ estado, ownerUid, prioridad }: {
  estado: EstadoTarea
  ownerUid?: string
  prioridad?: Prioridad
}) {
  const etapas = progresoResultado({ estado, ownerUid, prioridad })
  const pista = (
    <div
      className="nx-progreso-etapas"
      style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}
    >
      {etapas.map(e => (
        <span
          key={e.clave}
          title={e.motivoSinDato ?? `${e.etiqueta} — ${ETIQUETA_ESTADO[e.estado]}`}
          style={{
            fontSize: 10.5,
            lineHeight: 1.4,
            padding: '2px 8px',
            borderRadius: 'var(--r-pill)',
            border: `1px solid ${e.estado === 'pendiente' || e.estado === 'sin_dato' ? 'var(--border)' : COLOR[e.estado]}`,
            color: COLOR[e.estado],
            background: FONDO[e.estado],
            fontStyle: e.estado === 'sin_dato' ? 'italic' : 'normal',
          }}
        >
          {/* El glifo va primero y `aria-hidden`: el estado ya viaja en el
              resumen accesible del grupo, y repetirlo sería leerlo dos veces. */}
          <span aria-hidden="true" style={{ marginRight: 4 }}>{GLIFO[e.estado]}</span>
          {e.etiqueta}
        </span>
      ))}
    </div>
  )

  return (
    <div className="nx-progreso-resultado" role="group" aria-label={resumenAccesible(etapas)}>
      {/* ESCRITORIO: la pista entera, que cabe. */}
      <div className="nx-progreso-ancho">{pista}</div>

      {/* TELÉFONO: una línea que se despliega. `<details>` nativo — trae
          teclado, foco y lectores sin escribir una línea de JS. */}
      <details className="nx-progreso-estrecho">
        <summary style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer', minHeight: 24 }}>
          {resumenCompacto(etapas)}
        </summary>
        {pista}
      </details>
    </div>
  )
}
