'use client'
/**
 * /setup — Clinic creation wizard
 *
 * Shown when a logged-in user has no clinic yet.
 * Creates the clinic + sets the owner as admin member.
 */
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClinic } from '@/lib/firestore'
import { Stethoscope, Loader2, ArrowRight } from 'lucide-react'

export default function SetupPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombreMedico: '',
    nombreClinica: '',
    especialidad: '',
    telefono: '',
  })

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return }
    // Registro con Google: pre-llenar el nombre del médico con el de su cuenta
    // (solo si aún está vacío, para no pisar lo que el usuario escriba).
    if (user?.displayName) {
      setForm(f => f.nombreMedico ? f : { ...f, nombreMedico: user.displayName! })
    }
  }, [user, authLoading, router])

  const handleCreate = async () => {
    if (!form.nombreMedico.trim() || !form.nombreClinica.trim()) return
    setSaving(true)
    try {
      await createClinic(user!.uid, {
        nombreClinica: form.nombreClinica.trim(),
        nombreMedico: form.nombreMedico.trim(),
      })
      router.replace('/dashboard')
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  const canContinue = form.nombreMedico.trim().length > 2 && form.nombreClinica.trim().length > 2

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 20,
        padding: 40, width: '100%', maxWidth: 480,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 11,
            background: 'var(--s1)', border: '1px solid var(--border2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
              <g stroke="#3D5AFE" strokeWidth="5" strokeLinecap="round" fill="none">
                <line x1="8" y1="8" x2="8" y2="40"/>
                <line x1="40" y1="8" x2="40" y2="40"/>
                <line x1="8" y1="8" x2="40" y2="40"/>
              </g>
              <circle cx="24" cy="24" r="3" fill="#F2EFE9"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>NexusMED</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Configura tu consultorio</div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          ¡Bienvenido!
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 32, lineHeight: 1.6 }}>
          Vamos a configurar tu consultorio. Solo necesitas 2 datos para empezar — el resto lo puedes ajustar después.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Nombre del médico */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
              Tu nombre completo *
            </label>
            <input
              value={form.nombreMedico}
              onChange={e => setForm(f => ({ ...f, nombreMedico: e.target.value }))}
              placeholder="Dr. David Rodríguez"
              autoFocus
              style={{
                width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '12px 16px', fontSize: 14, color: 'var(--text)',
                outline: 'none',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--teal)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Nombre del consultorio */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
              Nombre del consultorio *
            </label>
            <input
              value={form.nombreClinica}
              onChange={e => setForm(f => ({ ...f, nombreClinica: e.target.value }))}
              placeholder="Consultorio de Infectología Rodríguez"
              style={{
                width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '12px 16px', fontSize: 14, color: 'var(--text)',
                outline: 'none',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--teal)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={!canContinue || saving}
            style={{
              width: '100%', padding: '14px 24px', borderRadius: 12,
              background: canContinue ? 'var(--teal)' : 'var(--s3)',
              color: '#fff', fontSize: 15, fontWeight: 600, border: 'none',
              cursor: canContinue && !saving ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s', marginTop: 8,
            }}
          >
            {saving
              ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Creando consultorio…</>
              : <><ArrowRight size={18} /> Crear mi consultorio</>
            }
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 24, textAlign: 'center', lineHeight: 1.6 }}>
          Tu consultorio incluye 14 días de prueba gratuita.
          Puedes agregar más médicos, secretarias y el bot de WhatsApp en la configuración.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
