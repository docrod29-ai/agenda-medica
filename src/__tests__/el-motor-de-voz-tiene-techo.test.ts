/**
 * GOLDEN — REG-551. El umbral de la transcripción (D-030) se aplica al motor.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Dos cosas a la vez, y la segunda la destapó la primera.
 *
 * 1. **El umbral de `transcribir` no existía.** El instrumento que pesa errores
 *    de voz (`asr/lo-que-pesa-de-un-error.ts`) lleva meses escrito: separa
 *    críticos, sin clasificar y ordinarios, y aprueba con cero en los dos
 *    primeros. Pero nadie lo corría contra un conjunto, y el tercer eje —cuánto
 *    error ordinario es demasiado— no lo había fijado nadie.
 *
 * 2. **El censo mentía sobre el conjunto.** El contrato decía, literalmente:
 *    «No existe gold de voz […] todavía no está». Y sí estaba, en el
 *    repositorio, desde antes: `synthetic-data/dialogos-consulta/` — 12 diálogos
 *    actuados con su guion (el oro) y la salida real del motor al lado.
 *
 *    Es la novena entrada del censo que resulta estar vieja al ir a construir
 *    sobre ella. Se corrige el censo, no se construye un segundo conjunto.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Antes de pedirle el número al médico, medí. La medición era la pregunta: sin
 * ella habría tenido que elegir entre inventar una cifra o pedirle una a ciegas.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * La misma familia que REG-550: «escrito y sin conectar», aplicada a un número.
 * Un instrumento que mide y un umbral que nadie compara contra lo medido son dos
 * mitades que no se tocan.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Los tres ejes no se suman. Los dos ceros —críticos y sin clasificar— salen de
 * una regla YA ESCRITA (`politica-critica.ts`: prohibido, **no penalizado**), y
 * se cuentan por consulta para que no se diluyan. Sólo el tercero lo decidió el
 * médico, y el veredicto sale del contrato, no de una copia.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 *  · **No dice que el motor esté bien.** Hay un crítico REAL abierto: DLG-004,
 *    donde el motor se comió «Van dos veces este mes». El trinquete lo sella en
 *    1 para que no suba; no lo da por bueno. Si esta prueba se lee como un
 *    aprobado del motor, se está leyendo mal — por eso `EL_CRITICO_QUE_SIGUE_
 *    ABIERTO` se comprueba aquí abajo con su nombre.
 *  · **No son pacientes.** Son voces sintetizadas, sin ruido de consultorio, sin
 *    acento regional y sin dos personas hablando encima. Un motor puede pasar
 *    esto y fallar en la sala.
 *  · **No es una muestra representativa.** Los 12 diálogos se armaron a mano
 *    para probar diarización y negación: son casos difíciles elegidos, no una
 *    consulta media.
 *  · **No mide diarización.** DLG-004 además funde a la hija con la paciente en
 *    un solo hablante, y para esta lectura —que sólo ve texto— eso es invisible.
 *    Lo dice `LO_QUE_NO_SE_VIGILA` del propio módulo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  leerConsulta, leerElMotor,
  EL_CRITICO_QUE_SIGUE_ABIERTO, LO_QUE_ESTE_CONJUNTO_NO_MIDE,
} from '@/lib/asr/lo-que-pesa-de-un-error'
import {
  CONTRATOS, aplicarUmbral, esVerde, PENDIENTE_DEL_MEDICO, type Umbral,
} from '@/lib/ia/contratos-de-evaluacion'

const RAIZ = process.cwd()
const CORPUS = join(RAIZ, 'synthetic-data/dialogos-consulta')

/** El umbral REAL del contrato. Si alguien lo cambia allí, esto lo usa. */
const UMBRAL: Umbral = CONTRATOS.find(c => c.capacidad === 'transcribir')!.umbral

/**
 * EL TRINQUETE. Medido el 1-sep-2026: 1 de 12 consultas con un crítico, y es
 * DLG-004. Sólo puede BAJAR. Si baja, se baja este número aquí y se dice por qué.
 */
const CONSULTAS_CON_CRITICO = 1

