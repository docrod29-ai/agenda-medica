/**
 * GOLDEN — subir un PDF no puede depender de una CDN ajena.
 *
 * ── EL FALLO, REPORTADO POR EL DR. EN USO REAL ───────────────────────────────
 *
 * «¿Por qué no me deja guardar la firma que subo en PDF?»
 *
 * El conversor de PDF a imagen armaba la URL del worker de pdf.js apuntando a
 * `unpkg.com`, **con la versión adivinada** (`pdfjs.version || '6.0.227'`). Así
 * que subir un PDF —la firma del médico, el membrete— dependía de:
 *
 *  · que unpkg estuviera arriba y contestara rápido;
 *  · que esa versión exacta existiera en esa ruta exacta;
 *  · que la red del consultorio no bloqueara CDNs, cosa habitual en hospitales.
 *
 * Y cuando fallaba **no se veía un error claro**: pdf.js se quedaba esperando al
 * worker y lo único que salía era «Tiempo agotado (60s). Tu PDF puede ser muy
 * pesado» — un mensaje que manda al médico a buscar el problema donde no está.
 * Probaba con otro PDF más chico y volvía a fallar.
 *
 * El archivo viene DENTRO de `pdfjs-dist`. No había que descargarlo de ningún
 * lado.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()

describe('el worker se sirve desde nuestro propio origen', () => {
  it('está en `public/`, listo para desplegarse', () => {
    const p = join(raiz, 'public', 'pdf.worker.min.mjs')
    expect(existsSync(p), 'falta public/pdf.worker.min.mjs — corre `npm run pdf-worker`').toBe(true)
    // Un archivo vacío o truncado se serviría con 200 y rompería igual.
    expect(statSync(p).size).toBeGreaterThan(100_000)
  })

  it('el build lo refresca, para que no se desincronice de la librería', () => {
    /**
     * Si se copiara a mano, una actualización de `pdfjs-dist` dejaría un worker
     * de otra versión sirviéndose desde `public/` — y ese desajuste falla de
     * formas raras, no con un error claro.
     */
    const pkg = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'))
    expect(pkg.scripts['pdf-worker']).toContain('pdfjs-dist/build/pdf.worker.min.mjs')
    expect(pkg.scripts.build).toContain('pdf-worker')
  })

  it('el código lo prefiere sobre la CDN', () => {
    const s = readFileSync(join(raiz, 'src', 'lib', 'pdf-to-image.ts'), 'utf8')
    expect(s).toContain("const local = '/pdf.worker.min.mjs'")
    expect(s).toContain('pdfjs.GlobalWorkerOptions.workerSrc = servible')
  })

  it('y la CDN queda sólo de respaldo', () => {
    // Quitarla del todo sería peor: si un despliegue no llevara el archivo,
    // la función quedaría muerta sin salida.
    const s = readFileSync(join(raiz, 'src', 'lib', 'pdf-to-image.ts'), 'utf8')
    expect(s).toContain('unpkg.com/pdfjs-dist@')
    expect(s).toContain('servible')
  })

  it('comprobar el respaldo no puede tumbar la conversión', () => {
    // Un HEAD que falle no debe impedir intentar con la CDN.
    const s = readFileSync(join(raiz, 'src', 'lib', 'pdf-to-image.ts'), 'utf8')
    const i = s.indexOf("const local = '/pdf.worker.min.mjs'")
    expect(s.slice(i, i + 400)).toContain('catch')
  })
})

describe('la subida de firma acepta PDF de verdad', () => {
  const seccion = readFileSync(
    join(raiz, 'src', 'app', '(dashboard)', 'configuracion', 'secciones-cuenta.tsx'), 'utf8')

  it('el selector de archivo ofrece PDF', () => {
    // Si `accept` no lo lista, el explorador ni siquiera enseña el archivo y
    // parece que la aplicación no lo admite.
    expect(seccion).toContain('accept="application/pdf,image/png,image/jpeg,image/webp"')
  })

  it('y el PDF se convierte a imagen antes de guardarse', () => {
    expect(seccion).toContain('pdfFileToImageDataUrl')
  })
})
