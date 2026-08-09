'use client'
/**
 * LO QUE EL PACIENTE VA A LEER — y el gesto por el que el médico lo aprueba.
 *
 * V9 · `POSTVISIT-001`. Cierra los dos P1 que quedaban de la auditoría:
 *
 *  - `POSTVISIT-GATE-001` — la hoja del paciente se componía del borrador EN
 *    CURSO. Lo que el médico llevaba dictado a medias ya tenía forma de
 *    indicación. Aquí no: el servidor compone desde la nota **firmada** y se
 *    niega si no lo está.
 *  - `POSTVISIT-ENTREGA-001` — la hoja no llegaba nunca al paciente. Sólo se
 *    podía copiar o imprimir, y en una consulta de treinta minutos eso no pasa.
 *    Al liberar, el paquete aparece en `/mi/[token]` → Cuidado.
 *
 * ── POR QUÉ HAY DOS PASOS Y NO UN BOTÓN ─────────────────────────────────────
 *
 * Primero se ve, después se libera. Liberar es un acto de comunicación hacia
 * una persona que **no puede detectar el error**: si la lista de medicamentos
 * salió rara, el paciente no lo va a notar. El médico sí, y sólo si se la
 * enseñan antes.
 *
 * ── POR QUÉ EL CONTENIDO NO SE COMPONE AQUÍ ─────────────────────────────────
 *
 * Esta pantalla **no arma el paquete**: se lo pide al servidor y pinta lo que
 * le devuelve. Si lo compusiera el navegador, lo que el médico aprueba y lo que
 * se guarda podrían ser dos cosas distintas — y la segunda es la que lee el
 * paciente. El único texto que sale de aquí son los signos de alarma, que los
 * escribe él.
 */
import { useState } from 'react'
import { CheckCircle2, Eye, Send, TriangleAlert } from 'lucide-react'
import { fetchAutenticado } from '@/lib/auth-client'
import type { PaqueteDeVisita } from '@/lib/paciente/paquete-de-visita'

export interface LiberarAlPacienteProps {
  clinicId: string
  patientId: string
  notaId: string
}

const CAJA: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)',
  background: 'var(--s2)',
  marginTop: 16,
  overflow: 'hidden',
}

const BOTON: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 'var(--r-md)', fontSize: 14, fontWeight: 600,
  background: 'var(--s3)', color: 'var(--text)',
  border: '1px solid var(--border)', cursor: 'pointer',
}

/** Cómo se le nombra al paciente cada cambio. Sin adjetivos y sin consejo. */
const COMO_SE_DICE_EL_CAMBIO: Record<string, string> = {
  nuevo: 'Nuevo en esta consulta',
  suspendido: 'Ya no está en tu lista',
  'sin-cambio': 'Sigue igual',
}

