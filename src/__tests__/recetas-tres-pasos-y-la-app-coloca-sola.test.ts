/**
 * GOLDEN — «Recetas, órdenes y notas» son TRES pasos, y la app coloca sola.
 *
 * ── LO QUE REPORTÓ EL DUEÑO ─────────────────────────────────────────────────
 *
 * Con capturas de su propia pantalla: «esto se me hace muy complejo […] quiero
 * que el usuario no batalle tanto para subir su hoja membretada y su receta,
 * que no batalle para configurar el papel en su impresora y que no batalle en
 * acomodar dónde va el nombre, edad, etcétera […] no tenga tanta cosa, está muy
 * llena la pantalla y los va a confundir».
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Mirando la pantalla real, no el código. En el navegador del Dr. la pestaña
 * abría con: una guía de SEIS pasos desplegada, un aviso de a quién aplica, la
 * tarjeta de subir el diseño, el calibrador, el ajuste de márgenes y NUEVE
 * tarjetas de ajustes — todas al mismo peso visual, todas abiertas. El botón de
 * guardar quedaba al final de todo eso.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * No era desorden: era que la pantalla PEDÍA lo que ya sabía hacer.
 *
 *  1. Colocar Nombre, Edad, F. nacimiento… se hacía a mano arrastrando ocho
 *     etiquetas. Existía «Detectar los campos», que las coloca solas leyendo el
 *     formato — detrás de un clic, dentro de una tarjeta que sólo aparecía
 *     DESPUÉS de subir. El trabajo que más se batallaba ya estaba resuelto y
 *     nadie lo encontraba.
 *  2. Los pasos vivían en un texto ARRIBA y los controles ABAJO, sin relación
 *     declarada entre unos y otros: había que leer seis instrucciones y luego
 *     adivinar cuál de las once tarjetas era cada una.
 *  3. Todo estaba abierto a la vez, así que el 5 % de ajustes raros (RFC,
 *     vigencia, color de acento) ocupaba tanta pantalla como el 95 % del
 *     trabajo real (subir el papel y la firma).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El paso ES el control. Tres pasos —papel, firma, prueba—, cada uno con su
 * control dentro; lo demás plegado, sin quitar nada. Y lo que la app sabe hacer
 * sola, lo hace sola y lo DICE (la colocación es visible y cada etiqueta se
 * arrastra: se ve y se deshace, como pide la regla 3 de seguridad clínica).
 *
 * El caso 3 es el que vigila la regla hermana de «el dato tiene que LLEGAR»:
 * un control que escriba con `setRx` en vez de `actualizar` guarda el cambio en
 * memoria, no marca la pantalla como sucia, la barra de guardar no aparece y el
 * ajuste se pierde al recargar — sin ningún error.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No prueba que la detección acierte.** Comprueba que se lance sola y que
 *   haya UN solo camino hacia `/api/receta/detectar-campos`; la calidad de lo
 *   que devuelve el modelo de visión no se mide aquí.
 * · **No mide la pantalla en un navegador.** Cuenta estructura en la fuente. La
 *   jerarquía visual la miden `recetas-orden-visual` y el trinquete de diseño;
 *   el recorrido real con teclado y en móvil es trabajo de los arneses de V15.
 * · **No comprueba que el guardado escriba bien.** Eso ya lo hace la propia
 *   pantalla releyendo del servidor (`confirmarQueQuedo`).
 * · **No mide la impresión real.** El bloque 8 fija la GEOMETRÍA de la vista
 *   previa con números; que la impresora obedezca ese `@page` es cosa del
 *   sistema operativo, y por eso el paso 3 existe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  paperEfectivo, dimensionesImpresion, colocacionDeLaReceta,
} from '@/components/RecetaDocumento'
import type { RecetaConfig } from '@/types'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Sin comentarios: las cabeceras de este repositorio CITAN lo que explican. */
const sinComentarios = (s: string) => s
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const RECETAS = sinComentarios(leer('src/app/(dashboard)/configuracion/secciones-recetas.tsx'))
const CUENTA = sinComentarios(leer('src/app/(dashboard)/configuracion/secciones-cuenta.tsx'))
const PAGINA = sinComentarios(leer('src/app/(dashboard)/configuracion/page.tsx'))
const AYUDA = leer('src/lib/ayuda/conocimiento.ts')

