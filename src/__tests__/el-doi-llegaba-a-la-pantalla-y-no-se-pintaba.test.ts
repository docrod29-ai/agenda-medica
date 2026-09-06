/**
 * GOLDEN — la identidad de la publicación llegaba al navegador y se pintaba «título · revista año».
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-398 dejó de tirar cuatro datos de identidad y los metió en el modelo. El
 * censo dejó apuntado que faltaba «pintarlo», y al medirlo contra el árbol
 * resultó ser la misma cola tres veces:
 *
 *  1. **El DOI en la consulta.** `/api/expediente/evidencia` devuelve los
 *     artículos ENTEROS —con `doi` y `revistaAbrev` dentro— y el `type ArtEv` de
 *     la pantalla declaraba cinco campos. Un campo que el tipo no declara no
 *     existe para el render: el dato viajaba, cruzaba la red y se tiraba en la
 *     puerta.
 *  2. **La disponibilidad del texto completo en el consultor.**
 *     `/api/consultor-evidencia` manda `pmcid` y `accesoAbierto`, que es lo
 *     único con lo que se puede distinguir «sólo hay resumen» de «hay texto
 *     completo y su licencia no deja copiarlo aquí». `interface Articulo` no los
 *     declaraba, así que las dos situaciones se pintaban como la primera.
 *  3. **La salvedad del diseño, de REG-401.** «Ensayo clínico» a secas puede no
 *     ser aleatorizado, y la ruta manda `tipoSalvedad` para poder decirlo. Su
 *     prueba comprobaba **que la ruta lo mandara**. Nadie comprobó que llegara a
 *     unos ojos, y no llegaba.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo `queFalta` de `WS-07.identidad-de-revista` contra el árbol antes de
 * construir nada, que es lo que este bucle hace desde que seis entradas del
 * censo resultaron estar desfasadas. El `queFalta` decía «la pantalla todavía no
 * enseña el DOI»; lo que no decía —y se vio al buscar por qué— es que **el dato
 * ya estaba en el cliente**. No faltaba traerlo.
 *
 * El caso 3 apareció de rebote, grepeando `tipoSalvedad`: dos apariciones en la
 * ruta, una en un test que comprueba la ruta, ninguna en una pantalla.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `.claude/rules/el-dato-tiene-que-llegar.md`, literal: *«una prueba de contrato
 * comprueba que el código DIGA lo acordado. No comprueba que el destinatario lo
 * ACEPTE»*. Un `interface` de pantalla es un destinatario que puede rechazar en
 * silencio, y TypeScript no avisa de un campo de más en el objeto que recibe.
 *
 * ── LA REGLA QUE ESTO HACE SEGURA ───────────────────────────────────────────
 *
 * **Ausente significa «no se sabe», nunca «no tiene».** Un artículo sin PMCID no
 * dice «no hay texto completo»: dice que nadie lo miró, o que no está en PMC. Y
 * un artículo CON PMCID y sin licencia permisiva tampoco dice «cerrado» — dice
 * que existe y que aquí no se puede copiar, que es una cosa que el médico puede
 * usar.
 *
 * Y una segunda: **un enlace roto es peor que no ofrecer enlace.** Un `doi.org`
 * con un DOI mal formado parece verificable y no lleva a ninguna parte; el
 * médico que lo pulsa aprende que las referencias de este producto no van a
 * ningún sitio.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No valida el DOI contra Crossref.** Comprueba su FORMA. Un DOI bien
 *   formado puede no existir, y saberlo necesita red y declarar el host.
 * · **No sabe si hay texto completo fuera de PMC.** Un artículo abierto en el
 *   sitio de su editorial sale `no_consta`, que es «no se miró».
 * · **No construye el catálogo NLM.** Empareja lo que la fuente ya dio junto; lo
 *   que nunca se vio emparejado se queda sin resolver a propósito.
 * · **No es una prueba de navegador.** Comprueba el tipo y el render en el
 *   fuente, no que el píxel salga. Eso es e2e.
 * · **No vigila los hosts de las PANTALLAS.** Declarar `doi.org` en
 *   `de-donde-se-baja.ts` hizo falta porque este módulo vive en
 *   `src/lib/evidencia`, que es lo que mira el escáner. Las dos pantallas
 *   llevaban enlazando `doi.org` desde REG-398 sin declararlo, porque
 *   `CAMINO_DE_EVIDENCIA` no incluye `src/app/(dashboard)`. Ampliarlo arrastraría
 *   todos los hosts de todas las pantallas y es otra decisión.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  claveDeRevista, catalogoDeAlias, mismaRevista,
  formaDelDoi, enlaceDoi, disponibilidadDeTextoCompleto,
  LO_QUE_NO_SE_SABE, POR_QUE_EL_CATALOGO_SE_OBSERVA,
} from '@/lib/evidencia/identidad-de-la-publicacion'

const leer = (r: string) => readFileSync(resolve(process.cwd(), r), 'utf8')
const CONSULTA = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
const CONSULTOR = leer('src/app/(dashboard)/consultor/page.tsx')
const RUTA_CONSULTOR = leer('src/app/api/consultor-evidencia/route.ts')

describe('la forma del DOI, que es sintaxis y no un hecho', () => {
  it('un DOI real pasa y se enlaza', () => {
    expect(formaDelDoi('10.1056/NEJMoa2034577')).toBe('valida')
    expect(enlaceDoi('10.1056/NEJMoa2034577')).toBe('https://doi.org/10.1056/NEJMoa2034577')
  })

  it('lo que no tiene la forma NO se enlaza — un doi.org roto parece verificable', () => {
    for (const roto of ['NEJMoa2034577', '10.abc/x', '10.1056/', '10.1056 / x', 'https://doi.org/10.1056/x']) {
      expect(formaDelDoi(roto), roto).toBe('malformada')
      expect(enlaceDoi(roto), roto).toBeNull()
    }
  })

  it('ausente y malformado son estados DISTINTOS: uno es «no lo dieron», el otro «lo dieron mal»', () => {
    expect(formaDelDoi(undefined)).toBe('ausente')
    expect(formaDelDoi('   ')).toBe('ausente')
    expect(formaDelDoi('10.x')).toBe('malformada')
  })

  it('el registrante lleva de 4 a 9 dígitos: tres no es un DOI', () => {
    expect(formaDelDoi('10.105/x')).toBe('malformada')
    expect(formaDelDoi('10.1056/x')).toBe('valida')
  })
})

describe('el texto completo: existir y poder reproducirse no son lo mismo', () => {
  it('sin PMCID no se afirma nada, y no se dice nada', () => {
    const d = disponibilidadDeTextoCompleto(undefined)
    expect(d.estado).toBe('no_consta')
    expect(d.origen).toBe('ninguno')
    /* Callado a propósito: «no hay texto completo» sobre un artículo que nadie
       miró sería dato de ausencia, y en doce fuentes sería además ruido. */
    expect(d.frase).toBe('')
  })

  it('CON PMCID y sin licencia permisiva: existe y no se puede copiar aquí — el estado que faltaba', () => {
    const d = disponibilidadDeTextoCompleto({ pmcid: 'PMC7188939' })
    expect(d.estado).toBe('existe_no_reproducible')
    expect(d.frase).toMatch(/licencia no permite reproducirlo/i)
  })

  it('tener PMCID NO se lee como acceso abierto', () => {
    expect(disponibilidadDeTextoCompleto({ pmcid: 'PMC1' }).estado).not.toBe('reproducible')
  })

  it('reproducible sólo cuando la licencia lo dijo', () => {
    expect(disponibilidadDeTextoCompleto({ pmcid: 'PMC1', accesoAbierto: true }).estado).toBe('reproducible')
  })

  it('`accesoAbierto: false` no inventa un cuarto estado: sigue existiendo en PMC', () => {
    expect(disponibilidadDeTextoCompleto({ pmcid: 'PMC1', accesoAbierto: false }).estado).toBe('existe_no_reproducible')
  })
})

