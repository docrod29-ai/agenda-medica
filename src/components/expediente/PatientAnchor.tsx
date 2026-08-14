'use client'
import { useMemo, type ReactNode } from 'react'
import { AlertTriangle, Mic } from 'lucide-react'
import type { Patient } from '@/types'
import type { NotaMedica } from '@/types/expediente'
import { TIPO_NOTA_LABEL } from '@/types/expediente'
import { avatarColor } from '@/lib/avatar-color'
import { alergenosDe, negacionesEnTexto } from '@/lib/seguridad/alergias'

/**
 * PATIENT ANCHOR — V15-PATIENT-WORKSPACE-001 (§7: identidad, edad/sexo,
 * alergia/seguridad, encuentro actual, último cambio — SIEMPRE visible).
 *
 * Antes del expediente había DOS bloques sueltos e independientes en la parte
 * de arriba: el banner de alergias y el encabezado de identidad. El médico
 * tenía que conciliar dos avisos para una sola pregunta ("¿en qué paciente
 * estoy y qué necesito saber ya?"). Aquí es UN ancla, pegajosa (`sticky`)
 * dentro del contenedor de scroll real (`<main>` en el layout del dashboard,
 * `overflowY: auto`), así que no se pierde al bajar por el expediente largo.
 *
 * "Encuentro actual" y "último cambio" NO abren una consulta nueva a
 * Firestore: se derivan de `notas`, la MISMA lista que ya carga
 * `useExpediente` en la página — una entidad, una fuente de verdad.
 */
