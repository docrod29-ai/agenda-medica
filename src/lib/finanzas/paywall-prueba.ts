/**
 * QUÉ PASA CUANDO SE ACABA LA PRUEBA.
 *
 * ── LA DECISIÓN DEL DUEÑO, LITERAL ───────────────────────────────────────────
 *
 * «Al terminar el trial se bloquea la IA, y la agenda y el expediente quedan en
 * solo lectura. Nunca se le borra nada ni se le cierra el expediente a un médico
 * que no pagó.»
 *
 * ── LO QUE YA EXISTÍA Y LO QUE FALTABA ───────────────────────────────────────
 *
 * Las reglas de Firestore (`clinicaPuedeEscribir`) ya cortan las ESCRITURAS con
 * la prueba vencida y **nunca** la lectura — con el motivo escrito ahí: cortar
 * la lectura sería ilegal además de hostil, porque el paciente tiene derecho a
 * su expediente (NOM-004).
 *
 * Lo que faltaba son dos cosas, y la primera cuesta dinero:
 *
 *  1. **La IA no miraba el trial.** Las rutas de IA corren con Admin SDK, que
 *     ignora las reglas de Firestore, y sólo comprobaban créditos y módulos. Un
 *     consultorio con la prueba vencida seguía quemando la llave del dueño
 *     indefinidamente.
 *  2. **El médico no sabía qué le pasó.** El banner decía «tu prueba terminó» y
 *     el resto lo descubría a golpes: guardar fallaba con un error de permisos
 *     genérico. Enterarse de lo que dejó de funcionar probándolo es la peor
 *     forma de enterarse.
 *
 * ── POR QUÉ ESTA LÓGICA ES UN ESPEJO, NO UNA SEGUNDA VERDAD ──────────────────
 *
 * La misma pregunta —«¿venció la prueba?»— se responde en dos motores que no se
 * pueden compartir código: las reglas de Firestore (su propio lenguaje) y este
 * TypeScript. Dos implementaciones de la misma regla divergen; es cuestión de
 * tiempo.
 *
 * Se acepta el espejo porque no hay alternativa, y se mitiga de dos maneras: las
 * constantes están AQUÍ con su nombre, y `paywall-prueba.test.ts` recorre el
 * texto de `firestore.rules` comprobando que la regla sigue diciendo lo mismo.
 * Si alguien cambia el día de gracia en un sitio, el CI cae.
 *
 * Módulo PURO.
 */

/**
 * Días de gracia después de la fecha de fin.
 *
 * No es generosidad: es que la fecha de corte y el momento en que alguien
 * intenta pagar rara vez coinciden, y quedarse fuera del expediente por unas
 * horas de diferencia horaria es un daño desproporcionado. **Tiene que valer lo
 * mismo que en `firestore.rules`** (allí, `86400000` ms).
 */
export const DIAS_DE_GRACIA = 1
export const GRACIA_MS = DIAS_DE_GRACIA * 86_400_000

/** Estados en los que el consultorio no escribe, haya prueba o no. */
export const ESTADOS_SIN_ESCRITURA = ['cancelled', 'canceled', 'suspended'] as const

export interface ClinicaParaPaywall {
  status?: string | null
  plan?: string | null
  trialEndsAtMs?: number | null
  paseLibre?: boolean | null
}

/**
 * ¿Venció la prueba?
 *
 * FALLA ABIERTO, igual que la regla de Firestore: sin `trialEndsAtMs` —clínicas
 * viejas, o el campo aún sin escribir— NO se bloquea. Dejar fuera a un
 * consultorio legítimo por un campo ausente es peor que dejar pasar a uno
 * vencido, porque el primero se queda sin poder atender y el segundo sólo
 * cuesta unas llamadas.
 */
export function pruebaVencida(c: ClinicaParaPaywall | null | undefined, ahoraMs: number): boolean {
  if (!c) return false
  if (c.paseLibre === true) return false
  if (c.status !== 'trial') return false          // quien paga queda en 'active'
  const fin = Number(c.trialEndsAtMs ?? 0)
  if (!(fin > 0)) return false                    // falla abierto
  return fin + GRACIA_MS < ahoraMs
}

/** ¿Puede escribir? Espejo de `clinicaPuedeEscribir` en firestore.rules. */
export function puedeEscribir(c: ClinicaParaPaywall | null | undefined, ahoraMs: number): boolean {
  if (!c) return true
  if (c.paseLibre === true) return true
  if (ESTADOS_SIN_ESCRITURA.includes(String(c.status ?? '') as never)) return false
  return !pruebaVencida(c, ahoraMs)
}

/**
 * ¿Puede usar la IA?
 *
 * Es lo PRIMERO que se corta, y a propósito: cada llamada de IA gasta dinero del
 * dueño en tiempo real, mientras que leer un expediente no cuesta nada. Cortar
 * primero lo que sangra y dejar en pie lo que no es la diferencia entre un
 * paywall y un castigo.
 */
export function puedeUsarIA(c: ClinicaParaPaywall | null | undefined, ahoraMs: number): boolean {
  return puedeEscribir(c, ahoraMs)
}

export interface EstadoPaywall {
  vencida: boolean
  puedeEscribir: boolean
  puedeUsarIA: boolean
  /** Lo que el médico SÍ puede seguir haciendo. Nunca vacío cuando vence. */
  loQueSigueFuncionando: string[]
  /** Una línea para la pantalla. Vacía cuando no hay nada que decir. */
  mensaje: string
}

/**
 * El estado completo, con el texto que ve el médico.
 *
 * El mensaje dice PRIMERO lo que conserva y después lo que se detuvo. Al revés
 * suena a amenaza, y el médico que lo lee está en su consultorio con pacientes:
 * lo que necesita saber en ese segundo es que sus expedientes están enteros.
 */
export function estadoPaywall(c: ClinicaParaPaywall | null | undefined, ahoraMs: number): EstadoPaywall {
  const vencida = pruebaVencida(c, ahoraMs)
  const escribir = puedeEscribir(c, ahoraMs)
  if (!vencida) {
    return { vencida: false, puedeEscribir: escribir, puedeUsarIA: escribir, loQueSigueFuncionando: [], mensaje: '' }
  }
  return {
    vencida: true,
    puedeEscribir: false,
    puedeUsarIA: false,
    loQueSigueFuncionando: [
      'Ver y consultar todos tus expedientes',
      'Ver tu agenda y tus citas',
      'Imprimir y descargar notas, recetas y órdenes',
      'Exportar tu información completa',
    ],
    mensaje: 'Tu prueba terminó. Conservas TODO: tus expedientes, tu agenda y tus documentos siguen ahí y los puedes ver, imprimir y exportar. Lo que se detuvo es escribir cosas nuevas y usar la IA. Se reactiva en cuanto actives tu plan — no se pierde nada.',
  }
}

export const POR_QUE_NUNCA_SE_CORTA_LA_LECTURA =
  'Porque el expediente no es nuestro: es del paciente, y la NOM-004 le da ' +
  'derecho a él. Cortarle el acceso a un médico que no pagó sería ilegal antes ' +
  'que hostil. Se detiene lo que cuesta dinero servir —la IA y las escrituras ' +
  'nuevas— y se deja en pie todo lo que ya existe.'
