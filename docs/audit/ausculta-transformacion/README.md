# Transformación de experiencia de producto — acta

Ocho unidades, del 1-sep-2026. Cada una salió de **mirar el producto servido
en un navegador**, no de leer el código; las capturas de `antes/` y `despues/`
son la prueba, y `interno/` son las pantallas del consultorio con sesión real
contra el emulador.

## Cómo se volvió a mirar

```bash
# superficie pública
npx next dev -p 3100
node scripts/ausculta-transformacion/capturar.mjs http://localhost:3100 <salida> <rutas…>
node scripts/ausculta-transformacion/recorrer.mjs  http://localhost:3100 / <salida> 390

# el consultorio, con sesión (emulador + datos sintéticos)
npx firebase emulators:start --only auth,firestore --project demo-nexusmed-v10
node scripts/design/sembrar-emulador.mjs
npm run arnes:dev                                  # http://localhost:3200
SALIDA=docs/audit/ausculta-transformacion/interno ANCHOS=390,1440 \
  node scripts/carril-excelencia/capturar-con-sesion.mjs http://localhost:3200 hoy <rutas…>

# accesibilidad, en los DOS temas
node scripts/carril-excelencia/axe-recorridos.mjs   http://localhost:3200 <rutas…>   # oscuro
node scripts/ausculta-transformacion/tema-claro.mjs http://localhost:3200 <salida> <rutas…>
node scripts/ausculta-transformacion/axe-detalle.mjs http://localhost:3200 /precios 390

# interacción, que una captura no demuestra
node scripts/ausculta-transformacion/probar-menu.mjs       http://localhost:3200 <salida>
node scripts/ausculta-transformacion/menos-movimiento.mjs  http://localhost:3200
node scripts/ausculta-transformacion/medir-color.mjs
node scripts/ausculta-transformacion/medir-sidebar.mjs
```

## Lo que sólo se vio mirando

| Qué | Cómo se vio | Dónde |
|---|---|---|
| La portada vendía un agendador con bot de WhatsApp | Captura de `/` a 1440 | `antes/landing-1440-p01.png` |
| El sitio público no tenía menú móvil | Captura de `/` a 390 | `antes/landing-390-p00.png` |
| `/opengraph-image` devolvía **HTTP 500** | `curl` a la ruta | — |
| El acento retirado pintaba 37 sitios | Píldora del héroe: relleno cian, borde índigo | `antes/landing-1440-p01.png` |
| 21 fallos de contraste en **tema claro** | axe con `colorScheme: 'light'` | `tema-claro.mjs` |
| La agenda del teléfono no dejaba leer un nombre | Captura de `/calendario` a 390 con sesión | `interno/calendario-hoy-390.png` |
| La agenda salía **rosa** con un solo médico | `getComputedStyle` del bloque real | `medir-color.mjs` |
| El nombre del consultorio envolvía a dos renglones | Alto medido: 42 px en vez de 21 | `medir-sidebar.mjs` |

Y una que sólo se vio **volviendo a medir después de arreglar**: la cabecera
del shell se corrigió en `Sidebar.tsx` y no cambió un píxel, porque a 1440
quien la pinta es `FlowRail.tsx`. El diff se veía perfecto.

## Estado medido al cerrar

| Medida | Antes | Después |
|---|---|---|
| axe grave · 15 rutas públicas × 3 anchos · **oscuro** | 6 | **0** |
| axe grave · las mismas × **claro** | 21 | **0** |
| Alto de la portada · escritorio | 6 496 px | 5 659 px |
| Menú móvil en el sitio público | no existía | 5 destinos, foco atrapado, Escape devuelve el foco |
| Temas del producto en la guía | 14 | 23 |
| Marcas de proveedor de IA de cara al médico | 7 | 0 |
| Trinquete de lint | 95 | **94** |
| Trinquete de diseño · hex en línea | 357 | **328** |
| Trinquete de diseño · tamaños fuera de escala | 1 947 | **1 874** |

## Lo que NO se pudo comprobar aquí, dicho

- **WebKit / iPhone real.** Sólo hay Chromium en este entorno. Todo lo que
  dice «390 px» es Chromium a 390 px, que no es un iPhone.
- **El alto del esqueleto de la puerta** contra el formulario real: verificado
  por lectura. La comprobación de sesión de Firebase se resuelve contra
  IndexedDB y no se deja frenar desde fuera.
- **La línea de tiempo del expediente con años de historia.** El emulador
  siembra un encuentro; juzgar si «cuenta una historia» con una muestra de uno
  sería opinar, no medir.
