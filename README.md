# Mass Font Downloader

Script/CLI en Node.js para descargar masivamente fuentes de Google Fonts, renombrarlas por tipografía y peso, y (opcionalmente) generar un archivo `font-options.ts` listo para importar en tus proyectos.

## 🚀 Características

- Descarga múltiples familias y pesos de Google Fonts en una sola ejecución.
- Renombra automáticamente los archivos siguiendo el patrón `<familia>-<peso>.<ext>` (según el formato elegido).
- Guarda cada familia en su propia carpeta dentro de un directorio de salida.
- Genera (opcionalmente) un archivo TypeScript con las fuentes descargadas, útil para selectores o componentes dinámicos.
- Se puede usar tanto mediante un script configurado por archivo (`config/fonts.config.js`) como con la CLI `mass-fonts`.

## 📦 Requisitos previos

- [Node.js](https://nodejs.org/) 18 o superior (el proyecto usa módulos ES).
- Acceso a internet para consultar Google Fonts y descargar los archivos `.woff2`, `.woff` o `.ttf`.

## 🛠 Instalación

```bash
# Instala las dependencias
npm install
```

## ⚙️ Configuración por archivo (`scripts/download-fonts.js`)

1. Edita `config/fonts.config.js` para definir:
   - `fonts`: lista de familias y pesos a descargar.
     - Usa un array de pesos (`weights: [400, 700]`) para controlar manualmente qué variantes quieres.
     - Establece `weights: "all"`, `weights: "*"` o la bandera `downloadAllVariants: true` para descargar **todas** las variantes disponibles (incluidas las itálicas cuando existan).
   - `formats`: formatos globales a descargar (`woff2`, `woff`, `ttf`). Si no indicas nada, se usarán `['woff2']`.
   - `subsets`: subconjuntos de caracteres (por defecto `latin`).
   - `outputDir`: carpeta de salida donde se guardarán las fuentes.
   - `generateOptionsFile`: `true` para generar `font-options.ts`.
   - `optionsFilePath`: ruta donde se escribirá ese archivo TypeScript.

   ```js
  export default {
    formats: ["woff2"],
    fonts: [
      { name: "Roboto", weights: [400, 700], formats: ["woff2", "woff"] },
      { name: "Poppins", weights: [400, 600, 700] },
      { name: "Inter", weights: "all" }, // todas las variantes disponibles
      { name: "Playfair Display", downloadAllVariants: true } // bandera alternativa
    ],
    subsets: ["latin"],
    outputDir: "output/fonts",
    generateOptionsFile: true,
    optionsFilePath: "output/font-options.ts"
  };
   ```

   > Si una familia necesita formatos distintos, declara `formats` dentro de su objeto. Ese array reemplaza al valor global (`formats` en la raíz); si lo omites se usará el predeterminado.

2. Ejecuta el script:

   ```bash
   npm run download
   # o
   npm start
   ```

El script descargará las fuentes y, si está activado, generará el archivo `font-options.ts` con un export `FONT_OPTIONS`.

## 🧰 Uso de la CLI (`bin/mass-fonts.js`)

La CLI permite lanzar descargas ad hoc sin tocar la configuración.

```bash
# Opción 1: usando npm (recomendado durante el desarrollo)
npm run cli -- --fonts "Roboto:400,700;Poppins:400" --output "output/fonts" --ts "output/font-options.ts" --subset latin --formats woff2,woff

# Opción 2: usando npx directamente
npx mass-fonts --fonts "Inter:400,500,700" --output "output/fonts" --subset latin-ext --formats woff2

# Descargar todas las variantes de una familia (incluyendo itálicas si existen)
npx mass-fonts --fonts "Roboto:all" --all --output "output/fonts"
```

### Parámetros disponibles

| Opción | Descripción | Valor por defecto |
| --- | --- | --- |
| `-f, --fonts <fonts>` | Familias y pesos separados por `;` y `,` (ej. `"Roboto:400,700;Poppins:400"`). **Obligatorio.** | — |
| `-o, --output <dir>` | Carpeta de salida raíz. | `output/fonts` |
| `--ts <file>` | Ruta del archivo `font-options.ts` a generar. | no genera archivo |
| `--subset <subset>` | Subconjunto de caracteres (`latin`, `latin-ext`, `cyrillic`, etc.). | `latin` |
| `--formats <formats>` | Formatos separados por coma (`woff2`, `woff`, `ttf`). | `woff2` |
| `--all` | Descarga todas las variantes disponibles (combina pesos e itálicas automáticamente). | `false` |
| `--debug` | Imprime trazas detalladas para depurar la descarga (puedes combinarlo con la variable `MASS_FONTS_DEBUG`). | `false` |

> **Nota:** Cada familia se almacenará dentro de una subcarpeta con el nombre en minúsculas y espacios reemplazados por guiones (`poppins`, `open-sans`, etc.).

> También puedes indicar `all` o `*` directamente en la definición de cada familia (`--fonts "Roboto:all"`) para forzar la descarga completa sin usar la bandera global.

### Ejecutar la CLI vía `npx`

El paquete publica un binario llamado `mass-fonts`, de modo que puedes invocarlo directamente sin instalarlo de forma permanente:

```bash
npx mass-fonts --help
npx mass-fonts --fonts "Inter:all" --all --output "output/fonts"
npx mass-fonts --fonts "Inter:all" --all --debug --output "output/fonts"
```

> Cuando el paquete aún no está publicado y quieres validar el comando localmente, ejecuta `npm link` en la raíz del proyecto para que `npx` (o el propio `mass-fonts`) resuelvan el binario desde tu copia de trabajo.

### Depuración avanzada

- Agrega `--debug` a la CLI para ver la query final enviada a Google Fonts, las variantes detectadas y cada URL descargada.
- Si usas el script de configuración, define `MASS_FONTS_DEBUG=1` (o cualquier valor truthy) antes del comando: `MASS_FONTS_DEBUG=1 npm run download`.
- Al fallar una descarga, la CLI mostrará el mensaje de error resumido; con `--debug` se imprimirá el objeto de error completo.

## 📁 Estructura de salida

Después de ejecutar una descarga, el directorio de salida tendrá este aspecto:

```
output/
└── fonts/
    ├── roboto/
    │   ├── roboto-400.woff2
    │   ├── roboto-400-italic.woff2
    │   └── roboto-700.woff2
    └── poppins/
        ├── poppins-400.woff2
        ├── poppins-600.woff2
        └── poppins-700.woff2
```

Si activaste la generación del archivo TypeScript, se creará también:

```ts
// ⚡️ Generated automatically by mass-font-downloader
export const FONT_OPTIONS = [
  {
    "name": "Roboto",
    "folder": "roboto",
    "files": ["roboto-400.woff2", "roboto-400-italic.woff2", "roboto-700.woff2"]
  },
  {
    "name": "Poppins",
    "folder": "poppins",
    "files": ["poppins-400.woff2", "poppins-600.woff2", "poppins-700.woff2"]
  }
];
```

## 🔧 Personalización adicional

- **Añadir más subconjuntos:** Agrega valores en `subsets` (ej. `['latin', 'latin-ext']`).
- **Cambiar formato de archivo:** Controla los formatos desde la propiedad `formats` del config (global o por familia) o la opción `--formats` en la CLI. Los valores válidos son `woff2`, `woff` y `ttf`. Si Google Fonts no ofrece el formato solicitado, la herramienta elige automáticamente el siguiente disponible (prioriza `woff2` → `woff` → `ttf`) y te avisa con una advertencia.
- **Descargar todo el set de variantes:** Usa `weights: "all"`, `downloadAllVariants: true` o la opción `--all` para obtener todas las combinaciones de peso/estilo. Los archivos itálicos se renombran como `<familia>-<peso>-italic.<ext>`.
- **Evitar la generación de TypeScript:** Pon `generateOptionsFile: false` en la configuración o no pases `--ts` en la CLI.

## 🧪 Consejos y resolución de problemas

- **No se descargan fuentes:** verifica que la familia exista en Google Fonts y que los pesos solicitados estén disponibles.
- **Errores de red (`403` o `404`):** Google Fonts requiere un `User-Agent` válido; el script ya envía uno, pero asegúrate de que tu red no bloquee las solicitudes.
- **Duplicados:** si una fuente ya existe, no se vuelve a descargar; simplemente se reutiliza el archivo existente.
- **Carpetas vacías:** si una familia no devuelve URLs válidas, se mostrará una advertencia y no se crearán archivos.

## ✅ ¿Cómo validar el desarrollo?

Ejecuta la batería de pruebas unitarias para verificar los helpers principales que alimentan tanto el script como la CLI:

```bash
npm test
```

Las pruebas usan el runner nativo de Node.js (`node --test`) y cubren la normalización de formatos, el parseo de CSS devuelto por Google Fonts, la resolución de variantes (incluyendo itálicas) y la construcción de nombres de archivo y queries.

Además de los tests, puedes ejecutar rápidamente la CLI en modo ayuda para confirmar que las opciones estén disponibles:

```bash
npm run cli -- --help
```

## 🤖 Integración en flujos automatizados

- Invoca el script desde npm (`npm run download`) dentro de tu pipeline (GitHub Actions, GitLab CI, etc.).
- Usa la CLI con los parámetros que necesites, por ejemplo:
  ```bash
  npx mass-fonts --fonts "Inter:400,500" --output "build/fonts" --subset latin --ts "src/font-options.ts" --formats woff2
  ```
- Si deseas usar la lógica desde otro archivo Node.js, puedes copiar/adaptar la función `downloadFonts` que se define en `scripts/download-fonts.js` o refactorizarla para exportarla según tus necesidades.

## 📄 Licencia de las fuentes

Este proyecto solo automatiza la descarga de los archivos hospedados en Google Fonts. Revisa las licencias de cada familia antes de distribuirlas o usarlas en proyectos comerciales.

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Abre un issue o PR con mejoras, correcciones o nuevas características. Crea un issue para seguir mejorando esta herramienta.

## 📝 Licencia
MIT © 2025 AlvaroMaxter
