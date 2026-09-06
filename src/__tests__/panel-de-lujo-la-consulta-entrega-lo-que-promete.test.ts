/**
 * LA CONSULTA ENTREGA LO QUE PROMETE — Panel de Lujo 2026-09.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Seis hallazgos de la misma familia: **el dato existe, la pantalla lo promete,
 * y no llega**. Es la regla `el-dato-tiene-que-llegar.md` en seis sitios.
 *
 *   MC-002  Las indicaciones postoperatorias (cuidado de la herida, drenajes,
 *           signos de alarma) nunca llegaban a la hoja del paciente: el motor
 *           `comoSeLoExplico` tiene el bloque «Indicaciones de su médico» desde
 *           que se escribió y `indicacionesDelMedico` tenía CERO llamadores.
 *   PO-004  «Entregar al paciente» decía «si quieres que los lea, escríbelos en
 *           tus indicaciones» — y el paquete del portal no las lleva
 *           (`componerPaquete` fija `warningSigns: []` y `NotaParaElPaquete` ni
 *           siquiera tiene el campo).
 *   PG-002  El mismo defecto visto desde la consulta de gineco.
 *   MO-004  Los estudios dictados no llegaban a `estudiosOrden`: con receta, al
 *           firmar se iba directo a /receta y la orden se quedaba en el tintero.
 *   ASN-003 Los signos que la enfermera captura en su equipo viven en el
 *           servidor; «Iniciar consulta» abría una nota nueva y vacía sin
 *           mirarlos siquiera.
 *   ASN-012 Corregir un signo ya guardado no pedía motivo ni dejaba rastro por
 *           campo: eso sólo existía en Hospital (C-5), y el consultorio es justo
 *           donde la enfermera y el médico tocan el mismo campo.
 *   D-005   Los campos de la receta dentro de la consulta se nombraban sólo por
 *           marcador de posición, que desaparece al escribir.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Panel de Lujo 2026-09, auditores M-cirujano, PO/PG (voces de paciente),
 * MO (órdenes), AS-enfermería y D (diseño). Todos confirmados por el equipo
 * rojo, que además CORRIGIÓ una premisa: `indicacionesDelMedico` tampoco viajaba
 * por la hoja impresa, como se había supuesto — no tenía ningún llamador.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * Campos «escritos y sin conectar»: el motor los sabe pintar, el tipo los
 * declara, y quien monta el componente no se los pasa. Una prueba de contrato
 * del motor pasa en verde con el defecto vivo, porque el motor está bien.
 *
 * ── REGLA ───────────────────────────────────────────────────────────────────
 *
 * `el-dato-tiene-que-llegar.md`: «¿dónde acaba este dato? Si la respuesta es
 * "en la función que lo escribe", todavía no ha llegado». Y §3 de seguridad
 * clínica para ASN-012: un cambio sobre lo ya asentado no puede ser invisible.
 *
 * ── TIPO DE PRUEBA ──────────────────────────────────────────────────────────
 *
 * CONTRATO DE CABLEADO: se comprueba que quien monta pasa el dato, con la forma
 * exacta que lo hace llegar. Es lo único que node puede ver de un componente
 * cliente, y es justo donde estaba el hueco (el motor y el tipo ya estaban
 * bien). Se prueba al revés donde hay un camino que NO debe existir: el texto de
 * `EntregarAlPaciente` ya no puede prometer que las indicaciones viajan al
 * portal, porque no viajan.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * No cubre el portal: que `componerPaquete` lleve las indicaciones exige tocar
 * `src/lib/paciente/paquete-de-visita.ts`, que es de otra rebanada (handoff a
 * PORTAL). No cubre la extracción de estudios desde el dictado en el esquema del
 * modelo (PROMPTS-ASR): aquí se recogen los que el extractor de entidades ya
 * devuelve. No cubre que dos personas editen la misma nota a la vez
 * (concurrencia), que ASN-003 declara fuera de alcance.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { comoSeLoExplico } from '@/lib/paciente/como-se-lo-explico'

const raiz = process.cwd()
const leer = (...p: string[]) => readFileSync(join(raiz, ...p), 'utf8')
const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const entregar = leer('src', 'components', 'EntregarAlPaciente.tsx')

describe('MC-002 · las indicaciones del médico llegan a la hoja del paciente', () => {
  it('control: el motor sabe pintarlas, y las pinta LITERALES', () => {
    const bloques = comoSeLoExplico({ indicacionesDelMedico: 'No mojar la herida por 5 días' })
    const ind = bloques.find(b => b.titulo === 'Indicaciones de su médico')
    expect(ind).toBeTruthy()
    expect(ind!.lineas).toContain('No mojar la herida por 5 días')
  })

  it('la consulta se las pasa, elegidas por CLAVE de la plantilla y no por heurística', () => {
    expect(consulta).toMatch(/indicacionesDelMedico=\{CLAVES_DE_INDICACIONES/)
    expect(consulta).toMatch(/const CLAVES_DE_INDICACIONES/)
    for (const clave of ['planPostop', 'signosAlarma', 'indicacionesAlta']) {
      expect(consulta).toContain(`'${clave}'`)
    }
  })
})

describe('PO-004 · PG-002 — lo que no viaja no se promete', () => {
  it('el texto ya no dice que las indicaciones lleguen al portal', () => {
    expect(entregar).not.toMatch(/Si quieres que los lea, escríbelos en tus indicaciones/)
    expect(entregar).toMatch(/hoja impresa/)
    expect(entregar).toMatch(/todavía no viajan/)
  })

  it('control: el paquete sigue sin componer signos de alarma por su cuenta', () => {
    const paquete = leer('src', 'lib', 'paciente', 'paquete-de-visita.ts')
    expect(paquete).toMatch(/warningSigns: \[\]/)
  })
})

describe('MO-004 · los estudios dictados llegan a la orden', () => {
  it('la consulta recoge los estudios del extractor y los ofrece', () => {
    expect(consulta).toMatch(/entidades\?\.tests/)
    expect(consulta).toMatch(/setEstudiosOrden\(prev => \[\.\.\.prev/)
    expect(consulta).toMatch(/Agregarlos todos a la orden/)
  })

  it('no se agregan solos: el médico elige (lo que extrae el modelo se revisa)', () => {
    expect(consulta).toMatch(/se agregan a la orden médica sólo si tú lo pides/)
  })
})

describe('ASN-003 · la consulta sin cerrar del servidor se ofrece', () => {
  it('se busca una nota no firmada cuando se entra sin ?nota=', () => {
    expect(consulta).toContain('borradorDelServidor')
    expect(consulta).toMatch(/n\.estado !== 'firmada' && n\.id !== notaIdRef\.current/)
  })

  it('se OFRECE, no se adopta sola — y se puede empezar una nueva', () => {
    expect(consulta).toMatch(/Continuar esa consulta/)
    expect(consulta).toMatch(/Empezar una nueva/)
    expect(consulta).toMatch(/\?nota=\$\{borradorDelServidor\.id\}/)
  })

  it('dice si esa consulta ya trae signos capturados, que es el caso del hallazgo', () => {
    expect(consulta).toMatch(/conSignos/)
    expect(consulta).toMatch(/con signos vitales ya capturados/)
  })
})

describe('ASN-012 · corregir un signo ya guardado deja rastro', () => {
  it('hay línea base de lo guardado y se detecta el cambio', () => {
    expect(consulta).toContain('signosGuardadosRef')
    expect(consulta).toContain('correccionesDeSignos')
  })

  it('pide motivo sin bloquear y la constancia queda DENTRO de la nota', () => {
    expect(consulta).toMatch(/Motivo \(ej\./)
    expect(consulta).toMatch(/agregarASeccion\('correccionDeSignos', 'Correcciones de signos vitales'\)/)
    expect(consulta).toMatch(/sin motivo declarado/)
  })
})

describe('D-005 · los campos de la receta tienen nombre', () => {
  it('hay encabezado de columna una vez, no en cada fila', () => {
    expect(consulta).toMatch(/aria-hidden="true"[\s\S]{0,400}Medicamento<\/span>/)
  })

  it('y cada campo se anuncia con el fármaco al que pertenece', () => {
    expect(consulta).toMatch(/aria-label=\{`Dosis\$\{m\.nombre/)
    expect(consulta).toMatch(/aria-label=\{`Frecuencia\$\{m\.nombre/)
    expect(consulta).toMatch(/aria-label=\{`Duración\$\{m\.nombre/)
  })
})
