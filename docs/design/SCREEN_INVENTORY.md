# Inventario de pantallas — NexusMED

> **GENERADO. No se edita a mano.**
> `node scripts/design/inventario-de-pantallas.mjs`
> El guardián `el-inventario-de-pantallas-no-miente` falla si este archivo se
> queda atrás respecto del árbol de rutas.
>
> **Qué NO dice**: mide el `page.tsx`, no el árbol de componentes que cuelga
> de él. Una pantalla delgada que delega en un componente grande sale con
> `Resp: —` y eso **no** significa que no sea adaptable. Sirve para ordenar el
> barrido; aprobar una pantalla exige abrirla en un navegador.

**Total: 79 pantallas.**

| Superficie | Pantallas |
|---|---|
| paciente | 9 |
| medico | 33 |
| alpha | 10 |
| publica | 18 |
| interna | 9 |

- **paciente** — a quien le habla es el paciente. Es lo que gobierna V9.
- **medico** — la consulta y su alrededor. Producto Practice.
- **alpha** — Hospital y UCI. Detrás de bandera, **no a la venta**.
- **publica** — marketing y alta.
- **interna** — superadmin. Fuera del alcance de V9.

## Columnas

`Cli` `'use client'` · `Nav` salidas declaradas (`<Link`, `router.push`) ·
`Resp` menciona un punto de corte · `Tok` usa `var(--…)` de `globals.css` ·
`Est` toca almacenamiento del navegador.

