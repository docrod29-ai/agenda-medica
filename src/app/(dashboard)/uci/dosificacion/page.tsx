'use client'

/**
 * DOSIFICACIÓN EN UCI — consultar y validar.
 *
 * ── VALIDAR ──────────────────────────────────────────────────────────────────
 *
 * El Dr. entregó 54 fármacos con sus reglas y sus fuentes, y dijo: «haz lo que
 * puedas tú y déjame verificar los datos yo». Esto es ese «déjame verificar».
 *
 * Un fármaco por tarjeta, con sus cuatro reglas tal como vienen, sus reglas
 * duras y el enlace a la fuente. El médico coteja contra la fuente y firma. Hasta
 * que firma, la app dice que la regla NO está validada — porque el dataset se
 * marque a sí mismo «verified» describe de dónde salió el dato, no que alguien
 * de aquí lo haya mirado.
 *
 * ── CONSULTAR (v936) ─────────────────────────────────────────────────────────
 *
 * Durante semanas ésta fue la única pestaña, y `lib/dosing/motor.ts` —el módulo
 * que **elige** cuál de las cuatro reglas aplica a este paciente y que devuelve
 * `SPECIALIST_REVIEW` cuando falta un dato— no lo llamaba **nadie**. Trabajo
 * clínico terminado y probado que no le llegaba al médico: el fallo más caro que
 * hay, porque se paga entero y no se nota.
 *
 * Lo destapó el guardián de huérfanos al arreglarse en v935: hasta entonces el
 * nombre `motor` coincidía con otros módulos y el motor de dosis pasaba por
 * «usado».
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, ExternalLink, Search, ShieldQuestion, Undo2, Ban, HelpCircle, Stethoscope } from 'lucide-react'
import { useClinic } from '@/context/ClinicContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import { DATASET, nombresFarmacos, buscarFarmaco, fuentesDe } from '@/lib/dosing/dataset'
import { estadoDe, firmar, avance, type FirmaValidacion } from '@/lib/dosing/validacion'
import { getFirmas, guardarFirma, retirarFirma } from '@/lib/dosing/persistencia'
import { HUELLA_DATASET } from '@/lib/dosing/huella'
import { recomendar, POR_QUE_NO_CALCULA, type Recomendacion } from '@/lib/dosing/motor'
import {
  construirContexto, conValidacionDelMedico, COMO_SE_LEE, type CamposConsulta,
} from '@/lib/dosing/consulta'

type Filtro = 'todos' | 'sin_validar' | 'validados' | 'con_regla_dura'
type Pestana = 'consultar' | 'validar'

export default function ValidacionDosisPage() {
  const { clinicId } = useClinic()
  const { user } = useAuth()
  const { toast } = useToast()

  const [firmas, setFirmas] = useState<Record<string, FirmaValidacion>>({})
  const [cargando, setCargando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [pestana, setPestana] = useState<Pestana>('consultar')

  useEffect(() => {
    if (!clinicId) { setCargando(false); return }
    getFirmas(clinicId)
      .then(setFirmas)
      .catch(() => toast('No se pudieron cargar las validaciones', 'error'))
      .finally(() => setCargando(false))
  }, [clinicId, toast])

  const todos = useMemo(() => nombresFarmacos(), [])
  const progreso = useMemo(
    () => avance(todos, firmas, DATASET.version, HUELLA_DATASET),
    [todos, firmas])

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return todos.filter(nombre => {
      const f = buscarFarmaco(nombre)!
      if (q && !nombre.toLowerCase().includes(q) && !f.class.toLowerCase().includes(q)) return false
      const e = estadoDe(firmas[nombre], DATASET.version, HUELLA_DATASET).estado
      if (filtro === 'sin_validar') return e !== 'validado'
      if (filtro === 'validados') return e === 'validado'
      if (filtro === 'con_regla_dura') return !!f.hard_stops
      return true
    })
  }, [todos, firmas, busca, filtro])

  const validar = useCallback(async (nombre: string) => {
    if (!clinicId || !user) return
    const f = firmar(
      nombre,
      { uid: user.uid, nombre: user.displayName || user.email || user.uid },
      { version: DATASET.version, huella: HUELLA_DATASET },
      new Date().toISOString(),
      nota,
    )
    try {
      await guardarFirma(clinicId, f)
      setFirmas(prev => ({ ...prev, [nombre]: f }))
      setNota('')
      toast(`${nombre}: validado`, 'success')
    } catch { toast('No se pudo guardar la validación', 'error') }
  }, [clinicId, user, nota, toast])

  const retirar = useCallback(async (nombre: string) => {
    if (!clinicId) return
    try {
      await retirarFirma(clinicId, nombre)
      setFirmas(prev => { const c = { ...prev }; delete c[nombre]; return c })
      toast(`${nombre}: validación retirada`, 'success')
    } catch { toast('No se pudo retirar', 'error') }
  }, [clinicId, toast])

  return (
    <div style={{ padding: '20px 16px 60px', maxWidth: 980, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
        Dosificación en UCI
      </h1>
      <p style={{ color: 'var(--text2)', fontSize: 13.5, lineHeight: 1.55, marginBottom: 14 }}>
        {DATASET.drugs.length} fármacos del dataset <code>{DATASET.version}</code>. La app
        <strong> no da ninguna de estas reglas por buena</strong> hasta que usted la coteja
        contra su fuente y la firma. Su firma queda con su nombre, la fecha y la versión
        exacta del dataset.
      </p>

      <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([
          ['consultar', 'Consultar dosis', Stethoscope],
          ['validar', 'Validar el dataset', CheckCircle2],
        ] as const).map(([v, label, Icono]) => (
          <button
            key={v} role="tab" aria-selected={pestana === v}
            onClick={() => setPestana(v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border2)',
              background: pestana === v ? 'var(--teal)' : 'transparent',
              color: pestana === v ? '#fff' : 'var(--text2)',
            }}
          ><Icono size={14} /> {label}</button>
        ))}
      </div>

      {pestana === 'consultar' && (
        <Consultar firmas={firmas} />
      )}

      {pestana === 'validar' && <>
      <Progreso {...progreso} />

      <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text3)' }} />
          <input
            className="input" placeholder="Buscar fármaco o clase…" value={busca}
            onChange={e => setBusca(e.target.value)} style={{ paddingLeft: 30 }}
          />
        </div>
        {([
          ['todos', 'Todos'], ['sin_validar', 'Sin validar'],
          ['validados', 'Validados'], ['con_regla_dura', 'Con regla dura'],
        ] as const).map(([v, label]) => (
          <button
            key={v} onClick={() => setFiltro(v)}
            style={{
              padding: '7px 12px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer',
              border: '1px solid var(--border2)',
              background: filtro === v ? 'var(--teal)' : 'transparent',
              color: filtro === v ? '#fff' : 'var(--text2)',
            }}
          >{label}</button>
        ))}
      </div>

      {cargando && <p style={{ color: 'var(--text3)' }}>Cargando validaciones…</p>}
      {!cargando && visibles.length === 0 && (
        <p style={{ color: 'var(--text3)' }}>Ningún fármaco con ese filtro.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibles.map(nombre => (
          <Tarjeta
            key={nombre}
            nombre={nombre}
            firma={firmas[nombre]}
            abierta={abierto === nombre}
            onAbrir={() => { setAbierto(abierto === nombre ? null : nombre); setNota('') }}
            nota={nota} setNota={setNota}
            onValidar={() => validar(nombre)}
            onRetirar={() => retirar(nombre)}
          />
        ))}
      </div>
      </>}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   CONSULTAR — aquí es donde por fin se llama al motor.

   El motor existía desde hacía semanas, con sus pruebas, y no lo llamaba
   NADIE: la pantalla enseñaba y firmaba el dataset, pero la selección de la
   regla —la parte que decide cuál de las cuatro aplica a ESTE paciente y que
   devuelve SPECIALIST_REVIEW cuando falta un dato— no le llegaba al médico.
   ════════════════════════════════════════════════════════════════════════ */

