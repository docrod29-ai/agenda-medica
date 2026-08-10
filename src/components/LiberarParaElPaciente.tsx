'use client'
/**
 * REVISAR Y LIBERAR — la pantalla donde el médico decide qué lee su paciente.
 *
 * V9 · `POSTVISIT-001`. Es el llamador que le faltaba a `componerPaquete`, y es
 * el acto que le faltaba al programa: hasta hoy el producto sabía componer lo
 * que el paciente se lleva, y **no tenía forma de dárselo**.
 *
 * ── POR QUÉ HAY UN BOTÓN Y NO UN AUTOMATISMO ────────────────────────────────
 *
 * Liberar podría dispararse solo al firmar. No se hace, y no es prudencia
 * genérica: firmar es un acto hacia el expediente y liberar es un acto hacia una
 * persona que no puede detectar el error. La especificación los separa
 * explícitamente («Que el médico haya firmado la nota no libera el paquete: son
 * dos actos»), y la separación sólo significa algo si el segundo acto tiene su
 * propio gesto.
 *
 * ── LO QUE SE VE ANTES DE PULSAR ────────────────────────────────────────────
 *
 * Todo. La vista previa es **exactamente** lo que compone el servidor, pedida al
 * servidor —no recompuesta aquí— para que no puedan discrepar. Aprobar algo que
 * no se ve es firmar en blanco.
 *
 * ── LOS SIGNOS DE ALARMA SON SUYOS ──────────────────────────────────────────
 *
 * El campo va vacío y sin sugerencias. Un desplegable de «signos de alarma
 * frecuentes» sería el producto poniéndole indicaciones médicas en la boca al
 * médico, y esas indicaciones salen impresas con su cédula.
 *
 * ── IRREVERSIBLE, Y SE DICE ANTES ───────────────────────────────────────────
 *
 * Lo liberado no se reescribe. El botón lo advierte en su propio texto en vez de
 * abrir un diálogo de confirmación: un modal que aparece siempre se aprende a
 * despachar sin leerlo, y entonces deja de proteger nada (REG-245).
 */
import { useEffect, useState } from 'react'
import { Send, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react'
import { fetchAutenticado } from '@/lib/auth-client'
import type { PaqueteDeVisita } from '@/lib/paciente/paquete-de-visita'

const API = '/api/paciente/paquete'

export interface LiberarParaElPacienteProps {
  clinicId: string
  patientId: string
  notaId: string
  /** Sólo se monta con la nota firmada; se recibe para no adivinarlo aquí. */
  firmada: boolean
}

const CAJA: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)',
  background: 'var(--s2)',
  marginTop: 16,
  overflow: 'hidden',
}

