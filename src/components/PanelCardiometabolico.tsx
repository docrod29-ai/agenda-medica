'use client'
/**
 * PANEL CARDIOMETABÓLICO — dislipidemia, obesidad, MASLD (esteatosis hepática
 * metabólica) y su hoja para
 * el paciente, en un solo lugar porque en la consulta real vienen juntos.
 * Todo el contenido sale de módulos respaldados por guía; nada se inventa.
 */
import { useMemo, useState } from 'react'
import { evaluarPanelLipidico } from '@/lib/expediente/cardiometabolico/biomarcadores-lipidos'
import { Activity, Droplet, FileText, Plus, Printer, Scale, Waves } from 'lucide-react'
import {
  metaLipidica, planTrigliceridos, interpretarLpa, categorizarPrevent,
  esMuyAltoRiesgo, INTENSIDAD_ESTATINAS, DIETA_LDL, SUPLEMENTOS_SIN_BENEFICIO,
  SEGUIMIENTO_LIPIDOS, FUENTE_DISLIPIDEMIA,
} from '@/lib/expediente/cardiometabolico/dislipidemia'
import {
  imc as calcImc, clasificarIMC, indiceCinturaTalla, cinturaElevadaMexico,
  estadificarABCD, evaluarRespuesta, METAS_POR_COMPLICACION, FARMACOS_OBESIDAD,
  COMPLICACIONES_OBESIDAD, ENFERMEDADES_RELACIONADAS, REGLA_3_MESES,
  RECUPERACION_PESO, FUENTE_OBESIDAD,
} from '@/lib/expediente/cardiometabolico/obesidad'
import {
  fib4, interpretarFib4, interpretarElastografia, PERDIDA_PESO_MASLD,
  TRATAMIENTO_POR_ESTADIO, FUENTE_MASLD,
} from '@/lib/expediente/cardiometabolico/masld'
import { generarHoja, hojaATexto } from '@/lib/expediente/cardiometabolico/hoja-paciente'

interface Props {
  nombre?: string
  edad?: number
  sexo?: string
  onAgregarANota?: (texto: string) => void
  embebido?: boolean
}

type Tab = 'lipidos' | 'peso' | 'higado' | 'hoja'

