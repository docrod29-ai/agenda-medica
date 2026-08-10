# Candidatos de nombre — sustitución de «NexusMED»

Verificación ejecutada el **2026-08-09** (UTC) con herramientas, no con supuestos.

- Dominios: `whois -h whois.mx <dominio>` (registro NIC México) y `whois -h whois.verisign-grs.com <dominio>.com`, contrastado con `dig +short <dominio> A`.
- Marcas: **TMview** (`tmdn.org`), que consulta los registros de **IMPI (MX)**, **OEPM (ES)** y **EUIPO (EM)**. No sustituye a MARCANET; sirve para descartar barato antes de pagar.
- Apps: **iTunes Search API** (`itunes.apple.com/search?country=mx`), filtrada a categorías Medical / Health / Productivity / Business.
- Web: Brave Search (DuckDuckGo, Bing, Mojeek y Startpage bloquearon la consulta automatizada; queda constancia por honestidad del método).

Todo lo marcado **LIBRE** fue reconsultado una segunda vez al cierre y además carece de registro `A` en DNS.

---

## 0. Antes del nombre: el dominio ajeno ya está cobrando consecuencias

`nexusmed.mx` no sólo está registrado por el Dr. Felipe Barragán Albo (alta 2026-02-05, Key-Systems GmbH, Monterrey N.L.). Está **operando y recibiendo correo**:

```
$ dig +short nexusmed.mx MX
9  route3.mx.cloudflare.net.
27 route2.mx.cloudflare.net.
30 route1.mx.cloudflare.net.

$ curl -sL https://nexusmed.mx | grep title
<title>Expediente Clínico Electrónico México | Nexus Med — Más Rápido que el Papel</title>
   description: "...cumple NOM-004, NOM-024..."
```

Mismo mercado, misma norma, mismo argumento de venta. Y este producto publica, en páginas públicas, buzones **en ese dominio**:

| Dónde | Qué publica |
|---|---|
| `src/app/privacidad/page.tsx:47` | «Puedes ejercer tus derechos **ARCO** escribiendo a privacidad@nexusmed.mx» |
| `src/app/terminos/page.tsx:121` | «Dudas sobre estos Términos: soporte@nexusmed.mx» |
| `src/app/contacto/page.tsx:10` | `const CORREO = 'soporte@nexusmed.mx'` |
| `src/app/seguridad/page.tsx:135` | `mailto:privacidad@nexusmed.mx` |
| `src/app/(dashboard)/layout.tsx:381` | ruta de error: «escríbenos a soporte@nexusmed.mx» |
| `src/app/(dashboard)/migracion/page.tsx:364` | migración de expedientes → soporte@nexusmed.mx |

**Hallazgo.** El canal ARCO obligatorio del aviso de privacidad apunta a un dominio con MX activo que pertenece a un competidor directo. Un catch-all en Cloudflare Email Routing basta para que las solicitudes ARCO de pacientes, los correos de soporte y las peticiones de migración de expedientes —que por su naturaleza traen nombre de paciente, nombre de consultorio y a veces datos clínicos— lleguen a su bandeja.

**Impacto.** Tres capas: (1) el canal ARCO es inoperante, o sea el aviso de privacidad tiene un defecto de fondo; (2) si un solo correo llegó, hay comunicación de datos personales a un tercero no autorizado; (3) el competidor recibe gratis el volumen de soporte, las quejas y los nombres de los clientes. El daño no depende de que se gane o se pierda una discusión de marca.

**Arreglo reversible, hoy, independiente del nombre.** Sustituir los seis literales por un buzón en un dominio propio o, mientras tanto, por el correo que ya se usa en el código (`docrod29@gmail.com`), y desplegar. Es un cambio de cadenas de texto, sin migración ni riesgo clínico, y se revierte con un `git revert`. La decisión del nombre puede tardar semanas; ésta no debería pasar de hoy.

El renombrado completo son **625 menciones en 269 archivos**; los puntos de acoplamiento externo (los caros) son pocos y están localizados: `capacitor.config.ts:16` (`appId: 'mx.nexusmed.app'` — cambiarlo después de publicar en tiendas obliga a una app nueva y pierde la base instalada), `src/lib/clinical/sellos.json` y `src/lib/clinical/registry.ts` (sellos de integridad ya emitidos: **no** se reescriben retroactivamente, se versiona el emisor).

---

## 1. Candidatos verificados

Leyenda de riesgo de marca: **A** = sin obstáculo encontrado en clases 9/42/44 · **B** = obstáculo en clase vecina · **C** = obstáculo directo o signo descriptivo.

