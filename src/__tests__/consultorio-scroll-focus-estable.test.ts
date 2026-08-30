import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const fuente = readFileSync(
  join(process.cwd(), 'src/components/lente/VolverALaFuente.tsx'),
  'utf8',
)

function restaurador(): string {
  const inicio = fuente.indexOf('export function RestauradorDeRegreso()')
  if (inicio < 0) throw new Error('No se encontró RestauradorDeRegreso')
  return fuente.slice(inicio)
}

/**
 * ── POR QUÉ ESTAS ASERCIONES CAMBIARON (REG-355) ─────────────────────────────
 *
 * Comprobaban, por substring, las quince líneas que `RestauradorDeRegreso`
 * tenía EN LÍNEA para escuchar el gesto del médico. Estaban bien — y eran las
 * únicas: el restaurador de `/consulta` escribía `scrollTop` sin preguntar, y
 * se re-arma cuando `notaInternamientoId` llega de un `.then()` de Firestore.
 *
 * Copiar esas quince líneas al otro sitio habría garantizado que divergieran,
 * así que se sacaron a `lib/ui/el-dedo-manda.ts` y los dos escritores obedecen
 * la misma regla — no dos parecidas.
 *
 * Lo que este archivo sigue vigilando es lo que le toca a ESTE componente: que
 * use el módulo, que al cancelar consuma el contrato, y que un clic clínico no
 * lo cancele. **El comportamiento** —qué cuenta como gesto y qué no— se ejercita
 * despachando eventos de verdad en
 * `src/__tests__/el-dedo-manda-sobre-el-scroll.test.ts`, que es más fuerte que
 * cualquier substring.
 */
describe('Consultorio — scroll/focus estable en desktop y móvil', () => {
  it('el gesto del médico cancela una restauración diferida ANTES de mover scrollTop', () => {
    const bloque = restaurador()
    expect(bloque).toContain('vigilarGestoDelUsuario(main')
    expect(bloque).toContain('if (!vivo || canceladoPorUsuario) return')
    expect(bloque.indexOf('vigilarGestoDelUsuario('))
      .toBeLessThan(bloque.indexOf('main.scrollTop ='))
  })

  it('y suelta la escucha al desmontar: no queda nada peleando por el scroll', () => {
    const bloque = restaurador()
    expect(bloque).toContain('vigilancia.soltar()')
  })

  it('la lista de teclas ya no vive aquí — dos copias divergen', () => {
    const bloque = restaurador()
    expect(bloque).not.toContain("'PageDown', 'PageUp'")
    // Vive en el módulo, con su prueba de comportamiento.
    expect(fuente).toContain("from '@/lib/ui/el-dedo-manda'")
  })

  it('cancelar consume el contrato y evita que otro render vuelva a pelear por scroll/foco', () => {
    const bloque = restaurador()
    const cancelar = bloque.slice(
      bloque.indexOf('const vigilancia = vigilarGestoDelUsuario'),
      bloque.indexOf('const reponer ='),
    )
    expect(cancelar).toContain('canceladoPorUsuario = true')
    expect(cancelar).toContain('vivo = false')
    expect(cancelar).toContain('olvidarContrato(contrato.id)')
  })

  it('un click clínico normal no cancela la restauración por accidente', () => {
    // El médico pulsa cosas todo el rato sin querer mover la pantalla.
    const modulo = readFileSync(join(process.cwd(), 'src/lib/ui/el-dedo-manda.ts'), 'utf8')
    expect(modulo).not.toContain("addEventListener('click'")
    expect(modulo).not.toContain("addEventListener('pointerdown'")
  })
})
