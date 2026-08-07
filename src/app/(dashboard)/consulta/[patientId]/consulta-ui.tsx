'use client'
/**
 * Subcomponentes presentacionales de la consulta (extraídos del monolito page.tsx).
 * - DialogoDiarizado: diálogo separado por voz con etiquetado de roles.
 * - Section: encabezado de sección con ícono/obligatorio.
 * - S: objeto de estilos compartido del formulario de consulta.
 * Puro/presentacional; sin estado compartido con el padre.
 */
import React, { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'

// ── Subcomponentes ─────────────────────────────────────────────
// Paleta estable por hablante (A, B, C…) para diferenciar voces visualmente.
const COLOR_HABLANTE = ['#3D5AFE', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4']
function colorHablante(speaker: string): string {
  const idx = speaker.charCodeAt(0) - 65 // 'A' → 0
  return COLOR_HABLANTE[((idx % COLOR_HABLANTE.length) + COLOR_HABLANTE.length) % COLOR_HABLANTE.length]
}

/** Diálogo separado por voz (diarización). El médico puede etiquetar cada voz
 *  (Médico/Paciente/Acompañante) de un toque; es material de origen. */
export function DialogoDiarizado({ utterances, rolesIniciales, onRolesChange }: {
  utterances: { speaker: string; text: string }[]
  rolesIniciales?: Record<string, string>
  /**
   * Sin esto la corrección se quedaba encerrada aquí: cambiaba los colores y
   * nada más. La nota se arma con los roles que vive la PÁGINA, así que si la
   * IA invirtió médico y paciente y el médico lo corregía, al reprocesar la nota
   * salía igual de invertida.
   */
  onRolesChange?: (roles: Record<string, string>) => void
}) {
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [tocado, setTocado] = useState(false)  // el médico ya corrigió a mano → no pisar
  // Siembra los roles que asignó la IA en cuanto llegan (sin pisar correcciones manuales).
  useEffect(() => {
    if (tocado || !rolesIniciales || Object.keys(rolesIniciales).length === 0) return
    setRoles(rolesIniciales)
  }, [rolesIniciales, tocado])
  const hablantes = Array.from(new Set(utterances.map(u => u.speaker)))
  const ROLES = ['Médico', 'Paciente', 'Acompañante']
  const etiqueta = (s: string) => roles[s] || `Hablante ${s}`
  const autoAsignado = !tocado && rolesIniciales && Object.keys(rolesIniciales).length > 0

  return (
    <div style={{ marginTop: 4 }}>
      {autoAsignado && (
        <div style={{ fontSize: 10.5, color: 'var(--teal)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Sparkles size={11} /> Médico y paciente asignados automáticamente · toca para corregir si hace falta
        </div>
      )}
      {/* Asignar quién es cada voz */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {hablantes.map(s => {
          const c = colorHablante(s)
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: c, background: `color-mix(in srgb, ${c} 12%, transparent)`, borderRadius: 6, padding: '2px 8px' }}>
                Hablante {s}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>es:</span>
              {ROLES.map(r => {
                const activo = roles[s] === r
                return (
                  <button key={r} type="button" onClick={() => {
                      setTocado(true)
                      setRoles(p => {
                        const next = { ...p, [s]: r }
                        onRolesChange?.(next)   // que llegue a la nota, no solo al color
                        return next
                      })
                    }}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
                      border: '1px solid ' + (activo ? c : 'var(--border)'),
                      background: activo ? `color-mix(in srgb, ${c} 13%, transparent)` : 'var(--s2)',
                      color: activo ? c : 'var(--text3)',
                    }}>
                    {r}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Diálogo con el rol asignado */}
      <div style={{ maxHeight: 260, overflow: 'auto', display: 'grid', gap: 8 }}>
        {utterances.map((u, i) => {
          const c = colorHablante(u.speaker)
          return (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <span style={{
                flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: c,
                background: `color-mix(in srgb, ${c} 12%, transparent)`, borderRadius: 6, padding: '2px 7px', height: 'fit-content',
              }}>
                {etiqueta(u.speaker)}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{u.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * `id` existe para que la barra «Antes de firmar» pueda llevar al médico al
 * sitio del problema con un clic, en vez de dejarlo buscando (REG-181).
 */
export function Section({ id, title, icon, obligatorio, children }: { id?: string; title: string; icon?: React.ReactNode; obligatorio?: boolean; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ color: 'var(--teal)' }}>{icon}</span>}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        {obligatorio && <span style={{ color: 'var(--red)', fontSize: 13 }}>*</span>}
      </div>
      {children}
    </div>
  )
}

export const S = {
  back: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', marginBottom: 14, padding: 0 } as React.CSSProperties,
  alergia: { display: 'flex', alignItems: 'center', gap: 8, background: 'color-mix(in srgb, var(--red) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 } as React.CSSProperties,
  firmadaBadge: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(61,90,254,0.12)', color: 'var(--teal)', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 'var(--r-pill)' } as React.CSSProperties,
  grabCard: { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 20 } as React.CSSProperties,
  transcripcion: { width: '100%', marginTop: 14, minHeight: 100, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, resize: 'vertical', outline: 'none' } as React.CSSProperties,
  resumen: { display: 'flex', gap: 8, background: 'rgba(61,90,254,0.06)', border: '1px solid rgba(61,90,254,0.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 18 } as React.CSSProperties,
  textarea: { width: '100%', minHeight: 70, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 13, color: 'var(--text)', lineHeight: 1.6, resize: 'vertical', outline: 'none' } as React.CSSProperties,
  input: { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' } as React.CSSProperties,
  miniLabel: { fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 3 } as React.CSSProperties,
  miniInput: { width: '100%', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', fontSize: 13, color: 'var(--text)', outline: 'none' } as React.CSSProperties,
  row: { display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' } as React.CSSProperties,
  del: { background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 6, flexShrink: 0 } as React.CSSProperties,
  addBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--s2)', border: '1px dashed var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' } as React.CSSProperties,
  chip: (a: boolean): React.CSSProperties => ({ background: a ? 'var(--teal)' : 'var(--s2)', color: a ? '#000' : 'var(--text2)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }),
  iaBtn: (d: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 7, background: d ? 'var(--s3)' : 'var(--nexus-solido)', color: d ? 'var(--text3)' : '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: d ? 'default' : 'pointer', letterSpacing: '-0.005em' }),
  valBox: (t: 'error' | 'warn'): React.CSSProperties => ({ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6, background: t === 'error' ? 'color-mix(in srgb, var(--red) 8%, transparent)' : 'color-mix(in srgb, var(--amber) 8%, transparent)', border: `1px solid ${t === 'error' ? 'color-mix(in srgb, var(--red) 25%, transparent)' : 'color-mix(in srgb, var(--amber) 25%, transparent)'}`, color: t === 'error' ? '#f87171' : '#f59e0b', borderRadius: 8, padding: '12px 14px', fontSize: 12.5 }),
  firmar: (d: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 8, background: d ? 'var(--s3)' : 'var(--teal)', color: d ? 'var(--text3)' : '#000', border: 'none', borderRadius: 10, padding: '13px 22px', fontSize: 15, fontWeight: 700, cursor: d ? 'default' : 'pointer' }),
  guardar: { background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 10, padding: '13px 18px', fontSize: 14, cursor: 'pointer' } as React.CSSProperties,
  descartar: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', color: 'var(--red)', borderRadius: 10, padding: '13px 16px', fontSize: 14, cursor: 'pointer' } as React.CSSProperties,
}
