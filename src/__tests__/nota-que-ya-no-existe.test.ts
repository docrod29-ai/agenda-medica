/**
 * GOLDEN — «el servidor rechazó el permiso» cuando el problema NO era el permiso.
 *
 * ── LO QUE VIVIÓ EL DR. EL 4-AGO-2026, CON UNA CONSULTA ENFRENTE ─────────────
 *
 * Dos avisos a la vez: «La nota NO se está guardando en el servidor (el servidor
 * rechazó el permiso (reglas o sesión vencida))» y «Error al firmar».
 *
 * Se comprobó en su sistema en vivo, y **todo estaba bien**: rol `admin`,
 * clínica `active`, pase libre, sesión con token vivo, nota de 10 KB —lejísimos
 * del tope de 1 MB—, y el campo `estado` presente en la raíz de los 22
 * documentos.
 *
 * ── LA CAUSA ─────────────────────────────────────────────────────────────────
 *
 * La pantalla tenía un `notaId` de un documento que **ya no existe** —un
 * respaldo local restaurado, o una nota descartada— y actualizaba a ciegas.
 *
 * Y Firestore, ante un `update` sobre un documento ausente, **no contesta «no
 * existe»**: la regla intenta leer `resource.data.estado` de un `resource` nulo,
 * revienta, y el fallo vuelve como PERMISSION_DENIED.
 *
 * De ahí el diagnóstico falso, que nos mandó a los dos a revisar reglas, roles y
 * sesión mientras el documento simplemente no estaba.
 *
 * ── POR QUÉ ERA EVITABLE ─────────────────────────────────────────────────────
 *
 * `updateNota` **ya leía el documento** justo antes, para versionarlo, y
 * `prev.exists()` decía que no. Tenía el dato en la mano y escribía igual.
 *
 * ── LA REPARACIÓN ────────────────────────────────────────────────────────────
 *
 * Se distingue el caso y la consulta se recupera sola: recrea el borrador con lo
 * que hay en pantalla y sigue. En el autoguardado y en la firma, porque cerrar
 * la consulta es el único paso que no admite esperar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (r: string) => readFileSync(join(process.cwd(), r), 'utf8')
const firestore = leer('src/lib/expediente/firestore.ts')
const consulta = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

describe('SE DISTINGUE «NO EXISTE» DE «NO TIENES PERMISO»', () => {
  it('updateNota se niega a escribir sobre un documento ausente', () => {
    expect(firestore).toContain('if (prevLeida && !prevLeida.exists())')
    expect(firestore).toContain("code: 'nota-inexistente'")
  })

  it('y sólo cuando la lectura FUE concluyente', () => {
    /**
     * `prevLeida` nulo significa que la lectura falló (un hipo de red), no que
     * el documento no esté. Tratarlo igual dejaría al médico sin guardar por un
     * problema de conexión — exactamente lo que el resto de esta función evita.
     */
    const i = firestore.indexOf('if (prevLeida && !prevLeida.exists())')
    expect(i).toBeGreaterThan(0)
    // La condición exige las DOS cosas: que haya lectura y que diga que no existe.
    expect(firestore.slice(i, i + 60)).toContain('prevLeida &&')
  })

  it('el aviso ya no culpa al permiso cuando la causa es otra', () => {
    expect(consulta).toContain("codigo === 'nota-inexistente'")
  })
})

describe('LA CONSULTA SE RECUPERA SOLA — no se pierde nada', () => {
  it('el autoguardado recrea la nota y sigue', () => {
    const i = consulta.indexOf("if ((e as { code?: string })?.code !== 'nota-inexistente') throw e")
    expect(i).toBeGreaterThan(0)
    expect(consulta.slice(i, i + 400)).toContain('await createNota(')
  })

  it('y la firma también, porque cerrar la consulta no admite esperar', () => {
    /**
     * Sin esto, «Error al firmar» dejaba al médico con la nota escrita y sin
     * poder cerrarla.
     */
    const iFirma = consulta.indexOf('await updateNota(clinicId, patientId, nuevo, notaFirmada)')
    expect(iFirma).toBeGreaterThan(0)
  })

  it('recreando siempre como BORRADOR, nunca como firmada', () => {
    /**
     * REG-017: ninguna nota nace firmada. La recuperación no puede ser la
     * puerta trasera que salte el flujo borrador → firmada.
     */
    const veces = consulta.split("estado: 'borrador' })").length - 1
    expect(veces).toBeGreaterThanOrEqual(2)
    // Y nunca se recrea directamente en firmada.
    expect(consulta).not.toContain("createNota(clinicId, patientId, { ...notaFirmada")
  })
})

describe('LO QUE NO SE TOCÓ, PORQUE ESTABA BIEN', () => {
  it('el conflicto de versión sigue bloqueando la escritura', () => {
    // Dos sesiones sobre la misma nota: se niega en vez de pisar el trabajo ajeno.
    expect(firestore).toContain('ConflictoDeVersion')
    expect(consulta).toContain("=== 'conflicto-de-version'")
  })

  it('y el tope de 1 MB sigue avisando con su propio mensaje', () => {
    expect(firestore).toContain("code: 'nota-demasiado-grande'")
  })
})
