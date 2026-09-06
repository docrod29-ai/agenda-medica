/**
 * EL TEXTO DEL CONSENTIMIENTO DE GRABACIÓN — Y SU VERSIÓN.
 *
 * ── QUÉ FALLABA (Panel de Lujo 2026-09) ─────────────────────────────────────
 *
 * El modal decía que el audio «se conserva temporalmente en este dispositivo por
 * si la transcripción falla». Los dos extremos de esa frase eran imprecisos:
 *
 *   · el lugar — `guardarAudioDeLaConsulta` (`src/hooks/useGrabacionAudio.ts`)
 *     SUBE el audio a Firebase Storage (`consultas-audio/<uid>/…`), tanto en el
 *     camino largo de la diarización como en el corto, y ahí vive hasta que el
 *     barrido lo borra: `HORAS_DE_VIDA` de `audio-caduco.ts`;
 *   · el motivo — no es «por si falla»: el audio se conserva A PROPÓSITO para
 *     poder reproducir de dónde salió cada frase de la nota (REG-249, la
 *     procedencia que REG-213/REG-250 construyeron), y eso lo autorizó el dueño.
 *
 * Lo hallaron cuatro auditores a la vez sobre el mismo párrafo: PG-003, PI-003,
 * PO-016 (P2, confirmados) y, sobre el mismo modal, PC-012, PI-008 y PP-009
 * (P3, parciales: constancia y sujeto del consentimiento).
 *
 * Lo que el texto ya decía bien y NO se toca: que el audio se envía a un
 * servicio de transcripción, y que el expediente guarda únicamente la
 * transcripción de texto (`audioPath` vive en estado de React y no se escribe en
 * Firestore; comprobado por el equipo rojo). REG-032 no ha reaparecido.
 *
 * ── POR QUÉ VIVE AQUÍ Y NO DENTRO DEL JSX ───────────────────────────────────
 *
 * Para que una prueba pueda comparar lo que el texto AFIRMA con lo que el
 * pipeline HACE, sin raspar un archivo de 7 000 líneas. Es la regla «el dato
 * tiene que llegar» aplicada a una promesa: si el hook sube audio a la nube, el
 * texto tiene que nombrar la nube.
 *
 * ── LO QUE SIGUE PENDIENTE (declarado, no escondido) ────────────────────────
 *
 * `VERSION_DEL_CONSENTIMIENTO` existe para que el expediente pueda guardar QUÉ
 * texto se leyó y volver a pedirlo cuando cambie —el mecanismo que
 * `AvisoPrivacidadModal` ya usa con su hash—. Guardarlo exige un campo nuevo en
 * `Patient.consentimientoGrabacion` (`src/types/index.ts`) y su regla de
 * Firestore, que son de otra rebanada: queda en el handoff (PC-012 · PI-008).
 * La redacción final del consentimiento por representante (PP-009) es
 * NEEDS_LEGAL_REVIEW.
 *
 * Módulo PURO.
 */
import { HORAS_DE_VIDA } from '@/lib/expediente/audio-caduco'

/**
 * Se sube cuando cambia el texto. Hoy sólo viaja a la pantalla; cuando el
 * expediente pueda guardarlo, sirve para volver a pedir el consentimiento.
 */
export const VERSION_DEL_CONSENTIMIENTO = 2

/** El párrafo que se le lee al paciente (o a quien consiente por él). */
export function textoDelConsentimiento(esMenor: boolean): string {
  const sujeto = esMenor
    ? 'Confirme que el padre, la madre o el tutor del paciente fue informado'
    : 'Confirme que el paciente fue informado'
  return `${sujeto} de que la conversación será grabada y transcrita para estructurar la nota `
    + 'clínica con asistencia de IA. El audio se envía a un servicio de transcripción para generar '
    + `el texto y se guarda en el almacenamiento del consultorio, en la nube, hasta ${HORAS_DE_VIDA} horas `
    + '—para poder comprobar de dónde salió cada frase de la nota—; después se borra. '
    + 'El expediente guarda únicamente la transcripción de texto.'
}

/** Los puntos que acompañan al párrafo. */
export function puntosDelConsentimiento(esMenor: boolean): string[] {
  return [
    esMenor
      ? 'El tutor o el paciente pueden pedir que se detenga la grabación en cualquier momento.'
      : 'El paciente puede pedir detener la grabación en cualquier momento.',
    'La nota final debe ser revisada y firmada por usted.',
    'La IA NO guarda datos clínicos sin su aprobación.',
  ]
}
