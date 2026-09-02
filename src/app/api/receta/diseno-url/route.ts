/**
 * POST /api/receta/diseno-url — ACUÑA capacidades para el proxy del formato de
 * receta (R-06 / #350, evolución de NEXUS-QUALITY-010).
 *
 * Este es el ÚNICO sitio donde nace una autorización para /api/receta/diseno, y
 * nace sólo después de:
 *   1. autenticación de Firebase (`verificarUsuario`);
 *   2. resolución CANÓNICA del consultorio del que llama, leída en
 *      `clinic_members/{uid}` — nunca del cuerpo de la petición;
 *   3. comprobación de que el dueño del path pertenece a ESE consultorio.
 *
 * La capacidad resultante liga `version + path + ownerUid + clinicId + exp`, así
 * que una URL filtrada no sirve para otro objeto, otro médico ni otro
 * consultorio, y caduca en minutos (`DISENO_TOKEN_TTL_S`).
 *
 * FALLA CERRADO, siempre: sin sesión, sin consultorio verificable, sin secreto
 * configurado o con un path de dueño indeterminable, NO se devuelve URL. Antes,
 * la ausencia de secreto devolvía la URL PELADA y el proxy la aceptaba: eso era
 * un pase libre silencioso y aquí se acabó.
 *
 * El camino de impresión, el PDF y la vista previa llaman aquí (autenticados)
 * justo antes de usar la imagen y cambian las `<img src>`. Las URLs guardadas en
 * la configuración de los médicos NO se tocan: si se acuñaran al guardar,
 * caducarían y romperían la papelería después.
 *
 * Body: { paths: string[] }  (paths del bucket: "receta-diseno/<uid>/...")
 * Resp: { ok, urls: Record<path, urlConCapacidad> }
 */
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/auth-server'
import { acunarCapacidadDiseno, duenoDePath, urlDeCapacidad } from '@/lib/receta-diseno-token'
import { adminDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'

/** clinicId canónico de un uid según `clinic_members`. Lanza si Firestore falla. */
async function clinicIdDe(uid: string): Promise<string | null> {
  const s = await adminDb.collection('clinic_members').doc(uid).get()
  if (!s.exists) return null
  const cid = s.data()?.clinicId
  return typeof cid === 'string' && cid ? cid : null
}

export async function POST(req: NextRequest) {
  const acceso = await verificarUsuario(req)
  if (!acceso.ok) return acceso.response

  const body = await req.json().catch(() => ({})) as { paths?: unknown }
  const paths = Array.isArray(body.paths) ? body.paths.filter((p): p is string => typeof p === 'string').slice(0, 20) : []
  if (paths.length === 0) return NextResponse.json({ ok: false, error: 'paths requerido' }, { status: 400 })

  /**
   * Tenant canónico del que llama. Sin membresía no se acuña NADA: la capacidad
   * liga un clinicId, y un clinicId que no se pudo verificar no se inventa.
   * Un fallo de lectura es 503, no un 403 disfrazado: son cosas distintas y el
   * cliente ya reintenta sin romper la papelería.
   */
  let miClinica: string | null = null
  try {
    miClinica = await clinicIdDe(acceso.uid)
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo verificar tu consultorio' }, { status: 503 })
  }
  if (!miClinica) {
    return NextResponse.json({ ok: false, error: 'Aún no tienes un consultorio verificado.' }, { status: 403 })
  }
  const clinicaVerificada: string = miClinica

  // IDOR (REG-021): el que acuña sólo puede pedir SU propio diseño o el de un
  // miembro de SU MISMA clínica (la asistente imprime por el médico). El cruce a
  // otra clínica queda bloqueado → no se puede robar la firma/membrete ajeno.
  // El caso común (uid == quien llama) no hace ninguna lectura extra.
  const cacheClinica = new Map<string, string | null>()
  const mismaClinica = async (ownerUid: string): Promise<boolean> => {
    if (ownerUid === acceso.uid) return true
    if (!cacheClinica.has(ownerUid)) {
      cacheClinica.set(ownerUid, await clinicIdDe(ownerUid).catch(() => null))
    }
    return cacheClinica.get(ownerUid) === clinicaVerificada
  }

  const ahoraMs = Date.now()
  const urls: Record<string, string> = {}
  for (const p of paths) {
    // Dueño indeterminable (ruta fuera del espacio legado, traversal, sin uid) →
    // no se adivina: simplemente no se acuña.
    const ownerUid = duenoDePath(p)
    if (!ownerUid) continue
    if (!(await mismaClinica(ownerUid))) continue
    const cap = acunarCapacidadDiseno({ path: p, ownerUid, clinicId: clinicaVerificada, ahoraMs })
    // Sin secreto no hay capacidad posible. Se corta con 503 en vez de devolver
    // la URL pelada: una configuración incompleta no puede abrir el proxy.
    if (!cap) {
      return NextResponse.json({ ok: false, error: 'Firma de diseño no configurada en el servidor' }, { status: 503 })
    }
    urls[p] = urlDeCapacidad(cap)
  }
  return NextResponse.json({ ok: true, urls })
}
