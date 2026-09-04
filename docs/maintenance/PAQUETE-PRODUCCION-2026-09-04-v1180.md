# Paquete de producción — `nexusmed-v1180`

> **Estado: PREPARADO, NO PUBLICADO.** Publicar sigue siendo decisión del dueño
> (`.claude/rules/deployment-and-flags.md`). Autorizado por él el 4-sep-2026
> con la palabra «DESPLIEGA»; este documento se escribe ANTES de correr el botón,
> para que lo que se declara no se pueda ajustar a lo que salga.

| | |
|---|---|
| **Versión del service worker** | `nexusmed-v1179` → **`nexusmed-v1180`** |
| **Última línea desplegada** | `59a11d6b` — v1179, verificada por la ejecución #15 |
| **Commits que entran** | **97** |
| **Superficie** | 374 archivos · +20 229 / −1 598 · **73 de código de producto** |
| **Rutas de API nuevas** | **0** |
| **Pantallas nuevas** | **0** |
| **Reglas de Firestore** | **SÍ — y es la fila que importa de este paquete** |
| **Índices de Firestore** | sin cambios |
| **Regresiones cerradas** | **22** (REG-417, 431, 433…446, 506…511) |

---

## 1. La fila que importa: las reglas cambiaron

Es lo único de este paquete que **no se publica solo**. `vercel --prod` no
despliega `firestore.rules`; lo hace el paso del workflow, y por eso este
despliegue no es opcional aunque el código ya esté vivo.

```
reglas en main:     1d91d707…
reglas desplegadas: 3032001e…   ← lo que rige AHORA en producción
```

Lo que falta por publicar es la colección **`preguntas_paciente`** (PR #443,
PATIENT-AI-001): lo que el paciente le pregunta a su médico, con la clase de
respuesta que le puso el servidor.

**Qué se rompe mientras tanto: nada, y está declarado.** La colección cae en el
comodín de denegación, y quien escribe es el servidor con Admin SDK. Lo que no
rige es su regla explícita —`write: if false` desde el navegador— que es la que
impide que quien tenga el token del portal se fabrique la constancia de que el
sistema le contestó algo que nunca le contestó.

Publicar cierra ese hueco. No estaba abierto; estaba tapado por el comodín.

---

## 2. Qué entra, en una frase por bloque

**La IA de cara al paciente** (PR #443). El destino «Preguntar» del portal era un
párrafo que decía «llame por teléfono». Ahora clasifica —urgencia, acto
prohibido, administrativa, cita del plan liberado, escalar— y del otro lado hay
alguien. **Sin modelo de lenguaje**: lo que devuelve como respuesta es una cadena
que ya venía en el paquete que el médico liberó, o escala.

**Seis defectos que sólo se veían al ir a ejecutarlos** (REG-506…511). El
despliegue anunciaba índices y no mandaba ninguno; el membrete del Word vivía de
un candado apagado; el documento de protección de rama mandaba activar una
casilla que habría dejado `main` cerrada para siempre; y el acta de seguridad
podía publicar «cero vulnerabilidades» sobre 21 sin haber medido.

**Ocho superficies del médico miradas en un teléfono** (REG-437…445), y el
guardián que impide que dos sesiones den el mismo número de regresión — que se
renumeró tres veces mientras esperaba a fusionarse, y la tercera la cazó él.

**Seis decisiones del dueño** (D-023 a D-029), ninguna de las cuales cambia
comportamiento: cierran preguntas abiertas y quedan escritas en el código que
gobiernan.

---

## 3. Lo que este paquete NO afirma

- **No se ha visto en un navegador contra producción.** El contenedor donde se
  preparó tiene bloqueada la salida a internet por política de red: no se pudo
  hacer ni un `curl` al sitio vivo. La verificación contra producción la hace el
  workflow, que corre desde GitHub y sí llega.
- **`ops-timeout-y-punto-ciego` sigue rojo** en local: exige que `10.255.255.1`
  trague paquetes y el proxy rechaza al instante. Es del entorno, está
  documentado y su aserción no se ha tocado. En CI pasa.
- **Los índices no se tocan aquí.** Los doce se confirmaron `Enabled` en la
  consola el 2-sep; este paquete no añade ninguno.
- **El PR #442 se queda fuera a propósito.** Está dos días por detrás y sus dos
  números de regresión ya están dados. Meterlo aquí haría que un problema del
  despliegue tuviera dos causas posibles.

---

## 4. Orden de publicación

1. Este PR: sube el service worker a v1180 y escribe esta acta.
2. Un segundo PR repunta `SHA_AUTORIZADO` al `main` resultante. Va aparte porque
   la Compuerta 0 compara el pin contra la cabeza de `main`, y un pin que apunta
   a un árbol que aún no existe no se puede escribir.
3. El botón. Publica reglas, verifica la versión contra el sitio vivo y corre la
   comprobación de cabeceras de producción.

---

## 5. Lo que pasó de verdad

*(Se rellena tras correr el botón. Si esta sección sigue vacía, el paquete está
preparado y no publicado.)*
