/**
 * GOLDEN — la aplicación no inventa el título de quien la usa.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `Sidebar` y `FlowRail` anteponían `Dr. ` cuando el nombre configurado no
 * traía prefijo:
 *
 *     const yaTienePrefijo = /^Dr\.?\s+|^Dra\.?\s+/i.test(config.nombreMedico)
 *     return yaTienePrefijo ? config.nombreMedico : `Dr. ${config.nombreMedico}`
 *
 * Con el consultorio sintético del arnés —cuyo `config.nombreMedico` es
 * «Ximena Alcántara Robledo»— el armazón entero de la aplicación la llamaba
 * **«Dr. Ximena Alcántara Robledo»**, mientras el portal del paciente, que lee
 * el nombre de otro documento donde sí venía escrito, la llamaba «Dra.».
 *
 * El mismo médico con dos títulos según la pantalla, y uno de los dos
 * inventado a partir de nada.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Abriendo la agenda con sesión sintética en un navegador real. Está en el
 * texto de la captura: «Consultorio de Medicina Interna · Dr. Ximena Alcántara
 * Robledo». No lo habría visto ninguna prueba de las que había.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Un valor de fábrica que parece cortesía y es una suposición. En un país donde
 * la mitad de los médicos son médicas, acierta la mitad de las veces.
 *
 * Y estaba DOS veces, con la misma expresión regular copiada, que es la otra
 * mitad del problema: dos sitios que hay que acordarse de mantener iguales.
 *
 * ── LA DECISIÓN, PARA QUE SE PUEDA REVERTIR ─────────────────────────────────
 *
 * Se prefiere un nombre sin título a un título equivocado. Quien escriba «Dra.»
 * o «Dr.» en su nombre lo verá tal cual. Si el dueño quiere un valor de
 * fábrica, se pone en `@/lib/nombre-medico` — en un sitio, no en dos.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No unifica los DOS sitios donde vive el nombre del médico (el documento de
 *   la clínica y `config/main`). Que puedan decir cosas distintas es un defecto
 *   aparte, declarado y no resuelto aquí.
 * - No toca la receta ni los documentos impresos: ahí el nombre sale del sello
 *   de la firma, que es otro camino.
 */
import { describe, it, expect } from 'vitest'
import { nombreMedicoParaMostrar, traeTitulo } from '@/lib/nombre-medico'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

describe('el nombre se enseña como el médico lo escribió', () => {
  it('respeta el título que sí puso', () => {
    expect(nombreMedicoParaMostrar('Dra. Ximena Alcántara Robledo')).toBe('Dra. Ximena Alcántara Robledo')
    expect(nombreMedicoParaMostrar('Dr. David Alonso Rodríguez Luna')).toBe('Dr. David Alonso Rodríguez Luna')
  })

  it('y no le pone uno cuando no lo puso — éste es el defecto', () => {
    // Antes esto devolvía «Dr. Ximena Alcántara Robledo».
    expect(nombreMedicoParaMostrar('Ximena Alcántara Robledo')).toBe('Ximena Alcántara Robledo')
    expect(nombreMedicoParaMostrar('Ximena Alcántara Robledo')).not.toMatch(/^Dr\.?\s/i)
  })

  it('sin nombre devuelve null, para que la pantalla elija su respaldo', () => {
    for (const v of ['', '   ', null, undefined]) expect(nombreMedicoParaMostrar(v)).toBeNull()
  })

  it('reconoce un título ya escrito, en sus formas reales', () => {
    for (const s of ['Dr. A', 'Dra. B', 'dra C', 'DR. D', 'Dr(a). E', 'Mtra. F']) {
      expect(traeTitulo(s), s).toBe(true)
    }
    expect(traeTitulo('Ximena Alcántara')).toBe(false)
    expect(traeTitulo('Draco Fuentes')).toBe(false)   // «Dra» pegado a más letras no es título
  })
})

describe('ninguna pantalla del armazón inventa el título', () => {
  for (const ruta of ['src/components/Sidebar.tsx', 'src/components/FlowRail.tsx']) {
    it(ruta.replace('src/components/', ''), () => {
      const codigo = sinComentarios(leer(ruta))
      expect(codigo, `${ruta} vuelve a anteponer «Dr. »`).not.toMatch(/`Dr\.\s*\$\{/)
      expect(codigo, `${ruta} reimplementa la regla en vez de usar el módulo`).not.toMatch(/\^Dr\\?\./)
      expect(codigo).toContain('nombreMedicoParaMostrar(')
    })
  }
})