describe('los alias de revista se observan de los pares que la fuente dio', () => {
  const CATALOGO = catalogoDeAlias([
    { revista: 'The New England Journal of Medicine', revistaAbrev: 'N Engl J Med' },
    { revista: 'Journal of the American Medical Association', revistaAbrev: 'JAMA' },
    { revista: 'Revista de Investigación Clínica', revistaAbrev: 'Rev Invest Clin' },
    { revista: 'The Lancet' },   // sin abreviatura: no enseña nada, no entra
  ])

  it('el nombre entero y la abreviatura del MISMO registro quedan emparejados', () => {
    expect(mismaRevista('N. Engl. J. Med.', 'The New England Journal of Medicine', CATALOGO)).toBe(true)
  })

  it('la puntuación y el artículo inicial no son datos', () => {
    expect(claveDeRevista('N. Engl. J. Med.')).toBe('n engl j med')
    expect(claveDeRevista('The Lancet')).toBe('lancet')
    expect(claveDeRevista('Revista de Investigación Clínica')).toBe('revista de investigacion clinica')
  })

  it('dos revistas distintas que SÍ están en el catálogo se declaran distintas', () => {
    expect(mismaRevista('N Engl J Med', 'JAMA', CATALOGO)).toBe(false)
  })

  it('lo que nunca se vio emparejado sale `undefined`, no `false`', () => {
    /* `false` afirmaría que son distintas. Nadie lo comprobó. */
    expect(mismaRevista('Am J Med', 'Am J Med Sci', CATALOGO)).toBeUndefined()
  })

  it('un registro con una sola forma no entra en el catálogo', () => {
    expect(CATALOGO.has(claveDeRevista('The Lancet'))).toBe(false)
  })

  it('no se adivina por parecido, y el módulo dice por qué', () => {
    expect(POR_QUE_EL_CATALOGO_SE_OBSERVA).toMatch(/no se adivina|nunca se vio emparejado/i)
    expect(LO_QUE_NO_SE_SABE.join(' ')).toMatch(/Crossref/)
    expect(LO_QUE_NO_SE_SABE.join(' ')).toMatch(/fuera de PMC/i)
  })
})

