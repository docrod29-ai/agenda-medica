# Handoff — rebanada PORTAL

Hallazgos de mi lista cuyo arreglo cae, entero o en parte, en archivos que **no
son míos**. No he tocado ninguno de esos archivos: qué hay que cambiar, dónde, y
qué prueba lo cubriría.

---

## 1 · PI-006 — «Ya no tomas: Tempra» y «Empiezas: Paracetamol» son la misma medicina

**Rebanada: MOTORES.**

`cambiosDeMedicacion` (mío, `src/lib/paciente/paquete-de-visita.ts`) compara
**nombres normalizados**. Nombre comercial contra genérico son dos cadenas
distintas, así que el mismo fármaco sale como suspendido y como nuevo en el plan
que lee el paciente — y la lista «qué cambió» es justo la que existe para que no
se equivoque.

- **Dónde**: el catálogo de sinónimos comercial↔genérico vive en
  `src/lib/expediente/medical-dictionary.ts` (MOTORES). Hace falta una función
  con nombre —`mismaMoleculaQue(a, b)` o equivalente— que `cambiosDeMedicacion`
  pueda importar.
- **Lo que NO se puede hacer sin ella**: adivinar. Comparar por prefijo o por
  primeras letras uniría «metoprolol» con «metotrexato».
- **Prueba que lo cubre**: caso en
  `src/__tests__/el-paquete-de-la-visita-se-libera-y-llega.test.ts` con
  `medicacionPrevia: ['Tempra 500 mg']` y una receta de hoy con «Paracetamol 500
  mg»: `medicationChanges` no puede contener un `nuevo` y un `suspendido` para la
  misma molécula.

---

## 2 · PG-014 — la fecha probable de parto se calcula y se queda en la nota

**Rebanada: MOTORES (el cálculo) · RECETA-DOCS o CONSULTA (de dónde sale).**

Naegele es determinista y ya está bien hecho, pero la FPP no llega al paquete del
paciente: la embarazada no la ve en su plan ni sabe quién la calculó.

- **Dónde**: `NotaParaElPaquete` (mío) ya puede recibir el campo; lo que falta es
  que la nota lo GUARDE en un sitio estable que el compositor pueda leer, con la
  fecha de la última regla y el método, para poder decir de dónde sale.
- **Cuando exista**: yo añado el campo al `PaqueteDeVisita` y a la pantalla en
  una línea; no lo hago antes para no crear un campo que nadie llena.

---

## 3 · PO-011 — la reseña «anónima» que se publica con nombre

**Rebanada: AGENDA-MENSAJERIA (`src/lib/reviews.ts`).**

Ya corregí el TEXTO de `/resena/[token]` para que diga la verdad («aparecerá con
tu nombre de pila y la inicial de tu apellido»). Lo que queda es decidir y
construir el comportamiento:

- publicar de verdad anónimo, o
- preguntarle al paciente al enviar («¿puedo publicarla con tu nombre?») y
  guardar esa respuesta con la reseña.

**Prueba**: la publicación no puede contener ninguna parte del nombre cuando el
paciente no lo autorizó.

---

## 4 · PG-021 (segunda mitad) — «¡Bienvenido!» en el bot de WhatsApp

**Rebanada: AGENDA-MENSAJERIA (`src/app/api/whatsapp/webhook/route.ts`).**

Arreglé el masculino del portal («tú mismo» → sin género). El saludo
«¡Bienvenido!» del bot sigue igual, y la mitad de quien lo lee es una paciente.
Es un cambio de una cadena: «Hola» o «Te damos la bienvenida».

---

## 5 · MC-016 · MO-010 · PC-020 — los documentos que no existen

**Rebanada: RECETA-DOCS.**

Incapacidad, constancia de asistencia, certificado médico e informe para
aseguradora no existen en el producto. Ya llegan al consultorio **rotulados como
lo que son** (`documento_firmado`, fixture `pl-16`), que es lo que se podía hacer
desde aquí; el documento con firma protegida es trabajo de la familia documental
(y hay una fila para ello en PL-L8).

---

## 6 · PC-011 — la foto de la herida

