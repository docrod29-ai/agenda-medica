'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { useToast } from '@/context/ToastContext'
import { auth } from '@/lib/firebase'
import { getPatients } from '@/lib/firestore'
import { useGrabacionVoz } from '@/hooks/useGrabacionVoz'
import {
  createNota, updateNota, getNota, deleteNota, getUltimasNotasResumen,
} from '@/lib/expediente/firestore'
import { seccionesVacias, requiereSignosVitales, esPreoperatoria } from '@/lib/expediente/templates'
import { PreopAssessment } from '@/components/PreopAssessment'
import { RevisionPanel } from '@/components/RevisionPanel'
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { logAudit } from '@/lib/expediente/audit-log'
import { validarNOM004 } from '@/lib/expediente/nom004'
import { generarHashIntegridad, generarHashFirma } from '@/lib/expediente/integrity'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import type { TipoNota, NotaMedica, NotaSeccion, Diagnostico, Medicamento, SignosVitales } from '@/types/expediente'
import type { Patient } from '@/types'
import {
  ArrowLeft, Mic, Square, Sparkles, Loader2, AlertTriangle, CheckCircle2,
  Trash2, Plus, ShieldCheck, Pill, Stethoscope, FileSignature,
} from 'lucide-react'

const TIPOS: TipoNota[] = ['primera_vez', 'seguimiento', 'historia_clinica', 'valoracion_preoperatoria', 'alta_consulta', 'ingreso', 'evolucion', 'egreso']

