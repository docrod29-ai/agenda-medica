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
import { MODULOS, MODULO_LABEL } from '@/lib/modulos'
import { type ModeloPrecio, explicarPrecio } from '@/lib/pricing'
import { ShieldCheck, Search, Gift, Ban, Play, CalendarPlus, StickyNote, Lock, RefreshCw, Package, Plus, Trash2, Boxes, Sparkles } from 'lucide-react'

interface Cliente {
  id: string; nombreClinica: string; nombreMedico: string
  plan: string; status: string; paseLibre: boolean; paseLibreMotivo: string
  trialEndsAt: string | null; diasPrueba: number | null; trialVencido: boolean
  cobranza: 'al_corriente' | 'debe' | 'cortesia' | 'prueba'
  mrr: number; totalPagado: number; tieneStripe: boolean; notasInternas: string
  modulos: string[] | null; paqueteId: string; paqueteNombre: string; createdAt: string | null
  nivelIA: 'pro' | 'premium'
  consultasMes: number; limiteConsultas: number
}
interface Paquete { id: string; nombre: string; precio: number; modulos: string[]; descripcion?: string; activo?: boolean; orden?: number; modeloPrecio?: ModeloPrecio; precioBase?: number; precioPorUnidad?: number }
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
  const [paquetes, setPaquetes] = useState<Paquete[]>([])
  const [loading, setLoading] = useState(true)
  const [denegado, setDenegado] = useState(false)
  const [vista, setVista] = useState<'clientes' | 'paquetes'>('clientes')
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'debe' | 'prueba' | 'cortesia'>('todos')
  const [sel, setSel] = useState<Cliente | null>(null)

  const cargarPaquetes = useCallback(async () => {
    try {
      const res = await fetchAutenticado('/api/superadmin/paquetes')
      const d = await res.json()
      if (d.ok) setPaquetes(d.paquetes)
    } catch { /* */ }
  }, [])

  const cargar = useCallback(async () => {
    try {
      const res = await fetchAutenticado('/api/superadmin/clientes')
      if (res.status === 403) { setDenegado(true); setLoading(false); return }
      const d = await res.json()
      if (d.ok) { setClientes(d.clientes); setTotales(d.totales); setDenegado(false); cargarPaquetes() }
    } catch { /* */ }
    setLoading(false)
  }, [cargarPaquetes])

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
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 16px' }}>Solo tú ves esto. Todos los consultorios, quién paga, cuánto entra, a quién le das pase libre y qué paquete tiene cada uno.</p>

      {/* Tabs Clientes / Paquetes */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {([['clientes', 'Clientes', <Boxes key="a" size={15} />], ['paquetes', 'Paquetes', <Package key="b" size={15} />]] as const).map(([k, label, icon]) => (
          <button key={k} onClick={() => setVista(k)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none', borderBottom: `2px solid ${vista === k ? '#7c3aed' : 'transparent'}`,
            color: vista === k ? 'var(--text)' : 'var(--text3)', marginBottom: -1,
          }}>{icon} {label}</button>
        ))}
      </div>

      {vista === 'paquetes' ? (
        <PaquetesManager paquetes={paquetes} onCambio={cargarPaquetes} />
      ) : (
      <>
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
                  <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>
                    <div>{PLAN_LABEL[c.plan] ?? c.plan}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>
                      {c.paqueteNombre ? c.paqueteNombre : c.modulos == null ? 'Todo (sin restringir)' : `${c.modulos.length} módulo${c.modulos.length === 1 ? '' : 's'}`}
                    </div>
                  </td>
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
      </>
      )}

      {sel && <ModalGestion cliente={sel} paquetes={paquetes} onClose={() => setSel(null)} onHecho={() => { setSel(null); cargar() }} />}
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
function ModalGestion({ cliente, paquetes, onClose, onHecho }: { cliente: Cliente; paquetes: Paquete[]; onClose: () => void; onHecho: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [motivo, setMotivo] = useState(cliente.paseLibreMotivo || '')
  const [dias, setDias] = useState(14)
  const [notas, setNotas] = useState(cliente.notasInternas || '')
  // Módulos actuales de la clínica (null = todo). Los editamos a mano o aplicando un paquete.
  const [mods, setMods] = useState<string[]>(cliente.modulos == null ? MODULOS.map(m => m.key) : cliente.modulos)
  const [paqNombre, setPaqNombre] = useState(cliente.paqueteNombre || '')
  const [paqId, setPaqId] = useState(cliente.paqueteId || '')
  const [nivelIA, setNivelIA] = useState<'pro' | 'premium'>(cliente.nivelIA ?? 'pro')
  const toggleMod = (k: string) => setMods(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const aplicarPaquete = (p: Paquete) => { setMods(p.modulos); setPaqNombre(p.nombre); setPaqId(p.id) }

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

        {/* Paquete / acceso a módulos */}
        <Seccion icono={<Package size={16} color="#2563eb" />} titulo="Paquete y acceso a módulos">
          {paquetes.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {paquetes.filter(p => p.activo !== false).map(p => (
                <button key={p.id} onClick={() => aplicarPaquete(p)} style={{
                  padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${paqId === p.id ? '#2563eb' : 'var(--border)'}`,
                  background: paqId === p.id ? '#2563eb18' : 'transparent', color: paqId === p.id ? '#2563eb' : 'var(--text2)',
                }}>{p.nombre}{p.precio ? ` · ${mxn(p.precio)}` : ''}</button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Aplica un paquete o marca módulos a mano:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
            {MODULOS.map(m => (
              <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', padding: '3px 0' }}>
                <input type="checkbox" checked={mods.includes(m.key)} onChange={() => { toggleMod(m.key); setPaqId(''); setPaqNombre('') }} />
                <span style={{ fontWeight: 600 }}>{m.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {m.descripcion}</span>
              </label>
            ))}
          </div>
          <Button size="sm" loading={busy === 'asignar_modulos'} disabled={mods.length === 0}
            onClick={() => accion('asignar_modulos', { modulos: mods, paqueteId: paqId, paqueteNombre: paqNombre })}>
            Guardar acceso {mods.length === MODULOS.length ? '(todo)' : `(${mods.length})`}
          </Button>
        </Seccion>

        {/* Nivel de IA (Pro económico / Premium Opus+GPT-5) */}
        <Seccion icono={<Sparkles size={16} color="#3d5afe" />} titulo="Nivel de IA">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['pro', 'premium'] as const).map(n => {
              const activo = nivelIA === n
              const label = n === 'pro' ? 'Pro ($899) · Sonnet 5' : 'Premium ($1,999) · Opus 4.8 + GPT-5'
              return (
                <button key={n} disabled={busy === 'set_nivel_ia'}
                  onClick={() => { setNivelIA(n); accion('set_nivel_ia', { nivelIA: n }) }}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                    border: '1px solid ' + (activo ? '#3d5afe' : 'var(--border)'),
                    background: activo ? 'rgba(61,90,254,0.12)' : 'transparent',
                    color: activo ? '#3d5afe' : 'var(--text3)',
                  }}>
                  {activo ? '✓ ' : ''}{label}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            Pro: nota con Sonnet 5, 2ª opinión a botón. Premium: Opus 4.8 + razonamiento + 2ª opinión GPT-5 automática.
          </div>
          {/* Consumo del mes vs límite del plan */}
          {(() => {
            const usadas = cliente.consultasMes ?? 0
            const lim = cliente.limiteConsultas || 1
            const pct = Math.min(100, Math.round((usadas / lim) * 100))
            const col = pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#16a34a'
            return (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text2)', marginBottom: 4 }}>
                  <span>Consultas este mes</span>
                  <strong style={{ color: col }}>{usadas} / {cliente.limiteConsultas}</strong>
                </div>
                <div style={{ height: 6, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: col, transition: 'width .3s' }} />
                </div>
              </div>
            )
          })()}
        </Seccion>

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

// ── Gestor de PAQUETES (armar combinaciones de módulos con precio) ──
type BorradorPaquete = { id?: string; nombre: string; precio: number; modulos: string[]; descripcion: string; modeloPrecio: ModeloPrecio; precioBase: number; precioPorUnidad: number }
const NUEVO: BorradorPaquete = { nombre: '', precio: 0, modulos: [], descripcion: '', modeloPrecio: 'fijo', precioBase: 0, precioPorUnidad: 0 }

function PaquetesManager({ paquetes, onCambio }: { paquetes: Paquete[]; onCambio: () => void }) {
  const [editar, setEditar] = useState<BorradorPaquete | null>(null)
  const [busy, setBusy] = useState(false)

  const guardar = async () => {
    if (!editar || !editar.nombre.trim() || editar.modulos.length === 0) return
    setBusy(true)
    try {
      await fetchAutenticado('/api/superadmin/paquetes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: editar.id ? 'editar' : 'crear', id: editar.id, paquete: editar }),
      })
      setEditar(null); onCambio()
    } finally { setBusy(false) }
  }
  const borrar = async (id: string) => {
    setBusy(true)
    try {
      await fetchAutenticado('/api/superadmin/paquetes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'borrar', id }),
      })
      onCambio()
    } finally { setBusy(false) }
  }
  const toggle = (k: string) => setEditar(e => e ? { ...e, modulos: e.modulos.includes(k) ? e.modulos.filter(x => x !== k) : [...e.modulos, k] } : e)

  // Genera paquetes de ejemplo (todos editables después). Solo para arrancar.
  const sugeridos = async () => {
    setBusy(true)
    const base: { nombre: string; precio: number; modulos: string[]; descripcion: string }[] = [
      { nombre: 'Solo agenda', precio: 399, modulos: ['agenda'], descripcion: 'Citas, calendario y recordatorios' },
      { nombre: 'Consulta', precio: 699, modulos: ['agenda', 'expediente'], descripcion: 'Agenda + expediente de consulta' },
      { nombre: 'Hospital', precio: 999, modulos: ['agenda', 'hospitalizacion'], descripcion: 'Agenda + módulo de hospitalización' },
      { nombre: 'Todo', precio: 1799, modulos: MODULOS.map(m => m.key), descripcion: 'Acceso completo a la plataforma' },
    ]
    try {
      for (let i = 0; i < base.length; i++) {
        await fetchAutenticado('/api/superadmin/paquetes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'crear', paquete: { ...base[i], orden: i } }),
        })
      }
      onCambio()
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Arma tus paquetes: elige qué módulos incluye cada uno y su precio. Luego se los asignas a cada consultorio.</p>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setEditar({ ...NUEVO })}>Nuevo paquete</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {paquetes.map(p => (
          <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{p.nombre}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{p.precio ? mxn(p.precio) : 'Gratis'}<span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{(p.modeloPrecio ?? 'fijo') === 'por_medico' ? '/médico' : (p.modeloPrecio ?? 'fijo') === 'por_cama' ? ' base' : '/mes'}</span></div>
            </div>
            {(p.modeloPrecio ?? 'fijo') !== 'fijo' && (
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', background: '#7c3aed12', borderRadius: 6, padding: '2px 7px', alignSelf: 'flex-start' }}>
                {p.modeloPrecio === 'por_medico' ? `Por médico · +${mxn(p.precioPorUnidad ?? 0)} c/u extra` : `Por cama · +${mxn(p.precioPorUnidad ?? 0)} c/cama`}
              </div>
            )}
            {p.descripcion && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.descripcion}</div>}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {p.modulos.map(k => <span key={k} style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', background: '#2563eb15', borderRadius: 6, padding: '2px 7px' }}>{MODULO_LABEL[k] ?? k}</span>)}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <Button size="sm" variant="secondary" onClick={() => setEditar({ id: p.id, nombre: p.nombre, precio: p.precio, modulos: [...p.modulos], descripcion: p.descripcion ?? '', modeloPrecio: p.modeloPrecio ?? 'fijo', precioBase: p.precioBase ?? p.precio, precioPorUnidad: p.precioPorUnidad ?? 0 })}>Editar</Button>
              <button title="Borrar" onClick={() => borrar(p.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: '#dc2626', cursor: 'pointer', padding: '0 10px' }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {paquetes.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <div>Aún no tienes paquetes. Crea el primero, o arranca con unos de ejemplo (los editas luego).</div>
            <Button size="sm" variant="secondary" loading={busy} icon={<Boxes size={14} />} onClick={sugeridos}>Crear paquetes de ejemplo</Button>
          </div>
        )}
      </div>

      {editar && (
        <Modal open onClose={() => setEditar(null)} title={editar.id ? 'Editar paquete' : 'Nuevo paquete'}
          footer={<><Button variant="secondary" onClick={() => setEditar(null)}>Cancelar</Button><Button loading={busy} disabled={!editar.nombre.trim() || editar.modulos.length === 0} onClick={guardar}>Guardar</Button></>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text3)' }}>Nombre</label>
              <input value={editar.nombre} onChange={e => setEditar({ ...editar, nombre: e.target.value })} placeholder="Ej. Consulta, Hospital, Todo…"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }} />
            </div>
            {/* Modelo de cobro */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Modelo de cobro</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {([
                  { v: 'fijo' as const, t: 'Fijo', d: 'Un precio al mes' },
                  { v: 'por_medico' as const, t: 'Por médico', d: 'Consultorio: escala con médicos' },
                  { v: 'por_cama' as const, t: 'Por cama', d: 'Hospital: escala con el tamaño' },
                ]).map(op => {
                  const activo = editar.modeloPrecio === op.v
                  return (
                    <button key={op.v} onClick={() => setEditar({ ...editar, modeloPrecio: op.v })}
                      style={{ padding: 10, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        background: activo ? '#7c3aed15' : 'transparent', border: activo ? '1px solid #7c3aed' : '1px solid var(--border)', color: activo ? '#7c3aed' : 'var(--text2)' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{op.t}</div>
                      <div style={{ fontSize: 10.5, marginTop: 2, lineHeight: 1.3 }}>{op.d}</div>
                    </button>
                  )
                })}
              </div>
            </div>
            {/* Precios según el modelo */}
            {editar.modeloPrecio === 'fijo' ? (
              <div style={{ maxWidth: 180 }}>
                <label style={{ fontSize: 12, color: 'var(--text3)' }}>Precio $/mes</label>
                <input type="number" min={0} value={editar.precio} onChange={e => setEditar({ ...editar, precio: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text3)' }}>{editar.modeloPrecio === 'por_medico' ? 'Precio base (1 médico)' : 'Precio base (hospital)'}</label>
                  <input type="number" min={0} value={editar.precioBase} onChange={e => setEditar({ ...editar, precioBase: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text3)' }}>{editar.modeloPrecio === 'por_medico' ? '+ por médico extra' : '+ por cama'}</label>
                  <input type="number" min={0} value={editar.precioPorUnidad} onChange={e => setEditar({ ...editar, precioPorUnidad: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }} />
                </div>
                <div style={{ gridColumn: '1/-1', fontSize: 11.5, color: 'var(--text3)', background: 'var(--s2)', borderRadius: 8, padding: '8px 10px' }}>
                  Ejemplo: {editar.modeloPrecio === 'por_medico'
                    ? explicarPrecio({ modeloPrecio: 'por_medico', precioBase: editar.precioBase, precioPorUnidad: editar.precioPorUnidad }, { medicos: 3, camas: 0 })
                    : explicarPrecio({ modeloPrecio: 'por_cama', precioBase: editar.precioBase, precioPorUnidad: editar.precioPorUnidad }, { medicos: 0, camas: 20 })}
                </div>
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text3)' }}>Descripción (opcional)</label>
              <input value={editar.descripcion} onChange={e => setEditar({ ...editar, descripcion: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Módulos incluidos</label>
              <div style={{ display: 'grid', gap: 4 }}>
                {MODULOS.map(m => (
                  <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', padding: '3px 0' }}>
                    <input type="checkbox" checked={editar.modulos.includes(m.key)} onChange={() => toggle(m.key)} />
                    <span style={{ fontWeight: 600 }}>{m.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {m.descripcion}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
