/**
 * EL ENLACE DEL PACIENTE NO SE QUEDA EN EL TELÉFONO.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Panel de Lujo, 6-sep-2026:
 *
 *   PC-017 (P3)  El service worker cachea el HTML de las navegaciones, y su
 *                lista de rutas clínicas NO incluía `mi`. El HTML de
 *                `/mi/<token>` se guardaba en Cache Storage **con el token como
 *                clave**, así que el enlace del paciente quedaba en el
 *                dispositivo —y en el del tercero al que se lo reenviaron por
 *                WhatsApp— después de caducar o de ser revocado.
 *   A-007 (P3)   Esa lista está escrita a mano en `public/sw.js` y nadie la
 *                compara con el árbol de rutas: ya contenía `valoracion`, un
 *                prefijo que **no corresponde a ninguna ruta del producto**. Una
 *                entrada que no cubre nada da impresión de cobertura.
 *   PI-019 (P3)  Un botón flotante de tema acompañaba al paciente en `/mi`, en
 *                `/reservar`, en el aviso de privacidad y en la reseña. Con su
 *                voz: «no sé qué es».
 *   ASR-012 y PO-019 (P3) La página de «no encontrada» le hablaba de «caché» y
 *                de «una versión vieja de la app», y le ofrecía «Ir al
 *                dashboard». Y es la página a la que llega un paciente con un
 *                enlace de reserva partido al reenviarlo, que es el 404 más
 *                frecuente de este producto.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Los recorridos de paciente del Panel de Lujo (auditores PC, PI, PO) y el de
 * ingeniería para A-007. El equipo rojo confirmó los cuatro.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * Las superficies del paciente se añadieron después que las del médico, y las
 * listas escritas a mano —la del service worker, la del cromo global— no se
 * revisaron al añadirlas. El shell monta el botón de tema sin ninguna condición
 * de ruta, y el 404 se escribió pensando en el único usuario que había entonces.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * `data-privacy.md`: un enlace de paciente se reenvía por WhatsApp y acaba en
 * sitios que nadie controla, así que lo que el navegador guarde de él sobrevive
 * a la revocación. Y `patient-facing-ai.md` §8: el paciente ve lo suyo, en su
 * idioma, sin el cromo de una herramienta que no es la suya.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · No prueba el service worker corriendo: se comprueba el CONTRATO del archivo
 *   contra el árbol real de `src/app`. Que el navegador respete la regla es
 *   cosa del navegador y se mide en el arnés, no aquí.
 * · No mira lo que YA está cacheado en el teléfono de alguien: esta reparación
 *   evita que se guarde de ahora en adelante, no borra lo guardado. Quien tenga
 *   un `/mi/<token>` en caché lo conserva hasta que el service worker rote de
 *   versión (`CACHE` cambia con cada despliegue, así que se va en el siguiente).
 * · PI-019: no se renderiza. Se comprueba que la lista de superficies existe y
 *   que la ruta se consulta, no el píxel.
 * · No cubre PI-012 (el portal sin señal enseña la página de venta para
 *   médicos): eso pide una página de respaldo propia y va en `no-reparado`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const sw = leer('public/sw.js')

/** Los prefijos que la lista del service worker declara como clínicos. */
const declarados = (() => {
  const m = /const esRutaClinica = \/\^\\\/\(([^)]+)\)/.exec(sw)
  if (!m) throw new Error('no se encontró la lista de rutas clínicas en public/sw.js')
  return m[1].split('|')
})()

describe('PC-017 · las superficies del paciente no se cachean', () => {
  it.each(['mi', 'resena', 'teleconsulta', 'verificar'])('«/%s» está en la lista', (ruta) => {
    expect(declarados).toContain(ruta)
  })

  it('y las del médico siguen estando', () => {
    /* AL REVÉS: añadir las del paciente no puede haberse llevado por delante
       las que ya protegían el expediente. */
    for (const r of ['expediente', 'consulta', 'nota', 'receta', 'orden', 'referencia']) {
      expect(declarados, r).toContain(r)
    }
  })
})

describe('A-007 · la lista escrita a mano se compara con el árbol', () => {
  it('cada prefijo declarado corresponde a una ruta que existe', () => {
    /*
     * Éste es el guardián que faltaba, y es el que caza el próximo error de este
     * tipo: `valoracion` llevaba tiempo en la lista sin corresponder a nada. Un
     * prefijo que no cubre ninguna ruta no protege, y hace creer que sí.
     */
    const inexistentes = declarados.filter(r =>
      !existsSync(join(process.cwd(), 'src/app', r)) &&
      !existsSync(join(process.cwd(), 'src/app/(dashboard)', r)))
    expect(
      inexistentes,
      `prefijos del service worker sin ruta en el árbol: ${inexistentes.join(', ')}`,
    ).toEqual([])
  })

  it('la lista no está vacía', () => {
    /* Un guardián sobre una lista vacía pasa siempre: eso no es verde, es ciego. */
    expect(declarados.length).toBeGreaterThan(6)
  })
})

