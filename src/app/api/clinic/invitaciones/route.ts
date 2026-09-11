/**
 * /api/clinic/invitaciones — crear, listar y revocar invitaciones de equipo.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * **1. El panel de «Invitaciones pendientes» no podía funcionar.** La regla dice
 * `allow list: if false` en `clinic_invitations` —se cerró en la auditoría de
 * 2026-07 porque un `list` abierto deja enumerar las invitaciones de TODAS las
 * clínicas, y con ellas el código que permite unirse— y su propio comentario
 * afirmaba: «el cliente no lista invitaciones en ninguna parte». No era cierto:
 * `listarInvitaciones()` hacía un `getDocs(query(...))` desde el navegador y
 * `EquipoTab` lo llamaba al montarse. La consulta era rechazada, el `catch` del
 * componente sólo apagaba el spinner, y el médico veía «No hay invitaciones
 * pendientes» para siempre — acabara de generar una o no.
 *
 * Es la misma forma que `clinic_members`, que ya se había resuelto así
 * (`/api/clinic/miembros`). Aquí faltaba hacerlo.
 *
 * **2. Crear desde el navegador ataba el producto al despliegue de las reglas.**
 * Escribir el documento con el SDK de cliente lo somete a la forma congelada
 * (`hasOnly`) que hay **desplegada**, no a la que está escrita en el
 * repositorio. Añadir `emailInvitado` —el correo que hace la invitación
 * nominativa— dejaba la función inservible hasta que alguien corriera
 * `firebase deploy --only firestore:rules`, que es otro comando y otra
 * autorización. Una función que espera semanas a un despliegue manual no está
 * entregada.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Una invitación es una CREDENCIAL: quien la tiene entra al expediente. Se
 * emite en el servidor, con el autor sacado del token y el rol validado contra
 * la lista, nunca con lo que diga el cuerpo de la petición. El navegador pide;
 * no firma.
 *
 * Los TRES métodos exigen `administrar` (= {medico, admin}, la matriz de
 * capacidades E0-07). También el GET, y a propósito: `equipo.leer` —que la
 * asistente sí tiene— es para ver los correos del equipo, y esto es otra cosa.
 * En la lista van los CÓDIGOS, y un código es lo único que hace falta para
 * entrar con el rol que diga la invitación: quien pudiera leerlos podría pasar
 * a alguien el código de una invitación de médico.
 *
 * La regla de `firestore.rules` se conserva y se mantiene al día como **defensa
 * en profundidad**: si algún día alguien vuelve a escribir esta colección desde
 * el cliente, la forma congelada sigue ahí. Pero el producto ya no depende de
 * que esté desplegada.
 *
 * ── LO QUE ESTA RUTA NO HACE ─────────────────────────────────────────────────
 *
 * No manda ningún correo: esta plataforma no tiene proveedor de correo saliente
 * y elegir uno es una decisión del dueño. El enlace se comparte desde la
 * pantalla, por WhatsApp o por el correo del propio médico.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarCapacidad } from '@/lib/authz/verificar'
import { adminDb } from '@/lib/firebase-admin'
import { safeLog } from '@/lib/security/sanitize'
import {
  documentoDeInvitacion, generarCodigo, ROLES_INVITACION,
  type Invitacion, type RolInvitacion,
} from '@/lib/invitaciones/documento'

/**
 * La colección va LITERAL en cada llamada, no por una constante. No es estilo:
 * el guardián `el-indice-que-nadie-declaro` lee las cadenas del SDK admin para
 * comprobar que toda consulta compuesta tenga su índice declarado, y una
 * `.collection(COL)` la marca como ILEGIBLE — no la da por buena, se pone rojo.
 * Escribirla literal es lo que hace comprobable que la consulta del GET
 * (clinicId ↑ · createdAt ↓) tiene el suyo.
 */
