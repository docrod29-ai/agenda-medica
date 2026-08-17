'use client'
/**
 * LA FRANJA DE ESTADO DE `/operaciones` — lo que pide atención, arriba de todo.
 *
 * El motor vive en `@/lib/operaciones/estado-de-operaciones` y es puro; esto
 * sólo lee y pinta. La separación no es ceremonia: los seis estados se prueban
 * ahí sin navegador, y aquí sólo queda el cableado, que es lo que un guardián
 * de DOM puede vigilar.
 *
 * ── POR QUÉ SE PARECE A `/pendientes` Y NO A UN TABLERO ────────────────────
 *
 * `/pendientes` es la única superficie que la re-auditoría independiente dejó
 * en 1.0, y el diagnóstico de §29 explicó por qué: **cada entrada lleva encima
 * su siguiente acción**, y la cabecera no es un título con botones sino una
 * frase que dice de dónde salen las entradas. Aquí se hace lo mismo con lo
 * operativo: una línea por comprobación, con su cuenta, su detalle, quién
 * responde y a dónde se va a actuar.
 *
 * Lo que NO se hace, y es la mitad del trabajo:
 *
 *  · **Ningún indicador.** No hay «citas del mes», ni gráfica, ni porcentaje.
 *    Un número que no pide una decisión es decoración con aspecto de dato.
 *  · **Ninguna acción destructiva aquí.** Se va a `/citas`, `/lista-espera` o
 *    `/farmacia`, que son las pantallas con autoridad. Confirmar una cita desde
 *    un resumen, sin su detalle en pantalla, es la misma trampa que §29 rechazó
 *    para `/pacientes`.
 *  · **Ninguna urgencia falsa.** El rojo es sólo para lo que no se pudo leer,
 *    porque eso es lo único de esta franja que puede estar escondiendo algo.
 *    Lo que pide atención va en ámbar; lo sano, en gris y en una sola línea.
 *
 * ── Y CUANDO NO HAY NADA ───────────────────────────────────────────────────
 *
 * Se dice que no hay nada, y se dice QUÉ se miró para poder decirlo. Un «todo
 * en orden» sin la lista de lo comprobado es una promesa sin respaldo: el día
 * que una lectura se rompa en silencio, la pantalla seguirá diciendo lo mismo.
 */
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, EyeOff, ChevronRight } from 'lucide-react'
import type { EstadoDeOperaciones as Estado, Comprobacion } from '@/lib/operaciones/estado-de-operaciones'

const COLOR: Record<string, string> = {
  excepcion: 'var(--amber)',
  'no-se-pudo-leer': 'var(--red)',
}

function Fila({ c }: { c: Comprobacion }) {
  const color = COLOR[c.estado] ?? 'var(--text3)'
  return (
    <div
      data-comprobacion={c.id}
      data-estado={c.estado}
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start',
        padding: '13px 0', borderTop: '1px solid var(--border)',
      }}>
      <span aria-hidden style={{ color, marginTop: 2, flexShrink: 0, display: 'inline-flex' }}>
        {c.estado === 'no-se-pudo-leer' ? <EyeOff size={16} /> : <AlertTriangle size={16} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-body" style={{ fontWeight: 700 }}>
          {c.cuantos > 0 && <span style={{ color }}>{c.cuantos} · </span>}{c.titulo}
        </div>
        <p className="t-caption" style={{ lineHeight: 1.5, margin: '3px 0 0' }}>{c.detalle}</p>
        <p className="t-caption" style={{ color: 'var(--text3)', margin: '4px 0 0' }}>
          Responde: {c.quien}
        </p>
      </div>
      <Link
        href={c.destino}
        data-destino={c.id}
        className="t-body"
        style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
          minHeight: 44, padding: '0 4px',
          fontWeight: 600, color: 'var(--nexus)',
        }}>
        {c.destinoLabel} <ChevronRight size={14} aria-hidden />
      </Link>
    </div>
  )
}

export function EstadoDeOperaciones({ estado, cargando }: { estado: Estado | null; cargando: boolean }) {
  if (cargando) {
    return (
      <p data-estado-operaciones="cargando" className="t-caption" style={{ color: 'var(--text3)', margin: '0 0 18px' }}>
        Comprobando el estado del consultorio…
      </p>
    )
  }
  if (!estado) return null

  const piden = [...estado.excepciones, ...estado.ciegas]
  const limpias = estado.sanas
  const fuera = estado.noAplican

  return (
    <section
      data-estado-operaciones={piden.length ? 'con-excepcion' : 'sin-excepcion'}
      aria-labelledby="ops-estado-titulo"
      style={{ margin: '0 0 26px' }}>
      <h2
        id="ops-estado-titulo"
        className="t-h2"
        style={{ margin: '0 0 2px' }}>
        {piden.length
          ? `Pide atención (${piden.length})`
          : 'Nada del consultorio pide atención ahora'}
      </h2>
      <p className="t-caption" style={{ color: 'var(--text3)', margin: '0 0 6px', lineHeight: 1.5 }}>
        {piden.length
          ? 'Sale de las citas, la lista de espera y las existencias que ya guarda este consultorio. Se actúa en la pantalla que manda, no aquí.'
          : 'Se comprobaron las citas, la lista de espera y las existencias. Nada de eso está esperando una decisión.'}
      </p>

      {piden.map(c => <Fila key={c.id} c={c} />)}

      {(limpias.length > 0 || fuera.length > 0) && (
        <p
          data-comprobado-limpio
          className="t-caption"
          style={{
            display: 'flex', gap: 7, alignItems: 'baseline',
            color: 'var(--text3)', lineHeight: 1.6,
            margin: 0, paddingTop: piden.length ? 13 : 0,
            borderTop: piden.length ? '1px solid var(--border)' : 'none',
          }}>
          <CheckCircle2 size={13} aria-hidden style={{ flexShrink: 0, position: 'relative', top: 2 }} />
          <span>
            {limpias.length > 0 && <>Sin novedad: {limpias.map(c => c.titulo.toLowerCase()).join(' · ')}. </>}
            {fuera.map(c => c.detalle).join(' ')}
          </span>
        </p>
      )}
    </section>
  )
}
