/**
 * GUARDIÁN — EL SELLO QUE SE VE CUENTA LO MISMO QUE EL QUE SE ARCHIVA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `construirManifiesto` audita la prosa de la nota (cada sección y el resumen
 * ejecutivo, con su cita textual) desde hace versiones. Al FIRMAR, `/consulta`
 * le pasaba la prosa, así que el sello que queda en el registro medicolegal
 * (`iaAuditoria.procedencia`) la contaba.
 *
 * Las dos superficies donde un humano LEE ese sello —la tira de `/consulta` y
 * la del expediente— construían su propio objeto a mano y omitían `secciones`
 * y `resumen`. Sobre la MISMA nota:
 *
 * ```text
 *   lo que se ARCHIVA  →  «3 del dictado · 4 a mano»   (7 campos)
 *   lo que se VE       →  «4 a mano»                   (4 campos)
 * ```
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * El estado de la iteración lo dejó nombrado como deuda declarada y sin pagar
 * («la mitad de PROSA del manifiesto sigue sin conectar»), con la mitad del
 * diagnóstico correcta: se creía que NINGUNA superficie le pasaba la prosa. Al
 * mirar del otro lado —«el dato tiene que LLEGAR»— resultó que el guardado sí,
 * y sólo las pantallas no. Eso lo empeora: no era una capacidad sin estrenar,
 * eran **dos sellos que cuentan distinto sobre el mismo documento**, y el que
 * miente por defecto es el único que un humano llega a ver.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Tres listas independientes de «qué es una nota para el sello»: una en el
 * guardado de `/consulta`, otra en las props de `SelloProcedencia` (un
 * `interface FinalNota` local que ni siquiera DEJABA pasar la prosa — el
 * compilador la habría rechazado) y otra en `procedencia-de-la-nota-archivada`.
 * Sólo la primera estaba completa.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Una sola definición: `notaParaElSello()` en `lib/expediente/procedencia.ts`,
 * y el tipo `FinalNota` exportado en vez de recopiado. Las tres superficies
 * pasan por ahí.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO comprueba la compuerta de firma. `camposSinEvidencia()` —el aviso de
 *   «estos datos no se pudieron comprobar contra el dictado» -- sigue
 *   construyendo su propia lista SIN prosa, así que el aviso previo a firmar
 *   no mira los párrafos. Es una decisión de conducta clínica sobre la firma,
 *   no de presentación: §1 del Master Loop V15 congela la lógica de negocio, y
 *   ampliar una compuerta de firma es del dueño. Queda declarado, no arreglado.
 * · NO comprueba que el manifiesto CLASIFIQUE bien la prosa: eso lo cubre
 *   `procedencia-de-la-prosa.test.ts`, con su corpus.
 * · NO es una prueba de navegador. Que la lente abra, cierre y devuelva el foco
 *   lo cubren `v15-lente-contextual-es-la-capa-4.test.ts` y la medición.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  construirManifiesto,
  notaParaElSello,
  resumenProcedencia,
  esProsa,
  PREFIJO_PROSA,
} from '@/lib/expediente/procedencia'
import { procedenciaDeLaNotaArchivada } from '@/lib/expediente/procedencia-de-la-nota-archivada'
import type { NotaMedica } from '@/types/expediente'

const leer = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')

/**
 * El caso no es de laboratorio: es el fallo real que el Dr. encontró en
 * producción. La pregunta fue «¿diabetes o presión alta?», el paciente dijo
 * «no, nada de eso», y la nota quedó redactada como «Paciente con DM2 e HTA».
 * El manifiesto lo sella como venido del dictado y **enseña la cita al lado**,
 * que es lo que permite ver que el respaldo dice lo contrario.
 */
const EXTRACCION = {
  diagnosticos: [{ value: 'Diabetes mellitus 2', source_quote: 'la diabetes', confidence: 'alta' }],
  secciones: {
    antecedentes: { value: 'Paciente con DM2 e HTA.', source_quote: 'no, nada de eso', confidence: 'media' },
    padecimiento: { value: 'Dolor abdominal de 3 dias.', source_quote: 'me duele la panza hace tres dias', confidence: 'alta' },
  },
  resumenEjecutivo: { value: 'Colecistitis probable.', source_quote: 'la de la docencia', confidence: 'baja' },
}

const TRANSCRIPCION =
  'me duele la panza hace tres dias, la diabetes, no, nada de eso, la de la docencia'

