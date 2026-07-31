'use client'

/**
 * VALIDACIÓN DEL DATASET DE DOSIS — la pantalla donde el médico revisa.
 *
 * El Dr. entregó 54 fármacos con sus reglas y sus fuentes, y dijo: «haz lo que
 * puedas tú y déjame verificar los datos yo». Esto es ese «déjame verificar».
 *
 * Un fármaco por tarjeta, con sus cuatro reglas tal como vienen, sus reglas
 * duras y el enlace a la fuente. El médico coteja contra la fuente y firma. Hasta
 * que firma, la app dice que la regla NO está validada — porque el dataset se
 * marque a sí mismo «verified» describe de dónde salió el dato, no que alguien
 * de aquí lo haya mirado.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, ExternalLink, Search, ShieldQuestion, Undo2 } from 'lucide-react'
import { useClinic } from '@/context/ClinicContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/context/ToastContext'
import { DATASET, nombresFarmacos, buscarFarmaco, fuentesDe } from '@/lib/dosing/dataset'
import { estadoDe, firmar, avance, type FirmaValidacion } from '@/lib/dosing/validacion'
import { getFirmas, guardarFirma, retirarFirma } from '@/lib/dosing/persistencia'
import { HUELLA_DATASET } from '@/lib/dosing/huella'

type Filtro = 'todos' | 'sin_validar' | 'validados' | 'con_regla_dura'

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
        Dosificación en UCI · validación
      </h1>
      <p style={{ color: 'var(--text2)', fontSize: 13.5, lineHeight: 1.55, marginBottom: 16 }}>
        {DATASET.drugs.length} fármacos del dataset <code>{DATASET.version}</code>. La app
        <strong> no da ninguna de estas reglas por buena</strong> hasta que usted la coteja
        contra su fuente y la firma. Su firma queda con su nombre, la fecha y la versión
        exacta del dataset.
      </p>

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
