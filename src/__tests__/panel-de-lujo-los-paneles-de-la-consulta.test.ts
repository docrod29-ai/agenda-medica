/**
 * LOS PANELES DE LA CONSULTA, DESPUÉS DEL PANEL DE LUJO (2026-09).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Un archivo por hallazgo habría sido un archivo por línea. Estos catorce
 * comparten familia: **el panel afirma algo que nadie evaluó, o pierde lo que
 * el médico capturó**. Cada caso dice cuál es el suyo.
 *
 *   MC-007  ASA arrancaba en «II» sin que nadie lo eligiera —la píldora decía
 *           «ASA II» de fábrica— y la clase elegida no tenía forma de llegar a
 *           la nota. El registro de motores promete lo contrario: «sin clase
 *           seleccionada no devuelve texto (no asume ASA I)».
 *   MC-008  «Es caso quirúrgico» usaba una regex propia SIN frontera de palabra:
 *           «neurología» contiene «urolog», así que a un neurólogo se le forzaba
 *           el panel de cirugía; y traumatología o coloproctología no lo
 *           encontraban ni en el buscador.
 *   MC-013  «Aplicar escalas» REEMPLAZABA la conclusión de riesgo y las
 *           recomendaciones que el cirujano había escrito a mano.
 *   MC-014  El panel de cirugía no veía las alergias: proponía cefazolina por
 *           omisión aunque el expediente dijera alergia a betalactámicos.
 *   MC-017  Los puntajes vivían sólo en memoria y el texto que iba a la nota
 *           daba el total sin decir qué factores se marcaron.
 *   MC-018  La lista de la OMS se llena en el quirófano, no en el consultorio, y
 *           su resumen numérico no nombraba los puntos pendientes.
 *   MG-009  Sin edad capturada, la conducta ante la citología se calculaba con
 *           una edad INVENTADA de 35 años.
 *   MG-011  Una FUM futura contestaba «captura la FUM» —ya estaba capturada— y
 *           un ciclo inválido se sustituía por 28 en silencio.
 *   MG-017  El panel de gineco desaparecía a los 61 años, aunque el tamizaje
 *           cervical del propio motor llega a 65.
 *   MG-022  La gestación vivía en el estado local: cerrar la herramienta borraba
 *           la FUM y el control prenatal empezaba otra vez.
 *   MP-002  `Math.round(edad * 12)` colapsa a 0 en lactantes: la barra de vacunas
 *           callaba justo en la franja con más vacunas.
 *   MP-011  La barra decía «N vacunas atrasadas» en rojo sobre un niño del que la
 *           app no sabe qué se le aplicó — y el propio panel ya había corregido
 *           ese texto.
 *   C-014   La edad gestacional se calculaba con la fecha del navegador en UTC:
 *           después de las 18:00 en México ya es «mañana».
 *   ZC-002  «Alternativa segura: X» — la palabra «segura» la ponía la pantalla
 *           sobre un fármaco que propuso el modelo y que ningún motor cruzó con
 *           las alergias.
 *   ZC-014  Los umbrales de tendencia sin fuente entraban a la nota como
 *           hallazgo, y sin comprobar la unidad.
 *   ZC-015  «Agregar a la nota» copiaba el catálogo de tamizajes sin el organismo
 *           y sin la advertencia de que no se leyó el documento fuente vigente.
 *   ZC-016  El panel hablaba como sistema: «Claude está identificando…»,
 *           «cross-checks», «condición(es)».
 *   ZC-017  La procedencia de cada entidad vivía sólo en un `title`: en el
 *           teléfono y con teclado no se podía ver.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Panel de Lujo 2026-09 (auditores M-cirujano, M-gineco, M-pediatra, C, ZC),
 * todos confirmados por el equipo rojo salvo MC-018 (parcial: esconder o no la
 * pestaña es decisión de producto; lo accionable era el resumen que no nombra lo
 * pendiente).
 *
 * ── CAUSA RAÍZ COMÚN ────────────────────────────────────────────────────────
 *
 * Un panel es una superficie que AFIRMA. Cuando afirma con un valor por omisión
 * (ASA II, edad 35, ciclo 28) o con una palabra que nadie calculó («segura»,
 * «atrasada»), la afirmación llega al médico con el mismo aspecto que un cálculo
 * hecho — y de ahí a la nota firmada hay un clic.
 *
 * ── REGLA ───────────────────────────────────────────────────────────────────
 *
 * clinical-safety §1 (ninguna cifra se inventa: ni una edad, ni un ciclo), §3
 * (nada cambia en silencio), §4 (ausencia de dato no es dato de ausencia) y §5
 * (señalar de menos, nunca de más). Y de `design-system.md`, PROCEDENCIA:
 * lo que escribió la IA enseña de dónde salió, alcanzable con teclado.
 *
 * ── TIPO DE PRUEBA ──────────────────────────────────────────────────────────
 *
 * MIXTA y declarada: comportamiento donde hay una función pura (`troncoDe`,
 * `edadEnMeses`, `hoyISO`), y CONTRATO DE TEXTO sobre el TSX donde lo que se
 * repara es lo que la pantalla pinta —estos componentes no se montan en node—.
 * Cada contrato se escribe contra la forma que la reparación introdujo, así que
 * revertir la reparación lo pone en rojo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * No monta ningún componente ni comprueba píxeles: que el ámbar se vea y que el
 * chip sea alcanzable con TAB lo dice el navegador, y esa comprobación sigue
 * siendo del recorrido manual (`design-system.md`: «no se aprueba una interfaz
 * leyendo el código»). No valida el CONTENIDO clínico de ningún catálogo —ni las
 * conductas ASCCP, ni el esquema de vacunación, ni los tamizajes—: eso es
 * criterio del médico responsable y sigue marcado como pendiente en el registro
 * de motores. No cubre la persistencia de la gestación en el expediente (MG-022
 * queda a medias a propósito: necesita un campo en la paciente, y está en el
 * handoff).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { troncoDe } from '@/lib/herramientas-por-especialidad'
import { edadEnMeses, vacunasSegunEdad } from '@/lib/expediente/pediatria'

const raiz = process.cwd()
const leer = (...p: string[]) => readFileSync(join(raiz, ...p), 'utf8')
const cirugia = leer('src', 'components', 'PanelCirugia.tsx')
const gineco = leer('src', 'components', 'PanelGineco.tsx')
const pediatria = leer('src', 'components', 'PanelPediatria.tsx')
const preventivo = leer('src', 'components', 'PanelPreventivo.tsx')
const ner = leer('src', 'components', 'NerPanel.tsx')
const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

describe('cirugía: no afirma lo que nadie evaluó', () => {
  it('MC-007 · ASA arranca sin clase y sólo se pinta la píldora cuando hay una', () => {
    expect(cirugia).toMatch(/useState\(estadoInicial\?\.clase \?\? ''\)/)
    expect(cirugia).toMatch(/clase !== '' && \(\s*\n?\s*<span style=\{pill/)
    expect(cirugia).toContain('Sin evaluar')
  })

  it('MC-007 · la clase elegida puede llegar a la nota', () => {
    expect(cirugia).toMatch(/asaTexto\(clase, urgencia\)\}[\s\S]{0,120}Agregar a la nota|Estado físico \$\{asaTexto/)
  })

  it('MC-008 · el tronco decide, y «neurología» ya no es cirugía', () => {
    expect(troncoDe('Neurología')).not.toBe('cirugia')
    expect(troncoDe('Traumatología y ortopedia')).toBe('cirugia')
    expect(troncoDe('Coloproctología')).toBe('cirugia')
    expect(troncoDe('Angiología')).toBe('cirugia')
    expect(consulta).toContain("troncoDe(especialidadEfectiva) === 'cirugia'")
  })

  it('MC-013 · aplicar escalas ANEXA, no reemplaza lo escrito a mano', () => {
    expect(consulta).toMatch(/if \(previo\.includes\(nuevo\.trim\(\)\)\) return s/)
    expect(consulta).toMatch(/no se borró nada/)
  })

  it('MC-014 · el panel recibe las alergias y avisa antes de proponer', () => {
    expect(cirugia).toMatch(/alergias\?: readonly string\[\]/)
    expect(cirugia).toContain('alergiaBetalactamicos')
    expect(consulta).toMatch(/alergias=\{alergenosDe\(patient \?\? \{\}\)\}/)
  })

  it('MC-017 · lo capturado sobrevive a cerrar la herramienta y el total dice qué factores lleva', () => {
    expect(cirugia).toContain('onCambioDeEstado')
    expect(cirugia).toMatch(/factores\('Factores', rc\)/)
    expect(consulta).toContain('estadoDeCirugia')
  })

  it('MC-018 · la lista de la OMS sólo donde hay quirófano, y nombra lo que falta', () => {
    expect(cirugia).toContain('mostrarChecklist')
    expect(cirugia).toMatch(/Sin marcar: \$\{pendientes\.join/)
    expect(consulta).toMatch(/mostrarChecklist=\{tipo === 'nota_postoperatoria' \|\| !!internamientoActivo\}/)
  })
})

describe('gineco: sin dato no se calcula', () => {
  it('MG-009 · sin edad no hay conducta cervical (ya no se inventa 35 años)', () => {
    expect(gineco).not.toMatch(/conductaCervical\(cito, vph, edadAnios \?\? 35\)/)
    expect(gineco).toMatch(/edadAnios != null \? conductaCervical\(cito, vph, edadAnios\) : null/)
    expect(gineco).toMatch(/Falta la edad de la paciente/)
  })

  it('MG-011 · la FUM futura y el ciclo inválido se dicen con su nombre', () => {
    expect(gineco).toContain('fumEnElFuturo')
    expect(gineco).toMatch(/posterior a hoy/)
    expect(gineco).toContain('cicloValido')
    expect(gineco).toMatch(/no es una duración de ciclo válida/)
  })

  it('MG-017 · el panel ya no desaparece a los 61 años', () => {
    expect(consulta).not.toMatch(/patient\?\.edad \?\? 0\) <= 60/)
    expect(consulta).toMatch(/const esGineco = \/\^f\/i\.test\(patient\?\.sexo \?\? ''\) && \(patient\?\.edad \?\? 0\) >= 10/)
  })

  it('MG-022 · la gestación capturada sube a la consulta y vuelve al panel', () => {
    expect(gineco).toContain('onCambioDeGestacion')
    expect(gineco).toContain('gestacionInicial')
    expect(consulta).toContain('gestacionDeLaConsulta')
  })

  it('C-014 · el panel calcula con la fecha del consultorio, no con la del navegador en UTC', () => {
    expect(gineco).not.toContain("new Date().toISOString().slice(0, 10)")
    expect(gineco).toMatch(/hoyProp \?\? hoyISO\(zonaActiva\(\)\)/)
    expect(pediatria).not.toContain("new Date().toISOString().slice(0, 10)")
  })
})

describe('pediatría: la edad en meses es la de verdad', () => {
  it('MP-002 · un lactante de 11 meses no es «0 años» para el esquema', () => {
    // El motor puro: la barra llamaba con 0 y no devolvía nada.
    expect(vacunasSegunEdad(0).filter(v => v.estado === 'atrasada')).toHaveLength(0)
    expect(vacunasSegunEdad(11).length).toBeGreaterThan(0)
    // Y la derivación que ahora usa la barra sí da 11 meses.
    expect(edadEnMeses('2025-10-06', '2026-09-06')).toBe(11)
    expect(consulta).toContain('edadEnMesesDelPaciente')
    // La barra ya no llama al motor con `edad * 12`: eso queda sólo como último
    // recurso cuando NO hay fecha de nacimiento, y entonces no hay nada mejor.
    expect(consulta).toMatch(/if \(patient\?\.fechaNacimiento\) return edadEnMeses\(patient\.fechaNacimiento, hoyDeLaConsulta\)/)
    expect(consulta).not.toMatch(/vacunasSegunEdad\(Math\.round\(patient\.edad \* 12\)\)/)
  })

  it('MP-011 · la barra dice «corresponden por edad», no «atrasadas» en rojo', () => {
    expect(consulta).toContain('vacunasQueCorresponden')
    expect(consulta).toMatch(/corresponde\$\{vacunasQueCorresponden > 1 \? 'n' : ''\} por edad · verifica cartilla/)
    expect(consulta).not.toMatch(/atrasada\$\{vacunasAtrasadas/)
  })

  it('MP-008 · del cálculo por peso se puede recetar, con la dosis que elige el médico', () => {
    expect(pediatria).toContain('onRecetar')
    expect(pediatria).toContain('dentroDelRango')
    expect(pediatria).toMatch(/procedenciaClinica: 'se_prescribe_hoy'/)
    expect(consulta).toMatch(/onRecetar=\{med => setMedicamentos/)
  })
})

describe('preventivo y entidades: lo que se afirma se puede defender', () => {
  it('ZC-014 · el umbral sin fuente lo dice, y la unidad viaja con el dato', () => {
    expect(preventivo).toMatch(/umbral orientativo, sin fuente citada/)
    expect(preventivo).toMatch(/\$\{analito\} \(\$\{unidad \|\| 'unidad no capturada'\}\)/)
  })

  it('ZC-015 · el tamizaje que entra a la nota lleva su organismo y su advertencia', () => {
    expect(preventivo).toMatch(/t\.organismo \? `, \$\{t\.organismo\}` : ''/)
    expect(preventivo).toMatch(/Catálogo orientativo: verificar la vigencia/)
  })

  it('ZC-002 · la alternativa del modelo ya no se llama «segura»', () => {
    expect(ner).not.toContain('Alternativa segura')
    expect(ner).toMatch(/Alternativa que propone el modelo/)
    expect(ner).toMatch(/sin verificar/)
  })

  it('ZC-016 · el panel habla como persona, no como sistema', () => {
    expect(ner).not.toContain('Claude está identificando')
    expect(ner).not.toContain('cross-checks')
    expect(ner).not.toContain('condición(es)')
    expect(ner).toContain('Leyendo la nota…')
    expect(ner).toMatch(/No se pudo leer la nota/)
  })

  it('ZC-017 · la procedencia de cada entidad es alcanzable, no un tooltip', () => {
    expect(ner).toContain('ChipConCita')
    expect(ner).toMatch(/<button[\s\S]{0,200}aria-expanded=\{abierta\}/)
    expect(ner).toMatch(/En el dictado: «\{cita\}»/)
    // Ya no queda ningún chip cuya única procedencia sea el `title`.
    expect(ner).not.toMatch(/title=\{[a-z]\.source_quote\}/)
  })
})
