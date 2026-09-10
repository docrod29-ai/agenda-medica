/**
 * LA NOTA QUE EL MÉDICO PIDIÓ — D-046 · D-047 · D-048 · D-049 (10-sep-2026).
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * El médico dueño, probando una consulta real en su iPhone, con cinco capturas:
 *
 *   «no infieres ningún dx; si quiero que lo hagas pero no mil · sigues
 *    poniendo todos los medicamentos que usa · sigues mostrando la IA el nivel,
 *    te había dicho que no tiene que escoger · no es nada amigable, súper
 *    confuso, todos los consejos · nomás quiero que hagas la nota y sugerencias
 *    de tx y dx y abordaje · ya no quiero ver de dónde lo sacaste»
 *
 * Lo que enseñaban las capturas: ONCE diagnósticos; NUEVE medicamentos sin
 * dosis bloqueando la firma —tres de ellos la misma frase «acabo de terminar
 * un medicamento» convertida en tres filas («Medicamento no especificado»,
 * «Medicamento previo (nombre no precisado)», «medicamento de terminación
 * reciente cuyo nombre no fue precisado»), y el resto lo que ya tomaba o le
 * dio un urólogo antes—; el selector ⚡/⭐/💎; y «Qué es de qué» con la cita
 * del dictado bajo cada fármaco.
 *
 * ── LA CAUSA RAÍZ, QUE ES UNA POR PUNTO ─────────────────────────────────────
 *
 * · Diagnósticos: la regla 7-bis del prompt pide de tres a seis. Un prompt es
 *   una petición; no había tope determinista. (D-049)
 * · Medicamentos: `loQueSeReceta` ya existía y ya decidía qué baja al PAPEL,
 *   pero la LISTA de la pantalla y la COMPUERTA de dosis miraban `medicamentos`
 *   entero. Y la regla 19 del prompt prohíbe las filas «no especificado»; el
 *   modelo la ignora y nada lo paraba. (D-048)
 * · Nivel de IA: Board #296 ya decía que el médico no elige; el selector seguía
 *   montado y la petición mandaba `motor`. (D-046)
 * · Procedencia: «Qué es de qué» se montaba siempre que hubiera dos grupos. (D-047)
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * UNA PUERTA para «qué es receta de hoy»: la pantalla, la compuerta de firma y
 * el impreso usan `loQueSeReceta`. Lo demás con nombre se enseña en una línea
 * aparte, sin dosis y sin bloquear. Lo que no nombra un fármaco no entra. El
 * lote de la IA trae como máximo seis diagnósticos. El médico no elige nivel.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · Si la diarización atribuye mal quién dijo el fármaco, esto hereda el error
 *   (REG-515 ya lo declara). Ese renglón aparecerá en la línea de mencionados
 *   con su botón «Recetar hoy»: el médico lo sube con un gesto.
 * · No decide QUÉ seis diagnósticos son los correctos: conserva el orden del
 *   modelo y sólo recorta diferenciales primero. Eso sigue siendo del médico.
 * · No mide que la nota sea buena: mide que la pantalla deje de estorbar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Diagnostico, Medicamento } from '@/types/expediente'
import {
  fusionarMedicamentos, loQueSeReceta, loQueSoloSeMenciono, comoRecetaDeHoy, esNombreSinPrecisar,
} from '@/lib/expediente/que-va-en-la-receta'
import { fusionarDiagnosticos, acotarLoteIa, TOPE_DE_SUGERENCIAS_IA } from '@/lib/expediente/fusionar-diagnosticos'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PAGE = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

const med = (nombre: string, extra: Partial<Medicamento> = {}): Medicamento =>
  ({ nombre, dosis: '', via: 'oral', frecuencia: '', duracion: '', ...extra })
const dx = (descripcion: string, tipo: Diagnostico['tipo'] = 'presuntivo'): Diagnostico =>
  ({ descripcion, tipo, estado: 'activo' })

describe('D-048 · un renglón que no nombra un fármaco no es un medicamento', () => {
  it.each([
    'Medicamento no especificado',
    'Medicamento previo (nombre no precisado)',
    'Antibiótico no especificado',
    'medicamento de terminación reciente cuyo nombre no fue precisado',
    'un antibiótico',
    'Tratamiento previo',
    'analgésico sin especificar',
  ])('«%s» se reconoce como sin precisar', n => {
    expect(esNombreSinPrecisar(n)).toBe(true)
  })

  it.each(['Doxiciclina', 'Ceftriaxona', 'Telmisartán', 'Levofloxacino', 'Metformina 850 mg', 'Losartán/HCTZ'])(
    '«%s» es un fármaco y pasa', n => {
      expect(esNombreSinPrecisar(n)).toBe(false)
    })

  it('vacío no es «sin precisar»: es un renglón que el médico está tecleando', () => {
    expect(esNombreSinPrecisar('')).toBe(false)
    expect(esNombreSinPrecisar(undefined)).toBe(false)
  })

  it('EL CASO: las tres filas de «acabo de terminar un medicamento» no entran a la lista', () => {
    // Falla sin el filtro: entraban las cuatro y tres bloqueaban la firma.
    const lista = fusionarMedicamentos({ previos: [], deLaIaAnterior: [], nuevos: [
      med('medicamento de terminación reciente cuyo nombre no fue precisado', { speaker: 'paciente' }),
      med('Medicamento no especificado', { speaker: 'paciente' }),
      med('Medicamento previo (nombre no precisado)', { speaker: 'paciente' }),
      med('Doxiciclina', { speaker: 'medico', procedenciaClinica: 'se_prescribe_hoy', dosis: '100 mg' }),
    ] })
    expect(lista.map(m => m.nombre)).toEqual(['Doxiciclina'])
  })

  it('lo que el MÉDICO escribió a mano no se filtra, aunque diga «sin precisar»', () => {
    // Señalar de menos: el filtro es para el lote automático, no para su teclado.
    const lista = fusionarMedicamentos({
      previos: [med('inhalador, nombre no precisado')], deLaIaAnterior: [], nuevos: [],
    })
    expect(lista).toHaveLength(1)
  })
})

describe('D-048 · la lista es la receta de hoy; lo demás es una línea', () => {
  const lista: Medicamento[] = [
    med('Telmisartán', { procedenciaClinica: 'ya_lo_toma', speaker: 'paciente' }),          // lo toma
    med('Ceftriaxona', { speaker: 'paciente', estado: 'borrador' }),                        // se lo dio un urólogo
    med('Levofloxacino', { speaker: 'medico', estado: 'borrador' }),                        // IA sin intención
    med('Doxiciclina', { speaker: 'medico', procedenciaClinica: 'se_prescribe_hoy', dosis: '100 mg' }),
    med('Paracetamol', { dosis: '500 mg' }),                                                // a mano
    med(''),                                                                                 // tecleando
  ]

  it('sólo dos bajan a la receta de hoy (y el renglón vacío, que se está escribiendo)', () => {
    expect(loQueSeReceta(lista).map(m => m.nombre)).toEqual(['Doxiciclina', 'Paracetamol', ''])
  })

  it('los otros tres son «mencionados»: con nombre y fuera del papel', () => {
    expect(loQueSoloSeMenciono(lista).map(m => m.nombre)).toEqual(['Telmisartán', 'Ceftriaxona', 'Levofloxacino'])
  })

  it('los dos conjuntos parten la lista sin perder ni repetir nada con nombre', () => {
    const conNombre = lista.filter(m => m.nombre.trim())
    const union = [...loQueSeReceta(lista), ...loQueSoloSeMenciono(lista)].filter(m => m.nombre.trim())
    expect(union).toHaveLength(conNombre.length)
    expect(new Set(union).size).toBe(conNombre.length)
  })

  it('«Recetar hoy» es el gesto del médico: sube el renglón con SU atribución', () => {
    const subido = comoRecetaDeHoy(lista[2])
    expect(subido.procedenciaClinica).toBe('se_prescribe_hoy')
    expect(subido.speaker).toBe('medico')
    expect('estado' in subido).toBe(false)
    expect(loQueSeReceta([subido])).toHaveLength(1)
  })

  it('y al subirlo deja de estar entre los mencionados', () => {
    const nueva = lista.map((m, i) => i === 2 ? comoRecetaDeHoy(m) : m)
    expect(loQueSoloSeMenciono(nueva).map(m => m.nombre)).toEqual(['Telmisartán', 'Ceftriaxona'])
  })
})

describe('D-048 · la compuerta de dosis mira la MISMA puerta que el papel', () => {
  it('el aviso antes de firmar itera la receta de hoy, no la lista entera', () => {
    const i = PAGE.indexOf('const dosisIncompletas')
    expect(PAGE.slice(i, i + 400)).toContain('return loQueSeReceta(medicamentos)')
  })

  it('el bloqueo al pulsar Firmar también', () => {
    expect(PAGE).toContain('const dosisMal = loQueSeReceta(medicamentos)')
    expect(PAGE).not.toContain('const dosisMal = medicamentos')
  })

  it('las filas editables son la receta de hoy, y los mencionados van en su línea', () => {
    expect(PAGE).toContain('const enRecetaDeHoy = new Set(loQueSeReceta(medicamentos))')
    expect(PAGE).toContain('{filasDeReceta.map(({ m, i }) => (')
    expect(PAGE).not.toContain('{medicamentos.map((m, i) => (')
    expect(PAGE).toContain('Mencionados en la consulta, fuera de la receta:')
    expect(PAGE).toContain('comoRecetaDeHoy(x)')
  })

  it('la línea de mencionados es reversible: tiene subir y quitar, con nombre para el lector', () => {
    expect(PAGE).toContain('aria-label={`Recetar hoy: ${m.nombre}`}')
    expect(PAGE).toContain('aria-label={`Quitar de la nota: ${m.nombre}`}')
  })

  it('EL DATO SIGUE LLEGANDO: la nota guarda la lista entera, no sólo la receta', () => {
    // De `medicamentos` cuelgan alergias, interacciones y reconciliación.
    expect(PAGE).toContain('medicamentos: medicamentos.map(m => ({ ...m, via: corregirViaParenteral(m.nombre, m.via)')
  })
})

describe('D-049 · como máximo seis diagnósticos sugeridos por pasada', () => {
  // Once descripciones DISTINTAS: la fusión deduplica por palabras, y «Diagnóstico 1…11»
  // se leería como uno solo (los números no cuentan como palabra).
  const NOMBRES = ['Uretritis no gonocócica', 'Hipertensión arterial sistémica', 'Prostatitis crónica',
    'Epididimitis', 'Cistitis aguda', 'Balanitis', 'Dislipidemia mixta', 'Obesidad grado I',
    'Disfunción eréctil', 'Ansiedad generalizada', 'Rinitis alérgica']
  const once = NOMBRES.map(n => dx(n))

  it('el tope es seis, el mismo número que pide la regla 7-bis del prompt', () => {
    expect(TOPE_DE_SUGERENCIAS_IA).toBe(6)
  })

  it('EL CASO: once del modelo → seis en la nota, en su orden', () => {
    // Falla sin el tope: entraban los once.
    const r = fusionarDiagnosticos({ previos: [], deLaIaAnterior: [], nuevos: once })
    expect(r.map(d => d.descripcion)).toEqual(once.slice(0, 6).map(d => d.descripcion))
  })

  it('los diferenciales salen primero, y desde el final', () => {
    const lote = [dx('A'), dx('B', 'diferencial'), dx('C'), dx('D'), dx('E', 'diferencial'), dx('F'), dx('G'), dx('H')]
    expect(acotarLoteIa(lote).map(d => d.descripcion)).toEqual(['A', 'C', 'D', 'F', 'G', 'H'])
  })

  it('un diferencial se conserva si aún cabe', () => {
    const lote = [dx('A'), dx('B', 'diferencial'), dx('C')]
    expect(acotarLoteIa(lote)).toHaveLength(3)
  })

  it('los del MÉDICO no se tocan: el tope es para el lote automático', () => {
    const SUYOS = ['Diabetes mellitus tipo 2', 'Hipotiroidismo primario', 'Gastritis crónica', 'Asma leve',
      'Migraña sin aura', 'Insomnio crónico', 'Gonartrosis bilateral', 'Anemia ferropénica']
    const suyos = SUYOS.map(n => dx(n, 'definitivo'))
    const r = fusionarDiagnosticos({ previos: suyos, deLaIaAnterior: [], nuevos: once })
    expect(r.filter(d => SUYOS.includes(d.descripcion))).toHaveLength(8)
    expect(r.filter(d => NOMBRES.includes(d.descripcion))).toHaveLength(6)
  })

  it('seis o menos pasan íntegros', () => {
    expect(acotarLoteIa(once.slice(0, 6))).toHaveLength(6)
    expect(acotarLoteIa([])).toEqual([])
  })
})

describe('D-046 · el médico no elige nivel de IA', () => {
  it('no hay selector ni catálogo en la consulta', () => {
    expect(PAGE).not.toContain('Nivel de IA para esta nota')
    expect(PAGE).not.toContain('const MOTORES_UI')
    expect(PAGE).not.toContain('setMotorSel')
  })

  it('la petición de la nota y la de evidencia no mandan `motor`: lo decide el servidor por plan', () => {
    expect(PAGE).not.toMatch(/\n\s*motor: motorEfectivo/)
    expect(PAGE).not.toMatch(/motor: \(enVivo \|\| preliminar\)/)
    // Y el servidor sí tiene ese camino: sin motor, el del plan.
    const ruta = leer('src/app/api/expediente/procesar/route.ts')
    expect(ruta).toContain('body.motor ? motorPorClave(body.motor) : motorPorDefecto(nivel)')
  })

  it('lo que sí queda es el nivel USADO, para procedencia de la nota', () => {
    expect(PAGE).toContain('motor: motorUsado ?? undefined')
  })
})

describe('D-047 · «Qué es de qué» ya no se monta en la consulta', () => {
  it('ni import ni JSX', () => {
    expect(PAGE).not.toContain("from '@/components/PlanPorProblema'")
    expect(PAGE).not.toContain('<PlanPorProblema')
  })

  it('la procedencia por frase (REG-213/250) no se toca: pulsar una frase sigue llevando al dictado', () => {
    expect(PAGE).toContain('construirManifiesto(')
  })
})
