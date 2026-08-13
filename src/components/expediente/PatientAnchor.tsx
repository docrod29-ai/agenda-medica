'use client'
import { useMemo } from 'react'
import { AlertTriangle, Mic } from 'lucide-react'
import type { Patient } from '@/types'
import type { NotaMedica } from '@/types/expediente'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import { avatarColor } from '@/lib/avatar-color'

/**
 * PATIENT ANCHOR — V15-PATIENT-WORKSPACE-001 (§7: identidad, edad/sexo,
 * alergia/seguridad, encuentro actual, último cambio — SIEMPRE visible).
 *
 * Antes del expediente había DOS bloques sueltos e independientes en la parte
 * de arriba: el banner de alergias y el encabezado de identidad. El médico
 * tenía que conciliar dos avisos para una sola pregunta ("¿en qué paciente
 * estoy y qué necesito saber ya?"). Aquí es UN ancla, pegajosa (`sticky`)
 * dentro del contenedor de scroll real (`<main>` en el layout del dashboard,
 * `overflowY: auto`), así que no se pierde al bajar por el expediente largo.
 *
 * "Encuentro actual" y "último cambio" NO abren una consulta nueva a
 * Firestore: se derivan de `notas`, la MISMA lista que ya carga
 * `useExpediente` en la página — una entidad, una fuente de verdad.
 */
export function PatientAnchor({
  patient, notas, errorPaciente, onContinuarEncuentro,
}: {
  patient: Patient | null
  notas: NotaMedica[]
  errorPaciente?: string
  onContinuarEncuentro: (notaId: string) => void
}) {
  const { encuentroActivo, ultimoCambio } = useMemo(() => {
    const orden = [...notas].sort((a, b) =>
      (b.fechaConsulta || b.createdAt || '').localeCompare(a.fechaConsulta || a.createdAt || ''))
    return {
      // Un borrador sin firmar es un encuentro que empezó y no cerró — la
      // misma noción que ya usa CabosSueltosDelPaciente, leída aquí sin
      // duplicar su consulta.
      encuentroActivo: orden.find(n => n.estado !== 'firmada') ?? null,
      ultimoCambio: orden.find(n => n.estado === 'firmada') ?? null,
    }
  }, [notas])

  const alergiaTexto = (patient?.alergias ?? '').trim()
  const sinAlergias = !alergiaTexto || /^(ninguna|niega|no|sin|nkda|negad)/i.test(alergiaTexto)
  const colores = avatarColor(patient?.nombre ?? 'Paciente')

  return (
    <div className="nx-patient-anchor" style={{
      position: 'sticky', top: 0, zIndex: 4,
      background: 'var(--bg)', paddingTop: 10, paddingBottom: 12,
      marginBottom: 16, borderBottom: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: colores.bg, color: colores.fg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-display)',
        }}>
          {(patient?.nombre ?? 'P').charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* La página no tiene otro <h1>: el nombre del paciente es el
              encabezado de nivel 1 de todo el expediente (page-has-heading-one).
              Nivel DISPLAY, no .nx-ident de fila: VISUAL_DNA §1 R3 reserva la
              serif Fraunces para «el nombre del paciente en su espacio
              clínico» — y este ancla es exactamente ese espacio.
              `.nx-vt-paciente` (§20, continuidad.ts): en una navegación
              coreografiada este <h1> es el DESTINO del nombre que viene de la
              fila de Hoy — y el ORIGEN al continuar hacia la consulta. */}
          <h1 className="nx-display nx-ancla-nombre nx-vt-paciente">
            {patient?.nombre ?? 'Paciente'}
          </h1>
          <div className="nx-meta" style={{ marginTop: 2 }}>
            {patient?.edad ? `${patient.edad} años` : ''}{patient?.sexo ? ` · ${patient.sexo}` : ''}
            {patient?.telefono ? ` · ${patient.telefono}` : ''}
          </div>
        </div>
        {encuentroActivo && (
          <button
            className="nx-anchor-continuar"
            onClick={() => onContinuarEncuentro(encuentroActivo.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)',
              color: 'var(--amber)', borderRadius: 'var(--r-pill)', padding: '6px 12px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <Mic size={13} /> Consulta sin cerrar — continuar
          </button>
        )}
      </div>
      {/* Bajo 480px el nombre puede partirse en varias líneas: el CTA de
          "continuar" comparte fila con un bloque de ancho variable y queda
          apretado a media altura. Su propia fila completa evita eso sin
          tocar el orden DOM ni el layout de escritorio. */}
      <style>{`
        @media (max-width: 480px) {
          .nx-anchor-continuar { flex-basis: 100%; }
        }
      `}</style>

      {/* Ausencia de lectura ≠ ausencia de alergia (regla de seguridad clínica
          §4): si el paciente no se pudo LEER, se dice aquí en vez de pintar el
          aviso de alergias con datos que no llegaron. */}
      {errorPaciente ? (
        <div style={{
          ...alertaEstilo, color: 'var(--amber)',
          background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--amber) 40%, transparent)',
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {errorPaciente}
        </div>
      ) : (
        <div style={{
          ...alertaEstilo,
          color: sinAlergias ? 'var(--text2)' : 'var(--red)',
          background: sinAlergias ? 'var(--s2)' : 'color-mix(in srgb, var(--red) 12%, transparent)',
          borderColor: sinAlergias ? 'var(--border)' : 'color-mix(in srgb, var(--red) 35%, transparent)',
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          {/* Una alergia REGISTRADA es valor crítico (§2: peso + icono, nunca
              sólo color — el icono va al lado, en esta misma fila). «No
              registradas» NO lo es: es un dato del registro, se queda en el
              cuerpo neutro del aviso. */}
          <span className={sinAlergias ? undefined : 'nx-critico'}>
            <strong>Alergias:</strong> {alergiaTexto || 'no registradas'}
          </span>
          {ultimoCambio && (
            <span className="nx-meta" style={{ marginLeft: 'auto' }}>
              Último cambio: {TIPO_NOTA_LABEL[ultimoCambio.tipo]} · {formatoRelativo(ultimoCambio.fechaConsulta || ultimoCambio.createdAt)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function formatoRelativo(iso?: string): string {
  if (!iso) return '—'
  try {
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (dias <= 0) return 'hoy'
    if (dias === 1) return 'hace 1 día'
    if (dias < 30) return `hace ${dias} días`
    return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'medium' })
  } catch { return '—' }
}

const alertaEstilo: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8,
  padding: '9px 13px', fontSize: 12, border: '1px solid var(--border)', flexWrap: 'wrap',
}
