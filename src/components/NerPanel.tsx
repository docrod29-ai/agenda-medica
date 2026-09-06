'use client'

/**
 * NerPanel — visualiza las entidades clínicas extraídas por NER.
 *
 * Jerarquía visual (lo más crítico arriba):
 *  1. 🚨 RIESGO_MAXIMO (alergia con anafilaxia + fármaco prescrito)
 *  2. ⚠️ Interacciones MAYORES / contraindicadas
 *  3. ⚠️ Otros avisos de riesgo menor (alergias cruzadas, interacciones moderadas)
 *  4. Listas de entidades por categoría (condiciones, medicamentos,
 *     procedimientos, estudios, alergias, anatomía)
 *
 * Las entidades son DE LECTURA — el médico edita la nota en el editor
 * principal. Este panel es referencia rápida + alerta de seguridad.
 */

import { useState } from 'react'
import type { EntidadesExtraidas } from '@/lib/expediente/medical-ner'
import { AlertTriangle, ShieldAlert, Pill, Stethoscope, TestTube, Scissors, X, Loader2, FlaskConical, Lightbulb, Bone } from 'lucide-react'

/** Lo que el motor determinista tuvo que corregir sobre la salida del modelo. */
export interface NegacionCorregida { texto: string; condicion: string; cita: string }

/**
 * Condiciones ACTIVAS que el dictado situó en el pasado.
 *
 * A diferencia de las negadas, éstas **no se tocaron**: pasar una condición a
 * «resuelto» porque la frase iba en pretérito sería una decisión clínica. Se
 * señalan, y decide el médico.
 */
export interface AvisoTemporal { texto: string; condicion: string; cita: string }

interface NerPanelProps {
  entidades: EntidadesExtraidas | null
  /**
   * Condiciones que el extractor dio por confirmadas y el paciente había NEGADO.
   *
   * Se enseñan a propósito. Una corrección silenciosa se ve en pantalla
   * exactamente igual que un extractor que acertó a la primera — y entonces
   * nadie se entera de que el modelo sigue cosechando términos de las preguntas
   * del interrogatorio.
   */
  negacionesCorregidas?: NegacionCorregida[]
  /** Lo que salió como activo y en el dictado iba en pasado. Ver `AvisoTemporal`. */
  avisosTemporales?: AvisoTemporal[]
  cargando?: boolean
  error?: string
  onCerrar?: () => void
}

