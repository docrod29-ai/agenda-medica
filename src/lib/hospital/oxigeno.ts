/**
 * CÓMO SE LEE EL OXÍGENO DE UNA TOMA DE SIGNOS.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * Una SpO₂ de 94 respirando aire ambiente y una SpO₂ de 94 con 5 L/min son dos
 * pacientes muy distintos. La tabla de signos del episodio los pintaba
 * **idénticos**: no tenía columna de oxígeno.
 *
 * Y no es que el dato no existiera. `RegistroSignos` declara `oxigeno`,
 * `oxigenoFlujoLpm` y `oxigenoFiO2`; el adaptador del monitor traduce los dos
 * últimos desde LOINC (3151-8 y 3150-0) y el export FHIR los emite. O sea que se
 * guardaban, viajaban a un sistema externo… y el médico que abría la ficha no
 * los veía por ninguna parte.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
 *
 * **No deduce que el paciente recibe oxígeno a partir del flujo.** Un flujo
 * registrado sin el indicador de O₂ suplementario deja el modificador de NEWS2
 * (que suma puntos) sin aplicar, y decidir que un flujo implica oxígeno es una
 * regla clínica — no la invento. Lo que sí hace es **decirlo**, para que quien
 * lea la tabla sepa que ese score puede estar por debajo.
 *
 * Y distingue «no se registró» de «aire ambiente»: un guion donde debería decir
 * aire ambiente es un dato que falta, no un paciente sin oxígeno.
 *
 * Módulo PURO.
 */
import type { RegistroSignos } from '@/types/hospital'

/** Lo que hace falta mirar de una toma para hablar de su oxígeno. */
export interface OxigenoDeToma {
  oxigeno?: boolean
  oxigenoFlujoLpm?: number
  oxigenoFiO2?: number
}

export interface TextoOxigeno {
  texto: string
  ayuda: string
}

const num = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Qué poner en la columna de O₂, y qué decir al posarse encima. */
export function textoOxigeno(s: OxigenoDeToma | null | undefined): TextoOxigeno {
  const flujo = num(s?.oxigenoFlujoLpm)
  const fio2 = num(s?.oxigenoFiO2)
  const cifras = [
    flujo !== null ? `${flujo} L/min` : '',
    fio2 !== null ? `FiO₂ ${fio2}%` : '',
  ].filter(Boolean).join(' · ')

  if (s?.oxigeno === true) {
    return {
      texto: cifras || 'sí',
      ayuda: cifras
        ? `Recibe O₂ suplementario: ${cifras}.`
        : 'Recibe O₂ suplementario. No se registró flujo ni FiO₂.',
    }
  }

  if (cifras) {
    /**
     * Hay cifras de oxígeno pero nadie marcó que lo recibe. NO se deduce: el
     * modificador de NEWS2 que suma puntos se queda sin aplicar, y decirlo es
     * mejor que corregirlo por nuestra cuenta.
     */
    return {
      texto: `${cifras} ⚠`,
      ayuda: `Se registró ${cifras}, pero la toma no dice si recibe O₂ suplementario. ` +
        'NEWS2 no aplica el modificador de oxígeno, así que el score puede quedar por debajo. ' +
        'Corrige la toma para dejarlo asentado.',
    }
  }

  if (s?.oxigeno === false) {
    return { texto: 'aire', ayuda: 'Aire ambiente: se registró que NO recibe O₂ suplementario.' }
  }

  // Ni sí, ni no, ni cifras: es un dato que falta, no un paciente sin oxígeno.
  return { texto: '—', ayuda: 'No se registró si recibe O₂ suplementario.' }
}

/** ¿Esta toma tiene cifras de oxígeno sin el indicador que NEWS2 necesita? */
export function oxigenoSinDeclarar(s: OxigenoDeToma | null | undefined): boolean {
  const hayCifras = num(s?.oxigenoFlujoLpm) !== null || num(s?.oxigenoFiO2) !== null
  return hayCifras && s?.oxigeno !== true
}

export const POR_QUE_NO_SE_DEDUCE =
  'Porque decidir que un flujo registrado significa «recibe O₂ suplementario» ' +
  'es una regla clínica, y aplicarla cambiaría el NEWS2 —el modificador suma ' +
  'puntos—. Se declara y lo decide el médico. NEEDS_CLINICAL_REVIEW.'
