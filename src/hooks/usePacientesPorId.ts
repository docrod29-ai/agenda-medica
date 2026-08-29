'use client'
import { useEffect, useRef, useState } from 'react'
import { getPatient } from '@/lib/firestore'
import type { Patient } from '@/types'

/**
 * RESOLVER LOS PACIENTES QUE SE VAN A PINTAR — por sus ids, no bajándose el
 * directorio.
 *
 * ── POR QUÉ (REG-351) ────────────────────────────────────────────────────────
 *
 * Varias pantallas construían un índice `id → Patient` a partir de «la lista»
 * del consultorio, para resolver el paciente de cada fila. Desde REG-341 esa
 * lista viene **recortada**, así que las filas cuyo paciente quedó fuera del
 * recorte se pintan como si el paciente **no existiera** — sin nombre, sin
 * teléfono, sin su señal de riesgo — y eso no se distingue de un dato que
 * falta de verdad.
 *
 * Los ids que hay que resolver son los de lo que se está enseñando: un día de
 * agenda, una página de filas. Son pocos y acotados por la pantalla, no por el
 * tamaño del consultorio. Se leen uno a uno y **se recuerdan**, así que cambiar
 * de día o de filtro no vuelve a leer lo ya resuelto.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No distingue «este paciente no existe» de «no se pudo leer»: las dos salen
 * como ausente en el mapa. Quien necesite esa diferencia —porque vaya a decidir
 * algo con ella— tiene que pedirla explícitamente, no deducirla de un `Map` sin
 * la clave.
 */
const VACIO: Map<string, Patient> = new Map()

export function usePacientesPorId(
  clinicId: string | null | undefined,
  ids: readonly (string | undefined)[],
): Map<string, Patient> {
  /**
   * El consultorio viaja DENTRO del estado, y no en un efecto que lo limpie.
   *
   * Un efecto de limpieza corre DESPUÉS del render, así que existe un render en
   * el que `clinicId` ya es el nuevo y el mapa todavía es el viejo: durante ese
   * render la pantalla pinta **pacientes de otro consultorio**. Llevando el
   * consultorio dentro del estado, el desajuste se ve en el propio render y se
   * devuelve un mapa vacío, que es la verdad.
   */
  const [estado, setEstado] = useState<{ de: string | null; mapa: Map<string, Patient> }>(
    { de: clinicId ?? null, mapa: VACIO },
  )
  /** Ids ya pedidos (resueltos o fallidos): no se vuelven a pedir en bucle. */
  const pedidos = useRef<{ de: string | null; ids: Set<string> }>({ de: clinicId ?? null, ids: new Set() })
  const clave = [...new Set(ids.filter((x): x is string => !!x))].sort().join(',')

  useEffect(() => {
    if (!clinicId) return
    if (pedidos.current.de !== clinicId) pedidos.current = { de: clinicId, ids: new Set() }
    const quiero = clave ? clave.split(',') : []
    const faltan = quiero.filter(id => !pedidos.current.ids.has(id))
    if (faltan.length === 0) return
    for (const id of faltan) pedidos.current.ids.add(id)
    let vivo = true
    Promise.all(faltan.map(id => getPatient(clinicId, id).then(p => [id, p] as const).catch(() => [id, null] as const)))
      .then(pares => {
        if (!vivo) return
        setEstado(previo => {
          // Lo acumulado sólo sirve si es del MISMO consultorio.
          const base = previo.de === clinicId ? previo.mapa : VACIO
          const siguiente = new Map(base)
          for (const [id, p] of pares) if (p) siguiente.set(id, p)
          return { de: clinicId, mapa: siguiente }
        })
      })
    return () => { vivo = false }
  }, [clinicId, clave])

  return estado.de === (clinicId ?? null) ? estado.mapa : VACIO
}
