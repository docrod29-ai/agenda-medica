'use client'
/**
 * «Confirma tu correo» — el aviso que faltaba.
 *
 * ── POR QUÉ IMPORTA MÁS DE LO QUE PARECE ─────────────────────────────────────
 *
 * No existía verificación de correo en ninguna parte del producto. Si el médico
 * teclea mal su dirección al registrarse, la cuenta se crea, el consultorio se
 * crea, empieza a trabajar… y el día que pierda la contraseña, el correo de
 * recuperación va a una dirección que no existe.
 *
 * A partir de ahí no hay forma de recuperar la cuenta sin soporte humano — y el
 * producto entero está construido sobre la promesa de que un médico nuevo puede
 * arrancar solo. Además, en su expediente hay datos de sus pacientes.
 *
 * ── POR QUÉ NO BLOQUEA ───────────────────────────────────────────────────────
 *
 * Impedir el acceso hasta verificar cambiaría la promesa comercial del alta, y
 * ésa es una decisión del dueño, no mía. Aquí se avisa y se ofrece reenviar:
 * suficiente para que el error se detecte el primer día, cuando todavía no
 * cuesta nada arreglarlo.
 *
 * Las cuentas de Google entran ya verificadas, así que a ésas no se les molesta.
 */
import { useState } from 'react'
import { sendEmailVerification } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { MailWarning } from 'lucide-react'

export function AvisoCorreoSinVerificar() {
  const { user } = useAuth()
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  // `emailVerified` es false también mientras carga la sesión: se exige `user`.
  if (!user || user.emailVerified) return null

  const reenviar = async () => {
    if (!auth.currentUser) return
    setEnviando(true); setError('')
    try {
      await sendEmailVerification(auth.currentUser)
      setEnviado(true)
    } catch {
      setError('No se pudo enviar. Inténtalo en un momento.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div role="status" style={{
      padding: '10px 16px', background: 'var(--s2)', borderBottom: '1px solid var(--amber)',
      fontSize: 13, color: 'var(--text2)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
    }}>
      <MailWarning size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />
      <span>
        Confirma tu correo <strong>{user.email}</strong>. Si está mal escrito, no podrás
        recuperar tu cuenta si pierdes la contraseña.
      </span>
      {enviado ? (
        <span style={{ color: 'var(--text3)' }}>Te reenviamos el correo. Revisa también el correo no deseado.</span>
      ) : (
        <button
          onClick={reenviar}
          disabled={enviando}
          style={{
            background: 'none', border: 'none', color: 'var(--teal)', fontWeight: 600,
            fontSize: 13, cursor: enviando ? 'wait' : 'pointer', padding: 0,
          }}
        >
          {enviando ? 'Enviando…' : 'Reenviar correo de confirmación'}
        </button>
      )}
      {error && <span style={{ color: 'var(--red)' }}>{error}</span>}
    </div>
  )
}
