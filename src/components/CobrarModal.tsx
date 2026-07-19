'use client'
/**
 * Modal de cobro rápido — se abre desde la lista de citas o desde finanzas.
 * Pre-llena datos cuando se invoca desde una cita específica.
 */
import { useState } from 'react'
import {
  registrarCobro, METODO_LABEL, CONCEPTO_LABEL,
  type MetodoPago, type ConceptoCobro,
} from '@/lib/cobros'
import { updateAppointment } from '@/lib/firestore'
import { DollarSign } from 'lucide-react'
import { Modal, Button } from '@/components/ui'
import { useToast } from '@/context/ToastContext'

export interface CobrarModalProps {
  clinicId: string
  creadoPor: string
  prefill?: {
    citaId?: string
    patientId?: string
    patientNombre?: string
    medicoId?: string
    medicoNombre?: string
    concepto?: ConceptoCobro
    monto?: number
  }
  onClose: () => void
  onCobrado?: (cobroId: string) => void
}

export function CobrarModal({ clinicId, creadoPor, prefill, onClose, onCobrado }: CobrarModalProps) {
  const { toast } = useToast()
  const [monto, setMonto] = useState(String(prefill?.monto ?? ''))
  const [concepto, setConcepto] = useState<ConceptoCobro>(prefill?.concepto ?? 'consulta')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [descripcion, setDescripcion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    const n = parseFloat(monto)
    // Un reembolso es un cobro NEGATIVO (corrige contabilidad). Para los demás
    // conceptos, el monto debe ser positivo. Antes el modal bloqueaba ≤0 siempre,
    // por lo que la funcionalidad de reembolso (que el tipo sí define) era inalcanzable.
    if (isNaN(n) || n === 0) { toast('Monto inválido', 'error'); return }
    if (concepto === 'reembolso' && n > 0) { toast('Un reembolso debe ser negativo (ej. -500)', 'error'); return }
    if (concepto !== 'reembolso' && n < 0) { toast('El monto debe ser positivo', 'error'); return }
    setGuardando(true)
    try {
      const id = await registrarCobro(clinicId, {
        monto: n,
        metodo,
        concepto,
        descripcion: descripcion.trim() || undefined,
        citaId: prefill?.citaId,
        patientId: prefill?.patientId,
        patientNombre: prefill?.patientNombre,
        medicoId: prefill?.medicoId,
        medicoNombre: prefill?.medicoNombre,
        referenciaExterna: referencia.trim() || undefined,
        notas: notas.trim() || undefined,
        creadoPor,
      })
      // Marca la cita con el cobro para EVITAR DOBLE COBRO (el botón se oculta si ya tiene cobroId).
      let marcadaLaCita = true
      if (prefill?.citaId) {
        try {
          await updateAppointment(clinicId, prefill.citaId, { cobroId: id, cobradoEn: new Date().toISOString() })
        } catch {
          // El cobro YA quedó registrado, pero la cita no se marcó. Como el botón
          // "Cobrar" se oculta justo con ese cobroId, callarlo hacía que el botón
          // siguiera visible y se cobrara dos veces al mismo paciente.
          marcadaLaCita = false
        }
      }
      const monto = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
      if (marcadaLaCita) {
        toast(`Cobro registrado: ${monto}`, 'success')
      } else {
        toast(`Cobro de ${monto} registrado, pero NO se pudo marcar la cita. El botón de cobrar seguirá visible: verifica en Finanzas antes de volver a cobrar.`, 'error')
      }
      onCobrado?.(id)
      onClose()
    } catch (e) {
      console.error(e)
      toast('Error al registrar cobro', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><DollarSign size={18} color="var(--teal)" /> Registrar cobro</span>}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={guardando}>Registrar cobro</Button>
        </>
      )}
    >
        {prefill?.patientNombre && (
          <div style={{ padding: 10, background: 'var(--s)', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
            <div style={{ color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>Paciente</div>
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{prefill.patientNombre}</div>
            {prefill.medicoNombre && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
                Médico: {prefill.medicoNombre}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {/* Monto — grande y prominente */}
          <div>
            <label style={lbl}>Monto MXN *</label>
            <input
              type="number" inputMode="decimal" step="0.01" min="0"
              value={monto} onChange={(e) => setMonto(e.target.value)}
              autoFocus placeholder="0.00"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
                fontSize: 22, fontWeight: 700, textAlign: 'right',
                fontFamily: 'monospace', boxSizing: 'border-box',
              }}
            />
          </div>

          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Concepto</label>
              <select value={concepto} onChange={(e) => setConcepto(e.target.value as ConceptoCobro)} style={inp}>
                {(Object.keys(CONCEPTO_LABEL) as ConceptoCobro[]).map(k => (
                  <option key={k} value={k}>{CONCEPTO_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Método de pago</label>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)} style={inp}>
                {(Object.keys(METODO_LABEL) as MetodoPago[]).map(k => (
                  <option key={k} value={k}>{METODO_LABEL[k]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>Descripción (opcional)</label>
            <input
              value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Consulta de seguimiento"
              style={inp}
            />
          </div>

          {(metodo === 'tarjeta_debito' || metodo === 'tarjeta_credito' || metodo === 'transferencia' || metodo === 'cheque') && (
            <div>
              <label style={lbl}>
                {metodo === 'cheque' ? 'Número de cheque' : metodo === 'transferencia' ? 'Folio de transferencia' : 'Autorización'}
              </label>
              <input
                value={referencia} onChange={(e) => setReferencia(e.target.value)}
                placeholder={metodo === 'cheque' ? '12345' : metodo === 'transferencia' ? 'SPEI 0123456' : '6 dígitos del voucher'}
                style={inp}
              />
            </div>
          )}

          <div>
            <label style={lbl}>Notas (opcional)</label>
            <input value={notas} onChange={(e) => setNotas(e.target.value)} style={inp} />
          </div>
        </div>
    </Modal>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
  fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit',
}