| # | Nombre | `.mx` | `.com.mx` | `.com` | Marca MX (IMPI vía TMview) | Marca ES/EUIPO | Colisión de mercado | Riesgo | Por qué el nombre |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Amanuense** | LIBRE | LIBRE | OCUPADO (alta 2005-07-09; sin contenido) · `amanuensemx.com` **LIBRE** | `AMANUENSE`, clase **41**, registrada, exp. 1820714, 2016-11-14. Nada en 9/42/44 | Sin coincidencias en ES ni EUIPO | Sin producto de salud. Único uso: shareware viejo de escritura (`amanuense.softonic.com`). App Store MX: ninguna app médica | **A** | El amanuense escribe al dictado lo que otro le dicta. Es literalmente el producto |
| 2 | **Ausculta** | LIBRE | LIBRE | OCUPADO (1999-09-27, «AuscultA Management», consultora alemana) · `auscultamx.com` **LIBRE** | **Cero coincidencias en todo IMPI** | Sólo «Instituto de Auscultación Estructural», cl. 42, ingeniería civil, 2004 | `ausculta.net` = Ausculta Ltd, consultoría («Complexity made simple»); Auscultar SAS (Colombia, monitoreo estructural). Ninguna en salud | **A** | Auscultar es escuchar al paciente. El producto escucha y documenta |
| 3 | **Cotejo** | LIBRE | LIBRE | OCUPADO (2006-03-29) | Sólo `EL COTEJO FVG`, clase 33 (vinos) | Sin coincidencias | Sin producto de salud ni app | **A** | Cotejar = contrastar. Es lo que hace el motor contra alergias, dosis y antibiograma |
| 4 | **Auscultar** | LIBRE | LIBRE | OCUPADO (2008-09-18) | **Cero coincidencias** | — | Igual que Ausculta | **A** | Variante verbal, por si se prefiere el infinitivo |
| 5 | **Anamnesis** | LIBRE | LIBRE | OCUPADO (1999-02-02, estacionado) · `anamnesismx.com` **LIBRE** | Sólo `ANAMNESIS JEWELRY`, cl. 14 | **`ANAMNESIS` solicitada en EUIPO el 2026-04-15 en clases 9 y 42** (software). Además cl. 25 en ES, `STAR OCEAN: ANAMNESIS` cl. 9/41, `ASTROANAMNESIS` cl. 44/45/41 | App Store MX: «Patient Records: Anamnesis!», «Podana – Podiatry Anamnesis», «EasyAnamnesis» — usan la palabra como descriptor, no como marca | **B** | La anamnesis es el interrogatorio: el corazón del expediente. Pero alguien la está reclamando en Europa justo en las clases de software |
| 6 | **Nosología** (`nosologia`) | LIBRE | LIBRE | OCUPADO (2026-01-11) | **Cero coincidencias** | Sin coincidencias | Ninguna | **A** | La clasificación de las enfermedades. Limpísimo en marcas, pero cinco sílabas y acento: se dicta mal por teléfono |
| 7 | **Legajo** | LIBRE | LIBRE | OCUPADO (2007-02-14, estacionado) · `legajomx.com` **LIBRE** | **`LEGAJO VIRTUAL`, clase 9, registrada 2008-05-19** | Sin coincidencias | App Store: `TuLegajo.com` (MINDER S.A., legajos de RR.HH., Argentina) | **B** | El legajo es el expediente que se acumula y se conserva. El obstáculo en clase 9 es real |
| 8 | **Constancia** | LIBRE | LIBRE | OCUPADO (2007-05-25) | `CONSTANCIA`, cl. 36, **caducada** (2000) | Sin coincidencias | Apps de hábitos en Health & Fitness usan la palabra | **A** | Doble lectura: el documento que hace constar, y la disciplina de documentar todos los días |
| 9 | **Membrete** | LIBRE | LIBRE | OCUPADO (2025-06-12, no resuelve) · `membretemx.com` **LIBRE** | Sólo `MEMBRETE ARTÍCULOS DE PAPELERÍA`, cl. 35 | Sin coincidencias | Ninguna en software médico | **A** | Muy limpio, pero nombra sólo la hoja membretada. Se le queda chico al producto |
| 10 | **Acuse** | LIBRE | LIBRE | OCUPADO (2005-07-17) | 19 coincidencias parciales, **ninguna idéntica** | — | Ninguna | **A** | «Acuse de recibo»: prueba de que algo quedó asentado. Suena a trámite, no a clínica |
| 11 | **Sutura** | LIBRE | LIBRE | OCUPADO (1998-03-13) · `suturamx.com` **LIBRE** | **`SUTURA`, clase 10 (instrumental médico), registrada 2025-12-16** | Sin coincidencias | App Store: «Sutura» (Health & Fitness) y «SuturaEDU» (Medical) | **B** | Lo que une. Pero la clase 10 es campo médico vecino y la marca es de diciembre pasado: pleito caro |
| 12 | **Pase de visita** (`pasevisita`) | LIBRE | LIBRE | OCUPADO (2026-02-10) | Sin idénticas | — | Ninguna | **A** | Nadie fuera de un hospital mexicano dice «pase de visita». Funciona mejor como nombre del módulo hospitalario que como marca madre |
| 13 | **Prontuario** | LIBRE | LIBRE | OCUPADO (2002-03-15, «Coming Soon») · `prontuariomx.com` **LIBRE** | 5 parciales, ninguna idéntica | Sin coincidencias | App Store: «Prontuario Veterinario», «PRONTUARIO LATTI» (Italia) | **C** | Descartar: en México «prontuario» arrastra la connotación de **prontuario delictivo**. Regalarle eso a un producto clínico no tiene sentido |
| 14 | **Escriba** | LIBRE | LIBRE | OCUPADO (2000-03-06) · `escribamx.com` **LIBRE** | 24 parciales, ninguna idéntica | — | **«Escriba clínico con IA» es el nombre genérico de la categoría en español.** App Store MX: «Anota — Escriba Clínico con IA», «Escriba clínico – notavik», «Escriba: voz a texto». Heidi Health se describe así en psiquiatria.com | **C** | Descartar pese a tener los dominios libres: es la palabra de la categoría, no de la marca. Ni se defiende ante IMPI ni se posiciona en buscadores |