export function PanelCardiometabolico({ nombre, edad, sexo, onAgregarANota, embebido }: Props) {
  const [tab, setTab] = useState<Tab>('lipidos')
  const esMujer = !!sexo && /^f/i.test(sexo)

  // Lípidos
  const [ldl, setLdl] = useState('')
  const [tg, setTg] = useState('')
  const [lpa, setLpa] = useState('')
  const [unidadLpa, setUnidadLpa] = useState<'nmol/L' | 'mg/dL'>('nmol/L')
  // Biomarcadores más allá del LDL-C: el perfil ya trae total y HDL, así que
  // no-HDL y remanente salen sin pedir ningún estudio extra.
  const [ct, setCt] = useState('')
  const [hdl, setHdl] = useState('')
  const [apoB, setApoB] = useState('')
  const [prevent, setPrevent] = useState('')
  const [ascvd, setAscvd] = useState(false)
  const [eventos, setEventos] = useState('0')
  const [condiciones, setCondiciones] = useState('0')
  const [diabetes, setDiabetes] = useState(false)
  const [erc, setErc] = useState(false)
  const [severa, setSevera] = useState(false)

  const muyAlto = useMemo(
    () => ascvd && esMuyAltoRiesgo(Number(eventos) || 0, Number(condiciones) || 0),
    [ascvd, eventos, condiciones],
  )
  const meta = useMemo(() => metaLipidica({
    ascvdClinica: ascvd, muyAltoRiesgo: muyAlto, erc, diabetes,
    hipercolesterolemiaSevera: severa,
    preventPct: prevent ? Number(prevent) : undefined,
    tg: tg ? Number(tg) : undefined, edad,
  }), [ascvd, muyAlto, erc, diabetes, severa, prevent, tg, edad])
  const planTG = useMemo(() => (tg ? planTrigliceridos(Number(tg)) : null), [tg])
  const resLpa = useMemo(() => (lpa ? interpretarLpa(Number(lpa), unidadLpa) : null), [lpa, unidadLpa])
  const catPrevent = useMemo(() => (prevent ? categorizarPrevent(Number(prevent)) : null), [prevent])

  /**
   * Panel lipídico avanzado. Se calcula con lo que haya: no-HDL y remanente salen
   * del perfil habitual (total y HDL), así que aparecen sin pedir ningún estudio
   * extra, y `faltantes` dice qué conviene solicitar.
   */
  const panelAvanzado = useMemo(() => evaluarPanelLipidico({
    colesterolTotal: ct ? Number(ct) : undefined,
    hdl: hdl ? Number(hdl) : undefined,
    ldl: ldl ? Number(ldl) : undefined,
    trigliceridos: tg ? Number(tg) : undefined,
    apoB: apoB ? Number(apoB) : undefined,
    lpa: lpa ? Number(lpa) : undefined,
    lpaUnidad: unidadLpa,
  }, {
    categoria: meta.ldl <= 55 ? 'muy-alto' : meta.ldl <= 70 ? 'alto' : 'intermedio',
    metaNoHDL: meta.noHDL,
  }), [ct, hdl, ldl, tg, apoB, lpa, unidadLpa, meta.ldl, meta.noHDL])

  // Peso
  const [peso, setPeso] = useState('')
  const [talla, setTalla] = useState('')
  const [cintura, setCintura] = useState('')
  const [comps, setComps] = useState<Set<string>>(new Set())
  const [severaComp, setSeveraComp] = useState(false)
  const [perdido, setPerdido] = useState('')

  const bmi = useMemo(() => (peso && talla ? calcImc(Number(peso), Number(talla)) : null), [peso, talla])
  const ict = useMemo(() => (cintura && talla ? indiceCinturaTalla(Number(cintura), Number(talla)) : null), [cintura, talla])
  const cinturaAlta = useMemo(() => (cintura ? cinturaElevadaMexico(Number(cintura), esMujer) : null), [cintura, esMujer])
  const abcd = useMemo(() => estadificarABCD(comps.size, severaComp), [comps, severaComp])
  const respuesta = useMemo(() => (perdido ? evaluarRespuesta(Number(perdido)) : null), [perdido])

  // Hígado
  const [ast, setAst] = useState('')
  const [alt, setAlt] = useState('')
  const [plaq, setPlaq] = useState('')
  const [kpa, setKpa] = useState('')
  const valorFib4 = useMemo(
    () => (edad && ast && plaq && alt ? fib4(edad, Number(ast), Number(plaq), Number(alt)) : null),
    [edad, ast, plaq, alt],
  )
  const resFib4 = useMemo(
    () => (valorFib4 != null && edad ? interpretarFib4(valorFib4, edad) : null),
    [valorFib4, edad],
  )
  const resElasto = useMemo(
    () => (kpa ? interpretarElastografia(Number(kpa), plaq ? Number(plaq) : undefined) : null),
    [kpa, plaq],
  )

  // Hoja del paciente
  const hoja = useMemo(() => generarHoja({
    nombre, edad, esMujer,
    pesoKg: peso ? Number(peso) : undefined,
    tallaCm: talla ? Number(talla) : undefined,
    ldl: ldl ? Number(ldl) : undefined,
    tg: tg ? Number(tg) : undefined,
    fib4: valorFib4 ?? undefined,
    complicaciones: [...comps],
    contextoLipidico: {
      ascvdClinica: ascvd, muyAltoRiesgo: muyAlto, erc, diabetes,
      hipercolesterolemiaSevera: severa,
      preventPct: prevent ? Number(prevent) : undefined,
      tg: tg ? Number(tg) : undefined, edad,
    },
  }), [nombre, edad, esMujer, peso, talla, ldl, tg, valorFib4, comps, ascvd, muyAlto, erc, diabetes, severa, prevent])

  const imprimir = () => {
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    const html = `<html><head><title>${hoja.titulo}</title><meta charset="utf-8">
      <style>
        body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:32px auto;padding:0 24px;line-height:1.6;color:#111}
        h1{font-size:22px;margin:0 0 4px;border-bottom:2px solid #111;padding-bottom:8px}
        h2{font-size:15px;margin:26px 0 8px;text-transform:uppercase;letter-spacing:.5px;color:#333}
        p{margin:0 0 10px} ul{margin:8px 0 0;padding-left:20px} li{margin-bottom:6px}
        .intro{font-style:italic;color:#444;margin-bottom:20px}
        .cierre{margin-top:28px;padding-top:12px;border-top:1px solid #ccc;font-size:13px;color:#555}
        @media print{body{margin:0}}
      </style></head><body>
      <h1>${hoja.titulo}</h1><p class="intro">${hoja.intro}</p>
      ${hoja.secciones.map(s => `<h2>${s.titulo}</h2>${s.parrafos.map(p => `<p>${p}</p>`).join('')}${s.acciones?.length ? `<ul>${s.acciones.map(a => `<li>${a}</li>`).join('')}</ul>` : ''}`).join('')}
      <p class="cierre">${hoja.cierre}</p>
      </body></html>`
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
  }

  const alternar = (s: Set<string>, put: (n: Set<string>) => void, v: string) => {
    const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); put(n)
  }

  return (
    <div style={embebido ? {} : caja}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 11, flexWrap: 'wrap' }}>
        <Tb a={tab === 'lipidos'} on={() => setTab('lipidos')} i={<Droplet size={13} />} t="Lípidos" />
        <Tb a={tab === 'peso'} on={() => setTab('peso')} i={<Scale size={13} />} t="Peso y obesidad" />
        <Tb a={tab === 'higado'} on={() => setTab('higado')} i={<Waves size={13} />} t="Hígado graso" />
        <Tb a={tab === 'hoja'} on={() => setTab('hoja')} i={<FileText size={13} />} t="Hoja del paciente" />
      </div>

      {/* ── LÍPIDOS ── */}
      {tab === 'lipidos' && (
        <div style={col}>
          <Bloque t="Contexto clínico">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Campo l="LDL-C (mg/dL)" v={ldl} s={setLdl} w={100} />
              <Campo l="Triglicéridos" v={tg} s={setTg} w={100} />
              <Campo l="PREVENT 10 años (%)" v={prevent} s={setPrevent} w={120} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <Chk on={ascvd} set={setAscvd} t="ASCVD clínica" />
              <Chk on={diabetes} set={setDiabetes} t="Diabetes" />
              <Chk on={erc} set={setErc} t="Enfermedad renal crónica" />
              <Chk on={severa} set={setSevera} t="LDL ≥190 (hipercolesterolemia severa)" />
            </div>
            {ascvd && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Campo l="Eventos ASCVD mayores" v={eventos} s={setEventos} w={130} />
                <Campo l="Condiciones de alto riesgo" v={condiciones} s={setCondiciones} w={150} />
                <span style={{ ...pill(muyAlto ? '#f87171' : 'var(--text3)', muyAlto ? 'rgba(239,68,68,.15)' : 'var(--s2)'), marginBottom: 6 }}>
                  {muyAlto ? 'MUY ALTO RIESGO' : 'No de muy alto riesgo'}
                </span>
              </div>
            )}
          </Bloque>

          <Res color="var(--red)" titulo={`Meta: LDL-C <${meta.ldl} · no-HDL-C <${meta.noHDL}${meta.apoB ? ` · apoB <${meta.apoB}` : ''} mg/dL`}>
            <p style={txt}>{meta.poblacion}</p>
            {meta.opcional && <p style={{ ...txt, color: 'var(--text3)' }}>{meta.opcional}</p>}
            {ldl && Number(ldl) > meta.ldl && (
              <p style={{ ...txt, fontWeight: 700, color: 'var(--amber)' }}>
                Faltan {Math.round(Number(ldl) - meta.ldl)} mg/dL para la meta.
              </p>
            )}
            {catPrevent && <p style={{ ...txt, color: 'var(--text3)' }}>{catPrevent.etiqueta}. {catPrevent.equivalentePCE}.</p>}
            <Nota onAgregarANota={onAgregarANota} texto={`Meta de lípidos: LDL-C <${meta.ldl} mg/dL, no-HDL-C <${meta.noHDL} mg/dL${meta.apoB ? `, apoB <${meta.apoB} mg/dL` : ''} (${meta.poblacion}). ${FUENTE_DISLIPIDEMIA}.`} />
          </Res>

          {planTG && Number(tg) >= 150 && (
            <Res color={planTG.riesgoPancreatitis ? '#f87171' : '#f59e0b'} titulo={planTG.categoria}>
              {planTG.riesgoPancreatitis && <p style={{ ...txt, fontWeight: 700, color: 'var(--red)' }}>Riesgo de pancreatitis.</p>}
              <ul style={lista}>
                <li>Azúcares añadidos: {planTG.azucares}</li>
                <li>Grasa total: {planTG.grasaTotal}</li>
                <li>Alcohol: {planTG.alcohol}</li>
                <li>{planTG.peso}</li>
              </ul>
              <p style={{ ...txt, color: 'var(--text3)' }}>{planTG.referencia}</p>
              <Nota onAgregarANota={onAgregarANota} texto={`${planTG.categoria}. Azúcares añadidos ${planTG.azucares}. Grasa total ${planTG.grasaTotal}. Alcohol: ${planTG.alcohol}. ${planTG.peso}`} />
            </Res>
          )}

          <Bloque t="Más allá del LDL-C — apoB, no-HDL y colesterol remanente">
            <p style={{ ...txt, color: 'var(--text3)', marginTop: 0 }}>
              El LDL-C se <em>calcula</em> y estima el colesterol que llevan las partículas, no
              cuántas hay. Con triglicéridos altos, diabetes o síndrome metabólico se queda corto —
              y ese es el perfil más frecuente en consulta.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Campo l="Colesterol total" v={ct} s={setCt} w={110} />
              <Campo l="HDL" v={hdl} s={setHdl} w={90} />
              <Campo l="apoB (mg/dL)" v={apoB} s={setApoB} w={110} />
            </div>

            {panelAvanzado.lecturas.map((l, i) => (
              <Res key={i} color={l.nivel === 'optimo' ? '#22c55e' : l.nivel === 'limitrofe' ? '#f59e0b' : '#f87171'} titulo={l.nombre}>
                <p style={{ ...txt, fontWeight: 600 }}>{l.interpretacion}</p>
                <p style={{ ...txt, color: 'var(--text3)' }}>{l.fundamento}</p>
                <ul style={lista}>{l.recomendaciones.map((r, k) => <li key={k}>{r}</li>)}</ul>
                <p style={{ ...txt, color: 'var(--text3)' }}>{l.referencia}</p>
                <Nota onAgregarANota={onAgregarANota}
                  texto={`${l.nombre}: ${l.interpretacion} ${l.recomendaciones.join(' ')} (${l.referencia})`} />
              </Res>
            ))}

            {panelAvanzado.discordancias.length > 0 && (
              <Res color="var(--red)" titulo="Discordancia entre marcadores">
                <ul style={lista}>{panelAvanzado.discordancias.map((d, i) => <li key={i}>{d}</li>)}</ul>
                <Nota onAgregarANota={onAgregarANota}
                  texto={`Discordancia lipídica: ${panelAvanzado.discordancias.join(' ')}`} />
              </Res>
            )}

            {panelAvanzado.faltantes.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)' }}>Conviene solicitar</div>
                <ul style={lista}>{panelAvanzado.faltantes.map((f, i) => <li key={i}>{f}</li>)}</ul>
                <Nota onAgregarANota={onAgregarANota}
                  texto={`Se solicitan para completar el perfil lipídico: ${panelAvanzado.faltantes.join(' ')}`} />
              </div>
            )}
          </Bloque>

          <Bloque t="Lp(a) — la guía 2026 la pide al menos UNA VEZ en todo adulto">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <Campo l="Lp(a)" v={lpa} s={setLpa} w={100} />
              <select value={unidadLpa} onChange={e => setUnidadLpa(e.target.value as 'nmol/L' | 'mg/dL')} style={{ ...campo, marginBottom: 0 }}>
                <option value="nmol/L">nmol/L</option><option value="mg/dL">mg/dL</option>
              </select>
            </div>
            {resLpa && <>
              <p style={{ ...txt, marginTop: 8, color: resLpa.nivel === 'normal' ? 'var(--text2)' : '#f59e0b' }}>{resLpa.texto}</p>
              <Nota onAgregarANota={onAgregarANota} texto={resLpa.texto} />
            </>}
          </Bloque>

          <Bloque t="Intensidad de estatina">
            {INTENSIDAD_ESTATINAS.map(n => (
              <div key={n.intensidad} style={{ marginBottom: 7 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--red)', textTransform: 'capitalize' }}>{n.intensidad} — {n.reduccionLDL}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
                  {[...n.preferidas, ...n.otras].map(e => `${e.nombre} ${e.dosis}`).join(' · ') || '—'}
                </div>
              </div>
            ))}
          </Bloque>

          <Bloque t="Seguimiento">
            <p style={txt}>{SEGUIMIENTO_LIPIDOS.inicio}</p>
            <p style={txt}>{SEGUIMIENTO_LIPIDOS.despues}</p>
          </Bloque>
        </div>
      )}

      {/* ── PESO ── */}
      {tab === 'peso' && (
        <div style={col}>
          <Bloque t="Antropometría">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Campo l="Peso (kg)" v={peso} s={setPeso} w={96} />
              <Campo l="Talla (cm)" v={talla} s={setTalla} w={96} />
              <Campo l="Cintura (cm)" v={cintura} s={setCintura} w={110} />
            </div>
            {bmi != null && (
              <p style={{ ...txt, marginTop: 8 }}>
                IMC <b>{bmi}</b> — {clasificarIMC(bmi)}
                {ict && <> · Índice cintura-talla <b>{ict.valor}</b> {ict.elevado ? '(elevado)' : '(normal)'}</>}
                {cinturaAlta != null && <> · Cintura {cinturaAlta ? 'ELEVADA' : 'normal'} para población de México</>}
              </p>
            )}
          </Bloque>

          <Bloque t="Complicaciones presentes (definen el estadio y el tratamiento)">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
              {[...COMPLICACIONES_OBESIDAD, ...ENFERMEDADES_RELACIONADAS].map(c => (
                <button key={c} type="button" onClick={() => alternar(comps, setComps, c)} style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  border: '1px solid ' + (comps.has(c) ? '#22c55e' : 'var(--border)'),
                  background: comps.has(c) ? 'rgba(34,197,94,.15)' : 'var(--s2)',
                  color: comps.has(c) ? '#22c55e' : 'var(--text3)',
                }}>{c}</button>
              ))}
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={severaComp} onChange={e => setSeveraComp(e.target.checked)} />
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Al menos una es severa</span>
            </label>
          </Bloque>

          <Res color="#22c55e" titulo={`Estadio ABCD ${abcd.estadio}`}>
            <p style={txt}>{abcd.descripcion}</p>
            <p style={{ ...txt, color: 'var(--text3)' }}>{abcd.equivalencia}</p>
            <p style={{ ...txt, fontWeight: 700 }}>{abcd.tratamiento}</p>
            <Nota onAgregarANota={onAgregarANota} texto={`Obesidad estadio ABCD ${abcd.estadio}. ${abcd.descripcion} ${abcd.tratamiento} (${FUENTE_OBESIDAD}).`} />
          </Res>

          {comps.size > 0 && peso && (
            <Bloque t="Cuánto peso hay que bajar para cada complicación de este paciente">
              {METAS_POR_COMPLICACION.filter(m => [...comps].some(c => m.complicacion.toLowerCase().includes(c.toLowerCase().split(' ')[0]) || c.toLowerCase().includes(m.complicacion.toLowerCase().split(' ')[0]))).map(m => (
                <div key={m.complicacion} style={{ fontSize: 11.5, color: 'var(--text2)', marginBottom: 3 }}>
                  <b>{m.complicacion}:</b> {m.beneficio}
                  {!/investigación/i.test(m.beneficio) && Number(peso) > 0 && (
                    <span style={{ color: 'var(--text3)' }}> (aprox. {Math.round(Number(peso) * parseFloat(m.beneficio) / 100)} kg)</span>
                  )}
                </div>
              ))}
            </Bloque>
          )}

          <Bloque t="Respuesta al tratamiento">
            <Campo l="Peso perdido (%)" v={perdido} s={setPerdido} w={120} />
            {respuesta && (
              <div style={{ marginTop: 8 }}>
                <p style={{ ...txt, fontWeight: 700, color: respuesta.categoria === 'incompleta' ? '#f87171' : respuesta.categoria === 'buena' ? '#f59e0b' : '#22c55e' }}>{respuesta.etiqueta}</p>
                <p style={txt}>{respuesta.conducta}</p>
                <Nota onAgregarANota={onAgregarANota} texto={`${respuesta.etiqueta}. ${respuesta.conducta}`} />
              </div>
            )}
            <p style={{ ...txt, color: 'var(--text3)', marginTop: 6 }}>{REGLA_3_MESES}</p>
          </Bloque>

          <Bloque t="Fármacos">
            {FARMACOS_OBESIDAD.map(f => (
              <details key={f.nombre} style={{ marginBottom: 5 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}>
                  {f.nombre} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>— {f.perdidaEsperada.split('.')[0]}</span>
                </summary>
                <div style={{ fontSize: 11.5, color: 'var(--text2)', padding: '5px 0 0 14px', lineHeight: 1.5 }}>
                  <div><b>Inicio:</b> {f.inicio}</div>
                  <div><b>Escalamiento:</b> {f.escalamiento}</div>
                  <div><b>Máxima:</b> {f.maxima}</div>
                  <div><b>Contraindicaciones:</b> {f.contraindicaciones}</div>
                  <div style={{ color: 'var(--text3)' }}>{f.grade}</div>
                </div>
              </details>
            ))}
            <p style={{ ...txt, color: 'var(--amber)', marginTop: 6 }}>{RECUPERACION_PESO.cuanto}</p>
          </Bloque>
        </div>
      )}

      {/* ── HÍGADO ── */}
      {tab === 'higado' && (
        <div style={col}>
          <Bloque t="FIB-4 (se calcula con la edad del paciente)">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Campo l="AST (U/L)" v={ast} s={setAst} w={92} />
              <Campo l="ALT (U/L)" v={alt} s={setAlt} w={92} />
              <Campo l="Plaquetas (×10⁹/L)" v={plaq} s={setPlaq} w={130} />
            </div>
            {!edad && <p style={{ ...txt, color: 'var(--amber)', marginTop: 6 }}>Falta la edad del paciente en el expediente para calcular el FIB-4.</p>}
          </Bloque>

          {resFib4 && (
            <Res color={resFib4.zona === 'alto' ? '#f87171' : resFib4.zona === 'indeterminado' ? '#f59e0b' : '#22c55e'} titulo={`FIB-4 ${resFib4.valor}`}>
              <p style={txt}>{resFib4.interpretacion}</p>
              <p style={{ ...txt, fontWeight: 700 }}>{resFib4.conducta}</p>
              <p style={{ ...txt, color: 'var(--text3)' }}>{resFib4.seguimiento}</p>
              {resFib4.advertencias.map((a, i) => (
                <p key={i} style={{ ...txt, color: 'var(--amber)', fontSize: 11 }}>{a}</p>
              ))}
              <Nota onAgregarANota={onAgregarANota} texto={`FIB-4 ${resFib4.valor}: ${resFib4.interpretacion} ${resFib4.conducta} (${FUENTE_MASLD}).`} />
            </Res>
          )}

          <Bloque t="Elastografía (si ya se hizo)">
            <Campo l="Rigidez hepática (kPa)" v={kpa} s={setKpa} w={140} />
            {resElasto && (
              <div style={{ marginTop: 8 }}>
                <p style={{ ...txt, fontWeight: 700, color: resElasto.referir ? '#f87171' : '#22c55e' }}>{resElasto.interpretacion}</p>
                <p style={txt}>{resElasto.conducta}</p>
                <Nota onAgregarANota={onAgregarANota} texto={`${resElasto.interpretacion} ${resElasto.conducta}`} />
              </div>
            )}
          </Bloque>

          <Bloque t="Qué logra cada porcentaje de pérdida de peso en el hígado">
            {PERDIDA_PESO_MASLD.map(p => (
              <div key={p.porcentaje} style={{ fontSize: 11.5, color: 'var(--text2)', marginBottom: 4, lineHeight: 1.5 }}>
                <b style={{ color: '#22c55e' }}>{p.porcentaje}:</b> {p.logra}
              </div>
            ))}
          </Bloque>

          <Bloque t="Tratamiento según el estadio">
            {TRATAMIENTO_POR_ESTADIO.map(t => (
              <details key={t.estadio} style={{ marginBottom: 5 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--text)' }}>{t.estadio}</summary>
                <div style={{ fontSize: 11.5, color: 'var(--text2)', padding: '5px 0 0 14px', lineHeight: 1.5 }}>
                  <div><b>Obesidad:</b> {t.obesidad}</div>
                  <div><b>Diabetes:</b> {t.diabetes}</div>
                  <div><b>MASH:</b> {t.mash}</div>
                  {t.advertencia && <div style={{ color: 'var(--amber)' }}>{t.advertencia}</div>}
                </div>
              </details>
            ))}
          </Bloque>
        </div>
      )}

      {/* ── HOJA DEL PACIENTE ── */}
      {tab === 'hoja' && (
        <div style={col}>
          <p style={{ ...txt, color: 'var(--text3)' }}>
            Se arma sola con los datos que capturaste en las otras pestañas. Entre más llenes, más específica queda.
          </p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button type="button" onClick={imprimir} style={{ ...btn, background: '#22c55e', color: '#000', border: 'none' }}>
              <Printer size={13} /> Imprimir para el paciente
            </button>
            {onAgregarANota && (
              <button type="button" onClick={() => onAgregarANota(`Se entregó hoja de información al paciente.\n\n${hojaATexto(hoja)}`)} style={btn}>
                <Plus size={13} /> Agregar a la nota
              </button>
            )}
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 9, background: 'var(--s1)', padding: 12, maxHeight: 400, overflowY: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{hoja.titulo}</div>
            <p style={{ ...txt, fontStyle: 'italic' }}>{hoja.intro}</p>
            {hoja.secciones.map((s, i) => (
              <div key={i} style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: .3 }}>{s.titulo}</div>
                {s.parrafos.map((p, j) => <p key={j} style={txt}>{p}</p>)}
                {s.acciones?.length ? <ul style={lista}>{s.acciones.map((a, j) => <li key={j}>{a}</li>)}</ul> : null}
              </div>
            ))}
            <p style={{ ...txt, color: 'var(--text3)', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>{hoja.cierre}</p>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 12, lineHeight: 1.5, fontStyle: 'italic' }}>
        {tab === 'lipidos' && FUENTE_DISLIPIDEMIA}
        {tab === 'peso' && FUENTE_OBESIDAD}
        {tab === 'higado' && FUENTE_MASLD}
        {tab === 'hoja' && 'Contenido derivado de las guías citadas en cada pestaña. Apoyo a la decisión: no sustituye el juicio clínico.'}
      </div>
      {tab === 'lipidos' && (
        <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 6, lineHeight: 1.5 }}>
          {SUPLEMENTOS_SIN_BENEFICIO.recomendacion} {DIETA_LDL[0].intervencion}: {DIETA_LDL[0].efecto.toLowerCase()}.
        </div>
      )}
    </div>
  )
}

