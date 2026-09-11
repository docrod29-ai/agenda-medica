'use client'
/**
 * DE QUIÉN ES ESTE PACIENTE, Y CON QUIÉN SE COMPARTE — D-057.
 *
 * Un solo componente para los tres estados posibles de quien lo mira:
 *
 * - TITULAR (o admin): ve a los médicos del equipo y marca con quién comparte.
 *   Cada cambio es una escritura sobre `compartidoCon` y un asiento en la
 *   bitácora (`expediente_compartido` / `expediente_compartir_revocado`).
 * - OTRO MÉDICO sin acceso: ve el nombre del titular y un botón para PEDIR
 *   acceso, que abre una tarea a nombre del titular. No hay «acceso de
 *   emergencia»: el dueño no lo decidió, y aquí no se adivina.
 * - SIN TITULAR (paciente anterior a la decisión): cualquier médico puede
 *   reclamarlo — hasta entonces se ve como siempre.
 *
 * Recepción no lo ve: este componente sólo se monta bajo rutas de médico.
 */
import { useMemo, useState } from 'react'
import { Users, ShieldCheck, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useClinic } from '@/context/ClinicContext'
import { useDoctors } from '@/hooks/useDoctors'
import { useToast } from '@/context/ToastContext'
import { updatePatient } from '@/lib/firestore'
import { logAudit, type AuditEvento } from '@/lib/expediente/audit-log'
import { crearTareas } from '@/lib/tareas-clinicas/firestore'
import { pesoDeUrgencia } from '@/lib/tareas-clinicas/modelo'
import {
  puedeVerExpediente, puedeAdministrarAcceso, conAcceso, sinAcceso, porQueNoVe, TEXTO_SIN_ACCESO,
} from '@/lib/authz/alcance-del-paciente'
import type { Patient } from '@/types'

export const ORIGEN_PETICION_DE_ACCESO = 'expediente:peticion-de-acceso'

