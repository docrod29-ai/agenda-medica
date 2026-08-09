'use client'
/**
 * TABLERO DE COSTOS DE IA — lo que de verdad cuesta servir NexusMED.
 *
 * Master Loop V3 §CE. Sin esta pantalla, el libro de costos es una colección de
 * Firestore que nadie mira.
 *
 * ── LO QUE ESTA PANTALLA HACE DISTINTO A UN DASHBOARD NORMAL ─────────────────
 *
 * Enseña lo que NO sabe. Mientras un modelo no tenga tarifa cargada, su costo no
 * se estima ni se promedia: aparece «sin tarifa», con el nombre del modelo, para
 * que se pueda ir a buscarla. Un total calculado sobre la mitad de las llamadas
 * se ve en pantalla exactamente igual que uno completo, y ésa es justo la forma
 * en que una cifra inventada acaba sosteniendo una decisión de precio.
 *
 * Y separa el gasto del FUNDADOR del de los clientes: probar UCI a diario puede
 * ser el consumo más grande de la plataforma, y no le corresponde a nadie que
 * pague.
 */
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { onAuthStateChanged, getIdToken } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { esSuperadminCliente } from '@/lib/superadmin-client'
import { msLegible, type ResumenLatencia } from '@/lib/observabilidad/latencias'
import { avisoDeSaldo, type SaldoProveedor } from '@/lib/finanzas/saldo-proveedores'

interface Resumen {
  llamadas: number; conCosto: number; sinTarifa: number; totalUsd: number
  tokensEntrada: number; tokensSalida: number; creditos: number
  modelosSinTarifa: string[]; latenciaP50: number | null; latenciaP95: number | null
}
interface Grupo { clave: string; resumen: Resumen }
/** Una caída de la IA de la plataforma, agrupada por proveedor, clase y hora. */
interface Incidente {
  id: string; proveedor?: string; clase?: string; urgente?: boolean
  titulo?: string; queHacer?: string; veces?: number; hora?: string
  features?: string[]; ultimoStatus?: number
}
interface Datos {
  ok: true; mes: string; total: Resumen; cogs: Resumen; confiable: boolean
  porFeature: Grupo[]; porModelo: Grupo[]; porClase: Grupo[]; truncado: boolean
  /** Quién gasta. `uid`, nunca el nombre: el libro de costos no guarda identidades. */
  porMedico?: Grupo[]
  /** Cuánto cuesta de IA atender a un paciente. */
  porConsulta?: { consultas: number; totalUsd: number; usdPorConsulta: number | null; sinTarifa: number; supuesto: string }
  latenciasPorFeature: ResumenLatencia[]; latenciasPorModelo: ResumenLatencia[]
  incidentes?: Incidente[]; hayUrgente?: boolean
  saldos?: SaldoProveedor[]
  webhook?: { configurado: boolean; faltantes: string[]; faltanCriticos: string[]; aviso: string; modo?: 'prueba' | 'produccion' | 'sin_llave'; avisoModo?: string } | null
}

const mesActual = () => new Date().toISOString().slice(0, 7)
const n = (x: number) => x.toLocaleString('es-MX')
const usd = (x: number) => '$' + x.toFixed(4) + ' USD'

const CLASE_NOMBRE: Record<string, string> = {
  customer: 'Clientes (COGS)',
  rnd: 'Tuyo, probando (I+D)',
  llave_propia: 'Con su propia llave',
}

