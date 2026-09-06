'use client'
/**
 * PANEL DE GINECO-OBSTETRICIA — aparece en pacientes femeninas.
 *  · Calculadora gestacional (FUM o ultrasonido) + hitos del control prenatal.
 *  · Riesgo de preeclampsia → indicación de aspirina.
 *  · Índice de Bishop.
 *  · Conducta ante citología cervical + VPH.
 * Apoyo a la decisión: la conducta la define el médico.
 */
import { useEffect, useMemo, useState } from 'react'
import { Baby, CalendarDays, HeartPulse, Microscope, Plus, Stethoscope } from 'lucide-react'
import { SelloMotor } from '@/components/SelloMotor'
import { hoyISO, zonaActiva } from '@/lib/timezone'
import {
  gestacionPorFUM, gestacionPorUltrasonido, hitosSegunEG,
  aspirinaPreeclampsia, RIESGO_ALTO_PE, RIESGO_MODERADO_PE,
  bishop, conductaCervical, tamizajeRutina,
  type Citologia, type EstadoVPH,
} from '@/lib/expediente/ginecologia'

interface Props {
  sexo?: string
  edadAnios?: number
  onAgregarANota?: (texto: string) => void
  /**
   * LA GESTACIÓN NO SE VUELVE A TECLEAR CADA VEZ QUE SE CIERRA EL PANEL — MG-022.
   *
   * La FUM vivía sólo en el estado local: cerrar la herramienta la borraba y el
   * control prenatal de diez minutos empezaba otra vez por la fecha. Con estas
   * dos props la consulta la conserva mientras dura el encuentro.
   *
   * Lo que NO resuelve: persistirla en el expediente para la visita del mes que
   * viene. Eso necesita un campo en la paciente y está en el handoff.
   */
  gestacionInicial?: { metodo?: 'fum' | 'us'; fum?: string; ciclo?: string; fechaUS?: string; semUS?: string; diasUS?: string }
  onCambioDeGestacion?: (g: { metodo: 'fum' | 'us'; fum: string; ciclo: string; fechaUS: string; semUS: string; diasUS: string }) => void
  /** Hoy en la zona del consultorio (C-014). Ausente = se calcula aquí. */
  hoy?: string
  /** Dentro de la barra de herramientas: sin marco ni título propios. */
  embebido?: boolean
}

type Tab = 'gestacion' | 'preeclampsia' | 'bishop' | 'citologia'

