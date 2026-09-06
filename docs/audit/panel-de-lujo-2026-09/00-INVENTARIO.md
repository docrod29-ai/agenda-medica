# 00 — Inventario de NexusMED (generado 2026-09-06T02:58Z, commit 5f871bb)

Generado por script de sólo lectura. Cada fila es una pieza que algún auditor debe cubrir; la columna «Auditores» se llena en la Fase 5.

## Resumen

| Pieza | Cuenta |
|---|---|
| Rutas de API | 100 |
| Pantallas de trabajo (dashboard) | 45 |
| Pantallas públicas y otras (fuera del dashboard y de api) | 35 |
| Componentes | 114 |
| Hooks | 20 |
| Módulos de biblioteca (entradas de primer nivel en src/lib) | 144 |
| Archivos TS/TSX en src/lib | 572 |
| Colecciones en firestore.rules | 68 |
| Motores en registry.ts | 93 (líneas id/nombre) |
| Archivos de prueba | 968 |
| Regresiones en el ledger | 496 (última: REG-555) |
| Scripts en scripts/ | 44 |

## Rutas de API

| Ruta | Métodos | Archivo |
|---|---|---|
| `/api/appointments` | POST  | `src/app/api/appointments/route.ts` |
| `/api/arco/acceso` | POST  | `src/app/api/arco/acceso/route.ts` |
| `/api/arco/cancelar` | POST  | `src/app/api/arco/cancelar/route.ts` |
| `/api/arco/oponerse` | POST  | `src/app/api/arco/oponerse/route.ts` |
| `/api/auditoria/registrar` | POST  | `src/app/api/auditoria/registrar/route.ts` |
| `/api/ayuda-bot` | POST  | `src/app/api/ayuda-bot/route.ts` |
| `/api/calendar/calendars` | GET  | `src/app/api/calendar/calendars/route.ts` |
| `/api/calendar/callback` | GET  | `src/app/api/calendar/callback/route.ts` |
| `/api/calendar/connect` | GET  | `src/app/api/calendar/connect/route.ts` |
| `/api/calendar/ocupado` | GET  | `src/app/api/calendar/ocupado/route.ts` |
| `/api/calendar/status` | GET DELETE  | `src/app/api/calendar/status/route.ts` |
| `/api/calendar/sync` | POST  | `src/app/api/calendar/sync/route.ts` |
| `/api/clinic/ai-keys` | GET POST  | `src/app/api/clinic/ai-keys/route.ts` |
| `/api/clinic/crear` | POST  | `src/app/api/clinic/crear/route.ts` |
| `/api/clinic/exportar-csv` | GET  | `src/app/api/clinic/exportar-csv/route.ts` |
| `/api/clinic/exportar-excel` | GET  | `src/app/api/clinic/exportar-excel/route.ts` |
| `/api/clinic/exportar` | GET  | `src/app/api/clinic/exportar/route.ts` |
| `/api/clinic/importar` | POST  | `src/app/api/clinic/importar/route.ts` |
| `/api/clinic/miembros` | GET  | `src/app/api/clinic/miembros/route.ts` |
| `/api/clinic/unirse` | POST  | `src/app/api/clinic/unirse/route.ts` |
| `/api/clinic/whatsapp-disconnect` | POST  | `src/app/api/clinic/whatsapp-disconnect/route.ts` |
| `/api/config/imagen` | POST  | `src/app/api/config/imagen/route.ts` |
| `/api/consultor-evidencia` | POST  | `src/app/api/consultor-evidencia/route.ts` |
| `/api/cron/asientos` | GET  | `src/app/api/cron/asientos/route.ts` |
| `/api/cron/limpiar-audio` | GET  | `src/app/api/cron/limpiar-audio/route.ts` |
| `/api/cron/reminders` | GET  | `src/app/api/cron/reminders/route.ts` |
| `/api/cron/retencion` | GET  | `src/app/api/cron/retencion/route.ts` |
| `/api/cron/vigilante` | GET  | `src/app/api/cron/vigilante/route.ts` |
| `/api/csp-report` | POST  | `src/app/api/csp-report/route.ts` |
| `/api/cumplimiento/bitacora` | GET  | `src/app/api/cumplimiento/bitacora/route.ts` |
| `/api/demo/evidencia` | GET  | `src/app/api/demo/evidencia/route.ts` |
| `/api/errores` | POST GET PATCH  | `src/app/api/errores/route.ts` |
| `/api/expediente/antibiograma-razonar` | POST  | `src/app/api/expediente/antibiograma-razonar/route.ts` |
| `/api/expediente/antibiograma-vision` | POST  | `src/app/api/expediente/antibiograma-vision/route.ts` |
| `/api/expediente/atribuir-roles` | POST  | `src/app/api/expediente/atribuir-roles/route.ts` |
| `/api/expediente/corregir` | POST  | `src/app/api/expediente/corregir/route.ts` |
| `/api/expediente/evidencia` | POST  | `src/app/api/expediente/evidencia/route.ts` |
| `/api/expediente/exportar/[patientId]` | GET  | `src/app/api/expediente/exportar/[patientId]/route.ts` |
| `/api/expediente/extraer-entidades` | POST  | `src/app/api/expediente/extraer-entidades/route.ts` |
| `/api/expediente/laboratorio-vision` | POST  | `src/app/api/expediente/laboratorio-vision/route.ts` |
| `/api/expediente/paquete-de-visita` | POST  | `src/app/api/expediente/paquete-de-visita/route.ts` |
| `/api/expediente/pregunta-atendida` | POST  | `src/app/api/expediente/pregunta-atendida/route.ts` |
| `/api/expediente/procesar` | POST  | `src/app/api/expediente/procesar/route.ts` |
| `/api/expediente/transcribir-chunk` | POST  | `src/app/api/expediente/transcribir-chunk/route.ts` |
| `/api/expediente/transcribir-diarizado` | POST GET  | `src/app/api/expediente/transcribir-diarizado/route.ts` |
| `/api/expediente/transcribir` | POST  | `src/app/api/expediente/transcribir/route.ts` |
| `/api/expediente/verificar-nota` | POST  | `src/app/api/expediente/verificar-nota/route.ts` |
| `/api/facturacion/descargar` | GET  | `src/app/api/facturacion/descargar/route.ts` |
| `/api/facturacion/pagos` | GET  | `src/app/api/facturacion/pagos/route.ts` |
| `/api/facturacion/solicitar` | POST  | `src/app/api/facturacion/solicitar/route.ts` |
| `/api/fhir/paciente/[patientId]` | GET  | `src/app/api/fhir/paciente/[patientId]/route.ts` |
| `/api/health` | GET  | `src/app/api/health/route.ts` |
| `/api/hl7/convertir` | POST  | `src/app/api/hl7/convertir/route.ts` |
| `/api/hospital/alerta` | POST  | `src/app/api/hospital/alerta/route.ts` |
| `/api/hospital/mutar` | POST  | `src/app/api/hospital/mutar/route.ts` |
| `/api/inmuno/redactar` | POST  | `src/app/api/inmuno/redactar/route.ts` |
| `/api/mantenimiento/backfill-contadores` | POST  | `src/app/api/mantenimiento/backfill-contadores/route.ts` |
| `/api/payment/create-checkout` | POST  | `src/app/api/payment/create-checkout/route.ts` |
| `/api/planes` | GET  | `src/app/api/planes/route.ts` |
| `/api/portal/link` | POST  | `src/app/api/portal/link/route.ts` |
| `/api/portal` | POST  | `src/app/api/portal/route.ts` |
| `/api/public/availability/[clinicId]` | GET  | `src/app/api/public/availability/[clinicId]/route.ts` |
| `/api/public/booking` | POST  | `src/app/api/public/booking/route.ts` |
| `/api/public/clinic/[clinicId]` | GET  | `src/app/api/public/clinic/[clinicId]/route.ts` |
| `/api/public/resena` | POST  | `src/app/api/public/resena/route.ts` |
| `/api/receta/detectar-campos` | POST  | `src/app/api/receta/detectar-campos/route.ts` |
| `/api/receta/diseno-url` | POST  | `src/app/api/receta/diseno-url/route.ts` |
| `/api/receta/diseno` | GET  | `src/app/api/receta/diseno/route.ts` |
| `/api/receta/verificacion-url` | POST  | `src/app/api/receta/verificacion-url/route.ts` |
| `/api/seguridad/csp-estado` | GET  | `src/app/api/seguridad/csp-estado/route.ts` |
| `/api/soporte` | POST GET PATCH  | `src/app/api/soporte/route.ts` |
| `/api/stripe/asientos` | GET POST  | `src/app/api/stripe/asientos/route.ts` |
| `/api/stripe/checkout` | POST  | `src/app/api/stripe/checkout/route.ts` |
| `/api/stripe/portal` | POST  | `src/app/api/stripe/portal/route.ts` |
| `/api/stripe/recarga` | POST  | `src/app/api/stripe/recarga/route.ts` |
| `/api/stripe/webhook` | POST  | `src/app/api/stripe/webhook/route.ts` |
| `/api/superadmin/accion` | POST  | `src/app/api/superadmin/accion/route.ts` |
| `/api/superadmin/clientes` | GET  | `src/app/api/superadmin/clientes/route.ts` |
| `/api/superadmin/contabilidad` | GET  | `src/app/api/superadmin/contabilidad/route.ts` |
| `/api/superadmin/costos` | GET POST  | `src/app/api/superadmin/costos/route.ts` |
| `/api/superadmin/csp` | GET  | `src/app/api/superadmin/csp/route.ts` |
| `/api/superadmin/incidentes` | GET  | `src/app/api/superadmin/incidentes/route.ts` |
| `/api/superadmin/onboarding` | GET  | `src/app/api/superadmin/onboarding/route.ts` |
| `/api/superadmin/paquetes` | GET POST  | `src/app/api/superadmin/paquetes/route.ts` |
| `/api/superadmin/planes` | GET PUT  | `src/app/api/superadmin/planes/route.ts` |
| `/api/superadmin/simulador` | GET PUT  | `src/app/api/superadmin/simulador/route.ts` |
| `/api/telesalud/sala` | POST  | `src/app/api/telesalud/sala/route.ts` |
| `/api/telesalud/token` | POST  | `src/app/api/telesalud/token/route.ts` |
| `/api/uci/copilot` | POST  | `src/app/api/uci/copilot/route.ts` |
| `/api/uci/estancia` | GET POST  | `src/app/api/uci/estancia/route.ts` |
| `/api/voz/comandos-config` | GET POST  | `src/app/api/voz/comandos-config/route.ts` |
| `/api/whatsapp/360dialog-callback` | GET  | `src/app/api/whatsapp/360dialog-callback/route.ts` |
| `/api/whatsapp/360dialog-connect` | POST  | `src/app/api/whatsapp/360dialog-connect/route.ts` |
| `/api/whatsapp/360dialog-webhook` | POST GET  | `src/app/api/whatsapp/360dialog-webhook/route.ts` |
| `/api/whatsapp/entregas` | GET  | `src/app/api/whatsapp/entregas/route.ts` |
| `/api/whatsapp/manual-connect` | POST  | `src/app/api/whatsapp/manual-connect/route.ts` |
| `/api/whatsapp/meta-connect` | POST  | `src/app/api/whatsapp/meta-connect/route.ts` |
| `/api/whatsapp/plantillas-config` | GET POST  | `src/app/api/whatsapp/plantillas-config/route.ts` |
| `/api/whatsapp/waitlist-notify` | POST  | `src/app/api/whatsapp/waitlist-notify/route.ts` |
| `/api/whatsapp/webhook` | GET POST  | `src/app/api/whatsapp/webhook/route.ts` |

