# Continuación visual y seguridad de captura — 10-sep-2026

Base: `b8cd736`, después de la integración concurrente del PR #478 y el pin de v1195. Se conservaron sus arreglos de columnas, filas de medicamento y ubicación del chat/herramientas. El dueño reiteró que esperaba cambios visibles en toda la aplicación, colores más vivos y animaciones.

## Cambios de este lote

- Paleta compartida azul vivo, superficies claras azuladas y oscuras tinta azul; mismos tokens para agenda, pacientes, consulta, configuración, acceso y superficies públicas. Los colores de riesgo clínico no cambian.
- Navegación activa con tinte de marca; encabezados compartidos con mejor separación, subtítulo legible y entrada breve, desactivada con movimiento reducido.
- Consulta: navegación por tres regiones más distinguible, indicadores de sección, estado del documento y transiciones breves. Se mantienen las regiones montadas y las correcciones de 1440/1280/móvil del PR #478.
- Tarjeta social alineada con el nuevo tema oscuro.
- REG-670: autoría persistida del medicamento para que el eco de una IA no convierta una decisión médica en contenido eliminable. Edición, aceptación, restauración y estado manuales marcan autoría médica. La IA no puede atribuirse esa marca. Reproyección/corrección conservan capturas explícitas.

## Evidencia

La reproducción del defecto falló antes de repararlo en primer plano y recuperación. Tras la reparación, el grupo inicial de 44 casos pasó. La suite completa ejecutó 14 635 casos: 14 632 pasaron; fallaron tres guardianes de referencias de paleta/clasificación que se actualizaron con la nueva paleta y REG-670. La comprobación posterior de esos guardianes y regresiones clínicas pasó: 100 casos, seis archivos. Lint: 93/93; trinquete de diseño sin incremento; build equivalente a Preview compiló y terminó correctamente.

Contraste determinista, medido con el comprobador WCAG existente: blanco sobre azul sólido 6.22:1; acento oscuro sobre superficie oscura más clara 7.85:1; acento claro sobre superficie clara más oscura 5.37:1. Rojo y verde clínicos sobre la nueva superficie oscura: 4.80 y 4.82:1.

## Pendientes que este lote no declara resueltos

QA montada en cuenta privada, teclado y móvil del nuevo aspecto; asignación y aislamiento entre médicos de la misma clínica (incluidas exportaciones y metadatos clínicos del directorio); migración revisada del legado y publicación de reglas Firebase. La verificación de la demo pública no sustituye esos recorridos. Este lote no cambia permisos ni migra pacientes.

No se presenta este ajuste compartido como un rediseño completo, pantalla por pantalla, ni como cierre del objetivo de seguridad/despliegue. La vista previa es para verificar los cambios; producción requiere resolver las compuertas pendientes.

## Ampliación de la interfaz

CI remoto de `daf1091`: cinco jobs completados correctamente (verificar, clinical-safety, lint, aislamiento-tenant y e2e-publico). Preview Vercel construido, aunque la inspección en navegador sigue detenida en el acceso de Vercel.

El dueño reiteró que un cambio de paleta era insuficiente. Se añadió una composición de acceso con panel azul y recorrido de tres pasos en escritorio; en móvil el formulario sigue en una columna. El marco de navegación tiene ahora un tema tinta acotado, distinto del área de trabajo. Se corrigió el contraste del hover en las acciones con texto blanco. Se retiró el halo decorativo del acceso: el techo de degradados bajó de 11 a 10. Comprobación de los cinco guardianes afectados: 55 casos correctos; build equivalente final correcto. Esta ampliación todavía requiere inspección visual autenticada.

## Continuación sin acceso a la cuenta privada

El dueño no puede completar el acceso del navegador desde su móvil y pidió continuar sin detenerse. No se reintentó ni se relajó la autenticación de Vercel. Los cinco jobs de CI sobre `8da4e10` sí terminaron correctamente; esto no certifica los cambios siguientes.

