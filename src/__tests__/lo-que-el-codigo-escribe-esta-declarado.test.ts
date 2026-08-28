import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { coleccionesEscritas } from '../../scripts/seguridad/colecciones-escritas.mjs'
import { COLECCIONES, EXCLUIDAS, COLECCIONES_RAIZ, RAIZ_EXCLUIDAS } from '@/lib/clinica/respaldo'
import { MATRIZ_ACCESO } from '@/lib/authz/matriz-acceso'

/**
 * REG-340 — LOS TRES GUARDIANES ERAN CIEGOS AL MISMO HUECO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La regla de aislamiento exige declarar toda colección nueva en TRES sitios:
 * `firestore.rules`, `matriz-acceso.ts` y `respaldo.ts`. Y había un guardián por
 * cada uno. Aun así, NUEVE colecciones de consultorio se escribían desde el
 * código y no estaban en ninguno de los tres.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Los dos guardianes que importan aquí —`respaldo-consultorio` y
 * `matriz-acceso`— **parsean `firestore.rules`** y lo tratan como el censo de lo
 * que existe. Comparan reglas↔matriz y reglas↔respaldo. **Ninguno mira el
 * código.**
 *
 * De modo que una colección que nunca entró en las reglas es invisible para los
 * tres sitios Y para los dos guardianes A LA VEZ, y la suite se queda en verde.
 * No era un olvido repetido nueve veces: era un punto ciego con forma de círculo
 * — tres documentos validándose entre ellos, ninguno contra la realidad.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría WS-11 del Master Completion Loop, enumerando `.collection('…')` en
 * `src/` y cruzándolo a mano contra los tres sitios.
 *
 * ── LO QUE HABÍA DENTRO DEL HUECO ────────────────────────────────────────────
 *
 * · `internamientos/{id}/registros` — la bitácora APPEND-ONLY del episodio,
 *   íntegra y sin truncar, que existe **para la NOM-004**. No se respaldaba: se
 *   restauraba el episodio, su bitácora legal no volvía, y el pie del archivo
 *   seguía diciendo `completo: true`. Idéntico al fallo que ya costó las adendas.
 * · `members` — se leía Y se escribía **desde el navegador** sin ninguna regla,
 *   así que la negaba el `match /{document=**}` final. El apodo del chat no se
 *   guardaba nunca y nadie se enteraba, porque el código cae con elegancia al
 *   nombre por omisión. Un defecto que se esconde detrás de su propio respaldo.
 * · Siete más de sólo servidor: sin exposición de acceso, pero sin respaldo y sin
 *   clasificar.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El censo sale del CÓDIGO, no de las reglas. Toda colección bajo
 * `clinics/{clinicId}` cuyo nombre aparezca escrito en `src/` tiene que estar en
 * los tres sitios, o declararse excluida con su motivo.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **Es un cedazo sobre literales.** No resuelve un nombre de colección que
 *   venga en una variable (`collection(db, ruta)`). Encuentra lo que está
 *   escrito a la vista, que es como entraron estas nueve.
 * · No comprueba que la REGLA sea correcta, sólo que exista. Que `registros`
 *   esté declarada `if false` es una decisión, no una verificación.
 * · No prueba las reglas contra el emulador: eso es la suite de emulador.
 * · De las de NIVEL RAÍZ sólo comprueba que estén CLASIFICADAS: o se respaldan
 *   con el consultorio (`COLECCIONES_RAIZ`) o se declaran fuera con su motivo
 *   (`RAIZ_EXCLUIDAS`). No comprueba reglas ni matriz para ellas: el Admin SDK
 *   se salta las reglas y el comodín de denegación niega al cliente, así que no
 *   hay exposición de acceso que vigilar — lo que había que cerrar era el hueco
 *   del RESPALDO (REG-343).
 */

const RUTAS_MATRIZ = new Set(
  MATRIZ_ACCESO.flatMap(r => r.ruta.split('/').filter(p => !p.startsWith('{'))),
)

/** Los nombres del árbol de respaldo, a cualquier profundidad. */
function nombresDelRespaldo(): Set<string> {
  const fuera = new Set<string>()
  const anda = (ramas: readonly unknown[]) => {
    for (const r of ramas) {
      if (typeof r === 'string') { fuera.add(r); continue }
      const rama = r as { ruta: string; hijas?: readonly unknown[] }
      fuera.add(rama.ruta)
      if (rama.hijas) anda(rama.hijas)
    }
  }
  anda(COLECCIONES)
  return fuera
}

