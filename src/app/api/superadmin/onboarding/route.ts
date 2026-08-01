/**
 * GET /api/superadmin/onboarding
 *
 * Dónde se atora un médico nuevo: cuánto tarda en llegar a cada hito y en cuál
 * se queda parado.
 *
 * ── DE DÓNDE SALEN LOS DATOS, Y POR QUÉ NO DE DONDE PARECÍA ──────────────────
 *
 * La primera versión recorría las colecciones de PACIENTES y NOTAS de cada
 * consultorio para leer sus fechas. El guardián de PHI la rechazó, y con razón:
 * el dueño de la plataforma no debe pasearse por los expedientes de sus
 * clientes, ni siquiera para leer un `createdAt`. Que sólo se lean marcas de
 * tiempo no cambia por dónde pasa la consulta.
 *
 * Los hitos se derivan del LIBRO DE COSTOS (`platform_cost_ledger`), que es
 * registro propio del dueño, vive a nivel plataforma y no contiene nada del
 * paciente: sólo qué función se usó, de qué consultorio y cuándo.
 *
 * El precio de hacerlo bien es que los hitos cambian de significado — se mide
 * la primera vez que el consultorio USÓ cada cosa, no la primera vez que
 * existió un registro— y eso se declara en la pantalla en vez de disimularse.
 *
 * Sólo el dueño.
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarSuperadmin } from '@/lib/superadmin'
import { safeLog } from '@/lib/security/sanitize'
import { embudoDe, resumirEmbudos, HITOS, type ClaveHito, type Instantes } from '@/lib/onboarding/embudo'

export const runtime = 'nodejs'

/**
 * Qué función del libro marca cada hito.
 *
 * `transcribir` marca el dictado —el primer uso real del producto— y `procesar`
 * la nota. La receta no llama a la IA, así que NO tiene marca propia: se declara
 * ausente en vez de inventarle una, porque un hito medido con la señal de otro
 * miente en la dirección optimista.
 */
const FEATURE_DE_HITO: Partial<Record<ClaveHito, string[]>> = {
  cita: ['transcribir-chunk'],
  consulta: ['procesar', 'transcribir'],
  receta: [],
}

export async function GET(req: NextRequest) {
  const acceso = await verificarSuperadmin(req)
  if (!acceso.ok) return acceso.response

  try {
    const clinicas = await adminDb.collection('clinics').orderBy('createdAt', 'desc').limit(50).get()

    /**
     * Se lee el libro UNA vez y se agrupa en memoria. Una consulta por
     * consultorio y por hito serían cientos de lecturas para pintar una tabla.
     */
    const eventos = await adminDb.collection('platform_cost_ledger')
      .orderBy('ts', 'asc').limit(5000).get()

    const primeroPorClinicaYFeature = new Map<string, number>()
    for (const d of eventos.docs) {
      const clinicId = String(d.get('clinicId') ?? '')
      const feature = String(d.get('feature') ?? '')
      if (!clinicId || !feature) continue
      const t = Date.parse(String(d.get('ts') ?? ''))
      if (!Number.isFinite(t)) continue
      const k = `${clinicId}|${feature}`
      if (!primeroPorClinicaYFeature.has(k)) primeroPorClinicaYFeature.set(k, t)
    }

    const primero = (clinicId: string, features: string[]): number | null => {
      const ts = features
        .map(f => primeroPorClinicaYFeature.get(`${clinicId}|${f}`))
        .filter((x): x is number => x != null)
      return ts.length ? Math.min(...ts) : null
    }

    const filas = clinicas.docs.map(d => {
      const id = d.id
      const creada = Date.parse(String(d.get('createdAt') ?? ''))
      const instantes: Instantes = {
        cuenta: Number.isFinite(creada) ? creada : null,
        // `paciente` no se puede medir sin entrar al expediente: se declara
        // ausente para todos, y la pantalla lo dice. Prefiero un hueco honesto
        // a un número sacado de donde no debo mirar.
        paciente: null,
        cita: primero(id, FEATURE_DE_HITO.cita ?? []),
        consulta: primero(id, FEATURE_DE_HITO.consulta ?? []),
        receta: null,
        cobro: null,
      }
      const e = embudoDe(instantes)
      return {
        clinicId: id,
        nombre: String(d.get('nombre') ?? id),
        plan: String(d.get('plan') ?? '—'),
        estado: String(d.get('status') ?? '—'),
        creada: Number.isFinite(creada) ? new Date(creada).toISOString().slice(0, 10) : null,
        embudo: e,
      }
    })

    return NextResponse.json({
      ok: true,
      hitos: HITOS,
      /** Los que NO se pueden medir sin entrar al expediente. Se dice, no se esconde. */
      hitosSinSeñal: ['paciente', 'receta', 'cobro'],
      consultorios: filas.map(f => ({
        clinicId: f.clinicId, nombre: f.nombre, plan: f.plan, estado: f.estado, creada: f.creada,
        atoradoEn: f.embudo.atoradoEn?.clave ?? null,
        queHacer: f.embudo.atoradoEn?.siSeAtora ?? null,
        pasos: f.embudo.pasos.map(p => ({ clave: p.hito.clave, alcanzado: p.alcanzado, desdeCuentaMs: p.desdeCuentaMs })),
      })),
      resumen: resumirEmbudos(filas.map(f => f.embudo)),
    })
  } catch (e) {
    safeLog.error('[superadmin/onboarding]', String(e).slice(0, 200))
    return NextResponse.json({ ok: false, error: 'No se pudo calcular el embudo de alta.' }, { status: 500 })
  }
}
