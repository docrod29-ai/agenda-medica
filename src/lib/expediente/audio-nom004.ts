/**
 * CUÁNDO CADUCA EL AUDIO CONSERVADO DE UNA CONSULTA — NOM-004.
 *
 * ── DE DÓNDE VIENE ──────────────────────────────────────────────────────────
 *
 * El dueño autorizó dos cosas, en dos momentos: **conservar** el audio de la
 * consulta (8-ago-2026) y **borrarlo según la NOM-004** (2-sep-2026). Este
 * módulo es la segunda mitad, y sólo la DECISIÓN: puro, sin bucket y sin red,
 * para poder probarlo entero.
 *
 * Hicieron falta dos reparaciones antes de poder escribirlo, y ninguna era ésta:
 *
 *   · REG-509 — la ruta del audio no llegaba a la nota, así que no había forma
 *     de saber de qué PACIENTE era cada archivo. Sin eso, el reloj de la norma
 *     no se puede aplicar: cuenta desde el último acto médico del paciente, no
 *     desde la fecha del archivo.
 *   · REG-510 — el audio conservado vivía en el prefijo del audio de trabajo y
 *     un cron lo borraba a las 24 h. No tenía sentido escribir una caducidad de
 *     cinco años sobre archivos que no llegaban al segundo día.
 *
 * ── EL RELOJ NO ES DE ESTE MÓDULO, Y ESO ES LO IMPORTANTE ───────────────────
 *
 * Aquí **no hay ningún plazo escrito**. El estado de retención se lo pasa quien
 * llama, y sale de `evaluarRetencion` en `src/lib/retencion.ts`, que ya cita la
 * norma: «el expediente clínico debe conservarse por un periodo mínimo de 5 años
 * contados a partir de la fecha del último acto médico» (NOM-004, numeral 5.7).
 *
 * Duplicar ese número aquí sería tener dos relojes que un día discrepan. Y
 * elegir otro —la fecha del archivo, por ejemplo— sería inventar una regla más
 * estricta que la norma y llamarla «la norma».
 *
 * ── LAS TRES NEGATIVAS ──────────────────────────────────────────────────────
 *
 * Un barrendero que borra PHI de forma permanente se juzga por lo que se NIEGA
 * a hacer:
 *
 *  1. **Sin veredicto de retención, no se borra.** `no_evaluable` significa que
 *     faltó un dato para calcularlo — no que el expediente sea viejo. Ausencia
 *     de dato no es dato de ausencia (regla 4 de seguridad clínica).
 *  2. **Fuera del prefijo conservado, no se toca nada.** Ni el audio de trabajo
 *     —ése tiene su propio barrido de 24 h— ni ningún otro objeto del bucket.
 *  3. **Ante una contradicción, no se borra.** Un estado `vencido` sin días
 *     calculados es un dato que se contradice a sí mismo; se declara y se deja.
 *
 * ── LO QUE NO DECIDE ────────────────────────────────────────────────────────
 *
 * Nada sobre el EXPEDIENTE. Cuánto se conserva una nota lo fija la NOM-004 y el
 * abogado del consultorio, y `src/lib/ops/retencion.ts` lo dice con todas las
 * letras: un barrendero que se lleve por delante un dato clínico es
 * infinitamente peor que una colección que crece. Esto borra **un archivo de
 * audio** cuya autorización es explícita y cuya nota, transcripción y sello
 * **se quedan**.
 */
import { PREFIJO_AUDIO_CONSERVADO } from './audio-caduco'
import type { PacienteRetencion } from '@/lib/retencion'

/** Lo que hace falta saber de un audio para juzgarlo. Nada de PHI. */
export interface AudioConservado {
  /** Ruta completa dentro del bucket. */
  ruta: string
  /**
   * Estado de retención del PACIENTE dueño de la nota que referencia este
   * audio, tal como lo devuelve `evaluarRetencion`. `null` cuando no se pudo
   * determinar de quién es — que NO es lo mismo que `no_evaluable`: aquello es
   * «sé de quién es y no pude fecharlo»; esto es «no sé de quién es».
   */
  retencion: Pick<PacienteRetencion, 'estado' | 'diasDesdeUltimoActo'> | null
}

export type VeredictoNom004 =
  | { borrar: true; porQue: string; diasDesdeUltimoActo: number }
  | { borrar: false; porQue: string }

/** ¿Está bajo el prefijo del audio que se conserva? */
export function esAudioConservado(ruta: string): boolean {
  const r = String(ruta ?? '')
  // La barra final importa: sin ella, `consultas-audio-nota-viejo/…` entraría.
  return r.startsWith(PREFIJO_AUDIO_CONSERVADO) && r.length > PREFIJO_AUDIO_CONSERVADO.length
}

/**
 * ¿Se borra este audio? PURO y determinista.
 *
 * Devuelve SIEMPRE una razón legible, también cuando la respuesta es no: el acta
 * del barrido tiene que poder explicar por qué NO borró algo, o «no se borró
 * nada» es indistinguible de «el barrido no corrió».
 */
export function veredictoNom004(a: AudioConservado): VeredictoNom004 {
  if (!esAudioConservado(a.ruta)) {
    return { borrar: false, porQue: `no está bajo ${PREFIJO_AUDIO_CONSERVADO}` }
  }
  if (a.retencion === null) {
    return { borrar: false, porQue: 'huérfano: ninguna nota lo referencia, así que no se sabe de qué paciente es' }
  }
  const { estado, diasDesdeUltimoActo } = a.retencion
  if (estado === 'no_evaluable') {
    return { borrar: false, porQue: 'no se pudo fechar el último acto médico: ausencia de dato no es dato de ausencia' }
  }
  if (estado !== 'vencido') {
    const d = diasDesdeUltimoActo === null ? 'sin días calculados' : `${diasDesdeUltimoActo} días`
    return { borrar: false, porQue: `el expediente sigue ${estado} (${d} desde el último acto)` }
  }
  if (diasDesdeUltimoActo === null || !Number.isFinite(diasDesdeUltimoActo)) {
    // Un `vencido` sin días es un dato que se contradice: `evaluarRetencion` no
    // puede producirlo. Si aparece, alguien lo construyó a mano — y borrar PHI
    // por un dato incoherente es exactamente lo que no se hace.
    return { borrar: false, porQue: 'estado «vencido» sin días calculados: dato incoherente, no se borra' }
  }
  return {
    borrar: true,
    porQue: `expediente vencido: ${diasDesdeUltimoActo} días desde el último acto médico`,
    diasDesdeUltimoActo,
  }
}

export const POR_QUE_EL_RELOJ_NO_VIVE_AQUI =
  'El plazo NO está escrito en este módulo a propósito: sale de `evaluarRetencion`, ' +
  'que cita la NOM-004 numeral 5.7 (cinco años desde el último acto médico). ' +
  'Duplicarlo daría dos relojes que un día discrepan, y elegir otro —la fecha del ' +
  'archivo, por ejemplo— sería inventar una regla más estricta que la norma y ' +
  'llamarla «la norma».'