## Pantallas de trabajo (dashboard)

| Ruta | Archivo | Líneas |
|---|---|---|
| `/antibiograma` | `src/app/(dashboard)/antibiograma/page.tsx` | 900 |
| `/asistente` | `src/app/(dashboard)/asistente/page.tsx` | 862 |
| `/calendario` | `src/app/(dashboard)/calendario/page.tsx` | 918 |
| `/chat` | `src/app/(dashboard)/chat/page.tsx` | 363 |
| `/citas` | `src/app/(dashboard)/citas/page.tsx` | 1276 |
| `/configuracion` | `src/app/(dashboard)/configuracion/page.tsx` | 2684 |
| `/consulta/[patientId]` | `src/app/(dashboard)/consulta/[patientId]/page.tsx` | 7567 |
| `/consultor` | `src/app/(dashboard)/consultor/page.tsx` | 354 |
| `/corte-caja` | `src/app/(dashboard)/corte-caja/page.tsx` | 341 |
| `/crm` | `src/app/(dashboard)/crm/page.tsx` | 278 |
| `/cumplimiento/motores` | `src/app/(dashboard)/cumplimiento/motores/page.tsx` | 205 |
| `/cumplimiento` | `src/app/(dashboard)/cumplimiento/page.tsx` | 1040 |
| `/cumplimiento/retencion` | `src/app/(dashboard)/cumplimiento/retencion/page.tsx` | 353 |
| `/cumplimiento/seguridad` | `src/app/(dashboard)/cumplimiento/seguridad/page.tsx` | 315 |
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | 383 |
| `/expediente/[patientId]` | `src/app/(dashboard)/expediente/[patientId]/page.tsx` | 1149 |
| `/expedientes` | `src/app/(dashboard)/expedientes/page.tsx` | 17 |
| `/farmacia` | `src/app/(dashboard)/farmacia/page.tsx` | 821 |
| `/finanzas` | `src/app/(dashboard)/finanzas/page.tsx` | 757 |
| `/guia` | `src/app/(dashboard)/guia/page.tsx` | 140 |
| `/hospitalizacion/[internamientoId]` | `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx` | 1732 |
| `/hospitalizacion/camas` | `src/app/(dashboard)/hospitalizacion/camas/page.tsx` | 238 |
| `/hospitalizacion/indicadores` | `src/app/(dashboard)/hospitalizacion/indicadores/page.tsx` | 101 |
| `/hospitalizacion` | `src/app/(dashboard)/hospitalizacion/page.tsx` | 452 |
| `/hospitalizacion/unidades` | `src/app/(dashboard)/hospitalizacion/unidades/page.tsx` | 170 |
| `/legal` | `src/app/(dashboard)/legal/page.tsx` | 112 |
| `/lista-espera` | `src/app/(dashboard)/lista-espera/page.tsx` | 308 |
| `/membresias` | `src/app/(dashboard)/membresias/page.tsx` | 324 |
| `/migracion` | `src/app/(dashboard)/migracion/page.tsx` | 416 |
| `/motores` | `src/app/(dashboard)/motores/page.tsx` | 207 |
| `/nota/[patientId]/[notaId]` | `src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx` | 1019 |
| `/nota/[patientId]` | `src/app/(dashboard)/nota/[patientId]/page.tsx` | 81 |
| `/operaciones` | `src/app/(dashboard)/operaciones/page.tsx` | 535 |
| `/orden/[patientId]/[notaId]` | `src/app/(dashboard)/orden/[patientId]/[notaId]/page.tsx` | 862 |
| `/pacientes` | `src/app/(dashboard)/pacientes/page.tsx` | 1239 |
| `/pendientes` | `src/app/(dashboard)/pendientes/page.tsx` | 790 |
| `/reactivacion` | `src/app/(dashboard)/reactivacion/page.tsx` | 364 |
| `/receta/[patientId]/[notaId]` | `src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx` | 1170 |
| `/referencia/[patientId]` | `src/app/(dashboard)/referencia/[patientId]/page.tsx` | 296 |
| `/resenas` | `src/app/(dashboard)/resenas/page.tsx` | 104 |
| `/uci/antimicrobianos` | `src/app/(dashboard)/uci/antimicrobianos/page.tsx` | 682 |
| `/uci/benchmark` | `src/app/(dashboard)/uci/benchmark/page.tsx` | 264 |
| `/uci/dosificacion` | `src/app/(dashboard)/uci/dosificacion/page.tsx` | 584 |
| `/uci/enfermeria` | `src/app/(dashboard)/uci/enfermeria/page.tsx` | 205 |
| `/uci` | `src/app/(dashboard)/uci/page.tsx` | 1935 |

