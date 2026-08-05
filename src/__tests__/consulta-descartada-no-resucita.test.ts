/**
 * GOLDEN — una consulta descartada NO puede volver sola.
 *
 * ── DE DÓNDE SALE ESTE GUARDIÁN ──────────────────────────────────────────────
 *
 * Buscando el ORIGEN de REG-155 —cómo llega la pantalla a tener el id de un
 * documento que ya no existe— apareció el camino: `descartar()` borraba el
 * documento y navegaba fuera, pero **no soltaba `notaIdRef`**. El autoguardado se
 * serializa en una cadena, así que puede quedar uno en vuelo, y ese guardado
 * tardío escribía sobre el documento recién borrado.
 *
 * Antes eso volvía como PERMISSION_DENIED — una de las formas en que el Dr. veía
 * «el servidor rechazó el permiso».
 *
 * ── Y EL RIESGO QUE INTRODUJO LA PROPIA REPARACIÓN ───────────────────────────
 *
 * Desde REG-155 la consulta se recupera sola cuando el documento no está. Sobre
 * este camino, ese mismo guardado tardío **volvería a crear la nota que el
 * médico acaba de descartar**, con su confirmación de por medio y el aviso «se
 * eliminará y no podrás recuperarla».
 *
 * Recuperar es correcto cuando el documento se PERDIÓ; es un defecto grave
 * cuando se borró QUERIENDO. Lo único que distingue los dos casos es la marca de
 * descarte, y por eso este golden existe.
 *
 * No es hipotético: el propio código ya avisaba de una versión anterior de esto
 * —«la consulta descartada reaparecía completa […] y se recreaba sola en
 * Firestore al autoguardarse»—.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const consulta = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

describe('LA MARCA DE DESCARTE EXISTE Y ES SÍNCRONA', () => {
  it('es una ref, no un estado', () => {
    /**
     * Un estado vale en el siguiente render. El guardado en vuelo ocurre antes
     * de eso, así que un estado llegaría tarde — exactamente el motivo por el
     * que `firmadaRef` y `notaIdRef` ya son refs en esta pantalla.
     */
    expect(consulta).toContain('const descartadaRef = useRef(false)')
  })

  it('se marca ANTES de borrar el documento', () => {
    // Entre el borrado y la navegación cabe un autoguardado: ése es el que resucita.
    const iMarca = consulta.indexOf('descartadaRef.current = true')
    const iBorra = consulta.indexOf('await deleteNota(clinicId, patientId, idReal)')
    expect(iMarca).toBeGreaterThan(0)
    expect(iMarca).toBeLessThan(iBorra)
  })

  it('y el id se suelta: ya no apunta a nada', () => {
    const i = consulta.indexOf('await deleteNota(clinicId, patientId, idReal)')
    const despues = consulta.slice(i, i + 300)
    expect(despues).toContain('notaIdRef.current = null')
    expect(despues).toContain('setNotaId(null)')
  })
})

describe('NADA ESCRIBE DESPUÉS DE DESCARTAR', () => {
  it('el autoguardado se detiene en la puerta', () => {
    const i = consulta.indexOf('const guardarBorrador = useCallback')
    expect(consulta.slice(i, i + 400)).toContain('if (descartadaRef.current) return Promise.resolve()')
  })

  it('y la recuperación de REG-155 NO recrea lo descartado', () => {
    /**
     * Es la parte que más importa: sin esta línea, la reparación de REG-155
     * convierte un descarte deliberado en una nota que reaparece.
     */
    const i = consulta.indexOf("if ((e as { code?: string })?.code !== 'nota-inexistente') throw e")
    const bloque = consulta.slice(i, i + 300)
    expect(bloque).toContain('if (descartadaRef.current) return')
    // Y la guarda va ANTES de crear, no después.
    expect(bloque.indexOf('if (descartadaRef.current) return'))
      .toBeLessThan(bloque.indexOf('await createNota('))
  })
})

describe('LO QUE SIGUE FUNCIONANDO', () => {
  it('la recuperación sigue viva para el caso legítimo', () => {
    // Documento perdido de verdad: se recrea y no se pierde la consulta.
    expect(consulta).toContain('await createNota(clinicId, patientId, { ...nota, estado: \'borrador\' })')
  })

  it('y descartar sigue limpiando el respaldo local y el audio', () => {
    const i = consulta.indexOf('const descartar = useCallback')
    const cuerpo = consulta.slice(i, i + 1800)
    expect(cuerpo).toContain('localStorage.removeItem(respaldoKey)')
    expect(cuerpo).toContain('borradorMem.borrar(respaldoKey)')
    expect(cuerpo).toContain('audio.descartarRecovery(')
  })
})
