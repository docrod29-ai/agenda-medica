/**
 * CÓMO SE LE DICE AL MUNDO CUÁNTO SE SABE DE UN DIAGNÓSTICO.
 *
 * ── LOS TRES DEFECTOS QUE ESTE MÓDULO CIERRA ─────────────────────────────────
 *
 * La exportación FHIR resolvía el estado de una `Condition` con dos ternarios:
 *
 *     verificationStatus: dx.tipo === 'definitivo' ? 'confirmed' : 'provisional'
 *     clinicalStatus:     dx.estado === 'activo'   ? 'active'    : 'resolved'
 *
 * **1. Una confirmación que nadie hizo.** `tipo` lo pone el modelo de lenguaje o
 * lo rellena el esquema por omisión —ninguna pantalla deja al médico elegirlo
 * (REG-365)—, así que un `definitivo` **del modelo** salía a otro sistema como
 * `confirmed`: una afirmación clínica firmada por nadie, en un registro
 * interoperable que este producto no controla una vez enviado.
 *
 * **2. Un descarte convertido en sospecha.** `descartado` caía en el `else` y
 * salía como `provisional` — «todavía en estudio». FHIR tiene `refuted`
 * exactamente para esto. Es REG-364 por la puerta de la interoperabilidad: lo
 * que el médico descartó, afirmado como vigente.
 *
 * **3. Una enfermedad crónica dada por resuelta.** `estado` tiene cuatro
 * valores; el ternario reconocía uno. `cronico` y `en_seguimiento` caían en el
 * `else` y salían como **`resolved`**: el expediente interoperable de un
 * diabético decía que su diabetes está resuelta.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * **Confirmar es un acto, y sólo lo puede hacer una persona.** `confirmed` se
 * reserva para `tipoOrigen === 'medico'`. Todo lo demás —lo que dijo el modelo,
 * lo que puso la omisión, y lo que viene de notas anteriores a que esto se
 * registrara— sale como `unconfirmed`, que es el código que FHIR tiene para
 * «no consta que se haya verificado».
 *
 * `unconfirmed` no dice que el diagnóstico sea falso: dice que **nadie firmó su
 * verificación**, que es exactamente lo que ocurre. Degradar de `confirmed` a
 * `unconfirmed` una nota histórica no pierde información — deja de afirmar la
 * que nunca hubo.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * No cambia `tipo` ni `estado` de ningún diagnóstico, no reclasifica nada y no
 * decide clínica: traduce lo que el expediente dice al vocabulario de FHIR,
 * conservando la distinción que el ternario aplanaba.
 *
 * Módulo PURO.
 */
import type { Diagnostico } from '@/types/expediente'

/** Códigos de `condition-ver-status` que este producto emite. */
export type VerificationStatus = 'confirmed' | 'unconfirmed' | 'provisional' | 'differential' | 'refuted'

/** Códigos de `condition-clinical` que este producto emite. */
export type ClinicalStatus = 'active' | 'resolved' | 'recurrence' | 'remission' | 'inactive'

/**
 * `verificationStatus` de una `Condition`.
 *
 * `confirmed` **sólo** cuando una persona lo eligió. Ver la regla del módulo.
 */
export function verificationStatusDe(
  dx: Pick<Diagnostico, 'tipo' | 'tipoOrigen'>,
): VerificationStatus {
  /* El descarte primero: es el único que afirma algo NEGATIVO, y confundirlo
     con «en estudio» es el defecto de REG-364 por la puerta de FHIR. */
  if (dx.tipo === 'descartado') return 'refuted'
  if (dx.tipo === 'diferencial') return 'differential'
  if (dx.tipo === 'definitivo') {
    return dx.tipoOrigen === 'medico' ? 'confirmed' : 'unconfirmed'
  }
  /* `presuntivo`: una sospecha declarada. `provisional` es su código, venga de
     donde venga, porque no afirma verificación ninguna. */
  return 'provisional'
}

/**
 * `clinicalStatus` de una `Condition`.
 *
 * Los cuatro estados del expediente tienen código propio en FHIR. El ternario
 * anterior reconocía uno y mandaba los otros tres a `resolved`, con lo que una
 * diabetes crónica salía como resuelta.
 */
export function clinicalStatusDe(dx: Pick<Diagnostico, 'estado'>): ClinicalStatus {
  switch (dx.estado) {
    case 'resuelto': return 'resolved'
    /* Crónico y en seguimiento son problemas VIGENTES: el paciente los tiene
       hoy. `active` es su código; `resolved` afirmaba lo contrario. */
    case 'cronico': return 'active'
    case 'en_seguimiento': return 'active'
    case 'activo': return 'active'
    /* Un estado que este código no conozca NO se da por resuelto: se dice
       `active`, que es lo que no pierde al paciente de vista. Ausencia de dato
       no es dato de ausencia. */
    default: return 'active'
  }
}

export const POR_QUE_CONFIRMED_SE_GANA =
  'Porque confirmar es un acto y sólo lo puede hacer una persona. `tipo` lo pone ' +
  'el modelo de lenguaje o lo rellena la omisión —ninguna pantalla deja al ' +
  'médico elegirlo—, así que un «definitivo» del modelo salía a otro sistema ' +
  'como `confirmed`: una afirmación clínica firmada por nadie, en un registro ' +
  'que este producto ya no controla una vez enviado.'

export const POR_QUE_UNCONFIRMED_NO_PIERDE_NADA =
  '`unconfirmed` no dice que el diagnóstico sea falso: dice que nadie firmó su ' +
  'verificación, que es exactamente lo que ocurre. Degradar una nota histórica ' +
  'de `confirmed` a `unconfirmed` no pierde información — deja de afirmar la ' +
  'que nunca hubo.'
