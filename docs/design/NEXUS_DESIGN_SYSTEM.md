# Sistema de diseño NexusMED

> **Unidad**: V9 · `DESIGN-SYSTEM-001` · abierta el 9-ago-2026
> **Fuente de verdad de los valores**: `src/app/globals.css`. Este documento
> explica **por qué**; el CSS dice **cuánto**. Si los dos discrepan, gana el CSS
> y este documento está mal.
> **Compuerta**: `node scripts/design/trinquete-de-diseno.mjs` ·
> `src/__tests__/el-trinquete-de-diseno-solo-baja.test.ts`

---

## Por qué este documento existe, y por qué no empieza por colores

La directiva V9 §13 lo dice literalmente: *«Do not start by changing colors or
building a chatbot.»* La auditoría `PATIENT-UX-TRUTH-001` explicó por qué esa
instrucción era la correcta, y de una forma que nadie esperaba: **la premisa de
la directiva no se cumple aquí.**

No hay cara de producto generado por IA. Cero degradados. Cero `from-purple`.
**Una** `rounded-2xl` en toda la aplicación. Una `shadow-2xl`. Un
`backdrop-blur`. Lo que hay es una identidad declarada, oscura por defecto, con
los cocientes de contraste WCAG calculados a mano y escritos en el propio CSS.

El defecto es el simétrico y es peor:

> **El sistema de diseño existe y la aplicación no le obedece.**

| Medida | 8-ago-2026 | Hoy |
|---|---|---|
| Archivos con `style={{` | 177 de 200 (88,5 %) | igual |
| Hexadecimales a mano en TS/TSX | 1 161 usos · **146** valores | 1 161 · **139** |
| El mismo color en dos mayúsculas | 7 valores · 175 sitios | **0** |
| `fontSize` en línea | 2 888 · 39 valores | igual, con 2 peldaños nuevos |
| `borderRadius` en línea | 1 092 · 20 valores | igual, con escala declarada |
| `gap`/`padding` numérico en línea | 3 162 · 34 valores | igual, con escala declarada |
| Tokens que Tailwind ve | **4** | **41** |

## La causa raíz, que es mecánica y no cultural

`@theme inline` exponía **cuatro** tokens. Todo lo demás vivía en variables CSS
de `:root`, y Tailwind no las mira. Para pintar un borde con `--border` no
existía `border-linea`: había que escribir
`style={{ border: '1px solid var(--border)' }}`.

De ahí salen los 6 065 estilos en línea. **No fue dejadez: el código no tenía
alternativa.** Por eso esta unidad empieza ensanchando esa lista, que es lo
único que se puede hacer sin cambiar un píxel — sólo añade utilidades que antes
no existían.

Y hay precedente de que aquí un token bien puesto **sí** se adopta: `--r-pill`
nació con su razón escrita y hoy tiene 131 usos. Faltaba repetirlo para el
resto.

---

## Las escalas, y de dónde salen

Ninguna se inventó. Las tres se midieron sobre el repositorio el 9-ago-2026 y se
quedaron con los peldaños que el producto **ya habla**. Una escala tomada de un
libro obliga a mover medio producto el primer día; una escala medida deja la
mayoría del código ya conforme y aísla la deriva.

### Radio — `--r-xs` … `--r-2xl`, más `--r-pill` y `--r-circulo`

`4 · 6 · 8 · 10 · 12 · 16`, que cubre **804 de los 1 092** radios en línea. Los
intermedios —9 (78), 7 (32), 11 (27), 3 (15), 5 (11)— son la deriva: 163 sitios
que dicen «como el de al lado, más o menos».

En píxeles, no en `rem`: un radio no debe crecer con la preferencia de tamaño de
letra del sistema. Una tarjeta con el radio al doble no es más accesible, es
otra tarjeta.

### Espacio — `--e-1` … `--e-10`

