/**
 * GET /api/superadmin/clientes
 *
 * Consola del DUEÑO de la plataforma: lista TODAS las clínicas con su estado de
 * suscripción + ingresos registrados. Solo accesible por superadmin (correo dueño).
 *
 * Resp: { ok, clientes: [...], totales: {...} }
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verificarSuperadmin, PRECIO_PLAN_MXN } from '@/lib/superadmin'
import { calcularPrecioPaquete } from '@/lib/pricing'
import { planDeNivel } from '@/lib/planes-ia'

const mesActual = () => new Date().toISOString().slice(0, 7)

type Any = Record<string, unknown>

async function contar(ref: FirebaseFirestore.CollectionReference): Promise<number> {
  try { return (await ref.count().get()).data().count } catch { return 0 }
}

/** Estado de cobranza derivado (para "quién debe"). */
function cobranza(c: Any, trialVencido: boolean): 'al_corriente' | 'debe' | 'cortesia' | 'prueba' {
  if (c.paseLibre === true || c.plan === 'cortesia') return 'cortesia'
  const st = String(c.status ?? '')
  if (st === 'active') return 'al_corriente'
  if (st === 'suspended' || st === 'cancelled' || st === 'canceled' || st === 'past_due') return 'debe'
  // trial: debe si ya venció la prueba (necesita poner tarjeta)
  return trialVencido ? 'debe' : 'prueba'
}

export async function GET(req: NextRequest) {
  const acc = await verificarSuperadmin(req)
  if (!acc.ok) return acc.response

  try {
    const [clinicsSnap, paysSnap] = await Promise.all([
      adminDb.collection('clinics').get(),
      adminDb.collection('platform_payments').get(),
    ])

    // Suma de pagos por clínica + total global.
    const pagadoPorClinica = new Map<string, number>()
    let ingresoTotal = 0
    const ahora = Date.now()
    const iniMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
    let ingresoMes = 0
    paysSnap.docs.forEach(d => {
      const p = d.data() as Any
      const monto = Number(p.monto ?? 0)
      const cid = String(p.clinicId ?? '')
      pagadoPorClinica.set(cid, (pagadoPorClinica.get(cid) ?? 0) + monto)
      ingresoTotal += monto
      if (p.fecha && new Date(String(p.fecha)).getTime() >= iniMes) ingresoMes += monto
    })

    const clientes = (await Promise.all(clinicsSnap.docs.map(async d => {
      const c = { ...(d.data() as Any) } as Any
      const cid = d.id
      const trialEnds = c.trialEndsAt ? new Date(String(c.trialEndsAt)).getTime() : null
      const trialVencido = c.status === 'trial' && trialEnds != null && trialEnds < ahora
      const diasPrueba = trialEnds != null ? Math.ceil((trialEnds - ahora) / 86400000) : null
      const plan = String(c.plan ?? 'trial')
      const cob = cobranza(c, trialVencido)
      // Precio del paquete. Si el paquete escala (por médico / por cama), se
      // RECALCULA con el tamaño ACTUAL de la clínica (así el cobro sigue a los
      // médicos que usan el consultorio / a las camas del hospital).
      const modeloPrecio = String(c.modeloPrecio ?? 'fijo')
      let medicos = 0, camas = 0
      let precioPaquete = Number(c.paquetePrecio ?? 0)
      if (modeloPrecio === 'por_medico' || modeloPrecio === 'por_cama') {
        const cref = adminDb.collection('clinics').doc(cid)
        if (modeloPrecio === 'por_medico') medicos = await contar(cref.collection('doctors'))
        if (modeloPrecio === 'por_cama') camas = await contar(cref.collection('camas'))
        precioPaquete = calcularPrecioPaquete(
          { modeloPrecio: modeloPrecio as 'fijo' | 'por_medico' | 'por_cama', precio: Number(c.paquetePrecio ?? 0), precioBase: Number(c.precioBase ?? 0), precioPorUnidad: Number(c.precioPorUnidad ?? 0) },
          { medicos, camas },
        )
      }
      const mrr = cob === 'al_corriente' ? (precioPaquete > 0 ? precioPaquete : (PRECIO_PLAN_MXN[plan] ?? 0)) : 0
      // Nivel de IA (Pro económico / Premium Opus+GPT-5) + consumo del mes — vive en secretos/ia.
      let nivelIA: 'pro' | 'premium' = 'pro'
      let consultasMes = 0
      try {
        const ia = (await adminDb.doc(`clinics/${cid}/secretos/ia`).get()).data()
        if (ia?.nivelIA === 'premium') nivelIA = 'premium'
        consultasMes = Number(ia?.uso?.[mesActual()]?.creditos ?? 0)
      } catch { /* default pro */ }
      const limiteConsultas = planDeNivel(nivelIA).limiteConsultas
      return {
        id: cid,
        nivelIA,
        consultasMes,
        limiteConsultas,
        nombreClinica: c.nombreClinica ?? '',
        nombreMedico: c.nombreMedico ?? '',
        plan,
        status: c.status ?? '',
        paseLibre: c.paseLibre === true,
        paseLibreMotivo: c.paseLibreMotivo ?? '',
        trialEndsAt: c.trialEndsAt ?? null,
        diasPrueba,
        trialVencido,
        cobranza: cob,
        mrr,
        precioPaquete,
        modeloPrecio,
        medicos,
        camas,
        totalPagado: pagadoPorClinica.get(cid) ?? 0,
        stripeCustomerId: c.stripeCustomerId ?? '',
        tieneStripe: !!c.stripeSubscriptionId,
        notasInternas: c.notasInternas ?? '',
        modulos: Array.isArray(c.modulos) ? c.modulos : null,
        paqueteId: c.paqueteId ?? '',
        paqueteNombre: c.paqueteNombre ?? '',
        createdAt: c.createdAt ?? null,
      }
    }))).sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))

    const totales = {
      clinicas: clientes.length,
      activas: clientes.filter(c => c.cobranza === 'al_corriente').length,
      enPrueba: clientes.filter(c => c.cobranza === 'prueba').length,
      deben: clientes.filter(c => c.cobranza === 'debe').length,
      cortesia: clientes.filter(c => c.cobranza === 'cortesia').length,
      mrr: clientes.reduce((s, c) => s + c.mrr, 0),
      ingresoTotal,
      ingresoMes,
    }

    return NextResponse.json({ ok: true, clientes, totales })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
