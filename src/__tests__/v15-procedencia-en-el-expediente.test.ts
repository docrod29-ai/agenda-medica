/**
 * V15 §21 — LA NOTA ARCHIVADA PUEDE ENSEÑAR DE DÓNDE SALIÓ.
 *
 * ── QUÉ FALTABA Y CÓMO SE DESCUBRIÓ ─────────────────────────────────────────
 *
 * §21 llama a la inspección de la fuente la interacción de firma del producto.
 * Estaba en 2 de 6 superficies: `/consulta` y `/pendientes`. Faltaba justo la
 * que importa el día de la discusión — **nadie audita una nota el día que la
 * firma**; se audita semanas después, y ese día se entra por `/expediente`.
 *
 * Buscando con qué contestar ahí apareció el hallazgo, y es de la familia
 * número uno de este sistema:
 *
 *   NotaMedica.transcripcionMotor  →  «el material de origen» (v996)
 *     escrito por  →  /consulta al guardar
 *     leído por    →  el bucle de aprendizaje del ASR
 *     leído por una pantalla → NADIE
 *
 *   NotaMedica.iaAuditoria.extraction  →  la trazabilidad de la IA (Fase B)
 *     escrito por  →  /consulta al guardar
 *     leído por    →  la propia /consulta, para restaurar SU borrador
 *     leído en el archivo → NADIE
 *
 * Los campos que se escribieron para una discusión medicolegal no tenían quién
 * los leyera el día de la discusión. «El dato tiene que LLEGAR» otra vez —
 * REG-160/167/170 son la misma familia.
 *
 * Y el hueco gemelo en el otro extremo, sexto de la iteración: **ninguna nota
 * sembrada traía `transcripcionMotor` ni `extraction`**, así que aunque la
 * pantalla los leyera, la medición en navegador habría fotografiado el estado
 * pobre en las tres y lo habría dado por bueno.
 *
 * ── LAS REGLAS QUE LO HACEN SEGURO ──────────────────────────────────────────
 *
 * 1. **EN EL ARCHIVO SE CONTRASTA CONTRA EL MATERIAL DE ORIGEN**, no contra el
 *    texto de trabajo. Y no es preferencia: si el médico editó el texto de
 *    trabajo para que dijera lo que la nota dice, contrastar contra él
 *    **fabrica el respaldo** — la frase sale en verde porque alguien la
 *    escribió en los dos sitios. El original del reconocedor no se puede
 *    editar. `/consulta` usa el de trabajo porque en la consulta viva es el
 *    único que tiene en la mano; en el archivo hay que elegir.
 * 2. **SE DICE CONTRA QUÉ SE CONTRASTA.** Un panel que no lo dice deja creer
 *    que contrasta contra el original.
 * 3. **SIN BLOQUE DE EXTRACCIÓN NO HAY SELLO.** `construirManifiesto`
 *    clasifica en cinco orígenes y no tiene «no consta»: lo que no casa cae en
 *    `manual`. En una nota archivada sin extracción eso imprimiría **«a mano»
 *    sobre datos que quizá salieron del dictado** — una afirmación falsa de
 *    autoría humana, en la superficie donde se discute la autoría. Regla 4 de
 *    seguridad clínica.
 * 4. **NO SE PUEDE ESCUCHAR EL MOMENTO EN EL ARCHIVO.** La nota guarda el
 *    diálogo SIN tiempos por palabra (guardarlos reventaba el tope de 1 MB de
 *    Firestore y bloqueaba todo guardado posterior). Sin el segundo exacto no
 *    hay botón: una prueba en el segundo equivocado es peor que ninguna
 *    (REG-250).
 * 5. **LAS ALERGIAS DEL SELLO SON LAS DE LA NOTA, NO LAS DEL PACIENTE HOY.**
 *    Mezclarlas haría que una nota de hace un año pareciera haber conocido una
 *    alergia registrada anteayer.
 * 6. **UNA SOLA DEFINICIÓN DE «EL TEXTO DE LA NOTA».** `textoDeLaNota` sale del
 *    monolito de `/consulta` a `lib/expediente/texto-de-la-nota.ts` y las dos
 *    pantallas lo importan. Dos copias serían dos definiciones de qué es «la
 *    nota» para el mismo motor de trazabilidad, y la que se quedara atrás
 *    mentiría en silencio.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Contra el árbol previo el fichero entero no carga (los módulos no existen).
 * Devolviendo sólo el cableado —módulos presentes, pantalla y siembra sin
 * tocar— fallan los casos 9, 10, 11, 12 y 13. Reversiones quirúrgicas sobre el
 * árbol nuevo, comprobadas en rojo una a una:
 *   · `fuente` prefiriendo 'trabajo' sobre 'motor'          → rompe el 2
 *   · `puedeSellar` cableado a true                         → rompe el 5
 *   · las alergias leídas del paciente y no de la nota      → rompe el 7
 *   · `textoDeLaNota` volviendo a declararse en /consulta   → rompe el 13
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No dice que se VEA bien: eso se mide en navegador real con
 *   `scripts/design/medir-procedencia-expediente-v15.mjs`. Éste es un guardián
 *   de fuente y de módulo puro (el repo no usa @testing-library/react).
 * · No sube el alcance de §21 a 6 de 6: sube de 2 a 3. `/dashboard`,
 *   `/pacientes` y `/operaciones` siguen declarados y sin hacer.
 * · **No cubre la mitad de PROSA del manifiesto.** `construirManifiesto`
 *   audita `secciones` y `resumenEjecutivo` desde hace versiones y NINGUNA
 *   superficie se los pasa —ni `/consulta` ni ésta—. Está escrito y sin
 *   conectar, y arreglarlo toca las dos pantallas a la vez: es unidad propia.
 * · No juzga si el texto de una nota es clínicamente bueno. Dice de dónde
 *   salió, que es otra pregunta.
 * · No puntúa §29: quien implementa no puede ser el juez.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  procedenciaDeLaNotaArchivada,
  NOMBRE_DE_LA_FUENTE,
  POR_QUE_EL_MOTOR_Y_NO_EL_DE_TRABAJO,
  POR_QUE_SIN_EXTRACCION_NO_HAY_SELLO,
} from '@/lib/expediente/procedencia-de-la-nota-archivada'
import { textoDeLaNota } from '@/lib/expediente/texto-de-la-nota'
import type { NotaMedica } from '@/types/expediente'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const PAGINA = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')
const PIEZA = leer('src/components/expediente/ProcedenciaDeLaNota.tsx')
const CONSULTA = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
const SIEMBRA = leer('scripts/design/sembrar-capturas.mjs')
const HOJA = leer('src/app/globals.css')

/** El cuerpo, sin la cabecera que lo explica: un guardián que busca una cadena
    en el fichero entero acaba cazándose a sí mismo leyendo la prosa que dice
    por qué esa cadena NO debe estar (la ceguera cazada seis veces ya). */
