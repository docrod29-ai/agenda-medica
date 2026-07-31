import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  generarHashIntegridad,
  verificarIntegridadEstado,
  normalizarParaSello,
  HASH_VERSION,
} from '@/lib/expediente/integrity'
import { stripUndefined } from '@/lib/expediente/serializacion'
import type { NotaMedica } from '@/types/expediente'

/**
 * REG-060 — el sello v3 marcaba "ALTERADA" una nota firmada LEGÍTIMA.
 *
 * POR QUÉ EL SUITE DE E0-12 NO LO VIO, y es la lección de este archivo: su test
 * de ida y vuelta escribía la nota como DOCUMENTO COMPLETO (`setDoc`). El flujo
 * de firma real hace `updateNota` → `updateDoc`, que hace **MERGE**. Un test que
 * simula una escritura distinta a la que hace la app puede estar verde mientras
 * el defecto está abierto en producción. Aquí se simula el merge de verdad.
 *
 * LA SECUENCIA, tal como la vive el médico:
 *   1. Dicta → autoguardado → `transcripcionCruda` queda en Firestore.
 *   2. VACÍA el cuadro del dictado → el campo pasa a `undefined` en memoria.
 *   3. Firma → el hash se calcula con ese campo en `null`.
 *   4. `stripUndefined` quita la llave (Firestore RECHAZA `undefined`) y
 *      `updateDoc` NO borra lo ausente → el texto viejo SOBREVIVE.
 *   5. Al reabrir, el hash recalculado no cuadra → alarma roja falsa.
 *
 * Datos 100 % sintéticos.
 */

/** Simula `updateDoc`: MERGE, y las llaves ausentes NO se borran. */
function comoUpdateDoc(
  enFirestore: Record<string, unknown>,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return { ...enFirestore, ...(stripUndefined(payload) as Record<string, unknown>) }
}

const notaBase = (): NotaMedica => ({
  id: 'n1',
  pacienteId: 'p-ficticio',
  pacienteNombre: 'Paciente Ficticio',
  tipo: 'consulta',
  estado: 'borrador',
  fechaConsulta: '2026-07-29',
  secciones: [],
  diagnosticos: [],
  medicamentos: [],
  alergias: [],
  metadata: { id: 'n1', medicoId: 'med-ficticio', tipoNota: 'consulta' },
} as unknown as NotaMedica)

/** Firma como lo hace la app: normaliza → sella → escribe ESE objeto por merge. */
async function firmarComoLaApp(
  enFirestore: Record<string, unknown>,
  enMemoria: NotaMedica,
): Promise<NotaMedica> {
  const sellable = normalizarParaSello(enMemoria)
  const hash = await generarHashIntegridad(sellable)
  const firmada = {
    ...sellable,
    estado: 'firmada',
    metadata: { ...sellable.metadata, hashIntegridad: hash, hashVersion: HASH_VERSION },
  } as unknown as NotaMedica
  const guardado = comoUpdateDoc(enFirestore, firmada as unknown as Record<string, unknown>)
  return guardado as unknown as NotaMedica
}

/** Los nueve opcionales que v3 sella con `?? null`. */
const OPCIONALES: readonly (keyof NotaMedica | string)[] = [
  'signosVitales', 'preop', 'hospital', 'infectologia', 'estudiosOrden',
  'internamientoId', 'iaAuditoria', 'transcripcionCruda', 'dialogoDiarizado',
]

