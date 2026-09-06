/**
 * UN REEMBOLSO EN STRIPE DE UN ANTICIPO TIENE QUE LLEGAR AL LIBRO DEL CONSULTORIO.
 *
 * ── EL FALLO (ASC-005, Panel de Lujo 2026-09, P2) ────────────────────────────
 *
 * `charge.refunded` buscaba la clínica por `stripeCustomerId` —que un Checkout
 * de anticipo NO tiene— y escribía en `platform_payments`, el libro de la
 * PLATAFORMA. El reembolso de un anticipo de paciente quedaba como asiento
 * huérfano de la plataforma; el cobro en `clinics/{id}/cobros` seguía vivo como
 * PAYMENT y la cita seguía «pagada». El corte de caja sumaba dinero que ya se
 * había devuelto.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Un cargo cuyo PaymentIntent lleva `metadata.tipo = 'paciente_anticipo'` es
 * dinero del consultorio, no de la plataforma: su devolución se asienta en
 * `clinics/{clinicId}/cobros` como documento `tipo: 'REFUND'` con traza al
 * cobro original (`cobroOriginalId`), idempotente por cargo (el acumulado
 * `amount_refunded` reescribe el mismo documento). Si la devolución es TOTAL y
 * el cobro original es el que tenía tomada la cita, la cita se libera.
 *
 * Es la primera pieza del REFUND tipado que REG-015 dejó declarado: la única
 * automática. La de ventanilla vive en `registrarReembolso` (lib/cobros).
 *
 * Módulo PURO: decide a partir del cargo; no toca red ni base.
 */

export interface EntradaReembolsoDelAnticipo {
  /** `charge.metadata` — Stripe copia al cargo los metadatos del PaymentIntent. */
  metadata?: Record<string, string | undefined> | null
  /** `charge.amount_refunded` en centavos (ACUMULADO del cargo). */
  amountRefunded?: number | null
  /** `charge.amount` en centavos. */
  amount?: number | null
  /** `charge.refunded` — true cuando el cargo quedó devuelto por completo. */
  refunded?: boolean | null
}

export type DecisionReembolsoDelAnticipo =
  | { esAnticipo: false; porQue: string }
  | {
      esAnticipo: true
      clinicId: string
      citaId: string
      /** Lo devuelto hasta ahora, en MXN. */
      monto: number
      /** ¿Se devolvió todo lo cobrado? Decide si la cita se libera. */
      total: boolean
      porQue: string
    }

export function decidirReembolsoDelAnticipo(e: EntradaReembolsoDelAnticipo): DecisionReembolsoDelAnticipo {
  const m = e.metadata ?? {}
  if (m.tipo !== 'paciente_anticipo') {
    return { esAnticipo: false, porQue: 'el cargo no lleva metadata.tipo = paciente_anticipo: es dinero de la plataforma' }
  }
  const clinicId = String(m.clinicId ?? '').trim()
  if (!clinicId) {
    return { esAnticipo: false, porQue: 'el cargo dice ser anticipo pero no trae clinicId: se asienta como huérfano de plataforma' }
  }
  const devuelto = Math.max(0, Number(e.amountRefunded) || 0)
  const cobrado = Math.max(0, Number(e.amount) || 0)
  const total = e.refunded === true || (cobrado > 0 && devuelto >= cobrado)
  return {
    esAnticipo: true,
    clinicId,
    citaId: String(m.citaId ?? '').trim(),
    monto: devuelto / 100,
    total,
    porQue: total
      ? 'devolución total del anticipo: REFUND con traza y la cita se libera si este cobro la tenía tomada'
      : 'devolución parcial del anticipo: REFUND con traza; la cita conserva su cobro',
  }
}

export const POR_QUE_EL_REEMBOLSO_VA_AL_LIBRO_DEL_CONSULTORIO =
  'Porque el anticipo se asentó como cobro del consultorio, así que su devolución ' +
  'tiene que asentarse en el mismo libro: un corte que suma un cobro ya devuelto ' +
  'reporta dinero que no está.'
