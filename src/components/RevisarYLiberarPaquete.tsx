'use client'
/**
 * REVISAR Y LIBERAR AL PACIENTE — POSTVISIT-001.
 *
 * ── QUÉ ARREGLA ─────────────────────────────────────────────────────────────
 *
 * El paquete de la visita (`PATIENT-COMPANION-001`) nace `DRAFT` y **nadie lo
 * componía**: `componerPaquete` existía sin llamador. La superficie del
 * paciente estaba lista para recibir paquetes y ninguno se creaba nunca — el
 * portal decía la verdad con un estado vacío, pero la verdad era que faltaba
 * esta pantalla.
 *
 * ── FIRMAR Y LIBERAR SIGUEN SIENDO DOS ACTOS ────────────────────────────────
 *
 * Este componente sólo se monta cuando la nota YA está firmada (lo decide
 * quien lo usa, igual que `HojaParaElPaciente`). Aun así, «componer» no libera
 * nada: arma un `DRAFT` que el médico revisa aquí mismo, y sólo con el botón
 * «Liberar al paciente» pasa a `RELEASED`. Las dos peticiones van al servidor
 * (`POST /api/expediente/paquete-visita`), que es quien de verdad decide —
 * esconder un botón no cierra una ruta HTTP.
 *
 * ── POR QUÉ NO SE COMPONE SOLO AL MONTAR ────────────────────────────────────
 *
 * Componer automáticamente en cuanto la nota se firma escribiría un `DRAFT` de
 * cada firma, incluida la que el médico deshace o corrige al vuelo. Un clic
 * explícito («Revisar paquete») es la misma frontera que ya existe para
 * imprimir la receta o la orden: nada se genera hasta que alguien lo pide.
 */
import { useState } from 'react'
import { CheckCircle2, ClipboardList, Loader2 } from 'lucide-react'
import { fetchAutenticado } from '@/lib/auth-client'
import type { CambioDeMedicacion, PaqueteDeVisita } from '@/lib/paciente/paquete-de-visita'

export interface RevisarYLiberarPaqueteProps {
  clinicId: string
  patientId: string
  notaId: string
}

type Fase = 'inicial' | 'componiendo' | 'revisando' | 'liberando' | 'liberado' | 'error'

const ETIQUETA_CAMBIO: Record<CambioDeMedicacion['tipo'], string> = {
  nuevo: 'Nuevo',
  suspendido: 'Suspendido',
  'sin-cambio': 'Sin cambio',
}

function Boton(p: { onClick: () => void; disabled?: boolean; children: React.ReactNode; primario?: boolean }) {
  return (
    <button
      onClick={p.onClick}
      disabled={p.disabled}
      className={`btn btn-sm ${p.primario ? 'btn-primary' : 'btn-secondary'}`}
    >
      {p.children}
    </button>
  )
}