const CODIGO_PIEZA = PIEZA.slice(PIEZA.indexOf("import { Fingerprint"))

const BASE: NotaMedica = {
  id: 'n1',
  clinicId: 'c1',
  pacienteId: 'p1',
  pacienteNombre: 'Aurelio Domínguez Peña',
  tipo: 'seguimiento',
  metadata: {
    id: 'n1', tipoNota: 'seguimiento', clinicId: 'c1', pacienteId: 'p1', medicoId: 'u1',
    cedulaProfesional: '0', especialidad: 'MI', establecimiento: 'x',
    fechaCreacion: '2026-08-01T10:00:00.000Z', fechaModificacion: '2026-08-01T10:00:00.000Z',
    hashIntegridad: 'h', version: 1, estado: 'firmada', fuenteGeneracion: 'ia_voz',
  },
  resumenEjecutivo: 'Control metabólico subóptimo.',
  secciones: [{ key: 'plan', label: 'Plan', value: 'Refuerzo de apego y laboratorios.' }],
  diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2', tipo: 'definitivo', estado: 'cronico' }],
  medicamentos: [],
  alergias: [],
  estado: 'firmada',
  fechaConsulta: '2026-08-01T10:00:00.000Z',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  creadoPor: 'medico@x',
}

describe('§21 en el expediente — el módulo decide qué se puede afirmar', () => {
  it('1 · sin ninguna transcripción no hay fuente, y no se inventa una', () => {
    const p = procedenciaDeLaNotaArchivada(BASE)
    expect(p.fuente).toBeNull()
    expect(p.dictado).toBe('')
  })

  it('2 · con las DOS, se contrasta contra el material de origen', () => {
    // La regla entera de esta rebanada. Si el médico corrigió el texto de
    // trabajo para que dijera lo que la nota dice, contrastar contra él
    // fabrica el respaldo; el original del reconocedor no se puede editar.
    const p = procedenciaDeLaNotaArchivada({
      ...BASE,
      transcripcionMotor: 'hemoglobina glucosa hilada de control',
      transcripcionCruda: 'hemoglobina glucosilada de control',
    })
    expect(p.fuente).toBe('motor')
    expect(p.dictado).toBe('hemoglobina glucosa hilada de control')
    expect(p.trabajoEditado).toBe(true)
  })

  it('3 · sin original se usa el de trabajo, y queda DICHO cuál es', () => {
    const p = procedenciaDeLaNotaArchivada({ ...BASE, transcripcionCruda: 'lo que se dictó' })
    expect(p.fuente).toBe('trabajo')
    expect(p.trabajoEditado).toBe(false)
    // Los dos nombres tienen que distinguirse en pantalla, no sólo en el tipo.
    expect(NOMBRE_DE_LA_FUENTE.motor).not.toBe(NOMBRE_DE_LA_FUENTE.trabajo)
    expect(NOMBRE_DE_LA_FUENTE.motor).toMatch(/reconocedor/i)
    expect(NOMBRE_DE_LA_FUENTE.trabajo).toMatch(/edit/i)
  })

  it('4 · dos transcripciones IGUALES no se declaran como edición', () => {
    const p = procedenciaDeLaNotaArchivada({
      ...BASE, transcripcionMotor: 'igual', transcripcionCruda: 'igual',
    })
    expect(p.trabajoEditado).toBe(false)
  })

  it('5 · sin bloque de extracción NO se puede sellar', () => {
    // Regla 4 de seguridad clínica: el manifiesto no tiene «no consta», así
    // que sin extracción imprimiría «a mano» sobre datos de máquina.
    expect(procedenciaDeLaNotaArchivada(BASE).puedeSellar).toBe(false)
    const con = procedenciaDeLaNotaArchivada({
      ...BASE, iaAuditoria: { extraction: { diagnosticos: [] } },
    })
    expect(con.puedeSellar).toBe(true)
    // Las dos decisiones tienen porqué PROPIO. Reusar una explicación para la
    // otra deja una regla sin motivo escrito, y la siguiente persona la borra.
    expect(POR_QUE_SIN_EXTRACCION_NO_HAY_SELLO).toMatch(/a mano/i)
    expect(POR_QUE_EL_MOTOR_Y_NO_EL_DE_TRABAJO).toMatch(/fabrica el respaldo/i)
    expect(POR_QUE_SIN_EXTRACCION_NO_HAY_SELLO).not.toBe(POR_QUE_EL_MOTOR_Y_NO_EL_DE_TRABAJO)
  })

  it('6 · los campos aceptados por el médico llegan al sello', () => {
    const p = procedenciaDeLaNotaArchivada({
      ...BASE, iaAuditoria: { extraction: {}, aprobadosPorMedico: ['dx:0'] },
    })
    expect(p.aprobados.has('dx:0')).toBe(true)
    expect(p.aprobados.has('dx:1')).toBe(false)
  })

  it('7 · las alergias del sello son las de la NOTA, no las del paciente hoy', () => {
    const p = procedenciaDeLaNotaArchivada({
      ...BASE,
      alergias: [{ alergeno: 'Penicilina', severidad: 'grave' }],
    })
    expect(p.final.alergias).toEqual(['Penicilina'])
    // El módulo no puede tener forma de leer al paciente: si aceptara uno,
    // alguien acabaría pasándoselo y la nota de hace un año conocería una
    // alergia registrada anteayer.
    expect(procedenciaDeLaNotaArchivada.length).toBe(1)
  })

  it('8 · una alergia guardada como cadena suelta (documentos viejos) no desaparece', () => {
    const p = procedenciaDeLaNotaArchivada({
      ...BASE,
      alergias: ['Sulfas'] as unknown as NotaMedica['alergias'],
    })
    expect(p.final.alergias).toEqual(['Sulfas'])
  })

  it('9 · el texto que se contrasta incluye los diagnósticos estructurados', () => {
    // El defecto original: `join` sobre objetos daba «[object Object]» y toda
    // la lista de diagnósticos era invisible para lo que leía «la nota».
    const p = procedenciaDeLaNotaArchivada(BASE)
    expect(p.nota).toContain('Diabetes mellitus tipo 2')
    expect(p.nota).toContain('Refuerzo de apego')
    expect(p.nota).not.toContain('[object Object]')
  })
})

