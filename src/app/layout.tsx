import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { MARCA, LEMA, DESCRIPCION } from "@/lib/marca"
import { GUION_TEMA } from "@/lib/tema"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"
import { ThemeToggle } from "@/components/ThemeToggle"

/**
 * ── POR QUÉ SE FUE GEIST ────────────────────────────────────────────────────
 *
 * Geist es la fuente **de fábrica de Vercel**. Venía puesta desde el primer
 * `create-next-app` y nadie la eligió: se quedó.
 *
 * Medido el 9-ago-2026 sobre las hojas de estilo reales de Suki, Abridge,
 * Nabla, Heidi y Freed: **ninguno de los cuatro buenos usa una fuente por
 * defecto**. El único que usa Inter puro es Freed, y es el más genérico de los
 * cinco. La tipografía por defecto es la señal más barata y más fiable de que
 * un producto no tuvo dirección de diseño.
 *
 * ── POR QUÉ IBM PLEX SANS, Y NO OTRA CON CARÁCTER ───────────────────────────
 *
 * No se elige por gusto. Esta pantalla es **datos clínicos densos**, y eso pone
 * cuatro requisitos que descartan casi todo:
 *
 * 1. **Cifras tabulares de verdad.** Una dosis, una hora y un resultado de
 *    laboratorio se leen en columna. Plex trae `tnum` real, no simulado.
 * 2. **Formas inconfundibles entre sí.** En una receta, confundir un `1` con
 *    una `l` o un `0` con una `O` no es un problema estético. Plex separa las
 *    cuatro; las grotescas geométricas de moda (Outfit, Figtree) no.
 * 3. **Diseñada para producto técnico**, no para portada. Nació para
 *    documentación e instrumentación: aguanta 12 px sin deshacerse.
 * 4. **Español completo.** Acentos, eñes y aperturas de interrogación con el
 *    mismo cuidado que el inglés — no como añadido.
 *
 * Y no es la fuente por defecto de nadie.
 *
 * ── LA SERIF YA ESTABA COMPRADA Y SIN GASTAR ────────────────────────────────
 *
 * Fraunces se carga desde junio y `var(--font-display)` aparecía **4 veces en
 * toda la aplicación**. Heidi —la mejor medida de las cinco— gana justamente
 * por emparejar una serif con la sans. El diferenciador estaba pagado y sin
 * usar.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
})

/**
 * FRAUNCES SE SIRVE DESDE EL REPOSITORIO, NO DESDE GOOGLE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `next/font/google` descarga los ficheros **durante el build**. La CI del
 * repositorio se cayó TRES veces (13 y 14-ago-2026) con el mismo error:
 * `module-not-found` sobre `fraunces_*.module.css`, o sea el runner sin poder
 * hablar con `fonts.gstatic.com`. Cada caída obliga a re-lanzar el job a mano;
 * el arreglo era de un clic y por eso se toleró dos veces. A la tercera, no.
 *
 * ── POR QUÉ ESTA FUENTE Y NO LAS OTRAS DOS ──────────────────────────────────
 *
 * Las tres vienen de Google, pero **sólo Fraunces ha fallado**, y es la que
 * más caro sale perder: VISUAL_DNA §1 R3 le reserva la serif al **nombre del
 * paciente en su espacio clínico**. Si el build se cae, no se despliega; si la
 * fuente no cargara en el navegador, el nombre del paciente saldría en la sans
 * y la jerarquía que distingue a este producto se apagaría.
 *
 * ── QUÉ SE VENDÓ, EXACTAMENTE ───────────────────────────────────────────────
 *
 * El MISMO fichero que servía Google: el subconjunto **latin** de Fraunces
 * v38, variable de 400 a 600 — que es justo el rango que pedía la declaración
 * anterior (`weight: ["400","500","600"]`). Ni una variante más: `subsets`
 * decía «latin», así que traerse vietnamita o latin-ext sería peso muerto.
 * La licencia (SIL Open Font License 1.1) viaja al lado, en `OFL.txt`, que es
 * lo que la propia licencia exige para redistribuir.
 *
 * Verificado en navegador tras el cambio: el nombre del paciente sigue
 * pintando Fraunces con la misma métrica.
 */
const fraunces = localFont({
  src: [{ path: "./fonts/fraunces-latin.woff2", weight: "400 600", style: "normal" }],
  variable: "--font-fraunces",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: MARCA,
    template: `%s · ${MARCA}`,
  },
  description: DESCRIPCION,
  applicationName: MARCA,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: MARCA,
  },
  icons: {
    // SVG para navegadores que lo soportan + PNG de respaldo (Safari/Android no
    // pintan bien el SVG como ícono de app instalada).
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // apple-touch DEBE ser PNG opaco: iOS no soporta SVG y con transparencia lo
    // pinta en negro → ícono en blanco al "Agregar a inicio". Ahora sale la marca.
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: MARCA,
    description: LEMA,
    type: "website",
    locale: "es_MX",
  },
}

export const viewport: Viewport = {
  themeColor: "#0B0C0E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // La supresión de aviso de hidratación en la etiqueta raíz es el par del
  // script anti-flicker de más abajo: ese script pone `data-theme` ANTES de que
  // React hidrate, así que el atributo nunca coincide con lo que rindió el
  // servidor. Alcanza SOLO los atributos de este elemento (un nivel), no a los
  // hijos — un mismatch real en el árbol sigue avisando. Sin esto, React
  // avisaba en TODAS las rutas (V10-BUG-001).
  return (
    <html lang="es" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable} ${fraunces.variable} h-full`}>
      <head>
        {/*
          Kill-switch único por versión de deploy.
          Si el usuario tiene un SW viejo cacheando HTML/JS desactualizados,
          este script lo desregistra UNA SOLA VEZ y recarga la página.
          El flag se guarda en localStorage para no entrar en bucle.
          La versión se sube cuando hay deploys que rompen compatibilidad
          de routing (rutas nuevas, layouts movidos, etc.).
        */}
        {/*
          Anti-flicker tema: aplica data-theme ANTES de la primera pintada.
          Default = OSCURO (identidad de marca Ausculta). Solo si el usuario
          eligió 'light' explícitamente se respeta el claro.
        */}
        {/* El criterio vive en `@/lib/tema`, no aquí: este guion y `useTema`
            son DOS lectores del mismo dato, y cuando cada uno tenía su tabla
            el modo automático no sobrevivía a una recarga. */}
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try{
                var KEY='__am_sw_reset_v6';
                if(localStorage.getItem(KEY)) return;
                if(!('serviceWorker' in navigator)) { localStorage.setItem(KEY,'1'); return; }
                navigator.serviceWorker.getRegistrations().then(function(rs){
                  return Promise.all(rs.map(function(r){return r.unregister()}));
                }).then(function(){
                  return ('caches' in window)
                    ? caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))})
                    : null;
                }).then(function(){
                  localStorage.setItem(KEY,'1');
                  location.reload();
                }).catch(function(){ localStorage.setItem(KEY,'1'); });
              }catch(e){}
            })();`,
          }}
        />
      </head>
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
        <ThemeToggle />
      </body>
    </html>
  )
}
