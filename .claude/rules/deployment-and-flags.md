# Regla — despliegue y banderas

## Autonomía: hasta el PR, no más allá

El trabajo autónomo llega a **rama + commit + PR + CI en verde**. Desplegar a
producción y fusionar a `main` son decisiones del dueño.

## Ciclo completo (cuando el dueño lo autoriza)

```
vitest → lint-trinquete → build → subir public/sw.js a nexusmed-vNNN
→ node scripts/version-sw.mjs → bitácora + changelog → commit
→ vercel --prod --archive=tgz → verificar con curl → push → PR
→ 5 jobs de CI → merge → git merge origin/main
```

Olvidar `scripts/version-sw.mjs` deja `version.txt` atrasado y CI lo caza.

## Un despliegue arrastra TODO lo no desplegado

No publica «lo último que se pidió»: publica todo lo pendiente. Declarar el
paquete antes de publicar.

## Banderas

Hospital y UCI viven detrás de bandera y en estado ALPHA: **se usan, no se
venden**. Que el fundador pueda usar un módulo no lo pone a la venta.
