'use client'
/**
 * PANEL DE PEDIATRÍA — aparece solo si el paciente es menor de edad.
 *  · Dosis por peso con TOPE de adulto (el error más peligroso en pediatría).
 *  · Esquema de vacunación de México con detección de atrasos.
 * Apoyo a la decisión: la dosis final la ajusta el médico.
 */
import { useEffect, useMemo, useState } from 'react'
import { Baby, Syringe, Pill, Plus, AlertTriangle, TrendingUp, ClipboardPlus } from 'lucide-react'
import { SelloMotor } from '@/components/SelloMotor'
import { hoyISO as hoyDelConsultorio, zonaActiva } from '@/lib/timezone'
import type { Medicamento } from '@/types/expediente'
import {
  FARMACOS_PED, calcularDosisPediatrica, vacunasSegunEdad, imc, evaluarTodo, edadEnMeses,
  libraAKg, revisarPesoPediatrico, type UnidadPeso,
} from '@/lib/expediente/pediatria'

interface Props {
  /** Edad del paciente en años (si es ≥ 18 el panel no se muestra). */
  edadAnios?: number
  /** Fecha de nacimiento (ISO): si está, la edad en MESES se calcula exacta —
      crítico en lactantes, donde `edad*12` colapsa a 0 (percentil y vacunas mal). */
  fechaNacimiento?: string
  /** Peso ya capturado en signos: siembra el campo para no re-teclearlo (y evitar
      dos pesos discrepantes en la misma consulta). */
  pesoInicial?: number
  /**
   * EL PESO DE LA CONSULTA ANTERIOR — MP-006 (Panel de Lujo 2026-09).
   *
   * `revisarPesoPediatrico` detecta el error lb↔kg comparando con la medición
   * PREVIA. Aquí se recibía `pesoInicial`, que es el peso de HOY: la razón valía
   * 1 y la detección ×2.2 no podía saltar jamás. Ausente = no hay nota anterior
   * con peso, y entonces esa comparación simplemente no se hace.
   */
  pesoPrevio?: number
  /** Fecha (ISO) de esa medición previa, para poder decirla. */
  fechaDelPesoPrevio?: string
  /** Hoy, en la zona del consultorio. Ausente = se calcula aquí (C-014). */
  hoy?: string
  /**
   * Manda el fármaco a la LISTA DE MEDICAMENTOS de la consulta — MP-008.
   * Sin esto, «Nota» pegaba un rango en texto libre que ni la receta ni el
   * verificador de dosis podían leer, y el médico tecleaba la dosis dos veces.
   */
  onRecetar?: (m: Medicamento) => void
  /** Sexo del paciente: la referencia de la OMS es distinta por sexo. */
  sexo?: string
  onAgregarANota?: (texto: string) => void
  /** Dentro de la barra de herramientas: sin marco ni título propios. */
  embebido?: boolean
}

