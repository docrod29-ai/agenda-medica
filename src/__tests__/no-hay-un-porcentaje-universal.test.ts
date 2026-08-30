/**
 * GOLDEN — CUÁNDO EL CAMBIO DE UN ANALITO IMPORTA, Y CUÁNDO SÓLO ES UN NÚMERO
 * DISTINTO.
 *
 * ── DE DÓNDE SALE ESTA POLÍTICA ─────────────────────────────────────────────
 *
 * REG-369 dejó abierto, como `NEEDS_CLINICAL_REVIEW`, cuánto tiene que moverse
 * un analito para que el cambio importe. **El dueño lo resolvió el 29-ago-2026**,
 * y lo primero que dijo es lo que este archivo protege:
 *
 *   **NO existe un porcentaje universal seguro para todos los analitos. No se
 *   implementa un umbral global del 10 %, del 20 % ni de ninguno.**
 *
 * Después, en orden: usar primero los **umbrales clínicos ya definidos**; usar
 * **RCV / variación biológica validada** si existe para ese analito; **cruzar un
 * límite de decisión importa aunque el porcentaje sea pequeño**; y sin regla
 * específica validada, **mostrar delta absoluto y relativo pero NO etiquetarlo
 * como clínicamente significativo**. No inventar umbrales.
 *
 * ── QUÉ FALLABA ANTES ───────────────────────────────────────────────────────
 *
 * Nada: REG-369 dejó a propósito de decir si el cambio era relevante, porque no
 * había con qué decidirlo. Lo que faltaba era **usar lo que sí estaba definido**
 * —el rango de referencia de cada analito y los valores de pánico— para poder
 * decir «cruzó esta línea» sin inventar nada.
 *
 * ── DE DÓNDE SALEN LOS UMBRALES ─────────────────────────────────────────────
 *
 * De dos tablas que ya existen, cada una con su procedencia:
 * `ANALITOS[].refMin/refMax` y `CRITICOS` de `hospital/lab-criticos.ts`. El
 * módulo nuevo **no define ni una sola cifra**.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No hay tabla de RCV.** El punto 2 de la política la permite «si existe
 *   validada», y en este repositorio no existe. El hueco queda **declarado** en
 *   `RELEVANCIA_POR_RCV`, vacío, con su sitio marcado — no relleno de memoria.
 * · **No califica el cruce.** «Volvió dentro del rango» puede ser mejoría o
 *   puede ser una transfusión: se nombra, no se juzga.
 * · **No decide conducta.** Ningún motor cambia de comportamiento por esto: es
 *   lo que el médico lee al lado del número.
 * · **Un analito fuera del catálogo no se juzga.** Sin rango definido no hay
 *   línea que cruzar, y se muestran los deltas a secas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  queCambio, comoSeDiceElCambio, comoSeDicenLosDeltas, RELEVANCIA_POR_RCV,
  DE_QUIEN_ES_ESTA_POLITICA, POR_QUE_NO_HAY_TABLA_DE_RCV,
} from '@/lib/expediente/laboratorio/que-cambio-de-verdad'

describe('NO hay porcentaje universal — la regla que ordena todo', () => {
  it('un +50 % que no cruza ninguna línea NO se marca como relevante', () => {
    /* Creatinina 0.6 → 0.9: sube la mitad y sigue dentro del rango de
       referencia (0.6–1.3). Sin regla validada, se muestran los deltas y nada
       más. */
    const c = queCambio('creatinina', 0.6, 0.9)
    expect(Math.round(c.deltaRelativo!)).toBe(50)
    expect(c.cruces).toEqual([])
    expect(c.relevanciaDemostrada).toBe(false)
    expect(comoSeDiceElCambio(c)).toBe('+0.3 (+50 %)')
  })

  it('un +8 % que SÍ cruza el límite de referencia sí se dice', () => {
    /* Punto 3 de la política: cruzar un límite de decisión importa aunque el
       porcentaje sea pequeño. Creatinina 1.25 → 1.35 cruza 1.3. */
    const c = queCambio('creatinina', 1.25, 1.35)
    expect(Math.round(c.deltaRelativo!)).toBe(8)
    expect(c.relevanciaDemostrada).toBe(true)
    expect(comoSeDiceElCambio(c)).toMatch(/cruzó el límite alto de referencia \(1\.3 mg\/dL\)/)
  })

  it('el módulo NO contiene ninguna cifra propia', () => {
    /* Un umbral escrito aquí no rompería nada, no fallaría ninguna prueba, y
       decidiría conducta. Las líneas se leen de las tablas que ya existen. */
    const src = readFileSync('src/lib/expediente/laboratorio/que-cambio-de-verdad.ts', 'utf8')
    const codigo = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/'[^']*'|`[^`]*`/g, "''")
    const numeros = [...codigo.matchAll(/(?<![\w.])\d+(?:\.\d+)?/g)].map(m => m[0])
    /* `0` (comparar con cero) y `100` (pasar a porcentaje) son aritmética, no
       clínica. Cualquier 10, 20, 30 caería aquí. */
    expect(numeros.filter(n => n !== '0' && n !== '100')).toEqual([])
  })

  it('y no existe ninguna constante con pinta de umbral global', () => {
    const src = readFileSync('src/lib/expediente/laboratorio/que-cambio-de-verdad.ts', 'utf8')
    expect(src).not.toMatch(/CAMBIO_SIGNIFICATIVO|UMBRAL_(?:GLOBAL|CAMBIO)|PORCENTAJE_/)
  })
})

