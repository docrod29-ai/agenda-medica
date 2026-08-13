# V15-ORIGINALITY-REDTEAM-001 — veredicto consolidado

**Fecha:** 13-ago-2026 · **Evidencia:** 27 capturas reales
(`docs/design/capturas/v15-redteam/`, app corriendo con siembra sintética,
escritorio 1440 + móvil 390, tema oscuro/claro + variante GRIS por
superficie) · **Método:** 4 revisores independientes con lentes distintas
(§26/§41) — genérico-SaaS, jerarquía/silueta/logo-off, imitación/IA
feature-first/motion, móvil — y verificación del orquestador sobre cada
afirmación citada (conteos re-medidos por grep, archivos re-leídos,
capturas re-miradas). Los revisores auditan; el orquestador verifica y
escribe.

---

## 1. GENERIC_AI_LOOK_SCORE por superficie (§29)

Razones ESTRUCTURALES, no de paleta. Donde los revisores divergieron se
anotan los dos números y el consolidado lleva la razón del desempate.

| Superficie | Rojo | Panel jerarquía | **Consolidado** | Razón estructural dominante |
|---|---:|---|---:|---|
| hoy | 7 | silueta PASS marginal | **5** | El patrón NOW→cola→agenda es propio (no hay plantilla con eso), pero: saludo-portada pesa más que el NOW, 7 CTAs rellenos idénticos en la columna derecha, 3 contenedores del mismo borde/radio apilados, 2 FAB |
| pacientes | 9 | logo-off FAIL (canvas) | **7** | Anatomía canónica v0/shadcn de lista CRUD (título → 3 botones → búsqueda → pills de filtro → tarjeta de filas idénticas); única affordance por fila = «Editar» |
| expediente | 8 | silueta FAIL | **6** | Ancla de paciente + spine son intención propia, pero el primer viewport es: fila de exportación (admin) + 3 tarjetas-KPI iguales (2 VACÍAS) + pila de tarjetas del mismo peso; la historia clínica arranca en el borde inferior |
| consulta | 6 | la más fuerte de las 6 | **4** | Un propósito, una dominante (mic), todo subordinado — PASS de silueta; pero conserva íntegro el cromo SaaS (riel, banner, breadcrumb, 2 FAB), grabadora = drop-zone card-in-card, y columna única de 980px a 1440 |
| pendientes | 4 | PASS con reserva | **3** | La cola de cierre con 8 etapas y estado `sin_dato` es estructura identitaria real; reserva: la etapa activa no sobrevive al gris, 8 píldoras × tarjeta |
| operaciones | 9 | FAIL tolerado (§11) | **7** | Rejilla de 17 fichas idénticas = app-launcher de plantilla admin. §11 tolera un directorio en operaciones; cuenta contra el score igual |

**Target §29: ≤1.0. Ninguna superficie lo cumple.** La compuerta
GENERIC_AI_LOOK del §34 queda **FAIL** hasta pagar el registro de abajo.

Matiz que importa: los tests estructurales contra el producto VIEJO pasan —
prueba del menú §14 **PASS** (riel: 4 contextos + Operaciones subordinada,
verificado en `FlowRail.tsx:180-194` y captura; móvil 4+1 en
`BottomNav.tsx`), diferenciación entre superficies en gris **PASS** (Hoy /
expediente / consulta / pendientes tienen esqueletos distintos — no es una
plantilla con otro texto). El fallo no es «sigue siendo el almacén»: es que
el lienzo de varias superficies quedó con anatomía de plantilla.

## 2. Lo que se REFUTÓ (columna a favor)

- **Imitación de competidor: REFUTADA.** La paleta se eligió midiendo
  distancia de tono contra Suki/Abridge/Nabla/Heidi (`globals.css:45-70`);
  tipografía divergente a propósito; el mic centrado del encuentro tiene
  origen documentado propio (`EmpezarAGrabar.tsx:1-46`). Cero trade dress
  calcado.
- **Motion decorativo: REFUTADO en lo principal.** La coreografía de
  continuidad comunica objeto (nombre del paciente viaja), no anima donde
  no hay objeto (`continuidad.ts:46-60`), doble candado reduced-motion, y
  el marco de escucha bajo `reduce` queda FIJO, no apagado (información de
  micrófono abierto ≠ decoración). Dos grietas abajo (RT-08, RT-17).
- **Identidad estructural que existe y no se toca:** cola de cierre de
  Pendientes con `sin_dato` que se niega a decir «hecho» sin dato
  (`progreso-resultado.ts:38-47`); riel que se aquieta al grabar con la
  distinción 1.4.11 documentada (`FlowRail.tsx:69-115`); ancla de paciente
  DENTRO de la topbar móvil (`InstrumentStrip.tsx:103-114`); acción central
  contextual del BottomNav; fila-botón estirada de /pacientes
  (`.nx-fila-abrir`).

## 3. Registro de defectos

Cada hallazgo sobrevivió a la verificación del orquestador. «PAGADO» = en
esta corrida.

### P0

