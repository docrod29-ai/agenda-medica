/**
 * GET  /api/whatsapp/no-entregados?clinicId=…  → los mensajes que se rindieron
 * POST /api/whatsapp/no-entregados             → devolver uno a la cola
 *
 * ── POR QUÉ EXISTE (TR-WHATSAPP) ────────────────────────────────────────────
 *
 * REG-397 puso el instrumento: el vigilante cuenta las entradas muertas y las
 * distingue de las pausadas. Pero el aviso dice **un número**, y con un número no
 * se puede hacer nada — no se ve de qué paciente era, ni qué decía, ni por qué
 * murió, ni se puede volver a intentar.
 *
 * Un recordatorio de cita que murió es un paciente que no sabe que tiene cita, y
 * hasta hoy eso sólo se sabía en plural.
 *
 * ── LA PUERTA ES LA QUE YA EXISTE ───────────────────────────────────────────
 *
 * `mensajeria.enviar`, la misma que `/api/whatsapp/entregas`, para los dos
 * métodos. La primera versión de esta ruta inventó una distinción —ver con
 * membresía, revivir con `clinico.escribir`— que sonaba razonable y no es la del
 * árbol: aquí la mensajería es UNA capacidad, y la cola lleva teléfonos y textos
 * de pacientes, así que verla no es más inocente que usarla.
 *
 * Un criterio de autorización paralelo es exactamente lo que este repositorio
 * persigue por todas partes: dos partes decidiendo lo mismo con reglas distintas.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeLog } from '@/lib/security/sanitize'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { listarMuertas, revivirEntrada } from '@/lib/whatsapp/outbox'
import { listarNoEntregados } from '@/lib/whatsapp/no-entregados'

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId')
  if (!clinicId) return NextResponse.json({ ok: false, error: 'clinicId requerido' }, { status: 400 })

  const acc = await verificarCapacidad(req, clinicId, 'mensajeria.enviar')
  if (!acc.ok) return acc.response

  try {
    /**
     * REG-586 · las DOS listas por la misma puerta.
     *
     * `whatsapp_no_entregados` —los fallos del bot dentro de la conversación—
     * tenía un escritor y cero lectores: estaba declarada en los tres sitios,
     * respaldada, cerrada al cliente, e invisible. Un médico que abriera esta
     * pantalla veía la mitad de los mensajes que no llegaron.
     *
     * Van por la MISMA ruta y la misma capacidad porque es la misma pregunta
     * («¿qué no llegó?»), y separarlas en dos puertas sería el criterio paralelo
     * que este repositorio persigue. Van en campos distintos porque son hechos
     * distintos: los del bot NO se pueden reintentar.
     */
    const [muertas, delBot] = await Promise.all([
      listarMuertas(clinicId),
      listarNoEntregados(clinicId),
    ])
    /**
     * Se devuelve lo que hace falta para RECONOCER el mensaje y decidir, no la
     * entrada entera: `meta` lleva contexto de sesión que no aporta nada en una
     * pantalla y sí ensancha lo que viaja.
     */
    return NextResponse.json({
      ok: true,
      muertas: muertas.map(m => ({
        id: m.id,
        para: m.to,
        plantilla: m.clave,
        texto: m.textoLibre,
        intentos: m.intentos,
        pausas: m.pausas ?? 0,
        ultimoError: m.ultimoError ?? '',
        desde: m.proximoIntentoAt,
      })),
      /**
       * El registro del bot ya nace minimizado —últimos cuatro dígitos y 120
       * caracteres— así que se pasa tal cual: recortarlo más lo dejaría sin
       * poder reconocer de qué mensaje se trata, que es para lo único que sirve.
       */
      delBot: delBot.map(b => ({
        id: b.id, origen: b.origen, telefono: b.telefono,
        extracto: b.extracto, motivo: b.motivo, cuando: b.createdAt,
      })),
    })
  } catch (e) {
    safeLog.warn('[whatsapp/no-entregados] no se pudo leer la cola', e)
    /**
     * 503 y no una lista vacía: «no se pudo leer» y «no hay ninguno» tienen
     * consecuencias opuestas para el médico, y pintarlos igual es el defecto que
     * el sobre de recuperación de evidencia existe para no repetir.
     */
    return NextResponse.json(
      { ok: false, error: 'No se pudo leer la cola de mensajes no entregados.' },
      { status: 503 },
    )
  }
}

export async function POST(req: NextRequest) {
  let body: { clinicId?: string; id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }
  const { clinicId, id } = body
  if (!clinicId || !id) return NextResponse.json({ ok: false, error: 'clinicId e id requeridos' }, { status: 400 })

  const acc = await verificarCapacidad(req, clinicId, 'mensajeria.enviar')
  if (!acc.ok) return acc.response

  try {
    const r = await revivirEntrada(clinicId, id, acc.email ?? acc.uid, Date.now())
    if (r === 'no_existe') return NextResponse.json({ ok: false, error: 'Ese mensaje ya no está en la cola.' }, { status: 404 })
    if (r === 'no_estaba_muerta') {
      return NextResponse.json(
        { ok: false, error: 'Ese mensaje sigue en cola y se reintentará solo. No hace falta revivirlo.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true, estado: r })
  } catch (e) {
    safeLog.warn('[whatsapp/no-entregados] no se pudo revivir', e)
    return NextResponse.json({ ok: false, error: 'No se pudo devolver el mensaje a la cola.' }, { status: 503 })
  }
}
