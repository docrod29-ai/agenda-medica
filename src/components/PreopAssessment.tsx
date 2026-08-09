'use client'
import { useState, useMemo } from 'react'
import {
  rcriItems, calcularRCRI, DASI_ITEMS, calcularDASI, CAPRINI_ITEMS, calcularCaprini,
  STOPBANG_ITEMS, calcularStopBang, calcularAriscat, CHADSVASC_ITEMS, calcularChadsVasc,
  HASBLED_ITEMS, calcularHasBled, generarRecomendaciones,
  type RCRIInput, type AriscatInput, type PreopContexto, type Recomendacion, type CategoriaRec,
} from '@/lib/expediente/preop'
import { Activity, HeartPulse, Droplets, ClipboardCheck, ExternalLink, Pill, Check, Wind, Moon, Brain } from 'lucide-react'

interface Props {
  edadPaciente?: number
  disabled?: boolean
  /** Empuja el texto generado a las secciones de la nota + guarda datos crudos */
  onAplicar: (conclusion: string, recomendaciones: string, preopData: { inputs: Record<string, unknown>; resultados: Record<string, unknown> }) => void
  /** Se llama si se pulsa "Aplicar" sin ninguna escala capturada (para avisar sin borrar la nota). */
  onSinDatos?: () => void
  initialInputs?: Record<string, unknown>
}

const CAT_COLOR: Record<CategoriaRec, string> = {
  Medicamentos: '#3D5AFE', Biomarcadores: '#60a5fa', Tiempos: '#f59e0b',
  Pruebas: '#a78bfa', Tromboprofilaxis: '#f87171', General: '#94a3b8',
}