export function LiberarAlPaciente({ clinicId, patientId, notaId }: LiberarAlPacienteProps) {
  const [paquete, setPaquete] = useState<PaqueteDeVisita | null>(null)
  const [alarma, setAlarma] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [liberado, setLiberado] = useState<PaqueteDeVisita | null>(null)

  const pedir = async (accion: 'previsualizar' | 'liberar') => {
    setCargando(true)
    setError('')
    try {
      const r = await fetchAutenticado('/api/paciente/paquete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId, patientId, notaId, accion,
          signosDeAlarma: alarma.split('\n').map(l => l.trim()).filter(Boolean),
        }),
      })
      const j = await r.json()
      if (!r.ok || !j?.ok) {
        setError(String(j?.error ?? 'No se pudo preparar lo que verá el paciente.'))
        return
      }
      if (accion === 'liberar') setLiberado(j.paquete as PaqueteDeVisita)
      else setPaquete(j.paquete as PaqueteDeVisita)
    } catch {
      setError('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  if (liberado) {
    return (
      <section style={CAJA} aria-live="polite">
        <div style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <CheckCircle2 size={18} aria-hidden style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Liberado para el paciente · versión {liberado.version}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
              Ya lo puede leer desde su enlace, en «Tu plan de cuidado». Lo que se
              entregó queda guardado tal cual: corregirlo es liberar una versión
              nueva, igual que una adenda no reescribe la nota.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section style={CAJA}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Lo que el paciente va a leer
        </span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          de esta nota firmada, en su teléfono
        </span>
        {!paquete && (
          <button
            type="button"
            onClick={() => void pedir('previsualizar')}
            disabled={cargando}
            style={{ ...BOTON, marginLeft: 'auto' }}
          >
            <Eye size={14} aria-hidden /> {cargando ? 'Preparando…' : 'Revisar'}
          </button>
        )}
      </header>

      <div style={{ padding: 14 }}>
        {error && (
          <p role="alert" style={{
            margin: '0 0 12px', fontSize: 14, color: 'var(--text)',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <TriangleAlert size={16} aria-hidden style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
            {error}
          </p>
        )}

        {!paquete && !error && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
            Nada se le envía hasta que usted lo apruebe. Primero lo ve tal como
            le va a llegar.
          </p>
        )}

        {paquete && (
          <>
            {paquete.encounterSummary && (
              <Bloque titulo="Resumen de la consulta" lineas={[paquete.encounterSummary]} />
            )}
            {paquete.medicationInstructions.length > 0 && (
              <Bloque titulo="Sus medicamentos" lineas={paquete.medicationInstructions.map(m => m.instruccion)} />
            )}
            {paquete.medicationChanges === null ? (
              <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                No se pudo determinar qué cambió respecto de antes, así que no se
                le dice nada al respecto. No es lo mismo que «no hubo cambios».
              </p>
            ) : paquete.medicationChanges.length > 0 && (
              <Bloque
                titulo="Qué cambió"
                lineas={paquete.medicationChanges.map(c => `${c.nombre} — ${COMO_SE_DICE_EL_CAMBIO[c.tipo] ?? c.tipo}`)}
              />
            )}
            {paquete.orders.length > 0 && <Bloque titulo="Estudios que le pidió" lineas={paquete.orders} />}
            {paquete.followUp && <Bloque titulo="Próximo seguimiento" lineas={[paquete.followUp]} />}

            <div style={{ marginTop: 16 }}>
              <label htmlFor="signos-de-alarma" style={{
                display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.04em',
                textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6,
              }}>
                Signos de alarma — uno por línea
              </label>
              <textarea
                id="signos-de-alarma"
                value={alarma}
                onChange={e => setAlarma(e.target.value)}
                rows={3}
                placeholder="Si aparece fiebre de más de 38 °C…"
                style={{
                  width: '100%', padding: 10, fontSize: 14, lineHeight: 1.5,
                  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
                  background: 'var(--s1)', color: 'var(--text)', resize: 'vertical',
                }}
              />
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                Van tal como usted los escriba. El sistema no inventa ninguno: si
                lo deja vacío, el paciente no lee signos de alarma.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {/* Primitiva compartida: el primario del sistema, no un botón pintado a mano. */}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void pedir('liberar')}
                disabled={cargando}
              >
                <Send size={14} aria-hidden /> {cargando ? 'Liberando…' : 'Liberar al paciente'}
              </button>
              <button type="button" onClick={() => void pedir('previsualizar')} disabled={cargando} style={BOTON}>
                <Eye size={14} aria-hidden /> Volver a componer
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function Bloque({ titulo, lineas }: { titulo: string; lineas: readonly string[] }) {
  return (
    <div style={{ marginTop: 14 }}>
      <h4 style={{
        margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '.04em',
        textTransform: 'uppercase', color: 'var(--text3)',
      }}>
        {titulo}
      </h4>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {lineas.map((l, i) => (
          <li key={i} style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

export const POR_QUE_PRIMERO_SE_VE =
  'El paciente no puede detectar el error: si la lista salió rara, no lo va a ' +
  'notar. El médico sí, y sólo si se la enseñan antes de mandarla.'

export const POR_QUE_LOS_SIGNOS_DE_ALARMA_LOS_ESCRIBE_EL =
  'Son indicación médica. O los escribe él, o no existen: componerlos sería ' +
  'inventar una indicación que sale con su membrete.'
