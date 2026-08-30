'use client'
/**
 * QUÉ NOTA ES — una línea en vez de doce controles.
 *
 * ── LO QUE HABÍA (medido el 7-ago-2026 sobre la pantalla real) ──────────────
 *
 * Antes del micrófono se pintaban **ocho bloques**, dos de ellos enteros para
 * decidir cosas que casi nunca cambian:
 *
 *   · diez botones de tipo de nota, en dos filas
 *   · un desplegable de especialidad con su etiqueta y su explicación
 *
 * El médico dijo qué le estorba, con estas palabras: **«demasiadas cosas en
 * pantalla antes de poder hablar»**.
 *
 * ── POR QUÉ NO SE ESCONDEN, QUE ERA MI PRIMERA IDEA ─────────────────────────
 *
 * Le pregunté cuáles usa en una semana normal esperando quedarme con dos.
 * Contestó que **los diez**. Así que esconder los ocho «raros» habría sido
 * diseñar para un médico que no existe.
 *
 * La solución no es enseñar menos opciones: es **no preguntar cuando no hace
 * falta**. El sistema ya sabe si el paciente es nuevo, y la especialidad casi
 * siempre es la misma. Así que se muestran **como una frase**, ya resueltas, con
 * un lápiz para corregirlas. Doce controles se vuelven una línea que se lee de
 * un vistazo — y cuando la tocas, están los diez, sin esconder ninguno.
 *
 * ── LA REGLA QUE SALE DE AQUÍ ───────────────────────────────────────────────
 *
 * Simplificar no es quitar: es que cada cosa aparezca **cuando toca**. Un
 * desplegable que se contesta igual noventa veces de cada cien no es una
 * elección, es un peaje.
 */
import { useState } from 'react'
import { ChevronDown, Pencil, Sparkles, Loader2 } from 'lucide-react'
import type { TipoNota } from '@/types/expediente'

export interface QueNotaEsProps {
  tipo: TipoNota
  etiquetaDe: (t: TipoNota) => string
  tiposDisponibles: readonly TipoNota[]
  alCambiarTipo: (t: TipoNota) => void

  especialidad: string
  especialidadesPorGrupo: readonly { grupo: string; items: readonly string[] }[]
  alCambiarEspecialidad: (e: string) => void

  /** La nota se arma sola mientras se habla; se enseña que está viva. */
  estructurandoEnVivo?: boolean
}

export function QueNotaEs(p: QueNotaEsProps) {
  const [abierto, setAbierto] = useState(false)

  const linea = (
    <button
      onClick={() => setAbierto(v => !v)}
      aria-expanded={abierto}
      aria-label={`Tipo de nota: ${p.etiquetaDe(p.tipo)}. Especialidad: ${p.especialidad || 'General'}. Tocar para cambiar.`}
      className="nx-acc-texto"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'transparent', border: 'none', cursor: 'pointer',
        fontSize: 13.5, padding: '8px 0',
        /* 44 px de alto real: es el mínimo para el pulgar en un teléfono. */
        minHeight: 44, textAlign: 'left',
      }}
    >
      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.etiquetaDe(p.tipo)}</span>
      <span style={{ color: 'var(--text3)' }}>·</span>
      <span>{p.especialidad || 'General'}</span>
      <Pencil size={13} style={{ color: 'var(--text3)' }} />
    </button>
  )

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {linea}
        {/*
          «Nota en vivo» deja de ser una etiqueta decorativa y sólo se enseña
          cuando de verdad está trabajando. Un distintivo que está siempre
          encendido no informa de nada.
        */}
        {p.estructurandoEnVivo && (
          <span
            title="La nota se está armando mientras grabas"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, padding: '5px 12px',
              borderRadius: 'var(--r-pill)', border: '1px solid var(--nexus)',
              background: 'var(--nexus-soft)', color: 'var(--nexus)',
            }}
          >
            <Sparkles size={13} />
            Escribiendo la nota
            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          </span>
        )}
      </div>

      {abierto && (
        <div
          style={{
            marginTop: 8, padding: 14, borderRadius: 12,
            background: 'var(--s2)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Tipo de nota</div>
            {/*
              Los DIEZ, sin esconder ninguno: el médico dijo que usa todos. Lo
              que cambia es que ya no están delante cuando no se necesitan.
            */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {p.tiposDisponibles.map(t => (
                <button
                  key={t}
                  onClick={() => { p.alCambiarTipo(t); setAbierto(false) }}
                  aria-pressed={p.tipo === t}
                  style={{
                    minHeight: 40, padding: '9px 14px', borderRadius: 'var(--r-pill)',
                    fontSize: 13, fontWeight: p.tipo === t ? 700 : 500, cursor: 'pointer',
                    border: `1px solid ${p.tipo === t ? 'var(--nexus)' : 'var(--border)'}`,
                    background: p.tipo === t ? 'rgba(61,90,254,0.14)' : 'var(--s1)',
                    color: p.tipo === t ? 'var(--nexus)' : 'var(--text2)',
                  }}
                >
                  {p.etiquetaDe(t)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="especialidad-de-la-nota"
              style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}
            >
              Especialidad · la IA redacta la nota con ese criterio
            </label>
            <select
              id="especialidad-de-la-nota"
              value={p.especialidad}
              onChange={e => p.alCambiarEspecialidad(e.target.value)}
              style={{
                background: 'var(--s1)', border: '1px solid var(--border)', color: 'var(--text)',
                borderRadius: 8, padding: '10px 12px', fontSize: 14, cursor: 'pointer',
                minHeight: 44, width: '100%', maxWidth: 340,
              }}
            >
              <option value="">General / Otra</option>
              {p.especialidadesPorGrupo.map(g => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.items.map(e => <option key={e} value={e}>{e}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <button
            onClick={() => setAbierto(false)}
            style={{
              alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', color: 'var(--text3)',
              fontSize: 13, cursor: 'pointer', minHeight: 40,
            }}
          >
            <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} /> Listo
          </button>
        </div>
      )}
    </div>
  )
}

export const POR_QUE_UNA_LINEA_Y_NO_DOCE_CONTROLES =
  'El médico dijo que usa los diez tipos, así que esconder ocho habría sido ' +
  'diseñar para alguien que no existe. La solución no es enseñar menos ' +
  'opciones: es no preguntar cuando no hace falta.'

export const POR_QUE_44_PX =
  'Es el mínimo real para tocar con el pulgar en un teléfono. El médico usa ' +
  'celular y computadora por igual, así que la línea tiene que servir para los dos.'
