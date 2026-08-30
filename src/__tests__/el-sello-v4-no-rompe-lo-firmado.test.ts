/**
 * GOLDEN — EL SELLO v4 ENTRA SIN CONVERTIR EL HISTÓRICO EN «ALTERADA».
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `CAMPOS_NO_SELLADOS_V3` lo tenía escrito desde REG-199, con su fecha de
 * caducidad puesta:
 *
 *   «`transcripcionMotor` **ES material de origen y le CORRESPONDE ir sellado**
 *    — pero añadirlo al canónico v3 cambiaría el hash de TODAS las notas ya
 *    firmadas y las volvería «alterada» de golpe: la falsa alarma exacta de
 *    REG-060. Entra al sello cuando se suba a hashVersion 4.»
 *
 * Mientras tanto, en una nota **firmada**, lo que oyó el reconocedor —la fuente
 * de la que se re-proyecta la nota y de la que cuelga cualquier discusión
 * medicolegal— **se podía alterar sin que el sello lo notara**.
 *
 * ── POR QUÉ NO SE HABÍA HECHO, Y POR QUÉ AHORA SÍ ───────────────────────────
 *
 * Porque hacerlo mal es peor que no hacerlo: subir la versión sin conservar el
 * canónico viejo marca «alterada» todo el histórico firmado, que es la alarma
 * roja que el sello existe para no dar nunca. Se hace ahora porque el
 * FINAL-READINESS lo tenía como uno de los cinco pendientes, y porque la
 * maquinaria para hacerlo bien **ya estaba diseñada**: `CANONICO` despacha por
 * la versión que la nota DECLARA, y por eso las v2 siguen verificando hoy.
 *
 * ── QUÉ SELLA v4 ────────────────────────────────────────────────────────────
 *
 * Todo lo de v3, más **un solo campo**: `transcripcionMotor`. Es la reparación,
 * y nada más que la reparación.
 *
 * ── CÓMO SE DESCUBRIÓ LO QUE SOBRABA ────────────────────────────────────────
 *
 * La primera versión de este cambio abría además dos ranuras vacías,
 * `procedimientos` y `dispositivos`, con el argumento de que el canónico es una
 * lista cerrada y añadirles un campo después obligaría a un v5.
 *
 * `campos-sin-usar.test.ts` las rechazó —«un campo declarado y sin usar es una
 * promesa del modelo»— y al revisar el argumento no se sostenía: subir de
 * versión es justo lo que este módulo sabe hacer, y un v5 cuesta una entrada en
 * `CANONICO` y su prueba. La deuda que se compraba era permanente; lo que
 * evitaba, barato. Se quitaron. Este golden guarda esa decisión para que no se
 * vuelva a tomar al revés.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No añade procedimientos ni dispositivos al expediente.** Lo que el
 *   extractor oye se le señala al médico antes de firmar (REG-370) y
 *   documentarlo es acto suyo; el sello no crea el acto. Cuando exista quien
 *   los escriba, entrarán con su propio v5 — y v4 es la prueba recorrida de que
 *   esa migración no rompe lo firmado.
 * · **No re-sella las notas ya firmadas.** Una nota v3 sigue siendo v3, con su
 *   algoritmo y con lo que ese sello no cubre dicho en pantalla. Re-sellarlas
 *   sería reescribir documentos inmutables.
 * · **No cambia qué campos NO deben sellarse**: los que se escriben después del
 *   hash, los derivados y las transiciones legítimas posteriores a la firma
 *   siguen fuera, con su razón escrita.
 */
import { describe, it, expect } from 'vitest'
import {
  generarHashIntegridad, verificarIntegridadEstado, verificarIntegridadDetalle,
  normalizarParaSello,
  HASH_VERSION, VERSIONES_VERIFICABLES,
  CAMPOS_SELLADOS_V3, CAMPOS_NO_SELLADOS_V3,
  CAMPOS_SELLADOS_V4, CAMPOS_NO_SELLADOS_V4,
} from '@/lib/expediente/integrity'
import type { NotaMedica } from '@/types/expediente'

