'use client'
/**
 * EL HISTORIAL QUE SE ESCRIBÍA Y NO SE PODÍA LEER.
 *
 * ── LO QUE HABÍA ─────────────────────────────────────────────────────────────
 *
 * `updateNota` guarda religiosamente el documento previo en
 * `notas/{id}/versions` en CADA autoguardado — uno cada 30 segundos— con quién
 * provocó que esa versión quedara atrás. Un historial completo, bien construido.
 *
 * Y `getVersionesNota` **no tenía un solo llamador** en toda la aplicación.
 *
 * Consecuencia práctica: toda sobrescritura era irrecuperable PARA EL MÉDICO,
 * aunque el dato siguiera intacto en Firestore. Existía la información y no
 * existía la pantalla. Es la peor combinación posible: se paga el costo de
 * guardarlo y no se cobra ninguno de sus beneficios.
 *
 * ── QUÉ HACE ─────────────────────────────────────────────────────────────────
 *
 * Enseña las versiones anteriores y deja COPIAR el texto de cualquiera. No
 * restaura automáticamente y no toca la nota: una restauración silenciosa sobre
 * un documento clínico es exactamente el problema que esto viene a resolver, en
 * la otra dirección. El médico ve lo que había, copia lo que le sirve y decide.
 */
import { useState } from 'react'
import { getVersionesNota } from '@/lib/expediente/firestore'
import { useToast } from '@/context/ToastContext'
import { History, Copy, Loader2 } from 'lucide-react'
import type { NotaMedica } from '@/types/expediente'

type Version = NotaMedica & { versionadoEn: string; versionadoEmail?: string | null }

/** El texto de una versión, en el mismo orden en que se lee la nota. */
function textoDe(v: Version): string {
  const partes: string[] = []
  if (v.resumenEjecutivo?.trim()) partes.push(`RESUMEN\n${v.resumenEjecutivo.trim()}`)
  for (const s of v.secciones ?? []) {
    if (s.value?.trim()) partes.push(`${s.label.toUpperCase()}\n${s.value.trim()}`)
  }
  const dx = (v.diagnosticos ?? []).map(d => d.descripcion).filter(Boolean)
  if (dx.length) partes.push(`DIAGNÓSTICOS\n${dx.join('\n')}`)
  const meds = (v.medicamentos ?? []).map(m => [m.nombre, m.dosis, m.via, m.frecuencia].filter(Boolean).join(' · '))
  if (meds.length) partes.push(`MEDICAMENTOS\n${meds.join('\n')}`)
  return partes.join('\n\n')
}

export function HistorialVersiones({ clinicId, patientId, notaId }: {
  clinicId: string; patientId: string; notaId: string
}) {
  const { toast } = useToast()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [versiones, setVersiones] = useState<Version[] | null>(null)
  const [error, setError] = useState('')

  const abrir = () => {
    setAbierto(v => !v)
    if (versiones || cargando) return
    setCargando(true)
    getVersionesNota(clinicId, patientId, notaId)
      .then(vs => { setVersiones(vs as Version[]); setError('') })
      .catch(() => setError('No se pudo leer el historial. Revisa tu conexión.'))
      .finally(() => setCargando(false))
  }

  const copiar = async (v: Version) => {
    try {
      await navigator.clipboard.writeText(textoDe(v))
      toast('Versión copiada al portapapeles', 'success')
    } catch {
      toast('No se pudo copiar', 'error')
    }
  }

  return (
    <div className="no-print" style={{ marginTop: 16 }}>
      {/*
        MEDIDO el 31-ago en `/nota/pac-001/…`: éste era el ÚNICO control mudo de
        los ocho de la pantalla. Mismo defecto de siempre —`background` en el
        `style={{ }}`, que le gana por especificidad a cualquier `:hover` de la
        hoja—, y encima el que más falta hace: es la puerta al historial de
        versiones, la única forma que tiene el médico de recuperar lo que una
        sobrescritura se llevó. Leerlo como texto es no abrirlo nunca.

        `aria-expanded` porque esto REVELA contenido debajo: sin él, quien usa
        lector de pantalla no sabe si el historial está abierto ni que este
        botón lo controla.
      */}
      <button
        onClick={abrir}
        className="nx-acc-plana"
        aria-expanded={abierto}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px',
          fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer',
        }}
      >
        <History size={14} /> {abierto ? 'Ocultar versiones anteriores' : 'Ver versiones anteriores'}
      </button>

      {abierto && (
        <div style={{ marginTop: 10 }}>
          {cargando ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text3)' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Leyendo el historial…
            </div>
          ) : error ? (
            <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{error}</div>
          ) : !versiones?.length ? (
            <div style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6 }}>
              Todavía no hay versiones anteriores de esta nota. Se guarda una cada vez que
              el contenido se sobrescribe.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                {versiones.length} versión{versiones.length === 1 ? '' : 'es'} guardada{versiones.length === 1 ? '' : 's'}.
                Se puede copiar el texto; la nota no se modifica.
              </div>
              {versiones.map(v => (
                <details key={v.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--s2)' }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--text2)' }}>
                    {new Date(v.versionadoEn).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                    {v.versionadoEmail ? ` · sobrescrita por ${v.versionadoEmail}` : ''}
                  </summary>
                  <pre style={{
                    whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text2)',
                    marginTop: 8, fontFamily: 'inherit', lineHeight: 1.6,
                  }}>{textoDe(v) || '(esta versión estaba vacía)'}</pre>
                  <button
                    onClick={() => copiar(v)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                      background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                      padding: '4px 9px', fontSize: 11.5, color: 'var(--text2)', cursor: 'pointer',
                    }}
                  >
                    <Copy size={12} /> Copiar esta versión
                  </button>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
