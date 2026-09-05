/**
 * LOS MOTORES LLEGAN AL MÉDICO — REG-255.
 *
 * ── POR QUÉ HACÍA FALTA UN INSTRUMENTO ──────────────────────────────────────
 *
 * La familia de defectos más grande de este repositorio, con diferencia, es
 * **«escrito, probado y sin conectar»**: 21 de 102 REG. El módulo existe, tiene
 * pruebas, está bien, y **no corre** donde el médico pasa.
 *
 * Los veintiuno se encontraron **de uno en uno, por casualidad**: leyendo otra
 * cosa, o porque un equipo rojo tropezó con ello.
 *
 *   · `diasDeDuracion()` sabía que «14 editas» no era una duración (REG-238)
 *   · `rastrearNota()` tenía corpus oro y la pantalla usaba media función (239)
 *   · `tareaDeResultado()` no la llamaba nadie: el bucle de laboratorio **nunca
 *     empezaba** (REG-252)
 *
 * Encontrarlos por suerte no escala. Esto los cuenta.
 *
 * ── CÓMO ME EQUIVOQUÉ AL PRIMER INTENTO ─────────────────────────────────────
 *
 * La primera versión del medidor preguntaba «¿lo usa algún archivo que no sea el
 * suyo?». Dio **152 huérfanas de 771** — y la primera que fui a reparar, por
 * parecer la más peligrosa, era **falsa**:
 *
 *     crossResistenciaFQ   (EUCAST T13, cross-resistencia de fluoroquinolonas)
 *
 * La llama `analizarSeguridad`, en el mismo archivo, y ésa sí la llama el motor.
 * Era un ayudante interno, no un motor desconectado.
 *
 * **Un medidor que grita 152 cuando hay 50 enseña a ignorarlo** — que es el
 * mismo fallo que se repara en los avisos clínicos. Y casi me hace «reparar»
 * algo que funcionaba, en el módulo de antibiogramas, que es el que más le
 * importa al médico dueño.
 *
 * ── LO QUE ESTE GUARDIÁN HACE, Y LO QUE NO ──────────────────────────────────
 *
 * **No exige cero.** Un símbolo sin llamadores puede ser API legítima. Lo que
 * hace es congelar la cuenta: **sólo puede bajar**. Un motor clínico nuevo que
 * nazca sin conectar pone esto en rojo el mismo día, en vez de esperar a que
 * alguien tropiece con él dentro de seis meses.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const RAIZ = process.cwd()

function medir(): {
  total: number
  huerfanas: string[]
  /** ≤3 líneas sobre algo que sí corre: comodidad, no defecto (REG-260). */
  envoltorios: string[]
  /** Los que merecen mirarse uno a uno. */
  conCuerpo: string[]
  inalcanzables: string[]
} {
  const out = execSync('node scripts/calidad/motores-conectados.mjs --json', {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  })
  return JSON.parse(out)
}

/**
 * Lo medido el 8-ago-2026. **Sólo puede bajar.**
 *
 * No es una meta de cero: es el tope de hoy. Cada iteración del loop puede
 * quitar una o dos, y ninguna puede añadir.
 */
/**
 * `huerfanasMax` sube a 39 con `leerConsulta` (TR-VOZ), y sube CON SU NOMBRE en
 * `docs/quality/MOTORES-SIN-CONECTAR.md`: mide una transcripción contra su gold,
 * y en consulta no hay gold. Es evaluación —misma categoría que
 * `correrBenchmark`— y su consumidor es `scripts/medir-wer-limpio.ts`.
 */
