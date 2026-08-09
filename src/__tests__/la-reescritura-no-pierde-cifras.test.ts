/**
 * UNA REESCRITURA NO PIERDE NI CAMBIA UNA CIFRA — REG-240.
 *
 * ── EL HUECO ────────────────────────────────────────────────────────────────
 *
 * El editor por chat ya existía y ya estaba conectado: el médico escribe «la
 * dosis es 500 mg» o «haz esto más conciso» y el modelo devuelve la nota
 * reescrita. Lo que **no** existía es nada que comprobara qué se llevó por
 * delante.
 *
 * Pedirle a un modelo «más conciso» sobre un plan de tratamiento puede hacer
 * que desaparezca «cada 8 horas» o que «400 mg» quede en «400». **El texto
 * sigue leyéndose bien** — ésa es exactamente la trampa.
 *
 * ── POR QUÉ NO ES PARANOIA, ESTÁ MEDIDO ─────────────────────────────────────
 *
 * Sobre 62 811 pares borrador→nota final en la Universidad de California (AMIA
 * 2026), los médicos **eliminaron 216 199 oraciones** y reemplazaron 52 542. Un
 * modelo reescribiendo texto clínico cambia mucho más de lo que se le pidió.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Toda cifra con unidad sobrevive, **salvo que aparezca en la INSTRUCCIÓN**.
 * «La dosis es 500 mg» autoriza; «hazlo más conciso» no autoriza nada.
 *
 * Y no repara: **dice** qué se perdió. Volver a meter la cifra caída sería
 * reescribir una nota clínica por cuenta propia.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  cifrasClinicas,
  queCambioEnLasCifras,
  loQueSeLlevoPorDelante,
  POR_QUE_LA_INSTRUCCION_ES_LA_LLAVE,
  POR_QUE_NO_REPARA,
} from '@/lib/seguridad/la-reescritura-no-pierde-cifras'

const PLAN =
  'Moxifloxacino 400 mg vía oral cada 24 horas por 14 días. ' +
  'Paracetamol 500 mg cada 8 horas si dolor. TA 120/80 mmHg, temperatura 37.5 grados.'

describe('lee las cifras que importan', () => {
  it('caza dosis, frecuencia, duración, tensión y temperatura', () => {
    const c = cifrasClinicas(PLAN)
    for (const esperada of ['400mg', '24horas', '14dias', '500mg', '8horas', '120/80mmhg', '37.5grados'])
      expect([...c.keys()], `falta ${esperada}`).toContain(esperada)
  })

  it('«400 mg» y «400mg» son la MISMA cifra', () => {
    /** El objetivo es cazar pérdidas, no diferencias de formato. */
    expect([...cifrasClinicas('400 mg').keys()]).toEqual([...cifrasClinicas('400mg').keys()])
  })

  it('un número SIN unidad no es una cifra clínica', () => {
    /** «paciente de 2 hijos» no puede contar como dato de tratamiento. */
    expect(cifrasClinicas('el paciente tiene 2 hijos y vive con 3 personas').size).toBe(0)
  })
})

describe('UCI: perder el «/kg» son 70 veces la dosis (REG-246)', () => {
  /**
   * ── EL DEFECTO, Y ERA MÍO ────────────────────────────────────────────────
   *
   * En una alternancia de regex gana **la primera que casa**, no la más larga.
   * Con `mcg` antes que `mcg/kg/min`, «0.1 mcg/kg/min» se leía como «0.1 mcg».
   *
   * Consecuencia: una reescritura que convertía `0.1 mcg/kg/min` en
   * `0.1 mcg/min` —una infusión por peso en una tasa fija, unas 70 veces menos
   * en un adulto de 70 kg— pasaba **completamente indetectada**, porque las dos
   * normalizaban a la misma cifra.
   *
   * Se encontró midiendo el motor contra pautas de terapia intensiva.
   */
  it('lee la velocidad ENTERA, no su primera sílaba', () => {
    const c = [...cifrasClinicas(
      'Norepinefrina 0.1 mcg/kg/min, propofol 2 mg/kg/h, insulina 2 U/h, PEEP 8 cmH2O, Cr 1.2 mg/dL',
    ).keys()]
    expect(c).toEqual(['0.1mcg/kg/min', '2mg/kg/h', '2u/h', '8cmh2o', '1.2mg/dl'])
  })

  it('caza que se pierda el «/kg»', () => {
    const c = queCambioEnLasCifras(
      'Norepinefrina 0.1 mcg/kg/min', 'Norepinefrina 0.1 mcg/min', 'resume')
    expect(c.perdidas).toContain('0.1mcg/kg/min')
  })

  it('la lista de unidades se ordena EN CÓDIGO, no a mano', () => {
    /**
     * Una lista ordenada a mano se desordena en el primer añadido, y el
     * defecto vuelve sin que nadie lo note: no truena, sólo deja de ver.
     */
    const mod = readFileSync(
      join(process.cwd(), 'src/lib/seguridad/la-reescritura-no-pierde-cifras.ts'), 'utf8')
    expect(mod).toMatch(/sort\(\(a, b\) => b\.length - a\.length\)/)
  })
})

