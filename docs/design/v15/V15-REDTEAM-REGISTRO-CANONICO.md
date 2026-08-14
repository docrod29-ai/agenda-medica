# V15-ORIGINALITY-REDTEAM-001 — registro CANÓNICO de defectos

> **Creado 13-ago-2026** al unificar los dos registros que dejaron las dos
> corridas concurrentes del panel (§39: quedó registrado; consolidación por
> merge, sin force-push):
>
> - **Panel A** (3 revisores): `docs/design/v15/ORIGINALITY-REDTEAM-001-veredicto.md`, IDs `ORT-01..21`.
> - **Panel B** (4 revisores): `docs/design/V15_ORIGINALITY_REDTEAM_VEREDICTO.md`, IDs `RT-01..22`.
>
> Los dos veredictos se CONSERVAN como actas (scores §29 por superficie,
> refutaciones, método); **la cola de reparación vive AQUÍ y sólo aquí**.
> El mapeo se hizo por CONTENIDO: los paréntesis de los ORT (RT-xx/DS-xx/
> CW-xx) citan los informes internos del panel A, no los RT del panel B —
> la coincidencia de prefijo era una trampa y por eso este archivo existe.
>
> Severidad reconciliada: donde A y B divergieron, manda el dolor clínico
> primero (§43: seguridad sobre orden) y lo estructural después; la columna
> «Origen» conserva la trazabilidad hacia los dos registros viejos.

## Estado de la compuerta §29/§34

Ningún score consolidado cumplía `GENERIC_AI_LOOK ≤ 1` (mejor: Pendientes
2–3; peor: Pacientes/Operaciones 7) y la compuerta quedó **FAIL** hasta pagar
los P1 de este registro.

**14-ago-2026:** pagados los DOS P0 y NUEVE de los diez P1 (RTC-03, RTC-04,
RTC-05, RTC-06, RTC-07, RTC-08, RTC-09, RTC-10, RTC-11), cada uno con guardián
probado al revés y verificación en navegador real. Del décimo (RTC-12) se midió
que su mitad de identidad **no se reproduce** —y quedó con candado— y su mitad
estructural queda declarada como deuda del monolito con dueño. La compuerta
§29/§34 pide **re-puntuar las superficies** (§29) sobre capturas nuevas antes de
declararse PASS: los pagos están hechos, el score no se hereda de la corrida
que los encontró. Los dos paneles COINCIDEN en las refutaciones: no
hay imitación de competidor, §14 PASS (4+1 destinos), las superficies se
distinguen entre sí en gris, y la cola de cierre de Pendientes es la semilla
de identidad del producto (único Logo-off PASS).

## Registro (RTC-xx, orden = prioridad de pago)

Estado: `FIXED` = reparado con guardián y ledger · `PAGADO` = reparado en
una corrida del panel · `PARCIAL` = primera tanda pagada · `OPEN`.

### Cerrados