describe('los deltas salen siempre', () => {
  it('absoluto y relativo, con su signo', () => {
    expect(comoSeDicenLosDeltas(queCambio('ldl', 100, 190))).toBe('+90 (+90 %)')
    expect(comoSeDicenLosDeltas(queCambio('ldl', 190, 100))).toBe('-90 (-47 %)')
  })

  it('sin previo distinto de cero no se inventa un porcentaje', () => {
    const c = queCambio('ldl', 0, 90)
    expect(c.deltaRelativo).toBeNull()
    expect(comoSeDicenLosDeltas(c)).toBe('+90')
  })

  it('un analito que el catálogo no conoce sale con sus deltas y sin líneas', () => {
    const c = queCambio('loquesea', 10, 20)
    expect(c.cruces).toEqual([])
    expect(c.relevanciaDemostrada).toBe(false)
    expect(comoSeDiceElCambio(c)).toBe('+10 (+100 %)')
  })

  it('sin cambio, los deltas son cero y no hay línea', () => {
    const c = queCambio('creatinina', 1.1, 1.1)
    expect(c.deltaAbsoluto).toBe(0)
    expect(c.relevanciaDemostrada).toBe(false)
  })
})

describe('las líneas que sí se usan son las que ya estaban definidas', () => {
  it('entrar en rango crítico se dice, y es de `lab-criticos`', () => {
    /* Potasio 5.4 → 6.8 cruza el valor de pánico (6.5) de la tabla del
       hospital, que además sabe de unidades. */
    const c = queCambio('potasio', 5.4, 6.8)
    expect(c.criticoEvaluable).toBe(true)
    expect(c.cruces.some(x => x.linea === 'critico')).toBe(true)
    expect(comoSeDiceElCambio(c)).toMatch(/rango crítico/)
    expect(c.relevanciaDemostrada).toBe(true)
  })

  it('salir del rango crítico también se dice, sin calificarlo', () => {
    const c = queCambio('potasio', 6.8, 5.4)
    expect(comoSeDiceElCambio(c)).toMatch(/salió del rango crítico/)
    for (const juicio of [/mejor/i, /empeor/i, /significativ/i, /alarm/i]) {
      expect(comoSeDiceElCambio(c)).not.toMatch(juicio)
    }
  })

  it('volver dentro del rango de referencia se nombra, no se celebra', () => {
    const c = queCambio('creatinina', 1.5, 1.1)
    expect(comoSeDiceElCambio(c)).toMatch(/volvió dentro del rango de referencia/)
    expect(comoSeDiceElCambio(c)).not.toMatch(/mejor/i)
  })

  it('cruzar el límite BAJO también cuenta', () => {
    /* Hemoglobina 12.4 → 11.5 cruza el 12 de referencia. */
    const c = queCambio('hemoglobina', 12.4, 11.5)
    expect(c.cruces.some(x => x.extremo === 'bajo' && x.direccion === 'sale')).toBe(true)
  })

  it('moverse DENTRO del rango no cruza nada por mucho que se mueva', () => {
    const c = queCambio('glucosa', 72, 99)
    expect(c.cruces).toEqual([])
    expect(c.relevanciaDemostrada).toBe(false)
  })
})

describe('lo que no se puede juzgar se dice, no se da por normal', () => {
  it('un analito sin rango crítico definido queda como NO evaluable', () => {
    /* `lab-criticos` distingue «no evaluable» de «normal», y esa diferencia no
       se puede perder: un resultado no se da por bueno porque el motor no supo
       leerlo. */
    const c = queCambio('hba1c', 6.5, 9.0)
    expect(c.criticoEvaluable).toBe(false)
  })

  it('y aun así los deltas y el cruce de referencia salen', () => {
    const c = queCambio('hba1c', 5.4, 9.0)
    expect(c.cruces.some(x => x.linea === 'referencia')).toBe(true)
    expect(comoSeDicenLosDeltas(c)).toMatch(/\+3\.6/)
  })
})

describe('el RCV no se inventa: se declara que no lo hay', () => {
  it('la tabla existe, está vacía y está congelada', () => {
    expect(Object.keys(RELEVANCIA_POR_RCV)).toEqual([])
    expect(Object.isFrozen(RELEVANCIA_POR_RCV)).toBe(true)
  })

  it('y el módulo explica por qué está vacía y dónde entraría', () => {
    expect(POR_QUE_NO_HAY_TABLA_DE_RCV).toMatch(/inventar una cifra clínica/)
    expect(POR_QUE_NO_HAY_TABLA_DE_RCV).toMatch(/RELEVANCIA_POR_RCV/)
  })

  it('la política del dueño está citada, con su fecha', () => {
    expect(DE_QUIEN_ES_ESTA_POLITICA).toMatch(/29-ago-2026/)
    expect(DE_QUIEN_ES_ESTA_POLITICA).toMatch(/no existe un porcentaje universal/i)
  })
})

describe('el dato tiene que LLEGAR a la consulta', () => {
  const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

  it('la línea de laboratorios lleva el cambio junto a la trayectoria', () => {
    expect(src).toContain("from '@/lib/expediente/laboratorio/que-cambio-de-verdad'")
    expect(src).toMatch(/queCambio\(clave, t\.previo\.valor, t\.actual\.valor\)/)
    expect(src).toMatch(/comoSeDiceElCambio\(cambio\)/)
  })

  it('y sigue sin prometer que el cambio sea importante', () => {
    expect(src).toContain('no si el cambio es importante')
  })
})
