'use client'
/**
 * LIBERAR AL PACIENTE — POSTVISIT-001.
 *
 * ── EL CAMINO QUE FALTABA ────────────────────────────────────────────────────
 *
 * `PATIENT-COMPANION-001` dejó el portal listo para enseñar un `PaqueteDeVisita`
 * y `/api/portal` acción `paquetes` ya lo sirve — pero ningún paquete llegaba a
 * existir en producción: faltaba la pantalla donde el médico lo revisa y
 * libera. Este botón es esa pantalla, en su versión mínima.
 *
 * ── QUÉ HACE, Y QUÉ NO DECIDE AQUÍ ───────────────────────────────────────────
 *
 * Pulsar el botón manda `{ clinicId, patientId, notaId }` a
 * `POST /api/expediente/paquete-visita`. El servidor —no este componente—
 * vuelve a leer la nota firmada, decide qué está vigente, compone el paquete y
 * lo libera. Aquí no se arma nada: «autorización en el servidor, no en la
 * pantalla».
 *
 * ── POR QUÉ NO HAY VISTA PREVIA TODAVÍA ──────────────────────────────────────
 *
 * `HojaParaElPaciente`, arriba en la misma pantalla, ya enseña exactamente el
 * mismo contenido (mismo `comoTomarlo`, mismos estudios): es la vista previa de
 * facto. Construir una segunda —que reproduzca en el cliente el cálculo de
 * «vigentes antes/después» que sólo el servidor puede hacer bien— habría sido
 * la clase de duplicación que el invariante nº1 prohíbe. Cuando el paquete
 * tenga campos que la hoja no enseña (avisos, documentos), esto necesita una
 * vista previa de verdad.
 *
 * ── POR QUÉ SE PUEDE VOLVER A PULSAR ─────────────────────────────────────────
 *
 * Cada liberación es una VERSIÓN nueva (`componerPaquete`/la ruta la calculan
 * contando paquetes previos de la misma nota), nunca una sobrescritura. Si el
 * médico corrige la nota con una adenda y vuelve a pulsar, el paciente ve la
 * versión más reciente y la anterior queda en el historial — no desaparece.
 */
import { useState } from 'react'
import { Send, Check, TriangleAlert } from 'lucide-react'
import { fetchAutenticado } from '@/lib/auth-client'

export interface LiberarPaqueteAlPacienteProps {
  clinicId: string
  patientId: string
  /** `null` = nota sin firmar todavía; el botón no se enseña. */
  notaId: string | null
  /** Nota de hospital: los paquetes de visita son de consulta ambulatoria. */
  esNotaHospital: boolean
}

type Estado = { tipo: 'listo' } | { tipo: 'enviando' } | { tipo: 'hecho'; version: number } | { tipo: 'error'; mensaje: string }

export function LiberarPaqueteAlPaciente(p: LiberarPaqueteAlPacienteProps) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'listo' })

  if (!p.notaId || p.esNotaHospital) return null

  const liberar = async () => {
    setEstado({ tipo: 'enviando' })
    try {
      const res = await fetchAutenticado('/api/expediente/paquete-visita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId: p.clinicId, patientId: p.patientId, notaId: p.notaId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEstado({ tipo: 'error', mensaje: data?.error || 'No se pudo liberar el paquete.' })
        return
      }
      setEstado({ tipo: 'hecho', version: data?.paquete?.version ?? 1 })
    } catch {
      setEstado({ tipo: 'error', mensaje: 'Sin conexión. Vuelve a intentarlo.' })
    }
  }

  return (
    <div
      className="no-print"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        marginTop: 10, padding: '10px 12px',
        border: '1px solid var(--border)', borderRadius: 10, background: 'var(--s2)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text3)', flex: '1 1 220px' }}>
        Esto NO se le manda automáticamente al paciente. Lo enseña en su portal sólo
        cuando usted pulsa liberar.
      </span>

      {estado.tipo === 'hecho' ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>
          <Check size={15} /> Liberado (v{estado.version}) — ya está en su portal
        </span>
      ) : (
        <button
          onClick={liberar}
          disabled={estado.tipo === 'enviando'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: 'var(--s3)', color: 'var(--text)',
            border: '1px solid var(--border)',
            cursor: estado.tipo === 'enviando' ? 'default' : 'pointer',
            opacity: estado.tipo === 'enviando' ? 0.6 : 1,
          }}
        >
          <Send size={14} /> {estado.tipo === 'enviando' ? 'Liberando…' : 'Liberar al paciente'}
        </button>
      )}

      {estado.tipo === 'error' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--red)' }}>
          <TriangleAlert size={14} /> {estado.mensaje}
        </span>
      )}
    </div>
  )
}
