/**
 * GOLDEN — el quinto parser del campo de alergias: el del punto de ORDEN.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `cdsMedicamento` es el único sitio donde la alerta de alergia llega ANTES de
 * que la indicación se firme en hospitalización. Tenía su propio troceador
 * (`split(/[,;.\n]/)`) y su propia lista de negadores, distintos de los del
 * módulo canónico. Perdía dos cosas:
 *
 * 1. **Ni la «y» ni la barra separaban.** «Niega penicilina y alérgica a sulfas»
 *    era UN fragmento: el negador de delante lo tumbaba entero y la alergia a
 *    sulfas **desaparecía**. Al ordenar sulfametoxazol/trimetoprima no salía
 *    ninguna alerta crítica.
 * 2. **`alergiasEstructuradas` no se miraba** — ni en la firma de la función ni
 *    en el llamador, que pasaba `patient?.alergias` a secas. El paciente con las
 *    alergias mejor capturadas era el que corría sin compuerta.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Verificando SAFE-001 antes de darlo por cerrado. REG-171 unificó tres caminos
 * —consulta, UCI y extractor de entidades— sobre `alergiasDe`, y el recuento del
 * backlog decía «cuatro parsers». Buscando quién más partía el campo apareció
 * `hospital/cds.ts`, que no estaba en la cuenta. Reproducido con el motor real:
 * con el texto de arriba devolvía sólo la nota informativa de ajuste renal, cero
 * alertas críticas.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Un negador delante de una alergia real es la forma NORMAL de escribir el
 * campo: se descarta lo frecuente y se apunta lo que sí hay. Con el parser viejo,
 * ese orden bastaba para que la alergia posterior no existiera para el motor —
 * y el fármaco al que el paciente es alérgico se ordenaba sin un solo aviso.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Un campo, un parser. `alergiasDe` es el canónico y ya sabe partir por «y», por
 * barra con espacio y por punto con espacio, respetar los combinados que van
 * pegados (TMP/SMX) y preferir `alergiasEstructuradas` cuando existen.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No mejora el CRUCE en sí: `validarAlergiasVsMedicamentos` sigue comparando
 *   por subcadena contra su vocabulario de familias. Un alérgeno fuera de ese
 *   vocabulario sigue sin vigilarse, y eso es vocabulario, no criterio.
 * · No comprueba que el negador entienda toda la redacción posible: sólo que
 *   los dos caminos usen EL MISMO, sea cual sea.
 * · No hay ninguna ruta de escritura que llene `alergiasEstructuradas` hoy; lo
 *   que se cierra aquí es que el día que la haya, este camino ya la lea.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cdsMedicamento } from '@/lib/hospital/cds'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const criticas = (a: { nivel: string; texto: string }[]) => a.filter(x => x.nivel === 'critica')

describe('LA ALERGIA QUE VIENE DESPUÉS DE UNA NEGADA', () => {
  it('«Niega penicilina y alérgica a sulfas» → sulfas sigue vigilada', () => {
    const a = cdsMedicamento({
      nombre: 'Sulfametoxazol/trimetoprima',
      alergias: 'Niega penicilina y alérgica a sulfas',
    })
    expect(criticas(a).map(x => x.texto).join(' ')).toMatch(/sulfas/i)
  })

  it('con barra en vez de «y», igual', () => {
    const a = cdsMedicamento({
      nombre: 'Sulfametoxazol/trimetoprima',
      alergias: 'Niega penicilina / alérgica a sulfas',
    })
    expect(criticas(a)).toHaveLength(1)
  })

  it('con punto —el caso que el parser viejo sí cubría— sigue cubierto', () => {
    const a = cdsMedicamento({
      nombre: 'Ampicilina',
      alergias: 'niega penicilina. alérgico a ampicilina',
    })
    expect(criticas(a)).toHaveLength(1)
  })
})

describe('LO QUE NO DEBE DISPARAR', () => {
  it('un campo enteramente negado no bloquea', () => {
    expect(cdsMedicamento({ nombre: 'Penicilina G', alergias: 'niega alergia a penicilina' }))
      .toEqual([])
  })

  it('«sin alergias conocidas» tampoco', () => {
    expect(cdsMedicamento({ nombre: 'Amoxicilina', alergias: 'sin alergias conocidas' }))
      .toEqual([])
  })

  /**
   * El combinado va PEGADO: si la barra separase siempre, «TMP/SMX» se
   * convertiría en «SMX)» y el cruce dejaría de reconocerlo (REG-171).
   */
  it('«Trimetoprima/sulfametoxazol (TMP/SMX)» es UN alérgeno y cruza', () => {
    const a = cdsMedicamento({
      nombre: 'Sulfametoxazol/trimetoprima',
      alergias: 'Trimetoprima/sulfametoxazol (TMP/SMX)',
    })
    expect(criticas(a)).toHaveLength(1)
  })
})

