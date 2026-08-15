/**
 * §29 — LA FILA DE PACIENTES SE INSPECCIONA EN EL SITIO, Y NO SE CIERRA DESDE AHÍ.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La re-auditoría independiente dejó `/pacientes` en 1.5 y lo describió como
 * «título + buscador + filtros + filas de directorio + acciones de fila»:
 * anatomía CRUD. La medición de anatomía §29 lo confirmó con una ironía que
 * cabe en una línea: la fila llegaba a decir
 *
 *     «Resultado — venció y nadie la tomó»
 *
 * y el ÚNICO verbo de esa fila era **«Editar»**.
 *
 * Estado clínico presentado como información, con un gesto de CRM al lado. Para
 * hacer algo con ese resultado vencido había que irse a `/pendientes` y buscar
 * al paciente — o sea abandonar la lista, que es exactamente el modelo de
 * interacción que el auditor llamó genérico.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * `scripts/design/medir-anatomia-v29.mjs` (fase «antes»), leído junto a las
 * capturas. Y de paso REFUTÓ la vara obvia: `/pendientes`, la única superficie
 * que el revisor aprueba con 1.0, tiene MÁS cajas y MÁS rellenos de marca que
 * las que fallan. Contar contenedores no mide genericidad; lo que separa a la
 * que aprueba es que **cada entrada lleva encima su siguiente acción segura**.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * De ahí sale la tentación peligrosa, y este guardián existe sobre todo para
 * cerrarla:
 *
 *   **`/pacientes` NO puede recibir los controles que MUTAN el estado de un
 *   pendiente.**
 *
 * `/pendientes` separa a propósito «Ya se hizo» de «Lo revisé — cerrar»
 * (`POR_QUE_COMPLETADA_NO_ES_CERRADA`) porque entre esas dos vive el daño que
 * el worklist entero existe para evitar: el estudio hecho, el resultado en el
 * sistema, y nadie que lo lea. Un toque para cerrar en una lista donde el
 * detalle de la tarea NO está en pantalla permitiría cerrar un resultado sin
 * haberlo leído. Eso sería un cambio de conducta clínica disfrazado de mejora
 * de diseño, y §1 lo congela.
 *
 * Lo que la fila gana es **inspección**: la misma lente que ya usan
 * `/pendientes` y Hoy, con las cuatro respuestas de §10 y la traza a la
 * consulta de origen. Contesta la pregunta sin conceder la autoridad.
 *
 * Y una sola verdad: el pendiente que la lente explica es EL MISMO que la línea
 * clínica resume — mismo filtro, mismo `ordenWorklist`. Si divergieran, la fila
 * resumiría un pendiente y la lente explicaría otro.
 *
 * Probado al revés:
 *  · importar `cambiarEstado` en la página → caso 4;
 *  · pintar «Lo revisé — cerrar» / «Tomarla» en la fila → caso 4;
 *  · que `pendienteQueManda` use un orden propio → caso 2;
 *  · quitar el disparador de la fila → caso 3;
 *  · montar la lente dentro de la fila en vez de en la página → caso 5.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No puntúa §29: eso lo decide el revisor independiente sobre el SHA nuevo.
 * · No cubre render — el foco, la hoja móvil y la vuelta se miden en navegador
 *   (`medir-anatomia-v29.mjs` fase «despues» y el arnés del contrato de regreso).
 * · No cubre las otras superficies que siguen en 1.5.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { pendienteQueManda, estadoClinicoDeFila, type LecturaDelWorklist } from '@/lib/pacientes/estado-clinico'
import { ETIQUETA_TIPO, type TareaClinica } from '@/lib/tareas-clinicas/modelo'

const leer = (r: string) => readFileSync(join(process.cwd(), r), 'utf8')
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const PAGINA = leer('src/app/(dashboard)/pacientes/page.tsx')
const CODIGO = sinComentarios(PAGINA)

const AHORA = Date.parse('2026-08-15T10:00:00.000Z')
const dia = (n: number) => new Date(AHORA + n * 86_400_000).toISOString()

const tarea = (x: Partial<TareaClinica>): TareaClinica => ({
  clinicId: 'c1', patientId: 'p1', tipo: 'seguimiento', titulo: 't',
  prioridad: 'normal', estado: 'solicitada', creadaEn: dia(-10), origen: 'nota', ...x,
})

describe('la fila explica exactamente el pendiente que resume', () => {
  it('1 · el que manda es el del worklist, y viaja entero', () => {
    const lectura: LecturaDelWorklist = {
      estado: 'lista',
      tareas: [
        tarea({ id: 'a', patientId: 'p1', tipo: 'seguimiento', titulo: 'Control' }),
        tarea({ id: 'b', patientId: 'p1', tipo: 'resultado_por_revisar', titulo: 'Urocultivo', venceEn: dia(-1) }),
        tarea({ id: 'c', patientId: 'p2', tipo: 'seguimiento', titulo: 'De otro' }),
      ],
    }
    const manda = pendienteQueManda('p1', lectura, AHORA)
    expect(manda?.id).toBe('b')                 // el vencido escala primero
    expect(manda?.titulo).toBe('Urocultivo')    // entero, no una etiqueta
  })

  it('2 · la línea clínica y la lente hablan del MISMO pendiente', () => {
    const lectura: LecturaDelWorklist = {
      estado: 'lista',
      tareas: [
        tarea({ id: 'a', patientId: 'p1', tipo: 'seguimiento' }),
        tarea({ id: 'b', patientId: 'p1', tipo: 'resultado_por_revisar', venceEn: dia(-2) }),
      ],
    }
    const fila = estadoClinicoDeFila('p1', lectura, AHORA)
    const manda = pendienteQueManda('p1', lectura, AHORA)
    // La etiqueta que la fila PINTA sale del tipo del pendiente que la lente
    // ABRE. Si `pendienteQueManda` usara otro orden, esto se rompe.
    expect(fila.etiqueta).toBe(ETIQUETA_TIPO[manda!.tipo])
  })

  it('3 · sin lectura no se inventa nada, y sin pendientes tampoco', () => {
    expect(pendienteQueManda('p1', { estado: 'sin-leer' }, AHORA)).toBeNull()
    expect(pendienteQueManda('p1', { estado: 'lista', tareas: [] }, AHORA)).toBeNull()
    // `sin-leer` y «no hay ninguna» dan el mismo `null` a propósito: quien
    // pinta distingue por la CLASE, no por el null (regla 4).
    expect(estadoClinicoDeFila('p1', { estado: 'sin-leer' }, AHORA).clase).toBe('sin-leer')
    expect(estadoClinicoDeFila('p1', { estado: 'lista', tareas: [] }, AHORA).clase).toBe('sin-pendientes')
  })
})

describe('se inspecciona en el sitio; NO se muta en el sitio', () => {
  it('4 · la lista de pacientes no puede cambiar el estado de un pendiente', () => {
    /*
      LA INVARIANTE CLÍNICA DE ESTA REBANADA. Cerrar un resultado exige haberlo
      mirado, y en esta pantalla el detalle de la tarea no está. Si alguien trae
      aquí `cambiarEstado` o los rótulos de avance, este caso muerde.
    */
    expect(CODIGO).not.toMatch(/cambiarEstado/)
    expect(CODIGO).not.toMatch(/tareas-clinicas\/firestore'[\s\S]{0,80}cambiarEstado/)
    for (const rotulo of ['Lo revisé', 'Ya se hizo', 'Tomarla', 'Ya no aplica']) {
      expect(CODIGO, `«${rotulo}» no puede pintarse en /pacientes`).not.toContain(rotulo)
    }
  })

  it('5 · la fila SÍ puede inspeccionar, con la pieza compartida y sin estado propio', () => {
    // El disparador vive en la fila…
    expect(CODIGO).toMatch(/<DisparadorPorQue[\s\S]{0,200}tarea=\{manda\}/)
    // …y la lente se monta UNA vez en la página, no dentro de la fila: una
    // tarjeta declarada en el render se remonta y la lente se cerraría sola.
    const fila = CODIGO.slice(CODIGO.indexOf('function PacienteRow'))
    expect(fila).not.toMatch(/<LentePorQue/)
    expect(CODIGO).toMatch(/<LentePorQue/)
    expect(CODIGO).toMatch(/usePorQue\(\)/)
  })

  it('6 · no se pierde lo que la pantalla ya sabía hacer', () => {
    // Identidad, búsqueda, duplicados y alta siguen en pie: originalidad no
    // puede pagarse amputando capacidad.
    expect(CODIGO).toMatch(/buscarPosiblesDuplicados/)
    expect(CODIGO).toMatch(/getPatients/)
    expect(CODIGO).toMatch(/nx-ident/)
    expect(CODIGO).toMatch(/onEditar/)
  })
})
