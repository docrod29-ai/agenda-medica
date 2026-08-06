'use client'
/**
 * LA FRANJA QUE LE DICE AL DUEÑO QUE SU IA ESTÁ CAÍDA — donde sea que esté.
 *
 * ── EL HUECO, VIVIDO EL 4-AGO-2026 ───────────────────────────────────────────
 *
 * Al Dr. le salió «El servicio de IA no está disponible» **a media consulta**.
 * El sistema sí sabía qué había pasado: `reportarFalloIA` ya clasifica el fallo,
 * lo agrupa por hora y lo guarda, y `/superadmin/costos` lo enseña con el título
 * y qué hacer.
 *
 * Pero él estaba en la consulta. Para enterarse tenía que **saber que existe esa
 * pantalla y acordarse de abrirla justo ese día**. El propio código lo había
 * escrito una versión antes, hablando de otra cosa: «una alerta que vive en su
 * propia pantalla es una alerta que nadie ve».
 *
 * ── QUÉ HACE ─────────────────────────────────────────────────────────────────
 *
 * Si hay una incidencia **que exige que él haga algo** —la llave rechazada, la
 * cuenta sin saldo—, la enseña arriba con el titular y la acción.
 *
 * ── Y LO QUE APRENDIÓ A NO HACER, EL MISMO DÍA ───────────────────────────────
 *
 * La primera versión enseñaba todo lo de las últimas horas. El Dr. la vio en su
 * pantalla: **tres líneas del mismo aviso** —«Claude tardó demasiado»— ocupando
 * el ancho completo por encima de su lista de pacientes, por algo que se
 * resuelve solo y donde él no puede hacer nada.
 *
 * Un timeout o una saturación del proveedor son información de tablero. La
 * franja es para lo que está caído hasta que él entre a arreglarlo.
 *
 * Es la misma fatiga de alerta que se reparó esa mañana en la compuerta de
 * dosis, reintroducida aquí. Un aviso que salta donde no debe se acaba
 * ignorando — y con él, los que sí importan.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * **No le sale a ningún cliente.** Sólo al dueño: un consultorio no puede
 * arreglar la llave de la plataforma y decírselo nada más le roba tiempo con un
 * paciente enfrente — la misma razón por la que el mensaje del médico y el del
 * dueño son distintos desde que se escribieron.
 *
 * **No se consulta sola cada rato.** Una vez al montar. Preguntar en bucle sería
 * pagar por vigilar una pantalla que casi siempre está en verde.
 *
 * **No estorba.** Si la consulta falla, no se pinta nada: un aviso que se rompe
 * no puede convertirse en un problema encima del que ya hay.
 */
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { fetchAutenticado } from '@/lib/auth-client'

import { visiblesEn, type IncidenteVisible } from '@/lib/ops/interrumpe-la-consulta'

type Incidente = IncidenteVisible

export function AvisoIncidenteIA({ esDueno }: { esDueno: boolean }) {
  const [todos, setTodos] = useState<Incidente[]>([])
  const [oculto, setOculto] = useState(false)
  const ruta = usePathname()

  /**
   * ── CON UN PACIENTE ENFRENTE, SÓLO LO QUE IMPIDE ATENDERLO (5-ago-2026) ────
   *
   * El 5-ago le salió «5 trabajos automáticos dejaron de correr» en rojo debajo
   * de la nota de una consulta real. Cierto, suyo, y **nada de eso se arregla
   * desde ahí**. El filtro de esta franja preguntaba «¿es urgente?», y un cron
   * muerto lo es; la pregunta con alguien delante es otra.
   */
  const incidentes = visiblesEn(todos, ruta)

  useEffect(() => {
    if (!esDueno) return
    let vivo = true
    fetchAutenticado('/api/superadmin/incidentes')
      .then(r => r.json())
      .then(d => { if (vivo && d?.ok) setTodos(d.incidentes ?? []) })
      .catch(() => { /* un aviso que se rompe no puede estorbar */ })
    return () => { vivo = false }
  }, [esDueno])

  if (!esDueno || oculto || incidentes.length === 0) return null

  const urgente = incidentes.some(i => i.urgente)
  const color = urgente ? 'var(--red)' : 'var(--amber)'

  return (
    <div
      role="status"
      style={{
        margin: '8px 14px 4px', padding: '8px 12px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.45,
        color, background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}
    >
      <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Dos como mucho: si hay más, el problema es el tablero, no la franja. */}
        {incidentes.slice(0, 2).map((i, n) => (
          <div key={n} style={{ marginBottom: n < Math.min(incidentes.length, 2) - 1 ? 6 : 0 }}>
            <strong>{i.titulo}</strong>
            {typeof i.veces === 'number' && i.veces > 1 && (
              <span style={{ opacity: 0.85 }}> · {i.veces} veces</span>
            )}
            <div style={{ opacity: 0.92 }}>{i.queHacer}</div>
          </div>
        ))}
        <div style={{ marginTop: 6, display: 'flex', gap: 14 }}>
          <Link href="/superadmin/costos" style={{ color, textDecoration: 'underline' }}>
            Ver el tablero
          </Link>
          <button
            onClick={() => setOculto(true)}
            style={{ background: 'none', border: 'none', color, cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}
          >
            Ocultar hasta recargar
          </button>
        </div>
      </div>
    </div>
  )
}

export const POR_QUE_SOLO_AL_DUENO =
  'Un consultorio no puede arreglar la llave de la plataforma: decírselo sólo le ' +
  'roba tiempo con un paciente enfrente. Es la misma razón por la que el mensaje ' +
  'del médico y el del dueño se escribieron distintos desde el principio.'

export const POR_QUE_NO_BASTA_EL_TABLERO =
  'La incidencia ya se guardaba y ya se enseñaba — en /superadmin/costos. Para ' +
  'enterarse había que saber que esa pantalla existe y acordarse de abrirla justo ' +
  'ese día, estando en consulta. Una alerta que vive en su propia pantalla es una ' +
  'alerta que nadie ve.'
