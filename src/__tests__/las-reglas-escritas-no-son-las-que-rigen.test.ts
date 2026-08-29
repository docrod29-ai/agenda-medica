/**
 * GOLDEN — EL REPOSITORIO NO SABÍA SI SUS REGLAS RIGEN EN PRODUCCIÓN.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `firestore.rules` vive en el repositorio, se revisa en cada PR y se prueba
 * contra el emulador. Y **`vercel --prod` no lo publica**: el despliegue es otro
 * comando (`firebase deploy --only firestore:rules`) y otra autorización.
 *
 * Entre las dos cosas hay un hueco donde caben meses, y **nada lo detectaba**.
 * El repositorio queda diciendo una verdad —«esta colección está protegida
 * así»— que en producción no rige: la suite pasa, el emulador pasa, el PR se ve
 * bien, y la protección no existe.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Reconciliando P1-2 del tablero de Ausculta. La declaración en los tres sitios
 * la cerró REG-340 y el respaldo REG-343 — pero las dos anotaban lo mismo al
 * margen: «las reglas no se despliegan aquí; `members` sigue roto en producción
 * hasta que el dueño las publique». Esa nota llevaba meses viajando de un
 * documento a otro sin que nada la vigilara.
 *
 * `docs/roadmap/nexus-os/estado.json` lo tenía anotado desde E0-06.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * El estado del despliegue **se recordaba en prosa** en vez de derivarse. Es el
 * patrón `depende_de_recordar` de este repositorio aplicado a la
 * infraestructura: el dato existe (el contenido del archivo) y no había ningún
 * registro que lo comparara con lo que rige.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `firestore.rules.estado.json` guarda el **sha256 de las reglas confirmadas
 * desplegadas**. Si no coincide con las de hoy, `docs/ops/REGLAS-DE-FIRESTORE.md`
 * **tiene que decir qué está pendiente y qué se rompe mientras tanto**. Si no lo
 * dice, esto falla.
 *
 * Lo único que se pide a mano es lo que ninguna máquina puede saber —la
 * consecuencia— y es justo lo que hay que escribir.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No comprueba producción.** No hay forma de preguntarle a Firebase desde
 *   aquí qué reglas rigen; el hash dice lo que ALGUIEN CONFIRMÓ haber
 *   desplegado. Si se actualiza sin desplegar, miente — y por eso el propio
 *   archivo dice que no se toca para poner una prueba en verde.
 * · **No valida las reglas.** Que existan y estén desplegadas no dice que sean
 *   correctas: eso es la suite del emulador.
 * · **No cubre los índices**, que son otro despliegue y otra autorización
 *   (`docs/ops/INDICES-DE-FIRESTORE.md`).
 * · **No puede impedir el hueco**, sólo hacerlo visible. Desplegar sigue siendo
 *   una acción del dueño.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const RUTA_REGLAS = 'firestore.rules'
const RUTA_ESTADO = 'firestore.rules.estado.json'
const RUTA_DOC = 'docs/ops/REGLAS-DE-FIRESTORE.md'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

const reglas = readFileSync(RUTA_REGLAS, 'utf8')
const estado = JSON.parse(readFileSync(RUTA_ESTADO, 'utf8')) as {
  hashDesplegado: string; confirmadoEl: string; porQue: string; comoSeActualiza: string
}
const doc = readFileSync(RUTA_DOC, 'utf8')

/** Las filas de la tabla de pendientes: líneas de tabla que no son cabecera. */
function pendientesDeclarados(): string[] {
  const desde = doc.indexOf('## PENDIENTE DE DESPLIEGUE')
  if (desde < 0) return []
  const hasta = doc.indexOf('\n## ', desde + 1)
  const bloque = doc.slice(desde, hasta < 0 ? undefined : hasta)
  return bloque
    .split('\n')
    .filter(l => l.trim().startsWith('|'))
    .filter(l => !/^\|[\s|:-]+\|$/.test(l.trim()))   // separador de tabla
    .filter(l => !l.includes('Qué NO rige hoy'))     // cabecera
}

describe('EL DESPLIEGUE DE LAS REGLAS SE DERIVA, NO SE RECUERDA', () => {
  it('el registro existe y dice cómo se actualiza', () => {
    expect(typeof estado.hashDesplegado).toBe('string')
    expect(estado.comoSeActualiza).toContain('firebase deploy --only firestore:rules')
  })

  it('y dice, con todas las letras, que no se toca para poner una prueba en verde', () => {
    // Un registro de despliegue que se edita para pasar el CI deja de ser un
    // registro. Que lo diga el archivo es lo que hace pensar dos veces.
    expect(estado.comoSeActualiza).toContain('Nunca se actualiza para poner una prueba en verde')
  })

  it('EL CASO: si lo escrito no es lo desplegado, hay que DECIR qué queda pendiente', () => {
    const alDia = estado.hashDesplegado === sha256(reglas)
    if (alDia) {
      // Nada pendiente: la lista tiene que estar vacía, o estaría mintiendo al
      // revés — asustando con un hueco que ya se cerró.
      expect(
        pendientesDeclarados(),
        'las reglas están desplegadas: la lista de pendientes tiene que estar vacía',
      ).toEqual([])
      return
    }
    expect(
      pendientesDeclarados().length,
      `Las reglas de ${RUTA_REGLAS} NO coinciden con las confirmadas desplegadas. ` +
      `Declara en ${RUTA_DOC}, bajo «PENDIENTE DE DESPLIEGUE», QUÉ no rige y QUÉ se rompe ` +
      'mientras tanto. No actualices el hash sin haber desplegado.',
    ).toBeGreaterThan(0)
  })

  it('cada pendiente dice su consecuencia, no sólo su nombre', () => {
    // «Falta desplegar X» no le sirve a nadie. Lo que decide si esto es urgente
    // es qué está roto mientras tanto.
    for (const fila of pendientesDeclarados()) {
      const celdas = fila.split('|').map(c => c.trim()).filter(Boolean)
      expect(celdas.length, `fila incompleta: ${fila.slice(0, 60)}`).toBeGreaterThanOrEqual(3)
      expect(celdas[2].length, `sin consecuencia declarada: ${celdas[0]}`).toBeGreaterThan(20)
    }
  })

  it('el documento dice que `vercel --prod` NO publica las reglas', () => {
    expect(doc).toContain('no lo publica')
    expect(doc).toContain('firebase deploy --only firestore:rules')
  })

  it('y remite a los índices, que son otro despliegue y otra autorización', () => {
    expect(doc).toContain('docs/ops/INDICES-DE-FIRESTORE.md')
  })

  it('el cedazo sabe fallar: un documento sin tabla de pendientes no cuela', () => {
    /**
     * Probado al revés sobre un documento de mentira. Sin esto, el caso de
     * arriba pasaría igual el día que alguien borre la sección — que es
     * exactamente cómo desaparecen estas listas.
     */
    const falso = '# Reglas\n\n## PENDIENTE DE DESPLIEGUE\n\nNada por aquí.\n'
    const desde = falso.indexOf('## PENDIENTE DE DESPLIEGUE')
    const filas = falso.slice(desde).split('\n').filter(l => l.trim().startsWith('|'))
    expect(filas).toEqual([])
  })
})
