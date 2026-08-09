'use client'
/**
 * Modal de cobro rápido — se abre desde la lista de citas o desde finanzas.
 * Pre-llena datos cuando se invoca desde una cita específica.
 */
import { useEffect, useState } from 'react'
import {
  registrarCobro, exentarCobro, cobrosDeCita, METODO_LABEL, CONCEPTO_LABEL,
  type MetodoPago, type ConceptoCobro,
} from '@/lib/cobros'
import { situacionDeCobro, type SituacionCobro } from '@/lib/finanzas/estado-cobro'
import { decidirMedicoDelCobroSuelto, type MedicoElegible } from '@/lib/finanzas/cobro-suelto'
import { updateAppointment, getDoctors } from '@/lib/firestore'
import { auth } from '@/lib/firebase'
import { logAudit } from '@/lib/expediente/audit-log'
import { DollarSign, HeartHandshake } from 'lucide-react'
import { Modal, Button } from '@/components/ui'
import { useToast } from '@/context/ToastContext'

export interface CobrarModalProps {
  clinicId: string
  creadoPor: string
  prefill?: {
    citaId?: string
    /** Estado actual de la cita: para no retroceder uno más avanzado al cobrar. */
    estadoActual?: string
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
  /**
   * LO QUE YA ABONÓ ESTE PACIENTE POR ESTA CITA.
   *
   * El abono en el mostrador ya se registraba y —a propósito— no marcaba la cita
   * como saldada, así que seguía apareciendo «por cobrar». Correcto, y a la vez
   * indistinguible de una consulta donde nadie pagó nada: quien cobra veía lo
   * mismo en los dos casos y cobraba el precio completo. El paciente que dejó
   * $300 de una consulta de $800 acababa pagando $1,100.
   *
   * Aquí se leen los cobros de ESTA cita —incluidos los anulados, que son los
   * que distinguen «no ha pagado» de «se anuló»— y se pone el SALDO en la caja
   * del importe, no el precio de lista.
   */
  const [situacion, setSituacion] = useState<SituacionCobro | null>(null)
  useEffect(() => {
    const citaId = prefill?.citaId
    if (!clinicId || !citaId) return
    let vivo = true
    cobrosDeCita(clinicId, citaId)
      .then(cobros => {
        if (!vivo || cobros.length === 0) return
        const s = situacionDeCobro(prefill?.monto ?? null, cobros)
        setSituacion(s)
        // El importe se ajusta al saldo SÓLO si queda algo por cobrar; si ya
        // está saldada se deja lo que había, para no sugerir un cobro de $0.
        if (s.saldo > 0) setMonto(String(s.saldo))
      })
      // Un fallo de lectura no puede bloquear el cobro: se sigue con el precio
      // de lista, que es lo que había antes de existir esto.
      .catch(() => { /* sin aviso: el modal sigue siendo usable */ })
    return () => { vivo = false }
  }, [clinicId, prefill?.citaId, prefill?.monto])
  const [concepto, setConcepto] = useState<ConceptoCobro>(prefill?.concepto ?? 'consulta')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [descripcion, setDescripcion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Modo cortesía (no cobrar): decisión deliberada y auditada.
  const [modoCortesia, setModoCortesia] = useState(false)
  const [motivoCortesia, setMotivoCortesia] = useState('')

  /**
   * DE QUÉ MÉDICO ES ESTE COBRO CUANDO NO VIENE DE UNA CITA.
   *
   * Abierto desde Finanzas no hay `prefill.medicoId` y el modal tampoco
   * preguntaba: el cobro se guardaba con lo que resolviera la sesión y, si
   * quien cobra es la asistente, caía en la fila «sin atribuir» del reparto de
   * comisiones. Dinero cobrado y depositado que al repartir no es de nadie —y
   * que nadie reclama, porque no aparece en la fila de ningún médico.
   *
   * Con un solo médico no se pregunta nada. Ver `lib/finanzas/cobro-suelto.ts`.
   */
  const [doctores, setDoctores] = useState<MedicoElegible[]>([])
  const [medicoElegido, setMedicoElegido] = useState(prefill?.medicoId ?? '')
  useEffect(() => {
    if (!clinicId || prefill?.medicoId) return
    let vivo = true
    getDoctors(clinicId)
      .then(ds => {
        if (!vivo) return
        setDoctores(ds)
        const d = decidirMedicoDelCobroSuelto(ds)
        if (d.medicoId) setMedicoElegido(d.medicoId)
      })
      // Un fallo de lectura no puede bloquear el cobro: se queda sin atribuir,
      // que es lo que pasaba siempre antes de existir esto.
      .catch(() => { /* sin aviso */ })
    return () => { vivo = false }
  }, [clinicId, prefill?.medicoId])
  const decisionMedico = decidirMedicoDelCobroSuelto(doctores, prefill?.medicoId)

  const confirmarCortesia = async () => {
    if (!prefill?.citaId) { toast('La cortesía se marca sobre una cita', 'error'); return }
    const m = motivoCortesia.trim()
    if (!m) { toast('Escribe el motivo de la cortesía', 'error'); return }
    setGuardando(true)
    try {
      // Quien AUTORIZA la cortesía es el operador logueado, NO el médico de la cita
      // (antes se guardaba prefill.medicoNombre → bitácora anti-fraude mal atribuida
      // cuando la asistente exentaba). El uid (creadoPor) ya era correcto.
      const autorNombre = auth.currentUser?.displayName || auth.currentUser?.email || ''
      await exentarCobro(clinicId, prefill.citaId, m, creadoPor, autorNombre)
      // Bitácora inmutable (best-effort): quién autorizó no cobrar y por qué.
      logAudit({
        evento: 'cobro_exento', clinicId, patientId: prefill.patientId,
        meta: { citaId: prefill.citaId, paciente: prefill.patientNombre ?? '', motivo: m },
      }).catch(() => {})
      toast('Marcada como cortesía (no se cobra)', 'success')
      onCobrado?.('')
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo marcar la cortesía', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const guardar = async () => {
    const n = parseFloat(monto)
    // Un reembolso es un cobro NEGATIVO (corrige contabilidad). Para los demás
    // conceptos, el monto debe ser positivo. Antes el modal bloqueaba ≤0 siempre,
    // por lo que la funcionalidad de reembolso (que el tipo sí define) era inalcanzable.
    if (isNaN(n) || n === 0) { toast('Monto inválido', 'error'); return }
    if (concepto === 'reembolso' && n > 0) { toast('Un reembolso debe ser negativo (ej. -500)', 'error'); return }
    if (concepto !== 'reembolso' && n < 0) { toast('El monto debe ser positivo', 'error'); return }
    // Con varios médicos, a quién se le atribuye es tan obligatorio como el
    // importe: un cobro sin médico se pierde en silencio en el reparto.
    if (decisionMedico.hayQuePreguntar && !medicoElegido) {
      toast('Elige de qué médico es este cobro', 'error'); return
    }
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
        medicoId: prefill?.medicoId || medicoElegido || undefined,
        medicoNombre: prefill?.medicoNombre
          || doctores.find(d => d.id === medicoElegido)?.nombre
          || undefined,
        referenciaExterna: referencia.trim() || undefined,
        notas: notas.trim() || undefined,
        creadoPor,
      })
      // Marca la cita con el cobro para EVITAR DOBLE COBRO (el botón se oculta si ya tiene cobroId).
      let marcadaLaCita = true
      if (prefill?.citaId) {
        try {
          /**
           * COBRAR CIERRA LA CONSULTA.
           *
           * Antes solo se marcaba el `cobroId`. El estado de la cita había que
           * cambiarlo a mano después, en OTRA pantalla: ir a Citas, abrir el menú
           * ⋮ y elegir "atendida" de una lista sin traducir. Dos clics por
           * paciente, y en el lado contrario al que te lleva el flujo tras firmar.
           *
           * Y de `atendida` dependen SIETE cosas: el embudo del corte de caja,
           * cuentas por cobrar, el CRM, la campaña de reactivación, los
           * recordatorios post-visita y las reseñas. Si se olvida, todas se
           * degradan en silencio.
           *
           * Cobrar es la señal inequívoca de que el paciente fue atendido, así que
           * es el momento correcto para marcarlo. No se pisa un estado más
           * avanzado (finalizada, pagada) si ya lo tenía.
           */
          const avanzados = ['atendida', 'finalizada', 'pagada']
          /**
           * Un ABONO (pago parcial) o un REEMBOLSO NO saldan la cita. `registrarCobro`
           * a propósito NO reserva `cita.cobroId` en un abono, para que la cita SIGA
           * "por cobrar" por el saldo restante. Si aquí escribiéramos `cobroId`, el
           * botón "Cobrar" desaparecería (se oculta con `cobroId`) y el saldo quedaría
           * imposible de cobrar — ingreso perdido en silencio y corte de caja que sigue
           * marcándola pendiente. Solo un cobro que SALDA cierra la cita.
           */
          const salda = concepto !== 'abono' && concepto !== 'reembolso'
          await updateAppointment(clinicId, prefill.citaId, {
            ...(salda ? { cobroId: id, cobradoEn: new Date().toISOString() } : {}),
            ...(prefill.estadoActual && avanzados.includes(prefill.estadoActual) ? {} : { estado: 'atendida' as const }),
          })
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
      toast(e instanceof Error && e.message ? e.message : 'Error al registrar cobro', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={modoCortesia
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><HeartHandshake size={18} color="#a855f7" /> No cobrar (cortesía)</span>
        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><DollarSign size={18} color="var(--teal)" /> Registrar cobro</span>}
      footer={modoCortesia ? (
        <>
          <Button variant="secondary" onClick={() => setModoCortesia(false)}>Volver</Button>
          <Button onClick={confirmarCortesia} loading={guardando}>Confirmar cortesía</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={guardando}>Registrar cobro</Button>
        </>
      )}
    >
      {modoCortesia ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {prefill?.patientNombre && (
            <div style={{ padding: 10, background: 'var(--s)', borderRadius: 8, fontSize: 13 }}>
              <div style={{ color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>Paciente</div>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{prefill.patientNombre}</div>
            </div>
          )}
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
            Vas a marcar esta consulta como <strong>cortesía</strong>: no se cobra, se saca de cuentas
            por cobrar y no aparece en el corte de caja. Queda registrado <strong>quién lo autoriza,
            cuándo y por qué</strong>. Se puede revertir después.
          </div>
          <div>
            <label style={lbl}>Motivo de la cortesía *</label>
            <textarea
              value={motivoCortesia} onChange={e => setMotivoCortesia(e.target.value)}
              autoFocus rows={3} placeholder="Ej. familiar, cortesía profesional, paciente sin recursos…"
              style={{ ...inp, resize: 'vertical' }}
            />
          </div>
        </div>
      ) : (
        <>
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

        {/*
          LO QUE YA PAGÓ, ANTES DE TECLEAR EL IMPORTE.
          Va arriba de la caja a propósito: si estuviera debajo se lee después de
          haber escrito, que es tarde. Sólo aparece cuando hay algo que decir —un
          aviso que sale siempre deja de leerse.
        */}
        {situacion && situacion.pagado > 0 && (
          <div style={{
            margin: '0 0 12px', padding: '9px 12px', borderRadius: 9,
            border: '1px solid var(--border)', background: 'var(--s1)',
            display: 'flex', alignItems: 'center', gap: 9,
          }}>
            <DollarSign size={15} style={{ color: 'var(--teal)', flexShrink: 0 }} />
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <strong>{situacion.resumen}</strong>
              {situacion.saldo > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                  El importe ya viene con el saldo, no con el precio completo.
                </div>
              )}
            </div>
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
            {/*
              EL PRECIO SE TECLEA A MANO CADA VEZ, Y NO ES CULPA DEL MÉDICO.
              El monto sugerido sale de `config.preciosPublicos`, que NO viene en
              la configuración por omisión y sólo se edita bajo «Portal de
              auto-agenda → Tu perfil público». Nadie busca ahí el precio de su
              consulta: se busca en Finanzas o en Datos del consultorio, y en
              ninguno de los dos está. Así que el campo sale vacío en cada cobro
              y el médico lo teclea otra vez.
              Se dice dónde está, en el momento exacto en que hace falta.
            */}
            {!monto.trim() && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
                ¿Quieres que este monto se llene solo? Fija tus tarifas en{' '}
                <a href="/configuracion?tab=portal" style={{ color: 'var(--teal)', fontWeight: 600, textDecoration: 'none' }}>
                  Configuración → Portal de auto-agenda
                </a>.
              </div>
            )}
          </div>

          {!prefill?.medicoId && decisionMedico.opciones.length > 1 && (
            <div>
              <label style={lbl}>Médico *</label>
              <select
                value={medicoElegido}
                onChange={(e) => setMedicoElegido(e.target.value)}
                style={inp}
              >
                <option value="">Elige el médico…</option>
                {decisionMedico.opciones.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre || d.id}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                Sin médico, este cobro no entra en el reparto de comisiones de nadie.
              </div>
            </div>
          )}

          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Concepto</label>
              <select value={concepto} onChange={(e) => setConcepto(e.target.value as ConceptoCobro)} style={inp}>
                {/*
                  «Reembolso» NO se ofrece: no se puede registrar.
                  El selector lo listaba, aquí abajo se exige monto negativo, el
                  input tiene min="0" y `registrarCobro` rechaza a propósito
                  cualquier monto < 0 (REG-015: una devolución es su propio tipo
                  de transacción, con traza al cobro original, no un signo
                  menos). El médico lo elegía, escribía un número y se quedaba
                  con un error hiciera lo que hiciera. Hasta que exista la
                  operación de devolución, no se ofrece la opción — y la fila
                  «Reembolsos» del corte sigue en cero por el mismo motivo.
                */}
                {(Object.keys(CONCEPTO_LABEL) as ConceptoCobro[]).filter(k => k !== 'reembolso').map(k => (
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

          {/* No cobrar (cortesía): solo cuando se cobra sobre una cita concreta. */}
          {prefill?.citaId && (
            <button
              type="button"
              onClick={() => setModoCortesia(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'rgba(168,85,247,0.10)', border: '1px solid rgba(168,85,247,0.35)',
                color: '#a855f7', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', marginTop: 2,
              }}
            >
              <HeartHandshake size={15} /> No cobrar a este paciente (cortesía)
            </button>
          )}
        </div>
        </>
      )}
    </Modal>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)',
  fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit',
}
