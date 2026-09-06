'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useToast } from '@/context/ToastContext'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useClinic } from '@/context/ClinicContext'
import { useConfig } from '@/hooks/useConfig'
import { getNota, listarNotasPagina, agregarAdenda } from '@/lib/expediente/firestore'
import { logAudit } from '@/lib/expediente/audit-log'
import { claveDeIntento } from '@/lib/idempotencia'
import { useAuth } from '@/hooks/useAuth'
import { useDoctors } from '@/hooks/useDoctors'
import { textoDeLaCarta, motivoDeLaCarta, cartaTieneContenido } from '@/lib/referencia-carta'
import { huellaContenido } from '@/lib/expediente/huella-impreso'
import { getPatient } from '@/lib/firestore'
import type { NotaMedica } from '@/types/expediente'
import type { Patient } from '@/types'
import { ArrowLeft, Printer, Loader2, Download } from 'lucide-react'
import { descargarComoPDF } from '@/lib/pdf-download'
import { useSmartBack } from '@/hooks/useSmartBack'
import { imprimirElemento } from '@/lib/print-element'
import { AvisoConfigNoCargada } from '@/components/AvisoConfigNoCargada'
import { hoyISO, zonaActiva } from '@/lib/timezone'
import { edadLegible } from '@/lib/edad-legible'
import { alergiasParaElPapel } from '@/lib/impreso-medico'
import { nombreConCerteza } from '@/lib/expediente/problemas-activos'

type Tipo = 'referencia' | 'contrarreferencia'
type Urgencia = 'Rutina' | 'Prioritario' | 'Urgente'

