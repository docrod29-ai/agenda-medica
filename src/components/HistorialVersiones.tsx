'use client'
import { useState } from 'react'
import { History, Loader2, RotateCcw } from 'lucide-react'
import { listarVersiones, resumirVersion, type NotaVersion } from '@/lib/expediente/versioning'
import { useToast } from '@/context/ToastContext'

/**
 * Historial de versiones de un borrador — la única vía de rescate que existía…
 * y que no se podía usar.
 *
 * Cada autoguardado ya guardaba una copia de lo que iba a pisar, pero NINGUNA
 * pantalla las leía: el historial era de solo escritura. Eso importa porque dos
 * pestañas sobre la misma nota (o el teléfono y la computadora) se sobrescriben
 * en silencio, con la última en escribir ganando. Sin esta pantalla, la nota
 * pisada no se podía recuperar de ninguna forma.
 *
 * Se carga BAJO DEMANDA, al abrir el desplegable: son documentos pesados (llevan
 * la transcripción) y no tiene sentido descargarlos en cada consulta.
 */
export function HistorialVersiones({
  clinicId, patientId, notaId, onRestaurar,
}: {
  clinicId: string
  patientId: string
  notaId: string | null
  onRestaurar: (v: NotaVersion) => void
}) {
  const { toast, confirm } = useToast()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [versiones, setVersiones] = useState<NotaVersion[] | null>(null)
  const [error, setError] = useState('')

  if (!notaId) return null   // una nota que aún no existe no tiene historial

  const abrir = async () => {
    const abriendo = !abierto
    setAbierto(abriendo)
    if (!abriendo || versiones) return
    setCargando(true)
    setError('')
    try {
      setVersiones(await listarVersiones(clinicId, patientId, notaId))
    } catch (e) {
      console.error('[historial] no se pudo listar:', e)
      setError('No se pudo cargar el historial. Revisa tu conexión.')
    } finally {
      setCargando(false)
    }
  }

  const restaurar = async (v: NotaVersion) => {
    const ok = await confirm(
      `Se va a reemplazar lo que tienes ahora en pantalla por esta versión (${resumirVersion(v)}). ` +
      'Lo actual quedará guardado como una versión más, así que no se pierde y puedes volver.',
      { confirmar: 'Restaurar esta versión' },
    )
    if (!ok) return
    onRestaurar(v)
    setAbierto(false)
    toast('Versión restaurada. Revísala antes de guardar.', 'success')
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={abrir}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none',
          border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 9,
          padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}>
        <History size={14} /> {abierto ? 'Ocultar historial' : 'Historial de versiones'}
      </button>

      {abierto && (
        <div style={{
          marginTop: 10, border: '1px solid var(--border)', borderRadius: 12,
          background: 'var(--s1)', overflow: 'hidden',
        }}>
          {cargando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 14, fontSize: 13, color: 'var(--text3)' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando versiones…
            </div>
          )}

          {error && <div style={{ padding: 14, fontSize: 13, color: '#ef4444' }}>{error}</div>}

          {!cargando && !error && versiones?.length === 0 && (
            <div style={{ padding: 14, fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
              Todavía no hay versiones anteriores. Se guarda una cada vez que la nota se
              sobrescribe, así que aparecerán conforme sigas trabajando.
            </div>
          )}

          {!cargando && !error && versiones && versiones.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {versiones.map((v, i) => (
                <li key={v.id ?? i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '11px 14px', flexWrap: 'wrap',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>
                    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(v.versionadoEn).toLocaleString('es-MX', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {resumirVersion(v)}
                      {v.versionadoEmail ? ` · ${v.versionadoEmail}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => restaurar(v)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none',
                      border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8,
                      padding: '6px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    }}>
                    <RotateCcw size={13} /> Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
