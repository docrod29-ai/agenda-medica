# Mobile — Matriz de dispositivos y condiciones (baseline)

Estado de cobertura de pruebas al cierre de la Iteración 1. **Verificado** = observado esta sesión; **Pendiente** = requiere dispositivo físico o sesión autenticada (no disponible en este entorno). No se marca "verificado" nada que no se haya observado realmente.

## Dispositivos

| Clase | Dispositivo/representante | Navegador | Público (375–430px) | Dashboard autenticado | PWA instalada |
|---|---|---|---|---|---|
| iPhone chico | 375×667 (SE) | Safari | Verificado (emulado 375) | Pendiente | Pendiente |
| iPhone medio | 390×844 (13/14/15) | Safari | Parcial (emulado) | Pendiente | Pendiente |
| iPhone grande | 430×932 (Pro Max) | Safari | Pendiente | Pendiente | Pendiente |
| Android gama baja | ~360×640, CPU lenta | Chrome | Pendiente | Pendiente | Pendiente |
| Android gama media | 393×873 (Pixel) | Chrome | Pendiente | Pendiente | Pendiente |
| Android grande | 412×915 | Chrome | Pendiente | Pendiente | Pendiente |
| iPad vertical | 768×1024 | Safari | Pendiente | Pendiente | Pendiente |
| iPad horizontal | 1024×768 | Safari | Pendiente | Pendiente | Pendiente |
| Android tablet | 800×1280 | Chrome | Pendiente | Pendiente | Pendiente |
| Escritorio (control) | 1280×800 | Chrome | Verificado (no regresión) | Pendiente | — |

> "Emulado 375" = viewport móvil del navegador de vista previa, no hardware real. Sirve para overflow/layout, **no** para teclado, notch, rendimiento real ni gestos.

## Condiciones

| Condición | Estado | Cómo se medirá |
|---|---|---|
| Red rápida | Pendiente | DevTools throttling / dispositivo |
| 4G | Pendiente | Throttling "Fast/Slow 4G" |
| Red lenta / latencia alta | Pendiente | Throttling + WebPageTest |
| Conexión intermitente | Pendiente | Offline toggle intercalado |
| Sin conexión | Pendiente | DevTools offline + PWA |
| Ahorro de batería | Pendiente | Dispositivo real |
| Texto aumentado | Pendiente | iOS Dynamic Type / Android font size |
| Modo oscuro | Parcial | Verificado en público; falta dashboard |
| Teclado abierto | Pendiente | Dispositivo real (campo activo visible) |
| Notch / Dynamic Island | Pendiente | iPhone con notch |
| Rotación | Pendiente | Dispositivo real |

## Cómo cerrar esta matriz (siguiente paso operativo)
1. **Dispositivos reales:** el Dr. abre la app en su iPhone y en un Android (idealmente uno gama baja) y recorre los flujos de `workflow-baseline.md`, anotando tiempos/toques/fricción.
2. **Emulación sistemática:** DevTools device toolbar + throttling para las condiciones de red.
3. **Lighthouse móvil** sobre la URL de producción para LCP/INP/CLS/TBT por ruta.
4. Registrar resultados aquí y en `workflow-baseline.md`.
