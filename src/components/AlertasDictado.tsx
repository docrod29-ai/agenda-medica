'use client'

/**
 * AlertasDictado — lo que el guardián NO dejó pasar.
 *
 * Hermano de `CorreccionesPanel`, y su opuesto exacto: aquél muestra los cambios
 * que **sí** se aplicaron (y deja deshacerlos); éste muestra los que **no** se
 * aplicaron, porque tocaban una cifra, una unidad, una sigla crítica, una
 * negación o el lado del paciente.
 *
 * Va ABIERTO y no se puede cerrar. Una corrección aceptada puede revisarse
 * después; una dosis que perdió su número tiene que verse ahora, antes de firmar.
 * Es la regla del paquete del Dr.: en una ambigüedad crítica la interfaz pregunta,
 * no adivina.
 */

import { AlertTriangle } from 'lucide-react'
import type { AlertaDictado } from '@/lib/asr/corrector-vigilado'

interface Props {
  alertas: AlertaDictado[]
}

export function AlertasDictado({ alertas }: Props) {
  if (alertas.length === 0) return null

  return (
    <div
      role="alert"
      style={{
        marginTop: 8,
        border: '1px solid var(--amber, #b45309)',
        borderRadius: 8,
        background: 'var(--s2)',
        overflow: 'hidden',
        fontSize: 12.5,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderBottom: '1px solid var(--border)',
      }}>
        <AlertTriangle size={14} style={{ color: 'var(--amber, #b45309)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
          {alertas.length === 1
            ? 'Revise este punto antes de firmar'
            : `Revise estos ${alertas.length} puntos antes de firmar`}
        </span>
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alertas.map((a, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{a.titulo}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.45 }}>{a.detalle}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
