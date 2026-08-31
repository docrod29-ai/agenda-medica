'use client'
/**
 * MEMBRESÍAS — gestión de planes recurrentes de pacientes + worklist de cobro.
 * El cobro real usa el módulo de cobros (concepto 'membresia'); marcarlo avanza
 * el ciclo automáticamente.
 */
import { useEffect, useMemo, useState } from 'react'
import { useClinic } from '@/context/ClinicContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import { useBusquedaDePacientes } from '@/hooks/useBusquedaDePacientes'
import { hoyISO } from '@/lib/timezone'
import { fmtMXN, METODO_LABEL, type MetodoPago } from '@/lib/cobros'
import { PageHeader, Button, Spinner, Modal, Input, Select } from '@/components/ui'
import {
  crearPlan, listarPlanes, asignarMembresia, listarMembresias, cambiarEstadoMembresia,
  cobrarMembresia, porCobrar, PERIODICIDAD_LABEL,
  type PlanMembresia, type Membresia, type Periodicidad,
} from '@/lib/membresias'
import type { Patient } from '@/types'
import { CreditCard, Plus, UserPlus, CircleDollarSign } from 'lucide-react'

/* El lienzo de la página, escrito UNA vez: la rama de carga y la de contenido
   comparten medida, así que no puede haber dos anchos distintos según cuándo se
   mire. (Y el trinquete de diseño cuenta cada `maxWidth ≥ 400`: duplicarlo
   subía el techo de lienzos a mano.) */
const LIENZO: React.CSSProperties = { padding: 24, maxWidth: 1000, margin: '0 auto' }

