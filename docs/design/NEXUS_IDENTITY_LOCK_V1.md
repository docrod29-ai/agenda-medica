# Nexus Identity Lock V1 — Cantera + Instrumento

> **AUTORITATIVO** para todo trabajo visual, por V14 §8
> (`docs/ai/NEXUSMED_MASTER_LOOP_V14_UNIFIED_CATEGORY_DIFFERENTIATION.md`),
> hasta que el dueño lo cambie explícitamente. Sustituye la identidad cobalto
> de `NEXUSMED_VISUAL_DNA.md` (conflicto resuelto en
> `agent-state/V14_DECISION_LOG.md` D-2).

## Tesis

```text
Consultorio mexicano de excelencia con ingeniería visible.
Warm, dignified, unmistakably from here.
Calidez de cantera + disciplina de instrumento.
```

Explícitamente NO:

- California-SaaS blue/teal medical;
- generic medical blue;
- generic green medical;
- sparkle AI;
- cross-logo healthcare;
- heartbeat-line identity;
- node-link "nexus" identity;
- dashboard card grid;
- cream+terracotta generic AI default;
- black+acid generic AI default;
- anything resembling generic Nexus/NexusMed brands.

## Tokens de color — exhaustivos

Ningún color de UI de producto fuera de esta tabla sin decisión del dueño.

| Token | Hex | Uso |
|---|---|---|
| `canvas` | `#FAF7F2` | app background, warm alabaster |
| `surface` | `#FFFFFF` | cards, panels, inputs |
| `surface-sunken` | `#F3EFE8` | wells, timeline track, disabled fills |
| `ink` | `#2A2420` | primary text |
| `ink-secondary` | `#6E645A` | secondary text |
| `ink-tertiary` | `#A79B8D` | metadata/placeholders |
| `line` | `#EAE3D8` | dividers |
| `line-strong` | `#D8CFC0` | emphasized structure |
| `brand` | `#8E2A47` | primary actions, selection, brand |
| `brand-hover` | `#7A2540` | hover/pressed |
| `brand-soft` | `#F5E7EC` | selected fills / insight surfaces |
| `strip-bg` | `#2A2420` | instrument strip background |
| `strip-ink` | `#E8E2D9` | instrument strip text |
| `strip-ok` | `#7FBFA0` | healthy-state strip indicators |
| `info` | `#3D5A5C` | informational states |
| `success` | `#3E6B4F` | completion/closure |
| `warning` | `#9A6317` | nonblocking caution |
| `danger` | `#B42318` | clinical risk only |
| `focus` | `#8E2A47` | focus ring |

Reglas duras:

- `danger` reservado a riesgo clínico;
- todo color de riesgo va acompañado de etiqueta/forma;
- una captura en escala de grises debe seguir comunicando el estado;
- nada de azul/teal/morado salvo `info`;
- `brand` y `danger` no pueden ser la única diferencia entre estados adyacentes.

## Tipografía

| Rol | Familia | Peso/Tamaño | Notas |
|---|---|---|---|
| Display / identidad del paciente | Bricolage Grotesque | 600 · 20–24px | contención; sólo títulos de identidad/encuentro |
| Encabezados de sección | Bricolage Grotesque | 600 · 15–16px | limitado |
| Cuerpo | Instrument Sans | 400/500 · 16px | legibilidad de guardia larga |
| Cuerpo pequeño / metadatos | Instrument Sans | 400 · 13px | nunca bajo 12px |
| Numéricos clínicos | Spline Sans Mono | 400/500 · 12–15px | todos los números clínicos |
| Botones/etiquetas | Instrument Sans | 600 · 13.5px | sentence case |

Reglas: máx. 3 pesos en UI normal · editor de nota ≈66ch · nombres, fármacos y
dosis **nunca** con elipsis en contextos de decisión · todo número clínico en
tabular/monospace.

## Forma, espacio, elevación

- Radios: `4px`, `10px`, `14px` **solamente**.
- Espaciado: `4, 8, 12, 16, 20, 24, 32, 48`.
- Elevación: plano o elevado, nada más. Elevado: `0 4px 16px rgba(42,36,32,.08)`.
- Sin sombras decorativas. Sin tarjetas anidadas. Estructura por espacio y hairlines.

## Movimiento

- 120ms micro · 200ms estándar · 300ms espacial · nada >400ms en superficies de trabajo.
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- El movimiento comunica continuidad, estado, causalidad.
- `prefers-reduced-motion` se respeta.
- Sin bucles decorativos. El pulso de grabación es la única animación permanente
  de pantalla clínica.

## Elementos de firma

### La Banda de Instrumentos

Franja de telemetría persistente arriba de los espacios clínicos: `strip-bg`,
Spline Sans Mono 10.5px, REC + tiempo, calidad de audio, autoguardado, apellido
del paciente + edad/sexo, estado del encuentro. Siempre visible en Modo
Encuentro y Revisión de Nota; variante slim en el resto.

### El Sello

Marca circular discreta para estados verdaderamente cerrados: nota firmada,
curso cerrado, resultado comunicado, cierre completado. Significa verdad/acción
clínica consumada. Nunca decorativo.

### Nexus Course Bar

Barra de días segmentada para cursos antimicrobianos: días transcurridos, total,
fecha de revisión, estado, fuente, cierre. Foso de especialidad.

### Coreografía de continuidad

Abrir paciente/resultado/nota anima origen → destino. Cambiar de paciente hace
un reset de espacio de trabajo inconfundible. Nunca un cambio silencioso de
cabecera.

---

**Estado de implementación**: NO implementado aún en `globals.css` — la app
sigue con la piel anterior. La migración es `V14-IDENTITY-001` y toda
verificación es en navegador, nunca desde el código solo.
