# Continuación visual y seguridad de captura — 10-sep-2026

Base: `b8cd736`, después de la integración concurrente del PR #478 y el pin de v1195. Se conservaron sus arreglos de columnas, filas de medicamento y ubicación del chat/herramientas. El dueño reiteró que esperaba cambios visibles en toda la aplicación, colores más vivos y animaciones.

## Cambios de este lote

- Paleta compartida azul vivo, superficies claras azuladas y oscuras tinta azul; mismos tokens para agenda, pacientes, consulta, configuración, acceso y superficies públicas. Los colores de riesgo clínico no cambian.
- Navegación activa con tinte de marca; encabezados compartidos con mejor separación, subtítulo legible y entrada breve, desactivada con movimiento reducido.
- Consulta: navegación por tres regiones más distinguible, indicadores de sección, estado del documento y transiciones breves. Se mantienen las regiones montadas y las correcciones de 1440/1280/móvil del PR #478.
- Tarjeta social alineada con el nuevo tema oscuro.
- REG-668: autoría persistida del medicamento para que el eco de una IA no convierta una decisión médica en contenido eliminable. Edición, aceptación, restauración y estado manuales marcan autoría médica. La IA no puede atribuirse esa marca. Reproyección/corrección conservan capturas explícitas.

## Evidencia

La reproducción del defecto falló antes de repararlo en primer plano y recuperación. Tras la reparación, el grupo inicial de 44 casos pasó. La suite completa ejecutó 14 635 casos: 14 632 pasaron; fallaron tres guardianes de referencias de paleta/clasificación que se actualizaron con la nueva paleta y REG-668. La comprobación posterior de esos guardianes y regresiones clínicas pasó: 100 casos, seis archivos. Lint: 93/93; trinquete de diseño sin incremento; build equivalente a Preview compiló y terminó correctamente.

Contraste determinista, medido con el comprobador WCAG existente: blanco sobre azul sólido 6.22:1; acento oscuro sobre superficie oscura más clara 7.85:1; acento claro sobre superficie clara más oscura 5.37:1. Rojo y verde clínicos sobre la nueva superficie oscura: 4.80 y 4.82:1.

## Pendientes que este lote no declara resueltos

QA montada en cuenta privada, teclado y móvil del nuevo aspecto; asignación y aislamiento entre médicos de la misma clínica (incluidas exportaciones y metadatos clínicos del directorio); migración revisada del legado y publicación de reglas Firebase. La verificación de la demo pública no sustituye esos recorridos. Este lote no cambia permisos ni migra pacientes.

No se presenta este ajuste compartido como un rediseño completo, pantalla por pantalla, ni como cierre del objetivo de seguridad/despliegue. La vista previa es para verificar los cambios; producción requiere resolver las compuertas pendientes.
