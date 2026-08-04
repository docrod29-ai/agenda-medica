/**
 * GUARDIÁN — un documento de auditoría que cita un archivo inexistente **no
 * falla: certifica**.
 *
 * ── LA LECCIÓN, QUE YA SE PAGÓ UNA VEZ ───────────────────────────────────────
 *
 * En la v1020 (REG-131) el registro clínico nombraba **cinco puertas de entrada
 * que no estaban en ningún archivo de su motor**. No rompía nada: nadie ejecuta
 * un documento. Así que un nombre mal escrito, un archivo movido o un motor
 * partido en dos se quedan ahí años y el papel sigue pareciendo exacto — y es
 * justo el papel que lee un auditor.
 *
 * La auditoría de voz (`docs/voice/VOICE-001-auditoria.md`) es un documento de
 * ese tipo: cita rutas de módulos, de pruebas, de scripts y del informe medido
 * para respaldar cada afirmación. Si una de esas rutas deja de existir, la
 * afirmación se queda sin respaldo **sin que nada avise**.
 *
 * ── LO QUE ESTO COMPRUEBA, Y LO QUE NO ───────────────────────────────────────
 *
 * Comprueba que **cada ruta citada exista**. No comprueba que lo que dice el
 * documento sobre ella sea cierto: eso lo tiene que verificar una persona
 * abriendo el archivo, y así se hizo el 4-ago-2026. Un guardián mecánico no
 * puede leer una afirmación clínica — puede impedir que la afirmación apunte al
 * vacío.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'docs', 'voice')
const docs = readdirSync(DIR).filter(f => f.endsWith('.md'))

/**
 * Qué cuenta como «una ruta citada».
 *
 * Sólo lo que va entre acentos graves y **parece de este repositorio**: empieza
 * por un directorio conocido o termina en una extensión de código. Así no se
 * cazan nombres de campos (`speaker_options`), valores (`'medical-v1'`) ni
 * rutas de otros sistemas.
 */
const RUTA = /`([A-Za-z0-9_./[\]-]+\.(?:ts|tsx|mjs|json|md))`/g

const RAICES = ['src/', 'scripts/', 'docs/', 'public/', 'app/', 'lib/', 'types/', 'hooks/']

/**
 * Muchas citas son relativas al sitio del que hablan («`uci/benchmark-metricas.ts`»,
 * «`types/expediente.ts`»). Se prueban unos pocos prefijos antes de darla por
 * inexistente: la alternativa sería exigir rutas completas en la prosa, que la
 * volvería ilegible para quien la tiene que leer.
 */
const PREFIJOS = ['', 'src/', 'src/lib/', 'src/app/', 'src/app/api/', 'src/app/(dashboard)/', 'src/__tests__/', 'docs/', 'docs/voice/']

/**
 * Y los nombres sueltos, sin carpeta («`pipeline.ts`», «`route.ts`»).
 *
 * Son los MÁS fáciles de dejar podridos —no dicen dónde viven, así que nadie
 * nota que se movieron— y quedarían fuera si sólo se comprobaran las rutas con
 * barra. Basta con que exista un archivo con ese nombre en el código: el
 * documento habla de él por su nombre, no por su ruta.
 */
const basenames = (() => {
  const out = new Set<string>()
  const anda = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
      if (e.isDirectory()) anda(join(dir, e.name))
      else out.add(e.name)
    }
  }
  for (const raiz of ['src', 'scripts', 'docs']) {
    const d = join(process.cwd(), raiz)
    if (existsSync(d)) anda(d)
  }
  return out
})()

const existeAlguno = (ruta: string) =>
  PREFIJOS.some(p => existsSync(join(process.cwd(), p + ruta)))
  || (!ruta.includes('/') && basenames.has(ruta))

describe('LAS RUTAS QUE CITA LA AUDITORÍA DE VOZ EXISTEN', () => {
  it('hay documentos que revisar', () => {
    // Si alguien renombra la carpeta, esta prueba no puede pasar en vacío.
    expect(docs.length).toBeGreaterThan(0)
  })

  for (const doc of docs) {
    it(`${doc} no cita ningún archivo inexistente`, () => {
      const texto = readFileSync(join(DIR, doc), 'utf8')
      const citadas = [...texto.matchAll(RUTA)].map(m => m[1])
      const deEsteRepo = citadas.filter(r => RAICES.some(x => r.startsWith(x)) || r.includes('/') || basenames.has(r) || /\.(ts|tsx|mjs)$/.test(r))
      const perdidas = [...new Set(deEsteRepo)].filter(r => !existeAlguno(r))
      expect(perdidas, `rutas citadas que no existen en ${doc}`).toEqual([])
    })
  }
})

describe('Y LA TABLA DE FALLOS DICE CUÁNDO SE VERIFICÓ', () => {
  const voice = readFileSync(join(DIR, 'VOICE-001-auditoria.md'), 'utf8')

  it('la sección B.2 lleva fecha de re-verificación, no un «ABIERTOS» perpetuo', () => {
    /**
     * La tabla se escribió el 2-ago y siguió diciendo «ABIERTOS» durante veinte
     * versiones que los fueron cerrando. Una lista de pendientes sin fecha se
     * lee como si fuera de hoy.
     */
    expect(voice).toMatch(/RE-VERIFICADOS EL \d+-[A-Za-z]{3}-\d{4} CONTRA EL CÓDIGO/)
  })

  it('y declara que lo no comprobado no se movió', () => {
    expect(voice).toMatch(/Lo que no pude comprobar yo mismo no se movió/)
  })
})
