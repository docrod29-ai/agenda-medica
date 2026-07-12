'use client'
/**
 * Cobro por asiento (por médico). Muestra cuántos médicos tiene el consultorio y
 * el cobro mensual (incluye 1, cada extra suma). Si el # de médicos cambió, ofrece
 * actualizar el cobro (ajusta la suscripción de Stripe, prorrateado).
 */
import { useCallback, useEffect, useState } from 'react'
import { fetchAutenticado } from '@/lib/auth-client'
import { Users, Loader2 } from 'lucide-react'

const mxn = (n: number) => '$' + Math.round(n).toLocaleString('es-MX')

interface Estado { conAsientos: boolean; medicos: number; contratados: number; precioMedicoExtra: number; mensualTotal: number; requiereActualizar: boolean }

export default function AsientosSection({ clinicId }: { clinicId: string }) {
  const [st, setSt] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [aplicando, setAplicando] = useState(false)

  const cargar = useCallback(() => {
    setCargando(true)
    fetchAutenticado(`/api/stripe/asientos?clinicId=${encodeURIComponent(clinicId)}`)
      .then(r => r.json()).then(d => { if (d.ok) setSt(d) }).catch(() => {}).finally(() => setCargando(false))
  }, [clinicId])
  useEffect(() => { cargar() }, [cargar])

  const actualizar = async () => {
    setAplicando(true)
    try {
      const r = await fetchAutenticado('/api/stripe/asientos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clinicId }) })
      const d = await r.json(); if (d.ok) setSt(d)
    } catch { /* noop */ } finally { setAplicando(false) }
  }

  if (cargando || !st || !st.conAsientos) return null
  const extras = Math.max(0, st.medicos - 1)

  return (
    <div style={{ marginTop: 20, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--s1)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        <Users size={17} style={{ color: 'var(--teal)' }} /> Médicos y cobro por asiento
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>
        Tu plan incluye 1 médico. Cada médico adicional suma <strong>{mxn(st.precioMedicoExtra)}/mes</strong> con su propia bolsa de créditos. (La asistente/secretaria no cuenta.)
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
        <div><div style={{ color: 'var(--text3)', fontSize: 11 }}>Médicos activos</div><div style={{ fontSize: 20, fontWeight: 800 }}>{st.medicos}</div></div>
        <div><div style={{ color: 'var(--text3)', fontSize: 11 }}>Médicos extra</div><div style={{ fontSize: 20, fontWeight: 800 }}>{extras}</div></div>
        <div><div style={{ color: 'var(--text3)', fontSize: 11 }}>Total mensual</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--teal)' }}>{mxn(st.mensualTotal)}</div></div>
      </div>

      {st.requiereActualizar && (
        <div style={{ marginTop: 12, padding: '11px 13px', borderRadius: 10, border: '1px solid var(--amber, #d97706)', background: 'rgba(217,119,6,0.07)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 8 }}>
            Tienes <strong>{st.medicos}</strong> médicos pero tu cobro es por <strong>{st.contratados}</strong>. Actualiza para ajustar la suscripción (se prorratea).
          </div>
          <button onClick={actualizar} disabled={aplicando}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--teal)', color: '#000', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: aplicando ? 'wait' : 'pointer' }}>
            {aplicando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Actualizando…</> : `Actualizar cobro a ${st.medicos} médicos`}
          </button>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