describe('el caso que lo motiva: «hazlo más conciso»', () => {
  const CONCISO = 'Moxifloxacino 400 mg oral. Paracetamol 500 mg si dolor. TA 120/80 mmHg.'

  it('caza que se perdieron la frecuencia y la duración', () => {
    const c = queCambioEnLasCifras(PLAN, CONCISO, 'hazlo más conciso')
    expect(c.hayCambioNoPedido).toBe(true)
    expect(c.perdidas).toEqual(expect.arrayContaining(['24horas', '14dias', '8horas']))
  })

  it('el aviso nombra las cifras LITERALES, no «se perdieron datos»', () => {
    const t = loQueSeLlevoPorDelante(queCambioEnLasCifras(PLAN, CONCISO, 'hazlo más conciso'))!
    expect(t).toContain('14dias')
    expect(t).toMatch(/deshaz el cambio/)
  })

  it('«400 mg» degradado a «400» se caza', () => {
    const c = queCambioEnLasCifras('Moxifloxacino 400 mg', 'Moxifloxacino 400', 'resume')
    expect(c.perdidas).toContain('400mg')
  })
})

describe('la INSTRUCCIÓN es la llave', () => {
  it('«la dosis es 500 mg» AUTORIZA que 400mg salga y 500mg entre', () => {
    const antes = 'Moxifloxacino 400 mg cada 24 horas por 14 días'
    const despues = 'Moxifloxacino 500 mg cada 24 horas por 14 días'
    const c = queCambioEnLasCifras(antes, despues, 'la dosis es 500 mg')
    expect(c.hayCambioNoPedido).toBe(false)
    expect(loQueSeLlevoPorDelante(c)).toBeNull()
  })

  it('el MISMO cambio sin pedirlo NO se autoriza', () => {
    const antes = 'Moxifloxacino 400 mg cada 24 horas'
    const despues = 'Moxifloxacino 500 mg cada 24 horas'
    const c = queCambioEnLasCifras(antes, despues, 'hazlo más conciso')
    expect(c.perdidas).toContain('400mg')
    expect(c.aparecidas).toContain('500mg')
  })

  it('corregir la dosis NO autoriza tocar las horas ni los días', () => {
    /**
     * Ésta es la prueba que obligó a afinar la regla. La primera versión sólo
     * dejaba pasar la cifra literal, y con «la dosis es 500 mg» denunciaba que
     * 400mg desapareciera — que es justo lo que el médico acababa de pedir.
     *
     * Autorizar por UNIDAD arregla eso sin abrir la puerta de par en par:
     * nombrar un `mg` autoriza los `mg`, no las `horas`.
     */
    const antes = 'Moxifloxacino 400 mg cada 24 horas por 14 días'
    const despues = 'Moxifloxacino 500 mg por 14 días'
    const c = queCambioEnLasCifras(antes, despues, 'la dosis es 500 mg')
    expect(c.perdidas).toContain('24horas')
    expect(c.perdidas).not.toContain('400mg')
  })

  it('y queda escrito por qué la instrucción manda, y por qué por unidad', () => {
    expect(POR_QUE_LA_INSTRUCCION_ES_LA_LLAVE).toMatch(/sustituirla/)
    expect(POR_QUE_LA_INSTRUCCION_ES_LA_LLAVE).toMatch(/no nombra ninguna unidad/)
  })
})

describe('lo que NO hace', () => {
  it('no repara el texto — sólo lo dice', () => {
    const mod = readFileSync(
      join(process.cwd(), 'src/lib/seguridad/la-reescritura-no-pierde-cifras.ts'), 'utf8')
    /* Nada de devolver texto arreglado: la firma sólo produce diagnóstico. */
    expect(mod).not.toMatch(/function repara|textoCorregido|reinsertar/)
    expect(POR_QUE_NO_REPARA).toMatch(/decide el médico/)
  })

  it('una reescritura que no toca cifras no molesta', () => {
    const c = queCambioEnLasCifras(PLAN, PLAN.replace('vía oral', 'v.o.'), 'abrevia la vía')
    expect(c.hayCambioNoPedido).toBe(false)
  })

  it('no truena con vacíos', () => {
    expect(() => queCambioEnLasCifras('', '', '')).not.toThrow()
    expect(queCambioEnLasCifras(null, undefined).hayCambioNoPedido).toBe(false)
  })
})

describe('está CONECTADO al editor por chat', () => {
  const page = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

  it('la consulta lo importa', () => {
    expect(page).toContain("from '@/lib/seguridad/la-reescritura-no-pierde-cifras'")
  })

  it('captura el ANTES — cuando el modelo devuelve, lo que había ya se perdió', () => {
    expect(page).toMatch(/const cifrasAntes = /)
  })

  it('le pasa la instrucción del médico, que es la llave', () => {
    expect(page).toMatch(/queCambioEnLasCifras\(cifrasAntes, cifrasDespues, instr\)/)
  })

  it('el aviso llega al mismo chat donde él pidió el cambio', () => {
    /** Un aviso en otro sitio se lee cuando ya firmó. */
    expect(page).toMatch(/if \(aviso\) setChatCorr/)
  })
})
