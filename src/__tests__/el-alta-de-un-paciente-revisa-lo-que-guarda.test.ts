/**
 * ASM-001 · ASE-020 · ASR-020 · MP-017 · C-023 · D-002 (Panel de Lujo 2026-09)
 * — el formulario de alta de `/pacientes` guardaba sin mirar y hablaba mal.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * · **ASM-001** — `handleSave` validaba el nombre y la edad y NADA del teléfono:
 *   «12345», letras o un número sin lada se guardaban con un «Paciente
 *   actualizado» en verde. Con ese número salen los recordatorios de cita, y un
 *   mensaje que no llega no falla en la pantalla de nadie: se ve igual que uno
 *   entregado. El único control de teléfono del producto vivía en la reserva
 *   pública (`api/public/booking:85`), o sea en la puerta por la que NO entra el
 *   consultorio.
 * · **ASE-020** — los siete `<label className="label">` del formulario corto no
 *   tenían `htmlFor` ni `id`: para un lector de pantalla eran campos sin nombre.
 *   `design-system.md` lista «campo sin etiqueta» entre los mínimos que fallan
 *   la compuerta (WCAG 2.2 AA, 3.3.2).
 * · **D-002** — la X que limpia la búsqueda era un botón sólo-icono sin nombre
 *   accesible (WCAG 4.1.2). Lo cazó el propio analizador del repo,
 *   `scripts/design/lib/a11y-jsx.mjs`, con 2 aciertos en 224 .tsx.
 * · **ASR-020** — dos convenciones de nombre para la misma persona: «Apellido
 *   Apellido, Nombre» aquí y «Nombre completo» en el asistente, las dos puertas
 *   creando expedientes en la MISMA colección. Y «Edad *» se exigía aunque la
 *   fecha de nacimiento estuviera puesta.
 * · **MP-017** — `edad` y `fechaNacimiento` se guardaban las dos: dos fuentes de
 *   verdad para el mismo hecho. La congelada es la que imprime la receta, así
 *   que un niño registrado a los 6 seguía saliendo con 6 dos años después; y
 *   `edad: 0` —el lactante— se pintaba como «sin edad» porque 0 es falso.
 * · **C-023** — «El nombre es requerido» / «La edad es requerida»: anglicismo.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Panel de Lujo de septiembre de 2026 (auditores AS-mensajería, AS-expedientes,
 * AS-recorridos, MP y C; D-002 reproducido por el equipo rojo con el analizador
 * del propio repo). Los seis confirmados.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El formulario se escribió para capturar rápido, y lo que no bloquea la captura
 * —la forma del teléfono, la etiqueta del campo, el nombre accesible— se quedó
 * fuera. Ninguno de los seis rompe nada visible: por eso llevaban ahí tanto.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * `design-system.md` (ACCESIBILIDAD: campo sin etiqueta y control sólo-icono sin
 * nombre fallan la compuerta), el invariante «UN PACIENTE · UNA IDENTIDAD»
 * (dos convenciones de nombre fabrican duplicados) y CLAUDE.md: nunca duplicar
 * la fuente de verdad de una entidad clínica.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * MIXTA. El teléfono y la edad son COMPORTAMIENTO sobre los módulos puros
 * (`telefono-del-paciente`, `campos-que-se-guardan`), probados al revés: hay
 * casos que TIENEN que seguir pasando. Las etiquetas y los textos son CONTRATO
 * TEXTUAL sobre `pacientes/page.tsx`, declarado: este repo corre vitest en
 * `environment: 'node'`, sin jsdom ni testing-library, así que la pantalla no se
 * monta.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No comprueba que la línea exista ni que tenga WhatsApp: eso sólo lo sabe el
 * proveedor cuando el mensaje sale. No cubre los otros dos formularios que
 * capturan el mismo teléfono (`AppointmentModal`, lista de espera: son de otra
 * rebanada, van en `handoff-EXPEDIENTES.md`). No cubre la X del panel de
 * laboratorios (D-002 tiene dos mitades; la otra es de UI-CONFIG). No cubre que
 * la RECETA imprima la edad derivada ni los meses del lactante: eso vive en
 * `receta-word.ts`/`RecetaDocumento.tsx`, también en el handoff.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { revisarTelefonoDelPaciente } from '@/lib/pacientes/telefono-del-paciente'
import { construirGuardadoDePaciente } from '@/lib/pacientes/campos-que-se-guardan'

const fuente = readFileSync(resolve(process.cwd(), 'src/app/(dashboard)/pacientes/page.tsx'), 'utf8')

const FORM = {
  nombre: 'Ernestina Quiroga Balbuena', telefono: '', whatsapp: '', email: '',
  fechaNacimiento: '', edad: '', sexo: '', curp: '', seguroMedico: '', alergias: '', notas: '',
}
const CTX = { modo: 'medico' as const, previo: null, autor: 'staff@ejemplo.mx', ahora: '2026-09-06T12:00:00.000Z' }

describe('ASM-001 · el teléfono con el que salen los recordatorios se revisa', () => {
  it('rechaza lo que no puede recibir un mensaje, y dice qué le falta', () => {
    for (const malo of ['12345', '55A5010101', '+1 619', '664123456789012345']) {
      const r = revisarTelefonoDelPaciente(malo)
      expect(r.valido, `«${malo}» pasó`).toBe(false)
      expect(r.problema.length, `«${malo}» se rechazó sin decir por qué`).toBeGreaterThan(10)
    }
  })

  it('probada al revés: los que SÍ sirven siguen entrando', () => {
    expect(revisarTelefonoDelPaciente('6641234567').valido).toBe(true)
    expect(revisarTelefonoDelPaciente('664 123-4567').valido).toBe(true)
    expect(revisarTelefonoDelPaciente('+52 664 123 4567').valido).toBe(true)
    expect(revisarTelefonoDelPaciente('5216641234567').valido).toBe(true)
    // Un número extranjero completo es válido: el consultorio atiende a quien
    // vive del otro lado de la frontera, y forzarlo a formato mexicano sería
    // corregir en silencio un dato que está bien.
    expect(revisarTelefonoDelPaciente('+1 619 555 0101').valido).toBe(true)
  })

  it('el teléfono VACÍO es válido: hay pacientes sin teléfono', () => {
    const r = revisarTelefonoDelPaciente('')
    expect(r.valido).toBe(true)
    expect(r.vacio).toBe(true)
  })

  it('enseña el número tal y como lo verá WhatsApp, antes de guardar', () => {
    expect(revisarTelefonoDelPaciente('6641234567').comoSeVera).toBe('+52 664 123 4567')
    expect(revisarTelefonoDelPaciente('5216641234567').comoSeVera).toBe('+52 664 123 4567')
  })

  it('la pantalla bloquea el guardado y enseña la revisión', () => {
    expect(fuente).toMatch(/revisarTelefonoDelPaciente\(f\.telefono\)/)
    expect(fuente).toMatch(/if \(!tel\.valido\)/)
    expect(fuente).toMatch(/Se enviará a \$\{revisionTelefono\.comoSeVera\}/)
  })
})

describe('MP-017 · la edad sale de la fecha de nacimiento, y 0 es una edad', () => {
  it('con fecha puesta, la edad tecleada NO se guarda: se deriva', () => {
    const p = construirGuardadoDePaciente(
      { ...FORM, fechaNacimiento: '2019-03-15', edad: '40' },   // contradicción a mano
      CTX,
    )
    expect(p.edad, 'se guardó la edad tecleada por encima de la fecha').toBe(7)
  })

  it('el lactante conserva su edad: `edad: 0` no es «sin edad»', () => {
    const p = construirGuardadoDePaciente({ ...FORM, fechaNacimiento: '2026-01-10' }, CTX)
    expect(p.edad).toBe(0)
    expect(p.edad).not.toBeUndefined()
  })

  it('probada al revés: SIN fecha, la edad aproximada tecleada sí se guarda', () => {
    expect(construirGuardadoDePaciente({ ...FORM, edad: '68' }, CTX).edad).toBe(68)
    expect(construirGuardadoDePaciente({ ...FORM, edad: '' }, CTX).edad).toBeUndefined()
  })

  it('la lista no esconde al lactante detrás de un `&&`', () => {
    expect(fuente).not.toMatch(/\{p\.edad && <span/)
    expect(fuente).toMatch(/p\.edad != null &&/)
  })
})

describe('ASE-020 · cada campo del formulario tiene su etiqueta asociada', () => {
  it.each([
    ['p-nombre', 'Nombre completo'],
    ['p-telefono', 'Teléfono'],
    ['p-edad', 'Edad'],
    ['p-fecha-nacimiento', 'Fecha de nacimiento'],
    ['p-sexo', 'Sexo'],
    ['p-seguro', 'Servicio médico'],
    ['p-alergias', 'Alergias'],
  ])('«%s» une el <label> con su campo', (id, etiqueta) => {
    expect(fuente, `falta htmlFor="${id}"`).toMatch(new RegExp(`htmlFor="${id}"[^>]*>${etiqueta}`))
    expect(fuente, `falta id="${id}" en el campo`).toContain(`id="${id}"`)
  })
})

describe('D-002 · el botón que sólo dibuja una X tiene nombre', () => {
  it('la X de limpiar la búsqueda se anuncia', () => {
    expect(fuente).toMatch(/aria-label="Limpiar la búsqueda"/)
  })
})

describe('C-023/ASR-020 · la pantalla habla como una persona, y con una sola convención', () => {
  it('no quedan anglicismos de formulario', () => {
    expect(fuente).not.toMatch(/es requerid[oa]/)
    expect(fuente).toMatch(/Falta el nombre del paciente/)
  })

  it('el marcador del nombre ya no impone un orden distinto al del asistente', () => {
    expect(fuente).not.toMatch(/placeholder="Apellido Apellido, Nombre"/)
  })

  it('la edad sólo se exige cuando NO hay fecha de nacimiento', () => {
    expect(fuente).toMatch(/if \(!f\.fechaNacimiento\.trim\(\) && !f\.edad\.trim\(\)\)/)
  })
})
