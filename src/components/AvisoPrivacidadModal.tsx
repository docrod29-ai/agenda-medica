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
import { Check, FileText, Download } from 'lucide-react'
import { Modal, Button } from '@/components/ui'
import { sha256Hex } from '@/lib/expediente/integrity'

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

  const aceptar = async () => {
    if (!acepta) return
    // Huella del texto EXACTO que se le enseñó (ver el tipo). Si el hash falla
    // —navegador sin crypto.subtle en contexto inseguro— se acepta igual sin
    // huella: un consentimiento sin huella vale más que ninguno.
    let hashTexto: string | undefined
    try { hashTexto = await sha256Hex(textoCompleto) } catch { hashTexto = undefined }
    onAceptar({
      aceptado: true,
      fechaAceptacion: new Date().toISOString(),
      versionAviso: VERSION_AVISO,
      medioAceptacion: medio,
      ...(hashTexto ? { hashTexto } : {}),
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
    <Modal
      open
      onClose={onCancelar}
      size="wide"
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <FileText size={18} color="var(--teal)" />
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            Aviso de Privacidad
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>LFPDPPP · Versión {VERSION_AVISO}</span>
          </span>
        </span>
      )}
      footer={(
        <>
          {/*
            ZC-008 — el botón decía «Descargar PDF/texto» y bajaba un `.txt`.
            Nombra el formato que entrega: el contenido legal es exactamente el
            mismo cuyo SHA-256 se sella, así que lo que sobraba era la promesa.
          */}
          <Button variant="ghost" size="sm" icon={<Download size={12} />} onClick={descargarTexto} style={{ marginRight: 'auto' }}>Descargar texto</Button>
          <Button variant="secondary" onClick={onCancelar}>Cancelar</Button>
          <Button onClick={aceptar} disabled={!acepta} icon={<Check size={14} />}>Aceptar y continuar</Button>
        </>
      )}
    >
        <div>
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

          {/* ZC-009 — el ámbar sale de los tokens; el hex a mano no seguía al tema. */}
          <div style={{
            marginTop: 16, padding: 12, borderRadius: 8,
            background: 'color-mix(in srgb, var(--amber) 7%, transparent)',
            border: '1px solid color-mix(in srgb, var(--amber) 25%, transparent)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>
              ¿Cómo se está aceptando este aviso?
            </div>
            {/*
              Se retiró la opción "Verbal". Los datos de salud son datos SENSIBLES
              y el Art. 9 de la LFPDPPP pide consentimiento expreso y POR ESCRITO:
              firma autógrafa, firma electrónica o algún mecanismo de autenticación
              del titular. El propio aviso que genera el sistema cita ese artículo
              y termina con un bloque de firma; ofrecer "verbal" contradecía en el
              formulario lo que el documento promete.
            */}
            <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 9 }}>
              Los datos de salud son datos sensibles: el consentimiento debe quedar por escrito
              (Art. 9 LFPDPPP). Un &ldquo;sí&rdquo; de palabra no basta.
            </div>
            {/*
              ZC-009 — DESDE EL ESCRITORIO SÓLO SE PUEDE ASENTAR LO QUE PASÓ AQUÍ.
              ─────────────────────────────────────────────────────────────────
              Este modal dejaba asentar «Aceptado en el portal» y «Aceptado por
              WhatsApp» sin ninguna referencia a ese hecho: la fecha era la del
              clic del personal y la huella, la del texto que vio el PERSONAL, no
              el paciente.
              El agravante, que el equipo rojo verificó, es que esos dos medios
              tienen un camino REAL que los origina con evidencia —el portal sella
              `medioAceptacion: 'portal'` en el servidor con su propio hash, y el
              bot de WhatsApp sella `'whatsapp'`—, así que el mismo valor podía
              venir de un evento comprobable o de un clic del mostrador, y en el
              expediente quedaban indistinguibles.
              Desde aquí sólo queda lo que esta pantalla puede atestiguar: que se
              firmó en papel, delante de quien lo está registrando. Los otros dos
              medios siguen existiendo — los escribe quien los presencia, que es
              el servidor.
            */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Cómo se aceptó el aviso">
              {(['presencial'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMedio(m)}
                  /* Sin `aria-pressed` un lector de pantalla no sabía cuál estaba
                     elegido: el estado sólo se decía con el color. */
                  aria-pressed={medio === m}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--r-pill)', fontSize: 11.5, fontWeight: 600,
                    cursor: 'pointer', textTransform: 'capitalize', minHeight: 44,
                    background: medio === m ? 'var(--teal)' : 'var(--s2)',
                    color: medio === m ? '#000' : 'var(--text2)',
                    border: medio === m ? '1px solid var(--teal)' : '1px solid var(--border)',
                  }}
                >
                  Firmado en papel, aquí
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, marginTop: 8 }}>
              «Aceptado en el portal» y «Aceptado por WhatsApp» ya no se asientan desde aquí:
              los escribe el propio portal o el bot cuando el paciente acepta, con la fecha y
              la huella de lo que él vio. Desde esta pantalla sólo se registra lo que ocurre
              delante de ti.
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
    </Modal>
  )
}
