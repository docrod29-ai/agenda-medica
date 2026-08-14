'use client'
/**
 * DE DÓNDE SALIÓ ESTO — cada frase de la nota, junto al trozo de dictado que la
 * sostiene.
 *
 * ── POR QUÉ ESTO, Y POR QUÉ AHORA ───────────────────────────────────────────
 *
 * La investigación del mercado (7-ago-2026) dejó dos datos que juntos mandan:
 *
 *   1. Sobre 62 811 pares borrador→nota final de la Universidad de California,
 *      los médicos borraron **216 199 oraciones** e insertaron 165 939. El
 *      borrador de IA no se firma: se reescribe.
 *   2. Y lo hacen para **añadir cautela**: 3 440 secciones viraron hacia más
 *      incertidumbre contra 2 516 hacia más certeza (p < 0,001). El borrador
 *      afirma de más, y el médico gasta trabajo en desinflarlo.
 *
 * De los tres productos que dominan el mercado, **uno solo** tiene un mecanismo
 * real contra eso: el *Linked Evidence* de Abridge — subrayas una frase de la
 * nota y te enseña el fragmento del que salió. Suki no publica ninguno. Y Nabla
 * hace lo contrario: **borra el audio original**, con lo cual es imposible
 * comparar la nota con lo que de verdad se dijo (AP, oct-2024).
 *
 * ── LO QUE NO SE CONSTRUYÓ AQUÍ ─────────────────────────────────────────────
 *
 * El motor. `rastrearNota()` en `lib/expediente/trazabilidad.ts` ya devolvía,
 * para cada frase de la nota, **el fragmento del dictado con sus posiciones
 * exactas**, y tiene su corpus oro. Estaba escrito, probado y sin conectar: la
 * pantalla sólo usaba la mitad negativa —lo que NO tiene respaldo— y tiraba la
 * mitad que contesta la pregunta.
 *
 * Esta es la familia de defecto número uno de este sistema, otra vez.
 *
 * ── LA DECISIÓN DE DISEÑO ───────────────────────────────────────────────────
 *
 * Empieza CERRADO. La nota es lo que el médico lee; esto es lo que abre cuando
 * duda de una línea. Un panel que se abre solo delante de una nota correcta es
 * ruido, y el ruido es de lo que él ya se quejó: «esto nomás confunde».
 *
 * Y no puntúa la nota. No hay «94 % respaldada» — un porcentaje invita a firmar
 * por el número en vez de por las tres frases que están en rojo.
 *
 * ── DÓNDE SE ABRE (V15 §5 CAPA 4 / §21) ─────────────────────────────────────
 *
 * Hasta el 15-ago esto era un acordeón EN LÍNEA, y la medición de la corrida
 * lo dejó en números: abrirlo hacía crecer la nota de 2141 a 3013px en
 * escritorio y de 2666 a 3886px en el teléfono — entre 872 y 1220px de empujón
 * a todo lo que había debajo—, y **Escape no lo cerraba**.
 *
 * El disparador se queda EXACTAMENTE donde estaba, con el mismo texto y el
 * mismo resumen; lo que cambia es dónde aterriza lo que abre: la lente
 * contextual. En escritorio ancho ocupa el canalón que el lienzo ya reservaba,
 * así que la nota no se mueve ni un píxel mientras se compara con el dictado —
 * que es justo el gesto para el que existe esta pantalla.
 */
import { useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Quote } from 'lucide-react'
import { Lente } from '@/components/LenteContextual'
import type { Utterance } from '@/hooks/useGrabacionAudio'
import { cuandoSeDijo } from '@/lib/expediente/cuando-se-dijo'
import { EscucharElMomento } from '@/components/EscucharElMomento'
import { rastrearNota, type Respaldo } from '@/lib/expediente/trazabilidad'

export interface DeDondeSalioEstoProps {
  /** El texto de la nota tal como quedaría firmado. */
  nota: string
  /** El dictado, que es la fuente. */
  dictado: string
  /**
   * Los turnos con sus tiempos por palabra. Sin ellos no hay botón de escuchar
   * — que es lo correcto: no se sabe en qué segundo se dijo (REG-250).
   */
  utterances?: readonly Utterance[]
  /** Ruta del audio en Storage. `null` mientras no haya audio guardado. */
  audioPath?: string | null
  /** Resuelve la ruta a URL reproducible, en el momento de pulsar. */
  resolverUrlDeAudio?: (path: string) => Promise<string>
}

const COLOR: Record<Respaldo['estado'], { punto: string; rotulo: string }> = {
  respaldada: { punto: 'var(--green)', rotulo: 'Se dijo' },
  parcial: { punto: 'var(--amber)', rotulo: 'Se dijo en parte' },
  sin_respaldo: { punto: 'var(--red)', rotulo: 'No se encuentra en el dictado' },
}

