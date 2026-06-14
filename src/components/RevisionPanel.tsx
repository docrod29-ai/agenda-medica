'use client'
/**
 * Panel de Revisión IA — auditable por campo.
 *
 * Muestra los datos extraídos por la IA con confianza, hablante y fuente.
 * Permite al médico aprobar / rechazar cada campo antes de que se
 * persistan como parte de la nota.
 *
 * Reglas de UX:
 *  - Dato crítico (alergia, dosis, Dx grave, antibiótico, anticoagulante)
 *    SIEMPRE necesita aprobación explícita.
 *  - Confianza baja → marcado en amarillo.
 *  - Conflicto detectado → bandera roja.
 *  - "Ver fuente" abre el fragmento textual de la transcripción.
 */
import { useState, useMemo } from 'react'
import { Check, X, AlertTriangle, Eye, EyeOff, Sparkles, ShieldCheck, ShieldAlert } from 'lucide-react'
import type { CampoAuditado, Confianza, Hablante } from '@/lib/expediente/extraction-schema'

interface ExtractionBlock {
  resumenEjecutivo?: CampoAuditado
  secciones?: Record<string, CampoAuditado>
  diagnosticos?: Array<Record<string, unknown>>
  medicamentos?: Array<Record<string, unknown>>
  alergias?: Array<Record<string, unknown>>
  signosVitales?: Record<string, CampoAuditado>
}
interface SafetyBlock {
  fields_auto_filled?: string[]
  fields_requiring_review?: string[]
  conflicts_detected?: string[]
  missing_critical_fields?: string[]
}

interface Props {
  extraction?: ExtractionBlock
  safety?: SafetyBlock
  /** ids de campos aprobados explícitamente por el médico */
  aprobados: Set<string>
  onAprobar: (id: string) => void
  onRechazar: (id: string) => void
}

const CONF_COLOR: Record<Confianza, string> = { alta: '#4ade80', media: '#f59e0b', baja: '#f87171' }
const HABLANTE_LABEL: Record<Hablante, string> = {
  medico: 'Médico', paciente: 'Paciente', acompanante: 'Acompañante', desconocido: '—',
}

