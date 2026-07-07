'use client'
// ══════════════════════════════════════════════════════════════
// CONSOLA DEL DUEÑO — administración de suscripciones (solo superadmin).
// Ruta oculta /superadmin (no está en el sidebar). El acceso lo hace cumplir
// el servidor: /api/superadmin/* exige que tu correo sea el dueño.
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { fetchAutenticado } from '@/lib/auth-client'
import { Modal, Button, Spinner } from '@/components/ui'
import { ShieldCheck, Search, Gift, Ban, Play, CalendarPlus, StickyNote, Lock, RefreshCw } from 'lucide-react'

interface Cliente {
  id: string; nombreClinica: string; nombreMedico: string
  plan: string; status: string; paseLibre: boolean; paseLibreMotivo: string
  trialEndsAt: string | null; diasPrueba: number | null; trialVencido: boolean
  cobranza: 'al_corriente' | 'debe' | 'cortesia' | 'prueba'
  mrr: number; totalPagado: number; tieneStripe: boolean; notasInternas: string; createdAt: string | null
}
interface Totales { clinicas: number; activas: number; enPrueba: number; deben: number; cortesia: number; mrr: number; ingresoTotal: number; ingresoMes: number }

const mxn = (n: number) => '$' + Math.round(n).toLocaleString('es-MX')
const PLAN_LABEL: Record<string, string> = { trial: 'Prueba', cortesia: 'Pase libre', basico: 'Básico', pro: 'Pro', clinica: 'Clínica' }
const COB: Record<Cliente['cobranza'], { label: string; color: string }> = {
  al_corriente: { label: 'Al corriente', color: '#0d9488' },
  debe: { label: 'Debe', color: '#dc2626' },
  cortesia: { label: 'Pase libre', color: '#7c3aed' },
  prueba: { label: 'En prueba', color: '#d97706' },
}

