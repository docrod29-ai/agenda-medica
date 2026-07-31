import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'


/**
 * TOPE DE CRÉDITOS — hallazgo confirmado de la auditoría del 26-jul.
 *
 * «10 de 12 rutas que cobran créditos no verifican el tope: el consultorio
 * agotado sigue quemando la llave del dueño».
 *
 * Al medirlo hoy eran **5**, no 10 — y mi primer conteo dijo 14 porque buscaba
 * `creditosAgotados` y no vio las ocho rutas que ya usaban `gateCreditos`, que
 * lo llama por dentro. Un guardián automático no comete ese error; un `grep` a
 * ojo sí, y lo cometí.
 *
 * La puerta es UNA —`gateCreditos`— y este guardián comprueba que toda ruta que
 * resuelve una llave de IA pase por ella.
 */

const API = join(process.cwd(), 'src/app/api')

function rutas(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...rutas(p))
    else if (e === 'route.ts') out.push(p)
  }
  return out
}

/** Rutas que resuelven una llave de IA sin pasar por el tope. */
function sinTope(): string[] {
  return rutas(API).filter(p => {
    const src = readFileSync(p, 'utf8')
    if (!/resolverClaveIA\(/.test(src)) return false
    return !/gateCreditos|creditosAgotados/.test(src)
  }).map(p => p.replace(process.cwd() + '/', ''))
}

describe('tope de créditos · ninguna ruta cobra sin comprobarlo', () => {
  it('CERO rutas resuelven llave sin pasar por el tope', () => {
    const fuera = sinTope()
    expect(fuera, `Rutas sin tope:\n${fuera.join('\n')}`).toEqual([])
  })

  it('el escáner NO pasa por vacío', () => {
    // Si el walker se rompe, la lista queda vacía y el test de arriba pasa sin
    // comprobar nada.
    const conLlave = rutas(API).filter(p => /resolverClaveIA\(/.test(readFileSync(p, 'utf8')))
    expect(conLlave.length).toBeGreaterThanOrEqual(15)
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('tope de créditos · QUIÉN PAGA decide si se corta', () => {
  it('con llave PROPIA del consultorio NO se corta', async () => {
    // Paga su propia API: cortarle sería quitarle algo que ya pagó.
    const { gateCreditos } = await import('@/lib/ai-keys')
    expect(await gateCreditos('c1', 'clinica')).toBeNull()
  })

  it('sin llave tampoco: no hay nada que cobrar', async () => {
    const { gateCreditos } = await import('@/lib/ai-keys')
    expect(await gateCreditos('c1', 'ninguna')).toBeNull()
  })

  it('sobre la llave del dueño SIN consultorio, no se corta', async () => {
    // No hay contador al que preguntarle.
    const { gateCreditos } = await import('@/lib/ai-keys')
    expect(await gateCreditos(null, 'prueba')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════
describe('tope de créditos · falla ABIERTO, y también mira la PRUEBA', () => {
  it('ante un error de lectura NO corta', () => {
    // Dejar al médico sin la función por un fallo de red sería peor que una
    // llamada de más, y el contador de uso sigue registrando.
    const src = readFileSync(join(process.cwd(), 'src/lib/ai-keys.ts'), 'utf8')
    const i = src.indexOf('export async function gateCreditos')
    const cuerpo = src.slice(i, src.indexOf('\n}', i))
    expect(cuerpo).toMatch(/catch\(\(\) => false\)/)
    expect(cuerpo).not.toMatch(/catch\(\(\) => true\)/)
  })

  it('mira TAMBIÉN el tope de prueba, no sólo los créditos del mes', () => {
    // Antes sólo `creditosAgotados`: una cuenta en prueba con el tope de cortesía
    // consumido seguía llamando a la API del dueño.
    const src = readFileSync(join(process.cwd(), 'src/lib/ai-keys.ts'), 'utf8')
    const i = src.indexOf('export async function gateCreditos')
    expect(src.slice(i, src.indexOf('\n}', i))).toMatch(/pruebaAgotada/)
  })

  it('la decisión de fallar abierto está escrita, no implícita', () => {
    expect(readFileSync(join(process.cwd(), 'src/lib/ai-keys.ts'), 'utf8'))
      .toMatch(/Falla ABIERTO/)
  })
})
