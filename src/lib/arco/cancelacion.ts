/**
 * QUÉ SIGNIFICA «CANCELAR MIS DATOS» CUANDO HAY UN EXPEDIENTE DE POR MEDIO.
 *
 * ── EL PROBLEMA ──────────────────────────────────────────────────────────────
 *
 * La pantalla de Cumplimiento aceptaba solicitudes ARCO y las «resolvía»
 * escribiendo un texto libre. Nada más. No existía ningún camino técnico para la
 * C de ARCO —Cancelación—: la única función capaz de borrar un expediente
 * (`deletePatientExpediente`) estaba escrita, bien escrita, y SIN UN SOLO
 * LLAMADOR. Código muerto desde el día uno.
 *
 * ── POR QUÉ NO BASTA CON «BORRAR» ────────────────────────────────────────────
 *
 * Un expediente con notas FIRMADAS no se puede borrar: es un registro clínico
 * con conservación mínima obligatoria. Ofrecer un botón «eliminar» que a veces
 * funciona y a veces no, sin explicar por qué, convierte un derecho del paciente
 * en una lotería.
 *
 * Así que hay dos caminos, y cuál aplica NO es una opinión: depende de si existe
 * una nota firmada.
 *
 *   · SUPRESIÓN — no hay notas firmadas. El expediente se puede eliminar de
 *     verdad, con sus borradores y sus citas.
 *
 *   · BLOQUEO — hay notas firmadas. El expediente se CONSERVA porque la ley
 *     obliga, pero deja de usarse para todo lo demás: no entra en recordatorios,
 *     ni en reactivación, ni en campañas, ni en el CRM. Queda accesible sólo
 *     para lo que la conservación exige.
 *
 * ── LO QUE ESTE MÓDULO NO DECIDE ─────────────────────────────────────────────
 *
 * Los AÑOS de conservación y qué constituye una respuesta suficiente al titular
 * son criterio jurídico. Aquí sólo se decide lo verificable: si hay una nota
 * firmada, el borrado no procede. El plazo y la redacción de la respuesta los
 * fija el abogado del consultorio → NEEDS_LEGAL_REVIEW.
 *
 * Módulo PURO.
 */

export type CaminoCancelacion = 'supresion' | 'bloqueo'

export interface Veredicto {
  camino: CaminoCancelacion
  /** Qué va a pasar, en la lengua del médico. Se enseña ANTES de confirmar. */
  queOcurre: string
  /** Por qué no se puede hacer lo otro. Vacío cuando sí se puede todo. */
  porQueNoSeBorra: string
}

/**
 * El camino que aplica a ESTE expediente.
 *
 * Recibe el número de notas firmadas y no el expediente entero a propósito: la
 * decisión depende de un solo hecho comprobable, y así se puede probar sin
 * inventar un paciente.
 */
export function caminoDeCancelacion(notasFirmadas: number): Veredicto {
  const n = Math.max(0, Math.floor(notasFirmadas || 0))
  if (n === 0) {
    return {
      camino: 'supresion',
      queOcurre:
        'Se elimina el expediente completo: datos del paciente, borradores y sus citas. ' +
        'No hay notas firmadas, así que no hay registro clínico que conservar. Esto no se puede deshacer.',
      porQueNoSeBorra: '',
    }
  }
  return {
    camino: 'bloqueo',
    queOcurre:
      'El expediente se conserva pero deja de usarse: no vuelve a recibir recordatorios, ' +
      'ni reactivación, ni campañas, y sale del CRM. Sigue accesible sólo para la conservación ' +
      'del registro clínico.',
    porQueNoSeBorra:
      `Tiene ${n} nota${n === 1 ? '' : 's'} firmada${n === 1 ? '' : 's'}. Una nota firmada es un ` +
      'registro clínico con conservación mínima obligatoria (NOM-004): no puede eliminarse, ' +
      'ni siquiera a petición del paciente.',
  }
}

/** Lo que se escribe en el expediente al bloquear. Sin campos vacíos. */
export interface MarcaBloqueo {
  bloqueadoEn: string
  bloqueadoPor: string
  solicitudId: string
  /** Lo que el paciente pidió, en sus términos, recortado. */
  motivo: string
}

export function marcaDeBloqueo(p: {
  ahoraMs: number
  uid: string
  solicitudId: string
  motivo: string
}): MarcaBloqueo {
  return {
    bloqueadoEn: new Date(p.ahoraMs).toISOString(),
    bloqueadoPor: p.uid,
    solicitudId: p.solicitudId,
    motivo: String(p.motivo ?? '').trim().slice(0, 300),
  }
}

/**
 * ¿Este expediente está fuera de todo contacto?
 *
 * Lo consultan reactivación, CRM y campañas. Se pregunta por el expediente y no
 * por el teléfono porque un paciente puede cambiar de número y su bloqueo no
 * puede caducar con la línea telefónica.
 */
export function estaBloqueadoArco(p: { arcoBloqueo?: MarcaBloqueo | null } | null | undefined): boolean {
  return !!p?.arcoBloqueo?.bloqueadoEn
}

export const POR_QUE_DOS_CAMINOS =
  'Porque un expediente con notas firmadas no se puede borrar: es un registro ' +
  'clínico con conservación mínima obligatoria. Ofrecer un botón «eliminar» que ' +
  'a veces funciona y a veces no, sin explicar por qué, convierte un derecho del ' +
  'paciente en una lotería.'
