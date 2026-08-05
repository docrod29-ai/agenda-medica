/**
 * GOLDEN — una nota FIRMADA se quedaba abierta para editar, y no se guardaba
 * nunca.
 *
 * ── CÓMO SE ENCONTRÓ ─────────────────────────────────────────────────────────
 *
 * En vivo, el 4-ago-2026, con el Dr. atendiendo. Le salía cada 30 segundos:
 *
 *     «La nota NO se está guardando en el servidor (el servidor rechazó el
 *      permiso (reglas o sesión vencida)).»
 *
 * Se descartaron las tres sospechas obvias leyendo su propia base y su propio
 * navegador: la **sesión estaba viva**, la **clínica activa con pase libre**, y
 * su usuario era **admin** de esa clínica. Las tres condiciones de la regla se
 * cumplían.
 *
 * Lo que fallaba era la cuarta: `allow update: if ... resource.data.estado !=
 * 'firmada'`. **La nota del paciente estaba firmada.**
 *
 * ── EL MECANISMO ─────────────────────────────────────────────────────────────
 *
 * Las dos rutas que restauran el respaldo local reponen el `notaId` al que
 * pertenecía —con razón: sin eso se creaba una nota gemela en el expediente—,
 * pero **sin comprobar si esa nota ya se firmó**.
 *
 * Con el id de una nota firmada en la mano, la pantalla queda editando un
 * documento inmutable: cada autoguardado lo rechaza el servidor, para siempre.
 * Y `guardarBorrador` no se salta, porque su bandera `firmada` es del estado de
 * React y ahí valía `false` — el contenido vino del respaldo, no del servidor.
 *
 * El médico dicta una consulta entera creyendo que se guarda.
 *
 * ── LA REPARACIÓN ────────────────────────────────────────────────────────────
 *
 * Antes de adoptar el id se pregunta al servidor. Si está firmada, **el
 * contenido restaurado se queda** —no se pierde una palabra— pero pasa a ser
 * una nota NUEVA, y se le dice por qué con esas palabras.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const page = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')
const reglas = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8')

describe('EL SERVIDOR TIENE RAZÓN AL RECHAZAR', () => {
  it('una nota firmada es inmutable, y así seguirá', () => {
    /**
     * No se toca la regla: es la que le da valor legal al expediente. El fallo
     * estaba en el cliente, que le pedía algo imposible.
     */
    expect(reglas).toContain("allow update: if isMedico(clinicId) && resource.data.estado != 'firmada'")
  })
})

describe('NUNCA SE ADOPTA EL ID DE UNA NOTA FIRMADA', () => {
  it('en la restauración automática', () => {
    expect(page).toContain("const previa = await getNota(clinicId, patientId, id).catch(() => null)")
    expect(page).toMatch(/if \(previa\?\.estado === 'firmada'\)/)
  })

  it('y en el botón del banner — arreglar una y dejar la otra ya se hizo una vez aquí', () => {
    expect(page).toContain('const previa = await getNota(clinicId, patientId, idPrevio).catch(() => null)')
  })

  it('el contenido recuperado NO se pierde: pasa a ser una nota nueva', () => {
    expect(page).toMatch(/Lo recuperado se guardará como una nota NUEVA/)
  })

  it('las dos rutas dicen lo mismo, con las mismas palabras', () => {
    const veces = page.split('La nota anterior ya está firmada y no se puede modificar').length - 1
    expect(veces).toBe(2)
  })
})

describe('LOS AVISOS SE PUEDEN QUITAR', () => {
  it('el de negación y el de temporalidad', () => {
    /**
     * Un aviso que no se puede quitar deja de ser un aviso: se vuelve parte del
     * decorado y se deja de leer — y con él, el siguiente, que puede ser el que
     * importa.
     */
    expect(page).toContain("marcarRevisado('negacion', c.condicion)")
    expect(page).toContain("marcarRevisado('temporal', d.condicion)")
  })

  it('quitarlo NO cambia la nota', () => {
    // Sólo dice «ya lo miré». El criterio clínico quedó en lo que el médico
    // escribió, no en si el aviso está visible.
    expect(page).toMatch(/QUITARLO NO CAMBIA LA NOTA/)
  })

  it('y el aviso vuelve si el contenido cambia', () => {
    // Se filtra dentro del memo, que se recalcula con la nota: si el texto
    // cambia, es otro aviso y hay que volver a mirarlo.
    expect(page).toContain('.filter(c => !avisosRevisados.includes(`negacion:${c.condicion}`))')
    expect(page).toContain('.filter(d => !avisosRevisados.includes(`temporal:${d.condicion}`))')
  })
})