export function PatientAnchor({
  patient, notas, errorPaciente, onContinuarEncuentro, accion,
}: {
  patient: Patient | null
  notas: NotaMedica[]
  errorPaciente?: string
  onContinuarEncuentro: (notaId: string) => void
  /**
   * RTC-31 (5ª rebanada) — LA ACCIÓN PRIMARIA DEL EXPEDIENTE, MEDIDA.
   *
   * «Nueva consulta» vivía en una fila propia debajo del riel del Spine.
   * Medido en navegador sobre los tres expedientes sembrados:
   *
   *   escritorio  fila de 43px + 24px de margen · **720px sin usar a su
   *               izquierda** (la mitad del lienzo, vacía)
   *   móvil       44px + 24px, a todo el ancho — ahí NO sobra espacio: es el
   *               objetivo del pulgar de V10-DEBT-006
   *
   * Así que la fila entera existía para sostener un botón que ya tenía sitio:
   * el ancla, que es donde vive la otra acción del paciente («Consulta sin
   * cerrar — continuar»). Sube aquí, y en el teléfono la fila del ancla la
   * deja caer a su propio renglón completo — la misma variante que ya usa
   * `continuar`, no una amputación.
   */
  accion?: ReactNode
}) {
  const { encuentroActivo, ultimoCambio } = useMemo(() => {
    const orden = [...notas].sort((a, b) =>
      (b.fechaConsulta || b.createdAt || '').localeCompare(a.fechaConsulta || a.createdAt || ''))
    return {
      // Un borrador sin firmar es un encuentro que empezó y no cerró — la
      // misma noción que ya usa CabosSueltosDelPaciente, leída aquí sin
      // duplicar su consulta.
      encuentroActivo: orden.find(n => n.estado !== 'firmada') ?? null,
      ultimoCambio: orden.find(n => n.estado === 'firmada') ?? null,
    }
  }, [notas])

  /* La negación de alergias NO se decide aquí — REG-311. Una copia local de
     esa regla («empieza por niega/no/sin…») fue REG-279, y esta ancla nació
     con la séptima copia: «Niega penicilina. Alérgico a sulfas» salía como
     «sin alergias» en gris. `alergenosDe` aplica la semántica sellada
     (negadas exige negación explícita Y que no quede ningún alérgeno, leyendo
     también `alergiasEstructuradas`), y «no registradas» queda en ámbar:
     ausencia de dato no es dato de ausencia (regla 4). */
  const alergenos = useMemo(() => alergenosDe(patient ?? {}), [patient])
  const alergiasNegadas = alergenos.length === 0 && negacionesEnTexto(patient?.alergias).length > 0
  const colores = avatarColor(patient?.nombre ?? 'Paciente')

  return (
    <div className="nx-patient-anchor" style={{
      position: 'sticky', top: 0, zIndex: 4,
      background: 'var(--bg)', paddingTop: 10, paddingBottom: 12,
      marginBottom: 16, borderBottom: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: colores.bg, color: colores.fg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-display)',
        }}>
          {(patient?.nombre ?? 'P').charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* La página no tiene otro <h1>: el nombre del paciente es el
              encabezado de nivel 1 de todo el expediente (page-has-heading-one).
              Nivel DISPLAY, no .nx-ident de fila: VISUAL_DNA §1 R3 reserva la
              serif Fraunces para «el nombre del paciente en su espacio
              clínico» — y este ancla es exactamente ese espacio.
              `.nx-vt-paciente` (§20, continuidad.ts): en una navegación
              coreografiada este <h1> es el DESTINO del nombre que viene de la
              fila de Hoy — y el ORIGEN al continuar hacia la consulta. */}
          <h1 className="nx-display nx-ancla-nombre nx-vt-paciente">
            {patient?.nombre ?? 'Paciente'}
          </h1>
          <div className="nx-meta" style={{ marginTop: 2 }}>
            {patient?.edad ? `${patient.edad} años` : ''}{patient?.sexo ? ` · ${patient.sexo}` : ''}
            {patient?.telefono ? ` · ${patient.telefono}` : ''}
          </div>
        </div>
        {encuentroActivo && (
          <button
            className="nx-anchor-continuar"
            onClick={() => onContinuarEncuentro(encuentroActivo.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)',
              color: 'var(--amber)', borderRadius: 'var(--r-pill)', padding: '6px 12px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <Mic size={13} /> Consulta sin cerrar — continuar
          </button>
        )}
        {accion && <div className="nx-ancla-accion">{accion}</div>}
      </div>
      {/* Bajo 480px el nombre puede partirse en varias líneas: el CTA de
          "continuar" comparte fila con un bloque de ancho variable y queda
          apretado a media altura. Su propia fila completa evita eso sin
          tocar el orden DOM ni el layout de escritorio. */}
      <style>{`
        @media (max-width: 480px) {
          .nx-anchor-continuar { flex-basis: 100%; }
        }
        /* LA ACCIÓN NO PUEDE METERSE ENTRE EL PACIENTE Y SUS ALERGIAS.
           Primera versión de esta rebanada: en el teléfono la acción caía a su
           propio renglón dentro de la fila de identidad… y empujaba el aviso de
           alergias 60px hacia abajo, quedando ENTRE el nombre y lo único que
           hay que leer antes de empezar a atender. Se vio en la captura, no en
           el código. En un ancho donde todo va en columna, el orden ES la
           jerarquía: identidad → alergias → acción.
           Por eso hay dos sitios y sólo uno se pinta a la vez: en escritorio la
           acción vive en la fila del nombre (hay 172px libres a su derecha, y
           el aviso conserva su renglón entero); en el teléfono va DESPUÉS del
           aviso, a todo el ancho y con 44px para el pulgar. */
        @media (max-width: 768px) {
          .nx-ancla-accion { display: none; }
        }
        @media (min-width: 769px) {
          .nx-ancla-accion-movil { display: none; }
        }
        .nx-ancla-accion-movil { margin-top: 10px; }
        .nx-ancla-accion-movil > button { width: 100%; justify-content: center; min-height: 44px; }
      `}</style>

      {/* Ausencia de lectura ≠ ausencia de alergia (regla de seguridad clínica
          §4): si el paciente no se pudo LEER, se dice aquí en vez de pintar el
          aviso de alergias con datos que no llegaron. */}
      {errorPaciente ? (
        <div style={{
          ...alertaEstilo, color: 'var(--amber)',
          background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--amber) 40%, transparent)',
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {errorPaciente}
        </div>
      ) : (
        <div style={{
          ...alertaEstilo,
          color: alergenos.length ? 'var(--red)' : alergiasNegadas ? 'var(--text2)' : 'var(--amber)',
          background: alergenos.length
            ? 'color-mix(in srgb, var(--red) 12%, transparent)'
            : alergiasNegadas ? 'var(--s2)' : 'color-mix(in srgb, var(--amber) 8%, transparent)',
          borderColor: alergenos.length
            ? 'color-mix(in srgb, var(--red) 35%, transparent)'
            : alergiasNegadas ? 'var(--border)' : 'color-mix(in srgb, var(--amber) 35%, transparent)',
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          {/* Una alergia REGISTRADA es valor crítico (§2: peso + icono, nunca
              sólo color — el icono va al lado, en esta misma fila). «Negadas»
              es un dato neutro del registro; «no registradas» es un hueco y
              se dice en ámbar, no en gris. */}
          <span className={alergenos.length ? 'nx-critico' : undefined}>
            <strong>Alergias:</strong>{' '}
            {alergenos.length
              ? alergenos.join(' · ')
              : alergiasNegadas ? 'negadas por el paciente' : 'no registradas'}
          </span>
          {ultimoCambio && (
            <span className="nx-meta" style={{ marginLeft: 'auto' }}>
              Último cambio: {TIPO_NOTA_LABEL[ultimoCambio.tipo]} · {formatoRelativo(ultimoCambio.fechaConsulta || ultimoCambio.createdAt)}
            </span>
          )}
        </div>
      )}

      {/* El segundo sitio de la acción — sólo visible en el teléfono. Ver el
          porqué en el bloque de estilos: aquí el orden es la jerarquía y las
          alergias van antes que empezar a atender. */}
      {accion && <div className="nx-ancla-accion-movil">{accion}</div>}
    </div>
  )
}

function formatoRelativo(iso?: string): string {
  if (!iso) return '—'
  try {
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (dias <= 0) return 'hoy'
    if (dias === 1) return 'hace 1 día'
    if (dias < 30) return `hace ${dias} días`
    return new Date(iso).toLocaleDateString('es-MX', { dateStyle: 'medium' })
  } catch { return '—' }
}

const alertaEstilo: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8,
  padding: '9px 13px', fontSize: 12, border: '1px solid var(--border)', flexWrap: 'wrap',
}
