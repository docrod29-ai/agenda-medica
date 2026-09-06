import { fechaCorta } from '@/lib/formato/fecha'
/**
 * LA PRUEBA GRATIS SE ESTRENA UNA VEZ.
 *
 * ── EL FALLO ─────────────────────────────────────────────────────────────────
 *
 * `api/stripe/checkout` mandaba `trial_period_days: 14` **incondicional**, en
 * cada sesión de compra. Stripe hace lo que se le pide: cada suscripción nueva
 * nacía con catorce días gratis.
 *
 * Así que cancelar el día 13 y volver a suscribirse renueva la prueba. Repetido,
 * es **el producto entero gratis para siempre**, sin trampas ni herramientas: dos
 * clics cada dos semanas. Y no aparece en ninguna alarma, porque desde dentro se
 * ve como un cliente que se suscribe.
 *
 * ── LA DECISIÓN ──────────────────────────────────────────────────────────────
 *
 * La prueba es una **cortesía de bienvenida**, no una condición del plan. Quien
 * ya tuvo una suscripción con este consultorio —activa, cancelada, impagada, da
 * igual— ya la estrenó. Un cambio de plan tampoco la reinicia: no es un cliente
 * nuevo.
 *
 * Y cuando NO hay prueba se cobra desde el primer día, que es exactamente lo que
 * el médico espera al volver.
 *
 * Módulo PURO: quien llame a Stripe es la ruta.
 */

/** Días de cortesía al estrenar. Un solo sitio: la ruta ya no lo escribe. */
export const DIAS_PRUEBA = 14

export interface HistorialDePrueba {
  /**
   * Cuántas suscripciones conoce Stripe de este cliente, **en cualquier
   * estado** (`status: 'all'`). Las canceladas cuentan: son justamente las del
   * que se dio de baja para estrenar otra prueba.
   */
  suscripcionesPrevias: number
  /**
   * Marca local escrita por el webhook cuando una suscripción nació con prueba.
   * Es el respaldo para cuando no se puede preguntar a Stripe.
   */
  pruebaEstrenadaEn?: string | null
  /**
   * ¿Se pudo consultar el historial en Stripe? Si la consulta falló, `false`.
   */
  historialConsultado: boolean
}

export interface DecisionPrueba {
  /** Días a mandar a Stripe. `undefined` = sin prueba, se cobra desde hoy. */
  dias: number | undefined
  /** Por qué, en una frase. Va al registro, no a la pantalla del paciente. */
  porQue: string
}

/**
 * ¿Le toca prueba a este consultorio?
 *
 * ── QUÉ PASA SI STRIPE NO CONTESTA ───────────────────────────────────────────
 *
 * Se cae a la marca local. Si tampoco la hay, **se concede** la prueba.
 *
 * Es la decisión menos mala de las dos: negarla por una caída de red le cobra el
 * primer día a alguien a quien se le prometieron catorce gratis —y eso es una
 * promesa rota, no un descuento perdido—, mientras que concederla de más a quien
 * ya la tuvo exige, además de la caída, que el webhook nunca escribiera la marca.
 */
export function decidirPrueba(h: HistorialDePrueba): DecisionPrueba {
  if (h.pruebaEstrenadaEn) {
    return {
      dias: undefined,
      porQue: `La prueba ya se estrenó el ${fechaCorta(String(h.pruebaEstrenadaEn))}. `
        + 'Se cobra desde el primer día.',
    }
  }
  if (h.historialConsultado && h.suscripcionesPrevias > 0) {
    return {
      dias: undefined,
      porQue: `El consultorio ya tuvo ${h.suscripcionesPrevias} suscripción(es) con nosotros. `
        + 'La prueba es de bienvenida y no se reinicia al volver ni al cambiar de plan.',
    }
  }
  if (!h.historialConsultado) {
    return {
      dias: DIAS_PRUEBA,
      porQue: 'No se pudo consultar el historial en Stripe y no hay marca local de prueba '
        + 'estrenada: se concede, porque negarla por una caída rompería lo prometido.',
    }
  }
  return { dias: DIAS_PRUEBA, porQue: 'Primera suscripción de este consultorio.' }
}

export const POR_QUE_UNA_SOLA_PRUEBA =
  'La prueba gratis es una cortesía de bienvenida, no una condición del plan. ' +
  'Concederla en cada compra convierte «cancelar y volver a suscribirse» en el ' +
  'producto entero gratis, y desde dentro se ve igual que un cliente que se suscribe.'
