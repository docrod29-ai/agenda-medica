/**
 * REP-037 · ASE-001 (AS-expedientes) — buscar a un paciente por su apellido a
 * secas («iparraguirre») contesta «Ninguno de los N expedientes coincide» aunque
 * el paciente existe: la respuesta vacía del servidor SUSTITUYE al acierto del
 * filtro local.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/app/(dashboard)/pacientes/page.tsx:168`:
 *   `if (busquedaServidor && busquedaServidor.q === search.trim()) return busquedaServidor.pacientes`
 * Con una sola palabra, `buscarPacientes` (`firestore.ts:333`) sólo sondea por
 * PREFIJO sobre `nombre` («Tadeo Iparraguirre Nolasco» no empieza por
 * «iparraguirre»), y el sondeo por palabra (:352-354) excluye la palabra cuando
 * ES la búsqueda entera. El servidor devuelve `[]`, y :168 lo devuelve como
 * respuesta final, pisando el `includes` local de :171 que sí lo encontraba.
 * La pantalla imprime `vacio-de-la-lista.ts:131`.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-expedientes, hallazgo ASE-001 (`crudos/AS-expedientes.json`), en
 * la app levantada. El equipo rojo (`crudos/R-AS-expedientes.json`) confirmó
 * las tres líneas y midió el rescate por parecidos:
 * `similitudNombre('iparraguirre', 'Tadeo Iparraguirre Nolasco') = 0.667` <
 * `UMBRAL_NOMBRE = 0.8` → `buscarPosiblesDuplicados` devuelve `[]`. Corrigió al
 * auditor: «Barquin Salcedo» (dos palabras) SÍ lo rescata; el fallo sin red es
 * el de UNA palabra. Y su propuesta de quitar el filtro de :354 es un no-op
 * (el golden `el-orden-de-los-nombres-no-decide-si-existes.test.ts:167` fija
 * que con una palabra no se sondea dos veces lo mismo). Lo que arregla es UNIR
 * servidor + local en :168.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * REG-347 («buscar es preguntar al servidor») convirtió el resultado del
 * servidor en LA respuesta, y dejó el filtro local sólo «mientras la consulta
 * viaja». Pero el servidor no sabe «contiene»: su vacío no significa «no
 * está», significa «no empieza por». La regla de REG-347 se aplicó como
 * sustitución cuando tenía que ser unión.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §4 en clave de directorio: ausencia de resultado no es
 * resultado de ausencia. Invariante «UN PACIENTE · UNA IDENTIDAD»: un «no
 * está» falso abre un segundo expediente.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL sobre `pacientes/page.tsx`, declarado: la fusión vive
 * dentro de un `useMemo` de un componente de cliente y no se puede importar
 * sin montar React con ClinicContext, Auth y Firestore. Se acompaña de un
 * COMPORTAMIENTO real que demuestra por qué la unión importa: el rescate por
 * parecidos NO cubre este caso (y no debe: 0.8 es el umbral que evita ruido).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * El paciente que NO está entre los cargados (techo REG-341) y cuyo apellido
 * no es la primera palabra: ése sigue necesitando un índice normalizado
 * (`nombreBusqueda`) en el servidor. No monta la pantalla.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { buscarPosiblesDuplicados, similitudNombre, UMBRAL_NOMBRE } from '@/lib/pacientes/duplicados'

const raiz = path.resolve(__dirname, '../../../..')
const pagina = readFileSync(path.join(raiz, 'src/app/(dashboard)/pacientes/page.tsx'), 'utf8')

/** El cuerpo del `useMemo` de `resultadosBusqueda`. */
function bloqueResultados(): string {
  const ini = pagina.indexOf('const resultadosBusqueda = useMemo(')
  expect(ini, 'no encuentro `resultadosBusqueda` en pacientes/page.tsx').toBeGreaterThan(-1)
  const resto = pagina.slice(ini)
  const fin = resto.indexOf('}, [')
  return fin === -1 ? resto : resto.slice(0, fin)
}

describe('REP-037 · el resultado del servidor se UNE al filtro local, no lo sustituye', () => {
  const tadeo = { id: 'p1', nombre: 'Tadeo Iparraguirre Nolasco', telefono: '5550101010' }

  it('control (comportamiento): el rescate por parecidos NO cubre una sola palabra de un nombre de tres', () => {
    expect(similitudNombre('iparraguirre', tadeo.nombre)).toBeLessThan(UMBRAL_NOMBRE)
    expect(buscarPosiblesDuplicados({ nombre: 'iparraguirre' }, [tadeo])).toEqual([])
  })

  it('control (comportamiento): el filtro local por subcadena SÍ lo encuentra — es lo que :168 pisa', () => {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    expect([tadeo].filter(p => norm(p.nombre).includes(norm('iparraguirre')))).toHaveLength(1)
  })

  it('HOY FALLA: `resultadosBusqueda` no devuelve el resultado del servidor A SECAS cuando el texto coincide', () => {
    const bloque = bloqueResultados()
    const sustituye = /if\s*\(\s*busquedaServidor\s*&&[^\n]*\)\s*return\s+busquedaServidor\.pacientes\s*$/m.test(bloque)
    expect(sustituye, 'el vacío del servidor sigue sustituyendo al filtro local:\n' + bloque).toBe(false)
    // La unión debe seguir mirando LO YA CARGADO junto al servidor.
    expect(bloque).toMatch(/busquedaServidor\.pacientes/)
    expect(bloque).toMatch(/patients\s*\n?\s*\.filter|patients\.filter/)
  })
})
