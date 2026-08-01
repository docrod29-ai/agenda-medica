/**
 * EL SELLO QUE VE EL MÉDICO NO PUEDE MENTIR.
 *
 * `sellos.json` es la copia delgada del registro clínico que sí llega al
 * navegador (el registro entero son 2 100 líneas y no tiene por qué viajar para
 * pintar una etiqueta). Una copia es una segunda verdad, y una segunda verdad se
 * desincroniza.
 *
 * El fallo que estas pruebas impiden tiene dos caras y las dos son malas:
 *
 *  · La pantalla dice «sin validar» sobre un motor que el médico YA revisó →
 *    ruido que enseña a ignorar la etiqueta.
 *  · La pantalla CALLA sobre un motor que no está validado → exactamente lo
 *    contrario de para lo que se puso.
 *
 * Se comprueba regenerando y comparando, no leyendo: si el generador y el
 * registro discrepan, el CI cae.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CLINICAL_ENGINE_REGISTRY } from '@/lib/clinical/registry'
import sellos from '@/lib/clinical/sellos.json'

const RAIZ = process.cwd()

describe('sellos.json es fiel al registro clínico', () => {
  it('tiene EXACTAMENTE los mismos motores, ni uno más ni uno menos', () => {
    const enRegistro = CLINICAL_ENGINE_REGISTRY.map(m => m.id).sort()
    const enSellos = sellos.map(s => s.id).sort()
    expect(enSellos).toEqual(enRegistro)
  })

  it('cada motor lleva el MISMO estado que en el registro', () => {
    // Es la mitad que importa: un estado desincronizado es una etiqueta que
    // miente sobre seguridad clínica.
    const porId = new Map(sellos.map(s => [s.id, s.estado]))
    for (const m of CLINICAL_ENGINE_REGISTRY) {
      expect(porId.get(m.id), `estado de ${m.id}`).toBe(m.estado)
    }
  })

  it('el archivo publicado coincide con lo que genera el script AHORA MISMO', () => {
    /**
     * Regenerar y comparar, en vez de confiar en que alguien corrió el script.
     * Sin esto, cambiar un `estado` en el registro y olvidar regenerar dejaría el
     * CI verde con la pantalla diciendo lo de ayer.
     */
    execFileSync('node', ['scripts/generar-sellos-motores.mjs'], { cwd: RAIZ, stdio: 'pipe' })
    const enDisco = readFileSync(resolve(RAIZ, 'src/lib/clinical/sellos.json'), 'utf8')
    expect(JSON.parse(enDisco)).toEqual(sellos)
  })

  it('nadie se queda sin estado', () => {
    for (const s of sellos) {
      expect(['validado', 'pendiente_validacion', 'experimental'], `estado de ${s.id}`).toContain(s.estado)
      expect(s.nombre.length, `nombre de ${s.id}`).toBeGreaterThan(2)
    }
  })
})

describe('el trinquete de motores sin validar', () => {
  /**
   * TECHO, no cero.
   *
   * Exigir que no haya ningún motor sin validar haría nacer esta prueba en rojo,
   * y un gate que nadie puede poner en verde acaba desactivado — es lo que ya
   * pasó con el de ADRs hasta que se le puso trinquete. Así que el número se
   * CONGELA y sólo puede bajar: cuando el médico valide un motor, esta cifra
   * baja y la prueba obliga a apretar el trinquete.
   *
   * Que suba significa que se añadió un motor clínico nuevo sin validar. No está
   * prohibido —es lo normal al construirlo— pero tiene que ser una decisión
   * consciente y visible en el diff, no algo que se cuele.
   */
  const TECHO_SIN_VALIDAR = 24

  it(`no hay más de ${TECHO_SIN_VALIDAR} motores sin validación clínica`, () => {
    const sinValidar = sellos.filter(s => s.estado !== 'validado')
    expect(
      sinValidar.length,
      `Motores sin validar: ${sinValidar.map(s => s.id).join(', ')}`,
    ).toBeLessThanOrEqual(TECHO_SIN_VALIDAR)
  })

  it('si bajó, hay que apretar el trinquete', () => {
    const sinValidar = sellos.filter(s => s.estado !== 'validado').length
    expect(
      sinValidar,
      `Se validaron motores: baja TECHO_SIN_VALIDAR a ${sinValidar} en este archivo.`,
    ).toBe(TECHO_SIN_VALIDAR)
  })
})