export function RevisarYLiberarPaquete(p: RevisarYLiberarPaqueteProps) {
  const [fase, setFase] = useState<Fase>('inicial')
  const [paquete, setPaquete] = useState<PaqueteDeVisita | null>(null)
  const [paqueteId, setPaqueteId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const componer = async () => {
    setFase('componiendo')
    setError('')
    try {
      const res = await fetchAutenticado('/api/expediente/paquete-visita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId: p.clinicId, patientId: p.patientId, action: 'componer', notaId: p.notaId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo componer el paquete')
      setPaquete(data.paquete)
      setPaqueteId(data.paqueteId)
      setFase('revisando')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo componer el paquete')
      setFase('error')
    }
  }

  const liberarAlPaciente = async () => {
    if (!paqueteId) return
    setFase('liberando')
    setError('')
    try {
      const res = await fetchAutenticado('/api/expediente/paquete-visita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId: p.clinicId, patientId: p.patientId, action: 'liberar', paqueteId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo liberar el paquete')
      setPaquete(data.paquete)
      setFase('liberado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo liberar el paquete')
      setFase('error')
    }
  }

  return (
    <section style={{
      border: '1px solid var(--border)', borderRadius: 14,
      background: 'var(--s2)', marginTop: 16, overflow: 'hidden',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <ClipboardList size={16} style={{ color: 'var(--text3)' }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Revisar y liberar al paciente
        </span>
        {fase === 'liberado' && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
            <CheckCircle2 size={14} /> Liberado
          </span>
        )}
      </header>

      <div style={{ padding: 14 }}>
        {fase === 'inicial' && (
          <>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text3)', lineHeight: 1.55 }}>
              Compone lo que el paciente vería en su portal —resumen, medicamentos,
              estudios y seguimiento— para que usted lo revise antes de que lo vea.
              Nada llega al paciente hasta que usted lo libere.
            </p>
            <div style={{ marginTop: 12 }}>
              <Boton onClick={componer}>Revisar paquete</Boton>
            </div>
          </>
        )}

        {fase === 'componiendo' && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={14} className="animate-spin" /> Componiendo…
          </p>
        )}

        {(fase === 'revisando' || fase === 'liberando' || fase === 'liberado') && paquete && (
          <>
            <VistaDelPaquete paquete={paquete} />

            {fase !== 'liberado' && (
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <Boton onClick={liberarAlPaciente} disabled={fase === 'liberando'} primario>
                  {fase === 'liberando' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {fase === 'liberando' ? 'Liberando…' : 'Liberar al paciente'}
                </Boton>
              </div>
            )}

            {fase === 'liberado' && (
              <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
                Aprobado por {paquete.approvedBy} · {paquete.approvedAt ? new Date(paquete.approvedAt).toLocaleString('es-MX') : ''}
              </p>
            )}
          </>
        )}

        {fase === 'error' && (
          <>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--red)' }}>{error}</p>
            <div style={{ marginTop: 10 }}>
              <Boton onClick={paqueteId ? liberarAlPaciente : componer}>Reintentar</Boton>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function VistaDelPaquete({ paquete }: { paquete: PaqueteDeVisita }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {paquete.encounterSummary && (
        <Bloque titulo="Resumen">
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>{paquete.encounterSummary}</p>
        </Bloque>
      )}

      {paquete.medicationInstructions.length > 0 && (
        <Bloque titulo="Medicamentos">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {paquete.medicationInstructions.map(m => (
              <li key={m.nombre} style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{m.instruccion}</li>
            ))}
          </ul>
        </Bloque>
      )}

      {paquete.medicationChanges && paquete.medicationChanges.length > 0 && (
        <Bloque titulo="Cambios desde la visita anterior">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {paquete.medicationChanges.map(c => (
              <li key={c.nombre} style={{ fontSize: 14, color: 'var(--text)' }}>
                {c.nombre} — {ETIQUETA_CAMBIO[c.tipo]}
              </li>
            ))}
          </ul>
        </Bloque>
      )}

      {paquete.orders.length > 0 && (
        <Bloque titulo="Estudios">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {paquete.orders.map(o => <li key={o} style={{ fontSize: 14, color: 'var(--text)' }}>{o}</li>)}
          </ul>
        </Bloque>
      )}

      {paquete.followUp && (
        <Bloque titulo="Seguimiento">
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>{paquete.followUp}</p>
        </Bloque>
      )}

      {!paquete.encounterSummary && !paquete.medicationInstructions.length && !paquete.orders.length && !paquete.followUp && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text3)' }}>
          Esta consulta no dejó nada estructurado para mostrar en el portal todavía.
        </p>
      )}
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 style={{
        margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
        textTransform: 'uppercase', color: 'var(--text3)',
      }}>
        {titulo}
      </h4>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  )
}

export const POR_QUE_NO_SE_COMPONE_SOLO =
  'Componer automáticamente en cuanto se firma escribiría un DRAFT de cada ' +
  'firma, incluida la que el médico corrige al vuelo. Un clic explícito es la ' +
  'misma frontera que ya existe para imprimir la receta o la orden.'
