'use client'
/**
 * ENTREGARLE LA CONSULTA AL PACIENTE — V9 · `POSTVISIT-001`.
 *
 * ── EL HUECO QUE CIERRA ─────────────────────────────────────────────────────
 *
 * La hoja del paciente existía desde REG-242, estaba bien hecha —determinista,
 * sin modelo, se niega a inventar una pauta— y **el producto no la entregaba**:
 * dos botones, copiar e imprimir. No estaba en `/mi/[token]`, ni en
 * `/api/portal`, ni en ninguna plantilla de WhatsApp.
 *
 * «Escrito, probado y sin conectar» en su forma más cara: la pieza mejor pensada
 * del lado del paciente, sin camino hasta él.
 *
 * ── POR QUÉ ES UN BOTÓN APARTE Y NO PARTE DE FIRMAR ─────────────────────────
 *
 * Porque **firmar y liberar son dos actos** (regla 4 de `patient-facing-ai.md`).
 * Firmar es medicolegal, hacia el expediente. Liberar es comunicación, hacia el
 * paciente: «esto es lo que quiero que leas». El día que el médico quiera firmar
 * y todavía no liberar —una nota con un resultado pendiente de comentar—, tiene
 * que poder.
 *
 * Se pueden hacer en el mismo gesto, y por eso este control vive pegado a la
 * hoja: un clic más, no una pantalla más.
 *
 * ── LO QUE ESTE COMPONENTE NO DECIDE ────────────────────────────────────────
 *
 * Nada. No compone el paquete, no comprueba la firma y no sabe quién aprueba:
 * todo eso lo hace `/api/expediente/paquete-visita` con el token verificado en la
 * mano. Aquí sólo se pulsa y se cuenta lo que contestó el servidor — incluido el
 * 409 de «ya se entregó», que se enseña tal cual en vez de esconderse.
 */
import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { fetchAutenticado } from '@/lib/auth-client'

const RUTA = '/api/expediente/paquete-visita'

export interface EntregarAlPacienteProps {
  clinicId: string
  patientId: string
  notaId: string
}

type Estado =
  | { fase: 'cargando' }
  | { fase: 'sin-entregar' }
  | { fase: 'entregando' }
  | { fase: 'entregado'; cuando: number | null }
  | { fase: 'error'; mensaje: string }

/** `1754000000000` → «9 de agosto, 14:32». Sin librería y sin inventar zona. */
function cuandoEnLlano(ms: number | null): string {
  if (!ms) return ''
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    }).format(new Date(ms))
  } catch { return '' }
}

export function EntregarAlPaciente({ clinicId, patientId, notaId }: EntregarAlPacienteProps) {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })

  /**
   * ¿ESTA CONSULTA YA SE ENTREGÓ? — se le pregunta al servidor al montar.
   *
   * Sin esto, el médico que vuelve a abrir una nota ya entregada vería otra vez
   * «Entregar al paciente» y pensaría que la primera vez falló.
   *
   * El `vivo` no es ceremonia: la consulta es la pantalla desde la que más se
   * navega, y escribir estado sobre un componente desmontado es un aviso en la
   * consola que enseña a ignorar la consola.
   */
  useEffect(() => {
    let vivo = true
    const preguntar = async () => {
      try {
        const r = await fetchAutenticado(RUTA, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'estado', clinicId, patientId, notaId }),
        })
        const d = await r.json().catch(() => ({}))
        if (!vivo) return
        if (!r.ok) { setEstado({ fase: 'sin-entregar' }); return }
        setEstado(d.liberado ? { fase: 'entregado', cuando: d.approvedAt ?? null } : { fase: 'sin-entregar' })
      } catch {
        /**
         * Sin respuesta NO se afirma que no se entregó: se ofrece el botón, y si
         * ya estaba entregado el servidor contesta 409 y la pantalla se corrige.
         * La verdad la tiene él, no este componente.
         */
        if (vivo) setEstado({ fase: 'sin-entregar' })
      }
    }
    void preguntar()
    return () => { vivo = false }
  }, [clinicId, patientId, notaId])

  const entregar = async () => {
    setEstado({ fase: 'entregando' })
    try {
      const r = await fetchAutenticado(RUTA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'liberar', clinicId, patientId, notaId }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setEstado({ fase: 'entregado', cuando: d.approvedAt ?? null }); return }
      /* El 409 de «ya se entregó» no es un error del médico: es el estado real. */
      if (r.status === 409 && d.liberado) { setEstado({ fase: 'entregado', cuando: d.approvedAt ?? null }); return }
      setEstado({ fase: 'error', mensaje: typeof d.error === 'string' ? d.error : 'No se pudo entregar' })
    } catch {
      setEstado({ fase: 'error', mensaje: 'No se pudo entregar. Revisa tu conexión.' })
    }
  }

  if (estado.fase === 'cargando') return null

  return (
    <div
      className="no-print"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        marginTop: 10, padding: '10px 14px',
        border: '1px solid var(--border)', borderRadius: 10, background: 'var(--s1)',
      }}
    >
      {estado.fase === 'entregado' ? (
        <>
          <CheckCircle2 size={15} style={{ color: 'var(--green)' }} aria-hidden />
          <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
            Entregado al paciente
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {cuandoEnLlano(estado.cuando)
              ? `${cuandoEnLlano(estado.cuando)} · lo ve en su enlace, en «Tu plan de cuidado»`
              : 'Lo ve en su enlace, en «Tu plan de cuidado»'}
          </span>
        </>
      ) : (
        <>
          <button
            onClick={entregar}
            disabled={estado.fase === 'entregando'}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {estado.fase === 'entregando'
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
              : <Send size={14} aria-hidden />}
            Entregar al paciente
          </button>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            Aparece en su enlace del portal. Firmar no lo entrega: son dos actos.
          </span>
        </>
      )}

      {estado.fase === 'error' && (
        <span role="alert" style={{ fontSize: 12, color: 'var(--red)' }}>
          {estado.mensaje}
        </span>
      )}
    </div>
  )
}

export const POR_QUE_ENTREGAR_ES_OTRO_ACTO =
  'Firmar es medicolegal, hacia el expediente. Liberar es comunicación, hacia el ' +
  'paciente. El día que el médico quiera firmar sin liberar todavía —un resultado ' +
  'pendiente de comentar— tiene que poder.'
