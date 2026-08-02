'use client'
// ══════════════════════════════════════════════════════════════
// BENCHMARK DE VOZ — charter §41.
//
// Aquí se GRABA el material que hoy no existe: frases dictadas por el médico con
// su transcripción correcta al lado. Sin esto, «la app entiende mi dictado» no
// tiene respuesta con número: sólo sabemos que no truena.
//
// NUNCA se graban pases reales. El guion son casos FICTICIOS: se habla igual que
// en la unidad —mismo acento, misma jerga, mismo ruido— pero el paciente lo
// inventa el médico. Se mide igual de bien y no hay PHI que proteger.
// ══════════════════════════════════════════════════════════════
import { useMemo, useState } from 'react'
import { Mic, Square, ArrowLeft, ArrowRight, Trash2, Info, AlertTriangle, BarChart3 } from 'lucide-react'
import { useSmartBack } from '@/hooks/useSmartBack'
import { useToast } from '@/context/ToastContext'
import { useGrabacionAudio } from '@/hooks/useGrabacionAudio'
import { Button } from '@/components/ui'
import {
  evaluarFrase, reporteVoz, muestraSuficiente, NO_CORRIGE,
  type ResultadoFrase,
} from '@/lib/uci/benchmark-voz'
import { VOCABULARIO_POR_CONTEXTO } from '@/lib/uci/contexto-vocabulario'

/**
 * Guion de lectura.
 *
 * Las frases se componen con el vocabulario que la aplicación YA conoce; no se
 * inventa terminología. Los números son arbitrarios y **no son recomendaciones
 * clínicas**: sirven para oír cómo se pronuncian, no para decir qué poner.
 */
const GUION: readonly string[] = [
  'PEEP de ocho, FiO2 al cuarenta, volumen corriente cuatrocientos veinte',
  'presión plateau de veintidós, driving pressure de catorce',
  'norepinefrina a cero punto cero seis microgramos kilo minuto',
  'lactato de uno punto ocho, pH de siete punto tres cinco',
  'PaO2 de noventa y dos, índice de Kirby de doscientos treinta',
  'RASS menos dos, pupilas isocóricas reactivas',
  'diuresis de cero punto ocho mililitros kilo hora',
  'balance de más ochocientos en las últimas veinticuatro horas',
  'CKRT en modo CVVHDF, flujo de sangre ciento cincuenta',
  'ECMO veno venoso, flujo de cuatro punto dos litros por minuto',
  'creatinina de uno punto cuatro, urea de sesenta',
  'ventilación mecánica invasiva, modo asistido controlado por volumen',
  'VExUS grado dos, vena cava colapsable',
  'temperatura de treinta y siete punto ocho, frecuencia cardiaca noventa y seis',
  'se suspende el vasopresor y se inicia destete de la ventilación',
]

interface Captura {
  id: string
  gold: string
  transcripcion: string
}

