'use client'
/**
 * LO QUE QUEDÓ PENDIENTE DE ESTE PACIENTE — REG-266.
 *
 * ── EL HUECO ────────────────────────────────────────────────────────────────
 *
 * `tareasDePaciente()` decía en su comentario «para su expediente», y el
 * expediente no las enseñaba: la función no tenía llamador.
 *
 * ── DÓNDE VA Y POR QUÉ ARRIBA ───────────────────────────────────────────────
 *
 * Encima del resumen, no debajo. Un cabo suelto es lo único de esta pantalla
 * que exige una decisión HOY; el resto es historia y espera.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No cierra tareas. Cerrar es «alguien lo miró y decidió», y esa decisión pasa
 * por `/pendientes`, que ya valida las transiciones del ciclo. Poner aquí un
 * botón de cerrar duplicaría esa validación en una segunda pantalla — y una
 * regla clínica escrita dos veces se desalinea en la primera prisa.
 *
 * Tampoco enseña nada cuando no hay nada: una tarjeta que dice «0 pendientes»
 * ocupa el mismo sitio que una que dice algo, y enseñar ceros entrena a no
 * mirar. Es el mismo motivo por el que un aviso que grita de más se ignora.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, ChevronRight, ClipboardList } from 'lucide-react'
import { NoSePudoLeer } from '@/components/ui/NoSePudoLeer'
import type { TareaClinica } from '@/lib/tareas-clinicas/modelo'
import {
  cabosDelPaciente, comoSeResume,
  type Grupo, type CabosDelPaciente,
} from '@/lib/tareas-clinicas/cabos-del-paciente'

export interface CabosSueltosDelPacienteProps {
  clinicId: string
  patientId: string
  /** Se inyecta para poder probarlo sin Firestore. */
  cargar: (clinicId: string, patientId: string) => Promise<TareaClinica[]>
  /** Llevar al worklist, que es donde se cierran. */
  alAbrirPendientes: () => void
  /**
   * Reporta lo ya cargado hacia arriba (V15-PATIENT-WORKSPACE-001, Clinical
   * Spine) — NO abre una segunda consulta a Firestore, sólo entrega lo mismo
   * que este componente ya leyó, para que el Clinical Spine pueda mostrar un
   * conteo real sin duplicar la fuente de verdad.
   */
  onResumen?: (c: CabosDelPaciente | null) => void
}

const ETIQUETA: Record<Grupo, string> = {
  sin_leer: 'Resultado sin leer',
  vencido: 'Vencido',
  en_plazo: 'En plazo',
}

/**
 * El color dice el grupo, y el texto también.
 *
 * Nunca sólo el color: quien no distingue rojo de ámbar —o mira el teléfono al
 * sol— vería tres filas iguales.
 */
const COLOR: Record<Grupo, string> = {
  sin_leer: 'var(--red)',
  vencido: 'var(--amber)',
  en_plazo: 'var(--text3)',
}

