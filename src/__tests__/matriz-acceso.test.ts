import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  MATRIZ_ACCESO, ROLES, ROLES_NO_CLINICOS, GUARDAS_EN_REGLAS,
  rolesDe, puedeLeer, puedeEscribir, normalizarRuta, matrizComoMarkdown,
  type Rol, type Guarda,
} from '@/lib/authz/matriz-acceso'
import { permisosPorRol } from '@/lib/permissions'

/**
 * Unidad Nexus OS E0-06 — la matriz de acceso es COMPROBABLE, no decorativa.
 *
 * Molde: `firestore-rules-guard.test.ts` (invariantes estáticas sobre el archivo de
 * reglas, sin emulador ni red). Lo que este archivo caza y ningún test cazaba antes:
 *
 *  1. una colección nueva en firestore.rules que nadie clasificó,
 *  2. un recurso de clase `clinico` colgado de una guarda que admite a recepción,
 *  3. una guarda nombrada en la matriz que no existe en las reglas (o al revés),
 *  4. la matriz publicada en docs/ quedándose vieja respecto al código.
 *
 * Aquí no hay criterio clínico: son invariantes de autorización.
 */

const RAIZ = process.cwd()
const RUTA_REGLAS = resolve(RAIZ, 'firestore.rules')
const RUTA_MD = resolve(RAIZ, 'docs/security/matriz-acceso-phi.md')

const reglasCrudas = readFileSync(RUTA_REGLAS, 'utf8')
/** Sin comentarios: los comentarios de este repo citan rutas y llaves a montones. */
const reglas = reglasCrudas.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

/**
 * Extrae la ruta COMPLETA de cada `match` de firestore.rules respetando el
 * anidamiento. Se apoya en una propiedad verificada del archivo: fuera de los
 * comentarios, las únicas llaves son las de bloque (`service`, `function`, `match`)
 * y los comodines de las propias rutas de `match`.
 */