## Pantallas públicas y otras

| Ruta | Archivo | Líneas |
|---|---|---|
| `/arquitectura` | `src/app/arquitectura/page.tsx` | 130 |
| `/contacto` | `src/app/contacto/page.tsx` | 82 |
| `/demo/interactivo` | `src/app/demo/interactivo/page.tsx` | 771 |
| `/demo` | `src/app/demo/page.tsx` | 509 |
| `/demo/razonamiento` | `src/app/demo/razonamiento/page.tsx` | 157 |
| `/dr/[clinicId]` | `src/app/dr/[clinicId]/page.tsx` | 258 |
| `/evidencia` | `src/app/evidencia/page.tsx` | 93 |
| `/login` | `src/app/login/page.tsx` | 390 |
| `/mi/[token]` | `src/app/mi/[token]/page.tsx` | 1292 |
| `/operacion` | `src/app/operacion/page.tsx` | 116 |
| `/` | `src/app/page.tsx` | 412 |
| `/pago/cancelado` | `src/app/pago/cancelado/page.tsx` | 18 |
| `/pago/exito` | `src/app/pago/exito/page.tsx` | 31 |
| `/paquetes` | `src/app/paquetes/page.tsx` | 110 |
| `/precios` | `src/app/precios/page.tsx` | 204 |
| `/privacidad/[clinicId]` | `src/app/privacidad/[clinicId]/page.tsx` | 287 |
| `/privacidad` | `src/app/privacidad/page.tsx` | 171 |
| `/registro` | `src/app/registro/page.tsx` | 395 |
| `/resena/[token]` | `src/app/resena/[token]/page.tsx` | 138 |
| `/reservar/[clinicId]` | `src/app/reservar/[clinicId]/page.tsx` | 439 |
| `/seguridad` | `src/app/seguridad/page.tsx` | 174 |
| `/setup` | `src/app/setup/page.tsx` | 270 |
| `/superadmin/contabilidad` | `src/app/superadmin/contabilidad/page.tsx` | 291 |
| `/superadmin/costos` | `src/app/superadmin/costos/page.tsx` | 519 |
| `/superadmin/csp` | `src/app/superadmin/csp/page.tsx` | 177 |
| `/superadmin/errores` | `src/app/superadmin/errores/page.tsx` | 84 |
| `/superadmin/onboarding` | `src/app/superadmin/onboarding/page.tsx` | 162 |
| `/superadmin` | `src/app/superadmin/page.tsx` | 689 |
| `/superadmin/planes` | `src/app/superadmin/planes/page.tsx` | 227 |
| `/superadmin/simulador` | `src/app/superadmin/simulador/page.tsx` | 202 |
| `/superadmin/soporte` | `src/app/superadmin/soporte/page.tsx` | 95 |
| `/teleconsulta/[citaId]` | `src/app/teleconsulta/[citaId]/page.tsx` | 111 |
| `/terminos` | `src/app/terminos/page.tsx` | 177 |
| `/unirse/[code]` | `src/app/unirse/[code]/page.tsx` | 183 |
| `/verificar/[token]` | `src/app/verificar/[token]/page.tsx` | 102 |

