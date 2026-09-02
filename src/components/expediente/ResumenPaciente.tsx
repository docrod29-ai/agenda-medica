'use client'
import { useMemo } from 'react'
import type { Patient } from '@/types'
import type { NotaMedica } from '@/types/expediente'
import { Activity } from 'lucide-react'
import { fechaCorta } from '@/lib/formato/fecha'
import { nombreConCerteza } from '@/lib/expediente/problemas-activos'

/**
 * RESUMEN DEL PACIENTE — "todo en un solo lugar".
 *
 * Lo que un médico quiere ver de un vistazo al abrir un expediente, sin
 * desplegar nada: alergias (destacadas), los signos vitales de la última visita,
 * los diagnósticos activos y cuándo fue la última consulta. Es la pantalla que
 * la competencia enseña como su punto fuerte; aquí la información YA existía,
 * solo estaba dispersa y plegada.
 *
 * Derivado, no capturado: los signos y diagnósticos salen de la última nota real;
 * si no hay notas, la tarjeta se muestra igual con lo que haya del paciente.
 */
export function ResumenPaciente({ patient, notas }: { patient: Patient | null; notas: NotaMedica[] }) {
  const orden = useMemo(() => [...notas].sort((a, b) => (b.fechaConsulta || b.createdAt || '').localeCompare(a.fechaConsulta || a.createdAt || '')), [notas])
  const ultima = orden[0] ?? null

  const signos = useMemo(() => {
    for (const n of orden) {
      if (n.signosVitales && Object.values(n.signosVitales).some(Boolean)) return n.signosVitales
    }
    return null
  }, [orden])

  /**
   * ── AQUÍ SE PERDÍA QUIÉN PUSO CADA DIAGNÓSTICO ───────────────────────────
   *
   * MEDIDO en navegador el 1-sep-2026, con un paciente sembrado a propósito con
   * los tres ejes del modelo: los cuatro diagnósticos vigentes se pintaban en el
   * MISMO nodo de texto, con el mismo color, peso y tamaño, bajo el rótulo
   * «Diagnósticos activos» — uno definitivo puesto por el médico y otro que la
   * IA propuso y nadie avaló, indistinguibles.
   *
   * La causa: este `useMemo` empujaba `d.descripcion` PELADA. `tipo` y
   * `tipoOrigen` viajaban en el documento y se tiraban aquí.
   *
   * ── LO QUE NO SE HACE, Y POR QUÉ ─────────────────────────────────────────
   *
   * NO se etiqueta `presuntivo`. REG-365 lo decidió y sigue siendo correcto: es
   * el valor de fábrica del esquema —«nadie dijo nada»—, y escribir «(presuntivo)»
   * junto a una crónica confirmada afirma una duda que el médico nunca expresó,
   * en casi todos los renglones.
   *
   * Lo que sí se dice es la PROCEDENCIA, que es otro eje y hoy era invisible:
   * `tipoOrigen === 'medico'` es «lo eligió una persona» y el resto no. Es la
   * misma frontera que `la-certeza-que-sale-al-mundo` ya aplica al salir a FHIR
   * (`confirmed` sólo con `medico`) y la que la consulta ya avisa antes de
   * firmar. `requisitos.ts` declaraba el hueco: «FALTA la misma elección en las
   * otras superficies que muestran diagnósticos (expediente…)».
   *
   * Y se dice **una vez y no por fila**, con la regla que ya eligió la consulta:
   * un aviso por diagnóstico, en una lista de seis, es ruido que se aprende a
   * saltar. `por_defecto` cuenta igual que `extraccion`: en los dos casos nadie
   * lo decidió.
   */
  const dxActivos = useMemo(() => {
    const vistos = new Set<string>()
    const out: { texto: string; loEligioUnaPersona: boolean }[] = []
    for (const n of orden) {
      for (const d of n.diagnosticos ?? []) {
        const k = d.descripcion.trim().toLowerCase()
        if (!k || vistos.has(k)) continue
        if (d.estado === 'resuelto' || d.tipo === 'descartado') continue
        vistos.add(k)
        // `nombreConCerteza` y no la descripción a secas: UNA definición para
        // todos los lectores (REG-364).
        out.push({ texto: nombreConCerteza(d), loEligioUnaPersona: d.tipoOrigen === 'medico' })
        if (out.length >= 6) return out
      }
    }
    return out
  }, [orden])

  const sinAvalar = dxActivos.filter(d => !d.loEligioUnaPersona).length

  const ultimaFecha = ultima?.fechaConsulta || ultima?.createdAt
  /* Era `{ day: '2-digit' }` y daba «01 sep 2026», mientras dos renglones más
     abajo la MISMA pantalla decía «1 sep 2026» y una tercera línea decía
     «2026-09-01». Tres lecturas de la misma clase de hecho en un pliegue.
     Ahora sale del módulo único (`@/lib/formato/fecha`). */
  const fmt = (iso?: string) => fechaCorta(iso) || null

  const vitales: { label: string; valor: string }[] = []
  if (signos) {
    if (signos.ta) vitales.push({ label: 'TA', valor: `${signos.ta}` })
    if (signos.fc) vitales.push({ label: 'FC', valor: `${signos.fc}` })
    if (signos.fr) vitales.push({ label: 'FR', valor: `${signos.fr}` })
    if (signos.temperatura) vitales.push({ label: 'T°', valor: `${signos.temperatura}` })
    if (signos.spo2) vitales.push({ label: 'SpO₂', valor: `${signos.spo2}%` })
    if (signos.peso) vitales.push({ label: 'Peso', valor: `${signos.peso} kg` })
    if (signos.imc) vitales.push({ label: 'IMC', valor: `${signos.imc}` })
    if (signos.glucometria) vitales.push({ label: 'Gluc', valor: `${signos.glucometria}` })
  }

  /**
   * RTC-10 — UNA TARJETA VACÍA NO ES INFORMACIÓN: ES INVENTARIO.
   *
   * Medido en navegador el 14-ago sobre los TRES expedientes sembrados —el que
   * tiene notas incluido—: dos de las tres tarjetas decían «Sin signos
   * registrados aún» / «Sin diagnósticos activos», con su caja, su borde y su
   * encabezado a peso completo. Dos cajas del primer viewport de un expediente
   * clínico ocupadas por la ausencia de dato, empujando la historia clínica a
   * 743px. Es el §7 al revés: el primer viewport tenía que ser el paciente.
   *
   * Lo que NO se hace: desaparecer el hecho. «Ausencia de dato no es dato de
   * ausencia» (regla 4 de seguridad clínica) va en las dos direcciones — que no
   * haya signos registrados es información sobre el EXPEDIENTE y el médico
   * tiene derecho a leerla. Así que lo vacío no se borra: se degrada a una
   * línea callada, y por eso el texto habla del registro («sin registro»), no
   * del paciente. «Sin diagnósticos activos» sonaba a afirmación clínica sobre
   * la persona; era el mismo defecto en palabras.
   */
  const conSignos = vitales.length > 0
  const conDx = dxActivos.length > 0
  const ausentes = [
    ...(conSignos ? [] : ['signos']),
    ...(conDx ? [] : ['diagnósticos']),
  ]

  return (
    /**
     * RTC-31 / 4ª pasada de §29 — LA FILA DE TARJETAS-ESTADÍSTICA SE VA.
     *
     * Su CONTENIDO siempre fue clínico y específico; su FORMA era la fila de
     * KPIs de cualquier tablero, y era el residuo que la 4ª pasada nombró en
     * `/expediente` junto a las píldoras. Tres cajas con borde, encabezado en
     * versalitas y una cifra grande dentro: el gesto de «dashboard», no el de
     * un expediente.
     *
     * Lo que se pinta ahora es lo que un médico escribe: los signos en una
     * línea («TA 118/74 · FC 82 · T° 36.8»), los diagnósticos en la suya, y la
     * actividad al final en voz baja. Es EXACTAMENTE la anatomía del bloque de
     * «Problemas / Toma» que va justo debajo (`#spine-problemas`) — dos
     * bloques vecinos que dicen cosas del mismo orden ya no hablan idiomas
     * distintos.
     *
     * No se pierde ni un dato: los mismos signos, los mismos diagnósticos, el
     * mismo conteo, la misma línea honesta cuando algo falta.
     */
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
      background: 'var(--s2)', border: '1px solid var(--border)',
      borderRadius: 11, padding: '10px 13px',
    }}>
      <Activity size={16} style={{ color: 'var(--text3)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, minWidth: 0 }}>
        {conSignos && (
          <div>
            <strong style={{ color: 'var(--text)' }}>Últimos signos:</strong>{' '}
            {vitales.map((v, i) => (
              <span key={v.label}>
                {i > 0 && ' · '}
                <span style={{ color: 'var(--text3)' }}>{v.label}</span>{' '}
                <span className="nx-num" style={{ color: 'var(--text)' }}>{v.valor}</span>
              </span>
            ))}
          </div>
        )}

        {conDx && (
          <div>
            <strong style={{ color: 'var(--text)' }}>Diagnósticos activos:</strong>{' '}
            {dxActivos.map(d => d.texto).join(' · ')}
            {sinAvalar > 0 && (
              /* Una vez, no por fila. Y en pasado: estas notas ya están
                 firmadas, así que no es un aviso para antes de firmar — es lo
                 que el médico necesita saber al LEER su propio expediente. */
              <div className="nx-meta" style={{ marginTop: 2 }}>
                El tipo de {sinAvalar === 1 ? 'uno de ellos lo puso' : `${sinAvalar} de ellos lo puso`} el dictado
                o la plantilla, no una persona.
              </div>
            )}
          </div>
        )}

        <div>
          <strong style={{ color: 'var(--text)' }}>Actividad:</strong>{' '}
          <span className="nx-num">{notas.length}</span>
          {notas.length === 1 ? ' consulta' : ' consultas'}
          {fmt(ultimaFecha) ? <> · última visita <span className="nx-num">{fmt(ultimaFecha)}</span></> : ''}
        </div>

        {ausentes.length > 0 && (
          /* Lo que falta se DICE, y habla del registro. No desaparece porque
             que el expediente no traiga signos es algo que el médico necesita
             saber antes de prescribir. */
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
            Este expediente todavía no tiene {ausentes.join(' ni ')} registrados.
          </div>
        )}
      </div>
    </div>
  )
}

