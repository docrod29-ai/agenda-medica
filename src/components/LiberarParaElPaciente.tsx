'use client'
/**
 * LIBERAR PARA EL PACIENTE — V9 · `POSTVISIT-001`.
 *
 * ── EL ACTO QUE FALTABA ─────────────────────────────────────────────────────
 *
 * `PATIENT-COMPANION-001` dejó los cinco destinos del paciente montados y la
 * pantalla de «Tu plan de cuidado» diciendo la verdad: *cuando tu médico libere
 * el resumen de una consulta, lo verás aquí*. No lo veía nunca, porque no había
 * dónde liberarlo. Esto es ese dónde.
 *
 * ── FIRMAR NO ES LIBERAR, Y LA PANTALLA TIENE QUE DECIRLO ───────────────────
 *
 * Son dos actos (regla 4 de `patient-facing-ai.md`) y el médico tiene que poder
 * notar la diferencia sin haber leído la regla. Por eso este bloque **sólo
 * aparece con la nota firmada**, y por eso el botón dice «Liberar para el
 * paciente» y no «Guardar»: nombra hacia dónde va.
 *
 * ── SE ENSEÑA LO QUE VA A LEER, NO UN RESUMEN DE LO QUE VA A LEER ───────────
 *
 * Lo que se pinta aquí es el paquete **compuesto por el servidor**, tal cual, y
 * es exactamente el documento que se escribirá. Enseñar una aproximación y
 * guardar otra cosa es la forma más fácil de que el médico apruebe algo que no
 * leyó.
 *
 * Y por eso la previsualización se pide al servidor en vez de componerla aquí
 * con el estado de la pantalla: el estado de la pantalla puede haber cambiado
 * desde que se firmó, y lo que gobierna es la nota guardada.
 *
 * ── LO QUE ESTA PANTALLA NO HACE ────────────────────────────────────────────
 *
 * No edita el paquete. Corregir lo que se le entregó a un paciente es corregir
 * la nota —con una adenda— y liberar una versión nueva; un campo editable aquí
 * sería una segunda fuente de verdad clínica, que es el invariante nº1 del
 * proyecto.
 */
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Send, ShieldCheck } from 'lucide-react'
import { fetchAutenticado } from '@/lib/auth-client'
import type { PaqueteDeVisita } from '@/lib/paciente/paquete-de-visita'

interface YaLiberado {
  version: number
  approvedAt: number | null
  approvedBy: string | null
}

export interface LiberarParaElPacienteProps {
  clinicId: string
  patientId: string
  notaId: string
  /** Sólo se monta con la nota firmada; se recibe para no depender de eso a ciegas. */
  firmada: boolean
}

const fmt = (ms: number | null) =>
  ms ? new Date(ms).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : ''

