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
import { fetchAutenticado } from '@/lib/auth-client'
import { Stethoscope, Loader2, ArrowRight } from 'lucide-react'
import { zonaDelNavegador } from '@/lib/zona-horaria-mx'

export default function SetupPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nombreMedico: '',
    nombreClinica: '',
    especialidad: '',
    telefono: '',
    /**
     * La cédula se pide AQUÍ y es opcional.
     *
     * Sin ella, `validarNOM004` mete «Falta cédula profesional» como ERROR y el
     * botón de Firmar nace apagado: todo médico nuevo llegaba a su primera nota
     * con un paciente enfrente y un botón muerto que no dice a dónde ir.
     *
     * Pero OPCIONAL, no obligatoria: un campo que frena el alta cuesta médicos
     * que ni llegan a ver el producto, y el que la deje en blanco se la
     * encuentra resuelta en un clic dentro de la propia nota. Se pide donde es
     * barato preguntarla y se rescata donde duele que falte.
     */
    cedulaProfesional: '',
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
    if (!user) { setError('Tu sesión expiró. Vuelve a iniciar sesión.'); return }
    setSaving(true)
    setError('')
    try {
      // Vía servidor y en UNA transacción. Antes eran cuatro escrituras sueltas
      // desde el navegador: con dos pestañas abiertas se creaban dos consultorios
      // y el segundo pisaba la membresía del primero, dejando uno huérfano y
      // facturable al que ya no se podía entrar.
      const res = await fetchAutenticado('/api/clinic/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreClinica: form.nombreClinica.trim(),
          nombreMedico: form.nombreMedico.trim(),
          especialidad: form.especialidad.trim(),
          telefono: form.telefono.trim(),
          cedulaProfesional: form.cedulaProfesional.trim(),
          /**
           * La zona horaria se ADIVINA, no se pregunta.
           *
           * `DEFAULT_CONFIG` daba `America/Chihuahua` —la del dueño— a todo
           * consultorio nuevo, así que un médico en CDMX tenía la agenda corrida
           * una hora sin que nada fallara de forma visible. El navegador ya lo
           * sabe; poner una pantalla más aquí sería fricción que cuesta médicos.
           * El servidor valida contra la lista de zonas conocidas.
           */
          zonaHoraria: zonaDelNavegador(),
        }),
      })
      const r = await res.json().catch(() => ({}))
      if (!res.ok || !r?.ok) throw new Error(r?.error || 'No se pudo crear tu consultorio')
      router.replace('/dashboard')
    } catch (err) {
      // El catch solo hacía console.error y quitaba el spinner: el médico veía el
      // botón volver a la normalidad sin saber si había funcionado, y pulsaba otra
      // vez — alimentando justo el duplicado que la transacción ahora impide.
      console.error(err)
      setError(err instanceof Error ? err.message : 'No se pudo crear tu consultorio. Revisa tu conexión.')
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
          Solo tu nombre y el del consultorio. Todo lo demás ya viene listo y lo puedes ajustar cuando quieras.
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

          {/*
            LOS DOS OPCIONALES VAN AQUÍ, EN LA MISMA PANTALLA.
            ──────────────────────────────────────────────────────────────────
            Sin pasos, sin "siguiente", sin bloquear el botón. La especialidad ya
            se enviaba al servidor pero NUNCA se pintaba: viajaba siempre vacía y
            se perdía en silencio, y de ella dependen la firma de la nota y cómo
            redacta la IA. La cédula evita que la primera firma nazca bloqueada.
            Los dos se pueden dejar en blanco y seguir.
          */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <label htmlFor="setup-especialidad" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
                Especialidad <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <input
                id="setup-especialidad"
                value={form.especialidad}
                onChange={e => setForm(f => ({ ...f, especialidad: e.target.value }))}
                placeholder="Medicina Interna"
                style={{
                  width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 16px', fontSize: 14, color: 'var(--text)', outline: 'none',
                }}
              />
            </div>
            {/*
              EL CAMPO QUE FALTABA.
              `telefono` estaba en el estado del formulario, el servidor lo
              aceptaba y lo guardaba… y no había NINGÚN input que lo pintara.
              Campo muerto: el médico nunca podía escribirlo, y su primera
              receta salía sin teléfono de contacto.
            */}
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <label htmlFor="setup-telefono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
                Teléfono del consultorio <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(sale en la receta)</span>
              </label>
              <input
                id="setup-telefono"
                value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                placeholder="614 123 4567"
                inputMode="tel"
                style={{
                  width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 16px', fontSize: 14, color: 'var(--text)', outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <label htmlFor="setup-cedula" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
                Cédula profesional <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <input
                id="setup-cedula"
                value={form.cedulaProfesional}
                onChange={e => setForm(f => ({ ...f, cedulaProfesional: e.target.value }))}
                placeholder="1234567"
                inputMode="numeric"
                style={{
                  width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 16px', fontSize: 14, color: 'var(--text)', outline: 'none',
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              background: 'color-mix(in srgb, var(--red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)',
              borderRadius: 10, padding: '11px 14px', marginTop: 14,
              fontSize: 13.5, lineHeight: 1.5, color: 'var(--text)',
            }}>
              {error}
            </div>
          )}

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
          Puedes agregar más médicos, asistentes y el bot de WhatsApp en la configuración.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
