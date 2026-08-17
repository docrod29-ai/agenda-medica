/**
 * LA SIEMBRA TIENE QUE TENER EXPEDIENTES CON HISTORIA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `scripts/design/sembrar-capturas.mjs` poblaba médico, pacientes, citas y
 * tareas clínicas… y **ni una sola nota**. Todos los expedientes salían con
 * «Sin notas todavía», 0 encuentros, sin signos y sin diagnósticos. Sobre esa
 * pantalla vacía se midió media docena de rebanadas de V15.
 *
 * El coste está escrito, uno por uno, en los propios guardianes:
 *
 *   · **RTC-10** declaró que `#spine-problemas` NO llegó a pintarse en su
 *     medición «porque ningún paciente sembrado tiene notas firmadas con dx ni
 *     fármacos».
 *   · **Las tres pasadas de re-puntuación §29** puntuaron el expediente VACÍO
 *     y lo dejaron escrito como limitación de la medida.
 *   · **RTC-31 (5ª rebanada)** no pudo medir la convivencia del primario con
 *     «Consulta sin cerrar — continuar»: para eso hace falta un borrador.
 *
 * Tres huecos declarados, la misma causa. Un arnés que sólo sabe enseñar la
 * pantalla vacía mide el producto que nadie usa.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Buscando cómo medir el hueco que RTC-31 había declarado. La respuesta no
 * estaba en el arnés sino en la siembra: no había con qué.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. La siembra crea notas, y **al menos una firmada con diagnósticos** — sin
 *    eso el Clinical Spine (§7) no tiene problemas que pintar y su mitad de la
 *    pantalla queda sin medir nunca.
 * 2. Y **al menos un borrador**, que es lo único que hace aparecer «Consulta
 *    sin cerrar — continuar» en el ancla.
 * 3. **Algún paciente se queda SIN notas a propósito**: el expediente vacío es
 *    el estado del paciente nuevo y también hay que poder medirlo.
 * 4. Todo sintético (regla `data-privacy.md`) y el sello de integridad se
 *    declara falso por su nombre: estas notas no pasan por `sellar()`, así que
 *    un hash inventado dejaría creer que sí.
 *
 * Probado al revés: quitando el borrador falla el caso 2; quitando los
 * diagnósticos de las firmadas falla el 1; poniendo un `hashIntegridad` con
 * pinta de sello real falla el 4.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No corre la siembra**: es un barrido del fuente. Que el documento quede
 *   ESCRITO en Firestore lo comprueba el arnés en navegador, que es donde se
 *   vio por primera vez el ancla con su encuentro sin cerrar.
 * · No cubre notas hospitalarias (ingreso/evolución/egreso) ni internamientos:
 *   Hospital y UCI viven tras bandera y su arnés es otro.
 * · No juzga si el CONTENIDO clínico sintético es verosímil — eso es criterio
 *   médico, y por eso las notas no llevan dosis.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SIEMBRA = readFileSync(join(process.cwd(), 'scripts/design/sembrar-capturas.mjs'), 'utf8')

/** Los objetos del arreglo `notas` de la siembra, en crudo. */
const bloqueDeNotas = () => {
  const i = SIEMBRA.indexOf('const notas = [')
  expect(i, 'la siembra ya no declara notas').toBeGreaterThan(0)
  return SIEMBRA.slice(i, SIEMBRA.indexOf('\n  ]', i))
}

describe('la siembra sintética tiene expedientes con historia', () => {
  it('1 · hay notas FIRMADAS, y traen diagnósticos y signos', () => {
    const notas = bloqueDeNotas()
    expect((notas.match(/estado: 'firmada'/g) ?? []).length).toBeGreaterThanOrEqual(2)
    // Sin dx no hay `#spine-problemas` que pintar — el hueco que RTC-10 declaró.
    expect(notas).toMatch(/diagnosticos: \[\s*\n\s*\{ descripcion:/)
    expect(notas).toMatch(/signosVitales: \{ ta: /)
  })

  it('2 · y al menos un BORRADOR, que es lo que enseña «Consulta sin cerrar»', () => {
    expect((bloqueDeNotas().match(/estado: 'borrador'/g) ?? []).length).toBeGreaterThanOrEqual(1)
  })

  it('3 · pero algún paciente se queda sin notas: el expediente vacío también se mide', () => {
    const notas = bloqueDeNotas()
    const conNotas = new Set([...notas.matchAll(/pacienteId: '([^']+)'/g)].map(m => m[1]))
    const sembrados = new Set([...SIEMBRA.matchAll(/id: '(pac-[^']+)'/g)].map(m => m[1]))
    expect(sembrados.size).toBeGreaterThan(conNotas.size)
  })

  it('4 · el sello de integridad se declara falso por su nombre', () => {
    /**
     * Estas notas no pasan por `sellar()`. Un hash con pinta de sello real
     * dejaría creer que sí, y el día que alguien verifique integridad sobre la
     * siembra obtendría un «válido» que no significa nada.
     */
    expect(SIEMBRA).toContain("hashIntegridad: 'siembra-sintetica-sin-sello'")
    expect(SIEMBRA).toMatch(/hashVersion: 0/)
  })

  it('5 · sigue siendo sintética: el candado anti-producción no se toca', () => {
    expect(SIEMBRA).toContain("El proyecto de siembra DEBE empezar por demo-")
    expect(SIEMBRA).toMatch(/const PROJECT_ID = 'demo-/)
  })
})
