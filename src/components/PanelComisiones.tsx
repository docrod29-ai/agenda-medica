'use client'
/**
 * PANEL DE COMISIONES — reparto por médico sobre lo cobrado en el periodo.
 *
 * El dueño fija el % por médico (o un default) y marca los conceptos que NO
 * generan comisión (medicamento/material suelen ser costo). El reporte se
 * recalcula en vivo. Es solo lectura del dinero: calcula, no paga.
 */
import { useEffect, useMemo, useState } from 'react'
import { Percent, Save, Info } from 'lucide-react'
import { fmtMXN, CONCEPTO_LABEL, type Cobro, type ConceptoCobro } from '@/lib/cobros'
import {
  calcularComisiones, cargarConfigComisiones, guardarConfigComisiones,
  clampPct, CONFIG_COMISIONES_DEFAULT, type ConfigComisiones,
} from '@/lib/comisiones'

// Conceptos que tiene sentido marcar como "no comisionables" (el resto son honorarios).
const CONCEPTOS_EXCLUIBLES: ConceptoCobro[] = ['medicamento', 'material', 'estudio', 'reembolso', 'abono']

export function PanelComisiones({ clinicId, cobros }: { clinicId?: string | null; cobros: Cobro[] }) {
  const [config, setConfig] = useState<ConfigComisiones>(CONFIG_COMISIONES_DEFAULT)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    if (!clinicId) return
    setCargando(true)
    cargarConfigComisiones(clinicId).then(setConfig).finally(() => setCargando(false))
  }, [clinicId])

  // Médicos que aparecen en los cobros del periodo (para poder asignarles %).
  const medicos = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of cobros) if (c.medicoId) m.set(c.medicoId, c.medicoNombre || 'Médico')
    return Array.from(m.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [cobros])

  const reporte = useMemo(() => calcularComisiones(cobros, config), [cobros, config])

  const setPct = (medicoId: string, valor: string) => {
    const n = clampPct(parseFloat(valor))
    setConfig(c => ({ ...c, porMedico: { ...c.porMedico, [medicoId]: n } }))
    setGuardado(false)
  }
  const toggleExcluido = (concepto: ConceptoCobro) => {
    setConfig(c => {
      const set = new Set(c.conceptosExcluidos)
      set.has(concepto) ? set.delete(concepto) : set.add(concepto)
      return { ...c, conceptosExcluidos: Array.from(set) }
    })
    setGuardado(false)
  }
  const guardar = async () => {
    if (!clinicId) return
    setGuardando(true)
    try {
      await guardarConfigComisiones(clinicId, config)
      setGuardado(true)
    } finally { setGuardando(false) }
  }

  if (cargando) return <div style={{ color: 'var(--text3)', fontSize: 13, padding: 20 }}>Cargando comisiones…</div>

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
        <Info size={15} style={{ color: 'var(--nexus)', flexShrink: 0, marginTop: 1 }} />
        <span>
          El porcentaje arranca en <strong>0 %</strong> — tú lo fijas por médico. Este es un <strong>reporte</strong>: calcula el
          reparto sobre lo cobrado del periodo, <strong>no genera pagos ni mueve dinero</strong>. Los reembolsos (en negativo) ya
          restan de la base.
        </span>
      </div>

      {/* Config: % por médico */}
      {medicos.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>No hay cobros atribuidos a un médico en este periodo.</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--s1)' }}>
            <Percent size={15} style={{ color: 'var(--nexus)' }} />
            <strong style={{ fontSize: 13.5 }}>Porcentaje por médico</strong>
            <label style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Default
              <input type="number" min={0} max={100} value={config.porDefecto}
                onChange={e => { setConfig(c => ({ ...c, porDefecto: clampPct(parseFloat(e.target.value)) })); setGuardado(false) }}
                style={{ width: 58, padding: '4px 6px', fontSize: 12.5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
              %
            </label>
          </div>
          <div style={{ display: 'grid', gap: 1, background: 'var(--border)' }}>
            {medicos.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'var(--bg)' }}>
                <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{m.nombre}</span>
                <input type="number" min={0} max={100}
                  value={config.porMedico[m.id] ?? ''}
                  placeholder={String(config.porDefecto)}
                  onChange={e => setPct(m.id, e.target.value)}
                  style={{ width: 64, padding: '5px 7px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--s1)', color: 'var(--text)', textAlign: 'right' }} />
                <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conceptos excluidos */}
      <div>
        <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 7 }}>Conceptos que <strong>no</strong> generan comisión:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {CONCEPTOS_EXCLUIBLES.map(k => {
            const on = config.conceptosExcluidos.includes(k)
            return (
              <button key={k} onClick={() => toggleExcluido(k)} style={{
                padding: '5px 11px', fontSize: 12, borderRadius: 'var(--r-pill)', cursor: 'pointer',
                border: '1px solid ' + (on ? 'var(--nexus)' : 'var(--border)'),
                background: on ? 'color-mix(in srgb, var(--nexus) 12%, transparent)' : 'var(--bg)',
                color: on ? 'var(--nexus)' : 'var(--text3)', fontWeight: on ? 700 : 500,
              }}>{on ? '✕ ' : ''}{CONCEPTO_LABEL[k]}</button>
            )
          })}
        </div>
      </div>

      {/* Reporte */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--s1)', textAlign: 'right', color: 'var(--text3)', fontSize: 11.5 }}>
                <th style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 600 }}>Médico</th>
                <th style={{ padding: '9px 10px', fontWeight: 600 }}>Cobros</th>
                <th style={{ padding: '9px 10px', fontWeight: 600 }}>Base</th>
                <th style={{ padding: '9px 10px', fontWeight: 600 }}>%</th>
                <th style={{ padding: '9px 10px', fontWeight: 600, color: 'var(--nexus)' }}>Comisión</th>
                <th style={{ padding: '9px 14px', fontWeight: 600 }}>Queda al consultorio</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
              {reporte.filas.map(f => (
                <tr key={f.medicoId} style={{ borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                  <td style={{ textAlign: 'left', padding: '9px 14px', color: 'var(--text)' }}>{f.medicoNombre}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text3)' }}>{f.nCobros}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text2)' }}>{fmtMXN(f.baseComisionable)}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text3)' }}>{f.porcentaje}%</td>
                  <td style={{ padding: '9px 10px', color: 'var(--nexus)', fontWeight: 700 }}>{fmtMXN(f.comision)}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text2)' }}>{fmtMXN(f.netoConsultorio)}</td>
                </tr>
              ))}
              {reporte.filas.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>Sin datos en el periodo.</td></tr>
              )}
            </tbody>
            {reporte.filas.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', textAlign: 'right', fontWeight: 700 }}>
                  <td style={{ textAlign: 'left', padding: '10px 14px' }}>Total</td>
                  <td></td>
                  <td style={{ padding: '10px' }}>{fmtMXN(reporte.totalBase)}</td>
                  <td></td>
                  <td style={{ padding: '10px', color: 'var(--nexus)' }}>{fmtMXN(reporte.totalComision)}</td>
                  <td style={{ padding: '10px 14px' }}>{fmtMXN(reporte.totalNeto)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {reporte.dudosos.n > 0 && (
          /*
            DOS FILAS DEL MISMO MÉDICO SE VEN IGUAL QUE DOS MÉDICOS DISTINTOS.
            Hasta v853 el mismo médico llegaba con dos identificadores —el id de
            `doctors` desde Citas y el `uid` desde Consulta— y el reparto lo
            partía en dos: el dueño ponía el porcentaje en la fila que reconocía
            y la otra mitad se comisionaba al 0 %. Los cobros nuevos ya se
            normalizan; los anteriores siguen como estaban, y esa duda vale
            dinero, así que se dice antes de pagar.
          */
          <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 8, lineHeight: 1.5 }}>
            {reporte.dudosos.n} cobro{reporte.dudosos.n > 1 ? 's' : ''} ({fmtMXN(reporte.dudosos.monto)}) tiene{reporte.dudosos.n > 1 ? 'n' : ''} un
            médico que no se pudo reconocer con certeza. Si ves al mismo médico en dos filas, probablemente sea esto:
            revísalo antes de pagar.
          </div>
        )}

        {reporte.sinAtribuir.n > 0 && (
          <div style={{ padding: '8px 14px', fontSize: 11.5, color: 'var(--text3)', borderTop: '1px solid var(--border)', background: 'var(--s1)' }}>
            {reporte.sinAtribuir.n} cobro{reporte.sinAtribuir.n > 1 ? 's' : ''} sin médico atribuido ({fmtMXN(reporte.sinAtribuir.monto)}) — no entra a comisiones.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={guardar} disabled={guardando || !clinicId} className="btn btn-primary">
          <Save size={14} /> {guardando ? 'Guardando…' : 'Guardar porcentajes'}
        </button>
        {guardado && <span style={{ fontSize: 12.5, color: 'var(--teal)' }}>Guardado ✓</span>}
      </div>
    </div>
  )
}