const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** GET ?clinicId=… → las invitaciones de esa clínica, sin abrir `list` a nadie. */
export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get('clinicId') ?? ''
  if (!clinicId) return NextResponse.json({ ok: false, error: 'clinicId requerido' }, { status: 400 })

  const acc = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acc.ok) return acc.response

  try {
    // MISMA consulta que hacía el navegador (clinicId ↑ · createdAt ↓): su índice
    // compuesto ya está declarado y desplegado, y mantenerla igual evita quedarse
    // con un índice que nadie pide — que cuesta escrituras y almacenamiento en
    // cada documento de la colección, para siempre.
    const snap = await adminDb.collection('clinic_invitations')
      .where('clinicId', '==', clinicId)
      .orderBy('createdAt', 'desc')
      .get()
    const invitaciones = snap.docs
      .filter(d => acc.role === 'admin' || (d.data().role !== 'admin' && d.data().creadoPor === acc.uid))
      .map(d => ({ ...(d.data() as Omit<Invitacion, 'code'>), code: d.id }))
    return NextResponse.json({ ok: true, invitaciones })
  } catch (e) {
    safeLog.error('[clinic/invitaciones GET]', e)
    return NextResponse.json({ ok: false, error: 'No se pudieron leer las invitaciones' }, { status: 500 })
  }
}

/** POST { clinicId, clinicNombre, role, nombreInvitado?, emailInvitado?, especialidad? } */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 }) }

  const clinicId = texto(body.clinicId)
  if (!clinicId) return NextResponse.json({ ok: false, error: 'clinicId requerido' }, { status: 400 })

  const acc = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acc.ok) return acc.response

  const role = texto(body.role) as RolInvitacion
  if (!ROLES_INVITACION.includes(role)) {
    return NextResponse.json({ ok: false, error: 'Rol de invitación desconocido' }, { status: 400 })
  }
  /**
   * ESCALADA DE PRIVILEGIOS: para invitar a un `admin` hay que SER `admin`.
   * Sin esto, un médico fabrica un administrador y por esa puerta se cambia el
   * equipo entero. Es la misma condición que la regla de Firestore, escrita
   * donde ahora sí se ejecuta.
   */
  if (role === 'admin' && acc.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Sólo un administrador puede invitar a otro administrador.' }, { status: 403 })
  }

  const clinicNombre = texto(body.clinicNombre) || 'tu clínica'
  try {
    const invitacion = documentoDeInvitacion({
      code: generarCodigo(),
      clinicId,
      clinicNombre,
      role,
      // El autor sale del TOKEN, no del cuerpo: firmar con el uid de otro sería
      // exactamente lo que la regla ZL-011 vino a cerrar.
      creador: { uid: acc.uid, email: acc.email ?? '' },
      nombreInvitado: texto(body.nombreInvitado),
      emailInvitado: texto(body.emailInvitado),
      especialidad: texto(body.especialidad),
      ahoraMs: Date.now(),
    })
    await adminDb.collection('clinic_invitations').doc(invitacion.code).set(invitacion)
    return NextResponse.json({ ok: true, invitacion })
  } catch (e) {
    safeLog.error('[clinic/invitaciones POST]', e)
    return NextResponse.json({ ok: false, error: 'No se pudo crear la invitación' }, { status: 500 })
  }
}

/** DELETE ?code=…&clinicId=… → revoca una invitación de ESA clínica. */
export async function DELETE(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') ?? ''
  const clinicId = req.nextUrl.searchParams.get('clinicId') ?? ''
  if (!code || !clinicId) return NextResponse.json({ ok: false, error: 'code y clinicId requeridos' }, { status: 400 })

  const acc = await verificarCapacidad(req, clinicId, 'administrar')
  if (!acc.ok) return acc.response

  try {
    const ref = adminDb.collection('clinic_invitations').doc(code)
    const snap = await ref.get()
    // Si no existe, revocar ya está hecho: no se inventa un error para algo que
    // el médico quería que dejara de funcionar y no funciona.
    if (!snap.exists) return NextResponse.json({ ok: true })
    // La invitación tiene que ser de SU clínica. Sin esto, conocer un código
    // ajeno bastaría para borrar la invitación de otro consultorio.
    if ((snap.data() as { clinicId?: string }).clinicId !== clinicId) {
      return NextResponse.json({ ok: false, error: 'Esa invitación no es de tu consultorio.' }, { status: 403 })
    }
    if (acc.role !== 'admin' && (snap.data()?.role === 'admin' || snap.data()?.creadoPor !== acc.uid)) {
      return NextResponse.json({ ok: false, error: 'No puedes administrar esa invitación.' }, { status: 403 })
    }
    await ref.delete()
    return NextResponse.json({ ok: true })
  } catch (e) {
    safeLog.error('[clinic/invitaciones DELETE]', e)
    return NextResponse.json({ ok: false, error: 'No se pudo revocar la invitación' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