export function PanelGineco({ sexo, edadAnios, onAgregarANota, gestacionInicial, onCambioDeGestacion, hoy: hoyProp, embebido }: Props) {
  const [tab, setTab] = useState<Tab>('gestacion')
  /**
   * C-014: la fecha del CONSULTORIO, no la del navegador en UTC. Con
   * `new Date().toISOString()` después de las 18:00 en México ya es «mañana», y
   * la edad gestacional y la fecha probable de parto se corrían un día — sobre
   * un dato que decide cuándo se cita a una embarazada.
   */
  const hoy = useMemo(() => hoyProp ?? hoyISO(zonaActiva()), [hoyProp])

  // Gestación
  const [metodo, setMetodo] = useState<'fum' | 'us'>(gestacionInicial?.metodo ?? 'fum')
  const [fum, setFum] = useState(gestacionInicial?.fum ?? '')
  const [ciclo, setCiclo] = useState(gestacionInicial?.ciclo ?? '28')
  const [fechaUS, setFechaUS] = useState(gestacionInicial?.fechaUS ?? '')
  const [semUS, setSemUS] = useState(gestacionInicial?.semUS ?? '')
  const [diasUS, setDiasUS] = useState(gestacionInicial?.diasUS ?? '0')

  /* Lo capturado sube a la consulta para que cerrar la herramienta no lo borre. */
  useEffect(() => {
    onCambioDeGestacion?.({ metodo, fum, ciclo, fechaUS, semUS, diasUS })
  }, [metodo, fum, ciclo, fechaUS, semUS, diasUS, onCambioDeGestacion])

  /**
   * MG-011 — POR QUÉ NO HAY CÁLCULO, DICHO CON PRECISIÓN.
   *
   * `gestacionPorFUM` devuelve `null` tanto si falta la fecha como si la fecha
   * es posterior a hoy, y el panel contestaba a las dos con «Captura la fecha de
   * última menstruación» — delante de una fecha ya capturada. Y `Number(ciclo)
   * || 28` convertía «0», «abc» o vacío en 28 sin decirlo (regla 3).
   */
  const cicloNum = Number(ciclo)
  const cicloValido = Number.isFinite(cicloNum) && cicloNum >= 20 && cicloNum <= 45
  const fumEnElFuturo = !!fum && fum > hoy

  const gest = useMemo(() => {
    if (metodo === 'fum') return fum ? gestacionPorFUM(fum, hoy, cicloValido ? cicloNum : 28) : null
    return fechaUS && semUS !== '' ? gestacionPorUltrasonido(fechaUS, Number(semUS), Number(diasUS) || 0, hoy) : null
  }, [metodo, fum, cicloValido, cicloNum, fechaUS, semUS, diasUS, hoy])

  // Preeclampsia
  const [altos, setAltos] = useState<Set<string>>(new Set())
  const [mods, setMods] = useState<Set<string>>(new Set())
  const aas = useMemo(() => aspirinaPreeclampsia(altos.size, mods.size), [altos, mods])

  // Bishop
  const [bs, setBs] = useState<Record<string, number>>({})
  const bish = useMemo(() => bishop(bs), [bs])

  // Citología
  const [cito, setCito] = useState<Citologia>('NILM')
  const [vph, setVph] = useState<EstadoVPH>('desconocido')
  /**
   * MG-009 — SIN EDAD NO HAY CONDUCTA.
   *
   * Esto pasaba `edadAnios ?? 35`: una edad INVENTADA. `conductaCervical` decide
   * por edad (a una de 22 con HSIL le ofrecía el tratamiento escisional
   * inmediato, que el motor reserva a ≥25) y el botón de pegar lo mandaba a la
   * nota. Ausencia de dato no es dato de ausencia: sin edad no se calcula, se
   * dice qué falta y no se puede pegar nada.
   */
  const cerv = useMemo(
    () => (edadAnios != null ? conductaCervical(cito, vph, edadAnios) : null),
    [cito, vph, edadAnios],
  )

  if (sexo && !/^f/i.test(sexo)) return null

  const toggle = (set: Set<string>, put: (s: Set<string>) => void, v: string) => {
    const n = new Set(set)
    n.has(v) ? n.delete(v) : n.add(v)
    put(n)
  }

  return (
    <div style={embebido ? {} : { border: '1px solid color-mix(in srgb, var(--rosa) 30%, transparent)', borderRadius: 12, background: 'color-mix(in srgb, var(--rosa) 5%, transparent)', padding: 14, marginBottom: 12 }}>
      {!embebido && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <Stethoscope size={15} color="var(--rosa)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--rosa)' }}>Ginecología y obstetricia</span>
          {gest && (
            <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--rosa) 15%, transparent)', color: 'var(--rosa)' }}>
              {gest.texto} semanas · {gest.trimestre}º trimestre
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 11, flexWrap: 'wrap' }}>
        <Tb a={tab === 'gestacion'} on={() => setTab('gestacion')} i={<Baby size={13} />} t="Gestación" />
        <Tb a={tab === 'preeclampsia'} on={() => setTab('preeclampsia')} i={<HeartPulse size={13} />} t="Preeclampsia" />
        <Tb a={tab === 'bishop'} on={() => setTab('bishop')} i={<CalendarDays size={13} />} t="Bishop" />
        <Tb a={tab === 'citologia'} on={() => setTab('citologia')} i={<Microscope size={13} />} t="Citología / VPH" />
      </div>

      {/* ── Gestación ── */}
      {tab === 'gestacion' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 9 }}>
            <Chip a={metodo === 'fum'} on={() => setMetodo('fum')} t="Por FUM" />
            <Chip a={metodo === 'us'} on={() => setMetodo('us')} t="Por ultrasonido" />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {metodo === 'fum' ? (
              <>
                <Campo label="Fecha de última menstruación" tipo="date" v={fum} set={setFum} ancho={150} />
                <Campo label="Duración del ciclo (días)" v={ciclo} set={setCiclo} ancho={110} />
              </>
            ) : (
              <>
                <Campo label="Fecha del ultrasonido" tipo="date" v={fechaUS} set={setFechaUS} ancho={150} />
                <Campo label="Semanas" v={semUS} set={setSemUS} ancho={82} />
                <Campo label="Días" v={diasUS} set={setDiasUS} ancho={70} />
              </>
            )}
          </div>

          {gest ? (
            <>
              <div style={{ padding: '10px 12px', borderRadius: 9, border: '1px solid color-mix(in srgb, var(--rosa) 35%, transparent)', background: 'color-mix(in srgb, var(--rosa) 10%, transparent)', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--rosa)' }}>
                    {gest.semanas} semanas {gest.dias} días · {gest.trimestre}º trimestre
                  </span>
                  {/* MI-003: el registro clasifica este motor y hasta hoy eso no salía
                      en ninguna pantalla, aunque /cumplimiento/motores lo promete. */}
                  <SelloMotor id="gineco-obstetricia" />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
                  Fecha probable de parto: <b style={{ color: 'var(--text)' }}>{gest.fpp}</b>
                  {metodo === 'us' && <span style={{ color: 'var(--text3)' }}> (derivada del ultrasonido)</span>}
                </div>
                {onAgregarANota && (
                  <button type="button" style={{ ...btnMini, marginTop: 8 }} onClick={() => onAgregarANota(
                    `Embarazo de ${gest.semanas}.${gest.dias} semanas (${gest.trimestre}º trimestre) por ${metodo === 'fum' ? 'FUM' : 'ultrasonido'}. Fecha probable de parto: ${gest.fpp}.`
                  )}><Plus size={12} /> Agregar a la nota</button>
                )}
              </div>

              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>Control prenatal para esta edad gestacional</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
                {hitosSegunEG(gest.semanas).map((h, i) => (
                  <div key={i} style={{
                    border: '1px solid ' + (h.estado === 'vigente' ? 'color-mix(in srgb, var(--rosa) 40%, transparent)' : 'var(--border)'),
                    background: h.estado === 'vigente' ? 'color-mix(in srgb, var(--rosa) 8%, transparent)' : 'var(--s1)',
                    borderRadius: 9, padding: '8px 11px',
                    opacity: h.estado === 'proximo' ? 0.5 : h.estado === 'vencido' ? 0.75 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{h.hito.titulo}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>
                        sem {h.hito.ventana[0]}{h.hito.ventana[1] !== h.hito.ventana[0] ? `-${h.hito.ventana[1]}` : ''}
                      </span>
                      {h.estado === 'vigente' && <span style={pill('var(--rosa)', 'color-mix(in srgb, var(--rosa) 18%, transparent)')}>AHORA</span>}
                      {h.estado === 'vencido' && <span style={pill('var(--text3)', 'var(--s2)')}>ya pasó</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, lineHeight: 1.45 }}>{h.hito.detalle}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12, color: fumEnElFuturo ? 'var(--amber)' : 'var(--text3)', margin: 0, lineHeight: 1.5 }}>
              {metodo === 'fum'
                ? fumEnElFuturo
                  ? 'La fecha de última menstruación es posterior a hoy: revísala (¿se tecleó el año o el mes cambiado?).'
                  : 'Captura la fecha de última menstruación.'
                : 'Captura la fecha del ultrasonido y la edad gestacional que reportó.'}
            </p>
          )}
          {/* Nada cambia en silencio: si el ciclo no sirve, se dice cuál se usó. */}
          {metodo === 'fum' && ciclo.trim() !== '' && !cicloValido && (
            <p style={{ fontSize: 12, color: 'var(--amber)', margin: '6px 0 0', lineHeight: 1.5 }}>
              «{ciclo}» no es una duración de ciclo válida: el cálculo usa 28 días. Corrígela si el ciclo de la paciente es otro.
            </p>
          )}
        </div>
      )}

      {/* ── Preeclampsia ── */}
      {tab === 'preeclampsia' && (
        <div>
          <Grupo titulo="Factores de ALTO riesgo (basta uno)" items={RIESGO_ALTO_PE} sel={altos} on={v => toggle(altos, setAltos, v)} color="var(--red)" />
          <Grupo titulo="Factores de riesgo MODERADO (se necesitan dos)" items={RIESGO_MODERADO_PE} sel={mods} on={v => toggle(mods, setMods, v)} color="var(--amber)" />
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 9,
            border: `1px solid ${aas.indicada ? 'color-mix(in srgb, var(--rosa) 40%, transparent)' : 'var(--border)'}`,
            background: aas.indicada ? 'color-mix(in srgb, var(--rosa) 10%, transparent)' : 'var(--s1)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: aas.indicada ? 'var(--rosa)' : 'var(--text2)' }}>
              {aas.indicada ? 'Aspirina INDICADA' : 'Aspirina no indicada'} — {aas.motivo}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{aas.conducta}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 5, fontStyle: 'italic' }}>ACOG / USPSTF</div>
            {onAgregarANota && (
              <button type="button" style={{ ...btnMini, marginTop: 8 }} onClick={() => onAgregarANota(
                `Riesgo de preeclampsia (${aas.motivo}): ${aas.conducta}`
              )}><Plus size={12} /> Agregar a la nota</button>
            )}
          </div>
        </div>
      )}

      {/* ── Bishop ── */}
      {tab === 'bishop' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Sel label="Dilatación (cm)" k="dilatacion" bs={bs} setBs={setBs} ops={[['Cerrado', 0], ['1-2', 1], ['3-4', 2], ['5 o más', 3]]} />
            <Sel label="Borramiento (%)" k="borramiento" bs={bs} setBs={setBs} ops={[['0-30', 0], ['40-50', 1], ['60-70', 2], ['80 o más', 3]]} />
            <Sel label="Altura de la presentación" k="altura" bs={bs} setBs={setBs} ops={[['−3', 0], ['−2', 1], ['−1 / 0', 2], ['+1 / +2', 3]]} />
            <Sel label="Consistencia del cuello" k="consistencia" bs={bs} setBs={setBs} ops={[['Firme', 0], ['Media', 1], ['Blanda', 2]]} />
            <Sel label="Posición del cuello" k="posicion" bs={bs} setBs={setBs} ops={[['Posterior', 0], ['Media', 1], ['Anterior', 2]]} />
          </div>
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 9,
            border: `1px solid ${bish.completo ? 'color-mix(in srgb, var(--rosa) 35%, transparent)' : 'var(--border)'}`,
            background: bish.completo ? 'color-mix(in srgb, var(--rosa) 8%, transparent)' : 'var(--s1)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: bish.completo ? 'var(--rosa)' : 'var(--text3)' }}>
              {bish.completo ? `Bishop ${bish.puntaje}/13 — ${bish.categoria}` : 'Bishop: exploración incompleta'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{bish.interpretacion}</div>
            {/* Sin los cinco componentes el puntaje subestima: no se deja pegar a la nota. */}
            {onAgregarANota && bish.completo && (
              <button type="button" style={{ ...btnMini, marginTop: 8 }} onClick={() => onAgregarANota(
                `Índice de Bishop ${bish.puntaje}/13 — ${bish.categoria}. ${bish.interpretacion}`
              )}><Plus size={12} /> Agregar a la nota</button>
            )}
          </div>
        </div>
      )}

      {/* ── Citología ── */}
      {tab === 'citologia' && (
        <div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={etiqueta}>Resultado de citología</span>
              <select value={cito} onChange={e => setCito(e.target.value as Citologia)} style={campoBase}>
                <option value="NILM">NILM (negativa)</option>
                <option value="ASC-US">ASC-US</option>
                <option value="LSIL">LSIL</option>
                <option value="ASC-H">ASC-H</option>
                <option value="HSIL">HSIL</option>
                <option value="AGC">AGC (células glandulares atípicas)</option>
                <option value="CANCER">Carcinoma</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={etiqueta}>Prueba de VPH</span>
              <select value={vph} onChange={e => setVph(e.target.value as EstadoVPH)} style={campoBase}>
                <option value="desconocido">No realizada</option>
                <option value="negativo">Negativa</option>
                <option value="positivo-otro">Positiva (otro genotipo)</option>
                <option value="positivo-16-18">Positiva para 16 o 18</option>
              </select>
            </label>
          </div>

          {!cerv ? (
            <p style={{ fontSize: 12, color: 'var(--amber)', margin: 0, lineHeight: 1.5 }}>
              Falta la edad de la paciente en el expediente: la conducta ante la citología depende
              de ella, así que no se calcula ni se puede pegar a la nota. Captúrala y vuelve aquí.
            </p>
          ) : (
          <div style={{
            padding: '10px 12px', borderRadius: 9,
            border: `1px solid ${cerv.urgencia === 'urgente' ? 'color-mix(in srgb, var(--red) 45%, transparent)' : cerv.urgencia === 'colposcopia' ? 'color-mix(in srgb, var(--amber) 40%, transparent)' : 'color-mix(in srgb, var(--rosa) 35%, transparent)'}`,
            background: cerv.urgencia === 'urgente' ? 'color-mix(in srgb, var(--red) 10%, transparent)' : cerv.urgencia === 'colposcopia' ? 'color-mix(in srgb, var(--amber) 10%, transparent)' : 'color-mix(in srgb, var(--rosa) 8%, transparent)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: cerv.urgencia === 'urgente' ? 'var(--red)' : cerv.urgencia === 'colposcopia' ? 'var(--amber)' : 'var(--rosa)' }}>
              {cito}{vph !== 'desconocido' ? ` · VPH ${vph === 'negativo' ? 'negativo' : vph === 'positivo-16-18' ? '16/18' : 'positivo'}` : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{cerv.conducta}</div>
            {cerv.nota && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5, lineHeight: 1.45 }}>{cerv.nota}</div>}
            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>
              ASCCP 2019 (versión simplificada; con antecedente de displasia o tratamiento previo, consultar las tablas de riesgo completas)
            </div>
            {onAgregarANota && (
              <button type="button" style={{ ...btnMini, marginTop: 8 }} onClick={() => onAgregarANota(
                `Citología cervical ${cito}${vph !== 'desconocido' ? ` con VPH ${vph === 'negativo' ? 'negativo' : vph === 'positivo-16-18' ? 'positivo para 16/18' : 'positivo'}` : ''}. Conducta: ${cerv.conducta}`
              )}><Plus size={12} /> Agregar a la nota</button>
            )}
          </div>
          )}

          {edadAnios != null && (
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
              <b style={{ color: 'var(--text2)' }}>Tamizaje de rutina a los {edadAnios} años:</b> {tamizajeRutina(edadAnios)}
              {' '}<SelloMotor id="gineco-obstetricia" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── piezas ── */

function Grupo({ titulo, items, sel, on, color }: {
  titulo: string; items: string[]; sel: Set<string>; on: (v: string) => void; color: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color, marginBottom: 6 }}>{titulo}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(i => (
          <button key={i} type="button" onClick={() => on(i)} style={{
            padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
            border: '1px solid ' + (sel.has(i) ? color : 'var(--border)'),
            background: sel.has(i) ? color : 'var(--s2)',
            color: sel.has(i) ? 'var(--sobre-aviso)' : 'var(--text3)',
          }}>{i}</button>
        ))}
      </div>
    </div>
  )
}

function Sel({ label, k, bs, setBs, ops }: {
  label: string; k: string; bs: Record<string, number>
  setBs: (f: (p: Record<string, number>) => Record<string, number>) => void
  ops: [string, number][]
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 150, fontSize: 12, color: 'var(--text2)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {ops.map(([t, v]) => (
          <button key={t} type="button" onClick={() => setBs(p => ({ ...p, [k]: v }))} style={{
            padding: '4px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            border: '1px solid ' + (bs[k] === v ? 'var(--rosa)' : 'var(--border)'),
            background: bs[k] === v ? 'var(--rosa)' : 'var(--s2)',
            color: bs[k] === v ? 'var(--sobre-aviso)' : 'var(--text3)',
          }}>{t}</button>
        ))}
      </div>
    </div>
  )
}