describe('y ahora LLEGA: los tipos de pantalla ya no borran lo que la ruta manda', () => {
  it('la consulta declara el DOI y la abreviatura en `ArtEv`', () => {
    const t = CONSULTA.match(/type ArtEv = \{[^}]*\}/)?.[0] ?? ''
    expect(t).toContain('doi?: string')
    expect(t).toContain('revistaAbrev?: string')
  })

  it('y los pinta, con enlace sólo si la forma cuadra', () => {
    expect(CONSULTA).toContain("import { enlaceDoi } from '@/lib/evidencia/identidad-de-la-publicacion'")
    expect(CONSULTA).toMatch(/enlaceDoi\(a\.doi\)/)
    expect(CONSULTA).toMatch(/DOI: \{a\.doi\}/)
    expect(CONSULTA).toMatch(/\{a\.revistaAbrev \|\| a\.revista\}/)
  })

  it('el consultor declara los cuatro campos que la ruta compone', () => {
    const t = CONSULTOR.match(/interface Articulo \{[\s\S]*?\n\}/)?.[0] ?? ''
    for (const campo of ['revistaAbrev?', 'tipoSalvedad?', 'pmcid?', 'accesoAbierto?']) {
      expect(t, campo).toContain(campo)
    }
  })

  it('la salvedad de REG-401 se pinta, no sólo se manda', () => {
    /* La prueba vieja comprobaba esta línea de la RUTA… */
    expect(RUTA_CONSULTOR).toMatch(/tipoSalvedad: a\.tipo \?/)
    /**
     * …y ésta es la mitad que faltaba: que alguien la lea.
     *
     * Se exige TEXTO VISIBLE y no un `title=`. La primera versión de este
     * guardián decía `/\{a\.tipoSalvedad\}/` y pasaba con sólo el tooltip del
     * badge — se vio al probarlo al revés: quitar la línea visible no lo tiraba.
     * Un aviso que sólo existe al pasar el ratón no llega, y en móvil no existe.
     */
    expect(CONSULTOR).toMatch(/>\{a\.tipoSalvedad\}<\/div>/)
  })

  it('el consultor dice el estado del texto completo', () => {
    expect(CONSULTOR).toContain('disponibilidadDeTextoCompleto')
    expect(CONSULTOR).toMatch(/\{disp\.frase && /)
  })
})
