# Inventario de componentes — V10 (TRUTH-001, salida 4)

> **Unidad**: V10 · `V10-TRUTH-001` · 9-ago-2026.
> **Método**: conteo estático sobre `src/components/` (93 `.tsx`) y grep de
> importadores por ruta `@/components/...` y por barrel `@/components/ui`,
> excluyendo `src/__tests__/` y el propio archivo. **Límite declarado**: los
> imports relativos no se cuentan (se encontró 1 caso:
> `PanelLaboratorios.tsx:8` importa `./GraficaLab`), y los componentes
> colocados dentro de `src/app/` (p. ej. `configuracion/secciones-*.tsx`,
> `uci/*.tsx`, `consulta/[patientId]/consulta-ui`) quedan fuera de este censo.
> **Qué NO dice**: no juzga calidad visual (eso exige navegador, V10 §33);
> cuenta y clasifica.

## Cifras

| Medida | Valor |
|---|---|
| Componentes `.tsx` en `src/components/` | 93 |
| — en la raíz (sin carpeta de dominio) | 71 |
| — primitivos en `src/components/ui/` | 12 |
| — en 6 carpetas de dominio (`brand`, `expediente`, `hospital`, `laboratorio`, `motores`, `pacientes`) | 10 |
| Archivos que importan algo de `components/ui/` | **47 de 203** `.tsx` en `app`+`components` (~23 %) — coherente con el 48/200 que midió V9 |
| Componentes no-ui con **un solo** importador | **56 de 81** (69 %) |
| Componentes no-ui con ≥2 importadores | 23 |
| Componentes sin ningún importador (código muerto) | 1 — `DoctorOnboarding.tsx` |

## Los más usados (archivos que los importan, medido 9-ago-2026)

| Componente | Importadores | Vía |
|---|---|---|
| `ui/Spinner` | 27 | barrel |
| `ui/Button` | 26 | barrel (25) + directo (1) |
| `ui/Modal` | 14 | barrel |
| `ui/Skeleton` | 12 | directo (todos: los 12 `loading.tsx`) |
| `ui/EmptyState` | 12 | barrel |
| `ui/PageHeader` | 9 | barrel |
| `brand/EmptyArt` | 7 | ruta |
| `TipoCitaIcon` | 6 | ruta |
| `AvisoConfigNoCargada` | 5 | ruta |
| `DoctorFilter` | 4 | ruta |
| `StatusBadge` · `RecetaDocumento` · `CobrarModal` · `laboratorio/PanelLaboratorios` | 3 c/u | ruta |
| Con 2: `AppointmentModal`, `AsistenteChat`, `Cie10Autocomplete`, `Copiloto`, `SelloProcedencia`, `SelloMotor`, `brand/MarcaAuth`, `CambiosCifrasPanel`, `PanelRazonamiento`, `PanelPediatria`, `RecetaPreviewWrapper`, `Herramientas`, `FotosClinicas`, `AlertasDictado`, `MetaPixel` | 2 c/u | ruta |

## Clasificación

### Primitivos compartidos de verdad (6 de 12)

`Spinner`, `Button`, `Modal`, `Skeleton`, `EmptyState`, `PageHeader`. Los seis
tienen ≥9 importadores y **`Modal` es de lo mejor del repositorio**: trampa de
foco, foco inicial, Escape, scroll bloqueado, devolución de foco y
`aria-modal`/`aria-labelledby`, con el porqué de cada cosa escrito en el propio
archivo (`src/components/ui/Modal.tsx:26-76,96-106`). Los tres modales grandes
(`AppointmentModal.tsx:21`, `CobrarModal.tsx:17`, `AvisoPrivacidadModal.tsx:12`)
lo componen en lugar de reinventarlo. Aquí el código ya está bien.

### Primitivos muertos o casi (6 de 12)

| Primitivo | Importadores | Diagnóstico |
|---|---|---|
| `ui/Table` | **0** | escrito y sin conectar |
| `ui/Field` | **0** | escrito y sin conectar — cada formulario etiqueta a mano |
| `ui/Alert` | 1 | |
| `ui/Badge` | 1 | compite con `StatusBadge` (abajo) |
| `ui/Card` | 1 | |
| `ui/Tabs` | 1 | |

La mitad del kit `ui/` no se usa. Antes de crear primitivos Nexus nuevos hay
que decidir si estos seis se adoptan o se retiran: un primitivo con 0 usos es
deuda con nombre de sistema.

### Dominio compartido (bien situados)

`TipoCitaIcon` (6), `StatusBadge` (3), `RecetaDocumento` (3, la receta como
documento único que se pinta en receta/consulta/configuración),
`laboratorio/PanelLaboratorios` (3), `DoctorFilter` (4),
`AvisoConfigNoCargada` (5). Son la semilla real de la familia Nexus: ≥2 usos
demostrados, como pide V10 §30.

