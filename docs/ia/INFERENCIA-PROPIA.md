# Ausculta: primera integración de inferencia propia

Estado: candidato de software; sin servidor GPU conectado ni validación clínica
del modelo. El adaptador permite generar el borrador de nota en la ruta real
`/api/expediente/procesar`. No convierte a Ausculta en un médico autónomo ni
demuestra equivalencia con los modelos externos.

## Configuración de la aplicación

Todas estas variables pertenecen al servidor. Nunca llevan `NEXT_PUBLIC_`.

| Variable | Uso |
| --- | --- |
| `AUSCULTA_AI_MODE` | Ausente o `HYBRID`: comportamiento externo existente. `LOCAL_ONLY`: sólo inferencia propia. Cualquier valor distinto cierra las salidas. |
| `AUSCULTA_NOTE_PROVIDER` | `selfhosted` permite probar sólo la nota propia en `HYBRID`. Sin ese valor se conserva la nota externa. |
| `AUSCULTA_SELF_HOSTED_BASE_URL` | URL HTTPS del servidor administrado por Ausculta, terminada en `/v1`. Sin usuario, contraseña, parámetros ni fragmento. |
| `AUSCULTA_SELF_HOSTED_MODEL` | Un único identificador estable del modelo evaluado; debe coincidir exactamente con `model` en la respuesta. |
| `AUSCULTA_SELF_HOSTED_API_KEY` | Secreto del servicio. No se envía al navegador ni se toma del cuerpo de la petición. |

Una plantilla `.env.example` con valores vacíos no habilita el modo híbrido:
omitir `AUSCULTA_AI_MODE` o fijarlo explícitamente. HTTP sólo se admite para
loopback fuera de producción. No cambiar variables de producción para probar.

## Comportamiento implementado

- Mantiene autorización de módulo, límites y créditos. La nota propia además
  exige identidad, clínica y rol clínico resueltos; no acepta un contexto de
  autorización incompleto. El cuerpo no puede elegir endpoint, llave o modelo.
- Reutiliza prompts de especialidad, esquema de extracción, atribución y
  formato de nota. Exige JSON válido con contenido reconocido. Rechaza salida
  vacía, truncada, herramienta, rechazo o modelo distinto.
- Devuelve el proveedor/modelo reales y aviso de evaluación clínica pendiente.
  No activa el ensamble externo ni el segundo verificador automático.
- Ante fallo conserva el fallback canónico identificado como `parser-local`.
  Ese parser no es un LLM y su resultado requiere revisión. No hay rescate externo.
- La reserva del gateway es de cero créditos porque la ruta ya administra el
  cobro; la reserva de la nota se devuelve si no se genera una nota válida.
  Los tokens se anotan como `selfhosted`. Coste sin tarifa conocida no significa
  coste cero: la GPU requiere contabilidad de infraestructura aparte.
- El timeout privado cubre cabeceras y cuerpo, con límite de 2 MiB y sin seguir
  redirecciones. No registra texto clínico en errores propios.

## Qué limita `LOCAL_ONLY`

El transporte dedicado bloquea las llamadas actuales a Anthropic, OpenAI,
AssemblyAI, PubMed y openFDA, incluidos descubrimiento, revisión, ASR y rutas
directas. Las capacidades de dictado, transcripción y lectura por voz se
consultan antes de iniciarse; un cambio de política detiene el sondeo de ASR
sin agotar una cascada de proveedores. El audio de recuperación se conserva.

El modo es una política de IA, no una aplicación completamente desconectada:
Firebase, autenticación, almacenamiento, pagos y demás servicios existentes
siguen teniendo su función. Tampoco una URL prueba quién administra un servidor;
esa pertenencia y sus logs se verifican operativamente. El filtro de dominios
públicos conocidos no identifica cualquier proxy posible.

Una solicitud que ya salió antes de cambiar la política no puede retirarse.
Los navegadores con una versión antigua necesitan recargarse. Activar el modo
requiere drenar trabajos existentes y validar el despliegue coherente. Reforzar
la política del software con reglas de salida de infraestructura; el guardián
estático no sustituye esas reglas.

## Arranque del motor en un host GPU

La plantilla `infra/inferencia-privada/compose.yaml` está preparada para un host
administrado por Ausculta. No se ha ejecutado en GPU. Sus valores de contexto y
concurrencia son un punto de partida operativo, no un dimensionamiento medido.