Se amplió el rediseño en las pantallas de trabajo: encabezados compartidos sobre superficie propia y borde de marca, identidad del paciente en foco más legible, controles de calendario agrupados por vista/periodo y marcador claro de hoy. El directorio responde al foco del teclado igual que al puntero; el movimiento del chevron se desactiva al pedir menos movimiento. Se retiró un degradado del héroe.

REG-669 repara la selección y el destino del héroe de Hoy: consulta en curso → paciente en sala → próxima cita abierta. Usa el reloj canónico del consultorio. Recepción y citas sin paciente abren el detalle de la cita. Siete reproducciones fallaron con la lógica original; el conjunto de nueve casos nuevos más diecinueve existentes pasó después (28).

El entorno de ejecución local se desconectó durante la comprobación de tipos. Los cambios se reconstruyeron mediante reemplazos exactos sobre los archivos del último commit remoto; la verificación completa se traslada a CI y no se afirma que el typecheck interrumpido haya terminado. Siguen pendientes la inspección visual privada, el aislamiento entre médicos y el despliegue. El trabajo de #488 sigue separado.

El entorno se recuperó: se compararon los seis archivos de código locales contra `8057a8d` y coincidieron. La nueva comprobación de tipos terminó correctamente y lint permaneció en 93/93. CI #1781 detectó dieciséis fallos: ocho de documentación derivada y ocho guardianes de presentación/rutas que aún exigían literales anteriores. Se regeneraron los censos con sus scripts, se redujo el trinquete de diseño (degradados 10 → 9) y se actualizaron los guardianes para comprobar la clase conectada y el destino por rol; no se retiraron casos. Los once archivos afectados, incluidos los nueve casos de REG-669, pasaron: 129 casos.

Se añade `workspace-sintetico` a CI: build de esta rama, emuladores Auth/Firestore con las reglas reales y siembra canónica ficticia; Chromium de escritorio y WebKit con perfil de iPhone, temas claro/oscuro, login/Hoy/pacientes/calendario/consulta, 390 y 320 px, teclado y movimiento reducido. Bloquea conexiones externas desde el navegador y adjunta capturas de datos sintéticos. Se declara añadido, todavía no ejecutado; no sustituye la cuenta privada de Vercel, la prueba en dispositivo físico ni el aislamiento entre médicos.

## Evidencia remota del 11-sep-2026

