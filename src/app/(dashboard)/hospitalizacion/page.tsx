'use client'
// ══════════════════════════════════════════════════════════════
// CENSO hospitalario — tablero de pacientes internados (episodios activos).
// Punto de entrada del módulo de hospitalización.
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { buscarPosiblesDuplicados } from '@/lib/pacientes/duplicados'
import { auth } from '@/lib/firebase'
import { getPatients, createPatient } from '@/lib/firestore'
import { suscribirCenso, crearInternamiento, getTelefonoAlertas, setTelefonoAlertas, getCamas } from '@/lib/hospital/firestore'
import { normalizarCama } from '@/lib/hospital/cama'
import { logAudit } from '@/lib/expediente/audit-log'
import { SERVICIOS_HOSPITAL, ESTADO_CAMA_LABEL, diasEstancia, type Internamiento, type Cama } from '@/types/hospital'
import type { Patient } from '@/types'
import { Modal, Button, Spinner, EmptyState } from '@/components/ui'
import { CensoVacio } from '@/components/brand/EmptyArt'
import { Cie10Autocomplete } from '@/components/Cie10Autocomplete'
import { BedDouble, Plus, Stethoscope, Clock, Search, Bell } from 'lucide-react'

const inputCls = 'w-full rounded-md border px-2.5 py-2 text-sm bg-transparent'