export function CabosSueltosDelPaciente(p: CabosSueltosDelPacienteProps) {
  /**
   * Se guarda YA AGRUPADO, no la lista cruda.
   *
   * Agrupar exige leer el reloj, y el reloj no se lee al pintar: el linter de
   * pureza lo prohíbe con razón —cada repintado daría un reparto distinto—.
   * Se hace una vez, cuando llegan los datos, y «vencido hace 3 días» significa
   * lo mismo durante toda la visita.
   */
  const [cabos, setCabos] = useState<CabosDelPaciente | null>(null)
  /**
   * EL FALLO DE LECTURA ES UN ESTADO PROPIO — Panel de Lujo ZC-004.
   *
   * El comentario del `catch` ya decía lo correcto («`null` es "no se pudo
   * leer", que NO es "no hay pendientes"») y luego el `if (!cabos) return null`
   * de dos líneas más abajo hacía justo lo que el comentario prohibía: un
   * «resultado sin leer» desaparecía sin que nadie supiera que hubo un fallo.
   */
  const [falloAlLeer, setFalloAlLeer] = useState<unknown>(undefined)
  const [intento, setIntento] = useState(0)
  const { clinicId, patientId, cargar } = p
  const reintentar = useCallback(() => { setFalloAlLeer(undefined); setIntento(n => n + 1) }, [])

  /* Ref, no dependencia del efecto: `onResumen` puede llegar como una función
     nueva en cada render (arrow function inline) y si estuviera en el array
     de dependencias el efecto releería Firestore sin que clinicId/patientId
     hubieran cambiado — el mismo bug que ya evita usar `[p]` en vez de las
     dependencias por valor de abajo. */
  const onResumenRef = useRef(p.onResumen)
  useEffect(() => { onResumenRef.current = p.onResumen })

  /* Dependencias por VALOR, no el objeto de props: con `[p]` el efecto se
     redispara en cada render y relee Firestore sin que nada haya cambiado. */
  useEffect(() => {
    if (!clinicId || !patientId) return
    let vivo = true
    cargar(clinicId, patientId)
      .then(r => {
        if (!vivo) return
        const c = cabosDelPaciente(r, Date.now())
        setCabos(c)
        setFalloAlLeer(undefined)
        onResumenRef.current?.(c)
      })
      /* «No se pudo leer» NO es «no hay pendientes». El fallo se guarda aparte
         y se PINTA: enseñar el mismo hueco que ante un paciente sin nada suelto
         afirmaría algo que nadie comprobó. */
      .catch((e: unknown) => {
        if (!vivo) return
        setCabos(null)
        setFalloAlLeer(e ?? new Error('lectura fallida'))
        onResumenRef.current?.(null)
      })
    return () => { vivo = false }
  }, [clinicId, patientId, cargar, intento])

  if (falloAlLeer !== undefined) {
    return <NoSePudoLeer que="los pendientes de este paciente" error={falloAlLeer} alReintentar={reintentar} />
  }

  if (!cabos) return null

  const c = cabos
  const resumen = comoSeResume(c)
  if (!resumen) return null

  const urgente = c.sinLeer > 0 || c.vencidos > 0

  return (
    <section style={{
      border: `1px solid ${urgente ? 'color-mix(in srgb, var(--red) 40%, var(--border)' : 'var(--border)'}`,
      borderRadius: 11, background: 'var(--s2)', marginBottom: 20, overflow: 'hidden',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        {urgente
          ? <AlertCircle size={15} style={{ color: 'var(--red)' }} />
          : <ClipboardList size={15} style={{ color: 'var(--text3)' }} />}
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Pendientes de este paciente
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text3)' }}>{resumen}</span>
      </header>

      <div style={{ padding: 6 }}>
        {c.lista.map(({ tarea: t, grupo, diasVencido }) => (
          <div
            key={t.id ?? `${t.tipo}-${t.creadaEn}`}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 8px' }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: COLOR[grupo],
              flexShrink: 0, marginTop: 7,
            }} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14, color: 'var(--text)', fontWeight: grupo === 'en_plazo' ? 500 : 700 }}>
                {t.titulo}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5, marginTop: 2 }}>
                {[
                  ETIQUETA[grupo],
                  diasVencido !== null ? `hace ${diasVencido} día${diasVencido === 1 ? '' : 's'}` : null,
                  t.ownerNombre || 'sin dueño',
                ].filter(Boolean).join(' · ')}
              </span>
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={p.alAbrirPendientes}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          padding: '10px 12px', background: 'transparent', border: 0, borderTop: '1px solid var(--border)',
          font: 'inherit', fontSize: 13, color: 'var(--teal)', cursor: 'pointer',
        }}
      >
        Resolverlos en Pendientes <ChevronRight size={14} />
      </button>
    </section>
  )
}

export const POR_QUE_NO_CIERRA_AQUI =
  'Cerrar es «alguien lo miró y decidió», y esa transición la valida ' +
  '/pendientes. Repetir la validación en una segunda pantalla la desalinea en ' +
  'la primera prisa.'

export const POR_QUE_EL_FALLO_SE_VE =
  'Que no se pudieran leer los pendientes no es que no los haya. Hasta ' +
  'ZC-004 las dos cosas pintaban el mismo hueco, así que un «resultado sin ' +
  'leer» se perdía sin que nadie supiera que hubo un fallo.'

export const POR_QUE_NO_ENSENA_CEROS =
  'Una tarjeta que dice «0 pendientes» ocupa el mismo sitio que una que dice ' +
  'algo. Enseñar ceros entrena a no mirar, igual que un aviso que grita de más.'