function nota(): NotaMedica {
  return {
    id: 'n1', clinicId: 'c1', pacienteId: 'p1', pacienteNombre: 'Paciente Sintético',
    tipo: 'consulta', estado: 'firmada', fechaConsulta: '2026-08-29T10:00:00.000Z',
    createdAt: '2026-08-29T09:00:00.000Z', creadoPor: 'uid-medico',
    metadata: {
      id: 'n1', tipoNota: 'consulta', clinicId: 'c1', pacienteId: 'p1',
      medicoId: 'uid-medico', cedulaProfesional: '00000000',
      especialidad: 'Medicina interna', establecimiento: 'Consultorio de pruebas',
      fechaCreacion: '2026-08-29T09:00:00.000Z', fechaModificacion: '2026-08-29T10:00:00.000Z',
      hashIntegridad: '', hashVersion: undefined, version: 1, estado: 'firmada',
      fuenteGeneracion: 'ia_voz',
    },
    resumenEjecutivo: 'Resumen sintético.',
    secciones: [{ key: 'subjetivo', label: 'Subjetivo', value: 'Texto S.', obligatorio: true }],
    diagnosticos: [{ descripcion: 'Faringitis', tipo: 'definitivo', estado: 'activo' }],
    medicamentos: [], alergias: [],
    transcripcionCruda: 'texto de trabajo',
    transcripcionMotor: 'lo que oyó el reconocedor',
  } as unknown as NotaMedica
}

const sellar = async (n: NotaMedica, v: 2 | 3 | 4) => ({
  ...n,
  metadata: { ...n.metadata, hashIntegridad: await generarHashIntegridad(n, v), hashVersion: v },
})

describe('lo firmado sigue verificando — la condición que hace posible subir de versión', () => {
  it('una nota v2 sigue «verificada» después de que exista v4', async () => {
    expect(await verificarIntegridadEstado(await sellar(nota(), 2))).toBe('verificada')
  })

  it('una nota v3 sigue «verificada» después de que exista v4', async () => {
    expect(await verificarIntegridadEstado(await sellar(nota(), 3))).toBe('verificada')
  })

  it('AL REVÉS — si el canónico viejo se perdiera, el histórico saldría «alterada»', async () => {
    /*
     * Reproducción de lo que este arreglo existe para no hacer: re-verificar una
     * nota v3 con el algoritmo v4. El hash no cuadra y la nota, intacta, saldría
     * marcada como alterada. Es REG-060 a escala de todo el expediente firmado.
     */
    const v3 = await sellar(nota(), 3)
    const conV4 = await generarHashIntegridad(v3, 4)
    expect(conV4).not.toBe(v3.metadata.hashIntegridad)
    /* Y por eso el despacho es por la versión que la nota DECLARA: */
    expect(await verificarIntegridadEstado(v3)).toBe('verificada')
  })

  it('las tres versiones se saben re-verificar, y la nueva es la que rige', () => {
    expect([...VERSIONES_VERIFICABLES]).toEqual([2, 3, 4])
    expect(HASH_VERSION).toBe(4)
  })

  it('una versión FUTURA desconocida es «legado», no «alterada»', async () => {
    /* Durante un despliegue parcial un cliente viejo puede leer una nota sellada
       por uno nuevo. Eso no es una alteración, y decirlo en rojo sería la falsa
       alarma otra vez. */
    const futura = { ...await sellar(nota(), 4), metadata: { ...nota().metadata, hashIntegridad: 'x', hashVersion: 99 } }
    expect(await verificarIntegridadEstado(futura as NotaMedica)).toBe('legado')
  })
})

describe('v4 sella el material de origen, que es la reparación', () => {
  it('alterar `transcripcionMotor` en una nota v4 la marca «alterada»', async () => {
    const v4 = await sellar(nota(), 4)
    const tocada = { ...v4, transcripcionMotor: 'otra cosa' }
    expect(await verificarIntegridadEstado(tocada)).toBe('alterada')
  })

  it('AL REVÉS — en una nota v3 la misma alteración NO se detecta', async () => {
    /* El defecto, reproducido: es exactamente lo que v4 cierra, y sigue siendo
       cierto para las notas ya firmadas. Por eso la pantalla se lo dice. */
    const v3 = await sellar(nota(), 3)
    const tocada = { ...v3, transcripcionMotor: 'otra cosa' }
    expect(await verificarIntegridadEstado(tocada)).toBe('verificada')
  })

  it('una nota v4 SÍ cubre todo: no le queda nada firmable fuera', async () => {
    const d = await verificarIntegridadDetalle(await sellar(nota(), 4))
    expect(d.estado).toBe('verificada')
    expect(d.version).toBe(4)
    expect(d.noCubre).not.toContain('transcripcionMotor')
  })

  it('y a una nota v3 se le sigue diciendo lo que su sello no cubre', async () => {
    const d = await verificarIntegridadDetalle(await sellar(nota(), 3))
    expect(d.cubreTodo).toBe(false)
    expect(d.noCubre).toContain('transcripcionMotor')
  })
})

