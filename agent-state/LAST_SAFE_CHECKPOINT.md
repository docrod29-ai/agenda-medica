# Último punto seguro de reanudación

> **Para qué sirve**: que la siguiente sesión sepa, sin leerse todo, qué está
> cerrado y qué es lo siguiente. Se actualiza **tras cada unidad cerrada**, con
> su SHA. Sin SHA, una unidad no está cerrada.

---

## Checkpoint · 9-ago-2026

| | |
|---|---|
| **Rama** | `claude/relaxed-fermi-ykx2ql` |
| **SHA base de esta sesión** | `0144257` (merge de #271, `v1163` · REG-289/290) |
| **SHA de cierre** | `9e48b04` (REG-291) · `828c338` (REG-292) |
| **Unidades cerradas** | **`DESIGN-SYSTEM-001` · parte 1** (REG-291) y **`PATIENT-TELE-002`**, el último P0 abierto (REG-292) |
| **Siguiente unidad** | `DESIGN-TIPOGRAFIA-001`, luego `A11Y-GATE-001` |
| **P0 abiertos** | **ninguno** |

### Qué quedó hecho en esta sesión

**REG-291 — el azul de marca escrito a mano.** Dieciocho sitios pintaban
`#3D5AFE` literal en posición de color de texto o de icono: **2,96–3,81 : 1**
sobre las superficies oscuras y **4,25** en el chip del tema claro. El mínimo AA
es 4,5. El token que corresponde, `--nexus`, pasa en las ocho combinaciones. Y un
hexadecimal a mano tampoco cambia con el tema.

**DESIGN-THEME-001 — la causa raíz.** `@theme inline` pasa de exponer **4**
valores a exponer las familias del sistema (superficies, texto, marca, semántica
clínica, radio). Verificado del otro lado, compilando Tailwind contra una sonda:
`.text-nexus { color: var(--nexus) }` — la utilidad lee la variable, así que
sigue el tema.

**Una trampa evitada y documentada.** Declarar `--spacing-N` en `@theme` habría
encogido `p-6`/`px-6` de 24 px a 6 px en cinco sitios, sin fallar ninguna prueba.
Se vio compilando, no razonando. Hay guardián que lo impide.

**Escalas nuevas en `:root`**, sacadas de los picos reales del producto (no de
una progresión bonita): `--r-1…5` (19 valores de radio → 5) y `--sp-4…24`
(23 valores de `gap` → 8).

**Un guardián sellado**: `el-azul-de-marca-no-se-escribe-a-mano.test.ts` — lista
blanca con razón obligatoria por entrada, contraste **computado** desde
`globals.css` (no afirmado), y comprobación al revés que exige que `#3D5AFE`
siga reprobando.

**REG-292 — el último P0.** El enlace de la videoconsulta que viaja por WhatsApp
seguía sin token: REG-265 arregló el portal y dejó este camino diciendo
«recibirás el enlace por este medio» — honesto, pero el paciente seguía sin
enlace en el mensaje donde más falta le hace. El token se acuña ahora en el
servidor, y **el plazo se deriva de la cita** (lo justo para llegar más un día,
techo de 3 días) porque un plazo fijo se equivoca en los dos sentidos: corto
caduca antes de la cita, largo deja una credencial viva en un chat que se
reenvía. Alcance `agenda`, el mínimo.

**Y una prueba que no probaba nada.** El primer guardián de REG-292 contaba
apariciones de `tokenPaciente` en el archivo; **se comprobó al revés y pasó
igual**. Se reescribió casando llaves para mirar dentro de cada llamada, y
entonces sí falla. El extractor tiene su propio caso al revés.

**Tablero reconciliado**: los tres P0 de audio seguían marcados `pendiente` en
`BACKLOG.json` estando cerrados en v1158/v1161 (REG-283/287). Se cierran contra
la verdad del repositorio.

### Compuertas en este checkpoint

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **8 475 pasan** · 1 fallo preexistente y de entorno (`ops-timeout-y-punto-ciego`: abre una conexión a una IP no enrutable esperando que expire; tras el proxy de este contenedor falla rápido). Mismo fallo en `HEAD` limpio |
| `lint-trinquete` | **96, igual que el techo.** Sin deuda nueva |
| `npx tsc --noEmit` | **limpio** |
| `npm run build` | **compila** («Compiled successfully in 34.5s») y luego falla al recolectar datos de página con `auth/invalid-api-key`: **este contenedor no tiene las variables de Firebase**. Entorno, no código |
| sonda de Tailwind | **las utilidades nuevas se emiten y resuelven a la variable**, no al hexadecimal |
| navegador / móvil / a11y | **no ejecutadas** |

---

## Qué hacer al reanudar

**1. Comprobar** que `git log --oneline -3` incluye el commit de REG-291 y correr
`node scripts/agent-state/actualizar.mjs`.

**2. NO rehacer** `PATIENT-UX-TRUTH-001` (cerrada, `639ca73`) ni los tres P0 de
audio (cerrados en v1158 y v1161) ni `DESIGN-THEME-001`.

**3. Seguir por `DESIGN-TIPOGRAFIA-001`.** Es el mismo mecanismo que acaba de
repararse, en el eje del tamaño: la escala existe como clases `.t-*` y **sus
cuatro tamaños más usados no están en ella** (13 con 474 usos, 12,5 con 436, 12
con 388, 11 con 279). Sacarla de lo que el producto usa, exponerla en `@theme`,
darle guardián — **y no tocar píxeles en el mismo cambio.**

**4. Luego `A11Y-GATE-001`**: `axe` sobre las 9 pantallas del paciente. Hoy hay
**1** prueba de accesibilidad entre 566 archivos, y es una expresión regular
sobre `layout.tsx`.

**5. Cuando haya entorno con credenciales de Firebase**: las seis comprobaciones
de navegador de `NAV-NAVEGADOR-001`. **Dos de ellas pueden convertir un P2 en
P0.** Y ahí mismo, mirar los dieciocho sitios que cambiaron de color en REG-291.

**6. No quedan P0 abiertos.** Lo primero que hay que comprobar cuando haya
teléfono y credenciales del dueño: **mandar un recordatorio de teleconsulta de
verdad y abrir la sala desde el enlace** (REG-292). Se probó el token, no el
mensaje.

## Lo que este checkpoint NO garantiza

Que la interfaz esté bien. **Nadie ha abierto una pantalla** en toda V9. El
contraste de REG-291 se **computó** con la fórmula de WCAG 2.1 sobre los valores
declarados en el CSS; no se miró en un navegador. Ninguna pantalla está
aprobada, y la directiva V9 §4 dice que no se aprueba interfaz leyendo código.
