/**
 * GET / PUT  /api/superadmin/planes
 *
 * El catálogo de precios, editable por el dueño sin tocar el código.
 *
 * Subir el plan Clínica de $899 a $949 exigía editar un archivo, compilar y
 * desplegar — un programador para una decisión de negocio que se toma en treinta
 * segundos. Aquí se guarda un documento de AJUSTES que sobreescribe el precio y
 * los créditos; los valores del código quedan como red.
 *
 * SÓLO EL DUEÑO. Y sólo dinero: lo que INCLUYE cada plan no se toca desde aquí
 * (ver `catalogo-planes.ts`), porque eso es permiso de acceso y se abriría con un
 * dedazo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarSuperadmin } from '@/lib/superadmin'
import { safeLog } from '@/lib/security/sanitize'
import { catalogoEfectivo, prepararGuardado, type CatalogoGuardado } from '@/lib/finanzas/catalogo-planes'

export const runtime = 'nodejs'

/** Documento único: el catálogo es uno para toda la plataforma. */
const REF = () => adminDb.collection('platform_config').doc('catalogo_planes')

async function leer(): Promise<CatalogoGuardado | null> {
  const snap = await REF().get()
  return snap.exists ? (snap.data() as CatalogoGuardado) : null
}

export async function GET(req: NextRequest) {
  const acceso = await verificarSuperadmin(req)
  if (!acceso.ok) return acceso.response
  try {
    const guardado = await leer()
    const efectivo = catalogoEfectivo(guardado)
    return NextResponse.json({
      ok: true,
      planes: efectivo.planes,
      version: efectivo.version,
      deFabrica: efectivo.deFabrica,
      avisos: efectivo.avisos,
      actualizadoEn: guardado?.actualizadoEn ?? null,
      actualizadoPor: guardado?.actualizadoPor ?? null,
    })
  } catch (e) {
    safeLog.error('[superadmin/planes] lectura', String(e).slice(0, 200))
    /**
     * Un fallo de lectura NO puede devolver el catálogo de fábrica como si fuera
     * el vigente: el dueño vería sus precios «revertidos» y podría volver a
     * teclearlos, pisando lo que sí estaba guardado.
     */
    return NextResponse.json({ ok: false, error: 'No se pudo leer el catálogo de planes.' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const acceso = await verificarSuperadmin(req)
  if (!acceso.ok) return acceso.response

  let cuerpo: { ajustes?: Record<string, { precioMXN?: number; creditos?: number }> }
  try { cuerpo = await req.json() } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }) }

  try {
    const actual = await leer()
    const { doc, rechazos } = prepararGuardado(
      (cuerpo?.ajustes ?? {}) as never,
      Number(actual?.version ?? 0),
      acceso.email,
      new Date().toISOString(),
    )
    await REF().set(doc)
    const efectivo = catalogoEfectivo(doc)
    /**
     * Los RECHAZOS viajan en la respuesta aunque el guardado saliera bien.
     *
     * Guardar «con éxito» ignorando en silencio la mitad de lo que se escribió
     * es la peor combinación posible: el dueño se va convencido de que subió el
     * precio y sigue cobrando el viejo hasta que cuadra el mes.
     */
    return NextResponse.json({
      ok: true,
      planes: efectivo.planes,
      version: efectivo.version,
      rechazos,
      avisos: efectivo.avisos,
    })
  } catch (e) {
    safeLog.error('[superadmin/planes] guardado', String(e).slice(0, 200))
    return NextResponse.json({ ok: false, error: 'No se pudo guardar el catálogo.' }, { status: 500 })
  }
}
