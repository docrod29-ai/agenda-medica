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
