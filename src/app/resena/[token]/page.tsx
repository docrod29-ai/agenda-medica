'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Star, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { obtenerSolicitudResena, enviarResena, type ReviewRequest } from '@/lib/reviews'

export default function ResenaPage() {
  const { token } = useParams<{ token: string }>()
  const [req, setReq] = useState<ReviewRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    obtenerSolicitudResena(token).then(r => {
      if (!r) setError('Enlace no válido')
      else if (r.used) setError('Esta reseña ya fue enviada. ¡Gracias!')
      else if (new Date() > new Date(r.expiresAt)) setError('Este enlace ha expirado')
      else setReq(r)
      setLoading(false)
    }).catch(() => { setError('Error de conexión'); setLoading(false) })
  }, [token])

  const enviar = async () => {
    if (!rating) return
    setEnviando(true)
    const r = await enviarResena(token, { rating, texto })
    if (r.ok) setEnviado(true)
    else setError(r.motivo ?? 'Error al enviar')
    setEnviando(false)
  }

  const card: React.CSSProperties = {
    background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 16,
    padding: '32px 28px', width: '100%', maxWidth: 440, textAlign: 'center',
  }

  if (loading) {
    return <Full><Loader2 size={26} color="var(--teal)" style={{ animation: 'spin 1s linear infinite' }} /></Full>
  }
  if (error) {
    return <Full><div style={card}><AlertTriangle size={36} color="var(--amber)" /><h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginTop: 10 }}>{error}</h1></div></Full>
  }
  if (enviado) {
    return <Full><div style={card}>
      <CheckCircle2 size={44} color="var(--green)" style={{ margin: '0 auto 14px' }} />
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>¡Gracias!</h1>
      <p style={{ fontSize: 14, color: 'var(--text2)', marginTop: 8 }}>Tu reseña ayuda a otros pacientes y al consultorio. La publicaremos tras una revisión rápida.</p>
    </div></Full>
  }
  if (!req) return null

  return (
    <Full>
      <div style={card}>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px' }}>
          ¿Cómo fue tu experiencia con {req.medicoNombre}?
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 18px' }}>Tu opinión es anónima en la página pública.</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '16px 0' }}>
          {[1,2,3,4,5].map(n => (
            /**
             * REG-292 — las cinco estrellas eran cinco botones SIN NOMBRE. Un
             * lector de pantalla anunciaba «botón, botón, botón, botón, botón»:
             * la única acción de esta pantalla era imposible de ejecutar sin ver.
             * `aria-pressed` además dice cuál está elegida, que es la otra mitad
             * del problema.
             */
            <button key={n} type="button"
              aria-label={n === 1 ? '1 estrella' : `${n} estrellas`}
              aria-pressed={rating === n}
              onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <Star size={36} fill={(hover || rating) >= n ? '#fbbf24' : 'none'} color={(hover || rating) >= n ? '#fbbf24' : 'var(--text3)'} />
            </button>
          ))}
        </div>

        <textarea
          aria-label="Tu comentario (opcional)"
          value={texto} onChange={e => setTexto(e.target.value.slice(0, 1000))}
          placeholder="¿Qué te gustaría compartir? (opcional)"
          rows={4}
          style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: 'var(--text)', resize: 'vertical' }}
        />
        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', marginTop: 4 }}>{texto.length}/1000</div>

        <button
          onClick={enviar}
          disabled={!rating || enviando}
          style={{ marginTop: 14, width: '100%', background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 18px', fontSize: 15, fontWeight: 700, cursor: rating && !enviando ? 'pointer' : 'default', opacity: rating && !enviando ? 1 : 0.5 }}
        >
          {enviando ? 'Enviando…' : 'Enviar reseña'}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Full>
  )
}

function Full({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>{children}</div>
}
