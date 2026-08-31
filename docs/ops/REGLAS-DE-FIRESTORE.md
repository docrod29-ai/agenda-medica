# Reglas de Firestore — qué está escrito y qué rige de verdad

> **Estado**: hay reglas en el repositorio que **NO están desplegadas**. Este
> archivo dice cuáles y qué se rompe mientras tanto. Desplegarlas es una acción
> del dueño.

## El problema que este archivo cierra

`firestore.rules` vive en el repositorio, se revisa en cada PR y se prueba contra
el emulador. Y **`vercel --prod` no lo publica**. El despliegue es otro comando y
otra autorización:

```bash
npx firebase deploy --only firestore:rules --project nexomed-agenda
```

Entre las dos cosas hay un hueco donde caben meses. El repositorio queda diciendo
una verdad —«esta colección está protegida así»— que **en producción no rige**, y
nada lo detecta: la suite pasa, el emulador pasa, el PR se ve bien.

Ya pasó. `docs/roadmap/nexus-os/estado.json` lleva anotado desde E0-06 que el
bloque `clinico` está modificado en el repositorio y **sin desplegar**.

## Cómo deja de depender de que alguien se acuerde

`firestore.rules.estado.json` guarda el **sha256 de las reglas que se
confirmaron desplegadas**. El guardián
`src/__tests__/las-reglas-escritas-no-son-las-que-rigen.test.ts` compara ese
hash con el de las reglas de hoy:

- **Iguales** → lo escrito es lo que rige. Nada que hacer.
- **Distintos** → hay cambios sin desplegar, y entonces este documento **tiene
  que decir cuáles** en la sección de abajo. Si no lo dice, el guardián falla.

Es la misma regla que el resto del repositorio: el estado se **deriva**, no se
recuerda. Lo único que se pide a mano es lo que ninguna máquina puede saber —qué
se rompe mientras tanto— y eso es justo lo que hay que escribir.

**El hash no se actualiza para poner una prueba en verde.** Sólo se actualiza
después de correr el despliegue y ver que terminó bien. Un registro de despliegue
que se edita para pasar el CI deja de ser un registro.

## PENDIENTE DE DESPLIEGUE

Mientras esta lista no esté vacía, hay reglas escritas que no protegen nada en
producción.

| Regla | Qué NO rige hoy | Consecuencia mientras tanto |
|---|---|---|
| `clinics/{id}/members/{uid}` | La colección se lee y se escribe desde el navegador y **no tiene regla desplegada**, así que la niega el `match /{document=**}` final | El apodo del chat del consultorio **no se guarda nunca**, y el código cae con elegancia al nombre por omisión: el defecto se esconde detrás de su propio respaldo (REG-340) |
| `clinics/{id}/patients/{pid}/clinico/{doc}` | El bloque de la subcolección clínica de E0-06 | Hoy es inocuo porque todavía no hay datos ahí — y por eso mismo tiene que desplegarse **antes** de que los haya, no después |
| Las nueve colecciones que REG-340 declaró | Sus `match` nuevos | Sin exposición de acceso (son de servidor, con Admin SDK, que se salta las reglas), pero el comodín de denegación es lo único que las cubre hoy |

## Qué NO arregla desplegarlas

Desplegar las reglas **no** despliega los índices: ésos son
`docs/ops/INDICES-DE-FIRESTORE.md` y otro comando. Son dos autorizaciones
distintas y conviene pedirlas juntas.
