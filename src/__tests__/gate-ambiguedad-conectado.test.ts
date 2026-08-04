/**
 * GOLDEN — el gate de ambigüedad salió del cajón.
 *
 * ── LO QUE PASABA ────────────────────────────────────────────────────────────
 *
 * `pipeline.ts` calcula `motivos` y `requiereConfirmacion` en **cada dictado**
 * desde hace versiones. Es la etapa que decide cuándo hay que **preguntarle al
 * médico en vez de adivinar**: negación incierta, lateralidad incierta, dosis o
 * unidad ambigua, dos fármacos plausibles.
 *
 * Y no lo leía nadie. El hook ni siquiera lo devolvía — `grep` de
 * `requiereConfirmacion` fuera de las pruebas daba **cero** consumidores. Es el
 * patrón «escrito, probado y sin conectar» que este repositorio lleva toda la
 * sesión persiguiendo, esta vez en las tres pantallas a la vez.
 *
 * ── Y UN MOTIVO QUE ERA INALCANZABLE ─────────────────────────────────────────
 *
 * `confianza_baja_con_termino_critico` está declarado en la política crítica y
 * **nada lo emitía**. No por descuido: el pipeline trabaja sobre texto y no ve
 * las confianzas por palabra, que viven en otro objeto. O sea que el motivo más
 * directo de todos —«el audio dudó justo donde había una dosis»— estaba escrito
 * y era imposible de disparar.
 *
 * ── POR QUÉ SE MUESTRA Y NO BLOQUEA ──────────────────────────────────────────
 *
 * Convertirlo en una pregunta obligatoria antes de firmar es una decisión sobre
 * el flujo del médico, no sobre el código. Queda declarada como decisión del
 * Dr., no tomada por mí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dudaEnZonaCritica, VENTANA_CRITICA, POR_QUE_NO_SE_ADIVINA_SI_ES_FARMACO, type TurnoConPalabras } from '@/lib/expediente/confianza-audio'
import { textosDeMotivos, TEXTO_MOTIVO, POR_QUE_NO_BLOQUEA } from '@/lib/expediente/motivos-confirmacion-texto'
import { MOTIVOS_CONFIRMACION, UNIDADES_CANONICAS } from '@/lib/asr/politica-critica'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')

const turno = (palabras: { texto: string; confianza: number }[]): TurnoConPalabras => ({
  speaker: 'A', text: palabras.map(p => p.texto).join(' '),
  palabras: palabras.map((p, i) => ({ ...p, inicioMs: i * 400 })),
})

describe('EL SEXTO MOTIVO, que era inalcanzable', () => {
  it('la duda PEGADA a una cifra cuenta', () => {
    const t = turno([
      { texto: 'meropenem', confianza: 0.35 },
      { texto: 'dos', confianza: 0.98 },
      { texto: '2', confianza: 0.99 },
      { texto: 'gramos', confianza: 0.97 },
    ])
    expect(dudaEnZonaCritica([t], UNIDADES_CANONICAS)).toBe(true)
  })

  it('y la duda pegada a una UNIDAD también', () => {
    const t = turno([{ texto: 'sefriaxona', confianza: 0.3 }, { texto: 'mg', confianza: 0.99 }])
    expect(dudaEnZonaCritica([t], UNIDADES_CANONICAS)).toBe(true)
  })

  it('una duda LEJOS de toda cifra no dispara', () => {
    /**
     * El falso positivo caro: si cualquier palabra dudosa disparara, el aviso
     * saldría en todas las consultas y el médico aprendería a ignorarlo.
     */
    const lejos = turno([
      { texto: 'refiere', confianza: 0.99 },
      { texto: 'docencia', confianza: 0.3 },
      { texto: 'desde', confianza: 0.98 },
      { texto: 'hace', confianza: 0.98 },
      { texto: 'mucho', confianza: 0.97 },
      { texto: 'tiempo', confianza: 0.96 },
      { texto: 'tomó', confianza: 0.98 },
      { texto: '500', confianza: 0.99 },
    ])
    expect(dudaEnZonaCritica([lejos], UNIDADES_CANONICAS)).toBe(false)
  })

  it('sin palabras dudosas, nunca dispara', () => {
    const t = turno([{ texto: 'meropenem', confianza: 0.99 }, { texto: '2', confianza: 0.99 }])
    expect(dudaEnZonaCritica([t], UNIDADES_CANONICAS)).toBe(false)
  })

  it('la ventana es acotada y tiene nombre', () => {
    expect(VENTANA_CRITICA).toBeGreaterThan(0)
    expect(VENTANA_CRITICA).toBeLessThan(10)
  })

  it('NO se intenta adivinar si la palabra dudosa «es un fármaco»', () => {
    /**
     * Eso exigiría adivinar qué quiso decir una palabra que el motor no
     * entendió — el fallo exacto que todo esto existe para impedir.
     */
    expect(POR_QUE_NO_SE_ADIVINA_SI_ES_FARMACO).toMatch(/existe para impedir/)
  })

  it('y el hook lo emite, que es donde sí están las confianzas', () => {
    expect(hook).toContain('dudaEnZonaCritica(utterancesRef.current, UNIDADES_CANONICAS)')
    expect(hook).toContain("'confianza_baja_con_termino_critico'")
  })

  it('con un espejo en referencia, no con el estado congelado', () => {
    // `aplicar` corre en un callback creado en un render anterior: leer el
    // estado ahí devolvería el valor viejo. Es el mismo defecto que ya obligó a
    // espejar la duración para el libro de costos.
    expect(hook).toContain('const utterancesRef = useRef<Utterance[]>([])')
  })
})

