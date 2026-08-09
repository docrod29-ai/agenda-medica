/**
 * ¿DE DÓNDE SALIÓ ESTO? SE VE — REG-239.
 *
 * ── EL DEFECTO, Y ES EL DE SIEMPRE ──────────────────────────────────────────
 *
 * `rastrearNota()` devuelve, para cada frase de la nota, **el fragmento del
 * dictado que la sostiene con sus posiciones exactas**. Tiene corpus oro
 * (`corpus-oro-de-donde-salio-esto.test.ts`). Existía desde hace versiones.
 *
 * La consulta importaba **sólo `afirmacionesSinRespaldo`** — la mitad negativa,
 * la que dice qué NO se sostiene. La mitad que contesta la pregunta que el
 * médico se hace de verdad —«¿de dónde sacó la IA esto?»— no llegaba a ninguna
 * pantalla.
 *
 * Escrito, probado y sin conectar. Familia número uno.
 *
 * ── POR QUÉ IMPORTA, MEDIDO Y PUBLICADO ─────────────────────────────────────
 *
 * De la investigación del mercado (7-ago-2026):
 *
 *   · 62 811 pares borrador→nota final en la Universidad de California:
 *     **216 199 oraciones borradas**, 165 939 insertadas. El borrador no se
 *     firma, se reescribe.
 *   · Y se reescribe para **añadir cautela** (p < 0,001): los borradores de IA
 *     afirman de más.
 *
 * De los tres productos que dominan el mercado, **sólo Abridge** tiene un
 * mecanismo contra eso. Nabla **borra el audio original**, así que ni podría.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { rastrearNota } from '@/lib/expediente/trazabilidad'
import {
  POR_QUE_EMPIEZA_CERRADO,
  POR_QUE_NO_HAY_PORCENTAJE,
  EL_MOTOR_YA_ESTABA,
} from '@/components/DeDondeSalioEsto'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const comp = leer('src', 'components', 'DeDondeSalioEsto.tsx')
const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

describe('está CONECTADO — que es todo el punto', () => {
  it('la consulta lo importa y lo monta', () => {
    expect(page).toContain("import { DeDondeSalioEsto } from '@/components/DeDondeSalioEsto'")
    expect(page).toContain('<DeDondeSalioEsto')
  })

  it('recibe la MISMA nota que se firma, no un resumen aparte', () => {
    /**
     * `textoDeLaNota(resumen, diagnosticos, secciones)` es la función que ya
     * usa `sinRespaldo`. Trazar un texto distinto del que se firma sería una
     * comprobación sobre algo que nadie va a leer.
     */
    expect(page).toMatch(/nota=\{textoDeLaNota\(resumen, diagnosticos, secciones\)\}/)
    expect(page).toMatch(/dictado=\{voz\.transcripcion\}/)
  })

  it('usa el motor que ya existía, no uno nuevo', () => {
    expect(comp).toContain("from '@/lib/expediente/trazabilidad'")
    expect(comp).toContain('rastrearNota(')
    expect(EL_MOTOR_YA_ESTABA).toMatch(/sin conectar/)
  })
})

describe('lo que enseña es verdad comprobable', () => {
  const dictado =
    'El paciente refiere tos de cinco días con expectoración verdosa. ' +
    'Niega fiebre. Le doy moxifloxacino cuatrocientos miligramos cada 24 horas por 14 días.'

  it('una frase dictada aparece con SU fragmento', () => {
    const t = rastrearNota('Refiere tos de cinco días con expectoración verdosa.', dictado)
    expect(t[0].estado).toBe('respaldada')
    expect(t[0].segmento?.texto).toMatch(/tos de cinco d[íi]as/)
  })

  it('una frase que NADIE dictó sale marcada', () => {
    const t = rastrearNota('Paciente con nefropatía diabética estadio 4.', dictado)
    expect(t[0].estado).toBe('sin_respaldo')
    expect(t[0].huerfanas.length).toBeGreaterThan(0)
  })

  it('el fragmento se cita LITERAL — no se parafrasea ni se recorta', () => {
    expect(comp).toContain('«{t.segmento.texto}»')
    expect(comp).not.toMatch(/segmento\.texto\.slice\(/)
  })
})

describe('las decisiones de diseño, y por qué', () => {
  it('empieza CERRADO', () => {
    expect(comp).toMatch(/useState\(false\)/)
    expect(POR_QUE_EMPIEZA_CERRADO).toMatch(/ruido/)
  })

  it('NO puntúa la nota con un porcentaje', () => {
    /**
     * Un «94 % respaldada» invita a firmar por el número en vez de por las
     * tres frases que están en rojo.
     */
    /**
     * Se mira el CÓDIGO, no la prosa: la primera versión de esta prueba
     * buscaba «% respaldada» en el archivo entero y saltaba con el comentario
     * que explica por qué NO existe. Una prueba que se caza a sí misma no
     * prueba nada del producto.
     */
    const codigo = comp.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(codigo).not.toMatch(/cobertura/)
    expect(codigo).not.toMatch(/Math\.round|toFixed\(|'%'|`%`/)
    expect(POR_QUE_NO_HAY_PORCENTAJE).toMatch(/tres frases/)
  })

  it('no dice que una frase sin respaldo sea FALSA', () => {
    /**
     * Puede venir del expediente o de una exploración que no se narró en voz
     * alta. Decir «falsa» sería afirmar más de lo que se midió.
     */
    expect(comp).toMatch(/no la vuelve falsa/)
  })

  it('sin dictado no se enseña un panel vacío', () => {
    expect(comp).toMatch(/if \(!p\.dictado\.trim\(\) \|\| !p\.nota\.trim\(\)\) return null/)
  })
})

describe('usa tokens de color que EXISTEN', () => {
  /**
   * La primera versión de este componente usaba `--ok`, `--warn` y `--danger`.
   * Ninguno de los tres existe en `globals.css`: los reales son `--green`,
   * `--amber` y `--red`. Se cazó mirando el archivo, no ejecutando — un token
   * inexistente no truena, sólo pinta transparente.
   */
  const css = leer('src', 'app', 'globals.css')

  it.each(['--green', '--amber', '--red', '--text3', '--border', '--s2', '--r-pill'])(
    '%s está definido', (t) => expect(css).toMatch(new RegExp(`\\${t}\\s*:`)))

  it('no quedó ninguno de los inventados', () => {
    expect(comp).not.toMatch(/var\(--ok\)|var\(--warn\)|var\(--danger\)|--border-suave/)
  })
})
