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
  incidentes?: Incidente[]; hayUrgente?: boolean
  webhook?: { configurado: boolean; faltantes: string[]; faltanCriticos: string[]; aviso: string } | null
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

  return (
    <div style={{ padding: '28px 20px 60px', maxWidth: 980, margin: '0 auto' }}>
      <Link href="/superadmin" style={{ fontSize: 13, color: 'var(--nexus, #3d5afe)', textDecoration: 'none' }}>← Consola</Link>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '10px 0 4px', color: 'var(--text, #0f172a)' }}>Costo de la IA</h1>
      <p style={{ fontSize: 14, color: 'var(--text3, #64748b)', margin: '0 0 20px', lineHeight: 1.5 }}>
        Tokens, modelo y latencia de cada llamada. No guarda prompts, respuestas ni pacientes.
      </p>

      <label style={{ fontSize: 13, color: 'var(--text2, #334155)' }}>
        Mes{' '}
        <input type="month" value={mes} onChange={e => { setMes(e.target.value); void cargar(e.target.value) }}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', fontSize: 13 }} />
      </label>

      {cargando && <p style={{ marginTop: 20, fontSize: 14, color: 'var(--text3, #64748b)' }}>Cargando…</p>}
      {error && <p style={{ marginTop: 20, fontSize: 14, color: '#dc2626' }}>{error}</p>}

      {datos && !cargando && (
        <>
          {/*
            EL WEBHOOK DE STRIPE, PRIMERO DE TODO.

            El código sabe atender un reembolso; si nadie marcó la casilla en el
            panel de Stripe, el evento no llega NUNCA y el dinero se devuelve con
            la suscripción viva. Esa casilla está fuera del repositorio, así que
            ningún test la ve — se le pregunta a Stripe y se muestra aquí.
          */}
          {datos.webhook?.aviso && (
            <div style={{
              border: `1px solid ${datos.webhook.faltanCriticos.length ? '#dc2626' : 'var(--border)'}`,
              background: datos.webhook.faltanCriticos.length ? 'rgba(220,38,38,.07)' : 'var(--panel, #f8fafc)',
              borderRadius: 10, padding: '13px 15px', margin: '18px 0 4px',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: datos.webhook.faltanCriticos.length ? '#b91c1c' : 'var(--text, #0f172a)' }}>
                {datos.webhook.faltanCriticos.length ? '⚠︎ ' : ''}Webhook de Stripe
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2, #334155)', marginTop: 5, lineHeight: 1.55 }}>{datos.webhook.aviso}</div>
              <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer"
                 style={{ display: 'inline-block', marginTop: 9, fontSize: 12.5, fontWeight: 600, color: 'var(--nexus, #3d5afe)' }}>
                Abrir el panel de Stripe ↗
              </a>
            </div>
          )}

          {/*
            LO QUE ESTÁ CAÍDO VA ANTES QUE LO QUE CUESTA.
            El 31-jul-2026 la IA estuvo caída y la única señal apareció cuando el
            dueño la probó a mano. Aquí ya no hay que ir a buscarla.
          */}
          {(datos.incidentes?.length ?? 0) > 0 && (
            <div style={{ margin: '18px 0 4px' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--text, #0f172a)' }}>
                Incidencias de la llave de la plataforma
              </h2>
              {datos.incidentes!.map(i => (
                <div key={i.id} style={{
                  border: `1px solid ${i.urgente ? '#dc2626' : 'var(--border, #e5e7eb)'}`,
                  background: i.urgente ? 'rgba(220,38,38,.07)' : 'var(--panel, #f8fafc)',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: i.urgente ? '#b91c1c' : 'var(--text, #0f172a)' }}>
                    {i.urgente ? '⚠︎ ' : ''}{i.titulo}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2, #334155)', marginTop: 4, lineHeight: 1.5 }}>{i.queHacer}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3, #64748b)', marginTop: 6 }}>
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

          <Tabla titulo="Por operación" filas={datos.porFeature} />
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
      background: alerta ? 'rgba(217,119,6,0.10)' : 'var(--s2, #f1f5f9)',
      border: '1px solid ' + (alerta ? 'rgba(217,119,6,0.35)' : 'var(--border, #e5e7eb)'),
      color: 'var(--text2, #334155)',
    }}>{children}</div>
  )
}

function Tarjeta({ titulo, valor, pie }: { titulo: string; valor: string; pie?: string }) {
  return (
    <div style={{
      flex: '1 1 170px', minWidth: 160, background: 'var(--s1, #fff)',
      border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text3, #64748b)' }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text, #0f172a)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      {pie && <div style={{ fontSize: 11.5, color: 'var(--text3, #64748b)', marginTop: 3 }}>{pie}</div>}
    </div>
  )
}

function Tabla({ titulo, filas, nota }: { titulo: string; filas: Grupo[]; nota?: string }) {
  if (filas.length === 0) return null
  return (
    <div style={{ marginTop: 30 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #0f172a)', margin: '0 0 4px' }}>{titulo}</h2>
      {nota && <p style={{ fontSize: 12.5, color: 'var(--text3, #64748b)', margin: '0 0 10px', lineHeight: 1.5 }}>{nota}</p>}
      {/* Las tablas anchas se desplazan solas: el cuerpo de la página nunca. */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border, #e5e7eb)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
          <thead>
            <tr style={{ background: 'var(--s2, #f1f5f9)' }}>
              <Th align="left">Concepto</Th><Th>Llamadas</Th><Th>Entrada</Th><Th>Salida</Th><Th>Costo</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map(g => (
              <tr key={g.clave} style={{ borderTop: '1px solid var(--border, #e5e7eb)' }}>
                <Td align="left">{g.clave}</Td>
                <Td>{n(g.resumen.llamadas)}</Td>
                <Td>{n(g.resumen.tokensEntrada)}</Td>
                <Td>{n(g.resumen.tokensSalida)}</Td>
                <Td>
                  {g.resumen.conCosto > 0
                    ? usd(g.resumen.totalUsd)
                    : <span style={{ color: '#b45309' }}>sin tarifa</span>}
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
  <th style={{ textAlign: align, padding: '9px 12px', fontWeight: 600, color: 'var(--text2, #334155)', fontSize: 12 }}>{children}</th>
)
const Td = ({ children, align = 'right' }: { children: React.ReactNode; align?: 'left' | 'right' }) => (
  <td style={{ textAlign: align, padding: '9px 12px', color: 'var(--text, #0f172a)', fontVariantNumeric: 'tabular-nums' }}>{children}</td>
)