export function CompartirExpediente({ patient, onCambio }: { patient: Patient; onCambio?: (p: Patient) => void }) {
  const { user } = useAuth()
  const { clinicId, role } = useClinic()
  const { activeDoctors } = useDoctors()
  const { toast } = useToast()
  const [ocupado, setOcupado] = useState('')
  const uid = user?.uid ?? null

  const medicosConUid = useMemo(
    () => activeDoctors.filter(d => d.uid && d.uid !== patient.medicoTitularUid),
    [activeDoctors, patient.medicoTitularUid],
  )
  const titular = useMemo(() => activeDoctors.find(d => d.uid && d.uid === patient.medicoTitularUid) ?? null, [activeDoctors, patient.medicoTitularUid])
  const ve = puedeVerExpediente(patient, uid, role)
  const administra = puedeAdministrarAcceso(patient, uid, role)
  const motivo = porQueNoVe(patient, uid, role)

  const escribir = async (cambios: Partial<Patient>, evento: AuditEvento, meta: Record<string, unknown>) => {
    if (!clinicId || !uid) return
    setOcupado(evento)
    try {
      await updatePatient(clinicId, patient.id, cambios)
      logAudit({ evento, clinicId, patientId: patient.id, meta }).catch(() => {})
      onCambio?.({ ...patient, ...cambios })
    } catch (e) {
      toast(`No se pudo guardar: ${e instanceof Error ? e.message : 'revisa tu conexión'}`, 'error')
    } finally { setOcupado('') }
  }

  const pedirAcceso = async () => {
    if (!clinicId || !uid || !patient.medicoTitularUid) return
    setOcupado('pedir')
    try {
      const ahora = new Date().toISOString()
      const r = await crearTareas(clinicId, [{
        clinicId, patientId: patient.id, patientNombre: patient.nombre,
        tipo: 'otra', titulo: `${user?.displayName || user?.email || 'Un médico'} pide acceso al expediente`,
        detalle: 'Compártelo desde el expediente si procede. Hasta entonces sólo ve la ficha.',
        prioridad: 'normal', pesoUrgencia: pesoDeUrgencia('normal'), estado: 'solicitada', creadaEn: ahora,
        origen: ORIGEN_PETICION_DE_ACCESO, origenId: `${patient.id}__${uid}`,
        ownerUid: patient.medicoTitularUid, ownerNombre: titular?.nombre,
      }])
      if (r.creadas === 0) throw new Error('la petición no se pudo escribir')
      logAudit({ evento: 'expediente_acceso_pedido', clinicId, patientId: patient.id, meta: { titular: patient.medicoTitularUid } }).catch(() => {})
      toast('Petición enviada a su médico titular.', 'success')
    } catch (e) {
      toast(`No se pudo pedir el acceso: ${e instanceof Error ? e.message : 'revisa tu conexión'}`, 'error')
    } finally { setOcupado('') }
  }

  if (!uid || !role) return null

  if (!ve) {
    return (
      <section aria-label="Acceso al expediente" style={caja}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--text)' }}>
          <Lock size={16} aria-hidden="true" /> Sin acceso al expediente
        </div>
        <p style={{ margin: '6px 0 10px', color: 'var(--text2)', lineHeight: 1.5 }}>
          {motivo ? TEXTO_SIN_ACCESO[motivo] : ''}
          {titular ? ` Titular: ${titular.nombre}.` : ''}
        </p>
        {motivo === 'de_otro_medico' && (
          <button type="button" onClick={pedirAcceso} disabled={!!ocupado} className="nx-acc-caja" style={boton}>
            Pedir acceso al titular
          </button>
        )}
      </section>
    )
  }

  return (
    <section aria-label="Quién ve este expediente" style={caja}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--text)' }}>
        <Users size={16} aria-hidden="true" /> Quién ve este expediente
      </div>
      <p style={{ margin: '6px 0 10px', color: 'var(--text2)', lineHeight: 1.5 }}>
        {patient.medicoTitularUid
          ? <>Titular: <b>{titular?.nombre ?? (patient.medicoTitularUid === uid ? 'tú' : 'médico del consultorio')}</b>.</>
          : <>Sin médico titular todavía (paciente anterior a esta regla): lo ve todo el equipo médico.</>}
      </p>
      {!patient.medicoTitularUid && (
        <button type="button" onClick={() => escribir({ medicoTitularUid: uid }, 'expediente_titular_asignado', { titular: uid, por: uid })} disabled={!!ocupado} className="nx-acc-caja" style={boton}>
          <ShieldCheck size={14} aria-hidden="true" /> Hacerme titular
        </button>
      )}
      {administra && patient.medicoTitularUid && (
        medicosConUid.length === 0
          ? <p style={{ margin: 0, color: 'var(--text3)', fontSize: 12 }}>No hay otros médicos con sesión en el equipo.</p>
          : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {medicosConUid.map(d => {
                const marcado = (patient.compartidoCon ?? []).includes(d.uid!)
                return (
                  <li key={d.id}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: ocupado ? 'default' : 'pointer', minHeight: 44 }}>
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={!!ocupado}
                        onChange={() => escribir(
                          { compartidoCon: marcado ? sinAcceso(patient, d.uid!) : conAcceso(patient, d.uid!) },
                          marcado ? 'expediente_compartir_revocado' : 'expediente_compartido',
                          { con: d.uid, por: uid },
                        )}
                        style={{ width: 18, height: 18 }}
                      />
                      <span style={{ color: 'var(--text)' }}>{d.nombre}</span>
                      <span style={{ color: 'var(--text3)', fontSize: 12 }}>{marcado ? 've el expediente' : 'sólo la ficha'}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )
      )}
      {!administra && patient.medicoTitularUid && (
        <p style={{ margin: 0, color: 'var(--text3)', fontSize: 12 }}>Tienes acceso compartido por el titular.</p>
      )}
    </section>
  )
}

const caja: React.CSSProperties = { marginTop: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--s1)', fontSize: 14 }
const boton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600, color: 'var(--text)', background: 'var(--s2)', cursor: 'pointer', minHeight: 44 }
