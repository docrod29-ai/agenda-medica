/**
 * GOLDEN — un presuntivo elegido no es un presuntivo de fábrica.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El modelo estaba completo desde REG-372: `Diagnostico.tipo` con sus cuatro
 * valores y `tipoOrigen` diciendo quién lo puso, con este comentario:
 *
 *     'medico' — «Lo eligió una persona. Es lo único que autoriza a decir
 *                 confirmado.»
 *     'extraccion' — «El modelo emitió `tipo` explícitamente. Es una sugerencia,
 *                     no una firma.»
 *
 * Y **ninguna pantalla lo dejaba elegir.**
 *
 * La fila de un diagnóstico enseñaba descripción, CIE-10 y el botón de borrar. El
 * `tipo` no aparecía. Así que:
 *
 *  · un diagnóstico que la IA extrajo como **definitivo** se guardaba como
 *    definitivo con `tipoOrigen: 'extraccion'` — una sugerencia que el médico
 *    nunca vio como elección, y que no podía cambiar;
 *  · uno añadido a mano nacía `presuntivo` y se quedaba presuntivo para siempre,
 *    aunque el médico lo confirmara en su cabeza.
 *
 * Es **«sugerido ≠ confirmado»** y **«la autoridad final es del médico»**
 * incumplidos en el mismo control: el sistema no podía distinguir un presuntivo
 * ELEGIDO de uno de fábrica, y guardaba los dos igual.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Cambiar el tipo marca `tipoOrigen: 'medico'`. Es la **única** vía por la que un
 * diagnóstico pasa a estar firmado por una persona, y por eso no puede haber
 * ninguna otra escritura de `tipo` que no la ponga.
 *
 * ── LA PROCEDENCIA, UNA VEZ Y NO POR FILA ───────────────────────────────────
 *
 * Cuando algún diagnóstico trae el tipo del dictado o de la plantilla, se dice —
 * es el principio de PROCEDENCIA del sistema de diseño: lo que escribió la IA
 * enseña de dónde salió.
 *
 * Pero **una vez, no por fila**: un aviso por diagnóstico, en una nota con seis,
 * es ruido que se aprende a saltar, y entonces deja de proteger sin dejar de
 * ocupar sitio. Es el mismo criterio con el que `avisoAlPaciente` se dejó
 * opcional y con el que el aviso de vigencia de guías sólo sale donde hay cita.
 *
 * `por_defecto` cuenta igual que `extraccion`: en los dos casos **nadie lo
 * decidió**, que es lo único que este aviso afirma.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No obliga a revisar.** El médico puede firmar con diagnósticos cuyo tipo
 *   puso el dictado; lo que no puede es no enterarse. Obligar sería fijar
 *   política clínica —cuándo un tipo sugerido es aceptable— y eso no lo decide
 *   un archivo de software.
 * · **No cambia lo ya firmado.** Una nota firmada es inmutable (NOM-004): los
 *   diagnósticos de notas anteriores conservan su `tipoOrigen`, incluso ausente,
 *   porque rellenarlo sería inventar la autoría.
 * · **No toca `estado`** (activo/resuelto/crónico/en seguimiento), que es otro
 *   eje y tiene su propia historia.
 * · **No prueba el render.** Que el selector se VEA y se pueda usar con teclado
 *   depende del componente; aquí se comprueba que existe, que tiene etiqueta
 *   accesible y qué escribe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Diagnostico, OrigenDelTipoDeDiagnostico } from '@/types/expediente'

const CONSULTA = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
const TIPOS = readFileSync('src/types/expediente.ts', 'utf8')

/**
 * El bloque del selector de tipo, acotado para no confundirlo con el de vía.
 *
 * Se ancla en la etiqueta y se retrocede hasta su `<select`: el `disabled` va
 * antes que el `aria-label`, y cortar en la etiqueta lo dejaba fuera.
 */
const iEtiqueta = CONSULTA.indexOf('aria-label={`Tipo de diagnóstico')
const SELECTOR = CONSULTA.slice(CONSULTA.lastIndexOf('<select', iEtiqueta), iEtiqueta + 900)

