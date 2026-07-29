import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Formulario corto de paciente (apartado «Consulta») — petición del médico dueño
 * del 29-jul-2026.
 *
 * La pantalla pide sólo lo que se llena de verdad al dar de alta a alguien:
 * nombre · UN teléfono · edad · fecha de nacimiento · sexo · alergias ·
 * servicio médico.
 *
 * LO QUE ESTOS CASOS PROTEGEN, y es lo delicado del cambio: quitar un campo de la
 * PANTALLA no debe quitarlo de los DATOS. Correo, CURP y notas clínicas siguen
 * guardados y siguen viajando en `handleSave`; si alguien "limpiara" el formulario
 * borrando también esas claves del payload, editar a un paciente viejo le
 * VACIARÍA su CURP y sus notas sin avisar. Eso es pérdida silenciosa de
 * información del expediente, que es el peor defecto posible en este repo.
 */

const RUTA = resolve(process.cwd(), 'src/app/(dashboard)/pacientes/page.tsx')
const fuente = readFileSync(RUTA, 'utf8')

describe('formulario corto de paciente — la pantalla', () => {
  const inputVisible = (etiqueta: string) => fuente.includes(`className="label">${etiqueta}`)

  it.each([
    'Nombre completo *',
    'Teléfono',
    'Edad *',
    'Fecha de nacimiento',
    'Sexo',
    'Servicio médico',
    'Alergias',
  ])('muestra «%s»', (etiqueta) => {
    expect(inputVisible(etiqueta)).toBe(true)
  })

  it.each([
    ['Correo electrónico', 'correo'],
    ['CURP (NOM-024)', 'CURP'],
    ['Notas clínicas', 'notas clínicas'],
    ['WhatsApp', 'segundo teléfono'],
  ])('ya NO muestra el campo de %s', (etiqueta) => {
    expect(inputVisible(etiqueta)).toBe(false)
  })

  it('la etiqueta del seguro dice «Servicio médico», como lo pidió el Dr.', () => {
    expect(fuente).not.toContain('className="label">Seguro médico')
  })
})

describe('formulario corto de paciente — los DATOS no se pierden', () => {
  it.each(['email', 'curp', 'notas'])(
    '`%s` sigue inicializándose desde el paciente guardado',
    (campo) => {
      // Sin esto, abrir a un paciente viejo cargaría '' y al guardar lo borraría.
      expect(fuente).toMatch(new RegExp(`${campo}:\\s*patient\\?\\.${campo}\\s*\\?\\?`))
    },
  )

  it.each(['email', 'curp', 'notas'])('`%s` sigue viajando en el payload de guardado', (campo) => {
    expect(fuente).toMatch(new RegExp(`^\\s*${campo}:\\s*f\\.${campo}`, 'm'))
  })

  it('el teléfono único alimenta también el campo whatsapp', () => {
    // El export FHIR lee `whatsapp` por separado (fhir-export.ts:120). Si el
    // formulario dejara de llenarlo, un paciente nuevo perdería su móvil ahí.
    expect(fuente).toContain("whatsapp: (f.whatsapp.replace(/\\D/g, '') || tel)")
  })

  it('respeta el whatsapp ya guardado en vez de sobreescribirlo con el teléfono', () => {
    // El `||` importa: si un paciente viejo tiene DOS números distintos, el suyo gana.
    const m = fuente.match(/whatsapp: \(f\.whatsapp[^\n]*\)/)
    expect(m, 'no se encontró la línea de whatsapp').not.toBeNull()
    expect(m![0]).toContain('f.whatsapp')       // primero el guardado
    expect(m![0]).toContain('|| tel')           // el teléfono es sólo el respaldo
  })
})

describe('fecha de nacimiento en la receta (la piden las farmacias)', () => {
  const receta = readFileSync(resolve(process.cwd(), 'src/components/RecetaDocumento.tsx'), 'utf8')
  const config = readFileSync(
    resolve(process.cwd(), 'src/app/(dashboard)/configuracion/secciones-recetas.tsx'), 'utf8',
  )
  const tipos = readFileSync(resolve(process.cwd(), 'src/types/index.ts'), 'utf8')

  it('es un campo ARRASTRABLE del calibrador, como el nombre', () => {
    expect(config).toContain("{ k: 'nacimiento', label: 'F. nacimiento' }")
  })

  it('el tipo de `disenoCampos` la admite (si no, no se puede guardar su posición)', () => {
    expect(tipos).toMatch(/disenoCampos\?:[^\n]*'nacimiento'/)
  })

  it('la receta sabe imprimir su valor', () => {
    expect(receta).toContain("k === 'nacimiento'")
    expect(receta).toContain('fmtFechaNac(data.paciente.fechaNacimiento)')
  })

  it('entra en el auto-acomodo vertical junto a los demás datos', () => {
    expect(receta).toContain("['nombre', 'edad', 'nacimiento', 'sexo', 'fecha', 'folio']")
  })

  it('usa el MISMO formateador que el encabezado por defecto', () => {
    // Dos formatos distintos de fecha en la misma receta se ven como un error.
    const usos = receta.match(/fmtFechaNac\(/g) ?? []
    expect(usos.length).toBeGreaterThanOrEqual(3)   // definición + calibrador + encabezado
  })

  it('el paciente de ejemplo del calibrador TIENE fecha, para que no salga vacío', () => {
    // Sin fecha en el demo, el Dr. arrastra el campo y no ve nada: parece roto.
    expect(config).toContain("fechaNacimiento: '1984-03-15'")
  })
})
