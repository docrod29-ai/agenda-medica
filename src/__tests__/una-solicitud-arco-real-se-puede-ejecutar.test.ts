/**
 * ASE-010 · ASE-011 · ASE-012 · ASE-026 · C-007 · D-008 (Panel de Lujo 2026-09,
 * auditores AS-expedientes, C y D) — los derechos ARCO estaban escritos, se les
 * contaba el plazo de 20 días hábiles, y no se podían ejercer.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * · **ASE-010** — toda solicitud REAL nace en el portal público, y
 *   `firestore.rules:750-752` le prohíbe traer `patientId` (con razón: si
 *   pudiera, cualquiera desde internet señalaría el expediente de un tercero y
 *   el panel ofrecería suprimirlo de un clic). Las reglas dejan ligarlo después
 *   (:775-786) y **ningún código lo hacía**: `resolverSolicitudArco` sólo manda
 *   `{estado, resolucion, resueltoPor, fechaResolucion}`, y el grep de «arco»
 *   en `expediente/[patientId]/page.tsx` daba 0. El panel mandaba a «ejecutarla
 *   desde su expediente», donde no hay ninguna acción ARCO.
 * · **ASE-011** — «Marcar resuelta» sobre un acceso mandaba
 *   `identidadVerificada: true` escrito a fuego en el cliente (y la MISMA
 *   constante estaba dos veces: acceso y oposición). El servidor documenta que
 *   «el médico afirma que verificó»; el cliente afirmaba por él. La cancelación
 *   —el patrón correcto— sí exigía una casilla real.
 * · **ASE-012 / C-007** — rectificación y revocación caían a un `prompt()`
 *   nativo: se guardaba un texto, y ni el dato se corregía ni el consentimiento
 *   se apagaba. Era el último `prompt()` de `src/app` fuera de comentarios.
 * · **ASE-026** — la entrega de acceso bajaba un `.json` crudo: correcto para el
 *   acuse con hash, dudoso como «copia comprensible» para un paciente de 70.
 * · **D-008** — el badge RECHAZADA usaba el gris literal `#9ca3af` sobre su
 *   propio fondo: 2.16:1 en tema claro, medido por el equipo rojo con
 *   `contraste-wcag.mjs` (en oscuro 6.23 — defecto exclusivo del tema claro).
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-expedientes recorriendo el flujo entero en la app levantada
 * («clics para entregar un ARCO: infinitos»), confirmado por el equipo rojo del
 * otro lado: las tres rutas de servidor sólo hacen `set({estado, …})` y ninguna
 * escritura del cliente incluye `patientId`.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * «Escrito y sin conectar» en su forma más cara: la regla de Firestore abría la
 * puerta, el tipo `ArcoRequest` declaraba el campo, el panel lo leía… y nadie lo
 * escribía nunca. El hueco no rompe ninguna prueba porque el sistema funciona
 * perfectamente: sólo que el derecho no se puede ejercer.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * `data-privacy.md`: «el acceso se ENTREGA (expediente completo + acuse con
 * hash), no se resuelve escribiendo un texto». Art. 29 LFPDPPP: acreditar la
 * identidad del titular es un acto de la clínica, con el documento delante — por
 * eso la afirmación sale de una casilla y queda con nombre y fecha, no de una
 * constante del cliente.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * MIXTA. `porQueNoSePuedeLigar` y `copiaLegibleDeArcoAcceso` son módulos puros y
 * se prueban por COMPORTAMIENTO, al revés incluido. El resto es CONTRATO
 * TEXTUAL sobre `cumplimiento/page.tsx`, declarado: este repo corre vitest en
 * `environment: 'node'`, sin jsdom ni testing-library, y la pantalla necesita
 * ClinicContext, Auth y Firestore para montarse.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre las rutas `api/arco/*` (son de la rebanada de SEGURIDAD: que el
 * servidor exija `identidadVerificada` en vez de confiar en el cliente va en
 * `handoff-EXPEDIENTES.md`). No comprueba que la escritura llegue a Firestore
 * —no hay emulador en esta suite—. No genera PDF: la copia legible es un HTML
 * imprimible, y si eso satisface el «formato legible» del Art. 33 lo decide el
 * abogado del consultorio (queda como NEEDS_LEGAL_REVIEW en el módulo). No
 * cubre el segundo gris literal de D-008 (`configuracion/page.tsx:2551`, de
 * UI-CONFIG).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { porQueNoSePuedeLigar } from '@/lib/compliance/ligar-solicitud-arco'
import { copiaLegibleDeArcoAcceso } from '@/lib/compliance/copia-legible-arco'

const fuente = readFileSync(resolve(process.cwd(), 'src/app/(dashboard)/cumplimiento/page.tsx'), 'utf8')
/** Sin comentarios: lo que se afirma es sobre el CÓDIGO, no sobre lo que cuenta. */
const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('ASE-010 · una solicitud del portal se puede ligar a su expediente', () => {
  it('la sin expediente y abierta SÍ se puede ligar', () => {
    expect(porQueNoSePuedeLigar({ id: 'r1', estado: 'recibida' })).toBeNull()
    expect(porQueNoSePuedeLigar({ id: 'r1', estado: 'en_proceso' })).toBeNull()
  })

  it('probada al revés: no se religa la ya ligada ni se toca la cerrada', () => {
    expect(porQueNoSePuedeLigar({ id: 'r1', estado: 'recibida', patientId: 'p1' })).toMatch(/ya está ligada/i)
    expect(porQueNoSePuedeLigar({ id: 'r1', estado: 'resuelta' })).toMatch(/cerrada/i)
    expect(porQueNoSePuedeLigar({ id: 'r1', estado: 'rechazada' })).toMatch(/cerrada/i)
    expect(porQueNoSePuedeLigar({ estado: 'recibida' })).toMatch(/identificador/i)
  })

  it('la pantalla ofrece «Ligar expediente» y escribe el vínculo', () => {
    expect(codigo).toMatch(/Ligar expediente…/)
    expect(codigo).toMatch(/ligarSolicitudArcoAExpediente\(/)
    // El texto muerto que mandaba a un sitio sin acción ARCO ya no está.
    expect(fuente).not.toMatch(/ejecuta la cancelación desde su expediente/)
  })

  it('para ligar hay que buscar en el SERVIDOR, no en un recorte del directorio', () => {
    expect(codigo).toMatch(/useBusquedaDePacientes\(clinicId, busca\)/)
  })
})

describe('ASE-011 · la identidad la afirma una persona, no una constante', () => {
  it('no queda ningún `identidadVerificada: true` escrito a fuego', () => {
    expect(codigo).not.toMatch(/identidadVerificada:\s*true/)
    expect(codigo).toMatch(/identidadVerificada:\s*identidadOk/)
  })

  it('acceso y oposición se niegan a correr sin la casilla', () => {
    expect(codigo).toMatch(/if \(!identidadOk\) \{[\s\S]{0,200}?entregarle su expediente/)
    expect(codigo).toMatch(/if \(!identidadOk\) \{[\s\S]{0,200}?ejecutar la oposición/)
  })

  it('el botón dice lo que va a pasar, y no lo mismo para los cinco tipos', () => {
    expect(codigo).toMatch(/Entregar su expediente…/)
    expect(codigo).toMatch(/Ejecutar oposición…/)
    expect(codigo).toMatch(/Revocar el consentimiento…/)
    expect(fuente).not.toMatch(/>\s*Marcar resuelta\s*</)
  })
})

describe('C-007/ASE-012 · resolver deja de ser un prompt() del navegador', () => {
  it('no queda ninguna llamada a prompt() en la pantalla', () => {
    expect(codigo).not.toMatch(/\bprompt\s*\(/)
  })

  it('la resolución exige texto: una negativa sin fundamento no se sostiene', () => {
    expect(codigo).toMatch(/if \(!texto\)/)
  })

  it('la revocación APAGA el contacto además de guardar el texto', () => {
    expect(codigo).toMatch(/req\.tipo === 'revocacion'[\s\S]{0,300}?ejecutarOposicion\(req\)/)
  })

  it('la rectificación lleva al editor del paciente, donde el dato se corrige', () => {
    expect(codigo).toMatch(/\/pacientes\?editar=\$\{encodeURIComponent\(porResolver\.req\.patientId\)\}/)
  })
})

describe('ASE-026 · la copia legible sale del mismo paquete y lleva el mismo hash', () => {
  const html = copiaLegibleDeArcoAcceso({
    expediente: {
      paciente: { nombre: 'Ernestina Quiroga Balbuena', fechaNacimiento: '1980-03-15', alergias: '' },
      notas: [{ fecha: '2026-08-01', diagnostico: 'Faringitis aguda' }],
    },
    paqueteHash: 'abc123def456',
    faltantes: [{ seccion: 'laboratorios', motivo: 'no se pudo leer' }],
    entregadoEn: '2026-09-06T18:00:00.000Z',
    consultorio: 'Consultorio de ejemplo',
  })

  it('imprime el hash del paquete y dice a qué archivo corresponde', () => {
    expect(html).toContain('abc123def456')
    expect(html).toMatch(/archivo <code>\.json<\/code>/)
  })

  it('se lee: los datos salen con rótulo en español, no como claves de JSON', () => {
    expect(html).toContain('Ernestina Quiroga Balbuena')
    expect(html).toContain('Fecha nacimiento')
    expect(html).toContain('Faringitis aguda')
  })

  it('lo que no se pudo incluir se DECLARA', () => {
    expect(html).toMatch(/Lo que no se pudo incluir/)
    expect(html).toContain('laboratorios')
  })

  it('el dato vacío se dice «sin dato»: ausencia de dato no es dato de ausencia', () => {
    expect(html).toMatch(/<em>sin dato<\/em>/)
  })

  it('probada al revés: un nombre con HTML dentro no rompe ni inyecta el documento', () => {
    const sucio = copiaLegibleDeArcoAcceso({
      expediente: { paciente: { nombre: '<script>alert(1)</script>' } },
      paqueteHash: 'h', entregadoEn: '2026-09-06T18:00:00.000Z',
    })
    expect(sucio).not.toContain('<script>alert(1)</script>')
    expect(sucio).toContain('&lt;script&gt;')
  })

  it('la pantalla entrega los DOS archivos', () => {
    expect(codigo).toMatch(/arco_acceso_\$\{req\.id\}\.json/)
    expect(codigo).toMatch(/copiaLegibleDeArcoAcceso\(/)
    expect(codigo).toMatch(/_copia_legible\.html/)
  })
})

describe('D-008 · el badge RECHAZADA usa el token medido, no un gris literal', () => {
  it('no queda el hex #9ca3af en la pantalla', () => {
    expect(codigo).not.toMatch(/#9ca3af/i)
    expect(codigo).toMatch(/var\(--badge-gris-t\)/)
    expect(codigo).toMatch(/var\(--badge-gris-b\)/)
  })
})
