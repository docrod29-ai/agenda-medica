'use client'
// ══════════════════════════════════════════════════════════════
// VERIFICACIÓN DEL PASE — charter §24, §31, §8, §12 y tendencias.
//
// Los motores existían, pasaban sus golden y NO LOS VEÍA NADIE. Aquí no se
// calcula nada: se les pasan los valores del panel y se pinta lo que devuelven.
//
// Es la pestaña donde el sistema enseña EN QUÉ NO ESTÁ DE ACUERDO consigo mismo
// y QUÉ NO PUEDE CALCULAR — las dos cosas que un copiloto honesto tiene que
// decir en voz alta.
// ══════════════════════════════════════════════════════════════
import { useMemo } from 'react'
import { GitCompare, HelpCircle, TrendingUp, Info, AlertTriangle, CheckCircle2, ShieldQuestion, Droplet } from 'lucide-react'
import {
  reconciliar, soloDiscrepancias, resumenRevision,
  PARES_RECONCILIABLES, type Reconciliacion,
} from '@/lib/uci/reconciliacion'
import { huecos, soloFaltantes, datosQueDesbloquean } from '@/lib/uci/dato-faltante'
import { tendenciasUCI, flechaTendencia, type PuntoSerie } from '@/lib/uci/tendencias'
import { contextoDicho, CONTEXTOS_UCI } from '@/lib/uci/contexto-vocabulario'
import { num } from '@/lib/uci/num'
import {
  clasificarConfirmacion, preguntaDeDesambiguacion, CONFIANZA_BAJA,
  type DecisionConfirmacion,
} from '@/lib/uci/confirmacion'
import { revisarInfusion, tieneErrores, type RegistroInfusion } from '@/lib/uci/infusion-registro'

const COLOR_VEREDICTO: Record<Reconciliacion['veredicto'], string> = {
  concuerdan: '#0d9488', discrepan: '#dc2626', incomparable: 'var(--text3)',
}

function Bloque({ icon: Icon, titulo, sub, children }: {
  icon: typeof Info; titulo: string; sub?: string; children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Icon size={16} style={{ color: 'var(--nexus,#3d5afe)' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{titulo}</span>
        {sub && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>· {sub}</span>}
      </div>
      {children}
    </div>
  )
}

const Nota = ({ children, color = '#d97706' }: { children: React.ReactNode; color?: string }) => (
  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.55, color: 'var(--text3)' }}>
    <AlertTriangle size={13} style={{ color, flexShrink: 0, marginTop: 2 }} />
    <div>{children}</div>
  </div>
)

export interface VerificacionProps {
  /** Campos capturados/dictados en el panel, tal cual. */
  campos: Record<string, string>
  /** Lo que los motores deterministas calcularon con esos campos. */
  computados: Record<string, number | null>
  /** Serie histórica de lecturas para las tendencias. */
  lecturas: readonly { t: number; m: Record<string, number> }[]
  /** Texto del pase dictado, si lo hubo. */
  dictado?: string
  /** Avisos deterministas de la extracción por voz. */
  avisosVoz?: readonly { campo: string; crudo: string; motivo: 'implausible' | 'ambiguo'; detalle: string }[]
  /** La infusión que el panel está calculando ahora mismo, si hay alguna. */
  infusion?: RegistroInfusion | null
}