describe('§21 en el expediente — el cableado, del otro lado', () => {
  it('10 · el expediente monta la pieza dentro de la nota abierta', () => {
    expect(PAGINA).toContain("import { ProcedenciaDeLaNota } from '@/components/expediente/ProcedenciaDeLaNota'")
    expect(PAGINA).toContain('<ProcedenciaDeLaNota nota={nota} />')
  })

  it('11 · la pieza usa las DOS piezas que ya existían, no copias nuevas', () => {
    expect(CODIGO_PIEZA).toContain("from '@/components/SelloProcedencia'")
    expect(CODIGO_PIEZA).toContain("from '@/components/DeDondeSalioEsto'")
    // Y decide con el módulo, no con condiciones tecleadas a mano en el JSX.
    expect(CODIGO_PIEZA).toContain('procedenciaDeLaNotaArchivada')
  })

  it('12 · en el archivo NO se ofrece escuchar el momento', () => {
    // La nota archiva el diálogo sin tiempos por palabra: no hay de dónde
    // sacar el segundo. `DeDondeSalioEsto` sólo pinta el botón si recibe
    // `resolverUrlDeAudio`, así que basta con no pasárselo — pero se sella,
    // porque el día que alguien lo añada «por completitud» aproximaría.
    expect(CODIGO_PIEZA).not.toContain('resolverUrlDeAudio')
    expect(CODIGO_PIEZA).not.toContain('utterances')
  })

  it('13 · «el texto de la nota» tiene UNA casa, y /consulta la importa', () => {
    expect(CONSULTA).toContain("import { textoDeLaNota } from '@/lib/expediente/texto-de-la-nota'")
    // Y ya no la declara: dos definiciones de qué es «la nota» para el mismo
    // motor de trazabilidad acaban divergiendo sin que nadie lo note.
    expect(CONSULTA).not.toMatch(/function\s+textoDeLaNota\s*\(/)
    expect(textoDeLaNota('r', [], [])).toBe('r')
  })

  it('14 · la tipografía de la pieza vive en la HOJA, no en el JSX', () => {
    // La lección de `nx-stat-grid`: un estilo en línea vence a la hoja en
    // silencio, y un tamaño escrito a mano es un rol tipográfico sin nombre.
    expect(HOJA).toContain('.nx-proc-nota')
    expect(HOJA).toContain('.nx-proc-fuente')
    expect(CODIGO_PIEZA).not.toMatch(/fontSize:/)
  })

  it('15 · la siembra trae los DOS estados, para que la medición vea la diferencia', () => {
    // Sin esto, la medición fotografía el estado pobre en las tres notas y lo
    // da por bueno. Sexto hueco de siembra de esta familia en la iteración.
    expect(SIEMBRA).toContain('transcripcionMotor')
    expect(SIEMBRA).toContain('aprobadosPorMedico')
    expect(SIEMBRA).toContain('extraction')
    // Y el original tiene que DIFERIR del texto de trabajo: si fueran iguales,
    // la distinción que esta rebanada entrega no se podría fotografiar.
    expect(SIEMBRA).toContain('hemoglobina glucosa hilada')
    expect(SIEMBRA).toContain('hemoglobina glucosilada')
  })
})
