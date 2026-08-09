'use client'
/**
 * Facturas del consultorio (cliente). Lista sus pagos y le permite PEDIR factura
 * (CFDI 4.0) SOLO si la quiere: captura sus datos fiscales y se timbra vía el
 * servidor (Facturama). Si ya está facturado, descarga PDF/XML.
 */
import { useCallback, useEffect, useState } from 'react'
import { fetchAutenticado } from '@/lib/auth-client'
import { FileText, Download, Loader2, ReceiptText } from 'lucide-react'

const mxn = (n: number) => '$' + Math.round(n).toLocaleString('es-MX')
const fecha = (iso: string) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

const REGIMENES = [
  ['612', '612 · Personas Físicas con Actividad Empresarial y Profesional'],
  ['626', '626 · RESICO (Régimen Simplificado de Confianza)'],
  ['605', '605 · Sueldos y Salarios'],
  ['601', '601 · General de Ley Personas Morales'],
  ['603', '603 · Personas Morales con Fines no Lucrativos'],
  ['621', '621 · Incorporación Fiscal'],
]
/** Catálogo del SAT (c_FormaPago). Sólo las que aplican a este cobro. */
const FORMAS_PAGO = [
  ['04', '04 · Tarjeta de crédito'],
  ['28', '28 · Tarjeta de débito'],
  ['03', '03 · Transferencia electrónica (SPEI)'],
  ['01', '01 · Efectivo'],
  ['02', '02 · Cheque nominativo'],
  ['99', '99 · Por definir'],
] as const

const USOS = [
  ['G03', 'G03 · Gastos en general'],
  ['G01', 'G01 · Adquisición de mercancías'],
  ['I08', 'I08 · Otra maquinaria y equipo'],
  ['P01', 'P01 · Por definir'],
]

interface Pago { id: string; monto: number; moneda: string; fecha: string; descripcion: string; facturado: boolean; cfdiUuid: string | null; cfdiId: string | null }
interface Fiscales { rfc?: string; nombre?: string; regimenFiscal?: string; usoCfdi?: string; cp?: string; formaPago?: string }