- **RT-01 · La vara de medir no puede detectar lo que dice medir.**
  `docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` cuenta clases Tailwind en un
  código 88.5% estilo-en-línea: sus ceros son artefactos de método.
  Re-medido hoy: 14 `linear-gradient`, 56 `box-shadow`, 15
  `backdrop-filter` en `src/` — y un degradado morado literal
  (`secciones-recetas.tsx:417`, **PAGADO**: muerto). El trinquete de diseño
  mide adherencia a tokens, no genericidad: gradientes/cristal/FABs no
  tienen guardián. **Pago restante:** contadores de genericidad en
  `trinquete-de-diseno.mjs` (gradientes, backdrop-filter, halos de color)
  con techo sólo-baja, y corregir las cifras del audit doc.

### P1

- **RT-02 · Expediente: primer viewport sin un solo dato clínico.** Fila de
  exportación (Carta/Expediente/FHIR) ARRIBA de la historia clínica; 3
  tarjetas-KPI iguales, 2 vacías («Sin signos», «Sin diagnósticos»);
  historia clínica bajo el pliegue (~675px en 1440×900). 3 revisores.
  `expediente/[patientId]/page.tsx:157-269`, `ResumenPaciente.tsx:61-104`.
  Pago: exportación subordinada (menú/pie), stat-cards vacías colapsadas a
  una línea, historia/pendientes del paciente al primer viewport.
- **RT-03 · Hoy móvil: el héroe de próxima cita era fila de escritorio sin
  breakpoint.** `.prox-hero` sin `@media`: identidad en columna de ~110px,
  3 renglones. **PAGADO**: wrap ≤560px, CTA a renglón completo
  (`globals.css`), verificado en navegador real
  (`acta-heroe-movil.json`).
- **RT-04 · «Encuentro» es destino sin lugar.** `FlowRail.tsx:131`:
  `encounterHref = enEncuentro ? pathname : '/pacientes'` — dos de los
  cuatro destinos-ruta apuntan a la misma URL; dentro del encuentro, a sí
  mismo. Falla la pregunta de §15 (¿lugar al que se VA o capacidad?). Pago:
  estado real de encuentro activo (retomar el que está abierto, no
  /pacientes) — pertenece al refactor de Fase 5 / NOTE-PLAN-CONTINUITY.
- **RT-05 · Etiquetas de IA como feature en cromo clínico (§25).**
  **PAGADO en 4 sitios**: «Nueva consulta con IA»→«Nueva consulta»
  (expediente), «Razonar con IA (infectólogo — Claude + GPT)»→«Interpretar
  el cultivo» (antibiograma — un LLM con título profesional y proveedores
  en el rótulo), «Claude estructurando…»→«Estructurando la nota…» (×2,
  consulta). **Restante:** «Procesar con IA» + Sparkles (19 usos),
  «Pedir segunda opinión (otra IA revisa la nota)», y un guardián de
  contenido §25 (hoy hay 54 guardianes v15-* y ninguno de contenido).
- **RT-06 · Dos FAB permanentes sobre toda pantalla clínica.** Ayuda 52px
  (trade dress Intercom, `BotonAyuda.tsx:17-57`) + tema 44px
  (`globals.css:1979`). NO suscritos a `EVENTO_GRABANDO` (el riel y la nav
  sí); en móvil ocluyen contenido en 4/6 superficies (búsqueda de
  herramientas en consulta, texto en pendientes). Los parches existentes
  son por-pantalla (`globals.css:1023,2064`), no estructurales. Pago: tema
  a Operaciones en móvil; ayuda fuera del arco del pulgar; compuerta
  EVENTO_GRABANDO compartida.
- **RT-07 · Ninguna superficie usa el lienzo de escritorio.** Columna única
  centrada en todas (880-1100px); en consulta a 1440 no hay panel de
  contexto — el paciente se pierde al desplazar. Deuda dimensionada del
  monolito (6147 líneas) → V15-NOTE-PLAN-CONTINUITY / refactor.
- **RT-08 · Ventana de clic ciego en la coreografía de continuidad.**
  `continuidad.ts:80,149-151`: durante `await esperarCambioDeRuta()` (tope
  1200ms) el navegador pinta la instantánea VIEJA pero el clic aterriza en
  el DOM NUEVO — desde una worklist con un «Consulta» por renglón, un clic
  a ciegas puede abrir el encuentro de OTRO paciente. El guardián existente
  sólo verifica que `pointer-events:none` esté en la hoja para los
  pseudo-elementos, no esta ventana. Pago: `inert`/pointer-events sobre
  `<main>` durante el callback + tope ~400ms, con guardián probado al
  revés. **Riesgo de paciente equivocado: primera prioridad del registro.**
- **RT-09 · «Consultor IA» es página-módulo de IA, bajo el grupo "Clínico"
  de /operaciones.** Contradice §3.2 (la IA junto al trabajo, no en página
  genérica) y el propio copy de la pantalla («aparte del trabajo clínico»).
  Por defecto no sabe de qué paciente se habla (`consultor/page.tsx:56`).
  Pago: capacidad contextual en expediente/encuentro; /operaciones sin
  grupo «Clínico».