export function PanelPediatria({ edadAnios, fechaNacimiento, pesoInicial, pesoPrevio, fechaDelPesoPrevio, hoy, sexo, onAgregarANota, onRecetar, embebido }: Props) {
  const [tab, setTab] = useState<'dosis' | 'vacunas' | 'crecimiento'>('dosis')
  const [perimetro, setPerimetro] = useState('')
  const [peso, setPeso] = useState(pesoInicial && pesoInicial > 0 ? String(pesoInicial) : '')
  // L6.2 (decisión del Dr): unidad EXPLÍCITA. Internamente siempre kg; si se captura
  // en lb se convierte antes de dosificar. Sin auto-conversión por magnitud.
  const [unidadPeso, setUnidadPeso] = useState<UnidadPeso>('kg')
  const [pesoConfirmado, setPesoConfirmado] = useState(false)
  const [talla, setTalla] = useState('')
  /* C-014: la fecha es la del consultorio, no la del navegador en UTC — después
     de las 18:00 en México «hoy» en UTC ya es mañana y la edad en meses baila. */
  const mesesIniciales = fechaNacimiento
    ? String(edadEnMeses(fechaNacimiento, hoy ?? hoyDelConsultorio(zonaActiva())))
    : (edadAnios != null ? String(Math.round(edadAnios * 12)) : '')
  const [meses, setMeses] = useState(mesesIniciales)
  const [busca, setBusca] = useState('')
  /**
   * LA DOSIS QUE ELIGE EL MÉDICO DENTRO DEL RANGO — MP-008.
   * No se prescribe la máxima por omisión: el rango es el motor, la dosis es
   * suya. Sin un número dentro del rango, «Recetar» no se puede pulsar.
   */
  const [dosisElegida, setDosisElegida] = useState<Record<string, string>>({})

  // Peso SIEMPRE a kg (convierte si se capturó en lb). Revisión de seguridad de
  // unidad: si no es ok y no se confirmó, se BLOQUEA el cálculo y "Agregar a nota".
  const pesoKg = unidadPeso === 'lb' ? libraAKg(Number(peso)) : Number(peso)
  /* MP-006: contra el peso PREVIO (otra consulta), no contra el de hoy. */
  const revPeso = useMemo(() => pesoKg > 0 ? revisarPesoPediatrico(pesoKg, pesoPrevio) : { ok: true }, [pesoKg, pesoPrevio])
  const pesoBloqueado = pesoKg > 0 && !revPeso.ok && !pesoConfirmado
  // Cambiar el peso o la unidad exige volver a confirmar (no arrastrar un "confirmado" viejo).
  useEffect(() => { setPesoConfirmado(false) }, [peso, unidadPeso])
  const edadMeses = Number(meses)

  const dosis = useMemo(() => {
    if (!(pesoKg > 0) || pesoBloqueado) return []   // sin dosis hasta confirmar el peso
    const q = busca.trim().toLowerCase()
    const edad = meses !== '' && edadMeses >= 0 ? edadMeses : undefined
    return FARMACOS_PED
      .filter(f => !q || f.nombre.toLowerCase().includes(q))
      .map(f => calcularDosisPediatrica(f, pesoKg, edad))
      .filter(Boolean)
  }, [pesoKg, pesoBloqueado, busca, meses, edadMeses])

  const vacunas = useMemo(
    () => (edadMeses >= 0 && meses !== '' ? vacunasSegunEdad(edadMeses) : []),
    [edadMeses, meses],
  )
  const atrasadas = vacunas.filter(v => v.estado === 'atrasada')
  const indice = useMemo(() => (pesoKg > 0 && Number(talla) > 0 ? imc(pesoKg, Number(talla)) : null), [pesoKg, talla])

  // La referencia de la OMS solo cubre 0 a 60 meses; fuera de ahí no se evalúa.
  // Y es DISTINTA por sexo: si no se conoce el sexo (undefined/'Otro'), NO se evalúa
  // con la tabla de niño por defecto (antes lo hacía en silencio → z-score erróneo).
  const sexoConocido = !!sexo && /^(f|m)/i.test(sexo)
  const esNina = !!sexo && /^f/i.test(sexo)
  const crecimiento = useMemo(() => {
    if (!sexoConocido || meses === '' || edadMeses < 0 || edadMeses > 60) return []
    return evaluarTodo(edadMeses, esNina, {
      pesoKg: pesoKg > 0 ? pesoKg : undefined,
      tallaCm: Number(talla) > 0 ? Number(talla) : undefined,
      perimetroCm: Number(perimetro) > 0 ? Number(perimetro) : undefined,
    })
  }, [sexoConocido, meses, edadMeses, esNina, pesoKg, talla, perimetro])

  if (edadAnios != null && edadAnios >= 18) return null

  return (
    <div style={embebido ? {} : { border: '1px solid color-mix(in srgb, var(--purple) 30%, transparent)', borderRadius: 12, background: 'color-mix(in srgb, var(--purple) 5%, transparent)', padding: 14, marginBottom: 12 }}>
      {!embebido && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <Baby size={15} color="var(--purple)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>Pediatría</span>
          {atrasadas.length > 0 && (
            <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--amber) 15%, transparent)', color: 'var(--amber)' }}>
              verificar {atrasadas.length} vacuna{atrasadas.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Datos base */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)' }}>Peso</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input value={peso} onChange={e => setPeso(e.target.value)} inputMode="decimal"
              style={{ ...campoBase, width: 62 }} />
            <select value={unidadPeso} onChange={e => setUnidadPeso(e.target.value as UnidadPeso)}
              style={{ ...campoBase, width: 54, padding: '6px 4px' }} aria-label="Unidad de peso">
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </div>
          {unidadPeso === 'lb' && Number(peso) > 0 && <span style={{ fontSize: 10, color: 'var(--text3)' }}>= {pesoKg.toFixed(1)} kg</span>}
        </div>
        <Campo label="Talla (cm)" valor={talla} set={setTalla} />
        <Campo label="Edad (meses)" valor={meses} set={setMeses} />
        <Campo label="P. cefálico (cm)" valor={perimetro} set={setPerimetro} />
        {indice != null && Number.isFinite(indice) && (
          <div style={{ alignSelf: 'flex-end', fontSize: 11.5, color: 'var(--text2)', paddingBottom: 6 }}>
            IMC <b style={{ color: 'var(--text)' }}>{indice}</b>
            <span style={{ color: 'var(--text3)' }}> — interpretar por percentil para edad y sexo, no por cortes de adulto</span>
          </div>
        )}
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <Tab activo={tab === 'dosis'} onClick={() => setTab('dosis')} icono={<Pill size={13} />} texto="Dosis por peso" />
        <Tab activo={tab === 'vacunas'} onClick={() => setTab('vacunas')} icono={<Syringe size={13} />} texto="Vacunación" />
        <Tab activo={tab === 'crecimiento'} onClick={() => setTab('crecimiento')} icono={<TrendingUp size={13} />} texto="Crecimiento" />
      </div>

      {tab === 'dosis' && (
        <div>
          {!(pesoKg > 0) ? (
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Captura el peso para calcular las dosis.</p>
          ) : pesoBloqueado ? (
            /* L6.2 (decisión del Dr): hard-stop de UNIDAD. Mientras el peso no esté
               confirmado NO se calcula dosis ni se ofrece "Agregar a nota"; solo el
               porqué + un botón para confirmar. Nunca corrige el valor por su cuenta. */
            <div style={{ border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)', background: 'color-mix(in srgb, var(--red) 7%, transparent)', borderRadius: 9, padding: '11px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--red)', marginBottom: 3 }}>Verifica el peso antes de calcular</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                    {revPeso.motivo}
                    {fechaDelPesoPrevio && ` (la medición anterior es del ${fechaDelPesoPrevio}).`}
                  </div>
                  <button type="button" onClick={() => setPesoConfirmado(true)}
                    style={{ ...btnMini, marginTop: 9 }}>
                    Confirmar peso: {pesoKg.toFixed(1)} kg
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar fármaco…"
                style={{ ...campoBase, width: '100%', marginBottom: 8 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                {dosis.map(d => d && (
                  <div key={d.farmaco} style={{ border: '1px solid ' + (d.contraindicadoPorEdad ? 'color-mix(in srgb, var(--red) 40%, transparent)' : 'var(--border)'), borderRadius: 9, background: d.contraindicadoPorEdad ? 'color-mix(in srgb, var(--red) 7%, transparent)' : 'var(--s1)', padding: '9px 11px' }}>
                    {d.contraindicadoPorEdad ? (
                      /* Auditoría 2026-07 (P0): sin dosis ni botón de nota cuando el
                         fármaco no corresponde a la edad; solo el porqué. */
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <AlertTriangle size={14} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{d.farmaco} · </span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)' }}>NO CORRESPONDE A ESTA EDAD</span>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, lineHeight: 1.45 }}>{d.motivoEdad}</div>
                        </div>
                      </div>
                    ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{d.farmaco}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--purple)', fontWeight: 700 }}>
                        {d.porToma.min === d.porToma.max ? d.porToma.max : `${d.porToma.min}–${d.porToma.max}`} {d.unidad} {d.intervalo}
                      </span>
                      {d.esRescate ? (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>(rescate: por episodio, no dosis diaria fija)</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                          (total {d.porDia.min === d.porDia.max ? d.porDia.max : `${d.porDia.min}–${d.porDia.max}`} {d.unidad}/día)
                        </span>
                      )}
                      {d.topeAplicado && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--amber) 15%, transparent)', color: 'var(--amber)' }}>
                          <AlertTriangle size={11} /> tope de adulto
                        </span>
                      )}
                      {onAgregarANota && (
                        <button type="button" onClick={() => onAgregarANota(
                          `${d.farmaco} ${d.porToma.min === d.porToma.max ? d.porToma.max : `${d.porToma.min}-${d.porToma.max}`} ${d.unidad} ${d.intervalo} (peso ${pesoKg} kg).`
                        )} style={btnMini}><Plus size={12} /> Nota</button>
                      )}
                      {/*
                        ── DEL CÁLCULO A LA RECETA (MP-008) ──────────────────
                        «Nota» pega un RANGO en texto libre: no es una
                        prescripción, no llega a la receta ni al verificador de
                        dosis, y obliga a teclear lo mismo dos veces. Aquí se
                        elige UNA dosis dentro del rango —el médico, no el
                        panel— y se crea el renglón del medicamento.
                      */}
                      {onRecetar && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <input
                            aria-label={`Dosis por toma de ${d.farmaco} en ${d.unidad}`}
                            inputMode="decimal"
                            value={dosisElegida[d.farmaco] ?? ''}
                            onChange={e => setDosisElegida(p => ({ ...p, [d.farmaco]: e.target.value }))}
                            placeholder={d.porToma.min === d.porToma.max ? String(d.porToma.max) : `${d.porToma.min}–${d.porToma.max}`}
                            style={{ ...campoBase, width: 74 }}
                          />
                          <button
                            type="button"
                            disabled={!dentroDelRango(dosisElegida[d.farmaco], d.porToma)}
                            title={dentroDelRango(dosisElegida[d.farmaco], d.porToma)
                              ? `Agrega ${d.farmaco} a los medicamentos de esta consulta`
                              : `Escribe la dosis por toma entre ${d.porToma.min} y ${d.porToma.max} ${d.unidad}`}
                            onClick={() => {
                              const cantidad = Number(String(dosisElegida[d.farmaco]).replace(',', '.'))
                              onRecetar({
                                nombre: d.farmaco,
                                dosis: `${cantidad} ${d.unidad}`,
                                via: 'oral',
                                frecuencia: d.intervalo,
                                duracion: '',
                                procedenciaClinica: 'se_prescribe_hoy',
                                instruccionesEspeciales: `Dosis calculada por peso (${pesoKg} kg); rango del motor ${d.porToma.min}–${d.porToma.max} ${d.unidad} por toma.`,
                              })
                              setDosisElegida(p => ({ ...p, [d.farmaco]: '' }))
                            }}
                            style={{ ...btnMini, opacity: dentroDelRango(dosisElegida[d.farmaco], d.porToma) ? 1 : 0.45, cursor: dentroDelRango(dosisElegida[d.farmaco], d.porToma) ? 'pointer' : 'default' }}
                          ><ClipboardPlus size={12} /> Recetar</button>
                        </span>
                      )}
                    </div>
                    )}
                    {!d.contraindicadoPorEdad && d.nota && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.45 }}>{d.nota}</div>}
                  </div>
                ))}
                {dosis.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)' }}>Sin coincidencias.</p>}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'crecimiento' && (
        <div>
          {meses === '' ? (
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Captura la edad en meses.</p>
          ) : edadMeses > 60 ? (
            <p style={{ fontSize: 12, color: 'var(--amber)', margin: 0, lineHeight: 1.5 }}>
              Los estándares de crecimiento de la OMS que trae la app cubren de 0 a 60 meses (5 años).
              Para mayores de 5 años se usan otras referencias, que no están cargadas aquí.
            </p>
          ) : crecimiento.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Captura peso, talla o perímetro cefálico.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {crecimiento.map(r => (
                <div key={r.indicador} style={{
                  border: '1px solid ' + (r.nivel === 'normal' ? 'var(--border)' : r.nivel === 'bajo' ? 'color-mix(in srgb, var(--red) 35%, transparent)' : 'color-mix(in srgb, var(--amber) 35%, transparent)'),
                  background: r.nivel === 'normal' ? 'var(--s1)' : r.nivel === 'bajo' ? 'color-mix(in srgb, var(--red) 8%, transparent)' : 'color-mix(in srgb, var(--amber) 8%, transparent)',
                  borderRadius: 9, padding: '9px 11px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{r.indicador}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: r.nivel === 'normal' ? 'var(--green)' : r.nivel === 'bajo' ? 'var(--red)' : 'var(--amber)' }}>
                      z {r.z > 0 ? '+' : ''}{r.z} · percentil {r.percentil}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {r.valor} {r.unidad} · mediana esperada {r.mediana} {r.unidad}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 3 }}>{r.clasificacion}</div>
                </div>
              ))}
              {onAgregarANota && (
                <button type="button" style={{ ...btnMini, alignSelf: 'flex-start', marginTop: 4 }} onClick={() => onAgregarANota(
                  crecimiento.map(r => `${r.indicador}: ${r.valor} ${r.unidad} (z ${r.z > 0 ? '+' : ''}${r.z}, percentil ${r.percentil}) — ${r.clasificacion}`).join('. ')
                  + `. Referencia: ${crecimiento[0].fuente}.`
                )}><Plus size={12} /> Agregar a la nota</button>
              )}
              <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic', marginTop: 2 }}>
                {crecimiento[0].fuente}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'vacunas' && (
        <div>
          {meses === '' ? (
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>Captura la edad en meses para revisar el esquema.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 340, overflowY: 'auto' }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 3px', lineHeight: 1.45 }}>
                Esto es el <b>esquema que corresponde a la edad</b>, no el estado real del paciente:
                el expediente no guarda qué vacunas se aplicaron. Verifica la cartilla.{' '}
                {/* MI-003: el registro clasifica este motor como no revisado y hasta hoy
                    eso no salía en ninguna pantalla, aunque /cumplimiento/motores lo promete. */}
                <SelloMotor id="esquema-vacunacion-mx" />
              </p>
              {vacunas.map((v, i) => (
                <div key={i} style={{
                  border: '1px solid ' + (v.estado === 'atrasada' ? 'color-mix(in srgb, var(--red) 35%, transparent)' : 'var(--border)'),
                  background: v.estado === 'atrasada' ? 'color-mix(in srgb, var(--red) 8%, transparent)' : 'var(--s1)',
                  borderRadius: 9, padding: '8px 11px', opacity: v.estado === 'pendiente' ? 0.6 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{v.vacuna.nombre}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {v.vacuna.mes === 0 ? 'al nacer' : v.vacuna.mes < 24 ? `${v.vacuna.mes} meses` : `${v.vacuna.mes / 12} años`}
                    </span>
                    {v.estado === 'atrasada' && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'color-mix(in srgb, var(--amber) 15%, transparent)', color: 'var(--amber)' }}>CORRESPONDE POR EDAD</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, lineHeight: 1.45 }}>{v.vacuna.detalle}</div>
                </div>
              ))}
              {/* Auditoría 2026-07 (P1): la app NO tiene registro de qué se aplicó
                  (`vacunasSegunEdad` se llama sin `aplicadas`), así que TODA vacuna
                  con fecha pasada salía "ATRASADA" en todo paciente pediátrico. Se
                  dejó de afirmar un hecho clínico que nunca se verificó: ahora se
                  informa qué CORRESPONDE por edad y se remite a la cartilla. */}
              {onAgregarANota && atrasadas.length > 0 && (
                <button type="button" onClick={() => onAgregarANota(
                  `Por edad corresponden las siguientes vacunas del esquema nacional: ${atrasadas.map(a => `${a.vacuna.nombre} (${a.vacuna.mes} m)`).join(', ')}. Se verifica cartilla de vacunación para confirmar aplicaciones previas y regularizar lo que falte.`
                )} style={{ ...btnMini, alignSelf: 'flex-start', marginTop: 4 }}>
                  <Plus size={12} /> Agregar a la nota
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Campo({ label, valor, set }: { label: string; valor: string; set: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>{label}</span>
      <input type="number" inputMode="decimal" value={valor} onChange={e => set(e.target.value)}
        style={{ ...campoBase, width: 96 }} />
    </label>
  )
}

function Tab({ activo, onClick, icono, texto }: { activo: boolean; onClick: () => void; icono: React.ReactNode; texto: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7,
      fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
      border: '1px solid ' + (activo ? 'var(--purple)' : 'var(--border)'),
      background: activo ? 'var(--purple)' : 'var(--s2)', color: activo ? 'var(--sobre-aviso)' : 'var(--text3)',
    }}>{icono}{texto}</button>
  )
}

const campoBase: React.CSSProperties = {
  background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '5px 8px', fontSize: 12, color: 'var(--text)',
}
const btnMini: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, background: 'color-mix(in srgb, var(--purple) 15%, transparent)',
  color: 'var(--purple)', border: '1px solid color-mix(in srgb, var(--purple) 35%, transparent)', borderRadius: 6,
  padding: '3px 9px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
}

/**
 * ¿La dosis que tecleó el médico cae dentro del rango que calculó el motor?
 * Fuera de rango no se receta desde aquí: el rango es lo único que este panel
 * puede sostener (MP-008).
 */
function dentroDelRango(texto: string | undefined, rango: { min: number; max: number }): boolean {
  const n = Number(String(texto ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n >= rango.min && n <= rango.max
}
