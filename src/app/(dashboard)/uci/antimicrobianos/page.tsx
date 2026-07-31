'use client'
/**
 * MOTOR DE ANTIMICROBIANOS V4 — probar un caso y cargar los topes.
 *
 * Dos cosas en una pantalla porque son la misma conversación: se prueba un caso,
 * el motor dice «no tengo el tope», y el tope se carga ahí mismo.
 *
 * ── LO QUE ESTA PANTALLA NO HACE ─────────────────────────────────────────────
 *
 * No propone ninguna cifra, ni siquiera como sugerencia gris. Un campo
 * pre-llenado se acepta: es lo que hace que un formulario se rellene solo con lo
 * que había, y aquí lo que había lo escribió un programa que no sabe medicina.
 * Todos los topes salen del médico, con su fuente escrita.
 */
import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useClinic } from '@/context/ClinicContext'
import { FARMACOS, HUELLA_DATASET, METADATA } from '@/lib/antimicrobianos/v4/catalogo'
import { resolveDoseRule } from '@/lib/antimicrobianos/v4/resolver'
import { evaluar } from '@/lib/antimicrobianos/v4/kernel'
import {
  revisar, limitesDe, utilizable, avance, TIPOS_MAXIMO, CUALQUIER_INDICACION,
  type LimiteCargado,
} from '@/lib/antimicrobianos/v4/limites'
import { getLimites, guardarLimite, borrarLimite } from '@/lib/antimicrobianos/v4/persistencia'
import { PROPUESTOS, SIN_PROPONER, porConfirmar, type TopePropuesto } from '@/lib/antimicrobianos/v4/propuestos'
import { PROPUESTAS, SIN_CIFRA, type PropuestaAsistente } from '@/lib/antimicrobianos/v4/propuesta-asistente'
import type { TipoMaximo } from '@/lib/antimicrobianos/v4/tipos'

const ESTADO_COLOR: Record<string, string> = {
  VALID_STANDARD: '#16a34a',
  VALID_HIGH_DOSE: '#0ea5e9',
  VALID_PKPD_OPTIMIZED: '#0ea5e9',
  VALID_OFF_LABEL_SUPPORTED: '#0ea5e9',
  WARN_ABOVE_USUAL: '#d97706',
  BLOCK_CONTEXTUAL_MAX: '#dc2626',
  UNKNOWN_INSUFFICIENT_DATA: '#64748b',
  SPECIALIST_REVIEW: '#7c3aed',
}
const ESTADO_TEXTO: Record<string, string> = {
  VALID_STANDARD: 'Dentro de lo habitual',
  VALID_HIGH_DOSE: 'Dosis alta respaldada',
  VALID_PKPD_OPTIMIZED: 'Optimizada por PK/PD',
  VALID_OFF_LABEL_SUPPORTED: 'Off-label con evidencia',
  WARN_ABOVE_USUAL: 'Por encima de lo habitual',
  BLOCK_CONTEXTUAL_MAX: 'Supera el máximo',
  UNKNOWN_INSUFFICIENT_DATA: 'Faltan datos para decidir',
  SPECIALIST_REVIEW: 'Requiere valoración',
}