describe('EL GATE SALE DEL HOOK Y LLEGA A LAS PANTALLAS', () => {
  it('el hook devuelve los motivos', () => {
    expect(hook).toContain('motivosConfirmacion: string[]')
    expect(hook).toContain('setMotivosConfirmacion(')
  })

  it('y se limpian al empezar una grabación nueva', () => {
    expect(hook).toContain('setMotivosConfirmacion([])')
  })

  it('la consulta los enseña', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('textosDeMotivos(audio.motivosConfirmacion)')
    expect(page).toMatch(/Conviene confirmar antes de firmar/)
  })

  it('y UCI también', () => {
    const uci = leer('src', 'app', '(dashboard)', 'uci', 'page.tsx')
    expect(uci).toContain('textosDeMotivos(audio.motivosConfirmacion)')
    expect(uci).toMatch(/Conviene confirmar antes de firmar/)
  })
})

describe('LOS TEXTOS: cada uno dice DÓNDE mirar', () => {
  it('los seis motivos declarados tienen texto', () => {
    // Un motivo sin texto se ignora en pantalla, así que uno nuevo sin traducir
    // sería una alerta que nunca sale. Esto lo impide.
    for (const m of MOTIVOS_CONFIRMACION) {
      expect(TEXTO_MOTIVO[m], m).toBeTruthy()
    }
  })

  it('ninguno dice sólo «hay una ambigüedad»', () => {
    for (const m of MOTIVOS_CONFIRMACION) {
      expect(TEXTO_MOTIVO[m].length, m).toBeGreaterThan(40)
    }
  })

  it('no se repiten textos ni se enseña el nombre de máquina', () => {
    const t = textosDeMotivos(['dosis_o_unidad_ambigua', 'dosis_o_unidad_ambigua', 'motivo_que_no_existe'])
    expect(t).toHaveLength(1)
    expect(t[0]).not.toContain('_')
  })

  it('sin motivos, no hay lista', () => {
    expect(textosDeMotivos([])).toEqual([])
  })
})

describe('POR QUÉ NO BLOQUEA — decisión declarada, no tomada', () => {
  it('está escrito que bloquear es del Dr.', () => {
    expect(POR_QUE_NO_BLOQUEA).toMatch(/flujo de trabajo del médico/)
    expect(POR_QUE_NO_BLOQUEA).toMatch(/antifatiga/)
  })
})