describe('v4 añade UN campo, y ni uno más', () => {
  /**
   * El caso que rechaza la versión que se descartó. Una subida de sello es la
   * ocasión perfecta para colar «ya que estamos» un campo que nadie escribe, y
   * lo que se cuela queda prometido en el modelo para siempre. Si alguien vuelve
   * a ampliar el canónico de v4, esto se pone rojo y le obliga a justificarlo.
   */
  it('la diferencia con v3 es exactamente `transcripcionMotor`', () => {
    const nuevos = CAMPOS_SELLADOS_V4.filter(c => !CAMPOS_SELLADOS_V3.includes(c))
    expect(nuevos).toEqual(['transcripcionMotor'])
  })

  it('y nada que el producto no escriba entró al sello', () => {
    /* Documentar un procedimiento es acto del médico (REG-370); sellar una
       ranura vacía no crea el acto. Cuando exista quien la llene, entra con su
       propio v5. */
    for (const huerfano of ['procedimientos', 'dispositivos']) {
      expect(CAMPOS_SELLADOS_V4, `${huerfano} no lo escribe nadie`).not.toContain(huerfano)
    }
  })

  it('`normalizarParaSello` deja `transcripcionMotor` en null ANTES del hash (REG-060)', () => {
    /* Sin esto, el hash se calcularía sobre `null` y `updateDoc` conservaría el
       valor viejo por el MERGE: el documento guardado dejaría de corresponder a
       su sello. Es el modo de fallo de REG-060, ahora en el material de origen. */
    const sinMaterial = { ...nota() }
    delete sinMaterial.transcripcionMotor
    const n = normalizarParaSello(sinMaterial) as unknown as Record<string, unknown>
    expect('transcripcionMotor' in n, 'transcripcionMotor no se normalizó').toBe(true)
    expect(n.transcripcionMotor).toBeNull()

    /* Y con valor no se toca: normalizar no es borrar. */
    const conMaterial = normalizarParaSello(nota()) as unknown as Record<string, unknown>
    expect(conMaterial.transcripcionMotor).toBe(nota().transcripcionMotor)
  })

  it('una nota sin material de origen verifica igual', async () => {
    expect(await verificarIntegridadEstado(await sellar(nota(), 4))).toBe('verificada')
  })
})

describe('la partición del tipo se juzga contra el sello VIGENTE', () => {
  it('v4 cubre todo lo de v3, y además el material de origen', () => {
    for (const c of CAMPOS_SELLADOS_V3) expect(CAMPOS_SELLADOS_V4).toContain(c)
    expect(CAMPOS_SELLADOS_V4).toContain('transcripcionMotor')
  })

  it('lo que v4 no cubre se DERIVA de v3, no se copia a mano', () => {
    /* Dos listas escritas a mano acaban diciendo cosas distintas: es lo que
       REG-199 arregló. */
    const esperado = CAMPOS_NO_SELLADOS_V3.filter(x => !CAMPOS_SELLADOS_V4.includes(x.campo))
    expect(CAMPOS_NO_SELLADOS_V4).toEqual(esperado)
    expect(CAMPOS_NO_SELLADOS_V4.map(x => x.campo)).not.toContain('transcripcionMotor')
  })

  it('lo que NO debe sellarse sigue fuera, con su razón', () => {
    const fuera = CAMPOS_NO_SELLADOS_V4.map(x => x.campo)
    for (const c of ['firma', 'updatedAt', 'estado', 'metadata.hashIntegridad']) {
      expect(fuera, `${c} debería seguir fuera del sello`).toContain(c)
    }
    for (const { razon } of CAMPOS_NO_SELLADOS_V4) expect(razon.trim().length).toBeGreaterThan(30)
  })

  it('las listas v3 se conservan intactas como acta histórica', () => {
    /* Son lo que cubre el sello de las notas ya firmadas con v3, y de ahí sale
       lo que la pantalla les dice. Editarlas cambiaría el pasado. */
    expect(CAMPOS_NO_SELLADOS_V3.map(x => x.campo)).toContain('transcripcionMotor')
  })
})