describe('el médico puede elegir el tipo, que era lo que faltaba', () => {
  it('hay un selector de tipo en la fila del diagnóstico', () => {
    /**
     * AL REVÉS: antes la fila era descripción + CIE-10 + borrar. Sin este
     * control, `tipoOrigen: 'medico'` sólo lo llevaba el diagnóstico añadido a
     * mano, y ni ése se podía cambiar.
     */
    expect(SELECTOR, 'no se localizó el selector de tipo').not.toBe('')
    for (const t of ['presuntivo', 'definitivo', 'diferencial', 'descartado']) {
      expect(SELECTOR, `falta la opción «${t}»`).toContain(`value="${t}"`)
    }
  })

  it('y ofrece los CUATRO tipos del modelo, ni uno más ni uno menos', () => {
    /* Ofrecer tres dejaría un estado clínico inalcanzable desde la pantalla, que
       es la forma en que un modelo completo se vuelve uno incompleto. */
    const enElModelo = /tipo: '(definitivo|presuntivo|descartado|diferencial)'(?: \| '(?:definitivo|presuntivo|descartado|diferencial)')*/.exec(TIPOS)?.[0] ?? ''
    expect(enElModelo, 'no se localizó el tipo en el modelo').not.toBe('')
    const opciones = [...SELECTOR.matchAll(/value="([a-z]+)"/g)].map(m => m[1])
    expect(new Set(opciones)).toEqual(new Set(['presuntivo', 'definitivo', 'diferencial', 'descartado']))
  })

  it('tiene etiqueta accesible con el diagnóstico dentro', () => {
    /* Cuatro selectores idénticos en una nota con cuatro diagnósticos son
       indistinguibles para un lector de pantalla. */
    expect(SELECTOR).toMatch(/aria-label=\{`Tipo de diagnóstico\$\{d\.descripcion \? `: \$\{d\.descripcion\}` : ''\}`\}/)
  })

  it('y se bloquea en una nota firmada', () => {
    /* Una nota firmada es inmutable (NOM-004). */
    expect(SELECTOR).toMatch(/disabled=\{firmada\}/)
  })
})

describe('elegir es lo que convierte una sugerencia en una decisión', () => {
  it('cambiar el tipo marca `tipoOrigen: medico`', () => {
    /**
     * El corazón del arreglo. Sin esto el selector cambiaría el tipo y dejaría
     * el origen en `extraccion`: la pantalla diría que el médico eligió y el
     * expediente diría que lo puso el modelo.
     */
    expect(SELECTOR).toMatch(/tipoOrigen: 'medico'/)
    expect(SELECTOR).toMatch(/tipo: e\.target\.value as Diagnostico\['tipo'\]/)
  })

  it('y el diagnóstico añadido a mano sigue naciendo con su origen', () => {
    expect(CONSULTA).toMatch(/tipo: 'presuntivo', estado: 'activo', tipoOrigen: 'medico'/)
  })

  it('el modelo dice que «medico» es lo único que autoriza a confirmar', () => {
    /* Si esa frase desaparece, el selector pierde su razón de ser y alguien lo
       convertirá en un campo más. */
    expect(TIPOS).toMatch(/Lo eligió una persona\. Es lo único que autoriza a decir «confirmado»/)
    expect(TIPOS).toMatch(/Es una sugerencia, no una firma/)
  })
})

describe('la procedencia se dice, y sólo cuando hay algo que decir', () => {
  it('el aviso mira los que NO puso el médico', () => {
    expect(CONSULTA).toMatch(/diagnosticos\.some\(d => d\.descripcion\.trim\(\) && d\.tipoOrigen !== 'medico'\)/)
  })

  it('`por_defecto` cuenta igual que `extraccion`', () => {
    /**
     * En los dos casos nadie lo decidió, que es lo único que el aviso afirma.
     * Distinguirlos en la pantalla sería enseñar el modelo, no el trabajo.
     */
    const origenes: OrigenDelTipoDeDiagnostico[] = ['extraccion', 'por_defecto']
    const avisa = (o?: OrigenDelTipoDeDiagnostico) => o !== 'medico'
    for (const o of origenes) expect(avisa(o), o).toBe(true)
    expect(avisa('medico')).toBe(false)
    /* Y un diagnóstico sin origen —notas anteriores a REG-372— también avisa:
       «no consta» no es «lo eligió el médico». */
    expect(avisa(undefined)).toBe(true)
  })

  it('no avisa por una fila vacía', () => {
    /* «Agregar diagnóstico» crea una fila en blanco. Avisar de ella sería avisar
       de algo que el médico acaba de empezar a escribir. */
    const d: Partial<Diagnostico> = { descripcion: '   ', tipoOrigen: 'extraccion' }
    expect(Boolean(d.descripcion?.trim() && d.tipoOrigen !== 'medico')).toBe(false)
  })

  it('y se dice UNA vez, no por fila', () => {
    /**
     * Un aviso por diagnóstico, en una nota con seis, es ruido que se aprende a
     * saltar — y entonces deja de proteger sin dejar de ocupar sitio. El bloque
     * vive fuera del `.map`.
     */
    const iMap = CONSULTA.indexOf('{diagnosticos.map((d, i) =>')
    const iAviso = CONSULTA.indexOf("El tipo de {diagnosticos.filter(d => d.descripcion.trim()")
    expect(iAviso, 'no se localizó el aviso de procedencia').toBeGreaterThan(0)
    const cierreDelMap = CONSULTA.indexOf('))}', iMap)
    expect(iAviso, 'el aviso está dentro del map: saldría uno por diagnóstico').toBeGreaterThan(cierreDelMap)
  })
})
