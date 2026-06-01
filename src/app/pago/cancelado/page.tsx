'use client'
import { XCircle } from 'lucide-react'
import Link from 'next/link'

export default function PagoCanceladoPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--s1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: '32px 28px', textAlign: 'center' }}>
        <XCircle size={48} color="#f87171" style={{ margin: '0 auto 16px' }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>Pago cancelado</h1>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 18px' }}>
          No se realizó ningún cargo. Tu cita sigue pendiente de pago. Puedes intentar de nuevo o comunicarte con el consultorio.
        </p>
        <Link href="/" style={{ color: 'var(--teal)', fontSize: 13, textDecoration: 'underline' }}>Volver al inicio</Link>
      </div>
    </div>
  )
}