export function NerPanel({ entidades, negacionesCorregidas, avisosTemporales, cargando, error, onCerrar }: NerPanelProps) {
  if (cargando) {
    return (
      <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--teal)' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Leyendo la nota…</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Buscando diagnósticos, fármacos, dosis, alergias e interacciones.</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 16, borderColor: 'color-mix(in srgb, var(--red) 50%, transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
          <AlertTriangle size={18} color="var(--red)" />
          <span style={{ fontWeight: 600 }}>No se pudo leer la nota.</span>
          <span style={{ color: 'var(--text2)' }}>Vuelve a intentarlo. {error && <span style={{ color: 'var(--text3)', fontSize: 12 }}>({error})</span>}</span>
          {onCerrar && (
            <button onClick={onCerrar} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
              <X size={14} /> Cerrar
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!entidades) return null

  const { conditions = [], medications = [], procedures = [], tests = [], allergies = [], anatomy = [], cross_check } = entidades
  const bloquea = (cross_check?.alergia_vs_medicamento ?? []).filter(c => c.RIESGO_MAXIMO)
  const cruzAlergias = (cross_check?.alergia_vs_medicamento ?? []).filter(c => !c.RIESGO_MAXIMO)
  const interaccionesGraves = (cross_check?.interacciones_farmacologicas ?? []).filter(i => i.severidad === 'mayor' || i.severidad === 'contraindicada')
  const interaccionesLeves = (cross_check?.interacciones_farmacologicas ?? []).filter(i => i.severidad === 'menor' || i.severidad === 'moderada')

  const totalEntidades = conditions.length + medications.length + procedures.length + tests.length + allergies.length + anatomy.length

  if (totalEntidades === 0 && !cross_check) {
    return (
      <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--text2)' }}>
        No se detectaron entidades clínicas en el texto. Intenta dictar más detalles.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* h2, no h3: en /consulta el único encabezado previo es el h1 del
            paciente — un h3 aquí saltaba un nivel (`heading-order`). Todas las
            secciones mayores del lienzo hablan h2. */}
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlaskConical size={15} className="ds-icon" /> Entidades clínicas <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>· {totalEntidades} elementos</span>
        </h2>
        {onCerrar && (
          <button onClick={onCerrar} className="btn btn-ghost btn-sm">
            <X size={14} /> Cerrar
          </button>
        )}
      </div>

      {/* ── 🚨 BLOQUEA RECETA ─────────────────────────────────────── */}
      {bloquea.map((c, i) => (
        <div key={`bloq-${i}`} style={{
          padding: 14, borderRadius: 10,
          background: 'color-mix(in srgb, var(--red) 10%, transparent)',
          border: '2px solid var(--red)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ShieldAlert size={20} color="var(--red)" />
            <strong style={{ color: 'var(--red)', fontSize: 14, letterSpacing: '0.02em' }}>RIESGO MÁXIMO — antecedente de anafilaxia</strong>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
            Paciente alérgico a <strong>{c.alergeno}</strong> + fármaco prescrito: <strong>{c.farmaco_riesgoso}</strong>
          </div>
          {/*
            Decir QUIÉN bloquea. La tarjeta decía «BLOQUEA RECETA» y no bloqueaba
            nada: el estado con las entidades no se lee en el guardado ni en la
            impresión. Lo que sí detiene la firma es la verificación NOM-004 con
            las alergias del expediente, que no depende de que se pulse este botón.
          */}
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
            Esto es lo que el modelo vio en el texto. La firma la detiene la verificación NOM-004
            con las alergias registradas en el expediente, aunque no abras este panel.
          </div>
          {/*
            ── LA PALABRA «SEGURA» LA PONÍA LA PANTALLA (ZC-002) ─────────────
            `alternativa_sugerida` la escribe el modelo de lenguaje: ningún motor
            determinista la cruza con las alergias del paciente. Llamarla
            «alternativa segura» es una afirmación de seguridad que nadie hizo.
            El campo se conserva —puede ahorrar tiempo— con el rótulo que le
            corresponde.
          */}
          {c.alternativa_sugerida && (
            <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 6, padding: '6px 10px', background: 'var(--s2)', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <Lightbulb size={13} className="ds-icon" color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Alternativa que propone el modelo, <b>sin verificar</b>: <strong>{c.alternativa_sugerida}</strong>.
                <span style={{ color: 'var(--text3)' }}> Si la recetas, la comprobación de alergias corre al escribirla en la lista de medicamentos.</span>
              </span>
            </div>
          )}
        </div>
      ))}

      {/* ── ⚠️ INTERACCIONES MAYORES / CONTRAINDICADAS ─────────────── */}
      {interaccionesGraves.map((i, idx) => (
        <div key={`int-${idx}`} style={{
          padding: 12, borderRadius: 10,
          background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
          border: '1px solid var(--amber)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <AlertTriangle size={16} color="var(--amber)" />
            <strong style={{ fontSize: 13, color: 'var(--amber)' }}>
              Interacción {i.severidad}: {i.farmaco_a} + {i.farmaco_b}
            </strong>
          </div>
          {i.mecanismo && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{i.mecanismo}</div>}
        </div>
      ))}

      {/* ── Cross-checks de menor severidad ─────────────────────── */}
      {(cruzAlergias.length > 0 || interaccionesLeves.length > 0) && (
        <details style={{ fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text2)', padding: '4px 0' }}>
            {cruzAlergias.length + interaccionesLeves.length} {cruzAlergias.length + interaccionesLeves.length === 1 ? 'aviso más' : 'avisos más'} de riesgo menor
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {cruzAlergias.map((c, i) => (
              <div key={i} style={{ padding: '8px 12px', background: 'var(--s2)', borderRadius: 6, fontSize: 12 }}>
                <strong>{c.alergeno}</strong> vs <strong>{c.farmaco_riesgoso}</strong> — riesgo {c.riesgo}
                {c.alternativa_sugerida && <div style={{ color: 'var(--text3)', marginTop: 2 }}>Alternativa que propone el modelo, sin verificar: {c.alternativa_sugerida}</div>}
              </div>
            ))}
            {interaccionesLeves.map((i, idx) => (
              <div key={idx} style={{ padding: '8px 12px', background: 'var(--s2)', borderRadius: 6, fontSize: 12 }}>
                {i.farmaco_a} + {i.farmaco_b} — {i.severidad}
                {i.mecanismo && <span style={{ color: 'var(--text3)' }}> · {i.mecanismo}</span>}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── LO QUE SE CORRIGIÓ POR NEGACIÓN ────────────────────── */}
      {(negacionesCorregidas?.length ?? 0) > 0 && (
        <div style={{
          padding: '10px 12px', borderRadius: 8, marginBottom: 10, fontSize: 12.5, lineHeight: 1.55,
          color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
        }}>
          <b>{negacionesCorregidas!.length === 1
            ? 'Se reclasificó 1 diagnóstico: el paciente lo negó.'
            : `Se reclasificaron ${negacionesCorregidas!.length} diagnósticos: el paciente los negó.`}</b>
          <div style={{ marginTop: 4 }}>
            {negacionesCorregidas!.map((n, i) => (
              <div key={`${n.condicion}-${i}`}>«{n.texto}» → descartada. En el dictado: {n.cita}</div>
            ))}
          </div>
          <div style={{ marginTop: 4, opacity: .9 }}>
            No se borraron: negar una enfermedad es información clínica (negativo pertinente).
          </div>
        </div>
      )}

      {/* ── LO QUE VENÍA EN PASADO Y SALIÓ COMO ACTIVO ─────────── */}
      {(avisosTemporales?.length ?? 0) > 0 && (
        <div style={{
          padding: '10px 12px', borderRadius: 8, marginBottom: 10, fontSize: 12.5, lineHeight: 1.55,
          color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
        }}>
          <b>{avisosTemporales!.length === 1
            ? '1 diagnóstico sale como activo y en el dictado se dijo en pasado.'
            : `${avisosTemporales!.length} diagnósticos salen como activos y en el dictado se dijeron en pasado.`}</b>
          <div style={{ marginTop: 4 }}>
            {avisosTemporales!.map((a, i) => (
              <div key={`${a.condicion}-${i}`}>«{a.texto}» · en el dictado: {a.cita}</div>
            ))}
          </div>
          <div style={{ marginTop: 4, opacity: .9 }}>
            No se cambiaron: decidir que están resueltas sería una decisión clínica, no de la pantalla.
          </div>
        </div>
      )}

      {/* ── CONDICIONES ────────────────────────────────────────── */}
      {conditions.length > 0 && (
        <Seccion icono={<Stethoscope size={14} />} titulo={`Diagnósticos / condiciones · ${conditions.length}`}>
          {conditions.map((c, i) => (
            <ChipConCita key={i} estilo={chipStyle(c.certeza === 'descartado' ? 'gris' : c.certeza === 'sospecha' ? 'ambar' : 'teal')} cita={c.source_quote}>
              {c.texto}
              {c.cie10 && <code style={codeStyle}>{c.cie10}</code>}
              {c.estado && c.estado !== 'activo' && <em style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>· {c.estado}</em>}
              {c.severidad && <em style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>· {c.severidad}</em>}
            </ChipConCita>
          ))}
        </Seccion>
      )}

      {/* ── MEDICAMENTOS ──────────────────────────────────────── */}
      {medications.length > 0 && (
        <Seccion icono={<Pill size={14} />} titulo={`Medicamentos · ${medications.length}`}>
          {medications.map((m, i) => (
            <div key={i} style={cardChipStyle}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {m.generico || m.texto}
                {m.marca && <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11, marginLeft: 6 }}>({m.marca})</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {[
                  m.dosis && `${m.dosis}${m.unidad_dosis || ''}`,
                  m.via !== 'desconocida' && m.via?.toUpperCase(),
                  m.intervalo,
                  m.duracion && `× ${m.duracion}`,
                ].filter(Boolean).join(' · ') || 'Sin posología detallada'}
              </div>
              {m.necesita_ajuste && m.necesita_ajuste !== 'no' && (
                <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={11} className="ds-icon" /> Verificar ajuste por función {m.necesita_ajuste === 'renal' ? 'renal' : m.necesita_ajuste === 'hepatico' ? 'hepática' : 'peso'}
                </div>
              )}
              {m.indicacion && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  Indicación: {m.indicacion}
                </div>
              )}
              <ProcedenciaDeLaEntidad cita={m.source_quote} />
            </div>
          ))}
        </Seccion>
      )}

      {/* ── ALERGIAS ──────────────────────────────────────────── */}
      {allergies.length > 0 && (
        <Seccion icono={<AlertTriangle size={14} />} titulo={`Alergias · ${allergies.length}`}>
          {allergies.map((a, i) => (
            <ChipConCita key={i} estilo={chipStyle(a.severidad === 'anafilaxia' || a.severidad === 'grave' ? 'rojo' : 'ambar')} cita={a.source_quote}>
              {a.alergeno}
              {a.reaccion && <em style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>· {a.reaccion}</em>}
              {a.severidad && a.severidad !== 'desconocida' && <em style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>· {a.severidad}</em>}
            </ChipConCita>
          ))}
        </Seccion>
      )}

      {/* ── ESTUDIOS ──────────────────────────────────────────── */}
      {tests.length > 0 && (
        <Seccion icono={<TestTube size={14} />} titulo={`Estudios paraclínicos · ${tests.length}`}>
          {tests.map((t, i) => (
            <ChipConCita key={i} estilo={chipStyle(t.anormal ? 'rojo' : 'gris')} cita={t.source_quote}>
              {t.texto}
              {t.valor && <strong style={{ marginLeft: 4 }}>· {t.valor}{t.unidad ? ' ' + t.unidad : ''}</strong>}
              {t.anormal && <em style={{ marginLeft: 4, fontSize: 10, color: 'var(--red)' }}>· anormal</em>}
            </ChipConCita>
          ))}
        </Seccion>
      )}

      {/* ── PROCEDIMIENTOS ────────────────────────────────────── */}
      {procedures.length > 0 && (
        <Seccion icono={<Scissors size={14} />} titulo={`Procedimientos · ${procedures.length}`}>
          {procedures.map((p, i) => (
            <ChipConCita key={i} estilo={chipStyle('teal')} cita={p.source_quote}>
              {p.texto}
              {p.lateralidad && p.lateralidad !== 'no_aplica' && <em style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>· {p.lateralidad}</em>}
              {p.fecha && <em style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>· {p.fecha}</em>}
            </ChipConCita>
          ))}
        </Seccion>
      )}

      {/* ── ANATOMÍA ──────────────────────────────────────────── */}
      {anatomy.length > 0 && (
        <Seccion icono={<Bone size={14} />} titulo={`Regiones anatómicas · ${anatomy.length}`}>
          {anatomy.map((a, i) => (
            <ChipConCita key={i} estilo={chipStyle('gris')} cita={a.source_quote}>
              {a.texto}
              {a.region && <em style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>· {a.region}</em>}
            </ChipConCita>
          ))}
        </Seccion>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Helpers visuales
// ─────────────────────────────────────────────────────────────────

/**
 * ── DE DÓNDE SALIÓ ESTO, ALCANZABLE (ZC-017) ────────────────────────────────
 *
 * La cita del dictado vivía SÓLO en el atributo `title` de un `<span>`: en el
 * teléfono no hay puntero que la muestre y con teclado no hay forma de llegar.
 * PROCEDENCIA es uno de los dos principios propios de este producto
 * (`design-system.md`) y estaba dependiendo de un tooltip.
 *
 * Ahora el chip es un `<button>` —focalizable, pulsable, anunciable— que abre
 * la cita en el DOM. Sin cita no hay botón: no se ofrece algo que no se puede
 * enseñar.
 */
function ChipConCita({ estilo, cita, children }: { estilo: React.CSSProperties; cita?: string; children: React.ReactNode }) {
  const [abierta, setAbierta] = useState(false)
  if (!cita) return <span style={estilo}>{children}</span>
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
      <button
        type="button"
        onClick={() => setAbierta(a => !a)}
        aria-expanded={abierta}
        title="Ver de dónde salió esto en el dictado"
        style={{ ...estilo, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
      >
        {children}
      </button>
      {abierta && (
        <span style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.45, maxWidth: 320 }}>
          En el dictado: «{cita}»
        </span>
      )}
    </span>
  )
}

/** La misma procedencia, para las tarjetas de medicamento (que no son chips). */
function ProcedenciaDeLaEntidad({ cita }: { cita?: string }) {
  const [abierta, setAbierta] = useState(false)
  if (!cita) return null
  return (
    <div style={{ marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setAbierta(a => !a)}
        aria-expanded={abierta}
        style={{ background: 'none', border: 'none', padding: 0, fontSize: 10.5, fontWeight: 600, color: 'var(--nexus)', cursor: 'pointer', textDecoration: 'underline' }}
      >
        {abierta ? 'Ocultar de dónde salió' : 'De dónde salió'}
      </button>
      {abierta && (
        <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.45 }}>En el dictado: «{cita}»</div>
      )}
    </div>
  )
}

function Seccion({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icono}
        {titulo}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  )
}

type ChipColor = 'teal' | 'ambar' | 'rojo' | 'gris'
function chipStyle(color: ChipColor): React.CSSProperties {
  const palette: Record<ChipColor, { bg: string; border: string; text: string }> = {
    teal:  { bg: 'var(--nexus-soft)',  border: 'var(--nexus-borde)',  text: 'var(--text)' },
    ambar: { bg: 'color-mix(in srgb, var(--amber) 10%, transparent)',  border: 'color-mix(in srgb, var(--amber) 40%, transparent)',  text: 'var(--text)' },
    rojo:  { bg: 'color-mix(in srgb, var(--red) 10%, transparent)',  border: 'color-mix(in srgb, var(--red) 40%, transparent)',  text: 'var(--text)' },
    gris:  { bg: 'var(--s2)',                 border: 'var(--border2)',           text: 'var(--text2)' },
  }
  const p = palette[color]
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 10px',
    borderRadius: 6,
    background: p.bg,
    border: `1px solid ${p.border}`,
    color: p.text,
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'help',
  }
}

const codeStyle: React.CSSProperties = {
  marginLeft: 6,
  padding: '1px 5px',
  background: 'var(--s3)',
  borderRadius: 4,
  fontFamily: 'var(--font-mono), monospace',
  fontSize: 11,
  color: 'var(--text2)',
}

const cardChipStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: 'var(--s2)',
  border: '1px solid var(--border2)',
  borderRadius: 8,
  flex: '1 1 240px',
  minWidth: 240,
}