### Componentes de pantalla disfrazados (56 con un solo importador)

El 69 % de `src/components/` no es biblioteca: es trozos de UNA pantalla
guardados en la carpeta común. Ejemplos con su único importador:
`FacturacionSection`, `SoporteSection`, `AsientosSection` (→ configuración),
`PanelPendientes`, `CabosSueltosDelPaciente` (→ dashboard/expediente),
`NerPanel`, `RevisionPanel`, `AntesDeFirmar`, `MientrasHablas`,
`EscucharElMomento`, `QueNotaEs` (→ consulta). No es urgente moverlos, pero el
inventario debe dejar de contarlos como «componentes compartidos»: la
biblioteca real tiene ~29 piezas, no 93.

### Código muerto (1)

`DoctorOnboarding.tsx`: 0 importadores. Ya está declarado como tal en
`src/__tests__/modulos-sin-conectar.test.ts:101` («escrita, sin pantalla que la
monte todavía»). Consta; no es un descubrimiento nuevo.

## Duplicación (verificada, con rutas)

1. **Dos `HistorialVersiones` con el mismo nombre y el mismo trabajo.**
   `src/components/HistorialVersiones.tsx` (lo monta la consulta,
   `consulta/[patientId]/page.tsx:11`, permite **restaurar**) y
   `src/components/expediente/HistorialVersiones.tsx` (lo monta la nota,
   `nota/[patientId]/[notaId]/page.tsx:16`, permite **copiar**). Leen la misma
   subcolección `versions` por dos funciones distintas:
   `lib/expediente/versioning.ts:37` (`listarVersiones`, con límite 20) y
   `lib/expediente/firestore.ts:368` (`getVersionesNota`, sin límite). La
   diferencia restaurar/copiar es deliberada y está razonada en las cabeceras;
   la duplicación del lector de datos y del nombre no. Candidato P2: un lector,
   un componente con dos modos.
2. **Dos gráficas de tendencia casi gemelas.**
   `hospital/GraficaSignos.tsx` (55 líneas) y `laboratorio/GraficaLab.tsx`
   (56 líneas): mismas props (`titulo`, `unidad`, `puntos`, banda de
   referencia), mismo SVG a mano. Son exactamente los «≥2 usos reales» que
   V10 §30 exige antes de crear un primitivo: aquí sí procede uno.
3. **Dos sistemas de badge.** `ui/Badge` (1 uso) y `StatusBadge` (3 usos,
   estados de cita). `StatusBadge` tiene una razón documentada (tonos por tema
   con contraste AA, `StatusBadge.tsx:4-15`) pero no compone a `Badge`: dos
   tablas de tonos que divergirán. P3.

**No es duplicación aunque lo parezca**: `SelloProcedencia` (resumen de origen
de la nota), `DeDondeSalioEsto` (frase ↔ segundo del dictado) y `SelloMotor`
(estado de validación del motor) son tres papeles distintos de la misma
familia de procedencia — lo que les falta es el primitivo común `NexusInsight`
ya anotado abajo, no una fusión.

## Mapa contra la familia Nexus candidata (V10 §30)

| Candidato V10 | Existe hoy | Nota |
|---|---|---|
| `NexusPatientHeader` | ❌ (cabeceras ad-hoc por pantalla) | candidato temprano: identidad + alergias + encuentro (V10 §16) |
| `NexusEncounterShell` | ❌ | la consulta vive en pantalla monolítica (**5 805 líneas**, `consulta/[patientId]/page.tsx`) |
| `NexusClinicalTimeline` | ❌ | firma de producto pendiente (V10 §17) |
| `NexusInsight` | parcial | `EvidenciaEnVivo`, `Copiloto`, `AlertasDelEpisodio` hacen partes; sin primitivo común |
| `NexusRecorder` | parcial | `EmpezarAGrabar`, `MientrasHablas`, `EscucharElMomento` |
| `NexusEmptyState` | ✅ `EmptyState` | 12 usos reales; evaluar si cumple V10 §26 (enseña la siguiente acción — en dashboard/citas/pacientes ya lleva botón de acción) |
| `NexusStatus` | parcial | `Badge` genérico (1 uso) + `StatusBadge` (3); estados firmado/borrador/liberado sin primitivo único (V10 §8.30) |
| `NexusTrendChart` | **nuevo candidato con evidencia** | `GraficaSignos` + `GraficaLab`: 2 implementaciones, mismas props |
| resto | ❌ | **no crear antes de evidencia repetida** (V10 §30) |

## Regla

No se construye un primitivo Nexus hasta que TRUTH-001 documente ≥2 usos
reales que lo pidan, y nunca renombrando un card genérico (V10 §30). La deuda
visual (estilos en línea, hexadecimales, adopción del 23 %) ya está medida en
`docs/design/GENERIC_AI_AESTHETIC_AUDIT.md` y `agent-state/DESIGN_STATE.md`;
este inventario no la repite.