const VACIO: CamposConsulta = { farmaco: '', rrt: 'ninguna', escalarPeso: 'no_documentado' }

function Consultar({ firmas }: { firmas: Record<string, FirmaValidacion> }) {
  const [campos, setCampos] = useState<CamposConsulta>(VACIO)
  const set = (k: keyof CamposConsulta) => (v: string) => setCampos(p => ({ ...p, [k]: v }))

  const resultado = useMemo<Recomendacion | null>(() => {
    if (!campos.farmaco.trim()) return null
    const rec = recomendar(construirContexto(campos))
    // El motor no puede leer las firmas del consultorio; la pantalla sí.
    return conValidacionDelMedico(rec, estadoDe(
      rec.farmaco ? firmas[rec.farmaco] : undefined, DATASET.version, HUELLA_DATASET))
  }, [campos, firmas])

  return (
    <div>
      <p style={{
        fontSize: 12.5, lineHeight: 1.55, color: 'var(--text2)', marginBottom: 14,
        padding: 10, borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--s2)',
      }}>{POR_QUE_NO_CALCULA}</p>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Campo etiqueta="Fármaco">
          <input
            className="input" list="farmacos-dosis" value={campos.farmaco}
            onChange={e => set('farmaco')(e.target.value)} placeholder="p. ej. meropenem"
          />
          <datalist id="farmacos-dosis">
            {nombresFarmacos().map(n => <option key={n} value={n} />)}
          </datalist>
        </Campo>

        <Campo etiqueta="Indicación">
          <input className="input" value={campos.indicacion ?? ''}
            onChange={e => set('indicacion')(e.target.value)} placeholder="en sus palabras" />
        </Campo>

        <Campo etiqueta="Gravedad">
          <Selector value={campos.gravedad ?? ''} onChange={set('gravedad')} opciones={[
            ['', '— sin declarar —'], ['no_grave', 'No grave'],
            ['grave', 'Grave'], ['choque', 'Choque'],
          ]} />
        </Campo>

        <Campo etiqueta="Peso (kg)">
          <input className="input" inputMode="decimal" value={campos.pesoKg ?? ''}
            onChange={e => set('pesoKg')(e.target.value)} placeholder="vacío = no documentado" />
        </Campo>

        <Campo etiqueta="Escalar de peso">
          <Selector value={campos.escalarPeso ?? 'no_documentado'} onChange={set('escalarPeso')} opciones={[
            ['no_documentado', '— no documentado —'], ['TBW', 'TBW (real)'],
            ['IBW', 'IBW (ideal)'], ['AdjBW', 'AdjBW (ajustado)'],
          ]} />
        </Campo>

        <Campo etiqueta="CrCl Cockcroft-Gault (mL/min)">
          <input className="input" inputMode="decimal" value={campos.crClMlMin ?? ''}
            onChange={e => set('crClMlMin')(e.target.value)} placeholder="no se acepta eGFR" />
        </Campo>

        <Campo etiqueta="¿Función renal inestable?">
          <Selector value={campos.renalInestable ?? ''} onChange={set('renalInestable')} opciones={SI_NO} />
        </Campo>

        <Campo etiqueta="Reemplazo renal">
          <Selector value={campos.rrt ?? 'ninguna'} onChange={set('rrt')} opciones={[
            ['ninguna', 'Ninguno'], ['IHD', 'IHD'], ['SLED_PIRRT', 'SLED / PIRRT'],
            ['CVVH', 'CVVH'], ['CVVHD', 'CVVHD'], ['CVVHDF', 'CVVHDF'],
            ['desconocida', '— sin declarar —'],
          ]} />
        </Campo>

        <Campo etiqueta="Efluente CRRT (L/h)">
          <input className="input" inputMode="decimal" value={campos.efluenteCrrtLh ?? ''}
            onChange={e => set('efluenteCrrtLh')(e.target.value)} />
        </Campo>

        <Campo etiqueta="Organismo">
          <input className="input" value={campos.organismo ?? ''}
            onChange={e => set('organismo')(e.target.value)} />
        </Campo>

        <Campo etiqueta="CMI (mg/L)">
          <input className="input" inputMode="decimal" value={campos.micMgL ?? ''}
            onChange={e => set('micMgL')(e.target.value)} />
        </Campo>

        <Campo etiqueta="¿Es neumonía?">
          <Selector value={campos.esNeumonia ?? ''} onChange={set('esNeumonia')} opciones={SI_NO} />
        </Campo>

        <Campo etiqueta="¿Sedación y ventilación aseguradas?">
          <Selector value={campos.sedacionYVentilacionAseguradas ?? ''}
            onChange={set('sedacionYVentilacionAseguradas')} opciones={SI_NO} />
        </Campo>
      </div>

      <button
        onClick={() => setCampos(VACIO)}
        style={{
          marginTop: 12, padding: '7px 12px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer',
          border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)',
        }}
      >Limpiar</button>

      {resultado
        ? <Resultado rec={resultado} />
        : <p style={{ marginTop: 20, color: 'var(--text3)', fontSize: 13 }}>
            Escriba un fármaco para ver qué regla aplica.
          </p>}
    </div>
  )
}

