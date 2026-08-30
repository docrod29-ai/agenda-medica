'use client'
import { useEffect, useState } from 'react'
import { candidatosDePaciente } from '@/lib/pacientes/candidatos'
import type { Patient } from '@/types'

/**
 * BUSCAR UN PACIENTE, PREGUNTÁNDOLE AL SERVIDOR.
 *
 * ── POR QUÉ HAY UN HOOK Y NO NUEVE COPIAS ────────────────────────────────────
 *
 * Nueve pantallas tenían el mismo selector escrito nueve veces: pedir «la
 * lista» y filtrarla en memoria. Desde REG-341 esa lista viene **recortada**, y
 * un selector que filtra un recorte no dice «hay más»: dice **nada**, que quien
 * está agendando lee como «este paciente no existe» y resuelve dándolo de alta
 * otra vez. El resultado es un expediente partido en dos.
 *
 * Copiar el arreglo nueve veces habría garantizado que divergieran. Va aquí una
 * vez y las pantallas lo consumen.
 *
 * ── LAS TRES RESPUESTAS QUE NO SON LA MISMA ──────────────────────────────────
 *
 *   · `resultados` vacío con `sePudoPreguntar` — se preguntó y no hay nadie;
 *   · `truncada` — hay, y **puede haber más** que no caben en la ventana;
 *   · `sePudoPreguntar: false` — **no se pudo preguntar**.
 *
 * La tercera no se puede pintar como la primera. «No lo sé» dicho como «no hay»
 * es la regla 4 de seguridad clínica al revés, y aquí desemboca en un
 * expediente duplicado.
 *
 * ── EL RESULTADO VA ATADO AL TEXTO QUE LO PRODUJO ────────────────────────────
 *
 * Sin eso se enseñarían un instante los resultados de la búsqueda anterior —
 * en una lista de pacientes, **otra persona** — y se elige a quien estaba
 * debajo del dedo. Por eso `resultados` sólo devuelve algo cuando corresponde
 * al texto actual.
 */

/** Por debajo de esto no se consulta: dos letras sondean media agenda. */
export const MINIMO_PARA_BUSCAR = 2

export interface BusquedaDePacientes {
  resultados: Patient[]
  /** true = hay una consulta en vuelo para el texto actual. */
  buscando: boolean
  /** true = la ventana se llenó; puede haber coincidencias no mostradas. */
  truncada: boolean
  /** false = la consulta falló. NO es «no hay». */
  sePudoPreguntar: boolean
  /** true = el texto es demasiado corto y todavía no se ha consultado nada. */
  textoCorto: boolean
}

export function useBusquedaDePacientes(
  clinicId: string | null | undefined,
  texto: string,
  opts?: { retardoMs?: number },
): BusquedaDePacientes {
  const [estado, setEstado] = useState<{
    q: string; pacientes: Patient[]; truncada: boolean; sePudoPreguntar: boolean
  } | null>(null)
  const q = texto.trim()
  const digitos = q.replace(/\D/g, '')
  const textoCorto = q.length < MINIMO_PARA_BUSCAR && digitos.length < 3

  useEffect(() => {
    if (!clinicId) return
    const t = q.trim()
    const d = t.replace(/\D/g, '')
    if (t.length < MINIMO_PARA_BUSCAR && d.length < 3) return
    let vivo = true
    const temporizador = setTimeout(() => {
      candidatosDePaciente(clinicId, { nombre: t, telefono: d.length >= 3 ? t : '' })
        .then(c => {
          if (!vivo) return
          setEstado({ q: t, pacientes: c.pacientes, truncada: c.truncada, sePudoPreguntar: c.sePudoPreguntar })
        })
        .catch(() => {
          // Un fallo se DICE. Dejar el estado anterior enseñaría los resultados
          // de otro texto, y vaciarlo en silencio diría «no hay» de lo que no
          // se pudo mirar.
          if (vivo) setEstado({ q: t, pacientes: [], truncada: false, sePudoPreguntar: false })
        })
    }, opts?.retardoMs ?? 220)
    return () => { vivo = false; clearTimeout(temporizador) }
  }, [clinicId, q, opts?.retardoMs])

  const alDia = estado && estado.q === q
  return {
    resultados: alDia ? estado.pacientes : [],
    buscando: !textoCorto && !alDia,
    truncada: alDia ? estado.truncada : false,
    sePudoPreguntar: alDia ? estado.sePudoPreguntar : true,
    textoCorto,
  }
}