export default function Verificacion({ campos, computados, lecturas, dictado, avisosVoz, infusion }: VerificacionProps) {
  // ── §24 · dictado vs calculado ──
  const reconciliaciones = useMemo(() => PARES_RECONCILIABLES.map(p => {
    // El valor DICTADO de un campo derivado sólo existe si el médico lo dijo:
    // se busca por su clave en los campos, no se deduce.
    const clave = p.campo === 'driving pressure' ? 'drivingPressure'
      : p.campo === 'presión arterial media' ? 'pam' : 'kirby'
    return reconciliar(p.campo, num(campos[clave]), computados[clave], p.unidad)
  }), [campos, computados])

  const discrepan = soloDiscrepancias(reconciliaciones)
  const aviso = resumenRevision(reconciliaciones)

  // ── §31 · qué NO se puede calcular y por qué ──
  const hs = useMemo(() => huecos(campos), [campos])
  const faltantes = soloFaltantes(hs)
  const desbloquean = datosQueDesbloquean(hs)

  // ── Tendencias ──
  const tend = useMemo(() => {
    const series: Record<string, PuntoSerie[]> = {}
    for (const l of lecturas) {
      for (const [k, v] of Object.entries(l.m)) {
        if (!Number.isFinite(v)) continue
        ;(series[k] ??= []).push({ t: l.t, v })
      }
    }
    return tendenciasUCI(series)
  }, [lecturas])

  // ── §8 · contexto del dictado ──
  const contexto = useMemo(() => (dictado ? contextoDicho(dictado) : null), [dictado])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Bloque icon={GitCompare} titulo="Dictado vs calculado" sub="charter §24">
        {aviso && (
          <div style={{ marginBottom: 10 }}>
            <Nota color="#dc2626">{aviso}</Nota>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {reconciliaciones.map(r => (
            <div key={r.campo} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
              <span style={{ color: 'var(--text2)' }}>{r.mensaje}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: COLOR_VEREDICTO[r.veredicto], flexShrink: 0 }}>
                {r.veredicto}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <Nota color="var(--text3)">
            Cuando los dos números no coinciden, el sistema <strong>no elige ganador</strong>:
            muestra los dos y quién los produjo. Decidir cuál vale —una Pplat mal medida o un
            dato mal dictado— es criterio de quien está en la cabecera.
            {discrepan.length === 0 && ' Ahora mismo no hay ninguna discrepancia.'}
          </Nota>
        </div>
      </Bloque>

      <Bloque icon={HelpCircle} titulo="Lo que NO se puede calcular" sub="charter §31">
        {faltantes.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text3)' }}>
            <CheckCircle2 size={15} style={{ color: '#0d9488' }} />
            No falta ningún dato para lo que este panel calcula.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {faltantes.map(h => (
                <div key={h.campo} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                  · {h.mensaje}
                </div>
              ))}
            </div>
            {desbloquean.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text3)', marginBottom: 6 }}>
                  Un dato que desbloquea varias cosas
                </div>
                {desbloquean.map(d => (
                  <div key={d.dato} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>
                    <strong>{d.dato}</strong> → {d.desbloquea.join(', ')}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div style={{ marginTop: 10 }}>
          <Nota color="var(--text3)">
            «Faltan datos» no es lo mismo que «no aplica» ni que «sale normal».
            Un hueco que se calla se lee como un resultado.
          </Nota>
        </div>
      </Bloque>

      {Object.keys(tend).length > 0 && (
        <Bloque icon={TrendingUp} titulo="Tendencias" sub={`${lecturas.length} lecturas`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {Object.entries(tend).map(([k, t]) => (
              <span key={k} style={{ fontSize: 12.5, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
                {k} <strong style={{ color: 'var(--text)' }}>{flechaTendencia(t.direccion)}</strong>
              </span>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <Nota color="var(--text3)">
              La flecha es la dirección del dato, no un juicio. Subir o bajar no significa
              mejor o peor salvo donde esa dirección está declarada — eso lo dice el Morning Brief.
            </Nota>
          </div>
        </Bloque>
      )}

      {(avisosVoz?.length ?? 0) > 0 && (
        <Bloque icon={ShieldQuestion} titulo="Qué hay que confirmar" sub="charter §12">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {avisosVoz!.map((a, i) => {
              // La decisión es DETERMINISTA. El LLM no la toma: aporta señales.
              const d: DecisionConfirmacion = clasificarConfirmacion({
                concepto: a.campo,
                // El reconocedor NO devuelve confianza por término hoy, así que
                // ese camino no se evalúa. Se pasa 1 para NO fabricar una
                // confianza baja que dispararía preguntas inventadas — y se
                // declara abajo, porque callarlo sería peor.
                confianzaVoz: 1,
                contextoConcuerda: contexto !== null,
                plausible: a.motivo === 'implausible' ? false : null,
                unidadAmbigua: a.motivo === 'ambiguo',
                seVuelveOrden: false,
              })
              const pregunta = preguntaDeDesambiguacion(a.crudo, d.candidatosEnDisputa ?? [])
              return (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--s2)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13 }}>{a.campo}</strong>
                    <span style={{ fontSize: 11, fontWeight: 700, color: d.interrumpeAhora ? '#d97706' : 'var(--text3)' }}>
                      {d.nivel}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{a.detalle}</div>
                  {d.motivos.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
                      {d.motivos.join(' · ')}
                    </div>
                  )}
                  {pregunta && <div style={{ fontSize: 12.5, color: 'var(--nexus,#3d5afe)', marginTop: 4 }}>{pregunta}</div>}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 10 }}>
            <Nota color="var(--text3)">
              La decisión de preguntar o no es <strong>determinista</strong>: la IA aporta
              señales, no el veredicto. Hoy el transcriptor no devuelve confianza por término,
              así que el camino de «confianza baja» (&lt; {CONFIANZA_BAJA}) <strong>no se evalúa</strong>;
              los demás —valor improbable, unidad ambigua, contexto que no concuerda— sí.
            </Nota>
          </div>
        </Bloque>
      )}

      {infusion && (() => {
        const hallazgos = revisarInfusion(infusion)
        if (hallazgos.length === 0) return null
        return (
          <Bloque icon={Droplet} titulo="Revisión de la infusión" sub="charter §13/19/20">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {hallazgos.map((h, i) => (
                <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5, color: h.severidad === 'ERROR' ? '#dc2626' : 'var(--text2)' }}>
                  · {h.mensaje}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <Nota color={tieneErrores(hallazgos) ? '#dc2626' : 'var(--text3)'}>
                Esto revisa la <strong>estructura</strong> del registro: que la concentración no
                contradiga sus partes, que el peso conste, que la procedencia esté declarada.
                <strong> No juzga si la dosis es alta o baja</strong> — eso son los umbrales de
                magnitud del §20, que fija el médico y todavía no están.
              </Nota>
            </div>
          </Bloque>
        )
      })()}

      {dictado && (
        <Bloque icon={Info} titulo="Contexto del dictado" sub="charter §8">
          {contexto === null ? (
            <Nota color="var(--text3)">
              No se nombró ningún aparato o sistema en el dictado. El sistema
              <strong> no lo infiere</strong>: sin contexto, un término que significa cosas
              distintas en ventilación y en hemodinamia se queda ambiguo, y adivinar sería peor
              que preguntar.
            </Nota>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                Contexto detectado: <strong style={{ color: 'var(--nexus,#3d5afe)' }}>{contexto}</strong>
              </div>
              <div style={{ marginTop: 8 }}>
                <Nota color="var(--text3)">
                  Los términos que también existen en otros contextos se validan contra éste.
                  Ante la duda, el sistema <strong>falla abierto</strong>: prefiere aceptar el
                  término y que usted lo revise, antes que descartar en silencio un dato real.
                </Nota>
              </div>
            </>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>
            Contextos que reconoce: {CONTEXTOS_UCI.join(' · ')}
          </div>
        </Bloque>
      )}
    </div>
  )
}