export default function FacturacionSection({ clinicId }: { clinicId: string }) {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [disponible, setDisponible] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)   // pagoId con el form abierto
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')
  /**
   * LOS DATOS FISCALES NACEN VACÍOS. A PROPÓSITO.
   *
   * Venían pre-llenados con régimen 612 (persona FÍSICA con actividad
   * empresarial) y uso G03. Y la validación —cliente y servidor— sólo
   * comprobaba que no estuvieran vacíos, cosa que nunca ocurría. Una persona
   * moral que no tocaba los desplegables se facturaba con el régimen de una
   * persona física: el PAC lo rechaza (CFDI40157) o, peor, timbra y hay que
   * cancelar.
   *
   * Es la misma regla que la tabla de tarifas y el simulador: un default
   * silencioso en un campo que nadie eligió produce un dato que PARECE
   * correcto. Aquí además lo firma el SAT.
   */
  const [f, setF] = useState<Fiscales>({})

  const cargar = useCallback(() => {
    setCargando(true)
    fetchAutenticado(`/api/facturacion/pagos?clinicId=${encodeURIComponent(clinicId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setPagos(d.pagos || [])
          setDisponible(d.disponible !== false)
          if (d.datosFiscales) setF(prev => ({ ...prev, ...d.datosFiscales }))
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [clinicId])

  useEffect(() => { cargar() }, [cargar])

  const solicitar = async (pagoId: string) => {
    setMsg('')
    for (const k of ['rfc', 'nombre', 'regimenFiscal', 'usoCfdi', 'cp'] as const) {
      if (!String(f[k] ?? '').trim()) { setMsg('Completa todos los datos fiscales.'); return }
    }
    setEnviando(true)
    try {
      const r = await fetchAutenticado('/api/facturacion/solicitar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, pagoId, receptor: f }),
      })
      const d = await r.json()
      if (d.ok) { setAbierto(null); cargar() }
      else setMsg(d.error || 'No se pudo emitir la factura.')
    } catch { setMsg('Error de conexión.') } finally { setEnviando(false) }
  }

  const descargar = async (pagoId: string, tipo: 'pdf' | 'xml') => {
    try {
      const r = await fetchAutenticado(`/api/facturacion/descargar?clinicId=${encodeURIComponent(clinicId)}&pagoId=${encodeURIComponent(pagoId)}&tipo=${tipo}`)
      if (!r.ok) return
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `factura.${tipo}`; a.click()
      URL.revokeObjectURL(url)
    } catch { /* noop */ }
  }

  const inp: React.CSSProperties = { width: '100%', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }
  const lbl: React.CSSProperties = { fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        <ReceiptText size={17} style={{ color: 'var(--teal)' }} /> Facturas
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>
        ¿Necesitas factura de tus pagos? Pídela aquí — solo cuando la requieras.
      </div>

      {!disponible && (
        <div style={{ fontSize: 12.5, color: 'var(--text2)', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px' }}>
          La facturación electrónica aún no está habilitada. Escríbenos para solicitar tu factura.
        </div>
      )}

      {disponible && cargando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 13 }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando pagos…</div>
      )}

      {disponible && !cargando && pagos.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Aún no tienes pagos para facturar.</div>
      )}

      {disponible && !cargando && pagos.map(p => (
        <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 10, background: 'var(--s1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.descripcion}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{fecha(p.fecha)} · {mxn(p.monto)} {p.moneda}</div>
            </div>
            {p.facturado ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => descargar(p.id, 'pdf')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--nexus-solido)', color: '#FFF', border: 'none', borderRadius: 8, padding: '7px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}><Download size={13} /> PDF</button>
                <button onClick={() => descargar(p.id, 'xml')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><FileText size={13} /> XML</button>
              </div>
            ) : (
              <button onClick={() => { setAbierto(abierto === p.id ? null : p.id); setMsg('') }}
                style={{ background: abierto === p.id ? 'var(--s2)' : 'var(--nexus-solido)', color: abierto === p.id ? 'var(--text)' : '#FFF', border: abierto === p.id ? '1px solid var(--border)' : 'none', borderRadius: 8, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {abierto === p.id ? 'Cancelar' : 'Solicitar factura'}
              </button>
            )}
          </div>

          {abierto === p.id && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10 }}>
                <div><label style={lbl}>RFC</label><input value={f.rfc ?? ''} onChange={e => setF({ ...f, rfc: e.target.value.toUpperCase() })} placeholder="XAXX010101000" style={inp} /></div>
                <div><label style={lbl}>Razón social (como en el SAT)</label><input value={f.nombre ?? ''} onChange={e => setF({ ...f, nombre: e.target.value })} placeholder="Nombre o empresa" style={inp} /></div>
                <div><label style={lbl}>Código postal fiscal</label><input value={f.cp ?? ''} onChange={e => setF({ ...f, cp: e.target.value })} placeholder="00000" style={inp} /></div>
                <div><label style={lbl}>Régimen fiscal</label><select value={f.regimenFiscal ?? ''} onChange={e => setF({ ...f, regimenFiscal: e.target.value })} style={inp}><option value="">Elige tu régimen…</option>{REGIMENES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div><label style={lbl}>Uso del CFDI</label><select value={f.usoCfdi ?? ''} onChange={e => setF({ ...f, usoCfdi: e.target.value })} style={inp}><option value="">Elige el uso…</option>{USOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                {/*
                  FORMA DE PAGO: iba quemada como '04' (tarjeta de crédito) en
                  TODAS las facturas, se hubiera pagado por SPEI o por débito.
                  Descuadra contra el estado de cuenta y es motivo habitual de
                  cancelación. La elige quien sabe cómo se le cobró.
                */}
                <div><label style={lbl}>Forma de pago</label><select value={f.formaPago ?? ''} onChange={e => setF({ ...f, formaPago: e.target.value })} style={inp}><option value="">¿Cómo se pagó?…</option>{FORMAS_PAGO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              </div>
              {msg && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{msg}</div>}
              <button onClick={() => solicitar(p.id)} disabled={enviando}
                style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--nexus-solido)', color: '#FFF', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: enviando ? 'wait' : 'pointer' }}>
                {enviando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Timbrando…</> : 'Emitir factura'}
              </button>
              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 8 }}>Verifica que tus datos coincidan EXACTO con tu Constancia de Situación Fiscal — el SAT rechaza si no.</div>
            </div>
          )}
        </div>
      ))}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
