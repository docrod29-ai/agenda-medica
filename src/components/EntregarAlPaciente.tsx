'use client'
/**
 * ENTREGAR AL PACIENTE — la pantalla donde se libera el paquete de la visita.
 *
 * V9 · `POSTVISIT-001` · REG-335.
 *
 * ── EL INVARIANTE, DICHO EN LENGUAJE DE INTERFAZ ────────────────────────────
 *
 *     FIRMAR LA NOTA ≠ LIBERARLE INFORMACIÓN AL PACIENTE.
 *
 * Por eso este bloque no aparece hasta que la nota está firmada, y por eso
 * aparecer no basta: hace falta un gesto más, explícito, con su propio botón y
 * su propio rastro en la bitácora. Firmar es hacia el expediente; liberar es
 * hacia el paciente. Se hacen seguidos y se registran aparte.
 *
 * ── LO QUE ESTA PANTALLA NO DECIDE ──────────────────────────────────────────
 *
 * Nada del contenido. El navegador no compone el paquete ni manda campos que
 * acaben en él: pide una previsualización, la enseña, y si el médico aprueba
 * manda `liberar` con el `notaId` y la versión que está viendo. El servidor
 * vuelve a leer la nota firmada y vuelve a componer. Si esta pantalla mintiera
 * sobre el contenido, no cambiaría lo que el paciente lee.
 *
 * Es la regla 3 de `.claude/rules/patient-facing-ai.md` aplicada a la interfaz:
 * la prohibición vive en el servidor, no en el botón.
 *
 * ── POR QUÉ SE ENSEÑA ANTES DE LIBERAR ──────────────────────────────────────
 *
 * Porque es lo que el paciente va a leer, y el médico responde por ello. Una
 * liberación a ciegas —«confía, sale bien»— es la misma clase de acto que
 * firmar sin leer, y el producto ya tiene un sello entero dedicado a que eso no
 * pase inadvertido.
 */
import { useCallback, useEffect, useState } from 'react'
import { Send, Copy, ClipboardCheck, Loader2, ShieldCheck, Undo2, AlertTriangle } from 'lucide-react'
import { fetchAutenticado } from '@/lib/auth-client'
import { openWhatsApp } from '@/lib/whatsapp'
import { mensajeDeEntrega } from '@/lib/paciente/entrega-del-paquete'
import { visibleParaElPaciente, type PaqueteDeVisita } from '@/lib/paciente/paquete-de-visita'

const RUTA = '/api/expediente/paquete-de-visita'

export interface EntregarAlPacienteProps {
  clinicId: string
  patientId: string
  notaId: string
  /** Sin esto el bloque no se pinta. La compuerta de `POSTVISIT-GATE-001`. */
  firmada: boolean
  /** Teléfono del paciente, para abrir WhatsApp. Sin él quedan copiar y el portal. */
  telefono?: string
  nombreDelConsultorio?: string
  /** `2026-09-08`, tal como el médico la puso en «Próxima consulta». */
  proximaCita?: string
  onAviso?: (texto: string, tipo: 'success' | 'error' | 'info') => void
}

