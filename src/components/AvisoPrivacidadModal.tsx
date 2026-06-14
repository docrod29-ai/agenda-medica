'use client'
/**
 * Modal para presentar el aviso de privacidad al paciente y registrar su aceptación.
 *
 * Cumple LFPDPPP Art. 16: consentimiento expreso para datos sensibles de salud.
 * El consentimiento se guarda en patient.avisoPrivacidad como snapshot legal.
 */
import { useState } from 'react'
import type { ClinicConfig } from '@/types'
import { generarAvisoPrivacidad, generarAvisoResumido, VERSION_AVISO } from '@/lib/aviso-privacidad'
import { X, Check, FileText, Download } from 'lucide-react'

export interface AvisoPrivacidadModalProps {
  config: ClinicConfig | null
  /** Llamado cuando el paciente acepta. medioAceptacion identifica cómo se aceptó. */
  onAceptar: (datos: { aceptado: boolean; fechaAceptacion: string; versionAviso: string; medioAceptacion: 'presencial' | 'portal' | 'whatsapp' | 'verbal' }) => void
  onCancelar: () => void
  /** Si el paciente está aceptando en el consultorio (default) o desde otro medio */
  medioInicial?: 'presencial' | 'portal' | 'whatsapp' | 'verbal'
}

export function AvisoPrivacidadModal({ config, onAceptar, onCancelar, medioInicial = 'presencial' }: AvisoPrivacidadModalProps) {
  const [verCompleto, setVerCompleto] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [medio, setMedio] = useState<'presencial' | 'portal' | 'whatsapp' | 'verbal'>(medioInicial)

  const textoCompleto = generarAvisoPrivacidad(config)
  const textoResumen = generarAvisoResumido(config)

  const aceptar = () => {
    if (!acepta) return
    onAceptar({
      aceptado: true,
      fechaAceptacion: new Date().toISOString(),
      versionAviso: VERSION_AVISO,
      medioAceptacion: medio,
    })
  }

  const descargarTexto = () => {
    const blob = new Blob([textoCompleto], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aviso-privacidad-${VERSION_AVISO}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg)', borderRadius: 14, maxWidth: 640, width: '100%',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={20} color="var(--teal)" />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Aviso de Privacidad</h2>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              LFPDPPP · Versión {VERSION_AVISO}
            </div>
          </div>
          <button onClick={onCancelar} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body con scroll */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {verCompleto ? (
            <pre style={{
              whiteSpace: 'pre-wrap', fontSize: 11.5, color: 'var(--text2)',
              fontFamily: 'system-ui, sans-serif', margin: 0, lineHeight: 1.6,
            }}>
              {textoCompleto}
            </pre>
          ) : (
            <>
              <div style={{
                fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.65,
                background: 'var(--s)', padding: 14, borderRadius: 8, marginBottom: 12,
              }}>
                {textoResumen}
              </div>
              <button
                onClick={() => setVerCompleto(true)}
                style={{
                  background: 'none', border: '1px solid var(--border)', color: 'var(--teal)',
                  borderRadius: 6, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <FileText size={14} className="ds-icon" /> Ver aviso completo (10 secciones)
              </button>
            </>
          )}

          <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,200,0,0.06)', border: '1px solid rgba(255,200,0,0.2)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 8 }}>
              ¿Cómo se está aceptando este aviso?
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(['presencial', 'verbal', 'whatsapp', 'portal'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMedio(m)}
                  style={{
                    padding: '6px 12px', borderRadius: 100, fontSize: 11.5, fontWeight: 600,
                    cursor: 'pointer', textTransform: 'capitalize',
                    background: medio === m ? 'var(--teal)' : 'var(--s2)',
                    color: medio === m ? '#000' : 'var(--text2)',
                    border: medio === m ? '1px solid var(--teal)' : '1px solid var(--border)',
                  }}
                >
                  {m === 'presencial' ? 'En consultorio' : m === 'verbal' ? 'Verbal' : m === 'whatsapp' ? 'Por WhatsApp' : 'Portal web'}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14, cursor: 'pointer', padding: 12, background: 'var(--s)', borderRadius: 8 }}>
            <input
              type="checkbox"
              checked={acepta}
              onChange={(e) => setAcepta(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--teal)', cursor: 'pointer', marginTop: 1 }}
            />
            <span style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>
              <strong>El paciente</strong> manifiesta haber leído y comprendido el aviso de privacidad,
              y otorga su <strong>consentimiento expreso</strong> para el tratamiento de sus datos
              personales y datos sensibles de salud, conforme al Art. 9 de la LFPDPPP.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={descargarTexto}
            style={{
              background: 'none', border: 'none', color: 'var(--text3)',
              fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <Download size={12} /> Descargar PDF/texto
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancelar} className="btn btn-secondary">
              Cancelar
            </button>
            <button onClick={aceptar} disabled={!acepta} className="btn btn-primary">
              <Check size={14} /> Aceptar y continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
