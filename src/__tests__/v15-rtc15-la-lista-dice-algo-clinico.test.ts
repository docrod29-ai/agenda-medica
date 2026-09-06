/**
 * RTC-15 — la lista de pacientes dice algo CLÍNICO de cada paciente.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `/pacientes` puntuó **5.0/10** en la re-puntuación §29 del 14-ago-2026 — la
 * peor superficie del producto, con objetivo ≤1.0 — y la razón cabe en una
 * frase: **no decía nada clínico de nadie**. Cada fila era inicial en disco de
 * color, nombre, teléfono, edad, «Editar» y un icono de documento. Ni quién
 * tenía algo abierto, ni a quién se vio ayer, ni de quién venció un resultado.
 * La lista de contactos de un CRM, en la pantalla que el médico abre veinte
 * veces al día.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * El equipo rojo lo había escrito como RTC-15/P2 («anatomía CRUD; única
 * affordance por fila = Editar»). La re-puntuación sobre capturas nuevas le
 * puso número y lo subió a P1: los diez P1 originales dejaron cuatro
 * superficies entre 1.0 y 2.5, y ésta se quedó donde estaba porque **ningún P1
 * la había tocado** — RTC-11 arregló su identidad en móvil sin cambiar lo que
 * la pantalla ES.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El dato clínico existía y no llegaba a la fila. `tareasVivas()` —el worklist
 * del consultorio— ya la leían `/pendientes` y el `ContinuidadPanel` de Hoy;
 * `ultimaCita` ya se leía aquí mismo para ORDENAR la pestaña «Recientes» y no
 * se pintaba en ningún sitio. La pantalla tenía la información en la mano y
 * enseñaba el teléfono.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. **Una sola fuente de verdad.** El estado clínico de la fila sale de
 *    `tareasVivas()` y se ordena con `ordenWorklist` — las mismas funciones
 *    del modelo que usa `/pendientes`. Un segundo criterio de urgencia sería
 *    una segunda verdad sobre la misma entidad clínica.
 * 2. **Ausencia de dato no es dato de ausencia** (regla 4). La lectura tiene
 *    TRES respuestas, no dos: `con-pendientes`, `sin-pendientes` (llegó y no
 *    había nada) y `sin-leer` (falló o no ha llegado). `sin-leer` **no se
 *    pinta como «sin pendientes»**: una fila que dice «nada pendiente» por un
 *    error de red es el daño exacto que esto existe para evitar.
 * 3. **La consecuencia, en prosa.** «Resultado — venció y nadie la tomó», no
 *    un chip rojo que hay que saber interpretar. Es lo que hace que
 *    `/pendientes` sea la superficie mejor puntuada (§29: 1.0), y el color
 *    acompaña sin ser el único canal (RTC-17).
 * 4. **La lectura no bloquea la lista.** Los pacientes se pintan cuando
 *    llegan; el estado clínico aterriza encima.
 *
 * Probado al revés: quitando el filtro por `patientId` falla el caso 2;
 * devolviendo `sin-pendientes` cuando la lectura no llegó falla el 4; usando un
 * orden propio en vez de `ordenWorklist` falla el 6; devolviendo la línea
 * clínica DEBAJO del teléfono falla el 8; devolviendo el `FileText` falla el 9.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No cubre las otras dos mitades del pago de RTC-15.** «Respaldo» sigue en
 *   la cabecera primaria de `/pacientes` siendo una operación de §11: mudarlo
 *   exige darle casa en `/operaciones`, que es justo la pantalla que RTC-29 va
 *   a rehacer, y hacerlo dos veces sería trabajo tirado. Queda declarado, no
 *   olvidado.
 * · **No mide el score.** Que la fila diga algo clínico no garantiza que §29
 *   baje de 5.0: eso se vuelve a puntuar en navegador, sobre capturas nuevas.
 * · No cubre jsdom/layout: no hay render aquí. La verificación visual es del
 *   arnés.
 * · No cubre qué pasa con 300 filas y 200 tareas — el tope de `tareasVivas` es
 *   200 y esa cota es del worklist, no de esta pantalla.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  estadoClinicoDeFila, ultimaVezVisto,
  type LecturaDelWorklist,
} from '@/lib/pacientes/estado-clinico'
import type { TareaClinica } from '@/lib/tareas-clinicas/modelo'

const AHORA = Date.parse('2026-08-14T12:00:00Z')
const DIA = 86_400_000

const tarea = (over: Partial<TareaClinica>): TareaClinica => ({
  clinicId: 'c1', patientId: 'p1', tipo: 'seguimiento', titulo: 'x',
  prioridad: 'normal', estado: 'solicitada', creadaEn: '2026-08-01T00:00:00Z',
  origen: 'nota', ...over,
})

const lista = (tareas: TareaClinica[]): LecturaDelWorklist => ({ estado: 'lista', tareas })

describe('RTC-15 — el estado clínico de una fila', () => {
  it('1 · sin pendientes de ese paciente, la clase lo dice — y NO es lo mismo que no haber leído', () => {
    const e = estadoClinicoDeFila('p1', lista([]), AHORA)
    expect(e.clase).toBe('sin-pendientes')
    expect(e.vivas).toBe(0)
    expect(e.etiqueta).toBeNull()
  })

  it('2 · sólo cuentan las tareas DE ESE paciente', () => {
    const e = estadoClinicoDeFila('p1', lista([
      tarea({ patientId: 'p1' }),
      tarea({ patientId: 'p2' }),
      tarea({ patientId: 'p2' }),
    ]), AHORA)
    expect(e.vivas).toBe(1)
  })

  it('3 · la etiqueta es la del TIPO, y sale del modelo (no de una tercera copia)', () => {
    const e = estadoClinicoDeFila('p1', lista([tarea({ tipo: 'resultado_por_revisar' })]), AHORA)
    expect(e.etiqueta).toBe('Resultado')
  })

  it('4 · «no se pudo leer» NUNCA se pinta como «sin pendientes»', () => {
    /**
     * El caso que justifica que esto sea un tipo y no un array vacío. Una fila
     * muda es honesta; una que afirma que no hay nada abierto porque Firestore
     * devolvió un error afirma algo que nadie comprobó — regla 4 de seguridad
     * clínica, exactamente en la dirección que se olvida.
     */
    const e = estadoClinicoDeFila('p1', { estado: 'sin-leer' }, AHORA)
    expect(e.clase).toBe('sin-leer')
    expect(e.clase).not.toBe('sin-pendientes')
    expect(e.etiqueta).toBeNull()
    expect(e.urgente).toBe(false)
  })

  it('5 · la razón se dice en prosa, y distingue vencida de sin dueño', () => {
    const vencidaYSola = estadoClinicoDeFila('p1', lista([
      tarea({ venceEn: '2026-08-13T00:00:00Z' }),
    ]), AHORA)
    expect(vencidaYSola.porQue).toBe('venció y nadie la tomó')

    const vencidaConDueno = estadoClinicoDeFila('p1', lista([
      tarea({ venceEn: '2026-08-13T00:00:00Z', ownerUid: 'u1' }),
    ]), AHORA)
    expect(vencidaConDueno.porQue).toBe('venció')

    const criticaSola = estadoClinicoDeFila('p1', lista([
      tarea({ prioridad: 'critica' }),
    ]), AHORA)
    expect(criticaSola.porQue).toBe('crítica, sin dueño')

    const tranquila = estadoClinicoDeFila('p1', lista([tarea({ ownerUid: 'u1' })]), AHORA)
    expect(tranquila.porQue).toBeNull()
    expect(tranquila.urgente).toBe(false)
  })

  it('6 · la que MANDA es la que el worklist pondría arriba, no la primera del array', () => {
    // Si esta fila usara su propio criterio, un seguimiento tranquilo creado
    // antes taparía el resultado crítico sin dueño de esta mañana.
    const e = estadoClinicoDeFila('p1', lista([
      tarea({ tipo: 'seguimiento', creadaEn: '2026-07-01T00:00:00Z', ownerUid: 'u1' }),
      tarea({ tipo: 'resultado_por_revisar', prioridad: 'critica', creadaEn: '2026-08-14T06:00:00Z' }),
    ]), AHORA)
    expect(e.etiqueta).toBe('Resultado')
    expect(e.urgente).toBe(true)
    expect(e.vivas).toBe(2)
  })

  it('7 · «visto hace…» habla en días, meses y años — y una cita futura no es «visto»', () => {
    /**
     * OJO CON LA FORMA DEL DATO. Estos casos pasaban marcas de tiempo ISO
     * completas, y lo que la lista manda es `p.ultimaCita`: una FECHA de diez
     * caracteres, sin hora y sin zona. Con hora completa la cuenta acertaba y
     * sin ella no, así que este caso estuvo verde mientras el producto decía
     * «visto ayer» de un paciente atendido esa misma mañana — a partir de las
     * 18:00 hora del consultorio, todas las tardes. Es REG-525.
     *
     * Se conservan las marcas completas (también llegan) y se añade la forma
     * que manda la lista. El caso a fondo vive en
     * `la-tarde-no-envejece-al-paciente`.
     */
    // Y a una hora que IMPORTE: a las 06:00 del consultorio el día UTC y el
    // día local coinciden, así que el defecto no se asoma. Sólo aparece de las
    // 18:00 en adelante, que es cuando el médico repasa la jornada.
    const LA_TARDE = Date.parse('2026-08-15T00:30:00Z')   // 14-ago, 18:30 en México
    expect(ultimaVezVisto('2026-08-14', LA_TARDE)).toBe('visto hoy')
    expect(ultimaVezVisto('2026-08-13', LA_TARDE)).toBe('visto ayer')
    expect(ultimaVezVisto(new Date(AHORA).toISOString(), AHORA)).toBe('visto hoy')
    expect(ultimaVezVisto(new Date(AHORA - DIA).toISOString(), AHORA)).toBe('visto ayer')
    expect(ultimaVezVisto(new Date(AHORA - 5 * DIA).toISOString(), AHORA)).toBe('visto hace 5 días')
    expect(ultimaVezVisto(new Date(AHORA - 70 * DIA).toISOString(), AHORA)).toBe('visto hace 2 meses')
    expect(ultimaVezVisto(new Date(AHORA - 800 * DIA).toISOString(), AHORA)).toBe('visto hace 2 años')
    // Sin fecha no se inventa «nunca visto»: puede ser un expediente migrado.
    expect(ultimaVezVisto(undefined, AHORA)).toBeNull()
    expect(ultimaVezVisto('no es una fecha', AHORA)).toBeNull()
    expect(ultimaVezVisto(new Date(AHORA + 3 * DIA).toISOString(), AHORA)).toBeNull()
  })
})

