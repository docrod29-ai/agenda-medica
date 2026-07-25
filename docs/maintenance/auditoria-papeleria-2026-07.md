# Auditoría de papelería médica (diseño gráfico / imprenta / impresión) — 2026-07-24

Equipo de 6 auditores especializados (tipografía, imprenta/pre-prensa, ingeniería de impresión web, membrete/logo, cumplimiento NOM/COFEPRIS, UX) + verificación adversarial de cada hallazgo. Motivada por el reporte del Dr de que la nota impresa se veía mal.

**30 hallazgos confirmados** ({'P0': 2, 'P1': 5, 'P2': 13, 'P3': 10}).

---

### 1. [P0] membrete-logo — `src/lib/print-element.ts:87`
**El membrete de la NOTA se imprime deformado (object-fit:fill) — viola el requisito #1**

- **Impacto:** La hoja membretada que sube el médico se ESTIRA para llenar una hoja carta. En print-element.ts:87 el CSS del popup fuerza `.membrete-bg{object-fit:fill!important}` y en la nota en pantalla (nota page:225) el <img className="membrete-bg"> lleva inline `objectFit:'fill'`. Salvo que el membrete tenga EXACTAMENTE proporción carta (216:279), se deforma: logo achatado o estirado. Es justo el caso del membrete apaisado del Dr. (documentado en memoria). Contradice al requisito #1 y al propio patrón CORRECTO que ya usa la RECETA, que estampa el diseño subido con `objectFit:'contain'` (RecetaDocumento.tsx:546).
- **Reproducción:** Configuración → subir una hoja membretada cuya proporción NO sea carta (p.ej. logo/encabezado apaisado). Abrir una nota con ese membrete → Imprimir. El membrete de fondo sale estirado a carta; el logo se ve deformado tanto en la vista previa como en el papel.
- **Arreglo:** Cambiar ambos `object-fit:fill` a `object-fit:contain` (print-element.ts:87 y nota page:225), igual que la receta. Con la página a sangre (margin:0) y position:fixed, `contain` centra el membrete respetando su proporción; si el membrete no es carta quedará letterbox blanco en vez de deformación. Alternativa superior (como se hizo en recetas): dimensionar la hoja a la proporción real del membrete en vez de forzar carta, pero el requisito #2 exige carta para notas, así que `contain` es el fix correcto y mínimo.

### 2. [P0] membrete-logo — `src/lib/print-element.ts:87`
**La hoja membretada SUBIDA para NOTAS se estira con object-fit:fill y deforma el logo/encabezado**