describe('EL PACIENTE MEJOR DOCUMENTADO', () => {
  it('con las alergias en estructura y el texto libre vacío, la compuerta corre', () => {
    const a = cdsMedicamento({
      nombre: 'Amoxicilina',
      alergiasEstructuradas: [{ alergeno: 'Penicilina', severidad: 'grave' }],
    })
    expect(criticas(a)).toHaveLength(1)
  })

  it('lo estructurado manda sobre el texto libre', () => {
    const a = cdsMedicamento({
      nombre: 'Amoxicilina',
      alergias: 'niega alergias',
      alergiasEstructuradas: [{ alergeno: 'Penicilina' }],
    })
    expect(criticas(a)).toHaveLength(1)
  })

  /**
   * La reacción viaja con el alérgeno porque el cruce la NECESITA: con historia
   * de reacción cutánea grave, el carbapenémico vuelve a ser alerta crítica en
   * vez de precaución (decisión del médico dueño, E0-15d). El parser viejo
   * mandaba `{ alergeno }` a secas y esa distinción no podía hacerse.
   */
  it('la reacción llega al cruce: SCAR sube el carbapenémico a crítica', () => {
    const conReaccion = cdsMedicamento({
      nombre: 'Meropenem',
      alergiasEstructuradas: [{ alergeno: 'Penicilina', reaccion: 'Síndrome de Stevens-Johnson' }],
    })
    expect(criticas(conReaccion)).toHaveLength(1)
  })
})

/**
 * LA FRANJA DICE LO QUE DICE EL MOTOR.
 *
 * `nivel` sólo pinta —rojo, ámbar, verde— y no bloquea nada; por eso el defecto
 * era invisible en las pruebas y muy visible en la pantalla: el bucle marcaba
 * como «crítica» TODA alerta del cruce, incluida la que el motor había bajado a
 * precaución a propósito. Salía una franja roja sobre un texto que dice «NO es
 * contraindicación».
 *
 * QUÉ NO CUBRE: no juzga si la decisión de bajar el carbapenémico es correcta
 * —es del médico dueño (E0-15d)—; sólo que la pantalla no la deshaga.
 */
describe('LA SEVERIDAD DEL MOTOR NO SE APLANA', () => {
  it('penicilina + carbapenémico sin reacción grave se pinta ámbar, no rojo', () => {
    const a = cdsMedicamento({ nombre: 'Meropenem', alergias: 'alérgico a penicilina' })
    const cruce = a.filter(x => /carbapen/i.test(x.texto))
    expect(cruce).toHaveLength(1)
    expect(cruce[0].nivel).toBe('alta')
  })

  it('penicilina + amoxicilina sigue siendo roja', () => {
    const a = cdsMedicamento({ nombre: 'Amoxicilina', alergias: 'alérgico a penicilina' })
    expect(criticas(a)).toHaveLength(1)
  })
})

/**
 * EL DATO TIENE QUE LLEGAR — la función puede aceptar el campo y el llamador no
 * pasarlo. Fue exactamente lo que pasó aquí: `alergiasDe` existía desde el 4-ago
 * y este camino seguía leyendo `patient?.alergias` a secas.
 */
describe('EL LLAMADOR', () => {
  it('hospitalización pasa los DOS campos de alergias al CDS', () => {
    const page = leer('src', 'app', '(dashboard)', 'hospitalizacion', '[internamientoId]', 'page.tsx')
    expect(page).toContain('alergiasEstructuradas: patient?.alergiasEstructuradas')
  })

  it('el CDS ya no tiene troceador propio', () => {
    const cds = leer('src', 'lib', 'hospital', 'cds.ts')
    expect(cds).toContain("from '@/lib/seguridad/alergias'")
    expect(cds).not.toMatch(/opts\.alergias\s*\|\|\s*''\)\.split/)
  })
})