/**
 * ── 39 → 46 EL 4-sep-2026, Y NO PORQUE CRECIERA LA DEUDA ────────────────────
 *
 * Subir un trinquete es lo que este repositorio no hace. Aquí se sube porque
 * **cambió el instrumento, no el árbol**: hasta ese día `motores-conectados.mjs`
 * contaba las apariciones del símbolo sobre el texto CRUDO, así que **nombrar un
 * motor en un comentario lo daba por conectado**. Siete motores llevaban tapados
 * por eso.
 *
 * Se descubrió documentando el motor de corrección: bastó mencionarlo en su
 * propio JSDoc para que desapareciera del barrido. Un instrumento al que se le
 * tapa la boca escribiendo su nombre en prosa — y con el efecto exactamente al
 * revés del deseado: un motor sin conectar dejaba de contarse **justo cuando
 * alguien se molestaba en documentarlo**.
 *
 * Bajar el número deshaciendo el arreglo sería volver a esconderlos. El número
 * viejo era más bonito y más falso.
 *
 * De los siete, dos tienen cuerpo real y están declarados uno a uno en
 * `MOTORES-SIN-CONECTAR.md` —`masGrave` y `camposQueRequierenRevision`—, los dos
 * como huecos reales abiertos, no como excusas.
 */
const TOPE = { huerfanasMax: 46, totalMin: 771, inalcanzablesMax: 8 }
/* 50 → 48 → 44 el 8-ago-2026:
     · REG-256, la bandeja de alertas del episodio (2)
     · REG-257, CAM-ICU y tres motores POCUS del panel de UCI (4)
     · REG-258, el oxígeno con cifras y sin declarar (1)
     · REG-259, lo que el texto de la IA OMITE del motor (1)
     · REG-261, los ingresos hospitalarios en el expediente (1)
     · REG-262, el resumen de problemas y medicación en el expediente (2)
     · REG-264, el pase de UCI dictado se reparte por aparatos (1)
   Cada iteración del loop cierra una o dos y baja este número. */

describe('el trinquete de conexión', () => {
  const m = medir()

  it('no aparecen motores clínicos nuevos sin conectar', () => {
    expect(
      m.huerfanas.length,
      `Subió de ${TOPE.huerfanasMax} a ${m.huerfanas.length}. Las nuevas son motores ` +
      `escritos que NO corren en el camino del médico:\n  ` +
      m.huerfanas.slice(0, 10).join('\n  '),
    ).toBeLessThanOrEqual(TOPE.huerfanasMax)
  })

  it('EL CASO: el antibiograma NO sale acusado de no llegar al médico', () => {
    /**
     * Prueba de COMPORTAMIENTO, no de texto fuente: es la que de verdad falla
     * si el recorrido vuelve a romperse, sea por donde sea.
     *
     * La cadena real, comprobada a mano el 5-sep-2026:
     *   app/(dashboard)/antibiograma/page.tsx
     *     → '@/lib/expediente/antibiograma' (index.ts)
     *     → export … from './motor'
     *     → import { analizarSeguridad } from './seguridad'
     *   y `analizarSeguridad` llama a `fenotiposExcepcionales` y a
     *   `crossResistenciaFQ` en las líneas 90-91 de ese archivo.
     *
     * Con el medidor roto, esos dos aparecían en `inalcanzables`. El módulo de
     * antibiogramas es el que más le importa al médico dueño; que el
     * instrumento lo diera por muerto es justo el error que la cabecera de este
     * archivo cuenta que casi le hace «reparar» algo que funcionaba.
     */
    expect(
      m.inalcanzables.filter(x => x.includes('/antibiograma/')),
      'el módulo de antibiogramas vuelve a salir como inalcanzable',
    ).toEqual([])
  })

  it('los inalcanzables tampoco suben', () => {
    /**
     * Este tercer cubo no tenía trinquete: se podía llenar sin que nada se
     * pusiera rojo. Se congela ahora que el medidor dice la verdad — antes
     * habría congelado ocho acusaciones falsas.
     */
    expect(
      m.inalcanzables.length,
      `Subió de ${TOPE.inalcanzablesMax} a ${m.inalcanzables.length}:\n  ` +
      m.inalcanzables.slice(0, 10).join('\n  '),
    ).toBeLessThanOrEqual(TOPE.inalcanzablesMax)
  })

  it('el barrido no encoge sin avisar', () => {
    /**
     * Si el total baja, el tope se vuelve más fácil sin que nada mejore — la
     * forma más limpia de pasar un trinquete sin tocar el producto.
     */
    expect(m.total, 'el barrido cubre menos que antes').toBeGreaterThanOrEqual(TOPE.totalMin)
  })
}, 300_000)