| ID | Sev | Origen | Defecto | Estado |
|---|---|---|---|---|
| RTC-01 | P0 | ORT-01 | Séptima copia de la negación de alergias en `PatientAnchor` + dos criterios contradictorios en el viewport de /consulta | **FIXED** — REG-311, sello 4569 |
| RTC-02 | P0 | RT-01 | La vara de genericidad no podía medir lo que decía medir (contaba clases Tailwind en código 88,5 % inline); genericidad sin trinquete | **FIXED 13-ago** — contadores `gradientes`/`cristal`/`halosDeColor` en `trinquete-de-diseno.mjs`, techos sellados sólo-baja (16/16/9), corrección escrita en `GENERIC_AI_AESTHETIC_AUDIT.md`; el degradado morado literal murió con la primera tanda |
| RTC-03 | P1 | RT-08 | Ventana de clic ciego en la coreografía de continuidad: pantalla vieja pintada, DOM nuevo debajo (≤1200ms) → riesgo de PACIENTE EQUIVOCADO desde una worklist | **FIXED 13-ago** — REG-312: candado `data-vt-congelada` (pointer-events none en `<body>`) con `finally`, tope 1200→400ms, guardián probado al revés ×2, sello 4575 |
| — | P1 | RT-03 | Héroe móvil de Hoy sin breakpoint (identidad en columna de ~110px) | **PAGADO** — wrap ≤560px, verificado en navegador (acta-heroe-movil.json) |
| RTC-04 | P1 | ORT-06 | Banner de cobro a peso íntegro DENTRO del modo encuentro (sobre la franja de alergia); ni él ni la pila de avisos del layout se suscriben a `EVENTO_GRABANDO` (§8.5) | **FIXED 13-ago** — compuerta COMPARTIDA `@/hooks/useGrabando` (las 2 copias privadas de FlowRail/BottomNav mueren; RTC-05 la consumirá) + `PilaDeAvisosAdmin` en el layout: los 5 avisos admin desaparecen al grabar y VUELVEN al detener; OfflineBanner/AvisoIncidenteIA quedan FUERA (degradación ≠ admin). Guardián `v15-avisos-se-aquietan-al-grabar.test.ts` probado al revés (6/9 rojos sin el arreglo); navegador real desktop+móvil con offline simulado DURANTE la grabación (acta-avisos-quietos.json, PASS) |
| RTC-06 | P1 | ORT-05 + RT-11 | Hoy: dos CTA primarios co-iguales; 7 botones rellenos idénticos; el saludo (32px display) pesaba más que el NOW | **FIXED 13-ago** — UN relleno primario en la pantalla: el CTA clínico del héroe («Iniciar consulta»); «Nueva cita» a `variant="secondary"`; «Consulta» por fila a `btn-secondary` (misma conducta, otro peso); saludo a KICKER (15px, `--text2`, sigue siendo `<h1>`), con el achique móvil `main h1` excluyéndolo (lo AGRANDABA a 19px). Guardián `v15-hoy-una-primaria-clinica.test.ts` probado al revés (5/6 rojos); navegador real desktop+móvil con getComputedStyle: 0 `.btn-primary`, héroe relleno único, saludo 15px en ambos viewports (acta-hoy-una-primaria.json, PASS, 0 errores de consola) |
| RTC-05 | P1 | RT-06 + ORT-14 | Dos FAB permanentes (ayuda 52px estilo Intercom + tema 44px) sobre TODA pantalla clínica; no suscritos a `EVENTO_GRABANDO`; en móvil ocluyen contenido en 4/6 superficies; glassmorphism en el toggle; parches por-pantalla con números mágicos | **FIXED 13-ago (3ª corrida)** — los dos consumen `@/hooks/useGrabando` y devuelven null al grabar (vuelven al detener, medido ida y vuelta); en MÓVIL ninguno flota: ayuda = botón estático de la topbar (44×44, fuera del arco del pulgar, cero oclusión; abre el panel real por `EVENTO_ABRIR_AYUDA`, declarado UNA vez) y tema = fila «Apariencia» de /operaciones (§11); el tema ganó UNA fuente de verdad (`@/hooks/useTema`, dos vistas sincronizadas por evento); el cristal del toggle murió (fondo sólido; trinquete `cristal` 16→14) y el halo teal del FAB también (`halosDeColor` 9→8); murieron los parches de números mágicos (bottom 78/136). Guardián `v15-rtc05-fabs-quietos.test.ts` probado al revés (6/6 rojos); navegador real desktop+móvil despachando `nx:grabando` (acta-pulgar-y-fabs.json, PASS, 0 errores de consola) |
| RTC-07 | P1 | ORT-04 + RT-11 (móvil) | Shell móvil: la acción del pulgar (FAB central) corona «Nueva cita» (admin) en Hoy/Pendientes/Operaciones; en Hoy «+ Nueva cita» con énfasis máximo 2× en el primer viewport | **FIXED 13-ago (3ª corrida)** — la CORONA (círculo relleno elevado, §8.6) sólo se pinta cuando la acción central ES clínica (`centralCoronada`: la consulta de ESE paciente); fuera de contexto clínico «Nueva cita» conserva posición/href/táctil pero pesa como destino normal Y se aquieta al grabar (`iconoAtenuado(quieto, coronada)` — medido 0.4 grabando; la coronada mide 1); el CTA del header de Hoy se SUPRIME en móvil (la acción ya vive en el pulgar) y se conserva en escritorio. Alcance: shell V15 del médico — la barra de Secretaria conserva su corona («Nueva cita» ES su trabajo primario). Guardián `v15-rtc07-accion-del-pulgar-clinica.test.ts` probado al revés (4/5 rojos); navegador real /dashboard + /expediente móvil (acta-pulgar-y-fabs.json, PASS) |
| RTC-08 | P1 | ORT-03 + RT-04 | Destino «Encuentro» del riel no es un lugar: sin encuentro activo → `/pacientes` y se ilumina «Paciente» (falla la pregunta de §15 en su primer uso) | **FIXED 14-ago (5ª corrida)** — el riel tiene TRES respuestas y ninguna es el silencio: estás dentro (activo, como siempre) · hay uno abierto y lo RETOMA · no hay ninguno y lo DICE en su nombre accesible. El estado no se inventó: `@/lib/nav/encuentro-abierto` lo lee del respaldo local que la consulta YA escribía mientras se dicta (un encuentro abierto es lo que este médico hace en ESTE dispositivo; lo que quedó a medias en otro equipo es Seguimiento, que es otro destino). Saca IDs y sello de tiempo, **ni un dato clínico** — la barra de navegación no es sitio para PHI —, y un respaldo ilegible sigue contando (esconder una consulta a medias es el caso que más duele). La señal es un punto sólido con su color en la HOJA, no en el riel: el guardián de Fase 10 exige que el acento viva en las reglas compartidas y volvió a verde sin tocarlo. Guardián `v15-rtc08-encuentro-es-un-lugar.test.ts` (10 casos, 6 de ellos CONDUCTUALES sobre el módulo real; probado al revés: 3 rojos); navegador real recorriendo el ciclo entero —sin encuentro → abrir y escribir → salir a Hoy → retomar— (acta-rtc08.json, 13/13 PASS, 0 errores de consola): **«Paciente» ya no se ilumina al pedir «Encuentro»** |
| RTC-09 | P1 | ORT-02 + RT-09 | Operaciones: grupo «CLÍNICO» (Consultor IA, Antibiograma) dentro del área admin; «Consultor IA» es página-módulo de IA feature-first — la antítesis de §3.2 y del propio copy de la pantalla | **FIXED 14-ago (4ª corrida)** — el grupo «Clínico» MURIÓ. Consultor y Antibiograma se declaran UNA vez en `@/lib/nav/capacidades-del-paciente` y viven en la barra de Herramientas del EXPEDIENTE (el encuentro ya lo hacía así: embebía `AntibiogramaTool` y abría el consultor con `?paciente=` — esto termina de aplicar el patrón, no lo inventa): el consultor se abre LLEVANDO al paciente, el antibiograma se USA ahí mismo sin navegar. Hospitalización/UCI se quedan en el índice secundario (§11) con el nombre de lo que son —«Hospital y UCI», otro escenario de atención, ALPHA tras bandera— y el copy de la pantalla dejó de prometer sólo «lo administrativo». Ninguna ruta se borró. Guardián `v15-rtc09-ia-contextual.test.ts` (7 casos, probado al revés: 4 rojos); el freeze de los 20 destinos y el de alcanzabilidad pasan a contar las DOS casas leyendo la declaración, no una lista a mano. Navegador real desktop+móvil (acta-rtc09-rtc11.json, 23/23 PASS, 0 errores de consola) |
| RTC-10 | P1 | ORT-07 + RT-02 | Expediente: primer viewport sin un solo dato clínico (fila de exportación + 3 KPI-cards, 2 VACÍAS; historia bajo el pliegue ~675px); sin Clinical Spine real (§7): pila de cajas-módulo | **FIXED 14-ago (6ª corrida)** — el orden de la página dice ahora lo que la pantalla ES: identidad → estado → pendientes → historia → utilidades → documentos. Los tres botones de documentos/exportación bajaron al final con nombre propio («Documentos y exportación»), conservando conducta y avisos de lo que cada formato NO lleva; las tarjetas de signos y dx sólo se pintan CON contenido y su ausencia se dice en una línea que habla del REGISTRO («este expediente todavía no tiene … registrados»), no del paciente — regla 4 de seguridad clínica en las dos direcciones; las dos cajas-módulo plegadas (contacto, herramientas) bajaron bajo la historia; y el riel del Clinical Spine sigue el orden VISUAL (un índice que anuncia otro orden manda al médico abajo para volver a subir). Medido en navegador antes/después con el MISMO instrumento sobre los 3 expedientes sembrados (1440×900): pendientes **775px bajo el pliegue → 492px antes de la historia**, cajas-módulo sobre la historia **2 → 0**, tarjetas vacías **2 → 0**, export sobre la historia **3 → 0**. Guardián `v15-rtc10-primer-viewport-clinico.test.ts` (8 casos, probado al revés ×2: 2 rojos por las tarjetas, 1 por el orden). Actas: `docs/design/capturas/v15-rtc10/medicion-{baseline,despues}.json` |
| RTC-11 | P1 | ORT-08 + RT-13 (móvil) | Pacientes móvil: identidad rota (nombre en 3 renglones en columna ~90px, teléfono partido, «Editar» intacto) — defecto #13 de la DNA reaparecido | **FIXED 14-ago (4ª corrida)** — la fila tiene variante MÓVIL: bajo 768px «Editar» (datos de CONTACTO: administrativo) y el chevron decorativo salen, y la identidad se queda con el ancho. Medido en navegador: **de 3 renglones en ~90px a 1 renglón en 228px**; en escritorio «Editar» sigue pintado (variante, no amputación). La capacidad se MUEVE, no se ampu­ta: «Editar datos» del expediente hacía `push('/pacientes')` —un viaje que no llegaba: te soltaba en la lista con el editor cerrado— y ahora abre `?editar=<id>`, que la lista obedece. `!important` en la regla porque los dos elementos declaran su `display` en línea (la trampa que el arnés cazó en RTC-05). Guardián `v15-rtc11-fila-paciente-movil.test.ts` (5 casos, probado al revés: 3 rojos); navegador real 390+1440 (acta-rtc09-rtc11.json, 23/23 PASS) |
| RTC-12 | P1 | RT-07 | Ninguna superficie usa el lienzo de escritorio: columna única 880–1100px en todas; en consulta a 1440 el paciente se pierde al desplazar | **PARTIDO 14-ago (6ª corrida), medido en navegador.** (b) «el paciente se pierde al desplazar»: **NO SE REPRODUCE** — con el `<main>` desplazado 1500 de 2549px reales en /consulta a 1440, la identidad SIGUE a la vista, porque el `InstrumentStrip` (Capa 1, §5) vive FUERA del contenedor con `overflow-y:auto`. No es suerte y no se deja sin candado: guardián `v15-rtc12-la-identidad-no-se-desplaza.test.ts` (3 casos, probado al revés) para que un refactor de layout no lo rompa en silencio — es la familia «paciente equivocado» de REG-312. (a) «columna única»: **CONFIRMADO y dimensionado** — hoy 900px, pacientes 1100px, expediente 880px, consulta 980px, de 1440 (340–560px sin usar). Sigue **ABIERTO** y es lo que el propio registro declara deuda del monolito de 6147 líneas → V15-NOTE-PLAN-CONTINUITY / refactor: se planea entero antes de abrirlo. Acta: `docs/design/capturas/v15-rtc12/medicion-baseline.json` |