describe('1 · la app coloca los datos sola al subir el formato', () => {
  it('la subida lanza la detección — no espera a que nadie pulse un botón', () => {
    const i = RECETAS.indexOf('const subirDisenoCompleto = async (file: File)')
    expect(i, 'ya no existe subirDisenoCompleto').toBeGreaterThan(-1)
    const cuerpo = RECETAS.slice(i, RECETAS.indexOf('if (!clinicId) return', i))
    expect(cuerpo, 'subir el diseño ya no detecta los campos: vuelve a ser trabajo a mano')
      .toContain('await detectarCamposDelDiseno(')
  })

  it('hay UN solo camino a la detección, compartido con el botón del calibrador', () => {
    /**
     * Si la subida se hubiera hecho su propia copia de la petición, el día que
     * cambie el contrato de la ruta uno de los dos caminos se queda atrás — y
     * el que se queda atrás es siempre el que nadie mira.
     */
    const peticiones = RECETAS.match(/\/api\/receta\/detectar-campos/g) ?? []
    expect(peticiones, 'la petición de detección está duplicada').toHaveLength(1)
    expect(RECETAS).toContain('async function detectarCamposDelDiseno(')
  })

  it('y lo colocado se DICE, porque una ayuda que actúa en silencio no se puede revisar', () => {
    expect(RECETAS).toContain('setCamposDetectados(')
    expect(RECETAS).toMatch(/Colocamos \$\{camposDetectados\} dato/)
  })
})

describe('2 · tres pasos, y el control vive DENTRO de su paso', () => {
  const PASOS: [number, string][] = [
    [1, 'Tu papel de receta'],
    [2, 'Tu firma y tu sello'],
    [3, 'Imprime una prueba'],
  ]

  for (const [n, titulo] of PASOS) {
    it(`paso ${n} · ${titulo}`, () => {
      const i = RECETAS.indexOf(`n={${n}}`)
      expect(i, `no está declarado el paso ${n}`).toBeGreaterThan(-1)
      expect(RECETAS.slice(i, i + 400)).toContain(`titulo="${titulo}"`)
    })
  }

  it('van en el orden en que se hacen', () => {
    const pos = (t: string) => RECETAS.indexOf(`titulo="${t}"`)
    expect(pos(PASOS[0][1])).toBeLessThan(pos(PASOS[1][1]))
    expect(pos(PASOS[1][1])).toBeLessThan(pos(PASOS[2][1]))
  })

  it('la firma se monta DENTRO del paso 2, no como una tarjeta suelta al final', () => {
    // «Escrito y sin conectar» al revés: el componente existe y funciona, pero
    // si la página lo vuelve a pintar como hermana, el paso 2 sale vacío.
    expect(PAGINA).toContain('firmaSlot={')
    expect(PAGINA).toContain('<FirmaUploadSection')
    const i = PAGINA.indexOf('<RecetasTab')
    const f = PAGINA.indexOf('<FirmaUploadSection')
    expect(i, 'la firma se pinta fuera de RecetasTab').toBeLessThan(f)
    expect(RECETAS).toContain('{firmaSlot}')
  })

  it('cada paso sabe si ya está resuelto', () => {
    // Sin esto, quien ya configuró todo vuelve a ver tres tareas pendientes.
    expect(RECETAS).toContain('listo={paso1Listo}')
    expect(RECETAS).toContain('listo={firmaLista}')
    expect(RECETAS).toContain('listo={pruebaOk}')
  })
})

describe('3 · lo raro se pliega, pero no se pierde', () => {
  it('los cuatro bloques de siempre siguen ahí, dentro de «Ajustes avanzados»', () => {
    const a = RECETAS.indexOf('<Avanzados')
    const z = RECETAS.indexOf('</Avanzados>')
    expect(a, 'ya no hay bloque de avanzados').toBeGreaterThan(-1)
    expect(z).toBeGreaterThan(a)
    const dentro = RECETAS.slice(a, z)
    for (const t of ['El papel', 'Cómo se ve', 'Qué se imprime', 'Datos legales']) {
      expect(dentro, `el bloque «${t}» se salió de los avanzados (o se perdió)`).toContain(`t="${t}"`)
    }
  })

  it('y arranca plegado: es la excepción, no el trabajo del día', () => {
    expect(RECETAS).toContain('const [verAvanzados, setVerAvanzados] = useState(false)')
  })

  it('el desplegable dice si está abierto (lector de pantalla incluido)', () => {
    const i = RECETAS.indexOf('function Avanzados(')
    expect(RECETAS.slice(i, i + 1200)).toContain('aria-expanded={abierto}')
  })
})

