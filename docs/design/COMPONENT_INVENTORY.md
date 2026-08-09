# Inventario de componentes — V10 (TRUTH-001, salida 4)

> Estático, 9-ago-2026, sobre `claude/nexus-visual-excellence-v10` (base
> main `0144257`). **Qué NO dice**: no juzga calidad visual (eso exige
> navegador, V10 §33); cuenta y clasifica.

## Cifras

| Medida | Valor |
|---|---|
| Componentes `.tsx` en `src/components/` | 93 |
| Primitivos compartidos en `src/components/ui/` | 12 |
| Pantallas (`page.tsx` en `src/app/`) | 79 (detalle en `SCREEN_INVENTORY.md`, generado) |
| Adopción de `components/ui/` | 48/200 archivos (~24 %) — medido por V9 |

## Primitivos existentes (`src/components/ui/`)

`Alert` · `Badge` · `Button` · `Card` · `EmptyState` · `Field` · `Modal` ·
`PageHeader` · `Skeleton` · `Spinner` · `Table` · `Tabs`

## Mapa contra la familia Nexus candidata (V10 §30)

| Candidato V10 | Existe hoy | Nota |
|---|---|---|
| `NexusPatientHeader` | ❌ (cabeceras ad-hoc por pantalla) | candidato temprano: identidad + alergias + encuentro (V10 §16) |
| `NexusEncounterShell` | ❌ | la consulta vive en pantalla monolítica |
| `NexusClinicalTimeline` | ❌ | firma de producto pendiente (V10 §17) |
| `NexusInsight` | parcial | `EvidenciaEnVivo`, `Copiloto`, `AlertasDelEpisodio` hacen partes; sin primitivo común |
| `NexusRecorder` | parcial | `EmpezarAGrabar`, `MientrasHablas`, `EscucharElMomento` |
| `NexusEmptyState` | ✅ `EmptyState` | evaluar si cumple V10 §26 (enseña la siguiente acción) |
| `NexusStatus` | parcial | `Badge` genérico; estados firmado/borrador/liberado sin primitivo único (V10 §8.30) |
| resto | ❌ | **no crear antes de evidencia repetida** (V10 §30) |

## Regla

No se construye un primitivo Nexus hasta que TRUTH-001 documente ≥2 usos
reales que lo pidan, y nunca renombrando un card genérico (V10 §30).