export default function CostosPage() {
  const [mes, setMes] = useState(mesActual())
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [abono, setAbono] = useState({ proveedor: 'assemblyai', montoUsd: '', referencia: '' })
  const [guardando, setGuardando] = useState(false)
  const [avisoAbono, setAvisoAbono] = useState('')

  const cargar = useCallback(async (m: string) => {
    setCargando(true); setError('')
    try {
      const u = auth.currentUser
      if (!u) { setError('Inicia sesión.'); return }
      const t = await getIdToken(u)
      const r = await fetch(`/api/superadmin/costos?mes=${m}`, { headers: { Authorization: `Bearer ${t}` } })
      const j = await r.json()
      if (!j.ok) { setError(j.error ?? 'No se pudo leer.'); return }
      setDatos(j)
    } catch {
      setError('No se pudo leer el libro de costos.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => onAuthStateChanged(auth, u => {
    const ok = esSuperadminCliente(u?.email ?? null)
    setPermitido(ok)
    if (ok) void cargar(mes)
    else setCargando(false)
  }), [cargar, mes])

  if (permitido === false) {
    return <div style={{ padding: 40, fontSize: 15 }}>Esta consola es sólo para el dueño de la plataforma.</div>
  }

  /**
   * Registrar un abono.
   *
   * Recarga la pantalla al terminar en vez de parchear el estado a mano: el
   * saldo se recalcula en el servidor con el gasto real, y un número pintado
   * aquí a mano podría no coincidir con el que dispara el aviso.
   */
  const registrarAbono = async () => {
    setGuardando(true); setAvisoAbono('')
    try {
      const u = auth.currentUser
      if (!u) { setAvisoAbono('Inicia sesión.'); return }
      const t = await getIdToken(u)
      const r = await fetch('/api/superadmin/costos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...abono, montoUsd: Number(abono.montoUsd) }),
      })
      const j = await r.json()
      if (!j.ok) { setAvisoAbono(j.error ?? 'No se pudo registrar.'); return }
      setAbono({ proveedor: abono.proveedor, montoUsd: '', referencia: '' })
      setAvisoAbono('Abono registrado.')
      await cargar(mes)
    } catch {
      setAvisoAbono('No se pudo registrar el abono.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ padding: '28px 20px 60px', maxWidth: 980, margin: '0 auto' }}>
      <Link href="/superadmin" style={{ fontSize: 13, color: 'var(--nexus)', textDecoration: 'none' }}>← Consola</Link>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '10px 0 4px', color: 'var(--text)' }}>Costo de la IA</h1>
      <p style={{ fontSize: 14, color: 'var(--text3)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Tokens, modelo y latencia de cada llamada. No guarda prompts, respuestas ni pacientes.
      </p>

      <label style={{ fontSize: 13, color: 'var(--text2)' }}>
        Mes{' '}
        <input type="month" value={mes} onChange={e => { setMes(e.target.value); void cargar(e.target.value) }}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
      </label>

      {cargando && <p style={{ marginTop: 20, fontSize: 14, color: 'var(--text3)' }}>Cargando…</p>}
      {error && <p style={{ marginTop: 20, fontSize: 14, color: 'var(--red)' }}>{error}</p>}

      {datos && !cargando && (
        <>
          {/*
            EL WEBHOOK DE STRIPE, PRIMERO DE TODO.

            El código sabe atender un reembolso; si nadie marcó la casilla en el
            panel de Stripe, el evento no llega NUNCA y el dinero se devuelve con
            la suscripción viva. Esa casilla está fuera del repositorio, así que
            ningún test la ve — se le pregunta a Stripe y se muestra aquí.
          */}
          {/*
            EL MODO VA PRIMERO Y EN TONO NEUTRO.

            Estar en prueba no es un fallo: es lo correcto mientras no se venda.
            Pintarlo en rojo enseñaría a ignorar el rojo. Lo que sí tiene que
            quedar claro es la consecuencia — que un pago «exitoso» en este modo
            no mueve un peso — y que los eventos se configuran por separado en
            cada modo, que es de donde vendría la sorpresa al pasar a producción.
          */}
          {datos.webhook?.avisoModo && (
            <div style={{
              border: '1px solid var(--border)', background: 'var(--panel)',
              borderRadius: 10, padding: '12px 14px', margin: '18px 0 8px',
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                Stripe: modo {datos.webhook.modo === 'prueba' ? 'de prueba' : datos.webhook.modo === 'sin_llave' ? 'sin configurar' : 'producción'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.55 }}>{datos.webhook.avisoModo}</div>
            </div>
          )}

          {datos.webhook?.aviso && (
            <div style={{
              border: `1px solid ${datos.webhook.faltanCriticos.length ? '#dc2626' : 'var(--border)'}`,
              background: datos.webhook.faltanCriticos.length ? 'color-mix(in srgb, var(--red) 7%, transparent)' : 'var(--panel)',
              borderRadius: 10, padding: '13px 15px', margin: '18px 0 4px',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: datos.webhook.faltanCriticos.length ? '#b91c1c' : 'var(--text)' }}>
                {datos.webhook.faltanCriticos.length ? '⚠︎ ' : ''}Webhook de Stripe
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 5, lineHeight: 1.55 }}>{datos.webhook.aviso}</div>
              <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer"
                 style={{ display: 'inline-block', marginTop: 9, fontSize: 12.5, fontWeight: 600, color: 'var(--nexus)' }}>
                Abrir el panel de Stripe ↗
              </a>
            </div>
          )}

          {/*
            EL SALDO VA ARRIBA DEL GASTO.
            «Cuánto gasté» es una pregunta de fin de mes; «cuánto me queda» es
            una pregunta de hoy, y es la que deja a todos los consultorios sin
            separación de voces si se contesta tarde.
          */}
          <div style={{ margin: '18px 0 4px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>
              Saldo con los proveedores de IA
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 10px', lineHeight: 1.5 }}>
              <strong>Estimado.</strong> Ninguno de los tres publica su saldo por API, así que se calcula
              con lo que usted anota aquí menos lo que dice el libro de costos. Puede diferir del estado de
              cuenta por impuestos, redondeos o llamadas que no pasaron por el libro.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {(datos.saldos ?? []).map(sp => (
                <div key={sp.proveedor} style={{
                  flex: '1 1 220px', minWidth: 220,
                  border: `1px solid ${sp.nivel === 'ok' ? 'var(--border)' : 'var(--red)'}`,
                  background: sp.nivel === 'ok' ? 'var(--panel)' : 'color-mix(in srgb, var(--red) 7%, transparent)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, color: 'var(--text3)' }}>
                    {sp.proveedor}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                    {sp.cargadoUsd > 0 ? '$' + sp.restanteUsd.toFixed(2) : '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
                    {sp.cargadoUsd <= 0
                      ? 'Sin abonos registrados: no se puede estimar el saldo (y por eso no se pinta en rojo).'
                      : <>Abonado ${sp.cargadoUsd.toFixed(2)} · gastado ${sp.gastadoUsd.toFixed(2)}
                         {sp.diasRestantes !== null && <> · ~{sp.diasRestantes} día(s) al ritmo actual</>}</>}
                  </div>
                  {avisoDeSaldo(sp) && (
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--red)', marginTop: 8, lineHeight: 1.45 }}>
                      {avisoDeSaldo(sp)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12 }}>
              <select
                value={abono.proveedor}
                onChange={e => setAbono(a => ({ ...a, proveedor: e.target.value }))}
                aria-label="Proveedor al que se abonó"
                style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, minHeight: 44 }}
              >
                {(datos.saldos ?? []).map(sp => <option key={sp.proveedor} value={sp.proveedor}>{sp.proveedor}</option>)}
              </select>
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                placeholder="Monto en USD"
                value={abono.montoUsd}
                onChange={e => setAbono(a => ({ ...a, montoUsd: e.target.value }))}
                aria-label="Monto abonado en dólares"
                style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, minHeight: 44, width: 150 }}
              />
              <input
                placeholder="Referencia del cargo (opcional)"
                value={abono.referencia}
                onChange={e => setAbono(a => ({ ...a, referencia: e.target.value }))}
                aria-label="Referencia del cargo"
                style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, minHeight: 44, flex: '1 1 200px' }}
              />
              <button
                onClick={registrarAbono}
                disabled={guardando || !abono.montoUsd}
                style={{
                  padding: '10px 16px', borderRadius: 8, border: 'none', minHeight: 44,
                  background: 'var(--nexus-solido)', color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: guardando ? 'wait' : 'pointer', opacity: guardando || !abono.montoUsd ? .6 : 1,
                }}
              >
                {guardando ? 'Registrando…' : 'Registrar abono'}
              </button>
              {avisoAbono && <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{avisoAbono}</span>}
            </div>
          </div>

          {/*
            LO QUE ESTÁ CAÍDO VA ANTES QUE LO QUE CUESTA.
            El 31-jul-2026 la IA estuvo caída y la única señal apareció cuando el
            dueño la probó a mano. Aquí ya no hay que ir a buscarla.
          */}
          {(datos.incidentes?.length ?? 0) > 0 && (
            <div style={{ margin: '18px 0 4px' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>
                Incidencias de la llave de la plataforma
              </h2>
              {datos.incidentes!.map(i => (
                <div key={i.id} style={{
                  border: `1px solid ${i.urgente ? '#dc2626' : 'var(--border)'}`,
                  background: i.urgente ? 'color-mix(in srgb, var(--red) 7%, transparent)' : 'var(--panel)',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: i.urgente ? '#b91c1c' : 'var(--text)' }}>
                    {i.urgente ? '⚠︎ ' : ''}{i.titulo}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{i.queHacer}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                    {n(i.veces ?? 0)} {(i.veces ?? 0) === 1 ? 'vez' : 'veces'} · {i.hora?.replace('T', ' a las ')} h
                    {i.features?.length ? ` · afectó: ${i.features.join(', ')}` : ''}
                    {i.ultimoStatus ? ` · HTTP ${i.ultimoStatus}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {datos.total.llamadas === 0 && (
            <Aviso tono="neutro">
              No hay llamadas registradas en {datos.mes}. El libro empezó a llenarse el 30 de julio de 2026:
              antes de esa fecha los tokens se tiraban y no hay forma de recuperarlos.
            </Aviso>
          )}

          {/* Lo que NO se sabe va ARRIBA, no en una nota al pie. */}
          {datos.total.sinTarifa > 0 && (
            <Aviso tono="alerta">
              <strong>{n(datos.total.sinTarifa)} de {n(datos.total.llamadas)} llamadas no tienen precio cargado.</strong>{' '}
              Los tokens están completos; lo que falta es la tarifa de{' '}
              {datos.total.modelosSinTarifa.join(', ')}. Hasta que se carguen en{' '}
              <code style={{ fontSize: 12 }}>src/lib/finanzas/precios-modelo.ts</code>, el total de abajo
              cubre sólo {n(datos.total.conCosto)} llamadas — no es el gasto del mes.
              {' '}Se dejaron vacías a propósito: un precio escrito de memoria da un tablero que parece
              exacto y miente.
            </Aviso>
          )}

          {datos.truncado && (
            <Aviso tono="alerta">
              Se alcanzó el tope de 5 000 llamadas por consulta: lo de abajo es un mes incompleto.
            </Aviso>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
            <Tarjeta titulo="Llamadas" valor={n(datos.total.llamadas)} pie={`${n(datos.total.conCosto)} con precio conocido`} />
            <Tarjeta titulo="Tokens de entrada" valor={n(datos.total.tokensEntrada)} pie="incluye los servidos de caché" />
            <Tarjeta titulo="Tokens de salida" valor={n(datos.total.tokensSalida)} />
            <Tarjeta
              titulo="Costo de servir (COGS)"
              valor={datos.cogs.conCosto > 0 ? usd(datos.cogs.totalUsd) : '—'}
              pie={datos.cogs.conCosto > 0 ? `${n(datos.cogs.llamadas)} llamadas de clientes` : 'sin tarifas cargadas'}
            />
            <Tarjeta titulo="Créditos cobrados" valor={n(datos.total.creditos)} />
            <Tarjeta
              titulo="Latencia"
              valor={datos.total.latenciaP50 != null ? `${n(datos.total.latenciaP50)} ms` : '—'}
              pie={datos.total.latenciaP95 != null ? `p95 ${n(datos.total.latenciaP95)} ms` : undefined}
            />
          </div>

          {/*
            CUÁNTO TARDA Y CUÁNTO FALLA, por operación y por modelo.
            El KPI de arriba da un p50/p95 global, que dice si «en general» va
            bien y no dice DÓNDE va mal. Estos datos ya se guardaban en cada
            asiento y no los leía nadie.
          */}
          <TablaLatencias titulo="Cuánto tarda cada operación" filas={datos.latenciasPorFeature} />
          <TablaLatencias titulo="Cuánto tarda cada modelo" filas={datos.latenciasPorModelo}
            nota="Aquí se ve si un proveedor se degradó: la misma operación con dos modelos, uno lento." />

          {/*
            CUÁNTO CUESTA ATENDER A UN PACIENTE. Es la cifra con la que se
            decide un precio, y no estaba en ninguna parte: la consola sumaba
            por función, modelo y clase. Se dice el SUPUESTO al lado, porque una
            media sin su divisor se lee como un hecho.
          */}
          {datos.porConsulta && (
            <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Costo de IA por consulta dictada</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {datos.porConsulta.usdPorConsulta == null ? '—' : `$${datos.porConsulta.usdPorConsulta.toFixed(4)}`}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  USD · {n(datos.porConsulta.consultas)} {datos.porConsulta.consultas === 1 ? 'consulta' : 'consultas'} ·
                  ${datos.porConsulta.totalUsd.toFixed(4)} de cadena completa
                  {datos.porConsulta.sinTarifa > 0 && ` · ${n(datos.porConsulta.sinTarifa)} llamadas sin tarifa, fuera del total`}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>{datos.porConsulta.supuesto}</div>
            </div>
          )}

          <Tabla titulo="Por operación" filas={datos.porFeature} />
          {datos.porMedico && datos.porMedico.length > 0 && (
            <Tabla
              titulo="Por médico"
              nota="El identificador, nunca el nombre: el libro de costos no guarda identidades a propósito, y esta pantalla no va a ser la que las introduzca."
              filas={datos.porMedico}
            />
          )}
          <Tabla titulo="Por modelo" filas={datos.porModelo} />
          <Tabla
            titulo="Quién generó el gasto"
            nota="Lo que gastas probando módulos internos es investigación, no costo de servir a un cliente. Mezclarlos haría que el margen dejara de ser real."
            filas={datos.porClase.map(g => ({ ...g, clave: CLASE_NOMBRE[g.clave] ?? g.clave }))}
          />
        </>
      )}
    </div>
  )
}

function Aviso({ tono, children }: { tono: 'alerta' | 'neutro'; children: React.ReactNode }) {
  const alerta = tono === 'alerta'
  return (
    <div style={{
      marginTop: 18, padding: '13px 16px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.55,
      background: alerta ? 'color-mix(in srgb, var(--amber) 10%, transparent)' : 'var(--s2)',
      border: '1px solid ' + (alerta ? 'color-mix(in srgb, var(--amber) 35%, transparent)' : 'var(--border)'),
      color: 'var(--text2)',
    }}>{children}</div>
  )
}

function Tarjeta({ titulo, valor, pie }: { titulo: string; valor: string; pie?: string }) {
  return (
    <div style={{
      flex: '1 1 170px', minWidth: 160, background: 'var(--s1)',
      border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      {pie && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{pie}</div>}
    </div>
  )
}

function Tabla({ titulo, filas, nota }: { titulo: string; filas: Grupo[]; nota?: string }) {
  if (filas.length === 0) return null
  return (
    <div style={{ marginTop: 30 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{titulo}</h2>
      {nota && <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 10px', lineHeight: 1.5 }}>{nota}</p>}
      {/* Las tablas anchas se desplazan solas: el cuerpo de la página nunca. */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
          <thead>
            <tr style={{ background: 'var(--s2)' }}>
              <Th align="left">Concepto</Th><Th>Llamadas</Th><Th>Entrada</Th><Th>Salida</Th><Th>Costo</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map(g => (
              <tr key={g.clave} style={{ borderTop: '1px solid var(--border)' }}>
                <Td align="left">{g.clave}</Td>
                <Td>{n(g.resumen.llamadas)}</Td>
                <Td>{n(g.resumen.tokensEntrada)}</Td>
                <Td>{n(g.resumen.tokensSalida)}</Td>
                <Td>
                  {g.resumen.conCosto > 0
                    ? usd(g.resumen.totalUsd)
                    : <span style={{ color: 'var(--amber)' }}>sin tarifa</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const Th = ({ children, align = 'right' }: { children: React.ReactNode; align?: 'left' | 'right' }) => (
  <th style={{ textAlign: align, padding: '9px 12px', fontWeight: 600, color: 'var(--text2)', fontSize: 12 }}>{children}</th>
)
const Td = ({ children, align = 'right' }: { children: React.ReactNode; align?: 'left' | 'right' }) => (
  <td style={{ textAlign: align, padding: '9px 12px', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{children}</td>
)

/**
 * Latencias por clave. Tres percentiles y el máximo, no uno solo: un único
 * número siempre deja fuera una forma de ir mal. Y la tasa de fallo al lado,
 * porque una operación rapidísima que falla la mitad de las veces no es rápida.
 */
function TablaLatencias({ titulo, filas, nota }: { titulo: string; filas?: ResumenLatencia[]; nota?: string }) {
  const conDatos = (filas ?? []).filter(f => f.n > 0 || f.fallos > 0)
  if (!conDatos.length) return null
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto', marginBottom: 18 }}>
      <div style={{ padding: '12px 14px 6px' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{titulo}</div>
        {nota && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>{nota}</div>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 620 }}>
        <thead>
          <tr style={{ background: 'var(--s2)', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px' }}>Clave</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Llamadas</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>p50</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>p95</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>p99</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>La peor</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Fallos</th>
          </tr>
        </thead>
        <tbody>
          {conDatos.map(f => (
            <tr key={f.clave} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{f.clave}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.n}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{msLegible(f.p50)}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{msLegible(f.p95)}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{msLegible(f.p99)}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text3)' }}>{msLegible(f.max)}</td>
              <td style={{
                padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                color: f.fallos > 0 ? 'var(--red)' : 'var(--text3)',
              }}>
                {f.fallos > 0 ? `${f.fallos} · ${(f.tasaFallo * 100).toFixed(1)} %` : '0'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