## Módulos de biblioteca (src/lib, primer nivel)

| Módulo | Archivos | Líneas |
|---|---|---|
| `agenda` | 9 | 1154 |
| `ai-keys.ts` | 1 | 525 |
| `antimicrobianos` | 8 | 1586 |
| `arco` | 2 | 296 |
| `arco.ts` | 1 | 155 |
| `arquitectura` | 1 | 357 |
| `asr` | 19 | 4178 |
| `auth` | 1 | 67 |
| `auth-client.ts` | 1 | 124 |
| `auth-server.ts` | 1 | 192 |
| `authz` | 7 | 1960 |
| `availability.ts` | 1 | 344 |
| `avatar-color.ts` | 1 | 17 |
| `aviso-privacidad.ts` | 1 | 138 |
| `ayuda` | 1 | 332 |
| `branches.ts` | 1 | 42 |
| `calendario` | 6 | 630 |
| `calidad` | 1 | 1570 |
| `chat.ts` | 1 | 110 |
| `cie10.ts` | 1 | 296 |
| `clinica` | 6 | 1032 |
| `clinical` | 7 | 3315 |
| `clinical-fact` | 2 | 812 |
| `clinical-reasoning` | 2 | 642 |
| `clinical-truth` | 1 | 101 |
| `cobros.ts` | 1 | 689 |
| `comisiones.ts` | 1 | 172 |
| `compliance` | 2 | 477 |
| `contacto.ts` | 1 | 64 |
| `contrato-encargo.ts` | 1 | 99 |
| `corte-caja.ts` | 1 | 247 |
| `csv-pacientes.ts` | 1 | 191 |
| `csv-seguro.ts` | 1 | 32 |
| `curp.ts` | 1 | 51 |
| `demo-sandbox.ts` | 1 | 118 |
| `dispositivos` | 1 | 185 |
| `dosing` | 6 | 838 |
| `durability` | 19 | 4907 |
| `encuentro` | 1 | 106 |
| `especialidades.ts` | 1 | 108 |
| `evidence-integrations` | 12 | 3158 |
| `evidencia` | 15 | 3335 |
| `expediente` | 127 | 35066 |
| `facturama.ts` | 1 | 139 |
| `farmacia.ts` | 1 | 209 |
| `fecha-local.ts` | 1 | 116 |
| `fetch-con-timeout.ts` | 1 | 144 |
| `fhir` | 2 | 278 |
| `fhir-export.ts` | 1 | 552 |
| `finanzas` | 27 | 3716 |
| `firebase-admin.ts` | 1 | 30 |
| `firebase.ts` | 1 | 161 |
| `firestore` | 1 | 109 |
| `firestore.ts` | 1 | 902 |
| `firma-protegida.ts` | 1 | 104 |
| `formato` | 1 | 68 |
| `google-calendar.ts` | 1 | 216 |
| `guardia` | 1 | 221 |
| `herramientas-por-especialidad.ts` | 1 | 168 |
| `hl7` | 1 | 142 |
| `horario-medico.ts` | 1 | 69 |
| `hospital` | 20 | 3724 |
| `hoy` | 2 | 104 |
| `i18n.ts` | 1 | 110 |
| `ia` | 13 | 2406 |
| `idempotencia.ts` | 1 | 131 |
| `image-utils.ts` | 1 | 152 |
| `impreso-medico.ts` | 1 | 110 |
| `inmuno` | 6 | 833 |
| `invitations.ts` | 1 | 122 |
| `landing-evidencia.ts` | 1 | 56 |
| `learning.ts` | 1 | 137 |
| `legal` | 1 | 209 |
| `marca.ts` | 1 | 116 |
| `markdown.ts` | 1 | 30 |
| `membresias.ts` | 1 | 206 |
| `memoria-medico.ts` | 1 | 80 |
| `metricas` | 1 | 37 |
| `mfa.ts` | 1 | 86 |
| `miembros.ts` | 1 | 45 |
| `mobile` | 3 | 366 |
| `modulos.ts` | 1 | 188 |
| `nav` | 3 | 286 |
| `navegacion` | 2 | 178 |
| `ndjson.ts` | 1 | 90 |
| `no-show-risk.ts` | 1 | 103 |
| `nombre-medico.ts` | 1 | 54 |
| `nota-word.ts` | 1 | 126 |
| `observabilidad` | 2 | 231 |
| `onboarding` | 1 | 178 |
| `operaciones` | 1 | 226 |
| `ops` | 6 | 738 |
| `paciente` | 6 | 1448 |
| `pacientes` | 5 | 1159 |
| `patient-token.ts` | 1 | 172 |
| `pdf-download.ts` | 1 | 242 |
| `pdf-to-image.ts` | 1 | 158 |
| `permissions.ts` | 1 | 118 |
| `planes-ia.ts` | 1 | 446 |
| `portal` | 4 | 372 |
| `pricing.ts` | 1 | 63 |
| `print-element.ts` | 1 | 246 |
| `programa` | 1 | 830 |
| `push-notifications.ts` | 1 | 99 |
| `rate-limit.ts` | 1 | 113 |
| `reactivacion.ts` | 1 | 243 |
| `receta-certificado.ts` | 1 | 94 |
| `receta-diseno-client.ts` | 1 | 156 |
| `receta-diseno-token.ts` | 1 | 213 |
| `receta-folio.ts` | 1 | 26 |
| `receta-paginacion.ts` | 1 | 314 |
| `receta-template.ts` | 1 | 153 |
| `receta-token.ts` | 1 | 95 |
| `receta-word.ts` | 1 | 246 |
| `red` | 1 | 218 |
| `reportar-error.ts` | 1 | 63 |
| `retencion.ts` | 1 | 142 |
| `reviews.ts` | 1 | 161 |
| `salir-seguro.ts` | 1 | 217 |
| `security` | 4 | 666 |
| `seguridad` | 12 | 2214 |
| `specialty-packages.ts` | 1 | 119 |
| `stripe.ts` | 1 | 97 |
| `subir-imagen.ts` | 1 | 45 |
| `superadmin-client.ts` | 1 | 14 |
| `superadmin.ts` | 1 | 151 |
| `tareas-clinicas` | 11 | 2480 |
| `telesalud` | 2 | 258 |
| `tema.ts` | 1 | 82 |
| `texto-es.ts` | 1 | 35 |
| `time-blocks-core.ts` | 1 | 136 |
| `time-blocks.ts` | 1 | 45 |
| `timezone.ts` | 1 | 227 |
| `uci` | 46 | 9177 |
| `ui` | 7 | 1013 |
| `voice-engine` | 2 | 467 |
| `voz` | 2 | 196 |
| `whatsapp` | 31 | 2909 |
| `whatsapp-send.ts` | 1 | 371 |
| `whatsapp.ts` | 1 | 138 |
| `word-membrete.ts` | 1 | 58 |
| `workflow.ts` | 1 | 91 |
| `xlsx.ts` | 1 | 324 |
| `zona-horaria-mx.ts` | 1 | 98 |

