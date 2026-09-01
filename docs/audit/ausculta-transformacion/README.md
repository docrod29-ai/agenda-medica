# Transformación de experiencia de producto — acta

Catorce unidades, del 1-sep-2026. Cada una salió de **mirar el producto servido
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

# el portal del paciente (token HMAC, no sesión de equipo)
PORTAL_PACIENTE_SECRET=<16+ caracteres, el mismo del servidor> npm run arnes:dev
PORTAL_PACIENTE_SECRET=… node scripts/ausculta-transformacion/mirar-el-portal.mjs   http://localhost:3200 <salida>
PORTAL_PACIENTE_SECRET=… node scripts/ausculta-transformacion/cancelar-una-cita.mjs http://localhost:3200 <salida>
BASE=http://localhost:3200 PORTAL_PACIENTE_SECRET=… node scripts/carril-excelencia/nada-flotante-tapa-un-control.mjs

# accesibilidad, en los DOS temas
node scripts/carril-excelencia/axe-recorridos.mjs   http://localhost:3200 <rutas…>   # oscuro
node scripts/ausculta-transformacion/tema-claro.mjs http://localhost:3200 <salida> <rutas…>
node scripts/ausculta-transformacion/axe-detalle.mjs http://localhost:3200 /precios 390

# interacción, que una captura no demuestra
node scripts/ausculta-transformacion/probar-menu.mjs       http://localhost:3200 <salida>
node scripts/ausculta-transformacion/menos-movimiento.mjs  http://localhost:3200
node scripts/ausculta-transformacion/el-sitio-es-un-sitio.mjs http://localhost:3200
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
| El aviso de urgencia del paciente era el texto **más pequeño y más apagado** del portal | Estilos computados de los cinco destinos | `portal/preguntar-390-*.png` |
| «Preguntar» pintaba **cero** botones y cero enlaces | `ctrl 0` en las cuatro combinaciones | `mirar-el-portal.mjs` |
| Cancelar una cita salía por un `confirm()` **nativo** | Pulsándolo con un escuchador de diálogos | `cancelar-una-cita.mjs` |
| La barra del portal salía **1440 × 60** en escritorio | Caja medida de `nav[aria-label=Secciones]` | `portal/hoy-1440-dark.png` |
| «IA» y «Regla con código» se pintaban del **mismo color** | Color computado de cada distintivo, uno a uno | `evidencia/fallo-390-dark.png` |
| El sello «PubMed real» seguía puesto con PubMed caído | El estado real, con la salida a PubMed cerrada | `evidencia/fallo-390-dark.png` |
| El menú listaba «Evidencia» y al llegar **no había menú** | Salidas internas contadas página por página | `sitio/evidencia-movil.png` |
| `/privacidad` fallaba la **hidratación** (`<ul>` dentro de `<p>`) | Leyendo la consola del navegador | — |

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
| Trinquete de diseño · tamaños fuera de escala | 1 947 | **1 873** |
| Diálogos nativos del navegador en el portal del paciente | 4 (`confirm` ×1, `alert` ×3) | **0** |
| Destinos del portal sin ninguna acción | 3 de 5 | **0** |
| Ancho de la barra de destinos a 1440 | 1 440 px | **560 px**, centrada sobre la columna |
| El portal en `arnes:nada-tapa` | SIN MEDIR (faltaba el secreto) | **22 controles, 0 tapados** |
| Colores distintos entre los 4 orígenes del razonamiento | 3 de 4 | **4 de 4**, y con tinte propio |
| Trinquete de diseño · tamaños fuera de escala | 1 947 | **1 869** |
| Páginas públicas con la navegación del sitio | 3 de 11 | **11 de 11** |
| Salidas internas de `/evidencia` | 1 | **8** |
| Menús pintados dentro de `<main>` | 4 | **0** |
| Errores de hidratación en las páginas legales | 1 | **0** |

