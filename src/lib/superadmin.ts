/**
 * SUPERADMIN de la plataforma (dueño) — control de suscripciones.
 *
 * Este es el nivel MÁS alto: por encima de cualquier clínica. Solo el/los
 * correo(s) dueño(s) de la plataforma pueden ver el panel `/superadmin`
 * (todos los clientes, quién paga, cuánto, a quién dar pase libre).
 *
 * La lista de dueños sale de la env `SUPERADMIN_EMAILS` (separados por coma).
 * Si no está configurada, cae al dueño conocido para que funcione sin fricción.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { PLANES, type ClavePlan } from '@/lib/planes-ia'
import admin from './firebase-admin'

const DEFAULT_OWNER = 'docrod29@gmail.com'

/** Correos con acceso de superadmin (normalizados a minúsculas). */
export function superadminEmails(): string[] {
  const raw = process.env.SUPERADMIN_EMAILS ?? DEFAULT_OWNER
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

export function esSuperadmin(email?: string | null): boolean {
  if (!email) return false
  return superadminEmails().includes(email.trim().toLowerCase())
}

export interface SuperadminOk { ok: true; uid: string; email: string }
export interface SuperadminErr { ok: false; response: NextResponse }
export type SuperadminAcceso = SuperadminOk | SuperadminErr

/**
 * Verifica que el solicitante sea DUEÑO de la plataforma (ID-token válido +
 * correo en la lista). Úsalo al inicio de toda ruta `/api/superadmin/*`.
 */
export async function verificarSuperadmin(req: NextRequest): Promise<SuperadminAcceso> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 }) }
  }
  try {
    const decoded = await admin.auth().verifyIdToken(header.slice(7).trim())
    // El correo NO basta: hay que haber demostrado que es tuyo.
    //
    // Hallazgo de la auditoría: el alta es autoservicio con contraseña y no exige
    // verificar el correo. Hoy no es explotable porque el único superadmin ya tiene
    // cuenta y Firebase no deja registrar un correo existente. Pero en cuanto se
    // añada un correo NUEVO a SUPERADMIN_EMAILS (p. ej. soporte@), cualquiera puede
    // ir a /registro, darse de alta con esa dirección y quedarse con la consola de
    // la plataforma entera sin recibir un solo correo. Es una trampa armada
    // esperando un cambio de configuración rutinario.
    if (!decoded.email_verified) {
      return { ok: false, response: NextResponse.json({ ok: false, error: 'Verifica tu correo antes de entrar a la consola del dueño' }, { status: 403 }) }
    }
    if (!esSuperadmin(decoded.email)) {
      return { ok: false, response: NextResponse.json({ ok: false, error: 'Acceso restringido al dueño de la plataforma' }, { status: 403 }) }
    }
    /**
     * SI HAY SEGUNDO FACTOR ENROLADO, ESTA SESIÓN TIENE QUE HABERLO USADO.
     *
     * ── El hueco que cierra (REG-384) ────────────────────────────────────────
     *
     * El producto tiene TOTP implementado y funcionando, y **ninguna ruta del
     * servidor lo exigía**: una sesión sin segundo factor tenía privilegios
     * idénticos. Firebase bloquea el inicio de sesión de un usuario enrolado, sí
     * — pero un token emitido ANTES de enrolar sigue siendo válido hasta que
     * caduca. Quien enrola TOTP porque sospecha que le robaron la contraseña
     * seguía teniendo, durante esa ventana, una sesión abierta con todo.
     *
     * ── Por qué «si está enrolado» y no «siempre» ────────────────────────────
     *
     * Exigirlo a secas dejaría al dueño fuera de su propia consola el día que
     * todavía no ha enrolado nada. La condición se ata a un hecho comprobable de
     * su cuenta, no a una política que este código no puede decidir: quien no ha
     * enrolado entra como siempre; quien SÍ enroló no puede saltárselo.
     *
     * El coste es una lectura de usuario por petición. En la consola del dueño
     * —tráfico bajísimo— es irrelevante; por eso vive aquí y no en el camino
     * clínico, donde habría que pagarlo en cada nota.
     */
    if (!decoded.firebase?.sign_in_second_factor) {
      /**
       * FALLA CERRADO, Y EL MENSAJE NO MIENTE SOBRE LA CAUSA.
       *
       * Si no se puede preguntar por los factores enrolados, no se sabe si hace
       * falta el segundo o no. Seguir adelante convertiría un fallo de red en el
       * modo de saltarse la comprobación; y responder «token inválido» mandaría
       * al dueño a revisar su sesión cuando lo que pasa es que Firebase no
       * contestó. Se responde **503 y se dice que se reintente**.
       */
      let enrolados: number
      try {
        const usuario = await admin.auth().getUser(decoded.uid)
        enrolados = usuario.multiFactor?.enrolledFactors?.length ?? 0
      } catch {
        return {
          ok: false,
          response: NextResponse.json({
            ok: false,
            error: 'No se pudo comprobar tu segundo factor ahora mismo. Vuelve a intentarlo.',
          }, { status: 503 }),
        }
      }
      if (enrolados > 0) {
        return {
          ok: false,
          response: NextResponse.json({
            ok: false,
            error: 'Esta sesión no usó tu segundo factor. Cierra sesión y vuelve a entrar con tu código.',
          }, { status: 403 }),
        }
      }
    }
    return { ok: true, uid: decoded.uid, email: decoded.email! }
  } catch {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 401 }) }
  }
}

/**
 * Precio base mensual (MXN) de un plan para estimar MRR.
 *
 * FUENTE ÚNICA: `PLANES` (planes-ia.ts), la misma tabla que anuncia la landing y
 * cobra el checkout. Antes existía aquí una tabla PARALELA (`PRECIO_PLAN_MXN`)
 * con claves viejas (basico/pro/clinica) y valores desincronizados (1799 vs el
 * 899 real), así que la Consola del dueño y su Contabilidad mostraban DOS MRR
 * distintos para la misma clínica — y los planes cuya clave no estaba en la tabla
 * caían a 0. El cobro real lo hace Stripe; el ingreso REGISTRADO se calcula de
 * `platform_payments` (webhook). Esto es solo la estimación de MRR.
 */
export function precioPlanMXN(plan: string): number {
  return PLANES[plan as ClavePlan]?.precioMXN ?? 0
}

export const PLAN_LABEL: Record<string, string> = {
  trial: 'Prueba',
  cortesia: 'Pase libre',
  basico: 'Básico',
  pro: 'Pro',
  clinica: 'Clínica',
}

export const ESTADO_LABEL: Record<string, string> = {
  active: 'Activa',
  trial: 'En prueba',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
  canceled: 'Cancelada',
  past_due: 'Pago vencido',
}
