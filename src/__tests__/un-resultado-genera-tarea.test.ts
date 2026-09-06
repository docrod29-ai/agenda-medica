/**
 * UN RESULTADO GENERA UNA TAREA — REG-252.
 *
 * ── EL BUCLE TENÍA FUGA DEL 100 %, POR CONSTRUCCIÓN ─────────────────────────
 *
 * El charter V7 §F1 pide este ciclo, y que se **cierre**:
 *
 *     ORDEN → TOMA → RESULTADO → REVISIÓN → CONDUCTA → PACIENTE → CERRADO
 *
 * `tareaDeResultado()` existía. Estaba probada. Y **no la llamaba nadie**: cero
 * referencias en todo el repositorio fuera de su propio archivo de pruebas.
 * Ningún resultado de laboratorio generaba jamás una tarea de revisión.
 *
 * No es que el ciclo se cerrara poco: **nunca empezaba**.
 *
 * ── HABÍA UNA ALERTA, Y NO ES LO MISMO ──────────────────────────────────────
 *
 * Los valores críticos sí disparaban una alerta. Pero una alerta se lee, se
 * cierra, y nadie vuelve a saber si alguien actuó. El charter lo dice con estas
 * palabras: **«NexusMED debe CERRAR el trabajo, no sólo mostrar alertas»**.
 *
 * Y los NO críticos no tenían ni eso.
 *
 * ── POR QUÉ SE CONECTA EN `cargarResultadosLab` ─────────────────────────────
 *
 * Porque es el cuello de botella: los dos caminos por los que hoy entra un
 * resultado —la carga manual y la importación FHIR— pasan por ahí. Conectarlo
 * en las pantallas dejaría que el tercer camino que alguien añada naciera con
 * la misma fuga.
 *
 * Es la lección de las **veintiuna** veces que en este repositorio algo estaba
 * «escrito, probado y sin conectar»: se conecta donde el dato pasa
 * obligatoriamente, no donde es cómodo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { tareaDeResultado } from '@/lib/tareas-clinicas/derivar'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const firestore = leer('src', 'lib', 'hospital', 'firestore.ts')
const page = leer('src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx')

describe('el motor ya existía y ahora CORRE', () => {
  /**
   * Por SÍMBOLO y no por la línea de import entera: estas dos aserciones se
   * rompieron el día que el mismo módulo importó un segundo símbolo (REG-570),
   * sin que nada de lo que vigilan hubiera cambiado. Un guardián que se rompe al
   * añadir un import no vigila lo que dice vigilar.
   */
  const importaDe = (mod: string, simbolo: string) =>
    new RegExp(`import \\{[^}]*\\b${simbolo}\\b[^}]*\\} from '@/lib/tareas-clinicas/${mod}'`).test(firestore)

  it('`cargarResultadosLab` llama a `tareaDeResultado`', () => {
    expect(importaDe('derivar', 'tareaDeResultado')).toBe(true)
    expect(firestore).toContain('tareaDeResultado({')
  })

  it('y las persiste', () => {
    expect(importaDe('firestore', 'crearTareas')).toBe(true)
    expect(firestore).toMatch(/await crearTareas\(clinicId, aCrear\)/)
  })

  it('está en el CUELLO DE BOTELLA, no en la pantalla', () => {
    /**
     * Los dos caminos —manual y FHIR— pasan por `cargarResultadosLab`. Si la
     * tarea se creara en la pantalla, el tercer camino que alguien añada
     * nacería con la misma fuga.
     */
    expect(firestore).toMatch(/POR QUÉ SE CONECTA AQUÍ Y NO EN LAS PANTALLAS/)
    expect(page).not.toContain('tareaDeResultado')
  })

  it('una tarea POR ESTUDIO, no una por sobre', () => {
    /** El médico revisa resultados, no sobres. */
    expect(firestore).toMatch(/resultados\.filter\(r => r\?\.estudio\)\.map\(r => tareaDeResultado/)
  })
})

describe('lo que NO decide este código', () => {
  it('qué es crítico viaja tal cual, no se juzga aquí', () => {
    /**
     * `critico` llega en el resultado y se pasa sin tocar. Decidir aquí qué es
     * crítico sería criterio clínico en un archivo de persistencia — y ya vive,
     * con sus rangos, en `lab-criticos.ts`.
     */
    expect(firestore).toMatch(/critico: !!r\.critico/)
    expect(firestore).toMatch(/eso es criterio clínico y vive en `lab-criticos\.ts`/)
  })

  it('sin paciente en la solicitud no se inventa uno', () => {
    /** Una tarea colgada del paciente equivocado es peor que ninguna tarea. */
    expect(firestore).toMatch(/const aCrear = pacienteId\s*\n?\s*\?/)
  })
})

describe('si la tarea NO se crea, no se calla', () => {
  it('la función devuelve qué pasó en vez de `void`', () => {
    /**
     * Devolver `void` haría invisible el fallo — que es exactamente el defecto
     * que se está reparando.
     */
    expect(firestore).toMatch(/Promise<ResultadoGuardado>/)
    expect(firestore).toMatch(/tareasCreadas: number/)
    expect(firestore).toMatch(/tareasEsperadas: number/)
  })

  it('la carga MANUAL avisa al médico', () => {
    expect(page).toMatch(/guardado\.tareasCreadas < guardado\.tareasEsperadas/)
    expect(page).toMatch(/no se creó la tarea de revisión/)
  })

  it('la importación FHIR también, y con más razón', () => {
    /** Ahí nadie estaba mirando la pantalla cuando entró el resultado. */
    expect(page).toMatch(/g\.tareasCreadas < g\.tareasEsperadas/)
    expect(page).toMatch(/sin tarea de revisión/)
  })

  it('el resultado guardado NO se pierde por un fallo de la tarea', () => {
    /** La transacción del resultado va antes y no depende de esto. */
    const i = firestore.indexOf('await runTransaction')
    const j = firestore.indexOf('const tareasCreadas')
    expect(i).toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(i)
  })
})

describe('la tarea que se crea es la correcta', () => {
  const base = {
    clinicId: 'c1', patientId: 'p1', patientNombre: 'Paciente Sintético',
    estudio: 'Biometría hemática', ahoraMs: Date.parse('2026-08-08T10:00:00.000Z'),
  }

  it('lo crítico vence el mismo día; lo demás, en dos', () => {
    const critica = tareaDeResultado({ ...base, critico: true })
    const normal = tareaDeResultado({ ...base, critico: false })
    expect(Date.parse(critica.venceEn!) - base.ahoraMs).toBe(86_400_000)
    expect(Date.parse(normal.venceEn!) - base.ahoraMs).toBe(2 * 86_400_000)
  })

  it('nace en «solicitada»: nadie la ha aceptado todavía', () => {
    expect(tareaDeResultado({ ...base, critico: false }).estado).toBe('solicitada')
  })

  it('el título nombra el estudio, para poder decidir sin abrirla', () => {
    expect(tareaDeResultado({ ...base, critico: false }).titulo)
      .toBe('Revisar resultado: Biometría hemática')
  })
})
