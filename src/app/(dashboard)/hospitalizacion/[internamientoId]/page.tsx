'use client'
// ══════════════════════════════════════════════════════════════
// Ficha del EPISODIO de internamiento: datos administrativos + hilo de notas
// (ingreso → evoluciones → egreso) + acciones (nueva evolución, egresar).
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useToast } from '@/context/ToastContext'
import { getInternamiento, egresarInternamiento } from '@/lib/hospital/firestore'
import { getNotas } from '@/lib/expediente/firestore'
import { diasEstancia, TIPO_EGRESO_LABEL, type Internamiento, type TipoEgreso } from '@/types/hospital'
import { TIPO_NOTA_LABEL, type NotaMedica } from '@/types/expediente'
import { Modal, Button, Spinner } from '@/components/ui'
import { ArrowLeft, BedDouble, Stethoscope, Clock, FileText, Plus, LogOut, ClipboardList, Pill } from 'lucide-react'

const TIPO_EGRESO_OPCIONES: TipoEgreso[] = ['mejoria', 'maximo_beneficio', 'voluntaria', 'traslado', 'defuncion', 'otro']

export default function EpisodioPage() {
  const { internamientoId } = useParams<{ internamientoId: string }>()
  const router = useRouter()
  const { clinicId } = useClinic()
  const { toast } = useToast()

  const [inter, setInter] = useState<Internamiento | null>(null)
  const [notas, setNotas] = useState<NotaMedica[]>([])
  const [loading, setLoading] = useState(true)
  const [modalEgreso, setModalEgreso] = useState(false)
  const [tipoEgreso, setTipoEgreso] = useState<TipoEgreso>('mejoria')
  const [resumenEgreso, setResumenEgreso] = useState('')
  const [egresando, setEgresando] = useState(false)

  useEffect(() => {
    if (!clinicId || !internamientoId) return
    getInternamiento(clinicId, internamientoId).then(async (i) => {
      setInter(i)
      if (i) {
        const todas = await getNotas(clinicId, i.pacienteId).catch(() => [] as NotaMedica[])
        setNotas(todas.filter(n => n.internamientoId === internamientoId))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clinicId, internamientoId])

  const notasEpisodio = useMemo(() => [...notas].sort((a, b) => (a.fechaConsulta < b.fechaConsulta ? 1 : -1)), [notas])
  const tieneIngreso = notas.some(n => n.tipo === 'ingreso')

  const nuevaNota = (tipo: 'ingreso' | 'evolucion' | 'egreso') => {
    if (!inter) return
    router.push(`/consulta/${inter.pacienteId}?tipo=${tipo}&internamiento=${internamientoId}`)
  }

  const confirmarEgreso = async () => {
    if (!clinicId || !internamientoId) return
    setEgresando(true)
    try {
      await egresarInternamiento(clinicId, internamientoId, { tipoEgreso, resumenEgreso: resumenEgreso.trim() || undefined })
      toast('Paciente egresado del censo', 'success')
      setModalEgreso(false)
      // Encadena a la nota de egreso (documento NOM-004)
      nuevaNota('egreso')
    } catch {
      toast('No se pudo egresar', 'error')
      setEgresando(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
  if (!inter) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 40, textAlign: 'center' }}>
      <p style={{ color: 'var(--text3)' }}>No se encontró el episodio.</p>
      <Button variant="secondary" onClick={() => router.push('/hospitalizacion')}>Volver al censo</Button>
    </div>
  )

  const egresado = inter.estado === 'egresado'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 4px 40px' }}>
      <button onClick={() => router.push('/hospitalizacion')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
        <ArrowLeft size={15} /> Censo
      </button>

      {/* Cabecera del episodio */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--s1)', padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{inter.pacienteNombre}</h1>
            <div style={{ fontSize: 13.5, color: 'var(--text2)', marginTop: 3 }}>{inter.diagnosticoIngreso}{inter.cie10 ? ` (${inter.cie10})` : ''}</div>
          </div>
          <span style={{
            fontSize: 11.5, fontWeight: 700, padding: '4px 12px', borderRadius: 100,
            background: egresado ? 'var(--s2)' : 'rgba(13,148,136,.15)', color: egresado ? 'var(--text3)' : '#0d9488',
            border: `1px solid ${egresado ? 'var(--border)' : 'rgba(13,148,136,.4)'}`,
          }}>{egresado ? 'Egresado' : 'Internado'}</span>
        </div>

        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14, fontSize: 13, color: 'var(--text2)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><BedDouble size={14} /> {inter.servicio}{inter.cama ? ` · Cama ${inter.cama}` : ''}</span>
          {inter.medicoTratanteNombre && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Stethoscope size={14} /> {inter.medicoTratanteNombre}</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={14} /> {diasEstancia(inter)} días de estancia</span>
          <span>Ingreso: {new Date(inter.fechaIngreso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          {egresado && inter.fechaEgreso && <span>Egreso: {new Date(inter.fechaEgreso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}{inter.tipoEgreso ? ` · ${TIPO_EGRESO_LABEL[inter.tipoEgreso]}` : ''}</span>}
        </div>
        {inter.motivoIngreso && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}><strong>Motivo:</strong> {inter.motivoIngreso}</div>}
      </div>

      {/* Acciones */}
      {!egresado && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {!tieneIngreso && <Button icon={<Plus size={15} />} onClick={() => nuevaNota('ingreso')}>Nota de ingreso</Button>}
          <Button variant={tieneIngreso ? 'primary' : 'secondary'} icon={<Plus size={15} />} onClick={() => nuevaNota('evolucion')}>Nota de evolución</Button>
          <Button variant="secondary" icon={<LogOut size={15} />} onClick={() => setModalEgreso(true)}>Egresar</Button>
        </div>
      )}

      {/* Hilo de notas del episodio */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 12px' }}>
        Notas del internamiento ({notasEpisodio.length})
      </div>
      {notasEpisodio.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '16px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
          Aún no hay notas. Empieza con la <strong>Nota de ingreso</strong>.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {notasEpisodio.map(n => (
            <button key={n.id} onClick={() => router.push(`/nota/${inter.pacienteId}/${n.id}`)}
              style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--s1)', cursor: 'pointer' }}>
              <FileText size={16} style={{ color: 'var(--nexus,#3d5afe)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{TIPO_NOTA_LABEL[n.tipo] ?? n.tipo}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(n.fechaConsulta).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}{n.estado === 'firmada' ? ' · firmada' : ' · borrador'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {n.medicamentos?.length > 0 && <Pill size={14} style={{ color: 'var(--text3)' }} />}
                {n.estudiosOrden?.length ? <ClipboardList size={14} style={{ color: 'var(--text3)' }} /> : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal de egreso */}
      <Modal
        open={modalEgreso}
        onClose={() => setModalEgreso(false)}
        title="Egresar paciente"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalEgreso(false)}>Cancelar</Button>
            <Button onClick={confirmarEgreso} loading={egresando}>Egresar y escribir nota</Button>
          </>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Tipo de egreso</label>
            <select className="w-full rounded-md border px-2.5 py-2 text-sm bg-transparent" value={tipoEgreso} onChange={e => setTipoEgreso(e.target.value as TipoEgreso)}>
              {TIPO_EGRESO_OPCIONES.map(t => <option key={t} value={t}>{TIPO_EGRESO_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>Resumen del egreso (opcional)</label>
            <textarea className="w-full rounded-md border px-2.5 py-2 text-sm bg-transparent" rows={3} placeholder="Evolución y condición al alta" value={resumenEgreso} onChange={e => setResumenEgreso(e.target.value)} />
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text3)' }}>Al confirmar, el paciente sale del censo y se abre la <strong>Nota de egreso</strong> para completar el documento (NOM-004).</p>
        </div>
      </Modal>
    </div>
  )
}
