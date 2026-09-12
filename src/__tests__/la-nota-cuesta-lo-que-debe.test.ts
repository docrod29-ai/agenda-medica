/**
 * GOLDEN — D-062 · la nota cuesta lo que debe.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * Medida la consulta de veinte minutos con nota Estándar: 19 pesos, de los
 * que 15 eran el BORRADOR EN VIVO —unos cuarenta pases de Haiku con el prompt
 * entero y la transcripción creciente— que el médico no mira mientras
 * atiende y que la nota final reemplaza. La Máxima costaba 37: la fusión GPT
 * más síntesis (otra nota entera, sin evidencia de mejora y con antecedentes
 * de reescribir citas, REG-119) y el razonamiento máximo también en la
 * subsecuente de control, donde no hay nada que razonar.
 *
 * ── LO QUE SE HACE ───────────────────────────────────────────────────────────
 *
 * 1. El borrador en vivo lo arma el parser clínico local, en el navegador,
 *    sin red ni costo. La nota final y la preliminar siguen yendo al servidor.
 * 2. La nota Estándar escala sola a Máxima cuando señales DETERMINISTAS lo
 *    piden: polifarmacia (fármacos del diccionario o dosis con unidad),
 *    primera vez con comorbilidades, infectología con antimicrobianos o
 *    patógenos. El médico no elige (D-047); se le dice por qué.
 * 3. La fusión GPT va detrás de `NOTA_ENSAMBLE_GPT=1`, apagada.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * · Regla 5 de seguridad clínica: las señales son VOCABULARIO, no criterio.
 *   Que ninguna se dispare significa «no se detectó», nunca «es simple». El
 *   error posible es escalar de menos, y ése no toca la nota: sale igual de
 *   bien ordenada, con Sonnet, y el médico puede pedir la segunda opinión.
 * · Los umbrales son de enrutado (cuánto cómputo se gasta), no clínicos.
 * · El pase en vivo sólo rellena huecos (ya lo vigilaba la pantalla); el
 *   borrador local no pinta el texto de respaldo ni marca campos faltantes,
 *   porque aquí no hubo ningún fallo que avisar.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No mide el costo real: eso es el libro de costos en producción.
 * · No juzga si la nota Máxima es mejor que la Estándar en el caso difícil:
 *   eso es la prueba a ciegas de veinte dictados, pendiente del dueño.
 * · El diccionario de fármacos del parser es preoperatorio y corto (de 16
 *   fármacos comunes reconoce 4); por eso la señal de polifarmacia también
 *   cuenta dosis con unidad. Un dictado sin dosis y con fármacos que el
 *   diccionario no conoce se queda en Estándar: señalar de menos.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { evaluarComplejidad, contarDosis, esInfectologia, UMBRALES } from '@/lib/expediente/complejidad'
import { borradorLocal } from '@/lib/expediente/borrador-local'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('D-062 · señales deterministas de complejidad', () => {
  it('polifarmacia por dosis con unidad, aunque el diccionario no conozca los fármacos', () => {
    const t = 'Toma sitagliptina 100 mg, levotiroxina 75 mcg, sertralina 50 mg, amlodipino 5 mg y omeprazol 20 mg cada mañana.'
    expect(contarDosis(t)).toBe(5)
    const c = evaluarComplejidad(t, 'subsecuente')
    expect(c.compleja).toBe(true)
    expect(c.motivos.join(' ')).toMatch(/polifarmacia/)
  })

  it('polifarmacia por fármacos del diccionario, sin una sola dosis', () => {
    const c = evaluarComplejidad('Continúa con losartán, atorvastatina y warfarina.', 'subsecuente')
    expect(c.senales.medicamentos).toBeGreaterThanOrEqual(UMBRALES.medicamentos)
    expect(c.compleja).toBe(true)
  })

  it('una subsecuente con dos fármacos y una dosis NO escala', () => {
    const c = evaluarComplejidad('Toma metformina 850 mg y losartán. Presión controlada, sin cambios.', 'subsecuente')
    expect(c.compleja).toBe(false)
    expect(c.motivos).toEqual([])
  })

  it('primera vez con tres comorbilidades escala; la misma frase en subsecuente, no', () => {
    const t = 'Primera vez. Antecedentes de diabetes, hipertensión arterial y EPOC. Viene por tos.'
    expect(evaluarComplejidad(t, 'historia_clinica').compleja).toBe(true)
    expect(evaluarComplejidad(t, 'primera_vez').compleja).toBe(true)
    expect(evaluarComplejidad(t, 'subsecuente').compleja).toBe(false)
  })

  it('infectología con antimicrobianos y patógenos escala; otra especialidad con el mismo texto, no', () => {
    const t = 'Cultivo con Pseudomonas aeruginosa, se inicia meropenem y vancomicina.'
    expect(esInfectologia('Infectología')).toBe(true)
    expect(esInfectologia('Cardiología')).toBe(false)
    expect(evaluarComplejidad(t, 'subsecuente', 'Infectología').compleja).toBe(true)
    expect(evaluarComplejidad(t, 'subsecuente', 'Cardiología').compleja).toBe(false)
  })

  it('AL REVÉS: sin dictado no hay señal, y sin señal no se afirma que el caso sea simple', () => {
    const c = evaluarComplejidad('', 'subsecuente')
    expect(c.compleja).toBe(false)
    expect(c.motivos).toEqual([])
    // Las señales existen aunque valgan cero: el que lee sabe qué se miró.
    expect(Object.keys(c.senales).sort()).toEqual(['antimicrobianos', 'comorbilidades', 'dosisMencionadas', 'infectologia', 'medicamentos', 'patogenos', 'primeraVez'])
  })

  it('los umbrales son de enrutado y viven en un solo sitio', () => {
    expect(UMBRALES.dosisMencionadas).toBe(5)
    expect(UMBRALES.medicamentos).toBe(3)
    expect(UMBRALES.comorbilidadesEnPrimeraVez).toBe(3)
    expect(UMBRALES.antimicrobianosEnInfectologia).toBe(2)
  })
})

describe('D-062 · la ruta escala sola y lo dice, y la fusión va apagada', () => {
  const ruta = leer('src/app/api/expediente/procesar/route.ts')
  const codigo = sinComentarios(ruta)

  it('escala de Estándar a Máxima sólo cuando el servidor decide, nunca en el pase rápido ni con motor explícito', () => {
    expect(codigo).toContain("if (!rapido && !body.motor && motorPedido.clave === 'estandar') {")
    expect(codigo).toContain('const c = evaluarComplejidad(transcripcion, tipo, contexto.especialidad)')
    expect(codigo).toContain('if (c.compleja) { motorPedido = MOTORES.maxima; escalado = c.motivos }')
    // El motor por omisión sigue siendo el del plan (D-047): la expresión no cambia.
    expect(ruta).toContain('body.motor ? motorPorClave(body.motor) : motorPorDefecto(nivel)')
  })

  it('la respuesta dice por qué escaló', () => {
    expect(codigo).toContain('_escalado: escalado,')
  })

  it('la fusión GPT está detrás de una bandera y la bandera nace apagada', () => {
    expect(codigo).toContain("const ENSAMBLE_GPT = process.env.NOTA_ENSAMBLE_GPT === '1'")
    expect(codigo).toContain("const quiereEnsamble = ENSAMBLE_GPT && perfil === 'premium' && !modoEconomico && !rapido")
  })
})

describe('D-062 · el borrador en vivo no llama a ningún modelo', () => {
  const consulta = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

  it('en vivo no hay fetch: el borrador sale del parser local', () => {
    expect(consulta).toContain("const res = enVivo ? null : await fetchAutenticado('/api/expediente/procesar', {")
    expect(consulta).toContain('const data = enVivo ? borradorLocal(transcripcionParaIA, tipoActivo) : await res!.json().catch(() => null)')
    expect(consulta).toContain("import { borradorLocal } from '@/lib/expediente/borrador-local'")
  })

  it('el borrador local rellena sin avisar de un fallo que no hubo', () => {
    const b = borradorLocal('Paciente con diabetes e hipertensión. TA 130/80, FC 78. Toma losartán 50 mg.', 'primera_vez')
    expect(b._borradorLocal).toBe(true)
    expect(b._modelo).toBe('parser-local')
    expect(b.resumenEjecutivo).toBe('')
    expect(b.safety.missing_critical_fields).toEqual([])
    expect(JSON.stringify(b)).not.toMatch(/IA externa no disponible/)
    // Y sí extrae lo que el parser sabe extraer.
    expect(b.signosVitales.ta).toBe('130/80')
    // El diccionario preoperatorio conoce losartán (no metformina): se comprueba lo que sabe extraer.
    expect(b.medicamentos.map(m => m.nombre.toLowerCase()).join(' ')).toMatch(/losart/)
  })

  it('el pase en vivo no llena la bitácora con avisos de respaldo', () => {
    expect(consulta).toContain("if (!data._borradorLocal) safeLog.warn('[procesar] Fallback local. Causa:'")
  })

  it('la nota final y la preliminar siguen yendo al servidor con `rapido` sólo en la preliminar', () => {
    expect(consulta).toContain('rapido: enVivo || preliminar,')
  })
})