---

## 2. Descartados con evidencia (para que nadie los reproponga)

| Nombre | Por qué muere |
|---|---|
| **Ronda** | `RONDA` registrada en IMPI en **clase 9** (exp. 1505699) **y clase 42** (exp. 1598006), más 5, 16, 38, 39, 43. Bloqueo directo en las dos clases del producto |
| **Cardex** | `CARDEX DIGITAL` en clase 42; `cardex.com.mx` ocupado; Cardex S.A. operando |
| **Interconsulta** | `INTERCONSULTA`, **clase 44**, registrada desde 2000-02-17 |
| **Galeno** | `galeno.mx` es de **Farmacia Guadalajara, S.A. de C.V.** |
| **Bata** | `bata.mx` y `bata.com.mx` son de **Bata Brands SA** |
| **Vigía** | ambos dominios de Servicios Administrativos Vigía, S.A. de C.V. |
| **Tlacuilo · Cenzontle · Obsidiana · Amate · Códice · Tlamatini** | la vía nahua/prehispánica es preciosa y está **toda tomada** en `.mx` y `.com.mx` |
| **Folio · Sello · Signos · Latido · Pluma · Tinta · Alta · Historia · Ficha · Botica · Acervo · Minuta · Bitácora · Rúbrica · Caduceo · Asclepio** | ocupados en `.mx` y/o `.com.mx` |
| **Pedernal · Cálamo · Fedatario · Cuartilla** | sólo mitad del par disponible; se compra un activo cojo |

---

## 3. Cómo se consulta IMPI / MARCANET (lo hace el dueño)

Lo de arriba es **descarte barato**, no una búsqueda de antecedentes. Antes de pagar se hace esto:

1. **MARCANET** — `https://marcanet.impi.gob.mx`. Es gratuito y no requiere cuenta.
   - «**Búsqueda fonética**» es la que importa. IMPI niega por *similitud en grado de confusión*, no sólo por identidad: «Ausculta» puede chocar con «Auskulta» o «Asculta» aunque no aparezcan en una búsqueda literal.
   - «Ver todos los datos de un signo distintivo» sirve para leer el expediente completo de un obstáculo (titular, clase, vigencia, productos y servicios amparados).
   - Revisar la **descripción de productos/servicios**, no sólo el número de clase: dos marcas pueden coexistir en la misma clase si amparan cosas distintas.
2. **Presentación**: portal **IMPI en línea / PASE**. Desde 2020 se presenta **una solicitud por clase**; tres clases son tres solicitudes y tres pagos.
3. **Búsqueda internacional de respaldo**: TMview (`tmdn.org`) cubre MX, ES y EUIPO en una sola consulta — es la que se usó aquí y es reproducible.
4. **Obligación posterior que hace caducar la marca**: hay que presentar **declaración de uso real y efectivo** a los tres años del registro. Se olvida, y la marca se cae sola.
5. Registrar el dominio **antes** de anunciar el nombre y **antes** de presentar la solicitud: la solicitud es pública y se rastrea.

### Clases de Niza que aplican a este producto

| Clase | Qué ampara | ¿Aplica? |
|---|---|---|
| **42** | *SaaS*, plataforma como servicio, diseño y desarrollo de software, alojamiento | **Sí — es la principal.** El producto se vende como servicio en la nube |
| **9** | Software descargable, aplicaciones informáticas grabadas | **Sí** — hay app en tiendas (Capacitor, `mx.nexusmed.app`) |
| **44** | Servicios médicos, telemedicina, asistencia sanitaria | **Sólo si** se presta el acto médico (teleconsulta propia). Para software puro añade costo y superficie de oposición |
| **10** | Aparatos e instrumentos médicos | Sólo si algún módulo llega a registrarse como **SaMD** ante COFEPRIS |
| **35** | Gestión y administración de negocios (cobranza, facturación, agenda) | Opcional; defensiva |
| **41** | Formación y capacitación | Sólo si se venden cursos. **Ojo:** aquí es donde está ocupada `AMANUENSE` |
| **5** | Productos farmacéuticos | **No** |

Núcleo recomendado: **42 + 9**. Añadir 44 sólo cuando exista teleconsulta prestada por la empresa, y 35 sólo si se quiere blindar el módulo de cobranza.

> El precio final de todo esto —cuántas clases, si se pelea o se compra, qué nombre— lo fija el dueño. Este documento sólo pone la evidencia sobre la mesa.