describe('4 · ningún control escribe por fuera de `actualizar`', () => {
  /**
   * PROBADO AL REVÉS: se devolvió UN `onChange` a `setRx({ ...rx, … })` y este
   * caso cae. Es el defecto que importa —el cambio se queda en memoria, la
   * barra de guardar no aparece y se pierde al recargar, sin ningún error— y es
   * invisible en una revisión de diff, porque las dos líneas se parecen.
   */
  it('no queda ningún `setRx` en un manejador de eventos', () => {
    const culpables = RECETAS.split('\n')
      .filter(l => l.includes('setRx(') && /onChange|onClick|onDetectado/.test(l))
    expect(culpables, `usan setRx en vez de actualizar:\n${culpables.join('\n')}`).toEqual([])
  })

  it('`setRx` sólo lo usan la carga y el guardado', () => {
    const usos = RECETAS.match(/[^t]setRx\(/g) ?? []
    expect(usos.length, 'apareció un setRx nuevo fuera de la carga y el guardado')
      .toBeLessThanOrEqual(3)
  })

  it('y `actualizar` es de verdad quien mueve la pantalla', () => {
    expect((RECETAS.match(/actualizar\(/g) ?? []).length).toBeGreaterThan(20)
  })
})

describe('5 · la barra de guardar aparece cuando hay algo que guardar', () => {
  it('depende de que la pantalla esté sucia', () => {
    expect(RECETAS).toContain('const hayQueGuardar = sucio || (!!resultado && !resultado.ok)')
    expect(RECETAS).toContain('{hayQueGuardar && (')
  })

  it('un guardado que el servidor aceptó pero la verificación desmintió la MANTIENE', () => {
    // Si no, el médico se queda con un aviso rojo y sin botón con el que reintentar.
    expect(RECETAS).toContain('!resultado.ok')
  })

  it('cargar y guardar dejan la pantalla limpia', () => {
    expect((RECETAS.match(/setSucio\(false\)/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('6 · la ayuda nombra los controles que existen HOY', () => {
  /**
   * Una instrucción que nombra un botón que ya no se llama así manda al médico
   * a buscar algo que no existe. Aquí se descubrió que la ayuda seguía citando
   * «Detectar campos con IA», renombrado meses atrás (RTC-13).
   */
  it('no manda a pulsar botones que ya no se llaman así', () => {
    for (const muerto of ['Detectar campos con IA', 'Usa TU propia receta', 'Guardar template']) {
      expect(AYUDA, `la ayuda sigue nombrando «${muerto}»`).not.toContain(muerto)
    }
  })

  it('cuenta los tres pasos que tiene la pantalla, no seis', () => {
    expect(AYUDA).toContain('Configurar tu receta (3 pasos)')
    expect(AYUDA).toContain('Ajustar dónde caen los datos')
    expect(AYUDA).toContain('Imprimir una prueba')
  })

  it('y sigue explicando la fecha de nacimiento y para qué sirve', () => {
    // La piden las farmacias para dispensar: si se cae de la ayuda, el campo
    // vuelve a ser uno que existe y nadie sabe que existe.
    expect(AYUDA).toContain('F. nacimiento')
    expect(AYUDA).toMatch(/farmacias/i)
  })
})

describe('7 · la firma se lee de donde REG-014 la dejó (REG-338)', () => {
  /**
   * Salió al ponerle una marca de «listo» al paso 2 y preguntarse de dónde se
   * saca ese booleano. La sección de firma leía `form`, que es `config/main`;
   * REG-014 movió la firma a `config/firma` y la BORRA del general al migrar.
   * Resultado: consultorio migrado + recarga = recuadro vacío de «sube tu
   * firma», con la firma guardada y saliendo impresa.
   *
   * PROBADO AL REVÉS: devolviendo la lectura a `form.firmaPorMedico?.[medicoSel]`
   * a secas caen los dos primeros casos.
   */
  it('la sección de configuración lee del subdocumento protegido, como las cinco que imprimen', () => {
    expect(CUENTA, 'la pantalla que SUBE la firma no lee de donde vive')
      .toContain('useFirmaProtegida(clinicId, form)')
  })

  it('y lo que el médico acaba de tocar en esta sesión sigue ganando', () => {
    // `??` y no `||`: quitar la firma deja `''`, que es falso pero SÍ es una
    // decisión del médico y tiene que vencer al valor del servidor.
    expect(CUENTA).toContain("form.firmaPorMedico?.[medicoSel] ?? firmaProtegida.firmaPorMedico?.[medicoSel]")
    expect(CUENTA).toContain('form.firmaImagenDataUrl ?? firmaProtegida.firmaImagenDataUrl')
  })

  it('el paso 2 pregunta a la sección en vez de deducirlo por su cuenta', () => {
    // Deducirlo desde `form` en la página repetiría el mismo defecto un piso
    // más arriba: firma puesta, paso marcado como pendiente.
    expect(CUENTA).toContain('onEstado?.(!!firmaDataUrl)')
    expect(PAGINA).toContain('onEstado={setFirmaLista}')
    expect(PAGINA).toContain('firmaLista={firmaLista}')
  })
})

describe('8 · la vista previa enseña la hoja que sale de la impresora', () => {
  /**
   * ── EL DEFECTO, EN NÚMEROS ──────────────────────────────────────────────
   *
   * `imprimirEn: 'carta'` es el modo POR DEFECTO —el que funciona en cualquier
   * impresora— y hace que el documento se dibuje sobre una hoja carta de
   * 216 × 279 mm con la receta centrada dentro. La vista previa de
   * configuración dimensionaba su marco con `paperEfectivo`, que devuelve la
   * RECETA (140 × 216 en media carta). Marco de 140 mm, contenido de 216: la
   * receta salía cortada por la derecha nada más abrir la pantalla, sin tocar
   * nada, con la configuración de fábrica.
   *
   * Se descubrió MIRÁNDOLA: la captura del navegador enseñaba «FOLIO: RX-DE»
   * cortado a media palabra en el borde del marco. Ninguna prueba lo veía
   * porque ninguna comparaba las dos medidas.
   */
  const MEDIA_CARTA: RecetaConfig = { paperSize: 'media-carta', imprimirEn: 'carta' } as RecetaConfig

  it('la hoja que se DIBUJA no es la receta cuando se imprime en carta', () => {
    const receta = paperEfectivo(MEDIA_CARTA)
    const hoja = dimensionesImpresion(MEDIA_CARTA)
    expect(hoja.esHostCarta).toBe(true)
    // Ésta es la desigualdad que recortaba: 216 de contenido en 140 de marco.
    expect(hoja.widthMm).toBeGreaterThan(receta.widthMm)
    expect(hoja.heightMm).toBeGreaterThan(receta.heightMm)
  })

  it('y la pantalla dimensiona el marco con esa hoja, no con la receta', () => {
    expect(RECETAS).toContain('const host = dimensionesImpresion(rxOri)')
    expect(RECETAS).toContain('paperWidthMm={host.widthMm}')
    expect(RECETAS).toContain('paperHeightMm={host.heightMm}')
  })

  it('el marco es el componente canónico, no uno propio de esta pantalla', () => {
    // Tener su propio contenedor es lo que permitió que se desincronizara.
    expect(RECETAS).toContain('<RecetaPreviewWrapper')
    expect(RECETAS).not.toMatch(/const scaleByWidth/)
    expect(RECETAS).not.toContain("background: '#1a2333'")
  })

  it('y orienta el papel con el mismo hook que /receta, sin copiarlo', () => {
    expect(RECETAS).toContain('useRecetaPaperOrientado(rx)')
    expect(RECETAS).not.toMatch(/const apaisado = imgAspect > 1/)
  })

  it('la receta va centrada dentro de la carta, y las cuentas cierran', () => {
    const c = colocacionDeLaReceta(MEDIA_CARTA)
    expect(c.esHostCarta).toBe(true)
    expect(c.escala).toBeGreaterThan(1)                 // se agranda para llenar
    // La receta agrandada + sus dos márgenes son EXACTAMENTE la hoja carta. Si
    // esto no cierra, el recuadro arrastrable cae fuera de la receta.
    expect(c.offsetXMm * 2 + c.recetaWidthMm * c.escala).toBeCloseTo(c.hostWidthMm, 6)
    expect(c.offsetYMm * 2 + c.recetaHeightMm * c.escala).toBeCloseTo(c.hostHeightMm, 6)
  })

  it('sin host de carta la colocación es la identidad', () => {
    // Papel exacto cargado en la impresora: la receta ES la hoja, sin offsets
    // ni escala. Un `escala` distinto de 1 aquí movería el recuadro sin motivo.
    const c = colocacionDeLaReceta({ paperSize: 'media-carta', imprimirEn: 'papel-real' } as RecetaConfig)
    expect(c.esHostCarta).toBe(false)
    expect(c.escala).toBe(1)
    expect(c.offsetXMm).toBe(0)
    expect(c.offsetYMm).toBe(0)
    expect(c.recetaWidthMm).toBe(c.hostWidthMm)
  })

  it('el documento se dibuja con LA MISMA colocación que el recuadro', () => {
    // Si `HostCarta` volviera a calcular su escala por su cuenta, el recuadro y
    // la receta se separarían en cuanto una de las dos cambiara.
    const doc = leer('src/components/RecetaDocumento.tsx')
    expect(doc).toContain('const { escala } = colocacionEnCarta(paper)')
    expect(doc).not.toMatch(/const MARGEN_MM = 14[\s\S]{0,200}function HostCarta/)
  })

  it('el arrastre encadena las DOS escalas', () => {
    // La de la vista previa y la que agranda la receta dentro de la carta. Con
    // una sola, cada milímetro arrastrado valdría un 16 % de más.
    expect(RECETAS).toContain('scale={scale * colocacion.escala}')
  })

  it('lo que se manda a imprimir mide la hoja física', () => {
    expect(RECETAS).toContain('anchoMm: host.widthMm, altoMm: host.heightMm')
  })
})
