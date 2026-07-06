'use client'
// ══════════════════════════════════════════════════════════════
// CENSO hospitalario — tablero de pacientes internados (episodios activos).
// Punto de entrada del módulo de hospitalización.
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { auth } from '@/lib/firebase'
import { getPatients } from '@/lib/firestore'
import { getCenso, crearInternamiento } from '@/lib/hospital/firestore'
import { SERVICIOS_HOSPITAL, diasEstancia, type Internamiento } from '@/types/hospital'
import type { Patient } from '@/types'
import { Modal, Button, Spinner, EmptyState } from '@/components/ui'
import { Cie10Autocomplete } from '@/components/Cie10Autocomplete'
import { BedDouble, Plus, Stethoscope, Clock, Search } from 'lucide-react'

const inputCls = 'w-full rounded-md border px-2.5 py-2 text-sm bg-transparent'

export default function CensoPage() {
  const router = useRouter()
  const { clinicId } = useClinic()
  const { config } = useConfig()
  const { toast } = useToast()

  const [censo, setCenso] = useState<Internamiento[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Alta / ingreso
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [buscar, setBuscar] = useState('')
  const [pac, setPac] = useState<Patient | null>(null)
  const [servicio, setServicio] = useState(SERVICIOS_HOSPITAL[0])
  const [cama, setCama] = useState('')
  const [dxIngreso, setDxIngreso] = useState('')
  const [cie10, setCie10] = useState('')
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (!clinicId) return
    getCenso(clinicId).then(setCenso).catch(() => {}).finally(() => setLoading(false))
  }, [clinicId])

  const abrirModal = () => {
    setModal(true)
    if (clinicId && pacientes.length === 0) getPatients(clinicId).then(setPacientes).catch(() => {})
  }

  const pacientesFiltrados = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    if (!q) return pacientes.slice(0, 8)
    return pacientes.filter(p => (p.nombre || '').toLowerCase().includes(q) || (p.telefono || '').includes(q)).slice(0, 8)
  }, [pacientes, buscar])

  const ingresar = async () => {
    if (!clinicId || !pac) { toast('Selecciona el paciente', 'error'); return }
    if (!dxIngreso.trim()) { toast('Escribe el diagnóstico de ingreso', 'error'); return }
    setGuardando(true)
    try {
      const id = await crearInternamiento(clinicId, {
        clinicId,
        pacienteId: pac.id,
        pacienteNombre: pac.nombre || '',
        servicio,
        cama: cama.trim(),
        medicoTratanteId: auth.currentUser?.uid ?? '',
        medicoTratanteNombre: config?.nombreMedico ?? '',
        diagnosticoIngreso: dxIngreso.trim(),
        cie10: cie10 || undefined,
        motivoIngreso: motivo.trim(),
        fechaIngreso: new Date().toISOString(),
        creadoPor: auth.currentUser?.uid ?? '',
      })
      toast('Paciente ingresado al censo', 'success')
      router.push(`/hospitalizacion/${id}`)
    } catch (e) {
      const msg = e instanceof Error && e.message.startsWith('DUPLICADO')
        ? 'Este paciente ya tiene un internamiento activo. Búscalo en el censo.'
        : 'No se pudo registrar el ingreso'
      toast(msg, 'error')
      setGuardando(false)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 4px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BedDouble size={22} style={{ color: 'var(--nexus, #3d5afe)' }} /> Censo hospitalario
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => router.push('/hospitalizacion/camas')}>Tablero de camas</Button>
          <Button variant="secondary" onClick={() => router.push('/hospitalizacion/indicadores')}>Indicadores</Button>
          <Button icon={<Plus size={16} />} onClick={abrirModal}>Nuevo ingreso</Button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 20px' }}>
        Pacientes internados ahora mismo. Abre un episodio para ver ingreso, evoluciones y egreso.
      </p>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : censo.length === 0 ? (
        <EmptyState icon={<BedDouble size={28} />} title="Sin pacientes internados" description="Cuando registres un ingreso, aparecerá aquí el censo." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {censo.map(i => (
            <button
              key={i.id}
              onClick={() => router.push(`/hospitalizacion/${i.id}`)}
              style={{
                textAlign: 'left', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center',
                padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--s1)', cursor: 'pointer',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{i.pacienteNombre}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 2 }}>
                  {i.diagnosticoIngreso}{i.cie10 ? ` (${i.cie10})` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BedDouble size={12} /> {i.servicio}{i.cama ? ` · Cama ${i.cama}` : ''}</span>
                  {i.medicoTratanteNombre && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Stethoscope size={12} /> {i.medicoTratanteNombre}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--nexus,#3d5afe)' }}>{diasEstancia(i)}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}><Clock size={10} /> días</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal de ingreso */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Registrar ingreso hospitalario"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={ingresar} loading={guardando} disabled={!pac || !dxIngreso.trim()}>Ingresar al censo</Button>
          </>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Paciente */}
          {pac ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--s2)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{pac.nombre}{pac.edad ? ` · ${pac.edad} a` : ''}</span>
              <button onClick={() => setPac(null)} style={{ background: 'none', border: 'none', color: 'var(--nexus,#3d5afe)', cursor: 'pointer', fontSize: 12 }}>Cambiar</button>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Paciente</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text3)' }} />
                <input className={inputCls} style={{ paddingLeft: 30 }} placeholder="Busca por nombre o teléfono" value={buscar} onChange={e => setBuscar(e.target.value)} />
              </div>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {pacientesFiltrados.map(p => (
                  <button key={p.id} onClick={() => setPac(p)} style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--s1)', cursor: 'pointer', fontSize: 13 }}>
                    {p.nombre}{p.edad ? ` · ${p.edad} a` : ''}{p.sexo ? ` · ${p.sexo}` : ''}
                  </button>
                ))}
                {pacientesFiltrados.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', padding: 6 }}>Sin coincidencias. Registra al paciente primero en «Pacientes».</div>}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Servicio</label>
              <select className={inputCls} value={servicio} onChange={e => setServicio(e.target.value)}>
                {SERVICIOS_HOSPITAL.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Cama</label>
              <input className={inputCls} placeholder="ej. 302-A" value={cama} onChange={e => setCama(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Diagnóstico de ingreso</label>
            <Cie10Autocomplete value={dxIngreso} onChange={(desc, code) => { setDxIngreso(desc); if (code) setCie10(code) }} placeholder="Neumonía, J18, sepsis…" />
          </div>

          <div>
            <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Motivo de ingreso (opcional)</label>
            <textarea className={inputCls} rows={2} placeholder="Breve resumen del padecimiento que motiva el internamiento" value={motivo} onChange={e => setMotivo(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