export default function MembresiasPage() {
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast, confirm } = useToast()
  const [planes, setPlanes] = useState<PlanMembresia[]>([])
  const [membs, setMembs] = useState<Membresia[]>([])
  const [cuotaACobrar, setCuotaACobrar] = useState<Membresia | null>(null)
  const [metodoCobro, setMetodoCobro] = useState<MetodoPago>('efectivo')
  const [loading, setLoading] = useState(true)
  const [modalPlan, setModalPlan] = useState(false)
  const [asignar, setAsignar] = useState(false)
  // Evita el doble cobro por doble clic / reintento: se bloquea la fila en curso.
  const [cobrandoId, setCobrandoId] = useState<string | null>(null)

  const recargar = async () => {
    if (!clinicId) return
    const [p, m] = await Promise.all([listarPlanes(clinicId), listarMembresias(clinicId)])
    setPlanes(p); setMembs(m)
  }
  useEffect(() => {
    if (!clinicId) return
    // El directorio ya no se precarga: el único sitio que lo usaba era el
    // buscador del modal, y desde REG-351 ése pregunta al servidor.
    Promise.all([listarPlanes(clinicId), listarMembresias(clinicId)])
      .then(([p, m]) => { setPlanes(p); setMembs(m) })
      .catch(e => console.error('[membresias]', e))
      .finally(() => setLoading(false))
  }, [clinicId])

  const worklist = useMemo(() => porCobrar(membs, hoyISO()), [membs])

  /**
   * EL MÉTODO DE PAGO SE PREGUNTA. NO ERA «EFECTIVO» SIEMPRE.
   *
   * Iba quemado como `metodo: 'efectivo'` y no había ningún selector, así que
   * TODA cuota de membresía entraba al libro como efectivo aunque se hubiera
   * pagado por transferencia o con tarjeta. Eso corrompe exactamente el número
   * que sirve para cuadrar el cajón físico al cerrar el día, y el desglose por
   * forma de pago del corte.
   */
  const cobrar = async (m: Membresia) => {
    if (!clinicId || !user || cobrandoId) return   // ya hay un cobro en curso
    setCuotaACobrar(m)
    setMetodoCobro('efectivo')
  }

  const confirmarCobro = async () => {
    const m = cuotaACobrar
    if (!clinicId || !user || !m) return
    setCuotaACobrar(null)
    setCobrandoId(m.id ?? null)
    try {
      await cobrarMembresia(clinicId, m, { metodo: metodoCobro, creadoPor: user.uid })
      toast('Cuota cobrada y ciclo avanzado', 'success')
      await recargar()
    } catch (e) {
      // El motivo importa: «ya se cobró desde otro dispositivo» no es lo mismo
      // que «falló la red», y antes las dos decían «No se pudo cobrar».
      toast(e instanceof Error ? e.message : 'No se pudo cobrar', 'error')
      await recargar()
    }
    finally { setCobrandoId(null) }
  }

  /*
    LA PANTALLA NO PIERDE SU NOMBRE MIENTRAS CARGA.

    Antes, `<main>` entero se sustituía por un renglón: sin título, sin
    descripción, sin saber si era la pantalla que se había pedido. Medido con la
    red lenta: 20 caracteres en toda la página. Ahora la cabecera se queda —es lo
    único que ya se sabe— y debajo espera el contenido.
  */
  if (loading) return (
    <div className="page-pad" style={LIENZO}>
      <PageHeader
        title="Membresías"
        subtitle="Planes recurrentes de pacientes: consultas incluidas, descuentos, seguimiento."
      />
      <div style={{ padding: 40 }}><Spinner center label="Cargando membresías…" /></div>
    </div>
  )

  return (
    <div className="page-pad" style={LIENZO}>
      <PageHeader
        title="Membresías"
        subtitle="Planes recurrentes de pacientes: consultas incluidas, descuentos, seguimiento."
        actions={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setModalPlan(true)}>Nuevo plan</Button>
            <Button icon={<UserPlus size={15} />} onClick={() => setAsignar(true)} disabled={planes.length === 0}>Asignar a paciente</Button>
          </div>
        )}
      />

      {/* Worklist: a quién le toca pagar */}
      <Section titulo={`Por cobrar (${worklist.filter(w => w.vencida).length} vencidas)`} icon={<CircleDollarSign size={16} />}>
        {worklist.length === 0 ? <Vacio texto="Sin membresías activas todavía." /> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {worklist.map(w => (
              <div key={w.membresia.id} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13.5 }}>{w.membresia.pacienteNombre}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{w.membresia.planNombre} · {PERIODICIDAD_LABEL[w.membresia.periodicidad]} · vence {w.membresia.proximoCobro}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap',
                  background: w.vencida ? 'color-mix(in srgb, var(--red) 12%, transparent))' : 'rgba(127,127,127,.1)',
                  color: w.vencida ? 'var(--red)' : 'var(--text3)' }}>
                  {w.vencida ? `vencida ${-w.diasRestantes}d` : `en ${w.diasRestantes}d`}
                </span>
                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{fmtMXN(w.membresia.precio)}</div>
                <Button size="sm" onClick={() => cobrar(w.membresia)} disabled={cobrandoId === w.membresia.id}>
                  {cobrandoId === w.membresia.id ? 'Cobrando…' : 'Cobrar'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Planes */}
      <Section titulo={`Planes (${planes.length})`} icon={<CreditCard size={16} />}>
        {planes.length === 0 ? <Vacio texto="Crea tu primer plan de membresía." /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))', gap: 10 }}>
            {planes.map(p => (
              <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'var(--s1, rgba(127,127,127,.04))' }}>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{p.nombre}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--teal)', margin: '2px 0' }}>{fmtMXN(p.precio)}<span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}> / {PERIODICIDAD_LABEL[p.periodicidad].toLowerCase()}</span></div>
                {p.beneficios.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12, color: 'var(--text2)' }}>{p.beneficios.map((b, i) => <li key={i}>{b}</li>)}</ul>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Miembros */}
      <Section titulo={`Miembros (${membs.filter(m => m.estado === 'activa').length} activos)`}>
        {membs.length === 0 ? <Vacio texto="Aún no has asignado membresías." /> : (
          <div style={{ display: 'grid', gap: 4 }}>
            {membs.map(m => (
              <div key={m.id} style={row}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13.5 }}>{m.pacienteNombre}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text3)' }}> · {m.planNombre}</span>
                </div>
                <span style={{ fontSize: 11, color: m.estado === 'activa' ? 'var(--teal)' : 'var(--text3)' }}>{m.estado}</span>
                {m.estado === 'activa'
                  ? <button onClick={() => cambiarEstadoMembresia(clinicId!, m.id!, 'pausada').then(recargar).catch(() => toast('No se pudo pausar', 'error'))} style={linkBtn}>Pausar</button>
                  : m.estado === 'pausada'
                  ? <button onClick={() => cambiarEstadoMembresia(clinicId!, m.id!, 'activa').then(recargar).catch(() => toast('No se pudo reactivar', 'error'))} style={linkBtn}>Reactivar</button>
                  : null}
              </div>
            ))}
          </div>
        )}
      </Section>

      {modalPlan && <ModalPlan onClose={() => setModalPlan(false)} onCrear={async (p) => {
        // try/catch: sin él, un fallo (offline/permiso) dejaba el modal abierto sin
        // aviso (unhandled rejection) y parecía que no había pasado nada.
        try { await crearPlan(clinicId!, p); toast('Plan creado', 'success'); setModalPlan(false); recargar() }
        catch { toast('No se pudo crear el plan', 'error') }
      }} />}
      {asignar && <ModalAsignar clinicId={clinicId} planes={planes} onClose={() => setAsignar(false)}
        onAsignar={async (pac, plan) => {
          try { await asignarMembresia(clinicId!, { pacienteId: pac.id!, pacienteNombre: pac.nombre, plan, creadoPor: user!.uid }); toast('Membresía asignada', 'success'); setAsignar(false); recargar() }
          catch { toast('No se pudo asignar la membresía', 'error') }
        }} />}

      {/*
        COBRAR UNA CUOTA PREGUNTA CÓMO SE PAGÓ.
        Antes iba directo con `metodo: 'efectivo'` quemado, sin selector: toda
        cuota entraba al libro como efectivo aunque se hubiera pagado por
        transferencia. Eso corrompe justo el número con el que se cuadra el
        cajón físico al cerrar el día.
      */}
      <Modal
        open={!!cuotaACobrar}
        onClose={() => setCuotaACobrar(null)}
        title="Cobrar cuota de membresía"
        footer={
          <><Button variant="secondary" onClick={() => setCuotaACobrar(null)}>Cancelar</Button>
          <Button onClick={confirmarCobro}>Registrar cobro</Button></>
        }
      >
        {cuotaACobrar && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>
              <strong>{fmtMXN(cuotaACobrar.precio)}</strong> · {cuotaACobrar.planNombre}
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{cuotaACobrar.pacienteNombre}</div>
            </div>
            <label style={lbl}>¿Cómo se pagó?
              <Select value={metodoCobro} onChange={e => setMetodoCobro(e.target.value as MetodoPago)}>
                {(Object.keys(METODO_LABEL) as MetodoPago[]).map(k => (
                  <option key={k} value={k}>{METODO_LABEL[k]}</option>
                ))}
              </Select>
            </label>
            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
              Al registrarlo, el ciclo avanza a la siguiente fecha de cobro.
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ModalPlan({ onClose, onCrear }: { onClose: () => void; onCrear: (p: Omit<PlanMembresia, 'id' | 'createdAt'>) => void }) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('mensual')
  const [beneficios, setBeneficios] = useState('')
  return (
    <Modal open onClose={onClose} title="Nuevo plan de membresía" footer={
      <><Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <Button onClick={() => { const n = parseFloat(precio); if (!nombre.trim() || !(n > 0)) return; onCrear({ nombre: nombre.trim(), precio: n, periodicidad, beneficios: beneficios.split('\n').map(s => s.trim()).filter(Boolean), activo: true }) }}>Crear plan</Button></>
    }>
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={lbl}>Nombre<Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Plan mensual · consultas ilimitadas" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lbl}>Precio MXN<Input type="number" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="500" /></label>
          <label style={lbl}>Periodicidad<Select value={periodicidad} onChange={e => setPeriodicidad(e.target.value as Periodicidad)}><option value="mensual">Mensual</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option></Select></label>
        </div>
        <label style={lbl}>Beneficios (uno por línea)<textarea value={beneficios} onChange={e => setBeneficios(e.target.value)} rows={3} placeholder={'Consultas ilimitadas\n10% en farmacia'} style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', fontSize: 13, color: 'var(--text)', resize: 'vertical' }} /></label>
      </div>
    </Modal>
  )
}

