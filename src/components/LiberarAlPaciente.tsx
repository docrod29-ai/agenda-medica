'use client'
/**
 * LIBERAR AL PACIENTE — V9 · `POSTVISIT-001`.
 *
 * ── EL ACTO QUE FALTABA ─────────────────────────────────────────────────────
 *
 * `PATIENT-COMPANION-001` dejó montada toda la superficie del paciente y una
 * compuerta en el servidor, y con ella un hecho incómodo: **ningún paquete
 * existía**, porque no había dónde pulsar para crearlo. La pestaña «Cuidado»
 * enseñaba un estado vacío honesto y nada más.
 *
 * Esto es ese botón. Y es un **acto aparte de firmar**, no un paso más del
 * mismo. Firmar cierra el expediente; liberar decide qué de eso lee el
 * paciente. Se pueden hacer seguidos —y en la práctica se harán—, pero quedan
 * registrados por separado, con quién y cuándo (regla 4 de
 * `.claude/rules/patient-facing-ai.md`).
 *
 * ── LO QUE ESTA PANTALLA NO HACE ────────────────────────────────────────────
 *
 * **No manda nada.** Devuelve el enlace y el médico decide por dónde se lo hace
 * llegar. Mandar mensajes reales al paciente no es una decisión que tome un
 * componente.
 *
 * **No compone el contenido.** Lo compone el servidor desde la nota firmada.
 * Lo que se ve arriba, en la hoja del paciente, es la misma composición
 * determinista sobre los mismos campos: el médico aprueba lo que ve.
 */
import { useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, Link2, Send, ShieldCheck } from 'lucide-react'
import { fetchAutenticado } from '@/lib/auth-client'

const RUTA = '/api/expediente/paquete-visita'

interface VersionLiberada {
  version: number
  approvedAt: number | null
  approvedBy: string | null
}

export interface LiberarAlPacienteProps {
  clinicId?: string
  patientId: string
  notaId: string | null
  /** Sin firma no hay nada que liberar: es la compuerta de `POSTVISIT-GATE-001`. */
  firmada: boolean
}

const fecha = (ms: number | null): string =>
  ms ? new Date(ms).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : ''

export function LiberarAlPaciente({ clinicId, patientId, notaId, firmada }: LiberarAlPacienteProps) {
  const [ya, setYa] = useState<VersionLiberada[] | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enlace, setEnlace] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [error, setError] = useState('')

  const puede = firmada && !!clinicId && !!notaId

  /* Qué se liberó ya de ESTA consulta. Sin esto, el médico no puede saber si
     está liberando por primera vez o corrigiendo, y el botón le mentiría. */
  useEffect(() => {
    if (!puede) return
    let vivo = true
    fetchAutenticado(`${RUTA}?clinicId=${encodeURIComponent(clinicId!)}&patientId=${encodeURIComponent(patientId)}&notaId=${encodeURIComponent(notaId!)}`)
      .then(r => (r.ok ? r.json() : { paquetes: [] }))
      .then(d => { if (vivo) setYa(Array.isArray(d?.paquetes) ? d.paquetes : []) })
      .catch(() => { if (vivo) setYa([]) })
    return () => { vivo = false }
  }, [puede, clinicId, patientId, notaId])

  const liberar = useCallback(async () => {
    if (!puede || enviando) return
    setEnviando(true); setError('')
    try {
      const r = await fetchAutenticado(RUTA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /* Sólo identificadores: el contenido lo compone el servidor. */
        body: JSON.stringify({ clinicId, patientId, notaId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(String(d?.error || 'No se pudo liberar.')); return }
      setEnlace(String(d?.enlace || ''))
      setYa(prev => [{ version: d.version, approvedAt: d.approvedAt, approvedBy: d.approvedBy }, ...(prev ?? [])])
    } catch {
      setError('No se pudo liberar. Revisa tu conexión.')
    } finally {
      setEnviando(false)
    }
  }, [puede, enviando, clinicId, patientId, notaId])

  const copiar = useCallback(async () => {
    const url = enlace.startsWith('http') ? enlace : `${window.location.origin}${enlace}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* sin portapapeles queda el enlace visible para copiarlo a mano */ }
  }, [enlace])

  /* Sin firma no se enseña el botón. La hoja de arriba ya explica por qué. */
  if (!firmada) return null

  const ultima = ya?.[0]

  return (
    <section
      aria-labelledby="liberar-al-paciente"
      style={{
        border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        background: 'var(--s2)', marginTop: 16, padding: 14,
      }}
    >
      <h3
        id="liberar-al-paciente"
        style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <ShieldCheck size={16} aria-hidden="true" />
        Liberárselo al paciente
      </h3>

      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
        Firmar cierra el expediente. Liberar decide qué de esta consulta puede
        leer el paciente desde su teléfono. Son dos actos y quedan registrados
        aparte.
      </p>

      {ultima && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text2)' }}>
          Ya liberada — versión {ultima.version} el {fecha(ultima.approvedAt)}.
          {' '}Volver a liberar publica una versión corregida; el paciente verá la nueva.
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={liberar}
          disabled={!puede || enviando}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            minHeight: 44, padding: '0 14px', borderRadius: 'var(--r-md)',
            fontSize: 14, fontWeight: 600,
            background: 'var(--s3)', color: 'var(--text)',
            border: '1px solid var(--border)',
            cursor: enviando ? 'progress' : 'pointer',
            opacity: puede ? 1 : 0.6,
          }}
        >
          <Send size={14} aria-hidden="true" />
          {enviando ? 'Liberando…' : ultima ? 'Liberar una versión corregida' : 'Liberar al paciente'}
        </button>

        {enlace && (
          <button
            type="button"
            onClick={copiar}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              minHeight: 44, padding: '0 14px', borderRadius: 'var(--r-md)',
              fontSize: 14, fontWeight: 600,
              background: 'var(--s3)', color: 'var(--text)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            {copiado ? <ClipboardCheck size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
            {copiado ? 'Enlace copiado' : 'Copiar el enlace del paciente'}
          </button>
        )}
      </div>

      {enlace && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, wordBreak: 'break-all' }}>
          {enlace} — vence en 7 días. Mándaselo tú: desde aquí no sale ningún
          mensaje.
        </p>
      )}

      {error && (
        <p role="alert" style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--red)' }}>
          {error}
        </p>
      )}
    </section>
  )
}

export const POR_QUE_FIRMAR_Y_LIBERAR_SON_DOS_ACTOS =
  'Firmar es un acto medicolegal hacia el expediente; liberar es un acto de ' +
  'comunicación hacia el paciente. Se pueden hacer seguidos, pero un día el ' +
  'médico querrá firmar sin liberar todavía — y entonces la diferencia importa.'

export const POR_QUE_NO_SE_MANDA_SOLO =
  'Devolver el enlace y no mandarlo deja la decisión donde tiene que estar. ' +
  'Un mensaje real a un paciente no lo dispara un componente de interfaz.'