### P2

- **RT-10 · Alergias pintadas DOS veces en el mismo pliegue** (banda ancha
  + píldora a ~100px), en consulta y expediente; 4 revisores. En móvil
  cuesta ~12% del viewport y empuja «Grabar» a media pantalla. La
  repetición devalúa la señal de seguridad (lección REG-245). Pago: UNA
  presentación anclada al ancla; en móvil, la píldora abre la edición.
- **RT-11 · Hoy: jerarquía de acción invertida.** 7 botones rellenos
  idénticos (6 «Consulta» + «Iniciar consulta»); el saludo pesa más que el
  NOW; en móvil «+ Nueva cita» aparece con énfasis máximo DOS veces
  (header + acción central) por encima del héroe. Pago: sólo la cita
  inminente lleva relleno; saludo a kicker; CTA del header suprimido en
  móvil.
- **RT-12 · Pendientes: la etapa activa no sobrevive ni al gris ni al
  tacto.** Contorno de color como único canal de la etapa; cursiva como
  única marca de `sin_dato`; explicación sólo en `title=` (inexistente en
  táctil); 8 píldoras envueltas en 2 renglones a 390px
  (`ProgresoResultado.tsx:44-58`). Pago: canal no cromático (relleno
  sólido/check) + representación móvil compacta («Etapa 3 de 8 · sigue:
  Dueño») expandible con motivos inline.
- **RT-13 · Pacientes: anatomía CRUD + trabajo de operaciones en cabecera
  clínica.** «Respaldo» (NDJSON de todo el consultorio) como botón de
  primer nivel; «Editar» como única affordance visible de fila (la acción
  real —abrir— es implícita); fila sin variante móvil (nombre en 3
  renglones). Pago: Respaldo a /operaciones; «Abrir» explícito; «Editar»
  al expediente/overflow en móvil.
- **RT-14 · 67 literales teal-500 de Tailwind fuera de tokens**, dos en el
  cromo persistente: halo del FAB central (`BottomNav.tsx:167` — el objeto
  y su sombra son DOS teales distintos) y `BotonAyuda.tsx:25,44`. La
  migración de paleta se midió (`globals.css:70-95`); estos 67 nunca se
  re-midieron. Pago: guardián que prohíba `14b8a6`/`20,184,166` fuera de
  `--receta-*` (la receta impresa tiene motivo declarado).
- **RT-15 · ClinicalSpine con silueta de filtro.** El elemento que §7
  define longitudinal y estructural se rinde como fila de píldoras
  indistinguible de los filtros de /pacientes, se corta a media palabra
  sin affordance de scroll (`ClinicalSpine.tsx:79-107`). Pago: forma propia
  (indicador de posición, fade de corte); los 44px táctiles ya los cubre el
  bloque coarse global.
- **RT-16 · Expediente móvil: exportaciones a un gesto, «FHIR» de cara al
  médico en un teléfono** (§25 jargon; §22: exportar no es trabajo móvil).
  Pago: hoja «Compartir y exportar» de un botón; signos/diagnósticos
  suben.

### P3

- **RT-17** Cascada escalonada decorativa en /citas (`citas/page.tsx:575`:
  fila 12 invisible 336ms, se rearma con cada filtro). Quitar el delay; el
  fade de template ya cubre la entrada. (En dashboard, con 2 elementos y
  120ms, SÍ ordena jerarquía — no es defecto.)
- **RT-18** Rotación hover de la luna del theme-toggle: existencia sin
  información (`globals.css:2048`).
- **RT-19** Deriva de radio 12 fuera de escala 6/10/14
  (`ResumenPaciente.tsx:104`, `expediente:539`; `secciones-recetas`
  **PAGADO** 12→10).
- **RT-20** Franja de instrumentos con la marca duplicada (riel + topbar a
  20px) en superficies sin paciente — la franja sin función ahí.
- **RT-21** Tema claro: riel/topbar/FABs permanecen oscuros
  (`expediente-desktop-claro.png`) — verificar si es decisión o resto.
- **RT-22** Menores móviles: placeholder «…correo o CUI» cortado;
  descriptores de herramientas truncados bajo FABs; «Ver sólo los míos /
  Actualizar» ghost se leen como texto suelto; «Urgente» como metadato
  gris de 12px (una cita urgente con énfasis de lugar).

## 4. Veredicto

La tesis «V15 no parece SaaS genérico» **no sobrevive entera**: sobrevive
el ESQUELETO (shell 4+1, superficies estructuralmente distintas entre sí y
distintas del almacén viejo, cola de cierre identitaria, imitación de
competidor refutada) y **cae el LIENZO** de 4 de 6 superficies (anatomías
de plantilla: CRUD en pacientes, KPI-row vacía en expediente, launcher en
operaciones, cromo intacto en consulta) más la vara de medir rota (RT-01).
Ningún score cumple el ≤1 de §29. El registro de arriba es el plan de pago;
RT-08 (clic ciego → paciente equivocado) va primero por ser el único con
riesgo clínico, y RT-01 segundo porque sin vara honesta los demás pagos no
se pueden declarar.
