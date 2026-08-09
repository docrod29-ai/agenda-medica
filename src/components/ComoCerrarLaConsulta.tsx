'use client'
/**
 * CÓMO CERRAR LA CONSULTA — REG-244.
 *
 * ── QUÉ ARREGLA ─────────────────────────────────────────────────────────────
 *
 * Al firmar, la consulta elegía UN destino. Con medicamentos **y** estudios iba
 * a la receta y **la orden se quedaba sin imprimir**: el paciente salía sin su
 * solicitud de estudios, y todo se veía correcto —nota firmada, cita atendida—.
 *
 * Aquí no se elige: se enseña lo que queda, con lo que pasa si no se hace, y se
 * hace en el orden que convenga.
 *
 * ── POR QUÉ DICE LA CONSECUENCIA Y NO SÓLO EL NOMBRE ────────────────────────
 *
 * «Orden de estudios» es una etiqueta. «El laboratorio no le va a tomar la
 * muestra sin la solicitud» es una razón para pulsar. A las once de la noche,
 * con el siguiente paciente esperando, la diferencia entre las dos frases es si
 * el paciente vuelve o no vuelve.
 *
 * ── POR QUÉ SÓLO APARECE CUANDO HAY MÁS DE UNA COSA ─────────────────────────
 *
 * Con un solo destino se sigue yendo directo, como siempre. Ese caso no estaba
 * roto, y añadirle un clic a la consulta más común para arreglar un problema
 * que esa consulta no tiene sería empeorar el flujo con la excusa de mejorarlo.
 */
import { ArrowRight, Check } from 'lucide-react'
import type { PasoDeCierre } from '@/lib/expediente/que-falta-para-cerrar'

export interface ComoCerrarLaConsultaProps {
  pasos: readonly PasoDeCierre[]
  /** Los que ya se hicieron en esta sesión, por su clave. */
  hechos?: readonly string[]
  alIr: (ruta: string) => void
}

export function ComoCerrarLaConsulta(p: ComoCerrarLaConsultaProps) {
  if (!p.pasos.length) return null
  const hechos = new Set(p.hechos ?? [])

  return (
    <section style={{
      border: '1px solid var(--border)', borderRadius: 11,
      background: 'var(--s2)', marginTop: 16, overflow: 'hidden',
    }}>
      <header style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
          Ya está firmada. Falta esto
        </span>
      </header>

      <div style={{ padding: 8 }}>
        {p.pasos.map(paso => {
          const hecho = hechos.has(paso.que)
          const esVolver = paso.que === 'expediente'
          return (
            <button
              key={paso.que}
              onClick={() => paso.ruta && p.alIr(paso.ruta)}
              disabled={!paso.ruta}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 10px', borderRadius: 9, textAlign: 'left',
                background: 'transparent', border: 0, font: 'inherit',
                cursor: paso.ruta ? 'pointer' : 'default',
                opacity: hecho ? 0.55 : 1,
              }}
            >
              <span aria-hidden style={{
                width: 22, height: 22, borderRadius: 'var(--r-pill)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: hecho ? 'var(--green)' : 'var(--s3)',
                color: hecho ? '#FFF' : 'var(--text3)',
              }}>
                {hecho ? <Check size={13} /> : null}
              </span>

              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{
                  display: 'block', fontSize: 14.5, fontWeight: esVolver ? 500 : 600,
                  color: 'var(--text)',
                }}>
                  {paso.titulo}
                </span>
                {/*
                  La consecuencia, no la etiqueta. «Orden de estudios» es un
                  nombre; «el laboratorio no le va a tomar la muestra» es una
                  razón para pulsar.
                */}
                {paso.siNoSeHace && !hecho && (
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.45, marginTop: 2 }}>
                    {paso.siNoSeHace}
                  </span>
                )}
              </span>

              {paso.ruta && <ArrowRight size={15} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export const POR_QUE_DICE_LA_CONSECUENCIA =
  '«Orden de estudios» es una etiqueta. «El laboratorio no le va a tomar la ' +
  'muestra sin la solicitud» es una razón para pulsar.'

export const POR_QUE_NO_SALE_SIEMPRE =
  'Con un solo destino se va directo, como siempre. Añadirle un clic a la ' +
  'consulta más común para arreglar un problema que no tiene sería empeorar el ' +
  'flujo con la excusa de mejorarlo.'