const REGLAS = readFileSync('firestore.rules', 'utf8')
const EN_REGLAS = new Set(
  [...REGLAS.matchAll(/match\s+\/([a-z_]+)/g)].map(m => m[1]),
)

const escritas = coleccionesEscritas() as { nombre: string; ambito: string; donde: string[] }[]
const deConsultorio = escritas.filter(c => c.ambito === 'consultorio' && c.nombre !== 'clinics')

describe('REG-340 · lo que el código escribe está declarado en los tres sitios', () => {
  it('el censo NO sale de firestore.rules: sale del código', () => {
    // Si esto llegara a cero, el cedazo dejó de mirar y la prueba no prueba nada.
    expect(deConsultorio.length).toBeGreaterThan(20)
  })

  it('toda colección de consultorio está en firestore.rules', () => {
    const sin = deConsultorio
      .filter(c => !EN_REGLAS.has(c.nombre) && !(c.nombre in EXCLUIDAS))
      .map(c => `${c.nombre} (${c.donde[0]})`)
    expect(sin.join('\n')).toBe('')
  })

  it('toda colección de consultorio está en la matriz de acceso', () => {
    const sin = deConsultorio
      .filter(c => !RUTAS_MATRIZ.has(c.nombre) && !(c.nombre in EXCLUIDAS))
      .map(c => `${c.nombre} (${c.donde[0]})`)
    expect(sin.join('\n')).toBe('')
  })

  it('toda colección de consultorio se respalda, o se declara excluida CON MOTIVO', () => {
    const enRespaldo = nombresDelRespaldo()
    const sin = deConsultorio
      .filter(c => !enRespaldo.has(c.nombre) && !(c.nombre in EXCLUIDAS))
      .map(c => `${c.nombre} (${c.donde[0]})`)
    expect(sin.join('\n')).toBe('')
    // Y una exclusión sin motivo no es una exclusión.
    for (const [nombre, motivo] of Object.entries(EXCLUIDAS)) {
      expect(motivo.length, `${nombre}: excluida sin motivo`).toBeGreaterThan(40)
    }
  })

  it('la bitácora NOM-004 del episodio se respalda', () => {
    // El caso concreto que abrió REG-340, clavado para que no vuelva a caerse.
    expect(nombresDelRespaldo().has('registros')).toBe(true)
    expect(escritas.find(c => c.nombre === 'registros')?.ambito).toBe('consultorio')
  })

  it('toda colección de nivel raíz está clasificada: se respalda o se declara fuera', () => {
    const respaldadas = new Set(COLECCIONES_RAIZ.map(c => c.ruta))
    const fuera = new Set(Object.keys(RAIZ_EXCLUIDAS))
    /** `platform_*` cubre a toda la familia con un motivo común. */
    const cubiertaPorFamilia = (n: string) => n.startsWith('platform_') && fuera.has('platform_*')

    const sin = escritas
      .filter(c => c.ambito === 'raiz' && c.nombre !== 'clinics')
      .filter(c => !respaldadas.has(c.nombre) && !fuera.has(c.nombre) && !cubiertaPorFamilia(c.nombre))
      .map(c => `${c.nombre} (${c.donde[0]})`)
    expect(sin.join('\n')).toBe('')
  })

  it('lo que ata una cuenta a un consultorio se respalda con él', () => {
    // REG-343: restaurar sin `clinic_members` devuelve el expediente entero y a
    // NADIE que pueda entrar a verlo. Clavado, porque el archivo se veía
    // completo justamente porque lo que faltaba no estaba en la lista.
    expect(COLECCIONES_RAIZ.map(c => c.ruta)).toContain('clinic_members')
    const miembros = COLECCIONES_RAIZ.find(c => c.ruta === 'clinic_members')!
    expect(miembros.campoClinica).toBe('clinicId')
  })

  it('una exclusión de raíz sin motivo no es una exclusión', () => {
    for (const [nombre, motivo] of Object.entries(RAIZ_EXCLUIDAS)) {
      expect(motivo.length, `${nombre}: excluida sin motivo`).toBeGreaterThan(40)
    }
  })

  it('el cedazo sabe fallar: una colección sin declarar se detecta', () => {
    // Probado al revés sin tocar el árbol: se le pasa el mismo criterio a una
    // colección inventada que nadie declaró.
    const inventada = { nombre: 'coleccion_que_nadie_declaro', ambito: 'consultorio', donde: ['x.ts:1'] }
    expect(EN_REGLAS.has(inventada.nombre)).toBe(false)
    expect(RUTAS_MATRIZ.has(inventada.nombre)).toBe(false)
    expect(nombresDelRespaldo().has(inventada.nombre)).toBe(false)
  })
})
