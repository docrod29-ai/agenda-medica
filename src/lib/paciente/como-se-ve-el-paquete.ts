/**
 * CÓMO SE VE EL PAQUETE — una sola composición para las dos pantallas.
 *
 * V9 · `POSTVISIT-001` (residuo) · REG-308. Módulo PURO.
 *
 * ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────
 *
 * `LiberarAlPaciente` se titula «Lo que va a leer el paciente en su portal», y
 * su cabecera explica por qué no compone nada por su cuenta:
 *
 *     «Si la pantalla compusiera su propia versión para enseñarla, el médico
 *      aprobaría un texto y el paciente leería otro.»
 *
 * Eso valía para el **contenido** —que lo compone el servidor— y no valía para
 * la **presentación**: qué bloques se enseñan, en qué orden, y cuáles se callan
 * cuando van vacíos. Eso vivía escrito a mano en la tarjeta del médico, y la
 * pantalla del paciente lo habría vuelto a escribir a mano. Dos copias de la
 * misma decisión, y la promesa del título dependiendo de que nadie tocara una
 * sin tocar la otra.
 *
 * Aquí se decide **una vez**. Las dos pantallas piden los mismos bloques y sólo
 * cambian a quién le hablan.
 *
 * ── LO ÚNICO QUE CAMBIA ENTRE LAS DOS VOCES ES EL TÍTULO ────────────────────
 *
 * «Sus medicamentos» para quien firma, «Tus medicamentos» para quien los toma.
 * Las **líneas son idénticas**, byte a byte, y hay un guardián que lo comprueba:
 * en el momento en que una voz reescriba una línea «para que se entienda mejor»,
 * el médico habrá dejado de aprobar lo que el paciente lee.
 *
 * ── POR QUÉ UN BLOQUE VACÍO NO SE PINTA ─────────────────────────────────────
 *
 * Un encabezado «Estudios que te pidió» seguido de nada le dice al paciente que
 * hay algo que él no encuentra. El silencio se compone aquí y no en el JSX,
 * porque en el JSX se olvida en la segunda pantalla.
 *
 * ── LA EXCEPCIÓN: «QUÉ CAMBIÓ» SÍ SE PINTA VACÍO ────────────────────────────
 *
 * `medicationChanges === null` significa **«no se sabe qué había antes»**, y eso
 * no es lo mismo que «no cambió nada». Callarlo se leería como lo segundo, que
 * es tratar la ausencia de dato como dato de ausencia (regla 4 de seguridad
 * clínica). Así que se dice, con todas las letras y en las dos pantallas.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
 *
 * - **No compone contenido clínico.** Ni una cifra, ni una instrucción: todo
 *   sale ya compuesto de `componerPaquete`, que lo saca de la nota firmada.
 * - **No decide si el paquete es visible.** Eso es `visibleParaElPaciente`, y lo
 *   aplica el servidor antes de que este módulo vea nada.
 * - **No traduce.** Es es-MX. El resto es `PATIENT-LANGUAGE-001`.
 */
import type { PaqueteDeVisita, CambioDeMedicacion } from './paquete-de-visita'

/** A quién le habla la pantalla. No cambia el contenido: sólo el encabezado. */
export type VozDelPaquete = 'medico' | 'paciente'

/** Las claves son el orden, y el orden es el del riesgo para quien lo lee. */
export type ClaveDeBloque =
  | 'resumen'
  | 'medicamentos'
  | 'cambios'
  | 'estudios'
  | 'seguimiento'
  | 'alarma'
  | 'contacto'

export interface BloqueDelPaquete {
  clave: ClaveDeBloque
  titulo: string
  lineas: string[]
}

/**
 * Cómo se nombra cada cambio de medicación.
 *
 * En verbo y en presente —«empieza», «cambia»— porque describen lo que le pasa
 * al tratamiento del paciente, no una categoría de base de datos. `modificado`
 * existe desde REG-307: con tres casos, bajar la metformina de 850 a 425 mg
 * salía como «sigue igual».
 */
export const ETIQUETA_CAMBIO: Record<CambioDeMedicacion['tipo'], string> = {
  nuevo: 'empieza',
  modificado: 'cambia',
  suspendido: 'se suspende',
  'sin-cambio': 'sigue igual',
}

/**
 * Lo que se dice cuando no hay con qué comparar.
 *
 * Redactado para que sirva a las dos voces sin cambiar una coma: es exactamente
 * la línea que el médico aprueba y la que el paciente lee.
 */
export const SIN_CON_QUE_COMPARAR =
  'No hay una consulta anterior firmada con la que comparar, así que no se afirma qué cambió.'

const TITULOS: Record<ClaveDeBloque, Record<VozDelPaquete, string>> = {
  resumen:      { medico: 'Resumen de la consulta',  paciente: 'Resumen de tu consulta' },
  medicamentos: { medico: 'Sus medicamentos',        paciente: 'Tus medicamentos' },
  cambios:      { medico: 'Qué cambió',              paciente: 'Qué cambió' },
  estudios:     { medico: 'Estudios que le pidió',   paciente: 'Estudios que te pidió' },
  seguimiento:  { medico: 'Su próxima cita',         paciente: 'Tu próxima cita' },
  alarma:       { medico: 'Signos de alarma',        paciente: 'Signos de alarma' },
  contacto:     { medico: 'Cómo contactar',          paciente: 'Cómo contactar a tu consultorio' },
}

/**
 * Los bloques a pintar, en orden, ya filtrados.
 *
 * Devuelve `[]` para un paquete sin nada que decir — y entonces la pantalla
 * enseña su estado vacío, que es una frase honesta y no siete encabezados
 * huérfanos.
 */
export function bloquesDelPaquete(p: PaqueteDeVisita, voz: VozDelPaquete): BloqueDelPaquete[] {
  const bloques: BloqueDelPaquete[] = []
  const push = (clave: ClaveDeBloque, lineas: readonly string[]) => {
    const limpias = lineas.map(l => String(l ?? '').trim()).filter(Boolean)
    if (limpias.length) bloques.push({ clave, titulo: TITULOS[clave][voz], lineas: limpias })
  }

  push('resumen', [p.encounterSummary])
  push('medicamentos', p.medicationInstructions.map(m => m.instruccion))

  /* La excepción declarada arriba: «no lo sé» se dice, no se calla. */
  if (p.medicationChanges === null) push('cambios', [SIN_CON_QUE_COMPARAR])
  else push('cambios', p.medicationChanges.map(c => `${c.nombre} — ${ETIQUETA_CAMBIO[c.tipo]}`))

  push('estudios', p.orders)
  push('seguimiento', [p.followUp])
  push('alarma', p.warningSigns)
  push('contacto', [p.clinicianContactRules])

  return bloques
}

export const POR_QUE_UNA_SOLA_COMPOSICION =
  'La tarjeta del médico promete «lo que va a leer el paciente». Con dos ' +
  'composiciones, esa promesa dependía de que nadie tocara una sin tocar la otra.'
