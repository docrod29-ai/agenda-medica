import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * REG-341 — ACOTAR UNA LECTURA CREA UN HUECO; CALLARLO LO VUELVE UNA MENTIRA.
 *
 * ── DE DÓNDE SALE ESTE GOLDEN ────────────────────────────────────────────────
 *
 * A3 portó la lectura acotada del directorio de pacientes (PR #356): `getPatients`
 * dejó de bajarse el consultorio entero y pasó a tener un TECHO. Eso arregla la
 * escala y **abre un defecto nuevo** si nadie lo mira: catorce pantallas piden
 * «la lista» y reciben, sin enterarse, un RECORTE.
 *
 * En un consultorio de 600 pacientes:
 *   · el buscador dice «sin coincidencias» de alguien que existe;
 *   · la lista de retención NOM-004 dice «ninguno por revisar»;
 *   · `.find()` sobre el recorte devuelve «no está».
 *
 * Los tres fallan **hacia el silencio**, que es la peor dirección: un error
 * ruidoso se arregla, uno callado se cree. Es la regla 4 de seguridad clínica
 * —ausencia de dato no es dato de ausencia— aplicada a una lista.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Quien lee de forma acotada o bien **busca en el servidor**, o bien **declara
 * el recorte en pantalla**. Filtrar en memoria sobre un recorte y callarlo no es
 * una opción.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · Lee la FUENTE de tres pantallas concretas; no es un barrido del árbol. Las
 *   otras once que llaman a `getPatients` siguen recibiendo el recorte sin
 *   declararlo — están anotadas como P1 en el tablero, no dadas por buenas.
 * · No renderiza ni mide píxeles: que el aviso EXISTA no prueba que se vea.
 *   Eso es navegador, y no se ha ejecutado.
 * · No prueba la búsqueda contra Firestore real: eso es `scale-342`.
 */

const leer = (p: string) => readFileSync(p, 'utf8')

const PALETA = 'src/components/PaletteBusqueda.tsx'
const RETENCION = 'src/app/(dashboard)/cumplimiento/retencion/page.tsx'
const CONSULTOR = 'src/app/(dashboard)/consultor/page.tsx'

describe('REG-341 · la paleta busca en el servidor y dice si se quedó corta', () => {
  it('usa la búsqueda indexada, no un filtro sobre la lista', () => {
    const src = leer(PALETA)
    expect(src).toMatch(/buscarPacientes\(/)
    // Y ya NO se baja el directorio para enseñar seis filas.
    expect(src).not.toMatch(/getPatients\(/)
  })

  it('las sugerencias en frío se piden ACOTADAS', () => {
    expect(leer(PALETA)).toMatch(/listarPacientesPagina\(clinicId,\s*\{\s*limite:/)
  })

  it('cuando la ventana se llena, lo dice', () => {
    const src = leer(PALETA)
    expect(src).toMatch(/truncada/)
    expect(src).toMatch(/Hay más coincidencias/)
  })
})

describe('REG-341 · la lista de retención no finge estar completa', () => {
  it('ya no dispara un Promise.all sobre TODOS los pacientes', () => {
    const src = leer(RETENCION)
    expect(src).not.toMatch(/getPatients\(/)
    expect(src).toMatch(/listarPacientesPagina\(/)
  })

  it('las notas se piden en tandas, no todas a la vez', () => {
    const src = leer(RETENCION)
    expect(src).toMatch(/const TANDA =/)
    // El `Promise.all` que queda es sobre la TANDA, no sobre la página entera.
    expect(src).toMatch(/Promise\.all\(tanda\.map/)
  })

  it('si llegó al techo lo dice en pantalla, y con esas palabras', () => {
    const src = leer(RETENCION)
    expect(src).toMatch(/setTruncada\(alcanzoElTecho\)/)
    expect(src).toMatch(/esta pantalla no ha revisado/)
  })
})

describe('REG-341 · quien necesita UN paciente lee UN paciente', () => {
  it('el consultor no se baja el directorio para hacer .find()', () => {
    const src = leer(CONSULTOR)
    expect(src).toMatch(/getPatient\(clinicId, id\)/)
    expect(src).not.toMatch(/getPatients\(clinicId\)\.then\(ps =>/)
  })
})

describe('REG-341 · el guardián sabe fallar', () => {
  it('detecta el patrón exacto que se acaba de retirar', () => {
    // Probado al revés sin tocar el árbol: se le da el criterio a la fuente
    // ANTERIOR. Si esto no fallara, las aserciones de arriba no probarían nada.
    const antes = `
      const pacientes = await getPatients(clinicId)
      const evals = await Promise.all(pacientes.map(async (p) => {
        const notas = await getNotas(clinicId, p.id)
        return evaluarRetencion(p, notas, p.ultimaCita)
      }))`
    expect(/getPatients\(/.test(antes)).toBe(true)
    expect(/Promise\.all\(tanda\.map/.test(antes)).toBe(false)
    expect(/const TANDA =/.test(antes)).toBe(false)
  })
})
