'use client'
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useDoctors } from '@/hooks/useDoctors'
import { useToast } from '@/context/ToastContext'
import { useParams, useRouter } from 'next/navigation'
import { useSmartBack } from '@/hooks/useSmartBack'
import { imprimirElemento } from '@/lib/print-element'
import { entradaPorMedico, membreteValido, firmaValida } from '@/lib/impreso-medico'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { getNota, agregarAdenda, getAdendas } from '@/lib/expediente/firestore'
import { getPatient } from '@/lib/firestore'
import { useAuth } from '@/hooks/useAuth'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import type { NotaMedica, Adenda } from '@/types/expediente'
import type { Patient } from '@/types'
import { ArrowLeft, Printer, Loader2, Download, Pill, ClipboardList, AlertTriangle, Check, FileText, FilePlus2, X, Mic, ChevronDown } from 'lucide-react'
import { Spinner, EmptyState } from '@/components/ui'
import { descargarComoPDF } from '@/lib/pdf-download'
import { descargarNotaWord } from '@/lib/nota-word'
import { AvisoConfigNoCargada } from '@/components/AvisoConfigNoCargada'

export default function NotaImprimiblePage() {
  const { patientId, notaId } = useParams<{ patientId: string; notaId: string }>()
  const router = useRouter()
  const volver = useSmartBack(`/expediente/${patientId}`)
  const { clinicId } = useClinic()
  const { config, error: configError } = useConfig()

  /**
   * ¿Este consultorio tiene un solo médico?
   *
   * De esto depende que se pueda usar "la única firma configurada" cuando el
   * identificador de la nota no coincide con el de la configuración — que es lo
   * habitual por un desajuste histórico de ids. Con varios médicos, adivinar
   * significa estampar la firma de otro.
   */
  const { activeDoctors } = useDoctors()
  const unicoMedico = activeDoctors.length <= 1

  const { toast } = useToast()
  const { user } = useAuth()
  const [nota, setNota] = useState<NotaMedica | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [descargando, setDescargando] = useState(false)
  const [adendas, setAdendas] = useState<Adenda[]>([])
  const [modalAdenda, setModalAdenda] = useState(false)
  const [textoAdenda, setTextoAdenda] = useState('')
  const [motivoAdenda, setMotivoAdenda] = useState('')
  const [guardandoAdenda, setGuardandoAdenda] = useState(false)
  const [verTranscripcion, setVerTranscripcion] = useState(false)
  // null = sin verificar/no aplica · true = sello íntegro · false = ALTERADA
  const [integridad, setIntegridad] = useState<'verificada' | 'alterada' | 'legado' | 'sin-sello' | null>(null)

  const descargarPDF = async () => {
    const el = document.getElementById('doc')
    if (!el) return
    setDescargando(true)
    try {
      const nombre = (patient?.nombre ?? 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
      const fechaCorta = new Date(nota?.fechaConsulta ?? Date.now()).toISOString().slice(0, 10)
      // Con hoja membretada el margen lo pone el padding del #doc (mMemb), NO el
      // PDF: si además html2pdf mete su margen de 12mm, el membrete de fondo se
      // encoge y deja borde blanco. margin:0 para membrete; el default para el
      // formato de texto (que no lleva fondo a sangre).
      await descargarComoPDF(el, { filename: `Nota_${nombre}_${fechaCorta}`, format: 'letter', ...(membrete ? { margin: 0 } : {}) })
    } catch (e) {
      console.error('PDF error:', e)
      toast('No se pudo generar el PDF. Intenta con Imprimir → Guardar como PDF.', 'error')
      setDescargando(false)
      return
    }
    // El registro de auditoría va DESPUÉS y con su propio catch: estaba dentro
    // del mismo try, así que si fallaba el log se anunciaba "No se pudo generar
    // el PDF" con el archivo ya en Descargas. El médico reintentaba y duplicaba.
    try {
      if (clinicId) {
        const { logAudit } = await import('@/lib/expediente/audit-log')
        await logAudit({ evento: 'nota_impresion', clinicId, patientId, notaId })
      }
    } catch (e) {
      console.error('[NOM-024] no se registró la impresión:', e)
    } finally {
      setDescargando(false)
    }
  }

  const guardarAdenda = async () => {
    if (!clinicId || !textoAdenda.trim()) return
    setGuardandoAdenda(true)
    try {
      const nueva = await agregarAdenda(clinicId, patientId, notaId, {
        texto: textoAdenda.trim(),
        motivo: motivoAdenda.trim() || undefined,
        autorNombre: config?.nombreMedico || user?.email || 'Médico',
        autorEmail: user?.email || '',
        autorCedula: config?.cedulaProfesional || undefined,
      })
      setAdendas(prev => [...prev, nueva])
      setTextoAdenda(''); setMotivoAdenda(''); setModalAdenda(false)
      // NOM-004: la enmienda a una nota firmada queda en la bitácora inalterable.
      try {
        const { logAudit } = await import('@/lib/expediente/audit-log')
        await logAudit({ evento: 'nota_adenda', clinicId, patientId, notaId })
      } catch { /* nunca romper la operación clínica */ }
    } catch {
      toast('No se pudo agregar la adenda. Intenta de nuevo.', 'error')
    } finally {
      setGuardandoAdenda(false)
    }
  }

  useEffect(() => {
    if (!clinicId || !patientId || !notaId) return
    Promise.all([
      getNota(clinicId, patientId, notaId),
      getPatient(clinicId, patientId),
    ]).then(async ([n, ps]) => {
      setNota(n)
      setPatient(ps)
      setLoading(false)
      // Verificar el sello SHA-256 de las notas firmadas. Antes el sello se
      // MOSTRABA sin recomputarse — daba garantía de no-alteración que el
      // sistema no comprobaba. Ahora se recalcula y se compara.
      if (n && n.estado === 'firmada') {
        try {
          const { verificarIntegridadEstado } = await import('@/lib/expediente/integrity')
          setIntegridad(await verificarIntegridadEstado(n))
        } catch { setIntegridad(null) }
        try { setAdendas(await getAdendas(clinicId, patientId, notaId)) } catch { /* noop */ }
      }
    }).catch((e) => {
      // Sin este catch, un fallo de lectura dejaba "Cargando documento…" para
      // siempre y el médico no podía imprimir la receta del paciente que tenía
      // enfrente, sin saber por qué.
      console.error('[nota] no se pudo cargar', e)
      setErrorCarga('No se pudo cargar el documento. Revisa tu conexión y vuelve a intentar.')
      setLoading(false)
    })
    // NOM-024 Art. 6.5: registrar lectura de nota clínica
    import('@/lib/expediente/audit-log').then(({ logAudit }) => {
      logAudit({ evento: 'nota_lectura', clinicId, patientId, notaId })
    })
  }, [clinicId, patientId, notaId])

  if (loading) {
    return <Spinner center label="Cargando documento…" />
  }

  if (errorCarga) {
    return (
      <div style={{ maxWidth: 520, margin: '80px auto', padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>{errorCarga}</p>
        <button className="btn" onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    )
  }
  if (!nota) return <EmptyState icon={<FileText size={22} />} title="Nota no encontrada" />


  const fecha = new Date(nota.fechaConsulta).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })
  const medico = nota.firma?.nombreMedico || config?.nombreMedico || 'Médico'
  const cedula = nota.firma?.cedulaProfesional || config?.cedulaProfesional || '—'
  const especialidad = nota.firma?.especialidad || config?.especialidad || ''
  const establecimiento = nota.metadata.establecimiento || config?.nombreClinica || ''
  // Hoja membretada de la nota. BUG que el Dr reportó (su membrete subido NO salía
  // en la nota impresa): el match EXACTO por médico casi siempre falla porque la
  // nota se sella con medicoId=uid y Config guarda por id de la subcolección
  // `doctors` (ver impreso-medico.ts). A diferencia de la FIRMA, una hoja
  // membretada es branding de la CLÍNICA (no hay riesgo de suplantación), así que
  // se resuelve con tolerancia: exacto por médico → ÚNICA hoja disponible → general.
  const medMembrete = (() => {
    const exacta = entradaPorMedico(config?.notaMembretePorMedico, nota.metadata?.medicoId, membreteValido, unicoMedico)
    if (exacta) return exacta
    const validas = Object.values(config?.notaMembretePorMedico ?? {}).filter(v => membreteValido(v as { url?: string }))
    return validas.length === 1 ? (validas[0] as { url?: string; margenes?: { top: number; right: number; bottom: number; left: number }; firmaPos?: { x: number; y: number } }) : undefined
  })()
  // Firma a mostrar: el snapshot de la nota (inmutable) o la firma del médico que
  // la firmó (per-médico) o, en último caso, la general del consultorio.
  // Auditoría papelería 2026-07 (P1): el último fallback a la firma GLOBAL solo es
  // seguro con UN médico. Con varios, estampar la firma del consultorio sobre la
  // nota de otro médico es firmar por alguien más y NO se nota. Mejor sin firma
  // (se ve y se corrige) que con la firma equivocada. Igual criterio que la orden.
  const firmaMostrar = nota.firma?.imagenDataUrl
    || entradaPorMedico(config?.firmaPorMedico, nota.metadata?.medicoId, firmaValida, unicoMedico)
    || (unicoMedico ? config?.firmaImagenDataUrl : undefined)
  const mem = (medMembrete?.url ?? config?.notaMembreteDataUrl)?.trim()
  const membrete = (mem && /^(https?:|\/api\/|data:image)/.test(mem)) ? mem : undefined
  const mMemb = medMembrete?.margenes ?? config?.notaMembreteMargenes ?? { top: 42, right: 22, bottom: 28, left: 22 }
  // Posición de la firma sobre la hoja membretada (calibrada en Config). % de la
  // hoja. Default: sobre el pie derecho, donde suele imprimirse el nombre.
  const firmaPos = medMembrete?.firmaPos ?? config?.notaMembreteFirmaPos ?? { x: 70, y: 84 }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}><AvisoConfigNoCargada error={configError} /></div>

      {/* Auditoría papelería 2026-07 (P2 NOM-004): avisos de datos obligatorios que
          podrían salir vacíos en el papel. Solo cuando NO hay hoja membretada (esa
          ya trae el encabezado con el establecimiento). No se imprimen. */}
      {!membrete && !establecimiento && (
        <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 12px', display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 12, padding: '11px 14px' }}>
          <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
            <strong>Falta el nombre del establecimiento.</strong> Es dato obligatorio del expediente (NOM-004).
            Agrégalo en Configuración → General (o usa tu hoja membretada, que ya lo incluye).
          </div>
        </div>
      )}

      {/* Barra de acciones (no se imprime) */}
      <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Atrás
        </button>
        <div className="actions-row">
          <button onClick={() => { if (configError) return; descargarPDF() }} disabled={descargando || !!configError} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--teal)', color: '#000', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: descargando ? 'default' : 'pointer' }}>
            {descargando
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</>
              : <><Download size={16} /> Descargar PDF</>}
          </button>
          <button onClick={() => { if (configError) return; imprimirElemento(document.getElementById('doc'), 'Nota médica', membrete
            // Con membrete la nota YA viene paginada en hojas carta (.nota-sheet con
            // page-break y el membrete de fondo en cada una). Se imprime a sangre en
            // carta (@page letter margin 0) para que cada hoja llene la página.
            ? { anchoMm: 216, altoMm: 279, onError: (m) => toast(m, 'error') }
            : { formato: 'carta', onError: (m) => toast(m, 'error') }) }} disabled={!!configError} title={configError ? 'Espera a que cargue la configuración del consultorio' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: configError ? 'default' : 'pointer', opacity: configError ? 0.5 : 1 }}>
            <Printer size={16} /> Imprimir
          </button>
          {/* Word editable — para ajustar la nota al membrete/formato propio (igual
              que receta y orden; capacidad consistente entre documentos). */}
          <button onClick={() => { if (configError) return; try { descargarNotaWord(nota, config ?? null, { edad: patient?.edad, sexo: patient?.sexo, telefono: patient?.telefono, alergias: patient ? (patient.alergias || 'Negadas / no referidas') : 'NO DISPONIBLE — verificar con el paciente', membrete }) } catch { toast('No se pudo generar el Word', 'error') } }} disabled={!!configError} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: configError ? 'default' : 'pointer', opacity: configError ? 0.5 : 1 }}>
            <FileText size={16} /> Word
          </button>
          {/* Generar receta y orden — solo cuando la nota está firmada */}
          {nota.estado === 'firmada' && (
            <>
              <button onClick={() => router.push(`/receta/${patientId}/${notaId}`)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(20,184,166,0.12)', color: 'var(--teal)', border: '1px solid rgba(20,184,166,0.4)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                <Pill size={16} /> Receta
              </button>
              <button onClick={() => router.push(`/orden/${patientId}/${notaId}`)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                <ClipboardList size={16} /> Orden
              </button>
              <button onClick={() => setModalAdenda(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }} title="Corregir o aclarar sin alterar la nota firmada">
                <FilePlus2 size={16} /> Adenda
              </button>
            </>
          )}
        </div>
      </div>

      {/* Documento de la nota.
          Auditoría flujo 2026-07 (el Dr reportó pie del membrete empalmado a media
          hoja y página 2 sin membrete): con hoja membretada, el contenido se PAGINA
          en hojas carta (HojasNota) con el membrete completo en cada una y el texto
          en la zona segura. Sin membrete, render continuo normal. Los bloques
          imprimibles se arman una sola vez y se reparten por hoja. */}
      {(() => {
        const printables = (
          <>
        {/* Encabezado de texto — SOLO si NO hay hoja membretada (la membretada ya lo trae) */}
        {!membrete && (
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{medico}</div>
          <div style={{ fontSize: 12 }}>{especialidad}{especialidad && cedula !== '—' ? ' · ' : ''}{cedula !== '—' ? `Cédula Prof. ${cedula}` : ''}</div>
          {establecimiento && <div style={{ fontSize: 12 }}>{establecimiento}</div>}
          {config?.direccion && <div style={{ fontSize: 11, color: '#555' }}>{config.direccion}</div>}
          {(config?.telefonoAdmin || config?.whatsappConsultorio) && <div style={{ fontSize: 11, color: '#555' }}>Tel. {config.telefonoAdmin || config.whatsappConsultorio}</div>}
        </div>
        )}

        {/* Título */}
        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>
          {TIPO_NOTA_LABEL[nota.tipo]}
        </div>

        {/* Datos del paciente */}
        <table style={{ width: '100%', fontSize: 12.5, marginBottom: 10, borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '2px 0' }}><strong>Paciente:</strong> {nota.pacienteNombre}</td>
              <td style={{ padding: '2px 0', textAlign: 'right' }}><strong>Fecha:</strong> {fecha}</td>
            </tr>
            <tr>
              <td style={{ padding: '2px 0' }}>
                {patient?.edad ? `Edad: ${patient.edad} años` : ''}{patient?.sexo ? ` · Sexo: ${patient.sexo}` : ''}
              </td>
              <td style={{ padding: '2px 0', textAlign: 'right' }}>{patient?.telefono ? `Tel: ${patient.telefono}` : ''}</td>
            </tr>
          </tbody>
        </table>

        {/* Alergias — destacadas */}
        <div style={{
          border: '1.5px solid #b91c1c', color: '#b91c1c', borderRadius: 4,
          padding: '6px 10px', fontSize: 12.5, fontWeight: 700, marginBottom: 14,
        }}>
          {/* Tres estados, no dos: si el paciente NO se pudo leer, la nota NO puede
                  afirmar que las alergias se interrogaron y se negaron. Es un
                  documento legal (NOM-004) y eso sería un dato inventado. */}
              ALERGIAS: {patient
              ? (patient.alergias || 'Negadas / no referidas')
              : 'NO DISPONIBLE — verificar con el paciente'}
        </div>

        {/* Resumen ejecutivo */}
        {nota.resumenEjecutivo && (
          <p style={{ fontStyle: 'italic', marginBottom: 12 }}>{nota.resumenEjecutivo}</p>
        )}

        {/* Signos vitales */}
        {nota.signosVitales && Object.values(nota.signosVitales).some(Boolean) && (
          <div style={{ marginBottom: 12 }}>
            <SecTitle>Signos vitales</SecTitle>
            <div style={{ fontSize: 12.5 }}>
              {nota.signosVitales.ta && `TA ${nota.signosVitales.ta} mmHg  `}
              {nota.signosVitales.fc && `FC ${nota.signosVitales.fc} lpm  `}
              {nota.signosVitales.fr && `FR ${nota.signosVitales.fr} rpm  `}
              {nota.signosVitales.temperatura && `T° ${nota.signosVitales.temperatura}°C  `}
              {nota.signosVitales.spo2 && `SpO₂ ${nota.signosVitales.spo2}%  `}
              {nota.signosVitales.peso && `Peso ${nota.signosVitales.peso} kg  `}
              {nota.signosVitales.talla && `Talla ${nota.signosVitales.talla} cm`}
            </div>
          </div>
        )}

        {/* Secciones narrativas */}
        {nota.secciones.filter(s => s.value.trim()).map(s => (
          <div key={s.key} style={{ marginBottom: 12 }}>
            <SecTitle>{s.label}</SecTitle>
            <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{s.value}</div>
          </div>
        ))}

        {/* Diagnósticos */}
        {nota.diagnosticos.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <SecTitle>Diagnósticos</SecTitle>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5 }}>
              {nota.diagnosticos.map((d, i) => (
                <li key={i}>{d.descripcion}{d.codigoCIE10 ? ` (CIE-10: ${d.codigoCIE10})` : ''}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Medicamentos */}
        {nota.medicamentos.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <SecTitle>Plan farmacológico</SecTitle>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5 }}>
              {nota.medicamentos.map((m, i) => (
                <li key={i}>{[`${m.nombre}${m.dosis ? ` ${m.dosis}` : ''}`.trim(), m.via, m.frecuencia, m.duracion].filter(Boolean).join(' · ')}{m.indicacion ? ` — ${m.indicacion}` : ''}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Bloque de firma DEFAULT — solo SIN hoja membretada. Con membrete, la firma
            se coloca CALIBRADA sobre la hoja (HojasNota) y el pie del membrete ya trae
            el nombre impreso, así que este bloque duplicaría — se omite. */}
        {!membrete && (
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          {/* NOM-024: usar el SNAPSHOT de firma guardado en la nota (inmutable).
              Fallback al config actual solo si la nota es vieja y no tiene snapshot. */}
          {nota.estado === 'firmada' && firmaMostrar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={firmaMostrar}
              alt="Firma del médico"
              style={{
                maxHeight: 70,
                maxWidth: 280,
                display: 'block',
                margin: '0 auto -8px auto',  // overlap discreto con la línea
                objectFit: 'contain',
              }}
            />
          )}
          <div style={{ borderTop: '1px solid #1a1a1a', width: 280, margin: '0 auto', paddingTop: 4, fontSize: 12.5 }}>
            <strong>{medico}</strong><br />
            {especialidad}{especialidad ? <br /> : null}
            {/* Auditoría papelería 2026-07 (P1 NOM): la cédula es dato obligatorio.
                Antes se imprimía "Cédula Profesional —" (parece guion de maqueta);
                ahora se marca la ausencia en rojo para que no pase inadvertida. */}
            {cedula !== '—'
              ? <>Cédula Profesional {cedula}</>
              : <span style={{ color: '#b91c1c', fontWeight: 700 }}>[FALTA CÉDULA PROFESIONAL]</span>}
          </div>
          {nota.estado !== 'firmada' && (
            <div className="no-print" style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text3)', fontStyle: 'italic' }}>
              La firma y el sello aparecerán automáticamente al firmar la nota.
            </div>
          )}
        </div>
        )}

        {/* Alerta ROJA solo si el sello estable NO coincide (posible alteración real) */}
        {integridad === 'alterada' && (
          <div className="no-print" style={{
            marginTop: 16, padding: '8px 12px', borderRadius: 6,
            background: 'rgba(220,38,38,0.10)', border: '1.5px solid #b91c1c',
            color: '#b91c1c', fontSize: 12, fontWeight: 700, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <AlertTriangle size={14} className="ds-icon" style={{ flexShrink: 0 }} />
            <span>INTEGRIDAD NO VERIFICADA — el contenido no coincide con el sello SHA-256
            registrado al firmar. Esta nota pudo haber sido alterada. No la uses como
            documento legal sin investigar.</span>
          </div>
        )}

        {/* Aviso NEUTRO para notas con sello de formato anterior (no re-verificable) */}
        {integridad === 'legado' && (
          <div className="no-print" style={{
            marginTop: 16, padding: '8px 12px', borderRadius: 6,
            background: 'var(--s2)', border: '1px solid var(--border)',
            color: 'var(--text3)', fontSize: 11.5, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <AlertTriangle size={13} className="ds-icon" style={{ flexShrink: 0 }} />
            <span>Nota firmada con un formato de sello anterior: el sello no puede recalcularse
            automáticamente (no implica alteración). Las notas nuevas se verifican solas.</span>
          </div>
        )}

        {/* Sello de integridad NOM-024 */}
        <div style={{ marginTop: 20, paddingTop: 8, borderTop: '1px dashed #999', fontSize: 9.5, color: '#666', textAlign: 'center' }}>
          {nota.estado === 'firmada' && nota.firma ? (
            <>
              Documento firmado electrónicamente el {new Date(nota.firma.timestamp).toLocaleString('es-MX')}
              {integridad === 'verificada' && <> · <Check size={10} className="ds-icon" style={{ display: 'inline' }} /> integridad verificada</>}
              {' · Sello (SHA-256): '}{nota.metadata.hashIntegridad || '—'}
            </>
          ) : (
            <>BORRADOR — documento no firmado. Sin validez hasta su firma.</>
          )}
          <br />Conforme a NOM-004-SSA3-2012 y NOM-024-SSA3-2012.
        </div>

        {/* Trazabilidad de IA (transparencia): qué documentó la IA y que el médico
            lo revisó y validó. Solo aparece si la nota se procesó con IA. */}
        {nota.estado === 'firmada' && nota.iaAuditoria?.procesadoEn && (
          <div style={{ marginTop: 10, fontSize: 9.5, color: '#666', textAlign: 'center', fontStyle: 'italic' }}>
            Documentada con asistencia de inteligencia artificial (borrador) el{' '}
            {new Date(nota.iaAuditoria.procesadoEn).toLocaleDateString('es-MX')}; contenido
            revisado, corregido y <strong>validado por el médico responsable</strong>
            {nota.iaAuditoria.aprobadoPor ? ` (${nota.iaAuditoria.aprobadoPor})` : ''} antes de firmar.
            La IA es una herramienta de apoyo; la decisión clínica es del médico.
          </div>
        )}

        {/* Adendas: correcciones/aclaraciones posteriores a la firma (NOM-004).
            No alteran la nota original; se muestran e imprimen debajo. */}
        {adendas.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 12, borderTop: '2px solid #1a1a1a' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.3 }}>
              Adendas (correcciones posteriores a la firma)
            </div>
            {adendas.map((a, i) => (
              <div key={a.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i === adendas.length - 1 ? 'none' : '1px dashed #999' }}>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>
                  {new Date(a.createdAt).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}
                  {a.motivo ? ` · ${a.motivo}` : ''} · {a.autorNombre}{a.autorCedula ? ` (Céd. ${a.autorCedula})` : ''}
                </div>
                <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{a.texto}</div>
              </div>
            ))}
          </div>
        )}
          </>
        )
        // Bloques imprimibles como arreglo (los conditionals falsy se filtran).
        const bloques = (Array.isArray(printables.props.children) ? printables.props.children : [printables.props.children])
          .flat().filter((b: React.ReactNode) => b !== false && b != null)
        if (membrete) {
          // Nota membretada → paginar en hojas carta con el membrete en cada una.
          return (
            <div id="doc" style={{ width: 'fit-content', maxWidth: '100%', margin: '0 auto', color: '#1a1a1a', fontFamily: '"Times New Roman", Georgia, serif' }}>
              <HojasNota anchoMm={216} altoMm={279} mMemb={mMemb} membrete={membrete} bloques={bloques}
                firma={nota.estado === 'firmada' && firmaMostrar ? { src: firmaMostrar, x: firmaPos.x, y: firmaPos.y } : undefined} />
            </div>
          )
        }
        // Sin membrete → hoja blanca continua (encabezado de texto incluido en los bloques).
        return (
          <div id="doc" style={{
            maxWidth: 800, margin: '0 auto', background: '#fff', color: '#1a1a1a', position: 'relative',
            padding: '40px 48px', borderRadius: 4, fontFamily: '"Times New Roman", Georgia, serif',
            lineHeight: 1.4, fontSize: 13, orphans: 3, widows: 3,
          }}>
            {printables}
          </div>
        )
      })()}

      {/* Trazabilidad: lo que se DIJO vs lo redactado. Colapsable, NO se imprime.
          Permite al médico verificar que la nota refleja el dictado. */}
      {(nota.transcripcionCruda || (nota.dialogoDiarizado && nota.dialogoDiarizado.length > 0)) && (
        <div className="no-print" style={{ maxWidth: 800, margin: '14px auto 0' }}>
          <button
            onClick={() => setVerTranscripcion(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '11px 14px', fontSize: 13.5, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer',
            }}
          >
            <Mic size={15} style={{ color: 'var(--nexus)' }} />
            Lo que se dijo (transcripción original)
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text3)', fontWeight: 500 }}>
              compara con la nota
              <ChevronDown size={15} style={{ transform: verTranscripcion ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </span>
          </button>
          {verTranscripcion && (
            <div style={{
              background: 'var(--s2)', border: '1px solid var(--border)', borderTop: 'none',
              borderRadius: '0 0 10px 10px', padding: 16, marginTop: -1,
              fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, maxHeight: 340, overflowY: 'auto',
            }}>
              {nota.dialogoDiarizado && nota.dialogoDiarizado.length > 0 ? (
                nota.dialogoDiarizado.map((t, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: 'var(--nexus)', fontSize: 11.5 }}>{t.speaker}: </span>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{t.text}</span>
                  </div>
                ))
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{nota.transcripcionCruda}</div>
              )}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border)', fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
                Material de apoyo — no forma parte del documento legal impreso. Sirve para verificar que la nota redactada por IA refleja lo dictado.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de adenda */}
      {modalAdenda && (
        <div className="no-print" onClick={() => !guardandoAdenda && setModalAdenda(false)} style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 460, background: 'var(--s1)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 24, position: 'relative',
          }}>
            <button onClick={() => setModalAdenda(false)} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, lineHeight: 0 }}>
              <X size={18} />
            </button>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Agregar adenda</div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, margin: '0 0 16px' }}>
              Corrige o aclara esta nota <strong>sin alterar el documento firmado</strong>. La adenda queda fechada,
              con tu nombre, y no se puede editar ni borrar (NOM-004).
            </p>
            <label className="label" style={{ fontSize: 12.5 }}>Motivo (opcional)</label>
            <input className="input" value={motivoAdenda} onChange={e => setMotivoAdenda(e.target.value)}
              placeholder="Ej. Corrección de dosis, dato omitido" style={{ marginBottom: 12 }} />
            <label className="label" style={{ fontSize: 12.5 }}>Corrección o aclaración</label>
            <textarea value={textoAdenda} onChange={e => setTextoAdenda(e.target.value)} rows={5}
              placeholder="Describe la corrección o aclaración…"
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text)', fontSize: 13.5, resize: 'vertical', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setModalAdenda(false)} disabled={guardandoAdenda} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarAdenda} disabled={guardandoAdenda || !textoAdenda.trim()} className="lift" style={{ background: 'var(--nexus)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: guardandoAdenda || !textoAdenda.trim() ? 'default' : 'pointer', opacity: !textoAdenda.trim() ? 0.6 : 1 }}>
                {guardandoAdenda ? 'Guardando…' : 'Agregar adenda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos de impresión: solo el documento, en blanco y negro legible */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #doc, #doc * { visibility: visible !important; }
          #doc { position: absolute; top: 0; left: 0; width: 100%; max-width: none; margin: 0; padding: 24px 28px; border-radius: 0; box-shadow: none; }
          .no-print { display: none !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  )
}

