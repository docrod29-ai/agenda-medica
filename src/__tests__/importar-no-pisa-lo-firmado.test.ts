/**
 * GOLDEN — el importador validaba un campo y escribía en otro.
 *
 * ── DEFECTO 1 · SE PODÍA PISAR UNA NOTA FIRMADA ──────────────────────────────
 *
 * Cada línea del respaldo trae `_coleccion` y `_ruta`. El importador validaba
 * `_coleccion` contra el manifiesto… y escribía en `_ruta`. Los dos vienen del
 * mismo archivo y nada obligaba a que concordaran.
 *
 * Un respaldo manipulado podía declarar `_coleccion: "patients"` —inocua y
 * admitida— apuntando `_ruta` a `clinics/X/patients/P/notas/N`: una **nota
 * firmada**. Y el importador usa el SDK admin, que **ignora las reglas de
 * Firestore**, así que la regla que hace inmutable una nota firmada (NOM-024) no
 * llega a evaluarse por ese camino.
 *
 * La validación era, literalmente, sobre un campo distinto del que decidía el
 * destino.
 *
 * ── DEFECTO 2 · UNA REGRESIÓN PROPIA QUE ROMPÍA LA RESTAURACIÓN ──────────────
 *
 * En v1037 `hijas` pasó de lista de cadenas a ÁRBOL, para que el respaldo se
 * llevara también las adendas y las versiones. El importador seguía
 * interpolando cada elemento en una plantilla, así que producía
 * `patients.[object Object]`.
 *
 * Resultado: `patients.notas` no figuraba entre las colecciones conocidas y
 * **toda nota se rechazaba al restaurar**. El respaldo se exportaba completo y
 * no se podía volver a meter — justo en el momento en que un respaldo importa.
 *
 * ── LA REPARACIÓN, UNA PARA LOS DOS ──────────────────────────────────────────
 *
 * La colección se **deriva de la ruta**. Lo que se valida y lo que se escribe
 * pasan a ser el mismo dato, y las rutas anidadas se reconocen solas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { leerLinea, coleccionDeLaRuta, admitir } from '@/lib/clinica/restaurar'
import { COLECCIONES, rutasDelArbol } from '@/lib/clinica/respaldo'

describe('LA COLECCIÓN SALE DE LA RUTA, NO DEL CAMPO DECLARADO', () => {
  it('deriva bien los tres niveles', () => {
    expect(coleccionDeLaRuta('clinics/X/patients/P')).toBe('patients')
    expect(coleccionDeLaRuta('clinics/X/patients/P/notas/N')).toBe('patients.notas')
    expect(coleccionDeLaRuta('clinics/X/patients/P/notas/N/adendas/A')).toBe('patients.notas.adendas')
  })

  it('rechaza una ruta con forma imposible', () => {
    // Impar apunta a una colección, no a un documento: escribir ahí sería
    // inventarle un identificador.
    expect(coleccionDeLaRuta('clinics/X/patients')).toBeNull()
    expect(coleccionDeLaRuta('otra/cosa/aqui/alla')).toBeNull()
  })

  it('EL ATAQUE: declarar «patients» y apuntar a una nota firmada', () => {
    /**
     * Ésta es la línea exacta que antes pasaba la validación y escribía sobre
     * una nota firmada saltándose las reglas.
     */
    const linea = JSON.stringify({
      _coleccion: 'patients',
      _ruta: 'clinics/VICTIMA/patients/P1/notas/N1',
      estado: 'borrador', secciones: [], contenido: 'texto sustituido',
    })
    const l = leerLinea(linea)
    expect(l?.clase).toBe('documento')
    // Ya no vale lo declarado: se reclasifica según el destino real.
    expect((l as { coleccion: string }).coleccion).toBe('patients.notas')
    expect((l as { coleccion: string }).coleccion).not.toBe('patients')
  })

  it('y lo declarado ya no viaja a ninguna parte', () => {
    const ruta = readFileSync(join(process.cwd(), 'src/lib/clinica/restaurar.ts'), 'utf8')
    expect(ruta).toContain('const derivada = coleccionDeLaRuta(ruta)')
    expect(ruta).toContain('coleccion: derivada')
  })
})

describe('LAS SUBCOLECCIONES ANIDADAS SE RECONOCEN — mi regresión de v1037', () => {
  const conocidas = new Set(COLECCIONES.flatMap(rutasDelArbol))

  it('las notas se pueden restaurar', () => {
    /**
     * Con la interpolación vieja esto era `patients.[object Object]` y toda nota
     * se rechazaba con «colección desconocida».
     */
    expect(conocidas.has('patients.notas')).toBe(true)
  })

  it('y también sus adendas y sus versiones', () => {
    // Son lo que v1037 añadió al respaldo. De nada sirve exportarlas si no entran.
    expect(conocidas.has('patients.notas.adendas')).toBe(true)
    expect(conocidas.has('patients.notas.versions')).toBe(true)
  })

  it('ninguna ruta conocida quedó como «[object Object]»', () => {
    for (const r of conocidas) expect(r).not.toContain('object Object')
  })

  it('el importador las obtiene aplanando el árbol, no interpolando', () => {
    const ruta = readFileSync(join(process.cwd(), 'src/app/api/clinic/importar/route.ts'), 'utf8')
    expect(ruta).toContain('for (const r of rutasDelArbol(c)) conocidas.add(r)')
    expect(ruta).not.toContain('conocidas.add(`${c.ruta}.${h}`)')
  })
})

describe('LO QUE NO SE RESPALDA SIGUE SIN ENTRAR', () => {
  it('una colección excluida se rechaza aunque la ruta sea válida', () => {
    // Se consulta en los dos sentidos: lo que no sale por un respaldo tampoco entra.
    const derivada = coleccionDeLaRuta('clinics/X/secretos/S')
    expect(derivada).toBe('secretos')
    expect(admitir(derivada!).escribir).toBe(false)
  })
})
