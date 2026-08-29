/**
 * GOLDEN — LOS DISPOSITIVOS INVASIVOS SÓLO SE VEÍAN DENTRO DE SU PROPIA PESTAÑA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La valoración del inmunocomprometido captura dispositivos invasivos —CVC,
 * PICC, port-a-cath, sonda urinaria, ostomía, prótesis articular, **prótesis
 * valvular**, **marcapaso/DAI**, derivación ventricular, tubo, drenaje— y los
 * guarda en el expediente (`patient.txValoracion`, clave `hc_cb_disp_<x>`).
 *
 * Medido sobre el árbol el 29-ago-2026: el **único** lector de ese grupo era
 * `inmuno/compose.ts`, que arma el texto de esa misma valoración. Fuera de su
 * pestaña, nadie sabía que el paciente lleva una prótesis valvular.
 *
 * ── POR QUÉ IMPORTA ─────────────────────────────────────────────────────────
 *
 * Son los antecedentes que más cambian conducta sin aparecer en ningún
 * diagnóstico: una prótesis valvular o articular cambia la profilaxis y la
 * sospecha ante una bacteriemia; un marcapaso/DAI cambia qué imagen se puede
 * pedir; un catéter central cambia dónde se busca el foco.
 *
 * El médico los capturó una vez, están escritos, y en la consulta siguiente
 * tenía que acordarse de abrir una pestaña para verlos.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo WS-10 (dispositivos) con la pregunta de siempre: ¿quién lee esto?
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Familia «escrito y sin conectar», en la misma variante que REG-368: el dato
 * está en la misma pantalla, en otra pestaña, así que mirando la interfaz el
 * hueco es invisible.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **Sólo se afirma lo marcado.** Un dispositivo no marcado no es un dispositivo
 * negado: puede que nadie abriera la valoración. Con la lista vacía no se dice
 * «sin dispositivos» — no se dice nada. Regla 4.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No alimenta ningún motor.** No hay reglas clínicas sobre dispositivos en
 *   este producto —ni de profilaxis, ni de imagen, ni de foco— y escribirlas
 *   aquí sería inventar criterio clínico. Se pone el dato delante; decide el
 *   médico.
 * · **No crea una entidad de dispositivo** con fecha de colocación y de retiro.
 *   Eso es un campo nuevo en la nota, y un campo clínico nuevo exige el **sello
 *   v4** que REG-370 dejó declarado.
 * · **No dice si el dispositivo sigue puesto.** Lleva la fecha de la valoración
 *   para que se pueda juzgar; un catéter de hace dos años pudo retirarse.
 * · **No mueve `txValoracion` de sitio.** Es uno de los campos que E0-06 tiene
 *   pendientes de mudar fuera de `Patient`; leerlos no adelanta ni cambia esa
 *   migración, que sigue bloqueada por su acción externa.
 * · **No cubre UCI ni hospitalización**, que tienen su propio camino
 *   (`uci/handoff.ts`) y están diferidos por el dueño.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  dispositivosQueTrae, comoSeDicenLosDispositivos,
  POR_QUE_EL_VACIO_NO_DICE_NADA, POR_QUE_NO_ALIMENTA_UN_MOTOR,
} from '@/lib/expediente/los-dispositivos-que-trae'
import { TX_CHIPS } from '@/lib/inmuno/catalogos'

const CON_PROTESIS = {
  txValoracion: {
    hc_cb_disp_protval: '1',
    hc_cb_disp_marcapaso: '1',
    hc_cb_comorb_dm2: '1',      // otro grupo: no debe colarse
  },
  txValoracionAt: '2026-02-11T10:00:00.000Z',
}

describe('lo que el paciente lleva puesto llega a la consulta', () => {
  it('los marcados salen, con el nombre del catálogo', () => {
    const lo = dispositivosQueTrae(CON_PROTESIS)
    expect(lo.dispositivos.map(d => d.etiqueta)).toEqual(['Prótesis valvular', 'Marcapaso / DAI'])
    expect(comoSeDicenLosDispositivos(lo)).toBe('Prótesis valvular · Marcapaso / DAI')
  })

  it('con la fecha de la valoración: un catéter de hace dos años pudo retirarse', () => {
    expect(dispositivosQueTrae(CON_PROTESIS).registradoEn).toBe('2026-02-11T10:00:00.000Z')
  })

  it('AL REVÉS — sin este puente, el dato sigue guardado y nadie lo ve', () => {
    /* El estado anterior: el único lector era el compositor de la propia
       valoración. Aquí se comprueba que el dato SÍ estaba, que es lo que hace
       que la pérdida fuera invisible. */
    expect(CON_PROTESIS.txValoracion.hc_cb_disp_protval).toBe('1')
    const inmuno = readFileSync('src/lib/inmuno/compose.ts', 'utf8')
    expect(inmuno).toContain("chips('disp')")
  })

  it('otro grupo de la valoración no se cuela como dispositivo', () => {
    expect(dispositivosQueTrae(CON_PROTESIS).dispositivos.map(d => d.clave))
      .toEqual(['protval', 'marcapaso'])
  })

  it('el orden es el del catálogo, estable entre renders', () => {
    const claves = Object.keys(TX_CHIPS.disp.items)
    const lo = dispositivosQueTrae({
      txValoracion: Object.fromEntries(claves.map(k => [`hc_cb_disp_${k}`, '1'])),
    })
    expect(lo.dispositivos.map(d => d.clave)).toEqual(claves)
  })

  it('una llave suelta o renombrada en la base no se pinta como dispositivo', () => {
    /* Se recorre el catálogo, no las llaves guardadas: si no, un
       `hc_cb_disp_loquesea` saldría delante del médico con nombre de clave. */
    const lo = dispositivosQueTrae({ txValoracion: { hc_cb_disp_loquesea: '1' } })
    expect(lo.dispositivos).toEqual([])
  })
})