/**
 * REG-351 — el buscador de este modal filtraba «la lista» en memoria, y desde
 * REG-341 esa lista viene recortada: por encima del techo se le decía «no está»
 * a un paciente que sí está, y la membresía no se podía asignar sin darlo de
 * alta otra vez. Ahora pregunta al servidor.
 */
function ModalAsignar({ clinicId, planes, onClose, onAsignar }: { clinicId: string | null; planes: PlanMembresia[]; onClose: () => void; onAsignar: (p: Patient, plan: PlanMembresia) => void }) {
  const [busca, setBusca] = useState('')
  const [pacSel, setPacSel] = useState<Patient | null>(null)
  const [planId, setPlanId] = useState(planes[0]?.id ?? '')
  const busqueda = useBusquedaDePacientes(clinicId, busca)
  const filtrados = busqueda.resultados.slice(0, 8)
  return (
    <Modal open onClose={onClose} title="Asignar membresía" footer={
      <><Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <Button disabled={!pacSel || !planId} onClick={() => { const plan = planes.find(p => p.id === planId); if (pacSel && plan) onAsignar(pacSel, plan) }}>Asignar</Button></>
    }>
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={lbl}>Paciente
          {pacSel ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ fontWeight: 600 }}>{pacSel.nombre}</span>
              <button onClick={() => setPacSel(null)} style={linkBtn}>Cambiar</button>
            </div>
          ) : (
            <>
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar paciente por nombre o teléfono…" />
              {filtrados.map(p => <button key={p.id} onClick={() => { setPacSel(p); setBusca('') }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 11px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--s1)', color: 'var(--text)', cursor: 'pointer', marginTop: 4 }}>{p.nombre}</button>)}
              {!busqueda.textoCorto && filtrados.length === 0 && (
                <div style={{ fontSize: 12, marginTop: 6, color: busqueda.sePudoPreguntar ? 'var(--text3)' : 'var(--amber)' }}>
                  {busqueda.buscando
                    ? 'Buscando…'
                    : busqueda.sePudoPreguntar
                      ? 'Sin coincidencias. La búsqueda es por el principio del nombre o del teléfono.'
                      : 'No se pudo consultar el directorio: esto NO significa que el paciente no exista.'}
                </div>
              )}
              {busqueda.truncada && (
                <div role="status" style={{ fontSize: 12, marginTop: 6, color: 'var(--amber)' }}>
                  Hay más coincidencias de las que caben aquí; escribe más letras.
                </div>
              )}
            </>
          )}
        </label>
        <label style={lbl}>Plan<Select value={planId} onChange={e => setPlanId(e.target.value)}>{planes.map(p => <option key={p.id} value={p.id}>{p.nombre} · {fmtMXN(p.precio)}</option>)}</Select></label>
      </div>
    </Modal>
  )
}

function Section({ titulo, icon, children }: { titulo: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {icon}<h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{titulo}</h2>
      </div>
      {children}
    </div>
  )
}
function Vacio({ texto }: { texto: string }) { return <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text3)', border: '1px dashed var(--border)', borderRadius: 12 }}>{texto}</div> }

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--teal)', fontSize: 12, cursor: 'pointer', padding: 0 }