## Colecciones en firestore.rules

adendas alertas_no_entregadas antimicrobial_limits appointments arco_requests asr_aprendizaje audit_
log bed_assignments bot_sessions branches camas chat chat_reads clinic_invitations clinic_members cl
inic_review_requests clinico clinics cobros config databases doctors dosing_validations farmacia far
macia_movimientos formularios_previos fotos googleTokens handoff_revisiones hospital_alertas hospita
l_roles icu_observations icu_stays internamientos laboratorio laboratorios learning members membersh
ip_plans memberships memoria_medico notas notification_logs paquetes_visita patients platform_admin_
log platform_cost_ledger platform_meta platform_packages platform_payments preguntas_paciente regist
ros reviews secretos signos slot_locks tareas_clinicas time_blocks uci_copilot_feedback unidades ver
sions waitlist whatsapp_contacts whatsapp_events whatsapp_no_entregados whatsapp_optout whatsapp_out
box whatsapp_status 

## Componentes (src/components)

- `src/components/AlertasDelEpisodio.tsx`
- `src/components/AlertasDictado.tsx`
- `src/components/AntesDeFirmar.tsx`
- `src/components/AppointmentModal.tsx`
- `src/components/AsientosSection.tsx`
- `src/components/AsistenteChat.tsx`
- `src/components/AutoLogout.tsx`
- `src/components/AvisoConfigNoCargada.tsx`
- `src/components/AvisoCorreoSinVerificar.tsx`
- `src/components/AvisoIncidenteIA.tsx`
- `src/components/AvisoModuloBloqueado.tsx`
- `src/components/AvisoPrivacidadModal.tsx`
- `src/components/BotonAyuda.tsx`
- `src/components/BottomNav.tsx`
- `src/components/CabosSueltosDelPaciente.tsx`
- `src/components/CalculadorasClinicas.tsx`
- `src/components/CambiosCifrasPanel.tsx`
- `src/components/Cie10Autocomplete.tsx`
- `src/components/CierreAlPulgar.tsx`
- `src/components/CobrarModal.tsx`
- `src/components/ComoCerrarLaConsulta.tsx`
- `src/components/ContinuidadPanel.tsx`
- `src/components/Copiloto.tsx`
- `src/components/CorreccionesPanel.tsx`
- `src/components/DeDondeSalioEsto.tsx`
- `src/components/DemoWorkflow.tsx`
- `src/components/DoctorFilter.tsx`
- `src/components/DoctorOnboarding.tsx`
- `src/components/EmpezarAGrabar.tsx`
- `src/components/EntregarAlPaciente.tsx`
- `src/components/EscucharElMomento.tsx`
- `src/components/EvidenciaEnVivo.tsx`
- `src/components/FacturacionSection.tsx`
- `src/components/FirmadorDisenos.tsx`
- `src/components/FlowRail.tsx`
- `src/components/FotosClinicas.tsx`
- `src/components/GuiaConfigurarReceta.tsx`
- `src/components/Herramientas.tsx`
- `src/components/HistorialVersiones.tsx`
- `src/components/HojaParaElPaciente.tsx`
- `src/components/InstrumentStrip.tsx`
- `src/components/InternamientosDelPaciente.tsx`
- `src/components/LenteContextual.tsx`
- `src/components/MarcaAusculta.tsx`
- `src/components/MarcoEscuchando.tsx`
- `src/components/MetaPixel.tsx`
- `src/components/MientrasHablas.tsx`
- `src/components/MiniMarkdown.tsx`
- `src/components/MobileBackButton.tsx`
- `src/components/NerPanel.tsx`
- `src/components/NotificacionesPushOptIn.tsx`
- `src/components/OfflineBanner.tsx`
- `src/components/OnboardingTour.tsx`
- `src/components/PaletteBusqueda.tsx`
- `src/components/PanelCardiometabolico.tsx`
- `src/components/PanelCirugia.tsx`
- `src/components/PanelComisiones.tsx`
- `src/components/PanelGineco.tsx`
- `src/components/PanelPediatria.tsx`
- `src/components/PanelPendientes.tsx`
- `src/components/PanelPreventivo.tsx`
- `src/components/PanelRazonamiento.tsx`
- `src/components/PlanPorProblema.tsx`
- `src/components/PreopAssessment.tsx`
- `src/components/QueNotaEs.tsx`
- `src/components/RastreoErrores.tsx`
- `src/components/RecetaDocumento.tsx`
- `src/components/RecetaPreviewWrapper.tsx`
- `src/components/RevisionPanel.tsx`
- `src/components/SelloMotor.tsx`
- `src/components/SelloProcedencia.tsx`
- `src/components/ServiceWorkerRegister.tsx`
- `src/components/Sidebar.tsx`
- `src/components/SoporteSection.tsx`
- `src/components/StatusBadge.tsx`
- `src/components/TablaNivelesIA.tsx`
- `src/components/ThemeToggle.tsx`
- `src/components/TipoCitaIcon.tsx`
- `src/components/TituloDeDocumentoClinico.tsx`
- `src/components/brand/EmptyArt.tsx`
- `src/components/brand/MarcaAuth.tsx`
- `src/components/expediente/ClinicalSpine.tsx`
- `src/components/expediente/HistorialVersiones.tsx`
- `src/components/expediente/PatientAnchor.tsx`
- `src/components/expediente/ProcedenciaDeLaNota.tsx`
- `src/components/expediente/ResumenPaciente.tsx`
- `src/components/hospital/GraficaSignos.tsx`
- `src/components/hospital/PanelEnfermeria.tsx`
- `src/components/laboratorio/GraficaLab.tsx`
- `src/components/laboratorio/PanelLaboratorios.tsx`
- `src/components/landing/EsperaDeLaPuerta.tsx`
- `src/components/landing/HeroConsulta.tsx`
- `src/components/landing/NavPublica.tsx`
- `src/components/landing/Revelar.tsx`
- `src/components/lente/VolverALaFuente.tsx`
- `src/components/motores/QueDiceElMotor.tsx`
- `src/components/operaciones/EstadoDeOperaciones.tsx`
- `src/components/pacientes/ValoracionInmuno.tsx`
- `src/components/portal/ViaDeUrgencia.tsx`
- `src/components/tareas/PorQueEstaAqui.tsx`
- `src/components/tareas/ProgresoResultado.tsx`
- `src/components/ui/Alert.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/Field.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/PageHeader.tsx`
- `src/components/ui/Skeleton.tsx`
- `src/components/ui/Spinner.tsx`
- `src/components/ui/Table.tsx`
- `src/components/ui/Tabs.tsx`
- `src/components/ui/index.ts`