export default function BenchmarkVozPage() {
  const volver = useSmartBack('/uci')
  const { toast } = useToast()
  const audio = useGrabacionAudio()

  const [modo, setModo] = useState<'guion' | 'libre'>('guion')
  const [i, setI] = useState(0)
  const [goldLibre, setGoldLibre] = useState('')
  const [capturas, setCapturas] = useState<Captura[]>([])

  const grabando = audio.estado === 'grabando'
  const goldActual = modo === 'guion' ? GUION[i % GUION.length] : goldLibre

  /** Vocabulario a vigilar: el que la app ya conoce, sin inventar nada. */
  const terminos = useMemo(
    () => [...new Set(Object.values(VOCABULARIO_POR_CONTEXTO).flat())],
    [],
  )

  const resultados: ResultadoFrase[] = useMemo(
    () => capturas.map(c => evaluarFrase(c.id, c.gold, c.transcripcion, terminos)),
    [capturas, terminos],
  )
  const rep = useMemo(() => reporteVoz(resultados), [resultados])
  const muestra = muestraSuficiente(rep)

  const guardar = () => {
    const t = audio.transcripcion.trim()
    if (t === '') { toast('Todavía no hay transcripción de esta grabación', 'error'); return }
    if (goldActual.trim() === '') { toast('Falta escribir lo que dijiste', 'error'); return }
    setCapturas(cs => [...cs, { id: String(cs.length + 1), gold: goldActual, transcripcion: t }])
    if (modo === 'guion') setI(n => n + 1); else setGoldLibre('')
    toast(`Frase ${capturas.length + 1} guardada`, 'success')
  }

  const exportar = () => {
    const blob = new Blob([JSON.stringify({ capturas, reporte: rep }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `benchmark-voz-uci-${capturas.length}-frases.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`)

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 4px 40px' }}>
      <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0 }}>
        <ArrowLeft size={15} /> Pacientes y camas de UCI
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <BarChart3 size={22} style={{ color: 'var(--nexus,#3d5afe)' }} /> Benchmark de voz
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 0 16px', lineHeight: 1.6 }}>
        Mide cuánto entiende de verdad el dictado de UCI. Grabas, el sistema transcribe,
        y se compara contra lo que realmente dijiste.
      </p>

      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 11, background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.35)', marginBottom: 16 }}>
        <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text)' }}>
          <strong>No grabes pases reales.</strong> Un pase de visita real contiene datos de
          pacientes. El guion son casos <strong>ficticios</strong>: hablas igual que en la unidad
          —mismo acento, misma jerga, mismo ruido de fondo— pero el paciente lo inventas tú.
          Se mide igual de bien y no hay nada que proteger.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['guion', 'Leer el guion'], ['libre', 'Dictado libre']] as const).map(([k, txt]) => (
          <button key={k} onClick={() => setModo(k)} style={{
            background: modo === k ? 'rgba(61,90,254,0.14)' : 'none',
            border: `1px solid ${modo === k ? 'var(--nexus,#3d5afe)' : 'var(--border)'}`,
            color: modo === k ? 'var(--nexus,#3d5afe)' : 'var(--text3)',
            borderRadius: 9, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', minHeight: 36,
          }}>{txt}</button>
        ))}
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
        {modo === 'guion' ? (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text3)', marginBottom: 8 }}>
              Frase {(i % GUION.length) + 1} de {GUION.length} · léela como la dirías en el pase
            </div>
            <div style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text)', fontWeight: 600 }}>
              {goldActual}
            </div>
            <button onClick={() => setI(n => n + 1)} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12.5, padding: 0 }}>
              Saltar esta <ArrowRight size={13} />
            </button>
          </>
        ) : (
          <>
            <label style={{ fontSize: 12.5, color: 'var(--text2)' }}>
              Dicta lo que quieras y escribe aquí <strong>exactamente</strong> lo que dijiste
            </label>
            <textarea
              value={goldLibre} onChange={e => setGoldLibre(e.target.value)}
              rows={3}
              placeholder="Lo que dijiste, palabra por palabra"
              style={{ width: '100%', marginTop: 6, background: 'transparent', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 11px', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit' }}
            />
          </>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
          {audio.soportado ? (
            <Button
              onClick={() => (grabando ? audio.detener() : audio.iniciar({ recoveryKey: 'benchmark-voz', contexto: 'uci' }))}
              icon={grabando ? <Square size={15} /> : <Mic size={15} />}
              style={grabando ? { background: '#dc2626', color: '#fff', border: 'none' } : undefined}
            >
              {grabando ? 'Detener' : 'Grabar'}
            </Button>
          ) : <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>Este dispositivo no soporta grabación.</span>}
          <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
            {audio.estado === 'grabando' && `● Grabando… ${Math.floor(audio.duracion)}s`}
            {audio.estado === 'subiendo' && 'Transcribiendo…'}
          </span>
          {audio.transcripcion.trim() !== '' && (
            <Button variant="secondary" size="sm" onClick={guardar}>Guardar frase</Button>
          )}
        </div>

        {audio.transcripcion.trim() !== '' && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 9, background: 'var(--s2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>
              Lo que entendió
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.55 }}>{audio.transcripcion}</div>
          </div>
        )}
        {audio.error && <div style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 8 }}>{audio.error}</div>}
      </div>

      {capturas.length > 0 && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Resultado · {rep.frases} frase{rep.frases !== 1 ? 's' : ''}</span>
            <Button size="sm" variant="secondary" onClick={exportar}>Exportar JSON</Button>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700 }}>Exactitud clínica</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {pct(rep.exactitudClinica)}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{rep.terminosAcertados}/{rep.terminosEvaluados} términos</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700 }}>WER medio</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                {(rep.werMedio * 100).toFixed(1)} %
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>sólo de referencia</div>
            </div>
          </div>

          {!muestra.basta && (
            <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.55, color: 'var(--amber)', marginBottom: 12 }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{muestra.motivo}</div>
            </div>
          )}

          {rep.ranking.filter(r => r.perdidas > 0).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text3)', marginBottom: 6 }}>
                Lo que más se pierde
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                {rep.ranking.filter(r => r.perdidas > 0).slice(0, 12).map(r => (
                  <div key={r.termino} style={{ fontSize: 12.5, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
                    <strong style={{ color: 'var(--red)' }}>{r.termino}</strong> — falló {r.perdidas} de {r.veces}
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
            {resultados.slice().reverse().slice(0, 6).map(r => (
              <div key={r.id} style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text3)', borderLeft: `2px solid ${r.perdidos.length > 0 ? '#dc2626' : '#0d9488'}`, paddingLeft: 8 }}>
                <div><strong style={{ color: 'var(--text2)' }}>Dijiste:</strong> {r.gold}</div>
                <div><strong style={{ color: 'var(--text2)' }}>Entendió:</strong> {r.transcripcion}</div>
                {r.perdidos.length > 0 && <div style={{ color: 'var(--red)' }}>Perdió: {r.perdidos.join(', ')}</div>}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 11.5, lineHeight: 1.6, color: 'var(--text3)' }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              {NO_CORRIGE} La <strong>exactitud clínica</strong> es la que manda: el WER trata
              «el» y «norepinefrina» como si valieran lo mismo, y en un pase no valen lo mismo.
            </div>
          </div>

          <button onClick={() => setCapturas([])} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12 }}>
            <Trash2 size={12} /> Empezar de cero
          </button>
        </div>
      )}
    </div>
  )
}
