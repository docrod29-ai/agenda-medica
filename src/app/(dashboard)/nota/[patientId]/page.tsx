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
import { buscarNotaEnClinica } from '@/lib/expediente/firestore'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'

export default function NotaRescuePage() {
  // El "patientId" del param es en realidad un notaId huérfano (URL mal formado)
  const { patientId: posibleNotaId } = useParams<{ patientId: string }>()
  const router = useRouter()
  const { clinicId } = useClinic()
  const [estado, setEstado] = useState<'buscando' | 'no-encontrada' | 'no-resoluble' | 'error'>('buscando')

  useEffect(() => {
    if (!clinicId || !posibleNotaId) return
    let cancelado = false

    buscarNotaEnClinica(clinicId, posibleNotaId)
      .then((resultado) => {
        if (cancelado) return
        if (resultado.estado === 'encontrada') {
          // Encontrada → redirige a la URL completa. Se usa el id RESUELTO y no
          // el del enlace: en notas antiguas el identificador sellado y el del
          // documento pueden no coincidir, y redirigir al del enlace volvería a
          // caer en una URL que no abre.
          router.replace(`/nota/${resultado.patientId}/${resultado.notaId}`)
        } else if (resultado.estado === 'no-encontrada') {
          setEstado('no-encontrada')
        } else {
          /**
           * `ambigua` y `no-resoluble` NO son «no existe».
           *
           * La búsqueda por enlace roto está acotada a propósito (#342): recorrer
           * el consultorio entero era el defecto que se reparó. Cuando el
           * consultorio excede esa ventana, o cuando hay dos candidatas, lo
           * honesto es decir que no se pudo determinar — no afirmar una ausencia
           * que nadie comprobó.
           */
          setEstado('no-resoluble')
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
        {estado === 'no-encontrada' ? 'Nota no encontrada' : 'No se pudo determinar la nota'}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        {estado === 'no-encontrada'
          ? 'No localizamos esa nota en tu clínica. Es posible que el enlace esté roto.'
          : estado === 'no-resoluble'
            ? 'El enlace viene incompleto (le falta el paciente) y no pudimos resolverlo sin recorrer todo el expediente. No quiere decir que la nota no exista: ábrela desde el expediente del paciente.'
            : 'Hubo un error al buscar la nota. Intenta de nuevo desde el expediente.'}
      </p>
      {/* V15-FINAL-COHERENCE-001 — el rótulo decía «Ir a Consulta» y el destino
          era `/pacientes`. Es exactamente la familia de RTC-08, que este
          producto YA resolvió en el riel: «un ítem que dice Encuentro, te deja
          en la lista de pacientes … rompe la pregunta de §15 en el primer
          uso». La regla que se fijó entonces —o hay un lugar, o se dice cuál
          es— no había llegado hasta aquí. No se cambia el destino, que es el
          correcto (no se entra a una consulta sin elegir paciente): se cambia
          la promesa, que era la que mentía. */}
      <button
        onClick={() => router.push('/pacientes')}
        className="btn btn-primary"
        style={{ display: 'inline-flex' }}
      >
        <ArrowLeft size={14} /> Ir a Pacientes
      </button>
    </div>
  )
}
