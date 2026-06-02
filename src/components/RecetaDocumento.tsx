'use client'
/**
 * Componente puro que renderiza una receta médica imprimible.
 *
 * Recibe los datos necesarios y la configuración del médico (template).
 * Se diseñó para verse bien tanto en pantalla como impreso (CSS @page configurado por el padre).
 *
 * Soporta 3 estilos: minimalista, clásico, moderno.
 * Si el médico subió su membrete (imagen), se usa esa en vez del encabezado generado.
 */
import type { ClinicConfig, Patient, RecetaConfig } from '@/types'
import { PAPER_SIZES } from '@/lib/receta-template'
import type { Medicamento } from '@/types/expediente'

export interface RecetaData {
  /** Tipo de impreso: 'receta' (Rx) o 'orden' (orden médica) */
  tipo: 'receta' | 'orden'
  /** Folio único de la receta */
  folio: string
  /** Fecha de emisión */
  fecha: Date
  /** Paciente */
  paciente: Patient | null
  /** Diagnóstico principal (opcional) */
  diagnostico?: string
  /** Medicamentos (para receta) */
  medicamentos?: Medicamento[]
  /** Estudios solicitados (para orden) */
  estudios?: string[]
  /** Indicaciones generales */
  indicaciones?: string
  /** Aviso al paciente */
  notaParaPaciente?: string
}

export interface RecetaDocumentoProps {
  data: RecetaData
  config: ClinicConfig | null
  recetaConfig: RecetaConfig
  /** ID DOM del contenedor para que html2pdf lo capture */
  containerId?: string
}