export function LiberarParaElPaciente({ clinicId, patientId, notaId, firmada }: LiberarParaElPacienteProps) {
  const [paquete, setPaquete] = useState<PaqueteDeVisita | null>(null)
  const [liberado, setLiberado] = useState<YaLiberado | null>(null)
  /**
   * Nace en `true`, y no se pone a `true` dentro del efecto.
   *
   * Llamar a `setState` de forma síncrona en el cuerpo de un efecto encadena
   * renders, y el compilador de React lo marca. Aquí no hace falta: el estado
   * inicial de este bloque **es** «cargando» —el efecto sale disparado en el
   * primer render—, así que se declara así en vez de corregirlo un render
   * después.
   */
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const pedir = useCallback(async (accion: 'previsualizar' | 'liberar') => {
    const res = await fetchAutenticado('/api/expediente/paquete-visita', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId, patientId, notaId, accion }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok) throw new Error(String(data?.error || 'No se pudo hablar con el servidor'))
    return data as { paquete: PaqueteDeVisita; liberado?: YaLiberado | null; version?: number }
  }, [clinicId, patientId, notaId])

  useEffect(() => {
    if (!firmada || !clinicId || !patientId || !notaId) return
    let vivo = true
    pedir('previsualizar')
      .then(d => { if (!vivo) return; setPaquete(d.paquete); setLiberado(d.liberado ?? null); setError('') })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [firmada, clinicId, patientId, notaId, pedir])

  if (!firmada) return null

  const liberar = async () => {
    setEnviando(true); setError('')
    try {
      const d = await pedir('liberar')
      setPaquete(d.paquete)
      setLiberado({
        version: d.paquete.version,
        approvedAt: d.paquete.approvedAt,
        approvedBy: d.paquete.approvedBy,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo liberar')
    } finally {
      setEnviando(false)
    }
  }

  /* Sin nada que entregarle, no se ofrece liberar una hoja en blanco. */
  const vacio = !!paquete
    && !paquete.encounterSummary
    && paquete.medicationInstructions.length === 0
    && paquete.orders.length === 0
    && !paquete.followUp

  return (
    <section
      aria-labelledby="liberar-paciente-titulo"
      style={{
        border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
        background: 'var(--s2)', marginTop: 16, overflow: 'hidden',
      }}
    >
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
      }}>
        <ShieldCheck size={15} aria-hidden="true" style={{ color: 'var(--text3)' }} />
        <h3 id="liberar-paciente-titulo" style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Lo que verá el paciente en su portal
        </h3>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          firmar y liberar son dos actos
        </span>
      </header>

      <div style={{ padding: '14px' }}>
        {cargando && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text3)' }} aria-live="polite">
            Componiendo lo que se le entregaría…
          </p>
        )}

        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 14, color: 'var(--red)' }}>
            {error}
          </p>
        )}

        {paquete && !cargando && (
          <>
            {liberado ? (
              <p style={{
                margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 14, color: 'var(--text2)',
              }}>
                <CheckCircle2 size={15} aria-hidden="true" style={{ color: 'var(--green)' }} />
                Liberado (versión {liberado.version}) por {liberado.approvedBy} · {fmt(liberado.approvedAt)}
              </p>
            ) : (
              <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text3)' }}>
                Todavía no lo ve. Se compone de esta nota firmada y de nada más.
              </p>
            )}

            {vacio ? (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text3)' }}>
                Esta consulta no dejó medicación, estudios ni seguimiento que entregarle.
              </p>
            ) : (
              <dl style={{ margin: 0 }}>
                {paquete.encounterSummary && (
                  <Bloque titulo="Resumen">{paquete.encounterSummary}</Bloque>
                )}
                {paquete.medicationInstructions.length > 0 && (
                  <Bloque titulo="Sus medicamentos">
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {paquete.medicationInstructions.map(m => (
                        <li key={m.nombre} style={{ lineHeight: 1.6 }}>{m.instruccion}</li>
                      ))}
                    </ul>
                  </Bloque>
                )}
                {paquete.medicationChanges === null ? (
                  /* `null` NO es «sin cambios», y decírselo así al médico importa:
                     si cree que el sistema comparó y no encontró nada, no revisa. */
                  <Bloque titulo="Qué cambió">
                    No hay consulta anterior con la que comparar, así que no se le
                    dice qué cambió.
                  </Bloque>
                ) : paquete.medicationChanges.length > 0 && (
                  <Bloque titulo="Qué cambió">
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {paquete.medicationChanges.map(c => (
                        <li key={c.nombre} style={{ lineHeight: 1.6 }}>
                          {c.nombre} — {c.tipo === 'nuevo' ? 'nuevo' : c.tipo === 'suspendido' ? 'suspendido' : 'sigue igual'}
                        </li>
                      ))}
                    </ul>
                  </Bloque>
                )}
                {paquete.orders.length > 0 && (
                  <Bloque titulo="Estudios">
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {paquete.orders.map(o => <li key={o} style={{ lineHeight: 1.6 }}>{o}</li>)}
                    </ul>
                  </Bloque>
                )}
                {paquete.followUp && <Bloque titulo="Próximo seguimiento">{paquete.followUp}</Bloque>}
              </dl>
            )}

            {!vacio && (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={liberar}
                  disabled={enviando}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Send size={14} aria-hidden="true" />
                  {enviando ? 'Liberando…' : liberado ? 'Liberar una versión nueva' : 'Liberar para el paciente'}
                </button>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {liberado
                    ? 'Lo ya entregado no se reescribe: se le añade una versión.'
                    : 'Hasta que pulses, el paciente no ve nada de esta consulta.'}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <dt style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '.04em',
        textTransform: 'uppercase', color: 'var(--text3)',
      }}>
        {titulo}
      </dt>
      <dd style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
        {children}
      </dd>
    </div>
  )
}

export const POR_QUE_NO_SE_EDITA_AQUI =
  'Un campo editable en esta pantalla sería una segunda fuente de verdad ' +
  'clínica. Corregir lo entregado es corregir la nota con una adenda y liberar ' +
  'una versión nueva.'