export default function ConsultaActivaPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const notaIdParam = searchParams.get('nota')
  const { clinicId } = useClinic()
  const { config } = useConfig()
  const { toast } = useToast()
  const voz = useGrabacionVoz()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [tipo, setTipo] = useState<TipoNota>('primera_vez')
  const [secciones, setSecciones] = useState<NotaSeccion[]>(seccionesVacias('primera_vez'))
  const [signos, setSignos] = useState<SignosVitales>({})
  const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([])
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [resumen, setResumen] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [firmada, setFirmada] = useState(false)
  const [notaId, setNotaId] = useState<string | null>(notaIdParam)
  const [preop, setPreop] = useState<{ inputs: Record<string, unknown>; resultados: Record<string, unknown> } | undefined>(undefined)
  // Fase B: bloque auditable de la IA + aprobaciones por campo
  const [extraction, setExtraction] = useState<Record<string, unknown> | undefined>(undefined)
  const [safety, setSafety] = useState<Record<string, unknown> | undefined>(undefined)
  const [aprobados, setAprobados] = useState<Set<string>>(new Set())
  // Fase C: consentimiento del paciente antes de iniciar grabación
  const [consentimiento, setConsentimiento] = useState(false)
  const [modalConsentimiento, setModalConsentimiento] = useState(false)
  const ultimasNotasRef = useRef('')

  const iniciarGrabacion = () => {
    if (consentimiento) { voz.iniciar(); return }
    setModalConsentimiento(true)
  }
  const confirmarConsentimiento = () => {
    setConsentimiento(true)
    setModalConsentimiento(false)
    voz.iniciar()
  }

  // ── Cargar paciente + contexto IA ──────────────────────────────
  useEffect(() => {
    if (!clinicId || !patientId) return
    getPatients(clinicId).then(ps => setPatient(ps.find(p => p.id === patientId) ?? null))
    getUltimasNotasResumen(clinicId, patientId).then(r => { ultimasNotasRef.current = r })
  }, [clinicId, patientId])

  // ── Cargar nota existente (borrador) si viene ?nota= ───────────
  useEffect(() => {
    if (!clinicId || !patientId || !notaIdParam) return
    getNota(clinicId, patientId, notaIdParam).then(n => {
      if (!n) return
      setTipo(n.tipo)
      setSecciones(n.secciones)
      setSignos(n.signosVitales ?? {})
      setDiagnosticos(n.diagnosticos)
      setMedicamentos(n.medicamentos)
      setResumen(n.resumenEjecutivo ?? '')
      setFirmada(n.estado === 'firmada')
      if (n.preop) setPreop(n.preop)
      if (n.iaAuditoria) {
        if (n.iaAuditoria.extraction) setExtraction(n.iaAuditoria.extraction)
        if (n.iaAuditoria.safety) setSafety(n.iaAuditoria.safety)
        if (Array.isArray(n.iaAuditoria.aprobadosPorMedico)) setAprobados(new Set(n.iaAuditoria.aprobadosPorMedico))
      }
      if (n.transcripcionCruda) voz.setTranscripcion(n.transcripcionCruda)
    })
  }, [clinicId, patientId, notaIdParam]) // eslint-disable-line

  // ── Cambiar tipo de nota → reset de secciones ──────────────────
  const cambiarTipo = (t: TipoNota) => {
    setTipo(t)
    setSecciones(seccionesVacias(t))
  }

  // ── Procesar transcripción con IA ──────────────────────────────
  const procesarIA = useCallback(async () => {
    if (!voz.transcripcion.trim()) { toast('No hay transcripción que procesar', 'info'); return }
    setProcesando(true)
    try {
      const res = await fetch('/api/expediente/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripcion: voz.transcripcion,
          tipo,
          contexto: {
            nombre: patient?.nombre ?? '',
            edad: patient?.edad,
            sexo: patient?.sexo,
            alergias: patient?.alergias,
            notasPrevias: ultimasNotasRef.current,
          },
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        toast(data.error === 'ANTHROPIC_API_KEY no configurada en el servidor'
          ? 'Falta configurar la API key de Claude en Vercel'
          : `Error de IA: ${data.error}`, 'error')
        return
      }
      // Mapear respuesta a estado
      setResumen(data.resumenEjecutivo ?? '')
      setSecciones(prev => prev.map(s => ({ ...s, value: data.secciones?.[s.key] ?? s.value })))
      if (Array.isArray(data.diagnosticos)) setDiagnosticos(data.diagnosticos.filter((d: Diagnostico) => d.descripcion))
      if (Array.isArray(data.medicamentos)) setMedicamentos(data.medicamentos.filter((m: Medicamento) => m.nombre))
      if (data.signosVitales) {
        const sv = data.signosVitales
        setSignos({
          fc: sv.fc || undefined, fr: sv.fr || undefined, ta: sv.ta || undefined,
          temperatura: sv.temperatura || undefined, spo2: sv.spo2 || undefined,
          peso: sv.peso || undefined, talla: sv.talla || undefined,
        })
      }

      // Bloque auditable (Fase B): guardamos extraction + safety para el panel de revisión
      if (data.extraction) setExtraction(data.extraction)
      if (data.safety) setSafety(data.safety)
      setAprobados(new Set()) // reset de aprobaciones al nuevo procesamiento

      // Auditoría (Fase F)
      if (clinicId) logAudit({
        evento: 'ia_procesamiento', clinicId, patientId, notaId: notaId ?? undefined,
        medicoUid: auth.currentUser?.uid, medicoEmail: auth.currentUser?.email ?? undefined,
        meta: { tipo, transcripcionLen: voz.transcripcion.length },
      })

      toast('✨ Nota estructurada por IA — revisa campo por campo', 'success')
    } catch {
      toast('Error al conectar con la IA', 'error')
    } finally {
      setProcesando(false)
    }
  }, [voz.transcripcion, tipo, patient, toast])

  // ── Construir objeto NotaMedica ────────────────────────────────
  const construirNota = useCallback((estado: 'borrador' | 'firmada'): NotaMedica => {
    const now = new Date().toISOString()
    return {
      id: notaId ?? '',
      clinicId: clinicId!,
      pacienteId: patientId,
      pacienteNombre: patient?.nombre ?? '',
      tipo,
      metadata: {
        id: notaId ?? crypto.randomUUID(),
        tipoNota: tipo,
        clinicId: clinicId!,
        pacienteId: patientId,
        medicoId: auth.currentUser?.uid ?? '',
        cedulaProfesional: config?.cedulaProfesional ?? '',
        especialidad: config?.especialidad ?? '',
        establecimiento: config?.nombreClinica ?? '',
        fechaCreacion: now,
        fechaModificacion: now,
        hashIntegridad: '',
        version: 1,
        estado,
        fuenteGeneracion: voz.transcripcion ? 'ia_voz' : 'manual',
      },
      resumenEjecutivo: resumen,
      secciones,
      signosVitales: signos,
      diagnosticos,
      medicamentos,
      alergias: patient?.alergias
        ? [{ alergeno: patient.alergias, tipo: 'medicamento', reaccion: 'Ver expediente', severidad: 'moderada', confirmada: true }]
        : [],
      preop,
      iaAuditoria: extraction || safety ? {
        extraction, safety,
        aprobadosPorMedico: Array.from(aprobados),
        procesadoEn: now,
        aprobadoPor: estado === 'firmada' ? (auth.currentUser?.email ?? '') : undefined,
      } : undefined,
      transcripcionCruda: voz.transcripcion || undefined,
      estado,
      fechaConsulta: now,
      createdAt: now,
      updatedAt: now,
      creadoPor: auth.currentUser?.uid ?? '',
    }
  }, [notaId, clinicId, patientId, patient, tipo, config, resumen, secciones, signos, diagnosticos, medicamentos, preop, extraction, safety, aprobados, voz.transcripcion])

  // ── Guardar borrador ───────────────────────────────────────────
  // silencioso=true para el autoguardado (no muestra toast)
  const guardarBorrador = useCallback(async (silencioso = false) => {
    if (!clinicId || firmada) return
    setGuardando(true)
    try {
      const nota = construirNota('borrador')
      if (notaId) {
        await updateNota(clinicId, patientId, notaId, nota)
      } else {
        const id = await createNota(clinicId, patientId, nota)
        setNotaId(id)
      }
      if (!silencioso) toast('Borrador guardado', 'success')
    } catch (e) {
      console.error('[consulta] error guardando borrador:', e)
      if (!silencioso) toast('Error al guardar el borrador', 'error')
    } finally {
      setGuardando(false)
    }
  }, [clinicId, patientId, notaId, firmada, construirNota, toast])

  // ── Descartar borrador ─────────────────────────────────────────
  const descartar = useCallback(async () => {
    if (firmada) return
    const confirmar = window.confirm('¿Descartar esta consulta? Se eliminará y no podrás recuperarla.')
    if (!confirmar) return
    setGuardando(true)
    try {
      if (clinicId && notaId) {
        await deleteNota(clinicId, patientId, notaId)
      }
      toast('Consulta descartada', 'info')
      router.push(`/expediente/${patientId}`)
    } catch (e) {
      console.error('[consulta] error al descartar:', e)
      toast('Error al descartar', 'error')
      setGuardando(false)
    }
  }, [firmada, clinicId, notaId, patientId, router, toast])

  // ── Autoguardado cada 30s ──────────────────────────────────────
  useEffect(() => {
    if (firmada) return
    const t = setInterval(() => { if (resumen || secciones.some(s => s.value)) guardarBorrador(true) }, 30000)
    return () => clearInterval(t)
  }, [firmada, resumen, secciones, guardarBorrador])

  // ── Firmar nota (NOM-004 + NOM-024) ────────────────────────────
  const firmar = useCallback(async () => {
    if (!clinicId) return
    const notaParaValidar = construirNota('firmada')
    const val = validarNOM004(notaParaValidar)
    if (!val.valida) {
      toast(`No se puede firmar: ${val.errores[0]}`, 'error')
      return
    }
    if (!config?.cedulaProfesional) {
      toast('Agrega tu cédula profesional en Configuración → General', 'error')
      return
    }
    setGuardando(true)
    try {
      const now = new Date().toISOString()
      const hashIntegridad = await generarHashIntegridad(notaParaValidar)
      const medicoId = auth.currentUser?.uid ?? ''
      const hashFirma = await generarHashFirma(notaParaValidar.metadata.id, medicoId, now)

      const notaFirmada: NotaMedica = {
        ...notaParaValidar,
        metadata: { ...notaParaValidar.metadata, hashIntegridad, fechaModificacion: now },
        firma: {
          nombreMedico: config.nombreMedico,
          cedulaProfesional: config.cedulaProfesional,
          especialidad: config.especialidad ?? '',
          institucion: config.nombreClinica,
          timestamp: now,
          hashFirma,
        },
      }

      let id = notaId
      if (id) {
        await updateNota(clinicId, patientId, id, notaFirmada)
      } else {
        id = await createNota(clinicId, patientId, notaFirmada)
        setNotaId(id)
      }
      setFirmada(true)
      toast('✅ Nota firmada y sellada (NOM-024)', 'success')
      // Auditoría (Fase F)
      if (clinicId) logAudit({
        evento: 'nota_firmada', clinicId, patientId, notaId: id,
        medicoUid: auth.currentUser?.uid, medicoEmail: auth.currentUser?.email ?? undefined,
        meta: { tipo, aprobadosIA: aprobados.size, diagnosticos: diagnosticos.length, medicamentos: medicamentos.length },
      })
      setTimeout(() => router.push(`/expediente/${patientId}`), 1200)
    } catch (e) {
      toast('Error al firmar', 'error')
    } finally {
      setGuardando(false)
    }
  }, [clinicId, patientId, notaId, config, construirNota, router, toast])

  // ── Atajos de teclado ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'r') { e.preventDefault(); voz.grabando ? voz.detener() : iniciarGrabacion() }
      if (e.key === 'p') { e.preventDefault(); procesarIA() }
      if (e.key === 'Enter') { e.preventDefault(); firmar() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [voz, procesarIA, firmar])

  const validacion = validarNOM004(construirNota('borrador'))
  const mmss = `${String(Math.floor(voz.duracion / 60)).padStart(2, '0')}:${String(voz.duracion % 60).padStart(2, '0')}`

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <button onClick={() => router.push(`/expediente/${patientId}`)} style={S.back}>
        <ArrowLeft size={15} /> Expediente
      </button>

      {/* Alergias banner permanente */}
      {patient?.alergias && (
        <div style={S.alergia}>
          <AlertTriangle size={16} /> <strong>ALERGIA:</strong> {patient.alergias}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{patient?.nombre ?? 'Consulta'}</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
            {patient?.edad ? `${patient.edad} años` : ''}{patient?.sexo ? ` · ${patient.sexo}` : ''} · {TIPO_NOTA_LABEL[tipo]}
          </div>
        </div>
        {firmada && <span style={S.firmadaBadge}><CheckCircle2 size={14} /> Nota firmada</span>}
      </div>

      {/* Selector tipo de nota */}
      {!firmada && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          {TIPOS.map(t => (
            <button key={t} onClick={() => cambiarTipo(t)} style={S.chip(tipo === t)}>{TIPO_NOTA_LABEL[t]}</button>
          ))}
        </div>
      )}

      {/* ── Grabación ── */}
      {!firmada && (
        <div style={S.grabCard}>
          {!voz.soportado ? (
            <div style={{ fontSize: 13, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} /> Tu navegador no soporta dictado por voz. Usa Chrome o Edge, o escribe la nota manualmente abajo.
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <button
                onClick={() => voz.grabando ? voz.detener() : iniciarGrabacion()}
                style={{
                  width: 64, height: 64, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: voz.grabando ? '#ef4444' : 'var(--teal)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: voz.grabando ? 'pulse 1.5s infinite' : 'none',
                }}
              >
                {voz.grabando ? <Square size={24} color="#fff" fill="#fff" /> : <Mic size={26} color="#000" />}
              </button>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  {voz.grabando ? `🔴 Grabando · ${mmss}` : 'Grabar consulta'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Ctrl/Cmd+R grabar · Ctrl/Cmd+P procesar IA · Ctrl/Cmd+Enter firmar
                </div>
              </div>
              <button onClick={procesarIA} disabled={procesando || !voz.transcripcion.trim()} style={S.iaBtn(procesando || !voz.transcripcion.trim())}>
                {procesando ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Claude estructurando…</> : <><Sparkles size={16} /> Procesar con IA</>}
              </button>
            </div>
          )}

          {/* Transcripción en vivo / editable */}
          {(voz.transcripcion || voz.grabando) && (
            <textarea
              value={voz.transcripcion + (voz.interim ? ` ${voz.interim}` : '')}
              onChange={e => voz.setTranscripcion(e.target.value)}
              placeholder="La transcripción aparecerá aquí…"
              style={S.transcripcion}
            />
          )}
        </div>
      )}

      {/* ── Resumen ejecutivo ── */}
      {resumen && (
        <div style={S.resumen}>
          <Sparkles size={14} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: 'var(--text)', fontStyle: 'italic' }}>{resumen}</span>
        </div>
      )}

      {/* ── Alertas clínicas cruzadas (Fase C) ── */}
      {(() => {
        const alergiasPaciente = patient?.alergias
          ? [{ alergeno: patient.alergias, reaccion: '' }]
          : []
        const alertas = validarAlergiasVsMedicamentos(alergiasPaciente, medicamentos)
        if (alertas.length === 0) return null
        return (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>
              ⚠️ Alertas clínicas detectadas
            </div>
            {alertas.map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 4 }}>
                <strong style={{ color: a.severidad === 'critica' ? '#f87171' : '#f59e0b' }}>
                  [{a.severidad.toUpperCase()}]
                </strong> {a.mensaje}
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── Panel de revisión IA (Fase B) ── */}
      {(extraction || safety) && !firmada && (
        <RevisionPanel
          extraction={extraction as Parameters<typeof RevisionPanel>[0]['extraction']}
          safety={safety as Parameters<typeof RevisionPanel>[0]['safety']}
          aprobados={aprobados}
          onAprobar={id => setAprobados(prev => new Set(prev).add(id))}
          onRechazar={id => setAprobados(prev => { const n = new Set(prev); n.delete(id); return n })}
        />
      )}

      {/* ── Signos vitales ── */}
      {requiereSignosVitales(tipo) && (
        <Section title="Signos vitales" icon={<Stethoscope size={15} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10 }}>
            {([['ta', 'TA', '120/80'], ['fc', 'FC', 'lpm'], ['fr', 'FR', 'rpm'], ['temperatura', 'T°', '°C'], ['spo2', 'SpO₂', '%'], ['peso', 'Peso', 'kg'], ['talla', 'Talla', 'cm']] as const).map(([k, label, ph]) => (
              <div key={k}>
                <label style={S.miniLabel}>{label}</label>
                <input
                  value={(signos[k] as string | number | undefined) ?? ''}
                  onChange={e => setSignos(s => ({ ...s, [k]: k === 'ta' ? e.target.value : (e.target.value ? Number(e.target.value) : undefined) }))}
                  placeholder={ph} disabled={firmada} style={S.miniInput}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Calculadoras de valoración preoperatoria ── */}
      {esPreoperatoria(tipo) && (
        <PreopAssessment
          edadPaciente={patient?.edad}
          disabled={firmada}
          initialInputs={preop?.inputs}
          onAplicar={(conclusion, recomendaciones, preopData) => {
            setPreop(preopData)
            setSecciones(prev => prev.map(s => {
              if (s.key === 'conclusionRiesgo') return { ...s, value: conclusion }
              if (s.key === 'recomendaciones') return { ...s, value: recomendaciones }
              return s
            }))
            toast('Escalas aplicadas a la nota', 'success')
          }}
        />
      )}

      {/* ── Secciones narrativas ── */}
      {secciones.map((s, i) => (
        <Section key={s.key} title={s.label} obligatorio={s.obligatorio}>
          <textarea
            value={s.value}
            onChange={e => setSecciones(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
            placeholder={s.placeholder ?? ''}
            disabled={firmada}
            style={S.textarea}
          />
        </Section>
      ))}

      {/* ── Diagnósticos ── */}
      <Section title="Diagnósticos" icon={<ShieldCheck size={15} />}>
        {diagnosticos.map((d, i) => (
          <div key={i} style={S.row}>
            <input value={d.descripcion} disabled={firmada} placeholder="Diagnóstico"
              onChange={e => setDiagnosticos(prev => prev.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))}
              style={{ ...S.input, flex: 3 }} />
            <input value={d.codigoCIE10 ?? ''} disabled={firmada} placeholder="CIE-10"
              onChange={e => setDiagnosticos(prev => prev.map((x, j) => j === i ? { ...x, codigoCIE10: e.target.value } : x))}
              style={{ ...S.input, flex: 1 }} />
            {!firmada && <button onClick={() => setDiagnosticos(prev => prev.filter((_, j) => j !== i))} style={S.del}><Trash2 size={14} /></button>}
          </div>
        ))}
        {!firmada && (
          <button onClick={() => setDiagnosticos(prev => [...prev, { descripcion: '', tipo: 'presuntivo', estado: 'activo' }])} style={S.addBtn}>
            <Plus size={13} /> Agregar diagnóstico
          </button>
        )}
      </Section>

      {/* ── Medicamentos ── */}
      <Section title="Medicamentos / Plan farmacológico" icon={<Pill size={15} />}>
        {medicamentos.map((m, i) => (
          <div key={i} style={{ ...S.row, flexWrap: 'wrap' }}>
            <input value={m.nombre} disabled={firmada} placeholder="Medicamento"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))}
              style={{ ...S.input, flex: 2, minWidth: 120 }} />
            <input value={m.dosis} disabled={firmada} placeholder="Dosis"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, dosis: e.target.value } : x))}
              style={{ ...S.input, flex: 1, minWidth: 70 }} />
            <input value={m.frecuencia} disabled={firmada} placeholder="Frecuencia"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, frecuencia: e.target.value } : x))}
              style={{ ...S.input, flex: 1, minWidth: 90 }} />
            <input value={m.duracion} disabled={firmada} placeholder="Duración"
              onChange={e => setMedicamentos(prev => prev.map((x, j) => j === i ? { ...x, duracion: e.target.value } : x))}
              style={{ ...S.input, flex: 1, minWidth: 80 }} />
            {!firmada && <button onClick={() => setMedicamentos(prev => prev.filter((_, j) => j !== i))} style={S.del}><Trash2 size={14} /></button>}
          </div>
        ))}
        {!firmada && (
          <button onClick={() => setMedicamentos(prev => [...prev, { nombre: '', dosis: '', via: 'oral', frecuencia: '', duracion: '' }])} style={S.addBtn}>
            <Plus size={13} /> Agregar medicamento
          </button>
        )}
      </Section>

      {/* ── Validación + Acciones ── */}
      {!firmada && (
        <>
          {validacion.errores.length > 0 && (
            <div style={S.valBox('error')}>
              {validacion.errores.map((e, i) => <div key={i} style={{ display: 'flex', gap: 6 }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {e}</div>)}
            </div>
          )}
          {validacion.advertencias.length > 0 && (
            <div style={S.valBox('warn')}>
              {validacion.advertencias.map((a, i) => <div key={i} style={{ display: 'flex', gap: 6 }}>⚠️ {a}</div>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={firmar} disabled={!validacion.valida || guardando} style={S.firmar(!validacion.valida || guardando)}>
              <FileSignature size={17} /> Firmar y cerrar nota
            </button>
            <button onClick={() => guardarBorrador()} disabled={guardando} style={S.guardar}>
              {guardando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Guardar borrador'}
            </button>
            <button onClick={descartar} disabled={guardando} style={S.descartar}>
              <Trash2 size={14} /> Descartar
            </button>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Completitud: {validacion.puntajeCompletitud}%</span>
          </div>
        </>
      )}

      {/* ── Modal de consentimiento (Fase C) ── */}
      {modalConsentimiento && (
        <div onClick={e => e.target === e.currentTarget && setModalConsentimiento(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
        }}>
          <div style={{ width: '100%', maxWidth: 460, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>
              Consentimiento para grabar la consulta
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.65, margin: '0 0 14px' }}>
              Confirme que el paciente fue informado de que la conversación será grabada y transcrita para
              estructurar la nota clínica con asistencia de IA. El audio no se guarda; solo se conserva la
              transcripción de texto vinculada a su expediente.
            </p>
            <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.7 }}>
              <li>El paciente puede pedir detener la grabación en cualquier momento.</li>
              <li>La nota final debe ser revisada y firmada por usted.</li>
              <li>La IA NO guarda datos clínicos sin su aprobación.</li>
            </ul>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalConsentimiento(false)} style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 10, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmarConsentimiento} style={{ background: 'var(--teal)', color: '#000', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Confirmo el consentimiento e iniciar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 0 12px rgba(239,68,68,0); } }
        @media print { button, textarea:disabled { display: none; } }
      `}</style>
    </div>
  )
}

// ── Subcomponentes ─────────────────────────────────────────────
function Section({ title, icon, obligatorio, children }: { title: string; icon?: React.ReactNode; obligatorio?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ color: 'var(--teal)' }}>{icon}</span>}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        {obligatorio && <span style={{ color: '#f87171', fontSize: 13 }}>*</span>}
      </div>
      {children}
    </div>
  )
}

const S = {
  back: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', marginBottom: 14, padding: 0 } as React.CSSProperties,
  alergia: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 } as React.CSSProperties,
  firmadaBadge: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,212,168,0.12)', color: 'var(--teal)', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 100 } as React.CSSProperties,
  grabCard: { background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 20 } as React.CSSProperties,
  transcripcion: { width: '100%', marginTop: 14, minHeight: 100, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, resize: 'vertical', outline: 'none' } as React.CSSProperties,
  resumen: { display: 'flex', gap: 8, background: 'rgba(0,212,168,0.06)', border: '1px solid rgba(0,212,168,0.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 18 } as React.CSSProperties,
  textarea: { width: '100%', minHeight: 70, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 13, color: 'var(--text)', lineHeight: 1.6, resize: 'vertical', outline: 'none' } as React.CSSProperties,
  input: { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' } as React.CSSProperties,
  miniLabel: { fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 3 } as React.CSSProperties,
  miniInput: { width: '100%', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', fontSize: 13, color: 'var(--text)', outline: 'none' } as React.CSSProperties,
  row: { display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' } as React.CSSProperties,
  del: { background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 6, flexShrink: 0 } as React.CSSProperties,
  addBtn: { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--s2)', border: '1px dashed var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' } as React.CSSProperties,
  chip: (a: boolean): React.CSSProperties => ({ background: a ? 'var(--teal)' : 'var(--s2)', color: a ? '#000' : 'var(--text2)', border: '1px solid var(--border)', borderRadius: 100, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }),
  iaBtn: (d: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 7, background: d ? 'var(--s3)' : 'linear-gradient(90deg,#00d4a8,#00b8ff)', color: d ? 'var(--text3)' : '#000', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: d ? 'default' : 'pointer' }),
  valBox: (t: 'error' | 'warn'): React.CSSProperties => ({ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6, background: t === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${t === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`, color: t === 'error' ? '#f87171' : '#f59e0b', borderRadius: 8, padding: '12px 14px', fontSize: 12.5 }),
  firmar: (d: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 8, background: d ? 'var(--s3)' : 'var(--teal)', color: d ? 'var(--text3)' : '#000', border: 'none', borderRadius: 10, padding: '13px 22px', fontSize: 15, fontWeight: 700, cursor: d ? 'default' : 'pointer' }),
  guardar: { background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 10, padding: '13px 18px', fontSize: 14, cursor: 'pointer' } as React.CSSProperties,
  descartar: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 10, padding: '13px 16px', fontSize: 14, cursor: 'pointer' } as React.CSSProperties,
}
