'use client'
/**
 * Ruta de rescate: cuando llega un URL como /nota/XXX (un solo segmento),
 * trata XXX como notaId, busca el paciente en la clínica y redirige a la URL
 * completa /nota/{patientId}/{notaId}.
 *
 * Esto cubre el caso en que el JS viejo cacheado generó un URL malformado
 * (typo de doble slash colapsado por el navegador), o el usuario tiene un
 * link viejo guardado.
 */
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { findNotaByIdInClinic } from '@/lib/expediente/firestore'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'

export default function NotaRescuePage() {
  // El "patientId" del param es en realidad un notaId huérfano (URL mal formado)
  const { patientId: posibleNotaId } = useParams<{ patientId: string }>()
  const router = useRouter()
  const { clinicId } = useClinic()
  const [estado, setEstado] = useState<'buscando' | 'no-encontrada' | 'error'>('buscando')

  useEffect(() => {
    if (!clinicId || !posibleNotaId) return
    let cancelado = false

    findNotaByIdInClinic(clinicId, posibleNotaId)
      .then((resultado) => {
        if (cancelado) return
        if (resultado) {
          // Encontrada → redirige a la URL completa
          router.replace(`/nota/${resultado.patientId}/${posibleNotaId}`)
        } else {
          setEstado('no-encontrada')
        }
      })
      .catch(() => { if (!cancelado) setEstado('error') })

    return () => { cancelado = true }
  }, [clinicId, posibleNotaId, router])

  if (estado === 'buscando') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12, color: 'var(--text3)' }}>
        <Loader2 size={28} color="var(--teal)" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 13 }}>Localizando la nota…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: 40, maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
      <AlertCircle size={32} color="#f59e0b" style={{ marginBottom: 12 }} />
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
        Nota no encontrada
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        {estado === 'no-encontrada'
          ? 'No localizamos esa nota en tu clínica. Es posible que el enlace esté roto.'
          : 'Hubo un error al buscar la nota. Intenta de nuevo desde el expediente.'}
      </p>
      <button
        onClick={() => router.push('/expedientes')}
        className="btn btn-primary"
        style={{ display: 'inline-flex' }}
      >
        <ArrowLeft size={14} /> Ir a expedientes
      </button>
    </div>
  )
}
