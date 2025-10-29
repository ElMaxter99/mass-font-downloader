# 🚀 Mass Font Downloader

![Node.js](https://img.shields.io/badge/Node.js-22%2B-3C873A?logo=node.js&logoColor=white)
![CLI](https://img.shields.io/badge/CLI-ready-1D3557)
![Status](https://img.shields.io/badge/status-active-success)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Descarga, renombra y organiza tipografías de Google Fonts a escala sin depender de servicios externos. Mass Font Downloader es un script/CLI en Node.js pensado para equipos de frontend que necesitan preparar sus fuentes para builds estáticos, design systems o pipelines automatizados.

## 🧩 Características

- ✅ Descarga masiva de familias, pesos y estilos directamente desde Google Fonts.
- 🧭 Renombrado consistente de archivos con patrón configurable (por defecto `<familia>-<peso>(-italic).<ext>`).
- 🎯 Nomenclatura personalizable (`Roboto-Regular.ttf`, `jetbrains-mono-700.woff2`, etc.) mediante `fileNameOptions`.
- 🗂️ Organización automática por carpetas (`output/fonts/<familia>`).
- 🧾 Generación opcional de un `font-options.ts` con metadata lista para tus componentes.
- 🛠️ Configuración flexible mediante archivo (`config/fonts.config.js`) o CLI (`bin/mass-fonts.js`).
- 🧪 Modo `--debug` para inspeccionar peticiones, variantes y errores durante la descarga.

## 🛠️ Tecnologías

Node.js · Axios · fs-extra · Commander · Google Fonts Web API

## 📦 Instalación

```bash
git clone https://github.com/tuusuario/mass-font-downloader.git
cd mass-font-downloader
npm install
```

> El proyecto está escrito en módulos ES, por lo que se recomienda Node.js 18 o superior.

## ⚡️ Uso rápido

```bash
# Ejecuta la descarga usando la configuración del repositorio
npm run download
# o
npm start
```

Los archivos se guardarán en el directorio definido en `config/fonts.config.js` (por defecto `output/fonts`). Si has habilitado `generateOptionsFile`, también se producirá `font-options.ts` con el arreglo `FONT_OPTIONS` para consumirlo en tus apps.

### Sobrescribir pesos sin tocar la configuración

Si quieres reutilizar la lista de familias del config pero descargar únicamente ciertos pesos (por ejemplo `Regular`, `SemiBold` y `Bold`), pásalos como bandera al script oficial:

```bash
# Solo Regular, SemiBold y Bold para todas las familias del config
npm run download -- --weights regular,semibold,bold

# Para forzar todas las variantes disponibles e ignorar los pesos definidos en el config
npm run download -- --all
```

La bandera `--weights` acepta valores numéricos y alias textuales (`regular`, `medium`, `semibold`, `bold`, `black`, etc.). El patrón definido en `fileNameOptions` seguirá aplicándose, por lo que obtendrás nombres como `Roboto-Regular.woff2` o `Inter-SemiBold.woff2` sin tocar el archivo de configuración.

## ⚙️ Configuración por archivo

1. Edita `config/fonts.config.js` y ajusta las propiedades:
   - `fonts`: familias a descargar. Define pesos con arrays (`weights: [400, 700]`) o usa `"all"`/`downloadAllVariants: true` para traer todas las combinaciones, incluyendo itálicas.
   - `formats`: formatos globales (entre `woff2`, `woff`, `ttf`). Cada familia puede sobrescribirlos.
   - `fileNameOptions`: personaliza la nomenclatura final (`familyCase`, `weightCase`, sufijo de itálicas, etc.). Usa `weightNaming: "text"` para transformar `400` en `Regular` y conseguir archivos como `Roboto-Regular.ttf`.
   - `subsets`: subconjuntos de caracteres (`latin`, `latin-ext`, etc.).
   - `outputDir`: carpeta raíz de salida.
   - `generateOptionsFile` y `optionsFilePath`: controlan la creación de `font-options.ts`.
2. Ejecuta `npm run download` para aplicar la configuración.

La herramienta respetará los formatos disponibles en Google Fonts; si un formato no existe, se elegirá automáticamente el siguiente mejor (`woff2 → woff → ttf`) mostrando una advertencia.

## 🧰 CLI bajo demanda

Cuando necesites descargas puntuales, usa la CLI `mass-fonts` sin tocar la configuración:

```bash
# Durante el desarrollo
npm run cli -- --fonts "Roboto:400,700;Poppins:400" --output "output/fonts" --ts "output/font-options.ts" --subset latin --formats woff2,woff

# Con npx (sin instalación global)
npx mass-fonts --fonts "Inter:all" --all --output "output/fonts"
```

Si ejecutas la CLI dentro de un proyecto que tenga `config/fonts.config.js`, puedes omitir `--fonts`
para reutilizar todas las familias, formatos y nomenclatura definidas allí. Por ejemplo:

```bash
npx mass-fonts --all --output "output/fonts"
```

También puedes apuntar a otro archivo con `--config ./mi-config.js`.

### Parámetros principales

| Opción | Descripción | Valor por defecto |
| --- | --- | --- |
| `-f, --fonts <fonts>` | Familias y pesos separados por `;` y `,` (opcional si hay config). | — |
| `-o, --output <dir>` | Carpeta raíz donde se guardarán las fuentes. | `output/fonts` o `config.outputDir` |
| `--ts <file>` | Ruta del archivo `font-options.ts` a generar. | Config o — |
| `--subset <subset>` | Subconjunto(s) de caracteres (`latin`, `latin-ext`, ...). | `latin` o `config.subsets` |
| `--formats <formats>` | Formatos separados por coma (`woff2`, `woff`, `ttf`). | `config.formats` o `woff2` |
| `--weights <weights>` | Sobrescribe los pesos para todas las familias (`regular,semibold,bold`). | — |
| `--config <file>` | Ruta del archivo de configuración a reutilizar. | `config/fonts.config.js` si existe |
| `--all` | Descarga todas las variantes disponibles para cada familia. | `false` |
| `--debug` | Muestra logs detallados de la petición y cada descarga. | `false` |

> Consejo: combina `--debug` con la variable `MASS_FONTS_DEBUG=1` para inspeccionar respuestas crudas en pipelines CI.

Los pesos pueden declararse tanto en formato numérico (`400`, `500`, `700`) como textual (`regular`, `medium`, `semibold`, `bold`, `black`).
La opción `--weights` acepta los mismos alias y, cuando se usa junto con `--config` (o el archivo por defecto), reemplaza los pesos definidos allí.
La opción `--all` ignora la lista explícita y trae todas las variantes publicadas por Google Fonts (incluyendo itálicas cuando existan).

## 📁 Estructura de salida

```
output/
└── fonts/
    ├── roboto/
    │   ├── Roboto-Regular.woff2
    │   ├── Roboto-RegularItalic.woff2
    │   └── Roboto-Bold.woff2
    └── poppins/
        ├── Poppins-Regular.woff2
        ├── Poppins-SemiBold.woff2
        └── Poppins-Bold.woff2
```

Si `generateOptionsFile` está activo, se producirá un `font-options.ts` similar a:

```ts
export const FONT_OPTIONS = [
  {
    name: 'Roboto',
    folder: 'roboto',
    files: ['Roboto-Regular.woff2', 'Roboto-RegularItalic.woff2', 'Roboto-Bold.woff2']
  }
];
```

## 🤖 Automatización y CI/CD

- Añade `npm run download` a tu pipeline (GitHub Actions, GitLab CI, etc.) para materializar fuentes antes del build.
- Usa `npx mass-fonts` con los parámetros necesarios en scripts de despliegue.
- Activa `--debug` para obtener visibilidad en entornos donde el acceso a Google Fonts pueda estar restringido.

## 🧪 Pruebas

```bash
npm test
```

Las pruebas basadas en `node --test` cubren el parsing del CSS de Google Fonts, la detección de variantes (incluyendo itálicas) y la normalización de nombres de archivo.

## 🧱 Estructura del proyecto

```
📦 mass-font-downloader
 ┣ 📂 bin
 ┣ 📂 config
 ┣ 📂 lib
 ┣ 📂 scripts
 ┣ 📂 tests
 ┣ 📂 assets
 ┣ 📜 README.md
 ┣ 📜 CHANGELOG.md
 ┗ 📜 package.json
```

## 🤝 Contribuciones

¿Encontraste un caso de uso nuevo o un bug? Abre un issue o envía un PR. Las contribuciones son bienvenidas.

## 📄 Licencia

MIT © 2025 AlvaroMaxter