export default function CartaReferenciaPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const volver = useSmartBack(`/expediente/${patientId}`)
  const { clinicId } = useClinic()
  const { config, error: configError } = useConfig()
  const { toast } = useToast()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [notaOrigen, setNotaOrigen] = useState<NotaMedica | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const { user } = useAuth()
  const { activeDoctors } = useDoctors()
  /** Quien asienta la carta es el médico de la sesión, no el consultorio. */
  const medicoEnSesion = useMemo(() => {
    const uid = user?.uid
    const correo = (user?.email ?? '').trim().toLowerCase()
    const porUid = uid ? activeDoctors.filter(d => d.uid === uid) : []
    if (porUid.length === 1) return porUid[0]
    const porCorreo = correo ? activeDoctors.filter(d => (d.email ?? '').trim().toLowerCase() === correo) : []
    return porCorreo.length === 1 ? porCorreo[0] : undefined
  }, [activeDoctors, user?.uid, user?.email])
  /**
   * LA HUELLA DE LO ÚLTIMO QUE SE ASENTÓ — misma razón que en la orden emitida
   * (`orden/[patientId]/[notaId]/page.tsx`): un booleano impediría registrar la
   * carta corregida que sí se imprimió la segunda vez.
   */
  const huellaAsentada = useRef<string | null>(null)
  const claveAsiento = useRef<string | null>(null)

  // Campos de la carta
  const [tipo, setTipo] = useState<Tipo>('referencia')
  const [destino, setDestino] = useState('')         // médico/servicio destino
  const [institucion, setInstitucion] = useState('')
  const [motivo, setMotivo] = useState('')
  const [urgencia, setUrgencia] = useState<Urgencia>('Rutina')
  const [resumen, setResumen] = useState('')
  const [diagnosticos, setDiagnosticos] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [estudios, setEstudios] = useState('')
  const [descargando, setDescargando] = useState(false)

  /**
   * MC-004 — LA CARTA QUEDA EN EL EXPEDIENTE.
   *
   * Se asienta como adenda de la nota firmada de la que se compuso (ver
   * `referencia-carta.ts` para por qué ahí y no en una colección nueva), y deja
   * su evento de bitácora SIEMPRE — también cuando no hay nota firmada donde
   * asentarla, porque entonces lo único que queda es el asiento.
   *
   * Idempotente por `claveDeIntento`: imprimir dos veces la misma carta no
   * enmienda dos veces un documento inmutable.
   *
   * La bitácora NO lleva el contenido clínico: lleva su huella. El nombre del
   * destinatario tampoco viaja — basta saber que la hubo y poder cotejar el
   * papel con su huella.
   */
  const asentarCarta = async (formato: 'impresa' | 'pdf') => {
    if (!clinicId) return
    const carta = { tipo, urgencia, destino, institucion, motivo, resumen, diagnosticos, tratamiento, estudios }
    if (!cartaTieneContenido(carta)) return
    const texto = textoDeLaCarta(carta)
    const enNotaFirmada = notaOrigen?.estado === 'firmada'
    const huella = huellaContenido([texto])
    if (enNotaFirmada && huellaAsentada.current !== huella) {
      if (claveAsiento.current === null || huellaAsentada.current !== null) claveAsiento.current = claveDeIntento()
      try {
        await agregarAdenda(clinicId, patientId, notaOrigen.id, {
          texto,
          motivo: motivoDeLaCarta(carta),
          autorNombre: medicoEnSesion?.nombre || config?.nombreMedico || user?.email || 'Médico',
          autorEmail: user?.email || '',
          autorCedula: medicoEnSesion
            ? (medicoEnSesion.cedulaProfesional || undefined)
            : (config?.cedulaProfesional || undefined),
        }, claveAsiento.current)
        huellaAsentada.current = huella
      } catch {
        toast('La carta salió, pero no se pudo guardar en el expediente. Vuelve a intentarlo.', 'error')
      }
    }
    logAudit({
      evento: 'referencia_emitida',
      clinicId,
      patientId,
      notaId: notaOrigen?.id,
      meta: { tipo, urgencia, formato, enExpediente: enNotaFirmada, huella },
    }).catch(() => {})
  }

  /** Devuelve `true` sólo si el PDF llegó a generarse (ZL-002). */
  const descargarPDF = async (): Promise<boolean> => {
    const el = document.getElementById('doc')
    if (!el) return false
    setDescargando(true)
    try {
      const nombre = (patient?.nombre ?? 'paciente').replace(/[^\w\sáéíóúñ-]/gi, '').replace(/\s+/g, '_')
      // C-015 — `new Date().toISOString().slice(0,10)` da el día en UTC: a las
      // 19:00 de CDMX el archivo salía con la fecha de MAÑANA. `hoyISO()` usa la
      // zona del consultorio (REG-067).
      const fechaCorta = hoyISO()
      const tag = tipo === 'referencia' ? 'Referencia' : 'Contrarreferencia'
      await descargarComoPDF(el, { filename: `${tag}_${nombre}_${fechaCorta}` })
      return true
    } catch (e) {
      console.error('PDF error:', e)
      toast('No se pudo generar el PDF. Intenta con Imprimir → Guardar como PDF.', 'error')
      return false
    } finally {
      setDescargando(false)
    }
  }

  useEffect(() => {
    if (!clinicId || !patientId) return
    /**
     * REG-350 — esto pedía el historial ENTERO para prellenar un impreso con UNA
     * nota. Dos lecturas acotadas hacen lo mismo:
     *
     *  · con `?nota=`, se pide **esa** nota por su id. Además de barato es más
     *    correcto: la nota pedida podía ser antigua y quedar por debajo de
     *    cualquier techo, y entonces el impreso se habría prellenado en silencio
     *    con OTRA nota — la referencia de un paciente hablando de otra visita.
     *  · sin él, una página corta de las más recientes basta para «la última,
     *    preferiblemente firmada».
     */
    const notaParam = searchParams.get('nota')
    Promise.all([
      getPatient(clinicId, patientId),
      notaParam
        ? getNota(clinicId, patientId, notaParam).then(n => (n ? [n] : []))
        : listarNotasPagina(clinicId, patientId, { limite: 20 }).then(p => p.notas),
    ]).then(([ps, notas]) => {
      setPatient(ps)
      const nota: NotaMedica | undefined =
        notas.find(n => n.estado === 'firmada') ||
        notas[0]
      setNotaOrigen(nota ?? null)
      if (nota) {
        setResumen(nota.resumenEjecutivo || nota.secciones.find(s => s.value)?.value || '')
        /* REG-569 — esta lista viaja a OTRO médico. Aquí no se filtra: un
           descarte documentado le sirve al que recibe. Pero tiene que ir DICIENDO
           que lo es, y eso lo decide `nombreConCerteza`, no esta pantalla. */
        setDiagnosticos(nota.diagnosticos.map(d => `${nombreConCerteza(d)}${d.codigoCIE10 ? ` (CIE-10: ${d.codigoCIE10})` : ''}`).filter(Boolean).join('\n'))
        setTratamiento(nota.medicamentos.map(m => [`${m.nombre}${m.dosis ? ` ${m.dosis}` : ''}`.trim(), m.via, m.frecuencia, m.duracion].filter(Boolean).join(' · ')).join('\n'))
      }
      setLoading(false)
    }).catch(e => {
      /**
       * Sin este catch, `setLoading(false)` vivía SOLO dentro del `then`: con la
       * red caída o sin permisos, la carta de referencia se quedaba en "Cargando…"
       * para siempre — sin botón, sin mensaje, sin salida. Receta y orden sí lo
       * tenían; esta pantalla se había quedado fuera.
       */
      console.error('[referencia] no se pudo cargar:', e)
      setErrorCarga('No pudimos cargar los datos del paciente. Revisa tu conexión y recarga.')
      setLoading(false)
    })
  }, [clinicId, patientId, searchParams])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)', padding: 40 }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const medico = config?.nombreMedico || 'Médico'
  const cedula = config?.cedulaProfesional || '—'
  const especialidad = config?.especialidad || ''
  const establecimiento = config?.nombreClinica || ''
  /* C-015 — la fecha que se IMPRIME en la carta salía en la zona del navegador:
     a las 19:00 de CDMX desde un equipo en otra zona, la carta se fecha otro
     día. Se formatea en la zona del consultorio, como el resto del producto. */
  const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: zonaActiva() })
  const titulo = tipo === 'referencia' ? 'CARTA DE REFERENCIA' : 'CARTA DE CONTRARREFERENCIA'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <AvisoConfigNoCargada error={configError} />
        <AvisoConfigNoCargada error={errorCarga || null} />
      </div>
      {/* Acciones */}
      <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* minHeight 44: §24 táctil — mismo trato que ganaron los enlaces de
            texto de /login y /registro en su rebanada. */}
        <button onClick={volver} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', minHeight: 44 }}>
          <ArrowLeft size={15} /> Atrás
        </button>
        <div className="actions-row">
          <button onClick={() => { if (configError) return; void descargarPDF().then(ok => { if (ok) void asentarCarta('pdf') }) }} disabled={descargando || !!configError} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--nexus-solido)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: descargando ? 'default' : 'pointer' }}>
            {descargando
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</>
              : <><Download size={16} /> Descargar PDF</>}
          </button>
          <button onClick={() => { if (configError) return; /* ZL-002 — el asiento va después de que la ventana se abre. */ const resultado = imprimirElemento(document.getElementById('doc'), 'Carta de referencia', { formato: 'carta', onError: (m) => toast(m, 'error') }); if (resultado === 'abierta') void asentarCarta('impresa') }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {/* Formulario (no se imprime). Habla las clases del sistema
          (.label/.input, como /login y /registro) y cada control lleva su
          htmlFor/id: la primera medición axe de esta pantalla encontró el
          formulario entero sin nombres accesibles (`label` crítico +
          `select-name`) — la única deuda CRÍTICA del inventario de
          V15-A11Y-001, pagada en su 2ª rebanada. */}
      <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 20px', background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* MC-004 — se dice DÓNDE va a quedar la carta, o que no va a quedar.
            Callarlo es lo que hacía que el médico creyera que el sistema la
            guardaba: no la guardaba en ninguna parte. */}
        <div style={{
          background: notaOrigen?.estado === 'firmada' ? 'var(--s2)' : 'var(--badge-amber-b)',
          border: `1px solid ${notaOrigen?.estado === 'firmada' ? 'var(--border)' : 'var(--amber)'}`,
          borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--text)', lineHeight: 1.5,
        }}>
          {notaOrigen?.estado === 'firmada'
            ? <>Al imprimir o descargar, la carta queda asentada en el expediente como adenda de la nota firmada, y su emisión en la bitácora. Si la corriges y vuelves a emitirla, se asienta la nueva.</>
            : <><strong>Esta carta no quedará en el expediente.</strong> No hay una nota firmada de la que colgarla, así que sólo se registrará en la bitácora que se emitió. Firma la nota de la consulta y vuelve a emitirla si necesitas que conste.</>}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="label" htmlFor="ref-tipo">Tipo de carta</label>
            <select id="ref-tipo" className="input" value={tipo} onChange={e => setTipo(e.target.value as Tipo)}>
              <option value="referencia">Referencia (envío a otro médico)</option>
              <option value="contrarreferencia">Contrarreferencia (respuesta al referente)</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="label" htmlFor="ref-urgencia">Urgencia</label>
            <select id="ref-urgencia" className="input" value={urgencia} onChange={e => setUrgencia(e.target.value as Urgencia)}>
              <option>Rutina</option><option>Prioritario</option><option>Urgente</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="label" htmlFor="ref-destino">Dirigido a (médico / especialidad)</label>
            <input id="ref-destino" className="input" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Dr(a). ___ / Cardiología" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="label" htmlFor="ref-institucion">Institución / hospital</label>
            <input id="ref-institucion" className="input" value={institucion} onChange={e => setInstitucion(e.target.value)} placeholder="Hospital ___" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ref-motivo">Motivo de la {tipo === 'referencia' ? 'referencia' : 'contrarreferencia'}</label>
          <textarea id="ref-motivo" className="input" value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder="Ej. Valoración y manejo de…" />
        </div>
        <div>
          <label className="label" htmlFor="ref-resumen">Resumen clínico (prellenado de la última nota — editable)</label>
          <textarea id="ref-resumen" className="input" value={resumen} onChange={e => setResumen(e.target.value)} rows={4} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label className="label" htmlFor="ref-diagnosticos">Diagnóstico(s)</label>
            <textarea id="ref-diagnosticos" className="input" value={diagnosticos} onChange={e => setDiagnosticos(e.target.value)} rows={3} />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label className="label" htmlFor="ref-tratamiento">Tratamiento actual</label>
            <textarea id="ref-tratamiento" className="input" value={tratamiento} onChange={e => setTratamiento(e.target.value)} rows={3} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ref-estudios">Estudios adjuntos / realizados</label>
          <textarea id="ref-estudios" className="input" value={estudios} onChange={e => setEstudios(e.target.value)} rows={2} placeholder="Laboratorios, imagen…" />
        </div>
      </div>

      {/* Documento (hoja blanca) */}
      <div id="doc" style={{
        maxWidth: 800, margin: '0 auto', background: '#fff', color: '#1a1a1a',
        padding: '40px 48px', borderRadius: 4, fontFamily: '"Times New Roman", Georgia, serif',
        lineHeight: 1.5, fontSize: 13,
      }}>
        {/* Membrete */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{medico}</div>
          <div style={{ fontSize: 12 }}>{especialidad}{especialidad && cedula !== '—' ? ' · ' : ''}{cedula !== '—' ? `Cédula Prof. ${cedula}` : ''}</div>
          {establecimiento && <div style={{ fontSize: 12 }}>{establecimiento}</div>}
          {config?.direccion && <div style={{ fontSize: 11, color: '#555' }}>{config.direccion}</div>}
          {(config?.telefonoAdmin || config?.whatsappConsultorio) && <div style={{ fontSize: 11, color: '#555' }}>Tel. {config.telefonoAdmin || config.whatsappConsultorio}</div>}
        </div>

        {/* Lugar: último segmento de la dirección del consultorio si lo hay; NUNCA
            una ciudad fija (antes decía "Chihuahua, Chih." para cualquier clínica). */}
        <div style={{ textAlign: 'right', fontSize: 12.5, marginBottom: 14 }}>{(() => { const lugar = config?.direccion?.split(',').pop()?.trim(); return lugar ? `${lugar}, a ${fecha}` : `A ${fecha}` })()}</div>

        {/* <h1>: el único encabezado real de la pantalla (axe
            page-has-heading-one, encontrado por el primer arnés propio de esta
            página). Los estilos en línea conservan el papel IDÉNTICO. */}
        <h1 style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>
          {titulo}
          {urgencia !== 'Rutina' && <span style={{ color: 'var(--red)' }}> · {urgencia.toUpperCase()}</span>}
        </h1>

        {(destino || institucion) && (
          <div style={{ marginBottom: 12, fontSize: 12.5 }}>
            <strong>{destino || 'A quien corresponda'}</strong>{institucion ? <><br />{institucion}</> : null}<br />P r e s e n t e.
          </div>
        )}

        {/* Datos del paciente */}
        <div style={{ marginBottom: 10, fontSize: 12.5 }}>
          <strong>Paciente:</strong> {patient?.nombre ?? ''}
          {/* C-018 — esta hoja viaja a OTRO médico: «1 años» no. */}
          {edadLegible(patient?.edad) ? ` · ${edadLegible(patient?.edad)}` : ''}{patient?.sexo ? ` · ${patient.sexo}` : ''}{patient?.telefono ? ` · Tel: ${patient.telefono}` : ''}
        </div>
        <div style={{ border: '1.5px solid #b91c1c', color: 'var(--red)', borderRadius: 4, padding: '5px 10px', fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
          {/* Misma fuente que la pantalla y que la receta: leer `patient.alergias`
              en crudo se salta el campo estructurado, y esta hoja viaja a OTRO
              médico. */}
          ALERGIAS: {alergiasParaElPapel(patient)}
        </div>

        {/* Cuerpo */}
        <p style={{ marginBottom: 12, fontSize: 12.5 }}>
          Por medio de la presente me permito {tipo === 'referencia' ? 'referir' : 'contrarreferir'} al paciente arriba mencionado{destino ? ` a su valiosa atención` : ''}, con el siguiente motivo:
        </p>

        {motivo && <Bloque titulo="Motivo">{motivo}</Bloque>}
        {resumen && <Bloque titulo="Resumen clínico">{resumen}</Bloque>}
        {diagnosticos && <Bloque titulo="Diagnóstico(s)">{diagnosticos}</Bloque>}
        {tratamiento && <Bloque titulo="Tratamiento actual">{tratamiento}</Bloque>}
        {estudios && <Bloque titulo="Estudios">{estudios}</Bloque>}

        <p style={{ marginTop: 14, fontSize: 12.5 }}>
          Agradezco de antemano su valiosa atención y quedo a sus órdenes para cualquier información adicional que requiera.
        </p>

        {/* Firma */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #1a1a1a', width: 280, margin: '0 auto', paddingTop: 4, fontSize: 12.5 }}>
            <strong>{medico}</strong><br />
            {especialidad}{especialidad ? <br /> : null}
            {/* Cédula = dato obligatorio: marcar su ausencia, no imprimir un guion. */}
            {cedula !== '—'
              ? <>Cédula Profesional {cedula}</>
              : <span style={{ color: 'var(--red)', fontWeight: 700 }}>[FALTA CÉDULA PROFESIONAL]</span>}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #doc, #doc * { visibility: visible !important; }
          #doc { position: absolute; top: 0; left: 0; width: 100%; max-width: none; margin: 0; padding: 24px 28px; border-radius: 0; }
          .no-print { display: none !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{titulo}:</div>
      <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{children}</div>
    </div>
  )
}