describe('REG-060 · vaciar un campo opcional y firmar NO altera la nota', () => {
  it.each(OPCIONALES)('campo «%s»: se vacía tras un autoguardado y la nota sigue verificada', async (campo) => {
    // 1) Autoguardado CON el campo lleno.
    const conValor = { ...notaBase(), [campo]: 'valor-previo-sintetico' } as unknown as NotaMedica
    const enFirestore = stripUndefined(conValor as unknown as Record<string, unknown>) as Record<string, unknown>
    expect(enFirestore[campo as string]).toBe('valor-previo-sintetico')

    // 2) El médico lo VACÍA. 3-4) Firma y se escribe por merge.
    const vaciada = { ...notaBase(), [campo]: undefined } as unknown as NotaMedica
    const guardada = await firmarComoLaApp(enFirestore, vaciada)

    // 5) El valor viejo NO debe haber sobrevivido…
    expect(
      (guardada as unknown as Record<string, unknown>)[campo as string],
      `el valor viejo de ${campo} sobrevivió al merge: el sello no le corresponde`,
    ).toBeNull()

    // …y la nota firmada legítima NO debe salir alterada.
    expect(await verificarIntegridadEstado(guardada)).toBe('verificada')
  })

  it('CONTROL NEGATIVO: sin normalizar, el mismo camino SÍ da "alterada"', async () => {
    // Prueba que estos casos tienen dientes. Si alguien quita
    // `normalizarParaSello` del flujo de firma, esto es lo que vuelve a pasar.
    const conValor = { ...notaBase(), transcripcionCruda: 'tos y fiebre de tres dias' } as unknown as NotaMedica
    const enFirestore = stripUndefined(conValor as unknown as Record<string, unknown>) as Record<string, unknown>

    const vaciada = { ...notaBase(), transcripcionCruda: undefined } as unknown as NotaMedica
    const hashSinNormalizar = await generarHashIntegridad(vaciada)   // ← sin normalizar
    const firmada = {
      ...vaciada,
      estado: 'firmada',
      metadata: { ...vaciada.metadata, hashIntegridad: hashSinNormalizar, hashVersion: HASH_VERSION },
    } as unknown as NotaMedica
    const guardada = comoUpdateDoc(enFirestore, firmada as unknown as Record<string, unknown>) as unknown as NotaMedica

    expect((guardada as unknown as Record<string, unknown>).transcripcionCruda).toBe('tos y fiebre de tres dias')
    expect(await verificarIntegridadEstado(guardada)).toBe('alterada')
  })

  it('una nota que nunca tuvo el campo se verifica igual (no se rompió el caso normal)', async () => {
    const enFirestore = stripUndefined(notaBase() as unknown as Record<string, unknown>) as Record<string, unknown>
    const guardada = await firmarComoLaApp(enFirestore, notaBase())
    expect(await verificarIntegridadEstado(guardada)).toBe('verificada')
  })

  it('un campo con valor REAL se sigue sellando con su valor, no con null', async () => {
    // El arreglo no debe convertirse en «borrar los opcionales al firmar».
    const conValor = { ...notaBase(), transcripcionCruda: 'dictado que SÍ se conserva' } as unknown as NotaMedica
    const enFirestore = stripUndefined(conValor as unknown as Record<string, unknown>) as Record<string, unknown>
    const guardada = await firmarComoLaApp(enFirestore, conValor)

    expect((guardada as unknown as Record<string, unknown>).transcripcionCruda).toBe('dictado que SÍ se conserva')
    expect(await verificarIntegridadEstado(guardada)).toBe('verificada')
  })

  it('normalizarParaSello NO muta la nota que recibe', () => {
    const n = notaBase()
    const antes = JSON.stringify(n)
    normalizarParaSello(n)
    expect(JSON.stringify(n)).toBe(antes)
  })
})

describe('REG-060 · el flujo de firma real usa el normalizador', () => {
  const consulta = readFileSync(
    resolve(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8',
  )

  it('la pantalla de consulta normaliza ANTES de sellar', () => {
    expect(consulta).toContain('normalizarParaSello(notaParaValidar)')
  })

  it('sella el objeto NORMALIZADO, no el original', () => {
    // Si volviera a sellar `notaParaValidar`, el defecto regresa entero.
    expect(consulta).toContain('generarHashIntegridad(notaSellable)')
    expect(consulta).not.toContain('generarHashIntegridad(notaParaValidar)')
  })

  it('escribe el objeto NORMALIZADO, no el original', () => {
    expect(consulta).toContain('...notaSellable,')
  })
})
