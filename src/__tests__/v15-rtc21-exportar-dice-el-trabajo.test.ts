/**
 * RTC-21 — el bloque de exportación dice el TRABAJO, y lo dice ANTES.
 *
 * ── QUÉ DECÍA EL EQUIPO ROJO, Y QUÉ DIJO LA MEDICIÓN ────────────────────────
 *
 * RT-16 escribió dos cosas del expediente en el teléfono: que exportar pedía
 * demasiados gestos (§22: exportar no es trabajo móvil) y que «FHIR» le habla
 * al médico en jerga de interoperabilidad (§25). El pago propuesto era una
 * hoja «Compartir y exportar» detrás de UN botón.
 *
 * Antes de construirla se midió en navegador real
 * (`scripts/design/medir-rtc21-exportar-v15.mjs`, acta en
 * `docs/design/capturas/v15-rtc21-exportar/`):
 *
 *                        controles  bajo 44px  tras la historia  empieza en
 *   escritorio 1440           3          0           sí            820px
 *   móvil 390                 3          0           sí           1105px
 *
 * **La mitad de §22 ya estaba pagada** por RTC-10: el bloque vive al pie,
 * después de la historia clínica, con los tres controles apilados a ancho
 * completo y 45px de alto. Cada exportación cuesta HOY un gesto. Meterlas en
 * una hoja habría costado **dos** —abrir la hoja y elegir— y habría escondido
 * al pie de una pantalla lo que ya estaba al pie de una pantalla.
 *
 * Es la tercera vez en esta corrida que medir evita repintar: pasó con los
 * filtros de `/pacientes` (informaban) y con las píldoras (no sobraban en el
 * producto, sobraban en UNA pantalla).
 *
 * ── LO QUE LA MEDICIÓN SÍ CONFIRMÓ, Y SE PAGA AQUÍ ──────────────────────────
 *
 * 1. **«FHIR» era el único control que no decía su trabajo.** Cuatro letras en
 *    un botón de 358px de ancho en el teléfono. Ahora el botón dice **«Enviar
 *    a otro sistema»** y la sigla baja a segunda línea.
 *
 *    **No se borra la sigla, y ésa es la decisión.** Cuando otro hospital pide
 *    «el FHIR», el médico tiene que poder encontrarlo por ese nombre. §25
 *    prohíbe vender la tecnología como característica; no obliga a esconder el
 *    nombre de un artefacto real que alguien de fuera va a pedir. Misma
 *    distinción que RTC-13 tomó con «créditos con IA».
 *
 * 2. **Cuál archivo lleva qué se decía DESPUÉS de descargarlo.** Vivía en un
 *    comentario del código y en el aviso posterior. El médico elige antes: si
 *    se entera al terminar de que los borradores no iban, ya mandó el archivo
 *    equivocado. Ahora hay una línea bajo el rótulo que lo explica.
 *
 * 3. **Dos avisos por una descarga.** El manejador lanzaba `toast()` dos veces
 *    —uno con `resumenNotasExportadas` y otro recontando los borradores a
 *    mano— diciendo lo mismo con distintas palabras. Dos avisos para un acto
 *    no informan el doble: se lee el segundo y se pierde el primero.
 *
 * Probado al revés: devolviendo «FHIR» como etiqueta del botón falla el caso
 * 1; borrando la sigla del todo falla el 2; quitando la línea que explica la
 * diferencia falla el 3; devolviendo el segundo `toast` falla el 4.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba el contenido de los archivos.** Qué entra en el bundle FHIR
 *   y qué entra en el expediente completo lo prueban sus propios módulos; esto
 *   mira lo que la pantalla PROMETE, no lo que el exportador entrega.
 * · **No mide en navegador.** Que a 390px el bloque siga al pie y con 44px de
 *   táctil es el arnés, y su acta está fechada; este guardián protege el texto
 *   y la estructura, que es donde estaba el defecto.
 * · No juzga «Carta de referencia» ni «Expediente completo»: la medición dice
 *   que ya nombran su trabajo.
 * · **No cierra §22 para siempre.** Si algún día se añade una cuarta
 *   exportación, la cuenta cambia y la hoja vuelve a estar sobre la mesa. Lo
 *   que este guardián fija es que la decisión se tomó con números delante.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { exportarPacienteAFhir } from '@/lib/fhir-export'

const EXPEDIENTE = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/expediente/[patientId]/page.tsx'), 'utf8',
)

/** Sin comentarios: esta cabecera y la del código CITAN las etiquetas viejas. */
const sinComentarios = (s: string) => s
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const CODIGO = sinComentarios(EXPEDIENTE)