export default function SuperadminPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [totales, setTotales] = useState<Totales | null>(null)
  const [loading, setLoading] = useState(true)
  const [denegado, setDenegado] = useState(false)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'debe' | 'prueba' | 'cortesia'>('todos')
  const [sel, setSel] = useState<Cliente | null>(null)

  const cargar = useCallback(async () => {
    try {
      const res = await fetchAutenticado('/api/superadmin/clientes')
      if (res.status === 403) { setDenegado(true); setLoading(false); return }
      const d = await res.json()
      if (d.ok) { setClientes(d.clientes); setTotales(d.totales); setDenegado(false) }
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    cargar()
  }, [authLoading, user, cargar])

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return clientes.filter(c => {
      if (filtro !== 'todos' && c.cobranza !== filtro) return false
      if (!t) return true
      return (c.nombreClinica + ' ' + c.nombreMedico).toLowerCase().includes(t)
    })
  }, [clientes, q, filtro])

  // ── Estados de acceso ──
  if (authLoading || loading) return <div style={{ minHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spinner /></div>
  if (!user) return <Centro icon={<Lock size={30} />} titulo="Inicia sesión" texto="Entra con tu cuenta de dueño para ver la consola." accion={<Button onClick={() => router.push('/login')}>Ir a iniciar sesión</Button>} />
  if (denegado) return <Centro icon={<Lock size={30} />} titulo="Acceso restringido" texto="Esta consola es exclusiva del dueño de la plataforma. Tu cuenta no tiene permiso." />

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={24} style={{ color: '#7c3aed' }} /> Consola de suscripciones
        </h1>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={cargar}>Actualizar</Button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 20px' }}>Solo tú ves esto. Todos los consultorios, quién paga, cuánto entra y a quién le das pase libre.</p>

      {/* KPIs */}
      {totales && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          <Kpi label="Ingreso del mes" valor={mxn(totales.ingresoMes)} color="#0d9488" />
          <Kpi label="MRR (estimado)" valor={mxn(totales.mrr)} sub="/mes recurrente" />
          <Kpi label="Ingreso histórico" valor={mxn(totales.ingresoTotal)} />
          <Kpi label="Activas" valor={String(totales.activas)} color="#0d9488" />
          <Kpi label="En prueba" valor={String(totales.enPrueba)} color="#d97706" />
          <Kpi label="Deben" valor={String(totales.deben)} color={totales.deben ? '#dc2626' : 'var(--text)'} />
          <Kpi label="Pase libre" valor={String(totales.cortesia)} color="#7c3aed" />
        </div>
      )}

      {/* Buscador + filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text3)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar clínica o médico…"
            style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13.5 }} />
        </div>
        {(['todos', 'debe', 'prueba', 'cortesia'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${filtro === f ? '#7c3aed' : 'var(--border)'}`,
            background: filtro === f ? '#7c3aed18' : 'transparent', color: filtro === f ? '#7c3aed' : 'var(--text3)',
          }}>{f === 'todos' ? 'Todos' : f === 'debe' ? 'Deben' : f === 'prueba' ? 'En prueba' : 'Pase libre'}</button>
        ))}
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--s2)', textAlign: 'left', color: 'var(--text3)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              <th style={{ padding: '10px 12px' }}>Clínica / Médico</th>
              <th style={{ padding: '10px 12px' }}>Plan</th>
              <th style={{ padding: '10px 12px' }}>Cobranza</th>
              <th style={{ padding: '10px 12px' }}>Prueba</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>MRR</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Pagado</th>
              <th style={{ padding: '10px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(c => {
              const cob = COB[c.cobranza]
              return (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.nombreClinica || '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{c.nombreMedico || '—'}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{PLAN_LABEL[c.plan] ?? c.plan}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, color: cob.color, background: cob.color + '18' }}>{cob.label}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 12 }}>
                    {c.status === 'trial' && c.diasPrueba != null ? (c.diasPrueba >= 0 ? `${c.diasPrueba} d` : `venció`) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text2)' }}>{c.mrr ? mxn(c.mrr) : '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: c.totalPagado ? 'var(--text)' : 'var(--text3)', fontWeight: c.totalPagado ? 600 : 400 }}>{c.totalPagado ? mxn(c.totalPagado) : '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <Button size="sm" variant="secondary" onClick={() => setSel(c)}>Gestionar</Button>
                  </td>
                </tr>
              )
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Sin clínicas que coincidan.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {sel && <ModalGestion cliente={sel} onClose={() => setSel(null)} onHecho={() => { setSel(null); cargar() }} />}
    </div>
  )
}

function Kpi({ label, valor, sub, color }: { label: string; valor: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--text)' }}>{valor}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{sub}</div>}
    </div>
  )
}

function Centro({ icon, titulo, texto, accion }: { icon: React.ReactNode; titulo: string; texto: string; accion?: React.ReactNode }) {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: 20 }}>
      <div style={{ color: 'var(--text3)' }}>{icon}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>{titulo}</div>
      <div style={{ fontSize: 14, color: 'var(--text3)', maxWidth: 380, lineHeight: 1.5 }}>{texto}</div>
      {accion}
    </div>
  )
}

// ── Modal de gestión por clínica ──
function ModalGestion({ cliente, onClose, onHecho }: { cliente: Cliente; onClose: () => void; onHecho: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [motivo, setMotivo] = useState(cliente.paseLibreMotivo || '')
  const [dias, setDias] = useState(14)
  const [notas, setNotas] = useState(cliente.notasInternas || '')

  const accion = async (accion: string, extra: Record<string, unknown> = {}) => {
    setBusy(accion)
    try {
      const res = await fetchAutenticado('/api/superadmin/accion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId: cliente.id, accion, ...extra }),
      })
      const d = await res.json()
      if (d.ok) onHecho()
    } finally { setBusy(null) }
  }

  return (
    <Modal open onClose={onClose} title={cliente.nombreClinica || cliente.nombreMedico || 'Cliente'}
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>
          {cliente.nombreMedico} · Plan {PLAN_LABEL[cliente.plan] ?? cliente.plan} · <span style={{ color: COB[cliente.cobranza].color, fontWeight: 700 }}>{COB[cliente.cobranza].label}</span>
          {cliente.totalPagado > 0 && <> · Pagado {mxn(cliente.totalPagado)}</>}
        </div>

        {/* Pase libre */}
        <Seccion icono={<Gift size={16} color="#7c3aed" />} titulo="Pase libre (cortesía)">
          {cliente.paseLibre ? (
            <Button variant="secondary" loading={busy === 'quitar_pase_libre'} onClick={() => accion('quitar_pase_libre')}>Quitar pase libre</Button>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
              <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (demo, socio, familiar…)" className="input"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }} />
              <Button loading={busy === 'pase_libre'} onClick={() => accion('pase_libre', { motivo })} icon={<Gift size={14} />}>Dar acceso gratis permanente</Button>
            </div>
          )}
        </Seccion>

        {/* Prueba */}
        <Seccion icono={<CalendarPlus size={16} color="#d97706" />} titulo="Extender prueba">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" min={1} max={365} value={dias} onChange={e => setDias(Number(e.target.value))}
              style={{ width: 80, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }} />
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>días</span>
            <Button variant="secondary" loading={busy === 'extender_prueba'} onClick={() => accion('extender_prueba', { dias })}>Extender</Button>
          </div>
        </Seccion>

        {/* Acceso */}
        <Seccion icono={<Ban size={16} color="#dc2626" />} titulo="Acceso">
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" loading={busy === 'suspender'} onClick={() => accion('suspender')} icon={<Ban size={14} />}>Suspender</Button>
            <Button variant="secondary" loading={busy === 'reactivar'} onClick={() => accion('reactivar')} icon={<Play size={14} />}>Reactivar</Button>
          </div>
        </Seccion>

        {/* Notas internas */}
        <Seccion icono={<StickyNote size={16} color="var(--text3)" />} titulo="Notas internas (solo tú)">
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Ej. Prometió pagar el 15, muy interesado en hospitalización…"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, resize: 'vertical' }} />
          <Button variant="secondary" size="sm" loading={busy === 'guardar_notas'} onClick={() => accion('guardar_notas', { notas })}>Guardar notas</Button>
        </Seccion>
      </div>
    </Modal>
  )
}

function Seccion({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{icono} {titulo}</div>
      {children}
    </div>
  )
}
