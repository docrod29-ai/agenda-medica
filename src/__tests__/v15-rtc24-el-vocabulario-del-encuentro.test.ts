/**
 * RTC-24 — «cuatro nombres para el objeto central»: medidos, son **un lugar,
 * dos acciones distintas y una abreviatura**. Lo que queda es UNA decisión, y
 * es del dueño.
 *
 * ── LA QUEJA, Y LO QUE LA MEDICIÓN DESHACE ──────────────────────────────────
 *
 * ORT-19 listó «Encuentro / Iniciar consulta / Consulta / Nueva consulta con
 * IA». El cuarto murió con RTC-13. De los tres restantes se midió en navegador
 * (`medir-rtc24-nombres-del-encuentro-v15.mjs`) qué se pinta, dónde y con qué
 * destino, en dos anchos y con y sin paciente:
 *
 *   «Encuentro»         riel          LUGAR (un contexto del riel)
 *   «Nueva consulta»    expediente    ACCIÓN: crear uno que NO existe
 *   «Iniciar consulta»  héroe/citas   ACCIÓN: entrar en el que YA está citado
 *   «Consulta»          filas, pulgar la misma acción, abreviada por espacio
 *
 * **No son cuatro sinónimos.** «Iniciar» y «Nueva» no dicen lo mismo: una
 * entra en una cita que existe, la otra abre una consulta que no estaba
 * agendada. Unificarlas habría borrado una distinción que el médico usa.
 *
 * Y el destino del contexto, que parecía un hallazgo nuevo —«Encuentro» lleva
 * a `/pacientes` cuando no hay ninguno abierto—, está **decidido y escrito**:
 * el propio `title` lo dice, «ninguno abierto; elige un paciente para
 * empezar». No se puede entrar a un encuentro sin paciente. REFUTADO también.
 *
 * ── LO QUE SÍ QUEDA, Y POR QUÉ NO LO DECIDE ESTA PRUEBA ─────────────────────
 *
 * **Dos sustantivos para el mismo objeto**: el lugar se llama *encuentro* y
 * las acciones se llaman *consulta*. Eso sí es vocabulario partido.
 *
 * Pero elegir cuál gana no es una decisión de implementación:
 *
 *   · *encuentro* es el término de la especificación (y de FHIR: `Encounter`);
 *   · *consulta* es lo que dice un médico mexicano, y lo que dice el paciente.
 *
 * El dueño es internista en ejercicio; esta prueba no tiene opinión sobre cómo
 * se llama su trabajo. **Se declara la decisión y se congela el vocabulario
 * mientras tanto**, que es lo que un guardián sí puede hacer: que no siga
 * creciendo la lista mientras la pregunta espera.
 *
 * Probado al revés: añadiendo un quinto nombre al cromo falla el caso 1;
 * borrando la razón del destino del contexto falla el 3.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No unifica nada.** A propósito: la unificación que la queja pedía habría
 *   borrado la distinción entre «entrar en la cita» y «abrir una consulta».
 * · **No decide el sustantivo.** Declarado arriba como decisión del dueño.
 * · No cubre el modo Secretaria ni la landing, que hablan a otro lector.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const RIEL = leer('src/components/FlowRail.tsx')
const PULGAR = leer('src/components/BottomNav.tsx')
const EXPEDIENTE = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')
const HOY = leer('src/app/(dashboard)/dashboard/page.tsx')

describe('RTC-24 — el vocabulario del encuentro, congelado mientras se decide', () => {
  it('1 · el cromo nombra el LUGAR de una sola manera', () => {
    // Un quinto nombre en el riel o en el pulgar sería la lista creciendo
    // mientras la pregunta espera.
    expect(RIEL).toContain('label="Encuentro"')
    expect(PULGAR).toMatch(/label: 'Consulta'/)
  })

  it('2 · y las DOS acciones siguen siendo dos, porque no dicen lo mismo', () => {
    /**
     * «Iniciar consulta» entra en una cita que existe; «Nueva consulta» abre
     * una que no estaba agendada. Unificarlas —que es lo que la queja pedía—
     * borraría una distinción que el médico usa todos los días.
     */
    expect(HOY).toContain('Iniciar consulta')
    expect(EXPEDIENTE).toContain('Nueva consulta')
  })

  it('3 · el contexto del riel explica a dónde lleva cuando no hay ninguno abierto', () => {
    /**
     * Parecía un hallazgo —«Encuentro» lleva a `/pacientes`— y está decidido y
     * escrito: no se puede entrar a un encuentro sin paciente. Si alguien
     * borra esa razón, el destino vuelve a parecer un error.
     */
    expect(RIEL).toContain("abierto ? rutaDelEncuentro(abierto) : '/pacientes'")
    expect(RIEL).toContain('ninguno abierto; elige un paciente para empezar')
  })
})
