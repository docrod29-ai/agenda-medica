'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { PageHeader, Button, Spinner, Input } from '@/components/ui'
import { useClinic } from '@/context/ClinicContext'
import { listarCobros, fmtMXN } from '@/lib/cobros'
import { cortesiasDelDia } from '@/lib/corte-caja'
import { getAppointments, getConfig } from '@/lib/firestore'
import { where } from 'firebase/firestore'
import type { Cobro } from '@/lib/cobros'
import type { Appointment } from '@/types'
import { corteDeCaja, embudoCobro, cuentasPorCobrar } from '@/lib/corte-caja'
import { hoyISO, TZ_DEFAULT } from '@/lib/timezone'
import { Printer, Wallet, TrendingDown, Users, AlertCircle, Calendar } from 'lucide-react'

/**
 * DÍA LOCAL DEL CONSULTORIO.
 *
 * El comentario anterior aquí decía que usar el día UTC era lo correcto "para
 * que reconcilie con lo guardado". Reconciliaba con la etiqueta, no con la
 * realidad: cerrando caja a las 19:00 del lunes, el día UTC ya es martes, así
 * que el corte abría en MARTES —vacío— mientras el dinero del lunes seguía en
 * el cajón. Y las citas de esta misma pantalla siempre se consultaron por hora
 * local, de modo que se comparaban dos días distintos y las consultas de la
 * tarde salían como "atendida y no cobrada".
 *
 * Ahora los cobros se consultan por instante (`limitesDelDia` en lib/cobros),
 * que es correcto también para lo ya guardado, y el día es el del consultorio.
 */

export default function CorteCajaPage() {
  return <CorteCajaContenido />
}

/** Contenido del corte de caja. `embedded` lo usa la pestaña dentro de Finanzas
 * (sin su propio header/padding, para no duplicar el marco). */
