# NexusMED — App nativa (App Store + Google Play) con Capacitor

La PWA ya está lista (manifest, íconos, service worker). Capacitor la envuelve en
una app nativa iOS + Android que carga la versión desplegada en Vercel y añade
**cámara nativa** (fotos de antibiograma), **push** y contenedor nativo.

> Estos comandos se corren **en tu Mac** (con Xcode y Android Studio instalados,
> que traen CocoaPods, Java y el Android SDK). El entorno de CI/servidor no los
> tiene y no hacen falta ahí.

## Requisitos una sola vez
- **Xcode** (App Store del Mac) + Command Line Tools: `xcode-select --install`
- **CocoaPods**: `sudo gem install cocoapods`
- **Android Studio** (incluye JDK + Android SDK). Abrirlo una vez para que baje el SDK.
- Cuenta **Apple Developer** ($99 USD/año) y **Google Play Console** ($25 USD única vez).

## Generar los proyectos nativos (una vez)
```bash
cd ~/Desktop/agenda-medica
npm install
npm run cap:add:ios
npm run cap:add:android
```
Esto crea las carpetas `ios/` y `android/`. Commítalas.

## Íconos y splash
Necesitas un ícono maestro **1024×1024 px** (PNG opaco) y un splash **2732×2732**.
Colócalos en `resources/icon.png` y `resources/splash.png`, luego:
```bash
npm run cap:assets
```
(genera todos los tamaños para iOS y Android automáticamente).

## Cada vez que cambie la config nativa
```bash
npm run cap:sync
```
(La app carga la web desde Vercel vía `server.url` en `capacitor.config.ts`, así
que los cambios de la app web NO requieren re-compilar la nativa — salen solos al
desplegar a Vercel. Solo re-compilas para cambios nativos, íconos o plugins.)

## Abrir para compilar/subir
```bash
npm run cap:open:ios       # abre Xcode
npm run cap:open:android   # abre Android Studio
```

### iOS (Xcode)
1. Selecciona el equipo (tu Apple Developer) en *Signing & Capabilities*.
2. Bundle id: `mx.nexusmed.app`.
3. Product → Archive → Distribute App → App Store Connect.

### Android (Android Studio)
1. Build → Generate Signed Bundle/APK → **Android App Bundle (.aab)**.
2. Crea/usa tu keystore (guárdalo a salvo; sin él no puedes actualizar).
3. Sube el `.aab` a Play Console.

## Cámara nativa (recomendado para revisión de Apple)
`@capacitor/camera` ya está instalado. Para que la foto del antibiograma use la
cámara nativa cuando corre dentro de la app (y `<input type=file>` en web):
```ts
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType } from '@capacitor/camera'

export async function tomarFotoAntibiograma(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null // en web usa el input normal
  const foto = await Camera.getPhoto({ quality: 90, resultType: CameraResultType.DataUrl })
  return foto.dataUrl ?? null
}
```
Tener una función nativa real ayuda a que Apple no lo trate como "solo un sitio web".

## Notas de revisión (medical)
- Declarar que es **apoyo decisional**, no diagnóstico autónomo (ya está en la UI).
- Tener a la mano el **Aviso de Privacidad** (URL pública) para el formulario.
- Data Safety (Google) / App Privacy (Apple): datos de salud, cifrados en tránsito y reposo.
- Cuenta de demo para el revisor (usuario/contraseña de prueba).
