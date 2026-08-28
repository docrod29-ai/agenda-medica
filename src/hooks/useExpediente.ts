'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useClinic } from '@/context/ClinicContext'
import {
  listarNotasPagina, LIMITE_PAGINA_NOTAS, TECHO_COMPAT_NOTAS,
  type CursorNotas,
} from '@/lib/expediente/firestore'
import type { NotaMedica } from '@/types/expediente'

/**
 * ── P1-12 · LA HISTORIA SE LEE POR PÁGINAS, NO DE UNA SENTADA ───────────────
 *
 * Este hook llamaba a `getNotas`, que bajaba la subcolección ENTERA de notas del
 * paciente. Y una nota de este producto lleva dentro el dictado completo de la
 * consulta (`transcripcionMotor` + `transcripcionCruda` + `dialogoDiarizado`):
 * abrir el expediente de un paciente longitudinal costaba su vida entera en
 * lecturas, en tráfico y en memoria del navegador, para pintar las últimas
 * quince líneas de una línea de tiempo.
 *
 * Ahora se lee la primera página y se sigue bajo demanda. Dos cosas que este
 * hook NO hace, a propósito:
 *
 *  · **No finge estar completo.** `hayMas` viaja hasta la pantalla. Una línea de
 *    tiempo recortada que se enseña como el expediente entero es la regla 4 de
 *    seguridad clínica rota justo donde más duele.
 *  · **No confunde «falló la lectura» con «no hay notas».** En error se conserva
 *    lo que ya se había cargado y se marca `error`; nunca se vacía la lista.
 *
 * Quien de verdad necesite la historia completa —la exportación FHIR, el
 * archivo de derechos ARCO— la pide EXPLÍCITAMENTE con
 * `asegurarHistoriaCompleta()`, que devuelve además si el techo la recortó.
 */
export function useExpediente(patientId: string | null) {
  const { clinicId } = useClinic()
  const [notas, setNotas] = useState<NotaMedica[]>([])
  const [loading, setLoading] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [hayMas, setHayMas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * El cursor vive en una ref y no en el estado: `cargarMas` tiene que leer el
   * valor de AHORA, no el del render en que se creó la función. Con el cursor en
   * el estado, dos pulsaciones seguidas de «cargar más» pedían dos veces la
   * MISMA página — que es duplicar notas en una línea de tiempo clínica.
   */
  const cursorRef = useRef<CursorNotas | null>(null)
  /** Candado de reentrada: el mismo caso de las dos pulsaciones seguidas. */
  const enVueloRef = useRef(false)
  /** Identidad de la carga viva: descarta respuestas de un paciente anterior. */
  const cargaRef = useRef(0)

  const reload = useCallback(async () => {
    const mia = ++cargaRef.current
    cursorRef.current = null
    enVueloRef.current = false
    if (!clinicId || !patientId) {
      setNotas([]); setHayMas(false); setError(null); setLoading(false); return
    }
    setLoading(true)
    setError(null)
    try {
      const pagina = await listarNotasPagina(clinicId, patientId, { limite: LIMITE_PAGINA_NOTAS })
      if (cargaRef.current !== mia) return
      setNotas(pagina.notas)
      cursorRef.current = pagina.cursor
      setHayMas(pagina.hayMas)
    } catch (e) {
      if (cargaRef.current !== mia) return
      console.error('[useExpediente] error cargando notas:', e)
      setError('No se pudieron cargar las notas')
      setNotas([])
      setHayMas(false)
    } finally {
      if (cargaRef.current === mia) setLoading(false)
    }
  }, [clinicId, patientId])

  useEffect(() => { reload() }, [reload])

  /** La siguiente página. Nunca repite ni se salta: continúa por el cursor. */
  const cargarMas = useCallback(async () => {
    if (!clinicId || !patientId) return
    if (enVueloRef.current) return
    const cursor = cursorRef.current
    if (!cursor) return
    const mia = cargaRef.current
    enVueloRef.current = true
    setCargandoMas(true)
    setError(null)
    try {
      const pagina = await listarNotasPagina(clinicId, patientId, {
        limite: LIMITE_PAGINA_NOTAS,
        cursor,
      })
      if (cargaRef.current !== mia) return
      /**
       * Unión por id. El cursor ya garantiza que no se repita nada; esta red
       * está por si una nota se creara ENTRE dos páginas y cayera en el borde:
       * antes duplicar un acto médico en la pantalla que otra duplique en la
       * base.
       */
      setNotas(prev => {
        const vistos = new Set(prev.map(n => n.id))
        return [...prev, ...pagina.notas.filter(n => !vistos.has(n.id))]
      })
      cursorRef.current = pagina.cursor
      setHayMas(pagina.hayMas)
    } catch (e) {
      if (cargaRef.current !== mia) return
      console.error('[useExpediente] error cargando más notas:', e)
      // NO se toca `notas` ni `hayMas`: fallar al pedir más no borra lo que hay,
      // ni convierte «hay más» en «esto es todo».
      setError('No se pudieron cargar más notas')
    } finally {
      if (cargaRef.current === mia) { enVueloRef.current = false; setCargandoMas(false) }
    }
  }, [clinicId, patientId])

  /**
   * TODA la historia, hasta el techo duro, para quien de verdad la necesita:
   * exportación FHIR y archivo de derechos ARCO. Devuelve `truncada` para que
   * el llamador pueda decir lo que NO va dentro del archivo — «lo que no se
   * pudo leer se declara» (regla de datos y privacidad).
   *
   * Reutiliza lo ya cargado y sigue por el cursor: no vuelve a pedir lo que ya
   * está en la pantalla.
   */
  const asegurarHistoriaCompleta = useCallback(async (): Promise<{ notas: NotaMedica[]; truncada: boolean }> => {
    if (!clinicId || !patientId) return { notas: [], truncada: false }
    let acumuladas = notas
    let cursor = cursorRef.current
    let quedanMas = hayMas
    const vistos = new Set(acumuladas.map(n => n.id))

    while (quedanMas && cursor && acumuladas.length < TECHO_COMPAT_NOTAS) {
      const pagina = await listarNotasPagina(clinicId, patientId, {
        limite: Math.min(LIMITE_PAGINA_NOTAS * 4, TECHO_COMPAT_NOTAS - acumuladas.length),
        cursor,
      })
      const nuevas = pagina.notas.filter(n => !vistos.has(n.id))
      for (const n of nuevas) vistos.add(n.id)
      acumuladas = [...acumuladas, ...nuevas]
      cursor = pagina.cursor
      quedanMas = pagina.hayMas
    }

    // Se publica lo bajado: la pantalla que exportó ya no vuelve a pedirlo.
    cursorRef.current = cursor
    setHayMas(quedanMas)
    setNotas(acumuladas)
    return { notas: acumuladas, truncada: quedanMas }
  }, [clinicId, patientId, notas, hayMas])

  return { notas, loading, error, reload, hayMas, cargandoMas, cargarMas, asegurarHistoriaCompleta }
}