- **Impacto:** Viola de frente el requisito #1 (respetar el logo, nunca deformarlo). Toda la tubería de la hoja membretada de NOTAS usa object-fit:fill sobre un lienzo fijo tamaño carta (216x279): print-element.ts:87 (.membrete-bg{...object-fit:fill!important}), la vista previa en vivo nota page:225 (objectFit:'fill') dentro de un #doc con aspectRatio:'216 / 279' (nota page:213), y la vista previa de Configuracion secciones-cuenta.tsx:436 (objectFit:'fill') dentro de un contenedor con aspectRatio 216/279. object-fit:fill IGNORA la proporcion real de la imagen y la aplasta hasta llenar el marco. Cualquier hoja membretada cuya relacion ancho/alto no sea EXACTAMENTE la de carta (un escaneo con margenes distintos, un membrete apaisado, un membrete media-carta, un PNG con relacion 1:1) sale con el logo, el nombre del medico y la tipografia estirados o achatados. Es exactamente el mismo defecto que ya se corrigio para RECETAS (donde HojaCustom usa object-fit:contain y detecta el aspecto real via imgAspect), pero que quedo SIN corregir para las notas. Contraste directo: RecetaDocumento.tsx:546 usa 'contain'; la nota usa 'fill'.
- **Reproducción:** El medico sube en Configuracion una hoja membretada que no es carta perfecta (p.ej. su escaneo real es ~210x280 o su membrete es apaisado, o un PNG cuadrado con su logo). Genera una nota, Imprimir. En pantalla (preview) y en el papel el logo/encabezado aparece estirado horizontal o vertical respecto al original. En un membrete apaisado el efecto es grosero: se ve claramente deformado.
- **Arreglo:** Cambiar los tres object-fit:'fill' a 'contain' con objectPosition centrado (respeta SIEMPRE la proporcion; si el membrete ya es carta se ve identico, si no, letterboxea en vez de deformar). Mejor aun, replicar lo que ya hace la receta: leer el aspecto natural de la imagen (naturalWidth/naturalHeight) y, en el modo 'membrete' de print-element.ts, fijar @page al tamano real del membrete en vez de 'size:letter' fijo, para que llene la hoja sin bandas y sin estirar. Como las notas deben ir en carta (requisito #2), la solucion minima y segura es 'contain' centrado; la solucion completa es detectar dimensiones reales del membrete y ofrecer imprimir a ese tamano. Nunca 'fill'.

### 3. [P1] membrete-logo — `src/lib/print-element.ts:87`
**object-fit:fill DEFORMA la hoja membretada al imprimir notas (viola requisito #1)**

- **Impacto:** La ventana de impresión de NOTAS fuerza `@page{size:letter}` (carta vertical) y estira el membrete de fondo con `object-fit:fill!important`. Cualquier hoja membretada cuya proporción NO sea exactamente 216:279 (carta vertical) sale DEFORMADA: un membrete apaisado (el caso del Dr., según su historial) se aplasta horizontalmente y se estira verticalmente, el logo queda ovalado y las zonas pre-impresas del papel (líneas de Nombre/Fecha, encabezado, pie) se desalinean respecto al texto que la app sobrepone → exactamente el 'empalme y texto fantasma' reportado. La misma deformación ocurre en la vista previa/pantalla de la nota (nota page:225, mismo object-fit:fill sobre un contenedor con aspectRatio '216/279'), así que el médico calibra los márgenes contra una previsualización ya deformada. Rompe requisitos #1 (nunca deformar logos) y #3 (usar SU hoja tal cual).
- **Reproducción:** Config → Cuenta → 'Hoja membretada para notas': el Dr. sube su papel membretado apaisado (o cualquier proporción ≠ carta vertical). Abre una nota firmada → Imprimir. print-element.ts arma el popup con `.membrete-bg{object-fit:fill!important}` sobre `@page size:letter`. El membrete sale estirado/aplastado y su encabezado/pie impreso no coincide con el texto de la nota → se encima.
- **Arreglo:** Cambiar `object-fit:fill` → `object-fit:contain` en print-element.ts:87 Y en nota/[patientId]/[notaId]/page.tsx:225 (y por coherencia en el preview secciones-cuenta.tsx:436). `contain` preserva la proporción del papel del médico sin deformar el logo (a lo sumo deja franja blanca si el papel no es carta). Es el mismo criterio que ya usa correctamente la RECETA (RecetaDocumento.tsx:546 usa object-fit:contain). Compárese con la solución del path de receta, que además guarda las dimensiones reales del membrete y orienta la hoja.

### 4. [P1] impresion-web — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:63`
**El botón Descargar PDF diverge del Imprimir: deforma el membrete y no lo repite por hoja**

- **Impacto:** descargarPDF (nota:56-63) llama a descargarComoPDF(el, {filename}) SIN pasar formato/margen → usa los defaults de pdf-download.ts:29-31 (letter, margin 12mm). Problemas: (1) html2pdf captura el #doc con `objectFit:'fill'` (nota:225) → membrete deformado igual que en impresión, sin la corrección del hallazgo P0. (2) html2pdf AÑADE 12mm de margen alrededor del #doc, que a su vez ya trae padding = mMemb (p.ej. 42mm arriba): el membrete de fondo queda con un borde blanco de 12mm y NO llega al filo de la hoja (un membrete a sangre debe cubrir hasta el borde). (3) En notas de varias hojas el membrete es un solo <img> `height:100%` estirado sobre TODO el #doc alto: html2pdf rebana ese canvas por página, así que la hoja 1 muestra la franja superior del membrete y las hojas 2+ NO tienen encabezado/logo. En cambio el popup de Imprimir sí lo repite por página (position:fixed). Vista previa, PDF e impreso NO coinciden (rompe WYSIWYG y el requisito #1).
- **Reproducción:** Nota larga (2+ hojas) con hoja membretada → Descargar PDF. La hoja 2 sale sin membrete y el membrete de la hoja 1 aparecido deformado y con margen blanco alrededor. Comparar con el botón Imprimir: ahí sí se repite por hoja. Los dos caminos entregan documentos distintos.
- **Arreglo:** Para notas con membrete, el PDF debe seguir la MISMA estrategia que el popup: márgenes a 0 en jsPDF (`margin:0`) y repetición del membrete por página. Como html2pdf/html2canvas no soporta position:fixed repetido, lo robusto es unificar: que el botón PDF de la nota use un render con la tabla thead/tfoot espaciadora (igual que print-element 'membrete') y objectFit:contain, o generar el PDF desde el popup (print → guardar como PDF). Como mínimo inmediato: pasar `margin:0` y corregir objectFit a contain para que no deforme ni deje borde. Documentar que para membrete multipágina se use Imprimir → Guardar como PDF.

### 5. [P1] membrete-logo — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:170`
**En la NOTA, si no hay firma por-medico se estampa la firma GLOBAL del consultorio (firma de otro medico)**

- **Impacto:** Riesgo de suplantacion de identidad en un documento legal (NOM-004). La cadena de fallback de firmaMostrar (nota page:168-170) termina en `|| config?.firmaImagenDataUrl` SIN el guard de unicoMedico. La pagina de ORDEN resuelve esto CORRECTAMENTE (orden page:403: `(unicoMedico ? config.firmaImagenDataUrl : undefined)`) y hasta muestra un aviso 'saldra sin firma... seria la firma de alguien mas'. La NOTA no: en un consultorio con varios medicos, ante una nota firmada de legado sin snapshot de firma y cuyo medicoId no hace match exacto en firmaPorMedico (el desajuste uid<->id de doctors que documenta impreso-medico.ts es el caso NORMAL, no la excepcion), cae a la firma global (tipicamente la del dueno) y estampa la firma escaneada de OTRO medico en la nota impresa. entradaPorMedico ya protege bien; este ultimo `|| config?.firmaImagenDataUrl` deshace esa proteccion.
- **Reproducción:** Consultorio con doctores A (dueno, con firma global configurada) y B. Nota firmada por B en formato de legado (sin nota.firma.imagenDataUrl) o cuyo medicoId no coincide con la entrada de B en firmaPorMedico. Abrir la nota e Imprimir/Descargar PDF: aparece la firma de A sobre el nombre y cedula de B.
- **Arreglo:** Alinear la NOTA con la ORDEN: reemplazar el fallback `|| config?.firmaImagenDataUrl` por `|| (unicoMedico ? config?.firmaImagenDataUrl : undefined)`. Con varios medicos, mejor sin firma (se nota y se corrige) que con la firma de otro (no se nota nunca). Opcional: mostrar el mismo aviso que la orden cuando no hay firma resoluble.

### 6. [P1] nom-cumplimiento — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:346`
**La NOTA impresa estampa "Cédula Profesional —" cuando falta la cédula, sin avisar**

- **Impacto:** La cédula profesional es un dato OBLIGATORIO del documento clínico (NOM-004-SSA3-2012). En el bloque de firma, cedula se resuelve como `nota.firma?.cedulaProfesional || config?.cedulaProfesional || '—'` (línea 160) y la línea 346 imprime incondicionalmente `Cédula Profesional {cedula}`, produciendo literalmente 'Cédula Profesional —'. Un guion parece relleno de maquetación, no la AUSENCIA de un requisito legal: el médico entrega una nota que aparenta estar completa. Esto es exactamente el antipatrón que RecetaDocumento.tsx YA corrigió (ver su comentario en líneas 851-856, donde reemplazó 'Cédula Prof. —' por '[FALTA CÉDULA PROFESIONAL]' en rojo). Además, a diferencia de las páginas de receta y orden, esta página NO muestra el banner `sinCedula` de aviso previo, así que el médico nunca se entera antes de imprimir.
- **Reproducción:** Config sin cédula profesional (Configuración → General vacío) y una nota sin snapshot de firma con cédula → abrir /nota/[pid]/[nid] → Imprimir. El bloque de firma sale 'Cédula Profesional —' y no aparece ningún aviso rojo como sí ocurre en receta/orden.
- **Arreglo:** Replicar el patrón de RecetaDocumento.tsx: si cedula === '—', imprimir '[FALTA CÉDULA PROFESIONAL]' en rojo en lugar del guion, y añadir en esta página el mismo banner `sinCedula` (no-print) que ya existe en receta/orden para avisar antes de imprimir. No afecta el layout del médico que sí tiene cédula.

### 7. [P1] impresion-web — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:184`
**La vista previa de la NOTA no coincide con lo que imprime ni con el PDF (tres renders distintos) y el botón primario es el peor camino**

- **Impacto:** El médico ve en pantalla un #doc con aspectRatio 216/279 y membrete object-fit:fill (líneas 210-226). 'Descargar PDF' (botón PRIMARIO teal, línea 184) rasteriza ESE elemento con html2pdf (pdf-download.ts: sin format, avoid-all), mientras 'Imprimir' (secundario, línea 189) usa una ruta totalmente distinta en print-element.ts (tabla thead/tfoot que sí reserva la banda del membrete por página). Encima existe un tercer render: el @media print propio de la página (líneas 509-517, con padding 24px 28px y @page margin 1.5cm) que se activa si el médico usa Ctrl+P del navegador. Son 3 layouts diferentes para el mismo documento; la vista previa no representa a ninguno de forma confiable, y la jerarquía visual empuja al médico hacia 'Descargar PDF', que es justamente el que estira el membrete y no lo repite por hoja.
- **Reproducción:** Médico con hoja membretada sube una nota larga (2+ páginas) → la vista previa se ve 'bien' en una hoja carta. Si pulsa 'Descargar PDF' (el botón grande teal) el membrete se estira sobre todo el alto multipágina; si pulsa 'Imprimir' obtiene la paginación correcta con banda repetida; si hace Ctrl+P obtiene un tercero. Tres resultados, ninguno igual a lo que vio.
- **Arreglo:** Unificar en UNA sola ruta de render para preview, PDF e imprimir (idealmente la de print-element.ts con tabla espaciadora), y que 'Descargar PDF' genere el PDF DESDE esa misma composición (p.ej. imprimir a PDF vía la misma ventana) en vez de rasterizar el #doc con aspectRatio. Eliminar el @media print redundante de las líneas 509-517 para que Ctrl+P no produzca un cuarto camino. Respeta los 7 requisitos: no deforma el membrete y mantiene carta multipágina con márgenes.

### 8. [P2] diseno — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:212`
**Las tres piezas de papelería del mismo médico usan familias tipográficas distintas (serif vs sans) — no leen como un sistema**

- **Impacto:** La NOTA y la CARTA DE REFERENCIA se renderizan en serif '"Times New Roman", Georgia' (nota page:212 y 218; referencia page:187), mientras la RECETA y la ORDEN por default se renderizan en sans '"Inter", system-ui' (RecetaDocumento HojaGenerada:699-703, estilo 'minimalista'). El paciente recibe del MISMO consultorio, el MISMO día, dos documentos con esqueleto tipográfico opuesto: una receta sans y una nota/referencia serif. Rompe la identidad de marca de la papelería y hace que se vean como salidos de sistemas diferentes. Va contra el requisito #5 (coherencia).
- **Reproducción:** Firmar una nota, imprimirla (serif Times), y desde la misma nota generar la Receta (sans Inter). Poner ambas hojas juntas: distinta familia, distinto color de acento, distinta jerarquía. La carta de referencia (referencia page:187) agrava la incoherencia con un tercer tratamiento serif sin membrete configurable.
- **Arreglo:** Definir UNA familia tipográfica de papelería compartida por los cuatro renderizadores (p. ej. una constante FONT_PAPELERIA) y aplicarla a nota, referencia y a HojaGenerada. Si el médico eligió estilo 'clasico' (serif) que aplique a los cuatro; si 'minimalista/moderno' (sans) idem. Respeta requisitos #3/#5: cuando el médico sube su propio diseño/membrete, ese gana y este default no aplica.

### 9. [P2] nom-cumplimiento — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:346`
**La nota y la referencia imprimen 'Cédula Profesional —' cuando falta la cédula: parece un guion de maqueta, no un dato obligatorio ausente**

- **Impacto:** En el bloque de firma la nota imprime literalmente 'Cédula Profesional {cedula}' con cedula cayendo a '—' (nota page:160 y 346); la carta de referencia hace lo mismo (referencia page:243). El resultado impreso es 'Cédula Profesional —', que se lee como un guion de diseño y hace que un documento legalmente incompleto luzca completo y válido. La RECETA ya se corrigió para esto: cuando falta la cédula imprime '[FALTA CÉDULA PROFESIONAL]' en rojo (RecetaDocumento:854-856). Nota y referencia se quedaron con el comportamiento viejo. La cédula es requisito del impreso (NOM-004).
- **Reproducción:** Con un consultorio sin cédula configurada (config.cedulaProfesional vacío), abrir e imprimir una nota firmada: el pie de firma sale 'Cédula Profesional —', visualmente igual a un documento válido. La misma nota generada como receta sí avisa en rojo.
- **Arreglo:** Reutilizar el patrón ya existente de la receta: si cedula === '—' (o vacío), mostrar '[FALTA CÉDULA PROFESIONAL]' en rojo en el pie de firma de nota page:343-347 y referencia page:240-244, en vez de imprimir el guion silencioso.

### 10. [P2] imprenta — `src/lib/print-element.ts:84`
**El @page de notas está fijo en 'letter' y nunca usa las dimensiones reales del membrete**

- **Impacto:** En modo 'membrete' (notas) el CSS es `@page{size:letter;margin:0}` HARDCODEADO. Los parámetros `anchoMm/altoMm` que acepta imprimirElemento SOLO se aplican en la rama 'sangre' (línea 96); en 'membrete' y 'carta' se ignoran. Además, a diferencia de la receta —que guarda disenoWidthMm/disenoHeightMm al subir el diseño y con eso orienta la hoja (RecetaDocumento paperEfectivo:117-120)— la carga de hoja membretada para notas (secciones-cuenta.tsx subir:361-385) NO captura ni almacena el tamaño real en mm: solo guarda url + márgenes. Por eso una hoja A4, oficio o apaisada no puede orientar la página: el navegador la mete en carta vertical y el contenido se escala/recorta o desalinea contra las zonas pre-impresas del papel. Requisito #2 pide notas en CARTA, pero eso debe ser el DEFAULT cuando no hay papel propio; cuando el médico sube SU papel (req #3), la hoja debería respetar su tamaño/orientación real.
- **Reproducción:** El Dr. sube como hoja membretada de notas un papel A4 (210×297) o apaisado. Imprime una nota. print-element.ts:84 emite `@page{size:letter}` sin considerar 210×297 ni la orientación → el fondo membretado (object-fit:fill/contain sobre letter) y el texto no caen donde el papel físico los espera.
- **Arreglo:** 1) Capturar en secciones-cuenta.tsx (igual que subirDisenoCompleto de recetas) el widthMm/heightMm real del PDF/imagen y persistirlo junto a notaMembrete. 2) Pasar esas dimensiones a imprimirElemento y, en la rama 'membrete', usar `@page{size:${anchoMm}mm ${altoMm}mm;margin:0}` cuando existan; si no existen, caer a `size:letter` (default carta, requisito #2 y #5). Reutilizar la lógica ya probada de paperEfectivo/dimensionesImpresion de RecetaDocumento en lugar de duplicarla.

### 11. [P2] imprenta — `src/lib/print-element.ts:84`
**Membrete a sangre (margin:0) sin zona segura: la impresora láser recorta el borde del logo**

- **Impacto:** El modo 'membrete' imprime a sangre (`@page margin:0`) y el fondo cubre la hoja al 100%. Las impresoras láser/inyección de consumo tienen un margen físico NO imprimible de ~4-6 mm en los cuatro cantos; cualquier logo, marco o franja de color del membrete que llegue al borde se CORTA en el papel real (o el driver reescala toda la página para 'ajustar', desalineando el contenido). No hay líneas de corte ni safe-zone. La receta ya ofrece la opción 'Hoja carta + corte' vs 'Papel exacto' para mitigar esto (secciones-recetas.tsx:542-568), pero las notas siempre van a sangre.
- **Reproducción:** Membrete con un marco/logo que toca el borde superior o lateral. Imprimir nota en una láser típica → el marco sale recortado en ese canto porque cae en la zona no imprimible del hardware.
- **Arreglo:** Para el default de notas (sin papel propio) usar un pequeño margen físico seguro (p.ej. `@page margin:5mm`) o documentar 'ajustar a área imprimible' desactivado. Cuando el médico sube su papel, avisar en la config que deje ~5 mm de zona segura sin arte, o replicar el toggle 'carta + corte' de recetas para notas. No deformar ni reescalar el arte del médico.

### 12. [P2] imprenta — `src/app/(dashboard)/configuracion/secciones-recetas.tsx:141`
**Resolución del membrete/pie por debajo de 300 DPI de imprenta al ancho carta**

- **Impacto:** El membrete de receta se redimensiona a maxWidth 1400 px (línea 141-143) y la hoja membretada de notas a 1240×1650 px (secciones-cuenta.tsx:373). Al imprimirse a ancho carta (216 mm = 8.5 in): 1400 px ⇒ ~165 DPI; 1240 px ⇒ ~146 DPI. El estándar de imprenta es 300 DPI (mínimo aceptable ~200). A esas densidades el logo y el texto fino del membrete salen SUAVES/pixelados en impresión, sobre todo en carta y oficio. Es incoherente con el path de diseño completo de receta, que sube a 300 DPI PNG a propósito (secciones-recetas.tsx:196). En media-carta el problema es menor (1400/5.5in ≈ 254 DPI). mmToPx a 96 DPI (receta-template.ts:34) es correcto para el LAYOUT en CSS (px independientes del dispositivo al imprimir), así que el problema no es el layout sino la resolución del bitmap subido.
- **Reproducción:** Subir un membrete con logo + texto de dirección pequeño para papel carta. Imprimir receta/nota a ancho carta y comparar con el PDF original: el bitmap se ve borroso porque está a ~150-165 DPI, no 300.
- **Arreglo:** Subir membrete y hoja membretada a mayor resolución cuando hay Storage (que ya no impone el límite de 1 MB de Firestore): elevar maxWidth del membrete a ~2550 px (300 DPI × 8.5 in) y la hoja de notas a ~2550×3300, conservando PNG para líneas/tipografía. Mantener el fallback reducido solo cuando NO hay Storage. Esto reutiliza la misma estrategia de calidad ya escrita para el diseño completo de receta.

### 13. [P2] impresion-web — `src/lib/print-element.ts:57`
**Los avisos internos .no-print SÍ se imprimen en el popup (falta la regla en el CSS enlazado)**

- **Impacto:** print-element.ts:57 copia al popup SOLO las hojas `<link rel=stylesheet>`, y explícitamente NO los `<style>` de página. Pero la regla `.no-print{display:none}` está definida ÚNICAMENTE dentro de los `<style>` inline de cada página (nota:514, receta:717, orden:698, referencia:253) y en NINGÚN `<link>` (grep en globals.css = 0 coincidencias). Resultado: los elementos con className="no-print" que viven DENTRO de #doc se copian con `el.outerHTML` pero no hay regla que los oculte en el popup, así que se IMPRIMEN. En la nota son cajas de advertencia interna: el aviso gris 'Nota firmada con formato de sello anterior…' (nota:371-382, estado legado, muy común en notas viejas) y la alerta roja 'INTEGRIDAD NO VERIFICADA' (nota:356-368). Terminan en un documento legal impreso.
- **Reproducción:** Abrir una nota firmada antigua (integridad='legado') → botón Imprimir. En la hoja aparece la caja gris de aviso de sello que en pantalla es 'no-print'. Con una nota marcada 'alterada' saldría además la caja roja de integridad.
- **Arreglo:** Añadir `.no-print{display:none!important}` al `pageCss` que print-element inyecta en el popup (aplica a los tres formatos), o mejor: mover la regla `.no-print` a globals.css (hoja enlazada) para que valga en el popup Y en el Ctrl+P nativo. Con eso se garantiza que nada marcado no-print llegue al papel por ninguna vía.

### 14. [P2] impresion-web — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:213`
**La vista previa de la nota miente para membrete multipágina (aspect-ratio fijo + fill)**

- **Impacto:** El #doc de la nota fija `aspectRatio:'216 / 279'` (nota:213) y un único membrete-bg con `objectFit:'fill'`. La vista previa muestra UNA hoja con el membrete estirado a todo el alto del contenido. Pero la impresión real (popup 'membrete') pagina en varias hojas carta y repite el membrete por hoja vía thead/tfoot + position:fixed. Por tanto lo que el médico ve (una hoja larga, membrete deformado, sin cortes de página) no representa lo impreso (N hojas carta con membrete repetido). El WYSIWYG falla justo donde más importa: no puede prever dónde cae el corte de página ni cómo se ve el membrete real.
- **Reproducción:** Nota larga con membrete: la vista previa en pantalla muestra un solo bloque continuo con el membrete estirado; al imprimir salen varias hojas carta con el membrete a proporción repetido. Lo previsualizado y lo impreso no coinciden.
- **Arreglo:** Alinear la previa con el motor de impresión: usar objectFit:contain (hallazgo P0) y, para dar sensación de multipágina, envolver la previa en el mismo esquema de hoja carta con banda superior/inferior reservada (como el thead/tfoot del popup) o al menos indicar los cortes de página estimados. No es sangrante pero evita sorpresas al imprimir.

### 15. [P2] nom-cumplimiento — `src/app/(dashboard)/referencia/[patientId]/page.tsx:243`
**La CARTA DE REFERENCIA imprime "Cédula Profesional —" cuando falta la cédula**

- **Impacto:** Mismo defecto que la nota: `cedula = config?.cedulaProfesional || '—'` (línea 101) y la línea 243 imprime siempre `Cédula Profesional {cedula}` = 'Cédula Profesional —'. La referencia/contrarreferencia es documento de continuidad asistencial regido por NOM-004; el prescriptor debe quedar identificado con cédula. El propio membrete de arriba (línea 193) ya oculta la cédula cuando es '—', lo que hace la incoherencia más evidente: el encabezado la esconde pero el pie la imprime como guion. Tampoco hay banner `sinCedula`.
- **Reproducción:** Config sin cédula → abrir /referencia/[pid] → Imprimir. El pie de firma sale 'Cédula Profesional —' aunque el encabezado no muestre cédula.
- **Arreglo:** Igual que la nota: si cedula === '—', marcar '[FALTA CÉDULA PROFESIONAL]' en rojo en el pie (línea 243) y agregar aviso previo. Alternativamente ocultar la línea de cédula igual que en el encabezado, pero preferible marcarla porque es dato obligatorio.

### 16. [P2] nom-cumplimiento — `src/components/RecetaDocumento.tsx:969`
**El recetario DEFAULT puede omitir en silencio el domicilio del consultorio (requisito COFEPRIS)**

- **Impacto:** El Reglamento de Insumos para la Salud (art. 28) y la práctica COFEPRIS exigen que la receta lleve impresos nombre, DOMICILIO y cédula del prescriptor. En el encabezado auto-generado (EncabezadoAuto, estilo 'minimalista' que es el default en línea 687), `direccion` y `telefono` se renderizan solo `{direccion && ...}` / `{telefono && ...}` (líneas 969-970; igual en clásico 948 y moderno 930-934). Si el médico no capturó dirección, el impreso sale SIN domicilio y sin ningún aviso. La cédula ya se marca en rojo cuando falta (líneas 854-856) y hay banner `sinCedula`, pero el domicilio —también obligatorio— desaparece calladamente. Solo aplica a la plantilla generada; el diseño/membrete subido por el médico se respeta y no se toca (requisito #1).
- **Reproducción:** Consultorio sin 'direccion' en config, sin diseño de receta subido, estilo minimalista (default) → generar receta → el encabezado no incluye domicilio y no hay advertencia.
- **Arreglo:** Añadir en las páginas de receta/orden un aviso análogo a `sinCedula` cuando `!config.direccion?.trim()`, indicando que el domicilio es requisito del recetario. No cambiar el layout cuando el dato existe; respetar el default que le gusta al dueño.

### 17. [P2] nom-cumplimiento — `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:394`
**El aviso "saldrá marcado en rojo" es falso cuando el médico usa su DISEÑO propio de receta**

- **Impacto:** El banner `sinCedula` (líneas 387-399, idéntico en orden 499-511) promete: 'El documento saldrá marcándolo en rojo, porque la cédula es requisito del impreso (NOM-004)'. Pero ese marcado rojo SOLO existe en HojaGenerada (RecetaDocumento.tsx línea 856). Con diseño propio subido (disenoCompletoDataUrl) se usa HojaCustom, que NO estampa ni marca cédula: confía en que la imagen del médico ya la trae. Si el médico usa su diseño y su config no tiene cédula, el impreso sale sin marca roja alguna, contradiciendo el aviso. En la práctica el diseño suele traer la cédula impresa, por eso es P2 y no P1, pero el texto del aviso induce a error sobre lo que realmente saldrá.
- **Reproducción:** Config sin cédula + diseño de receta subido (disenoCompletoDataUrl) → aparece banner rojo 'saldrá marcándolo en rojo' → imprimir → el documento custom sale sin ninguna marca roja de cédula.
- **Arreglo:** Condicionar el texto del banner: si hay diseño propio, cambiar a 'verifica que tu formato ya incluya la cédula, la app no puede marcarla sobre tu diseño'; si es plantilla generada, mantener el texto actual.

### 18. [P2] nom-cumplimiento — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:232`
**El nombre del establecimiento (obligatorio NOM-004) se omite en silencio en la nota**

- **Impacto:** NOM-004-SSA3-2012 exige que el documento identifique el establecimiento (nombre/razón social). En línea 162 `establecimiento = nota.metadata.establecimiento || config?.nombreClinica || ''` y en línea 232 se renderiza solo `{establecimiento && ...}`. Si ambos están vacíos, la nota impresa no lleva establecimiento y no hay aviso. Además la nota no imprime folio/identificador visible (se apoya solo en el sello SHA-256 al pie, líneas 385-395), a diferencia de receta/orden que sí llevan folio.
- **Reproducción:** Config con nombreClinica vacío y nota sin metadata.establecimiento (sin hoja membretada que lo traiga) → imprimir nota → sin línea de establecimiento y sin advertencia.
- **Arreglo:** Cuando no haya establecimiento resoluble (y no exista hoja membretada del médico que ya lo incluya), mostrar aviso no-print al médico de que falta un dato obligatorio; opcionalmente imprimir el folio de la nota junto al sello para trazabilidad NOM-004.

### 19. [P2] nom-cumplimiento — `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx:229`
**El QR de la receta valida identidad y folio, pero NO el contenido: una receta con dosis alterada conserva folio y QR válidos**

- **Impacto:** El folio es estable (derivado del notaId, líneas 94-97) y el token del QR se firma con clinicId, notaId, folio, doctorNombre y cédula (verificacion-url/route.ts líneas 25-31) — NO incluye el hash de los medicamentos. Los medicamentos son editables en esta pantalla incluso después de firmada la nota (setMedicamentos, líneas 352-356). Por tanto se puede cambiar una dosis, reimprimir con el MISMO folio y el MISMO QR 'verificable', dando falsa sensación de inalterabilidad sobre el contenido prescrito. El huellaImpreso solo va al log de auditoría (línea 426), no al QR ni a nada que el verificador consulte.
- **Reproducción:** Generar receta (folio RX-XXXX, QR válido), imprimir; volver, cambiar '500 mg' a '5000 mg' en un medicamento, reimprimir. Mismo folio, mismo QR que 'verifica' correctamente, contenido distinto.
- **Arreglo:** Incluir en el token/QR un hash del contenido prescrito (huellaImpreso ya existe) para que la página de verificación pueda detectar discordancia, o mostrar en /verificar el resumen firmado de medicamentos. Decisión del Dr. sobre cuánto endurecer, ya que la receta no es un documento inmutable como la nota firmada.

### 20. [P2] impresion-web — `src/app/(dashboard)/configuracion/secciones-recetas.tsx:781`
**'Imprimir prueba' en Configuración prueba un flujo de impresión DISTINTO al real (window.print vs popup) y en OTRO tamaño de papel**

- **Impacto:** El objetivo del botón 'Imprimir prueba' es que el médico valide su formato/impresora ANTES de darle un papel al paciente. Pero imprimirPrueba (líneas 781-791) hace window.print() sobre toda la página apoyándose en body.print-solo-receta (globals.css 1193-1206) que NO define @page size, mientras que la receta real usa imprimirElemento() con @page{size: ancho/alto mm; margin:0} (receta page línea 426). Además PreviewReceta dimensiona con PAPER_SIZES[rx.paperSize] (línea 747) sin aplicar el forzado imprimirEn:'carta' (host carta con recorte) que sí aplica la receta real (dimensionesImpresion). Resultado: el ensayo se ve/pagina diferente a la impresión real → confianza falsa.
- **Reproducción:** Médico con receta media-carta calibra su diseño, pulsa 'Imprimir prueba' y sale una caja media-carta sobre una hoja carta con márgenes por defecto del navegador. Luego imprime una receta real desde el expediente y sale centrada en carta con línea de corte (host carta) — distinta paginación/posición que la que 'probó'.
- **Arreglo:** Hacer que 'Imprimir prueba' use exactamente imprimirElemento() con las mismas dimensionesImpresion() y recetaConfig (incluido imprimirEn:'carta') que usa la página de receta, sobre el mismo #zona-print-receta. Así la prueba es fiel a la impresión que recibirá el paciente.

### 21. [P3] diseno — `src/components/RecetaDocumento.tsx:872`
**Casi todo el texto secundario de receta/orden se imprime por debajo de 8pt (viola el mínimo legible exigido)**

- **Impacto:** La hoja es tamaño físico en mm pero los textos están en px; al imprimir 1px≈0.75pt (96dpi), así que el umbral de 8pt son 10.67px y prácticamente TODO el texto secundario cae debajo: aviso legal/vigencia 8.5px≈6.4pt (línea 872), etiqueta 'Verificación' del QR 7px≈5.3pt (889), indicador 'Hoja X de Y' 8px≈6pt (467), dirección/teléfono del encabezado 9px≈6.8pt (948/967), fecha de nacimiento y teléfono del paciente 9.5px≈7.1pt (772/773), posología del medicamento fontSize-0.5 (≈10.5px≈7.9pt, 397/372) y la nota al paciente fontSize-1 (≈10px≈7.5pt, 452). El aviso legal y la vigencia son texto normativo que debe poder leerse. Requisito explícito: mínimo 8pt impreso.
- **Reproducción:** Imprimir cualquier receta con aviso legal + vigencia y QR: el pie legal y la palabra 'Verificación' salen a ~6pt; en impresora láser de consultorio quedan al límite de lo legible, sobre todo el aviso de vigencia que el paciente/farmacia necesita.
- **Arreglo:** Subir el piso tipográfico: ningún texto impreso por debajo de ~11px (8pt). Elevar avisoLegal, vigencia, datos del paciente y posología a >=11px, y el indicador de hoja/etiqueta QR a >=10.7px. Como la hoja ya está en mm, conviene expresar los tamaños en pt o mantener una escala mínima. No afecta membrete/diseño subido (ahí manda el médico).

### 22. [P3] diseno — `src/components/RecetaDocumento.tsx:766`
**Textos en gris claro (#999 / #9ca3af / #888) a tamaño diminuto se desvanecen al imprimir en blanco y negro**

- **Impacto:** La combinación gris-claro + micro-tamaño reduce el contraste por debajo de lo utilizable en láser monocromo: etiqueta 'Paciente' #999 a 8.5px (766), fecha de nacimiento y teléfono del paciente #888 a 9.5px (772/773), etiqueta 'Verificación' #999 a 7px (889), indicador de hoja #9ca3af a 8px (467), dirección/teléfono del consultorio #666 a 9px (948/967). En pantalla se ven; impresos en B/N quedan lavados. En la nota, el sello SHA-256 y la línea NOM van #666 a 9.5px (nota page:385) — texto de cumplimiento que debe ser legible.
- **Reproducción:** Imprimir una receta en impresora láser B/N: los datos del paciente en gris (fecha de nacimiento, teléfono) y el pie del consultorio apenas se distinguen del fondo; la etiqueta 'Verificación' bajo el QR es prácticamente invisible.
- **Arreglo:** Oscurecer los grises de datos que deben leerse impresos a #444/#333 (contraste >= 4.5:1 sobre blanco) y reservar #999 solo para elementos verdaderamente decorativos y a tamaño >=8pt. La etiqueta 'Paciente'/'Verificación' puede quedar clara pero no ambas cosas (clara Y minúscula) a la vez.

### 23. [P3] impresion-web — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:522`
**Notas de varias páginas sin control de viudas/huérfanas: un encabezado de sección puede quedar solo al pie de hoja**

- **Impacto:** SecTitle (nota page:522-527) y los bloques de sección (map en 294-299, diagnósticos 302-311, plan farmacológico 314-323) no llevan 'break-after: avoid' ni 'break-inside: avoid'. En una nota larga que exige varias hojas (requisito #2), un título como 'Exploración física' o 'Diagnósticos' puede caer aislado al final de una página con su contenido arrancando en la siguiente — la huérfana tipográfica clásica. El @media print propio de esta pantalla (509-517) solo oculta lo que no se imprime; no aporta ninguna regla de paginación.
- **Reproducción:** Firmar una nota con secciones largas (interrogatorio + exploración + varios diagnósticos) de forma que el corte de hoja caiga justo después de un encabezado de sección: al imprimir, el título queda al pie de la hoja 1 y su texto empieza en la hoja 2.
- **Arreglo:** Añadir al SecTitle 'breakAfter: avoid' (page-break-after: avoid) y a cada bloque de sección 'breakInside: avoid' cuando sea razonable, más 'orphans: 3; widows: 3' en el contenedor del documento. Igual tratamiento a los bloques de la carta de referencia (referencia page:261-267).

### 24. [P3] impresion-web — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:509`
**Bloque @media print propio de la nota, redundante y con márgenes que chocarían con el popup**

- **Impacto:** La nota imprime SIEMPRE por popup (imprimirElemento, línea 189), que copia solo los <link> globales y NO los <style> en línea, así que este bloque `@media print{ #doc{...padding:24px 28px} @page{margin:1.5cm} }` queda inerte hoy. Pero es un riesgo latente: si alguien reintroduce un window.print() directo o el popup se bloquea y se cae al print de página, este bloque aplicaría `@page margin:1.5cm` MÁS el padding del #doc (doble margen) y NO repetiría la hoja membretada en páginas 2+ (no usa el mecanismo thead/tfoot del popup) → encimado/pérdida de banda de membrete en notas de varias hojas. Es la redundancia señalada en las pistas.
- **Reproducción:** Estático: el bloque coexiste con el motor de popup que resuelve márgenes y multipágina de forma distinta. Basta con que el popup falle (bloqueo de emergentes) para exponer un camino de impresión con reglas de margen y paginación incompatibles con las del popup.
- **Arreglo:** Eliminar el bloque `@media print` local de la nota (509-517) para que exista UNA sola fuente de verdad de impresión (print-element.ts). Si se quiere un respaldo cuando el popup se bloquea, que replique EXACTAMENTE @page/márgenes/orientación y el mecanismo multipágina del motor, no reglas propias.

### 25. [P3] imprenta — `src/lib/receta-template.ts:60`
**detectarPaperSize: tolerancia real (±5mm) no coincide con la documentada (±3mm)**

- **Impacto:** El docstring (líneas 50-53) dice tolerancia ±3 mm, pero el código usa `diffW<=5 && diffH<=5` (línea 60). Con ±5 mm, un escaneo cercano puede caer en zona ambigua entre tamaños vecinos (p.ej. A5 148×210 vs media-carta 140×215) y auto-seleccionar el tamaño equivocado, que luego orienta/dimensiona la hoja del membrete propio de receta. El impacto real es bajo porque desempata por menor diferencia total, pero un papel a medio camino podría auto-asignarse mal y el médico no siempre lo nota.
- **Reproducción:** Subir a 'Usa TU propia receta' un PDF de ~145×212 mm. detectarPaperSize puede resolverlo a media-carta o a5 según redondeos, cambiando el tamaño de hoja de impresión sin que el número documentado (±3) lo prediga.
- **Arreglo:** Unificar comentario y código (elegir una tolerancia, p.ej. ±3 mm, y aplicarla en ambos), o al menos actualizar el docstring a ±5. Considerar mostrar al médico qué tamaño se auto-detectó y permitir override explícito (ya existe el selector de tamaño, pero el auto-cambio no siempre es obvio).

### 26. [P3] ux — `src/lib/print-element.ts:50`
**Los botones 'Imprimir' no tienen estado de carga ni anti-rebote: doble clic abre varias ventanas y varios diálogos de impresión**

- **Impacto:** imprimirElemento abre window.open() en CADA invocación sin bandera de 'en curso' ni deshabilitar el botón; además espera hasta 8s a que carguen imágenes (líneas 132-143) sin ninguna señal visual. A diferencia de 'Descargar PDF' (que muestra 'Generando…' y se deshabilita), el botón 'Imprimir' (receta 426, orden 537, nota 189) se ve inerte mientras trabaja, invitando a un segundo clic → se abren 2 popups y aparecen 2 diálogos de impresión, confundiendo al médico y potencialmente imprimiendo doble.
- **Reproducción:** En /receta pulsar 'Imprimir' dos veces seguidas (natural si el diálogo tarda por el membrete en alta resolución) → se abren dos ventanas emergentes y dos diálogos de impresión del mismo documento.
- **Arreglo:** Añadir un estado 'imprimiendo' (bloquear reentradas en print-element.ts con una guarda de módulo/tiempo, o exponer un flag) y en las tres páginas deshabilitar el botón mostrando 'Preparando…' hasta que el popup dispare print() o falle. Reutilizar el mismo patrón visual que 'Descargar PDF'.

### 27. [P3] ux — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:189`
**Pulsar 'Imprimir'/'Word' con la config no cargada es un no-op silencioso (el botón se ve activo pero no hace nada)**

- **Impacto:** Cuando hay configError, 'Imprimir' hace onClick con `if (configError) return` PERO no lleva atributo disabled ni estilo apagado (nota 189; receta 'Imprimir' 426 y 'Word' 429; orden 'Imprimir' 537 y 'Word' 540). El médico ve un botón normal, lo pulsa y no pasa absolutamente nada. Aunque AvisoConfigNoCargada explica el bloqueo, el botón no da ninguna retroalimentación al clic, lo que se percibe como app rota justo en el momento de entregar el papel.
- **Reproducción:** Simular fallo de lectura de config (red/permiso) → aparece el aviso rojo, pero al pulsar 'Imprimir' o 'Word' no ocurre nada visible ni hay toast; el médico no entiende por qué no imprime.
- **Arreglo:** Aplicar disabled + estilo atenuado a TODOS los botones de acción cuando configError (como ya hace 'Descargar PDF'), o al pulsarlos mostrar un toast que remita al aviso. Coherencia entre los tres documentos.

### 28. [P3] ux — `src/lib/print-element.ts:44`
**El fallback de popup bloqueado usa window.alert nativo en vez del sistema de toasts de la app**

- **Impacto:** Cuando el navegador bloquea la ventana emergente, imprimirElemento lanza un window.alert() (líneas 44-47, 48, 51). Es un cuadro nativo tosco, ajeno al lenguaje visual de la app (que en todos lados usa toast), sin acción de recuperación y sin mencionar que 'Descargar PDF' es una alternativa inmediata. Para un médico primerizo cuyo Chrome bloquea popups por defecto, la primera experiencia de imprimir es una alerta del sistema que parece un error grave.
- **Reproducción:** Con el bloqueo de ventanas emergentes activo (estado común en Chrome), pulsar 'Imprimir' en /receta → salta un alert() del navegador; no hay toast ni botón para reintentar o cambiar a PDF.
- **Arreglo:** Sustituir el alert() por un toast/inline con acción: explicar cómo permitir emergentes y ofrecer 'Descargar PDF' como salida sin salir de la pantalla. Mantener la decisión correcta de NO imprimir basura, pero comunicarla con el patrón de la app.

### 29. [P3] ux — `src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx:470`
**Agregar estudio personalizado en la ORDEN usa prompt() nativo**

- **Impacto:** agregarCustom (líneas 470-473) usa window.prompt('Estudio personalizado:'). El prompt nativo es inconsistente con el resto de la UI, no valida longitud/duplicados, se ve tosco y en algunos contextos PWA/iOS puede comportarse mal o quedar bloqueado, dejando al médico sin poder añadir un estudio fuera del catálogo.
- **Reproducción:** En /orden pulsar 'Personalizado' → aparece un cuadro de texto nativo del navegador en lugar de un campo/modal integrado; en modo PWA puede no mostrarse con foco correcto.
- **Arreglo:** Reemplazar el prompt() por un input inline (o modal del design system) con validación y confirmación con Enter, consistente con cómo se agregan medicamentos en la receta.

### 30. [P3] ux — `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx:183`
**La NOTA carece de exportar a Word que sí tienen receta y orden (capacidades inconsistentes entre documentos)**

- **Impacto:** En receta y orden el médico tiene 'Word' (documento editable para pegar en su propio membrete: receta 429, orden 540), pero en la nota la barra de acciones (líneas 183-207) solo ofrece Descargar PDF/Imprimir. Un médico que quiere ajustar una nota a su formato propio no tiene la misma vía que en recetas, lo que crea una expectativa incoherente entre los tres documentos de papelería.
- **Reproducción:** Comparar la barra de acciones de /nota con la de /receta: falta el botón 'Word' en la nota sin motivo evidente para el usuario.
- **Arreglo:** Evaluar añadir 'Word' a la nota (reutilizando el patrón de receta-word.ts) o, si es intencional, documentar la razón; lo importante es que el conjunto de acciones de papelería sea predecible entre documentos.

---

## Estado de reparación (v592–v594, 2026-07-24)

**REPARADO Y DESPLEGADO:**
- **v592 (lote 1):** object-fit fill→contain en los 3 puntos del membrete (P0, ya no deforma logos no-carta); firma global solo con un médico en la nota (P1); [FALTA CÉDULA PROFESIONAL] en rojo en nota y referencia (P1); .no-print ya no se imprime en el popup (P2); viudas/huérfanas en notas multipágina (P3).
- **v593 (lote 2):** grises legibles al imprimir B/N (#888/#999→#555/#666, solo color); anti-rebote de impresión (candado 1.2s); botón Imprimir de la nota disabled con config sin cargar; detectarPaperSize doc ±3→±5; estudio personalizado de la orden con input inline (era prompt() nativo).
- **v594 (lote 3):** aviso de cédula adaptado al modo (diseño propio); aviso de domicilio COFEPRIS faltante.

Nota: mi cambio de object-fit:contain en #doc arregló la deformación en las TRES rutas (vista previa, impresión y PDF) porque las tres renderizan el mismo `.membrete-bg`.

**PENDIENTE (bigger build o decisión del Dr):**
- #4/#7 (P1 parcial): el PDF rasterizado (html2canvas) NO repite el membrete en páginas 2+ de una nota multipágina (limitación de html2canvas con position:fixed). Recomendación: para notas largas con membrete, usar Imprimir → Guardar como PDF (el popup sí repite el membrete). Unificar las 3 rutas en una sola sería un refactor mayor.
- #10 (P2): el @page de notas está fijo en 'letter'; para respetar un membrete de tamaño no-carta habría que capturar sus dimensiones reales en Configuración (como ya hace la receta) y pasarlas a imprimirElemento.
- #11 (P2): zona segura del membrete a sangre; el Dr usa membrete carta full-bleed, así que margin:0 es lo correcto para él; revisar si se ofrece toggle de zona segura para otros.
- #12 (P2): resolución del membrete <300 DPI al ancho carta; subir maxWidth cuando hay Storage.
- #14 (P2): la vista previa no representa el corte multipágina (cosmético).
- #18 (P2): la nota puede omitir el establecimiento (NOM-004) sin avisar.
- #19 (P2): el QR de la receta valida folio/identidad pero no el CONTENIDO (hash) — decisión del Dr sobre cuánto endurecer.
- #20 (P2): 'Imprimir prueba' en Configuración usa window.print en vez del popup real.
- #28/#30 (P3): alert→toast en popup bloqueado (refactor de lib); la nota no exporta a Word.