describe('el vacío no afirma nada', () => {
  it('sin ninguno marcado NO dice «sin dispositivos»', () => {
    expect(comoSeDicenLosDispositivos(dispositivosQueTrae({ txValoracion: {} }))).toBe('')
    expect(comoSeDicenLosDispositivos(dispositivosQueTrae(null))).toBe('')
    expect(comoSeDicenLosDispositivos(dispositivosQueTrae(undefined))).toBe('')
  })

  it('un valor distinto de «1» no cuenta como marcado', () => {
    expect(dispositivosQueTrae({ txValoracion: { hc_cb_disp_protval: '0' } }).dispositivos).toEqual([])
    expect(dispositivosQueTrae({ txValoracion: { hc_cb_disp_protval: '' } }).dispositivos).toEqual([])
  })

  it('sin valoración no hay fecha que inventar', () => {
    expect(dispositivosQueTrae({ txValoracion: {} }).registradoEn).toBeUndefined()
  })

  it('el porqué está escrito en el módulo', () => {
    expect(POR_QUE_EL_VACIO_NO_DICE_NADA).toMatch(/ausencia de dato en dato de ausencia/)
    expect(POR_QUE_NO_ALIMENTA_UN_MOTOR).toMatch(/inventar criterio clínico/)
  })
})

describe('el dato tiene que LLEGAR a la consulta', () => {
  const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

  it('la consulta lo deriva del paciente que ya tiene cargado', () => {
    expect(src).toContain("from '@/lib/expediente/los-dispositivos-que-trae'")
    expect(src).toMatch(/dispositivosQueTrae\(patient\)/)
  })

  it('lo pinta, y sólo cuando hay algo que decir', () => {
    expect(src).toMatch(/\{dispositivosEnLinea && \(/)
  })

  it('dice de cuándo es el dato y que el vacío no niega', () => {
    expect(src).toContain('loQueLleva.registradoEn')
    expect(src).toContain('que algo no aparezca no significa que no lo lleve')
  })

  it('NO se lo pasa a ningún motor: no hay reglas de dispositivos que aplicar', () => {
    expect(src).not.toMatch(/dispositivos:\s*loQueLleva/)
    expect(src).not.toMatch(/labsTrayectoria[\s\S]{0,200}dispositivos/)
  })
})