function rutasDeLasReglas(): string[] {
  const pila: { ruta: string; prof: number }[] = []
  const out: string[] = []
  let prof = 0
  for (const linea of reglas.split('\n')) {
    const m = linea.match(/^\s*match\s+(\S+)\s*\{\s*$/)
    if (m) {
      pila.push({ ruta: m[1].replace(/^\//, ''), prof })
      prof++
      // La raíz `databases/{database}/documents` no es un recurso: es el ancla.
      const partes = pila.slice(1).map(p => p.ruta)
      if (partes.length) out.push(partes.join('/'))
      continue
    }
    prof += (linea.match(/\{/g) || []).length - (linea.match(/\}/g) || []).length
    while (pila.length && prof <= pila[pila.length - 1].prof) pila.pop()
  }
  return out
}

const RUTAS_REGLAS = rutasDeLasReglas()

describe('E0-06 · el parser de firestore.rules ve el archivo real', () => {
  it('encuentra las rutas anidadas conocidas (control de que el parser no miente)', () => {
    expect(RUTAS_REGLAS).toContain('clinics/{clinicId}')
    expect(RUTAS_REGLAS).toContain('clinics/{clinicId}/patients/{docId}')
    expect(RUTAS_REGLAS).toContain('clinics/{clinicId}/patients/{docId}/notas/{notaId}')
    expect(RUTAS_REGLAS).toContain('clinics/{clinicId}/patients/{docId}/notas/{notaId}/adendas/{adendaId}')
    expect(RUTAS_REGLAS).toContain('{document=**}')
    // Y NO inventa la raíz como recurso.
    expect(RUTAS_REGLAS).not.toContain('databases/{database}/documents')
  })
})

describe('E0-06 · la matriz y firestore.rules no divergen', () => {
  it('cada `match` de las reglas tiene entrada en la matriz', () => {
    const enMatriz = new Set(MATRIZ_ACCESO.map(r => normalizarRuta(r.ruta)))
    const huerfanas = RUTAS_REGLAS.filter(r => !enMatriz.has(normalizarRuta(r)))
    expect(huerfanas, `colecciones sin clasificar en MATRIZ_ACCESO: ${huerfanas.join(', ')}`).toEqual([])
  })

  it('cada entrada de la matriz existe como `match` en las reglas', () => {
    const enReglas = new Set(RUTAS_REGLAS.map(normalizarRuta))
    const fantasmas = MATRIZ_ACCESO.filter(r => !enReglas.has(normalizarRuta(r.ruta))).map(r => r.ruta)
    expect(fantasmas, `rutas declaradas que ya no existen en firestore.rules: ${fantasmas.join(', ')}`).toEqual([])
  })

  it('no hay rutas duplicadas en la matriz', () => {
    const vistas = MATRIZ_ACCESO.map(r => normalizarRuta(r.ruta))
    expect(new Set(vistas).size).toBe(vistas.length)
  })

  it('cada guarda nombrada existe como función en firestore.rules', () => {
    const usadas = new Set<Guarda>()
    for (const r of MATRIZ_ACCESO) { usadas.add(r.guardaLectura); usadas.add(r.guardaEscritura) }
    for (const g of usadas) {
      if (!GUARDAS_EN_REGLAS.includes(g)) continue // 'servidor'/'publico' son pseudo-guardas
      expect(reglas, `falta function ${g}( en firestore.rules`).toContain(`function ${g}(`)
    }
  })

  it('los roles de cada guarda son los que la función declara en las reglas', () => {
    // Se leen los literales de rol del cuerpo de la función y se comparan con
    // ROLES_POR_GUARDA. Si alguien afloja `isMedico` para incluir a la secretaria,
    // la tabla de roles deja de ser una transcripción y esto se pone rojo.
    for (const g of GUARDAS_EN_REGLAS) {
      const i = reglas.indexOf(`function ${g}(`)
      expect(i, `no se encontró function ${g}(`).toBeGreaterThan(-1)
      const cuerpo = reglas.slice(i, reglas.indexOf('\n    }', i))
      const literales = [...cuerpo.matchAll(/'([a-z]+)'/g)].map(m => m[1])
      const rolesEnReglas = [...new Set(literales.filter(l => (ROLES as readonly string[]).includes(l)))]
      if (!rolesEnReglas.length) {
        // isMember no nombra roles: pertenecer a la clínica basta → todos.
        expect(g).toBe('isMember')
        expect([...rolesDe(g)].sort()).toEqual([...ROLES].sort())
        continue
      }
      expect([...rolesEnReglas].sort(), `roles de ${g}`).toEqual([...rolesDe(g)].sort())
    }
  })
})

describe('E0-06 · ACEPTACIÓN — recepción lee cita, no lee contenido clínico', () => {
  it('ningún recurso CLÍNICO queda bajo una guarda que admita a un rol no clínico', () => {
    const fugas: string[] = []
    for (const r of MATRIZ_ACCESO) {
      if (r.clase !== 'clinico') continue
      for (const rol of ROLES_NO_CLINICOS) {
        if (rolesDe(r.guardaLectura).includes(rol)) fugas.push(`${rol} LEE ${r.ruta} (${r.guardaLectura})`)
        if (rolesDe(r.guardaEscritura).includes(rol)) fugas.push(`${rol} ESCRIBE ${r.ruta} (${r.guardaEscritura})`)
      }
    }
    expect(fugas, fugas.join(' · ')).toEqual([])
  })

  it('recepción SÍ lee la cita (la mitad afirmativa de la aceptación)', () => {
    for (const rol of ROLES_NO_CLINICOS) {
      expect(puedeLeer(rol, 'clinics/{clinicId}/appointments/{docId}')).toBe(true)
      // Y el directorio del paciente: agendar exige nombre y teléfono. Cerrarlo
      // rompería la agenda, que es justo lo que la aceptación pide preservar.
      expect(puedeLeer(rol, 'clinics/{clinicId}/patients/{docId}')).toBe(true)
    }
  })

  it('recepción NO lee la nota ni el resumen clínico del paciente', () => {
    for (const rol of ROLES_NO_CLINICOS) {
      expect(puedeLeer(rol, 'clinics/{clinicId}/patients/{docId}/notas/{notaId}')).toBe(false)
      expect(puedeLeer(rol, 'clinics/{clinicId}/patients/{docId}/clinico/{clinicoId}')).toBe(false)
      expect(puedeEscribir(rol, 'clinics/{clinicId}/patients/{docId}/clinico/{clinicoId}')).toBe(false)
      expect(puedeLeer(rol, 'clinics/{clinicId}/patients/{docId}/laboratorios/{labId}')).toBe(false)
      expect(puedeLeer(rol, 'clinics/{clinicId}/patients/{docId}/fotos/{fotoId}')).toBe(false)
    }
  })

  it('el médico SÍ lee todo lo clínico (el candado no puede cerrarle la puerta al tratante)', () => {
    for (const r of MATRIZ_ACCESO) {
      if (r.clase !== 'clinico' || r.guardaLectura === 'servidor') continue
      expect(puedeLeer('medico', r.ruta), `medico no lee ${r.ruta}`).toBe(true)
    }
  })

  it('una ruta que no está en la matriz falla-CERRADO', () => {
    expect(puedeLeer('admin', 'clinics/{clinicId}/coleccion_inventada/{x}')).toBe(false)
    expect(puedeEscribir('admin', 'clinics/{clinicId}/coleccion_inventada/{x}')).toBe(false)
  })

  it('los permisos de UX no contradicen la matriz', () => {
    // `permisosPorRol` hoy no gatea nada en producción (solo lo importan los tests),
    // pero si algún día se cablea no puede decir lo contrario que la autorización real.
    for (const rol of ROLES_NO_CLINICOS) {
      expect(permisosPorRol(rol).verExpediente, rol).toBe(false)
      expect(permisosPorRol(rol).editarExpediente, rol).toBe(false)
    }
    expect(permisosPorRol('medico').verExpediente).toBe(true)
  })

  it('`recepcion` se evalúa aunque hoy no sea asignable en clinic_members', () => {
    // Si mañana se añade al enum de roles, no debe entrar por una puerta abierta.
    expect(ROLES_NO_CLINICOS).toContain('recepcion' as Rol)
    expect(rolesDe('isMedico')).not.toContain('recepcion' as Rol)
  })
})

describe('E0-06 · la matriz publicada no se queda vieja', () => {
  it('docs/security/matriz-acceso-phi.md coincide exactamente con la matriz', () => {
    const esperado = matrizComoMarkdown()
    // Escotilla de regeneración (como una snapshot): REGENERAR_MATRIZ=1 npx vitest run
    // src/__tests__/matriz-acceso.test.ts
    if (process.env.REGENERAR_MATRIZ === '1') {
      writeFileSync(RUTA_MD, esperado, 'utf8')
    }
    expect(existsSync(RUTA_MD), 'falta docs/security/matriz-acceso-phi.md').toBe(true)
    expect(readFileSync(RUTA_MD, 'utf8')).toBe(esperado)
  })
})