const PAGINA = readFileSync(join(process.cwd(), 'src/app/(dashboard)/pacientes/page.tsx'), 'utf8')
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('RTC-15 — y la fila lo pinta', () => {
  it('8 · lo clínico va ANTES del teléfono en el orden del documento', () => {
    const clinico = PAGINA.indexOf('nx-fila-clinico')
    const telefono = PAGINA.indexOf('{p.telefono &&')
    expect(clinico, 'la fila ya no pinta el estado clínico').toBeGreaterThan(0)
    expect(telefono).toBeGreaterThan(0)
    expect(clinico, 'el teléfono volvió a pesar más que lo clínico').toBeLessThan(telefono)
  })

  it('9 · la affordance de la fila dice «lleva a otro sitio», no «documento»', () => {
    expect(PAGINA).toContain('<ChevronRight className="nx-fila-chevron"')
    expect(PAGINA).not.toContain('<FileText className="nx-fila-chevron"')
  })

  it('10 · la lectura del worklist no bloquea la lista de pacientes', () => {
    // Dos efectos distintos: `load()` pinta los pacientes, `tareasVivas` aterriza
    // encima. Encadenarlos haría que la pantalla más visitada esperase al worklist.
    expect(PAGINA).toMatch(/useEffect\(\(\) => \{ load\(\) \}, \[clinicId\]\)/)
    expect(PAGINA).toContain('tareasVivas(clinicId)')
    expect(PAGINA).not.toMatch(/await tareasVivas/)
  })

  it('11 · si la lectura falla, el estado se queda en «sin-leer»', () => {
    const efecto = PAGINA.slice(PAGINA.indexOf('tareasVivas(clinicId)'))
    const hastaElCierre = efecto.slice(0, efecto.indexOf('}, [clinicId])'))
    // El catch NO puede poner `{ estado: 'lista', tareas: [] }`: eso convertiría
    // un error de red en «ningún paciente tiene nada pendiente».
    expect(hastaElCierre).toContain('.catch(')
    expect(hastaElCierre.slice(hastaElCierre.indexOf('.catch('))).not.toContain("estado: 'lista'")
  })
})

describe('RTC-15 — el nombre de cada tipo vive en UN solo sitio', () => {
  it('12 · ni /pendientes ni ContinuidadPanel declaran su propia copia', () => {
    /**
     * Había DOS copias idénticas y ésta iba a ser la tercera. Es la trampa que
     * AGENTS.md nombra: el día que «Reconciliar» cambie de nombre hay que
     * acordarse de tres sitios y el tercero se queda.
     */
    for (const ruta of [
      'src/app/(dashboard)/pendientes/page.tsx',
      'src/components/ContinuidadPanel.tsx',
    ]) {
      const src = readFileSync(join(process.cwd(), ruta), 'utf8')
      expect(src, `${ruta} volvió a declarar su copia de ETIQUETA_TIPO`)
        .not.toMatch(/const ETIQUETA_TIPO(:|\s*=)/)
      expect(src).toMatch(/import \{[^}]*ETIQUETA_TIPO[^}]*\} from '@\/lib\/tareas-clinicas\/modelo'/)
    }
  })
})
