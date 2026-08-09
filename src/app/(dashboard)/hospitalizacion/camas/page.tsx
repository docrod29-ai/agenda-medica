'use client'
// ══════════════════════════════════════════════════════════════
// Tablero de camas — inventario por servicio + % de ocupación + camas libres.
// Cruza el catálogo de camas con el censo activo. El admin gestiona el inventario.
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react'
import { activable } from '@/lib/ui/activable'
import { useRouter } from 'next/navigation'
import { useSmartBack } from '@/hooks/useSmartBack'
import { useClinic } from '@/context/ClinicContext'
import { suscribirCenso, getCamas, crearCama, actualizarCamaEstado, borrarCama } from '@/lib/hospital/firestore'
import { SERVICIOS_HOSPITAL, ESTADO_CAMA_LABEL, type Internamiento, type Cama, type EstadoCama } from '@/types/hospital'
import { Modal, Button, Spinner } from '@/components/ui'
import { mismaCama } from '@/lib/hospital/cama'
import { contarCamas, siguientes, POLITICA_CAMAS_SEGURA } from '@/lib/hospital/estados-cama'
import { ArrowLeft, BedDouble, Plus, Trash2, AlertTriangle } from 'lucide-react'

// ICU-002c: siete estados. El `Record` obliga a tsc a completarlos, que es cómo
// este mapa se encontró al ampliar el tipo. Semántica del color:
//   verde  = disponible · azul = con paciente · ámbar = transitorio ·
//   rojo   = no utilizable · morado = precaución de contacto.
const COLOR: Record<EstadoCama, string> = {
  libre: '#0d9488', ocupada: '#3D5AFE', bloqueada: '#dc2626', limpieza: '#d97706',
  reservada: '#7c3aed', mantenimiento: '#dc2626', aislamiento: '#a21caf',
  lista: '#0d9488', limpieza_aislamiento: '#a21caf',
}
// DECISIÓN DEL DR. (2026-07-30): el default de NexusMED es limpieza terminal
// requerida tras alta o traslado — ocupada → limpieza → lista → libre, y nunca
// ocupada → libre por omisión. Cada hospital puede configurarlo; mientras no
// haya pantalla de configuración, se usa el default seguro.
const POLITICA = POLITICA_CAMAS_SEGURA

const inputCls = 'w-full rounded-md border px-2.5 py-2 text-sm bg-transparent'

