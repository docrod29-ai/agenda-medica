'use client'
/**
 * LOS ESTUDIOS QUE SUBIÓ EL PACIENTE, EN LA PESTAÑA DE LABORATORIOS — D-058.
 *
 * Aparecen APARTE de los paneles, con su procedencia a la vista («aportado por
 * el paciente, sin revisar»): mezclarlos con lo que el médico ya validó haría
 * pasar por revisado lo que nadie miró. Tres acciones: abrir (URL firmada del
 * servidor), leer con la IA (el servidor toma el archivo del bucket y entra al
 * mismo flujo de revisión que un PDF adjuntado por el médico) y marcar
 * revisado (cierra la tarea, con quién).
 */
import { useEffect, useState } from 'react'
import { FileText, Image as ImageIcon, ExternalLink, Sparkles, Check, Loader2 } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { fechaCorta } from '@/lib/formato/fecha'
import { useAuth } from '@/hooks/useAuth'
import { listarEstudiosAportados, urlDelEstudio, marcarEstudioRevisado, type EstudioConRevision } from '@/lib/expediente/estudios-aportados-cliente'

export function EstudiosAportados({ clinicId, patientId, onLeerConIA, recarga }: {
  clinicId: string
  patientId: string
  /** Manda la referencia al flujo de visión del panel; devuelve cuando terminó. */
  onLeerConIA?: (e: EstudioConRevision) => Promise<void>
  /** Cambia para volver a cargar (p. ej. tras guardar un panel). */
  recarga?: number
}) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [lista, setLista] = useState<EstudioConRevision[] | null>(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState('')

  const cargar = () => listarEstudiosAportados(clinicId, patientId)
    .then(l => { setLista(l); setError('') })
    .catch(e => { console.error('[estudios-aportados] no se pudo leer', e); setError('No se pudieron cargar los estudios que subió el paciente. Esto no quiere decir que no haya.') })
  useEffect(() => {
    if (!clinicId || !patientId) return
    const t = setTimeout(() => { void cargar() }, 0)
    return () => clearTimeout(t)
  }, [clinicId, patientId, recarga]) // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = async (e: EstudioConRevision) => {
    setOcupado(e.id + 'abrir')
    try {
      const { url } = await urlDelEstudio(clinicId, patientId, e.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) { toast(err instanceof Error ? err.message : 'No se pudo abrir', 'error') }
    finally { setOcupado('') }
  }
  const revisar = async (e: EstudioConRevision) => {
    setOcupado(e.id + 'revisar')
    try {
      const r = await marcarEstudioRevisado(clinicId, e, user?.displayName || user?.email || 'médico')
      if (!r.ok) { toast(r.motivo, 'error'); return }
      toast('Marcado como revisado', 'success'); await cargar()
    } finally { setOcupado('') }
  }
  const leer = async (e: EstudioConRevision) => {
    if (!onLeerConIA) return
    setOcupado(e.id + 'ia')
    try { await onLeerConIA(e) } finally { setOcupado('') }
  }

  if (error) return <p role="status" style={{ margin: 0, fontSize: 12, color: 'var(--text3)' }}>{error}</p>
  if (!lista || lista.length === 0) return null

  return (
    <section aria-label="Estudios aportados por el paciente" style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, background: 'var(--s1)' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Aportados por el paciente</div>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
        Subidos desde el portal. Sin revisar hasta que tú lo digas: ábrelo, léelo con la IA si es laboratorio y confirma los valores, o márcalo revisado.
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map(e => {
          const esPdf = e.contentType === 'application/pdf'
          return (
            <li key={e.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              {esPdf ? <FileText size={15} aria-hidden="true" /> : <ImageIcon size={15} aria-hidden="true" />}
              <span style={{ flex: '1 1 180px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)', fontSize: 14 }}>{e.nombre}</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{fechaCorta(String(e.subidoEn))}</span>
              <span className="nx-estado" style={{ ['--estado-tono' as string]: e.revision === 'revisado' ? 'var(--green)' : 'var(--amber)' }}>
                {e.revision === 'revisado' ? 'Revisado' : 'Sin revisar'}
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm" onClick={() => abrir(e)} disabled={!!ocupado} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {ocupado === e.id + 'abrir' ? <Loader2 size={13} className="spin" /> : <ExternalLink size={13} />} Abrir
                </button>
                {onLeerConIA && (
                  <button type="button" className="btn btn-sm" onClick={() => leer(e)} disabled={!!ocupado} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {ocupado === e.id + 'ia' ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} Leer con IA
                  </button>
                )}
                {e.revision !== 'revisado' && (
                  <button type="button" className="btn btn-sm" onClick={() => revisar(e)} disabled={!!ocupado} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {ocupado === e.id + 'revisar' ? <Loader2 size={13} className="spin" /> : <Check size={13} />} Marcar revisado
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
