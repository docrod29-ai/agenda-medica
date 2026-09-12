# Checkpoint: primera integración de inferencia propia

Orden del dueño: ejecutar el plan de Ausculta con menor dependencia de IA externa.
Base original: `34211eaaebe366dcb87e3a02634f78fe41abf12c`.
Se integra main `91730a62ac6c35933aa3f4e2608a3c6dde38fb3d`, que conserva
v1198 y las decisiones D-059–D-062. Planes, precios y borrador local en vivo
se conservan. El pin de publicación autorizado en main se conserva sin activarlo.
Rama: `codex/ausculta-inferencia-privada`. Candidato de caché: v1199.
PR: https://github.com/docrod29-ai/agenda-medica/pull/495.

El trabajo se aisló de otro cambio activo en el clon original. No se alteran
reglas desplegadas, accesos de producción, suscripciones ni pesos de modelos.

## Entregado

- Proveedor `selfhosted` en el gateway y la ruta canónica de nota. Configuración
  de servidor, contexto clínico verificado, contrato JSON y procedencia real.
- Política `LOCAL_ONLY` aplicada a rutas directas, gateway y bibliografía.
  Sin rescate externo ante errores. Redirecciones prohibidas y plazo completo
  para respuesta privada, incluyendo su cuerpo.
- Capacidades vigentes de voz: Web Speech, transcripción y lectura por voz.
  Negación antes del micrófono, fin de sondeo ante prohibición, conservación del
  respaldo y protección frente a respuestas tardías de un intento anterior.
- Plantilla de host GPU, comprobador sintético de servidor y guía de operación
  en `docs/ia/INFERENCIA-PROPIA.md`. Sin imagen ni pesos fingidos como evaluados.

## Evidencia final de software, integrada con main v1198

| Comprobación | Resultado |
| --- | --- |
| Suite completa salvo el escáner npm, con TCP/DNS/UDP bloqueados | 14 938 casos pasan; 1 129 archivos; ninguno omitido. |
| Prueba separada que consulta vulnerabilidades de paquetes en npm | 16 casos pasan. No importa casos clínicos. |
| Casos nuevos de privacidad/nota/voz/inventario | 63 casos incluidos en la suite final. |
| Lint | 93 errores heredados; techo 93, sin deuda nueva. |
| Build final | `npm run build` completo y correcto, candidato v1199. |
| HTTP real del build local, `LOCAL_ONLY` | Capacidades 200; transcripción, sondeo y verificador 503 con capacidad limitada. |
| Prueba inversa del bloqueo | Quitar deliberadamente el bloqueo hace fallar el guardián; código restaurado y casos vuelven a pasar. |
| Prueba inversa del cobro privado | Retirar `!propia` del escalado cobra Máxima sin cambiar cómputo y hace fallar el caso; restaurado, pasa con reserva y cobro Estándar. |
| Plantilla GPU | Sintaxis shell/YAML y declaración de red revisadas; sin ejecución Docker/GPU. |
| Comprobador sin servidor configurado | Sale con error explícito; no informa inferencia exitosa. |

La primera suite general fue rechazada por revisión automática por posible
consulta clínica externa. Se construyó un bloqueo de conexiones para sus
procesos y workers; TCP, DNS y fetch nativo se comprobaron denegados antes de
conectar. La única prueba que necesita red, el escáner de dependencias, se
ejecuta separadamente y sólo envía metadatos de paquetes. CI conserva ambas
ejecuciones, sin eliminar casos ni simular cifras de vulnerabilidades.

La revisión paralela de transporte y voz detectó y ayudó a cerrar: hostname con
punto terminal, logs de salida privada, JSON vacío, timeout sólo de cabeceras,
TTS sin permiso, sondeo prolongado y carreras de captura. Los datos utilizados
son sintéticos. La revisión no certifica una instalación desplegada.

La integración de main detectó un cruce adicional: el escalado por complejidad
no aumenta cómputo cuando sólo hay un modelo privado. Se evita aumentar sus
créditos automáticamente; los perfiles públicos mantienen D-062. Una prueba
ejecuta la nota propia en modo híbrido con fusión habilitada y comprueba que
no resuelve ninguna llave pública ni inicia el borrador GPT. Los tableros de
versión y programa se regeneraron con sus scripts canónicos.

El estado de CI del commit final se consulta en el PR #495. Los resultados
locales anteriores no sustituyen sus comprobaciones remotas.

## Lo que aún impide afirmar independencia operativa

No hay GPU, endpoint ni credencial de inferencia propia disponibles en esta
sesión. No se descargaron ni entrenaron pesos, no se midió calidad médica y no
se activó el modo privado en producción. `LOCAL_ONLY` limita capacidades todavía
externas; no transforma Firebase y los demás servicios en software sin conexión.

Siguiente acción concreta: conectar un host GPU administrado con imagen y pesos
fijados, ejecutar el comprobador y una nota autenticada sintética, medir el mismo
corpus con revisión clínica y documentar las salidas de red del despliegue. RAG
local, ASR propio y especialidades adicionales siguen como incrementos sujetos
a evaluación. D-029 excluye transcripciones de producción, aun desidentificadas.

La autorización autónoma del repositorio termina en rama, commit, PR y CI.
Publicar o fusionar sigue siendo una decisión del dueño. Este checkpoint no es
un acta de publicación ni una afirmación de que Ausculta ya reemplaza a un médico.
