/**
 * GOLDEN — la alergia estructurada no llegaba a la compuerta que bloquea la firma.
 *
 * ── CÓMO SE ENCONTRÓ ─────────────────────────────────────────────────────────
 *
 * Cerrando SAFE-001. Los tres parsers de fuera ya usaban `alergenosDe`, así que
 * el ítem parecía hecho. Siguiendo la regla «el dato tiene que LLEGAR» —¿dónde
 * ACABA el alérgeno, y quién lo lee del otro lado?— apareció que quedaban dos
 * llamadores más en la consulta, y que uno de ellos es **el que sella la nota**.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * `nota.alergias` se sellaba con `parsearAlergiasTexto(patient?.alergias)`, que
 * sólo mira el TEXTO LIBRE. Un paciente cuya alergia vive en
 * `alergiasEstructuradas` sellaba `alergias: []`.
 *
 * Y de `nota.alergias` cuelga la compuerta de firma (`nom004.ts`): el cruce por
 * subcadena y el de **reactividad cruzada por familias**. Con la lista vacía, la
 * compuerta no tiene contra qué cruzar y devuelve verde.
 *
 * ── POR QUÉ IMPORTA PARA UN PACIENTE ─────────────────────────────────────────
 *
 * Reproducido con el motor real antes de tocar nada: paciente con «Penicilina»
 * sólo en el campo estructurado + prescripción de **cefalexina** → la pantalla
 * pinta la alergia en rojo (lee `alergiasDe`, que sí mira el estructurado) y la
 * compuerta devuelve **cero errores**. El betalactámico se firma sobre un
 * alérgico, con el aviso a la vista y sin que nada lo detenga.
 *
 * Es peor que no mostrar nada: la pantalla dice que el sistema conoce la
 * alergia, y eso invita a confiar en que la compuerta también la conoce.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * La pantalla y lo que se SELLA leen de la misma fuente. Es la misma divergencia
 * que `alergiasParaImpreso` ya documentaba para el papel —y que su comentario
 * anunciaba: «cualquier importación o mapeo desde otro sistema la activa el
 * mismo día».
 *
 * ── QUÉ **NO** CUBRE ─────────────────────────────────────────────────────────
 *
 * - **No hay hoy una ruta de escritura que llene `alergiasEstructuradas`.** El
 *   campo está tipado, declarado en `CAMPOS_CLINICOS_PACIENTE`, en las reglas y
 *   en el manifiesto del respaldo, pero ninguna pantalla lo escribe. El defecto
 *   es **latente**: se activa el día que una importación, un mapeo FHIR o una
 *   migración lo llene. Esta prueba lo cierra ANTES de ese día.
 * - **No cubre el contexto que se le manda al modelo.** `/verificar-nota` y
 *   `/evidencia` siguen recibiendo `patient?.alergias` en crudo. Son contexto
 *   para redactar, no una compuerta determinista, y van al backlog aparte.
 * - **No juzga el catálogo de familias** de `medical-dictionary`: si un fármaco
 *   no está en él, esta compuerta no lo cruza. Vocabulario, no criterio.
 * - **No comprueba que la severidad viaje**: hoy nadie llena `severidad`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { alergiasDe, parsearAlergiasTexto } from '@/lib/seguridad/alergias'
import { validarNOM004 } from '@/lib/expediente/nom004'
import type { NotaMedica } from '@/types/expediente'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/** El paciente del caso: la alergia SÓLO en el campo estructurado. */
const PACIENTE_ESTRUCTURADO = {
  alergias: undefined,
  alergiasEstructuradas: [{ alergeno: 'Penicilina' }],
}

/** Una nota mínima que pasa NOM-004 salvo por lo que queremos observar. */
function notaCon(alergias: { alergeno: string }[]): NotaMedica {
  return {
    tipo: 'evolucion',
    fechaConsulta: '2026-08-07T10:00:00Z',
    secciones: [],
    diagnosticos: [],
    medicamentos: [{ nombre: 'Cefalexina 500 mg' }],
    alergias,
    signosVitales: {},
    metadata: { medicoId: 'm1', cedulaProfesional: '123' },
  } as unknown as NotaMedica
}

describe('EL ALÉRGENO ESTRUCTURADO LLEGA A LA COMPUERTA', () => {
  it('lo que se sella en la nota incluye la alergia estructurada', () => {
    // Esto es exactamente lo que hace hoy el encabezado de la consulta.
    expect(alergiasDe(PACIENTE_ESTRUCTURADO).map(a => a.alergeno)).toEqual(['Penicilina'])
  })

  it('y con ella la compuerta DETIENE la cefalexina por reactividad cruzada', () => {
    const r = validarNOM004(notaCon(alergiasDe(PACIENTE_ESTRUCTURADO)))
    expect(r.errores.join(' ')).toMatch(/cefalexina/i)
  })

  it('el parser de sólo-texto-libre es el que la perdía — se deja documentado', () => {
    /**
     * Probado al revés: ésta es la trampa. Si alguien vuelve a sellar la nota
     * con el parser de texto libre, la compuerta se queda muda otra vez.
     */
    expect(parsearAlergiasTexto(PACIENTE_ESTRUCTURADO.alergias)).toEqual([])
    expect(validarNOM004(notaCon(parsearAlergiasTexto(PACIENTE_ESTRUCTURADO.alergias))).errores).toEqual([])
  })

  it('el texto libre sigue funcionando igual que antes', () => {
    // La reparación no puede costarle nada al caso normal, que es el de siempre.
    const soloTexto = { alergias: 'Penicilina', alergiasEstructuradas: undefined }
    expect(validarNOM004(notaCon(alergiasDe(soloTexto))).errores.join(' ')).toMatch(/cefalexina/i)
  })

  it('y «niega alergias» no inventa una alergia que detenga la firma', () => {
    const niega = { alergias: 'Niega alergias', alergiasEstructuradas: undefined }
    expect(validarNOM004(notaCon(alergiasDe(niega))).errores).toEqual([])
  })
})

describe('LOS LLAMADORES DE LA CONSULTA', () => {
  const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

  it('la nota se sella con `alergiasDe`, no con el texto libre a secas', () => {
    expect(consulta).toContain('alergias: alergiasDe(patient ?? {})')
  })

  it('el manifiesto de procedencia recibe el PACIENTE, no su campo de texto', () => {
    /**
     * El sello medicolegal dice de dónde salió cada dato. Un alérgeno que no
     * entra en el manifiesto no tiene procedencia que enseñar.
     */
    expect(consulta).not.toContain('alergiasArray(patient?.alergias)')
    expect(consulta).toContain('alergias: alergiasArray(patient)')
  })

  it('y ya no queda ningún parser de sólo-texto-libre en la consulta', () => {
    /**
     * El guardián que impide que vuelva. `parsearAlergiasTexto` sigue existiendo
     * en la librería —es la pieza que usa `alergiasDe`— pero la consulta no lo
     * IMPORTA: llamarlo aquí es exactamente el defecto que esta prueba cierra, y
     * sin el import no se puede llamar.
     *
     * Se mira el import y no las llamadas porque los comentarios de la consulta
     * nombran la función a propósito, para explicar por qué NO se usa.
     */
    const imports = consulta.match(/^import[\s\S]*?from\s+'[^']*'/gm) ?? []
    expect(imports.filter(i => i.includes('parsearAlergiasTexto'))).toEqual([])
  })
})