export function RecetaDocumento({ data, config, recetaConfig, containerId = 'receta-doc' }: RecetaDocumentoProps) {
  const paper = PAPER_SIZES[recetaConfig.paperSize ?? 'media-carta']
  const accent = recetaConfig.colorAccento ?? '#14b8a6'
  const estilo = recetaConfig.estilo ?? 'minimalista'

  // Si el médico subió su diseño completo, lo usamos como fondo y solo sobreponemos
  // los datos dinámicos. Este es el modo "tu propio papel".
  if (recetaConfig.disenoCompletoDataUrl) {
    return (
      <DocumentoConDisenoCustom
        data={data}
        config={config}
        recetaConfig={recetaConfig}
        containerId={containerId}
        paper={paper}
      />
    )
  }

  const medico = config?.nombreMedico ?? '—'
  const cedula = config?.cedulaProfesional ?? '—'
  const especialidad = config?.especialidad ?? ''
  const clinica = config?.nombreClinica ?? ''
  const direccion = config?.direccion ?? ''
  const telefono = config?.telefonoAdmin || config?.whatsappConsultorio || ''

  const fontFamily = estilo === 'clasico'
    ? '"Times New Roman", Georgia, serif'
    : estilo === 'moderno'
    ? '"Helvetica Neue", Arial, sans-serif'
    : '"Inter", system-ui, -apple-system, sans-serif'

  return (
    <div
      id={containerId}
      style={{
        width: `${paper.widthMm}mm`,
        minHeight: `${paper.heightMm}mm`,
        background: '#ffffff',
        color: '#1a1a1a',
        fontFamily,
        fontSize: 11,
        lineHeight: 1.35,
        padding: '10mm 12mm',
        boxSizing: 'border-box',
        position: 'relative',
        margin: '0 auto',
        boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
      }}
    >
      {/* Encabezado: membrete subido o auto-generado */}
      {recetaConfig.membreteDataUrl ? (
        // Membrete custom: imagen completa que el médico subió
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recetaConfig.membreteDataUrl}
          alt="Membrete"
          style={{
            width: '100%',
            maxHeight: '40mm',
            objectFit: 'contain',
            display: 'block',
            marginBottom: 6,
          }}
        />
      ) : (
        <EncabezadoAuto estilo={estilo} accent={accent} medico={medico} cedula={cedula} especialidad={especialidad} clinica={clinica} direccion={direccion} telefono={telefono} />
      )}

      {/* Banda de tipo de documento */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
        borderTop: estilo === 'clasico' ? '1.5px solid #1a1a1a' : `1.5px solid ${accent}`,
        borderBottom: estilo === 'clasico' ? '1.5px solid #1a1a1a' : `1.5px solid ${accent}`,
        margin: '6px 0',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        <div style={{ color: accent }}>{data.tipo === 'receta' ? 'Receta Médica' : 'Orden Médica'}</div>
        <div style={{ fontSize: 9.5, color: '#666', fontWeight: 500 }}>
          Folio: {data.folio} · {data.fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* Datos del paciente */}
      <table style={{ width: '100%', fontSize: 10.5, marginBottom: 6, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ padding: '1px 0', width: '70%' }}>
              <strong>Paciente:</strong> {data.paciente?.nombre ?? '—'}
            </td>
            <td style={{ padding: '1px 0', textAlign: 'right' }}>
              {data.paciente?.edad ? `Edad: ${data.paciente.edad}` : ''}
              {data.paciente?.sexo ? ` · ${data.paciente.sexo}` : ''}
            </td>
          </tr>
          {data.paciente?.telefono && (
            <tr><td colSpan={2} style={{ padding: '1px 0', fontSize: 10 }}><strong>Tel:</strong> {data.paciente.telefono}</td></tr>
          )}
        </tbody>
      </table>

      {/* Alergias destacadas */}
      {recetaConfig.mostrarAlergias !== false && (
        <div style={{
          border: '1.2px solid #b91c1c',
          color: '#b91c1c',
          borderRadius: 4,
          padding: '3px 8px',
          fontSize: 10,
          fontWeight: 700,
          marginBottom: 6,
        }}>
          ALERGIAS: {data.paciente?.alergias || 'Negadas / no referidas'}
        </div>
      )}

      {/* Diagnóstico (si aplica) */}
      {recetaConfig.mostrarDiagnostico !== false && data.diagnostico && (
        <div style={{ marginBottom: 6, fontSize: 10.5 }}>
          <strong>Dx:</strong> {data.diagnostico}
        </div>
      )}

      {/* Cuerpo: Rx o estudios */}
      {data.tipo === 'receta' && data.medicamentos && data.medicamentos.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {/* Símbolo Rx grande para estilo clásico */}
          {estilo === 'clasico' && (
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, fontFamily: 'serif' }}>℞</div>
          )}
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11, lineHeight: 1.5 }}>
            {data.medicamentos.map((m, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <strong>{m.nombre}{m.dosis ? ` ${m.dosis}` : ''}</strong>
                {m.via && <span> · {m.via}</span>}
                <br />
                <span style={{ fontSize: 10.5 }}>
                  {m.frecuencia}
                  {m.duracion && ` por ${m.duracion}`}
                  {m.indicacion && ` — ${m.indicacion}`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {data.tipo === 'orden' && data.estudios && data.estudios.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Estudios solicitados:</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11, lineHeight: 1.5 }}>
            {data.estudios.map((e, i) => <li key={i}>{e}</li>)}
          </ol>
        </div>
      )}

      {/* Indicaciones generales */}
      {data.indicaciones && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, marginBottom: 2 }}>Indicaciones generales:</div>
          <div style={{ fontSize: 10.5, whiteSpace: 'pre-wrap' }}>{data.indicaciones}</div>
        </div>
      )}

      {/* Nota para el paciente */}
      {data.notaParaPaciente && (
        <div style={{
          fontSize: 10,
          background: estilo === 'moderno' ? `${accent}10` : '#f5f5f5',
          padding: '4px 8px',
          borderLeft: `2px solid ${accent}`,
          marginBottom: 8,
          borderRadius: 2,
        }}>
          {data.notaParaPaciente}
        </div>
      )}

      {/* Firma del médico */}
      <div style={{ marginTop: 'auto', paddingTop: 14, textAlign: 'center' }}>
        {/* Imagen de firma + sello sobre la línea (si el médico la subió) */}
        {config?.firmaImagenDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={config.firmaImagenDataUrl}
            alt="Firma del médico"
            style={{
              maxHeight: '18mm',
              maxWidth: '60mm',
              margin: '0 auto -4mm auto', // -4mm: ligero overlap con la línea
              display: 'block',
              objectFit: 'contain',
            }}
          />
        )}
        <div style={{
          borderTop: '1px solid #1a1a1a',
          width: 200,
          margin: '0 auto',
          paddingTop: 3,
          fontSize: 10,
        }}>
          <strong>{medico}</strong><br />
          {especialidad && <>{especialidad}<br /></>}
          Cédula Prof. {cedula}
          {recetaConfig.registroDGP && <><br />Reg. DGP/SSA {recetaConfig.registroDGP}</>}
        </div>
      </div>

      {/* Pie subido o aviso legal */}
      {recetaConfig.pieDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recetaConfig.pieDataUrl}
          alt="Pie de página"
          style={{
            width: '100%',
            maxHeight: '15mm',
            objectFit: 'contain',
            marginTop: 8,
          }}
        />
      ) : (
        recetaConfig.avisoLegal && (
          <div style={{
            marginTop: 10,
            fontSize: 8.5,
            color: '#666',
            textAlign: 'center',
            paddingTop: 4,
            borderTop: '1px dashed #ccc',
          }}>
            {recetaConfig.avisoLegal}
            {recetaConfig.vigenciaDias && (
              <> · Vigencia: {recetaConfig.vigenciaDias} días desde la emisión</>
            )}
          </div>
        )
      )}

      {/* QR de verificación opcional */}
      {recetaConfig.mostrarQR && (
        <div style={{ position: 'absolute', bottom: '8mm', right: '10mm', textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(`Folio:${data.folio}`)}&size=80x80&margin=2`}
            alt="QR de verificación"
            style={{ width: '14mm', height: '14mm' }}
          />
          <div style={{ fontSize: 7, color: '#999', marginTop: 1 }}>Verificación</div>
        </div>
      )}
    </div>
  )
}

/**
 * Encabezado auto-generado cuando el médico no subió membrete.
 * Se adapta al estilo (minimalista / clásico / moderno).
 */
function EncabezadoAuto({
  estilo, accent, medico, cedula, especialidad, clinica, direccion, telefono,
}: {
  estilo: 'minimalista' | 'clasico' | 'moderno'
  accent: string
  medico: string
  cedula: string
  especialidad: string
  clinica: string
  direccion: string
  telefono: string
}) {
  if (estilo === 'moderno') {
    return (
      <div style={{
        background: accent,
        color: '#fff',
        padding: '6mm 8mm',
        margin: '-10mm -12mm 6mm -12mm',
        borderRadius: 0,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.3 }}>{medico}</div>
        <div style={{ fontSize: 10.5, opacity: 0.95 }}>
          {especialidad}{especialidad && cedula !== '—' ? ' · ' : ''}{cedula !== '—' ? `Cédula ${cedula}` : ''}
        </div>
        {clinica && <div style={{ fontSize: 10, opacity: 0.9, marginTop: 1 }}>{clinica}</div>}
        {(direccion || telefono) && (
          <div style={{ fontSize: 9.5, opacity: 0.85 }}>
            {direccion}{direccion && telefono ? ' · ' : ''}{telefono}
          </div>
        )}
      </div>
    )
  }

  // Minimalista y clásico: encabezado centrado
  return (
    <div style={{
      textAlign: 'center',
      paddingBottom: 6,
      borderBottom: estilo === 'clasico' ? '2px solid #1a1a1a' : `1.5px solid ${accent}`,
      marginBottom: 6,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: estilo === 'minimalista' ? accent : '#1a1a1a' }}>{medico}</div>
      <div style={{ fontSize: 10, marginTop: 1 }}>
        {especialidad}{especialidad && cedula !== '—' ? ' · ' : ''}{cedula !== '—' ? `Cédula Prof. ${cedula}` : ''}
      </div>
      {clinica && <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>{clinica}</div>}
      {direccion && <div style={{ fontSize: 9.5, color: '#666' }}>{direccion}</div>}
      {telefono && <div style={{ fontSize: 9.5, color: '#666' }}>Tel. {telefono}</div>}
    </div>
  )
}

/**
 * Documento con diseño custom del médico.
 *
 * Renderiza la imagen del médico como fondo a tamaño completo de la hoja,
 * y sobre ella coloca SOLO el contenido dinámico (paciente, Rx, indicaciones,
 * firma) en una "zona de contenido" definida por los márgenes.
 *
 * El médico calibra los márgenes una vez en Configuración para que el
 * contenido caiga exactamente donde su papel lo espera.
 */
function DocumentoConDisenoCustom({
  data, config, recetaConfig, containerId, paper,
}: {
  data: RecetaData
  config: ClinicConfig | null
  recetaConfig: RecetaConfig
  containerId: string
  paper: { widthMm: number; heightMm: number }
}) {
  const margenes = recetaConfig.disenoMargenes ?? { top: 35, right: 12, bottom: 30, left: 12 }
  const fontSize = recetaConfig.disenoFontSize ?? 11

  return (
    <div
      id={containerId}
      style={{
        width: `${paper.widthMm}mm`,
        height: `${paper.heightMm}mm`,
        position: 'relative',
        background: '#fff',
        margin: '0 auto',
        boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
        color: '#1a1a1a',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Diseño del médico como <img> — preserva aspect ratio sin distorsión.
          object-fit:contain → si el aspect ratio no coincide exacto, mantiene
          la proporción y rellena el resto con fondo blanco (mejor que estirar). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={recetaConfig.disenoCompletoDataUrl}
        alt="Diseño de receta"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',  // PRESERVA RATIO — sin distorsión
          objectPosition: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        draggable={false}
      />
      {/* Área de contenido — los márgenes definen dónde empieza y termina */}
      <div
        style={{
          position: 'absolute',
          top: `${margenes.top}mm`,
          right: `${margenes.right}mm`,
          bottom: `${margenes.bottom}mm`,
          left: `${margenes.left}mm`,
          fontSize: `${fontSize}px`,
          lineHeight: 1.35,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modo "solo Rx": oculta folio/paciente/dx porque ya están pre-impresos en el papel */}
        {!recetaConfig.disenoSoloRx && (
          <>
            {/* Folio + fecha (esquina superior derecha del área) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: fontSize - 1, color: '#444', marginBottom: 4 }}>
              <span>{data.fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              <span style={{ fontFamily: 'monospace' }}>Folio: {data.folio}</span>
            </div>

            {/* Paciente */}
            <div style={{ marginBottom: 4 }}>
              <strong>Nombre:</strong> {data.paciente?.nombre ?? '—'}
              {data.paciente?.edad ? `   ·   Edad: ${data.paciente.edad}` : ''}
              {data.paciente?.sexo ? `   ·   ${data.paciente.sexo}` : ''}
            </div>

            {/* Diagnóstico opcional */}
            {recetaConfig.mostrarDiagnostico !== false && data.diagnostico && (
              <div style={{ marginBottom: 4 }}>
                <strong>Dx:</strong> {data.diagnostico}
              </div>
            )}

            {/* Alergias resaltadas (si está activo) */}
            {recetaConfig.mostrarAlergias !== false && data.paciente?.alergias && (
              <div style={{
                border: '1px solid #b91c1c', color: '#b91c1c',
                padding: '2px 6px', borderRadius: 3,
                fontSize: fontSize - 1, fontWeight: 700, marginBottom: 6,
              }}>
                ALERGIAS: {data.paciente.alergias}
              </div>
            )}

            {/* Línea separadora discreta */}
            <div style={{ height: 1, background: 'rgba(0,0,0,0.15)', margin: '4px 0 6px 0' }} />
          </>
        )}

        {/* Cuerpo: Rx o estudios */}
        {data.tipo === 'receta' && data.medicamentos && data.medicamentos.length > 0 && (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: fontSize, lineHeight: 1.5 }}>
            {data.medicamentos.map((m, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <strong>{m.nombre}{m.dosis ? ` ${m.dosis}` : ''}</strong>
                {m.via && <span> · {m.via}</span>}
                <br />
                <span style={{ fontSize: fontSize - 0.5 }}>
                  {m.frecuencia}
                  {m.duracion && ` por ${m.duracion}`}
                  {m.indicacion && ` — ${m.indicacion}`}
                </span>
              </li>
            ))}
          </ol>
        )}

        {data.tipo === 'orden' && data.estudios && data.estudios.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Estudios solicitados:</div>
            <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
              {data.estudios.map((e, i) => <li key={i}>{e}</li>)}
            </ol>
          </div>
        )}

        {/* Indicaciones generales */}
        {data.indicaciones && (
          <div style={{ marginTop: 6 }}>
            <strong>Indicaciones:</strong>
            <div style={{ whiteSpace: 'pre-wrap' }}>{data.indicaciones}</div>
          </div>
        )}

        {/* Nota destacada al paciente */}
        {data.notaParaPaciente && (
          <div style={{
            marginTop: 6, padding: '3px 6px', borderRadius: 3,
            background: 'rgba(255,200,0,0.15)', borderLeft: '2px solid #f59e0b',
            fontSize: fontSize - 0.5,
          }}>
            {data.notaParaPaciente}
          </div>
        )}
      </div>

      {/* Firma + sello (imagen) en la zona inferior central. Se posiciona ENCIMA del diseño
          del médico — si su diseño ya tenía firma impresa, debería quitar esta imagen. */}
      {config?.firmaImagenDataUrl && (
        <div style={{
          position: 'absolute',
          bottom: `${Math.max(4, margenes.bottom - 22)}mm`,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.firmaImagenDataUrl}
            alt="Firma"
            style={{ maxHeight: '20mm', maxWidth: '60mm', display: 'block' }}
          />
        </div>
      )}

      {/* QR opcional al pie (esquina inferior derecha, fuera del área de contenido) */}
      {recetaConfig.mostrarQR && (
        <div style={{
          position: 'absolute',
          bottom: `${Math.max(2, margenes.bottom - 16)}mm`,
          right: `${margenes.right}mm`,
          textAlign: 'center',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(`Folio:${data.folio}`)}&size=80x80&margin=2`}
            alt="QR"
            style={{ width: '12mm', height: '12mm', background: 'rgba(255,255,255,0.8)', padding: 2, borderRadius: 2 }}
          />
        </div>
      )}
    </div>
  )
}