const SI_NO: [string, string][] = [['', '— sin declarar —'], ['si', 'Sí'], ['no', 'No']]

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>
        {etiqueta.toUpperCase()}
      </span>
      {children}
    </label>
  )
}

function Selector({ value, onChange, opciones }: {
  value: string; onChange: (v: string) => void; opciones: readonly (readonly [string, string])[]
}) {
  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)}>
      {opciones.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  )
}

function Resultado({ rec }: { rec: Recomendacion }) {
  const como = COMO_SE_LEE[rec.estado]
  const color = rec.estado === 'CLEAR' ? 'var(--teal)' : 'var(--amber, #b45309)'
  const Icono = rec.estado === 'CLEAR' ? CheckCircle2 : rec.estado === 'BLOCKED' ? Ban : HelpCircle

  return (
    <div style={{
      marginTop: 20, border: `1px solid ${color}`, borderRadius: 10,
      background: 'var(--s2)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
        <Icono size={16} style={{ color, flexShrink: 0 }} />
        <strong style={{ fontSize: 14 }}>{como.titulo}</strong>
        {rec.farmaco && <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>· {rec.farmaco}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>rama: {rec.rama}</span>
      </div>

      <div style={{ padding: '12px 14px', fontSize: 13, lineHeight: 1.55 }}>
        <p style={{ color: 'var(--text2)', fontSize: 12.5, marginBottom: 10 }}>{como.explicacion}</p>

        <p style={{
          padding: 9, borderRadius: 7, marginBottom: 12, fontSize: 12.5,
          border: `1px solid ${rec.validacion === 'validado_por_medico' ? 'var(--teal)' : 'var(--amber, #b45309)'}`,
          color: 'var(--text)',
        }}>{rec.avisoValidacion}</p>

        {rec.faltantes.length > 0 && (
          <Bloque titulo="Falta para poder decidir" destacado>
            <ul style={{ margin: '4px 0 0 18px' }}>
              {rec.faltantes.map((f, i) => <li key={i} style={{ marginBottom: 3 }}>{f}</li>)}
            </ul>
          </Bloque>
        )}

        {rec.bloqueos.length > 0 && (
          <Bloque titulo="Reglas duras" destacado>
            <ul style={{ margin: '4px 0 0 18px' }}>
              {rec.bloqueos.map((b, i) => <li key={i} style={{ marginBottom: 3 }}>{b}</li>)}
            </ul>
          </Bloque>
        )}

        {rec.reglaAplicada && (
          <Bloque titulo="Regla que aplica (texto literal del dataset)">
            <span style={{ whiteSpace: 'pre-wrap' }}>{rec.reglaAplicada}</span>
          </Bloque>
        )}
        <Bloque titulo="Por qué esa rama">{rec.porQueEsaRama}</Bloque>
        {rec.monitoreo && <Bloque titulo="Monitoreo">{rec.monitoreo}</Bloque>}

        <Bloque titulo="Datos que se usaron">
          {Object.entries(rec.entradasUsadas).map(([k, v]) => (
            <span key={k} style={{
              display: 'inline-block', marginRight: 6, marginBottom: 4, padding: '2px 7px',
              borderRadius: 5, border: '1px solid var(--border2)', fontSize: 11.5,
            }}>{k}: {String(v)}</span>
          ))}
        </Bloque>

        {rec.fuentes.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>FUENTES</div>
            {rec.fuentes.map(f => (
              <div key={f.id} style={{ fontSize: 12, marginBottom: 3 }}>
                {f.url
                  ? <a href={f.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {f.titulo ?? f.id} <ExternalLink size={11} />
                    </a>
                  : <span style={{ color: 'var(--text3)' }}>{f.id} (sin ficha de fuente)</span>}
                {f.verificado && <span style={{ color: 'var(--text3)' }}> · verificado {f.verificado}</span>}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
          dataset {rec.versionDataset} · {rec.fechaVerificacion}
        </div>
      </div>
    </div>
  )
}

function Progreso({ total, validados, caducados, sinValidar, porcentaje }: ReturnType<typeof avance>) {
  return (
    <div style={{
      border: '1px solid var(--border2)', borderRadius: 10, padding: 14, background: 'var(--s2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {validados}
        </span>
        <span style={{ color: 'var(--text2)', fontSize: 13.5 }}>de {total} validados</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
          {porcentaje}%
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--s1)', overflow: 'hidden' }}>
        <div style={{ width: `${porcentaje}%`, height: '100%', background: 'var(--teal)' }} />
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, color: 'var(--text3)' }}>
        <span>{sinValidar} sin validar</span>
        {caducados > 0 && (
          <span style={{ color: 'var(--amber, #b45309)' }}>
            {caducados} caducados (cambió el dataset)
          </span>
        )}
      </div>
    </div>
  )
}

function Tarjeta({ nombre, firma, abierta, onAbrir, nota, setNota, onValidar, onRetirar }: {
  nombre: string
  firma?: FirmaValidacion
  abierta: boolean
  onAbrir: () => void
  nota: string
  setNota: (s: string) => void
  onValidar: () => void
  onRetirar: () => void
}) {
  const f = buscarFarmaco(nombre)!
  const est = estadoDe(firma, DATASET.version, HUELLA_DATASET)

  return (
    <div style={{
      border: '1px solid var(--border2)', borderRadius: 10, background: 'var(--s2)', overflow: 'hidden',
    }}>
      <button
        onClick={onAbrir}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
        }}
      >
        {est.estado === 'validado'
          ? <CheckCircle2 size={16} style={{ color: 'var(--teal)', flexShrink: 0 }} />
          : est.estado === 'caducada'
            ? <AlertTriangle size={16} style={{ color: 'var(--amber, #b45309)', flexShrink: 0 }} />
            : <ShieldQuestion size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
        <span style={{ fontWeight: 600 }}>{nombre}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{f.class}</span>
        {f.hard_stops && (
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            border: '1px solid var(--amber, #b45309)', color: 'var(--amber, #b45309)',
          }}>regla dura</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text3)' }}>
          {est.estado === 'validado' ? 'validado' : est.estado === 'caducada' ? 'caducado' : 'sin validar'}
        </span>
      </button>

      {abierta && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', fontSize: 13, lineHeight: 1.55 }}>
          {est.estado === 'caducada' && (
            <p style={{
              padding: 9, borderRadius: 7, marginBottom: 10, fontSize: 12.5,
              border: '1px solid var(--amber, #b45309)', color: 'var(--text)',
            }}>{est.porQue}</p>
          )}

          {f.hard_stops && (
            <Bloque titulo="Regla dura" destacado>{f.hard_stops}</Bloque>
          )}
          <Bloque titulo="Dosis">{f.dose_rule}</Bloque>
          {f.renal_rule && <Bloque titulo="Función renal">{f.renal_rule}</Bloque>}
          {f.rrt_rule && <Bloque titulo="Reemplazo renal">{f.rrt_rule}</Bloque>}
          {f.critical_care_rule && <Bloque titulo="Paciente crítico">{f.critical_care_rule}</Bloque>}
          {f.monitoring && <Bloque titulo="Monitoreo">{f.monitoring}</Bloque>}

          <div style={{ margin: '12px 0 10px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>FUENTES</div>
            {fuentesDe(f).map(({ id, fuente }) => (
              <div key={id} style={{ fontSize: 12, marginBottom: 3 }}>
                {fuente
                  ? <a href={fuente.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {fuente.title} <ExternalLink size={11} />
                    </a>
                  : <span style={{ color: 'var(--text3)' }}>{id} (sin ficha de fuente)</span>}
              </div>
            ))}
          </div>

          {est.estado === 'validado' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                Validado por {est.firma.validadoPorNombre} el{' '}
                {new Date(est.firma.fecha).toLocaleDateString('es-MX')}
                {est.firma.nota ? ` — «${est.firma.nota}»` : ''}
              </span>
              <button
                onClick={onRetirar}
                style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'none', border: '1px solid var(--border2)', borderRadius: 6,
                  color: 'var(--text2)', cursor: 'pointer', padding: '5px 10px', fontSize: 12,
                }}
              ><Undo2 size={12} /> Retirar validación</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="input" placeholder="Nota (opcional): con qué fuente lo cotejó…"
                value={nota} onChange={e => setNota(e.target.value)}
                style={{ flex: '1 1 240px', fontSize: 12.5 }}
              />
              <button
                onClick={onValidar}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  borderRadius: 7, border: 'none', background: 'var(--teal)', color: '#fff',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              ><CheckCircle2 size={14} /> Validar esta regla</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Bloque({ titulo, children, destacado }: {
  titulo: string; children: React.ReactNode; destacado?: boolean
}) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{
        fontSize: 11, marginBottom: 2,
        color: destacado ? 'var(--amber, #b45309)' : 'var(--text3)',
        fontWeight: destacado ? 700 : 400,
      }}>{titulo.toUpperCase()}</div>
      <div style={{ color: 'var(--text)' }}>{children}</div>
    </div>
  )
}