describe('PI-019 · el cromo del médico no acompaña al paciente', () => {
  const src = leer('src/components/ThemeToggle.tsx')

  it('el botón de tema conoce las superficies del paciente', () => {
    expect(src).toMatch(/const SUPERFICIES_DEL_PACIENTE = \[/)
    for (const r of ["'/mi'", "'/reservar'", "'/dr'", "'/privacidad'"]) {
      expect(src, r).toContain(r)
    }
  })

  it('y se calla en ellas', () => {
    expect(src).toMatch(/SUPERFICIES_DEL_PACIENTE\.some\(/)
    expect(src).toMatch(/return null/)
  })

  it('AL REVÉS · sigue existiendo para el médico', () => {
    /* Esconderlo en todas partes habría sido quitarle al médico una preferencia
       de su herramienta de trabajo para arreglar el problema de otro. */
    expect(leer('src/app/layout.tsx')).toContain('<ThemeToggle />')
  })
})

describe('ASR-012 y PO-019 · el 404 habla a quien llega', () => {
  const src = leer('src/app/not-found.tsx')

  it('no le habla de caché ni de versiones de la app al paciente', () => {
    /* La jerga baja al pie, junto al diagnóstico, y en la voz del consultorio. */
    expect(src).not.toMatch(/está usando una versión vieja de la app/)
    expect(src).toContain('El enlace que abriste no lleva a ninguna parte')
  })

  it('le dice qué hacer si viene a pedir una cita', () => {
    expect(src).toContain('¿Vienes a pedir una cita?')
    expect(src).toMatch(/enlace de citas completo/)
  })

  it('y el camino del médico se nombra como suyo', () => {
    expect(src).not.toMatch(/>\s*Ir al dashboard\s*</)
    expect(src).toContain('Soy médico: ir a mi agenda')
    /* Sin perder el destino: sigue llevando a la agenda. */
    expect(src).toMatch(/href="\/dashboard"/)
  })
})

describe('MO-008 y MC-011 · la fotografía clínica', () => {
  const comp = leer('src/components/FotosClinicas.tsx')
  const lib = leer('src/lib/expediente/fotos-clinicas.ts')

  it('MC-011 · la foto se reencoda antes de subirla, así que el EXIF no viaja', () => {
    /*
     * El canvas de `image-utils` redibuja la imagen: en ese trayecto los
     * metadatos —GPS, dispositivo, hora original— se pierden por construcción.
     * Lo que se comprueba es que este componente lo USA, que era lo que faltaba.
     */
    expect(comp).toContain("from '@/lib/image-utils'")
    expect(comp).toMatch(/resizeImageFile\(file, \{/)
    expect(comp).not.toMatch(/fr\.readAsDataURL\(file\)/)
  })

  it('MC-012 · no se puede capturar sin marcar que el paciente consintió', () => {
    expect(comp).toMatch(/disabled=\{subiendo \|\| !consintio\}/)
    expect(comp).toMatch(/El paciente <b>consintió<\/b>/)
  })

  it('MC-012 · y la compuerta dice honestamente lo que NO es', () => {
    /*
     * Sin registro en el expediente, esta casilla no prueba nada ante un
     * tercero. Decir lo contrario sería cambiar un hueco por una promesa falsa,
     * que es peor.
     */
    expect(comp).toMatch(/no<\/b> queda registrada como\s*\n?\s*consentimiento formal/)
  })

  it('MO-008 · la fecha de la toma es editable y por omisión es hoy', () => {
    expect(comp).toMatch(/aria-label="Fecha en que se tomó la imagen"/)
    expect(comp).toMatch(/useState\(\(\) => hoyISO\(\)\)/)
    /* Y no se puede fechar en el futuro. */
    expect(comp).toMatch(/max=\{hoyISO\(\)\}/)
  })

  it('MO-008 · las articulaciones existen como región, con su lado', () => {
    for (const r of ['Rodilla derecha', 'Tobillo izquierdo', 'Codo derecho', 'Muñeca izquierda', 'Cadera derecha']) {
      expect(lib, r).toContain(r)
    }
    expect(lib).toContain('Columna lumbar')
  })

  it('MO-008 · ninguna región par se quedó sin lado', async () => {
    /* AL REVÉS: si alguien añade «Rodilla» a secas, esto se pone rojo. En una
       estructura par, la región sin lado no identifica nada. */
    const { REGIONES } = await import('@/lib/expediente/fotos-clinicas')
    const pares = ['Hombro', 'Brazo', 'Codo', 'Antebrazo', 'Muñeca', 'Mano',
      'Cadera', 'Muslo', 'Rodilla', 'Pierna', 'Tobillo', 'Pie']
    const sinLado = REGIONES.filter(r =>
      pares.some(p => r === p) && !/derech|izquierd/i.test(r))
    expect(sinLado).toEqual([])
  })
})

describe('ZC-007 · el paso del cobro lleva a alguna parte', () => {
  it('ya no es un botón deshabilitado sin explicación', () => {
    const src = leer('src/lib/expediente/que-falta-para-cerrar.ts')
    expect(src).toMatch(/que: 'cobro',[\s\S]{0,200}ruta: '\/citas'/)
    expect(src).not.toMatch(/que: 'cobro',[\s\S]{0,200}ruta: null/)
  })

  it('y el título dice DÓNDE se cobra', () => {
    /* La vía normal siempre fue la asistente desde Citas; lo que faltaba era
       decírselo al médico en vez de apagarle el botón. */
    const src = leer('src/lib/expediente/que-falta-para-cerrar.ts')
    expect(src).toContain('Registrar el cobro en la cita')
  })
})

describe('MP-010 · una fecha ilegible no se convierte en un recién nacido', () => {
  it('`edadEnMeses` devuelve null, como su hermana `edadEnAnios`', async () => {
    const { edadEnMeses, edadEnAnios } = await import('@/lib/expediente/pediatria')
    expect(edadEnMeses('no-es-fecha', '2026-09-06')).toBeNull()
    expect(edadEnAnios('no-es-fecha', '2026-09-06')).toBeNull()
  })

  it('y sigue contando bien lo que sí es una fecha', async () => {
    /* AL REVÉS: devolver null siempre también pasaría el caso de arriba. */
    const { edadEnMeses } = await import('@/lib/expediente/pediatria')
    expect(edadEnMeses('2020-09-06', '2026-09-06')).toBe(72)
    expect(edadEnMeses('2026-08-06', '2026-09-06')).toBe(1)
  })
})