export default function CamasPage() {
  const router = useRouter()
  const volver = useSmartBack('/hospitalizacion')
  const { clinicId, role } = useClinic()
  const esAdmin = role === 'admin' || role === 'medico'
  const [censo, setCenso] = useState<Internamiento[]>([])
  const [camas, setCamas] = useState<Cama[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ servicio: SERVICIOS_HOSPITAL[0], etiqueta: '', tipo: '' })
  const [busy, setBusy] = useState(false)

  // Censo EN VIVO: un ingreso/egreso/traslado desde otra sesión se refleja al
  // instante en la ocupación del tablero (antes era una lectura única al montar →
  // la "capacidad disponible" quedaba desfasada, justo el dato para aceptar un ingreso).
  const recargarCamas = () => { if (clinicId) getCamas(clinicId).then(setCamas).catch(() => {}) }
  useEffect(() => {
    if (!clinicId) return
    getCamas(clinicId).then(setCamas).catch(() => {})
    const unsub = suscribirCenso(clinicId, (c) => { setCenso(c); setLoading(false) })
    return unsub
  }, [clinicId])

  /**
   * ¿La cama está ocupada por un internamiento activo?
   *
   * El cruce se hacía con `===` exacto sobre texto libre: bastaba que enfermería
   * escribiera "302 A" en vez de "302-A" para que la cama saliera LIBRE con el
   * paciente dentro. Ver `mismaCama`, que normaliza solo lo que varía al teclear.
   */
  const ocupante = (cama: Cama) => censo.find(i => i.servicio === cama.servicio && mismaCama(i.cama, cama.etiqueta))

  /**
   * Internamientos activos que NO casan con ninguna cama del inventario.
   *
   * Es el hallazgo que hay que enseñar, no esconder: cada uno de estos pacientes
   * está ocupando una cama real que el tablero cuenta como DISPONIBLE. Quien mira
   * la ocupación para decidir si acepta un ingreso está viendo capacidad que no
   * existe. Normalizar reduce los casos; enseñarlos cierra el resto (cama sin
   * capturar, cama que no está dada de alta en el inventario, servicio mal puesto).
   */
  const sinCamaEnInventario = useMemo(
    () => censo.filter(i => !camas.some(c => c.servicio === i.servicio && mismaCama(i.cama, c.etiqueta))),
    [censo, camas],
  )

  /**
   * Camas con MÁS DE UN ocupante activo. El tablero usaba `find` (primer match) y
   * escondía al segundo paciente. El alta del servidor ya impide crear estas
   * colisiones; esto muestra las que pudieran haber quedado de antes en vez de
   * ocultarlas.
   */
  const conflictos = useMemo(
    () => camas
      .map(c => ({ cama: c, ocupantes: censo.filter(i => i.servicio === c.servicio && mismaCama(i.cama, c.etiqueta)) }))
      .filter(x => x.ocupantes.length > 1),
    [camas, censo],
  )

  const porServicio = useMemo(() => {
    const m = new Map<string, Cama[]>()
    for (const c of camas) { if (!m.has(c.servicio)) m.set(c.servicio, []); m.get(c.servicio)!.push(c) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [camas])

  // ICU-P2-1: el conteo se delega al motor de estados. Antes se sumaba a «libres»
  // toda cama que no estuviera en `ocupada`, así que una cama en limpieza, en
  // mantenimiento o bloqueada aparecía como disponible: quien lee «4 libres» y
  // sólo puede usar 1 decide un ingreso sobre un número que no existe.
  const conteo = useMemo(
    () => contarCamas(camas.map(c => ({ estado: c.estado, hayOcupante: !!ocupante(c) }))),
    [camas, censo],   // eslint-disable-line react-hooks/exhaustive-deps
  )
  const totalCamas = conteo.total
  const totalOcupadas = conteo.ocupadas
  const pctGlobal = totalCamas ? Math.round((totalOcupadas / totalCamas) * 100) : 0

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 4px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
          <ArrowLeft size={15} /> Atrás
        </button>
        {esAdmin && <Button size="sm" icon={<Plus size={14} />} onClick={() => { setForm({ servicio: SERVICIOS_HOSPITAL[0], etiqueta: '', tipo: '' }); setModal(true) }}>Agregar cama</Button>}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <BedDouble size={22} style={{ color: 'var(--nexus,#3D5AFE)' }} /> Tablero de camas
      </h1>
      {sinCamaEnInventario.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'color-mix(in srgb, var(--red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)',
          borderRadius: 12, padding: '13px 15px', margin: '0 0 16px',
        }}>
          <AlertTriangle size={17} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}>
            <strong>{sinCamaEnInventario.length} paciente{sinCamaEnInventario.length !== 1 ? 's' : ''} internado{sinCamaEnInventario.length !== 1 ? 's' : ''} sin cama del inventario.</strong>{' '}
            Ocupan una cama real que este tablero está contando como disponible. Revisa la cama
            capturada en el episodio o da de alta la cama en el inventario.
            <div style={{ marginTop: 7, fontSize: 12.5, color: 'var(--text2)' }}>
              {sinCamaEnInventario.map(i => (
                <div key={i.id}>
                  {i.pacienteNombre} · {i.servicio}{i.cama ? ` · cama capturada: "${i.cama}"` : ' · sin cama capturada'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {conflictos.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'color-mix(in srgb, var(--red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)',
          borderRadius: 12, padding: '13px 15px', margin: '0 0 16px',
        }}>
          <AlertTriangle size={17} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}>
            <strong>{conflictos.length} cama{conflictos.length !== 1 ? 's' : ''} con más de un paciente.</strong>{' '}
            Dos internamientos activos comparten la misma cama. Traslada a uno a otra cama.
            <div style={{ marginTop: 7, fontSize: 12.5, color: 'var(--text2)' }}>
              {conflictos.map(({ cama, ocupantes }) => (
                <div key={cama.id}>
                  {cama.servicio} · {cama.etiqueta}: {ocupantes.map(o => o.pacienteNombre).join(', ')}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {totalCamas > 0 && <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 20px' }}>Ocupación global: <strong style={{ color: pctGlobal >= 85 ? '#dc2626' : 'var(--text)' }}>{pctGlobal}%</strong> · {totalOcupadas}/{totalCamas} camas · <strong style={{ color: 'var(--text2)' }}>{conteo.disponibles} libres</strong>
        {conteo.reservadas > 0 && ` · ${conteo.reservadas} reservada${conteo.reservadas !== 1 ? 's' : ''}`}
        {conteo.condicionadas > 0 && ` · ${conteo.condicionadas} en aislamiento`}
        {conteo.noDisponibles > 0 && ` · ${conteo.noDisponibles} fuera de servicio`}</p>}

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        : totalCamas === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: 24, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
            No hay camas en el inventario. {esAdmin ? 'Agrega las camas de cada servicio para ver la ocupación.' : 'El administrador aún no configura las camas.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {porServicio.map(([servicio, lista]) => {
              const cs = contarCamas(lista.map(c => ({ estado: c.estado, hayOcupante: !!ocupante(c) })))
              const occ = cs.ocupadas
              const pct = Math.round((occ / lista.length) * 100)
              return (
                <div key={servicio}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{servicio}</span>
                    <span style={{ fontSize: 12, color: pct >= 85 ? '#dc2626' : 'var(--text3)', fontWeight: 600 }}>{occ}/{lista.length} · {pct}%</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))', gap: 8 }}>
                    {lista.map(c => {
                      const oc = ocupante(c)
                      const estado: EstadoCama = oc ? 'ocupada' : c.estado
                      const col = COLOR[estado]
                      return (
                        <div key={c.id} {...(oc ? activable(() => router.push(`/hospitalizacion/${oc.id}`), { etiqueta: `Abrir el internamiento de la cama ${c.etiqueta}` }) : {})} style={{ padding: 10, borderRadius: 10, border: `1px solid color-mix(in srgb, ${col} 33%, transparent)`, background: col + '10', cursor: oc ? 'pointer' : 'default' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: col }}>{c.etiqueta}</span>
                            <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: col }}>{ESTADO_CAMA_LABEL[estado]}</span>
                          </div>
                          {oc ? <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{oc.pacienteNombre}</div>
                            : <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{c.tipo || 'General'}</div>}
                          {esAdmin && !oc && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
                              <select value={c.estado} onChange={async e => { if (!clinicId) return; await actualizarCamaEstado(clinicId, c.id, e.target.value as EstadoCama); recargarCamas() }} style={{ fontSize: 10.5, padding: '2px 4px', borderRadius: 5, background: 'var(--s2)', color: 'var(--text2)', border: '1px solid var(--border)' }} onClick={ev => ev.stopPropagation()}>
                                {[c.estado, ...siguientes(c.estado, POLITICA)].filter(s => s !== 'ocupada')
                                  .map(s => <option key={s} value={s}>{ESTADO_CAMA_LABEL[s]}</option>)}
                              </select>
                              <button title="Eliminar cama" onClick={async ev => { ev.stopPropagation(); if (!clinicId) return; await borrarCama(clinicId, c.id); recargarCamas() }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2 }}><Trash2 size={12} /></button>
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
          try { await crearCama(clinicId, { servicio: form.servicio, etiqueta: form.etiqueta.trim(), tipo: form.tipo.trim() || undefined }); setModal(false); recargarCamas() } finally { setBusy(false) }
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
