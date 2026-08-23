/**
 * PACIENTES QUE NO EXISTEN — generador de fixtures.
 *
 * ── CERO PACIENTES REALES ────────────────────────────────────────────────────
 *
 * `data-privacy.md` no admite matices: ni en pruebas, ni en fixtures, ni en
 * corpus de evaluación, ni en ejemplos de documentación. Todo lo que sale de
 * aquí se compone de listas cerradas de nombres y apellidos comunes combinados
 * por índice, y los teléfonos viven en el rango `555…`, que es el reservado para
 * ficción.
 *
 * Que un nombre generado coincida con el de alguien real es inevitable —
 * «María López García» existe muchas veces— y también es inofensivo: lo que
 * convierte un dato en PHI es que describa a una persona concreta, y estas
 * combinaciones no salen de ningún expediente.
 *
 * ── POR QUÉ VIVE EN `src/lib` Y NO EN `scripts/` ─────────────────────────────
 *
 * Porque lo usan los dos: la suite de pruebas y el arnés de escala. Tenerlo dos
 * veces significaría que el arnés mide sobre unos datos y las pruebas garantizan
 * sobre otros, y la primera vez que discrepen nadie se va a enterar.
 *
 * ── DETERMINISTA ─────────────────────────────────────────────────────────────
 *
 * Sin `Math.random`. La semilla entra por parámetro y el generador es un
 * congruencial lineal de dos líneas: la misma semilla da el mismo archivo, byte
 * por byte, en cualquier máquina. Un arnés de escala que genera datos distintos
 * en cada corrida no mide dos veces la misma cosa.
 */
import { celdaSegura } from '@/lib/csv-seguro'

/* ═══════════════════════ EL AZAR REPRODUCIBLE ═══════════════════════ */

/**
 * Congruencial lineal (el de Numerical Recipes).
 *
 * No sirve para criptografía y no hace falta que sirva: hace falta que dé la
 * misma secuencia siempre. `Math.random` no puede prometer eso.
 */