export function PreopAssessment({ edadPaciente, disabled, onAplicar, onSinDatos, initialInputs }: Props) {
  const init = (initialInputs ?? {}) as Record<string, unknown>
  const b = (k: string) => init[k] === true
  const n = (k: string) => (typeof init[k] === 'number' ? (init[k] as number) : undefined)
  const s = (k: string) => (typeof init[k] === 'string' ? (init[k] as string) : undefined)

  // RCRI
  const [rcri, setRcri] = useState<RCRIInput>({
    cirugiaAltoRiesgo: b('cirugiaAltoRiesgo'),
    cardiopatiaIsquemica: b('cardiopatiaIsquemica'),
    insuficienciaCardiaca: b('insuficienciaCardiaca'),
    enfermedadCerebrovascular: b('enfermedadCerebrovascular'),
    diabetesInsulina: b('diabetesInsulina'),
    creatininaMayor2: b('creatininaMayor2'),
  })
  // DASI y Caprini
  const [dasi, setDasi] = useState<Record<string, boolean>>((init.dasi as Record<string, boolean>) ?? {})
  const [caprini, setCaprini] = useState<Record<string, boolean>>((init.caprini as Record<string, boolean>) ?? {})
  // STOP-BANG, CHA2DS2-VASc, HAS-BLED, ARISCAT
  const [stopbang, setStopbang] = useState<Record<string, boolean>>((init.stopbang as Record<string, boolean>) ?? {})
  const [chadsvasc, setChadsvasc] = useState<Record<string, boolean>>((init.chadsvasc as Record<string, boolean>) ?? {})
  const [hasbled, setHasbled] = useState<Record<string, boolean>>((init.hasbled as Record<string, boolean>) ?? {})
  const [ariscat, setAriscat] = useState<AriscatInput>((init.ariscat as AriscatInput) ?? {
    edad: edadPaciente ?? 0, spo2: 0, infeccionRespiratoria: false, anemia: false,
    incision: '', duracion: '', emergencia: false,
  })

  // Contexto de medicamentos / situación
  const [ctx, setCtx] = useState({
    edad: n('edad') ?? edadPaciente ?? 0,
    hipertension: b('hipertension'),
    diabetes: b('diabetes'),
    insuficienciaCardiacaFErEF: b('insuficienciaCardiacaFErEF'),
    cirugiaElectiva: init.cirugiaElectiva !== false,
    tomaBetabloqueador: b('tomaBetabloqueador'),
    tomaIECAoARA: b('tomaIECAoARA'),
    tomaEstatina: b('tomaEstatina'),
    tomaSGLT2: b('tomaSGLT2'),
    tomaGLP1: b('tomaGLP1'),
    glp1Semanal: b('glp1Semanal'),
    tomaAspirina: b('tomaAspirina'),
    pciPrevia: b('pciPrevia'),
    tomaAnticoagulante: b('tomaAnticoagulante'),
    tipoAnticoagulante: s('tipoAnticoagulante') as 'DOAC' | 'warfarina' | undefined,
    valvulaMecanicaMitral: b('valvulaMecanicaMitral'),
    stentDES: b('stentDES'),
    stentDESMotivo: s('stentDESMotivo') as 'SCA' | 'cronico' | undefined,
    mesesDesdeStent: n('mesesDesdeStent'),
    iamReciente: b('iamReciente'),
    mesesDesdeIAM: n('mesesDesdeIAM'),
  })

  const rcriRes = useMemo(() => calcularRCRI(rcri), [rcri])
  const dasiRes = useMemo(() => calcularDASI(dasi), [dasi])
  const capriniRes = useMemo(() => calcularCaprini(caprini), [caprini])
  const stopbangRes = useMemo(() => calcularStopBang(stopbang), [stopbang])
  const ariscatRes = useMemo(() => calcularAriscat(ariscat), [ariscat])
  const chadsvascRes = useMemo(() => calcularChadsVasc(chadsvasc), [chadsvasc])
  const hasbledRes = useMemo(() => calcularHasBled(hasbled), [hasbled])

  const recomendaciones = useMemo<Recomendacion[]>(() => {
    const contexto: PreopContexto = {
      cardiopatiaIsquemica: rcri.cardiopatiaIsquemica,
      insuficienciaCardiacaFErEF: ctx.insuficienciaCardiacaFErEF,
      hipertension: ctx.hipertension,
      diabetes: ctx.diabetes,
      edad: ctx.edad,
      cirugiaRiesgoElevado: rcri.cirugiaAltoRiesgo || rcriRes.elevado,
      cirugiaElectiva: ctx.cirugiaElectiva,
      stentDES: ctx.stentDES,
      stentDESMotivo: ctx.stentDESMotivo,
      mesesDesdeStent: ctx.mesesDesdeStent,
      iamReciente: ctx.iamReciente,
      mesesDesdeIAM: ctx.mesesDesdeIAM,
      tomaBetabloqueador: ctx.tomaBetabloqueador,
      tomaIECAoARA: ctx.tomaIECAoARA,
      tomaEstatina: ctx.tomaEstatina,
      tomaSGLT2: ctx.tomaSGLT2,
      tomaGLP1: ctx.tomaGLP1,
      glp1Semanal: ctx.glp1Semanal,
      tomaAspirina: ctx.tomaAspirina,
      pciPrevia: ctx.pciPrevia,
      tomaAnticoagulante: ctx.tomaAnticoagulante,
      tipoAnticoagulante: ctx.tipoAnticoagulante,
      valvulaMecanicaMitral: ctx.valvulaMecanicaMitral,
    }
    return generarRecomendaciones(contexto)
  }, [rcri, ctx, rcriRes.elevado])

  /**
   * ¿Se capturó algo de esta escala?
   *
   * Antes se documentaban SIEMPRE las cinco, así que un panel intacto escribía
   * en la nota "ARISCAT: 0 puntos — Bajo", "STOP-BANG: 0/8 — riesgo bajo" y
   * "Caprini: 0 — riesgo bajo". Eso es afirmar en un documento clínico que se
   * evaluó un riesgo que nunca se evaluó, y además lo declara BAJO.
   *
   * `prellenados` son campos que la app rellena sola (la edad viene del
   * expediente) y por tanto no prueban que el médico haya contestado nada.
   */
  const capturado = (obj: Record<string, unknown>, prellenados: string[] = []) =>
    Object.entries(obj).some(([k, v]) =>
      !prellenados.includes(k) && v !== false && v !== 0 && v !== '' && v != null)

  const aplicar = () => {
    const lineas: string[] = []
    if (capturado(rcri as unknown as Record<string, unknown>)) {
      lineas.push(`Riesgo cardiaco RCRI (Lee): ${rcriRes.puntos} punto(s) — Clase ${rcriRes.clase} (MACE 30 d ${rcriRes.riesgoEstimadoLee}, Lee 1999). ${rcriRes.interpretacion}`)
    }
    if (capturado(dasi)) {
      lineas.push(`Capacidad funcional DASI: ${dasiRes.score} puntos ≈ ${dasiRes.mets} METs. ${dasiRes.interpretacion}`)
    }
    if (capturado(ariscat as unknown as Record<string, unknown>, ['edad'])) {
      lineas.push(`Riesgo pulmonar ARISCAT: ${ariscatRes.puntos} puntos — ${ariscatRes.nivel} (complicaciones pulmonares ${ariscatRes.riesgoEstimado}). Conducta: ${ariscatRes.conducta}`)
    }
    if (capturado(stopbang)) {
      lineas.push(`Apnea del sueño STOP-BANG: ${stopbangRes.puntos}/8 — riesgo ${stopbangRes.nivel}. ${stopbangRes.interpretacion}`)
    }
    if (capturado(caprini)) {
      lineas.push(`Riesgo de TEV (Caprini): ${capriniRes.puntos} puntos — ${capriniRes.nivel}. ${capriniRes.profilaxisSugerida}`)
    }
    // CHA2DS2-VASc / HAS-BLED solo si se capturó algo (relevantes en FA/anticoagulación)
    if (chadsvascRes.puntos > 0 || ctx.tomaAnticoagulante) {
      lineas.push(`CHA₂DS₂-VASc: ${chadsvascRes.puntos} puntos. ${chadsvascRes.interpretacion}`)
      lineas.push(`HAS-BLED: ${hasbledRes.puntos} puntos — riesgo ${hasbledRes.nivel}. ${hasbledRes.interpretacion}`)
    }
    if (lineas.length === 0) {
      // NO llamar onAplicar con cadenas vacías: reemplazaría por vacío la conclusión
      // y las recomendaciones que el médico ya tecleó a mano (pérdida de datos con
      // toast de éxito). Si no hay ninguna escala capturada, no se toca la nota.
      onSinDatos?.()
      return
    }
    const conclusion = lineas.join('\n\n')

    // Recomendaciones limpias para la nota: agrupadas por categoría, sin códigos
    // ni referencias por línea. Una sola cita global al pie.
    const orden: CategoriaRec[] = ['Medicamentos', 'Tiempos', 'Tromboprofilaxis', 'Biomarcadores', 'Pruebas', 'General']
    const bloques = orden
      .map(cat => {
        const items = recomendaciones.filter(r => r.categoria === cat)
        if (items.length === 0) return ''
        const titulo = cat === 'Medicamentos' ? 'Manejo de medicamentos'
          : cat === 'Tiempos' ? 'Tiempos quirúrgicos'
          : cat === 'Tromboprofilaxis' ? 'Anticoagulación / tromboprofilaxis'
          : cat === 'Biomarcadores' ? 'Biomarcadores'
          : cat === 'Pruebas' ? 'Estudios complementarios'
          : 'Generales'
        return `${titulo}:\n` + items.map(r => `  • ${r.texto}`).join('\n')
      })
      .filter(Boolean)
    const recomTexto = bloques.join('\n\n') +
      '\n\nReferencias: Guía 2024 AHA/ACC de manejo cardiovascular perioperatorio (JACC 2024;84:1869-1969); Patel et al. (JACC 2015;66:2140-8).'

    onAplicar(conclusion, recomTexto, {
      inputs: { ...rcri, dasi, caprini, stopbang, chadsvasc, hasbled, ariscat, ...ctx },
      resultados: { rcri: rcriRes, dasi: dasiRes, caprini: capriniRes, stopbang: stopbangRes, ariscat: ariscatRes, chadsvasc: chadsvascRes, hasbled: hasbledRes },
    })
  }

  const chk = (checked: boolean, onChange: () => void, label: string, peso?: number) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', cursor: disabled ? 'default' : 'pointer', fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.4 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} style={{ marginTop: 2, accentColor: 'var(--teal)', flexShrink: 0 }} />
      <span>{label}{peso != null && <span style={{ color: 'var(--text3)' }}> ({peso} pt{peso !== 1 ? 's' : ''})</span>}</span>
    </label>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
      {/* Aviso de evidencia */}
      <div style={{ fontSize: 11.5, color: 'var(--text3)', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 8, padding: '8px 12px', lineHeight: 1.5 }}>
        Escalas y recomendaciones basadas en la <strong style={{ color: 'var(--text2)' }}>Guía 2024 AHA/ACC de manejo cardiovascular perioperatorio (JACC 2024;84:1869-1969)</strong> y Patel et al. JACC 2015;66:2140-8. Marca lo que aplique al paciente.
      </div>

      {/* ── RCRI ── */}
      <Card icon={<HeartPulse size={15} />} titulo="RCRI — Índice de Riesgo Cardiaco Revisado (Lee)" color="var(--red)">
        {rcriItems().map(it => chk(
          rcri[it.key], () => setRcri(r => ({ ...r, [it.key]: !r[it.key] })), it.label
        ))}
        <Resultado>
          <strong>{rcriRes.puntos} punto(s) · Clase {rcriRes.clase}</strong> — MACE 30 d {rcriRes.riesgoEstimadoLee} (Lee 1999).
          <span style={{ color: rcriRes.elevado ? '#f87171' : '#4ade80' }}> {rcriRes.interpretacion}</span>
        </Resultado>
      </Card>

      {/* ── DASI ── */}
      <Card icon={<Activity size={15} />} titulo="DASI — Capacidad funcional (Duke Activity Status Index)" color="var(--blue)">
        {DASI_ITEMS.map(it => chk(
          !!dasi[it.key], () => setDasi(d => ({ ...d, [it.key]: !d[it.key] })), it.label, it.peso
        ))}
        <Resultado>
          <strong>DASI {dasiRes.score} · ≈ {dasiRes.mets} METs</strong> (VO₂ pico {dasiRes.vo2pico} mL/kg/min).
          <span style={{ color: dasiRes.capacidadBaja ? '#f59e0b' : '#4ade80' }}> {dasiRes.interpretacion}</span>
        </Resultado>
      </Card>

      {/* ── Caprini ── */}
      <Card icon={<Droplets size={15} />} titulo="Caprini — Riesgo de tromboembolia venosa (TEV)" color="#fb923c">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '0 20px' }}>
          {CAPRINI_ITEMS.map(it => chk(
            !!caprini[it.key], () => setCaprini(c => ({ ...c, [it.key]: !c[it.key] })), it.label, it.peso
          ))}
        </div>
        <Resultado>
          <strong>{capriniRes.puntos} puntos · Riesgo {capriniRes.nivel}</strong>. {capriniRes.profilaxisSugerida}
        </Resultado>
      </Card>

      {/* ── ARISCAT ── */}
      <Card icon={<Wind size={15} />} titulo="ARISCAT — Riesgo de complicaciones pulmonares posoperatorias" color="#38bdf8">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Num label="Edad" value={ariscat.edad} onChange={v => setAriscat(a => ({ ...a, edad: v }))} />
          <Num label="SpO₂ (% aire ambiente)" value={ariscat.spo2} onChange={v => setAriscat(a => ({ ...a, spo2: v }))} />
          <Sel label="Incisión quirúrgica" value={ariscat.incision} onChange={v => setAriscat(a => ({ ...a, incision: v as AriscatInput['incision'] }))}
            opciones={[['', '—'], ['periferica', 'Periférica'], ['abdominal_alta', 'Abdominal alta (+15)'], ['intratoracica', 'Intratorácica (+24)']]} />
          <Sel label="Duración de cirugía" value={ariscat.duracion} onChange={v => setAriscat(a => ({ ...a, duracion: v as AriscatInput['duracion'] }))}
            opciones={[['', '—'], ['menos2h', '< 2 h'], ['de2a3h', '2-3 h (+16)'], ['mas3h', '> 3 h (+23)']]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '0 20px', marginTop: 6 }}>
          {chk(ariscat.infeccionRespiratoria, () => setAriscat(a => ({ ...a, infeccionRespiratoria: !a.infeccionRespiratoria })), 'Infección respiratoria en el último mes (+17)')}
          {chk(ariscat.anemia, () => setAriscat(a => ({ ...a, anemia: !a.anemia })), 'Anemia preoperatoria (Hb ≤ 10 g/dL) (+11)')}
          {chk(ariscat.emergencia, () => setAriscat(a => ({ ...a, emergencia: !a.emergencia })), 'Procedimiento de emergencia (+8)')}
        </div>
        <Resultado>
          <strong>{ariscatRes.puntos} puntos · Riesgo {ariscatRes.nivel}</strong> — complicaciones pulmonares {ariscatRes.riesgoEstimado} (Canet 2010). <span style={{ color: ariscatRes.nivel === 'Bajo' ? '#4ade80' : '#f59e0b' }}>Conducta: {ariscatRes.conducta}</span>
        </Resultado>
      </Card>

      {/* ── STOP-BANG ── */}
      <Card icon={<Moon size={15} />} titulo="STOP-BANG — Riesgo de apnea obstructiva del sueño" color="#818cf8">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '0 20px' }}>
          {STOPBANG_ITEMS.map(it => chk(!!stopbang[it.key], () => setStopbang(s => ({ ...s, [it.key]: !s[it.key] })), it.label))}
        </div>
        <Resultado>
          <strong>{stopbangRes.puntos}/8 · Riesgo {stopbangRes.nivel}</strong>. {stopbangRes.interpretacion}
        </Resultado>
      </Card>

      {/* ── CHA2DS2-VASc + HAS-BLED ── */}
      <Card icon={<Brain size={15} />} titulo="CHA₂DS₂-VASc / HAS-BLED — Tromboembolia y sangrado (FA / anticoagulación)" color="#f472b6">
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>CHA₂DS₂-VASc</div>
            {CHADSVASC_ITEMS.map(it => chk(!!chadsvasc[it.key], () => setChadsvasc(c => ({ ...c, [it.key]: !c[it.key] })), it.label, it.peso))}
            <Resultado><strong>{chadsvascRes.puntos} puntos.</strong> {chadsvascRes.interpretacion}</Resultado>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>HAS-BLED</div>
            {HASBLED_ITEMS.map(it => chk(!!hasbled[it.key], () => setHasbled(h => ({ ...h, [it.key]: !h[it.key] })), it.label))}
            <Resultado><strong>{hasbledRes.puntos} puntos · {hasbledRes.nivel}.</strong> {hasbledRes.interpretacion}</Resultado>
          </div>
        </div>
      </Card>

      {/* ── Contexto / Medicamentos ── */}
      <Card icon={<Pill size={15} />} titulo="Medicamentos y situación clínica (para recomendaciones)" color="#3D5AFE">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '0 20px' }}>
          {chk(ctx.hipertension, () => setCtx(c => ({ ...c, hipertension: !c.hipertension })), 'Hipertensión arterial')}
          {chk(ctx.insuficienciaCardiacaFErEF, () => setCtx(c => ({ ...c, insuficienciaCardiacaFErEF: !c.insuficienciaCardiacaFErEF })), 'Insuficiencia cardiaca con FE reducida')}
          {chk(ctx.tomaBetabloqueador, () => setCtx(c => ({ ...c, tomaBetabloqueador: !c.tomaBetabloqueador })), 'Toma betabloqueador (crónico)')}
          {chk(ctx.tomaIECAoARA, () => setCtx(c => ({ ...c, tomaIECAoARA: !c.tomaIECAoARA })), 'Toma IECA o ARA-II')}
          {chk(ctx.tomaEstatina, () => setCtx(c => ({ ...c, tomaEstatina: !c.tomaEstatina })), 'Toma estatina')}
          {chk(ctx.tomaSGLT2, () => setCtx(c => ({ ...c, tomaSGLT2: !c.tomaSGLT2 })), 'Toma iSGLT2 (—gliflozina)')}
          {chk(ctx.tomaGLP1, () => setCtx(c => ({ ...c, tomaGLP1: !c.tomaGLP1 })), 'Toma agonista GLP-1')}
          {ctx.tomaGLP1 && chk(ctx.glp1Semanal, () => setCtx(c => ({ ...c, glp1Semanal: !c.glp1Semanal })), '↳ GLP-1 de dosis semanal')}
          {chk(ctx.tomaAspirina, () => setCtx(c => ({ ...c, tomaAspirina: !c.tomaAspirina })), 'Toma aspirina')}
          {chk(ctx.pciPrevia, () => setCtx(c => ({ ...c, pciPrevia: !c.pciPrevia })), 'PCI / angioplastia previa')}
          {chk(ctx.tomaAnticoagulante, () => setCtx(c => ({ ...c, tomaAnticoagulante: !c.tomaAnticoagulante })), 'Toma anticoagulante')}
          {chk(ctx.valvulaMecanicaMitral, () => setCtx(c => ({ ...c, valvulaMecanicaMitral: !c.valvulaMecanicaMitral })), 'Válvula mecánica mitral')}
          {chk(ctx.stentDES, () => setCtx(c => ({ ...c, stentDES: !c.stentDES })), 'Stent liberador de fármaco (DES)')}
          {chk(ctx.iamReciente, () => setCtx(c => ({ ...c, iamReciente: !c.iamReciente })), 'IAM / SCA reciente')}
        </div>

        {/* Campos condicionales */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          <Num label="Edad" value={ctx.edad} onChange={v => setCtx(c => ({ ...c, edad: v }))} />
          {ctx.tomaAnticoagulante && (
            <Sel label="Anticoagulante" value={ctx.tipoAnticoagulante ?? ''} onChange={v => setCtx(c => ({ ...c, tipoAnticoagulante: (v || undefined) as 'DOAC' | 'warfarina' | undefined }))}
              opciones={[['', '—'], ['DOAC', 'DOAC'], ['warfarina', 'Warfarina']]} />
          )}
          {ctx.stentDES && (
            <>
              <Sel label="Motivo del stent" value={ctx.stentDESMotivo ?? ''} onChange={v => setCtx(c => ({ ...c, stentDESMotivo: (v || undefined) as 'SCA' | 'cronico' | undefined }))}
                opciones={[['', '—'], ['SCA', 'Síndrome coronario agudo'], ['cronico', 'Enf. coronaria crónica']]} />
              <Num label="Meses desde stent" value={ctx.mesesDesdeStent ?? 0} onChange={v => setCtx(c => ({ ...c, mesesDesdeStent: v }))} />
            </>
          )}
          {ctx.iamReciente && (
            <Num label="Meses desde IAM" value={ctx.mesesDesdeIAM ?? 0} onChange={v => setCtx(c => ({ ...c, mesesDesdeIAM: v }))} />
          )}
        </div>
      </Card>

      {/* ── Calculadoras de regresión (enlace oficial) ── */}
      <div style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text2)' }}>Gupta MICA</strong> y <strong style={{ color: 'var(--text2)' }}>NSQIP Surgical Risk Calculator</strong> usan modelos de regresión propietarios. Para no fabricar valores, usa la calculadora oficial:{' '}
        <a href="https://riskcalculator.facs.org/RiskCalculator/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          ACS NSQIP <ExternalLink size={11} />
        </a>{' · '}
        <a href="https://www.mdcalc.com/calc/4044/gupta-perioperative-cardiac-risk" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          Gupta MICA (MDCalc) <ExternalLink size={11} />
        </a>
      </div>

      {/* ── Recomendaciones ── */}
      <Card icon={<ClipboardCheck size={15} />} titulo={`Recomendaciones perioperatorias (${recomendaciones.length})`} color="var(--purple)">
        {recomendaciones.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Marca medicamentos y datos arriba para generar recomendaciones.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recomendaciones.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: CAT_COLOR[r.categoria], marginTop: 6 }} />
                <span>
                  <strong style={{ color: CAT_COLOR[r.categoria] }}>{r.categoria}{r.cor ? ` · ${r.cor}${r.loe ? `/${r.loe}` : ''}` : ''}:</strong> {r.texto}
                  <span style={{ color: 'var(--text3)', fontSize: 11 }}> — {r.fuente}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {!disabled && (
        <button onClick={aplicar} style={{
          display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
          background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 10,
          padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          <Check size={16} /> Aplicar escalas y recomendaciones a la nota
        </button>
      )}
    </div>
  )
}

// ── Subcomponentes ──
function Card({ icon, titulo, color, children }: { icon: React.ReactNode; titulo: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{titulo}</span>
      </div>
      {children}
    </div>
  )
}
function Resultado({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--s2)', borderRadius: 8, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{children}</div>
}
function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>{label}</label>
      <input type="number" value={value || ''} onChange={e => onChange(Number(e.target.value))}
        style={{ width: 130, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
    </div>
  )
}
function Sel({ label, value, onChange, opciones }: { label: string; value: string; onChange: (v: string) => void; opciones: [string, string][] }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 3 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }}>
        {opciones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}