export default function CensoPage() {
  const router = useRouter()
  const { clinicId } = useClinic()
  const { config } = useConfig()
  const { toast, confirm } = useToast()

  const [censo, setCenso] = useState<Internamiento[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Alta / ingreso
  const [pacientes, setPacientes] = useState<Patient[]>([])
  const [buscar, setBuscar] = useState('')
  const [pac, setPac] = useState<Patient | null>(null)
  /**
   * ALTA RÁPIDA DEL PACIENTE desde el ingreso hospitalario.
   *
   * Antes esta pantalla decía «Registra al paciente primero en Pacientes»: un
   * callejón. En urgencias y en terapia el paciente MUCHAS VECES NO EXISTE
   * todavía en el consultorio, y obligar a salir, registrarlo y volver es
   * exactamente la fricción que hace que la cama se capture mal o no se capture.
   *
   * Se piden los mismos campos cortos que el formulario de Consulta, más las
   * ALERGIAS: aquí se va a prescribir en las próximas horas y la compuerta de
   * alergias necesita el dato para poder bloquear.
   */
  const [nuevoPac, setNuevoPac] = useState(false)
  const [np, setNp] = useState({ nombre: '', telefono: '', edad: '', fechaNacimiento: '', sexo: '', alergias: '' })
  const [servicio, setServicio] = useState(SERVICIOS_HOSPITAL[0])
  /**
   * Entrada desde otra pantalla: `?nuevo=1&servicio=UCI` abre el alta con el
   * servicio ya puesto.
   *
   * Sin esto, el botón «Ingresar paciente a UCI» del listado de UCI dejaba al
   * médico en el censo sin nada abierto — el mismo callejón que la auditoría
   * encontró en el prellenado calendario→asistente. Se corrige por PREFIJO, no
   * por igualdad: la URL dice «UCI» y el servicio real es «UCI / Terapia
   * Intensiva»; comparar con === lo habría dejado igual de muerto, pero en
   * silencio.
   */
  const params = useSearchParams()
  useEffect(() => {
    if (params.get('nuevo') !== '1') return
    const pedido = (params.get('servicio') ?? '').trim().toLowerCase()
    if (pedido !== '') {
      const encontrado = SERVICIOS_HOSPITAL.find(sv => sv.toLowerCase().startsWith(pedido))
      if (encontrado) setServicio(encontrado)
    }
    setModal(true)
  }, [params])
  const [camasInventario, setCamasInventario] = useState<Cama[]>([])
  const camasDelServicio = useMemo(() => camasInventario.filter(c => c.servicio === servicio), [camasInventario, servicio])
  /** Camas del servicio ya ocupadas por alguien del censo, en forma canónica. */
  const ocupadas = useMemo(
    () => new Set(censo.filter(i => i.servicio === servicio).map(i => normalizarCama(i.cama)).filter(Boolean)),
    [censo, servicio],
  )
  const [cama, setCama] = useState('')
  const [dxIngreso, setDxIngreso] = useState('')
  const [cie10, setCie10] = useState('')
  const [motivo, setMotivo] = useState('')

  // WhatsApp personal para recibir alertas cuando soy el médico tratante
  const [modalTel, setModalTel] = useState(false)
  const [tel, setTel] = useState('')
  const [telGuardando, setTelGuardando] = useState(false)
  const [errorCenso, setErrorCenso] = useState('')

  useEffect(() => {
    if (!clinicId) return
    // Censo EN VIVO: ingresos/egresos/traslados de cualquier usuario aparecen solos.
    const unsub = suscribirCenso(
      clinicId,
      c => { setCenso(c); setLoading(false); setErrorCenso('') },
      // `setLoading(false)` vivía SÓLO en el callback de éxito: si la lectura
      // fallaba, la pantalla se quedaba girando para siempre, sin mensaje y sin
      // reintentar. Y un censo que no dice qué pasó es indistinguible de haber
      // perdido a todos los internados — el susto que este consultorio ya tuvo.
      () => { setLoading(false); setErrorCenso('No se pudo leer el censo en vivo. Esto NO significa que no haya pacientes internados: no se pudieron leer.') },
    )
    // Inventario de camas para ofrecer las reales al ingresar (ver el campo Cama).
    getCamas(clinicId).then(setCamasInventario).catch(() => { /* el campo sigue siendo libre */ })
    return unsub
  }, [clinicId])

  const abrirTelefono = async () => {
    setModalTel(true)
    const uid = auth.currentUser?.uid
    if (clinicId && uid) { try { setTel(await getTelefonoAlertas(clinicId, uid)) } catch { /* */ } }
  }
  const guardarTelefono = async () => {
    const uid = auth.currentUser?.uid
    if (!clinicId || !uid) return
    setTelGuardando(true)
    try { await setTelefonoAlertas(clinicId, uid, tel); toast('WhatsApp de alertas guardado', 'success'); setModalTel(false) }
    catch { toast('No se pudo guardar', 'error') }
    finally { setTelGuardando(false) }
  }

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
      logAudit({ evento: 'hosp_ingreso', clinicId, patientId: pac.id, medicoUid: auth.currentUser?.uid, medicoEmail: auth.currentUser?.email ?? undefined, meta: { internamientoId: id, servicio, cama: cama.trim() } })
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
          <Button variant="secondary" icon={<Bell size={15} />} onClick={abrirTelefono}>Mis alertas</Button>
          <Button variant="secondary" onClick={() => router.push('/hospitalizacion/camas')}>Tablero de camas</Button>
          <Button variant="secondary" onClick={() => router.push('/hospitalizacion/unidades')}>Unidades</Button>
          <Button variant="secondary" onClick={() => router.push('/hospitalizacion/indicadores')}>Indicadores</Button>
          <Button icon={<Plus size={16} />} onClick={abrirModal}>Nuevo ingreso</Button>
        </div>
      </div>

      {/* Mi WhatsApp para alertas (como médico tratante) */}
      <Modal open={modalTel} onClose={() => setModalTel(false)} title="Mi WhatsApp para alertas"
        footer={<><Button variant="secondary" onClick={() => setModalTel(false)}>Cancelar</Button><Button loading={telGuardando} onClick={guardarTelefono}>Guardar</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0, lineHeight: 1.5 }}>
            Cuando seas el <strong>médico tratante</strong> de un paciente, las alertas críticas (laboratorio crítico, deterioro NEWS2, interconsultas) llegarán a <strong>este</strong> número. Si lo dejas vacío, van al teléfono general de la clínica.
          </p>
          <input className={inputCls} inputMode="tel" placeholder="+52 614 123 4567" value={tel} onChange={e => setTel(e.target.value)} />
        </div>
      </Modal>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 20px' }}>
        Pacientes internados ahora mismo. Abre un episodio para ver ingreso, evoluciones y egreso.
      </p>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : errorCenso ? (
        <EmptyState
          title="No se pudo cargar el censo"
          description={errorCenso}
          action={<Button variant="secondary" size="sm" onClick={() => window.location.reload()}>Reintentar</Button>}
        />
      ) : censo.length === 0 ? (
        <EmptyState illustration={<CensoVacio />} title="Sin pacientes internados" description="Cuando registres un ingreso, aparecerá aquí el censo." />
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
                {pacientesFiltrados.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', padding: 6 }}>
                    Sin coincidencias.
                  </div>
                )}
              </div>
              <button
                onClick={() => { setNuevoPac(true); setNp(n => ({ ...n, nombre: buscar.trim() })) }}
                style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--nexus,#3d5afe)', cursor: 'pointer', minHeight: 38 }}
              >
                <Plus size={14} /> Registrar paciente nuevo
              </button>
            </div>
          )}

          {nuevoPac && !pac && (
            <div style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--s2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)' }}>Paciente nuevo</div>
              <input className={inputCls} placeholder="Nombre completo" value={np.nombre}
                onChange={e => setNp({ ...np, nombre: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className={inputCls} placeholder="Edad" inputMode="numeric" value={np.edad}
                  onChange={e => setNp({ ...np, edad: e.target.value })} />
                <select className={inputCls} value={np.sexo} onChange={e => setNp({ ...np, sexo: e.target.value })}>
                  <option value="">Sexo</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className={inputCls} type="date" value={np.fechaNacimiento}
                  onChange={e => setNp({ ...np, fechaNacimiento: e.target.value })} />
                <input className={inputCls} placeholder="Teléfono" inputMode="tel" value={np.telefono}
                  onChange={e => setNp({ ...np, telefono: e.target.value })} />
              </div>
              <input className={inputCls} placeholder="Alergias (o «niega»)" value={np.alergias}
                onChange={e => setNp({ ...np, alergias: e.target.value })} />
              <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
                Las alergias se piden aquí porque en las próximas horas se va a prescribir,
                y la alerta que bloquea la firma necesita el dato para poder saltar.
                Si no consta, escriba «niega» o «se desconoce»: dejarlo vacío no es lo mismo.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" loading={guardando} onClick={async () => {
                  if (!clinicId) return
                  if (!np.nombre.trim()) { toast('El nombre es requerido', 'error'); return }
                  if (!np.edad.trim() && !np.fechaNacimiento) { toast('Pon la edad o la fecha de nacimiento', 'error'); return }
                  /**
                   * MISMA RED QUE EN CONSULTA.
                   *
                   * Este alta no comprobaba nada, y es por donde entra el paciente
                   * en el peor momento posible: llega a ingresar, se captura de
                   * prisa, y sus alergias y antecedentes se quedan en el
                   * expediente viejo mientras se prescribe desde el nuevo.
                   *
                   * Sólo frena ante una coincidencia SEGURA, y ni así bloquea:
                   * pregunta. Un ingreso no se puede detener por una duda.
                   */
                  const yaExiste = buscarPosiblesDuplicados(
                    {
                      nombre: np.nombre,
                      telefono: np.telefono,
                      fechaNacimiento: np.fechaNacimiento,
                      edad: np.edad ? Number(np.edad) : undefined,
                    },
                    pacientes,
                  ).filter(c => c.certeza === 'seguro')
                  if (yaExiste.length) {
                    const d = yaExiste[0]
                    const seguir = await confirm(
                      `Ya existe "${d.paciente.nombre}" — ${d.motivo.toLowerCase()}. Si lo creas otra vez, sus alergias y antecedentes quedarán en el otro expediente. ¿Crearlo de todas formas?`,
                      { peligro: true, confirmar: 'Crear de todas formas' },
                    )
                    if (!seguir) return
                  }
                  setGuardando(true)
                  try {
                    const tel = np.telefono.replace(/\D/g, '')
                    const id = await createPatient(clinicId, {
                      nombre: np.nombre.trim(),
                      telefono: tel,
                      // Mismo criterio que el alta de Consulta: si no se captura
                      // el WhatsApp por separado, es el mismo número.
                      whatsapp: tel,
                      edad: np.edad ? Number(np.edad) : undefined,
                      fechaNacimiento: np.fechaNacimiento || undefined,
                      sexo: (np.sexo || undefined) as Patient['sexo'],
                      alergias: np.alergias.trim(),
                    } as Omit<Patient, 'id'>)
                    const creado = { id, nombre: np.nombre.trim(), edad: np.edad ? Number(np.edad) : undefined,
                      sexo: (np.sexo || undefined) as Patient['sexo'], telefono: tel,
                      alergias: np.alergias.trim() } as Patient
                    setPacientes(ps => [creado, ...ps])
                    setPac(creado)
                    setNuevoPac(false)
                    setNp({ nombre: '', telefono: '', edad: '', fechaNacimiento: '', sexo: '', alergias: '' })
                    toast('Paciente registrado. Queda en el expediente del consultorio.', 'success')
                  } catch {
                    toast('No se pudo registrar al paciente', 'error')
                  } finally { setGuardando(false) }
                }}>Registrar y continuar</Button>
                <Button size="sm" variant="secondary" onClick={() => setNuevoPac(false)}>Cancelar</Button>
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
              {/*
                LA RAÍZ del desajuste entre el censo y el tablero de camas: esto era
                un campo de texto libre. Escribir "302 A" en vez de "302-A" dejaba la
                cama pintada como LIBRE con el paciente dentro. Ahora se ofrecen las
                camas reales del servicio —con aviso de cuáles están ocupadas— pero
                sigue siendo `datalist` y no `select`: si el inventario está
                incompleto o llega un ingreso a una cama que aún no se dio de alta,
                obligar a elegir de la lista bloquearía el ingreso de un paciente, y
                eso nunca puede pasar en un hospital.
              */}
              <input
                className={inputCls}
                list="camas-del-servicio"
                placeholder={camasDelServicio.length ? 'Elige o escribe' : 'ej. 302-A'}
                value={cama}
                onChange={e => setCama(e.target.value)}
              />
              <datalist id="camas-del-servicio">
                {camasDelServicio.map(c => (
                  <option key={c.id} value={c.etiqueta}>
                    {ocupadas.has(normalizarCama(c.etiqueta)) ? 'ocupada' : c.estado === 'libre' ? 'libre' : ESTADO_CAMA_LABEL[c.estado]}
                  </option>
                ))}
              </datalist>
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