| Ruta | Superficie | Cli | Líneas | Nav | Resp | Tok | Est |
|---|---|---|---|---|---|---|---|
| `/dr/[clinicId]` | paciente | — | 259 | 1 | — | ✅ | — |
| `/mi/[token]` | paciente | ✅ | 710 | 0 | — | ✅ | — |
| `/pago/cancelado` | paciente | ✅ | 19 | 1 | — | ✅ | — |
| `/pago/exito` | paciente | ✅ | 32 | 0 | — | ✅ | — |
| `/privacidad/[clinicId]` | paciente | ✅ | 265 | 0 | — | ✅ | — |
| `/resena/[token]` | paciente | ✅ | 100 | 0 | — | ✅ | — |
| `/reservar/[clinicId]` | paciente | ✅ | 371 | 0 | — | ✅ | — |
| `/teleconsulta/[citaId]` | paciente | ✅ | 103 | 0 | — | ✅ | — |
| `/verificar/[token]` | paciente | — | 97 | 0 | — | ✅ | — |
| `/antibiograma` | medico | ✅ | 899 | 0 | — | ✅ | — |
| `/asistente` | medico | ✅ | 646 | 0 | — | ✅ | — |
| `/calendario` | medico | ✅ | 436 | 1 | — | ✅ | — |
| `/chat` | medico | ✅ | 330 | 0 | — | ✅ | — |
| `/citas` | medico | ✅ | 930 | 6 | — | ✅ | — |
| `/configuracion` | medico | ✅ | 2606 | 1 | — | ✅ | — |
| `/consulta/[patientId]` | medico | ✅ | 5872 | 5 | — | ✅ | ✅ |
| `/consultor` | medico | ✅ | 282 | 0 | — | ✅ | — |
| `/corte-caja` | medico | ✅ | 333 | 0 | — | ✅ | — |
| `/crm` | medico | ✅ | 228 | 1 | — | ✅ | — |
| `/cumplimiento` | medico | ✅ | 945 | 0 | — | ✅ | — |
| `/cumplimiento/motores` | medico | ✅ | 188 | 1 | — | ✅ | — |
| `/cumplimiento/retencion` | medico | ✅ | 177 | 2 | — | ✅ | — |
| `/cumplimiento/seguridad` | medico | ✅ | 291 | 1 | — | ✅ | — |
| `/dashboard` | medico | ✅ | 378 | 7 | — | ✅ | — |
| `/expediente/[patientId]` | medico | ✅ | 669 | 12 | — | ✅ | — |
| `/expedientes` | medico | ✅ | 18 | 1 | — | — | — |
| `/farmacia` | medico | ✅ | 683 | 0 | — | ✅ | — |
| `/finanzas` | medico | ✅ | 675 | 0 | — | ✅ | — |
| `/guia` | medico | ✅ | 131 | 0 | — | ✅ | — |
| `/lista-espera` | medico | ✅ | 285 | 0 | — | ✅ | — |
| `/membresias` | medico | ✅ | 281 | 0 | — | ✅ | — |
| `/migracion` | medico | ✅ | 370 | 0 | — | ✅ | — |
| `/motores` | medico | ✅ | 208 | 0 | — | ✅ | — |
| `/nota/[patientId]` | medico | ✅ | 74 | 2 | — | ✅ | — |
| `/nota/[patientId]/[notaId]` | medico | ✅ | 841 | 2 | — | ✅ | — |
| `/orden/[patientId]/[notaId]` | medico | ✅ | 793 | 2 | — | ✅ | — |
| `/pacientes` | medico | ✅ | 836 | 9 | — | ✅ | — |
| `/pendientes` | medico | ✅ | 259 | 1 | — | ✅ | — |
| `/reactivacion` | medico | ✅ | 250 | 0 | — | ✅ | — |
| `/receta/[patientId]/[notaId]` | medico | ✅ | 977 | 2 | — | ✅ | — |
| `/referencia/[patientId]` | medico | ✅ | 276 | 0 | — | ✅ | — |
| `/resenas` | medico | ✅ | 105 | 0 | — | ✅ | — |
| `/hospitalizacion` | alpha | ✅ | 425 | 5 | — | ✅ | — |
| `/hospitalizacion/[internamientoId]` | alpha | ✅ | 1725 | 4 | — | ✅ | ✅ |
| `/hospitalizacion/camas` | alpha | ✅ | 239 | 1 | — | ✅ | — |
| `/hospitalizacion/indicadores` | alpha | ✅ | 102 | 0 | — | ✅ | — |
| `/hospitalizacion/unidades` | alpha | ✅ | 171 | 0 | — | ✅ | — |
| `/uci` | alpha | ✅ | 1932 | 2 | — | ✅ | ✅ |
| `/uci/antimicrobianos` | alpha | ✅ | 683 | 0 | — | ✅ | — |
| `/uci/benchmark` | alpha | ✅ | 265 | 0 | — | ✅ | — |
| `/uci/dosificacion` | alpha | ✅ | 585 | 0 | — | ✅ | — |
| `/uci/enfermeria` | alpha | ✅ | 206 | 1 | — | ✅ | — |
| `/` | publica | ✅ | 662 | 12 | — | ✅ | — |
| `/arquitectura` | publica | — | 112 | 2 | — | ✅ | — |
| `/contacto` | publica | — | 69 | 2 | — | ✅ | — |
| `/demo` | publica | — | 312 | 5 | — | ✅ | — |
| `/demo/interactivo` | publica | ✅ | 772 | 2 | — | ✅ | — |
| `/demo/razonamiento` | publica | ✅ | 146 | 3 | — | ✅ | — |
| `/evidencia` | publica | — | 81 | 1 | — | ✅ | — |
| `/legal` | publica | ✅ | 113 | 1 | — | ✅ | — |
| `/login` | publica | ✅ | 392 | 4 | — | ✅ | — |
| `/operacion` | publica | — | 98 | 2 | — | ✅ | — |
| `/paquetes` | publica | — | 94 | 3 | — | ✅ | — |
| `/precios` | publica | — | 182 | 1 | — | ✅ | — |
| `/privacidad` | publica | — | 134 | 0 | — | — | — |
| `/registro` | publica | ✅ | 389 | 3 | — | ✅ | — |
| `/seguridad` | publica | — | 145 | 2 | — | ✅ | — |
| `/setup` | publica | ✅ | 279 | 2 | — | ✅ | — |
| `/terminos` | publica | — | 140 | 0 | — | ✅ | — |
| `/unirse/[code]` | publica | ✅ | 197 | 4 | — | ✅ | — |
| `/superadmin` | interna | ✅ | 690 | 1 | — | ✅ | — |
| `/superadmin/contabilidad` | interna | ✅ | 292 | 1 | — | ✅ | — |
| `/superadmin/costos` | interna | ✅ | 520 | 1 | — | ✅ | — |
| `/superadmin/csp` | interna | ✅ | 178 | 1 | — | ✅ | — |
| `/superadmin/errores` | interna | ✅ | 85 | 1 | — | ✅ | — |
| `/superadmin/onboarding` | interna | ✅ | 163 | 1 | — | ✅ | — |
| `/superadmin/planes` | interna | ✅ | 228 | 1 | — | ✅ | — |
| `/superadmin/simulador` | interna | ✅ | 193 | 1 | — | ✅ | — |
| `/superadmin/soporte` | interna | ✅ | 96 | 1 | — | ✅ | — |
