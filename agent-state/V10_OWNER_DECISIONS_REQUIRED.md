# V10 — Decisiones que sólo puede tomar el dueño

## OD-1 · Los nombres de modelos de IA en el catálogo de planes, frente a REG-292

**Visto en**: `/precios` (captura `agent-state/v10-screenshots/precios-desktop.png`)
y su fuente `src/lib/planes-ia.ts` («IA de máximo razonamiento clínico
(Opus 4.8 + GPT-5) por defecto 💎», niveles Estándar/Máxima con modelos por
nombre).

**La tensión**: la regla del dueño en REG-292 dice *«sólo lo que hace, no cómo
lo hace»* y su guardián (`lo-que-hace-si-como-lo-hace-no.test.ts`) quitó de la
portada y del menú los enlaces a `/motores` y `/arquitectura` por enseñar el
funcionamiento interno. Nombrar los modelos por marca comercial en la página
pública de precios enseña exactamente «cómo lo hace» — y además ata el precio
publicado a marcas de terceros que cambian de nombre cada pocos meses.

**Por qué no lo decido yo**: es texto comercial de precios; el nivel de la IA
como eje de los planes puede ser una decisión de venta deliberada («paga por
razonamiento premium»). Cambiarlo altera la promesa comercial, no el diseño.

**Recomendación**: decir capacidad, no marca — «IA de máximo razonamiento
clínico, con segunda opinión automática» ya comunica el valor sin regalar la
receta ni heredar el calendario de renombres de los proveedores. Si el dueño
la aprueba, el cambio es de una línea por plan en `planes-ia.ts` y el guardián
de REG-292 puede extenderse a vigilar nombres de modelos en superficies de
cliente.

**Mientras el dueño no decida**: no se toca. (V10 §6: la verdad comercial no se
altera por estética.)