function Campo({ label, v, set, ancho, tipo = 'number' }: {
  label: string; v: string; set: (s: string) => void; ancho: number; tipo?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={etiqueta}>{label}</span>
      <input type={tipo} value={v} onChange={e => set(e.target.value)} style={{ ...campoBase, width: ancho }} />
    </label>
  )
}

function Tb({ a, on, i, t }: { a: boolean; on: () => void; i: React.ReactNode; t: string }) {
  return (
    <button type="button" onClick={on} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7,
      fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
      border: '1px solid ' + (a ? 'var(--rosa)' : 'var(--border)'),
      background: a ? 'var(--rosa)' : 'var(--s2)', color: a ? 'var(--sobre-aviso)' : 'var(--text3)',
    }}>{i}{t}</button>
  )
}

function Chip({ a, on, t }: { a: boolean; on: () => void; t: string }) {
  return (
    <button type="button" onClick={on} style={{
      padding: '4px 10px', borderRadius: 'var(--r-pill)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
      border: '1px solid ' + (a ? 'color-mix(in srgb, var(--rosa) 50%, transparent)' : 'var(--border)'),
      background: a ? 'color-mix(in srgb, var(--rosa) 15%, transparent)' : 'var(--s2)', color: a ? 'var(--rosa)' : 'var(--text3)',
    }}>{t}</button>
  )
}

const pill = (fg: string, bg: string): React.CSSProperties => ({
  fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 'var(--r-pill)', background: bg, color: fg,
})
const etiqueta: React.CSSProperties = { fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }
const campoBase: React.CSSProperties = {
  background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '5px 8px', fontSize: 12, color: 'var(--text)',
}
const btnMini: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, background: 'color-mix(in srgb, var(--rosa) 15%, transparent)',
  color: 'var(--rosa)', border: '1px solid color-mix(in srgb, var(--rosa) 35%, transparent)', borderRadius: 6,
  padding: '3px 9px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
}