const ESTRUCTURADOS = {
  diagnosticos: [{ descripcion: 'Diabetes mellitus 2' }],
  medicamentos: [{ nombre: 'Metformina', dosis: '850 mg' }],
  alergias: ['Penicilina'],
  signosVitales: { fc: 88 },
}

const PROSA = {
  secciones: [
    { key: 'antecedentes', label: 'Antecedentes', value: 'Paciente con DM2 e HTA.' },
    { key: 'padecimiento', label: 'Padecimiento actual', value: 'Dolor abdominal de 3 dias.' },
  ],
  resumen: 'Colecistitis probable.',
}

const manifiestoDe = (final: Parameters<typeof construirManifiesto>[0]) =>
  construirManifiesto(final, EXTRACCION as never, undefined, { transcripcion: TRANSCRIPCION })

describe('el sello que se ve cuenta lo mismo que el que se archiva', () => {
  it('1. la prosa entra al manifiesto por `notaParaElSello`', () => {
    const m = manifiestoDe(notaParaElSello({ ...ESTRUCTURADOS, ...PROSA }))
    const prosa = m.campos.filter(esProsa)
    expect(prosa.map(c => c.id).sort()).toEqual([
      `${PREFIJO_PROSA}antecedentes`,
      `${PREFIJO_PROSA}padecimiento`,
      `${PREFIJO_PROSA}resumen`,
    ])
  })

  it('2. sin la prosa el total es OTRO — el defecto, dicho en números', () => {
    const conProsa = manifiestoDe(notaParaElSello({ ...ESTRUCTURADOS, ...PROSA }))
    const sinProsa = manifiestoDe(ESTRUCTURADOS)
    expect(sinProsa.resumen.total).toBe(4)
    expect(conProsa.resumen.total).toBe(7)
    // Y no es sólo el total: la frase que el médico lee cambia de sentido.
    expect(resumenProcedencia(sinProsa.resumen)).toBe('4 a mano')
    expect(resumenProcedencia(conProsa.resumen)).toContain('del dictado')
  })

  it('3. la fila que deja ver el fallo conserva la cita que lo contradice', () => {
    const m = manifiestoDe(notaParaElSello({ ...ESTRUCTURADOS, ...PROSA }))
    const antecedentes = m.campos.find(c => c.id === `${PREFIJO_PROSA}antecedentes`)
    expect(antecedentes?.valor).toContain('DM2 e HTA')
    expect(antecedentes?.cita).toBe('no, nada de eso')
  })

  it('4. `notaParaElSello` no inventa ni pierde nada: normaliza forma', () => {
    const conRuido = notaParaElSello({
      ...ESTRUCTURADOS,
      secciones: [
        // Un `NotaSeccion` real arrastra estado de interfaz. No debe viajar.
        { key: 'antecedentes', label: 'Antecedentes', value: 'Paciente con DM2 e HTA.', sugerencia: 'x', foco: true } as never,
      ],
      resumen: 'Colecistitis probable.',
    })
    expect(Object.keys(conRuido.secciones![0]).sort()).toEqual(['key', 'label', 'value'])
    expect(conRuido.resumen).toBe('Colecistitis probable.')
    expect(conRuido.diagnosticos).toBe(ESTRUCTURADOS.diagnosticos)
  })

  it('5. una nota archivada lleva su prosa al sello', () => {
    const nota = {
      diagnosticos: [{ descripcion: 'Diabetes mellitus 2' }],
      medicamentos: [{ nombre: 'Metformina', dosis: '850 mg' }],
      alergias: ['Penicilina'],
      signosVitales: { fc: 88 },
      secciones: PROSA.secciones,
      resumenEjecutivo: PROSA.resumen,
      transcripcionMotor: TRANSCRIPCION,
      iaAuditoria: { extraction: EXTRACCION },
    } as unknown as NotaMedica

    const p = procedenciaDeLaNotaArchivada(nota)
    expect(p.puedeSellar).toBe(true)
    expect(p.final.secciones?.length).toBe(2)
    expect(p.final.resumen).toBe('Colecistitis probable.')

    const m = construirManifiesto(p.final, p.extraction as never, p.aprobados, { transcripcion: p.dictado })
    expect(m.campos.filter(esProsa).length).toBe(3)
    expect(m.resumen.total).toBe(7)
  })

  it('6. una nota archivada SIN prosa no gana campos de la nada', () => {
    const nota = {
      diagnosticos: [{ descripcion: 'Diabetes mellitus 2' }],
      transcripcionMotor: TRANSCRIPCION,
      iaAuditoria: { extraction: EXTRACCION },
    } as unknown as NotaMedica
    const p = procedenciaDeLaNotaArchivada(nota)
    const m = construirManifiesto(p.final, p.extraction as never, p.aprobados, { transcripcion: p.dictado })
    expect(m.campos.filter(esProsa)).toHaveLength(0)
    // Regla 4: ausencia de dato no es dato de ausencia. Una sección vacía no se
    // sella como «escrita a mano»; simplemente no existe como campo.
    expect(m.resumen.total).toBe(1)
  })

  it('7. una sección en blanco no genera campo (no se sella el vacío)', () => {
    const m = manifiestoDe(notaParaElSello({
      ...ESTRUCTURADOS,
      secciones: [{ key: 'antecedentes', label: 'Antecedentes', value: '   ' }],
      resumen: '',
    }))
    expect(m.campos.filter(esProsa)).toHaveLength(0)
  })

  /* ── LAS TRES SUPERFICIES PASAN POR LA MISMA DEFINICIÓN ────────────────────
     Estos casos leen el árbol a propósito. La divergencia no fue un cálculo
     mal hecho: fue que cada pantalla enumeraba los campos por su cuenta, y eso
     sólo se ve en el fichero. */

  it('8. `/consulta` sella y pinta el MISMO objeto', () => {
    const src = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    expect(src).toContain('notaParaElSello({')
    // El sello archivado y la tira en pantalla, los dos:
    expect(src).toContain('procedencia: construirManifiesto(\n          notaDelSello,')
    expect(src).toContain('final={notaDelSello}')
    // Y ya no hay una segunda lista escrita a mano en el JSX.
    expect(src).not.toContain('final={{ diagnosticos, medicamentos')
  })

  it('9. `SelloProcedencia` importa el tipo en vez de recopiarlo', () => {
    const src = leer('src/components/SelloProcedencia.tsx')
    expect(src).toMatch(/import\s*\{[^}]*type FinalNota[^}]*\}\s*from\s*'@\/lib\/expediente\/procedencia'/)
    expect(src).not.toMatch(/interface FinalNota \{/)
  })

  it('10. el expediente construye su `final` con la misma función', () => {
    const src = leer('src/lib/expediente/procedencia-de-la-nota-archivada.ts')
    expect(src).toContain('final: notaParaElSello({')
    expect(src).toContain('secciones: nota.secciones')
    expect(src).toContain('resumen: nota.resumenEjecutivo')
  })

  it('11. la tira de `/consulta` no se calla en una nota que sólo trae prosa', () => {
    const src = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    // La condición vieja miraba sólo dos familias de las seis que el sello cuenta.
    expect(src).not.toContain('{(diagnosticos.length > 0 || medicamentos.length > 0) && (\n        <SelloProcedencia')
    expect(src).toContain("secciones.some(s => s.value?.trim()) || resumen.trim()")
  })

  it('12. el panel separa las dos familias y lo hace con `esProsa`, no con una cadena', () => {
    const src = leer('src/components/SelloProcedencia.tsx')
    expect(src).toContain('campos.filter(esProsa)')
    expect(src).toContain('campos.filter(c => !esProsa(c))')
    // El prefijo se declara UNA vez, en el motor.
    expect(src).not.toContain("'prosa:'")
    // El texto redactado va primero: es la familia cuya cita hay que leer.
    expect(src.indexOf("rotulo: 'Texto redactado'")).toBeLessThan(src.indexOf("rotulo: 'Datos estructurados'"))
  })

  it('13. el rótulo del grupo vive en la HOJA, no en línea', () => {
    const src = leer('src/components/SelloProcedencia.tsx')
    expect(src).toContain('className="nx-sello-grupo-rotulo"')
    const css = leer('src/app/globals.css')
    expect(css).toContain('.nx-sello-grupo-rotulo')
    expect(css).toContain('.nx-sello-grupo { display: contents; }')
  })

  it('14. la copia del panel ya no afirma que sólo hay datos estructurados', () => {
    const src = leer('src/components/SelloProcedencia.tsx')
    expect(src).not.toContain('Cada dato estructurado de la nota, con su origen')
    expect(src).toContain('el texto redactado incluido')
  })
})