## Hooks

- `src/hooks/useAhoraMinutos.ts`
- `src/hooks/useAppointments.ts`
- `src/hooks/useAuth.ts`
- `src/hooks/useAvisoAlSalirGrabando.ts`
- `src/hooks/useBusquedaDePacientes.ts`
- `src/hooks/useComandoVoz.ts`
- `src/hooks/useConfig.ts`
- `src/hooks/useDialogoDeTeclado.ts`
- `src/hooks/useDoctors.ts`
- `src/hooks/useEncuentroAbierto.ts`
- `src/hooks/useExpediente.ts`
- `src/hooks/useFirmaProtegida.ts`
- `src/hooks/useGrabacionAudio.ts`
- `src/hooks/useGrabacionVoz.ts`
- `src/hooks/useGrabando.ts`
- `src/hooks/useNotificacionesCitas.ts`
- `src/hooks/usePacientesPorId.ts`
- `src/hooks/usePorcupineComando.ts`
- `src/hooks/useSmartBack.ts`
- `src/hooks/useTema.ts`

## Archivos con prompts del modelo de lenguaje (heurística: 'system' + 'prompt')

- `src/app/api/expediente/antibiograma-razonar/route.ts`
- `src/app/api/expediente/antibiograma-vision/route.ts`
- `src/app/api/expediente/corregir/route.ts`
- `src/app/api/expediente/extraer-entidades/route.ts`
- `src/app/api/expediente/procesar/route.ts`
- `src/lib/agenda/prompts.ts`
- `src/lib/expediente/antibiograma/index.ts`
- `src/lib/expediente/antibiograma/vision.ts`
- `src/lib/expediente/medical-ner.ts`
- `src/lib/ia/protocolo.ts`
- `src/lib/programa/requisitos.ts`
