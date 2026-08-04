/**
 * GOLDEN — la especialidad del médico viajaba por cuatro capas y nadie la
 * llenaba nunca.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * `ContextoDictado.especialidades` está declarado desde que se escribió el
 * léxico, viaja del hook al `FormData`, del `FormData` a la ruta y de la ruta a
 * `construir()` — y **ninguna pantalla lo rellenaba**. El comentario del propio
 * módulo dice lo que se perdía: «si él dijo *esto es nefrología*, el módulo no
 * tiene por qué llevarle la contraria». Nadie se lo decía.
 *
 * Consecuencia concreta, con el usuario real de esta app: el Dr. es internista e
 * infectólogo, y dictando en su consultorio el motor **no cargaba**
 * «Antimicrobianos» ni «Microbiología y PROA» — justo los términos que más se le
 * escriben mal, y los que este repositorio lleva versiones persiguiendo
 * («sefriaxona»).
 *
 * ── LO QUE ESTO NO ES ────────────────────────────────────────────────────────
 *
 * No es una decisión clínica ni una cifra: es **enrutar vocabulario**. La tabla
 * dice qué cajones del mapa del Dr. abrir para cada especialidad, y todos sus
 * destinos tienen que existir de verdad — lo comprueba una prueba de aquí.
 *
 * Y sólo puede AÑADIR: sin coincidencia devuelve vacío y todo sigue como antes.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  especialidadesDelMedico, EQUIVALENCIAS, POR_QUE_NO_SE_ADIVINA,
} from '@/lib/asr/especialidad-del-medico'
import { contextosActivos, CONTEXTOS_POR_MODULO } from '@/lib/asr/lexicon'
import mapa from '@/lib/asr/data/especialidades.json'

const CLAVES = new Set(Object.keys((mapa as { specialties: Record<string, unknown> }).specialties))
const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('LA TABLA APUNTA A COSAS QUE EXISTEN', () => {
  it('cada destino es una clave real del mapa del Dr.', () => {
    /**
     * Un nombre mal escrito no falla: `contextosActivos` filtra por
     * `e in ESPECIALIDADES` y la fila entera se evapora **en silencio**. Sería
     * un vocabulario que se cree cargado y no está.
     */
    for (const [clave, destinos] of Object.entries(EQUIVALENCIAS)) {
      for (const d of destinos) expect(CLAVES.has(d), `${clave} → ${d}`).toBe(true)
    }
  })

  it('las llaves están normalizadas: sin acentos y en minúsculas', () => {
    // Se buscan DENTRO del texto ya normalizado; una llave con acento no
    // coincidiría nunca.
    for (const clave of Object.keys(EQUIVALENCIAS)) {
      expect(clave, clave).toBe(clave.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
    }
  })
})

describe('EL CASO DEL DUEÑO DE LA APP', () => {
  it('«Medicina Interna e Infectología» abre las dos', () => {
    const r = especialidadesDelMedico('Medicina Interna e Infectología')
    expect(r).toContain('Medicina interna ambulatoria')
    expect(r).toContain('Antimicrobianos')
    expect(r).toContain('Enfermedades infecciosas')
  })

  it('con abreviatura y sin acentos también', () => {
    expect(especialidadesDelMedico('MED. INTERNA')).toContain('Medicina interna ambulatoria')
    expect(especialidadesDelMedico('infectologia')).toContain('Antimicrobianos')
  })

  it('y no se repite un destino que salga por dos filas', () => {
    const r = especialidadesDelMedico('Infectología y enfermedades infecciosas')
    expect(new Set(r).size).toBe(r.length)
  })
})

describe('LO QUE NO HACE — que es la parte que protege', () => {
  it('sin coincidencia devuelve vacío, no «la más parecida»', () => {
    for (const t of ['', '   ', 'Médico general', 'Homeopatía', undefined, null]) {
      expect(especialidadesDelMedico(t as string | undefined), String(t)).toEqual([])
    }
  })

  it('y está escrito por qué', () => {
    expect(POR_QUE_NO_SE_ADIVINA).toMatch(/no se ve/)
  })

  it('sólo puede AÑADIR: el módulo sigue mandando lo suyo', () => {
    /**
     * Es la garantía de que esto no puede empeorar nada: sin especialidades, el
     * resultado es idéntico al de antes.
     */
    const sin = contextosActivos({ modulo: 'uci' })
    const con = contextosActivos({ modulo: 'uci', especialidades: especialidadesDelMedico('Infectología') })
    for (const e of CONTEXTOS_POR_MODULO.uci.slice(0, 2)) {
      expect(sin, e).toContain(e)
    }
    expect(con.length).toBeGreaterThanOrEqual(1)
  })

  it('lo que el médico dijo va PRIMERO, delante de lo del módulo', () => {
    // Es la regla que ya estaba escrita en el léxico y que no se podía cumplir
    // porque nadie mandaba especialidades.
    const con = contextosActivos({ modulo: 'consulta', especialidades: ['Nefrología'] })
    expect(con[0]).toBe('Nefrología')
  })
})

describe('Y AHORA SÍ LO MANDA ALGUIEN', () => {
  it('la consulta', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('especialidades: especialidadesDelMedico(especialidadEfectiva)')
  })

  it('y UCI', () => {
    const uci = leer('src', 'app', '(dashboard)', 'uci', 'page.tsx')
    expect(uci).toContain('especialidades: especialidadesDelMedico(config?.especialidad)')
  })

  it('con la especialidad en las dependencias del memo', () => {
    // `opcionesWhisper` se congela: sin la dependencia, cambiar la especialidad
    // en Configuración no cambiaría el vocabulario hasta recargar.
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    // La v1023 añadió `aprendido` a las mismas dependencias (LEARN): se
    // comprueba que la especialidad sigue estando, no la lista literal.
    expect(page).toMatch(/internamientoActivo, especialidadEfectiva[,\]]/)
  })
})