/* ── piezas ── */
function Bloque({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text2)', marginBottom: 6 }}>{t}</div>
      {children}
    </div>
  )
}
function Res({ color, titulo, children }: { color: string; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${color}55`, background: `${color}18`, borderRadius: 9, padding: '10px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color }}>{titulo}</div>
      {children}
    </div>
  )
}
function Nota({ onAgregarANota, texto }: { onAgregarANota?: (t: string) => void; texto: string }) {
  if (!onAgregarANota) return null
  return <button type="button" onClick={() => onAgregarANota(texto)} style={{ ...btn, marginTop: 7 }}><Plus size={12} /> Agregar a la nota</button>
}
function Campo({ l, v, s, w }: { l: string; v: string; s: (x: string) => void; w: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>{l}</span>
      <input type="number" inputMode="decimal" value={v} onChange={e => s(e.target.value)} style={{ ...campo, width: w }} />
    </label>
  )
}
function Chk({ on, set, t }: { on: boolean; set: (b: boolean) => void; t: string }) {
  return (
    <button type="button" onClick={() => set(!on)} style={{
      padding: '4px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
      border: '1px solid ' + (on ? '#f87171' : 'var(--border)'),
      background: on ? 'rgba(239,68,68,.15)' : 'var(--s2)', color: on ? '#f87171' : 'var(--text3)',
    }}>{t}</button>
  )
}
function Tb({ a, on, i, t }: { a: boolean; on: () => void; i: React.ReactNode; t: string }) {
  return (
    <button type="button" onClick={on} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7,
      fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
      border: '1px solid ' + (a ? '#22c55e' : 'var(--border)'),
      background: a ? '#22c55e' : 'var(--s2)', color: a ? '#000' : 'var(--text3)',
    }}>{i}{t}</button>
  )
}

const caja: React.CSSProperties = { border: '1px solid rgba(34,197,94,.3)', borderRadius: 12, background: 'rgba(34,197,94,.05)', padding: 14, marginBottom: 12 }
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 }
const txt: React.CSSProperties = { fontSize: 12, color: 'var(--text2)', margin: '4px 0 0', lineHeight: 1.55 }
const lista: React.CSSProperties = { margin: '6px 0 0', paddingLeft: 18, fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.55 }
const campo: React.CSSProperties = { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }
const pill = (fg: string, bg: string): React.CSSProperties => ({ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 100, background: bg, color: fg })
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,.35)', borderRadius: 7, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }

export { Activity }