[CI sobre 54bcd44](https://github.com/docrod29-ai/agenda-medica/actions/runs/34545520231) completó los seis jobs, incluido workspace-sintetico. Los nueve recorridos pasaron sin reintentos: Chromium, WebKit emulado con perfil de iPhone, temas claro/oscuro, 390/320 px, regiones de consulta, foco de teclado y movimiento reducido. El caso de escritura cambia de paciente mediante el directorio y comprueba el borrador de A, el de B y el regreso a A. Su copia WebKit queda omitida expresamente para mantener una sola sesión de escritura; los recorridos visuales de ambos motores sí se ejecutan.

La espera intermitente de snapshots del emulador en WebKit se resolvió usando long polling sólo dentro del candado demo-*. La configuración de producción conserva su transporte y caché. El segundo recorrido [sobre a3d47bb](https://github.com/docrod29-ai/agenda-medica/actions/runs/34545710655) también completó nueve casos, sin reintentos. Su único fallo de unidad fue que el informe de dependencias aún decía once avisos cuando el audit ya medía cero; el informe se regeneró con su script, sin retirar la prueba.

Se inspeccionaron ocho capturas con datos cargados. La consulta separa contexto, nota y asistente en escritorio; directorio y calendario conservan su legibilidad y acciones en móvil. La inspección encontró además una discrepancia entre la fecha de Hoy y la agenda, corregida como ampliación de REG-669. Las capturas adjuntas de consulta, directorio y calendario proceden de a3d47bb, con datos enteramente ficticios:

- [Consulta de escritorio](../audit/ausculta-visual-2026-09-11/consulta-escritorio.jpg)
- [Consulta móvil](../audit/ausculta-visual-2026-09-11/consulta-movil.jpg)
- [Calendario móvil](../audit/ausculta-visual-2026-09-11/calendario-movil.jpg)
- [Pacientes móvil](../audit/ausculta-visual-2026-09-11/pacientes-movil.jpg)

Dependencias: [verificación sobre el lock publicado](https://github.com/docrod29-ai/agenda-medica/actions/runs/34546034255), UUID/CommonJS y multipart de Gaxios/teeny-request correctos; producción cero avisos, árbol completo cinco moderados del CLI de Firebase, cero high/critical. Se actualizó Vitest/coverage-v8 a 4.1.11. Se elimina el workflow temporal que generó el candidato y el informe durante la desconexión del entorno local.

En ese checkpoint, el commit que incorporaba este informe y el arreglo de fecha necesitaba sus propios resultados de CI; los verdes de sus padres no lo sustituyen. La PR #487 permanece en borrador, sin merge ni despliegue de producción. Siguen pendientes la cuenta privada, Safari físico y el aislamiento entre médicos de una misma clínica (incluidos los metadatos clínicos de la ficha, el legado y todas las rutas de exportación). El trabajo concurrente de #488 no está integrado ni se declara validado aquí. La prueba entre dos borradores no demuestra ese aislamiento de permisos.


## Integración y cierre de accesos — 11-sep-2026

Producción avanzó por otra sesión a **v1196**, main `9a20b06`. La ejecución
[35](https://github.com/docrod29-ai/agenda-medica/actions/runs/34548993430)
publicó Firestore y envió índices, pero **Storage falló con 403
`firebasestorage.defaultBucket.get`**. El sitio READY y el acta SUCCESS no
cerraban el release: el job quedó en rojo. Se integran main y #490 completos
en #487, preservando el trabajo concurrente y su historial. La anterior REG-668
de autoría médica queda renumerada **REG-670** para no colisionar con el acta.

La revisión independiente encontró tres puertas Admin SDK que aún permitían
el paciente ajeno por rol. **REG-671** conecta el guardián canónico por paciente
al paquete de visita, enlace clínico del portal y sala de teleconsulta. Nueve
casos reales de POST con datos ficticios: cinco fallaron antes y nueve pasaron
tras el arreglo, incluidos titular/compartidos/admin y el enlace de recepción.
Se conserva la prioridad del token del paciente y el 404 de sala.

**REG-672** incluye `storage.rules` y `firebase.json` en la comparación del árbol;
el guardián ya detecta `--only storage` y su falta de declaración. Tres casos
fallaron antes. La recomendación del 403 se ajustó al permiso observado: Viewer
lo contiene; el error no demuestra que el bucket falte ni justifica crearlo.

**Validación local de esta integración:** suite completa 14 717 casos correctos,
tipos correctos, lint 93/93, build de producción completo y CSP posterior al build.
Tras regenerar versión/documentación, sus guardianes se volvieron a ejecutar.
Audit de producción: 0. Las nuevas pruebas no reemplazan la QA privada.

Se prepara **v1197** y su pin; no se ha publicado esta versión. Los recorridos
móvil/teclado del árbol integrado requieren su CI nuevo. El cambio no declara
cerrada la lectura de PHI legada en la ficha raíz, la asignación de pacientes sin
titular ni pruebas físicas de Safari. Resolver el permiso externo de Storage y
repetir el cierre de producción sigue pendiente; ningún permiso se ha cambiado.

## Mayor presencia de color y movimiento — 11-sep-2026

El dueño revisó las capturas anteriores y pidió un cambio más visible. Esta
continuación parte de `53cd30a`, con sus seis jobs de CI y dependencias correctos.
El acceso de Vercel ya se completó en el navegador y se alcanzó el login de
Ausculta; eso no equivale a haber recorrido una cuenta privada de la aplicación.

Se refuerzan los componentes canónicos: cabeceras de página, Hoy y calendario
en azul; marco lateral y móvil azul con acento cian; selección visible en la
navegación inferior; navegación de regiones y cabecera de la nota diferenciadas.
Las entradas duran 320 ms y el micrófono responde a foco/activación. No hay
movimiento de grabación en reposo. Se respetan movimiento reducido, foco visible,
colores clínicos y la ubicación de los controles fijos. La impresión conserva
fondo blanco y texto oscuro, incluido el estado de nota firmada.

La revisión encontró iniciales de paciente casi invisibles en tema claro.
**REG-673** sustituye seis pares pastel fijos por los pares temáticos canónicos.
La reproducción con los colores anteriores falló en 12 de 18 combinaciones;
después pasan las 18, con contraste mínimo 4.5:1 sobre cinco superficies por tema.
No se cambia el hash de identidad ni se agregan dependencias.

Verificación local inicial: 14 738 casos correctos y un fallo de clasificación
de REG-673; se corrigieron su familia y la cuenta del documento. Los 57 casos
dirigidos de presentación, movimiento y contraste ya habían pasado. Lint
conserva el techo de 93, sin deuda nueva. La validación del árbol definitivo se
registrará en la PR, sin atribuirle resultados del commit padre.

El recorrido sintético de CI conserva sus controles de red y sus datos ficticios
y ahora guarda video también al pasar, para mostrar movimiento real junto a las
capturas. Esta ampliación no cambia los pendientes de Storage, aislamiento del
legado, QA privada ni Safari físico. Las imágenes enlazadas en las secciones
anteriores corresponden al diseño anterior, no a esta ampliación.

### Revisión del resultado publicado

Los seis trabajos de [CI de 25172c4](https://github.com/docrod29-ai/agenda-medica/actions/runs/34561503990)
y dependencias terminaron correctamente. Su recorrido sintético pasó nueve casos,
sin reintentos, y produjo capturas y videos. La revisión independiente de catorce
capturas nuevas encontró dos ajustes pendientes a 320 px: «Asistente» salía de
la barra azul y la flecha derecha del calendario invadía su margen. Se corrigen
poniendo el número encima del rótulo en la navegación estrecha, sin reducir letra,
y permitiendo que la fecha del calendario se distribuya en varias líneas.

El detector de desbordamiento ahora mide también el main interior y la barra;
antes sólo miraba documentElement. El recorrido estrecho repone temporalmente
las declaraciones anteriores y exige detectar su desborde; restaura el estilo
antes de capturar. Este control inverso sólo existe en el arnés demo-* y no se
ejecuta en producción. Se añade una pausa de lectura de 800 ms al video para
que se distingan las pantallas y sus entradas. El ajuste requiere sus resultados
remotos propios; los verdes de 25172c4 son evidencia anterior.

El bloqueo de Storage ya cambió por trabajo concurrente del dueño. La
[ejecución #36](https://github.com/docrod29-ai/agenda-medica/actions/runs/34559024430)
publicó Storage correctamente («released rules storage.rules to firebase.storage»).
Revisión independiente comparó los seis publicables del pin 15b2b91 y main
9a20b06: idénticos. El 403 de #35 queda cerrado. Este resultado no demuestra
subida privada completa ni índices Enabled. Producción continúa en v1196.

Se abrió el preview nuevo con la sesión de Vercel. Google devolvió «Este dominio
no está autorizado en Firebase» tanto en su URL individual como en el alias
estable de la rama. La QA privada de Ausculta sigue pendiente por esa configuración;
no se cambiaron dominios autorizados, IAM ni datos de pacientes desde esta sesión.

### Continuación del 11-sep: dominio aprobado y guardados locales

El dueño autorizó expresamente el alias estable del PR. Se añadió en Firebase
Authentication de `nexomed-agenda` y se verificó en la tabla de dominios:
`agenda-medica-git-codex-ausculta-v-7f154b-docrod29-ais-projects.vercel.app`.
Esta confirmación sustituye el bloqueo descrito arriba; no acredita acceso privado.

Google pasó a devolver `Error 400: redirect_uri_mismatch`. El detalle visible
identifica el retorno que falta registrar en el cliente OAuth de Google Cloud:
`https://agenda-medica-git-codex-ausculta-v-7f154b-docrod29-ais-projects.vercel.app/__/auth/handler`.
La consola de Google Cloud abrió `Site Unavailable` desde esta sesión; no se
modificó el cliente OAuth. La cuenta privada de Ausculta sigue sin abrirse.

Los catorce índices de Firestore se comprobaron en las dos páginas de la consola:
todos **Habilitado**. El cierre de Storage #36 sigue válido. No se realizó una
subida privada ni se usaron datos reales en pruebas o imágenes.

La auditoría independiente encontró dos defectos locales adicionales: Retomar
ofrecía pacientes de respaldos ilegibles de otro uid, y un flush de A podía usar
el uid recién abierto de B. REG-674/675 cierran esos caminos, conservando los
archivos originales y respaldando antes del logout cuando falla la red. Cinco
casos negativos por defecto fallaron antes; los 68 casos dirigidos pasan tras
el arreglo. La suite completa, build y CI del nuevo commit se registrarán en PR.

Esto no cierra aislamiento total: faltan scope de clínica/usuario en el cajón y
el legado, PHI en ficha raíz y transición D-057 sin titular, además de QA privada,
subida real de prueba y Safari físico/teclado real. Producción sigue en v1196;
las capturas y videos actuales corresponden al diseño d4b34c7 ya validado.

### Continuación del 11-sep: acceso privado completado y salida verificable

El dueño registró el URI de retorno indicado. Desapareció `redirect_uri_mismatch`
y, tras completar la verificación de Google, se abrió `/dashboard` en el alias
estable de PR #487, deployment READY `dpl_6ZjomDxfKfnCQ9kGj1e1nnBRkDNx`,
SHA `3e1ac0f`. Una pestaña nueva abrió el dashboard con la misma sesión. El
bloqueo de acceso privado queda cerrado; no se cambió la autenticación del código.

Recorrido privado de lectura en Chrome, ancho 1363 px: Hoy, Operaciones,
calendario en Día/Semana/Mes, directorio de pacientes y apertura/cierre del
formulario Nuevo paciente. La búsqueda y el formulario conservan el foco dentro
con Tab/Shift+Tab y lo devuelven al disparador con Escape. No hubo desborde en
las superficies medidas ni nuevos errores/avisos de consola durante el recorrido.
El directorio muestra correctamente el estado sin citas recientes junto a su
total de expedientes. No se abrieron ni modificaron expedientes, citas, recetas,
mensajes o archivos clínicos reales. La captura de Hoy no contiene pacientes.

Este recorrido no acredita Safari físico ni teclado virtual. Tampoco ejercita
escritura clínica, subida privada de archivos, roles adicionales ni aislamiento
entre médicos. La sesión de una cuenta es evidencia de acceso y navegación.

La reproducción sintética adicional encontró un acuse falso de guardado al
cerrar sesión y tres puntos de guardado que podían adoptar el uid siguiente.
REG-676/677 los reparan en el callback existente, sin remontar proveedores ni
migrar claves: el acuse de salida rechaza el fallo real y las escrituras nuevas
revalidan el uid del montaje. Se conserva la copia local y el aviso cuando no
se confirma el servidor. Trece negativos fallaban antes; los diecinueve casos
del nuevo golden y los 47 del grupo dirigido pasan después. Revisión independiente
del diff sin regresión concreta. La suite completa pasa 14.770 casos en 1.117
archivos; lint 93/93 sin deuda nueva; build correcto con 170 rutas y cuatro
comprobaciones CSP posteriores sobre el artefacto. El build usa los rellenos
Firebase sintéticos de CI. Los resultados remotos del commit se registran en PR.

La memoria compartida, restauración legada, cambio de clínica bajo el mismo uid
y solicitudes ya entregadas al SDK permanecen fuera de este cierre. También
siguen los límites de PHI en ficha raíz y D-057. Producción no se publicó.
