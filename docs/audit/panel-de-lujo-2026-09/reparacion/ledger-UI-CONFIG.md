# Ledger de reparación — UI-CONFIG

Rama: `reparacion/UI-CONFIG` · worktree aislado · 6-sep-2026.

Los ids son los del Panel de Lujo, no REG: el orquestador asigna los `REG-nnn`
al integrar. Estado `CLOSED` significa que el defecto ya no ocurre y que hay una
prueba que **falla sin el arreglo**. Lo que quedó a medias está en la columna
Incidente, dicho, y su otra mitad vive en `handoff-UI-CONFIG.md` o en
`no-reparado-UI-CONFIG.md` — nunca en los dos silencios a la vez.

| ID | Área | Incidente | Estado | Test / control permanente |
|---|---|---|---|---|
| ZC-001 | Componentes · alertas | El fallo al leer las alertas del episodio pintaba el mismo hueco que «no hay alertas»: el potasio crítico desaparecía sin aviso | CLOSED | `src/__tests__/no-se-pudo-leer-no-es-no-hay-nada.test.ts` · `src/__tests__/la-alerta-tiene-quien-la-lea.test.ts` |
| ZC-004 | Componentes · expediente | Igual con los pendientes del paciente: un «resultado sin leer» se perdía en silencio | CLOSED | `src/__tests__/no-se-pudo-leer-no-es-no-hay-nada.test.ts` |
| ZC-005 | Componentes · expediente | Igual con los ingresos hospitalarios: se leía como «nunca estuvo internado» | CLOSED | `src/__tests__/no-se-pudo-leer-no-es-no-hay-nada.test.ts` |
| ZC-006 | Hoy · continuidad | `catch` vacío y «worklist» en inglés en la barra del médico | CLOSED | `src/__tests__/no-se-pudo-leer-no-es-no-hay-nada.test.ts` |
| C-010 | Hospitalización | El tablero pintaba «0 internados» tras un fallo de lectura | CLOSED | `src/__tests__/no-se-pudo-leer-no-es-no-hay-nada.test.ts` |
| C-037 | Facturación · asientos | La sección desaparecía si fallaba la lectura, igual que si no hubiera cobro por asiento | CLOSED | `src/__tests__/no-se-pudo-leer-no-es-no-hay-nada.test.ts` |
| C-020 | Toda la app | 45 avisos que empiezan por «Error…»; los 20 de esta rebanada, reescritos | CLOSED (parcial declarado) | `src/__tests__/la-pantalla-habla-como-persona.test.ts` (trinquete, techo 25) |
| C-021 | Configuración | Mensajes crudos de Firebase llegaban a la pantalla del médico | CLOSED | `src/__tests__/la-pantalla-habla-como-persona.test.ts` |
| C-022 | Login y registro | El código `auth/…` de Firebase salía a pantalla | CLOSED | `src/__tests__/la-pantalla-habla-como-persona.test.ts` |
| ZC-020 | /motores | Un motor que revienta se pintaba con la palomita del éxito y el texto de la excepción | CLOSED | `src/__tests__/la-pantalla-habla-como-persona.test.ts` |
| ZC-021 | Aviso de configuración | «Detalle técnico: permission-denied» en inglés de Firebase | CLOSED | `src/__tests__/la-pantalla-habla-como-persona.test.ts` |
| ZC-024 | Demo pública | `String(e)` («TypeError: Failed to fetch») al visitante | CLOSED | `src/__tests__/la-pantalla-habla-como-persona.test.ts` |
| ZC-011 | Herramientas clínicas | Buscador sin etiqueta y «N resultado(s)» | CLOSED | `src/__tests__/cada-campo-dice-como-se-llama.test.ts` · `la-pantalla-habla-como-persona.test.ts` |
| ZC-019 | Cinco componentes | Fechas clínicas en la zona del navegador, no del consultorio | CLOSED | `src/__tests__/no-se-pudo-leer-no-es-no-hay-nada.test.ts` (vía `fechaCorta`/`fechaConHora`) |
| C-038 | Brazalete impreso | La fecha de ingreso salía en la zona del navegador que imprimió | CLOSED | mismo formateador único (`src/lib/formato/fecha.ts`) |
| C-025 | Cinco pantallas | Campos cuya única etiqueta era el `placeholder` | CLOSED | `src/__tests__/cada-campo-dice-como-se-llama.test.ts` |
| ASM-025 | Configuración · mensajes | `<label>` sin `htmlFor` y campos sin `id` en toda la pestaña | CLOSED | `src/__tests__/cada-campo-dice-como-se-llama.test.ts` |
| ZC-012 | Panel de enfermería | Doce selectores sin nombre; ingresos/egresos sin asociar (y mal asociados por el arreglo automático, corregido a mano) | CLOSED | `src/__tests__/cada-campo-dice-como-se-llama.test.ts` |
| D-004 | Hospital y UCI | 42 campos sin etiqueta programática | CLOSED (con trinquete) | `src/__tests__/cada-campo-dice-como-se-llama.test.ts` (techo 81) |
| C-026 | `ui/Tabs` | Pestañas pintadas como botones sueltos: sin `tablist`, `tab`, `aria-selected` ni teclado | CLOSED | `src/__tests__/cada-campo-dice-como-se-llama.test.ts` |
| D-006 | `globals.css` | El mínimo táctil llegaba de alto pero no de ancho a los botones de sólo icono | CLOSED | `src/__tests__/cada-campo-dice-como-se-llama.test.ts` |
| **MP-003** | **Pediatría (P1)** | **El copiloto elegía «Gentamicina neonatal (≤7 días)» por subcadena para cualquier niño: alarma crítica falsa en un escolar y pauta de adulto para un recién nacido** | **CLOSED** | `src/__tests__/la-pauta-neonatal-no-es-la-de-un-escolar.test.ts` (movida de `REP-052`) · `src/__tests__/pediatria.test.ts` |
| MG-010 | Ginecología | La cuenta gestacional sin techo ni ciclo acotado: «105 semanas · 3.º trimestre» pegable a la nota | CLOSED | `src/__tests__/el-silencio-clinico-lleva-etiqueta.test.ts` |
| MG-021 | Ginecología | Hitos prenatales con dosis y sin fuente por renglón; el estado «pendiente de validación» no se decía | CLOSED | `src/__tests__/el-silencio-clinico-lleva-etiqueta.test.ts` |
| MG-018 | Especialidades | El antibiograma no salía por defecto en gineco-obstetricia | CLOSED | `src/__tests__/el-silencio-clinico-lleva-etiqueta.test.ts` |
| MI-007 | Farmacovigilancia | Ocho fármacos, cero alertas y ninguna declaración de qué se vigiló | CLOSED | `src/__tests__/el-silencio-clinico-lleva-etiqueta.test.ts` |
| MI-008 | Expediente | «No toma el losartán desde hace un mes» no se reconocía como suspensión | CLOSED | `src/__tests__/el-silencio-clinico-lleva-etiqueta.test.ts` |
| MI-013 | Farmacia | La dispensación no cruzaba la alergia del paciente | CLOSED | `src/__tests__/el-silencio-clinico-lleva-etiqueta.test.ts` |
| MP-015 | Avisos de consulta | La dosis crítica pesaba lo mismo que «medicamento controlado» y esperaba su turno | CLOSED | `src/__tests__/el-silencio-clinico-lleva-etiqueta.test.ts` (vía `manda`) |
| MP-010 | Pediatría | Una fecha ilegible daba `0` meses y sembraba un recién nacido | CLOSED | `src/__tests__/el-enlace-del-paciente-no-se-queda-en-el-telefono.test.ts` · `pediatria.test.ts` |
| ZC-003 | Panel de enfermería | Braden nacía en 23 («sin riesgo») y Morse en 0, con «Guardar» habilitado sin tocar nada | CLOSED | `src/__tests__/cada-campo-dice-como-se-llama.test.ts` (selectores) · el estado nace vacío y Guardar exige los seis ítems |
| C-001 | Configuración · portal | «Mensaje para pacientes» se guardaba y el paciente nunca lo veía | CLOSED (la promesa; la conexión, en handoff) | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| C-002 / ASM-016 | Configuración | «Hora de resumen diario»: campo con interfaz y cero lectores | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| C-003 | Configuración · recetas | El interruptor de signos vitales en órdenes no cambiaba nada | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| C-004 | Configuración · recetas | «y cuántas copias salen» sin control; dos campos verificados que nadie escribe | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| ASM-015 | Configuración · plantillas | La «vista previa de lo automático» enseñaba el texto de los botones manuales | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| ASM-018 | Configuración · avisos | Mandaba a conectar WhatsApp en una pestaña que no existe | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| N-008 | Suscripción | «Todas las funciones» con la IA topada en la prueba | CLOSED (el texto; el medidor, en `no-reparado`) | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| N-010 | Suscripción | El cliente anual veía un precio mensual | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| N-011 | Registro | En el teléfono no quedaba ni una palabra de «14 días · sin tarjeta · desde $349» | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| N-012 | Operaciones | «Mensajes con pacientes» abría el chat interno del equipo | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| N-013 | Operaciones | El CRM prometía «de dónde llegan los pacientes» sin un solo dato de origen | CLOSED (el rótulo; sellar el origen, en handoff) | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| N-017 | Alta | Contador de pasos de un asistente que ya no tiene pasos | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| N-018 | Registro | La puerta vendía el producto de hace dos versiones | CLOSED (una lista compartida, en handoff) | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| C-028 | `/operacion` pública | «Membresías: roadmap» de un módulo vivo que cobra cuotas | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| C-013 | Camas | «Eliminar cama» borraba al primer clic y sin capturar el error | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| C-031 | Superadmin | `alert()` y `window.confirm()` nativos, los únicos del producto | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| C-036 | Benchmark de voz | «Empezar de cero» borraba las frases grabadas sin confirmar | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| ZC-008 | Aviso de privacidad | «Descargar PDF/texto» bajaba un `.txt` | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| ZC-009 | Aviso de privacidad | Desde el escritorio se podía asentar «aceptó en el portal» o «por WhatsApp» sin ninguna referencia a ese hecho | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| RT-007 | Consultor | «✓ N citas verificadas contra las fuentes» sin haber leído un artículo | CLOSED (el texto; enchufar `verificarAfirmaciones`, en handoff) | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| PC-010 | Ayuda | Afirmaba que el acceso del cuidador existe con bitácora y revocación | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| ASC-006 | Navegación | La asistente, que cobra y hace el corte, no tenía enlace a Finanzas | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| ASE-018 | Navegación | Migración y Documentos legales sólo existían en modo médico | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| D-014 | Navegación | El mismo destino se llamaba de tres formas según la barra | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` (guardián de choque de nombres) |
| D-024 | Sidebar | Once entradas `modos: 'medico'` que ningún usuario puede ver | CLOSED (documentado, no recortado) | mismo archivo, cabecera del `NAV` |
| ZC-023 | Vista previa de receta | Marco `#1a2333` fijo aunque el tema fuera claro | CLOSED | `src/__tests__/lo-que-la-pantalla-promete-lo-cumple.test.ts` |
| MC-011 | Fotografía clínica | La foto subía con su EXIF (GPS, dispositivo) y fallaba con un mensaje que habla de PDF | CLOSED | `src/__tests__/el-enlace-del-paciente-no-se-queda-en-el-telefono.test.ts` |
| MC-012 | Fotografía clínica | Decía «requiere consentimiento» y no lo pedía, ni lo registraba, ni lo comprobaba | CLOSED (la compuerta; el registro, en handoff) | `src/__tests__/el-enlace-del-paciente-no-se-queda-en-el-telefono.test.ts` |
| MO-008 | Fotografía clínica | Sin articulaciones como región y sin fecha de la toma | CLOSED | `src/__tests__/el-enlace-del-paciente-no-se-queda-en-el-telefono.test.ts` |
| ZC-007 | Cierre de consulta | «Registrar el cobro»: botón deshabilitado sin explicación y sin salida | CLOSED | `src/__tests__/el-enlace-del-paciente-no-se-queda-en-el-telefono.test.ts` |
| PC-017 | Service worker | El HTML de `/mi/<token>` se cacheaba con el token como clave | CLOSED | `src/__tests__/el-enlace-del-paciente-no-se-queda-en-el-telefono.test.ts` |
| A-007 | Service worker | Lista de rutas sensibles escrita a mano, ya desincronizada (`valoracion` no existe) y sin nadie que la compare | CLOSED | `src/__tests__/el-enlace-del-paciente-no-se-queda-en-el-telefono.test.ts` |
| PI-019 | Rutas de paciente | Un botón flotante de tema acompañaba al paciente | CLOSED | `src/__tests__/el-enlace-del-paciente-no-se-queda-en-el-telefono.test.ts` |
| ASR-012 | 404 | A un paciente con un enlace partido se le hablaba de «caché» y de «el dashboard» | CLOSED | `src/__tests__/el-enlace-del-paciente-no-se-queda-en-el-telefono.test.ts` |
| PO-019 | 404 | Sin camino para el paciente que busca a su médico | CLOSED | `src/__tests__/el-enlace-del-paciente-no-se-queda-en-el-telefono.test.ts` |

## Fuera de la lista, pedido por el orquestador

| Qué | Estado | Control |
|---|---|---|
| `npm run mantenimiento` — citado en `CLAUDE.md` y sin existir | CLOSED | `scripts/mantenimiento/chequeo.mjs` (8 puntos, sólo lectura) y el guardián de `lo-que-la-pantalla-promete-lo-cumple.test.ts`, que exige que **todo** comando citado en la carta exista |

## Piezas nuevas que quedan para quien venga después

- `src/components/ui/NoSePudoLeer.tsx` — el estado «no se pudo leer», escrito una vez.
- `src/lib/texto-es.ts` — `plural`, `enEspanolLlano`, `noSePudo`: cómo suena el
  producto en español de México, en un solo sitio.
- `src/lib/navegacion/etiquetas.ts` — una ruta, un nombre.
- `src/lib/expediente/pediatria.ts` — `edadEnDias` y `elegirFarmacoPed`.
- `scripts/mantenimiento/chequeo.mjs` — el chequeo de ocho puntos.
