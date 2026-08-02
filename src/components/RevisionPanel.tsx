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
import { useState, useMemo, useEffect } from 'react'
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
  alergia_conflicto?: Array<{ alergeno?: string; farmaco_sugerido?: string; riesgo_cruzado?: string; alternativa_segura?: string }>
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
  const [verSeguros, setVerSeguros] = useState(false)

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
  // Lo que el MODELO vio cruzando alergias y fármacos. No es la compuerta —esa
  // es determinista y bloquea la firma—; es información que antes se perdía.
  const crucesAlergia = (safety?.alergia_conflicto ?? []).filter(c => c.alergeno || c.farmaco_sugerido)
  const faltantesCriticos = safety?.missing_critical_fields ?? []
  const requierenRevision = items.filter(i => i.campo.needs_review || i.critico)
  const seguros = items.filter(i => !i.campo.needs_review && !i.critico)

  // TODO ENTRA POR DEFECTO. El trabajo del médico es QUITAR lo que no corresponda,
  // no confirmar uno por uno lo que sí.
  //
  // Por qué: aprobar campo por campo NO condicionaba nada — ni la firma ni la
  // trazabilidad, porque firmar ya marca la nota como revisada por humano. Eran
  // clics que costaban tiempo frente al paciente sin comprar ninguna garantía.
  // Lo que sí protege al paciente es que los datos delicados se VEAN, y para eso
  // van resaltados arriba.
  useEffect(() => {
    const nuevos = items.filter(i => !aprobados.has(i.id))
    nuevos.forEach(it => onAprobar(it.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  if (items.length === 0 && conflictos.length === 0 && faltantesCriticos.length === 0 && crucesAlergia.length === 0) {
    return null
  }

  // Render de un campo (se reutiliza para críticos y seguros)
  const renderItem = ({ id, label, campo, critico }: { id: string; label: string; campo: CampoAuditado; critico?: boolean }) => {
    const aprobado = aprobados.has(id)
    const conf = campo.confidence ?? 'baja'
    const isCrit = critico || campo.needs_review
    return (
      <div key={id} style={{
        background: aprobado ? (isCrit ? 'rgba(245,158,11,0.06)' : 'var(--s2)') : 'rgba(239,68,68,0.05)',
        border: `1px solid ${!aprobado ? 'rgba(239,68,68,0.3)' : isCrit ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`,
        opacity: aprobado ? 1 : 0.6,
        borderRadius: 8, padding: '8px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: CONF_COLOR[conf], flexShrink: 0 }} title={`Confianza: ${conf}`} />
          <span style={{ fontSize: 12.5, color: 'var(--text)', flex: 1, minWidth: 120, textDecoration: aprobado ? 'none' : 'line-through' }}>
            <strong>{label}:</strong> {String(campo.value ?? '—') || '—'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--s3)', padding: '2px 6px', borderRadius: 4 }}>
            {HABLANTE_LABEL[campo.speaker ?? 'desconocido']}
          </span>
          {critico && <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>CRÍTICO</span>}
          <button onClick={() => setVerFuente(verFuente === id ? null : id)}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 8, minHeight: 32, minWidth: 32, justifyContent: 'center' }} title="Ver la frase del dictado de donde salió">
            {verFuente === id ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          {aprobado ? (
            <button onClick={() => onRechazar(id)} title="Quitar de la nota"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)', borderRadius: 6, padding: '6px 10px', fontSize: 11.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, minHeight: 32 }}>
              <X size={12} /> Quitar
            </button>
          ) : (
            <button onClick={() => onAprobar(id)} title="Volver a incluir en la nota"
              style={{ background: 'var(--teal)', border: 'none', color: '#000', borderRadius: 6, padding: '6px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, minHeight: 32 }}>
              <Check size={12} /> Regresar
            </button>
          )}
        </div>
        {verFuente === id && (
          <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--s3)', borderRadius: 6, fontSize: 11.5, color: 'var(--text2)', fontStyle: 'italic' }}>
            {campo.source_quote ? `"${campo.source_quote}"` : '(sin cita textual)'}
            {campo.reason && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--amber)', fontStyle: 'normal', display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} className="ds-icon" /> {campo.reason}</div>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--s1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 12,
      padding: 16, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Sparkles size={16} color="#60a5fa" />
        <strong style={{ fontSize: 14, color: 'var(--text)' }}>Extraído de tu dictado</strong>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#4ade80', fontWeight: 600 }}>
          {aprobados.size} en la nota
        </span>
      </div>
      {/* Nada que aprobar: todo entra. El médico solo quita lo que sobre. */}
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.5 }}>
        Todo esto ya está en la nota. <strong style={{ color: 'var(--text2)' }}>No tienes que aprobar nada</strong> — solo quita lo que no corresponda.
        {requierenRevision.length > 0 && (
          <> Los <strong style={{ color: 'var(--amber)' }}>{requierenRevision.length}</strong> datos delicados van arriba para que les des un vistazo.</>
        )}
      </div>

      {/* Conflictos detectados */}
      {conflictos.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--red)', fontWeight: 600, marginBottom: 4 }}>
            <ShieldAlert size={14} /> Conflictos detectados
          </div>
          {conflictos.map((c, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>• {c}</div>)}
        </div>
      )}

      {crucesAlergia.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--red)', fontWeight: 600, marginBottom: 4 }}>
            <ShieldAlert size={14} /> Cruce alergia ↔ medicamento
          </div>
          {crucesAlergia.map((c, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>
              • {c.alergeno || '—'} con {c.farmaco_sugerido || '—'}
              {c.riesgo_cruzado ? ` — ${c.riesgo_cruzado}` : ''}
              {c.alternativa_segura ? ` · alternativa mencionada: ${c.alternativa_segura}` : ''}
            </div>
          ))}
        </div>
      )}

      {/* Faltantes críticos */}
      {faltantesCriticos.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--amber)', fontWeight: 600, marginBottom: 4 }}>
            <AlertTriangle size={14} /> Datos críticos no documentados
          </div>
          {faltantesCriticos.map((c, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>• {c}</div>)}
        </div>
      )}

      {/* 1) Lo que REQUIERE atención del médico (críticos / dudosos) — arriba */}
      {requierenRevision.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {requierenRevision.map(renderItem)}
        </div>
      )}

      {/* 2) El resto: entra solo, colapsado. Se abre si el médico quiere revisarlo. */}
      {seguros.length > 0 && (
        <div>
          <button onClick={() => setVerSeguros(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', padding: '8px 0', minHeight: 44 }}>
            <ShieldCheck size={14} color="#4ade80" />
            {verSeguros
              ? `Ocultar los otros ${seguros.length} datos`
              : `Otros ${seguros.length} datos incluidos — ver por si algo sobra`}
          </button>
          {verSeguros && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {seguros.map(renderItem)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