describe('el instrumento no repite el error que ya cometió', () => {
  const s = readFileSync(join(RAIZ, 'scripts/calidad/motores-conectados.mjs'), 'utf8')

  it('cuenta el uso DENTRO del propio archivo', () => {
    /**
     * Éste es el arreglo del falso positivo: `crossResistenciaFQ` la llama su
     * vecina de archivo, y la primera versión no lo veía.
     */
    expect(s).toMatch(/const enElSuyo = \(sinComentarios\(texto\)\.match\(re\) \?\? \[\]\)\.length > 1/)
  })

  it('y NO cuenta lo que sólo aparece en un comentario', () => {
    /**
     * El segundo error del mismo medidor, arreglado el 4-sep-2026: contaba
     * sobre el texto crudo, así que nombrar un motor en su propio JSDoc lo daba
     * por conectado. Siete estaban tapados así.
     *
     * Se vigila que el filtro exista Y que se use en las DOS comprobaciones —la
     * del propio archivo y la del resto del árbol—, porque dejar una sin filtrar
     * devolvería el agujero por la otra puerta.
     */
    expect(s, 'desapareció el filtro de comentarios').toMatch(/function sinComentarios/)
    expect(s, 'la búsqueda fuera del archivo volvió a contar comentarios')
      .toMatch(/test\(sinComentarios\(t\)\)/)
  })

  it('y queda escrito el caso que lo destapó', () => {
    /**
     * Sin el nombre concreto, el próximo que lea esto no sabrá por qué el
     * medidor es más complicado de lo que parece necesario.
     */
    expect(s).toMatch(/crossResistenciaFQ/)
    expect(s).toMatch(/Un medidor que grita 152 cuando hay muchas menos/)
  })

  it('y sigue esa cadena también por las importaciones RELATIVAS', () => {
    /**
     * TERCER falso positivo del mismo medidor, 5-sep-2026. `moduloDeImport`
     * sólo resolvía `@/…`; con `./x` devolvía null, así que el recorrido se
     * paraba en la primera importación relativa y daba por muerto todo lo de
     * debajo.
     *
     * Los dos errores anteriores contaban de MÁS y tapaban huérfanos. Éste
     * cuenta de MENOS: acusa a módulos que sí corren. Es el más caro, porque
     * denunciar en falso enseña a ignorar la denuncia.
     */
    expect(s, 'volvió a ignorar las importaciones relativas')
      .toMatch(/spec\.startsWith\('\.'\)/)
    expect(s, 'sin dirname no se puede resolver una relativa').toMatch(/dirname/)
  })

  it('sigue la cadena de importaciones desde las pantallas', () => {
    /** Un módulo que ninguna pantalla alcanza no corre, por muy usado que esté. */
    expect(s).toMatch(/const alcanzables = new Set\(\)/)
    expect(s.replace(/\n/g, ' ')).toMatch(/src\/app\/.*src\/components\/.*src\/hooks\//)
  })

  it('sólo mira dominios clínicos, para que la señal no se ahogue', () => {
    /** En un `utils` genérico un símbolo sin llamadores es normal. */
    expect(s).toMatch(/const DOMINIOS = \[/)
    expect(s).toMatch(/'src\/lib\/seguridad'/)
    expect(s).not.toMatch(/'src\/lib\/utils'/)
  })
})

describe('el número significa algo: tres categorías (REG-260)', () => {
  const m = medir()

  it('el instrumento separa envoltorios de cuerpos reales', () => {
    /**
     * Decir «42 motores sin conectar» era inflar. 34 son envoltorios de ≤3
     * líneas sobre algo que sí corre — `sePuedeFirmar` es
     * `motivosParaNoFirmar().length === 0` —. No son defectos: son comodidad
     * que nadie usó.
     *
     * Un número que mezcla las dos cosas no sirve para decidir nada.
     */
    expect(m.envoltorios.length + m.conCuerpo.length).toBe(m.huerfanas.length)
    expect(m.envoltorios.length).toBeGreaterThan(m.conCuerpo.length)
  })

  it('los que tienen cuerpo real son POCOS y están nombrados', () => {
    /**
     * Subió a 6 con `leerConsulta` (TR-VOZ), y sube con su nombre puesto: mide
     * una transcripción contra su gold, y en una consulta de verdad no hay gold.
     * Es evaluación, no un motor del camino del médico — su consumidor es
     * `scripts/medir-wer-limpio.ts`. El documento de abajo lo obliga a estar
     * escrito, que es lo que impide que esta cuenta suba en silencio.
     */
    /* 6 → 8 el 4-sep-2026, por el mismo arreglo del instrumento: `masGrave` y
       `camposQueRequierenRevision` estaban tapados por menciones en
       comentarios. Los dos van con su nombre en el documento de abajo, y los
       dos declarados como huecos reales abiertos — no se explicaron como
       benignos ni se arreglaron de paso. */
    expect(m.conCuerpo.length).toBeLessThanOrEqual(8)
    const doc = readFileSync(join(RAIZ, 'docs/quality/MOTORES-SIN-CONECTAR.md'), 'utf8')
    for (const x of m.conCuerpo) expect(doc, `${x} no está en el documento`).toContain(x)
  })

  it('y el que estaba bloqueado en el DUEÑO ya no lo está — ahora falta cablearlo', () => {
    /**
     * `validarCorreccion` estuvo parado en el dueño, no en el código: quién
     * puede corregir un registro ya hecho, en qué ventana y si el motivo es
     * obligatorio es política de registro clínico con peso NOM-004, y elegir un
     * valor «razonable» y enterrarlo en una constante es exactamente lo que
     * este proyecto no hace.
     *
     * Lo decidió el 4-sep-2026 (D-026). Lo que queda es de otra naturaleza y no
     * se puede confundir con lo anterior: el motor **sigue sin llamador**.
     * Tener la política no enciende la función.
     *
     * Este caso vigila las dos mitades: que la decisión esté escrita donde se
     * lee, y que el hueco que queda siga declarado con su nombre.
     */
    const ev = readFileSync(join(RAIZ, 'src/lib/hospital/eventos.ts'), 'utf8')
    expect(ev).not.toMatch(/export const POLITICA_CORRECCION: PoliticaCorreccion \| null = null/)
    expect(ev, 'el hueco que queda tiene que seguir dicho').toMatch(/SIN_CABLEAR_CORRECCION/)
    const dec = readFileSync(join(RAIZ, 'agent-state/OWNER_DECISIONS_REQUIRED.md'), 'utf8')
    expect(dec).toMatch(/Política de correcciones a un registro ya hecho/)
    expect(dec, 'la cola del dueño no puede seguir pidiendo lo que ya contestó')
      .toMatch(/RESUELTA/)
  })
}, 300_000)

describe('lo que el instrumento encontró y hay que ir cerrando', () => {
  it('la lista vive en un sitio que se puede leer', () => {
    expect(existsSync(join(RAIZ, 'docs/quality/MOTORES-SIN-CONECTAR.md'))).toBe(true)
  })

  it('el documento distingue código muerto de probado-y-sin-conectar', () => {
    /**
     * No es lo mismo. `verificarIntegridad` no tiene ni prueba; `sePuedeFirmar`
     * sí la tiene y aun así no corre — ése es el defecto caro, porque el verde
     * de su prueba hace creer que está en marcha.
     */
    const doc = readFileSync(join(RAIZ, 'docs/quality/MOTORES-SIN-CONECTAR.md'), 'utf8')
    expect(doc).toMatch(/probad[ao]s? y sin conectar/i)
    expect(doc).toMatch(/sePuedeFirmar/)
    expect(doc).toMatch(/verificarIntegridad/)
  })
})