export function LiberarParaElPaciente({ clinicId, patientId, notaId, firmada }: LiberarParaElPacienteProps) {
  const [paquete, setPaquete] = useState<PaqueteDeVisita | null>(null)
  const [signos, setSignos] = useState('')
  const [cargando, setCargando] = useState(true)
  const [liberando, setLiberando] = useState(false)
  const [error, setError] = useState('')

  /** Sin los tres identificadores no hay nada que pedir ni nada que liberar. */
  const listo = Boolean(clinicId && patientId && notaId && firmada)

  /**
   * LA VISTA PREVIA SE PIDE AL SERVIDOR, NO SE RECOMPONE AQUÍ.
   *
   * El estado se toca dentro de los `.then`, nunca en el cuerpo síncrono del
   * efecto: el compilador de React marca esto último como renders en cascada, y
   * `cargando` ya nace en `true`, así que no hace falta ponerlo.
   *
   * `vivo` evita escribir sobre un componente desmontado — el médico puede
   * salirse de la consulta mientras la petición está en vuelo.
   */
  useEffect(() => {
    if (!listo) return
    let vivo = true
    fetchAutenticado(
      `${API}?clinicId=${encodeURIComponent(clinicId)}&patientId=${encodeURIComponent(patientId)}&notaId=${encodeURIComponent(notaId)}`,
    )
      .then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => {
        if (!vivo) return
        if (!ok) { setError(d?.error || 'No se pudo preparar el resumen del paciente.'); return }
        const p = (d.paquete as PaqueteDeVisita | null) ?? null
        setPaquete(p)
        setSignos((p?.warningSigns ?? []).join('\n'))
        setError('')
      })
      .catch(() => { if (vivo) setError('Sin conexión: no se pudo preparar el resumen del paciente.') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [listo, clinicId, patientId, notaId])

  const liberado = paquete?.estado === 'RELEASED'

  const liberarAhora = async () => {
    setLiberando(true); setError('')
    try {
      const r = await fetchAutenticado(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId, patientId, notaId, accion: 'liberar', signosDeAlarma: signos }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d?.error || 'No se pudo liberar el resumen.'); return }
      setPaquete(d.paquete as PaqueteDeVisita)
    } catch {
      setError('Sin conexión: el resumen no se liberó.')
    } finally {
      setLiberando(false)
    }
  }

  /* Sin nota firmada no hay nada que liberar, y decirlo aquí sería ruido: la
     pantalla ya está llena de lo que falta para firmar. */
  if (!listo) return null

  if (cargando) {
    return (
      <section style={CAJA}>
        <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 12 }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          Preparando el resumen del paciente…
        </div>
      </section>
    )
  }

  return (
    <section style={CAJA} aria-labelledby="liberar-titulo">
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <h3 id="liberar-titulo" style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          {liberado ? 'Resumen liberado al paciente' : 'Liberar el resumen al paciente'}
        </h3>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {liberado ? 'ya lo puede ver en su portal' : 'firmar es una cosa; entregárselo es otra'}
        </span>
      </header>

      <div style={{ padding: '14px' }}>
        {error && (
          <p role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '0 0 12px', fontSize: 12, color: 'var(--amber)' }}>
            <AlertTriangle size={15} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </p>
        )}

        {paquete && (
          <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
            {paquete.encounterSummary && <p style={{ margin: '0 0 10px', color: 'var(--text)' }}>{paquete.encounterSummary}</p>}

            {paquete.medicationInstructions.length > 0 && (
              <>
                <Rotulo>Sus medicamentos</Rotulo>
                <ul style={{ margin: '4px 0 12px', paddingLeft: 18 }}>
                  {paquete.medicationInstructions.map(m => <li key={m.nombre}>{m.instruccion}</li>)}
                </ul>
              </>
            )}

            {/*
              QUÉ CAMBIÓ. `null` significa que NO SE PUDO DETERMINAR, y se dice
              con esas palabras: escribir «sin cambios» cuando no se consultó el
              historial es inventarle una tranquilidad al paciente.
            */}
            <Rotulo>Cambios respecto a la visita anterior</Rotulo>
            <p style={{ margin: '4px 0 12px' }}>
              {paquete.medicationChanges === null
                ? 'No se pudo determinar: no hay una consulta firmada anterior con la que comparar.'
                : paquete.medicationChanges.filter(c => c.tipo !== 'sin-cambio').map(c => `${c.nombre} (${c.tipo})`).join(' · ') || 'Sin cambios respecto a la consulta anterior.'}
            </p>

            {paquete.orders.length > 0 && (
              <>
                <Rotulo>Estudios</Rotulo>
                <ul style={{ margin: '4px 0 12px', paddingLeft: 18 }}>
                  {paquete.orders.map(o => <li key={o}>{o}</li>)}
                </ul>
              </>
            )}

            {paquete.followUp && (
              <>
                <Rotulo>Su próxima cita</Rotulo>
                <p style={{ margin: '4px 0 12px' }}>{paquete.followUp}</p>
              </>
            )}
          </div>
        )}

        {!liberado && (
          <div style={{ marginTop: 14 }}>
            <label htmlFor="signos-de-alarma" style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
              Signos de alarma (opcional) — uno por línea
            </label>
            <textarea
              id="signos-de-alarma"
              value={signos}
              onChange={e => setSignos(e.target.value)}
              rows={3}
              placeholder="Con lo que usted quiera que vuelva o acuda a urgencias."
              style={{
                width: '100%', padding: '9px 11px', fontSize: 14, lineHeight: 1.5,
                borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
                background: 'var(--s1)', color: 'var(--text)', resize: 'vertical',
              }}
            />
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: '6px 0 0' }}>
              Se entregan tal como los escriba. El sistema no sugiere ninguno: son
              indicación médica y salen con su nombre.
            </p>
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {liberado ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text2)' }}>
              <ShieldCheck size={15} aria-hidden />
              Liberado por {paquete?.approvedBy}
              {paquete?.approvedAt ? ` · ${new Date(paquete.approvedAt).toLocaleString('es-MX')}` : ''}
            </span>
          ) : (
            <button
              type="button"
              onClick={liberarAhora}
              disabled={liberando || !paquete}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              {liberando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
              Liberar al paciente
            </button>
          )}
          {!liberado && (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              Lo que se libera no se puede reescribir después.
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{ margin: '0', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text3)' }}>
      {children}
    </h4>
  )
}

export const POR_QUE_FIRMAR_NO_LIBERA =
  'Firmar es un acto medicolegal hacia el expediente. Liberar es un acto de ' +
  'comunicación hacia alguien que no puede detectar el error. Separarlos sólo ' +
  'significa algo si el segundo tiene su propio gesto.'