### P1 abiertos (orden de pago)

Ninguno pendiente de pago. Los diez se cerraron entre el 13 y el 14-ago-2026;
el único que sigue teniendo trabajo por delante es **RTC-12(a)** —el lienzo
multicolumna— y no está aquí porque no es una rebanada de esta iteración: es
deuda del monolito de 6147 líneas, dimensionada arriba y con dueño declarado
(V15-NOTE-PLAN-CONTINUITY / refactor). Ponerlo en «abiertos» invitaría a
abrirlo a ciegas, que es justo lo que el registro pide no hacer.


### P2 abiertos

| ID | Sev | Origen | Defecto | Pago |
|---|---|---|---|---|
| RTC-13 | P2 | ORT-15 + RT-05 | Etiquetas de IA como feature en cromo clínico (§25). PARCIAL: 4 sitios pagados («Nueva consulta con IA», «Razonar con IA (… Claude + GPT)», «Claude estructurando…» ×2) | Restante: «Procesar con IA» + Sparkles (19 usos), «Pedir segunda opinión (otra IA revisa la nota)», y un guardián de CONTENIDO §25 |
| RTC-14 | P2 | RT-10 + ORT-11 | Alergias: pintadas DOS veces en el mismo pliegue (consulta y expediente; ~12 % del viewport móvil, empuja «Grabar»); y su salience es 100 % cromática — en gris es el elemento MENOS saliente | UNA presentación anclada al ancla, con canal no cromático; en móvil la píldora abre la edición |
| RTC-15 | P2 | ORT-09 + RT-13 | Pacientes: anatomía CRUD (título → botones → búsqueda → pills → filas idénticas); única affordance por fila = «Editar»; «Respaldo» (operación §11) en cabecera primaria | Respaldo a /operaciones; «Abrir» explícito; estado clínico por fila |
| RTC-16 | P2 | ORT-12 | No hay UN contenedor de página: 4 contenedores distintos; `.page-pad` clase muerta en escritorio; /pendientes a sangre hasta x=1440 | Contenedor unificado del shell |
| RTC-17 | P2 | ORT-13 + RT-12 | Pendientes: `NexusClosureTrack` degradado a 8 chips de 10.5px (2 renglones a 390px); etapa activa sólo por color; `sin_dato` sólo en cursiva; explicación sólo en `title=` (inexistente en táctil) | Canal no cromático (relleno/check) + representación móvil compacta («Etapa 3 de 8 · sigue: Dueño») expandible |
| RTC-18 | P2 | RT-15 | `ClinicalSpine` con silueta de filtro: el elemento longitudinal de §7 se rinde como fila de píldoras igual a los filtros de /pacientes; corta a media palabra sin affordance de scroll | Forma propia (indicador de posición, fade de corte) |
| RTC-19 | P2 | RT-14 | 67 literales teal-500 fuera de tokens, dos en cromo persistente (halo del FAB central con DOS teales distintos; BotonAyuda) | Guardián que prohíba `14b8a6`/`20,184,166` fuera de `--receta-*`; el trinquete ya cuenta los halos de color (RTC-02) |
| RTC-20 | P2 | ORT-16 | Los guardianes del riel certifican REUBICACIÓN, no reducción: ≤5 contando nodos JSX; reachability exige ≥21 rutas alcanzables | Guardián de reducción real cuando la IA se re-corte |
| RTC-21 | P2 | RT-16 | Expediente móvil: exportaciones a un gesto y «FHIR» de cara al médico en un teléfono (§25 jargon; §22: exportar no es trabajo móvil) | Hoja «Compartir y exportar» de un botón; signos/diagnósticos suben |

