# Regla — despliegue y banderas

## Autonomía: hasta el PR, no más allá

El trabajo autónomo llega a **rama + commit + PR + CI en verde**. Desplegar a
producción y fusionar a `main` son decisiones del dueño.

## Ciclo completo (cuando el dueño lo autoriza)

```
vitest → lint-trinquete → build → subir public/sw.js a nexusmed-vNNN
→ node scripts/version-sw.mjs → bitácora + changelog → commit
→ vercel --prod --archive=tgz → verificar con curl
→ npm run e2e:seguridad:prod  ← cabeceras de PRODUCCIÓN, aquí y no antes
→ push → PR → 5 jobs de CI → merge → git merge origin/main
```

Olvidar `scripts/version-sw.mjs` deja `version.txt` atrasado y CI lo caza.

## Las cabeceras de producción se comprueban DESPUÉS de publicar

`npm run e2e:seguridad:prod` recorre `RUTAS_PRIVADAS` —la lista del árbol— contra
el sitio vivo. Eso sólo tiene sentido cuando el sitio ya lleva ese árbol: una rama
que añade una pantalla al dashboard hace fallar A3 contra producción hasta que se
despliega, y ese rojo no dice nada de la rama.

Por eso el CI del PR mide **el build del PR** (`e2e-publico`, con
`PLAYWRIGHT_LOCAL=1`) y la comprobación contra producción vive aquí, en el paso
donde sí es accionable: si tras publicar una ruta privada sale sin
`X-Frame-Options`, el despliegue está mal y se puede arreglar en el momento.

## Un despliegue arrastra TODO lo no desplegado

No publica «lo último que se pidió»: publica todo lo pendiente. Declarar el
paquete antes de publicar.

## Banderas

Hospital y UCI viven detrás de bandera y en estado ALPHA: **se usan, no se
venden**. Que el fundador pueda usar un módulo no lo pone a la venta.