`2 · 4 · 6 · 8 · 10 · 12 · 16 · 20 · 24 · 32`. Base 2 hasta el 12 y base 4 desde
ahí, que es exactamente lo que el producto habla: los que mandan son 8 (620),
6 (366), 10 (434), 12 (252), 4 (185), 16 (132).

**No se fuerza una rejilla de 4** «porque es lo que se hace»: el 6 y el 10 son
534 usos, y redondearlos a 8 mueve medio producto sin que nadie lo haya mirado.

### Tipografía — las clases `.t-*`

La escala tenía seis pasos (28 · 20 · 16 · 14 · 12 · 10,5) y el producto escribe
2 888 tamaños en línea con 39 valores. Los cuatro más usados son 13 (536),
12,5 (466), 12 (422) y 11 (292): **el 13 y el 11 no tenían peldaño**, y quien no
tiene peldaño se inventa uno. Se añaden `.t-body-sm` (13) y `.t-micro` (11).

**No se añaden los medios píxeles** (12,5 · 11,5 · 13,5 — 865 sitios juntos). Un
medio píxel es la firma de una escala que no existía, y colapsarlos cambia la
altura de casi mil líneas de texto: eso se hace mirando la pantalla, y es
`VISUAL-EXCELLENCE-001`.

La escala se expone como **clases**, no como tokens de Tailwind, a propósito: un
peldaño tipográfico es tamaño + peso + interletraje + interlínea + color, y
exponerlo como `text-body` invita a coger sólo el tamaño y reinventar el resto.
Se usa `.t-body`, no `text-[14px]`.

### Color — no se toca

Ya estaba bien y con el contraste medido. Lo único que cambió es la
**ortografía**: `#3d5afe` y `#3D5AFE` convivían, y con siete valores así
cualquier recuento miente por exceso (146 distintos cuando eran 139). CSS no
distingue mayúsculas, así que normalizarlo no cambió un píxel. Es la única cifra
del trinquete que nace en **cero**, y por eso es la única que puede exigirse sin
margen.

---

## La compuerta

`scripts/design/trinquete-de-diseno.mjs` congela seis cifras y **sólo las deja
bajar**, igual que el trinquete de lint. Exigir cero hoy pondría el gate en rojo
el primer día — y un gate que nadie puede poner en verde acaba con
`continue-on-error`, que es como murió el gate de ADRs.

Una pantalla nueva escrita con estilo en línea sube alguna de las seis y **falla
la compuerta**. Ése es el requisito de la unidad: *«hay compuerta que falla si
una pantalla nueva no los usa.»*

```bash
node scripts/design/trinquete-de-diseno.mjs              # comprobar
node scripts/design/trinquete-de-diseno.mjs --actualizar # apretar, tras bajar deuda
```

---

## Lo que este sistema NO resuelve todavía

Se declara aquí para que no se confunda «hay sistema» con «la interfaz está
bien».

- **Nadie ha abierto una pantalla.** Todo son recuentos sobre el código. La
  regla `.claude/rules/design-system.md` es explícita: *no se aprueba una
  interfaz leyendo el código.* Ninguna pantalla está aprobada.
- **Accesibilidad**: sigue sin red. Hay **1** prueba de accesibilidad entre 540,
  y es una expresión regular sobre `layout.tsx`. Objetivo WCAG 2.2 AA →
  `A11Y-GATE-001`, y necesita `axe` sobre el producto corriendo.
- **Regresión visual**: no existe. No hay línea base de píxeles contra la que
  comparar.
- **Adopción de los primitivos** de `components/ui/`: 24 % de los archivos. El
  trinquete no la mide — se puede escribir una pantalla entera con tokens y sin
  un solo `<Button>`.
- **La deuda no ha bajado**, salvo la ortográfica. 1 161 colores a mano, 2 888
  tamaños y 3 162 espacios siguen ahí. Lo que cambió es que ahora **existe la
  alternativa** y la puerta está cerrada por detrás.
- **Móvil, teclado y consola**: sin ejecutar. Este contenedor no tiene
  credenciales de Firebase, así que el producto no arranca aquí.
