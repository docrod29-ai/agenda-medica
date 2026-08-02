'use client'
import { useState, useMemo } from 'react'
import { PageHeader, Button } from '@/components/ui'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { generarAvisoPrivacidad } from '@/lib/aviso-privacidad'
import { generarContratoEncargo } from '@/lib/contrato-encargo'
import { copyToClipboard } from '@/lib/whatsapp'
import Link from 'next/link'
import { FileText, Copy, Download, Printer, AlertTriangle, Settings } from 'lucide-react'

type Doc = 'aviso' | 'contrato'

export default function LegalPage() {
  const { config } = useConfig()
  const { toast } = useToast()
  const [doc, setDoc] = useState<Doc>('aviso')

  const texto = useMemo(
    () => doc === 'aviso' ? generarAvisoPrivacidad(config ?? null) : generarContratoEncargo(config ?? null),
    [doc, config],
  )

  const faltanDatos = !config?.razonSocial || !config?.rfc || !config?.correoArco

  const copiar = async () => {
    try { await copyToClipboard(texto); toast('Documento copiado', 'success') }
    catch { toast('No se pudo copiar', 'error') }
  }
  const descargar = () => {
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc === 'aviso' ? 'aviso-privacidad' : 'contrato-encargo'}.txt`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <PageHeader
        title="Documentos legales"
        subtitle="Tu aviso de privacidad y contrato de encargo, generados con los datos de tu consultorio."
        actions={
          <div style={{ display: 'flex', gap: 8 }} className="no-print">
            <Button variant="secondary" icon={<Copy size={15} />} onClick={copiar}>Copiar</Button>
            <Button variant="secondary" icon={<Download size={15} />} onClick={descargar}>Descargar</Button>
            <Button icon={<Printer size={15} />} onClick={() => window.print()}>Imprimir</Button>
          </div>
        }
      />

      {/* Aviso legal importante */}
      <div className="no-print" style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 10, background: 'color-mix(in srgb, var(--amber) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--amber) 25%, transparent)', marginBottom: 16 }}>
        <AlertTriangle size={18} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
          Estos documentos son un <strong>borrador base</strong> conforme a la LFPDPPP. Antes de usarlos con
          pacientes o firmarlos, conviene que un <strong>asesor legal</strong> los revise. Tú eres el responsable
          del tratamiento de datos de tus pacientes.
        </div>
      </div>

      {/* Faltan datos */}
      {faltanDatos && (
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--border)', marginBottom: 16 }}>
          <Settings size={16} style={{ color: 'var(--nexus)', flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: 'var(--text2)', flex: 1 }}>
            Faltan datos fiscales (razón social, RFC o correo ARCO). El documento usa marcadores hasta que los completes.
          </div>
          <Link href="/configuracion" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>Completar</Link>
        </div>
      )}

      {/* Selector de documento */}
      <div className="no-print" style={{ display: 'inline-flex', gap: 4, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 100, padding: 4, marginBottom: 16 }}>
        {([['aviso', 'Aviso de privacidad'], ['contrato', 'Contrato de encargo']] as [Doc, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setDoc(k)}
            style={{
              border: 'none', cursor: 'pointer', borderRadius: 100, padding: '7px 16px', fontSize: 13, fontWeight: 700,
              background: doc === k ? 'var(--nexus)' : 'transparent',
              color: doc === k ? '#fff' : 'var(--text3)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Documento */}
      <div id="legal-print" className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }} className="no-print">
          <FileText size={16} style={{ color: 'var(--nexus)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {doc === 'aviso' ? 'Aviso de privacidad integral' : 'Contrato de encargo de tratamiento de datos'}
          </span>
        </div>
        <pre style={{
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 12.5, lineHeight: 1.6, color: 'var(--text)', margin: 0,
        }}>{texto}</pre>
      </div>

      <style>{`
        @media print {
          .no-print, .mobile-topbar, .bottom-nav-wrap, aside, nav { display: none !important; }
          #legal-print { border: none !important; padding: 0 !important; }
          #legal-print pre { color: #000 !important; font-size: 11px !important; }
        }
      `}</style>
    </div>
  )
}
