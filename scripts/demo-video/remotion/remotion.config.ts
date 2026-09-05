import { Config } from '@remotion/cli/config'

// El contenedor no puede descargar el Chromium de Remotion (remotion.media está
// fuera de la lista blanca): se usa el headless shell que ya trae Playwright.
Config.setBrowserExecutable(process.env.REMOTION_CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell')
Config.setChromiumIgnoreCertificateErrors(true)
Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(92)
Config.setConcurrency(4)
Config.setOverwriteOutput(true)