export function CorteCajaContenido({ embedded = false }: { embedded?: boolean }) {
  const { clinicId } = useClinic()
  /**
   * ZONA HORARIA DEL CONSULTORIO (auditoría P2). El "hoy" y la ventana de instantes
   * de los cobros deben calcularse en la zona real de la clínica (config.zonaHoraria),
   * no en la de CDMX por defecto: en el norte (Tijuana UTC-8, etc.) un cierre cerca de
   * medianoche caía en el día equivocado. La zona vive en config/main, no en el doc
   * Clinic, así que se carga aparte.
   */
  const [tz, setTz] = useState(TZ_DEFAULT)
  const [dia, setDia] = useState(hoyISO())
  const diaAuto = useRef(true)  // el día sigue siendo el automático (el usuario no lo tocó)
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [citas, setCitas] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinicId) return
    getConfig(clinicId).then(c => {
      const z = c?.zonaHoraria || TZ_DEFAULT
      setTz(z)
      if (diaAuto.current) setDia(hoyISO(z))  // corrige "hoy" a la zona real del consultorio
    }).catch(() => {})
  }, [clinicId])

  const cargar = useCallback(async () => {
    if (!clinicId) return
    setLoading(true)
    try {
      const [cb, ct] = await Promise.all([
        /**
         * SE CARGAN TAMBIÉN LOS ANULADOS.
         *
         * Anular un cobro no tiene restricción de fecha: se puede anular el
         * jueves un cobro en efectivo del lunes. Como esta pantalla los excluía,
         * el corte del lunes reimpreso pasaba de $12,400 a $11,500 **sin una
         * sola nota** que lo explicara — y quien cuadra la caja contra el papel
         * anterior no tiene forma de saber qué cambió.
         *
         * No entran en los totales (eso lo decide `corteDeCaja`, que los
         * ignora): se listan aparte, con quién anuló y por qué.
         */
        listarCobros(clinicId, dia, dia, true, tz),
        getAppointments(clinicId, [
          where('fechaHora', '>=', dia + ' 00:00'),
          where('fechaHora', '<=', dia + ' 23:59'),
        ]),
      ])
      setCobros(cb); setCitas(ct)
    } finally {
      setLoading(false)
    }
  }, [clinicId, dia, tz])

  useEffect(() => { cargar() }, [cargar])

  /**
   * Los anulados llegan en la misma lista y se separan aquí: los totales se
   * calculan SIN ellos —`corteDeCaja` ya los ignora, pero también los ignoran
   * el embudo y las cuentas por cobrar— y se muestran aparte.
   */
  const anulados = useMemo(() => cobros.filter(c => c.cancelado), [cobros])
  const vivos = useMemo(() => cobros.filter(c => !c.cancelado), [cobros])

  const corte = useMemo(() => corteDeCaja(vivos), [vivos])
  const embudo = useMemo(() => embudoCobro(citas, vivos), [citas, vivos])
  const porCobrar = useMemo(() => cuentasPorCobrar(citas, vivos), [citas, vivos])
  const cortesias = useMemo(() => cortesiasDelDia(citas), [citas])

  return (
    <div style={{ padding: embedded ? 0 : 24, maxWidth: 920, margin: '0 auto' }}>
      {!embedded && (
        <PageHeader
          title="Corte de caja"
          subtitle="Cierra el día: cuánto entró, en qué forma de pago, y quién quedó pendiente de cobro."
          actions={
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Imprimir</Button>
          }
        />
      )}

      {/* Selector de día */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Calendar size={16} style={{ color: 'var(--text3)' }} />
        <Input type="date" value={dia} onChange={e => { diaAuto.current = false; setDia(e.target.value) }} style={{ width: 180 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => { diaAuto.current = true; setDia(hoyISO(tz)) }}>Hoy</button>
      </div>

      {loading ? <Spinner center label="Cargando corte…" /> : (
        <div id="corte-print">
          {/* Encabezado imprimible */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Corte del día</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{dia}</div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Kpi icon={<Wallet size={16} />} titulo="Total neto" valor={fmtMXN(corte.neto)} color="var(--nexus)" />
            <Kpi icon={<span style={{ fontSize: 15 }}>💵</span>} titulo="Efectivo en caja" valor={fmtMXN(corte.efectivo)} color="#16a34a" />
            {/*
              «Reembolsos» estaba condenado a $0.00: los montos negativos se
              rechazan en el origen y la operación de devolución no existe
              todavía, así que ese cero se leía como «no hubo devoluciones»
              cuando la verdad era «no se pueden registrar».
              Lo que SÍ baja el día son las anulaciones, y ésas sí se pueden
              contar.
            */}
            <Kpi icon={<TrendingDown size={16} />} titulo="Anulados" valor={fmtMXN(anulados.reduce((s, c) => s + c.monto, 0))} color="var(--red)" />
            <Kpi icon={<Users size={16} />} titulo="Movimientos" valor={String(corte.nCobros)} />
          </div>

          {anulados.length > 0 && (
            <div style={{
              border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', borderRadius: 12,
              background: 'color-mix(in srgb, var(--red) 5%, transparent)', padding: 14, marginBottom: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <AlertCircle size={15} style={{ color: 'var(--red)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  Anulados de este día · {anulados.length}
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: '0 0 10px', lineHeight: 1.5 }}>
                No cuentan en los totales. Se listan aquí para que un corte reimpreso explique por qué cambió:
                una anulación puede hacerse días después y sin esto el total baja sin motivo visible.
              </p>
              {anulados.map(c => (
                <div key={c.id} style={{ fontSize: 12.5, paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ color: 'var(--text2)', textDecoration: 'line-through' }}>
                    {fmtMXN(c.monto)}{c.patientNombre ? ` · ${c.patientNombre}` : ''}
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: 11.5, marginTop: 2 }}>
                    Motivo: {c.motivoCancelacion || '— sin motivo —'}
                    {c.canceladoEn ? ` · anulado el ${c.canceladoEn.slice(0, 10)}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Por método */}
          <Panel titulo="Desglose por forma de pago">
            {corte.porMetodo.length === 0
              ? <Vacio texto="Sin cobros este día." />
              : corte.porMetodo.map(m => (
                <Fila key={m.metodo} izq={m.label} der={fmtMXN(m.monto)} sub={`${m.n} mov.`} />
              ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--text)' }}>
              <span>Total</span><span>{fmtMXN(corte.neto)}</span>
            </div>
          </Panel>

          {/* Embudo */}
          <Panel titulo="Agendadas → Atendidas → Cobradas">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, textAlign: 'center' }}>
              <Etapa n={embudo.agendadas} label="Agendadas" />
              <Etapa n={embudo.atendidas} label="Atendidas" sub={`${Math.round(embudo.tasaAsistencia * 100)}% asistencia`} />
              <Etapa n={embudo.cobradas} label="Cobradas" sub={`${Math.round(embudo.tasaCobro * 100)}% cobro`} />
            </div>
            {(embudo.noAsistio > 0 || embudo.cortesias > 0) && (
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 12, textAlign: 'center' }}>
                {embudo.noAsistio > 0 && `${embudo.noAsistio} no asistió · `}
                {/* La cortesía sale del denominador de la tasa: es una decisión,
                    no una cobranza fallida. Pero se DICE, que es distinto de
                    esconderla. */}
                {embudo.cortesias > 0 && `${embudo.cortesias} de cortesía (fuera de la tasa) · `}
                Cobrado hoy en consultas: {fmtMXN(embudo.montoCobrado)}
              </div>
            )}
          </Panel>

          {/*
            CORTESÍAS DEL DÍA — la decisión que nadie veía.

            `exentarCobro` guarda con todo cuidado quién autorizó la cortesía,
            cuándo y por qué («una decisión deliberada y AUDITADA», dice su
            comentario), y esos tres campos no los leía ninguna pantalla. La caja
            ni las mencionaba: diez atendidos, ocho cobrados, dos de cortesía, y
            el corte mostraba ocho sin rastro de los otros dos. Quien cuadra el
            dinero no podía distinguir «dos que autorizó el doctor» de «dos que a
            alguien se le olvidó cobrar».
          */}
          {cortesias.length > 0 && (
            <Panel titulo={`Cortesías (${cortesias.length})`}>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 10 }}>
                Consultas que se decidió NO cobrar. No son deuda y no cuentan en la tasa de cobro.
              </div>
              {cortesias.map(c => (
                <Fila key={c.citaId}
                  izq={c.paciente}
                  der={c.fechaHora.slice(11, 16)}
                  sub={`${c.motivo}${c.autorizadaPor ? ` · autorizó ${c.autorizadaPor}` : ' · sin autor registrado'}`}
                />
              ))}
            </Panel>
          )}

          {/* Cuentas por cobrar */}
          <Panel titulo={`Cuentas por cobrar (${porCobrar.length})`}>
            {porCobrar.length === 0
              ? <Vacio texto={embudo.atendidas === 0
                  ? 'Sin consultas atendidas este día.'
                  : 'Todas las consultas atendidas de este día están cobradas. 🎉'} />
              : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--amber)', marginBottom: 10 }}>
                    <AlertCircle size={14} /> Consultas atendidas sin cobro registrado.
                  </div>
                  {porCobrar.map(c => (
                    <Fila key={c.citaId}
                      izq={c.paciente}
                      der={c.fechaHora.slice(11)}
                      sub={c.medico} />
                  ))}
                </>
              )}
          </Panel>
        </div>
      )}

      <style>{`
        @media print {
          .no-print, .mobile-topbar, .bottom-nav-wrap, aside, nav { display: none !important; }
          #corte-print { color: #000; }
        }
      `}</style>
    </div>
  )
}

/* ─── Sub-componentes ─── */
function Kpi({ titulo, valor, icon, color }: { titulo: string; valor: string; icon?: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
        {icon} {titulo}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--text)' }}>{valor}</div>
    </div>
  )
}
function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Fila({ izq, der, sub }: { izq: string; der: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{izq}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{der}</div>
    </div>
  )
}
function Etapa({ n, label, sub }: { n: number; label: string; sub?: string }) {
  return (
    <div style={{ padding: '14px 8px', borderRadius: 10, background: 'var(--s2)' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--nexus)' }}>{n}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
function Vacio({ texto }: { texto: string }) {
  return <div style={{ fontSize: 13, color: 'var(--text3)', padding: '6px 0' }}>{texto}</div>
}
