import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * REG-347 — «NO ESTÁ» DE UN PACIENTE QUE SÍ ESTÁ.
 *
 * ── DE DÓNDE VIENE ───────────────────────────────────────────────────────────
 *
 * REG-341 acotó la lectura del directorio: `getPatients` dejó de bajarse el
 * consultorio entero y pasó a tener un techo. Correcto para la escala — y
 * **abrió un defecto** en la pantalla donde más duele.
 *
 * `/pacientes` cargaba «la lista» y filtraba EN MEMORIA. Con techo, ese filtro
 * busca dentro de un RECORTE: en un consultorio de 600 pacientes, teclear el
 * nombre del 550º devolvía «Sin resultados» — de alguien que está en el
 * expediente. En la pantalla cuyo trabajo entero es encontrar a un paciente, ésa
 * es la peor respuesta posible, porque **se lee como un hecho**.
 *
 * Y había un segundo sitio peor: al guardar un paciente nuevo, la comprobación
 * antiduplicado releía la lista sin caché. Con el techo, el duplicado podía
 * estar entre los que no vinieron — un aviso antiduplicado que falla en silencio
 * justo en los consultorios grandes, que son los que lo necesitan.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * **Buscar es preguntar al servidor.** La consulta indexada no depende del
 * techo. El filtro en memoria se queda sólo por debajo de dos caracteres y
 * mientras la consulta viaja — nunca como la respuesta final.
 *
 * Y quien RECORRE la lista, en vez de buscar, lee un aviso que dice cuántos se
 * están listando y que la búsqueda sí llega a todos.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **La búsqueda es por PREFIJO.** Un duplicado con el orden de los nombres
 *   cambiado —«López María» frente a «María López»— y sin teléfono en común no
 *   aparece. Antes tampoco aparecía por encima del techo, y de forma arbitraria;
 *   ahora el hueco es conocido y tiene forma. No se da por resuelto.
 * · **Un paciente sin campo `nombre` no sale en el listado** (Firestore omite de
 *   una consulta ordenada los documentos sin el campo del `orderBy`). Límite
 *   heredado de REG-341, con su golden.
 * · **Quedan pantallas sin declarar el recorte**: `/citas`, `/crm`,
 *   `/asistente`, `/hospitalizacion`, `/farmacia`, `/membresias`,
 *   `/cumplimiento`, `/reactivacion`, `/migracion`. Siguen abiertas en el
 *   tablero; ésta se arregla primero porque es la pantalla de buscar.
 * · No renderiza: que el aviso exista no prueba que se vea.
 */

const PAC = readFileSync('src/app/(dashboard)/pacientes/page.tsx', 'utf8')

describe('REG-347 · buscar es preguntar al servidor', () => {
  it('la búsqueda usa la consulta indexada', () => {
    expect(PAC).toMatch(/buscarPacientes\(clinicId, q\)/)
  })

  it('el resultado del servidor va ATADO al texto que lo produjo', () => {
    // Sin esto se enseñarían un instante los resultados de la búsqueda anterior
    // como si fueran de ésta — que en esta pantalla significa enseñar OTRO
    // paciente al que se está buscando.
    expect(PAC).toMatch(/busquedaServidor\.q === search\.trim\(\)/)
  })

  it('el filtro en memoria dejó de ser la respuesta final', () => {
    // Sigue existiendo (por debajo de dos caracteres, y mientras la consulta
    // viaja), pero el resultado del servidor manda cuando corresponde a este
    // texto: se comprueba que la salida temprana esté ANTES del filtro local.
    const iServidor = PAC.indexOf('if (busquedaServidor && busquedaServidor.q === search.trim()) return busquedaServidor.pacientes')
    const iFiltro = PAC.indexOf('.filter(p => norm(p.nombre).includes(q)')
    expect(iServidor).toBeGreaterThan(0)
    expect(iFiltro).toBeGreaterThan(iServidor)
  })

  it('ya no se baja el directorio para comprobar duplicados', () => {
    expect(PAC).not.toMatch(/getPatients\(clinicId!, \{ force: true \}\)/)
    // Se sondea por teléfono Y por nombre: el teléfono es la señal fuerte.
    expect(PAC).toMatch(/payload\.telefono \? buscarPacientes\(/)
    expect(PAC).toMatch(/payload\.nombre \? buscarPacientes\(/)
  })

  it('quien recorre la lista lee cuántos faltan y qué hacer', () => {
    expect(PAC).toMatch(/listaTruncada/)
    expect(PAC).toMatch(/búscalos por nombre, teléfono o CURP/)
    // Y dice que la búsqueda no tiene ese techo, que es la salida real.
    expect(PAC).toMatch(/la búsqueda sí llega a todos/)
  })

  it('el guardián sabe fallar: reconoce el patrón que se retiró', () => {
    // Probado al revés sin tocar el árbol.
    const antes = `
      const data = await getPatients(clinicId)
      const resultadosBusqueda = useMemo(() => {
        const q = norm(search.trim())
        if (!q) return null
        return patients.filter(p => norm(p.nombre).includes(q))
      }, [patients, search])`
    expect(/buscarPacientes\(/.test(antes)).toBe(false)
    expect(/busquedaServidor/.test(antes)).toBe(false)
    expect(/getPatients\(/.test(antes)).toBe(true)
  })
})