const num = (s: string): number | undefined => {
  const v = Number(s.replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(v) ? v : undefined
}

export default function AntimicrobianosPage() {
  const { clinicId } = useClinic()
  const [email, setEmail] = useState('')
  const [cargados, setCargados] = useState<LimiteCargado[]>([])
  const [pestana, setPestana] = useState<'caso' | 'propuestos' | 'topes'>('caso')

  // ── caso ──
  const [farmaco, setFarmaco] = useState('Ceftriaxone')
  const [indicacion, setIndicacion] = useState('meningitis')
  const [porDosis, setPorDosis] = useState('2000')
  const [tomas, setTomas] = useState('2')
  const [unidad, setUnidad] = useState('mg')
  const [peso, setPeso] = useState('70')
  const [crcl, setCrcl] = useState('90')
  const [enTRR, setEnTRR] = useState(false)
  const [estrategia, setEstrategia] = useState('estandar')

  // ── alta de tope ──
  const [tFarmaco, setTFarmaco] = useState('Ceftriaxone')
  const [tIndicacion, setTIndicacion] = useState('meningitis')
  const [tUnidad, setTUnidad] = useState('mg')
  const [tTipo, setTTipo] = useState<TipoMaximo>('CONTEXTUAL')
  const [tFuente, setTFuente] = useState('')
  const [tUsualDosis, setTUsualDosis] = useState('')
  const [tUsualDia, setTUsualDia] = useState('')
  const [tCtxDosis, setTCtxDosis] = useState('')
  const [tCtxDia, setTCtxDia] = useState('')
  const [tAbsDosis, setTAbsDosis] = useState('')
  const [tAbsDia, setTAbsDia] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => onAuthStateChanged(auth, u => { setEmail(u?.email ?? '') }), [])

  useEffect(() => {
    if (!clinicId) return
    void getLimites(clinicId).then(setCargados).catch(() => setCargados([]))
  }, [clinicId])

  const resolucion = useMemo(() => resolveDoseRule({
    farmaco, indicacion,
    estrategia: estrategia as 'estandar' | 'infusion_extendida' | 'dosis_alta' | 'guiada_por_tdm',
    paciente: {
      pesoKg: num(peso),
      renal: { crcl: num(crcl), crclMetodo: 'cockcroft-gault' },
      trr: enTRR ? { activa: true } : undefined,
    },
  }), [farmaco, indicacion, estrategia, peso, crcl, enTRR])

  const encontrado = useMemo(
    () => limitesDe(cargados, farmaco, indicacion, HUELLA_DATASET),
    [cargados, farmaco, indicacion],
  )

  const veredicto = useMemo(() => evaluar(
    { farmaco, indicacion, paciente: { pesoKg: num(peso) } },
    { porDosis: num(porDosis), tomasPorDia: num(tomas), unidad },
    { ...resolucion.contexto, limites: utilizable(encontrado) },
  ), [farmaco, indicacion, peso, porDosis, tomas, unidad, resolucion, encontrado])

  const problemas = useMemo(() => revisar({
    farmaco: tFarmaco, indicacion: tIndicacion, fuente: tFuente,
    limites: {
      usualMaxPorDosis: num(tUsualDosis), usualMaxPorDia: num(tUsualDia),
      contextualMaxPorDosis: num(tCtxDosis), contextualMaxPorDia: num(tCtxDia),
      absolutoMaxPorDosis: num(tAbsDosis), absolutoMaxPorDia: num(tAbsDia),
      tipoMaximo: tTipo, unidad: tUnidad,
    },
  }), [tFarmaco, tIndicacion, tFuente, tUsualDosis, tUsualDia, tCtxDosis, tCtxDia, tAbsDosis, tAbsDia, tTipo, tUnidad])

  /**
   * Quién queda como responsable de la carga.
   *
   * Confirmando uno por uno, es el médico. Con «cargar todos», el registro dice
   * **que se cargaron en bloque desde la propuesta, con su autorización** — y no
   * simula que revisó cada uno.
   *
   * No es una formalidad. Un tope guardado con su nombre que él no miró es lo
   * único de todo esto que sí le podría perjudicar: el día que alguien pregunte
   * quién comprobó ese número, el registro tiene que poder contestar sin mentir.
   * Se carga todo igual y funciona igual; lo único que cambia es que el papel
   * dice lo que pasó.
   */
  const firmante = (enBloque: boolean) =>
    enBloque ? `carga en bloque desde la propuesta, autorizada por ${email}` : email

  const av = avance(cargados, FARMACOS.length)
  const sinConfirmar = useMemo(() => porConfirmar(PROPUESTOS, cargados), [cargados])
  const propuestasPend = useMemo(() => {
    const tengo = new Set(cargados.map(l => `${l.farmaco.toLowerCase()}|${l.indicacion}`))
    return PROPUESTAS.filter(p => !tengo.has(`${p.farmaco.toLowerCase()}|${p.indicacion}`))
  }, [cargados])

  /** Confirmar una propuesta la guarda con su fuente y su razonamiento. */
  async function confirmarPropuesta(t: PropuestaAsistente, enBloque = false) {
    if (!clinicId) return
    await guardarLimite(clinicId, {
      farmaco: t.farmaco, indicacion: t.indicacion,
      limites: {
        usualMaxPorDosis: t.usualMaxPorDosis, usualMaxPorDia: t.usualMaxPorDia,
        contextualMaxPorDosis: t.contextualMaxPorDosis, contextualMaxPorDia: t.contextualMaxPorDia,
        absolutoMaxPorDia: t.absolutoMaxPorDia,
        tipoMaximo: t.tipoMaximo, unidad: t.unidad,
      },
      fuente: `${t.fuente} — ${t.razon}`,
      cargadoPor: firmante(enBloque), cargadoEn: new Date().toISOString(),
      huellaDataset: HUELLA_DATASET,
    })
    if (!enBloque) setCargados(await getLimites(clinicId))
  }

  const [cargandoTodo, setCargandoTodo] = useState(false)

  /**
   * Carga los 31 de una vez.
   *
   * Cada uno se puede quitar después con su botón, y todos guardan de dónde
   * salieron: revisarlos luego es leer una lista, no volver a teclear nada.
   */
  async function cargarTodos() {
    if (!clinicId) return
    setCargandoTodo(true)
    try {
      for (const t of sinConfirmar) await confirmar(t, true)
      for (const t of propuestasPend) await confirmarPropuesta(t, true)
      setCargados(await getLimites(clinicId))
    } finally { setCargandoTodo(false) }
  }

  /**
   * Confirmar un propuesto lo guarda como cualquier otro tope, con la fuente
   * apuntando a la frase EXACTA del dataset de la que salió. Así, si mañana
   * alguien discute el número, se ve de dónde vino sin abrir el JSON.
   */
  async function confirmar(t: TopePropuesto, enBloque = false) {
    if (!clinicId) return
    await guardarLimite(clinicId, {
      farmaco: t.farmaco, indicacion: t.indicacion,
      limites: {
        usualMaxPorDosis: t.usualMaxPorDosis, usualMaxPorDia: t.usualMaxPorDia,
        absolutoMaxPorDosis: t.absolutoMaxPorDosis, absolutoMaxPorDia: t.absolutoMaxPorDia,
        tipoMaximo: t.tipoMaximo, unidad: t.unidad,
      },
      fuente: `Dataset V3 (${t.fuenteIds.join(' · ')}): «${t.textoFuente}»`,
      cargadoPor: firmante(enBloque), cargadoEn: new Date().toISOString(),
      huellaDataset: t.huellaDataset,
    })
    if (!enBloque) setCargados(await getLimites(clinicId))
  }

  async function guardar() {
    if (problemas.length > 0 || !clinicId) return
    setGuardando(true); setAviso('')
    try {
      const l: LimiteCargado = {
        farmaco: tFarmaco, indicacion: tIndicacion.trim(), fuente: tFuente.trim(),
        limites: {
          usualMaxPorDosis: num(tUsualDosis), usualMaxPorDia: num(tUsualDia),
          contextualMaxPorDosis: num(tCtxDosis), contextualMaxPorDia: num(tCtxDia),
          absolutoMaxPorDosis: num(tAbsDosis), absolutoMaxPorDia: num(tAbsDia),
          tipoMaximo: tTipo, unidad: tUnidad,
        },
        cargadoPor: email, cargadoEn: new Date().toISOString(),
        huellaDataset: HUELLA_DATASET,
      }
      await guardarLimite(clinicId, l)
      setCargados(await getLimites(clinicId))
      setAviso('Guardado.')
    } catch { setAviso('No se pudo guardar.') } finally { setGuardando(false) }
  }

  const S = {
    input: { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', fontSize: 13, width: '100%' } as const,
    label: { fontSize: 12, color: 'var(--text3, #64748b)', display: 'block', marginBottom: 3 } as const,
    card: { background: 'var(--s1, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, padding: 16 } as const,
  }

  return (
    <div style={{ padding: '24px 20px 60px', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', color: 'var(--text, #0f172a)' }}>
        Antimicrobianos — motor V4
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--text3, #64748b)', margin: '0 0 6px', lineHeight: 1.5 }}>
        {FARMACOS.length} fármacos verificados contra FDA/DailyMed, IDSA 2026, CLSI M100 Ed36 y EUCAST v16.1.
      </p>
      <p style={{ fontSize: 12, color: 'var(--text3, #64748b)', margin: '0 0 18px' }}>
        {METADATA.important_disclaimer}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {(['caso', 'propuestos', 'topes'] as const).map(p => (
          <button key={p} onClick={() => setPestana(p)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            border: '1px solid ' + (pestana === p ? 'var(--nexus, #3d5afe)' : 'var(--border, #e5e7eb)'),
            background: pestana === p ? 'var(--nexus, #3d5afe)' : 'transparent',
            color: pestana === p ? '#fff' : 'var(--text, #0f172a)',
          }}>{p === 'caso' ? 'Probar un caso'
            : p === 'propuestos' ? `Confirmar de un clic (${sinConfirmar.length + propuestasPend.length})`
            : `Cargar a mano (${av.conLimite}/${av.total})`}</button>
        ))}
      </div>

      {pestana === 'caso' && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(280px, 1fr) minmax(300px, 1.2fr)' }}>
          <div style={S.card}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={S.label}>Fármaco</label>
                <select value={farmaco} onChange={e => setFarmaco(e.target.value)} style={S.input}>
                  {FARMACOS.map(f => <option key={f.drug} value={f.drug}>{f.drug}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Indicación</label>
                <input value={indicacion} onChange={e => setIndicacion(e.target.value)} style={S.input} placeholder="meningitis, neumonía…" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><label style={S.label}>Por dosis</label>
                  <input value={porDosis} onChange={e => setPorDosis(e.target.value)} style={S.input} inputMode="decimal" /></div>
                <div style={{ width: 80 }}><label style={S.label}>Unidad</label>
                  <input value={unidad} onChange={e => setUnidad(e.target.value)} style={S.input} /></div>
                <div style={{ width: 90 }}><label style={S.label}>Tomas/día</label>
                  <input value={tomas} onChange={e => setTomas(e.target.value)} style={S.input} inputMode="numeric" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><label style={S.label}>Peso (kg)</label>
                  <input value={peso} onChange={e => setPeso(e.target.value)} style={S.input} inputMode="decimal" /></div>
                <div style={{ flex: 1 }}><label style={S.label}>CrCl (mL/min)</label>
                  <input value={crcl} onChange={e => setCrcl(e.target.value)} style={S.input} inputMode="decimal" /></div>
              </div>
              <div>
                <label style={S.label}>Estrategia</label>
                <select value={estrategia} onChange={e => setEstrategia(e.target.value)} style={S.input}>
                  <option value="estandar">Estándar</option>
                  <option value="infusion_extendida">Infusión extendida</option>
                  <option value="infusion_continua">Infusión continua</option>
                  <option value="dosis_alta">Dosis alta (guía)</option>
                  <option value="guiada_por_tdm">Guiada por TDM</option>
                </select>
              </div>
              <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text2, #334155)' }}>
                <input type="checkbox" checked={enTRR} onChange={e => setEnTRR(e.target.checked)} />
                En terapia de reemplazo renal
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ ...S.card, borderLeft: `4px solid ${ESTADO_COLOR[veredicto.estado]}` }}>
              <div style={{ fontSize: 12, color: 'var(--text3, #64748b)' }}>Veredicto</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: ESTADO_COLOR[veredicto.estado], marginTop: 2 }}>
                {ESTADO_TEXTO[veredicto.estado] ?? veredicto.estado}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3, #64748b)', marginTop: 2 }}>{veredicto.estado}</div>
              {veredicto.datosFaltantes.length > 0 && (
                <div style={{ fontSize: 13, color: 'var(--text2, #334155)', marginTop: 10, lineHeight: 1.5 }}>
                  <strong>Falta:</strong> {veredicto.datosFaltantes.join(' · ')}
                </div>
              )}
              {veredicto.alertas.map((a, i) => (
                <div key={i} style={{ fontSize: 13, marginTop: 9, lineHeight: 1.5, color: a.nivel === 'BLOCK' ? '#dc2626' : a.nivel === 'WARN' ? '#b45309' : 'var(--text2, #334155)' }}>
                  <strong>{a.nivel}</strong> · {a.mensaje}
                </div>
              ))}
              {!encontrado && (
                <div style={{ fontSize: 12.5, marginTop: 10, color: '#b45309', lineHeight: 1.5 }}>
                  No hay tope cargado para este fármaco e indicación. Cárgalo en la otra pestaña —
                  hasta entonces el motor no puede juzgar la cifra, y decirlo es lo correcto.
                </div>
              )}
              {encontrado?.caducado && (
                <div style={{ fontSize: 12.5, marginTop: 10, color: '#b45309' }}>
                  El tope se cargó con otra versión del dataset: caducado, no se usa.
                </div>
              )}
              {encontrado?.porComodin && !encontrado.caducado && (
                <div style={{ fontSize: 12.5, marginTop: 10, color: 'var(--text3, #64748b)' }}>
                  Se está usando el tope general del fármaco, no uno de esta indicación.
                </div>
              )}
            </div>

            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: 8 }}>Lo que dice la evidencia</div>
              {resolucion.noResuelve && <div style={{ fontSize: 13, color: '#b45309' }}>{resolucion.noResuelve}</div>}
              {resolucion.reglaDosis.label && (
                <Bloque titulo="Ficha" texto={resolucion.reglaDosis.label.texto} fuentes={resolucion.reglaDosis.label.fuentes} />
              )}
              {resolucion.reglaDosis.guideline
                && resolucion.reglaDosis.guideline.texto !== resolucion.reglaDosis.label?.texto && (
                <Bloque titulo="Guía" texto={resolucion.reglaDosis.guideline.texto} fuentes={resolucion.reglaDosis.guideline.fuentes} />
              )}
              {resolucion.ajustes.map((a, i) => <Bloque key={i} titulo={a.que} texto={a.texto} />)}
              {resolucion.avisos.map((a, i) => (
                <div key={i} style={{ fontSize: 12.5, marginTop: 9, color: 'var(--text2, #334155)', lineHeight: 1.5 }}>
                  <code style={{ fontSize: 11, color: 'var(--text3, #64748b)' }}>{a.regla}</code><br />{a.texto}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {pestana === 'propuestos' && (
        <div>
          <div style={{ ...S.card, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
              {sinConfirmar.length} topes transcritos de tu dataset
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2, #334155)', margin: '6px 0 0', lineHeight: 1.55 }}>
              No son una opinión: es la pauta que <strong>ya está escrita</strong> en tu dataset,
              pasada a números. «2 g IV q8h» son 2 000 mg por dosis y 6 000 al día. Cada uno
              trae la frase de la que salió — confirmar es leer una línea, no teclear seis campos.
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text3, #64748b)', margin: '8px 0 0', lineHeight: 1.55 }}>
              Sólo salen {PROPUESTOS.length} de {FARMACOS.length} porque el resto del texto describe
              MÁS DE UNA pauta, y las lecturas que fallaron fallaban todas hacia un tope
              demasiado bajo — que es la peor dirección: una alerta que salta en lo que haces
              todos los días enseña a ignorarla.
            </p>
          </div>

          {(sinConfirmar.length + propuestasPend.length) > 0 && (
            <div style={{ ...S.card, marginBottom: 14, borderLeft: '4px solid var(--nexus, #3d5afe)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1 1 320px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                    Cargar los {sinConfirmar.length + propuestasPend.length} de una vez
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text2, #334155)', margin: '5px 0 0', lineHeight: 1.55 }}>
                    Quedan guardados como «carga en bloque autorizada por ti», no como si
                    hubieras revisado cada uno — el registro dice lo que pasó. Todos guardan
                    de dónde salieron y cada uno se puede quitar después.
                  </p>
                </div>
                <button onClick={() => void cargarTodos()} disabled={!clinicId || cargandoTodo} style={{
                  padding: '11px 22px', borderRadius: 9, fontSize: 14, fontWeight: 700,
                  border: 'none', cursor: cargandoTodo ? 'wait' : 'pointer',
                  background: 'var(--nexus, #3d5afe)', color: '#fff',
                }}>{cargandoTodo ? 'Cargando…' : 'Cargar todos'}</button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {sinConfirmar.length === 0 && (
              <div style={{ ...S.card, fontSize: 13, color: 'var(--text3, #64748b)' }}>
                Ya los confirmaste todos. Los {SIN_PROPONER.length} restantes se cargan a mano
                en la otra pestaña.
              </div>
            )}
            {sinConfirmar.map(t => (
              <div key={t.farmaco} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 320px' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)' }}>{t.farmaco}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text2, #334155)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                      habitual <strong>{t.usualMaxPorDosis}</strong> {t.unidad}/dosis ·{' '}
                      <strong>{t.usualMaxPorDia}</strong> {t.unidad}/día
                      {t.absolutoMaxPorDia ? <> · tope <strong>{t.absolutoMaxPorDia}</strong> {t.unidad}/día</> : null}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text3, #64748b)', marginTop: 6, lineHeight: 1.5, fontStyle: 'italic' }}>
                      «{t.textoFuente}»
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3, #64748b)', marginTop: 3 }}>{t.fuenteIds.join(' · ')}</div>
                  </div>
                  <button onClick={() => void confirmar(t)} disabled={!clinicId} style={{
                    padding: '9px 18px', borderRadius: 9, fontSize: 13.5, fontWeight: 700,
                    border: 'none', cursor: 'pointer', background: 'var(--nexus, #3d5afe)', color: '#fff',
                  }}>Confirmar</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...S.card, margin: '22px 0 12px', borderLeft: '4px solid #d97706' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
              {propuestasPend.length} propuestos desde el etiquetado — revísalos con más calma
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2, #334155)', margin: '6px 0 0', lineHeight: 1.55 }}>
              Éstos <strong>no salen de una frase de tu dataset</strong>: son la pauta adulta de uso
              corriente puesta en números. Van aparte y en otro color porque no tienen el mismo
              respaldo — si los mezclara con los de arriba, los dos parecerían igual de firmes.
              No se cita ninguna tabla ni PMID: una cita inventada da por comprobado lo que
              nadie comprobó.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {propuestasPend.map(t => (
              <div key={t.farmaco} style={{ ...S.card, borderLeft: '4px solid #d97706' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 320px' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)' }}>{t.farmaco}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text2, #334155)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                      habitual <strong>{t.usualMaxPorDosis ?? '—'}</strong>/<strong>{t.usualMaxPorDia ?? '—'}</strong>
                      {t.contextualMaxPorDia ? <> · contexto <strong>{t.contextualMaxPorDosis ?? '—'}</strong>/<strong>{t.contextualMaxPorDia}</strong></> : null}
                      {t.absolutoMaxPorDia ? <> · techo <strong>{t.absolutoMaxPorDia}</strong></> : null} {t.unidad}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text2, #334155)', marginTop: 6, lineHeight: 1.5 }}>{t.razon}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3, #64748b)', marginTop: 3 }}>{t.fuente}</div>
                  </div>
                  <button onClick={() => void confirmarPropuesta(t)} disabled={!clinicId} style={{
                    padding: '9px 18px', borderRadius: 9, fontSize: 13.5, fontWeight: 700,
                    border: '1px solid #d97706', cursor: 'pointer', background: 'transparent', color: '#b45309',
                  }}>Confirmar</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...S.card, marginTop: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #0f172a)' }}>
              {SIN_CIFRA.length} en los que una cifra sería falsa
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text3, #64748b)', margin: '6px 0 10px', lineHeight: 1.55 }}>
              No es cautela: la cifra depende de un dato del paciente que el motor no tiene, o de
              una unidad que primero hay que declarar. Poner un mg fijo a una amikacina es
              inventarle el peso al enfermo.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {SIN_CIFRA.map(s2 => (
                <div key={s2.farmaco} style={{ fontSize: 12.5, color: 'var(--text2, #334155)', lineHeight: 1.5 }}>
                  <strong>{s2.farmaco}</strong> — {s2.porQue}
                </div>
              ))}
            </div>
          </div>

          <details style={{ marginTop: 18 }}>
            <summary style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text2, #334155)' }}>
              Detalle técnico: los {SIN_PROPONER.length} que el extractor no pudo leer
            </summary>
            <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
              {SIN_PROPONER.map(p => (
                <div key={p.farmaco} style={{ fontSize: 12.5, color: 'var(--text2, #334155)', lineHeight: 1.5 }}>
                  <strong>{p.farmaco}</strong> — {p.porQue}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {pestana === 'topes' && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)' }}>
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text, #0f172a)' }}>Cargar un tope</div>
            <p style={{ fontSize: 12.5, color: 'var(--text3, #64748b)', margin: '0 0 12px', lineHeight: 1.5 }}>
              Ninguna cifra viene sugerida: la escribes tú, con su fuente. Un tope sin
              procedencia no se puede rebatir, y una alerta que no se puede rebatir se
              acaba ignorando.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <div><label style={S.label}>Fármaco</label>
                <select value={tFarmaco} onChange={e => setTFarmaco(e.target.value)} style={S.input}>
                  {FARMACOS.map(f => <option key={f.drug} value={f.drug}>{f.drug}</option>)}
                </select></div>
              <div><label style={S.label}>Indicación ({CUALQUIER_INDICACION} = cualquiera)</label>
                <input value={tIndicacion} onChange={e => setTIndicacion(e.target.value)} style={S.input} /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><label style={S.label}>Habitual / dosis</label>
                  <input value={tUsualDosis} onChange={e => setTUsualDosis(e.target.value)} style={S.input} inputMode="decimal" /></div>
                <div style={{ flex: 1 }}><label style={S.label}>Habitual / día</label>
                  <input value={tUsualDia} onChange={e => setTUsualDia(e.target.value)} style={S.input} inputMode="decimal" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><label style={S.label}>Contexto / dosis</label>
                  <input value={tCtxDosis} onChange={e => setTCtxDosis(e.target.value)} style={S.input} inputMode="decimal" /></div>
                <div style={{ flex: 1 }}><label style={S.label}>Contexto / día</label>
                  <input value={tCtxDia} onChange={e => setTCtxDia(e.target.value)} style={S.input} inputMode="decimal" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><label style={S.label}>Absoluto / dosis</label>
                  <input value={tAbsDosis} onChange={e => setTAbsDosis(e.target.value)} style={S.input} inputMode="decimal" /></div>
                <div style={{ flex: 1 }}><label style={S.label}>Absoluto / día</label>
                  <input value={tAbsDia} onChange={e => setTAbsDia(e.target.value)} style={S.input} inputMode="decimal" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 90 }}><label style={S.label}>Unidad</label>
                  <input value={tUnidad} onChange={e => setTUnidad(e.target.value)} style={S.input} /></div>
                <div style={{ flex: 1 }}><label style={S.label}>Tipo de máximo</label>
                  <select value={tTipo} onChange={e => setTTipo(e.target.value as TipoMaximo)} style={S.input}>
                    {TIPOS_MAXIMO.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                  </select></div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3, #64748b)' }}>
                {TIPOS_MAXIMO.find(t => t.valor === tTipo)?.ayuda}
              </div>
              <div><label style={S.label}>Fuente (obligatoria)</label>
                <input value={tFuente} onChange={e => setTFuente(e.target.value)} style={S.input}
                  placeholder="IDSA 2026 tabla 1 · ficha FDA · CLSI M100 Ed36…" /></div>

              {problemas.length > 0 && (
                <div style={{ fontSize: 12.5, color: '#b45309', lineHeight: 1.5 }}>
                  {problemas.map((p, i) => <div key={i}>· {p}</div>)}
                </div>
              )}
              <button onClick={guardar} disabled={problemas.length > 0 || guardando || !clinicId}
                style={{
                  padding: '10px 0', borderRadius: 9, fontSize: 14, fontWeight: 700, border: 'none',
                  cursor: problemas.length > 0 ? 'not-allowed' : 'pointer',
                  background: problemas.length > 0 ? 'var(--s2, #f1f5f9)' : 'var(--nexus, #3d5afe)',
                  color: problemas.length > 0 ? 'var(--text3, #64748b)' : '#fff',
                }}>{guardando ? 'Guardando…' : 'Guardar tope'}</button>
              {aviso && <div style={{ fontSize: 12.5, color: 'var(--text3, #64748b)' }}>{aviso}</div>}
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text, #0f172a)' }}>
              Cargados · {av.conLimite} de {av.total} fármacos ({av.porcentaje} %)
            </div>
            {cargados.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text3, #64748b)', lineHeight: 1.5 }}>
                Todavía no hay ninguno. Mientras no los haya, el motor responde
                «faltan datos» en vez de juzgar una cifra — que es lo correcto.
              </p>
            )}
            <div style={{ display: 'grid', gap: 8 }}>
              {cargados.map(l => (
                <div key={`${l.farmaco}__${l.indicacion}`} style={{
                  border: '1px solid var(--border, #e5e7eb)', borderRadius: 9, padding: '9px 11px', fontSize: 12.5,
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--text, #0f172a)' }}>{l.farmaco}</div>
                  <div style={{ color: 'var(--text3, #64748b)' }}>{l.indicacion} · {l.limites.tipoMaximo}</div>
                  <div style={{ color: 'var(--text2, #334155)', marginTop: 3 }}>
                    habitual {l.limites.usualMaxPorDosis ?? '—'}/{l.limites.usualMaxPorDia ?? '—'} ·
                    contexto {l.limites.contextualMaxPorDosis ?? '—'}/{l.limites.contextualMaxPorDia ?? '—'} ·
                    absoluto {l.limites.absolutoMaxPorDosis ?? '—'}/{l.limites.absolutoMaxPorDia ?? '—'} {l.limites.unidad}
                  </div>
                  <div style={{ color: 'var(--text3, #64748b)', marginTop: 3 }}>{l.fuente}</div>
                  {l.huellaDataset !== HUELLA_DATASET && (
                    <div style={{ color: '#b45309', marginTop: 3 }}>Caducado: se cargó con otra versión del dataset.</div>
                  )}
                  <button onClick={async () => {
                    if (!clinicId) return
                    await borrarLimite(clinicId, l.farmaco, l.indicacion)
                    setCargados(await getLimites(clinicId))
                  }} style={{
                    marginTop: 6, background: 'transparent', border: 'none', color: '#dc2626',
                    fontSize: 12, cursor: 'pointer', padding: 0,
                  }}>Quitar</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Bloque({ titulo, texto, fuentes }: { titulo: string; texto: string; fuentes?: readonly string[] }) {
  if (!texto?.trim()) return null
  return (
    <div style={{ marginTop: 9 }}>
      <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text3, #64748b)' }}>{titulo}</div>
      <div style={{ fontSize: 13, color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>{texto}</div>
      {fuentes && fuentes.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text3, #64748b)', marginTop: 2 }}>{fuentes.join(' · ')}</div>
      )}
    </div>
  )
}