interface Dialogo { readonly id: string; readonly gold: string; readonly oido: string }

function corpus(): Dialogo[] {
  const guion = new Map<string, string>()
  for (const linea of readFileSync(join(CORPUS, 'GUION.jsonl'), 'utf8').split('\n').filter(Boolean)) {
    const d = JSON.parse(linea) as { id: string; turnos: { texto: string }[] }
    guion.set(d.id, d.turnos.map(t => t.texto).join(' '))
  }
  return readdirSync(join(CORPUS, 'salida/DIARIZACION')).sort().map(f => {
    const id = f.replace('.json', '')
    const segmentos = JSON.parse(readFileSync(join(CORPUS, 'salida/DIARIZACION', f), 'utf8')) as { text: string }[]
    return { id, gold: guion.get(id)!, oido: segmentos.map(s => s.text).join(' ') }
  })
}



/**
 * Ensucia un diálogo con errores ORDINARIOS: palabras corrientes, ni cifra, ni
 * unidad, ni término clínico. `gato` → `rata`, cuarenta veces.
 *
 * PREMISA CORREGIDA: mi primer intento usaba `palabra0` → `vocablo0`, y el
 * alineador no clasificaba NI UNA. Habría dejado la prueba en verde por un
 * fixture mal construido y no por el código, que es el error de REG-197 otra vez.
 */
function ensuciar(d: Dialogo): Dialogo {
  const veces = 40
  return {
    ...d,
    gold: `${d.gold} ${'casa perro gato silla mesa '.repeat(veces)}`,
    oido: `${d.oido} ${'casa perro rata silla mesa '.repeat(veces)}`,
  }
}
const compuerta = (ds: Dialogo[]) => aplicarUmbral(UMBRAL, leerElMotor(ds).medido)

describe('EL CONJUNTO EXISTE — el censo decía que no', () => {
  it('12 diálogos, cada uno con su guion y con lo que el motor oyó', () => {
    /**
     * El contrato decía «no existe gold de voz […] todavía no está», y estaba
     * en el árbol. Un censo viejo manda a construir lo que ya está construido.
     */
    const ds = corpus()
    expect(ds).toHaveLength(12)
    for (const d of ds) {
      expect(d.gold, d.id).toBeTruthy()
      expect(d.oido, d.id).toBeTruthy()
    }
  })

  it('y el contrato ya no dice que no existe', () => {
    const contrato = CONTRATOS.find(c => c.capacidad === 'transcribir')!
    expect(contrato.conjunto).toMatch(/dialogos-consulta/)
    expect(contrato.conjunto).toMatch(/CORRECCIÓN DEL CENSO/)
    // La frase vieja sólo puede aparecer ENTRECOMILLADA, como cita de lo que
    // decía. Si vuelve a aparecer como afirmación, esto se pone rojo.
    expect(contrato.conjunto).toMatch(/«no existe gold de voz.*todavía no está»/)
  })
})

describe('EL UMBRAL DE D-030 SE APLICA', () => {
  it('el veredicto sale del contrato: tres ejes, y dos de ellos en cero', () => {
    expect(PENDIENTE_DEL_MEDICO in UMBRAL).toBe(false)
    const lectura = compuerta(corpus())
    expect(lectura.ejes.map(e => e.nombre)).toEqual(['criticos', 'sinClasificar', 'ordinario'])
    expect(lectura.ejes.map(e => e.umbral)).toEqual([0, 0, 0.05])
  })

  it('los dos ceros NO son una preferencia: están en una regla escrita', () => {
    /**
     * Si fueran una preferencia, alguien podría subirlos. Salen de
     * `politica-critica.ts`, que dice que estas sustituciones están PROHIBIDAS,
     * no penalizadas — y una penalización se compensa con volumen.
     */
    const politica = readFileSync(join(RAIZ, 'src/lib/asr/politica-critica.ts'), 'utf8')
    expect(politica).toMatch(/prohibida[,\s]/)
    expect(UMBRAL).not.toHaveProperty(PENDIENTE_DEL_MEDICO)
    const fuente = (UMBRAL as { fuente: string }).fuente
    expect(fuente).toMatch(/politica-critica/)
    expect(fuente).toMatch(/D-030/)
  })

  it('la tasa ordinaria de hoy está por debajo del techo, y no por casualidad', () => {
    const m = leerElMotor(corpus())
    expect(m.consultas).toBe(12)
    expect(m.palabrasDelGold).toBe(532)
    expect(m.ordinarios).toBe(5)
    // 5/532 = 0,94 %. El techo del médico es 5 %.
    expect(m.tasaOrdinaria).toBeLessThan(0.05)
    expect(m.tasaOrdinaria).toBeGreaterThan(0)
  })
})