function generador(semilla: number): () => number {
  let s = semilla >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/* ═══════════════════════ VOCABULARIO INVENTADO ═══════════════════════ */

const NOMBRES = [
  'María', 'José', 'Guadalupe', 'Juan', 'Ana', 'Luis', 'Rosa', 'Carlos',
  'Elena', 'Miguel', 'Sofía', 'Diego', 'Lucía', 'Javier', 'Carmen', 'Andrés',
]
const APELLIDOS = [
  'Hernández', 'García', 'Martínez', 'López', 'Rodríguez', 'Pérez', 'Sánchez',
  'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Muñoz', 'Peña', 'Vázquez', 'Reyes', 'Ríos',
]
const SEGUROS = ['IMSS', 'ISSSTE', 'GNP', 'AXA', 'MetLife', '']

export interface FilaSintetica {
  readonly nombre: string
  readonly telefono: string
  readonly email: string
  readonly fechaNacimiento: string
  readonly sexo: string
  readonly seguro: string
  readonly notas: string
}

/** Un paciente que no existe, derivado sólo de `i` y la semilla. */
export function pacienteSintetico(i: number, aleatorio: () => number): FilaSintetica {
  const n = NOMBRES[Math.floor(aleatorio() * NOMBRES.length)]
  const a1 = APELLIDOS[Math.floor(aleatorio() * APELLIDOS.length)]
  const a2 = APELLIDOS[Math.floor(aleatorio() * APELLIDOS.length)]
  const anio = 1940 + Math.floor(aleatorio() * 80)
  const mes = 1 + Math.floor(aleatorio() * 12)
  // Día > 12 SIEMPRE: así una fecha `dd/mm` se desambigua sola y el generador
  // base no mete ambigüedad sin querer. La ambigüedad se inyecta a propósito
  // en `DEFECTOS`, no por accidente aquí.
  const dia = 13 + Math.floor(aleatorio() * 15)
  const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  return {
    nombre: `${n} ${a1} ${a2}`,
    telefono: `555${String(1000000 + i).slice(-7)}`,
    email: `paciente${i}@ejemplo.invalid`,
    fechaNacimiento: iso,
    sexo: aleatorio() < 0.5 ? 'M' : 'F',
    seguro: SEGUROS[Math.floor(aleatorio() * SEGUROS.length)],
    notas: `nota sintética ${i}`,
  }
}

/* ═══════════════════════ LOS DEFECTOS ═══════════════════════ */

/**
 * Los males que trae un archivo REAL.
 *
 * Un fixture de 50 000 filas perfectas mide velocidad y no mide nada más. Los
 * archivos que llegan de verdad traen todo esto a la vez, y es justamente lo
 * que decide si la importación pierde datos.
 *
 * Cada defecto declara cuál es su desenlace ESPERADO, para que el arnés pueda
 * comprobar que el pipeline lo trata como debe en vez de sólo no reventar.
 */
export const DEFECTOS = [
  'perfecta',
  'sin-nombre',
  'sin-telefono',
  'fecha-ambigua',
  'fecha-invalida',
  'sexo-desconocido',
  'duplicado-exacto',
  'duplicado-ambiguo',
  'acentos-y-unicode',
  'campo-larguisimo',
  'inyeccion-de-formula',
  'encabezado-en-ingles',
] as const

export type Defecto = (typeof DEFECTOS)[number]

export interface OpcionesFixture {
  readonly filas: number
  readonly semilla?: number
  /** Proporción de filas con algún defecto. 0 = todas perfectas. */
  readonly proporcionDefectuosa?: number
  /** Encabezados en inglés en vez de español. */
  readonly ingles?: boolean
  /** Cierra una comilla de menos en una fila, para probar el CSV malformado. */
  readonly malformado?: boolean
}

const CABECERA_ES = ['Nombre', 'Teléfono', 'Email', 'Fecha de nacimiento', 'Sexo', 'Seguro', 'Notas']
const CABECERA_EN = ['Name', 'Phone', 'Email', 'DOB', 'Sex', 'Insurance', 'Notes']

/**
 * Genera un CSV sintético con los defectos repartidos de forma determinista.
 *
 * Devuelve también el CENSO ESPERADO: cuántas filas de cada defecto lleva. Sin
 * eso, el arnés sólo puede comprobar que el proceso termina; con eso puede
 * comprobar que cada fila acabó donde tenía que acabar, que es lo que de verdad
 * hace falta saber.
 */
export function generarCsv(o: OpcionesFixture): {
  readonly csv: string
  readonly filasDeclaradas: number
  readonly censo: Readonly<Record<Defecto, number>>
} {
  const aleatorio = generador(o.semilla ?? 20260823)
  const proporcion = o.proporcionDefectuosa ?? 0
  const cabecera = o.ingles ? CABECERA_EN : CABECERA_ES

  const censo = Object.fromEntries(DEFECTOS.map(d => [d, 0])) as Record<Defecto, number>
  const lineas: string[] = [cabecera.join(',')]
  /** Se guarda la primera fila para poder repetirla como duplicado exacto. */
  let primera: FilaSintetica | null = null

  for (let i = 0; i < o.filas; i++) {
    const p = pacienteSintetico(i, aleatorio)
    if (!primera) primera = p

    // La elección del defecto es determinista: depende de `i`, no del azar, para
    // que el censo sea exacto y no aproximado.
    const defectuosa = proporcion > 0 && i > 0 && i % Math.max(1, Math.round(1 / proporcion)) === 0
    const defecto: Defecto = !defectuosa
      ? 'perfecta'
      : DEFECTOS[1 + (i % (DEFECTOS.length - 3))]   // los tres últimos son del archivo, no de la fila

    censo[defecto]++
    lineas.push(filaComoCsv(p, defecto, primera))
  }

  if (o.ingles) censo['encabezado-en-ingles'] = o.filas
  if (o.malformado) {
    // Una comilla sin cerrar. Se pone al FINAL para que no se coma el resto del
    // archivo: lo que se quiere probar es que una fila rota no aborta las buenas.
    lineas.push('"Comilla sin cerrar,555000000,x@ejemplo.invalid,1980-01-15,M,,nota')
  }

  return {
    csv: lineas.join('\n'),
    filasDeclaradas: lineas.length - 1,
    censo,
  }
}

function filaComoCsv(p: FilaSintetica, defecto: Defecto, primera: FilaSintetica): string {
  let f: FilaSintetica = p
  switch (defecto) {
    case 'sin-nombre': f = { ...p, nombre: '' }; break
    case 'sin-telefono': f = { ...p, telefono: '' }; break
    // 03/04 se lee como 3-abr o 4-mar: las dos valen y no se adivina.
    case 'fecha-ambigua': f = { ...p, fechaNacimiento: '03/04/25' }; break
    case 'fecha-invalida': f = { ...p, fechaNacimiento: '31/02/1980' }; break
    case 'sexo-desconocido': f = { ...p, sexo: '1' }; break
    case 'duplicado-exacto': f = { ...primera }; break
    // Mismo nombre, sin nada que lo separe ni que lo confirme: a revisión.
    case 'duplicado-ambiguo': f = { ...p, nombre: primera.nombre, fechaNacimiento: '', telefono: '' }; break
    case 'acentos-y-unicode': f = { ...p, nombre: 'Ñuño Peña Ibáñez', notas: 'acentos áéíóú · símbolos ±≤≥ · 中文' }; break
    case 'campo-larguisimo': f = { ...p, notas: 'x'.repeat(30_000) }; break
    // Lo que `csv-seguro.ts` neutraliza al exportar. Al importar no puede acabar
    // siendo una fórmula ni perder el apóstrofo que le pusimos nosotros.
    case 'inyeccion-de-formula': f = { ...p, nombre: `=HYPERLINK("http://x.invalid")`, notas: '@SUM(A1:A9)' }; break
    default: break
  }
  return [f.nombre, f.telefono, f.email, f.fechaNacimiento, f.sexo, f.seguro, f.notas]
    .map(celdaSegura)
    .join(',')
}

/**
 * Un padrón sintético YA EXISTENTE, para probar contra un consultorio con datos.
 *
 * Se generan a partir de las MISMAS semillas que el CSV para que un porcentaje
 * conocido de las filas del archivo choque con el padrón: sin solapamiento, el
 * emparejamiento no se ejercita y el arnés mediría el caso fácil.
 */
export function padronSintetico(cuantos: number, semilla = 20260823): {
  readonly id: string
  readonly nombre: string
  readonly telefono: string
  readonly fechaNacimiento: string
}[] {
  const aleatorio = generador(semilla)
  return Array.from({ length: cuantos }, (_, i) => {
    const p = pacienteSintetico(i, aleatorio)
    return { id: `existente_${i}`, nombre: p.nombre, telefono: p.telefono, fechaNacimiento: p.fechaNacimiento }
  })
}
