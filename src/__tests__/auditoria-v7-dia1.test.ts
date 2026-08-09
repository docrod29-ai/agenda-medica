/**
 * GOLDEN — los tres hallazgos del Día 1 del Master Loop V7 que sí muerden.
 *
 * Salieron de dos auditorías independientes que convergieron en lo mismo, y los
 * tres se verificaron **ejecutando el motor**, no leyendo el archivo.
 *
 * ── 1. EL DECIMAL PERDÍA SU ÚLTIMO DÍGITO ────────────────────────────────────
 *
 * «pH siete punto treinta y cinco» salía «pH 7.30 y 5». La parte ENTERA sí unía
 * decena y unidad con «y»; la decimal no. Y es la forma **natural** de dictar en
 * español un pH, un potasio, un INR o una dosis de vasopresor.
 *
 * Lo que quedaba era **plausible** —7.30 es un pH posible, 0.30 una dosis
 * posible—, que es el peor modo de falla. El guardián tampoco lo veía: sólo
 * vigila cifras que DESAPARECEN, y aquí la que sobra aparece.
 *
 * ── 2. UNA ALERGIA REAL DESAPARECÍA DETRÁS DE UNA NEGACIÓN ───────────────────
 *
 * «Niega penicilina. Alérgico a sulfas» era UN fragmento sin el punto como
 * separador: se filtraba entero por negado y devolvía `[]`. La alergia a sulfas
 * se perdía en los cuatro sitios que leen de ahí — receta, nota, FHIR y el sesgo
 * del reconocedor.
 *
 * El camino hospitalario ya partía por punto y su comentario decía por qué. El
 * canónico no se enteró.
 *
 * ── 3. LA ALERTA DE ALERGIA CORRÍA SOBRE EL TEXTO CRUDO ──────────────────────
 *
 * En la pantalla donde se prescribe, el campo entero entraba como un solo
 * alérgeno, sin partir y sin filtrar negaciones. «Niega alergia a penicilina» +
 * amoxicilina pintaba la alerta CRÍTICA roja.
 *
 * Es REG-034 y REG-035 —cerradas dos veces— en una tercera ruta, y en el mismo
 * archivo había otras dos lecturas del campo que sí usaban el parser bueno.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizar } from '@/lib/asr/normalizacion'
import { parsearAlergiasTexto } from '@/lib/seguridad/alergias'

describe('1 · EL DECIMAL DICTADO CON «Y»', () => {
  it('«pH siete punto treinta y cinco» → pH 7.35', () => {
    expect(normalizar('pH siete punto treinta y cinco').texto).toBe('pH 7.35')
  })

  it('«potasio tres punto cuarenta y dos» → 3.42 mmol/L', () => {
    expect(normalizar('potasio tres punto cuarenta y dos milimoles por litro').texto)
      .toBe('potasio 3.42 mmol/L')
  })

  it('«INR uno punto ochenta y cinco» → INR 1.85', () => {
    expect(normalizar('INR uno punto ochenta y cinco').texto).toBe('INR 1.85')
  })

  it('la norepinefrina, donde el error es una dosis de vasopresor', () => {
    expect(normalizar('norepinefrina cero punto treinta y cinco microgramos por kilo por minuto').texto)
      .toBe('norepinefrina 0.35 mcg/kg/min')
  })

  it('y lo que ya funcionaba sigue igual', () => {
    expect(normalizar('pH siete punto treinta').texto).toBe('pH 7.30')
    expect(normalizar('creatinina uno punto cero tres').texto).toBe('creatinina 1.03')
    expect(normalizar('cuarenta y ocho horas').texto).toBe('48 horas')
  })
})

describe('2 · LA ALERGIA QUE VENÍA DETRÁS DE UNA NEGACIÓN', () => {
  it('«Niega penicilina. Alérgico a sulfas» NO puede devolver vacío', () => {
    const r = parsearAlergiasTexto('Niega penicilina. Alérgico a sulfas')
    expect(r.length).toBeGreaterThan(0)
    expect(r.map(a => a.alergeno).join(' ').toLowerCase()).toContain('sulfas')
  })

  it('y las negaciones se siguen filtrando', () => {
    expect(parsearAlergiasTexto('No refiere alergias, no conocidas')).toEqual([])
  })

  it('el punto NO parte decimales ni abreviaturas', () => {
    /**
     * Se exige espacio detrás del punto. Sin esa condición, «2.5 mg» y
     * «Penicilina G.» se partirían y el arreglo crearía un problema nuevo.
     */
    expect(parsearAlergiasTexto('Paracetamol 2.5 mg')[0].alergeno).toBe('Paracetamol 2.5 mg')
    /**
     * REG-276 — antes esperaba «Penicilina G.» CON el punto final. Lo que esta
     * prueba defiende es que el punto **no PARTA** el nombre, y eso sigue en
     * pie: sale un solo alérgeno. Lo que cambia es que el punto que cierra el
     * texto ya no se queda pegado, porque «Penicilina G.» no casa con ningún
     * fármaco del catálogo y «Penicilina G» sí.
     */
    expect(parsearAlergiasTexto('Penicilina G.')).toHaveLength(1)
    expect(parsearAlergiasTexto('Penicilina G.')[0].alergeno).toBe('Penicilina G')
  })

  it('y lo de siempre sigue igual', () => {
    expect(parsearAlergiasTexto('Penicilina, Sulfas').map(a => a.alergeno)).toEqual(['Penicilina', 'Sulfas'])
  })
})

describe('3 · LA ALERTA DE ALERGIA USA EL PARSER CANÓNICO', () => {
  const page = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

  it('en la pantalla donde se prescribe', () => {
    expect(page).toContain('const alergiasPaciente = alergiasDe(patient ?? {})')
  })

  it('y ya no queda el campo crudo metido como un solo alérgeno', () => {
    expect(page).not.toContain("[{ alergeno: patient.alergias, reaccion: '' }]")
  })
})
