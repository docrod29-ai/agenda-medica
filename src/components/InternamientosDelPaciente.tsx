'use client'
/**
 * LOS INGRESOS DE ESTE PACIENTE — REG-261.
 *
 * ── EL HUECO, Y LO DECÍA EL PROPIO CÓDIGO ───────────────────────────────────
 *
 * `getInternamientosDePaciente()` lleva escrito en su comentario, desde que se
 * escribió:
 *
 *     «Internamientos de UN paciente (para mostrarlos en su expediente).»
 *
 * Y el expediente **no los mostraba**. La función no tenía llamador, ni prueba.
 *
 * ── POR QUÉ NO ES UN DETALLE ────────────────────────────────────────────────
 *
 * La constitución del charter V7 dice, en mayúsculas: **UN PACIENTE · UN
 * EXPEDIENTE LONGITUDINAL**. Un paciente que estuvo ingresado dos veces tenía
 * esos episodios sólo en la pantalla de hospitalización, a la que se llega por
 * el censo. Desde su expediente **no había forma de saber que existieron**.
 *
 * Las NOTAS de hospital sí aparecían, bajo su pestaña. Pero una nota suelta no
 * dice cuándo ingresó, cuántos días estuvo, ni cómo egresó.
 *
 * ── LO QUE ENSEÑA, Y LO QUE NO ──────────────────────────────────────────────
 *
 * Enseña lo que ya está guardado: fechas, servicio, cama y egreso. **No calcula
 * nada clínico** — ni días de estancia «corregidos», ni reingresos, ni ninguna
 * cifra derivada: esos motores existen aparte, con sus reglas, y duplicarlos
 * aquí sería crear una segunda verdad para el mismo dato.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { BedDouble, ChevronRight } from 'lucide-react'
import { NoSePudoLeer } from '@/components/ui/NoSePudoLeer'
import { plural } from '@/lib/texto-es'
import { fechaCorta } from '@/lib/formato/fecha'
import type { Internamiento } from '@/types/hospital'

export interface InternamientosDelPacienteProps {
  clinicId: string
  patientId: string
  /** Se inyecta para poder probarlo sin Firestore. */
  cargar: (clinicId: string, pacienteId: string) => Promise<Internamiento[]>
  alAbrir: (internamientoId: string) => void
  /**
   * Reporta lo ya cargado hacia arriba (V15-PATIENT-WORKSPACE-001, Clinical
   * Spine) — NO abre una segunda consulta a Firestore, sólo entrega lo mismo
   * que este componente ya leyó.
   */
  onCargado?: (lista: Internamiento[] | null) => void
}

/**
 * La fecha va por el formateador ÚNICO del producto (ZC-019): `toLocaleDateString`
 * a secas usaba la zona del navegador, y el mismo ingreso cambiaba de día según
 * desde dónde se mirara. `fechaCorta` formatea en la zona del consultorio.
 */
const fecha = (iso?: string) => fechaCorta(iso) || '—'

export function InternamientosDelPaciente(p: InternamientosDelPacienteProps) {
  const [lista, setLista] = useState<Internamiento[] | null>(null)
  /** El fallo de lectura es un estado propio — Panel de Lujo ZC-005. */
  const [falloAlLeer, setFalloAlLeer] = useState<unknown>(undefined)
  const [intento, setIntento] = useState(0)
  const { clinicId, patientId, cargar } = p
  const reintentar = useCallback(() => { setFalloAlLeer(undefined); setIntento(n => n + 1) }, [])

  /* Ref, no dependencia del efecto: ver la misma razón en
     CabosSueltosDelPaciente.tsx — `onCargado` no debe redisparar la lectura. */
  const onCargadoRef = useRef(p.onCargado)
  useEffect(() => { onCargadoRef.current = p.onCargado })

  /* Dependencias por VALOR, no el objeto de props: con `[p]` el efecto se
     redispara en cada render y relee Firestore sin que nada haya cambiado. */
  useEffect(() => {
    if (!clinicId || !patientId) return
    let vivo = true
    cargar(clinicId, patientId)
      .then(r => { if (vivo) { setLista(r); setFalloAlLeer(undefined); onCargadoRef.current?.(r) } })
      /* «No se pudo leer» NO es «nunca estuvo ingresado». El fallo se guarda
         aparte y se PINTA: una lista ausente ante un fallo de red afirmaría
         algo falso sobre la historia del paciente. */
      .catch((e: unknown) => {
        if (!vivo) return
        setLista(null)
        setFalloAlLeer(e ?? new Error('lectura fallida'))
        onCargadoRef.current?.(null)
      })
    return () => { vivo = false }
  }, [clinicId, patientId, cargar, intento])

  if (falloAlLeer !== undefined) {
    return <NoSePudoLeer que="sus ingresos hospitalarios" error={falloAlLeer} alReintentar={reintentar} />
  }

  if (!lista || lista.length === 0) return null

  return (
    <section style={{
      border: '1px solid var(--border)', borderRadius: 11,
      background: 'var(--s2)', marginBottom: 20, overflow: 'hidden',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <BedDouble size={15} style={{ color: 'var(--text3)' }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Ingresos hospitalarios
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text3)' }}>
          {plural(lista.length, 'episodio', 'episodios')}
        </span>
      </header>

      <div style={{ padding: 6 }}>
        {lista.map(i => {
          const abierto = !i.fechaEgreso
          return (
            <button
              key={i.id}
              onClick={() => p.alAbrir(i.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 8px', background: 'transparent', border: 0,
                font: 'inherit', textAlign: 'left', cursor: 'pointer',
              }}
            >
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, color: 'var(--text)', fontWeight: abierto ? 700 : 500 }}>
                  {fecha(i.fechaIngreso)} → {abierto ? 'sigue internado' : fecha(i.fechaEgreso)}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5, marginTop: 2 }}>
                  {[i.servicio, i.cama ? `cama ${i.cama}` : null, i.tipoEgreso]
                    .filter(Boolean).join(' · ') || 'sin datos de ubicación'}
                </span>
              </span>
              <ChevronRight size={15} style={{ color: 'var(--text3)', flexShrink: 0 }} />
            </button>
          )
        })}
      </div>
    </section>
  )
}

export const POR_QUE_EXISTE =
  'getInternamientosDePaciente() decía en su comentario «para mostrarlos en su ' +
  'expediente» y el expediente no los mostraba. Un paciente ingresado dos veces ' +
  'no tenía forma, desde su expediente, de saber que esos episodios existieron.'

export const POR_QUE_NO_CALCULA_NADA =
  'Días de estancia, reingresos y demás tienen sus propios motores con sus ' +
  'reglas. Recalcularlos aquí sería una segunda verdad para el mismo dato.'

export const POR_QUE_NULL_NO_ES_VACIO =
  'Si la lectura falla, no se enseña una lista vacía: eso afirmaría que el ' +
  'paciente nunca estuvo ingresado. Hasta ZC-005 el fallo y el vacío ' +
  'compartían el mismo `return null`, así que la afirmación falsa se hacía ' +
  'igual, sólo que en silencio.'