describe('EL TRINQUETE, Y EL DEFECTO QUE NO TAPA', () => {
  it('exactamente UNA consulta tiene un crítico, y sólo puede bajar', () => {
    /**
     * Se comprueba el número EXACTO y no un «≤». Un «≤» deja pasar el cambalache
     * de arreglar uno y romper otro sin que nadie mire cuál.
     */
    const m = leerElMotor(corpus())
    expect(
      m.conCriticos,
      m.conCriticos > CONSULTAS_CON_CRITICO
        ? 'SUBIÓ. Un motor que pierde más cifras que ayer.'
        : 'BAJÓ: arréglalo bajando CONSULTAS_CON_CRITICO y di en el ledger cuál se cerró.',
    ).toBe(CONSULTAS_CON_CRITICO)
    expect(m.conSinClasificar).toBe(0)
  })

  it('y es DLG-004: la frase con la cifra que el motor se comió', () => {
    const d = corpus().find(x => x.id === 'DLG-004')!
    expect(d.gold).toContain('Van dos veces este mes')
    expect(d.oido).not.toContain('Van dos veces')
    expect(leerConsulta(d.gold, d.oido).criticos.length).toBeGreaterThan(0)
    expect(leerConsulta(d.gold, d.oido).aprobada).toBe(false)
  })

  it('el defecto queda ESCRITO con nombre, no tapado por un verde', () => {
    /**
     * Un trinquete verde con un defecto dentro es exactamente cómo un problema
     * deja de mirarse. Si alguien borra esta declaración, esto se pone rojo.
     */
    expect(EL_CRITICO_QUE_SIGUE_ABIERTO).toMatch(/DLG-004/)
    expect(EL_CRITICO_QUE_SIGUE_ABIERTO).toMatch(/NO lo da por bueno/)
  })

  it('con el crítico dentro, la compuerta del motor REPRUEBA', () => {
    /**
     * El trinquete es del CI; el umbral del contrato es cero. Las dos cosas
     * conviven: la compuerta dice rojo hoy, y el trinquete impide que empeore
     * mientras se arregla. Esta prueba comprueba que la compuerta NO miente.
     */
    const lectura = compuerta(corpus())
    expect(lectura.veredicto).toBe('reprueba')
    expect(esVerde(lectura)).toBe(false)
    expect(lectura.porQue).toMatch(/criticos/)
  })

  it('sin ese diálogo, el motor pasa: el rojo es DE ÉL y de nada más', () => {
    /**
     * La contraprueba. Si al quitar DLG-004 siguiera rojo, el problema sería
     * otro y estaríamos culpando al diálogo equivocado.
     */
    const sinEl = corpus().filter(d => d.id !== 'DLG-004')
    expect(esVerde(compuerta(sinEl))).toBe(true)
  })
})