export function DeDondeSalioEsto(p: DeDondeSalioEstoProps) {
  const [abierto, setAbierto] = useState(false)
  const disparador = useRef<HTMLButtonElement | null>(null)

  const trazas = useMemo(
    () => (abierto ? rastrearNota(p.nota, p.dictado) : []),
    [abierto, p.nota, p.dictado],
  )

  /* Sin dictado no hay nada que contrastar, y decirlo con un panel vacío sería
     peor que no enseñarlo. */
  if (!p.dictado.trim() || !p.nota.trim()) return null

  const dudosas = trazas.filter(t => t.estado !== 'respaldada').length

  return (
    <section
      style={{
        border: '1px solid var(--border)', /* 11 y no 12: la escala visual tiene tope de 24 radios distintos y 12 era uno nuevo. */
        borderRadius: 11,
        background: 'var(--s2)', marginTop: 16, overflow: 'hidden',
      }}
    >
      <button
        ref={disparador}
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', background: 'transparent', border: 0,
          cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
          font: 'inherit', fontWeight: 600, fontSize: 14,
        }}
      >
        {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Quote size={15} style={{ color: 'var(--text3)' }} />
        <span>¿De dónde salió esto?</span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text3)', fontWeight: 400 }}>
          {abierto
            ? (dudosas > 0
              ? `${dudosas} ${dudosas === 1 ? 'frase' : 'frases'} sin apoyo claro`
              : 'todo se dijo en la consulta')
            : 'cada frase, junto a lo que usted dictó'}
        </span>
      </button>

      <Lente
        abierta={abierto}
        titulo="¿De dónde salió esto?"
        subtitulo={
          dudosas > 0
            ? `${dudosas} ${dudosas === 1 ? 'frase' : 'frases'} de la nota sin apoyo claro en el dictado`
            : 'Cada frase de la nota, junto a lo que usted dictó'
        }
        invocador={disparador}
        alCerrar={() => setAbierto(false)}
      >
        <div>
          {trazas.map((t, i) => (
            <div
              key={i}
              style={{
                display: 'grid', gridTemplateColumns: '10px 1fr', gap: 10,
                /* Sin recorte lateral propio: el cuerpo de la lente ya lo pone.
                   Repetirlo daba 30px de sangría en una columna de 400. */
                padding: '10px 0',
                borderTop: i > 0 ? '1px solid var(--border)' : undefined,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8, height: 8, /* `--r-pill` y no `--r-circulo`: en un elemento CUADRADO el navegador
                     recorta el radio a la mitad del lado, así que da el mismo círculo
                     sin añadir un valor más a la escala visual (tope: 24). */
                  borderRadius: 'var(--r-pill)', marginTop: 6,
                  background: COLOR[t.estado].punto,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                  {t.afirmacion}
                </p>

                {/*
                  El fragmento LITERAL del dictado. No se parafrasea ni se
                  recorta por el medio: si lo que sostiene la frase es una
                  palabra suelta, se ve que es una palabra suelta.
                */}
                {t.segmento
                  ? (
                    <>
                      <p style={{
                        margin: '6px 0 0', fontSize: 13, color: 'var(--text3)',
                        lineHeight: 1.5, paddingLeft: 10,
                        borderLeft: `2px solid ${COLOR[t.estado].punto}`,
                      }}>
                        «{t.segmento.texto}»
                      </p>

                      {/*
                        ESCUCHARLO (REG-250). Sólo aparece si se sabe en qué
                        segundo se dijo Y hay audio guardado. Si el motor no
                        localiza la frase con seguridad devuelve null y aquí no
                        sale botón: nunca se aproxima, porque una prueba en el
                        segundo equivocado es peor que ninguna prueba.
                      */}
                      {p.resolverUrlDeAudio && (() => {
                        const m = cuandoSeDijo(t.segmento.texto, p.utterances)
                        return m ? (
                          <span style={{ paddingLeft: 10 }}>
                            <EscucharElMomento
                              audioPath={p.audioPath}
                              inicioMs={m.inicioMs}
                              resolverUrl={p.resolverUrlDeAudio!}
                              etiqueta={t.afirmacion}
                            />
                          </span>
                        ) : null
                      })()}
                    </>
                  )
                  : (
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--red)' }}>
                      {COLOR[t.estado].rotulo}
                      {t.huerfanas.length > 0 && (
                        <> — no aparece: {t.huerfanas.slice(0, 6).join(', ')}</>
                      )}
                    </p>
                  )}
              </div>
            </div>
          ))}

          <p style={{
            margin: '4px 0 0', padding: '10px 0 0', fontSize: 12,
            color: 'var(--text3)', lineHeight: 1.5,
            borderTop: '1px solid var(--border)',
          }}>
            Compara la nota contra <b>lo que usted dictó</b>. Que una frase no
            aparezca aquí no la vuelve falsa —puede venir del expediente o de la
            exploración que no narró en voz alta—: significa que <b>el dictado
            no la sostiene</b>, y que si alguien la discute, no hay dónde
            enseñarla.
          </p>
        </div>
      </Lente>
    </section>
  )
}

export const POR_QUE_EMPIEZA_CERRADO =
  'La nota es lo que el médico lee; esto es lo que abre cuando duda de una ' +
  'línea. Un panel abierto delante de una nota correcta es ruido, y del ruido ' +
  'ya se quejó: «esto nomás confunde».'

export const POR_QUE_NO_HAY_PORCENTAJE =
  'Un «94 % respaldada» invita a firmar por el número en vez de por las tres ' +
  'frases que están en rojo.'

export const LO_QUE_HACE_NABLA =
  'Nabla borra el audio original por seguridad del dato, con lo cual es ' +
  'imposible comparar su nota con lo que se dijo (AP, oct-2024). Aquí el ' +
  'dictado se conserva, y por eso esta pantalla puede existir.'

export const EL_MOTOR_YA_ESTABA =
  'rastrearNota() devolvía esto desde hace versiones, con corpus oro. La ' +
  'pantalla sólo usaba la mitad negativa. Escrito, probado y sin conectar.'