export function RevisionPanel({ extraction, safety, aprobados, onAprobar, onRechazar }: Props) {
  const [verFuente, setVerFuente] = useState<string | null>(null)

  // Aplanar todos los campos auditables a una lista única
  const items = useMemo(() => {
    const out: { id: string; label: string; campo: CampoAuditado; critico?: boolean }[] = []
    if (!extraction) return out
    if (extraction.resumenEjecutivo) out.push({ id: 'resumen', label: 'Resumen ejecutivo', campo: extraction.resumenEjecutivo })
    if (extraction.secciones) {
      for (const [k, v] of Object.entries(extraction.secciones)) {
        out.push({ id: `sec:${k}`, label: k, campo: v })
      }
    }
    if (extraction.signosVitales) {
      for (const [k, v] of Object.entries(extraction.signosVitales)) {
        if (v && (v.value !== null && v.value !== '')) {
          out.push({ id: `sv:${k}`, label: `Signo vital: ${k.toUpperCase()}`, campo: v })
        }
      }
    }
    extraction.diagnosticos?.forEach((d, i) => {
      const campo: CampoAuditado = {
        value: String(d.descripcion ?? ''),
        confidence: (d.confidence as Confianza) ?? 'baja',
        source_quote: String(d.source_quote ?? ''),
        speaker: (d.speaker as Hablante) ?? 'desconocido',
        needs_review: Boolean(d.needs_review),
        reason: String(d.reason ?? ''),
      }
      out.push({ id: `dx:${i}`, label: `Diagnóstico: ${d.descripcion ?? '—'}`, campo, critico: ['definitivo'].includes(String(d.tipo)) })
    })
    extraction.medicamentos?.forEach((m, i) => {
      const campo: CampoAuditado = {
        value: `${m.nombre ?? ''} ${m.dosis ?? ''}`.trim(),
        confidence: (m.confidence as Confianza) ?? 'baja',
        source_quote: String(m.source_quote ?? ''),
        speaker: (m.speaker as Hablante) ?? 'desconocido',
        needs_review: Boolean(m.needs_review),
        reason: String(m.reason ?? ''),
      }
      out.push({ id: `med:${i}`, label: `Medicamento: ${m.nombre ?? '—'}`, campo, critico: true })
    })
    extraction.alergias?.forEach((a, i) => {
      const campo: CampoAuditado = {
        value: `${a.alergeno ?? ''}${a.reaccion ? ` — ${a.reaccion}` : ''}`,
        confidence: (a.confidence as Confianza) ?? 'baja',
        source_quote: String(a.source_quote ?? ''),
        speaker: (a.speaker as Hablante) ?? 'desconocido',
        needs_review: Boolean(a.needs_review),
        reason: String(a.reason ?? 'Dato crítico'),
      }
      out.push({ id: `alg:${i}`, label: `Alergia: ${a.alergeno ?? '—'}`, campo, critico: true })
    })
    return out
  }, [extraction])

  const conflictos = safety?.conflicts_detected ?? []
  const faltantesCriticos = safety?.missing_critical_fields ?? []
  const requierenRevision = items.filter(i => i.campo.needs_review || i.critico)
  const seguros = items.filter(i => !i.campo.needs_review && !i.critico)

  if (items.length === 0 && conflictos.length === 0 && faltantesCriticos.length === 0) {
    return null
  }

  const aprobarTodosSeguros = () => {
    seguros.forEach(it => { if (!aprobados.has(it.id)) onAprobar(it.id) })
  }

  return (
    <div style={{
      background: 'var(--s1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 12,
      padding: 16, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Sparkles size={16} color="#60a5fa" />
        <strong style={{ fontSize: 14, color: 'var(--text)' }}>Revisión IA — apruebe campo por campo</strong>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>
          {aprobados.size}/{items.length} aprobados
        </span>
      </div>

      {/* Conflictos detectados */}
      {conflictos.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#f87171', fontWeight: 600, marginBottom: 4 }}>
            <ShieldAlert size={14} /> Conflictos detectados
          </div>
          {conflictos.map((c, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>• {c}</div>)}
        </div>
      )}

      {/* Faltantes críticos */}
      {faltantesCriticos.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#f59e0b', fontWeight: 600, marginBottom: 4 }}>
            <AlertTriangle size={14} /> Datos críticos no documentados
          </div>
          {faltantesCriticos.map((c, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>• {c}</div>)}
        </div>
      )}

      {/* Aprobar todos los seguros */}
      {seguros.length > 0 && (
        <button onClick={aprobarTodosSeguros}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 10 }}>
          <ShieldCheck size={13} /> Aprobar los {seguros.length} campos seguros
        </button>
      )}

      {/* Lista de campos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(({ id, label, campo, critico }) => {
          const aprobado = aprobados.has(id)
          const conf = campo.confidence ?? 'baja'
          const isCrit = critico || campo.needs_review

          return (
            <div key={id} style={{
              background: aprobado ? 'rgba(74,222,128,0.05)' : 'var(--s2)',
              border: `1px solid ${aprobado ? 'rgba(74,222,128,0.3)' : isCrit ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`,
              borderRadius: 8, padding: '8px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CONF_COLOR[conf], flexShrink: 0 }} title={`Confianza: ${conf}`} />
                <span style={{ fontSize: 12.5, color: 'var(--text)', flex: 1, minWidth: 120 }}>
                  <strong>{label}:</strong> {String(campo.value ?? '—') || '—'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--s3)', padding: '2px 6px', borderRadius: 4 }}>
                  {HABLANTE_LABEL[campo.speaker ?? 'desconocido']}
                </span>
                {critico && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>CRÍTICO</span>}
                <button onClick={() => setVerFuente(verFuente === id ? null : id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', padding: 2 }} title="Ver fuente">
                  {verFuente === id ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                {aprobado ? (
                  <button onClick={() => onRechazar(id)}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <X size={11} /> Quitar
                  </button>
                ) : (
                  <button onClick={() => onAprobar(id)}
                    style={{ background: 'var(--teal)', border: 'none', color: '#000', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Check size={11} /> Aprobar
                  </button>
                )}
              </div>
              {verFuente === id && (
                <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--s3)', borderRadius: 6, fontSize: 11.5, color: 'var(--text2)', fontStyle: 'italic' }}>
                  {campo.source_quote ? `"${campo.source_quote}"` : '(sin cita textual)'}
                  {campo.reason && <div style={{ marginTop: 4, fontSize: 11, color: '#f59e0b', fontStyle: 'normal', display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} className="ds-icon" /> {campo.reason}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