describe('RTC-21 — exportar dice el trabajo, no el formato', () => {
  it('1 · el control nombra lo que hace', () => {
    expect(CODIGO).toContain('Enviar a otro sistema')
    // La etiqueta ya no es la sigla a secas.
    expect(CODIGO).not.toMatch(/<Upload size=\{15\} \/> FHIR\b/)
  })

  it('2 · pero la sigla SIGUE ahí, en segunda línea: otro hospital la pide por su nombre', () => {
    /**
     * Borrarla sería peor que exhibirla. Si el médico no puede encontrar «el
     * FHIR» que le pidieron, la pantalla le ha escondido el trabajo por
     * higiene de lenguaje.
     */
    expect(CODIGO).toMatch(/>FHIR R4</)
  })

  it('3 · la diferencia entre los dos archivos se dice ANTES de descargar', () => {
    // Vivía en un comentario y en el aviso POSTERIOR: llegaba tarde.
    expect(CODIGO).toContain('«Expediente completo» lleva todo lo que esta aplicación guarda')
    // Y dice la verdad sobre los borradores (REG-313), no lo contrario.
    expect(CODIGO).toMatch(/en borrador\s*\n?\s*también viajan/)
  })

  it('4 · una descarga, un aviso', () => {
    /**
     * Se contaban DOS `toast(` dentro del manejador de esta exportación,
     * diciendo lo mismo dos veces. El corte del bloque va del cierre del
     * manejador de «Expediente completo» al final de la sección.
     */
    const desde = CODIGO.indexOf('exportarPacienteAFhir')
    const hasta = CODIGO.indexOf('</section>', desde)
    expect(desde, 'no se encontró el manejador de la exportación estándar').toBeGreaterThan(-1)
    const bloque = CODIGO.slice(desde, hasta)
    expect(bloque.match(/\btoast\(/g)?.length ?? 0).toBe(1)
  })

  it('5 · quien lo oye con voz escucha una frase, no dos pegadas', () => {
    /**
     * Defecto que encontró el propio arnés DESPUÉS del cambio: las dos líneas
     * del botón se concatenaban sin espacio y el nombre accesible salía
     * «Enviar a otro sistemaFHIR R4». El texto en dos renglones es para el
     * ojo; el oído necesita que alguien decida dónde acaba la frase.
     */
    expect(CODIGO).toContain('aria-label="Enviar a otro sistema — archivo FHIR R4"')
  })

  it('6 · REG-313 · lo que la pantalla PROMETE es lo que el exportador HACE', () => {
    /**
     * ── EL DEFECTO MÁS CARO DE ESTA REBANADA, Y NO ERA DE DISEÑO ──────────
     *
     * El manejador lanzaba dos avisos que se contradecían sobre el MISMO
     * archivo: uno decía que las notas en borrador iban «marcadas como
     * preliminares» y el otro que «NO van en FHIR — usa Expediente completo».
     * El falso era el segundo, y por ser el último en pintarse era el que se
     * leía.
     *
     * El médico creía que el archivo que acababa de mandar a otra institución
     * no llevaba nada sin firmar. Llevaba.
     *
     * Este caso ata los dos lados —la promesa de la pantalla y la conducta
     * del exportador— para que no puedan volver a divergir. Es la regla «el
     * dato tiene que LLEGAR» aplicada al revés: aquí el dato llega, y lo que
     * fallaba era el cartel que decía que no.
     */
    const nota = (id: string, estado: string) => ({
      id, estado, tipo: 'consulta',
      fechaConsulta: '2026-08-04T10:00:00.000Z',
      metadata: { id, fechaCreacion: '2026-08-04T10:00:00.000Z', medicoId: 'm1' },
      secciones: [{ key: 'padecimiento', label: 'Padecimiento actual', value: 'Texto sintético.' }],
    })
    const bundle = exportarPacienteAFhir({
      paciente: { id: 'p1', nombre: 'Paciente Sintético', edad: 40, sexo: 'M', updatedAt: '2026-08-04T10:00:00.000Z' } as never,
      notas: [nota('n1', 'firmada'), nota('n2', 'borrador')] as never,
      config: null,
    })
    const composiciones = bundle.entry
      .filter(e => e.resource.resourceType === 'Composition')
      .map(e => (e.resource as { status?: string }).status)

    // El exportador SÍ manda el borrador, y lo manda como preliminar.
    expect(composiciones).toContain('preliminary')

    // Y por eso la pantalla no puede decir que se queda fuera.
    expect(CODIGO, 'la pantalla promete una exclusión que el exportador no hace')
      .not.toMatch(/NO van en (FHIR|este formato)/)
    expect(CODIGO).toMatch(/marcadas como preliminares/)
  })

  it('7 · y ese aviso sigue declarando qué pasa con lo que no está firmado', () => {
    /**
     * Quitar el aviso duplicado no puede costar el dato. Un archivo con huecos
     * que nadie señala se entrega creyendo que está completo — la regla 4 de
     * seguridad clínica dicha en lenguaje de exportación.
     */
    expect(CODIGO).toMatch(/en borrador, que viajan marcadas como preliminares/)
    expect(CODIGO).toContain('resumenNotasExportadas')
  })
})