function SecTitle({ children }: { children: React.ReactNode }) {
  // breakAfter:avoid → el título de sección nunca queda solo al pie de una hoja
  // (se imprime junto a su contenido en notas de varias páginas).
  return (
    <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', borderBottom: '0.5px solid #999', marginBottom: 3, letterSpacing: 0.3, breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
      {children}
    </div>
  )
}

/**
 * PAGINADOR de la NOTA MEMBRETADA — el Dr reportó que en notas de 2+ páginas el
 * PIE de su membrete caía a media hoja y la página 2 salía sin membrete.
 *
 * Solución (modelo de la receta): la nota se parte en HOJAS carta discretas; cada
 * hoja lleva el membrete COMPLETO de fondo (encabezado arriba, pie abajo) y el
 * texto SOLO en la zona segura (entre los márgenes mMemb). Los bloques se miden
 * en un medidor oculto y se reparten por hoja sin cortar un bloque a la mitad.
 * Como el DOM queda paginado, PANTALLA, PDF (html2canvas) e IMPRIMIR (page-break
 * inline) coinciden — congruente en las tres salidas.
 */
function HojasNota({ membrete, mMemb, anchoMm, altoMm, bloques, firma }: {
  membrete: string
  mMemb: { top: number; right: number; bottom: number; left: number }
  anchoMm: number; altoMm: number
  bloques: React.ReactNode[]
  /** Firma a colocar (calibrada) sobre la ÚLTIMA hoja. x/y en % de la hoja. */
  firma?: { src: string; x: number; y: number }
}) {
  const PXMM = 96 / 25.4
  const anchoPx = anchoMm * PXMM, altoPx = altoMm * PXMM
  const topPx = mMemb.top * PXMM, botPx = mMemb.bottom * PXMM
  const leftPx = mMemb.left * PXMM, rightPx = mMemb.right * PXMM
  const contentW = Math.max(50, anchoPx - leftPx - rightPx)
  const contentH = Math.max(80, altoPx - topPx - botPx)
  const medRef = useRef<HTMLDivElement>(null)
  const [paginas, setPaginas] = useState<number[][]>([bloques.map((_, i) => i)])

  // Dep ESTABLE: `bloques` se recrea en cada render (nuevo array), así que usarlo
  // como dependencia dispara el efecto en cada render → setState → bucle infinito
  // (congelaba la nota). Se depende de bloques.length + contentH, y setPaginas
  // BAILA si el resultado no cambió (misma referencia → React no re-renderiza).
  useLayoutEffect(() => {
    const c = medRef.current
    if (!c) return
    const medir = () => {
      const kids = Array.from(c.children) as HTMLElement[]
      if (!kids.length) return
      // Alturas EFECTIVAS con MÁRGENES: getBoundingClientRect excluye los márgenes
      // entre bloques → subestimaba y metía demasiados bloques por hoja (el texto se
      // derramaba al pie). offsetTop refleja la posición REAL ya con márgenes; la
      // diferencia entre bloques = el espacio vertical que ocupa cada uno.
      const tops = kids.map(k => k.offsetTop)
      const totalH = c.scrollHeight
      const hs = kids.map((k, i) => (i < kids.length - 1 ? tops[i + 1] - tops[i] : Math.max(0, totalH - tops[i])))
      const pages: number[][] = []
      let cur: number[] = []; let acc = 0
      hs.forEach((h, i) => {
        if (acc + h > contentH && cur.length) { pages.push(cur); cur = []; acc = 0 }
        cur.push(i); acc += h
      })
      if (cur.length) pages.push(cur)   // ← la ÚLTIMA hoja
      const final = pages.length ? pages : [Array.from({ length: kids.length }, (_, i) => i)]
      setPaginas(prev => (JSON.stringify(prev) === JSON.stringify(final) ? prev : final))
    }
    medir()
    // Brute force acotado: re-medir varias veces por si las fuentes asientan tarde.
    let n = 0
    const iv = setInterval(() => { medir(); if (++n >= 6) clearInterval(iv) }, 200)
    // ResizeObserver: re-mide cuando las alturas cambian (al cargar la tipografía,
    // reflow, etc.). La primera medición corre antes de que asiente la fuente y
    // subestimaba alturas → salía 1 hoja con el texto cortado. El guard de
    // setPaginas evita el bucle (si las páginas no cambian, no re-renderiza). El
    // medidor no se ve afectado por setPaginas, así que no hay lazo de observación.
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => medir())
      ro.observe(c)
    }
    // Respaldo por si no hay ResizeObserver: re-medir tras cargar fuentes.
    if (typeof document !== 'undefined' && document.fonts?.ready) document.fonts.ready.then(() => medir())
    return () => { ro?.disconnect(); clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloques.length, contentH])

  return (
    <>
      {/* Medidor oculto: mismos bloques al ancho de la zona de contenido */}
      <div ref={medRef} aria-hidden style={{ position: 'absolute', left: -99999, top: 0, width: contentW, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.4, visibility: 'hidden' }}>
        {bloques.map((b, i) => <div key={i}>{b}</div>)}
      </div>
      {/* Hojas reales */}
      {paginas.map((idxs, p) => (
        <div key={p} className="nota-sheet" style={{
          width: anchoPx, height: altoPx, position: 'relative', background: '#fff',
          margin: p === 0 ? '0 auto' : '16px auto 0', overflow: 'hidden', isolation: 'isolate',
          pageBreakAfter: p < paginas.length - 1 ? 'always' : 'auto',
          breakAfter: p < paginas.length - 1 ? 'page' : 'auto',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="membrete-bg" src={membrete} alt="" aria-hidden
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: -1, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: topPx, left: leftPx, width: contentW }}>
            {idxs.map(i => <div key={i}>{bloques[i]}</div>)}
          </div>
          {/* Firma CALIBRADA sobre la última hoja (centro en x/y %). */}
          {firma && p === paginas.length - 1 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={firma.src} alt="Firma del médico" style={{
              position: 'absolute', left: `${firma.x}%`, top: `${firma.y}%`,
              transform: 'translate(-50%, -50%)', maxWidth: '38%', maxHeight: '14%',
              objectFit: 'contain', pointerEvents: 'none',
            }} />
          )}
        </div>
      ))}
    </>
  )
}