**Decidido por el dueño (PL-P8): NO entra en V9.** No se construye. Queda dicho
en `no-reparado-PORTAL.md` para que no vuelva a aparecer como hallazgo nuevo.

---

## 7 · PO-012 (segunda mitad) — el tema oscuro del Portal de Privacidad

**Rebanada: UI-CONFIG.**

`/privacidad/[clinicId]` está escrita entera con colores literales (`#fff`,
`#f3f4f6`, `#374151`…), así que en tema oscuro la tarjeta queda blanca con título
gris claro. Arreglé el tamaño táctil y el contraste de lo que toqué, y **no**
convertí la pantalla a tokens: bajaría `hexEnLinea` unas veinte unidades y eso
obliga a re-sellar `scripts/design/techos-de-diseno.json`, que es vuestro.

- **Qué hacer**: cambiar los literales por `var(--bg)`, `var(--s1)`,
  `var(--text)`, `var(--text2)`, `var(--border)`; después
  `node scripts/design/trinquete-de-diseno.mjs --actualizar`.
- Lo mismo vale para la tarjeta de ARCO de `/cumplimiento`, que el hallazgo
  nombra y que es de EXPEDIENTES.

---

## 8 · Aviso al orquestador — dos artefactos generados que sí toqué

No son de nadie en particular y salen de un script, pero conviene saberlo al
integrar:

- `scripts/design/techos-de-diseno.json`: `tamanosFueraDeEscala` **1868 → 1860**
  (mis pantallas volvieron a la escala). Lo bajó el propio script con
  `--actualizar`, que es como el fichero dice que se baja.
- `docs/design/SCREEN_INVENTORY.md`: regenerado con
  `node scripts/design/inventario-de-pantallas.mjs` (sólo cambian los conteos de
  líneas de `/mi/[token]`, `/privacidad/[clinicId]` y `/resena/[token]`).

Si otra rebanada mueve esos mismos números, **vuelve a correr los dos scripts
después de integrar**: los dos guardianes exigen igualdad exacta, no holgura.

---

## 9 · Las reproducciones que moví

El directorio `docs/audit/panel-de-lujo-2026-09/` no está bajo control de
versiones en mi worktree, así que **copié** las cinco reproducciones a
`src/__tests__/` en vez de moverlas. Las de PORTAL que el orquestador puede
borrar de `reproducciones/` al integrar:

| Reproducción | Ahora vive en |
|---|---|
| `REP-019-dando-pecho-no-escala.test.ts` | `src/__tests__/dando-pecho-no-es-una-forma-menor-de-decir-lactancia.test.ts` |
| `REP-057-como-y-cuando-contestan-desde-el-plan.test.ts` | `src/__tests__/como-y-cuando-dentro-de-otra-pregunta-no-son-una-pregunta-de-toma.test.ts` |
| `REP-071-po-010-motivo-clinico-en-url-de-google-calendar.test.ts` | `src/__tests__/el-motivo-clinico-no-viaja-en-la-url-de-google.test.ts` |
| `REP-072-pc-001-diagnostico-descartado-llega-al-paciente.test.ts` | `src/__tests__/al-paciente-solo-bajan-los-diagnosticos-que-su-medico-confirmo.test.ts` |
| `REP-059-whatsapp-declara-no-tratar-salud.test.ts` | `src/__tests__/lo-que-se-declara-de-whatsapp-y-lo-que-se-manda-por-whatsapp.test.ts` |

---

## 10 · Un dato nuevo en el expediente del paciente

El cuidador autorizado se guarda como **campo** del documento del paciente
(`cuidadoresAutorizados: CuidadorAutorizado[]`), **no** como colección nueva: así
no abre una cuarta puerta que declarar en `firestore.rules`, la matriz de acceso
y el manifiesto de respaldo, y viaja en el respaldo con el expediente al que
pertenece.

SEGURIDAD debería mirarlo igualmente:

- `firestore.rules` permite `update` de `patients/{id}` a cualquier miembro y no
  usa `hasOnly` ahí, así que el campo no rompe ninguna regla — pero **la escritura
  real la hace el servidor** (`/api/portal`) con lista blanca, nunca el navegador.
- Si algún día se congela la forma de `patients` con `hasOnly`, este campo tiene
  que entrar en la lista.