export function EntregarAlPaciente(p: EntregarAlPacienteProps) {
  /* Por VALOR y no `p.algo` dentro de los `useCallback`: con el objeto de props
     en las dependencias, el efecto se redispara en cada render del padre y
     relee el expediente sin que nada haya cambiado. */
  const { clinicId, patientId, notaId, firmada, proximaCita } = p
  const [paquete, setPaquete] = useState<PaqueteDeVisita | null>(null)
  /**
   * Nace en `true`: en cuanto la nota está firmada esto pide su previsualización,
   * así que el primer pintado ya es una espera. Y arrancar en `false` obligaría a
   * ponerlo a `true` DENTRO del efecto, que es la cascada de renders que el lint
   * de React caza — y tendría razón.
   */
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState(false)
  /**
   * NO SE PUDO LEER ≠ NO HAY NADA. Sin este estado, un fallo de red pinta la
   * misma pantalla que «esta consulta no tiene nada que entregar», y el médico
   * se va creyendo que su paciente ya no necesitaba nada.
   */
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [enlace, setEnlace] = useState('')

  /**
   * PEDIR LA PREVISUALIZACIÓN — sin un `setState` sincrónico en el efecto.
   *
   * El resultado se aplica dentro de `.then`/`.catch`, y `vivo` corta la
   * escritura si el médico ya se fue de esta nota: un `setState` sobre un
   * componente desmontado es la fuga que este patrón evita, y el mismo que ya
   * usan `InternamientosDelPaciente` y `CabosSueltosDelPaciente`.
   */
  const pedir = useCallback((): Promise<PaqueteDeVisita> =>
    fetchAutenticado(RUTA, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'previsualizar', clinicId, patientId, notaId, proximaCita }),
    }).then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error || 'No se pudo preparar lo que se lleva el paciente.')
      return d.paquete as PaqueteDeVisita
    }), [clinicId, patientId, notaId, proximaCita])

  useEffect(() => {
    if (!firmada || !notaId) return
    let vivo = true
    pedir()
      .then(pk => { if (vivo) { setPaquete(pk); setError(''); setCargando(false) } })
      /* Un fallo de red se DICE. Sin paquete y sin aviso, la pantalla se lee
         como «esta consulta no tiene nada que entregar», y el médico se va
         creyendo que su paciente no necesitaba nada. */
      .catch((e: unknown) => {
        if (!vivo) return
        setError(e instanceof Error ? e.message : 'Sin conexión. No se pudo preparar lo que se lleva el paciente.')
        setCargando(false)
      })
    return () => { vivo = false }
  }, [pedir, firmada, notaId])

  const liberar = async () => {
    setTrabajando(true); setError('')
    try {
      const r = await fetchAutenticado(RUTA, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'liberar', clinicId, patientId, notaId,
          proximaCita,
          /* La versión QUE ESTOY VIENDO. Si en la base ya hay una mayor, el
             servidor responde 409 y esta pestaña no pisa el trabajo de otra. */
          versionEsperada: paquete?.version ?? 0,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d?.error || 'No se pudo liberar.'); p.onAviso?.(d?.error || 'No se pudo liberar.', 'error'); return }
      setPaquete(d.paquete as PaqueteDeVisita)
      p.onAviso?.(d.yaEstaba ? 'Ya estaba liberado; no se creó una versión nueva.' : 'Liberado para tu paciente ✓', 'success')
    } catch {
      setError('Sin conexión. No se liberó nada.')
    } finally { setTrabajando(false) }
  }

  const retirar = async () => {
    setTrabajando(true); setError('')
    try {
      const r = await fetchAutenticado(RUTA, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retirar', clinicId, patientId, notaId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d?.error || 'No se pudo retirar.'); return }
      setPaquete(d.paquete as PaqueteDeVisita)
      setEnlace('')
      p.onAviso?.('Retirado del portal. Queda constancia de la versión que se entregó.', 'info')
    } catch {
      setError('Sin conexión. No se retiró nada.')
    } finally { setTrabajando(false) }
  }

  /** El enlace CLÍNICO: el de la agenda no abre esto (E0-06). */
  const pedirEnlace = async (): Promise<string> => {
    if (enlace) return enlace
    const r = await fetchAutenticado('/api/portal/link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId, patientId, alcance: 'clinico' }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d?.url) throw new Error(d?.error || 'No se pudo generar el enlace')
    setEnlace(String(d.url))
    return String(d.url)
  }

  const entregar = async (via: 'whatsapp' | 'copiar') => {
    if (!paquete) return
    setTrabajando(true); setError('')
    try {
      const url = await pedirEnlace()
      /**
       * LA COMPUERTA, OTRA VEZ, AQUÍ. No porque se desconfíe del estado local:
       * porque el único sitio del producto que compone un camino hacia el
       * paquete tiene que ser el que la exige. Un botón deshabilitado no es una
       * defensa — es una sugerencia.
       */
      const m = mensajeDeEntrega({ paquete, enlace: url, consultorio: p.nombreDelConsultorio })
      if (!m.ok) {
        setError(m.motivo === 'no-liberado'
          ? 'Todavía no lo has liberado. Libéralo antes de mandarlo.'
          : 'No hay enlace que mandar.')
        return
      }
      if (via === 'whatsapp' && p.telefono) { openWhatsApp(p.telefono, m.mensaje); return }
      await navigator.clipboard.writeText(m.mensaje)
      setCopiado(true); setTimeout(() => setCopiado(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar la entrega.')
    } finally { setTrabajando(false) }
  }

  /* La compuerta de firma: sin nota firmada esto no existe. */
  if (!firmada || !notaId) return null

  const liberado = paquete ? visibleParaElPaciente(paquete) : false

  return (
    <section
      id="entregar-al-paciente"
      aria-labelledby="entregar-al-paciente-titulo"
      style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--s2)', marginTop: 16, overflow: 'hidden' }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <h2 id="entregar-al-paciente-titulo" style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Entregar al paciente
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {liberado
            ? `Liberado · versión ${paquete?.version}`
            : 'Firmar la nota no se lo enseña a nadie. Esto sí.'}
        </span>
      </header>

      <div style={{ padding: 14 }}>
        {cargando && (
          <p role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text3)', margin: 0 }}>
            <Loader2 size={14} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} />
            Preparando lo que se lleva…
          </p>
        )}

        {error && (
          <p role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: 'var(--amber)', margin: '0 0 12px' }}>
            <AlertTriangle size={14} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
            {error}
          </p>
        )}

        {paquete && (
          <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14 }}>
            {paquete.encounterSummary && <p style={{ margin: '0 0 8px' }}><strong>Motivo:</strong> {paquete.encounterSummary}</p>}
            {paquete.medicationInstructions.length > 0 && (
              <>
                <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text)' }}>Sus medicamentos</p>
                <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
                  {paquete.medicationInstructions.map(m => <li key={m.nombre}>{m.instruccion}</li>)}
                </ul>
              </>
            )}
            {paquete.orders.length > 0 && (
              <>
                <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text)' }}>Estudios</p>
                <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
                  {paquete.orders.map(o => <li key={o}>{o}</li>)}
                </ul>
              </>
            )}
            {paquete.followUp && <p style={{ margin: '0 0 8px' }}><strong>Próxima cita:</strong> {paquete.followUp}</p>}
            {/*
              LO QUE NO SE COMPONE SE DICE. Los signos de alarma son indicación
              médica: si el médico no los escribió, aquí no aparecen — y que el
              hueco se VEA es lo que hace que alguien lo llene, en vez de que el
              paciente se vaya sin saber cuándo volver.
            */}
            {paquete.warningSigns.length === 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text3)' }}>
                Sin signos de alarma: no se inventan. Si quieres que los lea, escríbelos en tus indicaciones.
              </p>
            )}
            {paquete.medicationChanges === null && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)' }}>
                No se pudo comparar con su visita anterior, así que no se le dice qué cambió.
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!liberado && (
            <button
              onClick={liberar}
              disabled={!paquete || trabajando}
              style={boton('var(--nexus)', '#fff')}
            >
              {trabajando ? <Loader2 size={14} aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={14} aria-hidden="true" />}
              Liberar al paciente
            </button>
          )}

          {liberado && (
            <>
              {p.telefono && (
                <button onClick={() => entregar('whatsapp')} disabled={trabajando} style={boton('var(--s3)', 'var(--text)')}>
                  <Send size={14} aria-hidden="true" />
                  Mandar por WhatsApp
                </button>
              )}
              <button onClick={() => entregar('copiar')} disabled={trabajando} style={boton('var(--s3)', 'var(--text)')}>
                {copiado ? <ClipboardCheck size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                {copiado ? 'Copiado' : 'Copiar el mensaje con el enlace'}
              </button>
              <button onClick={retirar} disabled={trabajando} style={boton('transparent', 'var(--text3)')}>
                <Undo2 size={14} aria-hidden="true" />
                Retirar del portal
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function boton(fondo: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    /* 44 px de alto mínimo: es el objetivo táctil de WCAG 2.2 AA, y esta
       pantalla se usa con el paciente todavía enfrente. */
    padding: '11px 14px', minHeight: 44, borderRadius: 10, fontSize: 14, fontWeight: 600,
    background: fondo, color, border: '1px solid var(--border)', cursor: 'pointer',
  }
}
