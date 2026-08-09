'use client'
/**
 * LIBERAR AL PACIENTE — el gesto que faltaba entre la consulta y su teléfono.
 *
 * V9 · `POSTVISIT-001`. Hasta hoy, «lo que se lleva el paciente» se podía copiar
 * o imprimir, y ahí terminaba: no llegaba a `/mi/[token]`, ni a `/api/portal`,
 * ni a ninguna plantilla de mensaje. Esta tarjeta es el camino.
 *
 * ── QUÉ ENSEÑA, Y POR QUÉ ES EXACTAMENTE LO QUE VA A LEER EL PACIENTE ───────
 *
 * No compone nada. Pide al servidor la previsualización y pinta **el mismo
 * objeto** que se guardaría al liberar. Si la pantalla compusiera su propia
 * versión «para enseñarla», el médico estaría aprobando un texto y el paciente
 * leería otro — que es la forma más silenciosa de romper una aprobación.
 *
 * ── POR QUÉ APARECE SÓLO CON LA NOTA FIRMADA ────────────────────────────────
 *
 * Porque liberar exige firma, y un botón que siempre falla es peor que un botón
 * ausente. La compuerta de verdad está en el servidor —esta tarjeta ni siquiera
 * se monta antes de la firma— y las dos dicen lo mismo a propósito.
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, Send, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { fetchAutenticado } from '@/lib/auth-client'
import type { PaqueteDeVisita, CambioDeMedicacion } from '@/lib/paciente/paquete-de-visita'

export interface LiberarAlPacienteProps {
  clinicId: string
  patientId: string
  /** La nota FIRMADA de la que sale el paquete. Sin ella no se monta nada. */
  notaId: string
}

interface Liberado { version: number; approvedAt: number | null }

const ETIQUETA_CAMBIO: Record<CambioDeMedicacion['tipo'], string> = {
  nuevo: 'empieza',
  modificado: 'cambia',
  suspendido: 'se suspende',
  'sin-cambio': 'sigue igual',
}

export function LiberarAlPaciente({ clinicId, patientId, notaId }: LiberarAlPacienteProps) {
  const [paquete, setPaquete] = useState<PaqueteDeVisita | null>(null)
  const [liberado, setLiberado] = useState<Liberado | null>(null)
  const [hayContenido, setHayContenido] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const pedir = useCallback(async (accion: 'previsualizar' | 'liberar') => {
    const r = await fetchAutenticado('/api/paciente/paquete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId, patientId, notaId, accion }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d?.ok) throw new Error(typeof d?.error === 'string' ? d.error : 'No se pudo preparar el paquete')
    return d as { paquete: PaqueteDeVisita; liberado: Liberado | null; hayContenido?: boolean }
  }, [clinicId, patientId, notaId])

  useEffect(() => {
    let vivo = true
    /* `cargando` nace en `true` y sólo baja al terminar: poner el estado a mano
       aquí dentro es la cascada de renders que marca el compilador de React. */
    pedir('previsualizar')
      .then(d => {
        if (!vivo) return
        setPaquete(d.paquete)
        setLiberado(d.liberado)
        setHayContenido(d.hayContenido !== false)
        setError('')
      })
      .catch((e: Error) => { if (vivo) setError(e.message) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [pedir])

  const liberarAhora = async () => {
    setEnviando(true)
    setError('')
    try {
      const d = await pedir('liberar')
      setPaquete(d.paquete)
      setLiberado(d.liberado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo liberar')
    } finally {
      setEnviando(false)
    }
  }

  /* Sin paquete no se enseña una tarjeta vacía; el error sí se dice. */
  if (cargando) return null
  if (!paquete && !error) return null

  const yaLiberado = !!liberado

  return (
    <section
      style={{
        border: '1px solid var(--border)', borderRadius: 14,
        background: 'var(--s2)', marginTop: 16, overflow: 'hidden',
      }}
    >
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Lo que va a leer el paciente en su portal
        </span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {yaLiberado
            ? `Liberado · versión ${liberado?.version}`
            : 'Todavía no lo ve nadie. Firmar y liberar son dos actos.'}
        </span>

        {/*
          El primitivo compartido, no un botón a mano: el sistema de diseño ya
          define la acción primaria, su foco visible y su objetivo táctil, y una
          copia local se queda atrás la primera vez que el sistema cambie.
        */}
        <div className="no-print" style={{ marginLeft: 'auto' }}>
          <Button
            variant={yaLiberado ? 'secondary' : 'primary'}
            onClick={liberarAhora}
            loading={enviando}
            disabled={!hayContenido}
            icon={yaLiberado ? <Check size={16} /> : <Send size={16} />}
            aria-label={yaLiberado ? 'Liberar una versión corregida al paciente' : 'Liberar al paciente'}
          >
            {enviando ? 'Liberando…' : yaLiberado ? 'Liberar una corrección' : 'Liberar al paciente'}
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" style={{
          display: 'flex', alignItems: 'center', gap: 8, margin: 0,
          padding: '10px 14px', fontSize: 12, color: 'var(--text2)',
          borderBottom: '1px solid var(--border)',
        }}>
          <TriangleAlert size={14} /> {error}
        </p>
      )}

      {paquete && (
        <div style={{ padding: '4px 14px 14px' }}>
          {paquete.encounterSummary && (
            <Bloque titulo="Resumen de la consulta" lineas={[paquete.encounterSummary]} />
          )}
          {paquete.medicationInstructions.length > 0 && (
            <Bloque titulo="Sus medicamentos" lineas={paquete.medicationInstructions.map(m => m.instruccion)} />
          )}
          {paquete.medicationChanges === null ? (
            /* «No lo sé» dicho en voz alta. Sin visita anterior firmada no se
               puede afirmar qué cambió, y callarlo se leería como «nada cambió». */
            <Bloque
              titulo="Qué cambió"
              lineas={['No hay una consulta firmada anterior con la que comparar: no se afirma qué cambió.']}
            />
          ) : paquete.medicationChanges.length > 0 && (
            <Bloque
              titulo="Qué cambió"
              lineas={paquete.medicationChanges.map(c => `${c.nombre} — ${ETIQUETA_CAMBIO[c.tipo]}`)}
            />
          )}
          {paquete.orders.length > 0 && (
            <Bloque titulo="Estudios que le pidió" lineas={paquete.orders} />
          )}
          {paquete.followUp && <Bloque titulo="Su próxima cita" lineas={[paquete.followUp]} />}
          {!hayContenido && (
            <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)' }}>
              Esta consulta no dejó medicamentos, estudios ni seguimiento: no hay nada que liberar.
            </p>
          )}
        </div>
      )}
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

export const POR_QUE_NO_COMPONE_EN_LA_PANTALLA =
  'Si la pantalla compusiera su propia versión para enseñarla, el médico ' +
  'aprobaría un texto y el paciente leería otro. Se pinta lo que devuelve el ' +
  'servidor, que es el mismo objeto que se guarda al liberar.'