## Lo que NO se pudo comprobar aquí, dicho

- **WebKit / iPhone real.** Sólo hay Chromium en este entorno. Todo lo que
  dice «390 px» es Chromium a 390 px, que no es un iPhone.
- **El alto del esqueleto de la puerta** contra el formulario real: verificado
  por lectura. La comprobación de sesión de Firebase se resuelve contra
  IndexedDB y no se deja frenar desde fuera.
- **La línea de tiempo del expediente con años de historia.** El emulador
  siembra un encuentro; juzgar si «cuenta una historia» con una muestra de uno
  sería opinar, no medir. Se resolvió sembrando once
  (`sembrar-historia-larga.mjs`), y ahí salió la fecha corrida de un día.
- **El panel de razonamiento DENTRO de la consulta.** Se monta sólo si hay
  diagnósticos, medicamentos, resumen o signos, y la consulta sembrada está en
  blanco: el arnés no encontró ni el desplegable. Lo verificado es el mismo
  componente en `/demo/razonamiento`. Sembrar una consulta con datos clínicos
  es trabajo con nombre.
- **El estado de ÉXITO de la evidencia en vivo.** Este entorno no alcanza
  `eutils.ncbi.nlm.nih.gov` —el proxy de salida lo rechaza—, así que se midió
  con la respuesta simulada (`page.route`). Lo que devuelva la red real, no
  visto.
- **Que el `tel:911` marque de verdad.** Chromium sin marcador no llama a nadie.
  Lo comprobado es que el destino sea un enlace `tel:` con el número del módulo,
  y no texto muerto.
- **El aviso de urgencia repetido en los cinco destinos.** Es una decisión, no
  una medición: la regla dice que la urgencia gana, y ver el aviso cinco veces
  cuesta menos que no verlo una. Si a un paciente real se le vuelve invisible
  por costumbre, eso sólo se sabe con pacientes reales.

## Dos trampas del arnés que dieron falsos verdes

Las dos costaron una lectura equivocada antes de descubrirse, y las dos están
ya cerradas en el guion que las sufrió:

1. **El limitador de tasa.** `/api/portal` permite 15 peticiones de alcance
   clínico cada diez minutos, y cada carga gasta dos. Pasado el tope, «Cuidado»
   y «Documentos» pintan sus estados de error —que son correctos, y no son el
   portal— y la captura se ve sanísima. `mirar-el-portal.mjs` ahora **aborta con
   3** si ve un 429.
2. **Una medición contra la hoja vieja.** `arnes:nada-tapa` se corrió sobre el
   portal ANTES de descubrir el CSS rancio, así que midió la barra apilada y
   no la que se despliega. Salió el mismo resultado —0 tapados— pero por
   suerte, no por método: se repitió con la hoja buena (789 controles, 0
   tapados) y **ése** es el número que cuenta.
3. **Medir a media animación.** La portada entra con `nx-acto`, que arranca en
   `opacity: 0`. axe lanzado ahí lee ese cero y canta contraste 1,55 — y como
   el reparto de tiempos cambia con lo que tarde en compilar el servidor, la
   violación salía **en una ruta distinta en cada corrida**. Una violación que
   se mueve de sitio no es un defecto: es un cronómetro mal puesto. Comprobado
   a 1,6 s, 4 s y 8 s: cero. El arnés espera ahora a que acaben las animaciones
   **finitas** — esperar al latido infinito del héroe lo colgaba, y un arnés
   colgado no da un rojo, no da nada.
4. **La hoja de estilos servida en caliente.** `next dev` volvió a servir el CSS
   viejo tras editar `globals.css`: la barra de destinos se midió en 358 × 294,
   apilada, porque la regla nueva sencillamente no estaba en el fragmento
   servido. Se comprueba pidiendo el `.css` servido y buscando la regla dentro;
   se arregla parando el servidor, borrando `.next` y arrancando en frío. Van
   cuatro veces en esta rama.
