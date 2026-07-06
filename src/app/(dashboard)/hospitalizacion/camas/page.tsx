'use client'
// ══════════════════════════════════════════════════════════════
// Tablero de camas — inventario por servicio + % de ocupación + camas libres.
// Cruza el catálogo de camas con el censo activo. El admin gestiona el inventario.
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { getCenso, getCamas, crearCama, actualizarCamaEstado, borrarCama } from '@/lib/hospital/firestore'
import { SERVICIOS_HOSPITAL, ESTADO_CAMA_LABEL, type Internamiento, type Cama, type EstadoCama } from '@/types/hospital'
import { Modal, Button, Spinner } from '@/components/ui'
import { ArrowLeft, BedDouble, Plus, Trash2 } from 'lucide-react'

const COLOR: Record<EstadoCama, string> = { libre: '#0d9488', ocupada: '#3d5afe', bloqueada: '#dc2626', limpieza: '#d97706' }
const inputCls = 'w-full rounded-md border px-2.5 py-2 text-sm bg-transparent'

export default function CamasPage() {
  const router = useRouter()
  const { clinicId, role } = useClinic()
  const esAdmin = role === 'admin' || role === 'medico'
  const [censo, setCenso] = useState<Internamiento[]>([])
  const [camas, setCamas] = useState<Cama[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ servicio: SERVICIOS_HOSPITAL[0], etiqueta: '', tipo: '' })
  const [busy, setBusy] = useState(false)

  const cargar = () => {
    if (!clinicId) return
    Promise.all([getCenso(clinicId), getCamas(clinicId)]).then(([c, cm]) => { setCenso(c); setCamas(cm) }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(cargar, [clinicId])

  // ¿La cama está ocupada por un internamiento activo?
  const ocupante = (cama: Cama) => censo.find(i => i.servicio === cama.servicio && (i.cama || '').trim() === cama.etiqueta.trim())

  const porServicio = useMemo(() => {
    const m = new Map<string, Cama[]>()
    for (const c of camas) { if (!m.has(c.servicio)) m.set(c.servicio, []); m.get(c.servicio)!.push(c) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [camas])

  const totalCamas = camas.length
  const totalOcupadas = camas.filter(c => ocupante(c) || c.estado === 'ocupada').length
  const pctGlobal = totalCamas ? Math.round((totalOcupadas / totalCamas) * 100) : 0

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 4px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => router.push('/hospitalizacion')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
          <ArrowLeft size={15} /> Censo
        </button>
        {esAdmin && <Button size="sm" icon={<Plus size={14} />} onClick={() => { setForm({ servicio: SERVICIOS_HOSPITAL[0], etiqueta: '', tipo: '' }); setModal(true) }}>Agregar cama</Button>}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <BedDouble size={22} style={{ color: 'var(--nexus,#3d5afe)' }} /> Tablero de camas
      </h1>
      {totalCamas > 0 && <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 20px' }}>Ocupación global: <strong style={{ color: pctGlobal >= 85 ? '#dc2626' : 'var(--text)' }}>{pctGlobal}%</strong> · {totalOcupadas}/{totalCamas} camas · {totalCamas - totalOcupadas} libres</p>}

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        : totalCamas === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: 24, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
            No hay camas en el inventario. {esAdmin ? 'Agrega las camas de cada servicio para ver la ocupación.' : 'El administrador aún no configura las camas.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {porServicio.map(([servicio, lista]) => {
              const occ = lista.filter(c => ocupante(c) || c.estado === 'ocupada').length
              const pct = Math.round((occ / lista.length) * 100)
              return (
                <div key={servicio}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{servicio}</span>
                    <span style={{ fontSize: 12, color: pct >= 85 ? '#dc2626' : 'var(--text3)', fontWeight: 600 }}>{occ}/{lista.length} · {pct}%</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {lista.map(c => {
                      const oc = ocupante(c)
                      const estado: EstadoCama = oc ? 'ocupada' : c.estado
                      const col = COLOR[estado]
                      return (
                        <div key={c.id} onClick={() => oc && router.push(`/hospitalizacion/${oc.id}`)} style={{ padding: 10, borderRadius: 10, border: `1px solid ${col}55`, background: col + '10', cursor: oc ? 'pointer' : 'default' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: col }}>{c.etiqueta}</span>
                            <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: col }}>{ESTADO_CAMA_LABEL[estado]}</span>
                          </div>
                          {oc ? <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{oc.pacienteNombre}</div>
                            : <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{c.tipo || 'General'}</div>}
                          {esAdmin && !oc && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
                              <select value={c.estado} onChange={async e => { if (!clinicId) return; await actualizarCamaEstado(clinicId, c.id, e.target.value as EstadoCama); cargar() }} style={{ fontSize: 10.5, padding: '2px 4px', borderRadius: 5, background: 'var(--s2)', color: 'var(--text2)', border: '1px solid var(--border)' }} onClick={ev => ev.stopPropagation()}>
                                {(['libre', 'bloqueada', 'limpieza'] as EstadoCama[]).map(s => <option key={s} value={s}>{ESTADO_CAMA_LABEL[s]}</option>)}
                              </select>
                              <button title="Eliminar cama" onClick={async ev => { ev.stopPropagation(); if (!clinicId) return; await borrarCama(clinicId, c.id); cargar() }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2 }}><Trash2 size={12} /></button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {/* Agregar cama */}
      <Modal open={modal} onClose={() => setModal(false)} title="Agregar cama"
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button loading={busy} disabled={!form.etiqueta.trim()} onClick={async () => {
          if (!clinicId) return; setBusy(true)
          try { await crearCama(clinicId, { servicio: form.servicio, etiqueta: form.etiqueta.trim(), tipo: form.tipo.trim() || undefined }); setModal(false); cargar() } finally { setBusy(false) }
        }}>Agregar</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Servicio</label>
            <select className={inputCls} value={form.servicio} onChange={e => setForm(f => ({ ...f, servicio: e.target.value }))}>{SERVICIOS_HOSPITAL.map(s => <option key={s}>{s}</option>)}</select></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Etiqueta (ej. 302-A)</label>
              <input className={inputCls} value={form.etiqueta} onChange={e => setForm(f => ({ ...f, etiqueta: e.target.value }))} /></div>
            <div><label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Tipo (opcional)</label>
              <input className={inputCls} placeholder="General / UCI / Aislamiento" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} /></div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
