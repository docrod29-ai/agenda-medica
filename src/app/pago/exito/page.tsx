'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'

export default function PagoExitoPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <Inner />
    </Suspense>
  )
}

function Inner() {
  const params = useSearchParams()
  const citaId = params.get('cita') ?? ''
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--s1)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)', borderRadius: 16, padding: '32px 28px', textAlign: 'center' }}>
        <CheckCircle2 size={48} color="#4ade80" style={{ margin: '0 auto 16px' }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>¡Pago recibido!</h1>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 18px' }}>
          Tu pago fue procesado con éxito. Tu cita queda confirmada. Te enviaremos un recordatorio 24 horas antes por WhatsApp.
        </p>
        {citaId && (
          <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', margin: 0 }}>Ref: {citaId.slice(0, 10)}</p>
        )}
      </div>
    </div>
  )
}
