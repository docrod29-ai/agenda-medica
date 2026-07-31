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
  const [pestana, setPestana] = useState<'caso' | 'topes'>('caso')

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

  const av = avance(cargados, FARMACOS.length)

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

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(['caso', 'topes'] as const).map(p => (
          <button key={p} onClick={() => setPestana(p)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            border: '1px solid ' + (pestana === p ? 'var(--nexus, #3d5afe)' : 'var(--border, #e5e7eb)'),
            background: pestana === p ? 'var(--nexus, #3d5afe)' : 'transparent',
            color: pestana === p ? '#fff' : 'var(--text, #0f172a)',
          }}>{p === 'caso' ? 'Probar un caso' : `Cargar topes (${av.conLimite}/${av.total})`}</button>
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