1. Elegir un candidato con licencia compatible y soporte en la versión fijada
   de vLLM. Registrar repositorio, revisión exacta, licencia, cuantización,
   plantilla de chat y hashes de pesos. La etiqueta comercial no identifica los
   pesos. Medir fidelidad en español, negaciones, alergias y atribución antes de
   seleccionar el modelo; no elegirlo sólo por un benchmark publicado.
2. Precargar en el host una imagen revisada y fijada por `@sha256:...`; descargar
   pesos en una fase separada y verificar su manifiesto. La plantilla no descarga
   nada mientras sirve inferencia. No activar código remoto de pesos sin auditar.
3. Definir en el host `AUSCULTA_VLLM_IMAGE`, `AUSCULTA_MODEL_DIR`,
   `AUSCULTA_SERVED_MODEL`, `AUSCULTA_API_KEY_FILE` y, si procede,
   `AUSCULTA_MODEL_CONTEXT`. Guardar la credencial fuera del repositorio, con
   permisos que permitan leerla al UID 2000 del contenedor. Verificar memoria,
   controladores NVIDIA y soporte de los flags de la imagen fijada.
4. Ejecutar `docker compose -f infra/inferencia-privada/compose.yaml up -d` en
   el entorno de prueba aprobado. El motor queda publicado sólo en loopback,
   en una red Docker interna; verificar de hecho que esa red no sale a Internet.
5. Conectar el backend mediante un proxy HTTPS administrado, con autenticación y
   acceso de red restringido. Publicar únicamente `POST /v1/chat/completions`;
   denegar `/invocations`, `/metrics`, `/docs`, administración y demás rutas.
   Desactivar logs de cuerpos y credenciales también en el proxy. La llave de
   vLLM por sí sola no protege todas sus rutas.
6. Configurar un entorno de Ausculta de prueba. Ejecutar
   `npx tsx scripts/ia/verificar-servidor-propio.ts`. Usa un texto fijo inventado,
   verifica modelo, protocolo y formato, y sólo imprime metadatos. Sin servidor
   no informa éxito. Esto no reemplaza la prueba autenticada de la nota completa.
   Preparar el ejecutor TypeScript `tsx` en ese entorno de prueba; no viene
   instalado por el `npm ci` actual de Ausculta.

El despliegue debe registrar imagen por digest, hash de pesos, versión de prompt
y commit de Ausculta. Para revertir un fallo del modelo bajo privacidad estricta,
conservar `LOCAL_ONLY` y volver a la revisión manual; habilitar `HYBRID` vuelve
a permitir procesamiento externo y exige una decisión consciente.

Referencias técnicas consultadas: [Docker oficial de vLLM](https://docs.vllm.ai/en/stable/deployment/docker/),
[argumentos del servidor y alcance de la API key](https://docs.vllm.ai/en/stable/cli/serve/),
[variables de entorno y telemetría](https://docs.vllm.ai/en/stable/configuration/env_vars/).

## Evaluación y siguiente avance

Las pruebas unitarias ejecutan la ruta canónica con transporte simulado. No se
presentan como inferencia real. La suite puede correr sin TCP, DNS ni UDP con:

```sh
NODE_OPTIONS='--require=./scripts/testing/sin-red.cjs' npx vitest run --maxWorkers=4 --exclude src/__tests__/la-cifra-de-seguridad-no-se-pudre.test.ts
npx vitest run src/__tests__/la-cifra-de-seguridad-no-se-pudre.test.ts
node scripts/lint-trinquete.mjs
npm run build
```

La prueba de vigencia de vulnerabilidades se ejecuta aparte: necesita consultar
el registro npm con nombres y versiones de paquetes, sin importar casos ni
funciones clínicas. Se mantienen todos los casos; no se inventan resultados del
escáner. Las restantes pruebas no pueden abrir conexiones TCP, DNS ni UDP.

Antes del piloto con el modelo real: usar casos inventados o actuados autorizados
según D-029; el banco inicial de cuatro casos no prueba seguridad general.
Comparar las mismas entradas, con modelo y prompt fijados, contra la referencia
externa sólo en un entorno que autorice ese procesamiento sintético. Medir
omisiones, afirmaciones sin soporte, conservación de cifras/negaciones,
atribución de hablante, procedencia de medicamentos, abstención, tiempo y coste.
Guardar resultados incluso cuando el modelo falla y revisar clínicamente por
especialidad. El sistema no se aprueba por la valoración de otro LLM.

El próximo incremento es recuperación de fuentes locales con licencia,
versionado y citas comprobables. Después, ASR autoalojado. Ajuste fino sólo con
datos autorizados y tras demostrar una mejora en evaluación separada del
entrenamiento. No hay aprendizaje automático de conversaciones de producción.