### P3 abiertos

| ID | Sev | Origen | Defecto |
|---|---|---|---|
| RTC-22 | P3 | ORT-17 + RT-20 | InstrumentStrip sin función en rutas sin paciente (marca duplicada riel + topbar a 20px; «Ausculta» ×2 en escritorio) |
| RTC-23 | P3 | ORT-18 + RT-17 + RT-18 | Motion decorativo puntual: cascada 520+120ms en Hoy; cascada de /citas re-armándose con cada filtro (fila 12 invisible 336ms); luna que rota al hover. (La cascada de dashboard con 2 elementos y 120ms SÍ ordena jerarquía — no es defecto) |
| RTC-24 | P3 | ORT-19 | Cuatro nombres para el objeto central: Encuentro / Iniciar consulta / Consulta / Nueva consulta con IA |
| RTC-25 | P3 | ORT-20 + RT-22 | Textos móviles que envuelven/truncan a 390px: rótulo del héroe; placeholder «…correo o CUI»; píldoras-pestaña sangrando; descriptores bajo FABs; «Urgente» como metadato gris de 12px |
| RTC-26 | P3 | ORT-21 | `style={{` subió en absoluto (6065 → 6173) aunque el cociente inline/className mejoró (7.43 → 5.99) |
| RTC-27 | P3 | RT-19 | Deriva de radio 12 fuera de escala (`ResumenPaciente.tsx:104`, `expediente:539`); `secciones-recetas` PAGADO 12→10 |
| RTC-28 | P3 | RT-21 | Tema claro: riel/topbar/FABs permanecen oscuros — verificar si es decisión o resto |

## Hueco de evidencia declarado (de los dos paneles)

El paquete de 27 capturas NO contiene el encuentro GRABANDO (transcripción
viva, nota emergiendo, cierre): el Encounter Mode se juzgó en PREPARE.
Primera tarea del siguiente paquete de capturas: el ciclo §8 completo.

## Lo que la reparación NO debe pisar

La IA de 5 contextos con paridad y guardián; el anti-paciente-obsoleto de la
franja; el aquietado del riel con razonamiento AA; el estado de error
honesto de la agenda; la cola de cierre de Pendientes entera; el mic
centrado con origen documentado propio; la fila-botón estirada de
/pacientes.
