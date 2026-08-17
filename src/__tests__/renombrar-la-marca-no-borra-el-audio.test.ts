/**
 * RENOMBRAR LA MARCA NO PUEDE BORRAR EL AUDIO DE UNA CONSULTA — REG-307.
 *
 * ── QUÉ PROTEGE ─────────────────────────────────────────────────────────────
 *
 * El producto pasó de **NexusMED** a **Ausculta** porque `nexusmed.mx` estaba
 * registrado desde el 5-feb-2026 por otro médico con un producto del mismo
 * mercado. Eran **625 menciones en 269 archivos**.
 *
 * Un renombrado a ciegas —un `sed` sobre todo el repositorio— habría cambiado
 * también cinco cadenas que **parecen la marca y no lo son**. La peor:
 *
 *     const DB_NAME = 'nexusmed-recovery'
 *
 * Es el nombre de la base IndexedDB donde vive **el audio de una consulta en
 * curso**. Renombrarla no migra nada: la base vieja se queda donde está y la
 * aplicación deja de mirarla. El médico que estuviera grabando en el momento
 * del despliegue **pierde el audio**.
 *
 * No es hipotético. Este repositorio ya cerró dos veces ese mismo daño por
 * otras causas: REG-283 (transcribir una consulta borraba el audio de otra) y
 * REG-287 (el cierre por inactividad se llevaba la grabación en curso).
 *
 * ── LAS OTRAS CUATRO, Y POR QUÉ CADA UNA ────────────────────────────────────
 *
 * · `nexusmed.theme` — su preferencia de tema. Renombrarla se la borra.
 * · `nexusmed-expediente-1` y `nexusmed-respaldo-1` — **no son marca, son
 *   identificadores de FORMATO**, escritos dentro de cada respaldo y cada
 *   exportación que el médico ya descargó. Un importador que espere otro
 *   nombre no los lee. Un formato se versiona; no se rebautiza porque cambie
 *   el logotipo.
 * · `nexusmed-v1168` — la caché del service worker y el sello de
 *   `version.txt`. Cambiar el prefijo rompe la comprobación de versión
 *   desplegada, que es la que descubrió que v1146 mentía (REG-267).
 *
 * ── POR QUÉ ESTA PRUEBA Y NO UN COMENTARIO ──────────────────────────────────
 *
 * Porque la próxima vez que alguien vea `nexusmed` en el código va a pensar
 * que el renombrado quedó a medias, y va a «terminarlo». Es lo razonable de
 * hacer y es exactamente el error.
 *
 * Una frontera que sólo vive en un comentario es una frontera que se cruza.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { MARCA, NO_SE_RENOMBRAN } from '@/lib/marca'

const RAIZ = process.cwd()
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8')

describe('la marca cambió donde el médico la lee', () => {
  it('el nombre es Ausculta', () => {
    expect(MARCA).toBe('Ausculta')
  })

  it('los metadatos de la aplicación ya no dicen el nombre viejo', () => {
    const layout = leer('src/app/layout.tsx')
    expect(layout).toContain('Ausculta')
    /* Salvo la clave de `localStorage`, que es de la frontera. */
    const sinClaves = layout.replace(/nexusmed\.theme/g, '')
    expect(sinClaves, 'quedó el nombre viejo en los metadatos').not.toMatch(/NexusMED|NexusMed/)
  })

  it('el identificador de la aplicación móvil también', () => {
    /**
     * Se pudo cambiar sin coste porque NO está publicada: no existen las
     * carpetas `ios/` ni `android/`. Después de publicar, cambiar el `appId`
     * cuesta la base instalada — se convierte en otra aplicación.
     */
    const cap = leer('capacitor.config.ts')
    expect(cap).toMatch(/appId:\s*'mx\.ausculta\.app'/)
    expect(cap).toMatch(/appName:\s*'Ausculta'/)
  })
})

describe('y NO cambió donde la máquina la busca', () => {
  it('la base del audio de recuperación conserva su nombre', () => {
    /**
     * El que de verdad importa. Si esta prueba se pone roja porque alguien
     * «completó» el renombrado, lo que se rompe es el audio de un médico que
     * está grabando una consulta ahora mismo.
     */
    const hook = leer('src/hooks/useGrabacionAudio.ts')
    expect(
      hook,
      'se renombró la base IndexedDB del audio: el médico que esté grabando pierde la consulta',
    ).toContain("const DB_NAME = 'nexusmed-recovery'")
  })

  it('el cierre de sesión borra ESA base y no otra', () => {
    /**
     * `salir-seguro` hace `deleteDatabase(...)` para no dejar PHI en el
     * dispositivo. Si el borrado apuntara a un nombre y la escritura a otro,
     * el audio se quedaría en el disco después de cerrar sesión — que es el
     * fallo contrario y peor.
     */
    expect(leer('src/lib/salir-seguro.ts')).toContain('nexusmed-recovery')
  })

  it('los formatos de archivo ya emitidos siguen llamándose igual', () => {
    expect(leer('src/lib/expediente/exportacion.ts')).toContain('nexusmed-expediente-1')
    expect(leer('src/app/api/clinic/exportar/route.ts')).toContain('nexusmed-respaldo-1')
  })

  it('la preferencia de tema no se pierde', () => {
    // La llave vive en el hook compartido desde RTC-05 (antes en ThemeToggle);
    // lo vigilado es el NOMBRE de la llave, no su casa.
    expect(leer('src/hooks/useTema.ts')).toContain("'nexusmed.theme'")
    expect(leer('src/app/layout.tsx')).toContain("'nexusmed.theme'")
  })

  it('el sello de versión desplegada conserva su prefijo', () => {
    expect(leer('public/version.txt')).toMatch(/^nexusmed-v\d+/)
    expect(leer('public/sw.js')).toMatch(/const CACHE = 'nexusmed-v\d+'/)
  })

  it('la frontera está declarada en el código, no sólo en un comentario', () => {
    expect(NO_SE_RENOMBRAN).toContain('nexusmed-recovery')
    expect(NO_SE_RENOMBRAN).toContain('nexusmed.theme')
    expect(NO_SE_RENOMBRAN).toContain('nexusmed-v')
    expect(NO_SE_RENOMBRAN.length).toBe(5)
  })
})

describe('la historia no se maquilla', () => {
  it('la bitácora sigue nombrando el producto como se llamaba entonces', () => {
    /**
     * REG-060 y REG-267 pasaron en una aplicación que se llamaba NexusMED.
     * Reescribir el registro para que parezca que siempre se llamó Ausculta
     * sería falsear la única memoria fiable que tiene este repositorio.
     */
    const ledger = leer('docs/audit/regression-ledger.md')
    expect(ledger, 'se reescribió la bitácora: eso falsea el registro').toMatch(/NexusMED/i)
  })
})
