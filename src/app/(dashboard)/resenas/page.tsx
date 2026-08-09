'use client'
import { useEffect, useState } from 'react'
import { useClinic } from '@/context/ClinicContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import { listarResenas, moderarResena, nombreAnonimizado, type Review } from '@/lib/reviews'
import { Star, Loader2, CheckCircle2, XCircle } from 'lucide-react'

export default function ResenasPage() {
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast } = useToast()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  const recargar = async () => {
    if (!clinicId) return
    setLoading(true)
    try { setReviews(await listarResenas(clinicId)) } finally { setLoading(false) }
  }
  useEffect(() => { recargar() /* eslint-disable-line */ }, [clinicId])

  const decidir = async (id: string, dec: 'publicar' | 'rechazar') => {
    if (!clinicId || !user) return
    try {
      await moderarResena(clinicId, id, dec, user.email ?? '')
      toast(dec === 'publicar' ? 'Reseña publicada' : 'Reseña rechazada', 'info')
      recargar()
    } catch { toast('Error al moderar', 'error') }
  }

  const pendientes = reviews.filter(r => r.estado === 'pendiente')
  const publicadas = reviews.filter(r => r.estado === 'publicada')

  return (
    <div className="page-pad" style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Reseñas</h1>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 20px' }}>
        Modera las reseñas antes de publicarlas. Las publicadas aparecen en tu página pública.
      </p>

      {loading ? (
        <div style={{ padding: 24, color: 'var(--text3)' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…</div>
      ) : (
        <>
          <Bloque titulo={`Pendientes de moderación (${pendientes.length})`}>
            {pendientes.length === 0
              ? <Vacio>No hay reseñas pendientes</Vacio>
              : pendientes.map(r => (
                <Tarjeta key={r.id} review={r}>
                  <button onClick={() => decidir(r.id, 'publicar')} style={btnPrim}><CheckCircle2 size={13} /> Publicar</button>
                  <button onClick={() => decidir(r.id, 'rechazar')} style={btnSec}><XCircle size={13} /> Rechazar</button>
                </Tarjeta>
              ))
            }
          </Bloque>

          <Bloque titulo={`Publicadas (${publicadas.length})`}>
            {publicadas.length === 0
              ? <Vacio>Aún no hay reseñas publicadas</Vacio>
              : publicadas.map(r => <Tarjeta key={r.id} review={r} />)
            }
          </Bloque>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const btnPrim: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, background: 'var(--teal)', color: '#040B12', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
const btnSec: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)', color: 'var(--red)', borderRadius: 8, padding: '5px 12px', fontSize: 12.5, cursor: 'pointer' }

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{titulo}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}
function Tarjeta({ review, children }: { review: Review; children?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 1 }}>
          {[1,2,3,4,5].map(n => (
            <Star key={n} size={14} fill={review.rating >= n ? '#FBBF24' : 'none'} color={review.rating >= n ? '#FBBF24' : 'var(--text3)'} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>·</span>
        <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{nombreAnonimizado(review.pacienteNombre)}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
          {new Date(review.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
        </span>
      </div>
      {review.texto && <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.55, margin: '4px 0 8px' }}>{review.texto}</p>}
      {children && <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>{children}</div>}
    </div>
  )
}
function Vacio({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 24, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10 }}>{children}</div>
}