describe('AL REVÉS — con el defecto dentro, reprueba', () => {
  const sano = () => corpus().filter(d => d.id !== 'DLG-004')

  it('una cifra cambiada REPRUEBA aunque todo lo demás esté perfecto', () => {
    /**
     * El error que el WER a secas no ve: una palabra de mil, y multiplica la
     * dosis. Se mete a mano sobre un diálogo que hoy está limpio.
     */
    const ds = sano()
    ds[0] = { ...ds[0], gold: `${ds[0].gold} Tome 40 miligramos.`, oido: `${ds[0].oido} Tome 400 miligramos.` }
    const lectura = compuerta(ds)
    expect(lectura.veredicto).toBe('reprueba')
    expect(lectura.ejes.find(e => e.nombre === 'criticos')!.medido).toBe(1)
  })

  it('pasarse del 5 % ordinario también reprueba', () => {
    /**
     * El eje que decidió el médico. Se ensucia un diálogo con palabras
     * corrientes —ni cifra, ni unidad, ni término clínico— hasta cruzar el techo.
     */
    const ds = sano()
    ds[0] = ensuciar(ds[0])
    const lectura = compuerta(ds)
    expect(lectura.veredicto).toBe('reprueba')
    expect(lectura.ejes.find(e => e.nombre === 'ordinario')!.medido).toBeGreaterThan(0.05)
  })

  it('y el número del contrato es el que manda: con un techo laxo, lo mismo pasa', () => {
    /**
     * La prueba de que no hay una constante escondida: el MISMO ruido que
     * reprueba con el 5 % del médico pasa con un 90 % armado aquí, que no está
     * en ningún contrato.
     */
    const ds = sano()
    ds[0] = ensuciar(ds[0])
    const laxo: Umbral = {
      valor: 0.9, fuente: 'Sólo para esta prueba: NO es un umbral del producto.',
      ejes: [{ nombre: 'ordinario', valor: 0.9, porQue: 'inventado para la prueba' }],
    }
    expect(aplicarUmbral(laxo, leerElMotor(ds).medido).veredicto).toBe('pasa')
  })

  it('un conjunto VACÍO no pone la compuerta en verde', () => {
    /**
     * Sin esto, la forma más fácil de tener el motor aprobado sería borrar los
     * doce diálogos.
     */
    const lectura = aplicarUmbral(UMBRAL, leerElMotor([]).medido)
    expect(lectura.veredicto).toBe('sin_conjunto')
    expect(esVerde(lectura)).toBe(false)
  })
})

describe('AL REVÉS POR EL OTRO LADO — no se pasa de frenada', () => {
  it('la puntuación y las mayúsculas NO cuentan como error', () => {
    /**
     * Si contaran, la compuerta estaría siempre roja y se dejaría de mirar — que
     * es el argumento con el que el médico descartó el 2 %. El WER crudo de este
     * corpus es 10 % y el normalizado 1,7 %: casi todo eran comas y «tres»/«3».
     */
    const ds = corpus().filter(d => d.id !== 'DLG-004').map(d => ({
      ...d, oido: d.oido.toUpperCase().replace(/[,.;:¿?¡!]/g, ''),
    }))
    expect(esVerde(compuerta(ds))).toBe(true)
  })

  it('una consulta transcrita PERFECTA no reprueba por nada', () => {
    const perfecto = corpus().map(d => ({ ...d, oido: d.gold }))
    const m = leerElMotor(perfecto)
    expect(m.conCriticos).toBe(0)
    expect(m.conSinClasificar).toBe(0)
    expect(m.ordinarios).toBe(0)
    expect(esVerde(compuerta(perfecto))).toBe(true)
  })
})

describe('LO QUE ESTE CONJUNTO NO MIDE, dicho a tiempo', () => {
  it('está declarado, y dice que no son pacientes', () => {
    const texto = LO_QUE_ESTE_CONJUNTO_NO_MIDE.join(' ')
    expect(texto).toMatch(/voces actuadas por síntesis/)
    expect(texto).toMatch(/puede pasar esto y fallar en la sala/)
    expect(texto).toMatch(/no es una muestra representativa|No es una muestra representativa/)
    expect(LO_QUE_ESTE_CONJUNTO_NO_MIDE.length).toBeGreaterThanOrEqual(4)
  })

  it('las tres cuentas no se suman, y eso sigue escrito', () => {
    /**
     * Es la doctrina del módulo y la razón de que haya tres ejes y no un WER
     * ponderado. Si alguien la borrara, el siguiente cambio los mezclaría.
     */
    const modulo = readFileSync(join(RAIZ, 'src/lib/asr/lo-que-pesa-de-un-error.ts'), 'utf8')
    expect(modulo).toMatch(/no se suman/)
    expect(modulo).toMatch(/se compensa con volumen/)
  })
})
